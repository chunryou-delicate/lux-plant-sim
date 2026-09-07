# -*- coding: utf-8 -*-
"""두 캐릭터의 **몸매**를 견준다 — 같은 클립·같은 시각으로 찍은 그림에서.

2026-09-07 · [Char] · 크레딧 0

■ 왜 이렇게 하나

GLB 를 그대로 견줄 수 없다. **포즈가 다르기 때문**이다
(기존은 A포즈 · 새 몸은 T포즈). 높이별 폭을 재면 「어깨」 띠가 서로 다른 데를 가리킨다.

⇒ ★ 그래서 **뷰어에서 «같은 클립을 같은 시각으로» 얹어 찍은 그림**을 쓴다.
  ⇒ 그러면 두 몸이 «같은 자세»다. 남는 차이가 곧 «몸매»다.

■ ⛔ 이 자가 «못» 하는 것

  · 「어느 쪽이 예쁜가」는 못 정한다. **어긋난 자리와 크기만** 낸다
  · 기존 몸은 «옷·머리카락»을 입고 있다 ⇒ ★ 그 부피가 «몸매»로 잡힌다.
    ⇒ ⇒ 그러니 「기존이 더 두껍다」가 나와도 그것이 «살»이라는 뜻이 아니다
"""
import os, sys
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
import numpy as np
from PIL import Image


def body_mask(path, x0=0.05, x1=0.45, y0=0.13, y1=0.82):
    """캔버스 자리에서 «배경이 아닌» 화소를 낸다."""
    a = np.asarray(Image.open(path).convert('RGB'), float)
    h, w, _ = a.shape
    c = a[int(h*y0):int(h*y1), int(w*x0):int(w*x1)]
    bg = np.median(c.reshape(-1, 3), axis=0)
    m = (np.abs(c - bg).max(axis=2) > 16)
    # ⛔⛔ 처음엔 이대로 냈다 ⇒ 머리끝·발끝 폭이 «366»(판 전체 폭)으로 나왔다.
    #   ★ 사람 머리 폭이 판 전체일 리 없다 ⇒ 파 보니 **카드 테두리 선**을 몸으로 잡고 있었다.
    #   ⇒ ⇒ 「말이 되나」 칸이 또 잡았다. 안 뒀으면 IoU 0.217 을 «몸매 차이»로 냈을 것이다.
    # ⇒ ✔ 가로로 «거의 꽉 찬» 줄은 몸이 아니다. 버린다.
    full = m.sum(axis=1) > m.shape[1] * 0.85
    m[full, :] = False
    return m


def norm(m):
    """몸을 잘라내 «높이 400»으로 맞춘다 — 카메라 거리가 달라도 견줄 수 있게."""
    ys, xs = np.nonzero(m)
    if not len(ys): return None
    cut = m[ys.min():ys.max()+1, xs.min():xs.max()+1]
    im = Image.fromarray((cut*255).astype(np.uint8))
    s = 400.0 / im.height
    return np.asarray(im.resize((max(1, int(im.width*s)), 400), Image.NEAREST)) > 127


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        print(__doc__); return 1
    A, B = norm(body_mask(args[0])), norm(body_mask(args[1]))
    if A is None or B is None:
        print('⛔ 몸을 못 찾았다'); return 2
    W = max(A.shape[1], B.shape[1])
    def pad(m):
        o = np.zeros((400, W), bool)
        s = (W - m.shape[1]) // 2
        o[:, s:s+m.shape[1]] = m
        return o
    A, B = pad(A), pad(B)
    inter = (A & B).sum(); union = (A | B).sum()
    # ★★ 「말이 되나」 칸 — 사람 실루엣이 네모 판을 꽉 채울 수는 없다
    for nm, M in (('첫째', A), ('둘째', B)):
        fill = M.sum() / M.size
        if fill > 0.6:
            print('  ⛔ %s 그림이 판의 %.0f%% 를 채운다 — 몸이 아니라 «판»을 잡았다' % (nm, fill*100))
    print('■ %s  vs  %s' % (os.path.basename(args[0]), os.path.basename(args[1])))
    print('  ★ 겹침(IoU) %.3f   — 1.0 이면 «똑같은 실루엣»' % (inter/max(union, 1)))
    print('  가로 폭   %d  vs  %d  (높이를 400 으로 맞춘 뒤)' % (A.sum(1).max(), B.sum(1).max()))
    print()
    print('  높이대별 폭 — 0.00 이 머리끝, 1.00 이 발끝')
    for i in range(10):
        a0, a1 = int(400*i/10), int(400*(i+1)/10)
        wa = int(A[a0:a1].sum(1).max()); wb = int(B[a0:a1].sum(1).max())
        d = (wb-wa)/max(wa, 1)*100
        bar = '#' * min(40, int(abs(d)/2))
        print('    %.1f~%.1f   %3d  vs %3d   %+6.1f%%  %s' % (i/10, (i+1)/10, wa, wb, d, bar))
    print()
    print('⛔ 이 자는 「어느 쪽이 낫나」를 못 정한다. ★ 기존 쪽은 «옷·머리카락»을 입고 있다.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
