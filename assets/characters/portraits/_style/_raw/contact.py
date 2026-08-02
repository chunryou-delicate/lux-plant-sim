#!/usr/bin/env python
"""납품 16장을 어두운 판·밝은 판에 얹은 대조 시트. 눈으로 확인하는 용도.

밝은 판에서 인물 둘레에 네모가 보이면 키잉이 샌 것이다
(assets/ui/_credit_log.md 「배경 키잉 규약」 — 완전 투명 기준은 255 가 아니다).

  python contact.py   ->  _style/_contact3_dark.png · _contact3_light.png
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
STYLE = os.path.dirname(HERE)
OUT = os.path.dirname(STYLE)

ROWS = [
    ["portrait_jachwi_neutral", "portrait_jachwi_worry", "portrait_jachwi_cry",
     "portrait_jachwi_surprise", "portrait_jachwi_happy",
     "portrait_jachwi_tired"],
    ["portrait_jachwi_think", "portrait_jachwi_proud", "portrait_jachwi_blank"],
    ["portrait_jachwi_m_neutral", "portrait_jachwi_m_worry",
     "portrait_jachwi_m_cry", "portrait_jachwi_m_surprise",
     "portrait_jachwi_m_happy", "portrait_jachwi_m_tired"],
    ["portrait_jachwi_m_think", "portrait_jachwi_m_proud",
     "portrait_jachwi_m_blank"],
    ["portrait_moni_neutral", "portrait_moni_excited", "portrait_moni_sad",
     "portrait_moni_curious"],
]
CW, CH = 210, 280
DARK, LIGHT = (0x43, 0x3C, 0x33), (0xE9, 0xE2, 0xD6)


def sheet(bg, dst):
    w = CW * max(len(r) for r in ROWS)
    im = Image.new("RGB", (w, CH * len(ROWS)), bg)
    for y, row in enumerate(ROWS):
        for x, name in enumerate(row):
            p = os.path.join(OUT, name + ".png")
            if not os.path.exists(p):
                continue
            s = Image.open(p).convert("RGBA").resize((CW, CH), Image.LANCZOS)
            im.paste(s, (x * CW, y * CH), s)
    im.save(dst)
    print(f"  {os.path.basename(dst)}  {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    sheet(DARK, os.path.join(STYLE, "_contact3_dark.png"))
    sheet(LIGHT, os.path.join(STYLE, "_contact3_light.png"))
