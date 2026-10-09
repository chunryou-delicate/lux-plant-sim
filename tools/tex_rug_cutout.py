"""tools/tex_rug_cutout.py — 위에서 본 러그 그림(흰 바탕)을 «러그만» 남긴 투명 webp 로 ([house] · 2026-10-10)

    python -I tools/tex_rug_cutout.py <in.jpg|png> <out.webp> [--max 1024] [--white 232] [--pad 0.01]

왜: Higgsfield 러그 그림은 틀을 꽉 채우라 했어도 둘레에 흰 여백(4~9%)이 남고, 짧은 변의 술(fringe)이 그 여백 안에 있다.
    네모로 자르면 술이 잘리거나 술 사이 흰 바탕이 남는다 ⇒ 둘레에서부터 이어진 흰 바탕만 투명으로 바꾸고(술 사이 포함),
    러그 몸 안의 흰 무늬(체크·잎)는 둘레와 안 이어져 있으니 그대로 둔다. 그다음 내용 상자로 잘라 판(러그 발자국)에 꽉 차게 한다.
"""
import argparse
import numpy as np
from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--max', type=int, default=1024)
    ap.add_argument('--white', type=int, default=232)
    ap.add_argument('--pad', type=float, default=0.01)
    a = ap.parse_args()
    im = Image.open(a.src).convert('RGB')
    s = a.max / max(im.size)
    if s < 1: im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    px = np.asarray(im).astype(np.int16)
    white = (px.min(axis=2) > a.white) & ((px.max(axis=2) - px.min(axis=2)) < 16)
    bg = np.zeros_like(white)
    bg[0, :] = white[0, :]; bg[-1, :] = white[-1, :]; bg[:, 0] = white[:, 0]; bg[:, -1] = white[:, -1]
    while True:                                   # 둘레에서 흰 바탕을 따라 번진다(4-이웃)
        grow = bg.copy()
        grow[1:, :] |= bg[:-1, :]; grow[:-1, :] |= bg[1:, :]; grow[:, 1:] |= bg[:, :-1]; grow[:, :-1] |= bg[:, 1:]
        grow &= white
        if (grow == bg).all(): break
        bg = grow
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    ys, xs = np.where(alpha > 0)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    p = round(a.pad * max(im.size))
    y0, x0 = max(0, y0 - p), max(0, x0 - p); y1, x1 = min(im.height - 1, y1 + p), min(im.width - 1, x1 + p)
    rgba = np.dstack([np.asarray(im), alpha])[y0:y1 + 1, x0:x1 + 1]
    out = Image.fromarray(rgba, 'RGBA')
    out.save(a.dst, 'WEBP', quality=86, method=6)
    print(f'{a.src} → {a.dst}  {out.size}  투명 {100 * (rgba[..., 3] == 0).mean():.1f}%  (잘라 낸 둘레 {x0},{y0} ~ {x1},{y1})')


if __name__ == '__main__':
    main()
