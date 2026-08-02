#!/usr/bin/env python
"""마젠타 시트(_raw) → 투명 배경 초상화 낱장.

생성물은 3칸 가로 시트 한 장이다. 크레딧을 다시 태우지 않고 여기서 자른다.
규격이 바뀌면 이 스크립트만 고쳐 다시 돌린다 — _raw 는 절대 지우지 말 것.

★ 칸을 1/3 로 자르면 안 된다
  생성기는 칸을 정확히 3등분해 주지 않는다. 몬이는 옆 칸 영역까지 잎이 뻗어
  x 구간이 겹치고(26~1069 / 960~2209), 자취생 시트에는 하지 말라고 해도
  검은 구분선이 그려져 나온다. 세로선으로 자르면 잎이 싹둑 잘리거나 구분선이
  들어온다.
  대신 **연결 성분**으로 나눈다. 세 인물은 화면에서 겹쳐 보여도 서로 닿아
  있지 않아 성분이 정확히 3개로 떨어진다. 구분선은 별도 성분이라 크기순으로
  큰 3개만 고르면 저절로 빠진다.

★ 키잉 (assets/ui/_credit_log.md 「배경 키잉 규약」)
  · 마젠타다움 = min(r,b) - g. 초록 잎·테라코타 화분·분홍 볼은 안 걸린다.
  · 완전 투명 기준은 255 가 아니라 **그 조각의 키 색**이다. 생성물 마젠타는
    #FE01FC 같은 값이라 255 로 재면 배경에 알파가 2~3% 남아, 어두운 UI 위에서
    네모난 판으로 보인다(실제로 그렇게 나왔다).
  · 반투명 가장자리는 언프리멀티플라이 (c - key*(1-a))/a 로 마젠타 테를 뺀다.
    디스필을 따로 안 해도 이게 수학적으로 맞는 답이다.

  python derive.py
"""
import os

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, find_objects, label

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)

# 시트 → (왼쪽부터 결과 파일명 3개, 배치 방식)
#   bust  — 흉상. 아래·좌우로 프레임 밖까지 흘러나가는 게 정상. 원본 배율 유지.
#   whole — 몬이. 잎과 화분이 **통째로** 보여야 한다. 공통 배율로 담는다.
SHEETS = {
    "portrait_jachwi_raw.png": (
        ["portrait_jachwi_neutral", "portrait_jachwi_happy",
         "portrait_jachwi_worried"], "bust"),
    "portrait_moni_raw.png": (
        ["portrait_moni_neutral", "portrait_moni_excited",
         "portrait_moni_sad"], "whole"),
}
AR = 3 / 4          # 대화창 초상화 비율
DELIV_H = 800       # 납품 세로. 폰 세로(390×844) @2x 에서 이면 충분하다.
QUANT = 192         # 팔레트 색수. 얼굴 그라데이션이 있어 96 까지는 못 줄인다.
LO = 90             # 마젠타다움 이 값 이하면 완전 불투명
FGT = 150           # 성분 분리용 전경 문턱
PAD = 10            # 성분 bbox 여유
MARGIN = 0.055      # whole 배치의 사방 여백


def components(rgb):
    """마젠타가 아닌 덩어리 중 큰 3개를 왼쪽부터. (라벨맵, [(라벨, bbox)])"""
    a = rgb.astype(np.int32)
    mag = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    lab, n = label(mag < FGT)
    sizes = np.bincount(lab.ravel())
    sizes[0] = 0
    top = sorted(range(1, n + 1), key=lambda i: -sizes[i])[:3]
    objs = find_objects(lab)
    got = [(i, objs[i - 1]) for i in top]
    got.sort(key=lambda t: t[1][1].start)
    return lab, got


def key_out(px, mask):
    """조각 하나를 투명 배경 RGBA 로. mask 밖(옆 인물)은 통째로 버린다."""
    px = px.astype(np.float32)
    flat = px.reshape(-1, 3).astype(np.uint32)
    packed = (flat[:, 0] << 16) | (flat[:, 1] << 8) | flat[:, 2]
    vals, cnt = np.unique(packed, return_counts=True)
    v = int(vals[cnt.argmax()])
    key = np.array([(v >> 16) & 255, (v >> 8) & 255, v & 255], np.float32)

    mag = np.minimum(px[..., 0], px[..., 2]) - px[..., 1]
    hi = float(min(key[0], key[2]) - key[1])
    a = np.clip((hi - mag) / max(hi - LO, 1.0), 0.0, 1.0)
    a *= binary_dilation(mask, iterations=3)     # 안티에일리어스 테두리는 살린다

    safe = np.maximum(a, 1e-3)[..., None]
    fg = (px - key * (1 - a)[..., None]) / safe
    fg = np.where(a[..., None] > 0.02, fg, px)
    rgb = np.clip(fg, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, (a * 255).astype(np.uint8)]), "RGBA")


def cut(src, lab, ident, box, y0=None):
    """bbox(+여유)로 잘라 키잉. y0 을 주면 위쪽을 거기에 맞춘다(bust 공통 기준)."""
    h, w = lab.shape
    ys, xs = box
    top = ys.start - PAD if y0 is None else y0
    r = (max(0, top), max(0, xs.start - PAD),
         min(h, ys.stop + PAD), min(w, xs.stop + PAD))
    sub = np.asarray(src)[r[0]:r[2], r[1]:r[3]]
    return key_out(sub, lab[r[0]:r[2], r[1]:r[3]] == ident)


def fit_bust(ims):
    """흉상: 원본 배율 그대로. 세로를 꽉 채우고 가로만 3:4 로 맞춘다."""
    h = max(im.size[1] for im in ims)
    tw = int(round(h * AR))
    out = []
    for im in ims:
        c = Image.new("RGBA", (tw, h), (0, 0, 0, 0))
        c.paste(im, ((tw - im.size[0]) // 2, h - im.size[1]), im)
        out.append(c)
    return out


def fit_whole(ims):
    """몬이: 전체가 다 들어가게. 배율은 세 칸 공통(제일 작은 값), 바닥도 공통.
    표정만 바뀐 같은 인물로 읽히려면 칸마다 크기가 달라지면 안 된다."""
    h = max(im.size[1] for im in ims)
    cw, ch = int(round(h * AR)), h
    uw, uh = cw * (1 - 2 * MARGIN), ch * (1 - 2 * MARGIN)
    s = min(min(uw / im.size[0], uh / im.size[1]) for im in ims)
    base = int((ch + max(im.size[1] * s for im in ims)) / 2)   # 공통 기준선
    out = []
    for im in ims:
        nw, nh = max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s))
        sub = im.resize((nw, nh), Image.LANCZOS)
        c = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        c.paste(sub, ((cw - nw) // 2, base - nh), sub)
        out.append(c)
    return out


def main():
    for sheet, (names, mode) in SHEETS.items():
        path = os.path.join(HERE, sheet)
        if not os.path.exists(path):
            print("없음(건너뜀):", sheet)
            continue
        src = Image.open(path).convert("RGB")
        lab, got = components(np.asarray(src))
        if mode == "bust":
            y0 = max(0, min(b[0].start for _, b in got) - PAD)
            parts = [cut(src, lab, i, b, y0) for i, b in got]
            laid = fit_bust(parts)
        else:
            parts = [cut(src, lab, i, b) for i, b in got]
            laid = fit_whole(parts)
        for name, im in zip(names, laid):
            im = im.resize((int(round(DELIV_H * AR)), DELIV_H), Image.LANCZOS)
            im = im.quantize(colors=QUANT, method=Image.FASTOCTREE)
            dst = os.path.join(OUT, name + ".png")
            im.save(dst, optimize=True)
            print(f"  {name}.png  {im.size[0]}x{im.size[1]}  "
                  f"{os.path.getsize(dst) / 1024:.0f}KB")


if __name__ == "__main__":
    main()
