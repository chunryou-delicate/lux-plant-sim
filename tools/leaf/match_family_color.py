# -*- coding: utf-8 -*-
"""tools/leaf/match_family_color.py — Meshy 새 잎의 색을 «옛 가족» 색에 맞출 손질값을 잰다 ([leaf] 10-09 · 크레딧 0)
   같은 도구(glb_thumb --view=top)로 찍은 옛 썸네일과 새 썸네일에서 잎 화소(흰 바탕 = 세 채널 ≥ 248 은 뺌)의
   «색 있는 화소(S>0.15)» 색상(원형 평균)·채도 중앙값·밝기 중앙값을 재고, lift_base.py 에 넣을 (감마 · 채도배 · 색상°)을 낸다.
     감마  = log(V옛)/log(V새)      (새 V^감마 = 옛 V)
     채도배 = S옛/S새 · 색상 = H옛 − H새 (±30° 안)
   쓰기: python tools/leaf/match_family_color.py <옛 썸네일 폴더> <새 썸네일 폴더> <접미(예: _new)> <가족...>
   ⚠ 무늬가 두 빛깔(분홍+민트 · 초록+금)이면 하나의 손질로 둘을 다 못 맞춘다 — 결과는 눈으로 다시 본다."""
import sys, math, json
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image

def stats(p):
    im = Image.open(p).convert('RGB'); a = np.asarray(im)
    leaf = ~(a >= 248).all(2)
    hsv = np.asarray(im.convert('HSV')).astype(float)[leaf] / 255
    col = hsv[hsv[:, 1] > 0.15]
    H = (np.angle(np.exp(1j * 2 * np.pi * col[:, 0]).mean()) / (2 * np.pi) % 1) * 360 if len(col) else 0.0
    return {'H': round(float(H)), 'S': round(float(np.median(col[:, 1])), 3) if len(col) else 0.0,
            'V': round(float(np.median(col[:, 2])), 3) if len(col) else 0.0,
            '흰%': round(float(((hsv[:, 1] < 0.15) & (hsv[:, 2] > 0.7)).mean() * 100), 1), '잎화소': int(leaf.sum())}

def params(o, n):
    g = math.log(max(o['V'], 0.03)) / math.log(max(n['V'], 0.03)) if 0.03 < n['V'] < 0.995 else 1.0
    s = o['S'] / max(n['S'], 0.05)
    dh = ((o['H'] - n['H'] + 180) % 360) - 180
    return {'감마': round(min(1.3, max(0.3, g)), 2), '채도배': round(min(1.5, max(0.25, s)), 2), '색상': round(max(-30, min(30, dh)))}

if __name__ == '__main__':
    od, nd, suf, fams = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
    out = {}
    for k in fams:
        o = stats(f'{od}/{k}.png'); n = stats(f'{nd}/{k}{suf}.png'); p = params(o, n)
        out[k] = {'옛': o, '새': n, **p}
        print(f'{k:26s} 옛 H{o["H"]:>4} S{o["S"]:.2f} V{o["V"]:.2f} 흰{o["흰%"]:>5} | 새 H{n["H"]:>4} S{n["S"]:.2f} V{n["V"]:.2f} 흰{n["흰%"]:>5} → γ{p["감마"]} S×{p["채도배"]} H{p["색상"]:+}')
    print(json.dumps(out, ensure_ascii=False))
