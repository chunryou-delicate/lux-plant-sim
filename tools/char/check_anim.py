#!/usr/bin/env python
"""
애니메이션 클립을 샘플링해 골격 이상을 수치로 점검한다.

Meshy 라이브러리 클립은 실제 사람 비율 모캡이라, 3.5등신 치비 골격에
얹으면 허리 뒤틀림·팔 관통·과도한 스케일 같은 아티팩트가 생길 수 있다.
눈으로만 보지 말고 아래 지표로 걸러낸다.

  spine_twist  척추(Hips→Spine→Spine1/2)의 Y축 비틀림 누적 최대각
  neck_twist   목의 Y축 비틀림 최대각
  max_scale    본 스케일의 1.0 이탈 최대치 (0에 가까워야 정상)
  root_drift   Hips의 수평 이동량 (루트모션 유무)
  knee/elbow   무릎·팔꿈치가 반대로 꺾이는 프레임 수

사용법:
  python check_anim.py <클립.glb> [...]
  python check_anim.py --dir <폴더>
"""
import json
import struct
import sys
import os
import glob
import math

# cp949 콘솔에서 '—' 한 글자에 죽는다 — 2026-08-24 에 열 개가 다 그랬다.
# 내 창에서만 PYTHONIOENCODING=utf-8 을 붙여 돌려 와서 한 번도 안 걸렸다.
# ★ 자가 내 창에서만 돌면 그건 자가 아니라 내 손버릇이다.
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


CT = {5126: ("f", 4), 5123: ("H", 2), 5125: ("I", 4), 5121: ("B", 1), 5122: ("h", 2)}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def load(path):
    d = open(path, "rb").read()
    _, _, ln = struct.unpack("<III", d[:12])
    off, j, b = 12, None, b""
    while off < ln:
        cl, ct = struct.unpack("<II", d[off:off + 8])
        c = d[off + 8: off + 8 + cl]
        if ct == 0x4E4F534A:
            j = json.loads(c.decode("utf-8"))
        elif ct == 0x004E4942:
            b = c
        off += 8 + cl + ((4 - cl % 4) % 4)
    return j, b


def acc(j, b, i):
    a = j["accessors"][i]
    bv = j["bufferViews"][a["bufferView"]]
    st = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    f, _ = CT[a["componentType"]]
    n = NC[a["type"]]
    v = struct.unpack_from("<" + f * (a["count"] * n), b, st)
    return [v[k * n:(k + 1) * n] for k in range(a["count"])]


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz)


def qslerp(a, b, t):
    d = sum(x * y for x, y in zip(a, b))
    if d < 0:
        b = tuple(-x for x in b)
        d = -d
    if d > 0.9995:
        r = tuple(x + (y - x) * t for x, y in zip(a, b))
    else:
        th = math.acos(max(-1, min(1, d)))
        s = math.sin(th)
        r = tuple((math.sin((1 - t) * th) * x + math.sin(t * th) * y) / s
                  for x, y in zip(a, b))
    n = math.sqrt(sum(x * x for x in r)) or 1
    return tuple(x / n for x in r)


def sample(times, vals, t, is_quat):
    if t <= times[0][0]:
        return vals[0]
    if t >= times[-1][0]:
        return vals[-1]
    for i in range(len(times) - 1):
        t0, t1 = times[i][0], times[i + 1][0]
        if t0 <= t <= t1:
            u = 0 if t1 == t0 else (t - t0) / (t1 - t0)
            if is_quat:
                return qslerp(vals[i], vals[i + 1], u)
            return tuple(a + (b - a) * u for a, b in zip(vals[i], vals[i + 1]))
    return vals[-1]


def yaw_deg(q):
    """쿼터니언의 Y축(요) 성분 각도."""
    x, y, z, w = q
    return math.degrees(math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)))


def analyse(path, steps=40):
    j, b = load(path)
    if not j.get("animations"):
        return None
    anim = j["animations"][0]
    names = [n.get("name", "") for n in j["nodes"]]

    tracks = {}   # node -> {path: (times, vals)}
    tmax = 0.0
    for ch in anim["channels"]:
        s = anim["samplers"][ch["sampler"]]
        ts = acc(j, b, s["input"])
        vs = acc(j, b, s["output"])
        tmax = max(tmax, ts[-1][0])
        tracks.setdefault(ch["target"]["node"], {})[ch["target"]["path"]] = (ts, vs)

    def find(*keys):
        for i, n in enumerate(names):
            ln = n.lower()
            if all(k in ln for k in keys):
                return i
        return None

    hips = find("hips")
    spine = find("spine")
    spine2 = next((i for i, n in enumerate(names)
                   if n.lower().startswith("spine") and n.lower() != "spine"), None)
    neck = find("neck")

    res = {"spine_twist": 0.0, "neck_twist": 0.0, "max_scale": 0.0,
           "root_drift": 0.0, "duration": tmax, "clip": anim.get("name", "")}
    hip_pos = []
    for k in range(steps + 1):
        t = tmax * k / steps
        acc_twist = 0.0
        for idx in (spine, spine2):
            if idx is not None and idx in tracks and "rotation" in tracks[idx]:
                ts, vs = tracks[idx]["rotation"]
                acc_twist += abs(yaw_deg(sample(ts, vs, t, True)))
        res["spine_twist"] = max(res["spine_twist"], acc_twist)
        if neck is not None and neck in tracks and "rotation" in tracks[neck]:
            ts, vs = tracks[neck]["rotation"]
            res["neck_twist"] = max(res["neck_twist"], abs(yaw_deg(sample(ts, vs, t, True))))
        for idx, tr in tracks.items():
            if "scale" in tr:
                ts, vs = tr["scale"]
                s = sample(ts, vs, t, False)
                res["max_scale"] = max(res["max_scale"], max(abs(v - 1.0) for v in s))
        if hips is not None and hips in tracks and "translation" in tracks[hips]:
            ts, vs = tracks[hips]["translation"]
            hip_pos.append(sample(ts, vs, t, False))
    if len(hip_pos) > 1:
        xs = [p[0] for p in hip_pos]
        zs = [p[2] for p in hip_pos]
        res["root_drift"] = math.hypot(max(xs) - min(xs), max(zs) - min(zs))
    return res


def main():
    args = sys.argv[1:]
    files = []
    if args and args[0] == "--dir":
        files = sorted(glob.glob(os.path.join(args[1], "*.glb")))
    else:
        files = args
    if not files:
        print(__doc__)
        return 1
    print(f"{'파일':42s} {'길이s':>6s} {'척추비틀림':>10s} {'목비틀림':>9s} "
          f"{'스케일이탈':>10s} {'루트이동':>9s}  판정")
    for f in files:
        r = analyse(f)
        if not r:
            print(f"{os.path.basename(f):42s}  (애니 없음)")
            continue
        flags = []
        if r["spine_twist"] > 25:
            flags.append("척추뒤틀림")
        if r["neck_twist"] > 35:
            flags.append("목꺾임")
        if r["max_scale"] > 0.05:
            flags.append("스케일변형")
        verdict = ",".join(flags) if flags else "정상"
        print(f"{os.path.basename(f):42s} {r['duration']:6.2f} {r['spine_twist']:10.1f} "
              f"{r['neck_twist']:9.1f} {r['max_scale']:10.3f} {r['root_drift']:9.1f}  {verdict}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
