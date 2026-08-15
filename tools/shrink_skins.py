# -*- coding: utf-8 -*-
"""
무늬 스킨 GLB 의 텍스처를 줄인다.

왜 직접 다루나
  이 환경에는 @gltf-transform 도 sharp 도 없다(오프라인일 수 있어 새로 안 깐다).
  GLB 는 어려운 형식이 아니다 — 헤더 12바이트 + 청크들이고, 청크는 4바이트 길이 +
  4바이트 종류 + 내용이다. JSON 청크의 `images[]` 가 `bufferViews[]` 를 가리키고
  거기 PNG 바이트가 통째로 들어 있다. 그 바이트만 PIL 로 줄여 도로 넣고,
  bufferView 의 byteOffset/byteLength 와 청크 길이를 다시 계산하면 끝이다.

⚠ 원본을 절대 안 지운다. `--out` 폴더에 새로 쓴다.

쓰는 법
  python tools/shrink_skins.py --scan                     # 지금 뭐가 들었나만 본다
  python tools/shrink_skins.py --size 512 --fmt jpeg --quality 88 --out assets/monstera/skins_small
  python tools/shrink_skins.py --only mon_charcoal_v1     # 한 장만 (견줘 보기용)
"""
import argparse, glob, io, json, os, struct, sys

from PIL import Image

GLB_MAGIC = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942


# ── GLB 읽기/쓰기 ────────────────────────────────────────────────
def glb_read(path):
    with open(path, 'rb') as f:
        data = f.read()
    magic, ver, total = struct.unpack_from('<III', data, 0)
    if magic != GLB_MAGIC:
        raise ValueError(f'{path}: GLB 가 아니다')
    off, js, bin_ = 12, None, b''
    while off < min(total, len(data)):
        clen, ctype = struct.unpack_from('<II', data, off)
        body = data[off + 8: off + 8 + clen]
        if ctype == CHUNK_JSON:
            js = json.loads(body.decode('utf-8'))
        elif ctype == CHUNK_BIN:
            bin_ = body
        off += 8 + clen + ((-clen) % 4)
    if js is None:
        raise ValueError(f'{path}: JSON 청크가 없다')
    return js, bytearray(bin_)


def glb_write(path, js, bin_):
    jb = json.dumps(js, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    jb += b' ' * ((-len(jb)) % 4)                      # JSON 은 공백으로 채운다
    bb = bytes(bin_) + b'\x00' * ((-len(bin_)) % 4)    # BIN 은 0 으로 채운다
    total = 12 + 8 + len(jb) + (8 + len(bb) if bb else 0)
    out = bytearray()
    out += struct.pack('<III', GLB_MAGIC, 2, total)
    out += struct.pack('<II', len(jb), CHUNK_JSON) + jb
    if bb:
        out += struct.pack('<II', len(bb), CHUNK_BIN) + bb
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with open(path, 'wb') as f:
        f.write(out)
    return total


# ── 이미지 하나 ──────────────────────────────────────────────────
def image_bytes(js, bin_, img):
    """images[i] 의 실제 바이트. bufferView 방식만 다룬다(uri 는 이 저장소에 없다)."""
    if 'bufferView' not in img:
        return None
    bv = js['bufferViews'][img['bufferView']]
    o = bv.get('byteOffset', 0)
    return bytes(bin_[o: o + bv['byteLength']])


def shrink_one(raw, size, fmt, quality):
    """PNG/JPEG 바이트 → 줄인 바이트, (원래크기, 새크기, 알파있나)"""
    im = Image.open(io.BytesIO(raw))
    im.load()
    w, h = im.size
    has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    if has_alpha:
        # 알파가 실제로 쓰이나 — 전부 255 면 없는 것과 같다
        a = im.convert('RGBA').getchannel('A')
        if a.getextrema() == (255, 255):
            has_alpha = False
    nw, nh = (size, size) if (w >= size or h >= size) else (w, h)
    if (w, h) != (nw, nh):
        im = im.resize((nw, nh), Image.LANCZOS)
    buf = io.BytesIO()
    f = fmt.lower()
    if f == 'jpeg' and has_alpha:
        f = 'webp'                                     # ⚠ 알파가 있으면 JPEG 는 못 쓴다
    if f == 'jpeg':
        im.convert('RGB').save(buf, 'JPEG', quality=quality, optimize=True, subsampling=0)
        mime = 'image/jpeg'
    elif f == 'webp':
        im.save(buf, 'WEBP', quality=quality, method=6)
        mime = 'image/webp'
    else:
        im.convert('RGBA' if has_alpha else 'RGB').save(buf, 'PNG', optimize=True)
        mime = 'image/png'
    return buf.getvalue(), (w, h), (nw, nh), has_alpha, mime


def image_roles(js):
    """images[i] 가 무엇에 쓰이나 — baseColor / normal / metalRough.

    ⚠ **normal·metalRough 를 baseColor 와 같이 다루면 안 된다.** 법선은 색이 아니라
      방향이고, JPEG 로 뭉개면 빛이 이상해진다. 무늬(=baseColor)와 갈라서 다룬다.
      다행히 이 저장소에서 그 둘은 원래도 작다(실측 0.04·0.45MB)."""
    role = {}
    for m in js.get('materials', []):
        pbr = m.get('pbrMetallicRoughness', {}) or {}
        def put(t, name):
            if t is None:
                return
            src = js['textures'][t['index']].get('source')
            if src is not None:
                role.setdefault(src, name)
        put(pbr.get('baseColorTexture'), 'baseColor')
        put(pbr.get('metallicRoughnessTexture'), 'metalRough')
        put(m.get('normalTexture'), 'normal')
        put(m.get('occlusionTexture'), 'occlusion')
        put(m.get('emissiveTexture'), 'emissive')
    return role


def process(path, out_path, size, fmt, quality):
    js, bin_ = glb_read(path)
    imgs = js.get('images') or []
    if not imgs:
        return None
    roles = image_roles(js)

    # bufferView 를 통째로 다시 깐다 — 이미지 것만 갈아치우고 나머지는 그대로 옮긴다
    new_bin = bytearray()
    report = []
    for bvi, bv in enumerate(js.get('bufferViews', [])):
        bv['_keep'] = bytes(bin_[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']])

    for i, img in enumerate(imgs):
        raw = image_bytes(js, bin_, img)
        if raw is None:
            continue
        rl = roles.get(i, 'baseColor')
        if rl == 'baseColor':
            small, was, now, alpha, mime = shrink_one(raw, size, fmt, quality)
        else:
            # 무늬가 아니다 — 절반 크기 · 손실 없는 PNG. 원래도 작아서 값이 싸다
            small, was, now, alpha, mime = shrink_one(raw, max(256, size // 2), 'png', 100)
        js['bufferViews'][img['bufferView']]['_keep'] = small
        img['mimeType'] = mime
        report.append(dict(idx=i, role=rl, before=len(raw), after=len(small),
                           wh=was, new_wh=now, alpha=alpha, mime=mime))

    # 다시 깔기 (4바이트 정렬)
    for bv in js['bufferViews']:
        blob = bv.pop('_keep')
        pad = (-len(new_bin)) % 4
        new_bin += b'\x00' * pad
        bv['byteOffset'] = len(new_bin)
        bv['byteLength'] = len(blob)
        new_bin += blob
    if js.get('buffers'):
        js['buffers'][0]['byteLength'] = len(new_bin) + ((-len(new_bin)) % 4)
        js['buffers'][0].pop('uri', None)

    total = glb_write(out_path, js, new_bin)
    return dict(file=os.path.basename(path), before=os.path.getsize(path),
                after=total, images=report)


def first_texture(path):
    """그 GLB 의 baseColor 텍스처 하나를 PIL 이미지로."""
    js, bin_ = glb_read(path)
    mats = js.get('materials') or []
    idx = 0
    for m in mats:                                     # baseColor 를 쓰는 이미지를 고른다
        t = (m.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
        if t is not None:
            tex = js['textures'][t['index']]
            idx = tex.get('source', 0)
            break
    raw = image_bytes(js, bin_, js['images'][idx])
    im = Image.open(io.BytesIO(raw)); im.load()
    return im.convert('RGB')


def count_colors(im):
    return len(im.getcolors(maxcolors=im.size[0] * im.size[1] + 1) or [])


def count_coarse(im, bits=5):
    """★ 굵은 색 가짓수 — 채널마다 위 `bits` 비트만 본다.

    그냥 센 색 가짓수는 **줄이면 오히려 는다**(LANCZOS 가 중간색을 만든다) —
    그래서 그것만으로는 「무늬가 살았나」를 못 가린다. 무늬는 **색의 갈래**지
    잡티가 아니므로, 아래 비트를 버리고 세면 잡티가 빠지고 갈래만 남는다.
    (까만 그림은 여기서도 한 가지로 무너진다 — 자로서의 성질은 그대로다)"""
    sh = 8 - bits
    q = im.point(lambda v: (v >> sh) << sh)
    return len(q.getcolors(maxcolors=q.size[0] * q.size[1] + 1) or [])


def psnr(a, b):
    import math
    if a.size != b.size:
        b = b.resize(a.size, Image.LANCZOS)
    pa, pb = a.tobytes(), b.tobytes()
    s = 0
    for x, y in zip(pa, pb):
        d = x - y
        s += d * d
    mse = s / len(pa)
    return 99.0 if mse == 0 else 10 * math.log10(255 * 255 / mse)


def cmd_count(a):
    """★ 무늬가 죽었나 — 색 가짓수를 센다 (START-HERE §2.9-③).

    셋을 나란히 놓는다. 그래야 「줄여서 죽은 것」과 「형식 때문에 죽은 것」이 갈린다.
      ① 원본 2048
      ② 원본을 그냥 N 으로 줄인 것 (형식 손실 없음 — 줄이기만의 몫)
      ③ 실제로 만든 파일 (줄이기 + 형식)
    """
    src = sorted(glob.glob(os.path.join(a.src, '*.glb')))
    if a.only:
        src = [f for f in src if a.only in os.path.basename(f)]
    print('갈래\t원본2048\t만든것\t굵은색_원본\t굵은색_만든것\tPSNR(dB)')
    for p in src:
        q = os.path.join(a.out, os.path.basename(p))
        if not os.path.exists(q):
            continue
        o = first_texture(p)
        n = first_texture(q)
        od = o.resize(n.size, Image.LANCZOS) if o.size != n.size else o
        print(f'{os.path.basename(p)[:-4]}\t{count_colors(o)}\t{count_colors(n)}\t'
              f'{count_coarse(o)}\t{count_coarse(n)}\t{psnr(od, n):.1f}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='assets/monstera/skins')
    ap.add_argument('--out', default='assets/monstera/skins_small')
    ap.add_argument('--size', type=int, default=512)
    ap.add_argument('--fmt', default='jpeg', choices=['png', 'jpeg', 'webp'])
    ap.add_argument('--quality', type=int, default=88)
    ap.add_argument('--only', default=None)
    ap.add_argument('--scan', action='store_true')
    ap.add_argument('--count', action='store_true')
    a = ap.parse_args()

    if a.count:
        cmd_count(a)
        return

    files = sorted(glob.glob(os.path.join(a.src, '*.glb')))
    if a.only:
        files = [f for f in files if a.only in os.path.basename(f)]

    if a.scan:
        rows = []
        for p in files:
            js, bin_ = glb_read(p)
            for i, img in enumerate(js.get('images') or []):
                raw = image_bytes(js, bin_, img)
                if raw is None:
                    rows.append((os.path.basename(p), i, 'uri', '', '', ''))
                    continue
                im = Image.open(io.BytesIO(raw))
                alpha = im.mode in ('RGBA', 'LA')
                if alpha:
                    alpha = im.convert('RGBA').getchannel('A').getextrema() != (255, 255)
                rows.append((os.path.basename(p), i, im.format, f'{im.size[0]}x{im.size[1]}',
                             im.mode, f'{len(raw)/1048576:.2f}MB', '알파O' if alpha else '알파X'))
        for r in rows:
            print('\t'.join(str(x) for x in r))
        print(f'# GLB {len(files)}개 · 이미지 {len(rows)}장')
        return

    tot_b = tot_a = 0
    for p in files:
        out_p = os.path.join(a.out, os.path.basename(p))
        r = process(p, out_p, a.size, a.fmt, a.quality)
        if r is None:
            # 이미지가 없는 GLB 는 그냥 복사한다(빠지면 안 된다)
            os.makedirs(a.out, exist_ok=True)
            with open(p, 'rb') as f1, open(out_p, 'wb') as f2:
                f2.write(f1.read())
            r = dict(file=os.path.basename(p), before=os.path.getsize(p),
                     after=os.path.getsize(out_p), images=[])
        tot_b += r['before']; tot_a += r['after']
        print(f"{r['file']}\t{r['before']/1048576:.2f}\t{r['after']/1048576:.2f}\t"
              f"{','.join(str(i['mime'].split('/')[1]) + ' ' + 'x'.join(map(str,i['new_wh'])) + ('+A' if i['alpha'] else '') for i in r['images'])}")
    print(f"# 합계 {len(files)}개 · {tot_b/1048576:.1f}MB → {tot_a/1048576:.1f}MB "
          f"({100*tot_a/tot_b:.1f}%)")


if __name__ == '__main__':
    main()
