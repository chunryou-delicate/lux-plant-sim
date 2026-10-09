# -*- coding: utf-8 -*-
"""tools/leaf/glb_flatview.py — 브라우저 없이 GLB 잎을 «정면(잎 겉면)»에서 납작하게 찍는다 ([leaf] 10-10 · 서버가 꺼졌을 때 검수용)
   잎이 가장 넓게 보이는 면(주성분 두 축)으로 투영 · 삼각형마다 UV 무게중심의 밑색을 칠한다(빛 없음 — glb_thumb 과 같은 «납작한 색» 결)
   · 보는 쪽에 가까운 삼각형을 나중에 칠한다(앞면이 위에 오게). 잎자루(맨 아래 8%)가 아래로 오게 세운다.
   쓰기: python tools/leaf/glb_flatview.py <out.png> <glb>... [--size=512]   (여러 개면 한 장에 나란히)"""
import sys, os, io
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb_geom import load, acc
from lift_base import read_glb

def base_tex(path):
    js, b = read_glb(path)
    mt = (js.get('materials') or [{}])[0]; bc = (mt.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
    if not js.get('images'): return None
    im = js['images'][js['textures'][bc['index']]['source']] if bc else js['images'][0]; v = js['bufferViews'][im['bufferView']]
    return np.asarray(Image.open(io.BytesIO(b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']])).convert('RGB'))

def flat(path, S=512):
    js, b = load(path); T = base_tex(path); tris = []
    for m in js['meshes']:
        for pr in m['primitives']:
            P = acc(js, b, pr['attributes']['POSITION']); U = acc(js, b, pr['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in pr['attributes'] else None
            I = acc(js, b, pr['indices']).astype(int).reshape(-1, 3) if 'indices' in pr else np.arange(len(P)).reshape(-1, 3)
            tris.append((P, U, I))
    allP = np.vstack([t[0] for t in tris]); c = allP.mean(0); w, V = np.linalg.eigh(np.cov((allP - c).T))
    ax_thin, ax2, ax1 = V[:, 0], V[:, 1], V[:, 2]          # 가장 얇은 축 = 보는 방향 · 가장 긴 축 = 세로
    img = Image.new('RGB', (S, S), (255, 255, 255)); d = ImageDraw.Draw(img)
    proj = lambda P: np.stack([(P - c) @ ax2, (P - c) @ ax1, (P - c) @ ax_thin], 1)
    Q = proj(allP); lo, hi = Q[:, :2].min(0), Q[:, :2].max(0); sc = 0.9 * S / (hi - lo).max()
    # 잎자루(가장 긴 축의 한쪽 끝 8% 띠)가 아래로 — 그 띠가 위에 있으면 뒤집는다
    y = Q[:, 1]; flip = -1 if (y < y.min() + 0.08 * (y.max() - y.min())).sum() > (y > y.max() - 0.08 * (y.max() - y.min())).sum() else 1
    polys = []
    for P, U, I in tris:
        q = proj(P)
        for t in I:
            xy = [((q[k, 0] - (lo[0] + hi[0]) / 2) * sc + S / 2, S / 2 - flip * ((q[k, 1] - (lo[1] + hi[1]) / 2) * sc)) for k in t]
            if T is not None and U is not None:
                uv = U[t].mean(0); col = tuple(int(x) for x in T[int(np.clip(uv[1], 0, 0.9999) * T.shape[0]), int(np.clip(uv[0], 0, 0.9999) * T.shape[1])])
            else: col = (120, 160, 120)
            polys.append((q[t, 2].mean(), xy, col))
    for _, xy, col in sorted(polys, key=lambda r: r[0]): d.polygon(xy, fill=col)
    return img

if __name__ == '__main__':
    S = next((int(a[7:]) for a in sys.argv if a.startswith('--size=')), 512)
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; out, gl = args[0], args[1:]
    sheet = Image.new('RGB', (S * len(gl), S), (255, 255, 255))
    for i, g in enumerate(gl): sheet.paste(flat(g, S), (i * S, 0))
    sheet.save(out); print('★', out, len(gl))
