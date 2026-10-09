# -*- coding: utf-8 -*-
"""tools/leaf/depink.py — GLB 밑색 텍스처에서 «분홍·적갈 무늬»만 지워 주변 초록으로 메운다 ([leaf] 10-09 · 크레딧 0)
   핑크프린세스 성숙잎 «민무늬» retexture 가 분홍을 못 지웠다(원본 텍스처를 끌고 옴). 다시 돌리기(10) 전에 손으로 지운다.
   분홍 = 색상 290~360° 또는 0~35° · 채도 > 0.22 (적갈 포함). 그 화소를 «분홍 아닌 화소만 흐린 색»(가린 흐림 ÷ 가림 흐림)으로 메운다
   — 큰 반지름부터 작은 반지름까지 겹쳐 빈 데가 없게 한다. 메운 자리의 밝기 결은 원래 밝기를 조금(LUMA) 섞어 남긴다.
   쓰기: python tools/leaf/depink.py <in.glb> <out.glb>   (out 이 있으면 안 돈다)"""
import sys, io, os
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lift_base import read_glb, write_glb

LUMA = 0.1
S_MIN = 0.12      # 이보다 진한 분홍·적갈을 지운다(JPEG 가장자리의 옅은 분홍 그림자까지)
GROW = 2          # 지울 자리를 이만큼(px) 넓힌다 — 테두리 그림자

def box(a, r):
    """상자 흐림(누적합 · 가장자리는 있는 만큼만) — PIL 흐림이 실수형을 못 받아서"""
    p = np.pad(a, r, mode='edge'); c = p.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    k = 2 * r + 1; H, W = a.shape
    return (c[k:k + H, k:k + W] - c[0:H, k:k + W] - c[k:k + H, 0:W] + c[0:H, 0:W]) / (k * k)

def depink(img):
    rgb = np.asarray(img.convert('RGB')).astype(np.float64)
    hsv = np.asarray(img.convert('RGB').convert('HSV')).astype(np.float64) / 255.0
    h, s = hsv[..., 0] * 360, hsv[..., 1]
    pink = (((h >= 270) | (h <= 45)) & (s > S_MIN))
    if GROW: pink = box(pink.astype(np.float64), GROW) > 0.01
    keep = (~pink).astype(np.float64)
    fill = np.zeros_like(rgb); have = np.zeros(pink.shape)
    for rad in (96, 48, 24, 12, 6):                     # 넓게 → 좁게: 좁은 반지름이 이웃 색을 더 잘 따른다
        num = np.stack([box(rgb[..., c] * keep, rad) for c in range(3)], -1)
        den = box(keep, rad)
        ok = den > 0.05
        f = num / np.maximum(den, 1e-6)[..., None]
        fill[ok] = f[ok]; have[ok] = 1
    lum = rgb.mean(2, keepdims=True); flum = fill.mean(2, keepdims=True) + 1e-6
    shaded = fill * ((1 - LUMA) + LUMA * (lum / flum))   # 밝기 결을 조금 남긴다
    out = rgb.copy(); m = pink & (have > 0)
    out[m] = shaded[m]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8)), float(pink.mean())

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    if os.path.exists(dst): print('⛔ 이미 있다', dst); sys.exit(2)
    js, b = read_glb(src)
    views = [b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']] for v in js['bufferViews']]
    for mt in js.get('materials') or []:
        bc = (mt.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
        if bc is None: continue
        im = js['images'][js['textures'][bc['index']]['source']]; vi = im['bufferView']
        pil = Image.open(io.BytesIO(views[vi])); new, frac = depink(pil)
        bio = io.BytesIO(); new.save(bio, 'JPEG', quality=92); im['mimeType'] = 'image/jpeg'; views[vi] = bio.getvalue()
        print(f'분홍 화소 {frac*100:.1f}% 를 메움 · {pil.size}')
    write_glb(dst, js, views); print('★', dst, os.path.getsize(dst))
