"""tools/glb_tex_patch_band.py — GLB 의 «한 높이 띠의 위를 보는 면»이 쓰는 텍스처 자리에서 짙은 얼룩을 판 색으로 덮는다 ([house] · 2026-10-09)

    python -I tools/glb_tex_patch_band.py <in.glb> <out.glb> --band 0.49 0.54 [--dark 150] [--grow 3] [--preview a.png]

왜: Meshy 코너 선반(raw_shelf_corner_3tier.glb) 가운데 판 윗면에 짙은 갈색 얼룩이 구워져 나왔다(원화엔 없다).
    다시 뽑기(retexture 10)보다 먼저 크레딧 0 으로 — 그 판 윗면 삼각형이 쓰는 UV 자리만 골라,
    그 안에서 밝기가 --dark 밑인 화소를 «그 자리의 밝은 화소 가운값»으로 칠한다. 기하·UV 는 안 건드린다.
--band: 높이 비율(0=바닥 · 1=꼭대기) — 이 띠 안에 세 꼭짓점이 다 있고 면 법선이 위(y>0.6)를 보는 삼각형만.
"""
import io, json, struct, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from glb_tex_webp import read_glb, write_glb

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def acc(js, bins, i):
    a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
    n, k, dt = a['count'], NC[a['type']], CT[a['componentType']]
    isz = np.dtype(dt).itemsize
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride') or k * isz
    rows = np.ndarray(shape=(n, k), dtype=dt, buffer=bins, offset=off, strides=(stride, isz))
    return np.array(rows, dtype=np.float64 if dt == np.float32 else np.int64)


def main():
    a = sys.argv[1:]; src, dst = a[0], a[1]
    lo, hi = float(a[a.index('--band') + 1]), float(a[a.index('--band') + 2])
    dark = int(a[a.index('--dark') + 1]) if '--dark' in a else 150
    grow = int(a[a.index('--grow') + 1]) if '--grow' in a else 3
    prev = a[a.index('--preview') + 1] if '--preview' in a else None
    js, bins = read_glb(src)
    tris_uv = []
    allp = [acc(js, bins, pr['attributes']['POSITION']) for m in js['meshes'] for pr in m['primitives']]
    ymin = min(p[:, 1].min() for p in allp); ymax = max(p[:, 1].max() for p in allp); H = ymax - ymin
    mat_img = None
    for m in js['meshes']:
        for pr in m['primitives']:
            P = acc(js, bins, pr['attributes']['POSITION']); UV = acc(js, bins, pr['attributes']['TEXCOORD_0'])
            I = acc(js, bins, pr['indices']).reshape(-1, 3) if 'indices' in pr else np.arange(len(P)).reshape(-1, 3)
            f = (P[:, 1] - ymin) / H
            inb = (f >= lo) & (f <= hi)
            for t in I:
                if not inb[t].all(): continue
                p0, p1, p2 = P[t]; nrm = np.cross(p1 - p0, p2 - p0); ln = np.linalg.norm(nrm)
                if ln < 1e-12 or abs(nrm[1]) / ln < 0.6: continue    # 판 윗면·밑면 둘 다(감는 차례가 뒤집혀 와도)
                tris_uv.append(UV[t])
            mi = pr.get('material')
            if mi is not None:
                bt = js['materials'][mi].get('pbrMetallicRoughness', {}).get('baseColorTexture')
                if bt: mat_img = js['textures'][bt['index']]['source'] if 'source' in js['textures'][bt['index']] else js['textures'][bt['index']]['extensions']['EXT_texture_webp']['source']
    img = js['images'][mat_img]; bv = js['bufferViews'][img['bufferView']]
    o = bv.get('byteOffset', 0); raw = bins[o: o + bv['byteLength']]
    pic = Image.open(io.BytesIO(raw)).convert('RGB'); W, Hh = pic.size
    mask = Image.new('L', (W, Hh), 0); dr = ImageDraw.Draw(mask)
    for uv in tris_uv: dr.polygon([(float(u) * W, float(v) * Hh) for u, v in uv], fill=255)
    if grow: mask = mask.filter(ImageFilter.MaxFilter(grow * 2 + 1))
    A = np.asarray(pic).astype(np.int32); M = np.asarray(mask) > 0
    L = A.mean(axis=2)
    light = M & (L >= dark)
    base = np.median(A[light], axis=0) if light.any() else np.array([235, 222, 200])
    hit = M & (L < dark)
    A2 = A.copy(); A2[hit] = base.astype(np.int32)
    print(f'  띠 {lo:.2f}~{hi:.2f} 위 삼각형 {len(tris_uv)} · 자리 화소 {int(M.sum())} · 덮은 짙은 화소 {int(hit.sum())} ({hit.sum() / max(1, M.sum()) * 100:.1f}%) · 판 색 {base.astype(int).tolist()}')
    out = Image.fromarray(A2.astype(np.uint8))
    if prev:
        a_ = pic.copy(); a_.paste((255, 0, 0), mask=Image.fromarray((hit * 255).astype(np.uint8)))
        sheet = Image.new('RGB', (W, Hh // 2)); sheet.paste(a_.resize((W // 2, Hh // 2)), (0, 0)); sheet.paste(out.resize((W // 2, Hh // 2)), (W // 2, 0)); sheet.save(prev)
    buf = io.BytesIO(); out.save(buf, 'PNG')
    new = buf.getvalue()
    # 이미지 bufferView 만 갈아 끼운다(나머지는 그대로 옮김)
    nb = bytearray()
    for vi, b in enumerate(js['bufferViews']):
        data = new if vi == img['bufferView'] else bins[b.get('byteOffset', 0): b.get('byteOffset', 0) + b['byteLength']]
        while len(nb) % 4: nb.append(0)
        b['byteOffset'] = len(nb); b['byteLength'] = len(data); b['buffer'] = 0; nb += data
    img['mimeType'] = 'image/png'
    js['buffers'] = [{'byteLength': len(nb)}]
    write_glb(dst, js, bytes(nb))
    print('  →', dst)


if __name__ == '__main__':
    main()
