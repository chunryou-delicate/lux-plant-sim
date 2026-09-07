#!/usr/bin/env python3
"""맨몸 GLB 의 «가슴만» 눌러 원뿔을 완만하게 만든다 — 크레딧 0.

⛔ 왜 있나 (2026-09-07 · 총괄)
  v7 은 박사님이 고르신 판이다(얼굴·귀·등신 성함). 흠은 «가슴이 미사일» 하나였다.
  원화를 다시 뽑아 다시 구웠더니(v8) ⇒ ★ 가슴은 고쳐졌는데 «얼굴을 통째로 잃었다».
  까닭: 원화 앞 3.5등신 · 옆 4등신 — 어긋난 뷰를 Meshy 가 평균 내어 뭉갰다.
  ⇒ ★★ 굽기를 다시 하면 «고친 것 말고 다른 것»이 흔들린다. 그래서 «메시를 직접» 깎는다.

무엇을 하나
  높이 y0~y1 구간에서, 몸통 가운데(|x| 작은) 정점 중 z > zbase 인 것을
    z ← zbase + (z - zbase) * k        (k<1 이면 눌린다)
  로 누른다. 구간 경계는 «코사인»으로 부드럽게 — 안 그러면 계단이 새겨진다.
  ⇒ 그리고 NORMAL 을 «다시 계산»한다. 안 하면 눌린 자리에 옛 빛이 남아 얼룩진다.

쓰기
  python tools/char/glb_chest.py <들.glb> <날.glb> [--y0=0.44] [--y1=0.65] \
        [--zbase=0.16] [--k=0.55] [--xr=0.22]
    y0/y1  높이비(0~1, 바닥이 0)
    zbase  이 z 보다 앞쪽만 누른다(몸통 앞면 값)
    k      누르는 세기. 1 이면 안 누름, 0.5 면 절반
    xr     |x| 가 이보다 크면 «팔»로 보고 안 건드린다

⚠ 이 자가 «안» 하는 것
  · 어깨·얼굴·다리는 안 건드린다(일부러). 한 번에 하나만 고친다.
  · 뼈·웨이트·클립은 손대지 않는다 — POSITION/NORMAL 바이트만 제자리에서 고친다.
  ⇒ ★ 낸 뒤 반드시 glb_probe 로 다시 재고 «찍어서 눈으로» 봐라(61).
"""
import json
import math
import struct
import sys


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, ver, total = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "glTF 가 아니다"
    off = 12
    js = binc = None
    js_span = bin_span = None
    while off < total:
        clen, ctype = struct.unpack_from("<II", data, off)
        body = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(body.decode("utf-8")); js_span = (off + 8, clen)
        elif ctype == 0x004E4942:
            binc = bytearray(body); bin_span = (off + 8, clen)
        off += 8 + clen
    return bytearray(data), js, binc, js_span, bin_span


def acc_span(js, idx, comp=12):
    acc = js["accessors"][idx]
    bv = js["bufferViews"][acc["bufferView"]]
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = bv.get("byteStride") or comp
    return base, stride, acc["count"], acc


def read_idx(js, binc, idx):
    acc = js["accessors"][idx]
    bv = js["bufferViews"][acc["bufferView"]]
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    ct = acc["componentType"]
    fmt, sz = {5121: ("<B", 1), 5123: ("<H", 2), 5125: ("<I", 4)}[ct]
    return [struct.unpack_from(fmt, binc, base + i * sz)[0] for i in range(acc["count"])]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    o = {a.split("=")[0]: float(a.split("=")[1]) for a in sys.argv[1:] if a.startswith("--") and "=" in a}
    src, dst = args[0], args[1]
    y0r = o.get("--y0", 0.44); y1r = o.get("--y1", 0.65)
    zbase = o.get("--zbase", 0.16); k = o.get("--k", 0.55); xr = o.get("--xr", 0.22)

    data, js, binc, js_span, bin_span = read_glb(src)

    for mi, m in enumerate(js.get("meshes", [])):
        for pi, p in enumerate(m["primitives"]):
            ai = p["attributes"].get("POSITION")
            if ai is None:
                continue
            pbase, pstr, n, pacc = acc_span(js, ai)
            V = [list(struct.unpack_from("<fff", binc, pbase + i * pstr)) for i in range(n)]
            ys = [v[1] for v in V]
            lo, hi = min(ys), max(ys)
            h = hi - lo
            y0, y1 = lo + h * y0r, lo + h * y1r

            moved = 0
            for v in V:
                if not (y0 <= v[1] <= y1) or v[2] <= zbase or abs(v[0]) > xr:
                    continue
                # 높이 가중치 — 구간 가운데가 1, 양 끝이 0 (코사인)
                t = (v[1] - y0) / (y1 - y0)
                wy = 0.5 - 0.5 * math.cos(2 * math.pi * t)
                # 가로 가중치 — 가운데 강하게, 옆구리로 갈수록 0
                wx = max(0.0, 1.0 - (abs(v[0]) / xr) ** 2)
                w = wy * wx
                if w <= 0:
                    continue
                kk = 1.0 - (1.0 - k) * w
                v[2] = zbase + (v[2] - zbase) * kk
                moved += 1

            for i, v in enumerate(V):
                struct.pack_into("<fff", binc, pbase + i * pstr, *v)
            pacc["min"] = [min(v[j] for v in V) for j in range(3)]
            pacc["max"] = [max(v[j] for v in V) for j in range(3)]

            # NORMAL 다시 계산 — 면 노멀을 정점마다 «면적 가중»으로 모은다
            ni = p["attributes"].get("NORMAL")
            if ni is not None and "indices" in p:
                idx = read_idx(js, binc, p["indices"])
                acc = [[0.0, 0.0, 0.0] for _ in range(n)]
                for t3 in range(0, len(idx) - 2, 3):
                    a, b, c = idx[t3], idx[t3 + 1], idx[t3 + 2]
                    A, B, C = V[a], V[b], V[c]
                    u = [B[j] - A[j] for j in range(3)]
                    w2 = [C[j] - A[j] for j in range(3)]
                    nx = u[1] * w2[2] - u[2] * w2[1]
                    ny = u[2] * w2[0] - u[0] * w2[2]
                    nz = u[0] * w2[1] - u[1] * w2[0]
                    for q in (a, b, c):
                        acc[q][0] += nx; acc[q][1] += ny; acc[q][2] += nz
                nbase, nstr, nn, _ = acc_span(js, ni)
                for i in range(min(n, nn)):
                    g = acc[i]
                    L = math.sqrt(g[0] ** 2 + g[1] ** 2 + g[2] ** 2)
                    if L < 1e-12:
                        continue
                    struct.pack_into("<fff", binc, nbase + i * nstr, g[0] / L, g[1] / L, g[2] / L)
                print(f"  NORMAL 다시 계산 {n:,}")
            print(f"  메시{mi}.{pi} 정점 {n:,} · 민 것 {moved:,} ({100*moved/n:.1f}%)")

    # 다시 쓴다 — JSON 길이가 달라질 수 있으니 통째로 짓는다
    jb = json.dumps(js, separators=(",", ":")).encode("utf-8")
    jb += b" " * ((4 - len(jb) % 4) % 4)
    bb = bytes(binc)
    bb += b"\x00" * ((4 - len(bb) % 4) % 4)
    total = 12 + 8 + len(jb) + 8 + len(bb)
    out = bytearray()
    out += struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(jb), 0x4E4F534A) + jb
    out += struct.pack("<II", len(bb), 0x004E4942) + bb
    with open(dst, "wb") as f:
        f.write(out)
    print(f"✔ {dst}  ({total:,} 바이트)")


if __name__ == "__main__":
    main()
