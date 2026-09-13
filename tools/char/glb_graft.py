#!/usr/bin/env python3
"""GLB 한 판의 «부분»(귀 따위)을 떼어 다른 판에 심는다 — 크레딧 0.

⛔ 왜 있나 (2026-09-13 · 총괄)
  v4 는 박사님이 고르신 몸(가슴도 딱 맞음)인데 «귀가 없다». v7 은 귀가 있는데 가슴이 커졌다.
  박사님: 「v4 에서 귀만 붙이는 게 더 빠를듯」 ⇒ 그래서 v7 의 귀를 떼어 v4 에 «겹쳐» 심는다.
  두 판은 같은 원화 몸이라 머리가 «같은 자리·같은 크기»(재서 확인: 키 1.899, 머리 y 0.303~0.949).

무엇을 하나
  src 에서 «머리 높이띠 안이고 |x| > xmin 인 정점을 하나라도 가진 삼각형» 전부를 떼어
  (뿌리까지 딸려 오게), dst 메시에 «새 프리미티브»로 붙인다. 이어 붙이지 않고 «겹쳐» 놓는다 —
  뿌리 열린 면은 머리 안에 숨는다. 색은 src 의 텍스처·재질을 같이 가져온다.

쓰기
  python tools/char/glb_graft.py <src.glb> <dst.glb> <out.glb> [--xmin=0.25] [--y0=0.66] [--y1=1.0]

⚠ 이 자가 «안» 하는 것
  · 머리 크기가 다른 두 판은 못 맞춘다(옮기기·배율 없음). 먼저 재서 같은지 봐라
  · 스킨(뼈)이 있는 판에는 안 쓴다. 리깅 «전» 판끼리만
"""
import json
import struct
import sys

import numpy as np


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    off, js, binc = 12, None, b""
    total = struct.unpack_from("<I", data, 8)[0]
    while off < total:
        clen, ctype = struct.unpack_from("<II", data, off)
        body = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(body.decode("utf-8"))
        elif ctype == 0x004E4942:
            binc = bytes(body)
        off += 8 + clen
    return js, binc


def acc_np(js, binc, idx):
    acc = js["accessors"][idx]
    bv = js["bufferViews"][acc["bufferView"]]
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    n = acc["count"]
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    dt = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}[acc["componentType"]]
    stride = bv.get("byteStride") or (np.dtype(dt).itemsize * ncomp)
    if stride == np.dtype(dt).itemsize * ncomp:
        a = np.frombuffer(binc, dtype=dt, count=n * ncomp, offset=base)
        return a.reshape(n, ncomp) if ncomp > 1 else a
    return np.array([np.frombuffer(binc, dt, ncomp, base + i * stride) for i in range(n)])


def write_glb(js, binc, path):
    jb = json.dumps(js, separators=(",", ":")).encode("utf-8")
    jb += b" " * ((4 - len(jb) % 4) % 4)
    bb = binc + b"\x00" * ((4 - len(binc) % 4) % 4)
    out = struct.pack("<III", 0x46546C67, 2, 28 + len(jb) + len(bb))
    out += struct.pack("<II", len(jb), 0x4E4F534A) + jb
    out += struct.pack("<II", len(bb), 0x004E4942) + bb
    with open(path, "wb") as f:
        f.write(out)


def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    o = {x.split("=")[0]: float(x.split("=")[1]) for x in sys.argv[1:] if x.startswith("--") and "=" in x}
    src, dst, out = a[0], a[1], a[2]
    xmin, y0r, y1r = o.get("--xmin", 0.25), o.get("--y0", 0.66), o.get("--y1", 1.0)

    sj, sb = read_glb(src)
    dj, db = read_glb(dst)
    sp = sj["meshes"][0]["primitives"][0]
    V = acc_np(sj, sb, sp["attributes"]["POSITION"]).astype(np.float32)
    N = acc_np(sj, sb, sp["attributes"]["NORMAL"]).astype(np.float32) if "NORMAL" in sp["attributes"] else None
    T = acc_np(sj, sb, sp["attributes"]["TEXCOORD_0"]).astype(np.float32) if "TEXCOORD_0" in sp["attributes"] else None
    F = acc_np(sj, sb, sp["indices"]).astype(np.int64).reshape(-1, 3)

    lo, hi = V[:, 1].min(), V[:, 1].max()
    h = hi - lo
    y0, y1 = lo + h * y0r, lo + h * y1r
    pick_v = (np.abs(V[:, 0]) > xmin) & (V[:, 1] >= y0) & (V[:, 1] <= y1)
    pick_f = pick_v[F].any(axis=1)
    Fe = F[pick_f]
    used = np.unique(Fe)
    remap = -np.ones(len(V), np.int64)
    remap[used] = np.arange(len(used))
    Fe = remap[Fe].astype(np.uint32)
    Ve = V[used]
    Ne = N[used] if N is not None else None
    Te = T[used] if T is not None else None
    print(f"  떼어 온 것: 삼각형 {len(Fe):,} · 정점 {len(used):,} · x {Ve[:,0].min():+.3f}~{Ve[:,0].max():+.3f}")

    binc = bytearray(db)

    def pad():
        while len(binc) % 4:
            binc.append(0)

    def add_bv(arr, target):
        raw = np.ascontiguousarray(arr).tobytes()
        pad()
        off = len(binc)
        binc.extend(raw)
        bv = {"buffer": 0, "byteOffset": off, "byteLength": len(raw)}
        if target:
            bv["target"] = target
        dj["bufferViews"].append(bv)
        return len(dj["bufferViews"]) - 1

    def add_acc(bv, count, ctype, typ, mn=None, mx=None):
        acc = {"bufferView": bv, "componentType": ctype, "count": int(count), "type": typ}
        if mn is not None:
            acc["min"] = [float(x) for x in mn]
            acc["max"] = [float(x) for x in mx]
        dj["accessors"].append(acc)
        return len(dj["accessors"]) - 1

    attrs = {"POSITION": add_acc(add_bv(Ve, 34962), len(Ve), 5126, "VEC3", Ve.min(0), Ve.max(0))}
    if Ne is not None:
        attrs["NORMAL"] = add_acc(add_bv(Ne, 34962), len(Ne), 5126, "VEC3")
    if Te is not None:
        attrs["TEXCOORD_0"] = add_acc(add_bv(Te, 34962), len(Te), 5126, "VEC2")
    idx = add_acc(add_bv(Fe.reshape(-1), 34963), Fe.size, 5125, "SCALAR")

    # src 의 재질·텍스처·이미지를 같이 가져온다 (색이 src 텍스처에 있다)
    mat_i = None
    if "material" in sp and sj.get("images"):
        sm = sj["materials"][sp["material"]]
        bt = sm.get("pbrMetallicRoughness", {}).get("baseColorTexture")
        if bt is not None:
            tex = sj["textures"][bt["index"]]
            img = sj["images"][tex["source"]]
            ibv = sj["bufferViews"][img["bufferView"]]
            raw = sb[ibv.get("byteOffset", 0): ibv.get("byteOffset", 0) + ibv["byteLength"]]
            pad()
            off = len(binc)
            binc.extend(raw)
            dj["bufferViews"].append({"buffer": 0, "byteOffset": off, "byteLength": len(raw)})
            dj.setdefault("images", []).append({"mimeType": img.get("mimeType", "image/png"),
                                                 "bufferView": len(dj["bufferViews"]) - 1})
            t = {"source": len(dj["images"]) - 1}
            if "sampler" in tex and dj.get("samplers"):
                t["sampler"] = min(tex["sampler"], len(dj["samplers"]) - 1)
            dj.setdefault("textures", []).append(t)
            nm = json.loads(json.dumps(sm))
            nm["name"] = "graft"
            nm["pbrMetallicRoughness"]["baseColorTexture"] = {"index": len(dj["textures"]) - 1}
            for k in ("normalTexture", "occlusionTexture", "emissiveTexture"):
                nm.pop(k, None)
            nm["pbrMetallicRoughness"].pop("metallicRoughnessTexture", None)
            dj.setdefault("materials", []).append(nm)
            mat_i = len(dj["materials"]) - 1

    prim = {"attributes": attrs, "indices": idx, "mode": 4}
    if mat_i is not None:
        prim["material"] = mat_i
    dj["meshes"][0]["primitives"].append(prim)
    dj["buffers"][0]["byteLength"] = len(binc)
    write_glb(dj, bytes(binc), out)
    print(f"✔ {out}  (프리미티브 {len(dj['meshes'][0]['primitives'])} · "
          f"재질 {'src 것 가져옴' if mat_i is not None else 'dst 것'})")


if __name__ == "__main__":
    main()
