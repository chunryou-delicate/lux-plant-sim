# -*- coding: utf-8 -*-
"""클립에 «발 고정»을 굽는다 — 서기·걷기 클립에서 몸 최저점(발바닥)이 시간마다 오르내리지 않게 Hips 높이를 키마다 고친다 — 크레딧 0.

2026-11-01 · [Char] · 총괄 «test_ground 발 −1.6cm» 가르기에서 나온 것

■ 왜
  hero2(Meshy) 걷기 클립은 한 걸음(1.07초) 사이에 정점 전부의 최저점이 5.0cm 오르내린다(서기 idle 1.1cm).
  방뷰(room_view measureGround)는 클립마다 «한 값»(재 본 최저점)만 빼서 바닥에 붙이므로,
  그 사이 시각에는 발이 떠오르거나 바닥에 묻힌다. 값 하나로는 못 고친다 — 클립 안에서 고쳐야 한다.
■ 하는 일
  Hips 이동 키마다 스킨 정점을 실제로 풀어(.scale 트랙은 게임처럼 뺀다 — v2_hero) 최저점 y(t) 를 재고,
  Hips 이동 y 에 (y* − y(t)) 를 더한다. y* 는 키 평균이다 — 클립 높이는 그대로 두고 오르내림만 없앤다.
  관절이 전부 Hips 아래라 Hips 를 옮기면 정점이 모두 같은 만큼 옮겨진다(키 시각에서는 정확하다).
  --floor-from=idle : y* 를 그 클립의 평균 하나로 모든 클립에 쓴다. 방뷰는 클립마다 바닥 보정값을 따로 재므로,
    값이 다르면 걷기↔서기를 바꿀 때마다 그 차(hero2 1.4cm)만큼 몸이 0.1초 동안 내려앉거나 뜬다(GROUND_EASE).
    같은 바닥에 맞추면 보정값이 같아져 그 틈이 없다 — 크로스페이드 동안 섞이는 두 자세도 같은 바닥을 딛는다.
  ⛔ JSON 은 한 바이트도 안 바꾼다(출력 accessor 에 min/max 가 있으면 멈춘다). BIN 안 그 accessor 값만 고친다.
  ⛔ 방뷰는 Hips 의 지역 x·z 를 매 프레임 되돌린다(루트 고정) — 그래서 지역 y 만 고친다. Hips 부모가 돌아 있으면 멈춘다.
■ 관문 (못 넘으면 안 쓴다)
  ① 고친 뒤 시간 240점에서 최저점 폭 ≤ 5mm(게임 키 1.40m 기준 · 키의 0.36%)
     ⚠ 처음엔 3mm 로 잡았다가 걷기가 4.2mm 에서 걸렸다. 남는 4.2mm 는 키(초당 30개) 사이 직선 보간이 못 따라가는
       발뒤꿈치·발끝 갈마듦이라 키 값으로는 못 지운다 — 최소제곱도, 최대 어긋남 줄이기(선형계획)도 4.2mm 로 같았다.
       지우려면 키를 늘려야 하는데 그러면 JSON·버퍼 배치가 바뀐다. 5.1cm → 0.4cm 로 충분해 5mm 로 정했다(11-01).
  ② 고친 accessor 밖의 바이트는 하나도 안 바뀐다
■ 쓰기
  python tools/char/ground_lock_clip.py <in.glb> <out.glb> --clips=idle,walk --floor-from=idle
  python tools/char/ground_lock_clip.py <in.glb> --report --clips=walk,idle      # 재기만
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
from glb_shot import read_glb, acc_np  # noqa: E402
from glb_pose_shot import trs, node_local, sample  # noqa: E402

HERO_H = 1.40
GATE_MM = 5.0
CHECK_N = 240


class Skin:
    """스킨 메시 하나 — 시각 t 의 정점 높이(y)만 빨리 푼다."""

    def __init__(self, js, bn):
        self.js, self.bn = js, bn
        self.nodes = js['nodes']
        self.parent = {}
        for i, nd in enumerate(self.nodes):
            for c in nd.get('children', []):
                self.parent[c] = i
        self.base = [node_local(nd) for nd in self.nodes]
        sk = js['skins'][0]
        self.joints = sk['joints']
        self.ibm = np.asarray(acc_np(js, bn, sk['inverseBindMatrices']), np.float64).reshape(-1, 4, 4).transpose(0, 2, 1)
        p = js['meshes'][0]['primitives'][0]
        V = np.asarray(acc_np(js, bn, p['attributes']['POSITION']), np.float64)
        self.Vh = np.concatenate([V, np.ones((len(V), 1))], 1)
        self.J = np.asarray(acc_np(js, bn, p['attributes']['JOINTS_0']), np.int64)
        W = np.asarray(acc_np(js, bn, p['attributes']['WEIGHTS_0']), np.float64)
        self.W = W / np.maximum(W.sum(1, keepdims=True), 1e-12)
        self.byname = {nd.get('name'): i for i, nd in enumerate(self.nodes)}

    def world(self, local):
        memo = {}

        def W(i):
            if i not in memo:
                memo[i] = local[i] if i not in self.parent else W(self.parent[i]) @ local[i]
            return memo[i]
        return W

    def low_y(self, chans, t):
        """시각 t 자세의 정점 최저 y(파일 세계 단위). chans = {노드: {'translation': (ts, vs), 'rotation': …}}"""
        local = list(self.base)
        for i, c in chans.items():
            nd = self.nodes[i]
            tr = sample(*c['translation'], t) if 'translation' in c else np.array(nd.get('translation', [0, 0, 0]))
            ro = sample(*c['rotation'], t) if 'rotation' in c else np.array(nd.get('rotation', [0, 0, 0, 1]))
            sc = np.array(nd.get('scale', [1, 1, 1]))            # ⛔ .scale 트랙은 게임처럼 뺀다
            local[i] = trs(tr, ro, sc)
        W = self.world(local)
        JMy = np.stack([(W(j) @ self.ibm[k])[1] for k, j in enumerate(self.joints)])   # (J,4) — y 행만
        y = np.zeros(len(self.Vh))
        for k in range(4):
            y += self.W[:, k] * np.einsum('nj,nj->n', JMy[self.J[:, k]], self.Vh)
        return float(y.min())

    def rest_height(self):
        W = self.world(self.base)
        JM = np.stack([W(j) @ self.ibm[k] for k, j in enumerate(self.joints)])
        y = np.zeros(len(self.Vh))
        for k in range(4):
            y += self.W[:, k] * np.einsum('nj,nj->n', JM[self.J[:, k]][:, 1], self.Vh)
        return float(y.max() - y.min())


def anim_chans(js, bn, name):
    for an in js['animations']:
        if an.get('name') != name:
            continue
        chans, dur = {}, 0.0
        for ch in an['channels']:
            smp = an['samplers'][ch['sampler']]
            ts = np.asarray(acc_np(js, bn, smp['input']), np.float64).ravel()
            vs = np.asarray(acc_np(js, bn, smp['output']), np.float64)
            chans.setdefault(ch['target']['node'], {})[ch['target']['path']] = (ts, vs.copy())
            dur = max(dur, float(ts[-1]))
        return an, chans, dur
    raise SystemExit(f'애니 «{name}» 가 없습니다')


def profile(sk, chans, dur, n=CHECK_N):
    ts = np.linspace(0, dur, n + 1)
    return ts, np.array([sk.low_y(chans, t) for t in ts])


def bin_offset(raw):
    jl = struct.unpack_from('<I', raw, 12)[0]
    return 12 + 8 + jl + 8                                   # BIN 덩이 데이터 시작


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opt = dict(a[2:].split('=', 1) if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
    names = (opt.get('clips') or 'walk,idle').split(',')
    src = args[0]
    report = 'report' in opt
    dst = None if report else args[1]
    raw = bytearray(open(src, 'rb').read())
    js, bn = read_glb(src)
    sk = Skin(js, bn)
    hips = sk.byname.get('Hips')
    if hips is None:
        raise SystemExit('Hips 뼈가 없습니다')
    P = sk.world(sk.base)(sk.parent[hips]) if hips in sk.parent else np.eye(4)
    R = P[:3, :3]
    sx = np.linalg.norm(R, axis=0)
    if not np.allclose(R / sx[None, :], np.eye(3), atol=1e-6):
        raise SystemExit('⛔ Hips 부모가 돌아 있습니다 — 지역 y 가 세계 y 가 아니라 이 도구로는 못 고칩니다')
    k_up = sx[1]                                             # 지역 y 1 → 세계 y k_up
    g = HERO_H / sk.rest_height()                            # 파일 세계 → 게임 m
    print(f'{os.path.basename(src)} · 정점 {len(sk.Vh)} · 게임 배율 {g:.4f} · Hips 부모 y 배율 {k_up}')
    boff = bin_offset(raw)
    patched = []
    floor_from = opt.get('floor-from')
    if floor_from:
        names = [floor_from] + [n for n in names if n != floor_from]   # 바닥을 정할 클립을 먼저
    floor = None
    for name in names:
        an, chans, dur = anim_chans(js, bn, name)
        ts0, y0 = profile(sk, chans, dur)
        print(f'  {name:6s} 전  최저점 폭 {(y0.max() - y0.min()) * g * 100:5.2f}cm  ({y0.min() * g * 100:+.2f} ~ {y0.max() * g * 100:+.2f}cm · {dur:.2f}초)')
        if report:
            continue
        ch = next(c for c in an['channels'] if c['target']['node'] == hips and c['target']['path'] == 'translation')
        smp = an['samplers'][ch['sampler']]
        if smp.get('interpolation', 'LINEAR') != 'LINEAR':
            raise SystemExit(f'⛔ {name} Hips 이동이 LINEAR 가 아닙니다')
        acc = js['accessors'][smp['output']]
        if 'min' in acc or 'max' in acc:
            raise SystemExit(f'⛔ {name} Hips 이동 accessor 에 min/max 가 있습니다 — JSON 을 고쳐야 해서 멈춥니다')
        bv = js['bufferViews'][acc['bufferView']]
        if bv.get('byteStride') not in (None, 12) or acc['componentType'] != 5126:
            raise SystemExit(f'⛔ {name} Hips 이동 accessor 가 촘촘한 float32 VEC3 가 아닙니다')
        kts, kvs = chans[hips]['translation']
        # ⛔ 첫 판은 키 시각만 맞췄다 ⇒ 걷기는 키 사이에 6.9mm 가 남았다(관문 ① 에 걸림).
        #   Hips 를 옮기면 정점이 다 같이 옮겨지므로 «새 최저점 = 옛 최저점 + 보간한 키 고침» 이 정확히 선형이다.
        #   ⇒ 키 사이를 8 등분한 촘촘한 시각 전부에서 최소제곱으로 키 고침 d 를 한 번에 푼다(모자 모양 기저 = LINEAR 보간 그대로).
        tf = np.unique(np.concatenate([np.linspace(kts[i], kts[i + 1], 9)[:-1] for i in range(len(kts) - 1)] + [kts[-1:]]))
        lowf = np.array([sk.low_y(chans, t) for t in tf])
        target = lowf.mean() if floor is None else floor
        if floor_from and name == floor_from:
            floor = target
        Phi = np.zeros((len(tf), len(kts)))
        for r, t in enumerate(tf):
            i = min(max(int(np.searchsorted(kts, t, side='right')) - 1, 0), len(kts) - 2)
            a = (t - kts[i]) / max(1e-12, kts[i + 1] - kts[i])
            Phi[r, i] += 1 - a
            Phi[r, i + 1] += a
        d, *_ = np.linalg.lstsq(Phi, target - lowf, rcond=None)
        kvs[:, 1] += d / k_up
        ts1, y1 = profile(sk, chans, dur)
        width_mm = (y1.max() - y1.min()) * g * 1000
        print(f'  {name:6s} 뒤  최저점 폭 {width_mm / 10:5.2f}cm  ({y1.min() * g * 100:+.2f} ~ {y1.max() * g * 100:+.2f}cm) · '
              f'Hips y 고친 폭 {(kvs[:, 1].max() - kvs[:, 1].min()):.3f} → 키 {len(kts)}개')
        if width_mm > GATE_MM:
            raise SystemExit(f'⛔ 관문 ① — {name} 최저점 폭 {width_mm:.1f}mm > {GATE_MM}mm. 안 씁니다')
        start = boff + bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
        nbytes = acc['count'] * 12
        raw[start:start + nbytes] = kvs.astype('<f4').tobytes()
        patched.append((start, nbytes))
    if report:
        return
    # 관문 ② — 고친 덩이 밖은 그대로
    old = open(src, 'rb').read()
    mask = np.ones(len(raw), bool)
    for s, n in patched:
        mask[s:s + n] = False
    diff = np.frombuffer(bytes(raw), np.uint8)[mask] != np.frombuffer(old, np.uint8)[mask]
    if len(raw) != len(old) or diff.any():
        raise SystemExit('⛔ 관문 ② — 고친 accessor 밖의 바이트가 바뀌었습니다')
    with open(dst, 'wb') as f:
        f.write(raw)
    print(f'✔ 썼습니다 → {dst} ({len(raw)} 바이트 · 고친 덩이 {len(patched)}개 · 나머지 바이트 그대로)')


if __name__ == '__main__':
    main()
