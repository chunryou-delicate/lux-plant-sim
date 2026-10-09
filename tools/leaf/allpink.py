# -*- coding: utf-8 -*-
"""tools/leaf/allpink.py — 핑크프린세스 «분홍 잎»(엽록소 없이 다 분홍) 판을 크레딧 0 으로 만든다 ([leaf] 10-09 · growth D45 물음 ②)
   밑색 텍스처에서 초록·검은초록 화소를 «분홍»으로 돌린다 — 이미 분홍인 화소의 색상·채도 중앙값을 기준으로 하고,
   밝기는 그 화소 밝기를 분홍 밝기 쪽으로 끌어(짙은 바탕이 탁한 자주가 되지 않게) 잎맥·결은 남긴다.
   분홍 화소가 거의 없으면(민무늬) 기준 분홍 = 색상 335° · 채도 0.45 · 밝기 0.85.
   쓰기: python tools/leaf/allpink.py <in.glb> <out.glb>   (out 이 있으면 안 돈다)"""
import sys, io, os
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lift_base import read_glb, write_glb

def allpink(img):
    hsv = np.asarray(img.convert('RGB').convert('HSV')).astype(np.float64) / 255.0
    h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    pink = ((h >= 290) | (h <= 20)) & (s > 0.2) & (v > 0.35)
    if pink.mean() > 0.02:
        ph = float(np.angle(np.exp(1j * np.deg2rad(h[pink])).mean()) % (2 * np.pi)) / (2 * np.pi)
        ps, pv = float(np.median(s[pink])), float(np.median(v[pink]))
    else:
        ph, ps, pv = 335 / 360, 0.45, 0.85
    other = ~pink
    out = hsv.copy()
    out[..., 0][other] = ph
    out[..., 1][other] = np.clip(ps * (0.75 + 0.5 * s[other]), 0, 1)
    out[..., 2][other] = np.clip(pv * (0.72 + 0.28 * (v[other] / max(v[other].max(), 1e-6))), 0, 1)   # 짙은 바탕도 분홍 밝기 근처로 · 결은 남김
    rgb = Image.fromarray((out * 255).clip(0, 255).astype(np.uint8), 'HSV').convert('RGB')
    return rgb, float(pink.mean()), (round(ph * 360), round(ps, 2), round(pv, 2))

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    if os.path.exists(dst): print('⛔ 이미 있다', dst); sys.exit(2)
    js, b = read_glb(src)
    views = [b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']] for v in js['bufferViews']]
    for mt in js.get('materials') or []:
        bc = (mt.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
        if bc is None: continue
        im = js['images'][js['textures'][bc['index']]['source']]; vi = im['bufferView']
        new, frac, ref = allpink(Image.open(io.BytesIO(views[vi])))
        bio = io.BytesIO(); new.save(bio, 'JPEG', quality=92); im['mimeType'] = 'image/jpeg'; views[vi] = bio.getvalue()
        print(f'원래 분홍 {frac*100:.1f}% · 기준 분홍 H{ref[0]} S{ref[1]} V{ref[2]}')
    write_glb(dst, js, views); print('★', dst, os.path.getsize(dst))
