# -*- coding: utf-8 -*-
"""tools/leaf/skeleton_view.py — 뼈대 조정표를 «그림»으로 본다 ([leaf] 10-23 · D71 · 브라우저 없이)
   판마다 normalizeAsset(anchorBottom) 자로 세우고 실측 cm 로 나란히 찍는다. 두 벌:
     · 위 두 줄 = 지금 GLB 그대로(앞 = 겉면 쪽 −Z 에서 · 옆 = +X 에서, 오른쪽이 +Z = 뒤)
     · 아래 두 줄 = 조정표의 기울기(pitch_fix_deg) → 거울 → 배율(skin_scale)을 넣은 뒤
   빨강 = 자루 끝(원점) · 주황 = 자루 윗끝 · 파랑 = 잎끝.
   쓰기: python tools/leaf/skeleton_view.py <skeleton_doc json> <out.png>"""
import sys, os, json
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from skeleton_table import world
from skeleton_doc import fix_matrix
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
plt.rcParams['font.family'] = ['Malgun Gothic', 'sans-serif']; plt.rcParams['axes.unicode_minus'] = False

def norm(P):                                           # normalizeAsset(anchorBottom) 와 같은 셈
    y0 = P[:, 1].min(); h = np.ptp(P[:, 1]); band = P[P[:, 1] <= y0 + 0.08 * h]
    return (P - [band[:, 0].mean(), y0, band[:, 2].mean()]) / h

def path_of(n):
    sp = {'sc': 'scindapsus', 'ca': 'calathea'}[n[:2]]
    return os.path.join(ROOT, 'assets', 'plants', sp, *(['skins'] if n.count('_') > 2 else []), n + '.glb')

if __name__ == '__main__':
    D = json.load(open(sys.argv[1], encoding='utf-8'))['species']
    cols = [(sp, n, e) for sp, d in D.items() for n, e in d['leaves'].items()]
    fig, ax = plt.subplots(4, len(cols), figsize=(2.0 * len(cols), 10.5))
    for i, (sp, n, e) in enumerate(cols):
        Q = norm(world(path_of(n))); m = e['real_max_m'] / e['longest_axis_norm'] * 100   # 정규 1 = m cm
        Q = Q[np.random.default_rng(0).choice(len(Q), min(len(Q), 3000), replace=False)]
        M = fix_matrix(e)
        marks = np.array([[0, 0, 0], e['petiole_top_xyz'], e['tip_xyz']])
        for k, X, K in [(0, Q * m, marks * m), (2, Q @ M.T * m, marks @ M.T * m)]:
            for r, (a, b) in enumerate([(0, 1), (2, 1)]):
                A = ax[k + r, i]; sgn = -1 if a == 0 else 1          # 앞(−Z 에서)은 +X 가 왼쪽
                A.scatter(sgn * X[:, a], X[:, b], s=0.4, c='#3d8a4f' if sp == 'scindapsus' else '#5a7d9a')
                A.scatter(sgn * K[:, a], K[:, b], s=22, c=['#d33', '#e90', '#25c'], zorder=3)
                A.set_aspect('equal'); A.grid(alpha=.3); A.tick_params(labelsize=6)
        ax[0, i].set_title(n.replace('sc_leaf_', 'SC ').replace('ca_leaf_', 'CA ').replace('mature_', 'mature\n'), fontsize=8)
        ax[3, i].set_xlabel((f"기울기 {e['pitch_fix_deg']}°" if e['pitch_fix_deg'] else '기울기 —') + (' · 거울' if e['mirror_x'] else '') + (f" · ×{e['skin_scale']}" if 'skin_scale' in e else ''), fontsize=7)
    for k, t in enumerate(['지금 · 앞', '지금 · 옆(→뒤)', '보정 뒤 · 앞', '보정 뒤 · 옆(→뒤)']): ax[k, 0].set_ylabel(t + ' · cm', fontsize=8)
    fig.suptitle('새 두 종 뼈대 — 위 = 지금 GLB · 아래 = 조정표 넣은 뒤 · 빨강 자루 끝 · 주황 자루 윗끝 · 파랑 잎끝 (실측 cm)', fontsize=9)
    fig.tight_layout(); fig.savefig(sys.argv[2], dpi=100); print('★', sys.argv[2])
