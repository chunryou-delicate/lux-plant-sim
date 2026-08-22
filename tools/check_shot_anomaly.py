# -*- coding: utf-8 -*-
"""스크린샷에서 **눈에 띄게 이상한 것**을 자동으로 짚는다.

2026-08-23 밤 · [Char] 이 [core] 하네스를 도우려고 만들었다.

■ 무엇을 하는 자인가

[core] 가 게임을 헤드리스로 돌려 자리마다 그림을 쌓는다. 아침에 사용자가 훑으신다.
그런데 **수백 장을 사람이 다 보는 것은 못 한다.** 이 자는 **먼저 훑어서 의심스러운 것만
앞으로 끌어낸다.** 사람의 눈을 대신하는 것이 아니라 **볼 순서를 정해 준다.**

■ 무엇을 못 하는가 — ★ 먼저 읽을 것

**「보기에 어색한 것」은 못 잡는다.** 손가락이 엉뚱한 데를 짚는다든지, 대사가 상황과 안 맞는다든지,
그림이 촌스럽다든지는 **사람만 안다.** 이 자가 잡는 것은 **화면이 깨진 것**뿐이다:

    빈 화면 · 단색 화면 · 새까맣거나 새하얀 화면 · 아무것도 안 그려진 화면 ·
    앞 컷과 한 픽셀도 안 바뀐 화면(멈춤) · 글자가 배경에 묻힌 자리

  그리고 **곁파일(`.json`)이 있으면** 픽셀로 못 보는 것까지 본다 —
  화면에 뜬 오류 문구 · 부팅 실패 · 가로 넘침 ·
  ★ **눌러야 하는 것이 다른 것에 가려짐** · 화면 밖 · 글자 잘림 · 손가락에 작음.
  그 갈래는 `shoot_screens.mjs` 가 찍을 때 **DOM 으로 재어** 남긴다.

⇒ **통과했다고 「괜찮다」가 아니다. 「깨지진 않았다」다.** 그 둘을 섞으면 안 된다.

■ 문턱을 어떻게 정했나 — ★ 지어내지 않았다

`docs/engine/shots/**` 의 **이미 찍어 둔 그림 437장**에 대고 재서 정했다.
그것들은 사람이 보고 넘어간 것이라 **「정상」의 표본**이다.
`--selftest` 가 그 표본을 다시 재서 **정상이 안 걸리는지** 확인한다.

■ 쓰는 법

    python tools/check_shot_anomaly.py <폴더 또는 파일...>
    python tools/check_shot_anomaly.py --selftest      # ★ 자부터 검사한다
    python tools/check_shot_anomaly.py --calibrate <폴더>   # 표본으로 문턱 다시 재기
    python tools/check_shot_anomaly.py --compare <폴더>     # ★ 해상도끼리 견주기
"""
import os, sys, glob, collections, io

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import numpy as np
from PIL import Image

# ── 문턱 — `--calibrate` 로 실제 표본에서 재어 정한 값 ──────────────────
# 실측(표본 437장): 표준편차 최소 7.64 · 평균 최소 17.09 · 엣지 최소 0.0000 · 가장자리 최대 0.283
FLAT_STD      = 6.0     # 표준편차가 이보다 낮으면 단색에 가깝다 (표본 최소 7.64 바깥)
DARK_MEAN     = 15.0    # 평균이 이보다 낮으면 새까맣다 (표본 최소 17.09 바깥)
BRIGHT_MEAN   = 242.0   # 이보다 높으면 새하얗다
# ★ 엣지만은 표본 최소(0.0000)에 맞추지 **않았다.**
#   표본 중에 엣지가 0인 그림이 실제로 있는데, 그건 「정상」이 아니라
#   **아무도 안 본 깨진 그림**일 수 있다. 문턱으로 덮으면 그걸 숨긴다.
#   ⇒ 5% 분위(0.0192)보다 훨씬 낮은 0.005 에 두어 **정말 빈 것만** 걸리게 했다.
EDGE_MIN      = 0.005
BORDER_FLAT   = 0.34    # 가장자리 단색 띠가 화면의 이 비율을 넘으면 잘렸다
SAME_MAXDIFF  = 0.5     # 앞 컷과 평균 절대차가 이보다 작으면 안 바뀐 것이다


def load(p):
    im = Image.open(p).convert('RGB')
    # ★ 크기를 줄여서 잰다.
    #   ⚠ 안 줄였다가 물렀다 — 1136px 짜리 또렷한 방 그림이 「그려진 것이 거의 없다」로
    #     걸렸다. 큰 그림은 **인접 화소 차가 작아서** 경계가 안 잡힌다(부드럽게 그려지므로).
    #     열어 보니 가구가 가득한 정상 화면이었다.
    #   줄이면 경계가 모여서 제대로 잡히고, 덤으로 빨라진다.
    if im.width > 384:
        im = im.resize((384, max(1, int(im.height * 384 / im.width))), Image.BILINEAR)
    a = np.asarray(im, dtype=np.float32)
    g = a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114
    return a, g


def edge_ratio(g):
    """엣지 화소 비율 — 무엇이든 그려져 있으면 경계가 생긴다.

    ★ 문턱을 **그림의 밝기 폭에 맞춘다.** 고정값(12)을 쓰면 **어두운 장면이 통째로 걸린다** —
      밤 화면은 진짜 경계도 밝기 차가 4~5밖에 안 되기 때문이다.
    ⚠ 실제로 `outside_win_night.png` 가 「그려진 것이 거의 없다」로 걸렸는데,
      열어 보니 **가구가 멀쩡히 보이는 정상 밤 장면**이었다. 헛걸림이었다.
      오늘 유령 자에서 겪은 것과 같다 — **바깥에서 가져온 고정 숫자는 맥락을 안 탄다.**"""
    lo, hi = np.percentile(g, 1), np.percentile(g, 99)
    thr = max(3.0, 0.10 * (hi - lo))
    dx = np.abs(np.diff(g, axis=1))
    dy = np.abs(np.diff(g, axis=0))
    n = (dx > thr).sum() + (dy > thr).sum()
    return n / float(g.size)


def border_flat_ratio(g):
    """가장자리에서 안쪽으로 단색이 얼마나 이어지나 — 잘린 화면·검은 띠를 잡는다."""
    h, w = g.shape
    def run(line_iter, total):
        n = 0
        for ln in line_iter:
            if ln.std() < 2.0:
                n += 1
            else:
                break
        return n / float(total)
    top = run((g[i, :] for i in range(h)), h)
    bot = run((g[h - 1 - i, :] for i in range(h)), h)
    left = run((g[:, i] for i in range(w)), w)
    right = run((g[:, w - 1 - i] for i in range(w)), w)
    return max(top + bot, left + right)


def low_contrast_bands(g, bands=8):
    """가로 띠로 잘라 국소 대비가 유난히 낮은 자리를 센다.

    글자가 배경에 묻히면 그 띠의 대비가 주저앉는다. **글자를 읽는 것이 아니라
    「읽을 수 있을 만한 대비가 있나」만 본다.** 그래서 헛걸림이 있다."""
    h = g.shape[0]
    out = []
    for i in range(bands):
        b = g[h * i // bands:h * (i + 1) // bands, :]
        if b.size and b.std() < 4.0:
            out.append(i)
    return out


def sidecar(path):
    """★ 그림 옆의 `.json` 을 읽는다 — **픽셀로는 글자를 못 읽는다.**

    ⚠ 실제로 겪었다. 7해상도를 나란히 띄웠다가 **부팅에 실패한 붉은 오류 상자**를 찍었는데
      이 자가 「안 깨졌다」로 통과시켰다. 오류 화면은 **깨져 보이지 않는다.**
      글자를 읽는 것은 픽셀이 아니라 **DOM 이 할 일**이라, `shoot_screens.mjs` 가 찍을 때
      화면 상태를 곁파일로 남기게 했다. 여기서 그걸 읽는다.

    곁파일이 없으면 조용히 넘어간다 — 남이 찍은 그림도 이 자로 볼 수 있어야 한다."""
    j = path.rsplit('.', 1)[0] + '.json'
    if not os.path.exists(j):
        return None
    try:
        import json
        return json.load(io.open(j, encoding='utf-8'))
    except Exception:
        return None


def check(path, prev_gray=None):
    a, g = load(path)
    bad, note = [], []

    st = sidecar(path)
    if st:
        if st.get('errorText') or st.get('errorBox'):
            bad.append('화면에 오류 문구가 떠 있다')
        if st.get('ready') is False:
            bad.append('부팅 표시를 못 봤다(게임이 안 떴다)')
        if st.get('scrollX'):
            bad.append('가로로 넘친다(내용이 폭을 벗어났다)')
        # ★ 「눌러야 하는 것이 가려졌나」 — [Asset] 이 눈으로 짚은 갈래(2026-08-23).
        #   픽셀로는 절대 못 본다. 찍을 때 DOM 으로 재어 곁파일에 남긴 것을 읽는다.
        #   08-22 민원 「해상도에 따라 [다음 날] 버튼 클릭 오류」가 이 갈래로 보인다.
        for key, msg in (('occluded', '★ 눌러야 하는 것이 가려졌다'),
                         ('partly',   '★ 절반 넘게 가려졌다'),
                         ('offscreen', '누를 것이 화면 밖에 있다'),
                         ('outside',  '부모 밖으로 삐져나가 잘렸다'),
                         ('clipped',  '글자가 잘렸다'),
                         ('dupText',  '같은 문구가 두 번 나온다')):
            v = st.get(key) or []
            if v:
                bad.append('%s: %s' % (msg, ', '.join(v[:3])))
        # ★ 정상인 까닭들 — 짚지 않고 **참고로만** 적는다. 이것을 「가려짐」으로 세면 안 된다.
        for key, msg in (('inClosedPanel', '닫힌 패널 안(정상)'),
                         ('coveredBySheet', '시트가 열려 그 아래(정상)'),
                         ('coveredByModal', '모달이 떠 있음(정상)'),
                         ('coveredByAnim',  '연출이 덮는 중(정상)'),
                         ('disabledOff',   '일부러 꺼둠(정상일 수 있음)')):
            v = st.get(key) or []
            if v:
                note.append('%s %d개' % (msg, len(v)))
        if st.get('animating'):
            note.append('★ 찍는 순간 연출이 돌고 있었다 — 이 컷의 가려짐 판정은 믿지 말 것')
        if st.get('talking'):
            note.append('대사 중이었다(.talking)')
        tiny = st.get('tiny') or []
        if tiny:
            note.append('손가락에 작다(32px 미만) %d개: %s' % (len(tiny), ', '.join(tiny[:3])))
    m, s = float(g.mean()), float(g.std())

    if s < FLAT_STD:
        bad.append('단색에 가깝다(표준편차 %.1f)' % s)
    if m < DARK_MEAN:
        bad.append('새까맣다(평균 %.0f)' % m)
    if m > BRIGHT_MEAN:
        bad.append('새하얗다(평균 %.0f)' % m)

    e = edge_ratio(g)
    if e < EDGE_MIN:
        bad.append('그려진 것이 거의 없다(엣지 %.3f%%)' % (e * 100))

    bf = border_flat_ratio(g)
    if bf > BORDER_FLAT:
        bad.append('가장자리 단색 띠가 %.0f%%' % (bf * 100))

    lb = low_contrast_bands(g)
    if lb:
        note.append('대비가 낮은 가로띠 %d개(글자가 묻혔을 수 있다)' % len(lb))

    if prev_gray is not None and prev_gray.shape == g.shape:
        d = float(np.abs(g - prev_gray).mean())
        if d < SAME_MAXDIFF:
            bad.append('앞 컷과 사실상 같다(평균차 %.2f) — 화면이 안 넘어갔나' % d)

    return bad, note, g


def calibrate(paths):
    """정상 표본에서 값의 분포를 재어 문턱을 정한다. **지어내지 않는다.**"""
    rows = []
    for p in paths:
        try:
            _, g = load(p)
        except Exception:
            continue
        rows.append((float(g.std()), float(g.mean()), edge_ratio(g), border_flat_ratio(g)))
    if not rows:
        print('표본이 없다'); return
    arr = np.array(rows)
    name = ['표준편차', '평균', '엣지비율', '가장자리단색']
    print('정상 표본 %d장에서 잰 값\n' % len(rows))
    print('%-12s %8s %8s %8s %8s' % ('', '최소', '5%', '중앙', '최대'))
    for i, nm in enumerate(name):
        c = arr[:, i]
        print('%-12s %8.4f %8.4f %8.4f %8.4f'
              % (nm, c.min(), np.percentile(c, 5), np.median(c), c.max()))
    print()
    print('⇒ 문턱은 **최소값보다 바깥**에 두어야 정상이 안 걸린다.')
    print('   지금 값: FLAT_STD=%.1f DARK_MEAN=%.1f EDGE_MIN=%.3f BORDER_FLAT=%.2f'
          % (FLAT_STD, DARK_MEAN, EDGE_MIN, BORDER_FLAT))


def selftest():
    """★ 자부터 검사한다 — **양쪽 다** 본다.

    ⚠ 오늘 유령 자에서 배운 것: 「떨어질 수 없는 검사」는 검사가 아니다.
      그래서 **일부러 깨진 그림을 만들어 넣고 잡히는지** 먼저 본다.
      그리고 **정상 표본이 안 걸리는지**도 본다. 한쪽만 보면 반쪽이다."""
    import tempfile
    print('자 검사 — 깨진 것을 잡나 · 정상을 안 잡나\n')
    bad = 0
    d = tempfile.mkdtemp()

    def mk(name, arr):
        p = os.path.join(d, name)
        Image.fromarray(arr.astype(np.uint8)).save(p)
        return p

    H, W = 200, 320
    rng = np.random.RandomState(0)
    CASES = [
        ('새까만 화면',   np.zeros((H, W, 3)),                         True),
        ('새하얀 화면',   np.full((H, W, 3), 255),                     True),
        ('단색 회색',     np.full((H, W, 3), 128),                     True),
        ('잡음(그려짐)',  rng.randint(0, 255, (H, W, 3)),              False),
    ]
    # ★ 「잡는다」고 적어 둔 갈래는 **전부 사례가 있어야 한다.**
    #   오늘 유령 자에서 배운 것 — 검사에 없는 갈래는 검사가 못 잡는다.
    crop = rng.randint(0, 255, (H, W, 3)).astype(float)
    crop[:int(H * 0.45), :] = 0            # 위쪽이 통째로 검은 띠 = 잘린 화면
    CASES.append(('잘린 화면(검은 띠)', crop, True))
    half = np.zeros((H, W, 3)); half[:, :W // 2] = rng.randint(0, 255, (H, W // 2, 3))
    CASES.append(('반쪽만 그려짐', half, True))
    print('[㉮ 만들어 넣은 그림]')
    for nm, arr, want_bad in CASES:
        p = mk(nm.replace(' ', '_') + '.png', arr)
        b, _, _ = check(p)
        got = bool(b)
        ok = got == want_bad
        bad += 0 if ok else 1
        print('   %-14s 기대 %-6s 실제 %-6s %s  %s'
              % (nm, '걸림' if want_bad else '통과', '걸림' if got else '통과',
                 'O' if ok else 'X', (b[0] if b else '')))

    print('\n[㉯ 이미 찍어 둔 정상 표본]')
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sample = sorted(glob.glob(os.path.join(root, 'docs/engine/shots/**/*.png'),
                              recursive=True))
    flagged = []
    for p in sample:
        try:
            b, _, _ = check(p)
        except Exception:
            continue
        if b:
            flagged.append((os.path.basename(p), b[0]))
    rate = len(flagged) / float(len(sample) or 1)
    print('   표본 %d장 중 %d장이 걸렸다 (%.1f%%)' % (len(sample), len(flagged), rate * 100))
    for n, why in flagged[:8]:
        print('      %-34s %s' % (n, why))
    if rate > 0.15:
        bad += 1
        print('   X 정상 표본이 15%%를 넘게 걸린다 — 문턱이 너무 빡빡하다')
    else:
        print('   O 정상 표본은 대체로 통과한다')

    print()
    print('자 검사 %s' % ('통과' if bad == 0 else '실패 %d건' % bad))
    print('⚠ 통과가 「그림이 괜찮다」는 뜻은 아니다. **「깨지진 않았다」까지다.**')
    print('   손가락이 엉뚱한 데를 짚는다든지 대사가 안 맞는다든지는 **사람만 안다.**')
    return bad == 0


def compare_resolutions(root):
    """★ 해상도끼리 견준다 — **한 장을 보는 게 아니라 여럿을 나란히 놓고 본다.**

    지금까지의 검사는 「깨진 그림」을 잡는다. 그런데 해상도 문제는
    **안 깨졌는데 잘못된 것**이다 — 버튼이 밖으로 나가거나, 아래에 빈 띠가 생기거나,
    같은 자리인데 해상도마다 딴판이거나.

    `qa/{해상도}/{순번}_{자리}.png` 규약을 전제로, **같은 「순번_자리」를 모아** 견준다.
    크기가 다르므로 **가로세로를 128×128 로 눌러** 배치만 남기고 비교한다.

    ⚠ **이것도 「깨지진 않았다」까지다.** 배치가 서로 닮았다고 예쁜 것은 아니다.
      그리고 **가로 화면은 세로와 원래 다르게 생겨야 정상**이라 따로 묶어 본다."""
    groups = collections.defaultdict(dict)     # 자리 -> {해상도: 경로}
    for p in glob.glob(os.path.join(root, '*', '*.png')):
        res = os.path.basename(os.path.dirname(p))
        spot = os.path.basename(p)
        groups[spot][res] = p
    if not groups:
        print('견줄 것이 없다 — %s/{해상도}/{순번}_{자리}.png 규약이 아니다' % root)
        return

    def sig(path):
        im = Image.open(path).convert('L').resize((128, 128), Image.BILINEAR)
        a = np.asarray(im, dtype=np.float32)
        a = (a - a.mean()) / (a.std() + 1e-6)      # 밝기 차는 지우고 **배치만** 본다
        return a

    print('해상도끼리 견주기 — 자리 %d개\n' % len(groups))
    for spot in sorted(groups):
        res = groups[spot]
        # 가로/세로를 갈라 본다. 서로 다르게 생기는 것이 정상이다.
        for kind, keys in (('세로', [k for k in res if _is_portrait(k)]),
                           ('가로', [k for k in res if not _is_portrait(k)])):
            if len(keys) < 2:
                continue
            sigs = {k: sig(res[k]) for k in keys}
            base = np.mean(list(sigs.values()), axis=0)
            far = []
            for k, v in sigs.items():
                d = float(np.abs(v - base).mean())
                far.append((d, k))
            far.sort(reverse=True)
            worst, name = far[0]
            typical = np.median([d for d, _ in far])
            if worst > max(0.25, typical * 2.0):
                print('★ %-24s [%s] **%s 만 딴판** (차이 %.2f · 나머지 중앙 %.2f)'
                      % (spot, kind, name, worst, typical))
            # 아래·옆 빈 띠 — 해상도 문제의 대표 증상
            for k in keys:
                _, g = load(res[k])
                bf = border_flat_ratio(g)
                if bf > 0.22:
                    print('   %-24s [%s] %-10s 가장자리 빈 띠 %.0f%%'
                          % (spot, kind, k, bf * 100))
    print()
    print('⚠ 여기서 안 걸린 것이 「보기 좋다」는 뜻은 아니다. **배치가 서로 닮았다**까지다.')


def _is_portrait(res_id):
    try:
        w, h = res_id.split('x')
        return int(h) >= int(w)
    except Exception:
        return True


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if '--selftest' in sys.argv:
        sys.exit(0 if selftest() else 1)
    paths = []
    for a in args or ['docs/engine/shots']:
        if os.path.isdir(a):
            paths += sorted(glob.glob(os.path.join(a, '**', '*.png'), recursive=True))
        else:
            paths.append(a)
    if '--calibrate' in sys.argv:
        return calibrate(paths)
    if '--compare' in sys.argv:
        return compare_resolutions(args[0] if args else 'docs/engine/shots/qa')

    prev = None
    hits = 0
    for p in paths:
        try:
            b, note, g = check(p, prev)
        except Exception as e:
            print('  ?  %-46s 열지 못했다: %s' % (p, e)); continue
        prev = g
        if b:
            hits += 1
            print('★ %-46s %s' % (os.path.relpath(p), ' / '.join(b)))
        elif note:
            print('   %-46s (%s)' % (os.path.relpath(p), ' / '.join(note)))
    print()
    print('%d장 중 %d장이 걸렸다.' % (len(paths), hits))
    print('⚠ 안 걸린 것이 「괜찮다」는 뜻은 아니다. 깨진 것만 잡는다.')


if __name__ == '__main__':
    main()
