#!/usr/bin/env python3
"""리깅 «전» 두 판의 정점 이동량을 리깅 «된» 판에 옮긴다 — 크레딧 0. 뼈·웨이트·클립은 그대로.

⛔ 왜 있나 (2026-09-13 · 총괄)
  남캐 v19 = 여캐 v19 에서 가슴만 지운 것. 정점은 «같은 개수·같은 차례»다.
  그런데 Meshy 리깅이 남캐만 422 로 거절했다 — 탐침으로 가려 보니 파일 구조·조합 탓이 아니라
  «가슴 없는 이 몸»을 자세 추정이 못 읽는 것이었다(블랙박스, 더 못 판다).
  ⇒ ★ 여캐 v19 «리깅된» 파일의 정점 위치만 남캐 것으로 바꾼다. 뼈·웨이트·클립이 그대로 남고
     남녀 뼈대가 «같음이 보장»된다(같은 파일에서 나왔으니).

리깅이 바꾸는 것(재서 확인)
  · 크기 0.78981 배(균일) · 발바닥 y=0 · 좌우·앞뒤 중심 0  ⇒ 상자로 s, t 를 푼다: R = s·U + t
  · ★ 정점 «차례»가 바뀐다(오차 중앙값 0.32) ⇒ 최근접(KD-tree)으로 짝짓는다
  · 몸(51,466)+귀(3,450)가 «하나»로 합쳐진다(54,916) ⇒ 리깅 전은 프리미티브를 다 이어 붙여 견준다

쓰기
  python tools/char/glb_apply_delta.py <리깅전_src.glb> <리깅전_dst.glb> <리깅된_src.glb> <날.glb>
    src→dst 의 이동량을 «리깅된 src» 에 얹어 «리깅된 dst» 를 낸다

⚠ 이 자가 «안» 하는 것
  · 리깅전 src 와 dst 의 정점 «개수·차례»가 같아야 한다(glb_flatten/glb_chest 출력이 그렇다). 다르면 멈춘다
  · 뼈 위치는 안 옮긴다 — 뼈가 «지나가는» 자리(머리·팔다리)를 바꾸는 데 쓰지 마라. 가슴·배처럼 뼈 사이 살만
"""
import json
import struct
import sys

import numpy as np
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
    return bv.get("byteOffset", 0) + acc.get("byteOffset", 0), acc, bv


def positions(js, binc):
    out = []
    for m in js["meshes"]:
        for p in m["primitives"]:
            b, acc, bv = span(js, p["attributes"]["POSITION"])
            n = acc["count"]
            st = bv.get("byteStride") or 12
            if st == 12:
                out.append(np.frombuffer(bytes(binc[b:b + n * 12]), np.float32).reshape(n, 3))
            else:
                out.append(np.array([np.frombuffer(bytes(binc[b + i * st:b + i * st + 12]), np.float32) for i in range(n)]))
    return np.concatenate(out)


def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    u_src, u_dst, r_src, out = a[0], a[1], a[2], a[3]
    U = positions(*read_glb(u_src))
    D = positions(*read_glb(u_dst))
    if len(U) != len(D):
        raise SystemExit(f"⛔ 리깅전 src {len(U):,} · dst {len(D):,} — 정점 수가 다르다")
    rj, rb = read_glb(r_src)
    R = positions(rj, rb)

    # 상자로 s, t 풀기 (균일 배율 가정 — 축별 배율이 어긋나면 알린다)
    su = (R.max(0) - R.min(0)) / (U.max(0) - U.min(0))
    if su.max() / su.min() > 1.01:
        print(f"  ⚠ 축별 배율이 다르다 {np.round(su, 5)} — 균일이 아니면 결과를 못 믿는다")
    s = float(np.median(su))
    t = R.min(0) - U.min(0) * s
    print(f"  배율 {s:.5f} · 이동 {np.round(t, 4)}")

    Q = (R - t) / s                                  # 리깅 정점을 리깅 전 공간으로
    tree = cKDTree(U)
    dist, idx = tree.query(Q, k=1)
    print(f"  최근접 거리 — 중앙값 {np.median(dist):.5f} · 95% {np.percentile(dist, 95):.5f} · 최대 {dist.max():.5f}")
    delta = (D - U)[idx] * s
    moved = int((np.linalg.norm(delta, axis=1) > 1e-6).sum())
    print(f"  옮긴 정점 {moved:,} / {len(R):,} · 최대 이동 {np.linalg.norm(delta, axis=1).max():.4f}")

    # 되써 넣기 (프리미티브 차례대로) + NORMAL 다시 계산
    k = 0
    for m in rj["meshes"]:
        for p in m["primitives"]:
            b, acc, bv = span(rj, p["attributes"]["POSITION"])
            n = acc["count"]
            st = bv.get("byteStride") or 12
            P = R[k:k + n] + delta[k:k + n]
            if st == 12:
                rb[b:b + n * 12] = P.astype(np.float32).tobytes()
            else:
                for i in range(n):
                    rb[b + i * st:b + i * st + 12] = P[i].astype(np.float32).tobytes()
            acc["min"] = [float(x) for x in P.min(0)]
            acc["max"] = [float(x) for x in P.max(0)]
            ni = p["attributes"].get("NORMAL")
            if ni is not None and "indices" in p:
                ib, iacc, ibv = span(rj, p["indices"])
                dt = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32}[iacc["componentType"]]
                F = np.frombuffer(bytes(rb[ib:ib + iacc["count"] * np.dtype(dt).itemsize]), dt).astype(np.int64).reshape(-1, 3)
                fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
                N = np.zeros_like(P)
                for c in (F[:, 0], F[:, 1], F[:, 2]):
                    np.add.at(N, c, fn)
                L = np.linalg.norm(N, axis=1, keepdims=True)
                nb, nacc, nbv = span(rj, ni)
                old = np.frombuffer(bytes(rb[nb:nb + n * 12]), np.float32).reshape(n, 3)
                N = np.where(L > 1e-12, N / np.where(L == 0, 1, L), old)   # 면 없는 점은 옛 법선
                nst = nbv.get("byteStride") or 12
                if nst == 12:
                    rb[nb:nb + n * 12] = N.astype(np.float32).tobytes()
                else:
                    for i in range(n):
                        rb[nb + i * nst:nb + i * nst + 12] = N[i].astype(np.float32).tobytes()
            k += n
    write_glb(rj, rb, out)
    print(f"✔ {out}")


if __name__ == "__main__":
    main()
