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
from scipy.ndimage import (binary_closing, binary_opening, binary_dilation,
                          binary_propagation, distance_transform_edt)

HERE = os.path.dirname(os.path.abspath(__file__))          # tools/char
ROOT = os.path.dirname(os.path.dirname(HERE))              # 저장소 루트
sys.path.insert(0, HERE)
from rescale_char_glb import load  # noqa: E402

# cp949 콘솔에서 '—' 한 글자에 죽는다 — 2026-08-24 에 열 개가 다 그랬다.
# 내 창에서만 PYTHONIOENCODING=utf-8 을 붙여 돌려 와서 한 번도 안 걸렸다.
# ★ 자가 내 창에서만 돌면 그건 자가 아니라 내 손버릇이다.
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


SRC = os.path.join(ROOT, "assets", "characters", "3d")
OUT = os.path.join(ROOT, "assets", "characters", "masks")

# 부위 코드 (R 채널). 간격 24 - 보간이 섞여도 최근접으로 복구 가능(허용오차 ±10).
CODE = {
    "none":  0,
    "hair":  24,    # 머리카락 + 눈썹
    "iris":  48,    # 홍채 + 동공 (색 변경 대상)
    "eye":   72,    # 흰자·하이라이트·속눈썹 (보호)
    "emblem": 96,   # 직업 상징물 (보호)
    "skin":  120,
    "top":   144,
    "bottom": 168,
    "shoe":  192,
}
VIS = {
    CODE["none"]: (30, 30, 30), CODE["hair"]: (220, 60, 60),
    CODE["iris"]: (0, 190, 255), CODE["eye"]: (255, 210, 0),
    CODE["emblem"]: (255, 130, 220), CODE["skin"]: (60, 200, 120),
    CODE["top"]: (80, 140, 230), CODE["bottom"]: (150, 80, 220),
    CODE["shoe"]: (240, 150, 60),
}

# 몸 높이 비율 구간 (발바닥 0 ~ 정수리 1)
BAND = {
    "shoe":  (0.000, 0.075),
    "leg":   (0.075, 0.460),
    "torso": (0.420, 0.760),
    "head":  (0.740, 1.000),
}
# 눈·눈썹이 있을 수 있는 높이. 실제 위치는 흰자로 찾으므로 넉넉해도 된다.
# 상한이 0.88 이면 눈썹(t 0.855~0.90)이 밴드 밖이라 눈 영역이 닿지 않는다.
EYE_BAND = (0.700, 0.940)

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
    # glTF UV 원점은 좌상단이고 v 는 아래로 증가한다. 이미지 행 = v * size 그대로다.
    # 1-v 로 뒤집으면 위치 정보가 통째로 어긋나 색과 위치가 맞지 않는다
    # (2026-07-25 실제로 그렇게 틀렸고, 색-위치 교차 검증으로 잡았다).
    px = np.clip(uv[:, 0] * size, 0, size - 1)
    py = np.clip(uv[:, 1] * size, 0, size - 1)
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


def chin_height(pos, lo_t=0.55, hi_t=0.88):
    """가로폭 프로파일에서 턱 높이(t)를 찾는다.

    목은 몸에서 가장 잘록한 곳이고, 턱은 거기서 위로 가며 폭이 확 넓어지는
    지점이다. 고정 밴드로 자르면 캐릭터마다 턱 밑이 남거나 옷깃까지 먹는다.
    """
    y = pos[:, 1]
    lo, hi = y.min(), y.max()
    t = (y - lo) / (hi - lo)
    edges = np.linspace(lo_t, hi_t, 45)
    w = []
    for i in range(len(edges) - 1):
        s = pos[(t >= edges[i]) & (t < edges[i + 1]), 0]
        w.append(np.percentile(s, 98) - np.percentile(s, 2) if len(s) > 40 else np.nan)
    w = np.array(w)
    if np.all(np.isnan(w)):
        return 0.72
    ni = int(np.nanargmin(w))                    # 목 = 가장 잘록한 곳
    neck_w = w[ni]
    for i in range(ni + 1, len(w)):              # 위로 가며 폭이 1.55배 되는 곳 = 턱
        if not np.isnan(w[i]) and w[i] > neck_w * 1.55:
            return float(edges[i])
    return float(edges[ni])


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

    # 피부: 색만으로 잡으면 베이지 앞치마·크림 티셔츠가 통째로 피부가 된다
    # (2026-07-25 남주부가 그랬다). 맨살이 나올 수 있는 자리로 제한한다 -
    # 머리·목, 바깥쪽(A포즈에서 팔·손), 다리. 몸통 한가운데는 옷이다.
    xr = pos[:, 0].max() - pos[:, 0].min()
    xn = np.abs(posmap[:, :, 0] - (pos[:, 0].min() + pos[:, 0].max()) / 2) / (xr / 2)
    # t>0.64 는 목까지 포함하기 위한 값(0.68 이면 목이 빠진다).
    # 신발(t<0.085)은 크림색이 피부 색조에 걸리므로 제외한다.
    # 목은 좁고 몸 한가운데 있다. t 하한만 낮추면 베이지 셔츠 등판까지 피부가
    # 되므로(남주부) 목 구간은 폭으로 제한한다.
    # 목·턱 밑은 폭을 넓게 열되 색 판정을 유지한다. 옷깃은 흰색·회색이라
    # 피부 색조에 안 걸리므로 안전하고, 턱선 바깥쪽 살구색 조각도 잡힌다.
    skin_zone = ((t > 0.72)                       # 머리(얼굴·귀)
                 | ((t > 0.62) & (xn < 0.34))     # 목 · 턱 밑
                 | (xn > 0.42)                    # 팔·손 (A포즈에서 바깥쪽)
                 | ((t < 0.40) & (t > 0.085)))    # 다리 (신발 제외)
    # 베이지 셔츠와 살구색 피부는 어떤 색공간으로도 갈리지 않는다. 측정 결과
    # 남주부의 셔츠는 그의 얼굴과 색도 거리 0.0247 로, 남연구원의 손(0.0374)보다
    # 얼굴에 더 가깝다. 그래서 색은 전역 기준으로 두고 위치로 처리한다.
    # 임계 44 는 음영진 피부와 볼터치를 놓쳐 얼굴에 얼룩이 남는다.
    is_skin = (d_skin < 58) & (warm_rg > 20) & covered & skin_zone

    code[band("shoe")] = CODE["shoe"]                       # 신발: 흰 티셔츠와 색이 같아 위치로만 갈림
    code[band("leg") & ~is_skin] = CODE["bottom"]
    code[band("torso") & ~is_skin] = CODE["top"]
    code[is_skin] = CODE["skin"]

    # --- 머리카락 ---
    # 긴 생머리는 등까지 내려와 머리 밴드 밖이라 높이로만 자르면 놓친다.
    # 반대로 검은 재킷·검은 바지는 진갈색과 명도가 겹친다. 따뜻한 색인지로 가른다
    # (진갈색 72,24,24 은 R-B=48, 검정 30,30,30 은 0).
    head = band("head")
    # 긴 생머리는 등 아래(t 0.3 근처)까지 내려온다. 하한을 낮추되, 그 아래에서는
    # 갈색 바지·신발과 섞이지 않게 '몸통보다 뒤에 있는 것'만 머리로 본다.
    zt = np.percentile(posmap[:, :, 2][covered], 45)
    dark_warm = covered & (d_hair < 68) & (warm_rb > 14)
    # 신발·발목(t<0.12)은 갈색이라도 머리가 아니다
    hairish = dark_warm & ((t > 0.46) | ((z < zt) & (t > 0.12)))
    # 경계 텍셀이 색 임계를 넘어 삐죽삐죽 남는 것을 메운다
    hairish = binary_closing(hairish, np.ones((5, 5))) & covered & (d_hair < 96)
    # 얼굴 앞면 아래쪽(눈보다 아래)에는 머리카락이 오지 않는다. 입술·콧구멍
    # 그늘이 진갈색이라 머리로 잡혀 머리색을 따라가던 것을 막는다.
    lower_face = covered & front & (xn < 0.28) & (t > 0.66) & (t < 0.775)
    hairish &= ~lower_face
    code[head & is_skin] = CODE["skin"]
    code[hairish] = CODE["hair"]

    # 눈: 높이 밴드로 잡으면 안 된다. 앞머리가 같은 높이에 같은 진갈색이라
    # 통째로 눈으로 분류된다(2026-07-25 실제로 그랬다).
    # 흰자를 기준점으로 삼는다 - 얼굴에서 아주 밝은 덩어리는 흰자뿐이고
    # 앞머리에는 흰자가 없다. 흰자를 찾아 그 주변만 눈으로 본다.
    # 흰자 후보는 반드시 얼굴 안이어야 한다. 범위를 넓게 잡으면 흰 가운·흰 셔츠가
    # 흰자로 검출돼 그 주변이 통째로 눈 영역이 되고, 볼·턱까지 보호돼 피부색이
    # 안 바뀐다(2026-07-25 여연구원·남연구원이 그랬다. 눈 라벨이 t 0.50 까지 퍼졌다).
    faceband = (covered & front & (t >= EYE_BAND[0]) & (t < EYE_BAND[1])
                & (xn < 0.30))
    sclera = faceband & (lum > 224)
    sclera = binary_opening(sclera, np.ones((3, 3)))          # 점 노이즈 제거
    if sclera.sum() < 200:                                    # 흰자를 못 찾으면 눈 처리 생략
        eye = np.zeros_like(sclera)
        iris = np.zeros_like(sclera)
    else:
        # 눈 주변을 원으로 넓히면 바로 위의 눈썹이 걸리고, 좁히면 눈매·속눈썹이
        # 빠져 머리색이 들어간다. 눈은 가로로 길고 눈썹은 바로 위에 있으므로
        # 가로로 넓고 세로로 납작한 타원으로 넓힌다.
        r_eye = max(8, int(round(np.sqrt(sclera.sum() / 2 / np.pi) * 1.20)))
        rv = max(6, int(round(r_eye * 1.00)))
        yy, xx = np.mgrid[-rv:rv + 1, -r_eye:r_eye + 1]
        near = (xx / r_eye) ** 2 + (yy / rv) ** 2 <= 1.0
        # 눈 주변을 UV 공간에서 팽창시키면 안 된다. 섬 경계를 넘어 엉뚱한 부위로
        # 건너뛰고(눈 라벨이 허리 높이에 나타났다), 반대로 눈썹이 별도 섬이면
        # 아무리 넓혀도 닿지 않는다. 텍셀마다 3D 좌표가 있으니 3D 거리로 잡는다.
        # 좌우 눈을 x 부호로 나누고, 각 눈 중심에서 일정 반경 안을 눈 영역으로 본다.
        sy_, sx_ = np.where(sclera)
        sp = posmap[sy_, sx_]                       # 흰자 텍셀의 3D 좌표
        cxm = (pos[:, 0].min() + pos[:, 0].max()) / 2
        eye_c = []
        for side in (sp[:, 0] < cxm, sp[:, 0] >= cxm):
            if side.sum() > 50:
                eye_c.append(sp[side].mean(axis=0))
        if not eye_c:
            eye_c = [sp.mean(axis=0)]
        # 구(球)로 잡으면 반경 하나로 가로·세로가 같이 커져 이마·앞머리까지
        # 닿는다(홍채 비율이 0.3% -> 3.7% 로 튀었다). 눈은 가로로 길고 세로로
        # 납작하므로 흰자의 실제 3D 범위에서 축별로 크기를 잡는다.
        # 세로는 눈 높이의 1.0배까지만 - 눈썹은 그보다 위에 있어 머리로 남는다.
        inside = np.zeros(posmap.shape[:2], bool)
        for c, side in zip(eye_c, (sp[:, 0] < cxm, sp[:, 0] >= cxm)):
            q = sp[side] if side.sum() > 50 else sp
            hw = max(np.percentile(np.abs(q[:, 0] - c[0]), 92), 1e-4) * 1.7
            # 세로 배율 2.6 은 측정값이다. 흰자 반높이를 1 로 보면 속눈썹은
            # 1.0~1.94 배 위, 눈썹은 3.98~6.31 배 위로 사이가 뚜렷이 벌어진다.
            # 좁으면 속눈썹이 머리색을 따라가고, 넓으면 눈썹까지 보호된다.
            hh = max(np.percentile(np.abs(q[:, 1] - c[1]), 92), 1e-4) * 2.6
            hd = max(np.percentile(np.abs(q[:, 2] - c[2]), 92), 1e-4) * 2.5
            inside |= ((np.abs(posmap[:, :, 0] - c[0]) < hw)
                       & (np.abs(posmap[:, :, 1] - c[1]) < hh)
                       & (np.abs(posmap[:, :, 2] - c[2]) < hd))
        region = inside & faceband
        # 눈 주변에서 피부가 아닌 것은 전부 눈 재료다(흰자·하이라이트·홍채·동공·
        # 속눈썹·눈매선). 색으로 고르면 중간톤인 눈꺼풀 주름이 빠져 머리로 간다.
        # 그중 흰자에 '이어진' 것만 눈으로 본다. 눈썹은 사이에 피부가 있어
        # 끊겨 있으므로 딸려오지 않고 머리색을 따라간다.
        # 눈 주변에서 피부가 아닌 것은 전부 눈으로 본다 - 눈썹까지 포함해서.
        #
        # 눈썹만 머리색을 따라가게 해봤지만(연결성 재구성) 눈썹과 눈매가 너무
        # 가까워서 그 경계가 눈매 위 가장자리와 눈꼬리를 침범한다. 이 체형은
        # 눈이 크고 눈썹이 바짝 붙어 있어 둘을 안정적으로 못 가른다.
        # 눈썹이 머리색을 안 따라가는 것보다 눈매에 색이 튀는 쪽이 나쁘다.
        eye = binary_closing(region & ~is_skin, np.ones((3, 3))) & region

        # 홍채: 눈 영역은 밝기가 둘로만 갈린다(흰자·하이라이트 / 진갈색). 진갈색
        # 덩어리에 홍채·동공과 속눈썹·눈매 테두리가 같이 있어 색으로는 못 가른다.
        # 모양으로 가른다 - 홍채는 둥근 덩어리, 속눈썹은 얇은 호(弧)라서
        # 원반 커널로 열림 연산을 하면 홍채만 살아남는다.
        dark_eye = eye & (lum < 150)
        r = max(4, int(round(r_eye * 0.42)))
        yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
        disk = (xx * xx + yy * yy) <= r * r
        iris = binary_opening(dark_eye, disk)
        iris = binary_closing(iris, np.ones((5, 5)))
    # 얼굴 피부는 색으로 잡으면 볼터치·옆턱 음영·입술이 계속 빠져 얼룩이 남는다.
    # 머리 영역에서 머리카락도 눈도 아니면 전부 피부다. 색 판정이 필요 없다.
    # 턱 아래와 목도 같은 규칙으로 채우되, 목은 좁으므로 폭으로 제한한다
    # (넓히면 셔츠 깃·등판까지 피부가 된다).
    # 색 판정 없이 채우는 건 머리 영역뿐이다. 그 아래(목·턱 밑)까지 색 없이
    # 채우면 옷깃을 먹는다 - 캐릭터마다 턱·어깨 높이가 달라 고정 밴드로는
    # 어느 쪽이든 틀린다. 목은 위의 is_skin(색 판정)에 맡긴다.
    face_fill = head & ~hairish & ~eye
    code[face_fill] = CODE["skin"]

    code[eye] = CODE["eye"]
    code[iris] = CODE["iris"]
    # 원피스·가운처럼 한 벌로 이어진 옷은 허리에서 갈리면 안 된다.
    # 상·하의 대표색이 거의 같으면 한 벌로 보고 상의로 합친다.
    # 임계가 관대하면 흰 가운과 다른 색 바지까지 합쳐진다.
    mt, mb = code == CODE["top"], code == CODE["bottom"]
    if mt.sum() > 2000 and mb.sum() > 2000:
        if np.linalg.norm(np.median(a[mt], axis=0) - np.median(a[mb], axis=0)) < 14:
            code[mb] = CODE["top"]

    # --- 직업 상징물: 옷 위에 있는데 옷 색에서 크게 벗어난 텍셀 ---
    # 벨트·밑단처럼 옷의 일부일 뿐인 것까지 잡히면 안 되므로 면적을 좁게 제한한다.
    for part in ("top", "bottom"):
        m = code == CODE[part]
        if m.sum() < 500:
            continue
        med = np.median(a[m], axis=0)
        dev = np.linalg.norm(a - med, axis=2)
        emb = m & (dev > 96)
        emb = binary_opening(emb, np.ones((5, 5)))
        emb = binary_closing(emb, np.ones((5, 5)))
        if emb.sum() < m.sum() * 0.12:        # 옷의 12% 넘게 잡히면 무늬가 아니라 옷 자체
            code[emb] = CODE["emblem"]

    # 여백 채우기: 아틀라스는 UV 섬이 수백 개고 섬 바깥에는 필터링용 패딩이
    # 깔려 있다. 삼각형 안쪽만 칠하면 렌더 시 텍스처 필터링이 라벨 없는 패딩을
    # 물어와 섬 경계마다 원래 색이 실선처럼 남는다(프랑켄슈타인 자국).
    # 라벨 없는 텍셀을 가장 가까운 라벨로 전부 메운다. 실제 표면이 아니므로
    # 분류 정확도에는 영향이 없고 이음매만 사라진다.
    labeled = code > 0
    if labeled.any():
        _, ind = distance_transform_edt(~labeled, return_indices=True)
        code_filled = code[ind[0], ind[1]]
    else:
        code_filled = code

    os.makedirs(OUT, exist_ok=True)
    m = np.zeros((S, S, 4), np.uint8)
    m[..., 0] = code_filled
    m[..., 3] = 255
    Image.fromarray(m, "RGBA").save(os.path.join(OUT, f"{char}_mask.png"))

    cov = covered.sum()
    inv = {v: k for k, v in CODE.items()}
    NAME = {"none": "미분류", "hair": "머리+눈썹", "iris": "홍채",
            "eye": "흰자·속눈썹(보호)", "emblem": "상징물(보호)", "skin": "피부",
            "top": "상의", "bottom": "하의", "shoe": "신발"}
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
