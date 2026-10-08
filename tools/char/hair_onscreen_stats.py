# -*- coding: utf-8 -*-
"""probe_hair_onscreen.mjs 가 찍은 색 판·가림 판에서 «머리카락 화소» 색을 모은다 — 크레딧 0.

2026-10-08 · [Char]
⛔ 가림 판도 게임 후처리를 거쳐 빨강(200,60,60)이 살구색(240,160,140)으로 나온다
   ⇒ 문턱 대신 «빨강이 초록·파랑보다 40 넘게 큰 화소»를 머리로 본다. 가장자리 1화소는 깎는다(배경 섞임).
정본(초상화) 머리색과 같은 자(sRGB 중앙값 · 밝기 · 채도)로 나란히 낸다.

쓰기  python tools/char/hair_onscreen_stats.py <tag ...>     (tag 예: 0_25 → hair_onscreen_0_25.png)
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
from recolor_hero_tex import canon_colors  # noqa: E402

D = os.path.join('docs', 'handoff', 'img', 'bodytest')


def lum(c):
    return float(np.dot(c, [0.299, 0.587, 0.114]))


def stats(rgb):
    med = np.median(rgb, 0)
    return {'rgb': med.round().astype(int).tolist(), 'L': round(lum(med), 1),
            'chroma': int(med.max() - med.min()),
            'L_p10_p90': [round(float(np.percentile(rgb @ [0.299, 0.587, 0.114], q)), 1) for q in (10, 90)]}


def main():
    ch, ct, _, _ = canon_colors()
    out = {'portrait_hair': {'rgb': ch.round().astype(int).tolist(), 'L': round(lum(ch), 1), 'chroma': int(ch.max() - ch.min())},
           'portrait_tee': {'rgb': ct.round().astype(int).tolist(), 'L': round(lum(ct), 1)}}
    for tag in sys.argv[1:]:
        c = np.asarray(Image.open(os.path.join(D, 'hair_onscreen_%s.png' % tag)).convert('RGB')).astype(float)
        m = np.asarray(Image.open(os.path.join(D, 'hair_onscreen_%s_mask.png' % tag)).convert('RGB')).astype(int)
        hair = (m[..., 0] > m[..., 1] + 40) & (m[..., 0] > m[..., 2] + 40) & (m[..., 0] > 150)
        core = binary_erosion(hair, iterations=1)
        s = stats(c[core]) if core.sum() > 20 else None
        # 같은 판의 티(초록 칸) — 머리만 어두운가, 장면이 다 어두운가를 가른다
        tee = binary_erosion((m[..., 1] > m[..., 0] + 25) & (m[..., 1] > m[..., 2] + 10), iterations=1)
        st = stats(c[tee]) if tee.sum() > 20 else None
        out[tag] = {'hair_px': int(hair.sum()), 'core_px': int(core.sum()), 'onscreen': s,
                    'tee_px': int(tee.sum()), 'tee_onscreen': st,
                    'hair_vs_portrait_L': round(s['L'] / lum(ch), 2) if s else None,
                    'tee_vs_portrait_L': round(st['L'] / lum(ct), 2) if st else None}
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
