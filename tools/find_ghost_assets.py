# -*- coding: utf-8 -*-
"""에셋 유령 검사 — **세기만 한다. 아무것도 안 지운다.**

2026-08-23 · [Char] 이 만들었다. 고칠 일 있으면 handoff 로 알리고 고쳐도 된다(공용 규칙).

■ 왜 만들었나

이 저장소가 하루에 세 번 「참조를 세어」 유령을 판정했다(`acceptance.json` · `bindDrag` ·
`sansevieria`). 그런데 나는 같은 날 **그 방법으로 멀쩡한 파일을 유령으로 찍었다** —
`char_*_walking_w.glb` 4개(60MB)를 「참조 0건」으로 판정했는데, 실제로는 뷰어 3곳이 쓴다.
파일 이름이 아니라 **`"walking_w"` 라는 조각**으로 배열에 들어 있어서 못 봤다.

⇒ ★ **유령을 세는 방법 자체가 유령을 만든다.** 이 저장소는 경로를 런타임에 조립한다:

      `${CHAR_ANIM}/char_${id}_${name}.glb`

  파일 이름 전체로 찾으면 이런 것을 **통째로 놓친다.** 그래서 셋을 같이 본다:

    ① 이름 전체        `char_jachwi_f_idle.glb` · 확장자 뺀 것 · 전체 경로
    ② 이름의 조각      `_` 로 자른 토막 (`walking_w` `idle` `harvest_crouch` …)
    ③ 조립하는 자리    템플릿 문자열의 **고정 부분**으로 디렉터리를 짚어 낸다

■ 넷으로 가른다 — ★ 마지막이 제일 중요하다

    쓰임          제품 코드(src/** · game.html · index.html …)가 부른다
    뷰어만 씀     검수용 HTML 만 부른다. 제품엔 안 붙었다
    조립돼서못셈  경로가 코드에서 조립된다. **기계가 못 푼다. 사람이 봐야 한다**
    ★ 유령        위 어디에도 안 걸린다

**「모른다」를 「유령」으로 적지 않는 것**이 이 자의 요점이다.

■ 쓰는 법

    python tools/find_ghost_assets.py                 # assets/** 전체
    python tools/find_ghost_assets.py assets/characters
    python tools/find_ghost_assets.py --selftest      # ★ 자를 먼저 검사한다
"""
import os, re, io, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEP = os.sep

SKIP_DIRS = {'.claude', '.git', 'node_modules', '.codex-worker',
             '.worktree-salvage', '.codex-remote-attachments'}
SRC_EXT = ('.js', '.html', '.py', '.json', '.md', '.mjs')
ASSET_EXT = ('.glb', '.png', '.jpg', '.jpeg', '.webp', '.gltf', '.bin',
             '.mp3', '.ogg', '.wav', '.svg', '.ttf', '.woff2')

# 제품 코드 — 여기서 불리면 「쓰임」
PRODUCT = ('src/', 'game.html', 'index.html', 'plant_grow.html')


def rel(p):
    return os.path.relpath(p, ROOT).replace(SEP, '/')


def walk(base, exts):
    out = []
    for r, ds, fs in os.walk(base):
        ds[:] = [d for d in ds if d not in SKIP_DIRS]
        for f in fs:
            if f.endswith(exts):
                out.append(os.path.join(r, f))
    return out


def load_sources():
    src = {}
    for p in walk(ROOT, SRC_EXT):
        k = rel(p)
        if k.startswith('.claude/'):
            continue
        try:
            src[k] = io.open(p, encoding='utf-8', errors='ignore').read()
        except OSError:
            pass
    return src


# ─────────────────────────────────────────────────────────────
# ③ 조립하는 자리 찾기
# ─────────────────────────────────────────────────────────────
CONST_RE = re.compile(r"""(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*['"]([^'"]*/[^'"]*)['"]""")
TMPL_RE = re.compile(r'`([^`]*\$\{[^`]*)`')


def assembled_dirs(src):
    """템플릿 문자열에서 **고정 부분**을 뽑아 「조립 대상 디렉터리」를 모은다.

    `${CHAR_ANIM}/char_${id}_${name}.glb` 처럼 앞이 상수면 그 상수를 풀어 준다.
    풀 수 없으면 템플릿에 박힌 고정 경로 조각을 그대로 쓴다."""
    dirs = collections.defaultdict(set)      # 디렉터리 -> 그것을 조립하는 파일들
    for path, text in src.items():
        consts = {m.group(1): m.group(2) for m in CONST_RE.finditer(text)}
        for m in TMPL_RE.finditer(text):
            t = m.group(1)
            if '.' not in t and '/' not in t:
                continue
            # ${NAME} 을 알려진 상수로 바꿔 본다
            def sub(mm):
                return consts.get(mm.group(1), '\x00')
            resolved = re.sub(r'\$\{\s*([A-Za-z_$][\w$]*)\s*\}', sub, t)
            resolved = re.sub(r'\$\{[^}]*\}', '\x00', resolved)
            # 고정 경로 조각들 — \x00 앞까지가 디렉터리다
            head = resolved.split('\x00')[0]
            if '/' not in head:
                continue
            d = head.rsplit('/', 1)[0]
            d = re.sub(r'^\.{0,2}/', '', d).replace('../', '')
            if d:
                dirs[d].add(path)
    return dirs


def tokens_of(name):
    """이름을 조각낸다 — 조립된 경로는 조각으로만 코드에 남는다."""
    stem = name.rsplit('.', 1)[0]
    out = {name, stem}
    parts = stem.split('_')
    for i in range(len(parts)):
        for j in range(i + 1, len(parts) + 1):
            t = '_'.join(parts[i:j])
            if len(t) >= 4:          # 3글자 이하는 우연히 걸린다
                out.add(t)
    return out


def classify(base):
    src = load_sources()
    asm = assembled_dirs(src)
    assets = walk(os.path.join(ROOT, base), ASSET_EXT)
    res = collections.defaultdict(list)

    for p in assets:
        r = rel(p)
        d, name = r.rsplit('/', 1)
        stem = name.rsplit('.', 1)[0]

        # ① 이름 전체 / 경로 — 제일 센 증거
        where = [k for k, t in src.items()
                 if (name in t or stem in t or r in t) and k != r]

        # ③ ★ 조립 판정을 토큰보다 **먼저** 한다.
        #    게임은 `${CHAR_MESH}/char_${id}_idle.glb` 로 부르므로 이름 전체가 코드에 없다.
        #    토큰부터 보면 뷰어에 먼저 걸려 「뷰어만 씀」으로 오판한다(실제로 그랬다).
        #    ⚠ 여기서 한 번 틀렸다 — 처음엔 `d.endswith(ad)` 로 잡고 **첫 판에 break** 했다.
        #      그러면 `anim` 같은 **짧은 조각**이 먼저 걸려 엉뚱한 조립자를 물어 온다.
        #      경계(`/`)를 붙여 맞추고, **끊지 말고 다 모은다.**
        builders = set()
        for ad, who in asm.items():
            if d == ad or d.endswith('/' + ad) or ad.endswith('/' + d):
                builders |= who
        builders = sorted(builders)

        prod = [k for k in where if k.startswith(PRODUCT)]
        prod_b = [k for k in builders if k.startswith(PRODUCT)]

        if prod:
            res['쓰임'].append((r, prod[:2]))
        elif prod_b:
            res['쓰임'].append((r, ['%s (경로 조립)' % prod_b[0]]))
        elif where:
            res['뷰어만 씀'].append((r, where[:2]))
        elif builders:
            res['조립돼서 못 셈'].append((r, builders[:2]))
        else:
            # ② 마지막 보조 — 조각으로도 안 걸리면 유령이다
            tok_hit = []
            for tok in sorted(tokens_of(name), key=len, reverse=True):
                if len(tok) < 5:
                    continue
                h = [k for k, t in src.items() if tok in t and k != r]
                if h:
                    tok_hit = h
                    break
            if [k for k in tok_hit if k.startswith(PRODUCT)]:
                res['쓰임'].append((r, ['%s (이름 조각)' % tok_hit[0]]))
            elif tok_hit:
                res['뷰어만 씀'].append((r, ['%s (이름 조각)' % tok_hit[0]]))
            else:
                res['★ 유령'].append((r, []))
    return res


def selftest():
    """★ 자를 먼저 검사한다.

    ⚠ 처음에 이 검사를 「유령만 아니면 통과」로 짰다. 그랬더니 **게임이 여는 파일이
      「뷰어만 씀」으로 나온 것을 놓치고 통과**시켰다. **떨어질 수 없는 검사는 검사가 아니다.**
      그래서 **갈래까지 맞아야** 통과로 바꿨다."""
    print("자 검사 — 갈래까지 맞아야 통과다\n")
    res = classify('assets/characters')
    idx = {r: k for k, v in res.items() for r, _ in v}
    CASES = [
        ('assets/characters/3d/lq/char_jachwi_f_idle.glb',     '쓰임',
         '게임이 `${CHAR_MESH}/char_${id}_idle.glb` 로 조립해 연다'),
        ('assets/characters/3d/anim/char_jachwi_f_repot.glb',  '쓰임',
         '게임 동작 클립'),
        ('assets/characters/portraits/portrait_moni_sad.png',  '쓰임',
         'game.html FACE_FILE'),
        ('assets/characters/3d/char_jachwi_f_walking_w.glb',   '뷰어만 씀',
         '★ 내가 유령으로 잘못 찍었던 것 — 뷰어 3곳이 쓴다'),
    ]
    bad = 0
    for f, want, why in CASES:
        got = idx.get(f, '(파일 없음)')
        ok = (got == want)
        if not ok:
            bad += 1
        print("  %-46s 기대 %-12s 실제 %-12s %s"
              % (f.replace('assets/characters/', ''), want, got,
                 'O' if ok else 'X'))
        if not ok:
            print("       (%s)" % why)
    print()
    print("자 검사 %s" % ("통과" if bad == 0
                        else "실패 %d건 — 고치기 전에는 결과를 믿지 말 것" % bad))
    return bad == 0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if '--selftest' in sys.argv:
        sys.exit(0 if selftest() else 1)
    base = args[0] if args else 'assets'
    res = classify(base)

    order = ['★ 유령', '조립돼서 못 셈', '뷰어만 씀', '쓰임']
    total = sum(len(res[k]) for k in order)
    print("%s 아래 에셋 %d개\n" % (base, total))
    for k in order:
        v = res[k]
        print("=" * 72)
        print("%s — %d개 (%.0f%%)" % (k, len(v), len(v) / total * 100 if total else 0))
        print("=" * 72)
        if k == '조립돼서 못 셈':
            print("  ★ 기계가 못 푼다. **사람이 그 코드를 봐야 한다.** 유령이 아니다.")
        if k == '★ 유령':
            print("  ⚠ 지우기 전에 반드시 눈으로 확인할 것. 「아직 안 붙은 것」과 다르다.")
        if k == '쓰임':
            print("  (목록 생략 — %d개)" % len(v))
            continue
        by_dir = collections.defaultdict(list)
        for r, who in v:
            by_dir[r.rsplit('/', 1)[0]].append((r.rsplit('/', 1)[1], who))
        for d in sorted(by_dir):
            fs = by_dir[d]
            print("  %s  (%d개)" % (d, len(fs)))
            for n, who in fs[:6]:
                print("     %-46s %s" % (n, (who[0] if who else '')))
            if len(fs) > 6:
                print("     ... 외 %d개" % (len(fs) - 6))
        print()
    print("※ 이 검사는 아무것도 지우지 않는다. 「뷰어만 씀」을 유령으로 셀지는 사람이 정한다.")


if __name__ == "__main__":
    main()
