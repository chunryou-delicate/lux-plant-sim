#!/usr/bin/env python
"""
Meshy 애니메이션 GLB에서 메시·텍스처를 제거하고 뼈대 + 애니메이션만 남긴다.

Meshy는 애니메이션마다 스킨드 메시 전체(≈15MB)를 통째로 재출력하지만,
실제 애니메이션 데이터는 50KB 수준이다. 캐릭터 1명당 메시는 이미
char_*_rigged.glb 로 갖고 있으므로, 클립은 뼈대+트랙만 있으면 된다.
엔진에서 rigged 메시에 이 클립을 붙여 재생한다.

노드 인덱스는 그대로 보존한다(애니메이션 채널이 노드 인덱스를 가리키므로).
mesh/skin 참조만 노드에서 떼어내고, 사용되지 않는 accessor/bufferView를 버린다.

사용법:
  python strip_anim_glb.py <입력.glb> <출력.glb>
  python strip_anim_glb.py --dir <폴더>     # *_withSkin.glb 일괄 처리
"""
import json
import struct
import sys
import os
import glob

GLB_MAGIC = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, version, length = struct.unpack("<III", data[:12])
    if magic != GLB_MAGIC:
        raise ValueError(f"{path}: GLB 파일이 아님")
    gltf, bin_chunk = None, b""
    off = 12
    while off < length:
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        chunk = data[off + 8: off + 8 + clen]
        if ctype == CHUNK_JSON:
            gltf = json.loads(chunk.decode("utf-8"))
        elif ctype == CHUNK_BIN:
            bin_chunk = chunk
        off += 8 + clen + ((4 - clen % 4) % 4)
    if gltf is None:
        raise ValueError(f"{path}: JSON 청크 없음")
    return gltf, bin_chunk


def write_glb(path, gltf, bin_chunk):
    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    bn = bin_chunk + b"\x00" * ((4 - len(bin_chunk) % 4) % 4)
    total = 12 + 8 + len(js) + (8 + len(bn) if bn else 0)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", GLB_MAGIC, 2, total))
        f.write(struct.pack("<II", len(js), CHUNK_JSON))
        f.write(js)
        if bn:
            f.write(struct.pack("<II", len(bn), CHUNK_BIN))
            f.write(bn)


def strip(src, dst):
    gltf, binc = read_glb(src)
    anims = gltf.get("animations")
    if not anims:
        raise ValueError(f"{src}: 애니메이션이 없음")

    # 애니메이션이 참조하는 accessor만 수집
    used = set()
    for a in anims:
        for s in a["samplers"]:
            used.add(s["input"])
            used.add(s["output"])
    used = sorted(used)
    acc_map = {old: new for new, old in enumerate(used)}

    # accessor -> bufferView 데이터를 새 버퍼로 재구성
    new_accessors, new_views, buf = [], [], bytearray()
    for old in used:
        acc = dict(gltf["accessors"][old])
        bv = gltf["bufferViews"][acc["bufferView"]]
        start = bv.get("byteOffset", 0)
        chunk = binc[start: start + bv["byteLength"]]
        # 4바이트 정렬 유지
        pad = (4 - len(buf) % 4) % 4
        buf.extend(b"\x00" * pad)
        acc["bufferView"] = len(new_views)
        acc.pop("byteOffset", None)
        new_views.append({"buffer": 0, "byteOffset": len(buf), "byteLength": len(chunk)})
        buf.extend(chunk)
        new_accessors.append(acc)

    # 샘플러 인덱스 갱신
    for a in anims:
        for s in a["samplers"]:
            s["input"] = acc_map[s["input"]]
            s["output"] = acc_map[s["output"]]

    # 노드에서 메시·스킨 참조 제거 (인덱스는 보존)
    for n in gltf.get("nodes", []):
        n.pop("mesh", None)
        n.pop("skin", None)

    out = {
        "asset": gltf.get("asset", {"version": "2.0"}),
        "scene": gltf.get("scene", 0),
        "scenes": gltf.get("scenes", [{"nodes": [0]}]),
        "nodes": gltf.get("nodes", []),
        "animations": anims,
        "accessors": new_accessors,
        "bufferViews": new_views,
        "buffers": [{"byteLength": len(buf)}],
    }
    write_glb(dst, out, bytes(buf))
    return os.path.getsize(src), os.path.getsize(dst)


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 1
    if args[0] == "--dir":
        files = sorted(glob.glob(os.path.join(args[1], "*_withSkin.glb")))
        if not files:
            print("처리할 *_withSkin.glb 없음")
            return 1
        tot_s = tot_d = 0
        for f in files:
            dst = f.replace("_withSkin.glb", ".glb")
            s, d = strip(f, dst)
            tot_s += s
            tot_d += d
            print(f"  {os.path.basename(dst):50s} {s/1048576:7.1f}MB -> {d/1024:7.1f}KB")
        print(f"\n합계 {tot_s/1048576:.0f}MB -> {tot_d/1048576:.1f}MB "
              f"({100*(1-tot_d/tot_s):.1f}% 절감, {len(files)}개)")
    else:
        s, d = strip(args[0], args[1])
        print(f"{s/1048576:.1f}MB -> {d/1024:.1f}KB ({100*(1-d/s):.2f}% 절감)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
