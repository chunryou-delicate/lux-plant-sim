# -*- coding: utf-8 -*-
"""tools/leaf/skeleton_doc.py — 새 두 종 뼈대 조정표를 낸다 ([leaf] 10-23 · D71) — skeleton_table 의 잰 값 → 보정값 → JSON · md 표
   보정(같은 종 안 «같은 자» · 모두 normalizeAsset(anchorBottom) 뒤 자루 끝 원점에서 · 안쪽부터 기울기 → 거울 → 배율):
     · pitch_fix_deg — 잎몸 겉면이 위로 든 각(face_up_deg)이 10° 넘으면 그만큼 X 축으로 되세운다(three.js rotation.x · −면 윗쪽이 앞(−Z)으로)
       ⚠ 통째로 돌리니 자루도 같이 눕는다 — after_fix.petiole_lean_deg 가 그 값(크면 이 보정 대신 메시에서 이음을 꺾어야 한다)
     · mirror_x — 자루 윗끝이 종의 «뚜렷한 다수»(|x| > .05 인 판들)와 반대 X 쪽이면 true(scale.x = −1 · 겉면 −Z 그대로)
     · skin_scale — 무늬판(Tripo 따로 · 다른 뼈대)의 잎몸을 같은 단계 바탕 잎과 «넓이가 같게»(길이×폭의 제곱근) 맞추는 배율
       stage_real_m — 그 무늬판 하나로 단계마다 쓸 때 잎몸 넓이가 바탕 잎과 같아지는 실측(가장 긴 축 m · 중간 무늬판은 성숙 판을 줄여 쓴다)
   쓰기: python tools/leaf/skeleton_doc.py <skeleton_table json> <out.json> <out.md>"""
import sys, json, math
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np

ORDER = ['young', 'mid', 'mature']
r3 = lambda v: round(float(v), 3)

def fix_matrix(e):                                               # 기울기 → 거울 → 배율 (자루 끝 원점에서)
    t = math.radians(e.get('pitch_fix_deg', 0)); c, s = math.cos(t), math.sin(t)
    Rx = np.array([[1, 0, 0], [0, c, -s], [0, s, c]])            # three.js rotation.x — +Y 가 +Z 쪽으로
    return np.diag([-1 if e.get('mirror_x') else 1, 1, 1]) @ Rx * e.get('skin_scale', 1)

def build(T):
    out = {}
    for sp, rows in T.items():
        base = {n: r for n, r in rows.items() if n.count('_') <= 2}                    # sc_leaf_mid · ca_leaf_mature …
        res = {}
        for n, r in rows.items():
            e = dict(r); e['stage'] = n.split('_')[2]
            e['pitch_fix_deg'] = -r['face_up_deg'] if abs(r['face_up_deg']) > 10 else 0.0
            res[n] = e
        side = [np.sign(e['petiole_top_xyz'][0]) for e in res.values() if abs(e['petiole_top_xyz'][0]) > 0.05]
        major = int(np.sign(sum(side))) if side and abs(sum(side)) >= 2 else 0                 # 뚜렷한 다수가 없으면 거울 없음
        for n, e in res.items():
            e['mirror_x'] = bool(major and abs(e['petiole_top_xyz'][0]) > 0.05 and np.sign(e['petiole_top_xyz'][0]) != major)
            ref = base.get('_'.join(n.split('_')[:3]))
            if ref is not None and ref is not rows[n] and 'blade_len_m' in e and 'blade_len_m' in ref:
                g = lambda x: math.sqrt(x['blade_len_m'] * x['blade_width_m'])
                e['skin_of'] = '_'.join(n.split('_')[:3]); e['skin_scale'] = r3(g(ref) / g(e))
                e['skin_scale_by_len'] = r3(ref['blade_len_m'] / e['blade_len_m']); e['skin_scale_by_width'] = r3(ref['blade_width_m'] / e['blade_width_m'])
                e['stage_real_m'] = {s: r3(e['real_max_m'] * g(b) / g(e)) for s in ORDER for b in [base.get(f"{n.split('_')[0]}_leaf_{s}")] if b and 'blade_len_m' in b}
            M = fix_matrix(e); m = e['real_max_m'] / e['longest_axis_norm']
            pt, bc = M @ np.array(e['petiole_top_xyz']), M @ np.array(e['blade_centroid_xyz'])
            e['after_fix'] = {'petiole_top_xyz': [r3(v) for v in pt], 'blade_centroid_xyz': [r3(v) for v in bc],
                              'blade_centroid_m': [r3(v * m) for v in bc],
                              'petiole_lean_deg': round(math.degrees(math.acos(max(-1, min(1, pt[1] / (np.linalg.norm(pt) or 1))))), 1)}
        out[sp] = {'petiole_side_majority_x': major, 'leaves': res}
    return out

if __name__ == '__main__':
    src, oj, om = sys.argv[1:4]
    T = json.load(open(src, encoding='utf-8')); T.pop('pink_princess', None)          # PP 는 대조로만 잰 것(굽은 잎이라 이 자가 안 맞다)
    D = build(T)
    json.dump({'_doc': '새 두 종 뼈대 조정표(leaf 10-23 · D71 · tools/leaf/skeleton_table.py → skeleton_doc.py) — normalizeAsset(anchorBottom) 과 같은 자: 자루 끝 = 원점 · 높이 1. '
               '*_frac · *_xyz 는 정규 단위 · *_m 은 manifest real_max_m(가장 긴 축) 기준 미터. 잎몸 길이·폭은 잎몸 «제 평면»(주성분)에서 잰다. '
               '보정은 자루 끝 원점에서 안쪽부터 기울기(pitch_fix_deg · rotation.x) → 거울(mirror_x) → 배율(skin_scale). after_fix = 보정 뒤 값. '
               '자세한 뜻은 docs/handoff/leaf-species2-skeleton-20261023.md', 'species': D},
              open(oj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    L = []
    for sp, d in D.items():
        mj = {1: 'X+', -1: 'X−', 0: '없음'}[d['petiole_side_majority_x']]
        L.append(f"### {sp} (자루 윗끝 뚜렷한 다수 쪽 {mj})"); L.append('')
        L.append('| 판 | 단계 | 실측 m | 잎몸 길이×폭(cm) | 자루(cm) | 겉면 듦 · 잎몸 뒤로 · 옆으로(°) | 기울기 보정 rotation.x | X 거울 | 보정 뒤 자루 누움(°) | 보정 뒤 잎몸 중심(cm) |')
        L.append('|---|---|---|---|---|---|---|---|---|---|')
        for n, e in d['leaves'].items():
            a = e['after_fix']
            L.append(f"| {n} | {e['stage']} | {e['real_max_m']} | {e['blade_len_m']*100:.1f}×{e['blade_width_m']*100:.1f} | {e['petiole_m']*100:.1f} | "
                     f"{e['face_up_deg']} · {e['blade_pitch_deg']} · {e['blade_side_deg']} | {(str(e['pitch_fix_deg']) + '°') if e['pitch_fix_deg'] else '—'} | "
                     f"{'예' if e['mirror_x'] else '—'} | {a['petiole_lean_deg']} | {[round(v * 100, 1) for v in a['blade_centroid_m']]} |")
        sk = [(n, e) for n, e in d['leaves'].items() if 'skin_scale' in e]
        if sk:
            L.append(''); L.append('| 무늬판 | 바탕 | 판 맞춤 배율(넓이) | (길이로 · 폭으로) | 단계마다 쓸 실측 m(잎몸 넓이 맞춤) |'); L.append('|---|---|---|---|---|')
            for n, e in sk:
                L.append(f"| {n} | {e['skin_of']} | ×{e['skin_scale']} | ×{e['skin_scale_by_len']} · ×{e['skin_scale_by_width']} | "
                         + ' · '.join(f'{s} {v}' for s, v in e['stage_real_m'].items()) + ' |')
        L.append('')
    open(om, 'w', encoding='utf-8').write('\n'.join(L)); print('★', oj, om)
