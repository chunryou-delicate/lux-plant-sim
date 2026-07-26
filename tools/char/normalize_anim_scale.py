#!/usr/bin/env python
"""
클립의 본 스케일 트랙을 1.0으로 정규화한다.

Meshy 애니메이션 라이브러리는 원본 모캡 골격의 키를 캐릭터에 맞추려고
Hips에 균일 스케일(관측값 1.1765)을 넣는 경우가 있다. 같은 캐릭터인데
클립마다 스케일이 달라지면 애니 전환 시 몸 크기가 튄다.
(관측: idle·Walking_Woman = 1.1765 / 리깅 기본 walking·inspect = 1.0)

기준은 리깅에 포함된 walking(1.0)이므로 전부 1.0으로 맞춘다.
치비 골격은 본 스케일 애니가 필요 없으므로 모든 scale 키를 1.0으로 만든다.

사용법:
  python normalize_anim_scale.py <파일.glb> [...]
  python normalize_anim_scale.py --dir <폴더>
"""
import json
import struct
import sys
import os
import glob

CJ = 0x4E4F534A
CB = 0x004E4942
GLB = 0x46546C67


def load(path):
    d = open(path, "rb").read()
    _, _, ln = struct.unpack("<III", d[:12])
    off, j, b, bpos = 12, None, b"", 0
    while off < ln:
        cl, ct = struct.unpack("<II", d[off:off + 8])
        if ct == CJ:
            j = json.loads(d[off + 8: off + 8 + cl].decode("utf-8"))
        elif ct == CB:
            b = d[off + 8: off + 8 + cl]
        off += 8 + cl + ((4 - cl % 4) % 4)
    return j, b


def save(path, j, b):
    js = json.dumps(j, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    bn = b + b"\x00" * ((4 - len(b) % 4) % 4)
    total = 12 + 8 + len(js) + (8 + len(bn) if bn else 0)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", GLB, 2, total))
        f.write(struct.pack("<II", len(js), CJ))
        f.write(js)
        if bn:
            f.write(struct.pack("<II", len(bn), CB))
            f.write(bn)


def normalize(path):
    j, b = load(path)
    if not j.get("animations"):
        return None
    buf = bytearray(b)
    changed = []
    for anim in j["animations"]:
        for ch in anim["channels"]:
            if ch["target"]["path"] != "scale":
                continue
            a = j["accessors"][anim["samplers"][ch["sampler"]]["output"]]
            if a["componentType"] != 5126 or a["type"] != "VEC3":
                continue
            bv = j["bufferViews"][a["bufferView"]]
            st = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
            n = a["count"] * 3
            old = struct.unpack_from("<" + "f" * n, buf, st)
            if max(abs(v - 1.0) for v in old) < 1e-4:
                continue
            struct.pack_into("<" + "f" * n, buf, st, *([1.0] * n))
            name = j["nodes"][ch["target"]["node"]].get("name", "?")
            changed.append((name, round(old[0], 4)))
            # accessor의 min/max도 갱신(있으면)
            if "min" in a:
                a["min"] = [1.0, 1.0, 1.0]
            if "max" in a:
                a["max"] = [1.0, 1.0, 1.0]
    if not changed:
        return []
    save(path, j, bytes(buf))
    return changed


def main():
    args = sys.argv[1:]
    files = sorted(glob.glob(os.path.join(args[1], "*.glb"))) if args[:1] == ["--dir"] else args
    if not files:
        print(__doc__)
        return 1
    fixed = 0
    for f in files:
        r = normalize(f)
        if r is None:
            continue
        if r:
            fixed += 1
            detail = ", ".join(f"{n}={v}" for n, v in r)
            print(f"  고침 {os.path.basename(f):42s} {detail} -> 1.0")
    print(f"\n총 {fixed}개 정규화 (나머지는 이미 1.0)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
