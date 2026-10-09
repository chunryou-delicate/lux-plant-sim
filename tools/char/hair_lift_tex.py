# -*- coding: utf-8 -*-
"""hero 텍스처의 머리 텍셀만 밝기를 곱해 올린 «시험 텍스처»를 만든다 — 크레딧 0 · hero.glb 는 안 건드린다.

2026-10-08 · [Char] · 총괄 청(폰 새벽 화면에서 머리가 검정으로 읽히나)
잰 것(probe_hair_onscreen · hair_onscreen_stats): 화면 위 머리 밝기 = 초상화의 0.31~0.55, 같은 판 티는 0.69~0.79.
⇒ 어두운 머리 텍스처가 게임 후처리에서 더 눌린다. 머리만 곱으로 올려(색상·결은 그대로) 화면에서 다시 잰다.
머리 자리 = hero_recolor_test_mask.png 의 빨강(눈 선은 이미 빠져 있다).

쓰기  python tools/char/hair_lift_tex.py <gain ...>   → assets/derived/hero_test/hair_lift_g<gain>.png
      python tools/char/hair_lift_tex.py --into=<나갈.glb> --gain=1.4   → hero.glb 사본에 넣는다(D24)
"""
import io
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from strip_stray_parts import read_glb, base_color_image  # noqa: E402

js, bn = read_glb('assets/v2/char/hero.glb')
bv = js['bufferViews'][base_color_image(js)['bufferView']]
o = bv.get('byteOffset', 0)
tex = np.asarray(Image.open(io.BytesIO(bytes(bn[o:o + bv['byteLength']]))).convert('RGB')).astype(float)
m = np.asarray(Image.open('assets/derived/hero_test/hero_recolor_test_mask.png').convert('RGB')).astype(int)
hair = (m[..., 0] > 150) & (m[..., 1] < 100) & (m[..., 2] < 100)
print('머리 텍셀 %d · 지금 중앙값 %s' % (hair.sum(), np.median(tex[hair], 0).round().astype(int).tolist()))
for g in [a for a in sys.argv[1:] if not a.startswith('--')]:
    out = tex.copy()
    out[hair] = np.clip(out[hair] * float(g), 0, 255)
    f = 'assets/derived/hero_test/hair_lift_g%s.png' % g
    Image.fromarray(out.round().astype(np.uint8)).save(f)
    print('  ×%s → 머리 중앙값 %s · %s' % (g, np.median(out[hair], 0).round().astype(int).tolist(), f))


# ── --into=<나갈.glb> --gain=<g> : 그 곱을 «hero.glb 사본»에 넣는다 (D24 · 2026-10-08 총괄: ×1.4) ──
#   새 webp 를 붙이고 이미지가 그것을 가리키게 한 뒤, 아무도 안 쓰는 bufferView(옛 그림)를 빼고 버퍼를 다시 짠다.
#   ⛔ 되읽어 «모든 accessor 값이 그대로»인지 본다 — 하나라도 다르면 쓰지 않는다.
def compact(js, bn):
    used = set(a['bufferView'] for a in js['accessors'] if 'bufferView' in a)
    used |= set(i['bufferView'] for i in js['images'] if 'bufferView' in i)
    remap, views, out = {}, [], bytearray()
    for i, v in enumerate(js['bufferViews']):
        if i not in used:
            continue
        while len(out) % 4:
            out.append(0)
        o = v.get('byteOffset', 0)
        nv = dict(v); nv['byteOffset'] = len(out)
        out.extend(bn[o:o + v['byteLength']])
        remap[i] = len(views); views.append(nv)
    for a in js['accessors']:
        if 'bufferView' in a:
            a['bufferView'] = remap[a['bufferView']]
    for im in js['images']:
        if 'bufferView' in im:
            im['bufferView'] = remap[im['bufferView']]
    js['bufferViews'] = views
    js['buffers'][0]['byteLength'] = len(out)
    return out


def into(dst, g):
    from strip_stray_parts import write_glb, acc_array
    js2, bn2 = read_glb('assets/v2/char/hero.glb')
    before = [acc_array(js2, bn2, i).copy() for i in range(len(js2['accessors']))]
    out = tex.copy()
    out[hair] = np.clip(out[hair] * g, 0, 255)
    buf = io.BytesIO()
    Image.fromarray(out.round().astype(np.uint8)).save(buf, 'WEBP', quality=92)
    data = buf.getvalue()
    while len(bn2) % 4:
        bn2.append(0)
    off = len(bn2); bn2.extend(data)
    js2['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
    base_color_image(js2)['bufferView'] = len(js2['bufferViews']) - 1
    n0 = len(bn2)
    bn3 = compact(js2, bn2)
    after = [acc_array(js2, bn3, i) for i in range(len(js2['accessors']))]
    same = all(a.shape == b.shape and np.array_equal(a, b) for a, b in zip(before, after))
    v = js2['bufferViews'][base_color_image(js2)['bufferView']]
    back = np.asarray(Image.open(io.BytesIO(bytes(bn3[v['byteOffset']:v['byteOffset'] + v['byteLength']]))).convert('RGB')).astype(float)
    print('■ --into  accessor %d개 되읽어 %s · 버퍼 %d → %d 바이트(안 쓰는 옛 그림 뺌) · 머리 중앙값 되읽기 %s'
          % (len(before), '✔ 전부 같다' if same else '⛔ 다르다', n0, len(bn3),
             np.median(back[hair], 0).round().astype(int).tolist()))
    if not same:
        print('⛔ 쓰지 않는다'); return 3
    write_glb(dst, js2, bn3)
    print('썼다: %s (%.2fMB)' % (dst, os.path.getsize(dst) / 1e6))
    return 0


_into = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--into=')), None)
if _into:
    _g = float(next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--gain=')), '1.4'))
    sys.exit(into(_into, _g))
