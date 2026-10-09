# -*- coding: utf-8 -*-
"""얼굴이 +Z(glTF 앞)를 보게 메시 정점을 Y 축으로 90° 단위 돌려 굽는다 — 크레딧 0.

2026-10-10 · [Char] · 유니티 주인공 Tripo 3만 면 판이 +X 를 보고 왔다(노드 회전 없음 · 정점에 구워짐).
  리그(Meshy rig · Higgsfield 3d_rigging)는 앞=+Z 로 본다 — 옆을 보는 몸에 뼈를 심으면 팔·다리 자리를 잘못 잡는다.
■ 얼굴 쪽 찾기: g2_check.face_forward 와 같은 자(머리 높이 살색 무게중심이 머리 무게중심에서 어느 쪽인가)
■ 돌리는 것: POSITION · NORMAL(· TANGENT 의 xyz) — accessor min/max 도 고친다. 스킨·애니가 있는 파일은 거절한다(리그 전 판만)

쓰기  python tools/char/glb_face_z.py <들어온.glb> <나갈.glb>
"""
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
from strip_stray_parts import read_glb, write_glb  # noqa: E402
from g2_check import load, face_forward  # noqa: E402


def rot_y(a, deg):
    t = np.radians(deg)
    c, s = np.cos(t), np.sin(t)
    out = a.copy()
    out[:, 0] = a[:, 0] * c + a[:, 2] * s
    out[:, 2] = -a[:, 0] * s + a[:, 2] * c
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        print(__doc__); return 1
    src, dst = args
    _, V, F, UV, tex = load(src)
    _, turned = face_forward(V, UV, tex)
    js, bn = read_glb(src)
    if js.get('skins') or js.get('animations'):
        raise SystemExit('⛔ 스킨·애니가 있는 파일이다 — 리그 전 판만 돌린다')
    if not turned:
        print('얼굴이 이미 +Z — 그대로 둔다'); return 0
    deg = -turned                                      # 얼굴 각만큼 되돌린다
    done = set()
    for m in js['meshes']:
        for p in m['primitives']:
            for key in ('POSITION', 'NORMAL', 'TANGENT'):
                ai = p['attributes'].get(key)
                if ai is None or ai in done:
                    continue
                done.add(ai)
                a = js['accessors'][ai]
                if a['componentType'] != 5126:
                    raise SystemExit('⛔ %s 가 float 가 아니다' % key)
                bv = js['bufferViews'][a['bufferView']]
                n = 4 if a['type'] == 'VEC4' else 3
                stride = bv.get('byteStride') or 4 * n
                base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
                arr = np.array([struct.unpack_from('<%df' % n, bn, base + i * stride) for i in range(a['count'])], np.float32)
                arr[:, :3] = rot_y(arr[:, :3], deg)
                for i in range(a['count']):
                    struct.pack_into('<%df' % n, bn, base + i * stride, *arr[i].tolist())
                if key == 'POSITION':
                    a['min'] = arr[:, :3].min(0).tolist(); a['max'] = arr[:, :3].max(0).tolist()
    write_glb(dst, js, bn)
    _, V2, _, UV2, tex2 = load(dst)
    _, t2 = face_forward(V2, UV2, tex2)
    print('돌림 %+.0f° · 다시 잰 얼굴 각 %+.0f° %s' % (deg, t2, '✔' if t2 == 0 else '⛔'))
    print('썼다: %s (%.2fMB)' % (dst, os.path.getsize(dst) / 1e6))
    return 0 if t2 == 0 else 2


if __name__ == '__main__':
    sys.exit(main())
