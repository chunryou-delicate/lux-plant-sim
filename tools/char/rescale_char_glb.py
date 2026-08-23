#!/usr/bin/env python
"""
캐릭터 GLB를 실스케일(1 유닛 = 1 미터)로 맞추고 발바닥을 y=0에 정렬한다.

Meshy는 모든 모델을 같은 높이로 정규화해 내보내므로 남녀 구분이 없고,
집·가구 데이터(문 2.0m, 옷장 1.9m, 스툴 0.355m)와 대조하면 190cm로 너무 크다.
  여캐 -> 1.40m,  남캐 -> 1.50m,  마스코트 -> 0.375m (고정)
  (실사람 키보다 작게 잡는다 - 머리가 큰 치비라 실키로 두면 방이 좁아 보인다)

방식
  정점을 건드리지 않고 씬 최상단에 래퍼 노드('__scale_root')를 끼워
  scale/translation 을 얹는다.
    - 스킨드 메시: 관절 노드가 래퍼 아래로 들어가므로 스키닝 결과가 함께
      스케일된다. 클립은 관절의 '로컬' 변환을 구동하므로 수정할 필요가 없다.
    - 정적 메시: 기존 노드 변환 위에 얹히므로 이중 적용이 없다.
  래퍼가 이미 있으면 값을 덮어쓴다(여러 번 돌려도 안전).

높이 측정
  스킨드 메시는 glTF 규약상 메시 노드의 변환이 무시되고 바인드 포즈에서
  skinMatrix = boneWorld x invBind = I 이므로, 렌더 높이는 POSITION 원본
  범위와 같다. 정적 메시는 노드 변환을 누적해 월드 범위를 구한다.

사용법
  python rescale_char_glb.py <디렉터리> [--dry]
"""
import json
import struct
import sys
import os
import glob

# cp949 콘솔에서 '—' 한 글자에 죽는다 — 2026-08-24 에 열 개가 다 그랬다.
# 내 창에서만 PYTHONIOENCODING=utf-8 을 붙여 돌려 와서 한 번도 안 걸렸다.
# ★ 자가 내 창에서만 돌면 그건 자가 아니라 내 손버릇이다.
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


GLB = 0x46546C67
CJ = 0x4E4F534A
CB = 0x004E4942
WRAP = "__scale_root"

FEMALE_H = 1.40
MALE_H = 1.50
# 마스코트는 캐릭터 키에 연동하지 않고 고정한다. 0.375 로 확정된 크기라
# 캐릭터를 줄여도 그대로 둔다(2026-07-26).
MASCOT_H = 0.375
FEMALE_KEYS = ("jachwi_f", "yeoja")


def load(path):
    d = open(path, "rb").read()
    _, _, ln = struct.unpack("<III", d[:12])
    off, j, b = 12, None, b""
    while off < ln:
        cl, ct = struct.unpack("<II", d[off:off + 8])
        c = d[off + 8: off + 8 + cl]
        if ct == CJ:
            j = json.loads(c.decode("utf-8"))
        elif ct == CB:
            b = c
        off += 8 + cl + ((4 - cl % 4) % 4)
    return j, b


def save(path, j, b):
    js = json.dumps(j, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    bn = b + b"\x00" * ((4 - len(b) % 4) % 4)
    total = 12 + 8 + len(js) + (8 + len(bn) if bn else 0)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", GLB, 2, total))
        f.write(struct.pack("<II", len(js), CJ))
        f.write(js)
        if bn:
            f.write(struct.pack("<II", len(bn), CB))
            f.write(bn)


def mat_of(node):
    """노드의 TRS/matrix를 4x4 리스트(행 우선)로."""
    if "matrix" in node:
        m = node["matrix"]           # glTF는 열 우선
        return [[m[0], m[4], m[8], m[12]],
                [m[1], m[5], m[9], m[13]],
                [m[2], m[6], m[10], m[14]],
                [m[3], m[7], m[11], m[15]]]
    t = node.get("translation", [0, 0, 0])
    r = node.get("rotation", [0, 0, 0, 1])
    s = node.get("scale", [1, 1, 1])
    x, y, z, w = r
    rot = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
           [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
           [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[rot[i][0] * s[0], rot[i][1] * s[1], rot[i][2] * s[2], t[i]] for i in range(3)] + \
           [[0, 0, 0, 1]]


def mul(a, b):
    return [[sum(a[i][k] * b[k][jj] for k in range(4)) for jj in range(4)] for i in range(4)]


def apply(m, v):
    return tuple(m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2] + m[i][3] for i in range(3))


def prim_positions(j, b, mesh_idx):
    for p in j["meshes"][mesh_idx]["primitives"]:
        ai = p["attributes"].get("POSITION")
        if ai is None:
            continue
        a = j["accessors"][ai]
        bv = j["bufferViews"][a["bufferView"]]
        st = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = bv.get("byteStride") or 12
        for k in range(a["count"]):
            yield struct.unpack_from("<fff", b, st + k * stride)


def world_bounds(j, b):
    """렌더 기준 범위.

    정적 메시는 조상 노드 변환을 그대로 누적한다.
    스킨드 메시는 렌더 위치가 jointWorld x invBind x v 이고, 원본 파일의
    조상 변환(Armature 스케일 등)은 이미 invBind에 baked 되어 바인드 포즈에서
    상쇄된다. 따라서 원본 변환은 무시하고, 나중에 얹은 래퍼 노드의 변환만
    적용해야 실제 렌더 크기가 나온다.
    """
    lo = [1e30] * 3
    hi = [-1e30] * 3
    ident = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]

    def visit(ni, m, mw):
        n = j["nodes"][ni]
        local = mat_of(n)
        wm = mul(m, local)
        wmw = mul(mw, local) if n.get("name") == WRAP else mw
        if "mesh" in n:
            use = wmw if "skin" in n else wm
            for v in prim_positions(j, b, n["mesh"]):
                p = apply(use, v)
                for i in range(3):
                    lo[i] = min(lo[i], p[i])
                    hi[i] = max(hi[i], p[i])
        for c in n.get("children", []):
            visit(c, wm, wmw)

    for r in j["scenes"][j.get("scene", 0)]["nodes"]:
        visit(r, ident, ident)
    return lo, hi


def rescale(path, target_h):
    j, b = load(path)
    scene = j["scenes"][j.get("scene", 0)]

    # 기존 래퍼가 있으면 벗겨내고 원래 상태에서 다시 계산(재실행 안전)
    roots = scene["nodes"]
    if len(roots) == 1 and j["nodes"][roots[0]].get("name") == WRAP:
        w = j["nodes"][roots[0]]
        scene["nodes"] = list(w.get("children", []))
        w["scale"] = [1, 1, 1]
        w["translation"] = [0, 0, 0]

    lo, hi = world_bounds(j, b)
    h = hi[1] - lo[1]
    if h <= 0:
        return None
    s = target_h / h
    tx = -(lo[0] + hi[0]) / 2 * s
    ty = -lo[1] * s
    tz = -(lo[2] + hi[2]) / 2 * s

    # 래퍼 노드 재사용 또는 신규 생성
    wrap_idx = next((i for i, n in enumerate(j["nodes"]) if n.get("name") == WRAP), None)
    if wrap_idx is None:
        j["nodes"].append({"name": WRAP, "children": list(scene["nodes"])})
        wrap_idx = len(j["nodes"]) - 1
    else:
        j["nodes"][wrap_idx]["children"] = list(scene["nodes"])
    j["nodes"][wrap_idx]["scale"] = [s, s, s]
    j["nodes"][wrap_idx]["translation"] = [tx, ty, tz]
    scene["nodes"] = [wrap_idx]

    save(path, j, b)
    return h, target_h, s


def target_for(name):
    if "mascot" in name:
        return MASCOT_H
    if any(k in name for k in FEMALE_KEYS):
        return FEMALE_H
    return MALE_H


def main():
    d = sys.argv[1] if len(sys.argv) > 1 else "."
    dry = "--dry" in sys.argv
    print(f"  {'파일':40s} {'전':>7s} -> {'후':>6s}  scale")
    done = 0
    for f in sorted(glob.glob(os.path.join(d, "char_*.glb"))):
        name = os.path.basename(f)
        t = target_for(name)
        if dry:
            j, b = load(f)
            lo, hi = world_bounds(j, b)
            print(f"  {name:40s} {hi[1]-lo[1]:7.3f} -> {t:6.3f}")
            continue
        r = rescale(f, t)
        if r:
            print(f"  {name:40s} {r[0]:7.3f} -> {r[1]:6.3f}  x{r[2]:.4f}")
            done += 1
    if not dry:
        print(f"\n{done}개 처리. 클립(anim/)은 래퍼 스케일을 상속하므로 수정 불필요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
