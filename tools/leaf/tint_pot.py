# -*- coding: utf-8 -*-
"""tools/leaf/tint_pot.py — 화분 색 판(_c1 민트 · _c2 핑크)을 만든다 (2026-08-23 · leaf)

    PYTHONIOENCODING=utf-8 python tools/leaf/tint_pot.py pot_concrete_square

★ 규칙을 지어내지 않았다. **이미 있는 `pot_concrete_round` · `pot_terracotta_wood` 의
  색 판을 재서 그대로 옮긴 것**이다:

      기본                     평균색상   평균채도   평균밝기
      pot_concrete_round        151      0.138     0.581
        _c1 (민트)              151      0.123     0.638
        _c2 (핑크)              343      0.118     0.638
      pot_terracotta_wood        19      0.416     0.592
        _c1 (민트)              151      0.178     0.649
        _c2 (핑크)              342      0.161     0.649

⇒ ★ **색상을 돌리는 것이 아니라 한 색으로 덧칠한다.** 바탕이 테라코타(19°)든 회백(151°)이든
  결과는 똑같이 민트 151° · 핑크 342~343° 다. 채도도 한 값으로 눕힌다.
  ⇒ 그래서 **무늬(밝고 어두움)만 남고 색은 통일된다.** 잎의 `_v1`·`_v2` 와 방식이 다르다 —
    잎은 「원래 색을 옮기는 것」이고 화분은 「한 색으로 칠하는 것」이다.

⚠ 콘크리트는 원래 회백이다. 채도를 올리면 **다른 재질처럼** 보인다.
  그래서 채도를 **0.13 로 낮게** 둔다(위 표의 c1·c2 와 같은 자리).
"""
import io, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from recolor_calm import read, write, to_hsv, to_rgb

MINT, PINK = 151.0, 343.0
TARGET_S   = 0.13      # 회백 콘크리트가 「플라스틱」으로 안 보이게 낮게
TARGET_V   = 0.638     # 위 표의 c1·c2 가 앉은 자리

# ⚠⚠ **1판은 흙까지 칠했다.** 찍어서 눈으로 보고 잡았다 —
#   민트 화분의 흙이 **초록**, 핑크 화분의 흙이 **적갈색**이 됐다. 흙은 갈색이어야 한다.
#   까닭: 칠하기는 **텍스처 전체**를 한 색으로 덮는데, 이 화분은 **흙이 같은 텍스처 안에** 있다.
#   ⇒ 흙만 빼 둔다. 흙은 **갈색이고 어둡다**(색상 25 · 채도 0.18 · 밝기 0.32 · 텍스처의 5.3%).
#   ⚠ 화분 몸통은 거의 무채색(평균 채도 0.035)이라 이 조건에 안 걸린다. 그래서 갈린다.
SOIL_H  = (5, 50)      # 갈색 띠
SOIL_S  = 0.15         # 그보다 진하면 흙 (몸통은 0.035 라 안 걸린다)
SOIL_V  = 0.60         # 그보다 어두우면 흙

def tint(img, hue):
    a = np.asarray(img.convert('RGB'), dtype=float)/255.0
    h, s, v = to_hsv(a)
    soil = (h >= SOIL_H[0]) & (h <= SOIL_H[1]) & (s > SOIL_S) & (v < SOIL_V)
    v2 = np.clip(v * (TARGET_V/max(v.mean(), 1e-6)), 0, 1)   # 밝기 무늬는 살리고 평균만 옮긴다
    h2 = np.where(soil, h,  np.full_like(h, hue))            # ★ 흙은 제 색 그대로
    s2 = np.where(soil, s,  np.full_like(s, TARGET_S))
    v3 = np.where(soil, v,  v2)                              # 흙은 밝기도 안 건드린다
    out = to_rgb(h2, s2, v3)
    return Image.fromarray((out*255+0.5).astype(np.uint8))

def make(base, suf, hue):
    src = 'assets/pots/%s.glb' % base
    dst = 'assets/pots/%s%s.glb' % (base, suf)
    js, bb = read(src)
    news = {}
    for im in js['images']:
        bv = js['bufferViews'][im['bufferView']]
        s0 = bv.get('byteOffset', 0)
        pil = Image.open(io.BytesIO(bb[s0:s0+bv['byteLength']]))
        buf = io.BytesIO()
        fmt = 'JPEG' if 'jpeg' in (im.get('mimeType') or '') else 'PNG'
        tint(pil, hue).save(buf, fmt, quality=92, optimize=True) if fmt == 'JPEG' \
            else tint(pil, hue).save(buf, 'PNG', optimize=True)
        news[im['bufferView']] = buf.getvalue()
    order = sorted(range(len(js['bufferViews'])), key=lambda i: js['bufferViews'][i].get('byteOffset', 0))
    nb = bytearray()
    for i in order:
        bv = js['bufferViews'][i]; s0 = bv.get('byteOffset', 0)
        data = news.get(i, bb[s0:s0+bv['byteLength']])
        while len(nb) % 4: nb.append(0)
        bv['byteOffset'] = len(nb); bv['byteLength'] = len(data); nb += data
    js['buffers'][0]['byteLength'] = len(nb)
    write(dst, js, bytes(nb))
    return dst, os.path.getsize(dst)

if __name__ == '__main__':
    for base in (sys.argv[1:] or ['pot_concrete_square']):
        for suf, hue, ko in (('_c1', MINT, '민트'), ('_c2', PINK, '핑크')):
            d, n = make(base, suf, hue)
            print('%-34s %-5s %6d KB' % (d, ko, n//1024))
