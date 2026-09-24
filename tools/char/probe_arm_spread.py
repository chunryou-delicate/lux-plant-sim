# -*- coding: utf-8 -*-
"""서 있을 때 **팔이 몸에서 몇 도 벌어졌나**를 잰다 — 크레딧 0.

2026-09-25 · [Char]

■ 왜

새 주인공(assets/v2/char/hero.glb)의 서기 자세가 「팔 벌린 A자」에 가깝다는 말이 나왔다.
⇒ 「가깝다」는 눈대중이다. **몇 도인지**, 그리고 **기준(옛 캐릭터 idle)은 몇 도였는지**를
  재야 「얼마나 내려야 하나」를 말할 수 있다.

■ 무엇을 재나

    벌림각   어깨(LeftArm/RightArm 관절) → 손(LeftHand/RightHand) 을 잇는 선이
            «바로 아래»(-Y)와 이루는 각. 0° 면 차렷, 90° 면 T포즈.
            ★ 앞뒤로 흔드는 것은 빼고 «옆으로» 벌린 몫만 본다 (정면 X-Y 평면에 투영)

    클립 한 바퀴를 steps 번 나눠 재고 최솟값·평균·최댓값을 낸다.

■ 쓰는 법

    python tools/char/probe_arm_spread.py <glb> [클립이름 ...] [--steps=48]
      클립이름을 안 주면 그 파일의 «모든» 클립을 잰다(한 파일에 여럿이 든 hero.glb 용)

■ ⛔ 이 자가 «못» 하는 것

  · 「보기에 자연스러운가」는 못 본다. 각도만 낸다
  · 손가락·손목 꺾임은 안 본다(24본에 손가락 뼈가 없다)
  · 스킨(살)이 아니라 «뼈» 자리로 잰다 — 소매·머리카락이 팔을 가려도 모른다
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from probe_anim_hands import Clip, mpos  # noqa: E402
from check_anim import acc  # noqa: E402


def use_animation(c, idx):
    """Clip 은 animations[0] 만 읽는다 ⇒ 다른 클립을 고르게 트랙을 다시 짠다."""
    an = c.j['animations'][idx]
    c.anim = an
    c.name = an.get('name', '')
    c.tracks, c.duration = {}, 0.0
    for ch in an['channels']:
        s = an['samplers'][ch['sampler']]
        ts, vs = acc(c.j, c.b, s['input']), acc(c.j, c.b, s['output'])
        if ts:
            c.duration = max(c.duration, ts[-1][0])
        c.tracks.setdefault(ch['target']['node'], {})[ch['target']['path']] = (ts, vs)


def spread(c, t):
    w = c.world(t)
    out = []
    for side in ('Left', 'Right'):
        a, h = c.find(side + 'Arm'), c.find(side + 'Hand')
        pa, ph = mpos(w[a]), mpos(w[h])
        dx, dy = ph[0] - pa[0], ph[1] - pa[1]
        out.append(math.degrees(math.atan2(abs(dx), -dy)))   # 0° = 바로 아래
    return out


def measure(path, names=None, steps=48):
    c = Clip(path)
    anims = c.j.get('animations') or []
    pick = [i for i, a in enumerate(anims)
            if not names or any(n.lower() in a.get('name', '').lower() for n in names)]
    rows = []
    for i in pick:
        use_animation(c, i)
        L, R = [], []
        for k in range(steps):
            l, r = spread(c, c.duration * k / steps)
            L.append(l); R.append(r)
        both = [(l + r) / 2 for l, r in zip(L, R)]
        rows.append((c.name, c.duration, min(both), sum(both) / len(both), max(both),
                     sum(L) / len(L), sum(R) / len(R)))
    return rows


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    steps = int(next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--steps=')), 48))
    if not args:
        print(__doc__); return 1
    path, names = args[0], args[1:]
    print('■ %s' % os.path.basename(path))
    print('   %-44s %6s   %s' % ('클립', '길이', '벌림각 최소 / ★평균 / 최대   (좌 · 우 평균)'))
    for nm, dur, mn, av, mx, l, r in measure(path, names, steps):
        print('   %-44s %5.2f초   %5.1f° / ★%5.1f° / %5.1f°   (%5.1f° · %5.1f°)'
              % (nm[:44], dur, mn, av, mx, l, r))
    return 0


if __name__ == '__main__':
    sys.exit(main())
