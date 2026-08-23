# -*- coding: utf-8 -*-
"""새로 리깅한 캐릭터가 **기존 클립 128개를 받는가**를 잰다.

2026-08-23 · 캐릭터 베이스를 새로 구축하면서 만든 자다.

■ 왜 필요한가

모션 128개는 384크레딧짜리다. 새 베이스에 안 붙으면 그걸 다시 구워야 한다.
새 베이스는 **T포즈**로 뽑는데(리깅 품질 때문) 기존 8종은 **A포즈**였다. 그래서 잰다.

■ ★ 이 자를 만들면서 내가 두 번 틀렸다 — 그대로 적는다

**첫 번째** — 본 길이가 8% 넘게 다르면 X 로 잡았다. 그런데 **기존 8종끼리 돌리니 X 가 났다.**
클립을 실제로 공유하는 짝인데도. 8% 는 내가 지어낸 숫자였다.

**두 번째** — 왜 그런지 재 봤다. 클립은 `rotation` 만 쓰는 줄 알았는데
**`translation`·`scale` 채널이 24본 전부에 걸려 있다**(실측). 즉 **클립이 재생되는 순간
본 길이가 통째로 덮인다.** 캐릭터 고유의 뼈 길이는 재생 중엔 존재하지 않는다.
그래서 비율이 달라도 클립이 공유됐던 것이다.

**정상값을 재 보니 기존 8종끼리 최대 68.7% 까지 벌어진다**(남가장 vs 남주부).
⇒ 본 길이는 **합격/불합격 기준이 될 수 없다.** 참고로만 찍는다.

> 교훈: **자를 만들면 「이미 옳다고 아는 것」에 먼저 대 봐야 한다.**
> 안 그러면 멀쩡한 것을 빨갛게 찍는다. 이 저장소가 오늘 같은 사고를 세 번 냈다.

■ 그래서 무엇이 진짜 관문인가

  ① 본 이름 집합      → 다르면 그 채널이 **조용히 무시된다.** 진짜 불합격
  ② 부모-자식 관계    → 다르면 회전이 엉뚱한 데로 전파된다. 진짜 불합격
  ③ 본 길이           → 참고만. 클립이 덮으므로 붙는 것과 무관하다

★ 그리고 이 자가 **못 재는 것**: 붙은 다음이 보기에 맞는가.
  A포즈로 구운 클립을 T포즈 바인드에 얹으면 붙기는 붙어도 살이 접히는 모양이 달라진다.
  그건 `assets/characters/motion_library.html` 로 **눈으로** 봐야 한다.
  **이 자가 O 를 내도 「된다」고 적지 말 것.** O 는 「조건은 갖췄다」까지다.

■ 쓰는 법

    python tools/char/check_skeleton_match.py <새_rigged.glb> [--ref <기준.glb>]
"""
import json, struct, os, sys, math

# cp949 콘솔에서 '—' 한 글자에 죽는다 — 2026-08-24 에 열 개가 다 그랬다.
# 내 창에서만 PYTHONIOENCODING=utf-8 을 붙여 돌려 와서 한 번도 안 걸렸다.
# ★ 자가 내 창에서만 돌면 그건 자가 아니라 내 손버릇이다.
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_REF = os.path.join(ROOT, "assets", "characters", "3d",
                           "char_jachwi_f_rigged.glb")
KNOWN_SPREAD = 0.687     # 기존 8종끼리의 최대 본길이 편차 [실측 2026-08-23]


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    if data[:4] != b"glTF":
        raise SystemExit("GLB 가 아니다: %s" % path)
    off, js = 12, None
    while off < len(data):
        ln, ty = struct.unpack_from("<II", data, off)
        if ty == 0x4E4F534A:
            js = json.loads(data[off + 8: off + 8 + ln].decode("utf-8"))
        off += 8 + ln + ((4 - ln % 4) % 4 if ln % 4 else 0)
    return js


def skeleton(js):
    if not js.get("skins"):
        raise SystemExit("skin 이 없다 — 리깅 안 된 GLB 다")
    joints = js["skins"][0]["joints"]
    name = {i: (js["nodes"][i].get("name") or "?") for i in range(len(js["nodes"]))}
    parent = {}
    for i, n in enumerate(js["nodes"]):
        for c in n.get("children", []):
            parent[c] = i
    out = {}
    for i in joints:
        t = js["nodes"][i].get("translation", [0, 0, 0])
        p = parent.get(i)
        out[name[i]] = dict(parent=name[p] if p is not None else None,
                            length=math.sqrt(sum(v * v for v in t)))
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit("쓰는 법: check_skeleton_match.py <새_rigged.glb> [--ref <기준.glb>]")
    new_path = sys.argv[1]
    ref_path = sys.argv[sys.argv.index("--ref") + 1] if "--ref" in sys.argv else DEFAULT_REF

    new = skeleton(read_glb(new_path))
    ref = skeleton(read_glb(ref_path))

    print("기준 %s  (%d본)" % (os.path.basename(ref_path), len(ref)))
    print("새것 %s  (%d본)" % (os.path.basename(new_path), len(new)))
    print()

    fail = []

    miss = sorted(set(ref) - set(new))
    extra = sorted(set(new) - set(ref))
    if miss or extra:
        fail.append("이름")
        print("[1] 본 이름   X   ← 진짜 불합격")
        if miss:
            print("    기준에 있는데 새것에 없다 (%d): %s" % (len(miss), " ".join(miss)))
            print("    -> 이 본을 건드리는 클립 채널은 **오류 없이 조용히 무시된다.**")
        if extra:
            print("    새것에만 있다 (%d): %s" % (len(extra), " ".join(extra)))
    else:
        print("[1] 본 이름   O   %d본 완전 일치" % len(ref))

    common = sorted(set(ref) & set(new))

    bad = [b for b in common if ref[b]["parent"] != new[b]["parent"]]
    if bad:
        fail.append("계층")
        print("[2] 부모 관계 X   %d본 다름  ← 진짜 불합격" % len(bad))
        for b in bad[:8]:
            print("    %-18s 기준 %-16s -> 새것 %s"
                  % (b, ref[b]["parent"], new[b]["parent"]))
    else:
        print("[2] 부모 관계 O")

    pairs = [b for b in common
             if ref[b]["length"] > 1e-6 and new[b]["length"] > 1e-6]
    if pairs:
        ratios = sorted(new[b]["length"] / ref[b]["length"] for b in pairs)
        scale = ratios[len(ratios) // 2]
        dev = max(abs((new[b]["length"] / ref[b]["length"]) / scale - 1) for b in pairs)
        note = "기존 8종끼리도 %.0f%% 까지 벌어진다 — 불합격 아님" % (KNOWN_SPREAD * 100)
        print("[3] 본 길이   -   전체 배율 %.3f · 최대 편차 %.0f%%   (%s)"
              % (scale, dev * 100, note))
        print("    클립이 translation 을 24본 전부 덮어쓰므로 붙는 것과 무관하다.")
        if abs(scale - 1.0) > 0.02:
            print("    * 전체 배율이 1.0 이 아니다 = 키가 다르게 구워졌다.")
            print("      rescale_char_glb.py 의 __scale_root 래퍼로 맞춘다.")

    print()
    if fail:
        print("판정: X  (%s)" % " · ".join(fail))
        print("  ⇒ 기존 클립 128개를 그대로 못 쓴다. **총괄에 즉시 보고할 것.**")
        print("     길 둘 — A포즈로 다시 뽑거나, 클립을 다시 굽는다(384크레딧).")
        sys.exit(1)

    print("판정: O  이름·계층이 맞다. **클립이 붙을 조건은 갖췄다.**")
    print("  ⚠ 이건 조건이지 확인이 아니다. 붙은 뒤 모양이 맞는지는 이 자가 못 잰다.")
    print("     motion_library.html 로 눈으로 보기 전에는 「된다」고 적지 말 것.")


if __name__ == "__main__":
    main()
