# -*- coding: utf-8 -*-
"""hero.glb 의 «머리카락» 정점에서 팔 무게를 떼어 머리·가슴으로 옮긴다 — 크레딧 0.

2026-10-08 · [Char]

■ 왜
hero 는 T포즈로 리깅돼 긴 머리(어깨 앞·옆·등)가 팔 뼈 무게를 받는다 — 잰 것:
    머리색 정점 14,733 중 팔 무게(>0.01)를 받는 것 11,343
      · 등 뒤 구역(z<-0.10 · |x|<0.30 · y 0.35~0.95) 3,583 — 게임이 불러올 때 fixBackHair 가 옮긴다
      · ★ 그 밖 7,760 — 어깨 앞·옆으로 내린 머리. 아무도 안 옮긴다
⇒ 팔을 드는 몸짓(cheer·wave)에서 앞머리 가닥이 팔을 따라 «얼굴을 가로지르는 검은 줄»이 된다
  (docs/handoff/img/hero/emote_cheer_wave.png).

■ 어떻게 — 위치가 아니라 «색»으로 머리를 가린다
T포즈에서 어깨 앞 머리(|x| 0.11~0.38 · y 0.40~0.75)는 팔(수평 · y 0.55~0.65)과 자리가 겹친다
⇒ 위치 상자로는 못 가른다. 정점 UV 의 텍스처 색이 «짙고 채도 낮으면» 머리로 본다.
옮기는 법은 v2_hero.js fixBackHair 와 같다: 팔(Arm·ForeArm·Hand) 무게만 떼어
  높이로 섞어 Head(y 0.75↑) · Spine(=가슴 · y 0.50↓) 에 준다. 어깨(Shoulder) 등 다른 뼈는 그대로.
⇒ 등 뒤 머리도 같은 법으로 옮겨지니 게임의 fixBackHair 는 그 정점들에서 할 일이 없어진다(해도 같은 답).

■ ⛔ 이 자가 «못» 하는 것
· 「보기에 괜찮은가」 — 팔을 내린 자세에서 팔이 머리카락을 뚫고 나올 수 있다. 같은 자로 전후를 찍어 볼 것
  (node tools/char/shot_body_still.mjs ... --clip=cheer --tex --game-hair)
· 머리색 가르기는 텍스처 한 점 표본이다 — 가닥 끝·이음매에서 몇 정점이 빠질 수 있다(빠진 수를 찍는다)

쓰기
  python tools/char/fix_hair_weights.py <hero.glb> <나갈.glb> [--near=0.06,0.16] [--as-emote]
    --as-emote : 원래 무게는 두고 고친 무게를 _JOINTS_EMOTE/_WEIGHTS_EMOTE 로 따로 싣는다 (★ 게임에 들이는 판)
"""
import io
import os
import struct
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from strip_stray_parts import read_glb, write_glb, acc_array  # noqa: E402

HAIR_L = 100      # 이보다 어둡고
HAIR_SAT = 40     # 채도가 이보다 낮으면 머리색
FMT = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}


def base_color_image(js):
    """메시 재질의 baseColorTexture 그림 — images[0] 이 아니다.
    ⛔ 2026-10-10 Tripo 판은 재질 그림 차례가 [노멀 · 바탕색 · 금속거칠기]라 images[0] 이 «노멀 맵»이었다
      (머리 가르기·색 바꾸기가 엉뚱한 그림을 읽을 뻔했다). Meshy 판은 바탕색 하나라 우연히 맞았다."""
    for m in js.get('meshes', []):
        for p in m.get('primitives', []):
            if 'material' in p:
                t = js['materials'][p['material']].get('pbrMetallicRoughness', {}).get('baseColorTexture')
                if t is not None:
                    tx = js['textures'][t['index']]
                    src = tx.get('source', next((e['source'] for e in tx.get('extensions', {}).values() if 'source' in e), None))   # EXT_texture_webp 등
                    if src is not None:
                        return js['images'][src]
    return js['images'][0]

def writer(js, ai):
    """accessor 에 정점마다 VEC4 를 «제자리에» 쓰는 함수 (끼워 넣은 버퍼 stride 를 따른다)."""
    a = js['accessors'][ai]
    bv = js['bufferViews'][a['bufferView']]
    f = FMT[a['componentType']]
    size = struct.calcsize('<' + f)
    stride = bv.get('byteStride') or size * 4
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)

    def put(bn, i, vals):
        struct.pack_into('<4' + f, bn, base + i * stride, *vals)
    return put


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        print(__doc__); return 1
    src, dst = args
    if os.path.abspath(src) == os.path.abspath(dst):
        print('⛔ 원본을 덮어쓰려 한다'); return 2
    js, bn = read_glb(src)
    pr = js['meshes'][0]['primitives'][0]
    at = pr['attributes']
    P = acc_array(js, bn, at['POSITION'])
    UV = acc_array(js, bn, at['TEXCOORD_0'])
    J = acc_array(js, bn, at['JOINTS_0']).astype(int)
    W = acc_array(js, bn, at['WEIGHTS_0']).astype(float)
    names = [js['nodes'][j]['name'] for j in js['skins'][0]['joints']]
    iHead, iSpine = names.index('Head'), names.index('Spine')
    isArm = np.array([n.startswith(('Left', 'Right')) and n.endswith(('Arm', 'ForeArm', 'Hand'))
                      and 'Shoulder' not in n for n in names])
    im = base_color_image(js)
    bv = js['bufferViews'][im['bufferView']]
    o = bv.get('byteOffset', 0)
    tex = np.asarray(Image.open(io.BytesIO(bytes(bn[o:o + bv['byteLength']]))).convert('RGB')).astype(float)
    H, Wd = tex.shape[:2]
    u = np.clip((UV[:, 0] * Wd).astype(int), 0, Wd - 1)
    v = np.clip((UV[:, 1] * H).astype(int), 0, H - 1)
    c = tex[v, u]
    L = c @ [0.299, 0.587, 0.114]
    sat = c.max(1) - c.min(1)
    core = (L < HAIR_L) & (sat < HAIR_SAT)
    # ⛔ 2026-10-08 첫 판은 정점 색 한 점만 봤다 ⇒ 가닥 가장자리의 «밝은 하이라이트»(L 100~140) 정점이 빠져
    #    옮긴 정점과 한 삼각형에 묶인 채 팔을 따라가 «바늘 같은 삼각형»이 눈가·어깨에 남았다.
    # ⇒ ✔ 둘레 삼각형의 «무게중심 색»이 과반 머리색이면 머리로 본다.
    #    (정점 색 문턱을 L<170 으로 느슨히 하면 허리 아래 바지 정점 268개가 딸려 와서 안 썼다)
    T = acc_array(js, bn, pr['indices']).reshape(-1, 3).astype(int)
    cuv = UV[T].mean(1)
    cu = np.clip((cuv[:, 0] * Wd).astype(int), 0, Wd - 1)
    cv = np.clip((cuv[:, 1] * H).astype(int), 0, H - 1)
    cc = tex[cv, cu]
    trih = ((cc @ [0.299, 0.587, 0.114]) < HAIR_L) & ((cc.max(1) - cc.min(1)) < HAIR_SAT)
    ntri = np.zeros(len(P)); nh = np.zeros(len(P))
    np.add.at(ntri, T.ravel(), 1); np.add.at(nh, T.ravel(), np.repeat(trih, 3))
    hair = core | (nh / np.maximum(ntri, 1) >= 0.5)
    print('■ 머리 가르기  정점 색 %d + 둘레 삼각형 과반 %d = %d' % (core.sum(), (hair & ~core).sum(), hair.sum()))
    armw = (W * isArm[J]).sum(1)
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    y = (y - y.min()) / (y.max() - y.min()) * 1.10          # 파일 단위 1.10m 로 맞춰 fixBackHair 와 같은 높이 자
    back = (z < -0.10) & (np.abs(x) < 0.30) & (y > 0.35) & (y < 0.95)
    pick = hair & (armw > 0)
    print('■ 정점 %d · 머리색 %d · 그중 팔 무게를 받는 것 %d (등 뒤 구역 %d · ★밖 %d)'
          % (len(P), hair.sum(), pick.sum(), (pick & back).sum(), (pick & ~back).sum()))
    # 머리 아닌데 팔 무게가 «큰» 정점이 머리 자리(어깨 앞 · 몸 가운데)에 있나 — 빠진 가닥 끝을 세는 자
    miss = (~hair) & (armw > 0.5) & (np.abs(x) < 0.12) & (y > 0.40) & (y < 0.75)
    print('  · 몸 가운데(|x|<0.12)에서 팔 무게가 큰데 머리색이 아닌 정점 %d — 가닥 끝·이음매에서 빠진 것일 수 있다' % miss.sum())
    # ★ 2단계 — 어깨 관절보다 «몸 안쪽»인 정점(뺨·턱·가슴 가운데)이 받는 팔 무게.
    #   ⛔ 머리만 옮긴 판에서 «뺨 옆 바늘»이 남았다. 잰 것: 치비라 Head 관절이 y 0.649 다 ⇒ y 0.70~0.85 는 턱·뺨인데
    #     그 피부 정점 300여 개가 팔 무게(중앙 0.19)를 받는다. 가슴 가운데(|x| 0.03~0.12)도 0.35~0.40.
    #   ⇒ 관절 안쪽은 팔이 아니다: 머리 높이(Head 관절 +0.03 위)면 팔 무게를 전부 Head 로,
    #     그 아래(가슴·어깨)는 가운데일수록 많이 Spine 으로(|x| 가 관절의 절반 이하면 전부 · 관절에 닿으면 그대로).
    IB = acc_array(js, bn, js['skins'][0]['inverseBindMatrices']).reshape(-1, 4, 4)
    jpos = {nm: np.linalg.inv(mm.T)[:3, 3] for nm, mm in zip(names, IB)}
    y0f, y1f = P[:, 1].min(), P[:, 1].max()
    xa = (abs(jpos['LeftArm'][0]) + abs(jpos['RightArm'][0])) / 2
    yHead = (jpos['Head'][1] - y0f) / (y1f - y0f) * 1.10
    inner = (~pick) & (armw > 0) & (np.abs(x) < xa)
    # ★ 3단계(--near) — 팔 뼈에 «가까운» 머리는 팔을 그대로 따르게 남긴다.
    #   ⛔ 머리 팔 무게를 «전부» 뗀 판은 환호는 깨끗했으나, 팔을 내린 idle·걷기에서 어깨·팔 둘레에 바늘이 «새로» 났다.
    #     T포즈 바인드라 팔에 닿아 있던 머리가 팔을 안 따라가며 맞닿은 삼각형이 늘어난 것이다(작업 전엔 깨끗).
    #   ⇒ 바인드에서 팔 뼈 선분(Arm→ForeArm→Hand)까지 거리 d 로 옮길 몫을 서서히: d≤NEAR0 그대로 · d≥NEAR1 전부.
    NEAR = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--near=')), None)
    frac = np.ones(len(P))
    if NEAR:
        n0, n1 = (float(v) for v in NEAR.split(','))
        Pn = P.copy()
        def seg_d(p, a, b):
            ab = b - a; t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
            return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)
        d = np.full(len(P), 9.0)
        for side in ('Left', 'Right'):
            ch = [jpos[side + 'Arm'], jpos[side + 'ForeArm'], jpos[side + 'Hand']]
            for a_, b_ in zip(ch[:-1], ch[1:]):
                d = np.minimum(d, seg_d(Pn, a_, b_))
        frac = np.clip((d - n0) / (n1 - n0), 0, 1)
        print('■ 3단계  팔 뼈 거리 %.3f~%.3f 로 서서히 · 머리 정점 중 그대로 둠 %d · 일부 %d · 전부 옮김 %d'
              % (n0, n1, (pick & (frac == 0)).sum(), (pick & (frac > 0) & (frac < 1)).sum(), (pick & (frac == 1)).sum()))
    print('■ 2단계  어깨 관절 |x| %.3f · Head 관절 높이 %.3f · 관절 안쪽인데 팔 무게를 받는 정점 %d (머리 높이 %d · 가슴 %d)'
          % (xa, yHead, inner.sum(), (inner & (y > yHead + 0.03)).sum(), (inner & (y <= yHead + 0.03)).sum()))
    # --as-emote : 원래 무게는 «그대로» 두고 고친 무게를 _JOINTS_EMOTE·_WEIGHTS_EMOTE 로 «따로» 싣는다.
    #   ⛔ 고친 무게를 통째로 쓰면 걷기·idle 어깨에 바늘이 새로 난다(위 3단계 주석) ⇒ 팔을 수평 위로 들 때만 바꿔 쓴다(v2_hero.js).
    # ⛔ 2026-10-09 hero2 — 관절·무게가 «서로 다른» bufferView 다(hero 는 한 구역에 끼워져 있었다).
    #   첫 판은 무게 구역만 되돌려 관절이 바뀐 채 남았고, 아래 관문이 «원래 무게가 안 돌아왔다»로 잡았다 ⇒ 두 구역 다 되돌린다
    origs = {}
    for k in ('JOINTS_0', 'WEIGHTS_0'):
        bvi = js['accessors'][at[k]]['bufferView']
        vb = js['bufferViews'][bvi]
        vo = vb.get('byteOffset', 0)
        origs[bvi] = (vo, bytes(bn[vo:vo + vb['byteLength']]))
    putJ, putW = writer(js, at['JOINTS_0']), writer(js, at['WEIGHTS_0'])
    n = 0
    for i in np.where(pick | inner)[0]:
        m = {}
        arm = 0.0
        for k in range(4):
            if W[i, k] <= 0:
                continue
            if isArm[J[i, k]]:
                arm += W[i, k]
            else:
                m[J[i, k]] = m.get(J[i, k], 0.0) + W[i, k]
        if pick[i]:
            kh = min(1.0, max(0.0, (y[i] - 0.50) / 0.25))
            mv = arm * frac[i]
            m[iHead] = m.get(iHead, 0.0) + mv * kh
            m[iSpine] = m.get(iSpine, 0.0) + mv * (1 - kh)
            if frac[i] < 1:                                # 남기는 몫은 원래 팔 뼈에 원래 비율대로
                for k in range(4):
                    if W[i, k] > 0 and isArm[J[i, k]]:
                        m[J[i, k]] = m.get(J[i, k], 0.0) + W[i, k] * (1 - frac[i])
        elif y[i] > yHead + 0.03:
            m[iHead] = m.get(iHead, 0.0) + arm
        else:
            keep = min(1.0, max(0.0, (abs(x[i]) - xa / 2) / (xa / 2)))
            m[iSpine] = m.get(iSpine, 0.0) + arm * (1 - keep)
            if keep > 0:                                   # 남기는 몫은 원래 팔 뼈에 원래 비율대로
                for k in range(4):
                    if W[i, k] > 0 and isArm[J[i, k]]:
                        m[J[i, k]] = m.get(J[i, k], 0.0) + W[i, k] * keep
        top = sorted([e for e in m.items() if e[1] > 0], key=lambda e: -e[1])[:4]
        s = sum(e[1] for e in top) or 1.0
        jj = [e[0] for e in top] + [0] * (4 - len(top))
        ww = [e[1] / s for e in top] + [0.0] * (4 - len(top))
        putJ(bn, i, jj)
        putW(bn, i, ww)
        n += 1
    # 되읽어 확인 — 팔 무게가 남은 머리 정점이 0 이어야 한다(관문)
    J2 = acc_array(js, bn, at['JOINTS_0']).astype(int)
    W2 = acc_array(js, bn, at['WEIGHTS_0']).astype(float)
    armw2 = (W2 * isArm[J2]).sum(1)
    left = int((armw2[pick & (frac >= 1)] > 1e-6).sum())
    face = inner & (y > yHead + 0.03)
    left += int((armw2[face] > 1e-6).sum())
    sums = W2.sum(1)
    touched = pick | inner
    print('■ 옮긴 정점 %d · 되읽어 팔 무게가 남은 머리·얼굴 정점 %d · 무게 합 %.4f~%.4f · 안 건드린 정점 바뀐 것 %d'
          % (n, left, sums.min(), sums.max(),
             int(((np.abs(W2[~touched] - W[~touched]).max(1) > 1e-7) | (J2[~touched] != J[~touched]).any(1)).sum())))
    print('  가슴 쪽 팔 무게 합  전 %.1f → 후 %.1f' % (armw[inner & ~face].sum(), armw2[inner & ~face].sum()))
    if left:
        print('⛔ 팔 무게가 남았다 — 쓰지 않는다'); return 3
    if '--as-emote' in sys.argv:
        for vo, orig in origs.values():                    # 원래 관절·무게를 되돌린다
            bn[vo:vo + len(orig)] = orig
        for name, arr, ct in (('_JOINTS_EMOTE', J2.astype('<u1'), 5121), ('_WEIGHTS_EMOTE', W2.astype('<f4'), 5126)):
            raw = np.ascontiguousarray(arr).tobytes()
            while len(bn) % 4:
                bn.append(0)
            off = len(bn); bn.extend(raw)
            js['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)})
            js['accessors'].append({'bufferView': len(js['bufferViews']) - 1, 'componentType': ct,
                                    'count': int(arr.shape[0]), 'type': 'VEC4'})
            at[name] = len(js['accessors']) - 1
        js['buffers'][0]['byteLength'] = len(bn)
        back_J = acc_array(js, bn, at['JOINTS_0']).astype(int); back_W = acc_array(js, bn, at['WEIGHTS_0'])
        ok = (back_J == J).all() and np.allclose(back_W, W)
        eJ = acc_array(js, bn, at['_JOINTS_EMOTE']).astype(int); eW = acc_array(js, bn, at['_WEIGHTS_EMOTE'])
        print('■ --as-emote  원래 무게 되돌림 %s · 몸짓 무게 실음(정점 %d · 원래와 다른 정점 %d)'
              % ('✔ 같다' if ok else '⛔ 다르다', len(eJ), int(((eJ != J).any(1) | (np.abs(eW - W) > 1e-6).any(1)).sum())))
        if not ok:
            print('⛔ 원래 무게가 안 돌아왔다 — 쓰지 않는다'); return 4
    write_glb(dst, js, bn)
    print('썼다: %s (%.1fMB) · ⛔ 보기는 같은 자로 전후를 찍어 볼 것' % (dst, os.path.getsize(dst) / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
