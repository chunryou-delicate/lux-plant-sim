#!/usr/bin/env python3
"""눈을 «얹는» 얼굴 데칼 메시를 만든다 — 머리 앞면을 조금 띄워 복사하고, 정면에서 본 좌표로 UV 를 준다. 크레딧 0.

⛔ 왜 있나 (2026-09-13 · 총괄) — 박사님 「눈 씌울 것도」
  맨몸 얼굴엔 눈이 없다(정본). 눈은 «갈아 끼우는» 것이라 텍스처에 굽지 않고, 얼굴 위에 얇은 면을 얹어
  눈 그림(알파 PNG)을 붙인다. 표정(감은 눈·놀란 눈…)은 그림만 바꾸면 된다.

무엇을 하나
  리깅된 몸의 «머리 앞면»(Head 뼈 무게 큰 정점 · z>0 · 눈 높이띠 · 앞을 보는 법선)을 뼈·무게째 복사해
  법선 방향으로 offset 만큼 띄우고, UV 를 «정면 직교 투영»(x→u, y→v)으로 다시 준다.
  재질은 주어진 눈 PNG(알파) · alphaMode BLEND. 뼈대(nodes·skin·ibm)는 몸 것을 그대로 베낀다.

쓰기
  python tools/char/glb_face_decal.py <몸_rigged.glb> <눈.png> <날.glb> [--y0=0.55] [--y1=0.82] [--offset=0.004]
    y0~y1  머리 높이 안에서 «눈 띠»의 비율(머리 밑 0 · 정수리 1)
⚠ 눈 PNG 는 «두 눈이 한 장에 좌우로» 들어 있고 배경이 투명해야 한다. 그림의 가로가 얼굴 띠 폭에 맞춰진다.
"""
import io
import json
import struct
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, __file__.rsplit("/", 1)[0] if "/" in __file__ else ".")
from glb_extract_part import read_glb, acc_np  # noqa: E402


def write_glb(js, binc, path):
    jb = json.dumps(js, separators=(",", ":")).encode()
    jb += b" " * ((4 - len(jb) % 4) % 4)
    bb = binc + b"\0" * ((4 - len(binc) % 4) % 4)
    out = struct.pack("<III", 0x46546C67, 2, 28 + len(jb) + len(bb))
    out += struct.pack("<II", len(jb), 0x4E4F534A) + jb + struct.pack("<II", len(bb), 0x004E4942) + bb
    open(path, "wb").write(out)


def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    o = {x.split("=")[0]: float(x.split("=")[1]) for x in sys.argv[1:] if x.startswith("--") and "=" in x}
    body, eyes_png, out = a[:3]
    y0r, y1r, off = o.get("--y0", 0.55), o.get("--y1", 0.82), o.get("--offset", 0.004)

    js, b = read_glb(body)
    p = js["meshes"][0]["primitives"][0]
    V = np.asarray(acc_np(js, b, p["attributes"]["POSITION"]), np.float32)
    N = np.asarray(acc_np(js, b, p["attributes"]["NORMAL"]), np.float32)
    J = np.asarray(acc_np(js, b, p["attributes"]["JOINTS_0"]))
    Wt = np.asarray(acc_np(js, b, p["attributes"]["WEIGHTS_0"]), np.float32)
    F = np.asarray(acc_np(js, b, p["indices"]), np.int64).reshape(-1, 3)
    sk = js["skins"][0]
    names = [js["nodes"][j]["name"] for j in sk["joints"]]
    head_i = names.index("Head")
    headw = (Wt * (J == head_i)).sum(1)
    H = headw > 0.5
    ylo, yhi = V[H, 1].min(), V[H, 1].max()
    y0, y1 = ylo + (yhi - ylo) * y0r, ylo + (yhi - ylo) * y1r
    sel = H & (V[:, 2] > 0) & (V[:, 1] >= y0) & (V[:, 1] <= y1) & (N[:, 2] > 0.15)
    keep = sel[F].all(1)
    Fe = F[keep]
    used = np.unique(Fe)
    remap = -np.ones(len(V), np.int64)
    remap[used] = np.arange(len(used))
    Fe = remap[Fe].astype(np.uint32)
    P = V[used] + N[used] * off
    Nn = N[used]
    x0, x1 = P[:, 0].min(), P[:, 0].max()
    yy0, yy1 = P[:, 1].min(), P[:, 1].max()
    UV = np.stack([(P[:, 0] - x0) / (x1 - x0), 1 - (P[:, 1] - yy0) / (yy1 - yy0)], 1).astype(np.float32)
    print(f"  얼굴 데칼 삼각형 {len(Fe):,} · 정점 {len(used):,} · 폭 {x1-x0:.3f} · 높이 {yy1-yy0:.3f}")

    binc = bytearray()
    bvs, accs = [], []

    def add(arr, target, ctype, typ, mm=False):
        raw = np.ascontiguousarray(arr).tobytes()
        while len(binc) % 4:
            binc.append(0)
        o_ = len(binc)
        binc.extend(raw)
        bvs.append({"buffer": 0, "byteOffset": o_, "byteLength": len(raw), "target": target})
        acc = {"bufferView": len(bvs) - 1, "componentType": ctype, "count": int(len(arr)), "type": typ}
        if mm:
            acc["min"] = [float(x) for x in arr.min(0)]
            acc["max"] = [float(x) for x in arr.max(0)]
        accs.append(acc)
        return len(accs) - 1

    jt = J[used]
    jdt = 5123 if jt.max() > 255 else 5121
    attrs = {
        "POSITION": add(P.astype(np.float32), 34962, 5126, "VEC3", True),
        "NORMAL": add(Nn.astype(np.float32), 34962, 5126, "VEC3"),
        "TEXCOORD_0": add(UV, 34962, 5126, "VEC2"),
        "JOINTS_0": add(jt.astype(np.uint16 if jdt == 5123 else np.uint8), 34962, jdt, "VEC4"),
        "WEIGHTS_0": add(Wt[used].astype(np.float32), 34962, 5126, "VEC4"),
    }
    idx = add(Fe.reshape(-1), 34963, 5125, "SCALAR")

    img = Image.open(eyes_png).convert("RGBA")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    raw = buf.getvalue()
    while len(binc) % 4:
        binc.append(0)
    o_ = len(binc)
    binc.extend(raw)
    bvs.append({"buffer": 0, "byteOffset": o_, "byteLength": len(raw)})
    img_bv = len(bvs) - 1

    ibm_acc = js["accessors"][sk["inverseBindMatrices"]]
    ibv = js["bufferViews"][ibm_acc["bufferView"]]
    st = ibv["byteOffset"] + ibm_acc.get("byteOffset", 0)
    raw_ibm = bytes(b[st: st + ibm_acc["count"] * 64])
    while len(binc) % 4:
        binc.append(0)
    o_ = len(binc)
    binc.extend(raw_ibm)
    bvs.append({"buffer": 0, "byteOffset": o_, "byteLength": len(raw_ibm)})
    accs.append({"bufferView": len(bvs) - 1, "componentType": 5126, "count": ibm_acc["count"], "type": "MAT4"})
    ibm_i = len(accs) - 1

    nodes = json.loads(json.dumps(js["nodes"]))
    mesh_node = next(i for i, n in enumerate(nodes) if "mesh" in n)
    nodes[mesh_node] = {"name": "face_decal", "mesh": 0, "skin": 0}
    skin = {"joints": sk["joints"], "inverseBindMatrices": ibm_i}
    if "skeleton" in sk:
        skin["skeleton"] = sk["skeleton"]
    out_js = {
        "asset": {"version": "2.0", "generator": "glb_face_decal"},
        "buffers": [{"byteLength": len(binc)}], "bufferViews": bvs, "accessors": accs,
        "images": [{"mimeType": "image/png", "bufferView": img_bv}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "textures": [{"source": 0, "sampler": 0}],
        "materials": [{"name": "eyes", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 1},
                       "alphaMode": "BLEND", "doubleSided": False}],
        "meshes": [{"primitives": [{"attributes": attrs, "indices": idx, "material": 0, "mode": 4}]}],
        "nodes": nodes, "skins": [skin], "scenes": js["scenes"], "scene": js.get("scene", 0),
    }
    write_glb(out_js, bytes(binc), out)
    print("✔", out)


if __name__ == "__main__":
    main()
