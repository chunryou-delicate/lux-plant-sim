#!/usr/bin/env python
"""
캐릭터/마스코트 GLB의 경량본(lq)을 만든다. 원본은 건드리지 않는다.

Meshy 원본은 쿼드 토폴로지로 조밀해서 캐릭터 19만 / 몬이 31만 삼각형이다.
게임 카메라에서 캐릭터는 화면상 110~340px, 얼굴은 24~48px이라 과잉이다.
초상화·클로즈업에는 원본을 쓰고, 게임 화면에는 lq를 쓴다.

  캐릭터  삼각형 x0.10 (약 1.9만), 텍스처 1024
  몬이    삼각형 x0.016 (약 6.9천), 텍스처 512

meshoptimizer(gltf-transform)를 쓰므로 JOINTS_0/WEIGHTS_0 스킨 웨이트와
애니메이션 채널이 보존된다. trimesh 계열로 줄이면 스킨이 날아간다.
노드 이름이 그대로라 3d/anim/ 의 스트립된 클립도 lq 리깅 메시에 그대로 붙는다.

사용법
  python make_lq_glb.py            # assets/characters/3d -> 3d/lq
  python make_lq_glb.py --only mascot
"""
import json
import os
import subprocess
import sys
import glob
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "assets", "characters", "3d")
DST = os.path.join(SRC, "lq")

CHAR = dict(ratio=0.10, error=0.002, tex=1024)
MASCOT = dict(ratio=0.016, error=0.002, tex=512)

sys.path.insert(0, HERE)
from rescale_char_glb import load, world_bounds, target_for  # noqa: E402


def gt(*args):
    """gltf-transform CLI. npx 캐시를 쓰므로 전역 설치가 필요 없다."""
    cmd = ["npx", "--yes", "@gltf-transform/cli@latest"] + list(args)
    r = subprocess.run(cmd, capture_output=True, text=True, shell=(os.name == "nt"))
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip()[-400:])


def stats(path):
    j, b = load(path)
    tri = sum(j["accessors"][pr["indices"]]["count"] // 3
              for m in j.get("meshes", []) for pr in m["primitives"] if "indices" in pr)
    lo, hi = world_bounds(j, b)
    attrs = set()
    for m in j.get("meshes", []):
        for pr in m["primitives"]:
            attrs |= set(pr["attributes"])
    return dict(tri=tri, h=hi[1] - lo[1], foot=lo[1], mb=os.path.getsize(path) / 1e6,
                skinned="JOINTS_0" in attrs,
                bones=len(j["skins"][0]["joints"]) if j.get("skins") else 0,
                chans=sum(len(a["channels"]) for a in j.get("animations", [])),
                names=set(n.get("name") for n in j.get("nodes", [])))


def build(src, dst, cfg, tmp):
    gt("simplify", src, tmp, "--ratio", str(cfg["ratio"]), "--error", str(cfg["error"]))
    gt("resize", tmp, dst, "--width", str(cfg["tex"]), "--height", str(cfg["tex"]))
    os.remove(tmp)


def main():
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1]
    os.makedirs(DST, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC, "char_*.glb")))
    if only:
        files = [f for f in files if only in os.path.basename(f)]

    tmp = os.path.join(DST, "_tmp.glb")
    print("  %-38s %19s %17s %s" % ("파일", "삼각형", "용량MB", "검증"))
    fails = []
    for f in files:
        name = os.path.basename(f)
        cfg = MASCOT if "mascot" in name else CHAR
        out = os.path.join(DST, name)
        a = stats(f)
        try:
            build(f, out, cfg, tmp)
        except Exception as e:
            fails.append((name, str(e)))
            print("  %-38s  실패: %s" % (name, str(e)[:60]))
            continue
        b = stats(out)
        # 감축이 깨뜨리기 쉬운 것들: 스킨 웨이트 / 본 수 / 애니 채널 / 실스케일 / 노드 이름
        chk = []
        if a["skinned"] != b["skinned"]:
            chk.append("스킨소실")
        if a["bones"] != b["bones"]:
            chk.append("본 %d->%d" % (a["bones"], b["bones"]))
        if a["chans"] != b["chans"]:
            chk.append("애니 %d->%d" % (a["chans"], b["chans"]))
        if abs(b["h"] - target_for(name)) > 0.01:
            chk.append("키 %.3f" % b["h"])
        if abs(b["foot"]) > 0.01:
            chk.append("발바닥 %.3f" % b["foot"])
        missing = a["names"] - b["names"]
        if missing:
            chk.append("노드소실 %d개" % len(missing))
        ok = "OK" if not chk else "  ".join(chk)
        if chk:
            fails.append((name, ok))
        print("  %-38s %8d -> %-7d %6.1f -> %-5.2f  %s"
              % (name, a["tri"], b["tri"], a["mb"], b["mb"], ok))

    if os.path.exists(tmp):
        os.remove(tmp)
    sa = sum(os.path.getsize(f) for f in files) / 1e6
    sb = sum(os.path.getsize(os.path.join(DST, os.path.basename(f)))
             for f in files if os.path.exists(os.path.join(DST, os.path.basename(f)))) / 1e6
    print("\n  합계 %.0fMB -> %.0fMB (%.1f%%)" % (sa, sb, sb / sa * 100 if sa else 0))
    if fails:
        print("  문제 %d건:" % len(fails))
        for n, m in fails:
            print("   ", n, m)
        return 1
    print("  전 파일 스킨/본/애니/실스케일/노드이름 보존 확인")
    return 0


if __name__ == "__main__":
    sys.exit(main())
