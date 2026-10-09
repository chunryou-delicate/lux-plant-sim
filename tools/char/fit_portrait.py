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
    python tools/char/fit_portrait.py ... --tol 8      (바탕이 깨끗한 순백이고 옷이 크림색일 때 · 기본 26)
    python tools/char/fit_portrait.py ... --tol 8 --pockets   (안 이어진 흰 틈도 지움 · 눈 반짝임은 남김 — §clear_pockets)
    python tools/char/fit_portrait.py <옷만 바꾼.png> <나갈.png> --match <원래 초상.png> --tol 8 --pockets   (얼굴 자리·크기를 원래 초상에 — §crop_to_match)
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


def clear_pockets(rgb, bg, tol):
    """가장자리와 «안 이어진» 배경 주머니(머리채와 팔 사이 · 잎 구멍 · 몸과 잎 사이)도 지운다 — --pockets 일 때만.

    ★ 2026-10-09 Higgsfield 초상: 퍼뜨림이 못 닿는 흰 틈이 대사창에서 «흰 실»로 남았다.
    ⛔ 눈 속 반짝임·눈물도 같은 순백 주머니다 — 지우면 눈이 뚫린다. 가르는 법(일곱 장을 칠해 보고 정함):
      · 그림 가운데 띠(|x−가운데| ≤ 0.25 폭) 안이고 인물 높이의 위 0.40 안 ⇒ 남긴다(눈 반짝임 높이 0.23~0.37 · 눈물 폭 0.19)
      · 그 밖 ⇒ 배경이다 — 옆 띠(머리채 틈 · 잎 구멍) · 가운데 아래(몬이 몸과 잎 사이 0.42~0.56 · 가위 쥔 손가락 틈)
      ⛔ 첫 판은 «둘레가 어두우면 눈»으로 갈랐다 — 몬이 외곽선이 짙은 자줏빛이라 몸·잎 틈 둘레도 어둡고,
        눈 반짝임 둘레는 오히려 밝아(옆 반사광) 눈이 뚫렸다. 위치로 가른다.
    ⛔ 못 하는 것: 얼굴 높이 가운데의 «진짜 배경 틈»은 남긴다 — 그림으로 볼 것."""
    from scipy.ndimage import label
    near = (np.abs(rgb.astype(int) - rgb[0, 0].astype(int)).max(axis=2) <= tol) & ~bg
    lab, n = label(near)
    w = rgb.shape[1]
    fy = np.nonzero((~bg).any(axis=1))[0]
    top, fh = int(fy.min()), int(fy.max() - fy.min() + 1)
    out = bg.copy()
    gone = kept = 0
    for i in range(1, n + 1):
        m = lab == i
        cnt = int(m.sum())
        if cnt < 30:
            continue
        ys, xs = np.nonzero(m)
        if abs(xs.mean() - w / 2) <= 0.25 * w and (ys.mean() - top) / fh < 0.40:
            kept += cnt
            continue
        out |= m
        gone += cnt
    print('  주머니: 지움 %d 화소 · 남김(눈 반짝임) %d 화소' % (gone, kept))
    return out


def crop_to_match(im, orig_path):
    """«옷만 바꾼 같은 낯»을 원래 초상과 얼굴 자리·크기가 같게 자른다 — --match <원래 초상.png> 일 때만.

    ★ 2026-10-09 앞치마 판 낯 넷: Higgsfield 가 몸을 더 넣어 얼굴이 원래보다 2~10% 작게 왔다.
      기본 길(인물 키로 맞춤)은 흉상이 판 위아래를 다 채워 얼굴 크기를 못 돌린다 ⇒ 같은 화자가 줄마다 얼굴 크기가 튄다.
    ⇒ 원래 초상의 얼굴 네모(가로 25~75% · 세로 17.5~53.75% — 눈·코·입)를 틀로 삼아 배율을 훑으며
      정규 상호상관(NCC)이 가장 큰 배율·자리를 찾고, 원래 판(600×800)에 해당하는 네모를 잘라 낸다(밖은 흰색).
    ⛔ 못 하는 것: 표정이 다른 그림에는 못 쓴다(얼굴이 안 겹친다) — NCC 가 0.9 밑이면 멈춘다."""
    from scipy.signal import fftconvolve
    o = Image.open(orig_path).convert('RGBA')
    ow, oh = o.size
    flat = Image.new('RGBA', o.size, (255, 255, 255, 255)); flat.alpha_composite(o)
    og = np.asarray(flat.convert('L')).astype(np.float32)
    bx0, by0, bx1, by1 = int(ow * 0.25), int(oh * 0.175), int(ow * 0.75), int(oh * 0.5375)
    tpl = og[by0:by1, bx0:bx1]
    t = tpl - tpl.mean(); tn = float(np.sqrt((t ** 2).sum())); ones = np.ones_like(tpl)
    g = im.convert('L')
    best = None
    base = ow / im.width
    for s in np.arange(base * 0.75, base * 1.30, base * 0.0115):
        r = np.asarray(g.resize((round(g.width * s), round(g.height * s)), Image.LANCZOS)).astype(np.float32)
        if r.shape[0] < tpl.shape[0] or r.shape[1] < tpl.shape[1]:
            continue
        num = fftconvolve(r, t[::-1, ::-1], mode='valid')
        s1 = fftconvolve(r, ones, mode='valid'); s2 = fftconvolve(r ** 2, ones, mode='valid')
        ncc = num / (np.sqrt(np.maximum(s2 - s1 ** 2 / tpl.size, 1e-6)) * tn)
        i = np.unravel_index(np.argmax(ncc), ncc.shape)
        if best is None or ncc[i] > best[0]:
            best = (float(ncc[i]), s, int(i[1]), int(i[0]))
    sc, s, lx, ly = best
    x, y, w, h = (lx - bx0) / s, (ly - by0) / s, ow / s, oh / s
    print('얼굴 맞춤(%s): NCC %.3f · 배율 %.3f(폭 맞춤 %.3f → 얼굴 %+.0f%%) · 자를 네모 x %.0f..%.0f y %.0f..%.0f'
          % (os.path.basename(orig_path), sc, s, base, (s / base - 1) * 100, x, x + w, y, y + h))
    if sc < 0.9:
        raise SystemExit('⛔ 얼굴이 원래 초상과 안 겹친다(NCC %.3f < 0.9) — 표정이 다른 그림인가?' % sc)
    canvas = Image.new('RGB', (round(w), round(h)), (255, 255, 255))
    canvas.paste(im, (round(-x), round(-y)))
    return canvas.resize((ow, oh), Image.LANCZOS), (ow, oh)


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
    # ★ 총괄 결정(2026-09-07): 자취녀는 «판 끝»으로 채운다.
    #   ⇒ 대사창이 아래 22%를 흐리게 지우므로 그 자리는 «어차피 안 보인다».
    #   ⇒ ★★ 그리고 「중앙값」도 «흩어진 것의 가운데»지 «지켜야 할 규약»이 아니다.
    #     ⇒ 743~799 로 흩어진 아홉 장의 가운데를 「기준」이라 부르면
    #       ⇒ ⇒ 「한 장을 기준이라 부르면 그 예외를 물려받는다」와 «같은 병»이다.
    if '--bottom' in sys.argv:
        BOTTOM_OVERRIDE = int(sys.argv[sys.argv.index('--bottom') + 1])
    else:
        BOTTOM_OVERRIDE = None
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

    if BOTTOM_OVERRIDE is not None:
        print('★ 바닥선을 «손으로» 준다: %d  (기준에서 잰 %d 를 «덮는다»)'
              % (BOTTOM_OVERRIDE, bottom))
        bottom = BOTTOM_OVERRIDE

    # ★ 2026-10-09 — Higgsfield 초상은 바탕이 거의 순백(모서리 흔들림 ≤2)인데 크림 티가 그 흰색에서 23~28 밖에 안 떨어져
    #   기본 26 으로 퍼뜨리면 어깨 닿은 자리로 배경이 티 안까지 먹어 들어갔다(beam 소매가 통째로 뚫림).
    #   ⇒ 바탕이 깨끗한 그림은 --tol 8 로 좁힌다. 기본값은 그대로 둔다(클링 것들은 26 으로 통과했다).
    tol = int(sys.argv[sys.argv.index('--tol') + 1]) if '--tol' in sys.argv else 26
    im = Image.open(src).convert('RGB')
    match = sys.argv[sys.argv.index('--match') + 1] if '--match' in sys.argv else None
    if match:
        im, (ow, oh) = crop_to_match(im, match)
    rgb = np.asarray(im)
    bg = edge_background(rgb, tol)
    print('배경 퍼뜨림 허용 %d' % tol)
    if '--pockets' in sys.argv:
        bg = clear_pockets(rgb, bg, tol)
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
    if match:
        # 얼굴 자리·크기를 원래 초상에 이미 맞췄다 — 키로 다시 늘리지 않는다
        Image.fromarray(rgba, 'RGBA').save(dst)
        print('썼다: %s  (%dx%d · 원래 초상 %s 의 얼굴 자리·크기 그대로)' % (dst, ow, oh, os.path.basename(match)))
        print('⛔ 이 자는 «화풍이 같나»를 못 잰다. 그건 보는 물음이다 — 눈으로 볼 것.')
        return 0
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
