"""tools/glb_tex_webp.py — GLB 안의 텍스처를 webp 로 줄여 새 GLB 로 쓴다 ([house] · 2026-10-09)

    python -I tools/glb_tex_webp.py <raw.glb> <out.glb> [--max 1024] [--q 82]

왜: v2 가구(0aa8b850)는 gltf-transform 으로 «텍스처 1024 webp»를 했는데 그 자가 저장소에 없다(전역 설치였다).
    Meshy raw 는 2K jpeg 가 GLB 안에 묻혀 온다(2~4MB). 폰 첫 화면을 안 늦추게 같은 판(1024 · webp · EXT_texture_webp)으로 줄인다.
무엇을 바꾸나: 이미지 bufferView 바이트만 갈고, 나머지 bufferView 는 그대로 옮긴다(4바이트 맞춤).
    textures[].source → extensions.EXT_texture_webp.source · extensionsUsed/Required 에 EXT_texture_webp.
    기하·재질·노드는 한 바이트도 안 건드린다.
"""
import io, json, struct, sys
from PIL import Image


def read_glb(p):
    b = open(p, 'rb').read()
    magic, ver, total = struct.unpack_from('<III', b, 0)
    assert magic == 0x46546C67, 'GLB 가 아니다'
    off, js, bins = 12, None, None
    while off < total:
        ln, ty = struct.unpack_from('<II', b, off)
        chunk = b[off + 8: off + 8 + ln]
        if ty == 0x4E4F534A: js = json.loads(chunk.decode('utf-8'))
        elif ty == 0x004E4942: bins = chunk
        off += 8 + ln
    return js, bins


def write_glb(p, js, bins):
    j = json.dumps(js, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    j += b' ' * ((4 - len(j) % 4) % 4)
    bins += b'\0' * ((4 - len(bins) % 4) % 4)
    total = 12 + 8 + len(j) + 8 + len(bins)
    with open(p, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(j), 0x4E4F534A)); f.write(j)
        f.write(struct.pack('<II', len(bins), 0x004E4942)); f.write(bins)


def main():
    a = sys.argv[1:]
    src, dst = a[0], a[1]
    mx = int(a[a.index('--max') + 1]) if '--max' in a else 1024
    q = int(a[a.index('--q') + 1]) if '--q' in a else 82
    js, bins = read_glb(src)
    img_views = {}
    for i, im in enumerate(js.get('images', [])):
        if 'bufferView' not in im: continue
        bv = js['bufferViews'][im['bufferView']]
        raw = bins[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
        pic = Image.open(io.BytesIO(raw)); pic.load()
        has_alpha = pic.mode in ('RGBA', 'LA') or (pic.mode == 'P' and 'transparency' in pic.info)
        pic = pic.convert('RGBA' if has_alpha else 'RGB')
        w0, h0 = pic.size
        if max(w0, h0) > mx:
            k = mx / max(w0, h0); pic = pic.resize((max(1, round(w0 * k)), max(1, round(h0 * k))), Image.LANCZOS)
        out = io.BytesIO(); pic.save(out, 'WEBP', quality=q, method=6)
        img_views[im['bufferView']] = out.getvalue()
        im['mimeType'] = 'image/webp'
        print(f'  그림 {i}: {w0}x{h0} {len(raw)//1024}KB → {pic.size[0]}x{pic.size[1]} webp {len(out.getvalue())//1024}KB')
    nb = bytearray()
    for vi, bv in enumerate(js['bufferViews']):
        data = img_views.get(vi)
        if data is None:
            o = bv.get('byteOffset', 0); data = bins[o: o + bv['byteLength']]
        while len(nb) % 4: nb.append(0)
        bv['byteOffset'] = len(nb); bv['byteLength'] = len(data); bv['buffer'] = 0
        nb += data
    js['buffers'] = [{'byteLength': len(nb)}]
    for t in js.get('textures', []):
        if 'source' in t:
            s = t.pop('source'); t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': s}
    for k in ('extensionsUsed', 'extensionsRequired'):
        lst = js.setdefault(k, [])
        if 'EXT_texture_webp' not in lst: lst.append('EXT_texture_webp')
    write_glb(dst, js, bytes(nb))
    import os
    print(f'  {os.path.getsize(src)//1024}KB → {os.path.getsize(dst)//1024}KB  {dst}')


if __name__ == '__main__':
    main()
