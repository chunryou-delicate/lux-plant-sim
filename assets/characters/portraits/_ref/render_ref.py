#!/usr/bin/env python
"""3D 원본 GLB 를 텍스처 색 그대로 정사영 렌더한다 — 초상화 생성용 참조 이미지.

초상화를 상상해서 그리면 3D 와 다른 인물이 나온다. 생성 API 에 넣을 참조
이미지를 여기서 만든다. 브라우저 없이 돌아간다(tools/char/preview_mask.py 와
같은 화가 알고리즘, 텍스처 색 사용).

  python render_ref.py
  -> _ref/ref_jachwi_f_{front,side,face}.png
     _ref/ref_mascot_{front,side,face}.png
     _ref/ref_sheet_jachwi_f.png / ref_sheet_mascot.png  (생성기에 넣을 시트)

주의: glTF UV 는 v 가 아래로 증가한다. 1-v 로 뒤집으면 안 된다(README §4 함정).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "char"))
from make_part_mask import read_glb  # noqa: E402

SRC = os.path.join(ROOT, "assets", "characters", "3d")


def project(pos, view):
    """정사영 축. front=+Z 에서, side=+X 에서, back=-Z 에서."""
    if view == "front":
        return pos[:, 0], pos[:, 1], pos[:, 2]
    if view == "back":
        return -pos[:, 0], pos[:, 1], -pos[:, 2]
    return pos[:, 2], pos[:, 1], -pos[:, 0]          # side


def render(pos, uv, idx, tex, view="front", size=640, ycrop=None,
           bg=(255, 0, 255)):
    """ycrop=(t0,t1) 이면 발바닥 0~정수리 1 기준 그 구간만 꽉 채워 그린다."""
    S = tex.size[0]
    texa = np.asarray(tex)
    uc = uv[idx].mean(axis=1)
    tx = np.clip((uc[:, 0] * S).astype(int), 0, S - 1)
    ty = np.clip((uc[:, 1] * S).astype(int), 0, S - 1)
    cols = texa[ty, tx]

    u, v_, depth = project(pos, view)
    y0, y1 = v_.min(), v_.max()
    if ycrop:
        h = y1 - y0
        lo_y, hi_y = y0 + h * ycrop[0], y0 + h * ycrop[1]
    else:
        lo_y, hi_y = y0, y1

    # 세로 기준으로만 배율을 잡으면 몬이처럼 가로로 넓은 모델은 잎이 잘린다.
    # 가로 폭도 같이 보고 둘 중 작은 배율을 쓴다. 폭은 **보이는 구간의 폭**이다
    # (얼굴 클로즈업에서 A포즈 팔 폭까지 세면 얼굴이 쪼그라든다).
    band = (v_ >= lo_y) & (v_ <= hi_y)
    ub = u[band] if band.any() else u
    span = max(hi_y - lo_y, 1e-6)
    pad = size * 0.05
    sc = min((size - 2 * pad) / span,
             (size - 2 * pad) / max(ub.max() - ub.min(), 1e-6))
    cx = (ub.min() + ub.max()) / 2
    sx = (u - cx) * sc + size / 2
    sy = size - pad - (v_ - lo_y) * sc

    img = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(img)
    # 화가 알고리즘: 뒤에서 앞으로. 삼각형 하나당 UV 무게중심 텍셀색.
    order = np.argsort(depth[idx].mean(axis=1))
    for f in order:
        a, b, c = idx[f]
        col = (int(cols[f][0]), int(cols[f][1]), int(cols[f][2]))
        d.polygon([(sx[a], sy[a]), (sx[b], sy[b]), (sx[c], sy[c])],
                  fill=col, outline=col)
    return img


def run(glb, tag, face_band, size=640):
    pos, uv, idx, tex = read_glb(os.path.join(SRC, glb))
    h = pos[:, 1].max() - pos[:, 1].min()
    print(f"{tag}: 삼각형 {len(idx):,}  높이 {h:.3f} m  텍스처 {tex.size[0]}")
    outs = {}
    for view in ("front", "side", "back"):
        outs[view] = render(pos, uv, idx, tex, view, size)
        outs[view].save(os.path.join(HERE, f"ref_{tag}_{view}.png"))
    outs["face"] = render(pos, uv, idx, tex, "front", size, ycrop=face_band)
    outs["face"].save(os.path.join(HERE, f"ref_{tag}_face.png"))

    sheet = Image.new("RGB", (size * 4, size), (255, 0, 255))
    for i, k in enumerate(("front", "side", "back", "face")):
        sheet.paste(outs[k], (i * size, 0))
    sheet.save(os.path.join(HERE, f"ref_sheet_{tag}.png"))
    print("  ->", f"ref_sheet_{tag}.png")


if __name__ == "__main__":
    # 자취생은 상반신(가슴 위)이 초상화 프레임이다. 몬이는 통째로 얼굴이다.
    run("char_jachwi_f_base.glb", "jachwi_f", (0.62, 1.00))
    # 남자 자취생 — 3차에서 추가. 여자와 같은 프레임(가슴 위)으로 본다.
    run("char_namja_jachwi_base.glb", "jachwi_m", (0.62, 1.00))
    run("char_mascot_sprout.glb", "mascot", (0.30, 1.00))
