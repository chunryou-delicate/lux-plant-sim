# -*- coding: utf-8 -*-
"""tools/leaf/higgs_order1009.py — leaf Higgsfield 주문표를 한 표에서 만든다 ([leaf] 10-09 · 총괄 «힉스필드 많이 써라»)
   한 표(아래 ROWS)에서 주문 JSON(총괄이 그대로 돌림)과 주문표 md 의 표를 같이 낸다 — 프롬프트·경로가 두 곳에서 갈리지 않게.
   ① 도감·카드 결은 시험 두 줄(P1 A · P2 B)로 고른 뒤 --style=A|B 로 다시 낸다(기본 A).
   쓰기: python tools/leaf/higgs_order1009.py [--style=A|B]
         → docs/handoff/leaf-higgsfield-order-20261009.json · 같은 이름 .md 의 맨 아래 표(표시 줄 아래를 다시 쓴다)"""
import sys, json, io, os
sys.stdout.reconfigure(encoding='utf-8')
STYLE = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--style=')), 'A').upper()
assert STYLE in ('A', 'B')

MODEL = {'model': 'gpt_image_2_5', 'variant': 'flare', 'quality': 'high', 'resolution': '1k'}
ROLE = 'image_references'
REFS = {   # 총괄이 media_upload → media_id 로 바꿔 끼운다
    'REF_STYLE_A': 'assets/illust/ev_first_varie_halfmoon.png',          # 이미 통과한 사건 원화(잉크 선 · 과슈 물칠) — 무늬 몬스테라 잎이 들어 있다
    'REF_STYLE_B': 'assets/raw/plants/pink_princess/PP2_clean.png',      # 파스텔 저폴리 원화(이것이 3D 가 됐다)
    'REF_STYLE_B2': 'assets/raw/plants/alocasia/AL2_clean.png',
    'REF_ST_OPENING': 'assets/monstera/thumbs/monstera_bud_opening2.png',
    'REF_ST_FURLED': 'assets/monstera/thumbs/monstera_bud_furled.png',
    'REF_ST_YOUNG': 'assets/monstera/thumbs/monstera_leaf_young.png',
    'REF_ST_MID': 'assets/monstera/thumbs/monstera_leaf_mid1.png',
    'REF_ST_MATURE': 'assets/monstera/thumbs/monstera_leaf_mature.png',
}

STYLE_TXT = {
    'A': 'Draw it as a 2D hand-drawn storybook illustration in the style of image 2: thin warm-brown ink outline, soft gouache and watercolor wash, gentle pastel tones, light paper grain only inside the leaf.',
    'B': 'Paint it as a hand-painted pastel low-poly illustration in the style of image 2: broad flat faceted planes like a low-poly model, soft pastel colors, a faint brush texture, no hard highlights.',
}
STYLE_REF = {'A': 'REF_STYLE_A', 'B': 'REF_STYLE_B'}

def card_prompt(what, colors, style):
    return (f'A single {what}, front view seen straight on (flat, like a pressed specimen), the whole leaf with a short petiole pointing down, '
            f'centered and filling about 80% of a square frame, isolated on a transparent background. '
            f'Keep exactly the leaf shape and the variegation pattern and colors of image 1: {colors}. {STYLE_TXT[style]} '
            f'No pot, no stem base, no text, no border, no drop shadow, not a photo, not a 3D render.')

MON = 'Monstera deliciosa mature leaf with deep splits and holes (fenestrations)'
PP = "Philodendron 'Pink Princess' heart-shaped leaf"
AL = "Alocasia 'Frydek' velvety arrowhead-shaped leaf with bold white veins"
T = 'assets/monstera/skins/thumbs/mon_{}.png'

# ① 도감·카드 — (이름 · 종·등급·가족 ko · 무엇 · 참조 썸네일 · 색 설명)
CARDS = [
    ('speckle_greencream', '몬스테라 · 산반 · 스페클-그린크림', MON, T.format('speckle_greencream'), 'green with large irregular cream-white speckled patches and streaks scattered over the whole leaf'),
    ('zebra', '몬스테라 · 산반 · 제브라-그린흰', MON, T.format('zebra'), 'dark green with many thin white zebra stripes running from the midrib out to the edge'),
    ('star_greenwhite', '몬스테라 · 산반 · 별무늬-그린흰', MON, T.format('star_greenwhite'), 'mostly creamy white with green patches along the margins and a few small star-shaped flecks'),
    ('star_greenyellow', '몬스테라 · 산반 · 별무늬-그린옐로우', MON, T.format('star_greenyellow'), 'green with cream and golden-yellow streaks and small star-shaped flecks'),
    ('star_palegreen', '몬스테라 · 산반 · 별무늬-페일그린', MON, T.format('star_palegreen'), 'soft olive pale green with small cream star-shaped flecks scattered evenly'),
    ('green_yellow', '몬스테라 · 산반 · 오로레아-그린옐로우', MON, T.format('green_yellow'), 'deep green with bright lime-yellow aurea streaks fanning out from the midrib'),
    ('green_lemonpatch', '몬스테라 · 산반 · 라임-레몬패치', MON, T.format('green_lemonpatch'), 'deep green with one or two lemon-yellow patches near the edge'),
    ('neon_lime', '몬스테라 · 산반 · 네온-라임', MON, T.format('neon_lime'), 'bright neon lime-yellow green all over with slightly darker veins'),
    ('halfmoon_greenwhite', '몬스테라 · 하프문 · 하프문-그린흰', MON, T.format('halfmoon_greenwhite'), 'exactly half clean white and half deep green, divided along the midrib (half-moon variegation)'),
    ('halfmoon_greencream', '몬스테라 · 하프문 · 하프문-그린크림', MON, T.format('halfmoon_greencream'), 'exactly half creamy white and half deep green, divided along the midrib (half-moon variegation)'),
    ('galaxy_tealgold', '몬스테라 · 하프문 · 갤럭시-틸골드', MON, T.format('galaxy_tealgold'), 'deep teal green with fine golden veins and tiny gold specks like a starry sky'),
    ('galaxy_darkteal', '몬스테라 · 하프문 · 갤럭시-다크틸', MON, T.format('galaxy_darkteal'), 'very dark teal with tiny cream star specks like a galaxy, veins and splits still clearly readable'),
    ('star_pinkmint', '몬스테라 · 하프문 · 별무늬-핑크민트', MON, T.format('star_pinkmint'), 'half pink-white and half mint green split along the midrib, with small white star-shaped flecks'),
    ('variegata_pink', '몬스테라 · 풀문 · 핑크-로즈핑크', MON, T.format('variegata_pink'), 'dusty rose-pink leaf with a few dark green streaks along the veins'),
    ('variegata_gold', '몬스테라 · 풀문 · 오로레아-골드', MON, T.format('variegata_gold'), 'large golden-orange aurea sectors covering about half the leaf, the rest deep green'),
    ('rose_pink', '몬스테라 · 풀문 · 핑크-로즈', MON, T.format('rose_pink'), 'coral rose-pink all over with pale pink veins and small light star-shaped flecks'),
    ('mauve', '몬스테라 · 풀문 · 모브-라벤더그레이', MON, T.format('mauve'), 'muted mauve lavender-grey all over, darker purple-grey toward one side'),
    ('fullalbo', '몬스테라 · 풀문 · 알보-전체흰', MON, T.format('fullalbo'), 'almost entirely clean cool white (NOT beige, NOT yellow) with faint pale green veins and a thin green midrib'),
    ('charcoal', '몬스테라 · 풀문 · 차콜-다크그린', MON, T.format('charcoal'), 'very dark charcoal green, but the lighter veins and every split and hole stay clearly readable - it must not become a black silhouette'),
    ('plain', '몬스테라 · 무지', MON, 'assets/monstera/thumbs/monstera_leaf_mature.png', 'plain healthy deep green with no variegation'),
    ('pp_green', '핑크프린세스 · 무지', PP, 'assets/plants/pink_princess/thumbs/pp_leaf_mature.png', 'very dark burgundy green with no pink, the veins still readable - not a black silhouette'),
    ('pp_marble', '핑크프린세스 · 산반', PP, 'assets/plants/pink_princess/skins/thumbs/pp_leaf_mature_pinkmarble.png', 'dark green with soft bubblegum-pink marbled flecks and brush streaks'),
    ('pp_heavy', '핑크프린세스 · 하프문', PP, 'assets/plants/pink_princess/skins/thumbs/pp_leaf_mature_pinkheavy.png', 'large bubblegum-pink sectors covering most of the leaf, the rest dark green'),
    ('pp_pink', '핑크프린세스 · 분홍 잎', PP, 'assets/plants/pink_princess/skins/thumbs/pp_leaf_mature_allpink.png', 'entirely soft bubblegum pink with slightly deeper pink veins, no green'),
    ('al_plain', '알로카시아 프라이덱 · 무지', AL, 'assets/plants/alocasia/thumbs/al_leaf_mature.png', 'deep velvety green with bold clean white veins'),
    ('al_marble', '알로카시아 프라이덱 · 산반', AL, 'assets/plants/alocasia/skins/thumbs/al_leaf_mature_marble.png', 'deep velvety green with soft cream marbling between the white veins'),
    ('al_sector', '알로카시아 프라이덱 · 하프문', AL, 'assets/plants/alocasia/skins/thumbs/al_leaf_mature_half.png', 'one large clean cream sector covering about half the leaf, the rest deep velvety green with white veins'),
]

def spec_prompt(what, stage, colors):
    return (f'A single {what} with its petiole, isolated on a plain pure white background, 3/4 view, petiole pointing down, '
            f'the whole leaf visible and centered, {stage}, {colors}. Pastel low-poly 3D game asset style like images 1 and 2: '
            f'broad flat faceted planes, soft pastel colors, soft even light. One leaf only. No pot, no shadow, no text.')
def whole_prompt(desc):
    return (f'{desc} Pastel low-poly 3D game asset style like images 1 and 2: broad flat faceted planes, soft pastel colors, soft even light. '
            f'The whole plant visible and centered, isolated on a plain pure white background, no text, no shadow.')
SC = "Epipremnum aureum (scindapsus / pothos) heart-shaped leaf with a slightly asymmetric pointed tip"
CA = 'Calathea orbifolia broad rounded oval leaf'
CW = "Calathea 'White Fusion' oval leaf with a pointed tip"
SPECIES = [
    ('scindapsus', 'SC1', '스킨답서스 · 어린잎(밑 모양)', spec_prompt(SC, 'a small young leaf just unrolled', 'fresh light green, plain, no variegation')),
    ('scindapsus', 'SC2', '스킨답서스 · 중간잎(밑 모양)', spec_prompt(SC, 'a half-grown leaf', 'glossy medium green, plain, no variegation')),
    ('scindapsus', 'SC3', '스킨답서스 · 성숙잎(밑 모양)', spec_prompt(SC, 'a fully grown leaf, gently curved', 'glossy medium green, plain, no variegation')),
    ('scindapsus', 'SC4', "스킨답서스 · 성숙 · 무늬 마블퀸", spec_prompt(SC, 'a fully grown leaf, gently curved', "heavily marbled with creamy white streaks and flecks over green ('Marble Queen')")),
    ('scindapsus', 'SC5', "스킨답서스 · 성숙 · 무늬 엔조이", spec_prompt(SC, 'a fully grown leaf, gently curved', "crisp clean white patches along the edges and a green center, sharp-edged sections, no marbling ('N'Joy')")),
    ('calathea', 'CA1', '칼라데아 · 어린잎(오비폴리아)', spec_prompt(CA, 'a small young leaf just unrolled', 'light green with pale silver-green feather stripes between the lateral veins')),
    ('calathea', 'CA2', '칼라데아 · 중간잎(오비폴리아)', spec_prompt(CA, 'a half-grown leaf', 'pale silver-green feather stripes alternating with mid green along the lateral veins')),
    ('calathea', 'CA3', '칼라데아 · 성숙잎(오비폴리아)', spec_prompt(CA, 'a large fully grown round leaf', 'pale silver-green feather stripes alternating with mid green along the lateral veins')),
    ('calathea', 'CA4', '칼라데아 · 중간 · 무늬 화이트퓨전', spec_prompt(CW, 'a half-grown leaf', 'light green with irregular brushstroke white and pale green marbling')),
    ('calathea', 'CA5', '칼라데아 · 성숙 · 무늬 화이트퓨전', spec_prompt(CW, 'a fully grown leaf', 'light green with irregular brushstroke white and pale green marbling, a hint of lilac-pink at the edge from the underside')),
]
WHOLE = [
    ('scindapsus', 'SC6', '스킨답서스 · 그루 전체(덩굴)', whole_prompt("A whole Epipremnum aureum 'Marble Queen' (scindapsus) plant in a small hanging pot, long vines trailing down with heart-shaped marbled leaves along them.")),
    ('calathea', 'CA6', '칼라데아 · 그루 전체(로제트)', whole_prompt('A whole Calathea orbifolia plant in a pot, a rosette of large round silver-striped leaves on long upright petioles rising straight from the base.')),
]

ST_FRAME = ('Same framing for every image of this set: one monstera stem rising from the bottom center of the frame against a soft blurred sunny windowsill '
            'background in cream and pale green, the subject centered at eye level filling the middle of the frame. No pot visible, no characters, no text, no border.')
def st_prompt(scene):
    return (f'Close-up 2D storybook illustration in the style of image 1 (thin warm-brown ink lines, soft gouache wash, warm pastel light): {scene}. '
            f'The leaf shape follows image 2. {ST_FRAME}')
STAGES = [
    ('opening', 'statusPhaseOpening «새순이 풀리기 시작했다»', 'REF_ST_OPENING', st_prompt('a monstera new leaf spear just starting to unroll - a pale yellow-green rolled spear loosening at the top, one edge peeling open')),
    ('young', 'statusPhaseYoung «잎이 다 펴졌다. 아직 연하다»', 'REF_ST_YOUNG', st_prompt('a monstera young leaf fully unrolled but small, thin and glossy, very light tender lime green, a simple heart shape with no splits, drooping a little')),
    ('mid', 'statusPhaseMid «중간잎이야»', 'REF_ST_MID', st_prompt('a monstera mid-stage leaf, firmer and medium green, heart shaped with just one or two small splits starting at the edge')),
    ('mature', 'statusPhaseMature «다 자란 잎이야»', 'REF_ST_MATURE', st_prompt('a large mature monstera leaf, deep green and leathery, with deep splits and holes (fenestrations)')),
    ('axis', 'statusPhaseAxis «다음 잎이 올라오고 있어. 줄기 끝을 봐»', 'REF_ST_FURLED', st_prompt('a mature monstera leaf on one side and, from the stem tip, a brand-new tightly furled pale green spear rising beside it - the next leaf coming')),
]

def med(*keys): return [{'value': k, 'role': ROLE} for k in keys]
def job(name, kind, save_as, used_in, who, prompt, medias, aspect='1:1', background=None, count=2):
    p = dict(MODEL, aspect_ratio=aspect, count=count, prompt=prompt, medias=medias)
    if background: p['background'] = background
    return {'name': name, 'kind': kind, 'save_as': save_as, 'used_in': used_in, 'who': who, 'tool': 'generate_image', 'params': p}

CARD_USE = '도감·카드 — 지금 게임에 자리 없음: 후보 ⓐ 무늬 등급 알림 «✨ N번째 잎 — 등급» 옆 그림 ⓑ 잎·삽수 팔기 확인 시트 ⓒ 앞으로 도감 · 지금 바로 docs/dogam 식물 칸'
jobs = []
for st in ('A', 'B'):   # 시험 두 줄 — 같은 가족(하프문-그린흰)을 두 결로
    jobs.append(job(f'P{1 if st == "A" else 2}_card_halfmoon_greenwhite_{st}', 'pilot', f'assets/illust/cards/_pilot/card_mon_halfmoon_greenwhite_{st}.png',
                    f'① 결 고르기 시험 — 결 {st}', '총괄·박사님(결 고르기) · leaf(검수)',
                    card_prompt(MON, CARDS[8][4], st), med(f'REF_FAM_halfmoon_greenwhite', STYLE_REF[st]), background='transparent'))
for (cid, ko, what, ref, colors) in CARDS:
    name = cid if cid.startswith(('pp_', 'al_')) else 'mon_' + cid
    jobs.append(job(f'card_{name}', 'card', f'assets/illust/cards/card_{name}.png', CARD_USE + f' · {ko}', 'plan(자리) · core(그림 걸기) · leaf(docs/dogam)',
                    card_prompt(what, colors, STYLE), med(f'REF_FAM_{cid}', STYLE_REF[STYLE]), background='transparent'))
for (sp, cid, ko, prompt) in SPECIES:
    jobs.append(job(cid, 'species_leaf', f'assets/raw/plants/{sp}/{cid}.png', f'② {ko} — Meshy image_to_3d 입력(나중 · Meshy 461 안에서 · growth 의 덩굴/로제트 규칙 뒤)',
                    'leaf(3D 로 · 잇기) · growth(종 프로필)', prompt, med('REF_STYLE_B', 'REF_STYLE_B2'), background='opaque'))
for (sp, cid, ko, prompt) in WHOLE:
    jobs.append(job(cid, 'species_whole', f'assets/raw/plants/{sp}/{cid}_whole.png', f'② {ko} — 그루 꼴 기준 그림(growth 가 덩굴·로제트 규칙을 세울 때 · 도감 후보)',
                    'growth(종 꼴) · plan', prompt, med('REF_STYLE_B', 'REF_STYLE_B2'), aspect='3:4', background='opaque'))
for (sid, line, ref, prompt) in STAGES:
    jobs.append(job(f'ev_leaf_stage_{sid}', 'stage', f'assets/illust/ev_leaf_stage_{sid}.png', f'③ 잎 단계 — 대사 {line} 위 #sceneArt(정사각) · 다섯 장이 한 벌(같은 구도)',
                    'core(sceneArtOf 에 case 한 줄) · plan', prompt, med('REF_STYLE_A', ref), background='opaque'))
jobs.append(job('ev_leaf_stage_strip', 'stage', 'assets/illust/ev_leaf_stage_strip.png', '③ 잎 단계 한눈에(왼→오) — 도움말·docs 용(글자는 화면이 얹는다)', 'plan(자리) · leaf(docs)',
                (f'2D storybook illustration in the style of image 1 (thin warm-brown ink lines, soft gouache wash, warm pastel light): the five stages of one monstera leaf side by side from left to right - '
                 f'a tightly furled spear, an unrolling spear, a small tender light-green young leaf, a firmer mid leaf with a couple of small splits, a large deep-green mature leaf with splits and holes; '
                 f'each on its own short stem standing at the same height, evenly spaced on a plain cream background. Shapes follow images 2 to 5. No pots, no characters, no text, no arrows, no border.'),
                med('REF_STYLE_A', 'REF_ST_FURLED', 'REF_ST_YOUNG', 'REF_ST_MID', 'REF_ST_MATURE'), aspect='16:9', background='opaque'))

refs = dict(REFS)
for (cid, ko, what, ref, colors) in CARDS: refs[f'REF_FAM_{cid}'] = ref
for k, v in refs.items(): assert os.path.exists(v), v
out = {'_doc': 'leaf Higgsfield 주문(10-09) — 총괄이 그대로 돌린다. REF_* 는 media_upload → media_id 로 바꿔 끼운다. 장당 1.5(high · 1k · 미리 잰 값) · count 2.',
       'style_for_cards': STYLE, 'refs': refs, 'jobs': jobs}
p = 'docs/handoff/leaf-higgsfield-order-20261009.json'
io.open(p, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
n_img = sum(j['params']['count'] for j in jobs)
by = {}
for j in jobs: by[j['kind']] = by.get(j['kind'], 0) + j['params']['count']
print('★', p, len(jobs), '줄', n_img, '장', round(n_img * 1.5, 1), '크레딧', by)

# 주문표 md 의 표(손으로 쓴 머리말 아래에 붙인다)
L = []
def row(*c): L.append('| ' + ' | '.join(c) + ' |')
L.append('### 표 ① 도감·카드 (결 ' + STYLE + ' · 투명 바탕 · 1:1)'); row('#', '종 · 등급 · 가족', '참조(모양·무늬)', 'save_as'); row('---', '---', '---', '---')
for i, (cid, ko, what, ref, colors) in enumerate(CARDS, 1):
    name = cid if cid.startswith(('pp_', 'al_')) else 'mon_' + cid
    row(str(i), ko, f'`{ref}`', f'`assets/illust/cards/card_{name}.png`')
L.append(''); L.append('### 표 ② 스킨답서스·칼라데아 (결 B · 흰 바탕)'); row('#', '무엇', 'save_as', '비율'); row('---', '---', '---', '---')
for (sp, cid, ko, prompt) in SPECIES: row(cid, ko, f'`assets/raw/plants/{sp}/{cid}.png`', '1:1')
for (sp, cid, ko, prompt) in WHOLE: row(cid, ko, f'`assets/raw/plants/{sp}/{cid}_whole.png`', '3:4')
L.append(''); L.append('### 표 ③ 잎 단계 (결 A · 사건 원화 결)'); row('이름', '대사(걸 자리)', '모양 참조', 'save_as'); row('---', '---', '---', '---')
for (sid, line, ref, prompt) in STAGES: row(f'ev_leaf_stage_{sid}', line, f'`{REFS[ref]}`', f'`assets/illust/ev_leaf_stage_{sid}.png`')
row('ev_leaf_stage_strip', '도움말·docs(한눈에 · 16:9)', '어린·중간·성숙·말린 순 넷', '`assets/illust/ev_leaf_stage_strip.png`')
MD = 'docs/handoff/leaf-higgsfield-order-20261009.md'; MARK = '<!-- 아래 표는 tools/leaf/higgs_order1009.py 가 다시 쓴다 -->'
md = io.open(MD, encoding='utf-8').read(); assert MARK in md, '표시 줄이 없다'
io.open(MD, 'w', encoding='utf-8').write(md.split(MARK)[0] + MARK + '\n' + '\n'.join(L) + '\n')
print('★ 표', len(L), '줄')
