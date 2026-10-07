# -*- coding: utf-8 -*-
"""hero.glb 텍스처의 «머리»·«티» 색을 정본(초상화)에 맞춘다 — 크레딧 0.

2026-10-08 · [Char] · 결정 D3(주인공 정본 = 초상화 · LOOK.md)

■ 왜
3D 주인공은 머리가 «새까맣고» 티가 «흰색»이다. 정본은 머리 «아주 짙은 갈색(검정 아님)», 티 «크림·아이보리».

■ 어떻게 — 색만으로 가르지 않는다
텍스처는 조각 지도(아틀라스)라 티(흰)와 신발·양말(흰)이 같은 색이다.
⇒ 삼각형을 UV 공간에 래스터화해 «텍셀마다 몸의 어느 높이에 붙나»(3D y)를 푼다.
   · 머리  = 어두운 텍셀(밝기 < DARK) — 몸 어디든(머리카락은 허리까지 내려온다)
   · 티    = 밝은 무채색 텍셀 중 3D 높이가 «허리~목»인 것 (신발·양말은 발목 아래라 빠진다)
⇒ 목표 색은 «정본 초상화에서 뽑는다»(머리·티 자리의 중앙값). 손으로 박지 않는다.
⇒ 색을 «갈아 끼우지» 않고 «평균만 옮기고 평균에서의 차이는 그대로 얹는다»(더하기) — 결·그림자가 산다.
⇒ 눈(홍채 둘레 · 텍스처 위 거리 ∩ 3D 얼굴 앞)은 머리 옮기기에서 뺀다 — 눈 선이 그대로 짙게 남는다.

■ ⛔ 이 자가 «못» 하는 것
· 「보기에 정본 같나」는 못 정한다 — 같은 자로 전후를 찍어 볼 것(shot_body_still.mjs --tex)
· 2026-10-08 판: 오른뺨 곁에 짙은 획 하나가 남는다(눈 조각 둘레의 머리 텍셀). 게임 거리에선 안 보임

쓰기
  python tools/char/recolor_hero_tex.py <hero.glb> <나갈.glb> [--report]
"""
import io
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from strip_stray_parts import read_glb, write_glb, acc_array  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORTRAIT = os.path.join(ROOT, 'assets', 'characters', 'portraits', 'portrait_jachwi_neutral.png')
DARK = 60          # 이보다 어두운 텍셀 = 머리(와 눈 선)
LIGHT = 200        # 이보다 밝고 채도 낮은 텍셀 = 흰 천


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def canon_colors():
    """정본 초상화에서 머리·티 색을 뽑는다 (중앙값)."""
    p = np.asarray(Image.open(PORTRAIT).convert('RGBA')).astype(float)
    rgb, al = p[..., :3], p[..., 3] > 200
    L = lum(rgb)
    sat = rgb.max(-1) - rgb.min(-1)
    h = p.shape[0]
    hair = al & (L < 70)
    rows = np.arange(h)[:, None]
    tee = al & (rows > h * 0.80) & (L > 190) & (sat < 60)        # 그림 아래쪽 = 티
    return np.median(rgb[hair], 0), np.median(rgb[tee], 0), int(hair.sum()), int(tee.sum())


def texel_height(js, bn, size):
    """UV 공간에 삼각형을 칠해 텍셀마다 3D 높이(키 대비 0~1)를 낸다. 안 쓰는 텍셀은 nan."""
    pr = js['meshes'][0]['primitives'][0]
    P = acc_array(js, bn, pr['attributes']['POSITION'])
    UV = acc_array(js, bn, pr['attributes']['TEXCOORD_0'])
    T = acc_array(js, bn, pr['indices']).reshape(-1, 3)
    y0, y1 = P[:, 1].min(), P[:, 1].max()
    Y = (P[:, 1] - y0) / (y1 - y0)
    hh = (y1 - y0)
    X = (P[:, 0] - P[:, 0].mean()) / hh
    Z = (P[:, 2] - P[:, 2].mean()) / hh
    W = H = size
    out = np.full((H, W), np.nan, np.float32)
    ox = np.full((H, W), np.nan, np.float32)
    oz = np.full((H, W), np.nan, np.float32)
    px = UV[:, 0] * W - 0.5
    py = UV[:, 1] * H - 0.5
    for a, b, c in T:
        xs = (px[a], px[b], px[c]); ys = (py[a], py[b], py[c])
        x0, x1 = int(max(0, np.floor(min(xs)))), int(min(W - 1, np.ceil(max(xs))))
        yA, yB = int(max(0, np.floor(min(ys)))), int(min(H - 1, np.ceil(max(ys))))
        if x1 < x0 or yB < yA:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(yA, yB + 1))
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-12:
            continue
        w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
        w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
        w2 = 1 - w0 - w1
        m = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        out[gy[m], gx[m]] = (w0 * Y[a] + w1 * Y[b] + w2 * Y[c])[m]
        ox[gy[m], gx[m]] = (w0 * X[a] + w1 * X[b] + w2 * X[c])[m]
        oz[gy[m], gx[m]] = (w0 * Z[a] + w1 * Z[b] + w2 * Z[c])[m]
    return out, ox, oz


def shift(rgb, mask, src_mean, dst):
    """평균 색을 dst 로 «옮기고» 평균에서의 차이(결·하이라이트)는 그대로 얹는다.

    ⛔ 2026-10-08 첫 판은 «밝기 비율»로 곱했다 ⇒ 거의 검정(밝기 ~10)의 작은 차이가 5배로 부풀어
       머리에 «점박이 얼룩»이 났다. 더하기로 옮기면 차이가 원래 크기로 남는다."""
    rgb[mask] = np.clip(rgb[mask] - src_mean[None] + dst[None], 0, 255)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        print(__doc__); return 1
    src, dst = args
    if os.path.abspath(src) == os.path.abspath(dst):
        print('⛔ 원본을 덮어쓰려 한다'); return 2
    js, bn = read_glb(src)
    im = js['images'][0]
    bv = js['bufferViews'][im['bufferView']]
    raw = bytes(bn[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])
    tex = np.asarray(Image.open(io.BytesIO(raw)).convert('RGB')).astype(float)
    H = tex.shape[0]
    hgt, tx, tz = texel_height(js, bn, H)
    used = ~np.isnan(hgt)
    L = lum(tex)
    sat = tex.max(-1) - tex.min(-1)
    # ★ 눈 자리 — 홍채(따뜻한 갈색 · 채도 높음)가 붙은 3D 자리를 찾아 그 둘레를 «머리에서 뺀다»
    #   ⛔ 첫 판은 눈동자·속눈썹도 어두워 머리와 같이 옮겨져 «눈이 희뿌옇게» 됐다.
    iris = used & (hgt > 0.55) & (sat > 50) & (L > 50) & (L < 180) & (tex[..., 0] > tex[..., 2] + 30)
    # ⛔ 2026-10-08 둘째 판은 3D 상자(홍채 높이·폭)로 뺐다 ⇒ 그 높이의 «앞머리·옆머리»까지 빠져 검은 띠가 남았다.
    # ⇒ ✔ 텍스처 «위에서» 홍채 둘레만 뺀다. 눈은 텍스처에 한 덩이로 그려져 있고 머리는 다른 조각이다.
    from scipy.ndimage import distance_transform_edt
    R = max(6, int(H * 0.014))
    eye = (distance_transform_edt(~iris) < R) if iris.sum() > 20 else np.zeros_like(used)
    # ⛔ 셋째 판: 텍스처에서 눈 조각 «옆»에 붙은 머리 조각까지 빠져 어깨께에 검은 점이 남았다.
    # ⇒ 3D 로도 «얼굴 앞 · 눈 높이»인 텍셀만 뺀다(둘 다 맞아야 눈).
    if iris.sum() > 20:
        ys_, xs_, zs_ = hgt[iris], tx[iris], tz[iris]
        near3d = used & (hgt > ys_.min() - 0.02) & (hgt < ys_.max() + 0.02)             & (tx > xs_.min() - 0.012) & (tx < xs_.max() + 0.012) & (tz > zs_.min() - 0.02)
        eye = eye & near3d
    print('■ 눈 자리  홍채 텍셀 %d · 텍스처 위 둘레 %dpx · %d텍셀을 «머리 옮기기»에서 뺀다'
          % (iris.sum(), R, eye.sum()))
    hair = (L < DARK) & ~eye
    tee = used & (L > LIGHT) & (sat < 40) & (hgt > 0.38) & (hgt < 0.70)
    shoe = used & (L > LIGHT) & (sat < 40) & (hgt < 0.15)
    ch, ct, nh, nt = canon_colors()
    print('■ 정본(초상화)에서 뽑은 색  머리 %s (%d화소) · 티 %s (%d화소)'
          % (ch.round().astype(int).tolist(), nh, ct.round().astype(int).tolist(), nt))
    print('■ 3D 텍스처 지금 색        머리 %s (%d텍셀) · 티 %s (%d텍셀) · (신발 %d텍셀은 안 건드림)'
          % (np.median(tex[hair], 0).round().astype(int).tolist(), hair.sum(),
             np.median(tex[tee], 0).round().astype(int).tolist(), tee.sum(), shoe.sum()))
    out = tex.copy()
    shift(out, hair, np.median(tex[hair], 0), ch)
    shift(out, tee, np.median(tex[tee], 0), ct)
    print('■ 바꾼 뒤                   머리 %s · 티 %s'
          % (np.median(out[hair], 0).round().astype(int).tolist(),
             np.median(out[tee], 0).round().astype(int).tolist()))
    buf = io.BytesIO()
    Image.fromarray(out.round().astype(np.uint8)).save(buf, 'WEBP', quality=92)
    data = buf.getvalue()
    while len(bn) % 4:
        bn.append(0)
    off = len(bn)
    bn.extend(data)
    js['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
    im['bufferView'] = len(js['bufferViews']) - 1
    js['buffers'][0]['byteLength'] = len(bn)
    write_glb(dst, js, bn)
    if '--report' in sys.argv:
        base = os.path.splitext(dst)[0]
        Image.fromarray(out.round().astype(np.uint8)).save(base + '_tex.png')
        vis = np.zeros((H, H, 3), np.uint8)
        vis[hair] = (200, 60, 60); vis[tee] = (60, 200, 90); vis[shoe] = (60, 120, 220)
        Image.fromarray(vis).save(base + '_mask.png')
    print('썼다: %s (%.1fMB) · ⛔ 보기는 같은 자로 전후를 찍어 볼 것' % (dst, os.path.getsize(dst) / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
