#!/usr/bin/env python3
"""원화의 «머리만» 줄여 등신을 맞춘다 — 크레딧 0.

⛔ 왜 있나 (2026-09-08 · 총괄)
  프롬프트에 「3.5 heads tall」이라 써도 «2.2등신»이 나왔다. 숫자가 안 통한다.
  image_to_image 로 「머리를 훨씬 작게」라고 두 번 걸었다 ⇒ ★ 2.22 → 2.21. 18크레딧이 헛돌았다.
  ⇒ ★★ 「참조를 그대로 두고 한 가지만 바꿔라」는 «크기»에는 안 먹는다.
     참조를 붙드는 힘이 지시보다 세다.
  ⇒ 그래서 «그림을 직접» 자른다. 이러면 등신이 원하는 값으로 «정확히» 선다.

무엇을 하나
  뷰마다 ① 목을 찾고(위에서 내려오며 가로폭이 가장 좁은 자리)
        ② 머리를 떼어 s 배로 줄이고
        ③ 목 바로 위에 «가운데를 맞춰» 다시 얹는다
  ⇒ 몸은 한 화소도 안 건드린다.

쓰기
  python tools/char/shrink_head.py <들.png> <날.png> [--deungsin=3.16] [--s=0]
    --deungsin  목표 등신. s 를 여기서 «계산»한다(권함)
    --s         배율을 직접 줄 때. 주면 --deungsin 을 무시한다

⚠ 이 자가 «안» 하는 것
  · 목이 «안 좁아지는» 그림(옆면 일부·머리가 어깨에 파묻힌 것)은 못 잡는다. 낸 뒤 눈으로 봐라
  · 줄인 머리와 몸의 «빛 방향»은 안 맞춘다. Meshy 는 형태를 보므로 대개 문제 없다
  · 얼굴 안의 눈·코 크기는 머리와 «같이» 줄어든다(일부러 — 그게 등신이다)
"""
import sys

import numpy as np
from PIL import Image


def find_neck(mask):
    """위에서 내려오며 가로폭이 «가장 좁아지는» 행. 머리 밑이다."""
    rows = mask.sum(axis=1)
    ys = np.where(rows > 0)[0]
    top, bot = ys[0], ys[-1]
    H = bot - top + 1
    a, b = top + int(0.18 * H), top + int(0.62 * H)
    seg = rows[a:b]
    return int(a + np.argmin(seg)), int(top), int(bot)


def shrink(src, dst, deungsin=3.16, s=0.0):
    im = Image.open(src).convert("RGBA")
    a = np.array(im)
    mask = a[:, :, 3] > 8
    if not mask.any():                       # 알파가 없으면 초록 배경으로 가른다
        rgb = a[:, :, :3].astype(np.int16)
        bg = rgb[0, 0]
        mask = (np.abs(rgb - bg).max(axis=2) > 60)

    neck, top, bot = find_neck(mask)
    head_h = neck - top
    body_h = bot - neck + 1
    if s <= 0:
        # (몸 + 머리·s) / (머리·s) = 등신  ⇒  s = 몸 / ((등신-1)·머리)
        s = body_h / ((deungsin - 1.0) * head_h)
    new_head = max(4, int(round(head_h * s)))

    # ★ 목을 «조금 더» 물고 자른다 — 안 그러면 이음매가 «각진 턱»으로 드러난다(09-08, 옆면에서 봄)
    ov = max(4, int(0.10 * head_h))
    cut = min(mask.shape[0], neck + ov)
    xs = np.where(mask[top:cut].any(axis=0))[0]
    hx0, hx1 = int(xs[0]), int(xs[-1]) + 1
    head = im.crop((hx0, top, hx1, cut))
    nw = max(2, int(round((hx1 - hx0) * s)))
    nh_cut = max(4, int(round((cut - top) * s)))
    head = head.resize((nw, nh_cut), Image.LANCZOS)

    # ★ s > 1 (머리를 «키울» 때) 이면 캔버스 위·옆이 모자란다. 넓혀서 얹는다.
    pad_top = max(0, nh_cut - (neck + ov))
    pad_x = max(0, (nw - (hx1 - hx0)) // 2 + 8)
    W2, H2 = im.size[0] + 2 * pad_x, im.size[1] + pad_top
    out = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    out.paste(im.crop((0, neck, im.size[0], im.size[1])), (pad_x, neck + pad_top))   # 몸은 그대로
    cx = (hx0 + hx1) // 2 + pad_x
    out.paste(head, (cx - nw // 2, neck + ov + pad_top - nh_cut), head)              # 머리를 목 위에

    out.save(dst)
    new_total = body_h + new_head
    return {"목": neck - top, "머리": head_h, "몸": body_h, "배율": round(s, 3),
            "새 머리": new_head, "새 키": new_total,
            "새 등신": round(new_total / new_head, 2)}


if __name__ == "__main__":
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    o = {x.split("=")[0]: float(x.split("=")[1]) for x in sys.argv[1:] if x.startswith("--") and "=" in x}
    if len(args) < 2:
        print(__doc__)
        raise SystemExit(2)
    r = shrink(args[0], args[1], deungsin=o.get("--deungsin", 3.16), s=o.get("--s", 0.0))
    print(f"{args[1]}  {r}")
