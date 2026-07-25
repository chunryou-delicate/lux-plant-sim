#!/usr/bin/env python
"""
캐릭터 텍스처에서 부위 마스크를 만든다.

Meshy는 머리·눈·옷·피부를 하나의 아틀라스에 구워 단일 머티리얼로 내보낸다.
메시나 머티리얼이 나뉘어 있지 않으므로 '머리 머티리얼만 골라 색 바꾸기'는
불가능하다. 대신 같은 UV를 쓰는 마스크 텍스처를 만들어 텍셀 단위로 부위를
골라내면 같은 결과를 얻는다.

분류는 위치 우선, 색 보조다.
  색만으로는 못 가르는 것들이 있다 - 흰 신발과 흰 티셔츠, 검은 재킷과 검은
  스커트, 갈색 눈동자와 갈색 머리카락. 그래서 텍셀마다 3D 위치를 먼저 구하고
  몸의 어느 높이인지로 큰 덩어리를 나눈 뒤, 그 안에서 색으로 세분한다.

  3D 위치는 UV 공간에 삼각형을 그대로 래스터화해서 얻는다. 정점을 점으로
  뿌리고 최근접으로 채우면 UV 섬 경계를 넘어 번져서 신발이 티셔츠로,
  뒤통수가 눈으로 분류된다(2026-07-25 실제로 그렇게 틀렸다).

보호 영역
  눈과 직업 상징물(가운 로고·명찰·앞치마 무늬)은 색을 바꾸지 않는다.
  눈은 텍셀 몇 개 단위라 경계가 미세하고, 상징물은 직업 정체성이라 색이
  바뀌면 캐릭터 구분이 깨진다. 마스크에 코드를 넣어두되 뷰어가 건드리지 않는다.

눈썹은 머리카락에 포함한다. 머리색을 바꾸면 눈썹도 같이 바뀌는 게 자연스럽다.

출력
  {char}_mask.png   R 채널 부위 코드, G=B=0, A=255
  {char}_mask_vis.png  검수용 색 시각화 (--vis)

  알파를 데이터 채널로 쓰면 안 된다. 캔버스는 프리멀티플라이드 알파로 저장하므로
  A=0 텍셀은 RGB가 통째로 0으로 뭉개진다.

사용법
  python make_part_mask.py char_namja_jachwi [--vis]
  python make_part_mask.py --all
"""
import io
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_closing, binary_opening, binary_dilation

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from rescale_char_glb import load  # noqa: E402

SRC = os.path.join(ROOT, "assets", "characters", "3d")
OUT = os.path.join(ROOT, "assets", "characters", "masks")

# 부위 코드 (R 채널). 간격 32 - 보간이 섞여도 최근접으로 복구 가능.
CODE = {
    "none":  0,
    "hair":  32,    # 머리카락 + 눈썹
    "eye":   64,    # 보호 (색 안 바꿈)
    "emblem": 96,   # 보호 (직업 상징물)
    "skin":  128,
    "top":   160,
    "bottom": 192,
    "shoe":  224,
}
VIS = {
    CODE["none"]: (30, 30, 30), CODE["hair"]: (220, 60, 60),
    CODE["eye"]: (255, 210, 0), CODE["emblem"]: (255, 130, 220),
    CODE["skin"]: (60, 200, 120), CODE["top"]: (80, 140, 230),
    CODE["bottom"]: (150, 80, 220), CODE["shoe"]: (240, 150, 60),
}

# 몸 높이 비율 구간 (발바닥 0 ~ 정수리 1)
BAND = {
    "shoe":  (0.000, 0.075),
    "leg":   (0.075, 0.460),
    "torso": (0.420, 0.760),
    "head":  (0.740, 1.000),
}
EYE_BAND = (0.800, 0.895)      # 눈 높이
BROW_BAND = (0.870, 0.925)     # 눈썹 높이

SKIN = [(240, 192, 144), (240, 192, 168), (240, 216, 192), (240, 168, 144),
        (240, 216, 216), (216, 168, 120), (232, 180, 150)]
DARKHAIR = [(72, 24, 24), (48, 24, 24), (72, 48, 24), (96, 48, 24), (56, 32, 28)]


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
        else:
            raw = np.frombuffer(b, dtype=np.uint8, count=a["count"] * stride, offset=st)
            raw = raw.reshape(a["count"], stride)[:, : n * np.dtype(dt).itemsize]
            arr = raw.copy().view(dt).ravel()
        return arr.reshape(a["count"], n) if n > 1 else arr

    pos = acc(prim["attributes"]["POSITION"]).astype(np.float32)
    uv = acc(prim["attributes"]["TEXCOORD_0"]).astype(np.float32)
    idx = acc(prim["indices"]).astype(np.int64).reshape(-1, 3)
    im = j["images"][0]
    bv = j["bufferViews"][im["bufferView"]]
    o = bv.get("byteOffset", 0)
    tex = Image.open(io.BytesIO(b[o:o + bv["byteLength"]])).convert("RGB")
    return pos, uv, idx, tex


def rasterize_faces(uv, idx, size):
    """UV 공간에 삼각형을 그려 텍셀마다 '어느 삼각형인지'를 기록한다.

    정점 splat + 최근접 채우기와 달리 UV 섬 경계를 넘지 않는다.
    PIL 폴리곤 채우기(C 구현)를 쓰므로 20만 삼각형도 감당된다.
    """
    img = Image.new("I", (size, size), 0)
    d = ImageDraw.Draw(img)
    px = np.clip(uv[:, 0] * size, 0, size - 1)
    py = np.clip((1.0 - uv[:, 1]) * size, 0, size - 1)   # glTF UV는 위가 0
    for f in range(len(idx)):
        a, b, c = idx[f]
        d.polygon([(px[a], py[a]), (px[b], py[b]), (px[c], py[c])], fill=int(f) + 1)
    return np.asarray(img, dtype=np.int64)


def face_position_map(pos, idx, faceid, size):
    """텍셀 -> 그 삼각형의 3D 무게중심. 0(빈 텍셀)은 마지막에 팽창으로 메운다."""
    cent = pos[idx].mean(axis=1)                      # (F,3)
    cent = np.vstack([np.zeros(3, np.float32), cent])  # 인덱스 0 = 빈 텍셀
    covered = faceid > 0
    return cent[faceid], covered


def nearest_color(a, cols):
    d = np.full(a.shape[:2], 1e9, np.float32)
    for c in cols:
        d = np.minimum(d, np.linalg.norm(a - np.array(c, np.float32), axis=2))
    return d


def build(char, vis=False, size=None):
    path = os.path.join(SRC, f"{char}_base.glb")
    pos, uv, idx, tex = read_glb(path)
    S = size or tex.size[0]
    faceid = rasterize_faces(uv, idx, S)
    posmap, covered = face_position_map(pos, idx, faceid, S)

    y = posmap[:, :, 1]
    z = posmap[:, :, 2]
    lo, hi = pos[:, 1].min(), pos[:, 1].max()
    t = (y - lo) / (hi - lo)                     # 발바닥 0 ~ 정수리 1
    zc = (pos[:, 2].min() + pos[:, 2].max()) / 2
    front = z > zc                               # 몸 앞면

    a = np.asarray(tex.resize((S, S), Image.NEAREST)).astype(np.float32)
    d_skin = nearest_color(a, SKIN)
    d_hair = nearest_color(a, DARKHAIR)
    lum = a.mean(axis=2)
    # 클레이 팔레트는 명도가 겹쳐도 색상은 갈린다. 거리만 쓰면
    # 크림 티셔츠(240,240,216)가 피부(240,216,192)로, 검은 재킷이 진갈색
    # 머리로 잡힌다. 따뜻한 정도(R-G, R-B)로 한 번 더 거른다.
    warm_rg = a[:, :, 0] - a[:, :, 1]
    warm_rb = a[:, :, 0] - a[:, :, 2]

    code = np.zeros((S, S), np.uint8)

    # --- 위치로 큰 덩어리부터 ---
    band = lambda k: (t >= BAND[k][0]) & (t < BAND[k][1]) & covered
    is_skin = (d_skin < 44) & (warm_rg > 20) & covered   # 크림색 옷 제외

    code[band("shoe")] = CODE["shoe"]                       # 신발: 흰 티셔츠와 색이 같아 위치로만 갈림
    code[band("leg") & ~is_skin] = CODE["bottom"]
    code[band("torso") & ~is_skin] = CODE["top"]
    code[is_skin] = CODE["skin"]                            # 피부는 위치 무관

    # --- 머리카락 ---
    # 긴 생머리는 등까지 내려와 머리 밴드 밖이라 높이로만 자르면 놓친다.
    # 반대로 검은 재킷·검은 바지는 진갈색과 명도가 겹친다. 따뜻한 색인지로 가른다
    # (진갈색 72,24,24 은 R-B=48, 검정 30,30,30 은 0).
    head = band("head")
    hairish = covered & (d_hair < 64) & (warm_rb > 14) & (t > 0.46)
    code[head & is_skin] = CODE["skin"]
    code[hairish] = CODE["hair"]

    # 눈: 얼굴 앞면 + 눈 높이 + 주변보다 어둡거나 매우 밝은 곳(홍채/흰자)
    eyeband = covered & front & (t >= EYE_BAND[0]) & (t < EYE_BAND[1])
    browband = covered & front & (t >= BROW_BAND[0]) & (t < BROW_BAND[1])
    eye = eyeband & ((d_hair < 90) | (lum > 225)) & ~browband
    eye = binary_opening(eye, np.ones((3, 3)))
    eye = binary_closing(eye, np.ones((7, 7)))
    eye = binary_dilation(eye, np.ones((3, 3)))              # 속눈썹 테두리까지
    code[eye] = CODE["eye"]
    # 눈썹은 머리카락에 포함 - 머리색 바꾸면 같이 바뀌는 게 자연스럽다
    code[browband & (d_hair < 90)] = CODE["hair"]

    # --- 직업 상징물: 옷 위에 있는데 옷 색에서 크게 벗어난 텍셀 ---
    for part in ("top", "bottom"):
        m = code == CODE[part]
        if m.sum() < 500:
            continue
        med = np.median(a[m], axis=0)
        dev = np.linalg.norm(a - med, axis=2)
        emb = m & (dev > 78)
        emb = binary_opening(emb, np.ones((3, 3)))
        emb = binary_closing(emb, np.ones((5, 5)))
        if emb.sum() < m.sum() * 0.35:        # 옷 전체가 무늬로 잡히면 무시
            code[emb] = CODE["emblem"]

    os.makedirs(OUT, exist_ok=True)
    m = np.zeros((S, S, 4), np.uint8)
    m[..., 0] = code
    m[..., 3] = 255
    Image.fromarray(m, "RGBA").save(os.path.join(OUT, f"{char}_mask.png"))

    cov = covered.sum()
    inv = {v: k for k, v in CODE.items()}
    NAME = {"none": "미분류", "hair": "머리+눈썹", "eye": "눈(보호)",
            "emblem": "상징물(보호)", "skin": "피부", "top": "상의",
            "bottom": "하의", "shoe": "신발"}
    # 아틀라스 여백(UV 미사용)은 빼고 실제 표면 기준으로만 센다
    print("  %-22s UV 실사용 %.1f%%" % (char, cov / (S * S) * 100))
    for v in sorted(set(code[covered].ravel().tolist())):
        n = int(((code == v) & covered).sum())
        print("     %-13s %6.2f%%" % (NAME[inv[v]], n / max(cov, 1) * 100))

    if vis:
        v = np.zeros((S, S, 3), np.uint8)
        for c, col in VIS.items():
            v[code == c] = col
        v[~covered] = (255, 255, 255)
        Image.fromarray(v).save(os.path.join(OUT, f"{char}_mask_vis.png"))
    return 0


CHARS = ["char_namja_jachwi", "char_namja_gajang", "char_namja_jubu",
         "char_namja_researcher", "char_jachwi_f", "char_yeoja_gajang",
         "char_yeoja_jubu", "char_yeoja_researcher"]

if __name__ == "__main__":
    vis = "--vis" in sys.argv
    if "--all" in sys.argv:
        for c in CHARS:
            build(c, vis)
        sys.exit(0)
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sys.exit(build(args[0] if args else CHARS[0], vis))
