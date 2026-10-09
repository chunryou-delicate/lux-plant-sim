# -*- coding: utf-8 -*-
"""새 주인공(hero2) — 색 맞춘 리그 + Meshy 클립들을 게임이 읽는 한 파일로 엮는다 — 크레딧 0.

2026-10-09 · [Char] · Meshy 주문표 ①② 의 받은 것 (rig 01a11e7a)

■ 하는 일
  1) 리그 GLB 의 Meshy 기본 애니(clip0)를 빼고, clips/*.glb 를 «게임 이름»으로 붙인다(merge_clips · 채널 통째 · 뼈 이름)
  2) 아무도 안 쓰는 bufferView(옛 텍스처 등)를 빼고 버퍼를 다시 짠다 — accessor 값이 그대로인지 되읽어 본다(관문)
  3) 게임이 «몸마다 다른 수»로 쓰던 것을 재서 scene.extras 에 적는다 — v2_hero 가 읽는다(GLTFLoader → scene.userData)
       crouchHand  쭈그리기 클립의 오른손 높이 표 [[t, 게임 m], …] (v2_hero crouchEnd 가 쓰던 HAND 표)
       walkMps     걷기 클립 지면 속도 [m/s] — 옛 몸 걷기와 «같은 자»로 잰 비 × 0.76 (v2_hero HERO_WALK_MPS 와 같은 셈)
       emoteWin    cheer 의 «팔이 가장 높은 3초» 구간 — 새 cheer(Motivational_Cheer)는 9초라 통째로 틀면 길다
■ 자기시험 (--selftest) — 옛 hero.glb 의 crouch 로 손 높이 표를 다시 재 v2_hero 의 HAND 표가 나오는가

쓰기
  python tools/char/build_hero2.py --selftest
  python tools/char/build_hero2.py <색 맞춘 리그.glb> <clips 폴더> <나갈.glb>
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
from strip_stray_parts import read_glb, write_glb, acc_array  # noqa: E402
from merge_clips import merge  # noqa: E402
from probe_anim_hands import Clip, mpos  # noqa: E402
from probe_arm_spread import use_animation, spread  # noqa: E402

HERO_H = 1.40
OLD_HAND = [[0.8, 0.666], [1.2, 0.526], [1.6, 0.312], [2.0, 0.166], [2.4, 0.120]]   # v2_hero.js HAND (옛 hero crouch)
OLD_WALK_MPS = 0.76
# 게임 이름 ← clips/<파일>.glb
CLIPS = [('walk', 'walking'), ('idle', 'idle'), ('sit', 'sit'), ('sleep', 'sleep'), ('crouch', 'crouch'),
         ('cheer', 'cheer'), ('wave', 'wave'), ('water', 'water'), ('harvest', 'harvest'),
         ('harvest_low', 'harvest_low'), ('pickup', 'pickup'), ('scratch', 'scratch'), ('nod', 'nod'),
         ('listen', 'listen'), ('run', 'running')]


def compact(js, bn):
    used = set(a['bufferView'] for a in js['accessors'] if 'bufferView' in a)
    used |= set(i['bufferView'] for i in js.get('images', []) if 'bufferView' in i)
    remap, views, out = {}, [], bytearray()
    for i, v in enumerate(js['bufferViews']):
        if i not in used:
            continue
        while len(out) % 4:
            out.append(0)
        o = v.get('byteOffset', 0)
        nv = dict(v); nv['byteOffset'] = len(out)
        out.extend(bn[o:o + v['byteLength']])
        remap[i] = len(views); views.append(nv)
    for a in js['accessors']:
        if 'bufferView' in a:
            a['bufferView'] = remap[a['bufferView']]
    for im in js.get('images', []):
        if 'bufferView' in im:
            im['bufferView'] = remap[im['bufferView']]
    js['bufferViews'] = views
    js['buffers'][0]['byteLength'] = len(out)
    return out


def file_height(js, bn):
    P = acc_array(js, bn, js['meshes'][0]['primitives'][0]['attributes']['POSITION'])
    return float(P[:, 1].max() - P[:, 1].min())


def clip_index(c, name):
    for i, a in enumerate(c.j.get('animations') or []):
        if a.get('name') == name:
            return i
    return None


def hand_table(path, clip='crouch', fileH=None, times=None):
    js, bn = read_glb(path)
    fileH = fileH or file_height(js, bn)
    c = Clip(path)
    use_animation(c, clip_index(c, clip))
    # ⚠ v2_hero 는 .scale 트랙을 뺀다(idle Hips 1.176) — 같은 그림이 되게 여기서도 뺀다
    for k in list(c.tracks):
        c.tracks[k].pop('scale', None)
    h = c.find('RightHand')
    # ⛔ 첫 판은 옛 표처럼 0.8~2.4초만 쟀다 ⇒ 새 crouch 는 0.8초에 이미 손이 0.493m 라 창턱(찾는 높이 0.62m)이 표 밖이었다
    #   ⇒ 0초부터 잰다(v2_hero crouchEnd 는 표 위로 벗어나면 가장 이른 때를 쓴다)
    ts = times or (0.8, 1.2, 1.6, 2.0, 2.4)
    return [[round(t, 2), round(mpos(c.world(t)[h])[1] / fileH * HERO_H, 3)] for t in ts]


def walk_speed(path, clip='walk', steps=240):
    """제자리 걷기에서 «디딘 발»이 뒤로 미끄러지는 속도(파일 단위/초) — 지면 속도와 같다. 옛 몸과 같은 자로 견주는 데만 쓴다."""
    js, bn = read_glb(path)
    fileH = file_height(js, bn)
    c = Clip(path)
    use_animation(c, clip_index(c, clip))
    for k in list(c.tracks):
        c.tracks[k].pop('scale', None)
    vs = []
    for side in ('Left', 'Right'):
        f = c.find(side + 'ToeBase') or c.find(side + 'Foot')
        ts = np.linspace(0, c.duration, steps, endpoint=False)
        pos = np.array([mpos(c.world(t)[f]) for t in ts])
        y = pos[:, 1]
        stance = y < y.min() + 0.012 * fileH
        dz = np.gradient(pos[:, 2], ts)
        if stance.sum() > 3:
            vs.append(float(np.median(-dz[stance])))
    return float(np.median(vs)) / fileH * HERO_H if vs else None


def cheer_window(path, clip='cheer', win=3.0, step=0.1):
    c = Clip(path)
    use_animation(c, clip_index(c, clip))
    ts = np.arange(0, c.duration, step)
    sp = np.array([np.mean(spread(c, t)) for t in ts])
    n = int(round(win / step))
    if len(sp) <= n:
        return [0.0, round(c.duration, 2)], float(sp.mean())
    best = max(range(len(sp) - n), key=lambda i: sp[i:i + n].mean())
    return [round(best * step, 2), round(best * step + win, 2)], float(sp[best:best + n].mean())


def selftest():
    old = 'assets/v2/char/hero.glb'
    tab = hand_table(old)
    worst = max(abs(a[1] - b[1]) for a, b in zip(tab, OLD_HAND))
    print('자기시험 ① 옛 hero crouch 손 높이 표 %s' % tab)
    print('           v2_hero HAND           %s · 가장 큰 차 %.3f m %s' % (OLD_HAND, worst, '✔' if worst < 0.01 else '⛔'))
    v = walk_speed(old, 'walk')
    print('자기시험 ② 옛 hero walk 디딘 발 속도(같은 자) %.3f m/s — hero2 는 이 값과의 비 × %.2f' % (v, OLD_WALK_MPS))
    return 0 if worst < 0.01 else 1


def main():
    if '--selftest' in sys.argv:
        return selftest()
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 3:
        print(__doc__); return 1
    base, cdir, dst = args
    js, bn = read_glb(base)
    js['animations'] = []
    for name, f in CLIPS:
        p = os.path.join(cdir, f + '.glb')
        if os.path.exists(p):
            merge(js, bn, name, p)
        else:
            print('  ⚠ %s 없음 — 건너뜀' % p)
    before = [acc_array(js, bn, i).copy() for i in range(len(js['accessors']))]
    n0 = len(bn)
    bn2 = compact(js, bn)
    # ⛔ acc_array 는 버퍼 사본 위의 «보기»를 돌려준다 — 모아 두면 사본(10MB)이 accessor 수만큼 쌓여 메모리가 넘친다(실제로 넘쳤다)
    #   ⇒ 하나씩 견주고 버린다
    same = True
    for i, a in enumerate(before):
        b = acc_array(js, bn2, i)
        if a.shape != b.shape or not np.array_equal(a, b):
            same = False; break
        del b
    print('■ 버퍼 다시 짬 %d → %d 바이트 · accessor %d개 되읽어 %s' % (n0, len(bn2), len(before), '✔ 같다' if same else '⛔ 다르다'))
    if not same:
        return 3
    write_glb(dst, js, bn2)
    # 몸마다 다른 수 — 쓴 파일로 잰다
    fileH = file_height(js, bn2)
    tab = hand_table(dst, 'crouch', fileH, [i * 0.2 for i in range(13)])
    v_old = walk_speed('assets/v2/char/hero.glb', 'walk')
    v_new = walk_speed(dst, 'walk')
    mps = round(OLD_WALK_MPS * v_new / v_old, 3)
    w, s = cheer_window(dst)
    js['scenes'][js.get('scene', 0)]['extras'] = {
        'hero': 'hero2', 'rig': '01a11e7a-322a-748f-9f2e-b72090b5f5b3',
        'crouchHand': tab, 'walkMps': mps, 'emoteWin': {'cheer': w}}
    write_glb(dst, js, bn2)
    print('■ 키(파일) %.3f · 쭈그리기 오른손 표 %s' % (fileH, tab))
    print('■ 걷기 디딘 발 속도  옛 %.3f · 새 %.3f m/s(같은 자) ⇒ walkMps %.3f (옛 0.76 × 비)' % (v_old, v_new, mps))
    print('■ cheer 팔이 가장 높은 3초 %s (벌림 평균 %.1f°)' % (w, s))
    print('썼다: %s (%.2fMB) · 클립 %d' % (dst, os.path.getsize(dst) / 1e6, len(js['animations'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
