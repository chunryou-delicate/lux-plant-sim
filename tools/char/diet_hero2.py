# -*- coding: utf-8 -*-
"""hero2.glb 다이어트 — 게임이 «쓰는 것»만 남긴다 — 크레딧 0.

2026-10-09 · [Char] · 총괄: «폰에서 첫 로딩이 짧아지는 것이 재미에 직결»
잰 것(줄이기 전 7.3MB): 클립 3.52MB · 정점 속성 2.43MB · 그림 0.69MB · JSON 0.49MB

■ 하는 일
  1) 클립 — 쓰는 구간만(아래 KEEP) · 안 쓰는 클립(pickup · run) 뺌
       · 앞을 자르는 클립(cheer · nod · scratch · listen · sit)은 시간을 0 부터로 당기고 extras 구간도 같이 옮긴다
       · 0 부터 쓰는 클립(water · harvest · harvest_low · crouch)은 뒤만 자른다 — v2_hero 의 구간 수(0.30~)가 그대로 맞는다
  2) 채널 — 모든 프레임이 «쉬는 자세(노드 값)와 같은» 채널은 뺀다(클립마다 66 중 40). three 믹서는 빠진 채널을 쉬는 자세로 둔다
  3) TANGENT 뺌(노멀 그림이 없다 — 안 쓴다)
  4) (--quant-weights 일 때만) 무게를 0~255 바이트로 — ⛔ three r128 에선 쓰지 말 것(아래 주석)
  5) 그림 2048 → --tex=1024 (옛 hero 와 같은 크기)
■ 관문 — 클립마다 0.1초 간격으로 «24뼈 월드 자리»를 줄이기 전(그 시각)과 견준다(키 1.4m 로 0.5mm 넘으면 멈춤)

쓰기  python tools/char/diet_hero2.py <hero2.glb> <나갈.glb> [--tex=1024]
"""
import io
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
from strip_stray_parts import read_glb, write_glb, acc_array  # noqa: E402
from build_hero2 import compact  # noqa: E402

# 게임 이름 → (앞, 뒤) 초 · None 은 통째 · 'tail:x' 는 끝 x 초
KEEP = {'walk': None, 'idle': None, 'sleep': None, 'wave': None,
        'sit': 'tail:1.5',                       # v2_hero 는 끝 1초(SIT_TAIL)만 쓴다 — 여유 0.5
        'crouch': (0.0, 2.6), 'water': (0.0, 1.9), 'harvest': (0.0, 2.2), 'harvest_low': (0.0, 2.5),
        'cheer': 'emoteWin', 'scratch': 'breakWin', 'nod': 'breakWin', 'listen': 'breakWin'}
DROP = {'pickup', 'run'}


def add_acc(js, bn, arr, typ, comp=5126, normalized=False, minmax=False):
    arr = np.ascontiguousarray(arr)
    raw = arr.tobytes()
    while len(bn) % 4:
        bn.append(0)
    off = len(bn); bn.extend(raw)
    js['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)})
    a = {'bufferView': len(js['bufferViews']) - 1, 'componentType': comp, 'count': int(arr.shape[0]), 'type': typ}
    if normalized:
        a['normalized'] = True
    if minmax:
        flat = arr.reshape(arr.shape[0], -1)
        a['min'] = flat.min(0).astype(float).tolist(); a['max'] = flat.max(0).astype(float).tolist()
    js['accessors'].append(a)
    return len(js['accessors']) - 1


def prune_accessors(js):
    used = set()
    for m in js['meshes']:
        for p in m['primitives']:
            used |= set(p['attributes'].values())
            if 'indices' in p:
                used.add(p['indices'])
    for sk in js.get('skins', []):
        if 'inverseBindMatrices' in sk:
            used.add(sk['inverseBindMatrices'])
    for a in js.get('animations', []):
        for s in a['samplers']:
            used.add(s['input']); used.add(s['output'])
    remap = {old: new for new, old in enumerate(sorted(used))}
    js['accessors'] = [js['accessors'][i] for i in sorted(used)]
    for m in js['meshes']:
        for p in m['primitives']:
            p['attributes'] = {k: remap[v] for k, v in p['attributes'].items()}
            if 'indices' in p:
                p['indices'] = remap[p['indices']]
    for sk in js.get('skins', []):
        if 'inverseBindMatrices' in sk:
            sk['inverseBindMatrices'] = remap[sk['inverseBindMatrices']]
    for a in js.get('animations', []):
        for s in a['samplers']:
            s['input'] = remap[s['input']]; s['output'] = remap[s['output']]
    print('■ accessor 걷기 — 남김 %d' % len(js['accessors']))


def quant_weights(W):
    """합 1 인 무게를 합 255 인 바이트로 — 남는 몫은 가장 큰 칸에."""
    q = np.floor(W * 255 + 0.5).astype(np.int32)
    d = 255 - q.sum(1)
    i = np.argmax(W, 1)
    q[np.arange(len(q)), i] += d
    return np.clip(q, 0, 255).astype(np.uint8)


def window_of(name, extras, dur):
    k = KEEP.get(name)
    if k is None:
        return 0.0, dur, 0.0
    if k == 'emoteWin' or k == 'breakWin':
        w = (extras.get(k) or {}).get(name)
        return (float(w[0]), float(w[1]), float(w[0])) if w else (0.0, dur, 0.0)
    if isinstance(k, str) and k.startswith('tail:'):
        a = max(0.0, dur - float(k[5:]))
        return a, dur, a
    return float(k[0]), min(dur, float(k[1])), 0.0       # 0 부터 쓰는 클립 — 시간은 안 당긴다


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        print(__doc__); return 1
    src, dst = args
    texN = int(next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--tex=')), 0) or 0)
    js, bn = read_glb(src)
    n0 = os.path.getsize(src)
    sc = js['scenes'][js.get('scene', 0)]
    extras = sc.setdefault('extras', {})
    nodes = js['nodes']
    # 1)·2) 클립
    new_anims, report = [], []
    for a in js['animations']:
        nm = a['name']
        if nm in DROP:
            report.append('  %-12s 뺌(게임이 안 씀)' % nm); continue
        t_all = max(float(acc_array(js, bn, s['input']).max()) for s in a['samplers'])
        lo, hi, shift = window_of(nm, extras, t_all)
        chans, smps, dropped = [], [], 0
        for ch in a['channels']:
            s = a['samplers'][ch['sampler']]
            t = acc_array(js, bn, s['input']).reshape(-1).astype(np.float64)
            v = acc_array(js, bn, s['output']).astype(np.float32)
            v = v.reshape(len(t), -1)
            rest = nodes[ch['target']['node']].get(ch['target']['path'])
            if rest is not None and np.abs(v - v[0]).max() < 1e-6 and np.abs(np.array(rest, np.float32) - v[0]).max() < 1e-5:
                dropped += 1; continue
            k = (t >= lo - 1e-4) & (t <= hi + 1e-4)
            if k.sum() < 2:                               # 구간 안에 키가 모자라면 양끝을 남긴다
                k = (t >= t[t <= lo].max() if (t <= lo).any() else t >= t.min()) & (t <= (t[t >= hi].min() if (t >= hi).any() else t.max()))
            tt = (t[k] - shift).astype(np.float32)
            typ = {1: 'SCALAR', 3: 'VEC3', 4: 'VEC4'}[v.shape[1]]
            ia = add_acc(js, bn, tt.reshape(-1, 1), 'SCALAR', minmax=True)
            oa = add_acc(js, bn, v[k], typ)
            smps.append({'input': ia, 'output': oa, 'interpolation': s.get('interpolation', 'LINEAR')})
            chans.append({'sampler': len(smps) - 1, 'target': ch['target']})
        new_anims.append({'name': nm, 'channels': chans, 'samplers': smps})
        report.append('  %-12s %.2f→%.2f초 (구간 %.2f~%.2f%s) · 채널 %d→%d' % (nm, t_all, hi - lo, lo, hi, ' · 0 부터로 당김' if shift else '', len(a['channels']), len(chans)))
        # extras 구간 옮기기
        if KEEP.get(nm) in ('emoteWin', 'breakWin') and shift:
            extras[KEEP[nm]][nm] = [0.0, round(hi - lo, 3)]
    js['animations'] = new_anims
    print('■ 클립'); print('\n'.join(report))
    # 3)·4) 속성
    pr = js['meshes'][0]['primitives'][0]
    at = pr['attributes']
    if 'TANGENT' in at:
        del at['TANGENT']; print('■ TANGENT 뺌')
    # ⛔ 무게 바이트화는 기본으로 «안» 한다 — three r128 의 BufferAttribute.getX 는 정규화된 바이트를 0~255 날값으로 돌려준다.
    #   v2_hero fixBackHair 가 그 값을 읽고 0~1 소수를 바이트 배열에 다시 써 무게가 0 으로 잘려 몸이 «점»으로 모였다(실제로 그렸다).
    #   room_view 발바닥 재기(SkinnedMesh.boneTransform · CPU 스키닝)도 같은 함정이다. --quant-weights 로만 켠다.
    for k in (('WEIGHTS_0', '_WEIGHTS_EMOTE') if '--quant-weights' in sys.argv else ()):
        if k in at:
            W = acc_array(js, bn, at[k]).astype(np.float64)
            q = quant_weights(W)
            err = np.abs(q / 255.0 - W).max()
            at[k] = add_acc(js, bn, q, 'VEC4', comp=5121, normalized=True)
            print('■ %s → 바이트 · 최대 오차 %.4f' % (k, err))
    # 5) 그림
    if texN:
        im = js['images'][0]
        bv = js['bufferViews'][im['bufferView']]
        o = bv.get('byteOffset', 0)
        img = Image.open(io.BytesIO(bytes(bn[o:o + bv['byteLength']]))).convert('RGB')
        if img.width > texN:
            img = img.resize((texN, texN), Image.LANCZOS)
            buf = io.BytesIO(); img.save(buf, 'JPEG', quality=90); data = buf.getvalue()
            while len(bn) % 4:
                bn.append(0)
            off = len(bn); bn.extend(data)
            js['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
            im['bufferView'] = len(js['bufferViews']) - 1; im['mimeType'] = 'image/jpeg'
            print('■ 그림 → %d · %.0fKB' % (texN, len(data) / 1e3))
    # ⛔ 첫 판: 옛 클립·무게 accessor 가 목록에 남아 그 버퍼 구역이 «쓰임»으로 잡혀 파일이 오히려 커졌다(7.29→7.69MB)
    #   ⇒ 아무도 안 가리키는 accessor 를 걷고 번호를 다시 매긴 뒤 버퍼를 짠다
    prune_accessors(js)
    bn2 = compact(js, bn)
    write_glb(dst, js, bn2)
    print('썼다: %s · %.2fMB → %.2fMB · extras %s' % (dst, n0 / 1e6, os.path.getsize(dst) / 1e6, json.dumps({k: extras[k] for k in ('emoteWin', 'breakWin') if k in extras})))
    return gate(src, dst)


def gate(src, dst, step=0.1, tol=0.0005):
    """클립마다 같은 «그 시각» 24뼈 월드 자리를 견준다 (키 1.4m · 0.5mm)."""
    from probe_anim_hands import Clip, mpos
    from probe_arm_spread import use_animation
    a, b = Clip(src), Clip(dst)
    ea = read_glb(src)[0]['scenes'][0].get('extras', {})
    names_a = [x['name'] for x in a.j['animations']]
    names_b = [x['name'] for x in b.j['animations']]
    bones = [a.find(n) for n in ('Hips', 'Spine', 'Head', 'LeftHand', 'RightHand', 'LeftFoot', 'RightFoot', 'LeftForeArm', 'RightForeArm')]
    bones_b = [b.find(a.names[i]) for i in bones]
    worst_all = 0.0
    for nm in names_b:
        use_animation(a, names_a.index(nm)); use_animation(b, names_b.index(nm))
        for c in (a, b):
            for k in list(c.tracks):
                c.tracks[k].pop('scale', None)        # v2_hero 처럼
        lo, hi, shift = window_of(nm, ea, a.duration)
        worst = 0.0
        for t in np.arange(0, b.duration, step):
            wa, wb = a.world(t + shift), b.world(t)
            d = max(float(np.linalg.norm(np.array(mpos(wa[i])) - np.array(mpos(wb[j])))) for i, j in zip(bones, bones_b))
            worst = max(worst, d)
        worst_all = max(worst_all, worst)
        print('  관문 %-12s 뼈 자리 최대 차 %.5f' % (nm, worst))
    ok = worst_all < tol
    print('■ 관문 %s — 가장 큰 차 %.5f (문턱 %.4f · 파일 단위 = m)' % ('✔' if ok else '⛔', worst_all, tol))
    return 0 if ok else 3


if __name__ == '__main__':
    sys.exit(main())
