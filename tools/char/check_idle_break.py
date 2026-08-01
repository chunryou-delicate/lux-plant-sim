# -*- coding: utf-8 -*-
"""기존 모션 16종 중 어느 것이 'idle 변주'로 쓸 수 있는지 잰다.

캐릭터별 성격을 새 모션 생성 없이 표현하려면(박사님 ㉮안, 2026-08-01),
기본 idle 루프 사이에 가끔 끼워 넣을 클립이 필요하다. Meshy 를 다시 부르기 전에
이걸로 걸러 크레딧을 아낀다.

판정 기준 — 두 가지만 본다:

  1. 서 있나          Hips 의 **절대** 높이를 rest 대비 비율로 본다.
                      범위(min~max)로 재면 처음부터 앉아 있는 클립(sit)이
                      "안 움직이니 서 있다"로 오판된다. 2026-08-01에 실제로 그랬다.
  2. 시작=끝인가      끝 자세가 다르면 idle 로 돌아갈 때 툭 튄다.

  루트 이동(drift)은 **탈락 사유가 아니다.** 걷기와 같은 방식으로 Hips XZ 를
  매 프레임 고정하면 제자리가 된다(`_room_tuner.html` 이 이미 그렇게 한다).
  참고로만 찍는다.

단위 주의 — 클립 좌표는 미터가 아니다. 이 골격은 Hips rest Y = 66.8 이다.
그래서 전부 **Hips rest 대비 비율(%)** 로 낸다.
"""
import json, struct, os, math

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ANIM = os.path.join(ROOT, "assets", "characters", "3d", "anim")
CHAR = "char_namja_jachwi"          # 골격·클립이 8종 공통이라 한 명만 재면 된다


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    assert data[:4] == b"glTF", path
    off, js, bin_ = 12, None, b""
    while off < len(data):
        ln, ty = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + ln]
        if ty == 0x4E4F534A:
            js = json.loads(chunk.decode("utf-8"))
        elif ty == 0x004E4942:
            bin_ = chunk
        off += 8 + ln + ((4 - ln % 4) % 4 if ln % 4 else 0)
    return js, bin_


CTYPE = {5126: ("f", 4), 5123: ("H", 2), 5121: ("B", 1), 5125: ("I", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def acc(js, bin_, i):
    a = js["accessors"][i]
    bv = js["bufferViews"][a["bufferView"]]
    n = NCOMP[a["type"]]
    fmt, sz = CTYPE[a["componentType"]]
    base = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride") or n * sz
    return [struct.unpack_from("<" + fmt * n, bin_, base + k * stride)
            for k in range(a["count"])]


def quat_angle(a, b):
    d = abs(max(-1.0, min(1.0, sum(x * y for x, y in zip(a, b)))))
    return math.degrees(2 * math.acos(d))


def measure(path):
    js, bin_ = read_glb(path)
    if not js.get("animations"):
        return None
    anim = js["animations"][0]
    names = {i: (n.get("name") or "") for i, n in enumerate(js["nodes"])}
    hips_i = next((i for i, n in names.items() if n.lower() == "hips"), None)
    hips_rest = js["nodes"][hips_i].get("translation", [0, 1, 0])[1]

    dur, pose_delta, worst = 0.0, 0.0, ""
    hips_y, hips_xz = [], []

    for ch in anim["channels"]:
        s = anim["samplers"][ch["sampler"]]
        t = [v[0] for v in acc(js, bin_, s["input"])]
        v = acc(js, bin_, s["output"])
        if not t:
            continue
        dur = max(dur, t[-1])
        node, p = names.get(ch["target"]["node"], ""), ch["target"]["path"]
        if p == "rotation" and len(v) >= 2:
            a = quat_angle(v[0], v[-1])
            if a > pose_delta:
                pose_delta, worst = a, node
        if p == "translation" and ch["target"]["node"] == hips_i:
            hips_y = [x[1] for x in v]
            hips_xz = [(x[0], x[2]) for x in v]

    # 절대 높이 비율 — 범위가 아니라 rest 대비 실제 위치
    lo = (min(hips_y) / hips_rest * 100) if hips_y else 100.0
    mean = (sum(hips_y) / len(hips_y) / hips_rest * 100) if hips_y else 100.0
    drift = 0.0
    if hips_xz:
        xs, zs = [p[0] for p in hips_xz], [p[1] for p in hips_xz]
        drift = math.hypot(max(xs) - min(xs), max(zs) - min(zs)) / hips_rest * 100

    return dict(dur=dur, pose=pose_delta, joint=worst,
                lo=lo, mean=mean, drift=drift, rest=hips_rest)


def main():
    rows = []
    for fn in sorted(os.listdir(ANIM)):
        if fn.startswith(CHAR + "_"):
            m = measure(os.path.join(ANIM, fn))
            if m:
                rows.append((fn[len(CHAR) + 1:-4], m))

    print("Hips rest = %.1f 단위 (미터 아님). 아래는 전부 rest 대비 %%\n"
          % rows[0][1]["rest"])
    print("%-15s %6s %7s %8s %8s %8s  %s" %
          ("clip", "길이", "끝자세", "최저Hips", "평균Hips", "이동", "판정"))
    print("-" * 84)

    ok, no = [], []
    for clip, m in sorted(rows, key=lambda r: (-r[1]["mean"], r[1]["pose"])):
        why = []
        if m["mean"] < 88:
            why.append("서 있지 않음(평균 %.0f%%)" % m["mean"])
        elif m["lo"] < 80:
            why.append("중간에 앉음(%.0f%%)" % m["lo"])
        if m["pose"] > 25:
            why.append("끝자세 %.0f도 어긋남(%s)" % (m["pose"], m["joint"]))
        if m["dur"] > 12.0:
            why.append("김 %.0fs" % m["dur"])
        v = "O" if not why else "X " + " / ".join(why)
        (ok if not why else no).append(clip)
        print("%-15s %5.1fs %6.0f도 %7.0f%% %8.0f%% %7.0f%%  %s" %
              (clip, m["dur"], m["pose"], m["lo"], m["mean"], m["drift"], v))

    print()
    print("서서 하는 변주 %2d종: %s" % (len(ok), " ".join(ok)))
    print("부적합         %2d종: %s" % (len(no), " ".join(no)))
    print("\n* 이동(drift)은 탈락 사유가 아니다 — Hips XZ 고정으로 제자리가 된다.")
    print("* 이 도구가 못 재는 것: 그 동작이 그 성격으로 보이는가."
          " 그건 motion_library.html 로 눈으로 봐야 한다.")


if __name__ == "__main__":
    main()
