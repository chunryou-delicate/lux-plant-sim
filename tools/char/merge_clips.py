# -*- coding: utf-8 -*-
"""Meshy 가 클립마다 따로 준 GLB 들의 애니메이션을 «리그된 몸 하나»에 뼈 이름으로 모아 붙인다 — 크레딧 0.

2026-10-09 · [Char] · 새 주인공(hero2) — rig 1 + animate 여럿을 게임이 읽는 한 파일로
■ 무엇을
  각 GLB 의 애니메이션(기본 첫 번째 · `파일#이름` 이면 그 이름)을 채널 그대로(회전·위치·배율) 옮긴다.
  대상 노드는 «뼈 이름»으로 찾는다 — 파일마다 노드 번호가 달라도 된다.
  ⛔ 이름이 대상에 없는 뼈의 채널은 버리고 그 수를 찍는다(조용히 삼키지 않는다).
■ graft_rot_clip.py 와 다른 점: 그것은 «회전만» 옮겨 대상 몸의 뼈 길이를 지킨다(다른 몸의 클립용).
  이것은 «같은 리그»에서 나온 클립을 통째로 모은다(위치 채널도 그 몸 것이다).
■ 자기시험  python tools/char/merge_clips.py --selftest   (hero.glb 의 cheer 를 자기에게 다시 붙여 값이 같은지)

쓰기  python tools/char/merge_clips.py <몸.glb> <나갈.glb> <새이름>=<클립.glb>[#클립이름] ...
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
from strip_stray_parts import read_glb, write_glb, acc_array  # noqa: E402
from graft_rot_clip import add_acc  # noqa: E402

TYPE = {1: 'SCALAR', 3: 'VEC3', 4: 'VEC4'}


def merge(js, bn, new_name, src_path, clip=None):
    names = {n.get('name'): i for i, n in enumerate(js['nodes']) if n.get('name')}
    sj, sb = read_glb(src_path)
    anims = sj.get('animations') or []
    if not anims:
        raise SystemExit('⛔ %s 에 애니메이션이 없다' % src_path)
    an = next((a for a in anims if a.get('name') == clip), None) if clip else anims[0]
    if an is None:
        raise SystemExit('⛔ %s 에 %s 클립이 없다' % (src_path, clip))
    snames = [n.get('name') for n in sj['nodes']]
    chans, smps, lost, dur = [], [], set(), 0.0
    for ch in an['channels']:
        nm = snames[ch['target']['node']]
        if nm not in names:
            lost.add(nm); continue
        smp = an['samplers'][ch['sampler']]
        t = acc_array(sj, sb, smp['input']).reshape(-1).astype('<f4')
        v = acc_array(sj, sb, smp['output']).astype('<f4')
        v = v.reshape(len(v), -1) if v.ndim > 1 else v.reshape(-1, 1)
        ia = add_acc(js, bn, t.reshape(-1, 1), 'SCALAR', want_minmax=True)
        oa = add_acc(js, bn, v, TYPE[v.shape[1]])
        smps.append({'input': ia, 'output': oa, 'interpolation': smp.get('interpolation', 'LINEAR')})
        chans.append({'sampler': len(smps) - 1, 'target': {'node': names[nm], 'path': ch['target']['path']}})
        dur = max(dur, float(t.max()))
    js.setdefault('animations', []).append({'name': new_name, 'channels': chans, 'samplers': smps})
    print('  %-12s ← %s%s · 채널 %d · %.2f초%s' % (new_name, os.path.basename(src_path), '#' + clip if clip else '',
                                                len(chans), dur, ('   ⛔ 대상에 없는 뼈 %d: %s' % (len(lost), sorted(lost)[:6])) if lost else ''))
    return len(lost)


def selftest():
    import tempfile
    src = 'assets/v2/char/hero.glb'
    js, bn = read_glb(src)
    n0 = len(js['animations'])
    merge(js, bn, 'cheer_copy', src, 'cheer')
    a = next(x for x in js['animations'] if x['name'] == 'cheer')
    b = js['animations'][n0]
    key = lambda an: {(c['target']['node'], c['target']['path']): c['sampler'] for c in an['channels']}
    ka, kb = key(a), key(b)
    same = set(ka) == set(kb) and all(
        np.array_equal(acc_array(js, bn, a['samplers'][ka[k]]['input']), acc_array(js, bn, b['samplers'][kb[k]]['input'])) and
        np.allclose(acc_array(js, bn, a['samplers'][ka[k]]['output']), acc_array(js, bn, b['samplers'][kb[k]]['output']))
        for k in ka)
    # 망친 판 — 하나를 비틀면 떨어져야 한다
    k0 = next(iter(kb)); o = acc_array(js, bn, b['samplers'][kb[k0]]['output']).copy(); o[0] += 1
    bad = not np.allclose(acc_array(js, bn, a['samplers'][ka[k0]]['output']), o)
    print('자기시험: 같은 클립을 다시 붙여 채널 %d개 값이 %s · 망친 값은 %s' % (len(ka), '✔ 같다' if same else '⛔ 다르다', '✔ 다르다고 잡는다' if bad else '⛔ 못 잡는다'))
    return 0 if same and bad else 1


def main():
    if '--selftest' in sys.argv:
        return selftest()
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 3:
        print(__doc__); return 1
    src, dst = args[0], args[1]
    if os.path.abspath(src) == os.path.abspath(dst):
        print('⛔ 원본을 덮어쓰려 한다'); return 2
    js, bn = read_glb(src)
    lost = 0
    for spec in args[2:]:
        new, rest = spec.split('=', 1)
        path, _, clip = rest.partition('#')
        lost += merge(js, bn, new, path, clip or None)
    js['buffers'][0]['byteLength'] = len(bn)
    write_glb(dst, js, bn)
    print('썼다: %s (%.1fMB) · 클립 %d개%s' % (dst, os.path.getsize(dst) / 1e6, len(js['animations']),
                                          '' if not lost else ' · ⛔ 버린 채널이 있다(위)'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
