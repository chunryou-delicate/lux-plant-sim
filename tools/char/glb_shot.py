#!/usr/bin/env python3
"""GLB 를 «브라우저 없이» 곧장 그려 본다 — 크레딧 0 · 재질 함정 없음.

⛔ 왜 있나 (2026-09-07 · 총괄)
  three.js 로 찍다가 두 번 물렸다:
    ① 스킨드 메시 상자를 뼈로 잡아 사람이 «점»으로 찍혔다
    ② MeshToonMaterial(계단 음영)이 굴곡을 뭉개 «귀·턱이 없다»고 잘못 물렸다 — 모델은 멀쩡했다
  ⇒ ★ 그래서 여기서는 재질 없이 «면의 기울기»만 회색으로 칠한다. 굴곡이 있는 그대로 보인다.

무엇을 하나
  삼각형을 정사영으로 래스터화(z-buffer) 하고 램버트로 칠한다. 뷰 넷을 한 장에 잇는다.

쓰기
  python tools/char/glb_shot.py <파일.glb> <나갈.png> [--w=420] [--views=front,left,back,q34]

⚠ 이 자가 «안» 하는 것
  · 텍스처·색을 안 본다. «형태»만 본다. 색이 문제면 이 자로는 못 잡는다.
  · 클립을 안 얹는다. 바인드 자세만 본다.
"""
import json
import math
import struct
import sys

import numpy as np
from PIL import Image


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, _, total = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67
    off, js, binc = 12, None, None
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
    ct = acc["componentType"]
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[acc["type"]]
    dt, sz = {5120: (np.int8, 1), 5121: (np.uint8, 1), 5122: (np.int16, 2),
              5123: (np.uint16, 2), 5125: (np.uint32, 4), 5126: (np.float32, 4)}[ct]
    stride = bv.get("byteStride") or (sz * ncomp)
    if stride == sz * ncomp:
        a = np.frombuffer(binc, dtype=dt, count=n * ncomp, offset=base)
        return a.reshape(n, ncomp) if ncomp > 1 else a
    out = np.empty((n, ncomp), dtype=dt)
    for i in range(n):
        out[i] = np.frombuffer(binc, dtype=dt, count=ncomp, offset=base + i * stride)
    return out if ncomp > 1 else out[:, 0]


VIEWS = {
    "front": (0.0, 0.0), "back": (math.pi, 0.0),
    "left": (-math.pi / 2, 0.0), "right": (math.pi / 2, 0.0),
    "q34": (math.pi * 0.25, 0.0),
}


def render(V, F, yaw, W, H, pad=0.94, UV=None, TEX=None):
    c, s = math.cos(yaw), math.sin(yaw)
    x = V[:, 0] * c + V[:, 2] * s
    z = -V[:, 0] * s + V[:, 2] * c
    y = V[:, 1]
    P = np.stack([x, y, z], 1)

    lo, hi = P.min(0), P.max(0)
    span = max(hi[0] - lo[0], hi[1] - lo[1]) / pad
    mid = (lo + hi) / 2
    sx = (P[:, 0] - mid[0]) / span * W + W / 2
    sy = H / 2 - (P[:, 1] - mid[1]) / span * H * (W / H) / (W / H)
    sy = H / 2 - (P[:, 1] - mid[1]) / span * W
    sz = P[:, 2]

    zbuf = np.full((H, W), -1e9, np.float32)
    img = np.zeros((H, W), np.float32)
    cimg = np.zeros((H, W, 3), np.float32)          # 텍스처 색(있으면)

    A, B, C = F[:, 0], F[:, 1], F[:, 2]
    # 면 노멀(회전 뒤 좌표에서) → 램버트
    u = P[B] - P[A]; w = P[C] - P[A]
    nrm = np.cross(u, w)
    L = np.linalg.norm(nrm, axis=1, keepdims=True); L[L == 0] = 1
    nrm = nrm / L
    light = np.array([0.35, 0.45, 0.82]); light = light / np.linalg.norm(light)
    lam = np.clip(nrm @ light, 0, 1) * 0.65 + 0.35          # ★ 2026-09-14 색을 «있는 그대로» — 정면 빛에서 알베도 그대로(×1.0)

    # ★ 삼각형마다 «화면 크기에 맞춰» 무게중심 격자 샘플 (2026-09-14 · 박사님 「지직지직」)
    #   전엔 7점 고정이라 확대하면 삼각형 하나가 수십 픽셀인데 7점만 찍혀 «구멍이 점점이» 남았다 — 판이 아니라 이 자 탓.
    #   변 길이(픽셀)만큼 k 를 올려 k(k+1)/2 점을 찍는다(최대 24).
    e = np.maximum.reduce([np.hypot(sx[B] - sx[A], sy[B] - sy[A]), np.hypot(sx[C] - sx[B], sy[C] - sy[B]), np.hypot(sx[A] - sx[C], sy[A] - sy[C])])
    kk = np.clip(np.ceil(e).astype(np.int32) + 1, 2, 24)
    zb = zbuf.reshape(-1); ib = img.reshape(-1); cb = cimg.reshape(-1, 3)
    for k in np.unique(kk):
        sel = np.nonzero(kk == k)[0]
        Ak, Bk, Ck, lk = A[sel], B[sel], C[sel], lam[sel]
        grid = [(i / k, j / k) for i in range(k + 1) for j in range(k + 1 - i)]
        for a_, b_ in grid:
            a, b, g = 1 - a_ - b_, a_, b_
            px = sx[Ak] * a + sx[Bk] * b + sx[Ck] * g
            py = sy[Ak] * a + sy[Bk] * b + sy[Ck] * g
            pz = sz[Ak] * a + sz[Bk] * b + sz[Ck] * g
            ix = np.clip(px.astype(np.int32), 0, W - 1)
            iy = np.clip(py.astype(np.int32), 0, H - 1)
            flat = iy * W + ix
            order = np.argsort(pz)          # 뒤→앞 차례로 덮어쓰면 앞이 남는다
            fo, zo, lo2 = flat[order], pz[order], lk[order]
            keep = zo > zb[fo]
            if not (UV is not None and TEX is not None and TEX.shape[2] == 4):
                zb[fo[keep]] = zo[keep]; ib[fo[keep]] = lo2[keep]
            if UV is not None and TEX is not None:
                u = UV[Ak, 0] * a + UV[Bk, 0] * b + UV[Ck, 0] * g
                v = UV[Ak, 1] * a + UV[Bk, 1] * b + UV[Ck, 1] * g
                th, tw = TEX.shape[:2]
                tx = np.clip((u * tw).astype(np.int32), 0, tw - 1); ty = np.clip((v * th).astype(np.int32), 0, th - 1)
                cc = TEX[ty, tx][order]
                if TEX.shape[2] == 4:                       # ★ 알파 — 투명한 샘플은 «안 찍는다»(눈 데칼)
                    op = cc[:, 3] >= 128
                    keep = keep & op
                    zb[fo[keep]] = zo[keep]; ib[fo[keep]] = lo2[keep]
                cb[fo[keep]] = cc[keep][:, :3]

    # 구멍 한 겹 메우기
    m = (zbuf <= -1e8)
    pad_img = np.pad(img, 1)
    nb = np.stack([pad_img[0:-2, 1:-1], pad_img[2:, 1:-1], pad_img[1:-1, 0:-2], pad_img[1:-1, 2:]])
    cnt = (nb > 0).sum(0)
    img = np.where(m & (cnt >= 3), nb.sum(0) / np.maximum(cnt, 1), img)

    out = np.full((H, W, 3), 22, np.uint8)
    body = img > 0
    if UV is not None and TEX is not None:
        col = (cimg * img[:, :, None] * 1.0).clip(0, 255).astype(np.uint8)    # 텍스처 × 빛 (전엔 ×1.25 라 살색이 하얗게 떴다)
        for ch in range(3):
            out[:, :, ch] = np.where(body, col[:, :, ch], out[:, :, ch])
        return out
    v = (img * 255).clip(0, 255).astype(np.uint8)
    for ch, tint in enumerate((1.00, 0.93, 0.86)):
        out[:, :, ch] = np.where(body, (v * tint).astype(np.uint8), out[:, :, ch])
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    o = {a.split("=")[0]: a.split("=")[1] for a in sys.argv[1:] if a.startswith("--") and "=" in a}
    src, dst = args[0], args[1]
    W = int(o.get("--w", 420)); H = int(W * 1.5)
    names = o.get("--views", "front,left,back,q34").split(",")

    js, binc = read_glb(src)
    Vs, Fs, base = [], [], 0
    for m in js["meshes"]:
        for p in m["primitives"]:
            V = np.asarray(acc_np(js, binc, p["attributes"]["POSITION"]), np.float32)
            I = np.asarray(acc_np(js, binc, p["indices"]), np.int64).reshape(-1, 3)
            Vs.append(V); Fs.append(I + base); base += len(V)
    V = np.concatenate(Vs); F = np.concatenate(Fs)
    print(f"  정점 {len(V):,} · 면 {len(F):,}")

    tiles = [render(V, F, VIEWS[n][0], W, H) for n in names]
    sheet = np.concatenate(tiles, axis=1)
    Image.fromarray(sheet).save(dst)
    print(f"✔ {dst}  {sheet.shape[1]}x{sheet.shape[0]}  [{' | '.join(names)}]")


if __name__ == "__main__":
    main()
