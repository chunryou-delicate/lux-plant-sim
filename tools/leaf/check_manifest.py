# -*- coding: utf-8 -*-
"""tools/leaf/check_manifest.py — manifest.json 이 «스스로와 어긋나지 않나» (2026-08-30 · leaf)

    PYTHONIOENCODING=utf-8 python tools/leaf/check_manifest.py

★ 왜 생겼나 — `summary.total` 이 **448** 인데 `items` 는 **450** 이었다. 그리고
  `summary.glb_done` 은 **61** 인데 GLB 는 197, `status=='glb완료'` 는 268 이었다.
  ⇒ ★★ **아무것과도 안 맞았다.** 「세는 자」와 「담는 곳」이 «따로» 늘고 있었던 것이다.
  ⇒ 손으로 적는 파일이라 이런 일이 조용히 난다. **그래서 자를 따로 둔다.**

⚠ 이 검사는 «값이 옳은가»를 안 본다. **「파일이 스스로와 맞는가」만 본다.**
  ⇒ 크기가 실제로 맞는지는 재 봐야 안다. 그건 이 자의 몫이 아니다.
"""
import json, os, sys, collections

M = 'assets/manifest.json'

def main():
    m = json.load(open(M, encoding='utf-8'))
    items = m.get('items') or []
    bad = []

    # ① 세는 자 ↔ 담는 곳
    s = m.get('summary') or {}
    for key, got in (('total', len(items)),
                     ('glb', sum(1 for x in items if x.get('is_glb'))),
                     ('status_glb완료', sum(1 for x in items if x.get('status') == 'glb완료'))):
        if key in s and s[key] != got:
            bad.append('summary.%s = %s 인데 items 에서 세면 %s' % (key, s[key], got))

    # ② id 가 겹치나 (문자열 id 도 있다 — 겹치지만 않으면 된다)
    c = collections.Counter(x.get('id') for x in items)
    for k, v in c.items():
        if v > 1: bad.append('id %r 이 %d번 나온다' % (k, v))
    if None in c: bad.append('id 가 없는 줄이 %d개' % c[None])

    # ③ ★ «path» 가 겹치나
    #   ⚠ `file` 로 보면 안 된다 — 그건 «파일 이름»이라 폴더가 다르면 겹치는 것이 «정상»이다
    #     (char_jachwi_f_idle.glb 가 3d/ · 3d/lq/ · derived/char_clips/ 에 하나씩 있다).
    #     처음에 file 로 봤다가 53건이 떴는데 그중 37건이 «멀쩡한 것»이었다.
    #   ⚠⚠ «전부터 있던» 겹침 17개가 있다(2026-08-30 캐릭터 329줄을 합칠 때 세었다).
    #     ⛔ 지우지 않았다 — 남의 손이 넣은 줄이고, 지우는 것은 내 판단이 아니다.
    #   ⚠⚠⚠ 처음엔 «개수»로 재웠다(17보다 많으면 운다). **구멍이었다** —
    #     일부러 망가뜨려 보니, 옛 겹침 하나가 사라지고 새 겹침 하나가 생기면 «17 그대로»라
    #     조용히 지나갔다. ⇒ ★ 그래서 «이름을 박아» 둔다. 목록에 없는 겹침은 무조건 운다.
    KNOWN_DUP = {
        'crops/fruit_strawberry_m.glb',
        'crops/thumbs/fruit_strawberry_m.png',
        'existing/Gemini_Generated_Image_46snqk46snqk46sn.png',
        'existing/Gemini_Generated_Image_5gbos15gbos15gbo.png',
        'existing/Gemini_Generated_Image_enmlecenmlecenml.png',
        'existing/Gemini_Generated_Image_hst80bhst80bhst8.png',
        'existing/Gemini_Generated_Image_jr0b3gjr0b3gjr0b.png',
        'existing/Gemini_Generated_Image_urd97hurd97hurd9.jfif',
        'existing/Gemini_Generated_Image_x419dpx419dpx419.jfif',
        'existing/kling_20260718_IMAGE_파스텔_저폴리_3D_2652_0.png',
        'existing/kling_20260718_IMAGE_파스텔_저폴리_3D_2657_0.png',
        'existing/kling_20260718_IMAGE_파스텔_저폴리_3D_2663_0.png',
        'existing/kling_20260718_IMAGE_파스텔_저폴리_3D_2670_1.png',
        'existing/kling_20260718_IMAGE_파스텔_저폴리_3D_2672_0.png',
        'existing/kling_20260718_IMAGE_파스텔_저폴리_3D_2672_1 (1).png',
        'existing/kling_20260718_IMAGE_파스텔_저폴리_3D_2672_3.png',
        'house/textures/',
    }
    p = collections.Counter(x.get('path') for x in items if x.get('path'))
    dups = set(k for k, v in p.items() if v > 1)
    for k in sorted(dups - KNOWN_DUP):
        bad.append('★ 새 겹침 — path %s 가 %d번 나온다' % (k, p[k]))
    healed = KNOWN_DUP - dups
    if healed:
        print('ℹ 전부터 있던 겹침 %d개가 사라졌다 — 누가 정리했다면 KNOWN_DUP 에서 빼라: %s'
              % (len(healed), sorted(healed)[:3]))

    # ③-b ★ name_ko 는 «짝 이름»이다 — 겹치는 것이 정상이다 (manifest._name_ko_rule)
    #   ⚠ 그러니 「겹치면 운다」로 짜면 안 된다. 2026-08-30 기준 137개가 «정상»으로 겹친다.
    #     ★ char 가 짚었다 — "매번 137줄이 울면 사람이 그 자를 안 보게 됩니다".
    #   ⇒ 잡을 것은 «짝이 아닌» 겹침뿐이다: 2D끼리 또는 3D끼리 같은 이름을 쓰는 것.
    #     2026-08-30 에 137개를 다 갈라 봤고 «전부» 2D↔3D 짝이었다(어긋난 것 0).
    byname = collections.defaultdict(list)
    for x in items:
        if x.get('name_ko'): byname[x['name_ko']].append(x)
    #   ⚠⚠ 처음엔 「무리가 «통째로» 2D 이거나 «통째로» 3D 면 운다」로 짰다. **구멍이었다** —
    #     일부러 망가뜨려 보니 「2D 하나 + 3D «둘»」이 그냥 지나갔다(무리에 둘 다 있으니까).
    #     ⇒ ★ 그런데 그것도 «진짜 충돌»이다 — 3D 두 물건이 같은 이름을 쓰는 것이다.
    #   ⇒ ⇒ 옳은 규칙은 이것이다: **한 이름에 2D «하나» · 3D «하나»까지.**
    #   ⚠ 그리고 «같은 path 가 두 줄»인 것은 위 ③ 이 이미 잡는다. 여기서 또 울면
    #     한 사고로 «두 번» 우는 것이다 — 그러면 사람이 자를 안 믿는다. 그래서 path 로 먼저 접는다.
    for k, v in byname.items():
        seenp = set(); v = [x for x in v if not (x.get('path') in seenp or seenp.add(x.get('path')))]
        if len(v) < 2: continue
        n3 = sum(1 for x in v if x.get('is_glb'))
        n2 = len(v) - n3
        if n2 > 1 or n3 > 1:
            bad.append('name_ko 「%s」 — 2D %d개 · 3D %d개다. 짝은 «하나씩»이어야 한다 (%s)'
                       % (k, n2, n3, ', '.join(str(x.get('path')) for x in v)))

    # ④ ★ GLB 인데 크기가 없나 — 이 저장소는 「GLB 는 전부 real_max_m 을 갖는다」로 굴러왔다
    noSize = [x.get('file') for x in items if x.get('is_glb') and 'real_max_m' not in x]
    if noSize: bad.append('GLB 인데 real_max_m 이 없는 줄 %d개: %s' % (len(noSize), noSize[:5]))

    # ④-b ★★ «베낀 자리»가 갈라지지 않았나 — 캐릭터 줄을 [Char] 의 자와 견준다
    #   ⚠⚠ 왜 필요했나 (2026-08-30): 표정 이름 하나가 «네 군데»에 있었다 —
    #       파일 이름 · core 의 표정 키 · 여기 name_ko · 그리고 ★ char 의 뽑는 자 안의 표.
    #     셋을 고쳤는데 «넷째»는 아무도 안 보고 있었고, char 가 다시 뽑는 날
    #     틀린 이름이 «조용히 되살아날» 뻔했다.
    #   ⇒ ★ 틀린 이름은 고쳐도 남는다. «베낀 자리»가 따로 있기 때문이다.
    #   ⇒ ⇒ 그러니 char 의 자가 낸 것과 여기를 «견준다». 겹치는 칸만 본다 —
    #      real_max_m·scale_to_real·id 는 내가 채운 것이라 그쪽 자가 모른다.
    DERIVED = 'assets/derived/manifest_char.json'
    OWNED = ('name_ko', 'category', 'type', 'char', 'file')
    if os.path.exists(DERIVED):
        try:
            dv = json.load(open(DERIVED, encoding='utf-8'))['items']
        except Exception as e:
            bad.append('%s 를 못 읽는다 — %s' % (DERIVED, e)); dv = []
        mine = {x.get('path'): x for x in items}
        for x in dv:
            me = mine.get(x.get('path'))
            if me is None:
                bad.append('char 의 자에는 있는데 여기 없다: %s' % x.get('path')); continue
            for k in OWNED:
                if k in x and me.get(k) != x[k]:
                    bad.append('%s 의 %s 가 갈렸다 — 여기 %r · char 의 자 %r'
                               % (x.get('path'), k, me.get(k), x[k]))

    # ⑤ 적힌 path 가 실제로 있나 (없으면 지워졌거나 옮겨진 것)
    gone = [x['path'] for x in items
            if x.get('path') and not os.path.exists(os.path.join('assets', x['path']))]
    if gone: bad.append('path 가 가리키는 파일이 없는 줄 %d개: %s' % (len(gone), gone[:5]))

    if bad:
        print('⛔ manifest 가 스스로와 어긋난다 — %d건' % len(bad))
        for b in bad: print('   ·', b)
        return 1
    print('✔ manifest 가 스스로와 맞는다 — items %d · GLB %d' %
          (len(items), sum(1 for x in items if x.get('is_glb'))))
    return 0

if __name__ == '__main__':
    sys.exit(main())
