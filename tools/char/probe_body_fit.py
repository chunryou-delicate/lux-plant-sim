# -*- coding: utf-8 -*-
"""새로 뽑은 몸/옷이 **기존 것과 맞나**를 잰다 — 뽑기 «전»에 지어 둔 자.

2026-09-07 · [Char] · 크레딧 0

■ 왜 «미리» 짓나

총괄이 맨몸 시험(약 45크레딧)을 건다. 결과가 오면 넷을 재야 한다:

    ① 옷이 몸을 «뚫나»          ⇒ 높이대별 폭을 견준다
    ② 두 메시 «치수»가 어긋나나  ⇒ 같은 자
    ③ 기존 8캐릭과 «같은 키»인가
    ④ ★ 뼈대가 «24뼈 표준»인가   ⇐ 안 되면 동작 128개를 못 쓴다. 제일 큰 것

⇒ ★ 물건이 온 «다음»에 자를 지으면, 자가 틀렸는지 물건이 틀렸는지 못 가른다.
  ⇒ ⇒ **기존 8개로 자를 «맞춰» 두면, 새 것 하나만 달라도 그것이 답이다.**

■ ⛔ 스킨드 메시를 어떻게 재나

three.js 의 Box3.setFromObject 는 스킨드 메시를 «못» 잰다(README §8).
⇒ ★ 그래서 **GLB 의 POSITION 접근자에 박힌 min/max** 를 읽는다. 바인드 포즈 기준이다.
⇒ ⇒ 이건 파일에 «이미 적혀 있는» 수다. 내가 셈하지 않는다.

■ ⛔⛔ **이 자는 «뼈대»를 안 잰다. 뼈대는 `check_skeleton_match.py` 가 잰다**

    이 자                 메시·치수·높이별 폭 · 뼈 «이름 차례»만 곁눈질
    check_skeleton_match  ★ 본 이름 집합 · ★★ **부모-자식 관계** · 본 길이

⇒ ★ **부모 관계가 다르면 회전이 엉뚱한 데로 전파된다 — 진짜 불합격이다.** 이 자는 그것을 «못 본다».
⇒ ⇒ 그러니 새 리깅을 받으면 **둘 다 돌린다.** 겹치는 것이 아니라 «겹쳐 보는» 것이다.

⚠ 2026-09-07 · 나는 `check_skeleton_match.py`(2026-08-23)가 있는 줄 모르고 이 자를 지었다.
  ⇒ ★ 틀린 수를 낸 것이 아니라 **맞는 수를 «두 번»** 냈다. 틀린 답이 안 나와서 «안 보이는» 흠이다.
  ⇒ ⇒ **자를 짓기 전에 `ls tools/char/` 를 먼저 본다.** 스무 개뿐이라 세 줄이면 읽는다.

■ ⛔ 이 자가 «못» 하는 것

  · 「진짜로 뚫리나」는 못 본다. **폭만** 견준다 — 옷이 몸보다 좁으면 뚫릴 «수» 있다는 뜻이다
    ⇒ ★ 눈으로 봐야 한다. 이 자는 «볼 곳»을 좁혀 줄 뿐이다
  · 「같은 뼈 이름 = 같은 뼈대」라고 못 한다. ★ 길이는 안 잰다
    ⇒ 9리그의 뼈 길이가 68.7% 벌어져도 이름은 같았다(2026-09-07 · 5크레딧 시험)
  · ★★ **`__scale_root` 래퍼를 안 본다.** POSITION 의 min/max 만 읽는다.
    ⇒ 그러니 이 자의 「키」는 **«래퍼를 걷어낸» 값**이다 — 게임에서 도는 실제 키가 아니다.
    ⇒ ⇒ 기존 8캐릭은 전부 1.7000 으로 나온 뒤 `rescale_char_glb.py` 가 여캐 1.40m 로 줄인다.
      ⇒ ★ 곧 이 자의 「1.7000 이 같다」는 **「같은 출발선이다」**는 뜻이지 「같은 키다」가 아니다.
      ⇒ ⇒ ⛔ 2026-09-07 에 나는 그것을 «모르고» 냈다. 우연히 더 쓸모 있는 답이었을 뿐이다.

■ 쓰는 법

    python tools/char/probe_body_fit.py --ref            # 기존 8개로 «기준»을 뽑아 적는다
    python tools/char/probe_body_fit.py 새것.glb         # 기준과 견준다(③④)
    python tools/char/probe_body_fit.py 몸.glb 옷.glb    # 둘을 견준다(①②)
"""
import array
import glob
import io
import json
import os
import struct
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
REF = os.path.join(HERE, '_body_ref.json')

CT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

BANDS = [('어깨', 0.80, 0.88), ('가슴', 0.68, 0.78),
         ('엉덩이', 0.48, 0.56), ('허벅지', 0.30, 0.42)]


def glb(path):
    """JSON 청크와 BIN 청크를 낸다."""
    with open(path, 'rb') as f:
        magic, _ver, total = struct.unpack('<4sII', f.read(12))
        if magic != b'glTF':
            raise ValueError('glTF 가 아니다')
        js = bn = None
        while f.tell() < total:
            ln, kind = struct.unpack('<I4s', f.read(8))
            d = f.read(ln)
            if kind == b'JSON':
                js = json.loads(d.decode('utf-8'))
            elif kind[:3] == b'BIN':
                bn = d
    return js, bn


def bones(g):
    """뼈 이름을 «뼈대 차례대로» 낸다."""
    out = []
    for sk in g.get('skins', []):
        out.append([g['nodes'][j].get('name', '#%d' % j) for j in sk.get('joints', [])])
    return out


def bbox(g):
    """★ POSITION 접근자의 min/max — 파일에 «이미 적힌» 수다."""
    lo = [1e9] * 3
    hi = [-1e9] * 3
    for m in g.get('meshes', []):
        for p in m.get('primitives', []):
            ai = p.get('attributes', {}).get('POSITION')
            if ai is None:
                continue
            a = g['accessors'][ai]
            if 'min' not in a or 'max' not in a:
                continue
            for k in range(3):
                lo[k] = min(lo[k], a['min'][k])
                hi[k] = max(hi[k], a['max'][k])
    if lo[0] > 1e8:
        return None
    return dict(lo=lo, hi=hi, size=[round(hi[k] - lo[k], 4) for k in range(3)])


def verts(g, bn):
    """POSITION 을 실제로 읽는다 — 높이대별 폭을 재려면 점이 필요하다."""
    pts = []
    if bn is None:
        return pts
    for m in g.get('meshes', []):
        for p in m.get('primitives', []):
            ai = p.get('attributes', {}).get('POSITION')
            if ai is None:
                continue
            a = g['accessors'][ai]
            if a.get('componentType') != 5126 or a.get('type') != 'VEC3':
                continue
            bv = g['bufferViews'][a['bufferView']]
            off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
            n = a['count'] * 3
            arr = array.array('f')
            arr.frombytes(bn[off:off + n * 4])
            pts += [tuple(arr[i:i + 3]) for i in range(0, len(arr) - 2, 3)]
    return pts


def width_bands(pts):
    """키를 0~1 로 보고 띠마다 «가로 폭»을 잰다."""
    if not pts:
        return {}
    ys = [p[1] for p in pts]
    y0, y1 = min(ys), max(ys)
    h = y1 - y0
    if h <= 0:
        return {}
    out = {}
    for nm, a, b in BANDS:
        sel = [p for p in pts if a <= (p[1] - y0) / h <= b]
        if len(sel) < 8:
            out[nm] = None
            continue
        xs = [p[0] for p in sel]
        zs = [p[2] for p in sel]
        out[nm] = (round(max(xs) - min(xs), 4), round(max(zs) - min(zs), 4))
    return out


def warn_arms(w):
    """★ 「말이 되나」 칸 — 몸통보다 넓은 띠가 있으면 그 띠에는 «팔»이 섞인 것이다.

    ⚠⚠ 처음 재고 그냥 넘길 뻔했다. 기존 8개에서 «허벅지 1.0614 > 어깨 0.6467» 이 나왔다.
      ⇒ 사람의 허벅지가 어깨보다 넓을 리 없다. ★ A-포즈로 내린 «팔·손»이 그 높이에 있다.
      ⇒ ⇒ 그러니 **그 띠로 옷을 견주면 「옷이 좁다」가 «늘» 뜬다.** 팔은 옷이 아니다.
    ⇒ ★★ 재는 자에 「말이 되나」 칸을 같이 두라는 것을 또 지킨다(§probe_char_px).
      ⇒ ⇒ 폭 916px 을 잡아낸 것도 「사람일 리 없다」였다."""
    sh = w.get('어깨')
    if not sh:
        return
    bad = [nm for nm in ('가슴', '엉덩이', '허벅지')
           if w.get(nm) and w[nm][0] > sh[0] * 1.05]
    if bad:
        print('    ⚠ 어깨보다 넓은 띠: %s ⇒ ★ 그 띠에는 «팔»이 섞였다.'
              ' 옷 견주기에 쓰지 말 것' % ', '.join(bad))


def describe(path):
    g, bn = glb(path)
    bb = bbox(g)
    bl = bones(g)
    print('■ %s' % os.path.basename(path))
    if bb:
        print('  치수(바인드 포즈)  가로 %.4f · ★ 키 %.4f · 깊이 %.4f' % tuple(bb['size']))
    print('  뼈대 %d벌 · 뼈 %s' % (len(bl), ' / '.join(str(len(b)) for b in bl) or '없음'))
    w = width_bands(verts(g, bn))
    for nm, _a, _b in BANDS:
        v = w.get(nm)
        print('    %-6s 폭 %s' % (nm, ('%.4f x %.4f' % v) if v else '(점이 모자람)'))
    warn_arms(w)
    return dict(path=path, size=bb['size'] if bb else None,
                bones=bl[0] if bl else [], nbones=len(bl[0]) if bl else 0, bands=w)


def build_ref():
    rows = [describe(p) for p in sorted(glob.glob(
        os.path.join(ROOT, 'assets', 'characters', '3d', '*_rigged.glb')))]
    if not rows:
        print('⛔ 기존 rigged GLB 를 못 찾았다')
        return 2
    sets = {}
    for r in rows:
        sets.setdefault(tuple(r['bones']), []).append(os.path.basename(r['path']))
    print('\n★ %d개 중 «뼈대 이름 차례»가 %d가지' % (len(rows), len(sets)))
    for k, v in sets.items():
        print('  · 뼈 %d개 — %d캐릭' % (len(k), len(v)))
    if len(sets) > 1:
        print('  ⛔ 기존끼리도 «다르다» — 그러면 이 기준은 못 쓴다. ★ 먼저 이것을 풀 것')
    hs = [r['size'][1] for r in rows if r['size']]
    print('★ 키 %.4f ~ %.4f (벌어짐 %.1f%%)' % (min(hs), max(hs), (max(hs) / min(hs) - 1) * 100))
    ref = dict(bones=list(list(sets)[0]), n=len(rows), h_lo=min(hs), h_hi=max(hs),
               bands={os.path.basename(r['path']): r['bands'] for r in rows})
    io.open(REF, 'w', encoding='utf-8').write(json.dumps(ref, ensure_ascii=False, indent=1))
    print('적었다: %s' % os.path.relpath(REF, ROOT))
    return 0


def compare(rows):
    if not os.path.exists(REF):
        print('\n⚠ 기준이 없다 — 먼저 `--ref` 로 지을 것')
        return
    ref = json.loads(io.open(REF, encoding='utf-8').read())
    print('\n★★ ④ 뼈대 — 기존 %d캐릭 기준과 견줌' % ref['n'])
    for r in rows:
        base = os.path.basename(r['path'])
        if not r['bones']:
            print('  ⛔ %s: 뼈대가 «없다» — 리깅 안 됨. ★ 동작 128개를 못 쓴다' % base)
            continue
        same = list(r['bones']) == ref['bones']
        print('  %s %s: 뼈 %d개 · 이름 차례 %s'
              % ('✔' if same else '⛔', base, r['nbones'], '같다' if same else '★ 다르다'))
        if not same:
            miss = [b for b in ref['bones'] if b not in r['bones']]
            extra = [b for b in r['bones'] if b not in ref['bones']]
            if miss:
                print('      없는 뼈 %d: %s' % (len(miss), ', '.join(miss[:6])))
            if extra:
                print('      새 뼈 %d: %s' % (len(extra), ', '.join(extra[:6])))
            if not miss and not extra:
                print('      ★ 이름은 같은데 «차례»가 다르다 — 그것만으로도 동작이 어긋난다')
    print('★ ③ 키 — 기존은 %.4f ~ %.4f' % (ref['h_lo'], ref['h_hi']))
    for r in rows:
        if not r['size']:
            continue
        h = r['size'][1]
        ok = ref['h_lo'] * 0.9 <= h <= ref['h_hi'] * 1.1
        print('  %s %s: %.4f' % ('✔' if ok else '⚠', os.path.basename(r['path']), h))


def fit(a, b):
    print('\n★★ ①② 옷이 몸을 뚫나 — 띠마다 «폭»을 견준다')
    print('   (%s = 몸 · %s = 옷 으로 본다)'
          % (os.path.basename(a['path']), os.path.basename(b['path'])))
    bad = 0
    sh = a['bands'].get('어깨')
    for nm, _x, _y in BANDS:
        va, vb = a['bands'].get(nm), b['bands'].get(nm)
        if not va or not vb:
            print('  %-6s (못 잼)' % nm)
            continue
        d = [(vb[i] - va[i]) / va[i] * 100 for i in (0, 1)]
        tight = d[0] < 0 or d[1] < 0
        # ★ 팔이 섞인 띠는 «세지 않는다» — 팔은 옷이 아니다(warn_arms 참조)
        arms = bool(sh) and va[0] > sh[0] * 1.05
        bad += 1 if (tight and not arms) else 0
        print('  %-6s 몸 %.3f x %.3f · 옷 %.3f x %.3f  ⇒ %+.1f%% / %+.1f%% %s'
              % (nm, va[0], va[1], vb[0], vb[1], d[0], d[1],
                 ('⚠ 팔이 섞인 띠 — 안 센다' if arms else
                  ('⛔ 옷이 «좁다» — 뚫릴 수 있다' if tight else ''))))
    print('  ⇒ %s' % ('⛔ %d띠에서 옷이 좁다. ★ 눈으로 볼 것' % bad if bad
                      else '✔ 어느 띠에서도 옷이 몸보다 좁지 않다'))
    print('  ⛔ 이 자는 «진짜 뚫리나»를 못 본다. 폭만 견준다 — 볼 곳을 좁혀 줄 뿐이다')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if '--ref' in sys.argv:
        return build_ref()
    if not args:
        print(__doc__)
        return 1
    rows = [describe(p) for p in args]
    compare(rows)
    if len(rows) == 2:
        fit(rows[0], rows[1])
    return 0


if __name__ == '__main__':
    sys.exit(main())
