#!/usr/bin/env python3
"""«몸째 구운» GLB 에서 머리카락·옷 같은 «덧씌운 부분»만 떼어낸다 — 크레딧 0.

⛔ 왜 있나 (2026-09-13 · 총괄)
  머리카락·옷을 «따로» 구우면 이 머리·이 몸에 안 맞는다. 그래서 «몸에 씌운 채로» 굽고(참조 시트에
  image_to_image 로 얹어) 몸을 «빼서» 남긴다. 그러면 이 몸에 «딱» 맞는다.

무엇으로 가르나 — 둘을 «겹친다» (하나만 쓰면 속는다)
  ① 색   구운 텍스처를 UV 로 찍어 정점 색을 얻는다. 살색과 «멀면» 덧씌운 것
  ② 거리 v19 몸(리깅 전) 표면에서 «먼» 정점은 덧씌운 것 (앞머리·옷은 몸에서 조금 떠 있다)
  ⇒ 삼각형은 세 꼭짓점이 «모두» 통과해야 남긴다(경계가 지저분해지지 않게)

맞춤
  구운 판의 «살색 정점» 상자를 v19 몸 상자에 맞춘다(배율·이동). 머리카락이 키를 늘려도 살색 상자는 몸이다.

쓰기
  python tools/char/glb_extract_part.py <구운.glb> <몸v19.glb> <날.glb> [--skin=230,200,180] [--ctol=55] [--dmin=0.012] [--mode=color|dist|both|dark|notcolors|near] [--target=R,G,B] [--dark=120] [--align=skin|span|icp]
    --skin   살색(RGB). 구운 텍스처의 살색을 먼저 «재서» 넣어라
    --ctol   이보다 살색에서 멀면 «덧씌운 것»
    --dmin   몸 표면에서 이보다 멀면 «덧씌운 것»(몸 키 1.9 기준)
    --mode   both 면 색 OR 거리(하나만 통과해도 남김). color/dist 는 하나만

⚠ 이 자가 «안» 하는 것
  · 뼈를 안 붙인다 — 그건 transfer_weights.py 몫
  · 살색과 비슷한 옷(베이지)은 색으로 못 가른다 ⇒ 거리로만. 그러면 몸에 «붙은» 자리는 뚫린다
  ⇒ 낸 뒤 반드시 찍어서 봐라(61)
"""
import io
import json
import struct
import sys

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    off, js, binc = 12, None, None
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


def texture_of(js, binc, prim):
    mat = js["materials"][prim["material"]]
    bt = mat.get("pbrMetallicRoughness", {}).get("baseColorTexture")
    if bt is None:
        return None
    img = js["images"][js["textures"][bt["index"]]["source"]]
    bv = js["bufferViews"][img["bufferView"]]
    raw = binc[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
    return np.array(Image.open(io.BytesIO(raw)).convert("RGB"))


def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    o = {x.split("=")[0]: x.split("=")[1] for x in sys.argv[1:] if x.startswith("--") and "=" in x}
    baked, body, out = a[0], a[1], a[2]
    skin = np.array([float(v) for v in o.get("--skin", "230,200,180").split(",")])
    ctol = float(o.get("--ctol", 55))
    dmin = float(o.get("--dmin", 0.012))
    mode = o.get("--mode", "both")

    bj, bb = read_glb(baked)
    p = bj["meshes"][0]["primitives"][0]
    V = np.asarray(acc_np(bj, bb, p["attributes"]["POSITION"]), np.float32).copy()
    N = np.asarray(acc_np(bj, bb, p["attributes"]["NORMAL"]), np.float32) if "NORMAL" in p["attributes"] else None
    UV = np.asarray(acc_np(bj, bb, p["attributes"]["TEXCOORD_0"]), np.float32)
    F = np.asarray(acc_np(bj, bb, p["indices"]), np.int64).reshape(-1, 3)
    tex = texture_of(bj, bb, p)
    H, W = tex.shape[:2]
    px = np.clip((UV[:, 0] * W).astype(int), 0, W - 1)
    py = np.clip((UV[:, 1] * H).astype(int), 0, H - 1)
    col = tex[py, px].astype(np.float32)
    cdist = np.abs(col - skin).max(1)
    is_skin = cdist <= ctol
    print(f"  구운 판 정점 {len(V):,} · 살색 {int(is_skin.sum()):,} ({100*is_skin.mean():.1f}%)")
    print(f"  살색 정점 색 중앙값 {np.median(col[is_skin], 0).round(0) if is_skin.any() else '-'} · 나머지 중앙값 {np.median(col[~is_skin], 0).round(0) if (~is_skin).any() else '-'}")

    # 몸에 맞추기 — 살색 상자 → 몸 상자
    mj, mb = read_glb(body)
    M = np.concatenate([np.asarray(acc_np(mj, mb, q["attributes"]["POSITION"]), np.float32)
                        for m in mj["meshes"] for q in m["primitives"]])
    if o.get("--align", "skin") == "icp":
        # ★ 살색 점(얼굴·팔·다리)을 몸에 «최근접 반복»으로 맞춘다(배율+이동, 회전 없음).
        #   팔폭 기준은 구운 팔이 3% 길어 머리카락을 줄였고 ⇒ 정수리가 머리 «안»에 묻혔다(1.456 < 1.5).
        src = V[is_skin] if is_skin.sum() > 300 else V
        tree_m = cKDTree(M)
        s, t = 1.0, np.zeros(3)
        for _ in range(8):
            Q = src * s + t
            dd, ii = tree_m.query(Q, k=1)
            ok = dd < np.percentile(dd, 80)                       # 먼 짝(가려진 자리)은 뺀다
            A_, B_ = src[ok], M[ii[ok]]
            ca, cb_ = A_.mean(0), B_.mean(0)
            s = float(((A_ - ca) * (B_ - cb_)).sum() / ((A_ - ca) ** 2).sum())
            t = cb_ - ca * s
        dd, _ = tree_m.query(src * s + t, k=1)
        print(f"  icp — 살색 점 {len(src):,} · 남은 거리 중앙값 {np.median(dd):.4f}")
    elif o.get("--align", "skin") == "span":
        # ★ 팔 벌린 폭(x)과 발바닥(y min)·앞뒤 중심으로 맞춘다 — 머리카락이 키를 늘리고 옷이 살색을 덮어도
        #   팔 끝과 발은 그대로다. (살색 상자로 맞췄더니 살색이 3.6% 뿐이라 머리카락이 «떠» 버렸다)
        s = float((M[:, 0].max() - M[:, 0].min()) / (V[:, 0].max() - V[:, 0].min()))
        t = np.array([(M[:, 0].max() + M[:, 0].min()) / 2 - (V[:, 0].max() + V[:, 0].min()) / 2 * s,
                      M[:, 1].min() - V[:, 1].min() * s,
                      (M[:, 2].max() + M[:, 2].min()) / 2 - (V[:, 2].max() + V[:, 2].min()) / 2 * s])
    else:
        src = V[is_skin] if is_skin.sum() > 100 else V
        s = float(np.median((M.max(0) - M.min(0)) / (src.max(0) - src.min(0))))
        t = (M.min(0) + M.max(0)) / 2 - (src.min(0) + src.max(0)) / 2 * s
    V = V * s + t
    print(f"  맞춤 — 배율 {s:.4f} · 이동 {np.round(t, 4)}")

    d, _ = cKDTree(M).query(V, k=1)
    far = d > dmin
    if mode == "near":                                   # ★ 한 색 «가까운» 것만 — 세트(후드·바지·신발)를 색으로 나눠 뗄 때
        tgt = np.array([float(v) for v in o.get("--target", "0,0,0").split(",")])
        keep_v = np.abs(col - tgt).max(1) <= ctol
    elif mode == "notcolors":                              # ★ 주어진 색들(살색;셔츠색…) «모두»에서 먼 것만 — 머리카락 정수리 하이라이트가
        excl = [np.array([float(v) for v in c.split(",")]) for c in o.get("--excl", "").split(";") if c]
        keep_v = np.ones(len(V), bool)                    #   밝아서 «어두운 것만» 기준에 빠졌던 것(정수리가 비었다)
        for c in excl:
            keep_v &= np.abs(col - c).max(1) > ctol
    elif mode == "dark":                                   # ★ 머리카락 — «어두운 것»만 (살색·옷 다 밝다)
        keep_v = col.mean(1) < float(o.get("--dark", 120))
    elif mode == "color":
        keep_v = ~is_skin
    elif mode == "dist":
        keep_v = far
    else:
        keep_v = (~is_skin) | far
    # ★ 높이 띠 — 살색과 «색이 가까운 옷»(크림 니트)은 거리로만 가르는데, 거리는 머리·팔다리도 잡는다 ⇒ 띠로 자른다
    if "--ymin" in o or "--ymax" in o:
        keep_v &= (V[:, 1] >= float(o.get("--ymin", -9))) & (V[:, 1] <= float(o.get("--ymax", 9)))
    if "--xmax" in o:
        keep_v &= np.abs(V[:, 0]) <= float(o["--xmax"])
    keep_f = keep_v[F].all(1)
    Fe = F[keep_f]
    used = np.unique(Fe)
    remap = -np.ones(len(V), np.int64)
    remap[used] = np.arange(len(used))
    Fe = remap[Fe].astype(np.uint32)
    print(f"  남긴 삼각형 {len(Fe):,} / {len(F):,} · 정점 {len(used):,} · 상자 {np.round(V[used].min(0), 3)} ~ {np.round(V[used].max(0), 3)}")

    # 새 GLB — 정점·법선·UV·인덱스 + 구운 판의 재질·텍스처 그대로
    Ve, Te = V[used].astype(np.float32), UV[used].astype(np.float32)
    Ne = N[used].astype(np.float32) if N is not None else None
    binc = bytearray()
    bvs, accs = [], []

    def add(arr, target, ctype, typ, mm=False):
        raw = np.ascontiguousarray(arr).tobytes()
        while len(binc) % 4:
            binc.append(0)
        off = len(binc)
        binc.extend(raw)
        bvs.append({"buffer": 0, "byteOffset": off, "byteLength": len(raw), "target": target})
        acc = {"bufferView": len(bvs) - 1, "componentType": ctype, "count": int(len(arr)), "type": typ}
        if mm:
            acc["min"] = [float(x) for x in arr.min(0)]
            acc["max"] = [float(x) for x in arr.max(0)]
        accs.append(acc)
        return len(accs) - 1

    attrs = {"POSITION": add(Ve, 34962, 5126, "VEC3", True), "TEXCOORD_0": add(Te, 34962, 5126, "VEC2")}
    if Ne is not None:
        attrs["NORMAL"] = add(Ne, 34962, 5126, "VEC3")
    idx = add(Fe.reshape(-1), 34963, 5125, "SCALAR")
    # 텍스처 이미지
    mat = bj["materials"][p["material"]]
    img = bj["images"][bj["textures"][mat["pbrMetallicRoughness"]["baseColorTexture"]["index"]]["source"]]
    ibv = bj["bufferViews"][img["bufferView"]]
    raw = bb[ibv.get("byteOffset", 0): ibv.get("byteOffset", 0) + ibv["byteLength"]]
    while len(binc) % 4:
        binc.append(0)
    off = len(binc)
    binc.extend(raw)
    bvs.append({"buffer": 0, "byteOffset": off, "byteLength": len(raw)})
    nm = json.loads(json.dumps(mat))
    for k in ("normalTexture", "occlusionTexture", "emissiveTexture"):
        nm.pop(k, None)
    nm["pbrMetallicRoughness"].pop("metallicRoughnessTexture", None)
    nm["pbrMetallicRoughness"]["baseColorTexture"] = {"index": 0}
    nm["doubleSided"] = True
    js = {"asset": {"version": "2.0", "generator": "glb_extract_part"},
          "buffers": [{"byteLength": len(binc)}], "bufferViews": bvs, "accessors": accs,
          "images": [{"mimeType": img.get("mimeType", "image/png"), "bufferView": len(bvs) - 1}],
          "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
          "textures": [{"source": 0, "sampler": 0}], "materials": [nm],
          "meshes": [{"primitives": [{"attributes": attrs, "indices": idx, "material": 0, "mode": 4}]}],
          "nodes": [{"mesh": 0, "name": "part"}], "scenes": [{"nodes": [0]}], "scene": 0}
    write_glb(js, bytes(binc), out)
    print(f"✔ {out}")


if __name__ == "__main__":
    main()
