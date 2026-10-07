# -*- coding: utf-8 -*-
"""tools/leaf/thin_leaf.py — 잎 GLB 를 «점마다 제 두께만큼만» 얇힌다 (반대면을 못 넘는다)

왜: plant_grow.reshapeLeaf 는 잎을 얇힐 때 정점을 법선 반대로 «메시 하나에 한 값»(thick)만큼 민다.
    두께가 고르지 않은 잎(하프문 중간잎 29~31)은 얇은 곳에서 그 값이 국소 두께의 절반을 넘어
    «반대면을 뚫는다» — 그래서 그 셋이 못(ALBO_MID_POOL)에서 빠져 있다(plant_grow.html:1866).
어떻게: 정점마다 법선 반대로 광선을 쏴 «그 자리의 두께 t» 를 잰다. 그리고 t*(1-KEEP)/2 만 민다.
    양쪽 면이 저마다 제 반만큼 다가오므로 가운데서 만나기 전에 멈춘다(KEEP>0 이면 안 겹친다).
    ⇒ 얇힌 에셋에 bladeR:1(실행 중 밀기 없음)을 주면 구멍이 날 자리가 사라진다.
지키는 것: POSITION 값만 바꾼다(같은 바이트 수). 텍스처·UV·인덱스·노드·이름은 한 바이트도 안 건드린다.
         법선이 파일에 있으면 그것도 그대로 둔다(three 가 다시 셈하지 않게) — 없으면 없는 그대로.
쓰는 법: python tools/leaf/thin_leaf.py IN.glb OUT.glb [KEEP=0.35]
⛔ 2026-10-08 — 하프문에 써 봤더니 «안 됐다»: 미리 얇혀도 가운데 이음매가 찢겼다.
   까닭은 두께가 아니라 «이음매 법선»이었다(쪼개진 정점 짝의 법선이 54~77% 갈림 · seam_normals.py).
   ⇒ 하프문은 weld_normals.py 로 고쳤다. 이 도구는 남겨 두되(write() 를 weld 가 쓴다) 하프문엔 안 쓴다.
"""
import sys, json, struct
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb_geom import load, acc, CT, NC

def chunks(path):
    b = open(path,'rb').read()
    off = 12; out = []
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off); out.append((ty, b[off+8:off+8+ln])); off += 8+ln
    return out

def write(path, js, bin_):
    j = json.dumps(js, ensure_ascii=False, separators=(',',':')).encode('utf-8')
    j += b' ' * ((4 - len(j) % 4) % 4)
    bn = bin_ + b'\0' * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(j) + 8 + len(bn)
    with open(path,'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(j), 0x4E4F534A)); f.write(j)
        f.write(struct.pack('<II', len(bn), 0x004E4942)); f.write(bn)

def ray_min_t(o, d, a, e1, e2, skip=None):
    h = np.cross(d, e2); det = (e1*h).sum(1)
    ok = np.abs(det) > 1e-12
    inv = np.where(ok, 1/np.where(ok,det,1), 0)
    s = o - a; u = (s*h).sum(1)*inv
    q = np.cross(s, e1); v = (q*d).sum(1)*inv
    t = (e2*q).sum(1)*inv
    hit = ok & (u>=-1e-6) & (v>=-1e-6) & (u+v<=1+1e-6) & (t>1e-5)
    if skip is not None: hit[skip] = False
    return t[hit].min() if hit.any() else None

CAP = 0.15
def thin(src, dst, keep=0.35):
    js, bin_ = load(src)
    bin_ = bytearray(bin_)
    report = []
    for mi, m in enumerate(js['meshes']):
        for pi, pr in enumerate(m['primitives']):
            ai = pr['attributes']['POSITION']
            a = js['accessors'][ai]; bv = js['bufferViews'][a['bufferView']]
            assert a['componentType'] == 5126 and a['type'] == 'VEC3'
            P = acc(js, bytes(bin_), ai)
            if 'indices' not in pr: report.append((mi,pi,'인덱스 없음 — 건너뜀')); continue
            T = acc(js, bytes(bin_), pr['indices']).astype(int).reshape(-1,3)
            A, B, C = P[T[:,0]], P[T[:,1]], P[T[:,2]]
            fn = np.cross(B-A, C-A)                          # 면적 가중 그대로
            vn = np.zeros_like(P)
            for k in range(3): np.add.at(vn, T[:,k], fn)
            vn /= (np.linalg.norm(vn,axis=1,keepdims=True)+1e-12)
            e1, e2 = B-A, C-A
            size = float(np.linalg.norm(P.max(0)-P.min(0)))
            cap = size * CAP                                  # 이보다 먼 «반대면»은 잎판이 아니라 다른 갈래다
            moved = 0; ts = []; flips = 0
            NP = P.copy()
            for i in range(len(P)):
                # ★ 법선이 뒤집힌 면이 섞여 있다(하프문 · 실측: 한쪽으로만 쏘면 12% 만 맞았다)
                #   ⇒ 양쪽으로 쏴서 «가까운 반대면» 쪽으로 당긴다. 방향을 안 믿는다.
                t1 = ray_min_t(P[i], -vn[i], A, e1, e2)
                t2 = ray_min_t(P[i],  vn[i], A, e1, e2)
                cand = [(t, -1) for t in (t1,) if t is not None] + [(t, +1) for t in (t2,) if t is not None]
                cand = [c for c in cand if c[0] <= cap]
                if not cand: continue
                t, sgn = min(cand)
                if sgn > 0: flips += 1
                ts.append(t)
                NP[i] = P[i] + sgn * vn[i] * t * (1-keep) / 2
                moved += 1
            # 같은 바이트 자리에 그대로 쓴다
            stride = bv.get('byteStride', 12)
            base = bv.get('byteOffset',0) + a.get('byteOffset',0)
            for i in range(len(NP)):
                struct.pack_into('<fff', bin_, base + i*stride, *map(float, NP[i]))
            a['min'] = [float(x) for x in NP.min(0)]; a['max'] = [float(x) for x in NP.max(0)]
            report.append((mi, pi, '정점 %d · 민 것 %d(%.0f%%) · 뒤집힌 쪽 %d · 두께 중앙 %.4f(크기 %.3f의 %.2f%%)' % (
                len(P), moved, moved/len(P)*100, flips, float(np.median(ts)) if ts else 0, size,
                (float(np.median(ts))/size*100) if ts else 0)))
    write(dst, js, bytes(bin_))
    return report

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    keep = float(sys.argv[3]) if len(sys.argv) > 3 else 0.35
    for r in thin(src, dst, keep): print('  메시%d·조각%d  %s' % r)
    print('★ 썼다:', dst)
