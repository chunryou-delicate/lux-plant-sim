#!/usr/bin/env python3
"""GLB 의 «생김새»를 잰다 — 크레딧 0. 굽기 전·후를 눈이 아니라 수로 본다.

⛔ 왜 있나 (2026-09-07 · 총괄)
  v8 이 «공» 이 된 까닭을 30크레딧 쓴 «뒤에» 알았다. 원화 앞은 3.5등신, 옆은 4등신이었다.
  ⇒ ★ 어긋난 뷰를 넣으면 Meshy 는 평균을 내어 뭉갠다. 그것을 넣기 «전에» 재야 한다.

쓰기
  python tools/char/glb_probe.py <파일.glb> [--slices=24]

내는 것
  · 상자·등신(키÷머리높이 어림)
  · 높이 24칸으로 잘라 칸마다 «가로폭·앞뒤깊이·정점수»
  ⇒ 가슴이 어느 칸에 있고 얼마나 튀어나왔는지 이 표에서 보인다.

⚠ 이 자가 «안» 하는 것
  · 잘생겼는지는 모른다. 수만 낸다. 눈으로도 봐라.
"""
import json
import struct
import sys


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, ver, total = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "glTF 가 아니다"
    off, js, binc = 12, None, None
    while off < total:
        clen, ctype = struct.unpack_from("<II", data, off)
        body = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(body.decode("utf-8"))
        elif ctype == 0x004E4942:
            binc = bytearray(body)
        off += 8 + clen + ((4 - clen % 4) % 4 if clen % 4 else 0)
    return data, js, binc


def accessor_floats(js, binc, idx):
    """접근자를 (n,3) float 목록으로. VEC3 float32 만 다룬다 — POSITION 이 그것이다."""
    acc = js["accessors"][idx]
    assert acc["type"] == "VEC3" and acc["componentType"] == 5126, "VEC3/float32 만"
    bv = js["bufferViews"][acc["bufferView"]]
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = bv.get("byteStride") or 12
    n = acc["count"]
    out = []
    for i in range(n):
        o = base + i * stride
        out.append(struct.unpack_from("<fff", binc, o))
    return out, base, stride, n


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = {a.split("=")[0]: a.split("=")[1] for a in sys.argv[1:] if "=" in a}
    path = args[0]
    slices = int(opts.get("--slices", 24))

    _, js, binc = read_glb(path)
    pts = []
    for m in js.get("meshes", []):
        for p in m["primitives"]:
            pi = p["attributes"].get("POSITION")
            if pi is None:
                continue
            v, _, _, _ = accessor_floats(js, binc, pi)
            pts.extend(v)

    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; zs = [p[2] for p in pts]
    lo = (min(xs), min(ys), min(zs)); hi = (max(xs), max(ys), max(zs))
    size = tuple(hi[i] - lo[i] for i in range(3))
    print(f"■ {path}")
    print(f"  정점 {len(pts):,} · 메시 {len(js.get('meshes', []))}")
    print(f"  상자 X {size[0]:.4f} · Y {size[1]:.4f} · Z {size[2]:.4f}")
    print(f"  바닥 {lo[1]:.4f} 꼭대기 {hi[1]:.4f}")

    print(f"\n  칸(아래→위)  높이비    가로폭    앞뒤깊이   앞끝(+Z)  뒤끝(-Z)  점수")
    h = size[1]
    for k in range(slices):
        y0 = lo[1] + h * k / slices
        y1 = lo[1] + h * (k + 1) / slices
        sel = [p for p in pts if y0 <= p[1] < y1]
        if not sel:
            print(f"   {k:2d}  {k/slices:5.2f}   (빈 칸)")
            continue
        sx = [p[0] for p in sel]; sz = [p[2] for p in sel]
        print(f"   {k:2d}  {k/slices:5.2f}  {max(sx)-min(sx):8.4f}  {max(sz)-min(sz):8.4f}  "
              f"{max(sz):8.4f}  {min(sz):8.4f}  {len(sel):6d}")


if __name__ == "__main__":
    main()
