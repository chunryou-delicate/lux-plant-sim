# -*- coding: utf-8 -*-
"""hero 텍스처의 머리 텍셀만 밝기를 곱해 올린 «시험 텍스처»를 만든다 — 크레딧 0 · hero.glb 는 안 건드린다.

2026-10-08 · [Char] · 총괄 청(폰 새벽 화면에서 머리가 검정으로 읽히나)
잰 것(probe_hair_onscreen · hair_onscreen_stats): 화면 위 머리 밝기 = 초상화의 0.31~0.55, 같은 판 티는 0.69~0.79.
⇒ 어두운 머리 텍스처가 게임 후처리에서 더 눌린다. 머리만 곱으로 올려(색상·결은 그대로) 화면에서 다시 잰다.
머리 자리 = hero_recolor_test_mask.png 의 빨강(눈 선은 이미 빠져 있다).

쓰기  python tools/char/hair_lift_tex.py <gain ...>   → assets/derived/hero_test/hair_lift_g<gain>.png
"""
import io
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from strip_stray_parts import read_glb  # noqa: E402

js, bn = read_glb('assets/v2/char/hero.glb')
bv = js['bufferViews'][js['images'][0]['bufferView']]
o = bv.get('byteOffset', 0)
tex = np.asarray(Image.open(io.BytesIO(bytes(bn[o:o + bv['byteLength']]))).convert('RGB')).astype(float)
m = np.asarray(Image.open('assets/derived/hero_test/hero_recolor_test_mask.png').convert('RGB')).astype(int)
hair = (m[..., 0] > 150) & (m[..., 1] < 100) & (m[..., 2] < 100)
print('머리 텍셀 %d · 지금 중앙값 %s' % (hair.sum(), np.median(tex[hair], 0).round().astype(int).tolist()))
for g in sys.argv[1:]:
    out = tex.copy()
    out[hair] = np.clip(out[hair] * float(g), 0, 255)
    f = 'assets/derived/hero_test/hair_lift_g%s.png' % g
    Image.fromarray(out.round().astype(np.uint8)).save(f)
    print('  ×%s → 머리 중앙값 %s · %s' % (g, np.median(out[hair], 0).round().astype(int).tolist(), f))
