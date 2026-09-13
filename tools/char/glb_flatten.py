#!/usr/bin/env python3
"""GLB 의 «봉우리»를 주변 곡면에 맞춰 내린다 — 크레딧 0. (남캐 = 여캐에서 가슴 지우기)

⛔ 왜 있나 (2026-09-13 · 총괄)
  ① glb_chest 로 z 만 누름 ⇒ 봉우리 둘레가 남아 «움푹한 자국 둘». 리깅 422
  ② glb_smooth 로 이웃 평균 120 번 ⇒ +0.129 → +0.117. 메시가 촘촘해 한 걸음이 너무 작다
  ⇒ ★ 봉우리 «둘레»의 점들로 몸통 곡면을 이차식 z=f(x,y) 로 맞추고, 봉우리 안 점을 그 면으로
     끌어내린다. 한 번에 되고, 결과가 «주변과 같은 곡면»이라 구덩이가 안 생긴다.

쓰기
  python tools/char/glb_flatten.py <들.glb> <날.glb> [--y0=0.44] [--y1=0.64] [--xr=0.22] [--ring=0.05]
    y0~y1 · |x|<xr   봉우리가 든 상자(높이비·가로)
    ring              상자 «바깥» 이만큼의 띠를 «둘레»로 삼아 곡면을 맞춘다

⚠ 이 자가 «안» 하는 것
  · 둘레 띠에 봉우리가 걸치면 곡면이 들린다. 상자를 봉우리보다 «조금 크게» 잡아라
  · 첫 프리미티브만 다룬다(귀 이식분은 안 건드림). 리깅 «전»에만
  ⇒ 낸 뒤 반드시 찍어서 봐라(61)
"""
import json
import struct
import sys

import numpy as np


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
            binc = bytearray(body)
        off += 8 + clen
    return js, binc


def write_glb(js, binc, path):
    jb = json.dumps(js, separators=(",", ":")).encode("utf-8")
    jb += b" " * ((4 - len(jb) % 4) % 4)
    bb = bytes(binc) + b"\x00" * ((4 - len(binc) % 4) % 4)
    out = struct.pack("<III", 0x46546C67, 2, 28 + len(jb) + len(bb))
    out += struct.pack("<II", len(jb), 0x4E4F534A) + jb
    out += struct.pack("<II", len(bb), 0x004E4942) + bb
    with open(path, "wb") as f:
        f.write(out)


def span(js, idx):
    acc = js["accessors"][idx]
    bv = js["bufferViews"][acc["bufferView"]]
    return bv.get("byteOffset", 0) + acc.get("byteOffset", 0), acc


def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    o = {x.split("=")[0]: float(x.split("=")[1]) for x in sys.argv[1:] if x.startswith("--") and "=" in x}
    src, dst = a[0], a[1]
    y0r, y1r, xr, ring = o.get("--y0", 0.44), o.get("--y1", 0.64), o.get("--xr", 0.22), o.get("--ring", 0.05)

    js, binc = read_glb(src)
    p = js["meshes"][0]["primitives"][0]
    pb, pacc = span(js, p["attributes"]["POSITION"])
    n = pacc["count"]
    V = np.frombuffer(bytes(binc[pb:pb + n * 12]), np.float32).reshape(n, 3).copy()
    ib, iacc = span(js, p["indices"])
    dt = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32}[iacc["componentType"]]
    F = np.frombuffer(bytes(binc[ib:ib + iacc["count"] * np.dtype(dt).itemsize]), dt).astype(np.int64).reshape(-1, 3)

    lo, hi = V[:, 1].min(), V[:, 1].max()
    h = hi - lo
    y0, y1 = lo + h * y0r, lo + h * y1r
    front = V[:, 2] > 0.0                                          # 앞면만(등은 안 건드린다)
    inbox = (V[:, 1] >= y0) & (V[:, 1] <= y1) & (np.abs(V[:, 0]) < xr) & front
    inring = (V[:, 1] >= y0 - ring * h) & (V[:, 1] <= y1 + ring * h) & (np.abs(V[:, 0]) < xr + ring) & front & ~inbox
    print(f"  상자 안 {int(inbox.sum()):,} · 둘레 {int(inring.sum()):,}")

    # ★ 목표 곡면 = «아래 띠(배)» 단면과 «위 띠(쇄골)» 단면을 x 별로 재서 y 로 잇는다.
    #   이차식으로 맞췄더니(첫 판) 둘레에 «가운데 x=0» 점이 없어 가운데를 앞으로 «외삽»했다(절편 0.21, 몸통은 0.14).
    #   단면을 실제로 재면 외삽이 없다.
    band = ring * h
    bot = V[(V[:, 1] >= y0 - band) & (V[:, 1] < y0) & (np.abs(V[:, 0]) < xr + 0.02) & front]
    top = V[(V[:, 1] > y1) & (V[:, 1] <= y1 + band) & (np.abs(V[:, 0]) < xr + 0.02) & front]
    edges = np.linspace(-xr - 0.02, xr + 0.02, 27)
    cx = 0.5 * (edges[:-1] + edges[1:])
    def profile(P):
        z = np.full(len(cx), np.nan)
        for i in range(len(cx)):
            m = (P[:, 0] >= edges[i]) & (P[:, 0] < edges[i + 1])
            if m.sum() >= 3:
                z[i] = np.percentile(P[m, 2], 90)      # 그 x 칸의 «앞면» 높이
        ok = ~np.isnan(z)
        # ★ 칸별 값을 그대로 쓰면 «세로 골»이 새겨진다(칸마다 들쭉날쭉). 4차식으로 매끈하게 한다
        cf = np.polyfit(cx[ok], z[ok], 4)
        zz = np.polyval(cf, cx)
        # ★ 데이터 «밖» x 는 외삽하지 않는다 — 외삽이 낮게 빠지면 팔 안쪽까지 끌어당겨 찢는다
        lo_x, hi_x = cx[ok].min(), cx[ok].max()
        zz[cx < lo_x] = np.polyval(cf, lo_x)
        zz[cx > hi_x] = np.polyval(cf, hi_x)
        return zz
    zb, zt = profile(bot), profile(top)
    # ★ 봉우리를 «먼저 찾고» 이웃으로 몇 겹 넓힌 뒤 그 안은 «전부» 곡면으로 보낸다.
    #   「곡면보다 앞인 점만」 옮겼더니(앞 판) 곡면과 «스치는» 옆구리에서 옆 점끼리 움직임이 갈려 얼룩졌다.
    wide = (V[:, 1] >= y0 - 0.03 * h) & (V[:, 1] <= y1 + 0.03 * h) & (np.abs(V[:, 0]) < xr + 0.06) & front
    W = V[wide]
    tw = np.clip((W[:, 1] - y0) / max(1e-6, y1 - y0), 0, 1)
    zf_w = (1 - tw) * np.interp(W[:, 0], cx, zb) + tw * np.interp(W[:, 0], cx, zt)
    zf_all = np.full(len(V), np.nan)
    zf_all[wide] = zf_w
    core = np.zeros(len(V), bool)
    core[wide] = (W[:, 2] - zf_w > 0.012) & inbox[wide]
    # 이웃표로 6 겹 넓힌다. 겹수가 곧 가중치(안쪽 1 → 바깥 0)
    A_, B_, C_ = F[:, 0], F[:, 1], F[:, 2]
    src_i = np.concatenate([A_, B_, B_, C_, C_, A_]); dst_i = np.concatenate([B_, A_, C_, B_, A_, C_])
    ring_of = np.full(len(V), -1); ring_of[core] = 0
    frontier = core.copy()
    RINGS = 6
    for r in range(1, RINGS + 1):
        nb = np.zeros(len(V), bool)
        nb[dst_i[frontier[src_i]]] = True
        nb &= (ring_of < 0) & wide
        ring_of[nb] = r
        frontier = nb
    sel = ring_of >= 0
    w = np.where(sel, 1.0 - ring_of / (RINGS + 1.0), 0.0)
    # ★ UV 이음선의 «쌍둥이 정점»(같은 자리, 다른 UV)은 가중치를 하나로 — 안 그러면 이음선이 벌어져 얼룩진다
    key = np.round(V * 2000).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    wmax = np.zeros(inv.max() + 1); np.maximum.at(wmax, inv.ravel(), w)
    w = wmax[inv.ravel()]
    w = 0.5 - 0.5 * np.cos(np.pi * w)                    # 부드럽게
    # ★ z 한 축으로 누르면 «옆을 보는» 봉우리 옆면이 찌부러진다(뒤집힌 면 619 · 찌부러진 면 848).
    #   ⇒ 몸통 곡면의 «법선» 방향으로 누른다 — 가운데는 앞뒤로, 옆구리는 옆으로.
    #   곡면 z=f(x) (y 로 배띠↔쇄골띠 잇기) 의 법선 = (-df/dx, 0, 1) 정규화. 세 번 되풀이해 수렴시킨다.
    dzb, dzt = np.gradient(zb, cx), np.gradient(zt, cx)
    idx = np.where(sel)[0]
    for _ in range(3):
        P = V[idx]
        tp = np.clip((P[:, 1] - y0) / max(1e-6, y1 - y0), 0, 1)
        zq = (1 - tp) * np.interp(P[:, 0], cx, zb) + tp * np.interp(P[:, 0], cx, zt)
        sl = (1 - tp) * np.interp(P[:, 0], cx, dzb) + tp * np.interp(P[:, 0], cx, dzt)
        nx, nz = -sl, np.ones_like(sl)
        L = np.sqrt(nx * nx + nz * nz); nx /= L; nz /= L
        d = (P[:, 2] - zq) * nz + 0.0 * nx          # Q=(x, y, zq) 에서 P 까지의 법선 거리
        d = np.clip(d, 0, None)                       # 곡면 «앞»에 있는 만큼만
        step = d * w[idx]
        V[idx, 0] -= step * nx
        V[idx, 2] -= step * nz
    over = np.clip(V[core, 2] * 0 + 1, 0, None)
    print(f"  봉우리 {int(core.sum()):,} 점 · 넓혀서 {int(sel.sum()):,} 점")
    coef = [float(zb[len(cx)//2]), float(zt[len(cx)//2])]
    print(f"  곡면 가운데 z — 배 띠 {coef[0]:.3f} · 쇄골 띠 {coef[1]:.3f}")

    binc[pb:pb + n * 12] = V.astype(np.float32).tobytes()
    pacc["min"] = [float(x) for x in V.min(0)]
    pacc["max"] = [float(x) for x in V.max(0)]
    ni = p["attributes"].get("NORMAL")
    if ni is not None:
        nb, _ = span(js, ni)
        A, Bi, C = F[:, 0], F[:, 1], F[:, 2]
        fn = np.cross(V[Bi] - V[A], V[C] - V[A])
        N = np.zeros_like(V)
        for k in (A, Bi, C):
            np.add.at(N, k, fn)
        L = np.linalg.norm(N, axis=1, keepdims=True)
        L[L == 0] = 1
        binc[nb:nb + n * 12] = (N / L).astype(np.float32).tobytes()
    write_glb(js, binc, dst)
    print(f"✔ {dst}")


if __name__ == "__main__":
    main()
