# -*- coding: utf-8 -*-
"""캐릭터 에셋을 **manifest 항목으로 뽑는다.** ⛔ manifest.json 을 고치지는 않는다.

2026-08-29 · [Char] 이 만들었다.

■ ★ 왜 「뽑기만」 하나 — 파일 임자가 다르다

`assets/manifest.json` 은 **[leaf] 소유**다(`docs/handoff/plan-to-leaf.md:84`).
필드 뜻을 정한 것도 그쪽이다. 그런데 캐릭터 파일은 내 것이다.
⇒ **자기 것을 뽑아서 넘기고, 합치는 것은 임자가 한다.**
  330줄을 남의 파일에 밀어 넣으면 그 창의 미커밋 작업과 부딪친다.

■ ★★ 이 자를 만들며 처음에 틀린 것 — 「246」

밤일 목록에 「캐릭터 246개를 올릴 것」이라 적혀 있었다. 세어 보니 **539개**였다.
246 은 **어느 한 번 센 수가 그대로 굳은 것**이다. 그리고 539 도 답이 아니었다 —
그중 234개가 **실험·참고·폐기·도구**였다.

    539  캐릭터 폴더에 있는 파일 전부
    -234  _pipeline_test · _ref · _style · _old · _raw · 뷰어 html · 도구 py
    ----
     330  ★ 이름으로 찾을 값이 있는 것

⇒ ★ **「몇 개냐」는 「무엇을 세느냐」가 정해진 뒤에만 답이 있다.**
  세기 전에 수를 물려받으면, 그 수를 맞추려고 엉뚱한 것을 넣게 된다.

■ ★ 이 자가 **못** 채우는 칸 — 비워 둔다. 짐작해 넣지 않는다

  `real_max_m` · `scale_to_real`   실제 크기. **안 쟀다.** 사람 키를 1.7m 라 적어 넣을 수
                                   있었지만 그건 잰 것이 아니다. [leaf] 가 다른 항목에
                                   쓴 값은 전부 **실측**이다. 짐작을 섞으면 그 칸이 못 쓰게 된다.
  `glb_matched`                    원화-glb 짝. 이름으로 이어 붙일 수는 있으나
                                   **이름이 같다고 그 원화로 구운 것은 아니다**(v2/v3 후보가 있다).

■ 쓰는 법

    python tools/char/manifest_char.py            # 무엇이 나오나 보기만
    python tools/char/manifest_char.py --emit     # assets/derived/manifest_char.json 으로
    python tools/char/manifest_char.py --dup      # ★ manifest 에 이미 있는 것과 겹치나
"""
import os
import re
import sys
import json
import collections

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets", "derived", "manifest_char.json")
MANIFEST = os.path.join(ROOT, "assets", "manifest.json")

# 뽑지 않는 것 - 폴더 이름 하나라도 걸리면 뺀다
SKIP_DIR = {'_raw', '_out', '_pipeline_test', '_old', '_ref', '_style',
            '3d_wip', '__pycache__'}
SKIP_EXT = {'.html', '.py', '.md', '.json', '.txt'}

CHAR = {
    'jachwi_f':         '자취녀',
    'namja_jachwi':     '자취남',
    'namja_jubu':       '남주부',
    'namja_gajang':     '남가장',
    'namja_researcher': '남연구원',
    'yeoja_jubu':       '여주부',
    'yeoja_gajang':     '여가장',
    'yeoja_researcher': '여연구원',
    'mascot_sprout':    '몬이',
    'namja':            '남캐공용',
    'yeoja':            '여캐공용',
}
MOTION = {
    'idle': '대기', 'walking': '걷기', 'running': '달리기', 'walking_w': '걷기(가중)',
    'cheer': '환호', 'crouch': '쪼그려앉기', 'doze': '졸기', 'happyjump': '기뻐뛰기',
    'harvest': '수확', 'harvest_crouch': '앉아수확', 'heart': '하트', 'inspect': '살펴보기',
    'listen': '듣기', 'nod': '끄덕임', 'opendoor': '문열기', 'pickup': '줍기',
    'repot': '분갈이', 'scratch': '긁적임', 'sit': '앉기', 'sleep': '자기', 'wave': '손흔들기',
}
VIEW = {'front': '정면', 'back': '뒷면', 'left': '좌측', 'right': '우측'}
# ★ 모션이 아닌 꼬리말. 처음에 빠뜨려서 `자취녀_base` 같은 이름이 75개 나왔다.
KIND = {
    'base': '소체', 'rigged': '리깅', 'base_color': '색텍스처',
    'base_base_color': '소체_색텍스처', 'sprout': '새싹', 'mask': '마스크',
    'anchor': '기준판', 'compare': '비교판',
}
# 마스크 미리보기 판 이름
PREVIEW = {
    'all': '전체', 'check': '검사', 'eyes': '눈', 'face': '얼굴', 'face8': '얼굴8인',
    'jubu': '주부', 'part': '부위', 'recolor': '색갈이', 'tex': '텍스처',
}
# ★ 영문이 남아도 되는 것 - «왜 되는지»를 적어 둔다.
#   ⚠ 그냥 통과시키면 다음에 진짜로 이름을 못 지은 것이 여기 섞여 안 보인다.
ALLOW_LATIN = {
    '얼굴안': '후보에 붙인 딱지가 A/B/C/D 다. 한글로 바꾸면 원본 파일명과 안 이어진다',
}
# ⚠⚠ `blank` 를 「빈판」이라 적었던 것이 **오해를 세 군데로 퍼뜨렸다** (2026-08-30).
#   그림은 «빈 판»이 아니라 **얼어붙은 얼굴**이다. 파산 첫 줄이 쓴다.
#   ⇒ 파일 이름(`0d4f1b9`) · 표정 키(`adbdb26` — [core] 가 `numb` 로) · manifest 한글명
#     **셋 다 「빈판」을 이고 있었다.** 이름 하나가 틀리면 그 이름이 «옮겨 다닌다».
#   ★ 그래서 여기도 고친다 — 안 고치면 다시 뽑을 때 「빈판」이 되살아난다.
FACE = {
    'neutral': '무표정', 'numb': '말잃음', 'happy': '기쁨', 'worry': '걱정', 'cry': '울음',
    'surprise': '놀람', 'tired': '피곤', 'think': '생각', 'proud': '뿌듯', 'sad': '슬픔',
    'excited': '신남', 'curious': '궁금', 'default': '기본', 'cheer': '환호', 'sleepy': '졸림',
}


def longest_char(stem):
    """★ 긴 이름부터 맞춘다. `namja` 로 먼저 맞으면 `namja_jachwi` 를 놓친다."""
    for k in sorted(CHAR, key=len, reverse=True):
        if stem.startswith(k + '_') or stem == k:
            return k
    return None


def ko_tail(tail):
    """꼬리말을 한글로. ★ 모션 표에만 대 보면 `base`/`rigged` 가 그대로 샌다."""
    if not tail:
        return '본체'          # char_mascot_sprout.glb 처럼 꼬리가 없는 것
    return MOTION.get(tail) or KIND.get(tail) or VIEW.get(tail) or tail


def ko_draft(tail):
    """원화 꼬리말. 후보판은 «이름이 없어야 정상»이라 번호를 그대로 살려 한글로 감싼다."""
    if not tail:
        return '기본'
    if re.fullmatch(r'v\d+', tail):
        return '후보%s번' % tail[1:]
    m = re.fullmatch(r'face_([a-z])', tail)
    if m:
        return '얼굴안%s' % m.group(1).upper()
    m = re.fullmatch(r'v(\d+)_(front|back|left|right)', tail)
    if m:
        return '후보%s번_%s' % (m.group(1), VIEW[m.group(2)])
    m = re.fullmatch(r'base_v(\d+)', tail)
    if m:
        return '소체_후보%s번' % m.group(1)
    return ko_tail(tail)


def split_char(stem, prefix='char_'):
    body = stem[len(prefix):] if stem.startswith(prefix) else stem
    c = longest_char(body)
    return c, (body[len(c) + 1:] if c else body)


def describe(rel):
    """경로 하나를 항목 하나로.

    ⚠ 못 알아본 것을 «빼지» 않는다. 조용히 빼면 그 파일은 영영 안 보인다.
      물음표로 남겨야 사람이 고친다."""
    d, fn = os.path.dirname(rel), os.path.basename(rel)
    stem, ext = os.path.splitext(fn)
    e = dict(file=fn,
             path=rel[len('assets/'):] if rel.startswith('assets/') else rel,
             is_glb=(ext.lower() == '.glb'),
             bytes=os.path.getsize(os.path.join(ROOT, rel)))

    if d.endswith('/anim'):
        c, mo = split_char(stem)
        e.update(category='캐릭터·모션', type='3D-모션', status='glb완료', char=c,
                 name_ko='%s_%s' % (CHAR.get(c, '물음'), MOTION.get(mo, mo)),
                 note='Meshy 모션 클립(메시 포함). 게임은 이걸 직접 안 연다')
    elif d.endswith('char_clips'):
        c, mo = split_char(stem)
        e.update(category='캐릭터·모션', type='3D-클립', status='glb완료', char=c,
                 name_ko='%s_%s_클립' % (CHAR.get(c, '물음'), MOTION.get(mo, mo)),
                 note='★ 게임이 읽는 것. 메시를 뗀 뼈대+트랙만')
    elif d.endswith('/lq'):
        c, tail = split_char(stem)
        e.update(category='캐릭터·3D', type='3D-경량', status='glb완료', char=c,
                 name_ko='%s_%s_경량' % (CHAR.get(c, '물음'), ko_tail(tail)),
                 note='텍스처를 줄인 판. ★ 게임이 이것을 연다')
    elif d.endswith('/3d'):
        c, tail = split_char(stem)
        png = ext.lower() == '.png'
        e.update(category='캐릭터·3D',
                 type='텍스처' if png else '3D-원본',
                 status='채택' if png else 'glb완료', char=c,
                 name_ko='%s_%s' % (CHAR.get(c, '물음'), ko_tail(tail)),
                 note='아틀라스 2048px' if png else 'Meshy 원본(무겁다). lq 를 쓸 것')
    elif d.endswith('/masks'):
        if stem.startswith('_preview'):
            k = stem[len('_preview_'):]
            c, nm = None, '마스크미리보기_%s' % PREVIEW.get(k, k)
        else:
            c, tail = split_char(stem)
            nm = '%s_%s' % (CHAR.get(c, '물음'), ko_tail(tail))
        e.update(category='캐릭터·마스크', type='마스크', status='참고자료',
                 char=c, name_ko=nm,
                 note='아틀라스 부위 마스크. ⚠ 실시간 부위 교체용이 아니다(README 4장)')
    elif d.endswith('/portraits'):
        body = stem[len('portrait_'):] if stem.startswith('portrait_') else stem
        who = ('자취남' if body.startswith('jachwi_m') else
               '몬이' if body.startswith('moni') else
               '자취녀' if body.startswith('jachwi') else '물음')
        face = body.rsplit('_', 1)[-1]
        e.update(category='캐릭터·초상', type='초상화', status='채택',
                 char='jachwi_f' if who == '자취녀' else
                      'mascot_sprout' if who == '몬이' else None,
                 name_ko='%s_%s' % (who, FACE.get(face, face)),
                 note='대사창 얼굴. ⚠ game.html FACE_FILE 에 없는 키는 조용히 neutral 로 떨어진다')
    elif '/mascot' in d:
        if stem.startswith('hf_'):
            nm, st = '몬이_원본출력', '참고자료'     # Higgsfield 원본. 골라 쓴 판은 따로 있다
        elif stem.startswith('char_'):
            nm, st = '몬이_원화', '채택'
        else:
            face = stem[len('mon_'):] if stem.startswith('mon_') else stem
            nm, st = '몬이_%s_원화' % FACE.get(face, face), '채택'
        e.update(category='캐릭터·마스코트', type='원화', status=st,
                 char='mascot_sprout', name_ko=nm)
    else:                                   # assets/characters 바로 밑 = 원화
        c, tail = split_char(stem)
        adopted = tail in VIEW or tail == ''
        e.update(category='캐릭터·원화',
                 type='원화-4방위' if tail in VIEW else '원화-후보',
                 status='채택' if adopted else '참고자료', char=c,
                 name_ko='%s_%s' % (CHAR.get(c, '물음'), ko_draft(tail)),
                 note='Meshy multi_image_to_3d 입력' if adopted else '고르다 만 판')
    return e


def collect():
    items = []
    for base in ('assets/characters', 'assets/derived/char_clips'):
        for r, ds, fs in os.walk(os.path.join(ROOT, base)):
            ds[:] = [x for x in ds if x not in SKIP_DIR]
            parts = os.path.relpath(r, ROOT).replace(os.sep, '/').split('/')
            if any(p in SKIP_DIR for p in parts):
                continue
            for f in sorted(fs):
                if os.path.splitext(f)[1].lower() in SKIP_EXT or f.startswith('_tmp'):
                    continue
                items.append(describe(
                    os.path.relpath(os.path.join(r, f), ROOT).replace(os.sep, '/')))
    return sorted(items, key=lambda x: x['path'])


def dup_check(items):
    """★ 이미 올라간 것과 겹치나. 겹치는 채로 넘기면 임자가 두 번 세게 된다."""
    if not os.path.exists(MANIFEST):
        print('manifest.json 이 없다')
        return
    have = {x.get('path') for x in
            json.load(open(MANIFEST, encoding='utf-8'))['items']}
    dup = [x['path'] for x in items if x['path'] in have]
    print('manifest 에 이미 있는 것: %d개' % len(dup))
    for p in dup[:20]:
        print('   %s' % p)
    if not dup:
        print('   없다 - 뽑은 것이 통째로 새것이다')


def main():
    items = collect()
    cat = collections.Counter(x['category'] for x in items)
    # ★★ 관문을 한 번 갈았다.
    #   처음엔 「물음 이 들어갔나」로 봤다. 0개가 나와서 다 된 줄 알았는데,
    #   눈으로 보니 `자취녀_base` 처럼 **영문이 그대로 남은 것이 75개**였다.
    #   ⇒ 표에 없는 낱말은 `dict.get(k, k)` 로 «그대로 통과»한다. 물음표가 안 찍힌다.
    #   ⇒ ★ 관문은 「내가 모르는 표시가 있나」가 아니라 «결과가 한글인가» 여야 한다.
    def latin(x):
        n = x.get('name_ko', '')
        if any(a in n for a in ALLOW_LATIN):
            return False
        return bool(re.search(r'[A-Za-z]', n)) or '물음' in n

    unk = [x for x in items if latin(x)]
    allowed = [x for x in items
               if any(a in x.get('name_ko', '') for a in ALLOW_LATIN)]

    print('■ 뽑은 것 %d개' % len(items))
    for k in sorted(cat):
        print('   %-12s %3d' % (k, cat[k]))
    print()
    if unk:
        print('⚠ 이름에 영문이 남은 것 %d개 - 빼지 않고 남겼다. 표에 낱말을 보탤 것:' % len(unk))
        for x in unk[:15]:
            print('   %-52s -> %s' % (x['path'], x['name_ko']))
        print()
        print('   ⇒ ★ 이 줄이 0 이 되어야 「이름으로 찾을 수 있다」가 된다.')
        print()
    if allowed:
        print('· 영문을 «일부러» 남긴 것 %d개:' % len(allowed))
        for a, why in ALLOW_LATIN.items():
            print('   %s ... %s' % (a, why))
        print()

    # ★★ 관문 셋째 - «이름이 겹치나».
    #   이 파일의 쓸모는 「이름으로 찾기」 하나다. 두 파일이 같은 이름이면
    #   찾은 사람이 «어느 쪽인지 모른다». 그때 색인은 없느니만 못하다.
    #   실제로 `몬이_놀람` 이 둘이었다 - 마스코트 표정 원화와 대사창 초상화.
    dupname = {k: v for k, v in
               collections.Counter(x['name_ko'] for x in items).items() if v > 1}
    if dupname:
        print('⛔ 이름이 겹친다 %d - 색인이 못 쓰게 된다:' % len(dupname))
        for k in dupname:
            for x in items:
                if x['name_ko'] == k:
                    print('   %-16s %s' % (k, x['path']))
        print()

    if '--dup' in sys.argv:
        dup_check(items)
        return
    if '--emit' in sys.argv:
        if dupname or unk:
            print('⛔ 안 썼다. 겹친 이름·영문을 먼저 없앨 것.')
            sys.exit(1)
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        with open(OUT, 'w', encoding='utf-8') as f:
            json.dump({
                '_note': '[Char] 이 뽑은 캐릭터 항목. ★ manifest.json 은 leaf 소유라 '
                         '여기에만 쓴다. 합치는 것은 임자가 한다.',
                '_generated_by': 'tools/char/manifest_char.py',
                '_missing': 'real_max_m / scale_to_real 은 안 쟀으므로 비웠다. '
                            '짐작을 넣지 않았다.',
                'count': len(items), 'items': items,
            }, f, ensure_ascii=False, indent=1)
        print('썼다: %s' % os.path.relpath(OUT, ROOT))
        print('⇒ ★ [leaf] 에 합쳐 달라고 알릴 것. ⛔ 내가 manifest.json 을 고치지 않는다.')
        print()
        # ★★ 이 파일은 [leaf] 검사의 «정답지»다(2026-08-30 · `31b5a61`).
        #   그쪽 `check_manifest.py` 가 manifest.json 과 여기를 견줘, 이름이 갈리면 운다.
        #   ⇒ ⛔ 그러니 «낡은 채로 두면» 그 검사가 «틀린 것을 정답이라» 우긴다.
        #     실제로 「빈판」이라는 틀린 이름이 여기서 나가 세 군데로 퍼졌다.
        print('★ 다음 한 줄을 «지금» 돌릴 것 — 이 파일이 [leaf] 검사의 정답지다:')
        print('    PYTHONIOENCODING=utf-8 python tools/leaf/check_manifest.py')
        print('  ⇒ 이름을 고쳤으면 여기가 낡은 채로 있으면 안 된다.')
    else:
        print('(보기만 했다. --emit 으로 파일에 쓴다)')


if __name__ == '__main__':
    main()
