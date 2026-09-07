# -*- coding: utf-8 -*-
"""바깥에서 온 초상화 한 장을 **기존 것들과 같은 규격으로** 다듬는다.

2026-09-07 · [Char] · 크레딧 0

■ 왜 필요한가

클링(KLING)이 낸 그림은 **880×1168 · 흰 배경**이고, 게임이 쓰는 것은
**600×800 · 투명 · 바닥선 y=621** 이다. 그대로는 못 쓴다.

    기존 넷(실측)   600×800 · 투명 · ★ 바닥 y 가 «전부 621» · 인물 높이 371~446(중앙값 383)
    클링 것         880×1168 · 흰 배경 · 바닥 913

■ ⛔ 왜 `derive3.py` 를 못 쓰나

그 자는 **마젠타 배경**을 전제한다(`key_out`). 흰 배경에 그대로 대면
**크림색 티셔츠와 흰 눈알이 뚫린다** — `derive3.py:162` 가 바로 그 사고를 적어 두었다.

⇒ ★ 그래서 **가장자리에서 «퍼져 나가는» 방식**으로 지운다.
  바깥과 «이어진» 밝은 화소만 배경이다. 안쪽 흰색은 아무리 밝아도 안 건드린다.

■ ★ 무엇을 맞추나 — 세 가지

    ① 배경   가장자리에서 퍼뜨려 지운다 (안쪽 흰색은 남는다)
    ② 크기   ★ 인물 «전체 높이»를 기준에 맞춘다 (머리 폭이 아니라)
             ⚠ 머리 폭으로 맞췄더니 인물이 «아래로 무거워» 보였다(2026-08-26)
    ③ 자리   ★ «바닥선»을 맞춘다. 기존 넷이 전부 y=621 이다

■ ⛔ 이 자가 «못» 하는 것

    · 「화풍이 같나」는 못 잰다. 그건 «보는» 물음이다
    · 배경이 인물과 «같은 색»이면 못 가른다 (흰 옷이 흰 배경에 닿아 있으면)
      ⇒ ★ 그래서 «구멍이 몇 개 남았나»를 세어 찍는다. 사람이 보고 판정한다

■ 쓰는 법

    python tools/char/fit_portrait.py <들어온.png> <나갈.png>
    python tools/char/fit_portrait.py ... --ref assets/characters/portraits/portrait_moni_sad.png
"""
import os
import sys
from collections import deque

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORTRAITS = os.path.join(ROOT, 'assets', 'characters', 'portraits')

OUT_W, OUT_H = 600, 800          # 게임이 쓰는 규격
BOTTOM = 621                     # ★ 기존 넷이 «전부» 이 값이다 [실측 2026-09-07]
BODY_H = 383                     # 기존 넷 인물 높이의 중앙값 [실측]


def edge_background(rgb, tol=26):
    """가장자리에서 «퍼져 나가며» 배경을 찾는다.

    ★ 임계로 「밝으면 배경」이라 하면 «흰 옷·흰 눈알»이 뚫린다.
      바깥과 «이어진» 것만 배경이다."""
    h, w, _ = rgb.shape
    seed = rgb[0, 0].astype(int)                 # 모서리 색을 배경색으로 본다
    near = (np.abs(rgb.astype(int) - seed).max(axis=2) <= tol)
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    return bg


def ref_metrics(paths):
    """기준에서 «바닥선»과 «인물 높이»를 잰다 — 박지 않고 «재서» 쓴다.

    ⚠⚠ 처음에 «한 장»만 받았다. ⛔ 그것이 틀렸다 —
      몬이는 바닥이 «전부 621» 로 같은데, **자취녀는 743~799 로 제각각**이다.
      ⇒ ★ 그래서 `neutral`(799) 을 기준으로 삼았더니 새 그림이 «55px 아래»에 앉았다.
      ⇒ ⇒ ★★ **한 장을 「기준」이라 부르면 그 한 장의 «예외»를 물려받는다.**
    ⇒ ✔ 여러 장을 받아 **중앙값**을 쓴다. 한 장만 주면 그 한 장이 곧 중앙값이다."""
    import statistics
    bots, hs, size = [], [], None
    for p in paths:
        a = np.asarray(Image.open(p).convert('RGBA'))
        op = a[:, :, 3] > 128
        if not op.any():
            continue
        ys, _ = np.nonzero(op)
        bots.append(int(ys.max()))
        hs.append(int(ys.max() - ys.min() + 1))
        size = (a.shape[1], a.shape[0])
    if not bots:
        return None
    return dict(bottom=round(statistics.median(bots)), h=round(statistics.median(hs)),
                size=size, n=len(bots), spread=(min(bots), max(bots)))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ref = None
    if '--ref' in sys.argv:
        ref = sys.argv[sys.argv.index('--ref') + 1]
    if len(args) < 2:
        print(__doc__)
        return 1
    src, dst = args[0], args[1]

    bottom, body_h, ow, oh = BOTTOM, BODY_H, OUT_W, OUT_H
    if ref:
        import glob as _g
        paths = sorted(_g.glob(ref)) if ('*' in ref or '?' in ref) else [ref]
        m = ref_metrics(paths)
        if m:
            bottom, body_h, (ow, oh) = m['bottom'], m['h'], m['size']
            print('기준 %d장 → 바닥 y %d · 인물 높이 %d · 판 %dx%d'
                  % (m['n'], bottom, body_h, ow, oh))
            if m['spread'][1] - m['spread'][0] > 8:
                print('  ⚠ 기존 바닥이 %d~%d 로 «벌어져» 있다 — 중앙값을 쓴다'
                      % m['spread'])
                if m['n'] == 1:
                    print('  ⛔ 그런데 기준이 «한 장»이다. 그 한 장의 예외를 물려받는다')

    im = Image.open(src).convert('RGB')
    rgb = np.asarray(im)
    bg = edge_background(rgb)
    fg = ~bg
    if not fg.any():
        print('⛔ 인물을 못 찾았다 — 배경색이 인물과 같은가?')
        return 2

    ys, xs = np.nonzero(fg)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    cur_h = y1 - y0 + 1
    print('들어온 것 %dx%d · 인물 %dx%d (바닥 y %d)'
          % (im.width, im.height, x1 - x0 + 1, cur_h, y1))

    # 구멍 세기 — 인물 «안»에 배경으로 잡힌 곳이 있나
    inner = bg[y0:y1 + 1, x0:x1 + 1]
    holes = int(inner.sum())
    print('★ 인물 네모 안에서 «배경으로 잡힌» 화소: %d개 (%.2f%%)'
          % (holes, holes / max(inner.size, 1) * 100))
    if holes / max(inner.size, 1) > 0.35:
        print('  ⚠ 많다 — 배경이 인물을 파고들었을 수 있다. **눈으로 볼 것**')

    # ★★ 테두리 깎기 — 배경색이 «반쯤 섞인» 가장자리 한 겹이 남는다(흰 테두리·halo).
    #   ⚠ 안 깎으면 어두운 화면에서 인물 둘레가 «하얗게 빛난다». 실제로 그랬다.
    #   ⇒ 배경에 «닿은» 앞면 화소를 한 겹 벗긴다. 두 겹은 안 벗긴다 — 잎 끝이 사라진다.
    pad = np.zeros((fg.shape[0] + 2, fg.shape[1] + 2), bool)
    pad[1:-1, 1:-1] = fg
    touch = (~pad[:-2, 1:-1]) | (~pad[2:, 1:-1]) | (~pad[1:-1, :-2]) | (~pad[1:-1, 2:])
    edge = fg & touch
    print('  테두리 한 겹 깎음: %d개' % int(edge.sum()))
    fg = fg & ~edge

    rgba = np.dstack([rgb, np.where(fg, 255, 0).astype(np.uint8)])
    cut = Image.fromarray(rgba[y0:y1 + 1, x0:x1 + 1], 'RGBA')

    scale = body_h / cur_h
    nw, nh = max(1, round(cut.width * scale)), max(1, round(cut.height * scale))
    cut = cut.resize((nw, nh), Image.LANCZOS)

    out = Image.new('RGBA', (ow, oh), (0, 0, 0, 0))
    out.paste(cut, ((ow - nw) // 2, bottom - nh + 1), cut)
    out.save(dst)
    print('썼다: %s  (%dx%d · 인물 %dx%d · 바닥 y %d)'
          % (dst, ow, oh, nw, nh, bottom))
    print('⛔ 이 자는 «화풍이 같나»를 못 잰다. 그건 보는 물음이다 — 눈으로 볼 것.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
