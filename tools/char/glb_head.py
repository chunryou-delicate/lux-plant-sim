#!/usr/bin/env python3
"""맨몸 GLB 의 «머리만» 키우거나 줄여 등신을 맞춘다 — 크레딧 0.

⛔ 왜 있나 (2026-09-12 · 총괄)
  머리 크기와 몸 굵기가 «한 낱말»에 묶여 있다:
    프롬프트에 chibi 를 넣으면 ⇒ 머리가 크고 «하체도 굵다»(2.2등신, 박사님 물리심)
    chibi 를 빼면          ⇒ 하체는 얇고 가슴도 사는데 «6.7등신 어른»이 된다
  ⇒ 원화를 다섯 번 뽑아도 그 사이가 안 나왔다. 산으로 갔다.
  ⇒ ★ 그래서 «몸은 슬림한 것으로 굽고, 머리만 3D 에서 키운다». 둘을 갈라 다룬다.

  2D 로도 해 봤다(shrink_head.py) ⇒ 이음매가 «각진 턱»으로 드러나고 목이 기둥이 됐다.
  ⇒ ★★ 3D 라야 «목에서 머리로 부드럽게» 커진다. 그래서 여기서 한다.

⚠ 언제 쓸 수 있나
  ★ «리깅 전»에만. 뼈가 붙은 뒤에는 정점만 고치면 뼈가 머리 밖으로 나간다.
    (v13 에서 그래서 못 했다. v14 는 리깅 전이라 됐다)

쓰기
  python tools/char/glb_head.py <들.glb> <날.glb> [--deungsin=3.2] [--s=0] [--blend=0.06]
    --deungsin  목표 등신. 배율을 여기서 «계산»한다(권함)
    --s         배율 직접. 주면 --deungsin 무시
    --blend     목 아래 몇 «키 비율»까지 부드럽게 이을지

⚠ 이 자가 «안» 하는 것
  · 목 두께는 blend 가 «딸려» 굵어질 뿐, 따로 못 정한다
  · 얼굴 이목구비도 함께 커진다(맨몸이라 눈·입이 없어 문제 없다. 귀는 커진다 — 치비니 맞다)
  ⇒ ★ 낸 뒤 반드시 glb_shot 으로 찍어 «눈으로» 봐라(61).
"""
import json
import math
import struct
import sys


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, _, total = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "glTF 가 아니다"
    off, js, binc = 12, None, None
    while off < total:
        clen, ctype = struct.unpack_from("<II", data, off)
        body = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(body.decode("utf-8"))
        elif ctype == 0x004E4942:
            binc = bytearray(body)
        off += 8 + clen
    return js, binc


def acc_span(js, idx, comp=12):
    acc = js["accessors"][idx]
    bv = js["bufferViews"][acc["bufferView"]]
    return bv.get("byteOffset", 0) + acc.get("byteOffset", 0), (bv.get("byteStride") or comp), acc["count"], acc


def read_idx(js, binc, idx):
    acc = js["accessors"][idx]
    bv = js["bufferViews"][acc["bufferView"]]
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    fmt, sz = {5121: ("<B", 1), 5123: ("<H", 2), 5125: ("<I", 4)}[acc["componentType"]]
    return [struct.unpack_from(fmt, binc, base + i * sz)[0] for i in range(acc["count"])]


def find_neck(V, lo, hi):
    """위쪽에서 «좁아졌다가 다시 넓어지는» 골짜기. 거기가 목이다."""
    h = hi - lo
    ws = []
    for k in range(60):
        y0, y1 = lo + h * k / 60, lo + h * (k + 1) / 60
        s = [v for v in V if y0 <= v[1] < y1 and abs(v[0]) < 0.14 * h]
        ws.append((max(x[0] for x in s) - min(x[0] for x in s)) if len(s) >= 20 else 0.0)
    for k in range(40, 58):
        if ws[k] > 0 and ws[k] < ws[k - 1] and ws[k] <= ws[k + 1]:
            return lo + h * k / 60
    raise SystemExit("⛔ 목을 못 찾았다 — 눈으로 보고 --s 로 직접 줘라")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    o = {a.split("=")[0]: float(a.split("=")[1]) for a in sys.argv[1:] if a.startswith("--") and "=" in a}
    src, dst = args[0], args[1]
    js, binc = read_glb(src)

    prims = [(m, p) for m in js["meshes"] for p in m["primitives"] if "POSITION" in p["attributes"]]
    allv = []
    for _, p in prims:
        b, st, n, _ = acc_span(js, p["attributes"]["POSITION"])
        allv += [struct.unpack_from("<fff", binc, b + i * st) for i in range(n)]
    lo = min(v[1] for v in allv); hi = max(v[1] for v in allv)
    neck = find_neck(allv, lo, hi)
    hh, hb = hi - neck, neck - lo
    s = o.get("--s", 0.0) or hb / ((o.get("--deungsin", 3.2) - 1.0) * hh)
    blend = o.get("--blend", 0.06) * (hi - lo)

    # ★ 확대 중심의 z 는 «목»의 한가운데라야 한다.
    #   머리 한가운데로 잡았더니(첫 판) 머리가 «뒤통수 쪽으로» 밀려 막대에 꽂힌 공이 됐다.
    nb_ = [v for v in allv if neck <= v[1] < neck + 0.02 * (hi - lo)]
    zc = (max(v[2] for v in nb_) + min(v[2] for v in nb_)) / 2 if nb_ else 0.0
    print(f"  목 y={neck:.4f} · 머리 {hh:.4f} · 몸 {hb:.4f} · 지금 {(hi-lo)/hh:.2f}등신")
    # ★ 목 굵기 — 세로 구간만으로 가중치를 주면 «어깨까지» 부풀어 접시 테두리가 생긴다(첫 판).
    #   그래서 «중심축에서 먼» 정점은 덜 키운다. 목 둘레만 따라 굵어진다.
    nk = [v for v in allv if neck <= v[1] < neck + 0.02 * (hi - lo)]
    r0 = 2.2 * max(0.01, max(math.hypot(v[0], v[2] - zc) for v in nk)) if nk else 0.1
    print(f"  ⇒ 배율 {s:.3f} · 목 아래 {blend:.4f} · 목둘레 {r0:.4f} 안쪽만 굵힌다")

    for mi, (m, p) in enumerate(prims):
        b, st, n, pacc = acc_span(js, p["attributes"]["POSITION"])
        V = [list(struct.unpack_from("<fff", binc, b + i * st)) for i in range(n)]
        # ★ 목 «위»로도 서서히 키운다.
        #   목 위를 곧장 s 배 하면 «머리 밑동»만 2.5배가 되어 목 위에 «접시»가 얹힌다(둘째 판).
        #   ⇒ 목에서 정수리로 가며 1 → s 로 벌어지게 하면 원뿔처럼 이어진다.
        up = 0.35 * hh
        for v in V:
            if v[1] >= neck + up:
                w = 1.0
            elif v[1] >= neck - blend:
                t = (v[1] - (neck - blend)) / (blend + up)
                w = 0.5 - 0.5 * math.cos(math.pi * t)
                if v[1] < neck:                            # 목 «아래»는 축 둘레만
                    w *= math.exp(-(math.hypot(v[0], v[2] - zc) / r0) ** 2)
            else:
                continue
            k = 1.0 + (s - 1.0) * w
            v[0] *= k
            v[1] = neck + (v[1] - neck) * k
            v[2] = zc + (v[2] - zc) * k
        for i, v in enumerate(V):
            struct.pack_into("<fff", binc, b + i * st, *v)
        pacc["min"] = [min(v[j] for v in V) for j in range(3)]
        pacc["max"] = [max(v[j] for v in V) for j in range(3)]

        ni = p["attributes"].get("NORMAL")
        if ni is not None and "indices" in p:
            idx = read_idx(js, binc, p["indices"])
            acc = [[0.0, 0.0, 0.0] for _ in range(n)]
            for t3 in range(0, len(idx) - 2, 3):
                a, bb, c = idx[t3], idx[t3 + 1], idx[t3 + 2]
                A, B, C = V[a], V[bb], V[c]
                u = [B[j] - A[j] for j in range(3)]
                w2 = [C[j] - A[j] for j in range(3)]
                g = (u[1] * w2[2] - u[2] * w2[1], u[2] * w2[0] - u[0] * w2[2], u[0] * w2[1] - u[1] * w2[0])
                for q in (a, bb, c):
                    for j in range(3):
                        acc[q][j] += g[j]
            nb, nst, nn, _ = acc_span(js, ni)
            for i in range(min(n, nn)):
                g = acc[i]
                L = math.sqrt(sum(x * x for x in g))
                if L > 1e-12:
                    struct.pack_into("<fff", binc, nb + i * nst, g[0] / L, g[1] / L, g[2] / L)
        print(f"  메시{mi} 정점 {n:,} · NORMAL 다시 계산")

    jb = json.dumps(js, separators=(",", ":")).encode("utf-8")
    jb += b" " * ((4 - len(jb) % 4) % 4)
    bb2 = bytes(binc) + b"\x00" * ((4 - len(binc) % 4) % 4)
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(bb2))
    out += struct.pack("<II", len(jb), 0x4E4F534A) + jb
    out += struct.pack("<II", len(bb2), 0x004E4942) + bb2
    with open(dst, "wb") as f:
        f.write(out)
    print(f"✔ {dst}")


if __name__ == "__main__":
    main()
