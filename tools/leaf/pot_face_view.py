# -*- coding: utf-8 -*-
"""tools/leaf/pot_face_view.py — 화분의 «어느 면이 카메라에 보이나» (2026-08-29 · leaf)

    PYTHONIOENCODING=utf-8 python tools/leaf/pot_face_view.py assets/pots/pot_concrete_round.glb

★ 왜 필요했나 — 방에 화분을 놓고 찍었더니 «밝은 테두리 + 어두운 속»만 보였다.
  색은 **바깥벽**에 칠해져 있다. 그러면 「색이 안 읽힌다」가 아니라
  **「색이 있는 면이 안 보인다」**일 수 있다. 그것을 브라우저 없이 가른다.

★ 카메라 — 코드에서 읽었다(지어낸 값이 아니다):
      src/game/room_view.js:214   BASE_EL_PORTRAIT = 0.86 rad ≈ 49°   (세로 화면)
      src/game/room_view.js:217   YAW_OFFSET = SNAP                   (45° 튼 3/4 시점)

⚠ 이 자가 «못» 하는 것
  · 가림을 안 본다 — 화분 앞에 뭐가 있으면 더 안 보인다. 여기 값은 **가장 좋은 경우**다
  · 원근을 안 본다 — 평행투영으로 잰다. 물건이 작아 차이는 작다
  · 「보인다」와 「읽힌다」는 다르다. 이 자는 **면적**만 낸다
"""

# ── ⚠ 내 창에서만 도는 자가 되지 않게 (2026-08-30 · char 가 잡아 줬다) ──────────
#   ★ 나는 늘 `PYTHONIOENCODING=utf-8` 을 «붙여서» 돌려 왔다. 그래서 «한 번도 안 걸렸다».
#     char 의 cp949 콘솔에서는 이 파일 열 개가 «전부» 죽었다 — 그것도 **검사를 통과한 뒤**
#     마지막 「✔」 한 글자를 찍다가. ⇒ ⛔ 「통과」가 «실패»로 보이고 종료값도 1 이 된다.
#   ⇒ ★★ 「내 창에서만 도는 자」는 자가 아니라 «내 손버릇»이다.
import sys as _sys
for _s in (_sys.stdout, _sys.stderr):
    try: _s.reconfigure(encoding='utf-8')
    except Exception: pass
import base64, json, struct, sys
import numpy as np

EL_DEG, AZ_DEG = 49.0, 45.0
CT = {5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}
NC = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

def read_glb(p):
    d = open(p,'rb').read()
    assert d[:4] == b'glTF'
    o, js, bins = 12, None, b''
    while o < len(d):
        ln, ty = struct.unpack_from('<II', d, o); o += 8
        ch = d[o:o+ln]; o += ln
        if ty == 0x4E4F534A: js = json.loads(ch.decode('utf-8'))
        elif ty == 0x004E4942: bins = ch
    return js, bins

def acc(js, bb, i):
    a = js['accessors'][i]
    bv = js['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset',0) + a.get('byteOffset',0)
    n, c = a['count'], NC[a['type']]
    fmt = CT[a['componentType']]
    itemsz = np.dtype(fmt).itemsize * c
    stride = bv.get('byteStride') or itemsz
    if stride == itemsz:
        arr = np.frombuffer(bb, dtype=fmt, count=n*c, offset=off).reshape(n,c)
    else:                                  # 사이가 벌어진 배열 — 한 줄씩 뜬다
        raw = np.frombuffer(bb, dtype=np.uint8, count=stride*n, offset=off).reshape(n,stride)
        arr = raw[:, :itemsz].copy().view(fmt).reshape(n,c)
    return arr.astype(np.float64) if fmt=='f' else arr.astype(np.int64)

def main(path):
    js, bb = read_glb(path)
    P = []; N = []; I = []
    base = 0
    for m in js['meshes']:
        for pr in m['primitives']:
            if pr.get('mode',4) != 4: continue
            p = acc(js, bb, pr['attributes']['POSITION'])
            nrm = acc(js, bb, pr['attributes']['NORMAL']) if 'NORMAL' in pr['attributes'] else None
            idx = acc(js, bb, pr['indices']).reshape(-1) if 'indices' in pr else np.arange(len(p))
            P.append(p); N.append(nrm if nrm is not None else np.zeros_like(p))
            I.append(idx + base); base += len(p)
    P = np.vstack(P); N = np.vstack(N); I = np.concatenate(I).reshape(-1,3)

    ctr = (P.max(0)+P.min(0))/2
    size = P.max(0)-P.min(0)
    Q = P - ctr
    tri = Q[I]                                   # (T,3,3)
    v1, v2 = tri[:,1]-tri[:,0], tri[:,2]-tri[:,0]
    cr = np.cross(v1, v2)
    area = np.linalg.norm(cr, axis=1)/2
    fn = cr/np.maximum(np.linalg.norm(cr,axis=1,keepdims=True),1e-12)   # 면 법선
    cen = tri.mean(1)

    el, az = np.radians(EL_DEG), np.radians(AZ_DEG)
    cam = np.array([np.cos(el)*np.sin(az), np.sin(el), np.cos(el)*np.cos(az)])  # 표면→카메라

    dot = fn @ cam
    vis = dot > 0
    proj = np.where(vis, area*dot, 0.0)          # 카메라로 보이는 면적

    # 갈래 나누기 — 높이와 법선으로
    hy = size[1]
    rad = cen.copy(); rad[:,1] = 0
    rn  = rad/np.maximum(np.linalg.norm(rad,axis=1,keepdims=True),1e-12)
    outward = np.einsum('ij,ij->i', fn[:,[0,1,2]]*np.array([1,0,1]), rn)
    top = cen[:,1] > (Q[:,1].max() - hy*0.12)

    kinds = {
        '테두리(위)'  : (fn[:,1] >  0.60) &  top,
        '속(안쪽벽)'  : (np.abs(fn[:,1]) <= 0.60) & (outward < 0),
        '★바깥벽'     : (np.abs(fn[:,1]) <= 0.60) & (outward >= 0),
        '윗면(그 밖)' : (fn[:,1] >  0.60) & ~top,
        '바닥'        : (fn[:,1] < -0.60),
    }
    tot = proj.sum()
    print('%s' % path)
    print('  크기 %.3f × %.3f × %.3f (GLB 자체) · 삼각형 %d개' % (size[0],size[1],size[2],len(I)))
    print('  카메라 고도 %.0f° · 방위 %.0f° (room_view.js:214·217 에서 읽음)' % (EL_DEG, AZ_DEG))
    print('  ─ 카메라에 보이는 면적을 100 으로 놓으면 ─')
    acc_ = 0.0
    for k, m in kinds.items():
        v = proj[m].sum(); acc_ += v
        print('    %-12s %6.1f%%' % (k, 100*v/max(tot,1e-9)))
    print('    %-12s %6.1f%%' % ('(나머지)', 100*(tot-acc_)/max(tot,1e-9)))

if __name__ == '__main__':
    for p in (sys.argv[1:] or ['assets/pots/pot_concrete_round.glb']):
        main(p); print()
