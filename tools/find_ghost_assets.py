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

# ① cp949 콘솔에서 '—' 하나에 죽는다 — [Asset] 이 잡았다(2026-08-23).
#    자가 안 도는 창이 있으면 그 자는 없는 것과 같다.
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEP = os.sep

SKIP_DIRS = {'.claude', '.git', 'node_modules', '.codex-worker',
             '.worktree-salvage', '.codex-remote-attachments'}
SRC_EXT = ('.js', '.html', '.py', '.json', '.md', '.mjs')
ASSET_EXT = ('.glb', '.png', '.jpg', '.jpeg', '.webp', '.gltf', '.bin',
             '.mp3', '.ogg', '.wav', '.svg', '.ttf', '.woff2')

# ★ 「제품」이 무엇인지부터 정해야 이 자가 답을 낸다.
#   team-map §2: **게임은 `game.html` + `src/game/*`** 다. `index.html` 은 3D 방 뷰어의
#   껍데기이고 `src/render3d/*` 는 그 뷰어가 쓰는 코드다 — 검수 도구지 제품이 아니다.
#   ⚠ 처음엔 `src/` 를 통째로 제품으로 쳤다. 그랬더니 뷰어 전용인
#     `src/render3d/character.js` 가 부르는 것까지 「쓰임」으로 갈렸다.
#   ⇒ ★ **이 목록을 바꾸면 답이 통째로 바뀐다.** 저장소가 「무엇이 제품인가」를
#     정하지 않으면 유령 판정은 성립하지 않는다.
PRODUCT = ('src/game/', 'game.html', 'plant_grow.html')

# ★ 실제로 파일을 여는 것만 「쓰임」의 근거로 친다.
#   문서(.md)·도구(.py)에 이름이 나오는 것은 **언급**이지 사용이 아니다.
#   [Asset] 이 206장을 갈라 보니 「쓰임」 셋 중 셋이 헛걸림이었다 —
#   `25_wateringcan.png` 가 문서에 「물뿌리개」라는 말이 있어 걸렸다.
#   ⇒ ★ 「쓰임」이 「유령」보다 위험하다. 유령은 사람이 다시 보는데,
#     쓰임으로 갈리면 **아무도 다시 안 본다.** 의심 쪽으로 기울여 둔다.
CODE_EXT = ('.js', '.html', '.mjs', '.json')

ROLE_FILE = '_role.txt'          # ② 폴더가 스스로 역할을 밝힌다


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


def tok_re(tok):
    """★ 조각은 **경계를 붙여** 찾는다.

    ⚠ 안 붙였다가 네 번째로 물렀다 — `char_jachwi_f_walking_w.glb` 를 재는데 조각
      `char_jachwi_f_walking` 이 `src/game/room_view.js` 에 걸렸다. 그런데 그 코드가 부르는 것은
      **`char_jachwi_f_walking.glb`**(다른 파일)였다. **접두사가 남의 쓰임을 물어 온다.**
    ⇒ 뒤에 `[A-Za-z0-9_]` 가 오면 다른 이름이다. 계율 ⑮ 의 또 다른 얼굴이다.
    ★ 그리고 이 헛걸림은 **「쓰임」 쪽으로** 기울었다 — 제일 위험한 방향이다."""
    return re.compile(r'(?<![A-Za-z0-9_])%s(?![A-Za-z0-9_])' % re.escape(tok))


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


WORD_RE = re.compile(r'[A-Za-z0-9_]+')


def word_index(files):
    """★ 낱말 색인을 **한 번만** 만든다.

    ⚠ 다섯 번째로 물렀다 — 경계를 붙이려고 조각마다 정규식을 전체 코드에 돌렸더니
      **자 검사 하나가 7분을 넘겼다.** 안 도는 자와 못 기다리는 자는 같다.
    ⇒ 코드를 낱말로 한 번 쪼개 두면 조회가 즉시 끝나고, `[A-Za-z0-9_]+` 로 쪼개는 것
      자체가 **경계 맞추기**라 정확도도 그대로다.
      `char_jachwi_f_walking_w` 는 한 낱말이고 `char_jachwi_f_walking` 은 다른 낱말이다."""
    idx = collections.defaultdict(set)
    for k, t in files.items():
        for w in set(WORD_RE.findall(t)):
            idx[w].add(k)
    return idx


def role_of(d, roles):
    """② 폴더가 스스로 밝힌 역할. 조상 폴더까지 거슬러 본다.

    `_role.txt` 에 `source`(또는 `원료`)라고 적힌 폴더는 **코드가 안 부르는 것이 정상**이다.
    원화·중간 산출물이 거기 산다. 그런 폴더를 「유령」으로 세면 안 된다.

    ★ 이 규약이 필요한 이유 — [Asset] 이 이 자로 206장을 갈랐는데 **87장이 「유령」으로 찍혔고
      실은 전부 「아직 안 붙음」**이었다. 그 폴더는 원료였다. 자는 그것을 밖에서 알 수 없다.
      **만든 쪽이 적고 읽는 쪽이 찾아본다.**"""
    cur = d
    while cur:
        if cur in roles:
            return roles[cur]
        if '/' not in cur:
            break
        cur = cur.rsplit('/', 1)[0]
    return None


def load_roles():
    roles = {}
    for r, ds, fs in os.walk(os.path.join(ROOT, 'assets')):
        ds[:] = [x for x in ds if x not in SKIP_DIRS]
        if ROLE_FILE in fs:
            try:
                t = io.open(os.path.join(r, ROLE_FILE), encoding='utf-8',
                            errors='ignore').read().lower()
            except OSError:
                continue
            if 'source' in t or '원료' in t:
                roles[rel(r)] = '원료'
            elif 'archive' in t or '보관' in t:
                roles[rel(r)] = '보관'      # 일부러 안 쓰는 것 — 버린 판·중복·시험물
            elif 'viewer' in t or '뷰어' in t:
                roles[rel(r)] = '뷰어용'
    return roles


def classify(base):
    src = load_sources()
    code = {k: v for k, v in src.items() if k.endswith(CODE_EXT)}
    asm = assembled_dirs(code)
    roles = load_roles()
    cidx = word_index(code)
    # ★ 남의 이름인 조각은 쓰지 않는다.
    #   `char_jachwi_f_walking_w` 의 조각 `char_jachwi_f_walking` 은 **실재하는 다른 파일**의
    #   이름 전체다. 경계를 붙여도 못 막는다 — 그 낱말이 코드에 진짜로 있기 때문이다.
    #   그래서 조각이 **다른 에셋의 이름과 같으면 증거로 안 친다.**
    all_stems = {os.path.basename(x).rsplit('.', 1)[0] for x in walk(
        os.path.join(ROOT, 'assets'), ASSET_EXT)}
    didx = word_index({k: v for k, v in src.items() if k not in code})
    assets = walk(os.path.join(ROOT, base), ASSET_EXT)
    res = collections.defaultdict(list)
    _dircache = {}

    for p in assets:
        r = rel(p)
        d, name = r.rsplit('/', 1)
        stem = name.rsplit('.', 1)[0]

        # ② 폴더가 「원료」라고 밝혔으면 코드가 안 부르는 것이 정상이다
        role = role_of(d, roles)
        if role in ('원료', '보관'):
            res['%s(선언됨)' % role].append((r, ['%s/%s' % (d, ROLE_FILE)]))
            continue

        # ★ 「쓰임」의 근거는 **코드만** 친다. 문서에 이름이 나오는 것은 언급이지 사용이 아니다.
        hit = sorted(cidx.get(stem, set()) - {r})
        doc = sorted(didx.get(stem, set()) - {r})

        builders = set()
        for ad, who in asm.items():
            if d == ad or d.endswith('/' + ad) or ad.endswith('/' + d):
                builders |= who
        builders = sorted(builders)

        # ★ 증거를 **다 모은 뒤** 판정한다.
        #   ⚠ 여기서 세 번째로 물렀다 — 처음엔 「이름 -> 조립 -> 조각」 순으로 보고
        #     먼저 걸리는 데서 끊었다. 그러면 **약한 근거(디렉터리 귀속)가 센 근거(조각 일치)를
        #     가로챈다.** 실제로 `walking_w` 가 「조립돼서 못 셈」으로 떨어졌다.
        #   ⇒ 규칙: **제품 근거는 어느 강도든 뷰어 근거보다 세다.**
        tok_hit = []
        if not hit:
            for tok in sorted(tokens_of(name), key=len, reverse=True):
                if len(tok) < 5 or (tok != stem and tok in all_stems):
                    continue
                h = sorted(cidx.get(tok, set()) - {r})
                if h:
                    tok_hit = h
                    break

        prod = ([k for k in hit if k.startswith(PRODUCT)]
                or [k for k in tok_hit if k.startswith(PRODUCT)]
                or ['%s (경로 조립)' % k for k in builders if k.startswith(PRODUCT)])
        view = hit or tok_hit

        if prod:
            res['쓰임'].append((r, prod[:2]))
        elif view:
            res['뷰어만 씀'].append((r, view[:2]))
        elif builders:
            res['조립돼서 못 셈'].append((r, builders[:2]))
        else:
            # ④ [Asset] 의 조언 — **폴더 경로 조각**으로도 훑는다.
            #    "조립해서 부르더라도 폴더 이름은 어딘가 남아야 한다."
            #    내 walking_w 사고는 파일명 단위였는데, 폴더 단위로 보면 조립도 걸린다.
            # ★ 폴더 조각은 **경로 모양**이어야 한다(마디 둘 이상).
            #   ⚠ 여섯 번째로 물렀다 — 낱말 색인으로 바꾸면서 마디 하나(`pots` `icons`)만
            #     맞아도 통과시켰더니 **유령이 0개**가 됐다. 아무 말도 안 하는 자가 된 것이다.
            #     한쪽으로 기울이라는 말은 **아무것도 안 거르라**는 뜻이 아니다.
            #   디렉터리마다 한 번만 재고 재활용한다(파일마다 재면 느리다).
            if d not in _dircache:
                segs = d.split('/')
                found = []
                for i in range(len(segs) - 1):       # 마디 둘 이상만
                    frag = '/'.join(segs[i:])
                    found = [k for k, t in code.items() if frag in t]
                    if found:
                        break
                _dircache[d] = found
            folder_hit = _dircache[d]
            if folder_hit:
                res['조립돼서 못 셈'].append((r, ['%s (폴더 조각)' % folder_hit[0]]))
            else:
                res['★ 유령'].append((r, ['(문서에만 언급: %s)' % doc[0]] if doc else []))
    return res


def selftest():
    """★ 자를 먼저 검사한다.

    ⚠ 두 번 물렀다:
      ① 처음엔 「유령만 아니면 통과」로 짰다. 그랬더니 **게임이 여는 파일이 「뷰어만 씀」으로
        나온 것을 놓치고 통과**시켰다. **떨어질 수 없는 검사는 검사가 아니다.**
        갈래까지 맞아야 통과로 바꾸니 바로 1건이 떨어졌다.
      ② 그렇게 고쳤는데도 **사례 넷이 전부 캐릭터 에셋**이었다. 그래서 [Asset] 이 원화 206장에
        돌렸을 때 터진 「원료」 사고를 **이 검사가 잡을 수 없었다.**
        ⇒ ★ **떨어질 수 있는지를 보되, 무엇에 대해 떨어질 수 있는지도 봐야 한다.**
    """
    print("자 검사 — 갈래까지 맞아야 통과다\n")
    bad = 0

    # ── ㉮ 논리 검사 — 디스크를 안 건드린다 ────────────────────────
    print("[㉮ 역할 규약 (파일 안 만들고 논리만)]")
    fake = {'assets/gen': '원료', 'assets/characters/masks': '뷰어용'}
    LOGIC = [
        ('assets/gen/2026-08-12/pots', '원료',  '선언한 폴더의 손자'),
        ('assets/gen',                 '원료',  '선언한 폴더 자신'),
        ('assets/characters/3d',       None,    '선언 안 한 폴더'),
        ('assets/characters/masks',    '뷰어용', '다른 역할'),
    ]
    for d, want, why in LOGIC:
        got = role_of(d, fake)
        ok = got == want
        bad += 0 if ok else 1
        print("   %-34s 기대 %-6s 실제 %-6s %s  (%s)"
              % (d, want, got, 'O' if ok else 'X', why))

    # ── ㉯ 실물 검사 ─────────────────────────────────────────────
    print("\n[㉯ 실물 — assets/characters]")
    res = classify('assets/characters')
    idx = {r: k for k, v in res.items() for r, _ in v}
    CASES = [
        ('assets/characters/3d/lq/char_jachwi_f_idle.glb',    '쓰임',
         '게임이 `${CHAR_MESH}/char_${id}_idle.glb` 로 조립해 연다'),
        ('assets/characters/3d/anim/char_jachwi_f_repot.glb', '쓰임', '게임 동작 클립'),
        ('assets/characters/portraits/portrait_moni_sad.png', '쓰임', 'game.html FACE_FILE'),
        ('assets/characters/3d/char_jachwi_f_walking_w.glb',  '뷰어만 씀',
         '★ 내가 유령으로 잘못 찍었던 것 — 뷰어 3곳이 쓴다'),
    ]
    for f, want, why in CASES:
        got = idx.get(f, '(파일 없음)')
        ok = (got == want)
        bad += 0 if ok else 1
        print("   %-44s 기대 %-12s 실제 %-12s %s"
              % (f.replace('assets/characters/', ''), want, got, 'O' if ok else 'X'))
        if not ok:
            print("        (%s)" % why)

    print()
    print("자 검사 %s" % ("통과" if bad == 0
                        else "실패 %d건 — 고치기 전에는 결과를 믿지 말 것" % bad))
    if bad == 0:
        print("⚠ 통과가 「이 자가 옳다」는 뜻은 아니다. **사례에 없는 갈래는 못 잡는다.**")
        print("   자기 폴더를 돌릴 창은 **자기 사례를 여기 더할 것.**")
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
