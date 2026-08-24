# -*- coding: utf-8 -*-
"""tools/leaf/tint_lamp.py — 조명의 `_c1` 을 민트로 맞춘다 (2026-08-24 · leaf)

    PYTHONIOENCODING=utf-8 python tools/leaf/tint_lamp.py

★ 왜 필요했나 — 규약은 `_c1`=민트인데 **조명 셋만 크림**이었다. 재서 확인했다:

      갈래                기본판 색상   _c1 색상   _c2 색상
      lamp_desk_mint        104.7        43.0       7.2
      lamp_clip              80.8        43.1       7.7
      lamp_table            150.2        43.4       7.4
      ────────────────────────────────────────────────
      화분(규약)                          151        343

  ⇒ 조명은 **43°/7° 라는 딴 조리법**으로 만들어져 있었다. 셋끼리는 맞고 화분과 안 맞는다.
  ⇒ ★ 게다가 **기본판이 이미 민트 쪽**이다(table 150°). `_c1` 이 민트를 크림으로 «바꿔» 놓았다.
    그래서 «_c1 을 고치는» 것이 아니라 **기본판에서 다시 칠한다.**

⚠ **켜진 안쪽은 안 칠한다.** 갓 안쪽이 노랗게 빛나는 것이 이 물건의 뜻이다.
  화분의 「흙 예외」와 같은 자리다 — 칠하기는 텍스처 전체를 덮으므로 뺄 것을 적어 둬야 한다.
  문턱은 재서 골랐다(색상 25~70 · 채도>0.35 · 밝기>0.65):

      갈래       느슨(s>.30 v>.55)   ★고른 것(s>.35 v>.65)   빡빡(s>.45 v>.75)
      desk           20.36%              20.07%                16.24%
      clip            3.60%               1.77%                 0.15%
      table           2.95%               1.24%                 0.07%

  ⇒ desk 는 어느 문턱에서도 20% 언저리다 — **진짜 넓은 발광면**이다.
    clip·table 은 느슨하면 텍스처 전체에 «주근깨»가 흩어진다. 그래서 가운데를 골랐다.

⚠ 밝기는 각 갈래가 **지금 _c1 에서 갖고 있던 평균**으로 맞춘다. 화분처럼 한 값(0.638)으로
  눕히면 desk(0.961)가 확 어두워진다. 조명은 밝은 것이 제 성질이다.

⛔ `_c2` 는 안 건드린다. 7° 라 규약(343° 핑크)과 어긋나지만 **박사님 승인은 `_c1` 뿐이다.**
"""
import io, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from recolor_calm import read, write, to_hsv, to_rgb

MINT     = 151.0       # 화분 규약과 같은 자리
TARGET_S = 0.13        # 화분 `_c1` 과 같은 자리

LIT_H = (25, 70)       # 켜진 안쪽 — 따뜻한 띠
LIT_S = 0.35
LIT_V = 0.65
LIT_K = 9              # ★ 「덩어리만」 자 — 9×9 안에서 절반 넘게 켜져 있어야 켜진 것으로 본다
LIT_MIN = 0.55

def _keep_blobs(m, k=LIT_K, thr=LIT_MIN):
    """흩어진 «주근깨»를 버리고 넓은 발광면만 남긴다.

    ⚠ 왜 필요했나 — 문턱만으로 고르면 텍스처 곳곳의 **한두 화소짜리 주황 점**이 같이 살아남는다.
      크림 바탕에서는 안 보이던 것이 **민트 바탕에서는 때처럼 도드라진다**(1판을 찍어서 봤다).
      버리는 양은 desk 0.55% · clip 0.33% · table 0.15% 뿐이고 넓은 발광면은 그대로 남는다.
    """
    p = np.pad(m.astype(np.float64), k // 2, mode='edge')
    c = p.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    H, W = m.shape
    lm = (c[k:k+H, k:k+W] - c[0:H, k:k+W] - c[k:k+H, 0:W] + c[0:H, 0:W]) / (k * k)
    return m & (lm > thr)

# 갈래 → (폴더, 지금 `_c1` 의 평균 밝기)
LAMPS = {
    'lamp_desk_mint': ('assets/lamps',    0.961),
    'lamp_clip':      ('assets/lighting', 0.852),
    'lamp_table':     ('assets/lighting', 0.778),
}

def tint(img, hue, target_v):
    a = np.asarray(img.convert('RGB'), dtype=float) / 255.0
    h, s, v = to_hsv(a)
    lit = _keep_blobs((h >= LIT_H[0]) & (h <= LIT_H[1]) & (s > LIT_S) & (v > LIT_V))
    v2 = np.clip(v * (target_v / max(v.mean(), 1e-6)), 0, 1)   # 밝기 무늬는 살리고 평균만 옮긴다
    h2 = np.where(lit, h, np.full_like(h, hue))                # ★ 켜진 데는 제 색 그대로
    s2 = np.where(lit, s, np.full_like(s, TARGET_S))
    v3 = np.where(lit, v, v2)
    out = to_rgb(h2, s2, v3)
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8)), float(lit.mean())

def make(base, folder, target_v, suf='_c1', hue=MINT):
    src = '%s/%s.glb' % (folder, base)
    dst = '%s/%s%s.glb' % (folder, base, suf)
    js, bb = read(src)
    news, litfrac = {}, 0.0
    for im in js['images']:
        bv = js['bufferViews'][im['bufferView']]
        s0 = bv.get('byteOffset', 0)
        pil = Image.open(io.BytesIO(bb[s0:s0 + bv['byteLength']]))
        buf = io.BytesIO()
        fmt = 'JPEG' if 'jpeg' in (im.get('mimeType') or '') else 'PNG'
        timg, litfrac = tint(pil, hue, target_v)
        if fmt == 'JPEG': timg.save(buf, 'JPEG', quality=92, optimize=True)
        else:             timg.save(buf, 'PNG', optimize=True)
        news[im['bufferView']] = buf.getvalue()
    order = sorted(range(len(js['bufferViews'])),
                   key=lambda i: js['bufferViews'][i].get('byteOffset', 0))
    nb = bytearray()
    for i in order:
        bv = js['bufferViews'][i]; s0 = bv.get('byteOffset', 0)
        data = news.get(i, bb[s0:s0 + bv['byteLength']])
        while len(nb) % 4: nb.append(0)
        bv['byteOffset'] = len(nb); bv['byteLength'] = len(data); nb += data
    js['buffers'][0]['byteLength'] = len(nb)
    write(dst, js, bytes(nb))
    return dst, os.path.getsize(dst), litfrac

if __name__ == '__main__':
    for base, (folder, tv) in LAMPS.items():
        d, n, lf = make(base, folder, tv)
        print('%-38s %6d KB   켜진 데로 빼 둔 화소 %4.1f%%' % (d, n // 1024, 100 * lf))
