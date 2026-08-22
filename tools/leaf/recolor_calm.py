# -*- coding: utf-8 -*-
"""tools/leaf/recolor_calm.py — 차분판(_v2) 을 다시 만든다 (2026-08-23 · leaf)

   PYTHONIOENCODING=utf-8 python tools/leaf/recolor_calm.py            ← 표대로 여덟 장
   PYTHONIOENCODING=utf-8 python tools/leaf/recolor_calm.py <갈래이름>  ← 한 장만

⚠ 왜 있나 — 원래 차분 규칙이 **색상을 -40도** 돌렸다. 진초록(140도)은 100도라 여전히 초록인데
  **연두(72~100도)는 32~60도, 곧 갈색**이 된다. 그래서 여덟 장이 삭은 잎으로 게임에 나갔다.

★ 이 자를 세 번 고쳤다. 고친 과정을 지우지 않고 적는다(`docs/assets/leaf_colorway_audit.md`):
   1판 — 삭은 띠로 갈 화소만 반대로 돌렸다.  ⇒ 잎 전체가 연두인 것에는 맞았는데
          **금 무늬 조각**이 겨자로 삭았다(금은 이 게임의 정식 색이다).
   2판 — 금을 지켰다.  ⇒ 무늬는 살았는데 **잎 전체가 연두인 것이 통째로 「금」으로 잡혀
          아무것도 안 바뀌었다.**
   3판 — 면적으로 갈랐다(금이 넓으면 바탕이니 돌린다).  ⇒ `variegata_gold` 가 **빨강**이 됐다.
   ⇒ ★ **한 자로 다 안 된다. 여덟 장이면 갈래마다 골라 주는 것이 맞다.** 아래 `PICK` 이 그 표다.
     **눈으로 보고 골랐다.** 숫자로 고른 것이 아니다.

⚠ 되돌리려면 `assets/monstera/skins/_orig/` 에 원본이 있다.
"""
import json, struct, io, os, sys
import numpy as np
from PIL import Image

GLB, CJ, CB = 0x46546C67, 0x4E4F534A, 0x004E4942
ROT, SAT, VAL = -40.0, 0.55, 0.96
GOLDSAT = 0.82        # ★ 금은 덜 뺀다
DEAD = (10.0, 55.0)          # 벽돌·녹·주황·겨자·갈색 = 삭은 색

def read(p):
    d = open(p, 'rb').read()
    assert d[:4] == b'glTF', p
    off, js, bb = 12, None, b''
    while off < len(d):
        ln, ty = struct.unpack_from('<II', d, off)
        ch = d[off+8:off+8+ln]
        if ty == CJ: js = json.loads(ch.decode('utf-8'))
        elif ty == CB: bb = ch
        off += 8 + ln
    return js, bb

def write(p, js, bb):
    s = json.dumps(js, separators=(',', ':')).encode('utf-8')
    s += b' ' * ((4 - len(s) % 4) % 4)          # JSON 은 공백으로 채운다
    b = bb + b'\x00' * ((4 - len(bb) % 4) % 4)  # BIN 은 0 으로 채운다
    total = 12 + 8 + len(s) + (8 + len(b) if b else 0)
    with open(p, 'wb') as f:
        f.write(struct.pack('<III', GLB, 2, total))
        f.write(struct.pack('<II', len(s), CJ)); f.write(s)
        if b: f.write(struct.pack('<II', len(b), CB)); f.write(b)

def to_hsv(a):
    mx = a.max(2); mn = a.min(2); df = mx - mn
    h = np.zeros_like(mx); nz = df > 1e-6
    r, g, bl = a[..., 0], a[..., 1], a[..., 2]
    i = (mx == r) & nz; h[i] = (60*((g[i]-bl[i])/df[i])) % 360
    i = (mx == g) & nz; h[i] = 60*((bl[i]-r[i])/df[i]) + 120
    i = (mx == bl) & nz; h[i] = 60*((r[i]-g[i])/df[i]) + 240
    s = np.where(mx > 0, df/np.maximum(mx, 1e-6), 0)
    return h % 360, s, mx

def to_rgb(h, s, v):
    h = h % 360; c = v*s; x = c*(1-np.abs((h/60.0) % 2 - 1)); m = v - c
    z = np.zeros_like(h); out = np.zeros(h.shape+(3,))
    seg = (h//60).astype(int) % 6
    tab = [(c, x, z), (x, c, z), (z, c, x), (z, x, c), (x, z, c), (c, z, x)]
    for k, (R, G, B) in enumerate(tab):
        i = seg == k
        out[..., 0][i] = R[i] if hasattr(R, 'shape') else R
        out[..., 1][i] = G[i] if hasattr(G, 'shape') else G
        out[..., 2][i] = B[i] if hasattr(B, 'shape') else B
    return np.clip(out + m[..., None], 0, 1)

def indead(h):
    return (h >= DEAD[0]) & (h <= DEAD[1])

def recolor(img, mode=3):
    """3판.
       1판 — 색상만 -40 도 돌렸다. 잎 **전체**가 연두인 것에는 맞는데,
              금 **무늬 조각**이 따로 있는 것은 그 금이 겨자로 삭았다.
       2판 — 금을 통째로 지켰다. 무늬 조각은 살았는데,
              잎 **전체**가 연두인 것은 온통 「금」으로 잡혀 **아무것도 안 바뀌었다**.
       ⇒ 3판 — **갈림은 면적이다.** 금이 잎의 바탕이면 돌리고, 무늬 조각이면 지킨다."""
    a = np.asarray(img.convert('RGB'), dtype=float)/255.0
    h, s, v = to_hsv(a)
    colored = s > 0.12
    rust   = (h >= 10) & (h < 40)                 # 벽돌·녹·주황 — 줄기·흙. 늘 그대로 둔다
    goldpx = (h >= 40) & (h < 70) & (s > 0.25)    # 금·노랑
    lowsat = s < 0.06
    frac = goldpx[colored].mean() if colored.any() else 0.0
    #  ★ 금이 잎의 바탕이면(넓으면) 「지킬 무늬」가 아니라 「바탕색」이다 → 돌린다
    if   mode == 1: gold = np.zeros_like(goldpx)          # 금도 돌린다
    elif mode == 2: gold = goldpx                        # 금은 늘 지킨다
    else:           gold = goldpx if frac < 0.40 else np.zeros_like(goldpx)
    keep = rust | gold | lowsat
    h1 = (h + ROT) % 360
    push = indead(h1) & (~keep)                   # 삭은 띠로 들어간 것만 반대로 돌린다
    h1 = np.where(push, (h + abs(ROT)) % 360, h1)
    h1 = np.where(keep, h, h1)
    sat = np.where(gold, s*GOLDSAT, s*SAT)        # 지킨 금은 덜 뺀다 — 안 그러면 겨자가 된다
    out = to_rgb(h1, np.clip(sat, 0, 1), np.clip(v*VAL, 0, 1))
    return Image.fromarray((out*255+0.5).astype(np.uint8)), int(push.sum()), push.size, float(frac)

def redo(base, out, mode=3, _fn=None):
    js, bb = read(base)
    imgidx = {im['bufferView'] for im in js.get('images', []) if 'bufferView' in im}
    assert imgidx, base + ' 에 이미지가 없다'
    news = {}
    pushed = tot = 0; fr = 0.0
    for im in js['images']:
        bv = js['bufferViews'][im['bufferView']]
        s0 = bv.get('byteOffset', 0)
        raw = bb[s0:s0+bv['byteLength']]
        pil = Image.open(io.BytesIO(raw))
        fmt = 'JPEG' if 'jpeg' in (im.get('mimeType') or '') else 'PNG'
        newim, p, t, frac = (_fn(pil) if _fn else recolor(pil, mode)); pushed += p; tot += t; fr = frac
        buf = io.BytesIO()
        if fmt == 'JPEG': newim.save(buf, 'JPEG', quality=92, optimize=True)
        else: newim.save(buf, 'PNG', optimize=True)
        news[im['bufferView']] = buf.getvalue()
    # BIN 을 통째로 다시 깐다 (4바이트 정렬)
    order = sorted(range(len(js['bufferViews'])), key=lambda i: js['bufferViews'][i].get('byteOffset', 0))
    newbin = bytearray()
    for i in order:
        bv = js['bufferViews'][i]
        s0 = bv.get('byteOffset', 0)
        data = news.get(i, bb[s0:s0+bv['byteLength']])
        while len(newbin) % 4: newbin.append(0)
        bv['byteOffset'] = len(newbin); bv['byteLength'] = len(data)
        newbin += data
    js['buffers'][0]['byteLength'] = len(newbin)
    write(out, js, bytes(newbin))
    return pushed, tot, fr

# ★ 눈으로 보고 고른 표. 1 = 금도 돌린다 · 2 = 금은 늘 지킨다 · 3 = 면적으로 가른다
PICK = {
    'heart_lime_2672_0'        : 3,   # 셋이 같다
    'mon_neon_lime'            : 1,   # 2·3판은 잎 전체가 「금」으로 잡혀 안 바뀐다
    'monstera_leaf_mid2'       : 3,
    'mon_variegata_gold'       : 2,   # ★ 금 패치가 넓다. 3판은 빨강이 된다
    'mon_green_yellow'         : 3,
    'pothos_marble_greenyellow': 1,   # 2·3판은 마블이 겨자빛이다
    'mon_star_greenyellow'     : 3,
    'mon_green_lemonpatch'     : 3,
}


# ─────────────────────────────────────────────────────────────
# 쨍판(_v1) — 채도 x1.55 · 색상 +18 · 밝기 x1.06
# ⚠ 흰·크림 화소는 채도를 올리면 **따뜻한 밑색이 드러나 탄색**이 된다.
#   이름이 `*white` · `*silver` 인 잎이 「흰 데가 없는 잎」이 됐다.
#   ⇒ 채도가 낮은 화소는 **덜 올린다.** 흰 것은 흰 채로 둔다.
VROT, VSAT, VVAL = 18.0, 1.55, 1.06
PALE_S   = 0.18      # 이보다 옅으면 「흰·크림」으로 본다
PALE_SAT = 1.12      # 그런 화소는 이만큼만 올린다

def recolor_vivid(img):
    a = np.asarray(img.convert('RGB'), dtype=float)/255.0
    h, s, v = to_hsv(a)
    pale = s < PALE_S
    h1 = np.where(pale, h, (h + VROT) % 360)          # 흰 데는 색상도 안 돌린다
    sat = np.where(pale, s*PALE_SAT, s*VSAT)
    out = to_rgb(h1, np.clip(sat, 0, 1), np.clip(v*VVAL, 0, 1))
    return Image.fromarray((out*255+0.5).astype(np.uint8)), int(pale.sum()), pale.size, 0.0

def redo_vivid(base, out):
    return redo(base, out, mode=0, _fn=recolor_vivid)

if __name__ == '__main__':
    todo = sys.argv[1:] or list(PICK)
    for name in todo:
        mode = PICK.get(name, 3)
        base = 'assets/monstera/skins/%s.glb' % name
        out  = 'assets/monstera/skins/%s_v2.glb' % name
        if not os.path.exists(base):
            base = 'assets/monstera/%s.glb' % name
            out  = 'assets/monstera/%s_v2.glb' % name
        p, t, fr = redo(base, out, mode)
        print('%-30s 고른 판 %d · 되돌린 화소 %5.1f%% · 금 %4.1f%%  -> %d KB'
              % (name, mode, 100.0*p/t, 100*fr, os.path.getsize(out)//1024))
