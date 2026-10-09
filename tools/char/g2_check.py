# -*- coding: utf-8 -*-
"""G2(리그 전 3D 받기) 자 — 받은 GLB 를 hero2 리그 전 판(01a11e76)과 «같은 자»로 견준다 — 크레딧 0.

2026-10-09 · [Char] · 유니티 3D 첫 판(장난감 턴어라운드 b → Meshy multi-image · Tripo multiview)
■ 재는 것 (char-meshy-plan G2 그대로)
  ① 덩어리 — 위치로 이은 연결 성분 수 · 가장 큰 덩어리 몫(한 덩어리여야 리그·옷 길이 hero2 와 같다)
  ② 면·정점 수 · 키(가로/세로 비)
  ③ 머리 텍셀 색 — 머리 덩어리(위 절반의 어둡고 덜 붉은 정점) 중앙 색 · 밝기(D24 정본 hero2 머리와 견줌)
  ④ 머리–팔 틈(바인드) — 목 아래로 내려온 머리 정점과 팔(살색 · 목 아래 · 몸통 밖) 정점의 거리.
     키에 대한 비로 낸다(파일마다 키가 다름). «2% 안에 붙은 머리 정점 수»가 리그 뒤 팔 무게가 머리에 묻는 씨앗이다
     (hero2: T포즈 55.8% → A포즈 0.4% 를 리그 뒤 G3 에서 쟀다 — 여기는 리그 «전»이라 거리로만)
  ⑤ 앞·옆·뒤·3/4 텍스처 그림 한 장(glb_shot.render · 같은 크기)
■ ⛔ 못 하는 것
  · 머리·팔 가르기는 «색과 자리»로 한다 — 뼈가 없으니 어림이다. 그림(⑤)으로 같이 볼 것
  · 리그 뒤 팔 무게(G3)는 못 잰다

쓰기  python tools/char/g2_check.py <받은.glb> [<견줄.glb> ...] --out=<그림.png>
"""
import io
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
from glb_shot import read_glb, acc_np, render  # noqa: E402

YAW = {'front': 0.0, 'left': np.pi / 2, 'back': np.pi, 'q34': np.pi / 4}


def load(path):
    js, binc = read_glb(path)
    Vs, Fs, UVs, base = [], [], [], 0
    tex = None
    for m in js['meshes']:
        for p in m['primitives']:
            V = np.asarray(acc_np(js, binc, p['attributes']['POSITION']), np.float32)
            I = np.asarray(acc_np(js, binc, p['indices']), np.int64).reshape(-1, 3)
            uv = p['attributes'].get('TEXCOORD_0')
            UVs.append(np.asarray(acc_np(js, binc, uv), np.float32) if uv is not None else np.zeros((len(V), 2), np.float32))
            Vs.append(V); Fs.append(I + base); base += len(V)
            if tex is None and 'material' in p:
                pbr = js['materials'][p['material']].get('pbrMetallicRoughness', {})
                if 'baseColorTexture' in pbr:
                    im = js['images'][js['textures'][pbr['baseColorTexture']['index']]['source']]
                    bv = js['bufferViews'][im['bufferView']]
                    o = bv.get('byteOffset', 0)
                    tex = np.asarray(Image.open(io.BytesIO(bytes(binc[o:o + bv['byteLength']]))).convert('RGB'))
    V = np.concatenate(Vs); F = np.concatenate(Fs); UV = np.concatenate(UVs)
    # 스킨이 붙은 판이면 노드 행렬을 안 탄다 — 리그 전 판만 견준다(바인드 그대로)
    return js, V, F, UV, tex


def components(V, F):
    """위치를 묶어(이음매 정점 합침) 면으로 이은 덩어리."""
    key = np.round(V / (np.ptp(V, 0).max() * 1e-5)).astype(np.int64)
    _, weld = np.unique(key, axis=0, return_inverse=True)
    weld = weld.reshape(-1)
    n = weld.max() + 1
    parent = np.arange(n)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for a, b in np.concatenate([weld[F[:, [0, 1]]], weld[F[:, [1, 2]]]]):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
    roots = np.array([find(i) for i in range(n)])
    _, lab = np.unique(roots, return_inverse=True)
    vlab = lab[weld]
    sizes = np.bincount(lab[weld[F[:, 0]]])
    return len(sizes), sizes.max() / sizes.sum(), vlab


def vcolor(UV, tex):
    th, tw = tex.shape[:2]
    tx = np.clip((UV[:, 0] * tw).astype(int), 0, tw - 1); ty = np.clip((UV[:, 1] * th).astype(int), 0, th - 1)
    return tex[ty, tx].astype(float)


def face_forward(V, UV, tex):
    """얼굴이 +Z 를 보게 Y 축으로 돌린다 — 2026-10-09 Tripo 판이 +X 를 보고 와서(앞 그림이 옆모습) 팔 벌림이 «두께»로 재졌다.
    머리 높이(위 35%)의 살색 정점 무게중심이 머리 전체 무게중심에서 어느 쪽에 있나 = 얼굴 쪽.
    ⛔ 짧은 머리에서 틀린다(10-10 옛 namja_jachwi 를 거꾸로 돌림) — 목덜미·귀 살이 뒤쪽 무게를 끈다. 돌렸다고 찍히면 그림(⑤)으로 앞을 볼 것."""
    if tex is None:
        return V, 0.0
    lo, hi = V.min(0), V.max(0)
    y = (V[:, 1] - lo[1]) / (hi[1] - lo[1])
    c = vcolor(UV, tex); L = c @ [0.299, 0.587, 0.114]
    head = y > 0.65
    skin = head & (L > 165) & (c[:, 0] > c[:, 2] + 25)
    if skin.sum() < 20:
        return V, 0.0
    d = V[skin][:, [0, 2]].mean(0) - V[head][:, [0, 2]].mean(0)
    ang = float(np.arctan2(d[0], d[1]))            # +Z 에서 얼굴까지 각
    ang = round(ang / (np.pi / 2)) * (np.pi / 2)   # 90° 단위로만(생성물은 축 맞춤으로 온다)
    if ang == 0:
        return V, 0.0
    cs, sn = np.cos(-ang), np.sin(-ang)
    R = V.copy()
    R[:, 0] = V[:, 0] * cs + V[:, 2] * sn
    R[:, 2] = -V[:, 0] * sn + V[:, 2] * cs
    return R, float(np.degrees(ang))


def measure(path):
    js, V, F, UV, tex = load(path)
    V, turned = face_forward(V, UV, tex)
    ncomp, big, _ = components(V, F)
    lo, hi = V.min(0), V.max(0); H = hi[1] - lo[1]
    y = (V[:, 1] - lo[1]) / H                      # 0 발 · 1 정수리
    x = (V[:, 0] - (lo[0] + hi[0]) / 2) / H
    r = dict(path=os.path.basename(path), verts=len(V), faces=len(F), comps=ncomp, big=big,
             h=float(H), w_over_h=float((hi[0] - lo[0]) / H), turned=turned)
    if tex is None:
        r['note'] = '텍스처 없음'
        return r, (V, F, UV, tex)
    c = vcolor(UV, tex)
    L = c @ [0.299, 0.587, 0.114]
    hair = (L < 110) & (c[:, 0] - c[:, 2] < 45) & (y > 0.30)
    skin = (L > 165) & (c[:, 0] > c[:, 2] + 25) & (c[:, 0] > c[:, 1] + 8)
    r['hair_n'] = int(hair.sum())
    r['hair_rgb'] = np.median(c[hair], 0).round().astype(int).tolist() if hair.any() else None
    r['hair_L'] = float(np.median(L[hair])) if hair.any() else None
    r['hair_low'] = float(y[hair].min()) if hair.any() else None          # 뒷머리 끝 높이(키 비)
    # 목 높이 — 살색 정점이 가장 «가는» 높이(머리 위 · 몸통 아래 사이 0.40~0.75)
    bins = np.linspace(0.40, 0.75, 36)
    widths = [np.ptp(x[skin & (y > b0) & (y < b1)]) if (skin & (y > b0) & (y < b1)).sum() > 5 else 9 for b0, b1 in zip(bins[:-1], bins[1:])]
    neck = float(bins[int(np.argmin(widths))])
    r['neck'] = neck
    torso = np.abs(x[(y > neck - 0.20) & (y < neck - 0.05) & ~skin])
    half = float(np.percentile(torso, 80)) if len(torso) else 0.1
    arm = skin & (y < neck - 0.02) & (y > 0.20) & (np.abs(x) > half * 0.95)
    low_hair = hair & (y < neck)
    r['arm_n'] = int(arm.sum()); r['low_hair_n'] = int(low_hair.sum())
    if arm.any() and low_hair.any():
        P = V[arm]
        d = np.array([np.sqrt(((P - q) ** 2).sum(1)).min() for q in V[low_hair]]) / H
        r['gap_min'] = float(d.min()); r['gap_med'] = float(np.median(d))
        r['hair_near2'] = int((d < 0.02).sum()); r['hair_near4'] = int((d < 0.04).sum())
    r['hand_reach'] = float(np.abs(x[arm]).max()) if arm.any() else None      # 손끝 가로 거리(키 비) — A포즈 벌림
    return r, (V, F, UV, tex)


def main():
    paths = [a for a in sys.argv[1:] if not a.startswith('--')]
    out = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--out=')), None)
    rows, sheets = [], []
    for p in paths:
        r, (V, F, UV, tex) = measure(p)
        rows.append(r)
        print('■ %s' % r['path'])
        print('  덩어리 %d (가장 큰 것 %.1f%%) · 정점 %s · 면 %s · 키 %.3f (가로/세로 %.2f)%s' % (
            r['comps'], r['big'] * 100, format(r['verts'], ','), format(r['faces'], ','), r['h'], r['w_over_h'],
            (' · ⚠ 얼굴이 +Z 가 아니라 %+.0f° 돌려 잼' % r['turned']) if r['turned'] else ''))
        if r.get('hand_reach') is not None:
            print('  손끝 가로 거리(키 비 · A포즈 벌림) %.3f' % r['hand_reach'])
        if 'hair_rgb' in r:
            print('  머리 정점 %d · 색 %s · 밝기 %.1f · 뒷머리 끝 키의 %.2f · 목 %.2f' % (r['hair_n'], r['hair_rgb'], r['hair_L'], r['hair_low'], r['neck']))
            if 'gap_min' in r:
                print('  머리–팔 틈(키 비): 가장 가까움 %.3f · 중앙 %.3f · 2%% 안 머리 정점 %d · 4%% 안 %d (목 아래 머리 %d · 팔 %d)' % (
                    r['gap_min'], r['gap_med'], r['hair_near2'], r['hair_near4'], r['low_hair_n'], r['arm_n']))
        if out:
            tiles = [render(V, F, YAW[n], 300, 450, UV=UV if tex is not None else None, TEX=tex) for n in ('front', 'left', 'back', 'q34')]
            sheets.append((r['path'], np.concatenate(tiles, 1)))
    if out:
        W = max(s.shape[1] for _, s in sheets)
        img = Image.new('RGB', (W, sum(s.shape[0] + 22 for _, s in sheets)), (22, 22, 22))
        d = ImageDraw.Draw(img); yy = 0
        for name, s in sheets:
            d.text((6, yy + 5), name, fill=(255, 255, 255)); img.paste(Image.fromarray(s), (0, yy + 22)); yy += s.shape[0] + 22
        img.save(out)
        print('그림: %s' % out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
