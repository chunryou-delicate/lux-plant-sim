# -*- coding: utf-8 -*-
"""tools/leaf/check_thumb_fresh.py — 썸네일이 «내용»으로 낡았나 (2026-08-30 · leaf)

    node tools/glb_thumb.mjs --all=<폴더> --force   (임시 폴더에 다시 찍고)
    PYTHONIOENCODING=utf-8 python tools/leaf/check_thumb_fresh.py <새로 찍은 폴더> <저장소 폴더>

⚠⚠ 왜 다시 지었나 — **어제(08-30) 나는 `mtime` 으로 「낡았다」를 쟀다. 틀렸다.**
  7장이 「낡음」으로 나왔는데 화소로 견주니 무지와의 거리가 **정확히 0.00** 움직였다.
  ⇒ ★ 「«언제» 만들어졌나」는 「«무엇이» 바뀌었나」가 아니다.

★★ 그리고 문턱을 «재서» 정했다 — 짐작으로 세우지 않았다:

    ① 한 판 «안»에서 같은 GLB 를 두 번 찍었다
       ⇒ ★ 최대차 «0» · 다른 화소 «0.000%». **렌더는 결정적이다**
    ② 저장소에 있는 것(옛 판에서 찍힘) ↔ 지금 새로 찍은 것
       ⇒ 최대차 3~9 · 평균 0.09~0.17 · «차>8 인 화소» 0.001% 이하
       ⇒ ★★ 즉 «판이 바뀌면» ±9 쯤 흔들린다 (PNG 인코딩·드라이버 차이로 본다)

  ⇒ ⇒ ★★★ 그러니 문턱을 ①(=0)로 세우면 **전부 「바뀜」이 된다.**
       ②에서 세워야 한다. 안 그러면 자가 매번 200줄을 울고, 그러면 사람이 안 본다.

⛔ 이 자가 못 하는 것
  · 「낡았다」를 판정할 뿐 **왜 달라졌는지는 모른다.** GLB 가 바뀐 것인지 찍는 도구가 바뀐 것인지
  · 걸린 것은 **눈으로 봐야 한다.** ±9 아래는 눈에 안 보이고, 위는 봐야 안다
"""
import os, sys, glob
import numpy as np
from PIL import Image

# ── ⚠ 내 창에서만 도는 자가 되지 않게 (char 가 잡아 줬다) ─────────────
import sys as _sys
for _s in (_sys.stdout, _sys.stderr):
    try: _s.reconfigure(encoding='utf-8')
    except Exception: pass

MAX_OK   = 16     # 최대차가 이보다 크면 «내용»이 다르다 (판간 흔들림은 ≤9 로 쟀다)
FRAC_OK  = 0.001  # 「차>8 인 화소」가 이 비율(0.1%)을 넘으면 «내용»이 다르다

SHRINK = 2   # ★ 512² 를 그대로 열면 104장에 2분이 넘는다. 절반으로 줄여 본다 —
             #   우리가 찾는 것은 «넓은 자리의 큰 차이»라 절반에서도 안 사라진다.
             #   ⚠ 한 화소짜리 차이는 놓칠 수 있다. 그건 어차피 눈에도 안 보인다

def _load(p):
    im = Image.open(p).convert('RGBA')
    if SHRINK > 1: im = im.resize((im.width // SHRINK, im.height // SHRINK), Image.BILINEAR)
    return np.asarray(im).astype(int)

def cmp(a_path, b_path):
    a = _load(a_path)
    b = _load(b_path)
    if a.shape != b.shape: return None, None, '크기 다름'
    d = np.abs(a - b); m = d.max(2)
    return int(d.max()), float((m > 8).mean()), None

def main(fresh, repo):
    rows = []
    for p in sorted(glob.glob(os.path.join(fresh, '*.png'))):
        n = os.path.basename(p)
        q = os.path.join(repo, n)
        if not os.path.exists(q): rows.append((n, None, None, '저장소에 없다')); continue
        mx, fr, err = cmp(q, p)
        rows.append((n, mx, fr, err))
    stale = [r for r in rows if r[3] or (r[1] is not None and (r[1] > MAX_OK or r[2] > FRAC_OK))]
    print('견준 것 %d장 · 문턱 — 최대차>%d 또는 「차>8 화소」>%.1f%%' % (len(rows), MAX_OK, 100*FRAC_OK))
    if not stale:
        mx = max((r[1] or 0) for r in rows) if rows else 0
        print('✔ 내용으로 낡은 것 «없다» — 가장 큰 차이도 %d (판간 흔들림 안쪽)' % mx)
        return 0
    print('⛔ 내용이 다른 것 %d장:' % len(stale))
    for n, mx, fr, err in stale:
        print('   %-44s %s' % (n, err or ('최대차 %d · 차>8 화소 %.3f%%' % (mx, 100*fr))))
    return 1

def selftest():
    """★ 자를 «일부러 망가뜨려» 켜지는지 본다.
       ⛔ 이걸 안 하면 「낡은 것 없음」이 «자가 안 도는 것»과 구별이 안 된다."""
    import tempfile, shutil
    src = 'assets/pots/thumbs/pot_concrete_round.png'
    if not os.path.exists(src): print('⚠ 시험용 그림이 없다:', src); return 2
    d1, d2 = tempfile.mkdtemp(), tempfile.mkdtemp()
    ok = True
    try:
        shutil.copy(src, os.path.join(d1, 't.png')); shutil.copy(src, os.path.join(d2, 't.png'))
        # ① 똑같으면 조용해야 한다
        r = main(d1, d2)
        print('  ① 똑같은 두 장 ⇒ %s' % ('✔ 조용하다' if r == 0 else '⛔ 우는데 울면 안 된다')); ok &= (r == 0)
        # ② 판간 흔들림만큼(±9) 흔들면 «조용해야» 한다
        a = np.asarray(Image.open(src).convert('RGBA')).astype(int)
        b = a.copy(); b[..., :3] = np.clip(b[..., :3] + 7, 0, 255)
        Image.fromarray(b.astype('uint8')).save(os.path.join(d1, 't.png'))
        r = main(d1, d2)
        print('  ② ±7 흔들기 ⇒ %s' % ('✔ 조용하다' if r == 0 else '⛔ 판간 흔들림에 운다')); ok &= (r == 0)
        # ③ ★ 진짜로 달라지면 «울어야» 한다
        b = a.copy(); b[100:200, 100:200, :3] = 0
        Image.fromarray(b.astype('uint8')).save(os.path.join(d1, 't.png'))
        r = main(d1, d2)
        print('  ③ 네모를 새까맣게 ⇒ %s' % ('✔ 운다' if r == 1 else '⛔ 안 운다 — 자가 죽었다')); ok &= (r == 1)
        # ④ 한쪽에 없으면 울어야 한다
        os.remove(os.path.join(d2, 't.png'))
        r = main(d1, d2)
        print('  ④ 저장소에 없음 ⇒ %s' % ('✔ 운다' if r == 1 else '⛔ 안 운다')); ok &= (r == 1)
    finally:
        shutil.rmtree(d1, ignore_errors=True); shutil.rmtree(d2, ignore_errors=True)
    print('')
    print('✔ 자가 넷 다 제대로 돈다' if ok else '⛔ 자에 구멍이 있다')
    return 0 if ok else 1

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--selftest':
        sys.exit(selftest())
    if len(sys.argv) < 3:
        print('쓰는 법: python tools/leaf/check_thumb_fresh.py <새로 찍은 폴더> <저장소 폴더>'); sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
