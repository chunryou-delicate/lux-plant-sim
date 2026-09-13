#!/usr/bin/env python3
"""리깅된 GLB 여러 개를 «클립의 한 순간» 자세로 움직여 한 장에 찍는다 — 브라우저 없이, 크레딧 0.

⛔ 왜 있나 (2026-09-13 · 총괄)
  옷·머리를 몸 뼈대로 이식했는데 «걸으면 따라가나»를 볼 자가 없었다(glb_shot 은 바인드 자세만).
  ⇒ 스킨(JOINTS_0/WEIGHTS_0·inverseBindMatrices)과 클립(translation/rotation/scale 키)을 읽어
     시간 t 의 뼈 행렬을 만들고, 선형 블렌드 스키닝으로 정점을 옮겨 glb_shot.render 로 찍는다.

쓰기
  python tools/char/glb_pose_shot.py <클립.glb> <나갈.png> <판1.glb> [판2.glb …] [--t=0.0,0.25,0.5,0.75] [--view=front] [--w=300]
    클립.glb   애니메이션이 든 판(예: yeoja_v19_walk.glb). 뼈는 «이름»으로 짝짓는다
    --t        클립 길이 비율(0~1) 여러 개 — 각각 한 칸
    --view     front|left|back|right|q34

⚠ 이 자가 «안» 하는 것
  · 뼈 이름이 다르면 그 뼈는 «바인드 자세»로 둔다(경고를 낸다)
  · 텍스처 색을 찍는다(있으면). 노멀은 다시 계산하지 않고 면 기울기로만 칠한다
"""
import io
import json
import struct
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_shot import read_glb, acc_np, render, VIEWS  # noqa: E402


def quat_to_mat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def trs(t, r, s):
    M = np.eye(4)
    M[:3, :3] = quat_to_mat(r) * np.asarray(s)[None, :]
    M[:3, 3] = t
    return M


def node_local(nd):
    if "matrix" in nd:
        return np.array(nd["matrix"]).reshape(4, 4).T
    return trs(nd.get("translation", [0, 0, 0]), nd.get("rotation", [0, 0, 0, 1]), nd.get("scale", [1, 1, 1]))


def sample(times, vals, t):
    if t <= times[0]:
        return vals[0]
    if t >= times[-1]:
        return vals[-1]
    i = np.searchsorted(times, t) - 1
    a = (t - times[i]) / max(1e-9, times[i + 1] - times[i])
    v0, v1 = vals[i], vals[i + 1]
    if len(v0) == 4:                                    # 쿼터니언은 slerp 대신 nlerp (짧아서 충분)
        if np.dot(v0, v1) < 0:
            v1 = -v1
        v = v0 * (1 - a) + v1 * a
        return v / np.linalg.norm(v)
    return v0 * (1 - a) + v1 * a


def load_clip(path):
    js, b = read_glb(path)
    an = js["animations"][0]
    chans = {}
    dur = 0.0
    for ch in an["channels"]:
        smp = an["samplers"][ch["sampler"]]
        times = np.asarray(acc_np(js, b, smp["input"]), np.float32).ravel()
        vals = np.asarray(acc_np(js, b, smp["output"]), np.float32)
        name = js["nodes"][ch["target"]["node"]].get("name")
        chans.setdefault(name, {})[ch["target"]["path"]] = (times, vals)
        dur = max(dur, float(times[-1]))
    return chans, dur


def pose_part(path, chans, t):
    """판 하나를 시간 t 자세로. (정점, 면, UV, 텍스처) 를 낸다."""
    js, b = read_glb(path)
    p = js["meshes"][0]["primitives"][0]
    V = np.asarray(acc_np(js, b, p["attributes"]["POSITION"]), np.float32)
    F = np.asarray(acc_np(js, b, p["indices"]), np.int64).reshape(-1, 3)
    UV = np.asarray(acc_np(js, b, p["attributes"]["TEXCOORD_0"]), np.float32).copy() if "TEXCOORD_0" in p["attributes"] else None
    tex = None
    if "material" in p:
        mat = js["materials"][p["material"]]
        bt = mat.get("pbrMetallicRoughness", {}).get("baseColorTexture")
        if bt is not None:
            img = js["images"][js["textures"][bt["index"]]["source"]]
            bv = js["bufferViews"][img["bufferView"]]
            tex = np.array(Image.open(io.BytesIO(bytes(b[bv["byteOffset"]:bv["byteOffset"] + bv["byteLength"]]))).convert("RGB")).astype(np.float32)
    sk = js["skins"][0]
    joints = sk["joints"]
    ibm = np.asarray(acc_np(js, b, sk["inverseBindMatrices"]), np.float32).reshape(-1, 4, 4).transpose(0, 2, 1)
    # 부모표
    parent = {}
    for i, nd in enumerate(js["nodes"]):
        for c in nd.get("children", []):
            parent[c] = i
    # 뼈 지역 행렬 — 클립이 있으면 덮는다
    local = {}
    missing = []
    for i, nd in enumerate(js["nodes"]):
        nm = nd.get("name")
        if nm in chans:
            c = chans[nm]
            tr = sample(*c["translation"], t) if "translation" in c else np.array(nd.get("translation", [0, 0, 0]))
            ro = sample(*c["rotation"], t) if "rotation" in c else np.array(nd.get("rotation", [0, 0, 0, 1]))
            sc = sample(*c["scale"], t) if "scale" in c else np.array(nd.get("scale", [1, 1, 1]))
            local[i] = trs(tr, ro, sc)
        else:
            local[i] = node_local(nd)
            if i in joints:
                missing.append(nm)
    if missing:
        print(f"  ⚠ 클립에 없는 뼈 {len(missing)}: {missing[:5]}")
    world = {}

    def W(i):
        if i in world:
            return world[i]
        m = local[i] if i not in parent else W(parent[i]) @ local[i]
        world[i] = m
        return m
    # 메시 노드의 세계 행렬(스킨 메시는 보통 단위)
    JM = np.stack([W(j) @ ibm[k] for k, j in enumerate(joints)])        # (J,4,4)
    J = np.asarray(acc_np(js, b, p["attributes"]["JOINTS_0"]), np.int64)
    Wt = np.asarray(acc_np(js, b, p["attributes"]["WEIGHTS_0"]), np.float32)
    Wt = Wt / np.maximum(Wt.sum(1, keepdims=True), 1e-9)
    Vh = np.concatenate([V, np.ones((len(V), 1), np.float32)], 1)
    out = np.zeros((len(V), 3), np.float32)
    for k in range(4):
        M = JM[J[:, k]]                                                    # (N,4,4)
        out += Wt[:, k:k + 1] * np.einsum("nij,nj->ni", M, Vh)[:, :3]
    return out, F, UV, tex


def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    o = {x.split("=")[0]: x.split("=")[1] for x in sys.argv[1:] if x.startswith("--") and "=" in x}
    clip, out, parts = a[0], a[1], a[2:]
    ts = [float(v) for v in o.get("--t", "0,0.25,0.5,0.75").split(",")]
    view = o.get("--view", "front")
    Wpx = int(o.get("--w", 300)); Hpx = int(Wpx * 1.5)
    chans, dur = load_clip(clip)
    print(f"  클립 {clip} · 길이 {dur:.2f}s · 뼈 {len(chans)}")
    tiles = []
    for tf in ts:
        Vs, Fs, UVs, texs, base = [], [], [], [], 0
        for pth in parts:
            V, F, UV, tex = pose_part(pth, chans, tf * dur)
            Vs.append(V); Fs.append(F + base); UVs.append(UV); texs.append(tex); base += len(V)
        V = np.concatenate(Vs); F = np.concatenate(Fs)
        UV = TEX = None
        if all(u is not None and t_ is not None for u, t_ in zip(UVs, texs)):
            Hm = max(t_.shape[0] for t_ in texs); Wt = sum(t_.shape[1] for t_ in texs)
            TEX = np.zeros((Hm, Wt, 3), np.float32); x0 = 0
            for u, t_ in zip(UVs, texs):
                h, w = t_.shape[:2]; TEX[:h, x0:x0 + w] = t_
                u[:, 0] = (u[:, 0] % 1.0) * w / Wt + x0 / Wt; u[:, 1] = (u[:, 1] % 1.0) * h / Hm
                x0 += w
            UV = np.concatenate(UVs)
        tiles.append(render(V, F, VIEWS[view][0], Wpx, Hpx, UV=UV, TEX=TEX))
    Image.fromarray(np.concatenate(tiles, 1)).save(out)
    print(f"✔ {out}  [{view} · t={ts}]")


if __name__ == "__main__":
    main()
