# -*- coding: utf-8 -*-
"""**뼈 무게를 옮긴다** — 리깅된 몸에서 «리깅 안 된» 메시로. 1단계(최근접 복사)만.

2026-09-07 · [Char] · 크레딧 0

■ 왜

Meshy 는 에셋마다 «독립적으로» 리깅한다 ⇒ 옷을 따로 리깅하면
**몸과 다른 스켈레톤·다른 bind pose·다른 본 순서**가 나온다.
⇒ ★ 그래서 옷은 «메시만» 뽑고 무게는 **우리 몸에서 이식**해야 한다.
  (우리가 겪은 「옷 리깅 422 거절」은 흠이 아니라 «해서는 안 될 일»이었다)

■ ★ 표준 — Robust Skin Weights Transfer via Weight Inpainting (Epic · SIGGRAPH Asia 2023)

    1단계 확신 전송   최근접 표면점에서 복사 — 거리 D · 법선각 Θ 를 «통과한» 점만
                     기본값 D = 0.05 × 바운딩박스 대각 · Θ = 30~35°
    2단계 인페인팅    탈락한 점은 복사 «안 하고» 라플라시안으로 «푼다»

⇒ ⛔ **이 자는 1단계만 한다.** 2단계는 「탈락이 몇 %인가」를 «센 뒤에» 정한다.
  ⇒ ★ 탈락이 적으면 2단계가 필요 없을 수도 있다. 판을 바꾸는 일은 나중에.

■ ⛔⛔ 이 자가 «못» 하는 것 — 먼저 적는다

  · 「옮기면 잘 움직일까」는 **모른다.** 옮긴 뒤 «눈으로» 봐야 한다
  · **2단계(인페인팅)를 안 한다.** 탈락한 점은 «가장 가까운 점의 무게를 그냥 쓴다»
    ⇒ ★ 그것이 틀릴 수 있다. 탈락률을 찍으니 그 수를 보고 판단할 것
  · 「법선각」은 **정점 법선**으로 잰다. 표면점 보간을 안 한다(그건 2단계 자리다)
  · 뼈대(nodes·skin·inverseBindMatrices)를 «그대로 베낀다» — 새로 계산하지 않는다
    ⇒ ⚠ 그러니 **몸과 옷이 «같은 자리·같은 크기»여야 한다.** 아니면 먼저 맞춰야 한다

■ ★ 쓰는 법

    python tools/char/transfer_weights.py <몸.glb> <옷.glb> <나갈.glb>
    python tools/char/transfer_weights.py <몸.glb> --selftest      # ★ 자기 자신에게 대 본다
"""
import array
import json
import os
import struct
import sys

# ⛔⛔ 2026-09-07 — cp949 콘솔에서 «한글을 찍다가» 죽으면 그것이 「없음」처럼 읽힌다.
#   `python -c "import scipy;print('✔ scipy 있음')"` 이 죽어서 「scipy 없음」으로 냈다.
#   ⇒ ★ preview_recolor.py:24 가 그 함정을 이미 적어 두었는데 «내 손에는 안 걸었다».
#     ⇒ ⇒ 읽은 것과 «거는 것»은 다르다. 그래서 여기 박아 둔다.
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import numpy as np

CT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
SZ = {'b': 1, 'B': 1, 'h': 2, 'H': 2, 'I': 4, 'f': 4}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    with open(path, 'rb') as f:
        magic, _v, total = struct.unpack('<4sII', f.read(12))
        if magic != b'glTF':
            raise ValueError('glTF 가 아니다: ' + path)
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
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(j) + 8 + len(b)))
        f.write(struct.pack('<I4s', len(j), b'JSON')); f.write(j)
        f.write(struct.pack('<I4s', len(b), b'BIN\x00')); f.write(b)


def acc(js, bn, i):
    a = js['accessors'][i]
    bv = js['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    # ⛔⛔ 2026-09-24 — «끼워 넣은 버퍼»(byteStride)를 무시했다.
    #   Meshy 옛 파일은 속성마다 bufferView 가 따로라 stride 가 없어 우연히 맞았다.
    #   assets/v2/char/hero.glb 는 POSITION·NORMAL·UV·JOINTS·WEIGHTS 를 stride 52 로 한데 끼웠다.
    #   ⇒ 연속으로 읽으니 법선·UV 가 위치에 섞여 «키 2.05 정육면체 · 482덩어리»가 나왔고,
    #     이 자가 멀쩡한 몸에 「판이 섞였다 · 리깅 쓰지 말 것」을 냈다.
    #   ⇒ ★ 파일의 min/max(키 1.10)와 달라서 잡았다. 그래서 그 대조를 «관문»으로 박는다.
    nc = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    c = CT[a['componentType']]
    esz = SZ[c] * nc
    stride = bv.get('byteStride') or esz
    n = a['count']
    if off + (n - 1) * stride + esz > len(bn):
        raise SystemExit('⛔ accessor %d 가 버퍼 밖을 가리킨다' % i)
    raw = np.frombuffer(bytes(bn), dtype=np.uint8)
    rows = np.lib.stride_tricks.as_strided(raw[off:], shape=(n, esz), strides=(stride, 1))
    out = np.ascontiguousarray(rows).view(np.dtype('<' + c)).reshape(n, nc)
    # ★ 관문 — 파일에 적힌 min/max 와 «다르게» 읽었으면 이 자가 틀린 것이다
    if 'min' in a and 'max' in a and a['componentType'] == 5126:
        mn, mx = out.min(0), out.max(0)
        tol = 1e-4 * max(1.0, float(np.max(np.abs(a['max']))))
        if np.abs(mn - a['min']).max() > tol or np.abs(mx - a['max']).max() > tol:
            raise SystemExit('⛔ accessor %d: 읽은 범위가 파일의 min/max 와 다르다 — 이 자가 잘못 읽고 있다' % i)
    return (out if nc > 1 else out.reshape(-1)), a


def norm_weights(w, comp):
    """WEIGHTS_0 는 float 이거나 정규화된 정수다."""
    if comp == 5126:
        return w.astype(np.float64)
    mx = float(np.iinfo({5121: np.uint8, 5123: np.uint16}[comp]).max)
    return w.astype(np.float64) / mx


def add_accessor(js, bn, data, comp, typ):
    """BIN 끝에 붙이고 새 accessor 번호를 낸다 — 옛 자리는 안 건드린다."""
    c = CT[comp]
    raw = array.array(c, data.reshape(-1).tolist()).tobytes()
    while len(bn) % 4:
        bn.append(0)
    off = len(bn)
    bn.extend(raw)
    js['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)})
    a = {'bufferView': len(js['bufferViews']) - 1, 'componentType': comp,
         'count': int(len(data)), 'type': typ}
    js['accessors'].append(a)
    return len(js['accessors']) - 1


def prim_of(js, mi=0, pi=0):
    return js['meshes'][mi]['primitives'][pi]


def read_skin_source(path):
    """몸에서 «점 · 법선 · 뼈번호 · 무게 · 뼈이름»을 읽는다."""
    js, bn = read_glb(path)
    pr = prim_of(js)
    at = pr['attributes']
    for need in ('POSITION', 'JOINTS_0', 'WEIGHTS_0'):
        if need not in at:
            raise ValueError('몸에 %s 가 없다 — 리깅된 GLB 를 주십시오' % need)
    pos, _ = acc(js, bn, at['POSITION'])
    nrm = acc(js, bn, at['NORMAL'])[0] if 'NORMAL' in at else None
    jnt, _ = acc(js, bn, at['JOINTS_0'])
    wgt, wa = acc(js, bn, at['WEIGHTS_0'])
    sk = js['skins'][0]
    names = [js['nodes'][x].get('name', '#%d' % x) for x in sk['joints']]
    return dict(js=js, bn=bn, pos=pos, nrm=nrm, jnt=jnt,
                wgt=norm_weights(wgt, wa['componentType']), names=names)


def transfer(src, dst_pos, dst_nrm, D=None, theta_deg=30.0, limit=4, k=12):
    """★ 1단계 — 최근접 표면점에서 복사. 거리·법선각을 «통과한» 점만 확신으로 본다."""
    from scipy.spatial import cKDTree
    lo, hi = src['pos'].min(0), src['pos'].max(0)
    diag = float(np.linalg.norm(hi - lo))
    if D is None:
        D = 0.05 * diag                       # ★ 표준 기본값
    # ★ 이웃 k 개 «거리 가중 평균» (2026-09-14 · 박사님 「움직일 때랑」)
    #   최근접 «하나»만 베끼면 가랑이(몸에서 먼 자리)에서 이웃 옷 점끼리 다른 다리 살을 베껴 걸을 때 4~5% 변이 찢어졌다.
    #   좌우를 갈라 찾아도 x=0 에서 단이 생겨 그대로였다. ⇒ k=12 를 1/d² 로 섞으면 두 다리 사이는 반반이 되어 «띠»로 늘어난다.
    tree = cKDTree(src['pos'])
    k = min(k, len(src['pos']))
    dk, ik = tree.query(dst_pos, k=k)
    if k == 1:                               # cKDTree 는 k=1 이면 1차원으로 돌려준다
        dk, ik = dk[:, None], ik[:, None]
    dist, idx = dk[:, 0], ik[:, 0]
    wk = 1.0 / (dk ** 2 + 1e-6); wk /= wk.sum(1, keepdims=True)
    nb_ = int(src['jnt'].max()) + 1
    dense = np.zeros((len(dst_pos), nb_))
    for c in range(k):
        Jc = src['jnt'][ik[:, c]].astype(np.int64); Wc = src['wgt'][ik[:, c]] * wk[:, c:c + 1]
        for q in range(Jc.shape[1]):
            np.add.at(dense, (np.arange(len(dst_pos)), Jc[:, q]), Wc[:, q])
    ok_d = dist <= D
    if dst_nrm is not None and src['nrm'] is not None:
        a = dst_nrm / (np.linalg.norm(dst_nrm, axis=1, keepdims=True) + 1e-12)
        b = src['nrm'][idx]
        b = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-12)
        cos = np.clip((a * b).sum(1), -1, 1)
        ok_n = cos >= np.cos(np.deg2rad(theta_deg))
    else:
        ok_n = np.ones(len(dst_pos), bool)
    confident = ok_d & ok_n

    order = np.argsort(-dense, axis=1)[:, :limit]
    J = order.astype(np.int64)
    W = np.take_along_axis(dense, order, 1)
    # ★ 본 수 제한 — 작은 것부터 버리고 다시 정규화
    if W.shape[1] > limit:
        order = np.argsort(-W, axis=1)[:, :limit]
        J = np.take_along_axis(J, order, 1)
        W = np.take_along_axis(W, order, 1)
    s = W.sum(1, keepdims=True)
    W = np.where(s > 1e-9, W / np.maximum(s, 1e-9), 0.0)
    stat = dict(D=D, diag=diag, dist_med=float(np.median(dist)),
                dist_p90=float(np.percentile(dist, 90)),
                drop_d=float((~ok_d).mean() * 100),
                drop_n=float((~ok_n).mean() * 100),
                drop=float((~confident).mean() * 100))
    return J, W, confident, stat


def selftest(body):
    """★★ 「이미 옳다고 아는 것」에 먼저 댄다 — 몸을 «자기 자신»에게 이식한다.

    같은 점을 같은 점에서 옮기는 것이므로 **원래 무게와 «똑같이» 나와야 한다.**
    안 같으면 자가 틀린 것이다.

    ⛔⛔ 2026-09-24 — 이 시험이 9/14 부터 «늘 떨어지고» 있었다(뼈번호 다른 칸 13.59%).
      9/14 에 이식을 「최근접 1개 복사」→「이웃 12개 섞기」로 바꿨는데(가랑이 찢김 고침)
      ★ 시험은 «그대로» 두었다. 섞으면 자기 자신에게 옮겨도 똑같이 나올 수 없다.
      게다가 뼈 칸을 무게 순으로 다시 늘어놓아 «차례만 달라도» 다르다고 셌다.
      ⇒ 곧 «자가 틀린 것»이 아니라 «시험이 낡은 것»이었다. 9/7 판(0da9d57)은 지금도 통과한다.
    ⇒ ✔ 그래서 이 시험은 이제 **k=1(섞지 않음)** 으로 «배관»(읽기·뼈 칸·정규화)만 본다.
      비교는 칸 차례와 상관없이 «뼈마다 무게»로 한다.
      ⚠ k=12 섞기가 «잘» 섞는지는 이 시험으로 못 본다 — 걸어 보고(check_motion) 눈으로 볼 일이다."""
    src = read_skin_source(body)
    J, W, conf, st = transfer(src, src['pos'], src['nrm'], k=1)
    print('■ ★★ 자기시험 — %s 를 «자기 자신»에게 이식' % os.path.basename(body))
    print('   점 %d · 대각 %.4f · D %.4f' % (len(src['pos']), st['diag'], st['D']))
    print('   최근접 거리  중앙값 %.6f · 90%% %.6f      (0 이어야 맞다)' % (st['dist_med'], st['dist_p90']))
    print('   탈락  거리 %.2f%% · 법선 %.2f%% · 합 %.2f%%   (0 이어야 맞다)'
          % (st['drop_d'], st['drop_n'], st['drop']))
    # 원래 무게와 견준다 (본 수를 4로 맞춘 뒤)
    J0 = src['jnt'].astype(np.int64)
    W0 = src['wgt'].astype(np.float64)
    if W0.shape[1] > 4:
        o = np.argsort(-W0, axis=1)[:, :4]
        J0 = np.take_along_axis(J0, o, 1); W0 = np.take_along_axis(W0, o, 1)
    s0 = W0.sum(1, keepdims=True)
    W0 = np.where(s0 > 1e-9, W0 / np.maximum(s0, 1e-9), 0.0)
    nb = int(max(J.max(), J0.max())) + 1
    def dense(Jx, Wx):
        d = np.zeros((len(Jx), nb))
        for q in range(Jx.shape[1]):
            np.add.at(d, (np.arange(len(Jx)), Jx[:, q]), Wx[:, q])
        return d
    D1, D0 = dense(J, W), dense(J0, W0)
    dj = float(((D1 > 1e-6) != (D0 > 1e-6)).any(1).mean() * 100)   # 물린 뼈가 다른 점의 비율
    dw = float(np.abs(D1 - D0).max())
    print('   ★ 뼈번호가 다른 칸 %.4f%%  ·  무게 최대 차이 %.6f' % (dj, dw))
    # ⛔⛔ 처음엔 「탈락 0%」까지 통과 조건에 넣었다가 **0.41% 로 «떨어졌다».**
    #   ⇒ ★ 파 보니 탈락한 506점이 «전부 거리 0» 이고, «UV 이음매의 짝 정점»을 고른 것이며,
    #     ★★ 그 점들의 **무게는 똑같았다**(뼈번호 다른 칸 0.0000%).
    #   ⇒ ⇒ 곧 «자의 흠이 아니라» 한 자리에 정점이 여럿이라 생기는 것이다.
    # ⇒ ✔ 그러니 이 시험의 판정은 **「무게가 그대로 나오나」**다. 탈락률은 «참고»로만 찍는다.
    #   ⛔ 기준을 느슨하게 «푼» 것이 아니라, «다른 것을 재고 있던 것»을 바로잡은 것이다.
    ok = dj < 0.01 and dw < 1e-6 and st['dist_med'] < 1e-9
    if st['drop_n'] > 0:
        print('   ⚠ 법선 탈락 %.2f%% 는 «UV 이음매»에서 난다 — 한 자리에 정점이 여럿이라 그렇다.'
              % st['drop_n'])
        print('      ⇒ ★ 거리 0 · 무게 같음을 확인했다(2026-09-07). 자의 흠이 아니다')
    print('   ⇒ %s' % ('✔✔ 통과 — 자기 자신은 «그대로» 나온다'
                       if ok else '⛔ 안 맞는다. ★ 자가 틀렸다. 고치기 전에는 쓰지 말 것'))
    return 0 if ok else 3


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if '--selftest' in sys.argv:
        if not args:
            print(__doc__); return 1
        return selftest(args[0])
    if len(args) < 3:
        print(__doc__); return 1
    body, cloth, out = args[0], args[1], args[2]
    if os.path.abspath(cloth) == os.path.abspath(out):
        print('⛔ 원본을 덮어쓰려 한다. 다른 이름을 주십시오'); return 2

    src = read_skin_source(body)
    cj, cb = read_glb(cloth)
    pr = prim_of(cj)
    at = pr['attributes']
    dpos, _ = acc(cj, cb, at['POSITION'])
    dnrm = acc(cj, cb, at['NORMAL'])[0] if 'NORMAL' in at else None

    J, W, conf, st = transfer(src, dpos, dnrm)
    print('■ 무게 옮기기 — %s ← %s' % (os.path.basename(cloth), os.path.basename(body)))
    print('   옷 점 %d · 몸 점 %d · 대각 %.4f · D %.4f'
          % (len(dpos), len(src['pos']), st['diag'], st['D']))
    print('   최근접 거리  중앙값 %.4f · 90%% %.4f' % (st['dist_med'], st['dist_p90']))
    print('   ★ 탈락  거리 %.2f%% · 법선 %.2f%% · 합 %.2f%%' % (st['drop_d'], st['drop_n'], st['drop']))
    if st['drop'] > 5.0:
        print('   ⚠ 탈락이 5%% 를 넘는다 — 2단계(인페인팅)가 필요할 수 있다. **눈으로 볼 것**')

    # ★ 2단계 대신 «옷 그물 위에서 무게 풀기» (2026-09-14 · 박사님 「움직일 때랑」)
    #   최근접 복사만 하면 가랑이·겨드랑이에서 이웃 정점이 «다른 다리·다른 팔» 뼈를 물어, 걸을 때 4~5% 변이 찢어졌다
    #   (맨몸은 0.6%). 무게를 옷 그물에서 smooth 번 이웃 평균으로 풀면 경계가 «띠»로 번져 찢기지 않는다.
    #   탈락(확신 없음) 점도 이때 이웃에서 채워진다. 그 뒤 큰 뼈 4개만 남기고 다시 정규화.
    sm = int(next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--smooth=')), 30))
    if sm > 0 and 'indices' in pr:
        from scipy.sparse import coo_matrix
        nb = len(src['names']); N = len(dpos)
        Wd = np.zeros((N, nb)); rows = np.repeat(np.arange(N), J.shape[1])
        np.add.at(Wd, (rows, J.reshape(-1)), W.reshape(-1))
        Fi, _ = acc(cj, cb, pr['indices']); F = np.asarray(Fi).reshape(-1, 3).astype(np.int64)
        key = np.round(dpos / 1e-5).astype(np.int64); _, grp = np.unique(key, axis=0, return_inverse=True); grp = grp.ravel(); ng = grp.max() + 1
        E = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); E = grp[np.concatenate([E, E[:, ::-1]])]
        E = np.unique(E, axis=0); E = E[E[:, 0] != E[:, 1]]
        deg = np.maximum(np.bincount(E[:, 0], minlength=ng), 1).astype(np.float64)
        cnt = np.bincount(grp, minlength=ng).astype(np.float64)
        Wg = np.zeros((ng, nb)); np.add.at(Wg, grp, Wd); Wg /= cnt[:, None]
        confg = np.zeros(ng); np.add.at(confg, grp, conf.astype(np.float64)); confg = confg / cnt > 0.5
        A = coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(ng, ng)).tocsr()
        W0 = Wg.copy()
        for _ in range(sm):
            Wg = 0.5 * Wg + 0.5 * (A @ Wg) / deg[:, None]
            pass   # (확신 점을 원래 값에 되붙들면 가랑이의 «잡음»이 그대로 남는다 — 재 보니 4.6%→4.6%. 붙들지 않는다)
        Wd = Wg[grp]
        order = np.argsort(-Wd, axis=1)[:, :4]
        J = order.astype(np.int64); W = np.take_along_axis(Wd, order, 1)
        W = W / np.maximum(W.sum(1, keepdims=True), 1e-9)
        print('   무게 풀기 %d번 (그물 점 %d · 변 %d)' % (sm, ng, len(E) // 2))

    # ★ 뼈대를 통째로 베낀다. ⛔ 본 이름이 하나라도 안 맞으면 «즉시 멈춘다»
    #   (「필요 없을 것」과 「검사도 필요 없다」는 다르다. 검사는 공짜다)
    body_names = src['names']
    at['JOINTS_0'] = add_accessor(cj, cb, J.astype(np.uint16), 5123, 'VEC4')
    at['WEIGHTS_0'] = add_accessor(cj, cb, W.astype(np.float32), 5126, 'VEC4')

    bjs = src['js']
    node_off = len(cj['nodes'])
    for n in bjs['nodes']:
        m = {k: v for k, v in n.items() if k in
             ('name', 'translation', 'rotation', 'scale', 'matrix')}
        if 'children' in n:
            m['children'] = [c + node_off for c in n['children']]
        cj['nodes'].append(m)
    bsk = bjs['skins'][0]
    ibm, ia = acc(bjs, src['bn'], bsk['inverseBindMatrices'])
    new_ibm = add_accessor(cj, cb, ibm.astype(np.float32), 5126, 'MAT4')
    cj.setdefault('skins', []).append(
        {'joints': [x + node_off for x in bsk['joints']], 'inverseBindMatrices': new_ibm})
    got = [cj['nodes'][x + node_off].get('name') for x in bsk['joints']]
    if got != body_names:
        raise SystemExit('⛔ 본 이름·차례가 어긋났다 — 옮기지 않는다 (조용한 실패를 막는다)')

    # 메시 노드에 skin 을 물리고, 뼈 뿌리를 씬에 넣는다
    par = set()
    for n in bjs['nodes']:
        par |= set(n.get('children', []))
    roots = [i + node_off for i in range(len(bjs['nodes'])) if i not in par]
    scene = cj['scenes'][cj.get('scene', 0)]
    for i, n in enumerate(cj['nodes'][:node_off]):
        if n.get('mesh') is not None:
            n['skin'] = len(cj['skins']) - 1
    scene['nodes'] = list(scene.get('nodes', [])) + roots

    cj['buffers'][0]['byteLength'] = len(cb)
    write_glb(out, cj, cb)
    print('   썼다: %s  (%.1fMB)' % (out, os.path.getsize(out) / 1e6))
    print('⛔ 이 자는 «잘 움직일까»를 모른다. ★ 옮긴 뒤 «눈으로» 볼 것.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
