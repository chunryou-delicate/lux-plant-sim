# -*- coding: utf-8 -*-
"""tools/leaf/glb_geom.py — GLB 한 장의 «모양»을 잰다 (손으로 연다 · 라이브러리 없이)
   정점 수 · 상자 · ★ 두께(주성분 제일 얇은 축 폭) · 그 두께가 «잎 넓이»의 몇 % 인가
   ⇒ 「기준잎의 2.4배 두께」를 «수»로 확인하려고 만든다."""
import sys, json, struct
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np

CT = {5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
NC = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

def load(path):
    b = open(path,'rb').read()
    assert b[:4] == b'glTF'
    off = 12; js = None; bin_ = None
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off); off += 8
        ch = b[off:off+ln]; off += ln
        if ty == 0x4E4F534A: js = json.loads(ch)
        elif ty == 0x004E4942: bin_ = ch
    return js, bin_

def acc(js, bin_, i):
    a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
    fmt, sz = CT[a['componentType']]; n = NC[a['type']]
    stride = bv.get('byteStride', sz*n)
    base = bv.get('byteOffset',0) + a.get('byteOffset',0)
    out = np.empty((a['count'], n), dtype=np.float64)
    for k in range(a['count']):
        out[k] = struct.unpack_from('<'+fmt*n, bin_, base + k*stride)
    return out

def geom(path):
    js, bin_ = load(path)
    P = []; T = []; base = 0
    for m in js['meshes']:
        for pr in m['primitives']:
            p = acc(js, bin_, pr['attributes']['POSITION'])
            P.append(p)
            if 'indices' in pr:
                idx = acc(js, bin_, pr['indices']).astype(int).reshape(-1,3) + base
                T.append(idx)
            base += len(p)
    P = np.vstack(P); T = np.vstack(T) if T else None
    return P, T

def measure(path):
    P, T = geom(path)
    c = P - P.mean(0)
    w, v = np.linalg.eigh(np.cov(c.T))           # 오름차순
    proj = c @ v
    ext = proj.max(0) - proj.min(0)              # [제일 얇은, 중간, 제일 긴]
    return {'정점': len(P), '삼각': (len(T) if T is not None else 0),
            '상자': [round(float(x),4) for x in (P.max(0)-P.min(0))],
            '주축폭': [round(float(x),4) for x in ext],
            '두께/넓이%': round(float(ext[0]/ext[1]*100),2)}

if __name__ == '__main__':
    for f in sys.argv[1:]:
        r = measure(f)
        print('%-52s %s' % (f.split('/')[-1], json.dumps(r, ensure_ascii=False)))

def local_thickness(path, samples=1500, seed=0):
    """★ 국소 두께 — 정점마다 «법선 반대쪽 면»까지 거리. 잎판이 얇은 껍질이면 작고, 덩어리면 크다.
       법선은 삼각형에서 다시 셈한다(파일 법선을 안 믿는다)."""
    P, T = geom(path)
    a, b, c = P[T[:,0]], P[T[:,1]], P[T[:,2]]
    fn = np.cross(b-a, c-a); ar = np.linalg.norm(fn,axis=1,keepdims=True)+1e-12; fn/=ar
    cen = (a+b+c)/3
    rng = np.random.default_rng(seed)
    pick = rng.choice(len(T), size=min(samples,len(T)), replace=False)
    out = []
    for i in pick:
        o = cen[i]; d = -fn[i]
        # 광선(o → d)과 모든 삼각형 교차 — Möller–Trumbore
        e1 = b-a; e2 = c-a
        h = np.cross(d, e2); det = (e1*h).sum(1)
        ok = np.abs(det) > 1e-12
        inv = np.where(ok, 1/np.where(ok,det,1), 0)
        s = o - a; u = (s*h).sum(1)*inv
        q = np.cross(s, e1); vv = (q*d).sum(1)*inv
        t = (e2*q).sum(1)*inv
        hit = ok & (u>=0) & (vv>=0) & (u+vv<=1) & (t>1e-6)
        hit[i] = False
        if hit.any(): out.append(t[hit].min())
    out = np.array(out)
    size = float(np.linalg.norm(P.max(0)-P.min(0)))
    return {'맞은 광선%': round(len(out)/len(pick)*100,1),
            '두께 중앙(크기 대비%)': round(float(np.median(out))/size*100,3) if len(out) else None,
            '두께 하위25%': round(float(np.percentile(out,25))/size*100,3) if len(out) else None}
