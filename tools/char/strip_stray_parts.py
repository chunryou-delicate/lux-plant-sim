# -*- coding: utf-8 -*-
"""GLB 에서 **몸과 이어지지 않은 조각**을 지운다 — 가장 큰 덩어리만 남긴다.

2026-09-07 · [Char] · 크레딧 0

■ 왜

원화 4뷰로 구운 맨몸에 **바닥판이 같이 구워졌다.**
클립을 얹으면 그 판이 뼈를 따라 움직이며 «검은 망토»처럼 뻗는다.

    기존 자취녀      1덩어리 100.0%    ✔
    시험몸(안 터짐)  1덩어리 100.0%    ✔
    본판(터짐)       ⛔ 3덩어리 · 50.8% + 50,803점 + 3점

■ ★★ 「덩어리」를 세려면 **점을 «먼저» 합쳐야 한다** — 이 판의 모든 GLB 에 걸린다

UV·법선 이음매마다 정점이 갈라져 있어서, 그냥 세면 **기존 자취녀도 「75덩어리」**로 나온다.
⇒ 「사람이 그럴 리 없다」로 잡았다. ★ 위치가 같은 점을 합친 뒤에 세야 한다.

■ ⛔⛔ 「가장 큰 덩어리 = 몸」이 아니다 — 2026-09-07 에 물렸다

    본판 리깅 전   판 61,024점  ·  몸 58,335점   ⇒ ★ 판이 «더 크다»
    ⇒ 「큰 것을 남긴다」로 했더니 **판만 남고 몸이 지워졌다.**
    ⇒ ⇒ ★★ 그래서 «세로폭»으로 고른다. 몸은 길고 판은 납작하다.

■ ⛔ 이 자가 «하는» 것과 «안 하는» 것

    한다    인덱스에서 «작은 덩어리의 삼각형»을 뺀다. 새 GLB 를 «사본»으로 낸다
    안 한다 정점·UV·무게·뼈는 **안 건드린다.** 안 쓰는 정점은 남는다(안 그려질 뿐)
    ⛔ 못 한다  「지우면 잘 돌까」는 모른다. **지운 뒤 눈으로 봐야 한다**

■ 쓰는 법

    python tools/char/strip_stray_parts.py <들어온.glb> <나갈.glb>
    python tools/char/strip_stray_parts.py ... --keep 2      # 큰 것 둘을 남긴다
    ★ python tools/char/strip_stray_parts.py <들어온.glb> --count   # «세기만» 한다. 안 쓴다

■ ★★ 새로 구운 GLB 는 «리깅 걸기 전에» 이것부터 세라

    1덩어리 100%   ⇒ ✔ 성하다. 리깅 걸어도 된다
    여럿           ⇒ ⛔ 판·액자가 같이 구워졌다. **리깅 5크레딧 쓰지 말 것**
    ⇒ 2026-09-07 에 「액자 판에 새겨진 부조」가 그대로 구워졌다. 리깅도 걸고 클립도 얹은 뒤에 알았다.
"""
import array
import json
import os
import struct
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import numpy as np

CT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
SZ = {'b': 1, 'B': 1, 'h': 2, 'H': 2, 'I': 4, 'f': 4}


def read_glb(path):
    with open(path, 'rb') as f:
        magic, ver, total = struct.unpack('<4sII', f.read(12))
        if magic != b'glTF':
            raise ValueError('glTF 가 아니다')
        js = bn = None
        while f.tell() < total:
            ln, kind = struct.unpack('<I4s', f.read(8))
            d = f.read(ln)
            if kind == b'JSON':
                js = json.loads(d.decode('utf-8'))
            elif kind[:3] == b'BIN':
                bn = bytearray(d)
    return js, bn


def write_glb(path, js, bn):
    j = json.dumps(js, separators=(',', ':')).encode('utf-8')
    j += b' ' * ((4 - len(j) % 4) % 4)
    b = bytes(bn) + b'\x00' * ((4 - len(bn) % 4) % 4)
    total = 12 + 8 + len(j) + 8 + len(b)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(j), b'JSON')); f.write(j)
        f.write(struct.pack('<I4s', len(b), b'BIN\x00')); f.write(b)


def acc_array(js, bn, i):
    a = js['accessors'][i]
    bv = js['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    nc = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    c = CT[a['componentType']]
    ar = array.array(c)
    ar.frombytes(bytes(bn[off:off + a['count'] * nc * SZ[c]]))
    return np.array(ar).reshape(-1, nc) if nc > 1 else np.array(ar)


def components(pos, tri, h):
    """★ 위치가 같은 점을 «먼저» 합친 뒤 이어진 덩어리를 낸다."""
    key = np.round(pos / (h * 2e-4)).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    m = int(inv.max()) + 1
    par = np.arange(m)

    def find(x):
        r = x
        while par[r] != r:
            r = par[r]
        while par[x] != r:
            par[x], x = r, par[x]
        return r

    for a, b, c in inv[tri]:
        ra, rb = find(a), find(b)
        if ra != rb:
            par[rb] = ra
        rc = find(c)
        if find(a) != rc:
            par[rc] = find(a)
    roots = np.array([find(i) for i in range(m)])
    return roots[inv]           # 원래 정점마다 «덩어리 번호»


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    keep = 1
    if '--keep' in sys.argv:
        keep = int(sys.argv[sys.argv.index('--keep') + 1])
    count_only = '--count' in sys.argv
    if len(args) < (1 if count_only else 2):
        print(__doc__)
        return 1
    src = args[0]
    dst = args[1] if len(args) > 1 else None
    if dst and os.path.abspath(src) == os.path.abspath(dst):
        print('⛔ 원본을 덮어쓰려 한다. 다른 이름을 주십시오')
        return 2

    js, bn = read_glb(src)
    total_cut = 0
    for mi, mesh in enumerate(js.get('meshes', [])):
        for pi, pr in enumerate(mesh.get('primitives', [])):
            if 'indices' not in pr or 'POSITION' not in pr.get('attributes', {}):
                continue
            pos = acc_array(js, bn, pr['attributes']['POSITION'])
            idx = acc_array(js, bn, pr['indices']).reshape(-1, 3)
            h = float(pos[:, 1].max() - pos[:, 1].min()) or 1.0
            lab = components(pos, idx, h)
            ids, cnt = np.unique(lab, return_counts=True)
            # ⛔⛔ 처음엔 «가장 큰 덩어리»를 몸으로 봤다. ★ 틀렸다 —
            #   바닥판이 61,024점이고 몸이 58,335점이라 **판만 남았다.**
            #   ⇒ ★★ 「크다」와 「몸이다」는 다른 말이다. 오늘 또 겪었다.
            # ⇒ ✔ 몸은 «세로로 길다». 판은 납작하다. ⇒ y 폭으로 고른다.
            span = np.array([float(np.ptp(pos[lab == i][:, 1])) for i in ids])
            order = np.argsort(span)[::-1]
            print('  메시 %d 조각 %d — 덩어리 %d개' % (mi, pi, len(cnt)))
            for k in order[:5]:
                print('     %7d점 · ★ 세로폭 %.4f (키의 %.0f%%)'
                      % (cnt[k], span[k], span[k] / h * 100))
            big = cnt[order[0]] / len(pos) * 100
            if count_only:
                print('    ⇒ %s' % ('✔ 1덩어리 %.1f%% — 성하다. 리깅 걸어도 된다' % big
                                     if len(cnt) == 1 else
                                     '⛔ %d덩어리 — 판·액자가 섞였다. ★ 리깅 5크레딧 쓰지 말 것' % len(cnt)))
                continue
            if len(cnt) <= keep:
                print('    ⇒ 지울 것이 없다')
                continue
            live = set(ids[order[:keep]].tolist())
            tri_keep = np.array([all(lab[v] in live for v in t) for t in idx])
            print('    ⇒ ★ 삼각 %d 중 %d 를 «지운다» (%.1f%%)'
                  % (len(idx), (~tri_keep).sum(), (~tri_keep).mean() * 100))
            total_cut += int((~tri_keep).sum())

            new = idx[tri_keep].reshape(-1)
            a = js['accessors'][pr['indices']]
            c = CT[a['componentType']]
            raw = array.array(c, new.tolist()).tobytes()
            # ★ BIN 끝에 새 인덱스를 붙이고 그쪽을 가리키게 한다 — 옛 자리는 안 건드린다
            while len(bn) % 4:
                bn.append(0)
            off = len(bn)
            bn.extend(raw)
            js['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)})
            js['accessors'].append({'bufferView': len(js['bufferViews']) - 1,
                                    'componentType': a['componentType'],
                                    'count': int(len(new)), 'type': 'SCALAR'})
            pr['indices'] = len(js['accessors']) - 1

    if count_only:
        return 0
    js['buffers'][0]['byteLength'] = len(bn)
    write_glb(dst, js, bn)
    print('썼다: %s  (삼각 %d 지움 · %.1fMB)' % (dst, total_cut, os.path.getsize(dst) / 1e6))
    print('⛔ 이 자는 «잘 돌까»를 모른다. ★ 지운 뒤 눈으로 볼 것.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
