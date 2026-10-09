"""tools/glb_rotate_y.py — GLB 꼭짓점(위치·법선·탄젠트)을 Y 축으로 돌려 굽는다 ([house] · 2026-10-10)

    python -I tools/glb_rotate_y.py <in.glb> <out.glb> --deg -57

왜: Tripo 는 원화(3/4 각도 그림)를 따라 물건을 비스듬히 낼 때가 있다(전신 거울 유리 법선이 +Z 에서 57° · 화장대 14° · 파티션 17°).
    옷 층(furniture_dress)의 yaw 로 돌리면 three r13x 의 Box3.setFromObject 가 «기하 상자를 돌린 상자»를 재서
    90° 배수가 아닌 각에서는 상자가 헐거워지고 → 옷이 발자국보다 작게 입혀진다. 그래서 돌림을 파일에 굽고 yaw 는 90° 배수로 둔다.
돌리는 쪽: three 의 rotation.y 와 같다 — x' = x·cos + z·sin · z' = −x·sin + z·cos (deg > 0 이면 +Z 가 +X 쪽으로).
무엇을 바꾸나: float VEC3 POSITION·NORMAL, VEC4 TANGENT 의 xyz 바이트만 제자리에서 갈고 POSITION min/max 를 다시 쓴다.
    그림·UV·인덱스·재질은 한 바이트도 안 건드린다. 노드 변환(rotation·matrix)이 있으면 멈춘다(Tripo·Meshy 는 없다).
"""
import math, sys
import numpy as np
sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from glb_tex_webp import read_glb, write_glb


def main():
    a = sys.argv[1:]; src, dst = a[0], a[1]
    d = float(a[a.index('--deg') + 1])
    js, bins = read_glb(src)
    for n in js.get('nodes', []):
        if any(k in n for k in ('rotation', 'matrix', 'scale')):
            sys.exit(f'노드 변환이 있다({n.get("name")}) — 이 자는 꼭짓점만 돌린다')
    t = math.radians(d); c, s = math.cos(t), math.sin(t)
    buf = bytearray(bins); done = set()
    for m in js['meshes']:
        for pr in m['primitives']:
            for key in ('POSITION', 'NORMAL', 'TANGENT'):
                ai = pr['attributes'].get(key)
                if ai is None or ai in done: continue
                acc = js['accessors'][ai]; bv = js['bufferViews'][acc['bufferView']]
                k = {'VEC3': 3, 'VEC4': 4}[acc['type']]
                assert acc['componentType'] == 5126, f'{key} 가 float 가 아니다'
                stride = bv.get('byteStride') or 4 * k
                off = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
                rows = np.ndarray((acc['count'], k), dtype='<f4', buffer=buf, offset=off, strides=(stride, 4))
                x, z = rows[:, 0].copy(), rows[:, 2].copy()
                rows[:, 0] = x * c + z * s; rows[:, 2] = -x * s + z * c
                if key == 'POSITION':
                    acc['min'] = [float(v) for v in rows[:, :3].min(0)]; acc['max'] = [float(v) for v in rows[:, :3].max(0)]
                    lo, hi = rows[:, :3].min(0), rows[:, :3].max(0)
                    print(f'  {key} {acc["count"]} · 돌린 뒤 상자 {(hi - lo).round(3).tolist()}')
                done.add(ai)
    write_glb(dst, js, bytes(buf))
    print(f'  {d:+.1f}° → {dst}')


if __name__ == '__main__':
    main()
