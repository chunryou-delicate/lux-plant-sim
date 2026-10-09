"""tools/glb_flatten_bump.py — 판 앞으로 솟은 작은 혹을 판 면까지 눌러 넣고, 그 자리 그림을 둘레 판 색으로 덮는다 ([house] · 2026-10-10)

    python -I tools/glb_flatten_bump.py <in.glb> <out.glb> --box X0 X1 YF0 YF1 [--paint-front] [--color R G B] [--grow 2] [--preview a.png]

왜: Tripo 전신 거울(raw_mirror.glb)의 유리 아래쪽(높이 22~31%)에 나무 쪽 하나가 3cm 솟아 나왔다. 원화가 코드 거울의
    «뒷다리가 판을 뚫은 쐐기»를 그대로 옮긴 것이다(장부 flags · 코드는 10-10 에 고쳤다). 다시 뜨기 없이(크레딧 0) 메운다.
판: 앞(+Z)을 보는 판 — 먼저 tools/glb_rotate_y.py 로 판 법선을 +Z 에 맞춘 GLB 를 넣는다.
--box: 가로 X0..X1(m · GLB 좌표) · 높이 비율 YF0..YF1(0=바닥 · 1=꼭대기). 이 상자 안 꼭짓점 중 판 면보다 앞에 있는 것을 판 면 z 로 민다.
    판 면 z = 같은 높이 띠 · 상자 둘레 5cm 안에서 앞을 보는(법선 z>0.9) 삼각형 무게중심 z 의 가운값(혹은 빼고).
법선: 민 꼭짓점의 법선은 판 삼각형 법선의 평균으로 둔다.
그림: 민 꼭짓점을 하나라도 가진 삼각형(--paint-front 면 상자 안 앞면 삼각형까지)의 UV 자리를 «둘레 판 삼각형이 덮는 화소의 가운값»으로 칠한다. 기하 개수·UV·인덱스는 그대로다.
"""
import io, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from glb_tex_webp import read_glb, write_glb
from glb_tex_patch_band import acc


def main():
    a = sys.argv[1:]; src, dst = a[0], a[1]
    i = a.index('--box'); x0, x1, f0, f1 = (float(v) for v in a[i + 1: i + 5])
    grow = int(a[a.index('--grow') + 1]) if '--grow' in a else 2
    prev = a[a.index('--preview') + 1] if '--preview' in a else None
    js, bins = read_glb(src)
    assert len(js['meshes']) == 1 and len(js['meshes'][0]['primitives']) == 1, '메시·프리미티브 하나짜리만(Tripo)'
    pr = js['meshes'][0]['primitives'][0]
    P = acc(js, bins, pr['attributes']['POSITION']); UV = acc(js, bins, pr['attributes']['TEXCOORD_0'])
    I = acc(js, bins, pr['indices']).reshape(-1, 3)
    mn, mx = P.min(0), P.max(0); H = mx[1] - mn[1]
    fy = (P[:, 1] - mn[1]) / H
    C = P[I].mean(1); cfy = (C[:, 1] - mn[1]) / H
    nr = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]]); n = nr / (np.linalg.norm(nr, axis=1, keepdims=True) + 1e-12)
    inb = (P[:, 0] >= x0) & (P[:, 0] <= x1) & (fy >= f0) & (fy <= f1)
    band = (cfy >= f0) & (cfy <= f1)
    tri_in = inb[I].any(1)
    flat = band & ~tri_in & (n[:, 2] > 0.9) & (C[:, 0] >= x0 - 0.05) & (C[:, 0] <= x1 + 0.05)   # 상자 둘레 5cm 만(틀은 안 섞는다)
    assert flat.any(), '같은 띠에 앞을 보는 판 삼각형이 없다'
    zp = float(np.median(C[flat, 2]))
    mv = inb & (P[:, 2] > zp + 0.001)
    print(f'  판 면 z {zp:+.4f} · 상자 안 꼭짓점 {int(inb.sum())} · 민 꼭짓점 {int(mv.sum())} · 가장 솟은 {float((P[inb, 2] - zp).max()):.4f}m')
    # 위치 바이트를 제자리에서 간다
    buf = bytearray(bins)
    acc_p = js['accessors'][pr['attributes']['POSITION']]; bv = js['bufferViews'][acc_p['bufferView']]
    assert acc_p['componentType'] == 5126
    off = bv.get('byteOffset', 0) + acc_p.get('byteOffset', 0); stride = bv.get('byteStride') or 12
    rows = np.ndarray((acc_p['count'], 3), dtype='<f4', buffer=buf, offset=off, strides=(stride, 4))
    rows[mv, 2] = zp
    acc_p['min'] = [float(v) for v in rows.min(0)]; acc_p['max'] = [float(v) for v in rows.max(0)]
    # 법선도 판 법선으로 — 안 그러면 눌린 면이 옛 옆 법선으로 빛을 받아 흰 네모로 비친다
    if 'NORMAL' in pr['attributes']:
        acc_n = js['accessors'][pr['attributes']['NORMAL']]; bn = js['bufferViews'][acc_n['bufferView']]
        offn = bn.get('byteOffset', 0) + acc_n.get('byteOffset', 0); sn = bn.get('byteStride') or 12
        nrows = np.ndarray((acc_n['count'], 3), dtype='<f4', buffer=buf, offset=offn, strides=(sn, 4))
        pn = n[flat].mean(0); pn /= np.linalg.norm(pn)
        ring = inb & (np.abs(rows[:, 2] - zp) < 0.004)   # 혹 밑동 둘레 판 꼭짓점 — 옆면과 법선을 나눠 가져 그늘 테두리가 진다
        nrows[mv | ring] = pn
    # 그림 — 민 꼭짓점을 가진 삼각형의 UV 자리를 판 색으로
    hit_t = mv[I].any(1)
    if '--paint-front' in a:                        # 둘레 판 섬에도 혹의 테두리가 그려져 왔다(Tripo 는 원화를 비춰 굽는다) — 상자 안 앞면도 같이 덮는다
        cin = (C[:, 0] >= x0) & (C[:, 0] <= x1) & band
        onp = (np.abs(np.asarray(rows)[:, 2] - zp) < 0.004)[I].all(1)   # 누른 «뒤» 판 면에 누운 삼각형(옛 옆면 포함)
        hit_t = hit_t | (cin & ((n[:, 2] > 0.5) | onp))
    ti = js['materials'][pr['material']]['pbrMetallicRoughness']['baseColorTexture']['index']
    tex = js['textures'][ti]; si = tex['source'] if 'source' in tex else tex['extensions']['EXT_texture_webp']['source']
    img = js['images'][si]; ib = js['bufferViews'][img['bufferView']]; o = ib.get('byteOffset', 0)
    pic = Image.open(io.BytesIO(bytes(buf[o: o + ib['byteLength']]))).convert('RGB'); W, Hh = pic.size
    A = np.asarray(pic).astype(np.int32)
    mask = Image.new('L', (W, Hh), 0); dr = ImageDraw.Draw(mask)
    for uv in UV[I[hit_t]]: dr.polygon([(float(u) * W, float(v) * Hh) for u, v in uv], fill=255)
    if grow: mask = mask.filter(ImageFilter.MaxFilter(grow * 2 + 1))
    M = np.asarray(mask) > 0
    # 판 색 = 둘레 판 삼각형이 덮는 «화소 전부»의 가운값(무게중심 한 점보다 고르다) · 덮을 자리는 뺀다
    rm = Image.new('L', (W, Hh), 0); dr2 = ImageDraw.Draw(rm)
    for uv in UV[I[flat & ~hit_t]]: dr2.polygon([(float(u) * W, float(v) * Hh) for u, v in uv], fill=255)
    R = (np.asarray(rm) > 0) & ~M
    base = np.median(A[R], axis=0)
    if '--color' in a:                              # 렌더에서 둘레와 견줘 고친 색(그림 가운값이 빛 받은 화면 색과 어긋날 때)
        j = a.index('--color'); base = np.array([int(v) for v in a[j + 1: j + 4]])
    A2 = A.copy(); A2[M] = base.astype(np.int32)
    print(f'  덮은 삼각형 {int(hit_t.sum())} · 화소 {int(M.sum())} · 판 색 {base.astype(int).tolist()}')
    out = Image.fromarray(A2.astype(np.uint8))
    if prev:
        sheet = Image.new('RGB', (W, Hh // 2)); sheet.paste(pic.resize((W // 2, Hh // 2)), (0, 0)); sheet.paste(out.resize((W // 2, Hh // 2)), (W // 2, 0)); sheet.save(prev)
    b2 = io.BytesIO(); out.save(b2, 'PNG'); new = b2.getvalue()
    nb = bytearray()
    for vi, b in enumerate(js['bufferViews']):
        data = new if vi == img['bufferView'] else bytes(buf[b.get('byteOffset', 0): b.get('byteOffset', 0) + b['byteLength']])
        while len(nb) % 4: nb.append(0)
        b['byteOffset'] = len(nb); b['byteLength'] = len(data); b['buffer'] = 0; nb += data
    img['mimeType'] = 'image/png'
    js['buffers'] = [{'byteLength': len(nb)}]
    write_glb(dst, js, bytes(nb))
    print('  →', dst)


if __name__ == '__main__':
    main()
