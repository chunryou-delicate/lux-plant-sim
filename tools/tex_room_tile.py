"""tools/tex_room_tile.py — 이음 없는 방 겉감 그림(Higgsfield)을 «지금 방 색»에 맞춘 webp 로 ([house] · 2026-10-10)

    python -I tools/tex_room_tile.py <in.jpg|png> <out.webp> --mean '#f6e5bf' [--size 1024] [--q 86]

왜: 방 겉감(room_materials)의 빛·색 손질(tint · ACES 눌림)은 절차 그림의 바탕색에 맞춰져 있다. 그림을 그대로 넣으면 방 전체 색이 바뀐다.
    ⇒ 그림의 평균 색(선형)을 --mean(절차 그림 바탕색)에 맞추고 결(무늬·얼룩)만 바꾼다. 크기만 줄이고 이음(가장자리)은 안 건드린다.
"""
import argparse
import numpy as np
from PIL import Image


def s2l(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def l2s(c): return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, None), 1 / 2.4) - 0.055)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--mean', required=True)
    ap.add_argument('--size', type=int, default=1024)
    ap.add_argument('--q', type=int, default=86)
    a = ap.parse_args()
    im = Image.open(a.src).convert('RGB').resize((a.size, a.size), Image.LANCZOS)
    lin = s2l(np.asarray(im).astype(np.float64) / 255)
    h = a.mean.lstrip('#'); want = s2l(np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)]) / 255)
    have = lin.reshape(-1, 3).mean(axis=0)
    k = want / np.maximum(have, 1e-6)
    out = l2s(np.clip(lin * k, 0, 1))
    Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGB').save(a.dst, 'WEBP', quality=a.q, method=6)
    hs = lambda v: '#' + ''.join(f'{int(round(float(x) * 255)):02x}' for x in l2s(v))
    print(f'{a.src} → {a.dst}  {a.size}²  평균 {hs(have)} → {a.mean}  (선형 배수 {k.round(3).tolist()})')


if __name__ == '__main__':
    main()
