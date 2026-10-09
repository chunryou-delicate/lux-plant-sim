# -*- coding: utf-8 -*-
"""tools/leaf/stage_meshy1009.py — Meshy 10-09 받은 9가족을 «들일 꼴»로 만든다(따로 둔 폴더 · 제자리는 안 건드림) · [leaf]
   기본판 = 받은 GLB 에 색 손질(옛 가족 색에 맞춘 값 · lift_base) + 텍스처 1024 JPEG
   쨍판(_v1) = recolor_calm.redo_vivid(기본판) · 차분판(_v2) = recolor_calm.redo(기본판, PICK 표의 판 · 없으면 3)
   ⇒ 옛 가족과 같은 규칙으로 세 판이 선다. 손질값은 thumbs 같은 크기 견줌으로 정했다(leaf-index 10-09).
   쓰기: PYTHONIOENCODING=utf-8 python tools/leaf/stage_meshy1009.py <받은 폴더> <낼 폴더>"""
import sys, os, subprocess
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import recolor_calm as rc

PARAMS = {                      # (감마, 채도배, 색상°) — 옛 썸네일과 같은 크기로 견줘 정한 값
    'mon_zebra':               (0.5, 0.375, 14),
    'mon_star_pinkmint':       (0.5, 0.45, 10),
    'mon_halfmoon_greencream': (0.53, 0.75, 12),
    'mon_green_lemonpatch':    (0.53, 0.78, 7),
    'mon_neon_lime':           (0.55, 1.1, -7),
    'mon_variegata_gold':      (1.0, 0.89, 11),
    'heart_albo_2672_3':       (0.45, 0.6, 20),
    'pothos_cream_marble':     (0.67, 0.42, -1),
    'pothos_mint_dot_34':      (0.75, 0.61, 16),
}

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    for fam, (g, s, h) in PARAMS.items():
        base = os.path.join(dst, fam + '.glb')
        if os.path.exists(base): print('⛔ 이미 있다', base); continue
        r = subprocess.run([sys.executable, os.path.join(HERE, 'lift_base.py'), os.path.join(src, fam + '_new.glb'), base, str(g), str(s), str(h), '--max=1024'],
                           capture_output=True, text=True, encoding='utf-8')
        if r.returncode: print('⛔', fam, r.stdout[-200:], r.stderr[-300:]); continue
        rc.redo_vivid(base, os.path.join(dst, fam + '_v1.glb'))
        rc.redo(base, os.path.join(dst, fam + '_v2.glb'), rc.PICK.get(fam, 3))
        sz = [os.path.getsize(os.path.join(dst, fam + x + '.glb')) // 1024 for x in ('', '_v1', '_v2')]
        print(f'{fam:26s} γ{g} S×{s} H{h:+} → 기본 {sz[0]}KB · 쨍 {sz[1]}KB · 차분 {sz[2]}KB (차분 판 {rc.PICK.get(fam, 3)})')
