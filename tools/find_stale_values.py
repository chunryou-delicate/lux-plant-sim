# -*- coding: utf-8 -*-
"""낡은 값을 찾는다 — **찾아 주기만 한다. 판정은 사람이 한다.**

2026-08-24 · [Char] 이 만들었다. 공용 규칙: 고칠 일 있으면 알리고 고쳐도 된다.

■ ★ 이 자가 «못» 하는 것 — 먼저 읽을 것

이 자는 **낡았는지 모릅니다.** 「수가 적힌 자리」를 찾아 줄 뿐입니다.
2026-08-24 에 사람이 아홉 자리를 눈으로 갈랐더니 **여덟이 안 낡은 것**이었습니다:

    이미 고친 기록      "옛 줄은 25,000이었는데 지금은 120,000이다"   ← 지우면 이력이 사라진다
    과거 서술           "그 전까지 … 였다"                            ← 지금 값 주장이 아니다
    다른 물건           lighting_presets 의 25000 은 «천장등» 값이다
    다른 단위           daylight_lux 의 25000 은 «럭스» 다
    다른 셈             game.html 의 25,000 은 «시루 다섯»(5,000×5) 이다

⇒ ★★ **같은 수가 다섯 가지 다른 뜻이었습니다. 자로는 절대 못 가릅니다.**
  `grep` 만 믿고 고쳤으면 **여덟 군데의 「왜 그렇게 됐나」를 지울 뻔했습니다.**

■ ★★ 그리고 이 자가 **아예 못 찾는** 갈래 — 「값에서 나온 말」

    "하루 반은 사는 돈인데"     "조금만 더 늘리면 하루가 안 깎여"
    "아직 본전은 아니야"        "제일 싼 가구보다 싸다"

**숫자가 아예 없습니다.** 그런데 **값이 바뀌면 틀립니다.** 그리고 **틀려도 티가 안 납니다.**
⇒ ⛔ **이 자가 아무것도 안 찍어도 그 갈래는 그대로 남아 있습니다.**
  `--phrases` 로 **후보를 모아만** 줍니다. 판정은 사람이 해야 합니다.

■ [Plan] 이 낸 가르는 선 (2026-08-24)

    「규칙」을 말한 줄은 안 낡는다    "빛이 모자라면 날짜만 가고 모양은 안 변해"
    「값」을 말한 줄은 낡는다        "이만오천 원. 전기는 하루 이십삼 원이고."
    ★ 「값에서 나온 말」은 낡아도 티가 안 난다

■ 왜 한글까지 보나

2026-08-24 에 **「이만오천」이 세 군데서 살아남았습니다** — 대사 둘 · 주석 하나 · 검사 하나.
`grep 25000` 에 **하나도 안 걸렸습니다.** 한글 하나가 자 셋을 다 피했습니다.

■ 쓰는 법

    python tools/find_stale_values.py                 # 한글 수 + 단위
    python tools/find_stale_values.py --phrases       # ★ 값에서 나온 말 (사람이 볼 목록)
    python tools/find_stale_values.py --num 25000     # 특정 수를 한글·숫자 양쪽으로
    python tools/find_stale_values.py --selftest      # ★ 좁힐 때마다 이것부터
"""
import os, re, io, sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.claude', '.git', 'node_modules', '_out', '.codex-worker',
             '.worktree-salvage', '.codex-remote-attachments'}
EXT = ('.js', '.mjs', '.html', '.py', '.json', '.md')

# 한글 수 — 단위가 붙은 것만. 「이만큼」 같은 말이 걸리지 않게.
DIGIT = '(?:일|이|삼|사|오|육|칠|팔|구|십|백|천|만|억)'
# ★ 자릿수 글자(십·백·천·만·억)를 «반드시» 포함해야 한다.
#   ⚠ 안 넣었더니 190군데가 나왔는데 대부분 헛걸림이었다 —
#     "할 «일이 분»명할 때" 처럼 명사+조사가 수처럼 보인다.
#     진짜 수 표현은 자릿수 글자를 거의 항상 낀다(이만오천 · 이십삼 · 삼십만).
KO_NUM = re.compile(r'(?<![가-힣])((?:' + DIGIT + r'){2,})\s*(원|배)(?!본|래|가|인|칙|형|판|점|료|자|장|안|선|열|치|급|양|출|송|경)')
#   ⚠ 두 번 좁혔다.
#     ① 처음엔 단위를 원·일·배·시간·분·초로 다 봤다 -> 190군데. "할 «일이 분»명할" 이 걸렸다
#     ② 자릿수 글자를 필수로 넣었더니 246군데. 「만 원」 「십 배」 같은 짧은 것이 늘었다
#   ⇒ **목적이 금액이다.** 단위를 「원·배」로 좁히고 수사를 **두 글자 이상**으로 두었다.
#     ★ 좁힌 만큼 놓치는 것이 있다 — 「한 달에 십 원」 같은 한 글자 수는 안 잡힌다.
#       그건 이 자의 한계로 적어 둔다. 넓히면 사람이 못 읽는 목록이 된다.
#   ⚠⚠ ③ 그리고 **좁히다가 아는 것을 놓쳤다.** 「원」 뒤에 한글이 오면 뺐더니
#     `test_lampaim.mjs` 의 «이만오천 원«이»» 가 안 잡혔다 — **조사가 붙은 것**이다.
#     ⇒ 조사는 정상이고 「원본·원래·원가」만 빼야 한다. **자 검사가 그걸 잡았다.**
#     ★ 좁히는 것은 늘 「아는 것을 다시 대 보면서」 해야 한다.

# 「이만큼」·「얼마만큼」류를 뺀다
KO_SKIP = re.compile(r'(이만큼|그만큼|얼마만큼|만큼)')

# ★ 값에서 나온 말 — 숫자가 없는데 값이 바뀌면 틀리는 것
PHRASE = re.compile(
    r'(하루\s*반|본전|이레|사흘|나흘|며칠치|[0-9]+일치|'
    r'제일\s*(싼|비싼)|보다\s*(싸|비싸)|[0-9.]+\s*배|'
    r'한\s*달치|한\s*주치|몇\s*배)')


def files():
    for r, ds, fs in os.walk(ROOT):
        ds[:] = [d for d in ds if d not in SKIP_DIRS]
        for f in fs:
            if f.endswith(EXT):
                yield os.path.join(r, f)


def rel(p):
    return os.path.relpath(p, ROOT).replace(os.sep, '/')


def scan(pat, skip=None, label=''):
    hits = []
    for p in files():
        try:
            t = io.open(p, encoding='utf-8', errors='ignore').read()
        except OSError:
            continue
        for i, line in enumerate(t.split('\n'), 1):
            if skip and skip.search(line):
                continue
            m = pat.search(line)
            if m:
                hits.append((rel(p), i, m.group(0).strip(), line.strip()[:96]))
    return hits


def show(hits, head):
    print('=' * 74)
    print('%s — %d군데' % (head, len(hits)))
    print('=' * 74)
    cur = None
    for p, i, hit, line in hits:
        if p != cur:
            print('\n  %s' % p)
            cur = p
        print('    %5d  [%s]  %s' % (i, hit, line))
    print()


def selftest():
    """★ 아는 것에 대 본다. 좁힐 때마다 여기부터 돌려야 한다.

    ⚠ 실제로 좁히다 놓쳤다 — 「원」 뒤에 한글이 오면 뺐더니 «이만오천 원«이»» 가
      안 잡혔다(조사였다). **자 검사가 그걸 잡았다.**"""
    KNOWN = [
        # ⚠⚠ 「아는 것」 목록도 **낡는다.**
        #   여기 `test_lampaim.mjs` 의 「이만오천 원」이 있었는데 [core] 가 걷었다(`0da3901`).
        #   그러자 이 검사가 X 를 냈고, 나는 **자가 망가진 줄 알고** 패턴을 뒤졌다.
        #   ⇒ ★ **고쳐지면 여기서도 빼야 한다.** 안 빼면 「자가 못 잡는다」로 읽힌다.
        #     찾은 것을 보태기만 하고 걷지 않으면, 이 목록이 다음 사람을 속인다.
        ('dialogue.js',            '이십삼 원',   '전기 하루치'),
    ]
    # ★ 헛걸림도 «아는 것»이다 — 잡히면 안 되는 것을 같이 박는다.
    #   ⚠ 안 보태면 자가 「오늘 수준」에 멈춘다(총괄 2026-08-24).
    #   찾을 때마다 여기 한 줄씩 늘릴 것.
    NOT_HIT = [
        ('tools/test_banjiha_routes.mjs', '이사 배', '「판매·이사 «배»선」이다. 배(倍)가 아니다'),
    ]
    hits = scan(KO_NUM, KO_SKIP)
    bad = 0
    print('자 검사 — 아는 것을 잡나')
    print()
    for f, word, why in KNOWN:
        # ★ **같은 줄**에서 둘 다 맞아야 한다.
        #   ⚠ 처음엔 "파일 목록에 있나" 와 "어딘가에 그 낱말이 있나" 를 따로 봤다.
        #     그러면 다른 파일의 낱말로 통과한다. 그리고 줄을 96자로 잘라 두어
        #     긴 줄은 낱말이 잘려 나갔다 — **검사가 헐거웠다.**
        ok = any(f in p2 and word in hit for p2, _, hit, _ in hits)
        bad += 0 if ok else 1
        print('   %-26s %-12s %s   (%s)' % (f, word, 'O' if ok else 'X', why))
    for f, word, why in NOT_HIT:
        got = any(f in p2 and word in hit for p2, _, hit, _ in hits)
        bad += 1 if got else 0
        print('   %-26s %-12s %s   (걸리면 안 됨 — %s)'
              % (f, word, 'X' if got else 'O', why))
    print()
    print('자 검사 %s' % ('통과' if bad == 0 else '실패 %d건' % bad))
    print('⚠ 통과가 「낡은 것을 다 찾았다」는 뜻이 아니다. **아는 것을 안 놓쳤다**까지다.')
    return bad == 0


def main():
    if '--selftest' in sys.argv:
        sys.exit(0 if selftest() else 1)
    if '--phrases' in sys.argv:
        hits = scan(PHRASE)
        show(hits, '★ 값에서 나온 말 (자가 «판정 못 한다». 사람이 볼 목록)')
        print('⛔ 이 목록은 「낡았다」가 아니라 「값이 바뀌면 틀릴 수 있는 자리」다.')
        print('   숫자가 없으니 자는 여기까지가 끝이다. **하나씩 읽어야 한다.**')
        return
    if '--num' in sys.argv:
        n = sys.argv[sys.argv.index('--num') + 1].replace(',', '')
        ko = {'25000': '이만오천', '120000': '십이만', '80000': '팔만',
              '23': '이십삼', '5000': '오천', '30000': '삼만'}
        pat = re.compile(r'\b%s\b|\b%s\b|%s'
                         % (n, '{:,}'.format(int(n)).replace(',', ','),
                            ko.get(n, n)))
        show(scan(pat), '수 %s (숫자·한글 양쪽)' % n)
        return
    show(scan(KO_NUM, KO_SKIP), '한글 수 + 단위')
    print('⚠ 이 자는 «낡았는지 모른다.» 아홉 중 여덟이 안 낡은 것이었던 날이 있다(2026-08-24).')
    print('   고친 기록 · 과거 서술 · 다른 물건 · 다른 단위 · 다른 셈 — 자로는 못 가른다.')
    print('★ 그리고 «값에서 나온 말»은 여기 안 나온다. `--phrases` 로 따로 보라.')
    print('   ⛔ 이 자가 아무것도 안 찍어도 그 갈래는 그대로 남아 있다.')


if __name__ == '__main__':
    main()
