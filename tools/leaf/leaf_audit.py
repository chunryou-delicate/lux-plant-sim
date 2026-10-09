# -*- coding: utf-8 -*-
"""tools/leaf/leaf_audit.py — 몬스테라 잎 GLB 전부를 «모양·그림» 자로 잰다 ([leaf] 10-09 · Meshy 주문표 ① 고르기)
   한 줄에: 정점·삼각 · 두께/넓이%(주성분) · 이음매 법선 갈림% · 잎몸 채움%(주평면 투영 넓이 ÷ 상자) ·
            그림(밑색 텍스처): 흰·크림 비율 · 분홍/노랑 비율 · 초록 비율 · 밝기 대비(5~95 백분위) · 텍스처 크기
   쓰기: python tools/leaf/leaf_audit.py > out.tsv   (manifest 의 잎·몬스테라·성숙/중간/초기 GLB 전부)
   ⚠ 이 자는 «후보를 좁히는» 자다 — 어색함은 마지막에 같은 크기 그림으로 눈이 본다(render-check-equal-scale)."""
import sys, json, io, os
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from glb_geom import load, acc, geom

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')

def seam_pct(js, b):
    tot = bad = 0
    for m in js['meshes']:
        for pr in m['primitives']:
            if 'NORMAL' not in pr['attributes']: continue
            P = acc(js, b, pr['attributes']['POSITION']); N = acc(js, b, pr['attributes']['NORMAL'])
            size = float(np.linalg.norm(P.max(0) - P.min(0))) or 1.0
            key = np.round(P / (size * 1e-5)).astype(np.int64)
            groups = {}
            for i, k in enumerate(map(tuple, key)): groups.setdefault(k, []).append(i)
            for g in groups.values():
                if len(g) < 2: continue
                tot += 1
                n = N[g]; n = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-9)
                if (1 - (n @ n.T)).max() > 0.02: bad += 1
    return round(100.0 * bad / tot, 1) if tot else None

def fill_pct(P, T):
    """주평면(두께 축을 뺀 두 축)에 삼각형을 투영해 넓이 합 ÷ 그 두 축 상자 넓이 — 갈라짐·구멍·실루엣이 얼마나 비었나"""
    if T is None or not len(T): return None
    c = P - P.mean(0); w, v = np.linalg.eigh(np.cov(c.T)); q = c @ v[:, 1:]
    a = q[T[:, 0]]; b2 = q[T[:, 1]]; c2 = q[T[:, 2]]
    area = 0.5 * np.abs((b2[:, 0] - a[:, 0]) * (c2[:, 1] - a[:, 1]) - (c2[:, 0] - a[:, 0]) * (b2[:, 1] - a[:, 1])).sum()
    box = (q[:, 0].max() - q[:, 0].min()) * (q[:, 1].max() - q[:, 1].min())
    # 겹친 면(앞뒤 두 장)이면 넓이가 두 배로 나온다 — 그대로 둔다(두께 판단은 두께% 가 한다)
    return round(100.0 * area / box, 1) if box > 0 else None

def tex_stats(js, b):
    imgs = js.get('images') or []
    if not imgs: return None
    # 밑색 텍스처를 찾는다(재질 baseColorTexture → texture.source)
    src = None
    for mt in js.get('materials') or []:
        bc = (mt.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
        if bc is not None:
            src = js['textures'][bc['index']]['source']; break
    if src is None: src = 0
    im = imgs[src]
    if 'bufferView' not in im: return None
    bv = js['bufferViews'][im['bufferView']]
    data = b[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
    pil = Image.open(io.BytesIO(data)).convert('RGBA')
    W, H = pil.size
    a = np.asarray(pil.resize((256, 256))).astype(np.float64) / 255.0
    rgb, al = a[..., :3], a[..., 3]
    mask = al > 0.5
    if mask.sum() < 50: mask = np.ones_like(al, bool)
    px = rgb[mask]
    mx, mn = px.max(1), px.min(1); sat = (mx - mn) / (mx + 1e-6); val = mx
    r, g, bl = px[:, 0], px[:, 1], px[:, 2]
    white = (sat < 0.22) & (val > 0.72)
    green = (g > r * 1.05) & (g > bl * 1.02) & (sat > 0.2) & ~white
    warm = ((r > g * 1.05) & (sat > 0.18)) | ((r > 0.6) & (g > 0.55) & (bl < g * 0.7) & ~white)   # 분홍·노랑·금
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * bl
    return {'tex': f'{W}x{H}', '흰%': round(100 * white.mean(), 1), '따뜻%': round(100 * warm.mean(), 1),
            '초록%': round(100 * green.mean(), 1), '대비': round(float(np.percentile(lum, 95) - np.percentile(lum, 5)), 3)}

def audit(path):
    js, b = load(path)
    P, T = geom(path)
    c = P - P.mean(0); w, v = np.linalg.eigh(np.cov(c.T)); ext = (c @ v).max(0) - (c @ v).min(0)
    row = {'정점': len(P), '삼각': (len(T) if T is not None else 0), '두께%': round(float(ext[0] / ext[1] * 100), 1),
           '길이비': round(float(ext[2] / ext[1]), 2), '이음매%': seam_pct(js, b), '채움%': fill_pct(P, T), '메시': len(js['meshes'])}
    try: row.update(tex_stats(js, b) or {})
    except Exception as e: row['tex'] = 'ERR ' + str(e)[:40]
    return row

if __name__ == '__main__':
    m = json.load(open(os.path.join(ROOT, 'assets', 'manifest.json'), encoding='utf-8'))
    items = m if isinstance(m, list) else (m.get('assets') or m.get('items') or [])
    cats = ('잎·몬스테라·성숙', '잎·몬스테라·중간', '잎·몬스테라·초기')
    cols = ['정점', '삼각', '두께%', '길이비', '이음매%', '채움%', '메시', 'tex', '흰%', '따뜻%', '초록%', '대비']
    print('\t'.join(['갈래', 'file', 'name_ko'] + cols))
    for it in items:
        if not it.get('is_glb') or it.get('category') not in cats: continue
        p = os.path.join(ROOT, 'assets', it['path'])
        if not os.path.exists(p): print('\t'.join([it['category'][-2:], it['file'], '없음'])); continue
        try: r = audit(p)
        except Exception as e: r = {'정점': 'ERR ' + str(e)[:60]}
        print('\t'.join([it['category'][-2:], it['file'], str(it.get('name_ko') or it.get('note') or '')] + [str(r.get(k, '')) for k in cols]), flush=True)
