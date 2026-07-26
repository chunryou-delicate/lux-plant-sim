#!/usr/bin/env python
"""
마스크를 적용한 색 교체 결과를 3D 정사영으로 렌더한다.

브라우저를 띄우지 않고 마스크가 맞는지 확인하기 위한 도구. 뷰어와 같은
알고리즘(명도비 보존)을 쓰므로 여기서 맞으면 뷰어에서도 맞다.

사용법
  python preview_recolor.py            # 8종 앞/뒤, 머리=금발 피부=보라
  python preview_recolor.py --face     # 얼굴 확대 4종
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))          # tools/char
ROOT = os.path.dirname(os.path.dirname(HERE))              # 저장소 루트
sys.path.insert(0, HERE)
from make_part_mask import read_glb, CODE, CHARS  # noqa: E402

MASKS = os.path.join(ROOT, "assets", "characters", "masks")
SRC = os.path.join(ROOT, "assets", "characters", "3d")


def recolor(char, changes):
    """뷰어와 동일: 부위 텍셀의 명도비를 목표색에 곱한다."""
    pos, uv, idx, tex = read_glb(os.path.join(SRC, f"{char}_base.glb"))
    a = np.asarray(tex).astype(np.float32)
    code = np.asarray(Image.open(os.path.join(MASKS, f"{char}_mask.png")))[..., 0].astype(int)
    out = a.copy()
    for part, rgb in changes.items():
        m = np.abs(code - CODE[part]) <= 10
        if m.sum() < 50:
            continue
        lum = a[m].mean(axis=1, keepdims=True)
        avg = max(a[m].mean(), 1e-3)
        out[m] = np.clip(np.array(rgb, np.float32) * (lum / avg), 0, 255)
    return pos, uv, idx, Image.fromarray(out.astype(np.uint8))


def draw(pos, uv, idx, tex, size, view="front", zoom=None):
    S = tex.size[0]
    texa = np.asarray(tex)
    uc = uv[idx].mean(axis=1)
    cols = texa[np.clip((uc[:, 1] * S).astype(int), 0, S - 1),
                np.clip((uc[:, 0] * S).astype(int), 0, S - 1)]
    if view == "front":
        u, v_, dep = pos[:, 0], pos[:, 1], pos[:, 2]
    else:
        u, v_, dep = -pos[:, 0], pos[:, 1], -pos[:, 2]
    lo = np.array([u.min(), v_.min()])
    hi = np.array([u.max(), v_.max()])
    H = hi[1] - lo[1]
    if zoom:                       # (중심 높이비, 담을 높이비)
        cy, span = lo[1] + H * zoom[0], H * zoom[1]
    else:
        cy, span = (lo[1] + hi[1]) / 2, H * 1.06
    sc = size / span
    cx = (lo[0] + hi[0]) / 2
    sx = (u - cx) * sc + size / 2
    sy = size / 2 - (v_ - cy) * sc
    img = Image.new("RGB", (size, size), (255, 255, 255))
    d = ImageDraw.Draw(img)
    for f in np.argsort(dep[idx].mean(axis=1)):        # 뒤 -> 앞
        A, B, C = idx[f]
        c = tuple(int(x) for x in cols[f])
        d.polygon([(sx[A], sy[A]), (sx[B], sy[B]), (sx[C], sy[C])], fill=c, outline=c)
    return img


# 오류가 바로 보이도록 원본과 동떨어진 색을 쓴다
CH = {"hair": (216, 180, 104), "skin": (196, 120, 196)}


def main():
    face = "--face" in sys.argv
    if face:
        names = ["char_namja_jachwi", "char_yeoja_gajang",
                 "char_jachwi_f", "char_yeoja_researcher"]
        W = 340
        sheet = Image.new("RGB", (W * len(names), W), (255, 255, 255))
        for i, n in enumerate(names):
            p, u, idx, t = recolor(n, CH)
            sheet.paste(draw(p, u, idx, t, W, "front", (0.845, 0.30)), (i * W, 0))
        out = os.path.join(MASKS, "_preview_face.png")
    else:
        names = CHARS
        W = 250
        sheet = Image.new("RGB", (W * 4, W * 4 + 6), (255, 255, 255))
        for i, n in enumerate(names):
            p, u, idx, t = recolor(n, CH)
            r, col = divmod(i, 2)
            sheet.paste(draw(p, u, idx, t, W, "front"), (col * 2 * W, r * (W + 2)))
            sheet.paste(draw(p, u, idx, t, W, "back"), (col * 2 * W + W, r * (W + 2)))
        out = os.path.join(MASKS, "_preview_check.png")
    sheet.save(out)
    print("  ->", out)
    print("  " + ", ".join(n.replace("char_", "") for n in names))
    return 0


if __name__ == "__main__":
    sys.exit(main())
