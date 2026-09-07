#!/usr/bin/env python3
"""원화의 «배경»을 도려내 투명 PNG 로 낸다 — Meshy 가 «액자»를 굽지 않게.

⛔ 왜 있나 (2026-09-07)
  맨몸 4뷰를 Meshy multi_image_to_3d 에 넣었더니 ⇒ ★ 사람이 «액자 판에 붙은 부조»로 나왔다.
  [char] 가 3/4 각도로 찍어 찾았다 — 거대한 판 위에 사람이 박혀 있고, 그 판이 뼈에 물려
  클립을 따라 «망토»처럼 휘둘렀다. 그리고 그 판 때문에 pose estimation 이 사람 꼴을 못 찾아
  a-pose 리깅이 422 로 거절당했다.
  ⇒ ★★ Meshy 는 원화를 «물체 사진»이 아니라 «그림이 놓인 면»으로 읽는다.
     배경이 완전한 단색이 아니면(스튜디오 바닥선·벽·그늘·비네팅) 그것을 «물체»로 본다.

★ 그래서 «크레딧 0» 으로 위에서 막는다: 가장자리에서 퍼져 나가며 배경을 지우고 알파를 준다.
  ⇒ 임계로 흰색을 전부 지우면 «흰 옷·흰 눈알»이 뚫린다([char] derive3.py:162 가 그 사고를 적어 뒀다).
    그래서 «가장자리에서 이어진 것»만 지운다. 안쪽 밝은 데는 안 건드린다.

쓰기
  python tools/char/cut_bg_alpha.py <들어온.png> [나갈.png] [--tol 26] [--feather 1]
  ⇒ 나갈 이름을 안 주면 <들어온>_cut.png

⚠ 이 자가 «안» 하는 것
  · 물체 안쪽의 밝은 자리를 지우지 않는다(일부러)
  · 그림자를 «물체의 일부»로 볼지 «배경»으로 볼지는 tol 이 정한다. 진한 그림자는 남을 수 있다
  ⇒ ★ 낸 뒤 반드시 «열어 보고» 넣어라. 다 도려냈는지는 눈으로만 안다.
"""
import sys
from collections import deque

import numpy as np
from PIL import Image


def cut(src: str, dst: str, tol: int = 26, feather: int = 1) -> dict:
    im = Image.open(src).convert("RGBA")
    a = np.array(im)
    h, w = a.shape[:2]
    rgb = a[:, :, :3].astype(np.int16)

    # 네 모서리의 평균을 «배경색»으로 삼는다 — 한 점만 보면 얼룩에 속는다
    k = max(2, min(h, w) // 100)
    corners = np.concatenate([
        rgb[:k, :k].reshape(-1, 3), rgb[:k, -k:].reshape(-1, 3),
        rgb[-k:, :k].reshape(-1, 3), rgb[-k:, -k:].reshape(-1, 3),
    ])
    bg = corners.mean(axis=0)

    near = (np.abs(rgb - bg).max(axis=2) <= tol)

    # ★ 가장자리에서 «이어진» 것만 지운다 (flood fill). 안쪽 밝은 데는 남는다
    seen = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))

    alpha = np.where(seen, 0, 255).astype(np.uint8)

    # 테두리 한 겹만 부드럽게 — 안 하면 계단이 3D 에 그대로 새겨진다
    for _ in range(max(0, feather)):
        p = alpha.astype(np.float32)
        blur = (p + np.roll(p, 1, 0) + np.roll(p, -1, 0) + np.roll(p, 1, 1) + np.roll(p, -1, 1)) / 5.0
        edge = (alpha > 0) & (
            (np.roll(alpha, 1, 0) == 0) | (np.roll(alpha, -1, 0) == 0)
            | (np.roll(alpha, 1, 1) == 0) | (np.roll(alpha, -1, 1) == 0)
        )
        alpha = np.where(edge, blur.astype(np.uint8), alpha)

    a[:, :, 3] = alpha
    Image.fromarray(a, "RGBA").save(dst)

    kept = int((alpha > 0).sum())
    return {"배경색": [round(float(v)) for v in bg], "남은 화소": kept,
            "남은 몫": round(100.0 * kept / (h * w), 2), "크기": [w, h]}


if __name__ == "__main__":
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    opts = {a.split("=")[0]: a.split("=")[1] for a in sys.argv[1:] if a.startswith("--") and "=" in a}
    if not args:
        print(__doc__)
        raise SystemExit(2)
    src = args[0]
    dst = args[1] if len(args) > 1 else src.rsplit(".", 1)[0] + "_cut.png"
    r = cut(src, dst, tol=int(opts.get("--tol", 26)), feather=int(opts.get("--feather", 1)))
    print(f"{src} -> {dst}  {r}")
