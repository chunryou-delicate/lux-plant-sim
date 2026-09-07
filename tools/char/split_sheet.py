#!/usr/bin/env python3
"""턴어라운드 시트 한 장을 «덩어리»로 갈라 뷰마다 투명 PNG 로 낸다 — 크레딧 0.

⛔ 왜 있나 (2026-09-07 · 총괄)
  뷰를 «따로» 뽑았더니 앞은 3.5등신, 옆은 4등신이었다 ⇒ Meshy 가 평균 내어 v8 이 «공» 이 됐다.
  ⇒ ★ 한 장 안에서 뽑으면 어긋날 수 없다. 그 한 장을 여기서 가른다.
  ⛔ 격자로 자르면 «팔이 잘린다» — T-pose 팔이 칸 경계를 넘는다.
    그래서 초록 배경을 지우고 «이어진 덩어리»를 찾아 그 상자로 자른다.

쓰기
  python tools/char/split_sheet.py <시트.png> <머리글> [--tol=60] [--min=0.004]
  ⇒ <머리글>_0.png .. _3.png 로 낸다. 차례는 «왼쪽위→오른쪽아래»(읽는 차례).

내는 것 — 덩어리마다 상자·키·너비. ★ 키가 서로 다르면 그 시트는 버려라.

⛔ 이 자가 «한 번 물린 것» (09-07)
  시트에 «흰 테두리 선»이 있으면 모서리가 흰색이라 배경색을 «흰색»으로 잡는다.
  ⇒ 그러면 «초록 칸 넷»이 덩어리로 잡히고, 넷이 똑같으니 **어긋남 0.0% 로 통과시킨다.**
  ⇒ ★ 그래서 「네모를 거의 다 채운 덩어리」는 «사람이 아니다»로 막는 관문을 달았다.

⚠ 이 자가 «안» 하는 것
  · 어느 덩어리가 «정면»인지는 모른다. 낸 뒤 열어 보고 이름을 붙여라.
"""
import sys
from collections import deque

import numpy as np
from PIL import Image


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    o = {a.split("=")[0]: float(a.split("=")[1]) for a in sys.argv[1:] if a.startswith("--") and "=" in a}
    src, stem = args[0], args[1]
    tol = o.get("--tol", 60); minfrac = o.get("--min", 0.004)

    im = Image.open(src).convert("RGBA")
    a = np.array(im); h, w = a.shape[:2]
    rgb = a[:, :, :3].astype(np.int16)

    k = max(2, min(h, w) // 100)
    corners = np.concatenate([rgb[:k, :k].reshape(-1, 3), rgb[:k, -k:].reshape(-1, 3),
                              rgb[-k:, :k].reshape(-1, 3), rgb[-k:, -k:].reshape(-1, 3)])
    bg = corners.mean(axis=0)
    near = (np.abs(rgb - bg).max(axis=2) <= tol)
    body = ~near
    print(f"  배경색 {[round(float(v)) for v in bg]} · 몸 화소 {body.sum():,} ({100*body.sum()/(h*w):.1f}%)")

    # 이어진 덩어리 찾기 (4-이웃)
    lab = np.zeros((h, w), np.int32)
    cur = 0
    for y0 in range(h):
        for x0 in range(w):
            if not body[y0, x0] or lab[y0, x0]:
                continue
            cur += 1
            q = deque([(y0, x0)]); lab[y0, x0] = cur
            while q:
                y, x = q.popleft()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and body[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = cur; q.append((ny, nx))

    blobs = []
    for i in range(1, cur + 1):
        m = (lab == i)
        n = int(m.sum())
        if n < minfrac * h * w:
            continue
        ys, xs = np.where(m)
        blobs.append((ys.min(), xs.min(), ys.max(), xs.max(), n, i))
    # 읽는 차례: 위쪽 줄 먼저, 그 안에서 왼쪽 먼저
    blobs.sort(key=lambda b: (b[0] // max(1, h // 4), b[1]))
    print(f"  덩어리 {len(blobs)} 개")

    # ⛔ 관문 — «칸»을 «사람»으로 잘못 잡는 것을 막는다 (09-07, 흰 테두리 시트에서 물림)
    #   덩어리가 «네모에 가깝고» 그 네모를 «거의 다 채우면» 그건 사람이 아니라 «칸»이다.
    #   ★ 이 자는 0.0% 어긋남을 내며 통과시켰다 — 넷이 똑같은 «칸»이었으니 당연히 같았다.
    # ⛔ 관문 둘 — «선»을 «사람»으로 잡는 것을 막는다 (같은 날, 격자 테두리에서 물림)
    #   상자는 커다란데 화소가 그 상자를 «거의 안 채우면» 그건 얇은 «선»이다.
    kept = []
    for b in blobs:
        y0, x0, y1, x1, n, i = b
        fill = n / float((y1 - y0 + 1) * (x1 - x0 + 1))
        if fill < 0.08:
            print(f"   ⤷ 버림: 상자 {x1-x0+1}x{y1-y0+1} 채움 {100*fill:.1f}% — «선»이다")
            continue
        kept.append(b)
    blobs = kept

    boxy = 0
    for (y0, x0, y1, x1, n, i) in blobs:
        hh, ww = y1 - y0 + 1, x1 - x0 + 1
        fill = n / float(hh * ww)
        square = abs(hh - ww) / float(max(hh, ww)) < 0.06
        if fill > 0.85 and square:
            boxy += 1
    if boxy and boxy == len(blobs):
        print("   ⛔ 덩어리가 «사람»이 아니라 «칸»이다 (네모를 85% 넘게 채웠다).")
        print("      시트에 «테두리 선»이 있어 배경색을 잘못 잡았다.")
        print("      ⇒ 먼저 테두리를 잘라내거나 --tol 을 낮춰 다시 돌려라.")
        raise SystemExit(3)

    hs = []
    for j, (y0, x0, y1, x1, n, i) in enumerate(blobs):
        pad = 12
        Y0, X0 = max(0, y0 - pad), max(0, x0 - pad)
        Y1, X1 = min(h, y1 + 1 + pad), min(w, x1 + 1 + pad)
        sub = a[Y0:Y1, X0:X1].copy()
        subm = (lab[Y0:Y1, X0:X1] == i)
        sub[:, :, 3] = np.where(subm, 255, 0).astype(np.uint8)
        out = f"{stem}_{j}.png"
        Image.fromarray(sub, "RGBA").save(out)
        hh, ww = y1 - y0 + 1, x1 - x0 + 1
        hs.append(hh)
        print(f"   {j}: {out}  상자 {ww}x{hh}  화소 {n:,}")

    if hs:
        print(f"\n  ★ 키 견줌 — 가장 작은 {min(hs)} · 가장 큰 {max(hs)} · "
              f"어긋남 {100*(max(hs)-min(hs))/max(hs):.1f}%")
        if (max(hs) - min(hs)) / max(hs) > 0.08:
            print("   ⛔ 8% 넘게 어긋났다. 이대로 구우면 뭉개진다. 시트를 다시 뽑아라.")
        else:
            print("   ✔ 넷이 «같은 키»다. 구워도 된다.")


if __name__ == "__main__":
    main()
