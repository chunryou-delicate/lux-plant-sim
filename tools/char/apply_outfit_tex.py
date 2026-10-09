# -*- coding: utf-8 -*-
"""Meshy retexture 로 받은 «옷» 그림을 hero2 에 입힌다 — 얼굴·눈·머리카락·맨살은 지금 hero2 것(정본 · D24)을 지킨다 — 크레딧 0.

2026-10-09 · [Char] · 주문표 ③ 계절 옷 (G5)
■ 왜 합치나
  retexture 는 옷만이 아니라 텍스처 «전부»를 새로 칠한다 — 봄 옷 판에서 머리 [61,37,47]→[23,9,8](거의 검정) · 살 [254,210,203]→[252,196,164] ·
  눈동자 [111,79,47]→[62,27,9]. 정본(D3 초상화 · D24 머리 ×1.4)이 옷마다 흔들리면 안 된다.
  UV 는 그대로다(enable_original_uv · 리그 전 3D 와 위치·UV 차 0) ⇒ 텍셀 단위로 고를 수 있다.
■ 고르는 법 (텍셀마다)
  바탕 = 옷 그림. 아래는 지금 hero2 그림으로:
    · 턱 위 — 텍셀이 붙는 3D 높이 > --neck(기본 0.63 · hero2 Head 관절 0.592)  ⇒ 얼굴·눈·귀·앞머리
    · 머리카락 — «원래 Meshy 그림»(리그 GLB)에서 자줏빛(R>G+8 · B≥G−2 · 밝기<130) 인 자리(여백 포함)
    · 맨살 — 원래 그림에서 살색이고, 옷 그림에서도 «그 그림의 얼굴 살색과 색 거리 < 40» 인 자리(손·목) ⇒ 살빛을 한 벌로
■ ⛔ 못 하는 것: 옷 모양(부피)은 못 바꾼다 — 칠한 판이다. 보기는 같은 자로 그려 볼 것.

쓰기  python tools/char/apply_outfit_tex.py <hero2.glb> <retex.glb> <원래 리그.glb> <나갈.glb> [--neck=0.60] [--tex-out=<그림.jpg>]
      --tex-out : 합친 그림만 따로 쓴다(게임은 몸 하나에 계절 그림을 바꿔 끼운다 — v2_hero setOutfit)
"""
import io
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
from strip_stray_parts import read_glb, write_glb, base_color_image  # noqa: E402
from recolor_hero_tex import texel_height, lum  # noqa: E402
from build_hero2 import compact  # noqa: E402


def tex_of(js, bn):
    im = base_color_image(js)
    bv = js['bufferViews'][im['bufferView']]
    o = bv.get('byteOffset', 0)
    return np.asarray(Image.open(io.BytesIO(bytes(bn[o:o + bv['byteLength']]))).convert('RGB')).astype(float), im


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 4:
        print(__doc__); return 1
    base_p, retex_p, ref_p, dst = args
    # 10-09: 0.60 → 0.63 — 겨울 목도리가 목 높이에 걸쳐 «목 위 = 원래 그림»에 덮여 잘렸다.
    #   턱 위만 통째로 원래 그림이고, 그 밑 목 띠는 아래 «맨살» 규칙(살색일 때만)을 따른다 ⇒ 목도리·깃은 옷으로 남는다.
    neck = float(next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--neck=')), 0.63))
    js, bn = read_glb(base_p)
    base, im = tex_of(js, bn)
    rj, rb = read_glb(retex_p); outfit, _ = tex_of(rj, rb)
    fj, fb = read_glb(ref_p); ref, _ = tex_of(fj, fb)
    # 10-09: 다이어트 뒤 hero2 그림은 1024 · Meshy retexture·원본 리그는 2048 ⇒ hero2 크기로 맞춰 합친다(UV 는 같다)
    def fit(a):
        if a.shape == base.shape:
            return a
        return np.asarray(Image.fromarray(a.round().astype(np.uint8)).resize(base.shape[1::-1], Image.LANCZOS)).astype(float)
    if not (base.shape == outfit.shape == ref.shape):
        print('■ 그림 크기 맞춤 — hero2 %s 에 옷 %s · 원본 %s 을 맞춘다' % (base.shape[:2], outfit.shape[:2], ref.shape[:2]))
        outfit, ref = fit(outfit), fit(ref)
    H = base.shape[0]
    hgt, _, _ = texel_height(js, bn, H)
    Lr = lum(ref); satr = ref.max(-1) - ref.min(-1)
    hair = (Lr < 130) & (ref[..., 0] > ref[..., 1] + 8) & (ref[..., 2] >= ref[..., 1] - 2)
    head = np.nan_to_num(hgt, nan=-1) > neck
    skin_ref = (Lr > 180) & (ref[..., 0] > ref[..., 2] + 25) & (satr < 70)
    # ⛔ 첫 판은 «옷 그림에서도 살색»을 «R>G>B 밝은 색»으로 갈랐다 ⇒ 크림 스웨터·노란 우비 소매까지 살로 보고
    #   원래 그림(맨팔)으로 덮었다(겨울 아래팔이 맨살로 나왔다).
    #   ⇒ 그 옷 그림 «안의 얼굴 살색»(원래 살 · 턱 위)과 색 거리가 가까운 것만 맨살로 본다.
    face_skin = skin_ref & head
    tone = np.median(outfit[face_skin], 0) if face_skin.sum() > 100 else np.array([252., 200., 175.])
    # ⛔ 둘째 판(색 거리 < 40)도 겨울 크림 스웨터 소매(거리 ≈33)를 살로 봤다 — 밝기가 비슷하면 거리가 작다.
    #   ⇒ 밝기를 빼고 «기운»(R−G, R−B)으로 견준다: 살 (46,75) 언저리 · 크림 옷 (15,40) · 노랑 (60,220).
    chroma = np.stack([outfit[..., 0] - outfit[..., 1], outfit[..., 0] - outfit[..., 2]], -1)
    tch = np.array([tone[0] - tone[1], tone[0] - tone[2]])
    skin_now = (lum(outfit) > 160) & (np.sqrt(((chroma - tch) ** 2).sum(-1)) < 22)
    print('■ 이 옷 그림의 얼굴 살색 %s (얼굴 텍셀 %d)' % (tone.round().astype(int).tolist(), face_skin.sum()))
    keep = head | hair | (skin_ref & skin_now)
    out = outfit.copy()
    out[keep] = base[keep]
    used = ~np.isnan(hgt)
    print('■ 텍셀 %d (쓰인 %d) · 지금 hero2 그림으로: 목 위 %d · 머리카락 %d · 맨살 %d · 옷 그림 %d'
          % (H * H, used.sum(), head.sum(), (hair & ~head).sum(), (skin_ref & skin_now & ~head & ~hair).sum(), (~keep).sum()))
    body = used & ~keep
    print('  옷 자리 색 중앙 %s (쓰인 텍셀 %d)' % (np.median(outfit[body], 0).round().astype(int).tolist(), body.sum()))
    tex_out = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--tex-out=')), None)
    if tex_out:
        os.makedirs(os.path.dirname(tex_out) or '.', exist_ok=True)
        Image.fromarray(out.round().astype(np.uint8)).save(tex_out, 'JPEG', quality=90)
        print('그림만: %s (%.2fMB)' % (tex_out, os.path.getsize(tex_out) / 1e6))
    fmt = {'image/jpeg': 'JPEG', 'image/png': 'PNG'}.get(im.get('mimeType'), 'WEBP')
    buf = io.BytesIO()
    Image.fromarray(out.round().astype(np.uint8)).save(buf, fmt, **({} if fmt == 'PNG' else {'quality': 92}))
    data = buf.getvalue()
    while len(bn) % 4:
        bn.append(0)
    off = len(bn); bn.extend(data)
    js['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
    im['bufferView'] = len(js['bufferViews']) - 1
    bn2 = compact(js, bn)
    write_glb(dst, js, bn2)
    print('썼다: %s (%.2fMB) · ⛔ 보기는 같은 자로 그려 볼 것' % (dst, os.path.getsize(dst) / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
