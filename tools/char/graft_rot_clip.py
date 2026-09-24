# -*- coding: utf-8 -*-
"""다른 몸의 클립에서 **회전만** 가져와 hero 에 새 클립으로 붙인다 — 크레딧 0.

2026-09-25 · [Char]

■ 왜

hero.glb(T포즈로 리깅)에 Meshy 가 붙여 준 클립은 팔이 너무 벌어졌다 — 잰 것:

    벌림각 평균(0°=차렷)   옛 자취녀 몸   hero 제 클립
    걷기(walking_man)        13.8°          ★82.0°
    idle(Idle)               18.0°          ★38.2°

같은 이름의 클립인데 hero 에서만 팔이 들린다.
⇒ 옛 클립의 «회전»만 뼈 이름으로 옮기고 뼈 길이(translation)·scale 은 hero 제 것을 쓰면
  수로는 걷기 13.8° · idle 18.0° 로 «옛 몸과 똑같이» 나온다(probe_arm_spread 로 잼).
  ⇒ Meshy 24본 뼈대는 몸마다 뼈의 «로컬 축»이 같다는 뜻이다.

■ ⛔ 왜 «회전만»인가

옛 클립을 통째로 얹으면 translation 채널이 hero 뼈 길이를 «1.7m 몸 길이»로 덮어써 몸이 늘어난다.
회전만 가져오면 그 일이 없다.

■ 쓰는 법

    python tools/char/graft_rot_clip.py <hero.glb> <나갈.glb> <새이름>=<hero클립>:<옛클립.glb> [...]
    예) ... walk_rot=walk:assets/characters/3d/char_jachwi_f_walking.glb

  새 클립의 translation·scale 은 <hero클립> 것, rotation 은 <옛클립.glb> 의 첫 클립 것.
  원본 hero.glb 는 안 건드린다(나갈 파일을 따로 쓴다).

■ ⛔ 이 자가 «못» 하는 것

  · 「보기에 괜찮은가」는 모른다 — T포즈 바인드에서 팔을 크게 내리면 겨드랑이 살·팔에 묶인
    머리카락이 어떻게 되는지는 «그려서 눈으로» 봐야 한다
  · 옛 클립과 hero 클립의 길이가 다르면 translation 이 어긋날 수 있다 — 길이를 찍어 준다
"""
import json
import re
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from strip_stray_parts import read_glb, write_glb, acc_array  # noqa: E402  (stride 를 읽는 판)


def add_acc(js, bn, arr, typ, want_minmax=False):
    arr = np.ascontiguousarray(arr, dtype='<f4')
    raw = arr.tobytes()
    while len(bn) % 4:
        bn.append(0)
    off = len(bn)
    bn.extend(raw)
    js['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)})
    a = {'bufferView': len(js['bufferViews']) - 1, 'componentType': 5126,
         'count': int(arr.shape[0]), 'type': typ}
    if want_minmax:                                  # 애니메이션 input 은 min/max 가 필수다
        flat = arr.reshape(arr.shape[0], -1)
        a['min'] = flat.min(0).tolist(); a['max'] = flat.max(0).tolist()
    js['accessors'].append(a)
    return len(js['accessors']) - 1


def graft(js, bn, new_name, hero_clip, src_path, only=None):
    names = [n.get('name') for n in js['nodes']]
    hc = [a for a in js['animations'] if a.get('name') == hero_clip]
    if not hc:
        raise SystemExit('⛔ hero 에 %s 클립이 없다' % hero_clip)
    hc = hc[0]
    sj, sb = read_glb(src_path)
    sa = sj['animations'][0]
    snames = [n.get('name') for n in sj['nodes']]
    rot = {}
    for ch in sa['channels']:
        if ch['target']['path'] == 'rotation':
            smp = sa['samplers'][ch['sampler']]
            rot[snames[ch['target']['node']]] = (acc_array(sj, sb, smp['input']).reshape(-1),
                                                 acc_array(sj, sb, smp['output']).reshape(-1, 4),
                                                 smp.get('interpolation', 'LINEAR'))
    chans, smps, got = [], [], 0
    for ch in hc['channels']:
        path = ch['target']['path']
        node = ch['target']['node']
        smp = hc['samplers'][ch['sampler']]
        take = only is None or re.search(only, names[node] or '')
        if path == 'rotation' and names[node] in rot and take:
            t, v, interp = rot[names[node]]
            ia = add_acc(js, bn, t.reshape(-1, 1), 'SCALAR', want_minmax=True)
            oa = add_acc(js, bn, v, 'VEC4')
            smps.append({'input': ia, 'output': oa, 'interpolation': interp}); got += 1
        else:
            smps.append(dict(smp))                   # translation·scale 은 hero 제 것
        chans.append({'sampler': len(smps) - 1, 'target': {'node': node, 'path': path}})
    js['animations'].append({'name': new_name, 'channels': chans, 'samplers': smps})
    hdur = max(float(acc_array(js, bn, s['input']).max()) for s in hc['samplers'])
    sdur = max(float(v[0].max()) for v in rot.values())
    print('  %-10s ← hero %s(길이 %.2f초) 의 길이·scale + %s 회전 %d뼈(길이 %.2f초)%s'
          % (new_name, hero_clip, hdur, os.path.basename(src_path), got, sdur,
             '' if abs(hdur - sdur) < 0.05 else '   ⚠ 길이가 다르다'))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 3:
        print(__doc__); return 1
    src, dst = args[0], args[1]
    if os.path.abspath(src) == os.path.abspath(dst):
        print('⛔ 원본을 덮어쓰려 한다'); return 2
    js, bn = read_glb(src)
    # --only=정규식 : 그 이름의 뼈만 회전을 옮긴다 (예: 'Shoulder|Arm|Hand' — 팔만)
    #   ⛔ 2026-09-25 — 24뼈 통째로 옮겼더니 팔은 내려왔으나 «몸이 숙고 무릎이 가슴까지» 올라갔다.
    #     벌림각(팔)만 재서 「된다」고 볼 뻔했다. 그려 보고서야 알았다.
    only = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--only=')), None)
    for spec in args[2:]:
        new, rest = spec.split('=', 1)
        hclip, path = rest.split(':', 1)
        graft(js, bn, new, hclip, path, only)
    js['buffers'][0]['byteLength'] = len(bn)
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    write_glb(dst, js, bn)
    print('썼다: %s (%.1fMB)' % (dst, os.path.getsize(dst) / 1e6))
    print('⛔ 이 자는 «보기에 괜찮은가»를 모른다. 그려서 볼 것.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
