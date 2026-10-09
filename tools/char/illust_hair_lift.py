# -*- coding: utf-8 -*-
"""사건 원화(2D)의 «머리 덩어리»만 밝기를 올려 정본(아주 짙은 갈색 · 검정 아님)에 맞춘다 — 크레딧 0.

2026-10-09 · [Char] · Meshy 그림 첫 장(ev_home_ending)이 머리 밝기 35 — 정본 초상화 60 보다 어두워 «검정»으로 읽혔다
■ 머리 가르기: 어둡고(밝기 < 90) 채도 낮은 화소를 «두껍게»(열기 3번 — 먹선처럼 가는 것은 빠진다) 남긴 뒤 가장 큰 덩어리
■ 올리기: 곱(색조 그대로 · 결 그대로) — 목표 밝기 / 지금 밝기(중앙값). 가장자리는 가림을 흐려 띠가 안 나게
■ ⛔ 못 하는 것: 덩어리가 둘로 갈라진 머리(뒤로 넘긴 가닥 등)는 가장 큰 것만 올린다 — 그림으로 볼 것

쓰기  python tools/char/illust_hair_lift.py <그림.png> <나갈.png> [--target=58]
"""
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import binary_opening, label, gaussian_filter

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    src, dst = args
    target = float(next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--target=')), 58))
    im = np.asarray(Image.open(src).convert('RGB')).astype(float)
    L = im @ [0.299, 0.587, 0.114]
    sat = im.max(2) - im.min(2)
    thick = binary_opening((L < 90) & (sat < 70), iterations=3)
    lab, n = label(thick)
    sizes = np.bincount(lab.ravel()); sizes[0] = 0
    hair = lab == np.argmax(sizes)
    now = float(np.median(L[hair]))
    gain = max(1.0, target / now)
    m = gaussian_filter(hair.astype(float), 1.5)[..., None]
    out = im * (1 - m) + np.clip(im * gain, 0, 255) * m
    Image.fromarray(out.round().astype(np.uint8)).save(dst)
    print('머리 덩어리 %d 화소 · 밝기 %.1f → 목표 %.1f (곱 %.2f) · 중앙 색 %s → %s' % (
        hair.sum(), now, target, gain, np.median(im[hair], 0).round().astype(int).tolist(),
        np.median(np.clip(im[hair] * gain, 0, 255), 0).round().astype(int).tolist()))
    return 0


if __name__ == '__main__':
    sys.exit(main())
