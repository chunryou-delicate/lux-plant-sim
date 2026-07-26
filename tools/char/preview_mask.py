#!/usr/bin/env python
"""
마스크를 3D 모델에 입혀 정면/측면으로 직접 렌더한다.

아틀라스 이미지만 봐서는 마스크가 맞는지 알 수 없다. UV 배치가 뒤섞여 있어
어느 덩어리가 어느 부위인지 분간이 안 되기 때문이다. 브라우저를 띄우지 않고
검증하려면 여기서 직접 그려봐야 한다.

정점을 화면 좌표로 정사영하고 z 순으로 뒤에서부터 삼각형을 칠한다(화가
알고리즘). 각 삼각형의 색은 UV 무게중심 자리의 마스크 라벨색이다.

사용법
  python preview_mask.py char_namja_jachwi            # 부위 색으로
  python preview_mask.py char_namja_jachwi --tex      # 원본 텍스처 색으로
  python preview_mask.py --all
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from make_part_mask import read_glb, CODE, VIS, CHARS  # noqa: E402

MASKS = os.path.join(ROOT, "assets", "characters", "masks")
W = 420


def render(char, use_tex=False, size=W):
    pos, uv, idx, tex = read_glb(os.path.join(ROOT, "assets", "characters", "3d",
                                              f"{char}_base.glb"))
    S = tex.size[0]
    code = np.asarray(Image.open(os.path.join(MASKS, f"{char}_mask.png")))[..., 0]
    texa = np.asarray(tex)

    # 삼각형별 색: UV 무게중심 자리의 라벨색(또는 원본 텍스처색)
    uc = uv[idx].mean(axis=1)
    tx = np.clip((uc[:, 0] * S).astype(int), 0, S - 1)
    ty = np.clip((uc[:, 1] * S).astype(int), 0, S - 1)     # v 아래로 증가
    if use_tex:
        cols = texa[ty, tx]
    else:
        lab = code[ty, tx]
        pal = np.zeros((256, 3), np.uint8)
        for k, v in VIS.items():
            pal[k] = v
        cols = pal[lab]

    outs = []
    for view in ("front", "side"):
        # 정사영. 정면은 +Z 에서, 측면은 +X 에서 본다.
        if view == "front":
            u, v_, depth = pos[:, 0], pos[:, 1], pos[:, 2]
        else:
            u, v_, depth = pos[:, 2], pos[:, 1], -pos[:, 0]
        lo = np.array([u.min(), v_.min()])
        hi = np.array([u.max(), v_.max()])
        span = max(hi[1] - lo[1], 1e-6)
        pad = size * 0.06
        sc = (size - 2 * pad) / span
        cx = (lo[0] + hi[0]) / 2
        sx = (u - cx) * sc + size / 2
        sy = size - pad - (v_ - lo[1]) * sc          # y 위로

        img = Image.new("RGB", (size, size), (255, 255, 255))
        d = ImageDraw.Draw(img)
        order = np.argsort(depth[idx].mean(axis=1))   # 뒤 -> 앞
        for f in order:
            a, b, c = idx[f]
            col = tuple(int(x) for x in cols[f])
            d.polygon([(sx[a], sy[a]), (sx[b], sy[b]), (sx[c], sy[c])],
                      fill=col, outline=col)
        outs.append(img)
    return outs


def main():
    use_tex = "--tex" in sys.argv
    names = CHARS if "--all" in sys.argv else \
        [a for a in sys.argv[1:] if not a.startswith("--")] or [CHARS[0]]
    tag = "tex" if use_tex else "part"
    sheet = Image.new("RGB", (W * 2 * len(names), W), (255, 255, 255))
    for i, n in enumerate(names):
        for k, im in enumerate(render(n, use_tex)):
            sheet.paste(im, ((i * 2 + k) * W, 0))
        print("  렌더:", n)
    out = os.path.join(MASKS, f"_preview_{tag}.png")
    sheet.save(out)
    print(" ->", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
