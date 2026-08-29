# -*- coding: utf-8 -*-
"""GLB 의 **실루엣**을 그린다 — 텍스처를 안 보고 «형상»만 본다.

2026-08-30 · [Char]

■ 왜 필요한가

「옷을 갈아입힌다」에 길이 둘이다.

    ㉮ retexture (10cr/벌)   텍스처를 다시 굽는다  ⇒ ★ «색·무늬»가 바뀐다
    ㉰ 옷 메시를 붙인다       ⇒ «부피»가 생긴다

⇒ ★★ ㉮ 는 **메시를 안 건드린다.** 그러므로 **실루엣이 «절대» 안 바뀐다.**
  치마를 아무리 잘 그려도 **다리 두 개가 그대로 보인다.**

⇒ 그걸 말로 하면 안 와닿는다. **그려서 보인다.** 이 자가 그 그림을 만든다.

■ ★ 이 자가 «못» 하는 것

    · 재질·그림자·조명을 안 본다. **형상만** 본다
    · 정투영이다. 게임 카메라는 원근이라 **모양이 조금 다르다**
      ⇒ ⛔ 「게임에서 이렇게 보인다」로 쓰지 말 것. **「무엇이 안 바뀌나」를 보이는 그림**이다
    · 점을 찍어 채우므로 **아주 얇은 부분(손가락)은 성길 수** 있다

■ 쓰는 법

    python tools/char/silhouette.py <a.glb> [b.glb ...] [--out 그림.png]
"""
import os
import sys
import json
import struct

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CTYPE = {5126: ('f', 4), 5123: ('H', 2), 5121: ('B', 1), 5125: ('I', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read_glb(path):
    with open(path, 'rb') as f:
        d = f.read()
    if d[:4] != b'glTF':
        raise SystemExit('GLB 가 아니다: %s' % path)
    off, js, bin_ = 12, None, b''
    while off < len(d):
        ln, ty = struct.unpack_from('<II', d, off)
        chunk = d[off + 8: off + 8 + ln]
        if ty == 0x4E4F534A:
            js = json.loads(chunk.decode('utf-8'))
        elif ty == 0x004E4942:
            bin_ = chunk
        off += 8 + ln + ((4 - ln % 4) % 4 if ln % 4 else 0)
    return js, bin_


def accessor(js, bin_, i):
    a = js['accessors'][i]
    bv = js['bufferViews'][a['bufferView']]
    n = NCOMP[a['type']]
    fmt, sz = CTYPE[a['componentType']]
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride') or n * sz
    out = np.empty((a['count'], n), dtype=np.float32)
    for k in range(a['count']):
        out[k] = struct.unpack_from('<' + fmt * n, bin_, base + k * stride)
    return out


def positions(path):
    """모든 프리미티브의 정점을 모은다.

    ⚠ 노드 변환을 **안 곱한다.** 스킨드 메시는 명세상 노드 변환을 무시하므로
      바인드 포즈 좌표가 곧 서 있는 모양이다 — 여기서 보려는 것이 그것이다.
      ⇒ ★ 다만 «리깅 안 된» GLB 에 노드 스케일이 걸려 있으면 크기가 어긋난다.
        그래서 아래에서 **각자 자기 높이로 정규화**한다. 크기가 아니라 «모양»을 본다."""
    js, bin_ = read_glb(path)
    pts = []
    for m in js.get('meshes', []):
        for pr in m.get('primitives', []):
            if 'POSITION' in pr.get('attributes', {}):
                pts.append(accessor(js, bin_, pr['attributes']['POSITION']))
    if not pts:
        raise SystemExit('정점이 없다: %s' % path)
    return np.concatenate(pts, axis=0)


def silhouette(pts, W=340, H=560, pad=0.06):
    """정면(X-Y)으로 눌러 실루엣을 만든다. 각자 자기 크기로 맞춘다."""
    x, y = pts[:, 0].astype(np.float64), pts[:, 1].astype(np.float64)
    x0, x1, y0, y1 = x.min(), x.max(), y.min(), y.max()
    sy = (H * (1 - 2 * pad)) / max(y1 - y0, 1e-9)
    sx = sy                                   # ★ 가로세로 비율을 지킨다
    cx = (x0 + x1) / 2
    px = ((x - cx) * sx + W / 2).astype(np.int32)
    py = (H - pad * H - (y - y0) * sy).astype(np.int32)
    ok = (px >= 0) & (px < W) & (py >= 0) & (py < H)
    img = np.zeros((H, W), np.uint8)
    img[py[ok], px[ok]] = 255
    # 점이 성기므로 «부풀렸다 줄인다»(닫기). 구멍은 메우되 «바깥 모양»은 지킨다.
    # ⚠ 처음에 5/3 으로 했더니 속이 «벌레 먹은» 채였다 — 정점이 1.5만 개뿐이라 성기다.
    #   ⇒ 부풀리는 만큼 줄여야 바깥선이 안 굵어진다. 9/9 로 맞춘다.
    im = Image.fromarray(img).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    # 그래도 남는 잔구멍은 한 번 더 닫는다
    im = im.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    return im


def main():
    """⚠ 인자 걸러내기를 한 번 틀렸다 — `--out` «뒤의 값»까지 파일로 봤다.
       ⇒ 다행히 «죽었다». 조용히 지나갔으면 엉뚱한 그림을 그렸을 것이다."""
    argv = sys.argv[1:]
    out = 'silhouette.png'
    if '--out' in argv:
        i = argv.index('--out')
        if i + 1 >= len(argv):
            raise SystemExit('--out 뒤에 파일 이름을 주십시오')
        out = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]          # ★ 값까지 걷어낸다
    args = [a for a in argv if not a.startswith('--')]
    if not args:
        print(__doc__)
        return 1

    tiles, names = [], []
    for p in args:
        pts = positions(p if os.path.isabs(p) else os.path.join(ROOT, p))
        tiles.append(silhouette(pts))
        names.append(os.path.basename(p))
        print('  %-44s 정점 %d' % (names[-1], len(pts)))

    W, H = tiles[0].size
    gap = 24
    canvas = Image.new('RGB', (len(tiles) * W + (len(tiles) + 1) * gap, H + 2 * gap), (18, 15, 26))
    for i, t in enumerate(tiles):
        rgb = Image.merge('RGB', (t, t, t))
        canvas.paste(rgb, (gap + i * (W + gap), gap))
    canvas.save(out)
    print()
    print('썼다: %s' % out)
    print('⛔ 이건 «형상»만이다. 텍스처를 다시 구워도(retexture) 이 모양은 «안 바뀐다».')
    print('   ⇒ 치마를 그려 넣어도 «다리 두 개»가 그대로 보인다는 것이 이 그림의 뜻이다.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
