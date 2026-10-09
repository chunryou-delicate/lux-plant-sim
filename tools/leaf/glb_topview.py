# -*- coding: utf-8 -*-
"""tools/leaf/glb_topview.py — GLB 잎을 «위에서 본» 그림으로 찍는다(서버·브라우저 없이 · [leaf] 10-09)
   잎몸 평면(주성분 둘째·셋째 축)에 삼각형을 투영하고 UV 로 밑색 텍스처를 집어 칠한다. 빛 없음(밑색 그대로).
   ⚠ 게임 화면이 아니다 — «견줄 셋을 같은 자로» 찍으려고 만든 것이다(지금 · 캔버스 · 새것). 게임 화면 확인은 따로.
   쓰기: python tools/leaf/glb_topview.py <out.png> <glb> [<glb> ...]   (가로로 나란히 · 칸마다 같은 픽셀)"""
import sys, io, os
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
from glb_geom import load, acc

def mesh_parts(path):
    js, b = load(path)
    texs = []
    for im in js.get('images') or []:
        bv = js['bufferViews'][im['bufferView']]
        texs.append(Image.open(io.BytesIO(b[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB'))
    parts = []
    for m in js['meshes']:
        for pr in m['primitives']:
            P = acc(js, b, pr['attributes']['POSITION'])
            UV = acc(js, b, pr['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in pr['attributes'] else None
            T = acc(js, b, pr['indices']).astype(np.int64).reshape(-1, 3) if 'indices' in pr else np.arange(len(P)).reshape(-1, 3)
            tex = None
            mi = pr.get('material')
            if mi is not None and texs:
                bc = (js['materials'][mi].get('pbrMetallicRoughness') or {}).get('baseColorTexture')
                if bc is not None: tex = texs[js['textures'][bc['index']]['source']]
            parts.append((P, UV, T, tex))
    return parts

def render(path, S=420):
    parts = mesh_parts(path)
    allP = np.vstack([p[0] for p in parts]); c = allP.mean(0)
    w, v = np.linalg.eigh(np.cov((allP - c).T))
    # ★ 보는 방향 = 넓이로 무게 준 면 법선의 평균(잎몸이 넓이를 거의 다 가진다 · 잎자루 관은 서로 지운다).
    #   앞뒤 두 겹이라 평균이 지워지면 주성분의 가장 얇은 축으로 떨어진다(10-09 · 자루가 긴 잎을 비스듬히 찍은 한 번)
    FN = np.vstack([np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]) for P, UV, T, tex in parts])   # 넓이 × 법선
    acc_n = FN.sum(0)
    nrm = acc_n / np.linalg.norm(acc_n) if np.linalg.norm(acc_n) > 1e-6 * len(allP) else v[:, 0]
    for _ in range(3):                                  # 주된 방향과 맞는 면만 남겨 다시 — 잎자루 관·말린 가장자리를 거른다
        un = FN / (np.linalg.norm(FN, axis=1, keepdims=True) + 1e-12)
        keep = (un @ nrm) > 0.5
        if keep.sum() < 10: break
        n2 = FN[keep].sum(0); nrm = n2 / np.linalg.norm(n2)
    up = v[:, 2] - nrm * (v[:, 2] @ nrm); up /= np.linalg.norm(up)
    side = np.cross(nrm, up)
    ax = np.stack([up, side], 1)                        # 세로 = 가장 긴 축을 화면 면에 내린 것 · 가로 = 그에 수직
    q_all = (allP - c) @ ax
    lo, hi = q_all.min(0), q_all.max(0); span = (hi - lo).max() * 1.06
    img = np.full((S, S, 3), 44, np.float64); zbuf = np.full((S, S), -1e9)
    for P, UV, T, tex in parts:
        q = (P - c) @ ax; d = (P - c) @ nrm
        px = (q[:, 1] - (lo[1] + hi[1]) / 2) / span * S + S / 2
        py = S / 2 - (q[:, 0] - (lo[0] + hi[0]) / 2) / span * S
        ta = np.asarray(tex, np.float64) if tex is not None else None
        for t in T:
            x0, x1, x2 = px[t]; y0, y1, y2 = py[t]
            xmin, xmax = int(max(0, np.floor(min(x0, x1, x2)))), int(min(S - 1, np.ceil(max(x0, x1, x2))))
            ymin, ymax = int(max(0, np.floor(min(y0, y1, y2)))), int(min(S - 1, np.ceil(max(y0, y1, y2))))
            if xmax < xmin or ymax < ymin: continue
            den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
            if abs(den) < 1e-12: continue
            X, Y = np.meshgrid(np.arange(xmin, xmax + 1) + 0.5, np.arange(ymin, ymax + 1) + 0.5)
            a = ((y1 - y2) * (X - x2) + (x2 - x1) * (Y - y2)) / den
            bb = ((y2 - y0) * (X - x2) + (x0 - x2) * (Y - y2)) / den
            cc = 1 - a - bb
            m = (a >= 0) & (bb >= 0) & (cc >= 0)
            if not m.any(): continue
            z = a * d[t[0]] + bb * d[t[1]] + cc * d[t[2]]
            ys, xs = Y[m].astype(int), X[m].astype(int); zz = z[m]
            front = zz > zbuf[ys, xs]
            ys, xs, zz = ys[front], xs[front], zz[front]
            if not len(ys): continue
            zbuf[ys, xs] = zz
            if ta is not None and UV is not None:
                u = a[m][front] * UV[t[0], 0] + bb[m][front] * UV[t[1], 0] + cc[m][front] * UV[t[2], 0]
                vv = a[m][front] * UV[t[0], 1] + bb[m][front] * UV[t[1], 1] + cc[m][front] * UV[t[2], 1]
                H, W = ta.shape[:2]
                tx = np.clip((u % 1.0) * W, 0, W - 1).astype(int); ty = np.clip((vv % 1.0) * H, 0, H - 1).astype(int)
                img[ys, xs] = ta[ty, tx]
            else:
                img[ys, xs] = (120, 160, 120)
    return Image.fromarray(img.clip(0, 255).astype(np.uint8))

if __name__ == '__main__':
    out, paths = sys.argv[1], sys.argv[2:]
    S = 420; f = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 14)
    W = Image.new('RGB', (len(paths) * (S + 10) + 10, S + 34), (24, 22, 30)); d = ImageDraw.Draw(W)
    for i, p in enumerate(paths):
        W.paste(render(p, S), (10 + i * (S + 10), 30)); d.text((10 + i * (S + 10), 8), os.path.basename(p), font=f, fill=(230, 220, 200))
    W.save(out); print(out, W.size)
