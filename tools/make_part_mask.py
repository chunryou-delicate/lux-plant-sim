#!/usr/bin/env python
"""
캐릭터 텍스처에서 부위 마스크를 만든다 (머리카락 / 눈·눈썹 / 피부 / 상의 / 하의).

Meshy는 머리·눈·옷·피부를 하나의 아틀라스에 구워 단일 머티리얼로 내보낸다.
메시나 머티리얼이 나뉘어 있지 않으므로 '머리 머티리얼만 골라 색 바꾸기'는
불가능하다. 대신 같은 UV를 쓰는 마스크 텍스처를 만들어 셰이더에서
텍셀 단위로 부위를 골라내면 같은 결과를 얻는다.

분류 방법
  1) 색  - 저폴리 클레이 팔레트라 색 덩어리가 뚜렷하다. 기준색과의 거리로 1차 분류.
  2) 위치 - 머리카락과 눈·눈썹은 같은 진갈색이라 색만으로는 못 가른다.
           정점의 UV와 3D 좌표를 UV 공간에 뿌리고 채워서 텍셀마다 3D 위치를 얻은 뒤,
           머리 높이 + 얼굴 앞면인지로 눈·눈썹을 갈라낸다.

출력
  {char}_mask.png  R 채널에 부위 코드, G=B=0, A=255 인 인덱스 맵.

  코드  0 기타 / 40 머리카락 / 80 눈·눈썹 / 120 피부 / 160 상의 / 200 하의

  알파를 데이터 채널로 쓰면 안 된다. 캔버스는 픽셀을 프리멀티플라이드 알파로
  저장하므로 A=0 인 텍셀은 RGB가 통째로 0 으로 뭉개진다. 부위를 RGBA 채널에
  나눠 담으면 읽어올 때 A 채널 부위만 살아남는다. 그래서 A 는 항상 255 로 두고
  R 하나에 코드를 넣는다. 코드 간격을 40 으로 벌려 확대·축소 시 보간이 섞여도
  가장 가까운 코드로 복구된다(뷰어는 최근접 보간을 쓴다).

사용법
  python make_part_mask.py char_namja_jachwi [--preview]
"""
import io
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, binary_closing, binary_opening

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from rescale_char_glb import load  # noqa: E402

SRC = os.path.join(ROOT, "assets", "characters", "3d")
OUT = os.path.join(ROOT, "assets", "characters", "masks")

# 기준색 (저폴리 클레이 팔레트에서 관측된 대표값)
# 부위 코드 (R 채널). 간격 40 — 보간이 섞여도 최근접으로 복구 가능.
CODE = {"none": 0, "hair": 40, "eyes": 80, "skin": 120, "top": 160, "bottom": 200}

REF = {
    "hair":  [(72, 24, 24), (48, 24, 24), (72, 48, 24), (96, 48, 24)],
    "skin":  [(240, 192, 144), (240, 192, 168), (240, 216, 192),
              (240, 168, 144), (240, 216, 216), (216, 168, 120)],
    "top":   [(240, 240, 216), (240, 240, 240), (216, 216, 192)],
    "bottom": [(72, 96, 144), (48, 96, 144), (96, 120, 168)],
    "dark":  [(48, 48, 48), (24, 24, 24)],          # 신발·소품 등
}


def read_glb(path):
    j, b = load(path)
    prim = j["meshes"][0]["primitives"][0]

    def acc(i):
        a = j["accessors"][i]
        bv = j["bufferViews"][a["bufferView"]]
        st = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        n = {"VEC2": 2, "VEC3": 3, "SCALAR": 1}[a["type"]]
        dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a["componentType"]]
        stride = bv.get("byteStride") or n * np.dtype(dt).itemsize
        if stride == n * np.dtype(dt).itemsize:
            arr = np.frombuffer(b, dtype=dt, count=a["count"] * n, offset=st)
        else:  # 인터리브
            raw = np.frombuffer(b, dtype=np.uint8, count=a["count"] * stride, offset=st)
            raw = raw.reshape(a["count"], stride)[:, : n * np.dtype(dt).itemsize]
            arr = raw.copy().view(dt).ravel()
        return arr.reshape(a["count"], n) if n > 1 else arr

    pos = acc(prim["attributes"]["POSITION"]).astype(np.float32)
    uv = acc(prim["attributes"]["TEXCOORD_0"]).astype(np.float32)
    img_i = j["images"][0]
    bv = j["bufferViews"][img_i["bufferView"]]
    o = bv.get("byteOffset", 0)
    tex = Image.open(io.BytesIO(b[o:o + bv["byteLength"]])).convert("RGB")
    return pos, uv, tex


def position_map(pos, uv, size):
    """UV 공간에 정점의 3D 좌표를 뿌리고 빈 곳을 최근접으로 채운다."""
    px = np.clip((uv[:, 0] * size).astype(int), 0, size - 1)
    py = np.clip(((1.0 - uv[:, 1]) * size).astype(int), 0, size - 1)   # glTF UV는 위가 0
    acc = np.zeros((size, size, 3), np.float64)
    cnt = np.zeros((size, size), np.int32)
    np.add.at(acc, (py, px), pos)
    np.add.at(cnt, (py, px), 1)
    filled = cnt > 0
    acc[filled] /= cnt[filled][:, None]
    # 빈 텍셀은 가장 가까운 채워진 텍셀 값으로
    _, idx = distance_transform_edt(~filled, return_indices=True)
    return acc[idx[0], idx[1]], filled


def classify(tex, posmap, size):
    a = np.asarray(tex.resize((size, size), Image.NEAREST)).astype(np.float32)
    lab = np.full((size, size), -1, np.int8)
    best = np.full((size, size), 1e9, np.float32)
    for k, (name, cols) in enumerate(REF.items()):
        d = np.full((size, size), 1e9, np.float32)
        for c in cols:
            d = np.minimum(d, np.linalg.norm(a - np.array(c, np.float32), axis=2))
        hit = d < best
        best[hit] = d[hit]
        lab[hit] = k
    names = list(REF.keys())
    hair_i = names.index("hair")

    # 머리카락 vs 눈·눈썹: 같은 진갈색이라 3D 위치로 가른다.
    y = posmap[:, :, 1]
    z = posmap[:, :, 2]
    top = y.max()
    bottom = y.min()
    h = top - bottom
    head = y > bottom + h * 0.80          # 머리 영역
    front = z > np.percentile(z[head], 62) if head.any() else np.zeros_like(head, bool)
    eyes = (lab == hair_i) & head & front  # 얼굴 앞면의 진갈색 = 눈·눈썹
    eyes = binary_opening(eyes, np.ones((3, 3)))
    eyes = binary_closing(eyes, np.ones((5, 5)))
    return lab, names, eyes


def build(char, preview=False):
    path = os.path.join(SRC, f"{char}_base.glb")
    pos, uv, tex = read_glb(path)
    size = tex.size[0]
    posmap, filled = position_map(pos, uv, size)
    lab, names, eyes = classify(tex, posmap, size)

    hair = (lab == names.index("hair")) & ~eyes
    skin = lab == names.index("skin")
    top = lab == names.index("top")
    bot = lab == names.index("bottom")

    os.makedirs(OUT, exist_ok=True)
    code = np.zeros((size, size), np.uint8)
    for c, mk in ((CODE["hair"], hair), (CODE["eyes"], eyes), (CODE["skin"], skin),
                  (CODE["top"], top), (CODE["bottom"], bot)):
        code[mk] = c
    m = np.zeros((size, size, 4), np.uint8)
    m[..., 0] = code
    m[..., 3] = 255            # A 는 데이터가 아니다 - 항상 불투명
    Image.fromarray(m, "RGBA").save(os.path.join(OUT, f"{char}_mask.png"))

    tot = size * size
    stats = [("머리카락", hair), ("눈·눈썹", eyes), ("피부", skin),
             ("상의", top), ("하의", bot)]
    print("  %-22s %s" % (char, tex.size))
    for n, mk in stats:
        print("     %-8s %6.2f%%  (%s 텍셀)" % (n, mk.sum() / tot * 100, f"{int(mk.sum()):,}"))
    unl = (lab < 0).sum() / tot * 100
    print("     %-8s %6.2f%%" % ("미분류", unl))

    if preview:
        base = np.asarray(tex).astype(np.float32)
        for name, col in [("blonde", (222, 184, 108)), ("black", (38, 34, 40)),
                          ("ash", (150, 146, 158))]:
            out = base.copy()
            tgt = np.array(col, np.float32)
            # 명도는 원본 유지하고 색조만 갈아끼운다 (음영이 살아있게)
            lum = base[hair].mean(axis=1, keepdims=True)
            ref = base[hair].mean()
            out[hair] = np.clip(tgt * (lum / max(ref, 1e-3)), 0, 255)
            Image.fromarray(out.astype(np.uint8)).save(
                os.path.join(OUT, f"{char}_hair_{name}.png"))
        print("     미리보기 3종 저장: blonde / black / ash")
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sys.exit(build(args[0] if args else "char_namja_jachwi",
                   "--preview" in sys.argv))
