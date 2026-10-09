# -*- coding: utf-8 -*-
"""유니티 주인공(장난감 턴어라운드 b → Meshy multi-image · 리그 01a12114) — 한 파일로 엮는다 — 크레딧 0.

2026-10-10 · [Char] · 박사님 «나중에 유니티로 만들 것도 생각해서» · 총괄 a459c237
■ hero2(build_hero2.py)와 같은 길 · 다른 것 셋
  ★ 10-10 몸은 Tripo 판(rig 01a12135 · facez)으로 바뀌었다 — Meshy 판은 아래 1)의 까닭으로 관문에 걸렸다.
     Tripo 는 날것 22.1% 지만 머리가 팔에 «안 닿아»(G2 2% 안 0) 전부 떼도 바늘이 없다(cheer·wave·idle 그림) ⇒ 기본 = 전부 떼기.
     머리 색은 이미 정본 곁([101,84,82] · 정본 [95,78,80]) — 색 바꾸기 문턱(B≥G−2)에 걸쳐 반만 칠할 수 있어 --keep-color 로 둔다.
  1) 머리 무게 — `fix_hair_weights.py`(기본 전부 · --near=a,b 면 팔 뼈 거리로 서서히)를 «기본 무게»로 굽는다(--as-emote 아님).
       G3: 날것은 머리 정점 12.3%(2,594)가 팔 무게 >0.5(hero2 0.4%) — 팔이 몸에 더 붙어(손끝 벌림 키의 0.245 · hero2 0.323)
       뒷머리 끝이 아래팔에 닿는다. 전부 떼면 어깨·든 팔에 바늘, 팔 뼈 거리로 서서히(0.08~0.20)면 바늘 없이 곧다.
       팔 내린 idle·걷기도 날것과 같다(그림 16장씩) ⇒ 유니티엔 v2_hero 의 «팔 들 때만 바꾸기»가 없으니 이것을 기본으로.
  2) 머리·티 색 — `recolor_hero_tex.py --hair-hue --hair-gain=1.4`(hero2 와 같은 값 · [42,20,21] → [95,78,80])
  3) 줄이지 않는다 — 그림 2048 · 클립 통째 길이(유니티가 구간을 자른다). 쓰는 구간은 extras.useWin 에 적어 둔다.
■ 클립 이름(게임 이름 ← clips/<파일>) — Meshy 파일 이름이 hero2 와 다른 둘: crouch ← repot(274) · inspect ← a281(281)
■ extras(GLTFLoader → scene.userData · 유니티 glTFast 는 extras 를 못 읽을 수 있다 — 같은 값을 <나갈>.json 으로도 쓴다)

쓰기  python tools/char/build_hero_unity.py <리그.glb> <clips 폴더> <나갈.glb> [--near=0.08,0.20] [--keep-color]
      Tripo 판: ... tripo/rig_01a12135.glb tripo/clips assets/v2/char/hero_unity.glb --keep-color
      남 주인공(리그 서면): ... hero_m_unity/<rig>.glb hero_m_unity/clips assets/v2/char/hero_m_unity.glb --keep-color --hero=hero2_m
        --from="sheet_hero_m_turnaround_toy_a → Tripo multiview e4df0454 (facez)"
        (웹 게임 판 hero2_m.glb 는 그 뒤 diet_hero2.py 로 줄인다 — 그림 1024 · 쓰는 구간만 · 관문)
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
from strip_stray_parts import read_glb, write_glb, acc_array  # noqa: E402
from merge_clips import merge  # noqa: E402
from build_hero2 import compact, file_height, hand_table, walk_speed, cheer_window, break_window, OLD_WALK_MPS  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
CLIPS = [('walk', 'walking'), ('run', 'running'), ('idle', 'idle'), ('sit', 'sit'), ('sleep', 'sleep'), ('crouch', 'repot'),
         ('cheer', 'cheer'), ('wave', 'wave'), ('water', 'water'), ('harvest', 'harvest'), ('harvest_low', 'harvest_low'),
         ('inspect', 'a281'), ('scratch', 'scratch'), ('nod', 'nod'), ('listen', 'listen')]
# 게임(hero2 · diet_hero2 KEEP · v2_hero actClipFrom)이 실제로 트는 구간 — 유니티에서 자를 때의 기준
USE_WIN = {'sit': 'tail', 'water': [0.30, 1.80], 'harvest': [0.30, 2.10], 'harvest_low': [0.30, 2.40], 'inspect': [0.0, 1.6]}


def run(args):
    r = subprocess.run([sys.executable] + args, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        print(r.stdout[-2000:], r.stderr[-2000:])
        raise SystemExit('⛔ %s 실패' % os.path.basename(args[0]))
    return r.stdout


def hair_arm_strong(path):
    """머리 정점 중 팔 무게 >0.5 몫 — G3 자(hero2 0.4% 를 되내는 것을 확인한 자)."""
    import io
    from PIL import Image
    js, bn = read_glb(path)
    prim = js['meshes'][0]['primitives'][0]; at = prim['attributes']
    J = np.asarray(acc_array(js, bn, at['JOINTS_0'])); W = np.asarray(acc_array(js, bn, at['WEIGHTS_0']), float)
    if W.max() > 1.5:
        W = W / 255.0
    UV = np.asarray(acc_array(js, bn, at['TEXCOORD_0']), float)
    names = [js['nodes'][j].get('name', '') for j in js['skins'][0]['joints']]
    arm = np.array(['Arm' in n or 'Hand' in n for n in names])
    t = js['materials'][prim['material']]['pbrMetallicRoughness']['baseColorTexture']['index']
    im = js['images'][js['textures'][t]['source']]; bv = js['bufferViews'][im['bufferView']]; o = bv.get('byteOffset', 0)
    tex = np.asarray(Image.open(io.BytesIO(bytes(bn[o:o + bv['byteLength']]))).convert('RGB')).astype(float)
    th, tw = tex.shape[:2]
    c = tex[np.clip((UV[:, 1] * th).astype(int), 0, th - 1), np.clip((UV[:, 0] * tw).astype(int), 0, tw - 1)]
    hair = ((c @ [0.299, 0.587, 0.114]) < 100) & ((c.max(1) - c.min(1)) < 40)
    aw = (W * arm[J]).sum(1)
    return int(hair.sum()), float((aw[hair] > 0.5).mean())


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 3:
        print(__doc__); return 1
    rig, cdir, dst = args
    t1, t2 = dst + '.w.glb', dst + '.c.glb'
    n0, s0 = hair_arm_strong(rig)
    near = next((a for a in sys.argv[1:] if a.startswith('--near=')), None)
    out = run([os.path.join(HERE, 'fix_hair_weights.py'), rig, t1] + ([near] if near else []))
    print('\n'.join(l for l in out.splitlines() if '3단계' in l or '되읽어' in l))
    n1, s1 = hair_arm_strong(t1)
    print('■ G3 머리 정점 중 팔 무게 >0.5  전 %.1f%%(머리 %d) → 후 %.1f%%(머리 %d) · hero2 0.4%%' % (s0 * 100, n0, s1 * 100, n1))
    if s1 > 0.005:
        os.remove(t1)
        # 10-10 Meshy 판: --near 0.08~0.20 에서 7.6%(hero2 몸짓 무게 0.3%) — 뒷머리 끝이 아래팔에 얹혀 팔 뼈 곁에 남는다.
        #   0.04~0.12 로 좁히면 3.5% 지만 어깨·든 팔 바늘이 돌아온다(그림) ⇒ 0 크레딧 도구로 못 고친다 = 박사님 «Meshy 안 되면 Tripo»
        raise SystemExit('⛔ 머리 무게가 덜 옮겨졌다(팔 무게 >0.5 %.1f%% > 0.5%%) — 몸을 바꿀 것(Tripo 판)' % (s1 * 100))
    keep = '--keep-color' in sys.argv
    if keep:
        os.replace(t1, t2)
        print('■ 색 그대로(--keep-color)')
    else:
        out = run([os.path.join(HERE, 'recolor_hero_tex.py'), t1, t2, '--hair-hue', '--hair-gain=1.4'])
        print('\n'.join(l for l in out.splitlines() if '바꾼 뒤' in l or '지금 색' in l))
        os.remove(t1)
    js, bn = read_glb(t2)
    js['animations'] = []
    for name, f in CLIPS:
        p = os.path.join(cdir, f + '.glb')
        if not os.path.exists(p):
            raise SystemExit('⛔ 클립 %s 없음' % p)
        merge(js, bn, name, p)
    before = [acc_array(js, bn, i).copy() for i in range(len(js['accessors']))]
    nb = len(bn)
    bn2 = compact(js, bn)
    for i, a in enumerate(before):
        b = acc_array(js, bn2, i)
        if a.shape != b.shape or not np.array_equal(a, b):
            raise SystemExit('⛔ 버퍼 다시 짠 뒤 accessor %d 가 다르다' % i)
        del b
    print('■ 버퍼 다시 짬 %d → %d 바이트 · accessor %d개 되읽어 ✔ 같다' % (nb, len(bn2), len(before)))
    write_glb(dst, js, bn2)
    os.remove(t2)
    fileH = file_height(js, bn2)
    tab = hand_table(dst, 'crouch', fileH, [i * 0.2 for i in range(13)])
    v_old = walk_speed('assets/v2/char/hero.glb', 'walk')
    v_new = walk_speed(dst, 'walk')
    mps = round(OLD_WALK_MPS * v_new / v_old, 3)
    w, sp = cheer_window(dst)
    bw = {}
    for nm in ('scratch', 'nod', 'listen'):
        bw[nm] = break_window(dst, nm)[0]
    durs = {a['name']: round(float(max(js['accessors'][s['input']]['max'][0] for s in a['samplers'])), 3) for a in js['animations']}
    rig_id = os.path.basename(rig).split('_')[1].split('.')[0]
    # 10-10 --hero=<이름>: 남 주인공은 웹 게임 몸 이름이 'hero2_m' 이다(v2_hero setOutfit 이 hero2 · hero2_m 만 옷을 입힌다 · core 66dfb4c0)
    hero_name = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--hero=')), 'hero_unity')
    ex = {'hero': hero_name, 'rig': rig_id,
          'from': next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--from=')),
                       'sheet_hero_turnaround_toy_b → ' + ('Tripo multiview 0cbeb136 (facez)' if 'tripo' in rig else 'Meshy multi-image 559fef1a')),
          'weights': 'fix_hair_weights %s(기본 무게로 구움)' % (near + ' ' if near else '전부 떼기 '), 'hair': 'keep' if keep else [95, 78, 80],
          'crouchHand': tab, 'walkMps': mps, 'emoteWin': {'cheer': w}, 'breakWin': bw, 'useWin': USE_WIN, 'clipSec': durs}
    js['scenes'][js.get('scene', 0)]['extras'] = ex
    write_glb(dst, js, bn2)
    with open(os.path.splitext(dst)[0] + '.json', 'w', encoding='utf-8', newline='\n') as f:
        json.dump(ex, f, ensure_ascii=False, indent=1)
    n2, s2 = hair_arm_strong(dst)
    print('■ 키(파일) %.3f · 걷기 walkMps %.3f · cheer 팔 높은 3초 %s · 쉬는 몸짓 구간 %s' % (fileH, mps, w, bw))
    print('■ 클립 %d · 길이 %s' % (len(js['animations']), durs))
    print('■ 관문 머리 팔 무게 >0.5 %.1f%% %s' % (s2 * 100, '✔' if s2 <= 0.005 else '⛔'))
    print('썼다: %s (%.2fMB) + %s' % (dst, os.path.getsize(dst) / 1e6, os.path.splitext(dst)[0] + '.json'))
    return 0 if s2 <= 0.005 else 2


if __name__ == '__main__':
    sys.exit(main())
