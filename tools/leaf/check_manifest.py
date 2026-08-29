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
    #   ⚠⚠ 그리고 «전부터 있던» 겹침 17건이 있다(2026-08-30 캐릭터 329줄을 합칠 때 세었다).
    #     ⛔ 지우지 않았다 — 남의 손이 넣은 줄이고, 지우는 것은 내 판단이 아니다.
    #     ★ 대신 «따로» 센다. 그래야 «새로 생긴» 겹침이 묻히지 않는다.
    KNOWN_DUP = 17
    p = collections.Counter(x.get('path') for x in items if x.get('path'))
    dups = sorted(k for k, v in p.items() if v > 1)
    if len(dups) > KNOWN_DUP:
        for k in dups: bad.append('path %s 가 %d번 나온다' % (k, p[k]))
        bad.append('★ 겹침이 %d개다 — 전부터 있던 %d개보다 «늘었다»' % (len(dups), KNOWN_DUP))
    elif len(dups) < KNOWN_DUP:
        print('ℹ 겹침이 %d개로 «줄었다»(전엔 %d). 누군가 정리했다면 KNOWN_DUP 을 낮춰라' % (len(dups), KNOWN_DUP))

    # ④ ★ GLB 인데 크기가 없나 — 이 저장소는 「GLB 는 전부 real_max_m 을 갖는다」로 굴러왔다
    noSize = [x.get('file') for x in items if x.get('is_glb') and 'real_max_m' not in x]
    if noSize: bad.append('GLB 인데 real_max_m 이 없는 줄 %d개: %s' % (len(noSize), noSize[:5]))

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
