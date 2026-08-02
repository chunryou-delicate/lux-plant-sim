#!/usr/bin/env python
"""화풍 후보 시트(_style/_raw) → 투명 배경 낱장 3장.

`portraits/_raw/derive.py` 와 같은 규약이다(assets/ui/_credit_log.md 「배경 키잉 규약」).
다른 점은 하나뿐 — 여기 세 칸은 **같은 인물의 세 화풍**이라 표정 세트가 아니다.
그래도 나란히 놓고 고르는 그림이라 **세 칸의 배율·기준선을 맞춰야** 공정하게 보인다.
칸마다 머리 크기가 다르면 화풍이 아니라 크기를 고르게 된다.

  python derive_style.py
  -> _style/style_a_webtoon.png · style_b_watercolor.png · style_c_lineless.png
"""
import os

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, find_objects, label

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)

SHEET = "style_sheet_v3_raw.png"
NAMES = ["style_1_fineline", "style_2_cleareye", "style_3_softshade"]

AR = 3 / 4          # 대화창 초상화 비율 — 납품 규격과 같게 본다
DELIV_H = 800
QUANT = 224         # 수채 번짐이 있어 192 보다 조금 넉넉하게
LO = 90             # 마젠타다움 이 값 이하면 완전 불투명
FGT = 150           # 성분 분리용 전경 문턱
PAD = 12
MARGIN = 0.04


def components(rgb, n_take=3):
    """마젠타가 아닌 덩어리 중 큰 것 n개를 왼쪽부터."""
    a = rgb.astype(np.int32)
    mag = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    lab, n = label(mag < FGT)
    sizes = np.bincount(lab.ravel())
    sizes[0] = 0
    top = sorted(range(1, n + 1), key=lambda i: -sizes[i])[:n_take]
    objs = find_objects(lab)
    got = [(i, objs[i - 1]) for i in top]
    got.sort(key=lambda t: t[1][1].start)
    return lab, got


def key_out(px, mask):
    """조각 하나를 투명 배경 RGBA 로. 키 색은 그 조각의 최빈색."""
    px = px.astype(np.float32)
    flat = px.reshape(-1, 3).astype(np.uint32)
    packed = (flat[:, 0] << 16) | (flat[:, 1] << 8) | flat[:, 2]
    vals, cnt = np.unique(packed, return_counts=True)
    v = int(vals[cnt.argmax()])
    key = np.array([(v >> 16) & 255, (v >> 8) & 255, v & 255], np.float32)

    mag = np.minimum(px[..., 0], px[..., 2]) - px[..., 1]
    hi = float(min(key[0], key[2]) - key[1])
    a = np.clip((hi - mag) / max(hi - LO, 1.0), 0.0, 1.0)
    a *= binary_dilation(mask, iterations=3)

    safe = np.maximum(a, 1e-3)[..., None]
    fg = (px - key * (1 - a)[..., None]) / safe
    fg = np.where(a[..., None] > 0.02, fg, px)
    rgb = np.clip(fg, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, (a * 255).astype(np.uint8)]), "RGBA")


def cut(src, lab, ident, box, y0=None):
    h, w = lab.shape
    ys, xs = box
    top = ys.start - PAD if y0 is None else y0
    r = (max(0, top), max(0, xs.start - PAD),
         min(h, ys.stop + PAD), min(w, xs.stop + PAD))
    sub = np.asarray(src)[r[0]:r[2], r[1]:r[3]]
    return key_out(sub, lab[r[0]:r[2], r[1]:r[3]] == ident)


def fit_bust(ims):
    """흉상: 세로를 꽉 채우고 가로만 3:4 로. 아래·좌우는 프레임 밖으로 흘러나간다."""
    h = max(im.size[1] for im in ims)
    tw = int(round(h * AR))
    out = []
    for im in ims:
        s = min(1.0, (h * (1 - MARGIN)) / im.size[1])
        nw, nh = max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s))
        sub = im.resize((nw, nh), Image.LANCZOS)
        c = Image.new("RGBA", (tw, h), (0, 0, 0, 0))
        c.paste(sub, ((tw - nw) // 2, h - nh), sub)
        out.append(c)
    return out


def main():
    path = os.path.join(HERE, SHEET)
    src = Image.open(path).convert("RGB")
    lab, got = components(np.asarray(src))
    print("성분 bbox:", [(b[1].start, b[1].stop, b[0].start, b[0].stop)
                        for _, b in got])
    y0 = max(0, min(b[0].start for _, b in got) - PAD)
    parts = [cut(src, lab, i, b, y0) for i, b in got]
    laid = fit_bust(parts)
    for name, im in zip(NAMES, laid):
        im = im.resize((int(round(DELIV_H * AR)), DELIV_H), Image.LANCZOS)
        im = im.quantize(colors=QUANT, method=Image.FASTOCTREE)
        dst = os.path.join(OUT, name + ".png")
        im.save(dst, optimize=True)
        print(f"  {name}.png  {im.size[0]}x{im.size[1]}  "
              f"{os.path.getsize(dst) / 1024:.0f}KB")


if __name__ == "__main__":
    main()
