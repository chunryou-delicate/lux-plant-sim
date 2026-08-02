#!/usr/bin/env python
"""확정 화풍 한 장(_raw/pick_jachwi_neutral_raw.png) → 투명 배경 3:4 낱장.

`derive_style.py` 와 같은 키잉 규약이다. 다른 점은 하나 — 시트가 아니라 **인물 하나**라
제일 큰 성분 1개만 고른다. 흉상이라 아래·좌우는 프레임 밖으로 흘러나가는 게 정상이다.

  python derive_pick.py
  -> _style/style_pick_jachwi_neutral.png  (600x800)
"""
import os

import numpy as np
from PIL import Image

from derive_style import AR, DELIV_H, PAD, QUANT, components, cut

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)

SRC = "pick_jachwi_neutral_raw.png"
DST = "style_pick_jachwi_neutral"


def main():
    src = Image.open(os.path.join(HERE, SRC)).convert("RGB")
    lab, got = components(np.asarray(src), n_take=1)
    ident, box = got[0]
    print("성분 bbox:", (box[1].start, box[1].stop, box[0].start, box[0].stop))
    im = cut(src, lab, ident, box, y0=max(0, box[0].start - PAD))

    # 3:4 프레임. 세로를 꽉 채우고 가로는 가운데 정렬 — 넘치면 잘리는 게 흉상이다.
    h = im.size[1]
    tw = int(round(h * AR))
    canvas = Image.new("RGBA", (tw, h), (0, 0, 0, 0))
    canvas.paste(im, ((tw - im.size[0]) // 2, 0), im)

    canvas = canvas.resize((int(round(DELIV_H * AR)), DELIV_H), Image.LANCZOS)
    canvas = canvas.quantize(colors=QUANT, method=Image.FASTOCTREE)
    dst = os.path.join(OUT, DST + ".png")
    canvas.save(dst, optimize=True)
    print(f"  {DST}.png  {canvas.size[0]}x{canvas.size[1]}  "
          f"{os.path.getsize(dst) / 1024:.0f}KB")


if __name__ == "__main__":
    main()
