# -*- coding: utf-8 -*-
"""tools/leaf/phone_px.py — 에셋이 «폰 화면에서 몇 픽셀»인지 환산한다 (2026-08-24 · leaf)

    PYTHONIOENCODING=utf-8 python tools/leaf/phone_px.py

★ 왜 있나 — 2026-08-24 박사님: *"근데 니가 화질 구지라서 안 보이는 거지,
  실플레이할 때는 자라는 것처럼 보이긴 하는데"*
  ⇒ 그날 배운 것: **에셋이 「실물 크기로 맞다」와 「폰에서 읽힌다」는 다른 물음**이다.
  ⇒ 그래서 **미터를 픽셀로 바꿔 놓고** 본다.

★ 자의 뿌리 — 재서 잡았다. 지어내지 않았다
    폰 컷 390×844 · dpr 2  →  실제 그림 780×1688
    시루(real_max_m 0.24)가 그 컷에서 ≈ 26 px
    ⇒ **1 m ≈ 106 px** (dpr 2 기준 · dpr 1 로는 그 절반)

⚠ 이 자가 못 하는 것
  · 깊이를 안 본다. 뒤에 있는 물건은 더 작게 보인다
  · 카메라를 당기면 달라진다. **첫 화면 기준**이다
  · ★ 「몇 픽셀인가」와 「읽히는가」는 또 다르다. 무늬가 굵으면 작아도 읽힌다
"""
import json, io, os, sys

PX_PER_M = 106.0          # ★ 재서 잡은 값 (dpr 2)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 얼마면 「읽히나」 — 중간잎 42px 시험에서 11 중 5~6 만 갈렸다
def verdict(px):
    if px >= 80:  return '넉넉하다'
    if px >= 45:  return '읽힌다'
    if px >= 25:  return '⚠ 아슬아슬'
    return '⛔ 뭉갠다'

GROUPS = [
    ('용기', ['container_siru_open', 'container_siru_closed', 'container_tray_s', 'container_tray_l',
              'pot_glassjar', 'pot_nursery_black', 'pot_concrete_round', 'pot_concrete_square',
              'pot_terracotta_wood', 'pot_macrame_hanging']),
    ('작물', ['beansprout_s', 'beansprout_m', 'beansprout_l',
              'sprout_radish_s', 'sprout_radish_m', 'sprout_radish_l',
              'seed_dicot', 'seed_monocot', 'sprout_dicot', 'sprout_monocot']),
    ('몬스테라·잎', ['monstera_leaf_early1', 'monstera_bud_furled',
                     'monstera_leaf_mid1', 'heart_albo_2672_3', 'monstera_leaf_mature']),
    ('삽수', ['pot_glassjar', 'pot_nursery_black']),
]

# ★ 등은 manifest 가 아니라 data/furniture_presets.json 이 갖는다 (가구·조명은 그쪽 소관)
LIGHT_PRESETS = ['lamp_ceiling', 'growlight_bar', 'growlight_clip', 'growlight_stand',
                 'lamp_desk', 'lamp_clip']

def main():
    M = json.load(io.open(os.path.join(ROOT, 'assets', 'manifest.json'), encoding='utf-8'))['items']
    by = {}
    for it in M:
        p = str(it.get('path', ''))
        if p.endswith('.glb'):
            by[os.path.splitext(os.path.basename(p))[0]] = it
    print('폰(390×844 · dpr 2)에서 몇 픽셀인가   —   1 m ≈ %.0f px' % PX_PER_M)
    print('%-26s %9s %9s   %s' % ('에셋', '실제 m', '폰 px', '읽히나'))
    for ko, names in GROUPS:
        print('── %s ' % ko + '─' * 46)
        for n in names:
            it = by.get(n)
            if not it:
                print('   %-23s %9s' % (n, '(없다)')); continue
            m = it.get('real_max_m')
            if not isinstance(m, (int, float)):
                print('   %-23s %9s' % (n, '(크기 없음)')); continue
            px = m * PX_PER_M
            print('   %-23s %9.3f %9.0f   %s' % (n, m, px, verdict(px)))
    # ── 등 ──────────────────────────────────────────────
    try:
        FP = json.load(io.open(os.path.join(ROOT, 'data', 'furniture_presets.json'), encoding='utf-8'))['presets']
    except Exception as e:
        print('── 등 ── (프리셋을 못 읽었다: %s)' % e); return
    print('── 등 ' + '─' * 47)
    for n in LIGHT_PRESETS:
        p = FP.get(n)
        if not p: print('   %-23s %9s' % (n, '(없다)')); continue
        sm = p.get('size_m') or {}
        m = max([v for v in (sm.get('w'), sm.get('d'), sm.get('h')) if isinstance(v, (int, float))] or [0])
        if not m: print('   %-23s %9s' % (n, '(크기 없음)')); continue
        px = m * PX_PER_M
        print('   %-23s %9.3f %9.0f   %s' % (n, m, px, verdict(px)))

if __name__ == '__main__':
    main()
