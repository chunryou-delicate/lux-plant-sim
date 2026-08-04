#!/usr/bin/env python
"""
동작 클립을 순운동학(FK)으로 풀어 **손이 어디에 있나**를 재는 도구.

왜 만들었나
  room_view 의 actAt(가서·하고·끝난다)은 물주기·씨앗심기·수확에 쓸 클립을 골라야 한다.
  이름만 보고 고르면 틀린다. "팔을 앞으로 뻗어 기울인다"가 물주기의 조건이라
  그걸 **재서** 확인해야 한다. check_anim.py 가 골격 이상을 재는 도구라면
  이 도구는 **쓸 만한 구간을 찾는** 도구다.

무엇을 재나 (모두 Armature 로컬 좌표 · 단위 m · 캐릭터의 앞은 +Z)
  hipY      Hips 높이. 낮아지면 숙이거나 쭈그린 것이다.
  rhF/lhF   손이 몸보다 얼마나 **앞**에 나갔나 (hand.z - hips.z). 클수록 뻗은 것.
  rhY/lhY   손 높이(바닥 기준).
  rhUp      손이 Hips 보다 얼마나 위인가. 0 근처면 허리춤, 음수면 무릎 아래.
  ext       팔 폄 정도 = |어깨→손| / (|어깨→팔꿈치|+|팔꿈치→손|). 1 이면 쭉 편 팔.
  pour      물 붓는 자세 점수 0~1. 아래 pour_score() 참고.

사용법
  python probe_anim_hands.py --dir assets/characters/3d/anim --id jachwi_f
  python probe_anim_hands.py --dir ... --id jachwi_f --detail inspect
"""
import sys
import os
import glob
import math
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_anim import load, acc, sample  # noqa: E402


# ── 행렬 ───────────────────────────────────────────────────────────────
def trs(t, r, s):
    """TRS 를 4x4 행렬(행 우선 리스트 16개)로 만든다."""
    x, y, z, w = r
    x2, y2, z2 = x + x, y + y, z + z
    xx, xy, xz = x * x2, x * y2, x * z2
    yy, yz, zz = y * y2, y * z2, z * z2
    wx, wy, wz = w * x2, w * y2, w * z2
    sx, sy, sz = s
    return [
        (1 - (yy + zz)) * sx, (xy - wz) * sy, (xz + wy) * sz, t[0],
        (xy + wz) * sx, (1 - (xx + zz)) * sy, (yz - wx) * sz, t[1],
        (xz - wy) * sx, (yz + wx) * sy, (1 - (xx + yy)) * sz, t[2],
        0.0, 0.0, 0.0, 1.0,
    ]


def mmul(a, b):
    o = [0.0] * 16
    for i in range(4):
        for k in range(4):
            v = a[i * 4 + k]
            if v == 0.0:
                continue
            for jx in range(4):
                o[i * 4 + jx] += v * b[k * 4 + jx]
    return o


def mpos(m):
    return (m[3], m[7], m[11])


# ── 클립 하나 풀기 ─────────────────────────────────────────────────────
class Clip:
    def __init__(self, path):
        j, b = load(path)
        self.path = path
        self.j, self.b = j, b
        self.nodes = j["nodes"]
        self.names = [n.get("name", "") for n in self.nodes]
        self.parent = {}
        for i, n in enumerate(self.nodes):
            for c in n.get("children", []):
                self.parent[c] = i
        self.roots = [i for i in range(len(self.nodes)) if i not in self.parent]
        self.anim = (j.get("animations") or [None])[0]
        self.name = self.anim.get("name", "") if self.anim else ""
        # 이름이 "Armature|Female_Bend_Over_Pick_Up|baselayer" 꼴이다 — 가운데만 쓴다
        parts = [p for p in self.name.split("|") if p and p.lower() not in ("armature", "baselayer")]
        self.short = parts[0] if parts else self.name
        self.tracks = {}
        self.duration = 0.0
        if self.anim:
            for ch in self.anim["channels"]:
                s = self.anim["samplers"][ch["sampler"]]
                ts = acc(j, b, s["input"])
                vs = acc(j, b, s["output"])
                if ts:
                    self.duration = max(self.duration, ts[-1][0])
                self.tracks.setdefault(ch["target"]["node"], {})[ch["target"]["path"]] = (ts, vs)

    def find(self, want):
        w = want.lower()
        for i, n in enumerate(self.names):
            if n.lower() == w:
                return i
        for i, n in enumerate(self.names):
            if w in n.lower():
                return i
        return None

    def world(self, t):
        """시각 t 의 모든 노드 월드 행렬."""
        out = {}
        stack = [(r, None) for r in self.roots]
        while stack:
            i, pm = stack.pop()
            n = self.nodes[i]
            tr = list(n.get("translation", (0, 0, 0)))
            ro = list(n.get("rotation", (0, 0, 0, 1)))
            sc = list(n.get("scale", (1, 1, 1)))
            tk = self.tracks.get(i)
            if tk:
                if "translation" in tk:
                    tr = list(sample(tk["translation"][0], tk["translation"][1], t, False))
                if "rotation" in tk:
                    ro = list(sample(tk["rotation"][0], tk["rotation"][1], t, True))
                if "scale" in tk:
                    sc = list(sample(tk["scale"][0], tk["scale"][1], t, False))
            m = trs(tr, ro, sc)
            m = mmul(pm, m) if pm else m
            out[i] = m
            for c in n.get("children", []):
                stack.append((c, m))
        return out


def d3(a, b):
    return math.dist(a, b)


def pour_score(hipY, hipY0, hf, hy, ext, lean):
    """물 붓는 자세 점수 0~1 — 무엇이 물주기처럼 보이나.
       ① 손이 몸보다 앞에 나가 있다(hf). 0.18m 넘으면 '뻗었다'로 본다.
       ② 손 높이가 무릎~가슴(0.35~0.95m). 너무 낮으면 줍는 것, 너무 높으면 흔드는 것이다.
       ③ 팔이 어느 정도 펴져 있다(ext>0.75). 접힌 팔은 안는 자세다.
       ④ 몸이 살짝만 숙었다. 푹 숙이면(Hips 가 20% 넘게 내려가면) 줍기·쭈그리기다.
       네 조건을 곱한다 — 하나라도 어긋나면 점수가 죽는다. 물주기는 넷이 동시에 맞아야 한다."""
    a = min(1.0, max(0.0, (hf - 0.06) / 0.22))
    b = 1.0 - min(1.0, abs(hy - 0.62) / 0.42)
    c = min(1.0, max(0.0, (ext - 0.62) / 0.28))
    drop = (hipY0 - hipY) / max(1e-6, hipY0)
    d = 1.0 - min(1.0, max(0.0, (drop - 0.06) / 0.22))
    return a * b * c * d


def measure(path, steps=64):
    cl = Clip(path)
    if not cl.anim:
        return None
    hips = cl.find("Hips")
    rows = []
    joints = {}
    for side in ("Right", "Left"):
        joints[side] = (cl.find(side + "Arm"), cl.find(side + "ForeArm"), cl.find(side + "Hand"))
    hipY0 = None
    for k in range(steps + 1):
        t = cl.duration * k / steps
        W = cl.world(t)
        hp = mpos(W[hips]) if hips is not None else (0, 0, 0)
        if hipY0 is None:
            hipY0 = hp[1]
        r = {"t": t, "hipY": hp[1], "hipZ": hp[2]}
        for side, key in (("Right", "r"), ("Left", "l")):
            sh, el, ha = joints[side]
            if sh is None or ha is None:
                r[key + "hF"] = r[key + "hY"] = r[key + "ext"] = 0.0
                continue
            ps, pe, ph = mpos(W[sh]), mpos(W[el]), mpos(W[ha])
            chain = d3(ps, pe) + d3(pe, ph)
            r[key + "hF"] = ph[2] - hp[2]        # 앞으로 나간 정도 (+Z 가 앞)
            r[key + "hY"] = ph[1]
            r[key + "hUp"] = ph[1] - hp[1]
            r[key + "ext"] = d3(ps, ph) / chain if chain > 1e-6 else 0.0
        r["pour"] = max(
            pour_score(r["hipY"], hipY0, r["rhF"], r["rhY"], r["rext"], 0),
            pour_score(r["hipY"], hipY0, r["lhF"], r["lhY"], r["lext"], 0),
        )
        rows.append(r)
    return cl, rows


def cut_table(path, lo, hi, step=0.1):
    """구간을 **어디서 끊나**를 고르는 표.
       ------------------------------------------------------------
       subclip 은 0 초부터 잘라 쓴다. 그러면 끝을 어디로 두나가 남는데, 두 가지를 본다.
         rest  끝 자세가 첫 자세(=idle 로 넘어갈 자세)에서 얼마나 먼가[m 합].
               멀수록 되돌아가는 0.28s crossfade 가 팔·허리를 홱 낚아챈다.
         move  그 순간 몸이 얼마나 빨리 움직이고 있나[m/s 합].
               **움직이는 중에 끊는 것**이 제일 나쁘다 — 멎어 있는 지점에서 끊어야 한다.
       둘 다 작은 지점이 좋은 끊는 자리다."""
    cl, rows = measure(path, steps=int(max(60, Clip(path).duration * 20)))
    ts = [r["t"] for r in rows]

    def pose(r):
        return (r["hipY"], r["rhF"], r["rhY"], r["lhF"], r["lhY"])

    p0 = pose(rows[0])
    out = []
    t = lo
    while t <= hi + 1e-6:
        i = min(range(len(ts)), key=lambda k: abs(ts[k] - t))
        pi = pose(rows[i])
        rest = sum(abs(a - b) for a, b in zip(pi, p0))
        j = min(len(rows) - 1, i + 1)
        k = max(0, i - 1)
        dt = max(1e-6, ts[j] - ts[k])
        move = sum(abs(a - b) for a, b in zip(pose(rows[j]), pose(rows[k]))) / dt
        out.append((t, rest, move, rows[i]["hipY"]))
        t += step
    return cl, out


def best_window(rows, win, key="pour"):
    """길이 win 초짜리 창 중 평균 점수가 제일 높은 구간의 시작 시각."""
    if not rows:
        return 0.0, 0.0
    dur = rows[-1]["t"]
    if dur <= win:
        return 0.0, sum(r[key] for r in rows) / len(rows)
    best, bs = -1.0, 0.0
    for i, r in enumerate(rows):
        s = r["t"]
        if s + win > dur:
            break
        seg = [q[key] for q in rows if s <= q["t"] <= s + win]
        if not seg:
            continue
        m = sum(seg) / len(seg)
        if m > best:
            best, bs = m, s
    return bs, best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="assets/characters/3d/anim")
    ap.add_argument("--id", default="jachwi_f")
    ap.add_argument("--detail", default=None, help="한 클립을 프레임별로 찍는다")
    ap.add_argument("--win", type=float, default=2.0, help="자를 구간 길이[s]")
    ap.add_argument("--cuts", default=None, help="어디서 끊나 — 클립 이름")
    ap.add_argument("--range", default="1.2:4.0", help="--cuts 로 훑을 구간 lo:hi[s]")
    a = ap.parse_args()

    if a.cuts:
        f = [p for p in sorted(glob.glob(os.path.join(a.dir, f"char_{a.id}_*.glb")))
             if p.endswith(f"_{a.cuts}.glb")]
        if not f:
            print(f"'{a.cuts}' 이 없습니다")
            return 1
        lo, hi = (float(x) for x in a.range.split(":"))
        cl, rows = cut_table(f[0], lo, hi)
        print(f"{cl.short}  {cl.duration:.2f}s   — 끊는 자리 고르기")
        print(f"{'끊는 t':>7} {'rest(첫자세와 거리)':>20} {'move(그때 속도)':>16} {'hipY':>7}")
        for t, rest, move, hy in rows:
            print(f"{t:7.2f} {rest:20.3f} {move:16.3f} {hy:7.3f}")
        return 0

    files = sorted(glob.glob(os.path.join(a.dir, f"char_{a.id}_*.glb")))
    if not files:
        print(f"파일이 없습니다: {a.dir}/char_{a.id}_*.glb")
        return 1

    if a.detail:
        f = [p for p in files if p.endswith(f"_{a.detail}.glb")]
        if not f:
            print(f"'{a.detail}' 이 없습니다")
            return 1
        cl, rows = measure(f[0], steps=int(max(24, Clip(f[0]).duration * 15)))
        print(f"{cl.short}  {cl.duration:.2f}s")
        print(f"{'t':>6} {'hipY':>6} {'R앞':>6} {'R높이':>6} {'R폄':>5} "
              f"{'L앞':>6} {'L높이':>6} {'L폄':>5} {'붓기':>5}")
        for r in rows:
            print(f"{r['t']:6.2f} {r['hipY']:6.3f} {r['rhF']:6.3f} {r['rhY']:6.3f} {r['rext']:5.2f} "
                  f"{r['lhF']:6.3f} {r['lhY']:6.3f} {r['lext']:5.2f} {r['pour']:5.2f}")
        return 0

    print(f"{'파일':22s} {'클립 이름':40s} {'길이':>6s} {'붓기최대':>8s} "
          f"{'0초부터':>8s} {'최적구간':>9s} {'구간점수':>8s} {'앞뻗음max':>9s} {'HipY낙차':>9s}")
    for p in files:
        m = measure(p)
        base = os.path.basename(p).replace(f"char_{a.id}_", "").replace(".glb", "")
        if not m:
            print(f"{base:22s}  (애니 없음)")
            continue
        cl, rows = m
        pk = max(r["pour"] for r in rows)
        head = [r["pour"] for r in rows if r["t"] <= a.win]
        h = sum(head) / len(head) if head else 0.0
        bs, bm = best_window(rows, a.win)
        fmax = max(max(r["rhF"], r["lhF"]) for r in rows)
        hy = [r["hipY"] for r in rows]
        drop = (hy[0] - min(hy)) / max(1e-6, hy[0])
        print(f"{base:22s} {cl.short:40s} {cl.duration:6.2f} {pk:8.2f} {h:8.2f} "
              f"{bs:6.2f}~{bs + a.win:.2f} {bm:8.2f} {fmax:9.3f} {drop * 100:8.1f}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
