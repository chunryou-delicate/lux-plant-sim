# -*- coding: utf-8 -*-
"""tools/leaf/varie_mask.py — 무늬 잎 GLB 의 밑색에서 «무늬 마스크»와 «초록 밑판»을 뽑는다 ([leaf] 10-09 · 유니티 몫 · 크레딧 0)
   유니티는 무늬를 텍스처 통째로 갈아 끼우지 않고 «초록 밑판 + 마스크 + 무늬색»으로 셰이더가 섞게 하려 한다:
     · 성숙 때 무늬가 드러나는 것(캐논 — 값은 날 때 · 그림은 성숙 때)을 초록 → 무늬로 «서서히» 보일 수 있다
     · 쨍/차분 판을 구운 텍스처 셋 대신 색 값 둘로
   하는 일
     ① GLB 의 UV 삼각형을 그려 «잎이 있는 화소»(섬)를 얻는다 — 텍스처 바깥 번진 색에 안 속으려고
     ② 섬 안 화소를 Lab 에서 k-평균(k=3) → 기준 초록(몬스테라 기본 성숙잎 밑색 중앙값)에 가장 가까운 무리 = 밑판.
        그 무리가 기준 초록에서 ΔE 25 넘게 멀면 «잎 전체가 특수색»(풀문) — 마스크 = 섬 전체
     ③ 마스크 R = 무늬 몫(부드러운 경계 · 밑판 무리까지 거리와 무늬 무리까지 거리의 차) · G = 무늬 안 «둘째 색» 몫(무늬 무리가 둘일 때)
     ④ 초록 밑판 = 무늬 화소를 밑판 무리 색으로 바꾸되 원래 밝기 결(잎맥·면)을 남긴다
   재는 것(장부에 적음): 마스크 넓이 % · 밑판에 남은 무늬 화소 % · lerp(밑판, 원본, R) 와 원본의 ΔE76 평균(마스크가 무늬를 다 덮었나)
   쓰기: python tools/leaf/varie_mask.py <out_dir> <glb>...   (out_dir 에 <이름>_mask.png · <이름>_base.png · <이름>_colors.json · 시트)"""
import sys, os, io, json
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lift_base import read_glb
from glb_geom import acc

REF_GLB = 'assets/monstera/monstera_leaf_mature.glb'

def tex_of(js, b):
    mt = (js.get('materials') or [{}])[0]
    bc = (mt.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
    im = js['images'][js['textures'][bc['index']]['source']] if bc else js['images'][0]
    v = js['bufferViews'][im['bufferView']]
    return Image.open(io.BytesIO(b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']])).convert('RGB')

def island_mask(js, b, W, H):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for mesh in js['meshes']:
        for pr in mesh['primitives']:
            if 'TEXCOORD_0' not in pr['attributes']: continue
            uv = acc(js, b, pr['attributes']['TEXCOORD_0'])
            idx = acc(js, b, pr['indices']).reshape(-1).astype(np.int64) if 'indices' in pr else np.arange(len(uv))
            P = np.stack([uv[:, 0] * W, uv[:, 1] * H], 1)
            for t in idx.reshape(-1, 3):
                d.polygon([tuple(P[t[0]]), tuple(P[t[1]]), tuple(P[t[2]])], fill=255)
    return np.asarray(m) > 127

def rgb2lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

def kmeans(X, k, it=25, seed=0):
    rng = np.random.default_rng(seed)
    C = X[rng.choice(len(X), k, replace=False)]
    for _ in range(it):
        D = ((X[:, None, :] - C[None]) ** 2).sum(-1); L = D.argmin(1)
        C2 = np.array([X[L == j].mean(0) if (L == j).any() else C[j] for j in range(k)])
        if np.allclose(C2, C, atol=0.05): break
        C = C2
    return C, L

def ref_green():
    js, b = read_glb(REF_GLB); t = np.asarray(tex_of(js, b)).astype(np.float64)
    isl = island_mask(js, b, t.shape[1], t.shape[0])
    return np.median(rgb2lab(t[isl]), 0)

def run(glb, out_dir, REF):
    name = os.path.splitext(os.path.basename(glb))[0]
    js, b = read_glb(glb); img = tex_of(js, b); t = np.asarray(img).astype(np.float64); H, W = t.shape[:2]
    isl = island_mask(js, b, W, H)
    lab = rgb2lab(t)
    X = lab[isl]; sub = X[np.random.default_rng(1).choice(len(X), min(len(X), 40000), replace=False)]
    K = 4
    C, Lsub = kmeans(sub, K)
    dref = np.sqrt(((C - REF) ** 2).sum(1))
    # 밑판 = «초록 색상»(Lab 색상각 100~200° · 채도 ≥ 8) 무리 중 가장 넓은 것. 그런 무리가 없거나 기준 초록에서 ΔE 40 넘게 멀면(네온 라임 같은 «색 자체»가 무늬) 잎 전체가 특수색
    hue = (np.degrees(np.arctan2(C[:, 2], C[:, 1])) + 360) % 360; chroma = np.hypot(C[:, 1], C[:, 2])
    share = np.array([(Lsub == j).mean() for j in range(K)])
    greens = [j for j in range(K) if 100 <= hue[j] <= 200 and chroma[j] >= 8]
    base = max(greens, key=lambda j: share[j]) if greens else int(dref.argmin())
    full = (not greens) or dref[base] > 40
    D = np.sqrt(((lab[..., None, :] - C[None, None]) ** 2).sum(-1))           # 화소마다 무리까지 거리
    others = [j for j in range(K) if j != base and not (j in greens and np.sqrt(((C[j] - C[base]) ** 2).sum()) < 18)]   # 밑판과 가까운 다른 초록(그늘진 초록)은 밑판 쪽
    bases = [base] + [j for j in range(K) if j != base and j not in others]
    if full:
        R = isl.astype(np.float64); G = np.zeros_like(R)
    else:
        dv = D[..., others].min(-1); db = D[..., bases].min(-1)
        R = 1 / (1 + np.exp(-(db - dv) / 4.0)); R = np.where(isl, R, 0)
        # 둘째 색: 무늬 무리가 서로 ΔE 20 넘게 다를 때만
        top2 = sorted(others, key=lambda j: -share[j])[:2]
        if len(top2) >= 2 and np.sqrt(((C[top2[0]] - C[top2[1]]) ** 2).sum()) > 20:
            # 밝은 쪽 = 첫째(흰·크림), 다른 쪽 = 둘째
            o1, o2 = sorted(sorted(others, key=lambda j: -share[j])[:2], key=lambda j: -C[j][0])   # 넓은 무늬 무리 둘 — 밝은 쪽이 첫째
            G = 1 / (1 + np.exp(-(D[..., o1] - D[..., o2]) / 4.0)); G = np.where(isl, G * R, 0)
        else:
            G = np.zeros_like(R)
    # 초록 밑판: 무늬 화소를 밑판 무리 색으로 · 밝기 결은 원본 L 의 위아래만 남긴다
    base_lab = C[base] if not full else REF
    Lc = lab[..., 0]; vreg = isl & (R > 0.5); Lmed = np.median(Lc[vreg]) if vreg.any() else np.median(Lc[isl])   # 무늬 자리 자체의 밝기 중앙값 — 줄무늬의 «밝은 몫»을 밑판에 안 옮긴다
    new_lab = np.stack([base_lab[0] + 0.35 * (Lc - Lmed), np.full_like(Lc, base_lab[1]), np.full_like(Lc, base_lab[2])], -1)
    # Lab → RGB(되돌림)
    def lab2rgb(L):
        fy = (L[..., 0] + 16) / 116; fx = fy + L[..., 1] / 500; fz = fy - L[..., 2] / 200
        f3 = lambda f: np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787)
        xyz = np.stack([f3(fx), f3(fy), f3(fz)], -1) * np.array([0.95047, 1.0, 1.08883])
        Mi = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
        c = xyz @ Mi.T; c = np.where(c > 0.0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055, 12.92 * c)
        return np.clip(c * 255, 0, 255)
    green = lab2rgb(new_lab)
    # 밑판은 «굳힌» 마스크로 채운다(R 0.2~0.5 를 0~1 로 · 한 화소 넓힘) — 부드러운 R 로 섞으면 가는 줄무늬가 반쯤 남는다(10-09 제브라 16%)
    Rb = np.clip((R - 0.2) / 0.3, 0, 1)
    Rb = np.asarray(Image.fromarray((Rb * 255).astype(np.uint8)).filter(__import__('PIL.ImageFilter', fromlist=['MaxFilter']).MaxFilter(3))) / 255.0
    Rb = np.where(isl, Rb, 0)
    basep = t * (1 - Rb[..., None]) + green * Rb[..., None]
    # 밑판에 남은 무늬: 밑판 화소를 같은 무리로 다시 갈랐을 때 무늬 무리 몫(풀문은 밑판이 통째 새 초록이라 0)
    bl = rgb2lab(basep)[isl]; Db = np.sqrt(((bl[:, None, :] - C[None]) ** 2).sum(-1))
    left = float((~np.isin(Db.argmin(1), bases)).mean()) if not full else 0.0
    # 납작한 다시 짜기: 밑판·무늬색 두 개로 lerp 했을 때 원본과의 ΔE76(무늬 화소 · 잎맥·결을 얼마나 잃나 — 참고 값)
    v1 = C[sorted(others, key=lambda j: -C[j][0])[0]] if not full else np.median(X, 0)
    flat = lab2rgb(np.broadcast_to(v1, lab.shape)); comp = basep * (1 - R[..., None]) + flat * R[..., None]
    vm = isl & (R > 0.5)
    dE = float(np.sqrt(((rgb2lab(comp) - lab) ** 2).sum(-1))[vm].mean()) if vm.any() else 0.0
    os.makedirs(out_dir, exist_ok=True)
    mask = np.stack([R, G, np.zeros_like(R)], -1) * 255
    Image.fromarray(mask.astype(np.uint8)).save(os.path.join(out_dir, f'{name}_mask.png'))
    Image.fromarray(basep.astype(np.uint8)).save(os.path.join(out_dir, f'{name}_base.png'))
    def hexof(l): return '#%02x%02x%02x' % tuple(int(v) for v in lab2rgb(np.array(l)[None, None])[0, 0])
    cols = {'base': hexof(C[base]) if not full else hexof(REF), 'varie1': hexof(C[sorted(others, key=lambda j: -C[j][0])[0]]) if not full else hexof(np.median(X, 0)),
            'varie2': hexof(C[sorted(others, key=lambda j: -C[j][0])[1]]) if (not full and len(others) >= 2) else None, 'full': bool(full)}
    rep = {'name': name, 'tex': [W, H], 'mask_pct': round(float(R[isl].mean()) * 100, 1), 'second_pct': round(float(G[isl].mean()) * 100, 1),
           'base_left_pct': round(left * 100, 2), 'flat_dE_in_varie': round(dE, 1), 'base_dE_from_ref': round(float(dref[base]), 1), 'colors': cols}
    json.dump(rep, open(os.path.join(out_dir, f'{name}_colors.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return rep, img, mask.astype(np.uint8), basep.astype(np.uint8)

if __name__ == '__main__':
    out = sys.argv[1]; REF = ref_green(); rows = []; tiles = []
    for g in sys.argv[2:]:
        rep, img, mask, basep = run(g, out, REF); rows.append(rep); print(json.dumps(rep, ensure_ascii=False))
        S = 256; tiles.append([img.resize((S, S)), Image.fromarray(mask).resize((S, S)), Image.fromarray(basep).resize((S, S))])
    if tiles:
        S = 256; sh = Image.new('RGB', (S * 3, S * len(tiles)), 'white')
        for i, tr in enumerate(tiles):
            for j, im in enumerate(tr): sh.paste(im, (j * S, i * S))
        sh.save(os.path.join(out, '_sheet.png'))
    json.dump(rows, open(os.path.join(out, '_report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
