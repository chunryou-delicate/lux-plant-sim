# -*- coding: utf-8 -*-
"""tools/leaf/unity_kit.py — 유니티 식물 키트를 저장소 «밖»에 만든다 ([leaf] 10-09 · 크레딧 0 · docs/handoff/leaf-unity-kit-20261009.md)
   키트는 저장소에서 다시 만들 수 있는 파생물이라 저장소에 안 넣는다(총괄 10-09 · pack 5.95 GiB). 기본 OUT = <저장소 위>/unity_kit/plants

   단계(차례대로 · 앞 단계가 낸 것을 뒤가 읽는다)
     tex   U2 — 잎 GLB 마다 «2048 밑색»을 찾아 그 GLB(같은 메시·같은 UV)에 넣어 OUT/<종>/mesh/<이름>.glb
            2048 을 «어디서» 찾나는 추측하지 않고 잰다: 후보마다 1024 로 줄여 지금 텍스처와 PSNR — 35dB 넘는 첫 후보를 쓴다.
              후보 ① 지금 GLB 가 이미 2048  ② skins/_orig/<같은 이름>(08-16 줄이기 전 원본 · 676f1781)
                   ③ Meshy 10-09 아홉 가족: _incoming1009/<가족>_new.glb 에 stage_meshy1009.PARAMS 색 손질(2048 그대로)
                   ④ 쨍(_v1)·차분(_v2): 2048 기본판에 recolor_calm 의 vivid · redo(PICK·1·2·3) · dim 을 다 걸어 본다
                   ⑤ 핑크프린세스·알로카시아: 같은 종 _incoming1009 의 원본들 · 그 원본에 depink · allpink
            못 찾은 것은 장부에 «1024 만»으로 적고 지금 GLB 를 그대로 둔다(키우지 않는다 — 가짜 2048 금지)
     mask  U3 — OUT 의 2048 GLB 마다 varie_mask(덮어쓰기 표 그대로) → OUT/<종>/mask/<이름>_mask.png · _base.png · _colors.json
   장부: OUT/kit_log.json(이름 → 고른 후보 · PSNR · 크기)
   ⚠ 마스크는 그 GLB 의 UV 에 붙는다 — 다른 메시를 쓰면 다시 뽑아야 한다(README).
   쓰기: python tools/leaf/unity_kit.py tex|mask [--out=<경로>] [--only=<이름 일부,…>]"""
import sys, os, io, json, glob, shutil, subprocess
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from lift_base import read_glb, write_glb
import recolor_calm as rc
import stage_meshy1009 as sm

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FLAGS = [a for a in sys.argv[1:] if a.startswith('--')]; ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
OUT = next((f[6:] for f in FLAGS if f.startswith('--out=')), os.path.abspath(os.path.join(ROOT, '..', 'unity_kit', 'plants')))
ONLY = next((f[7:] for f in FLAGS if f.startswith('--only=')), None)
WORK = os.path.join(OUT, '_work')
SAME_DB = 35.0

def species_of(path):
    p = path.replace(os.sep, '/')
    for sp in ('pink_princess', 'alocasia'):
        if f'/plants/{sp}/' in p: return sp
    return 'monstera'

def leaf_glbs():
    fs = glob.glob(os.path.join(ROOT, 'assets/monstera/*.glb')) + glob.glob(os.path.join(ROOT, 'assets/monstera/skins/*.glb')) \
       + glob.glob(os.path.join(ROOT, 'assets/plants/*/*.glb')) + glob.glob(os.path.join(ROOT, 'assets/plants/*/skins/*.glb'))
    return sorted(f for f in fs if not os.path.basename(f).startswith('_'))

def tex_index(js):
    mt = (js.get('materials') or [{}])[0]; bc = (mt.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
    return js['textures'][bc['index']]['source'] if bc else 0

def tex_of_glb(path):
    js, b = read_glb(path)
    if not js.get('images'): return None
    im = js['images'][tex_index(js)]; v = js['bufferViews'][im['bufferView']]
    return Image.open(io.BytesIO(b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']])).convert('RGB')

def put_tex(src_glb, img, dst_glb, q=95):
    js, b = read_glb(src_glb)
    views = [b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']] for v in js['bufferViews']]
    im = js['images'][tex_index(js)]; bio = io.BytesIO(); img.save(bio, 'JPEG', quality=q, subsampling=0)
    views[im['bufferView']] = bio.getvalue(); im['mimeType'] = 'image/jpeg'
    if os.path.exists(dst_glb): os.remove(dst_glb)
    write_glb(dst_glb, js, views)

def psnr(a, b):
    a = np.asarray(a, np.float64); b = np.asarray(b, np.float64); m = ((a - b) ** 2).mean()
    return 99.0 if m == 0 else float(10 * np.log10(255 ** 2 / m))

def tmp(name):
    os.makedirs(WORK, exist_ok=True); p = os.path.join(WORK, name)
    if os.path.exists(p): os.remove(p)
    return p

_best2048 = {}
def candidates(cur):
    """(이름, 만드는 함수) 를 싼 것부터 낸다. 함수는 2048 PIL 이나 None."""
    n = os.path.basename(cur); stem = n[:-4]; sp = species_of(cur)
    out = []
    out.append(('지금', lambda: tex_of_glb(cur)))
    o = os.path.join(ROOT, 'assets/monstera/skins/_orig', n)
    if os.path.exists(o): out.append(('_orig', lambda: tex_of_glb(o)))
    if stem in sm.PARAMS:
        def meshy(stem=stem):
            g, s, h = sm.PARAMS[stem]; dst = tmp(stem + '_lift2048.glb')
            r = subprocess.run([sys.executable, os.path.join(HERE, 'lift_base.py'), os.path.join(ROOT, 'assets/monstera/skins/_incoming1009', stem + '_new.glb'), dst, str(g), str(s), str(h)],
                               capture_output=True, text=True, encoding='utf-8', errors='replace', env=dict(os.environ, PYTHONIOENCODING='utf-8'))
            return tex_of_glb(dst) if r.returncode == 0 and os.path.exists(dst) else None
        out.append(('meshy1009+lift', meshy))
    if stem.endswith(('_v1', '_v2')):
        base = os.path.join(os.path.dirname(cur), stem[:-3] + '.glb')
        if os.path.exists(base):
            def via(kind, base=base, stem=stem):
                b2 = best2048(base)
                if b2 is None: return None
                bg = tmp(stem[:-3] + '_b2048.glb'); put_tex(base, b2, bg, q=98); dst = tmp(stem + '_' + kind + '.glb')
                if kind == 'vivid': rc.redo_vivid(bg, dst)
                elif kind == 'dim': rc.redo_dim(bg, dst)
                else: rc.redo(bg, dst, int(kind[-1]))
                return tex_of_glb(dst)
            kinds = ['vivid'] if stem.endswith('_v1') else ['pick%d' % rc.PICK.get(stem[:-3], 3), 'dim', 'pick1', 'pick2', 'pick3']
            for k in dict.fromkeys(kinds): out.append((k, (lambda k=k: via(k))))
    if sp != 'monstera':
        inc = sorted(glob.glob(os.path.join(ROOT, f'assets/plants/{sp}/_incoming1009/*.glb')))
        for f in inc: out.append(('incoming:' + os.path.basename(f), (lambda f=f: tex_of_glb(f))))
        for f in inc:
            for tool in ('depink', 'allpink'):
                def der(f=f, tool=tool):
                    dst = tmp(os.path.basename(f)[:-4] + '_' + tool + '.glb')
                    r = subprocess.run([sys.executable, os.path.join(HERE, tool + '.py'), f, dst], capture_output=True, text=True, encoding='utf-8', errors='replace', env=dict(os.environ, PYTHONIOENCODING='utf-8'))
                    return tex_of_glb(dst) if r.returncode == 0 and os.path.exists(dst) else None
                out.append((f'{tool}:' + os.path.basename(f), der))
    return out

def best2048(cur, log=None):
    if cur in _best2048: return _best2048[cur][0]
    ref = tex_of_glb(cur); best = (None, None, -1.0)
    if ref is None: _best2048[cur] = (None, 'no-tex', 0); return None
    small = ref if ref.size[0] <= 1024 else ref.resize((1024, 1024), Image.LANCZOS)
    for name, fn in candidates(cur):
        try: img = fn()
        except Exception as e: img = None; name = name + ' ERR ' + str(e)[:40]
        if img is None or img.size[0] < 2048: continue
        p = psnr(img.resize(small.size, Image.LANCZOS), small)
        if p > best[2]: best = (img, name, p)
        if p >= SAME_DB: break
    # 파생(depink·allpink)은 화소마다 퍼센타일·최댓값을 쓰는 손질이라 해상도에 따라 조금 갈린다 — 30dB 넘으면 «파생»으로 받는다(장부에 그렇게 적힌다)
    #   incoming(법선 맞춤·줄이기만 한 원본 · 색 손질 없음)은 34dB 면 같은 그림이다(10-09 PP 분홍 많음 34.5)
    ok = best[0] is not None and (best[2] >= SAME_DB or (best[2] >= 34 and str(best[1]).startswith('incoming:'))
                                  or (best[2] >= 30 and str(best[1]).startswith(('allpink:', 'depink:'))))
    _best2048[cur] = (best[0] if ok else None, best[1], round(best[2], 1))
    return _best2048[cur][0]

def step_tex():
    log = {}
    for cur in leaf_glbs():
        n = os.path.basename(cur)
        if ONLY and not any(o in n for o in ONLY.split(',')): continue
        sp = species_of(cur); dst_dir = os.path.join(OUT, sp, 'mesh'); os.makedirs(dst_dir, exist_ok=True); dst = os.path.join(dst_dir, n)
        img = best2048(cur); _, how, p = _best2048[cur]
        if img is not None:
            put_tex(cur, img, dst); log[n] = {'src': how, 'psnr': p, 'tex': 2048}
        else:
            shutil.copyfile(cur, dst); t = tex_of_glb(cur); log[n] = {'src': '1024 만(2048 못 찾음 · 가장 가까운 후보 %s %s dB)' % (how, p), 'tex': t.size[0] if t else None}
        print(f"{n:42s} {log[n]['src']} {log[n].get('psnr', '')}", flush=True)
    lp = os.path.join(OUT, 'kit_log.json'); old = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
    old.setdefault('tex', {}).update(log); json.dump(old, open(lp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    shutil.rmtree(WORK, ignore_errors=True)
    n2 = sum(1 for v in log.values() if v.get('tex') == 2048); print(f'★ {n2}/{len(log)} 이 2048 · 장부 {lp}')

def step_mask():
    import varie_mask as vm
    rows = []
    for sp in sorted(os.listdir(OUT)):
        md = os.path.join(OUT, sp, 'mesh')
        if not os.path.isdir(md): continue
        for g in sorted(glob.glob(os.path.join(md, '*.glb'))):
            n = os.path.basename(g)[:-4]
            if ONLY and not any(o in n for o in ONLY.split(',')): continue
            if n.endswith(('_v1', '_v2')): continue                    # 쨍·차분은 색 값이라 기본판 마스크를 같이 쓴다
            if not any(k in n for k in ('mon_', 'heart_', 'pothos_', '_pink', '_marble', '_half', '_creamcenter', 'allpink')): continue   # 무늬판만
            # 기준 초록은 저장소 쪽 같은 이름 경로로 고른다(종·단계)
            src_like = next((p for p in leaf_glbs() if os.path.basename(p)[:-4] == n), g)
            REF, refp = vm.ref_for(src_like)
            rep, *_ = vm.run(g, os.path.join(OUT, sp, 'mask'), REF); rep['ref'] = os.path.basename(refp); rows.append(rep)
            print(f"{n:34s} 무늬 {rep['mask_pct']:5.1f}% 둘째 {rep['second_pct']:5.1f}% 남음 {rep['base_left_pct']:5.2f}% {'전체' if rep['colors']['full'] else ''} {'OV' if rep.get('override') else ''}", flush=True)
    lp = os.path.join(OUT, 'kit_log.json'); old = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
    old.setdefault('mask', {}).update({r['name']: r for r in rows}); json.dump(old, open(lp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'★ 마스크 {len(rows)} · 장부 {lp}')

SERVE_ROOT = os.path.abspath(os.path.join(ROOT, '..'))       # 9341 서버의 뿌리 — 저장소(도구)와 키트(밖)를 같이 내준다
TOP_URL = os.environ.get('KIT_URL', 'http://127.0.0.1:9341')   # python tools/serve.py 9341 "<저장소 위>" 로 띄운다

def _thumb_all(rel_dir, bg):
    """rel_dir(SERVE_ROOT 기준)의 GLB 를 한 판(크롬 하나)에 위에서 2048 로 찍는다 → rel_dir/thumbs/*.png"""
    cmd = ['node', os.path.join(ROOT, 'tools', 'glb_thumb.mjs'), f'--all={rel_dir}', '--view=top', '--size=2048', '--force'] + ([f'--bg={bg}'] if bg else [])
    r = subprocess.run(cmd, cwd=SERVE_ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace',
                       env=dict(os.environ, BYEOT_URL=TOP_URL + '/' + os.path.basename(ROOT)))
    print((r.stdout or '').strip().splitlines()[-1:] or r.stderr[-300:], flush=True)
    return os.path.join(SERVE_ROOT, rel_dir, 'thumbs')

def _matte(white_png, black_png):
    """흰·검 두 판의 차로 알파 — 흰 무늬도 구멍 없이 남는다(색 빼기를 안 쓴다)"""
    w = np.asarray(Image.open(white_png).convert('RGB')).astype(np.float64) / 255
    k = np.asarray(Image.open(black_png).convert('RGB')).astype(np.float64) / 255
    a = np.clip(1 - (w - k).mean(2), 0, 1)
    col = np.where(a[..., None] > 1e-3, k / np.maximum(a[..., None], 1e-3), 0)
    return Image.fromarray((np.dstack([np.clip(col, 0, 1), a]) * 255).astype(np.uint8), 'RGBA'), a

def step_top():
    """U4 — 위에서 본 투명 2048(먼 거리 판 · UI) + 무늬판은 같은 각의 «판 마스크»(R·G · 알파는 잎 알파)"""
    if os.path.commonpath([OUT, SERVE_ROOT]) != SERVE_ROOT: print('⛔ OUT 이 서버 뿌리 밖이다', OUT); return
    log = {}
    for sp in sorted(os.listdir(OUT)):
        md = os.path.join(OUT, sp, 'mesh')
        if not os.path.isdir(md): continue
        rel = os.path.relpath(md, SERVE_ROOT).replace(os.sep, '/'); td = os.path.join(OUT, sp, 'top'); os.makedirs(td, exist_ok=True)
        thumbs = os.path.join(md, 'thumbs'); keep = os.path.join(OUT, '_work', sp + '_white'); shutil.rmtree(keep, ignore_errors=True)
        _thumb_all(rel, None); shutil.move(thumbs, keep)
        _thumb_all(rel, '000000')
        for f in sorted(glob.glob(os.path.join(keep, '*.png'))):
            n = os.path.basename(f)[:-4]
            if ONLY and not any(o in n for o in ONLY.split(',')): continue
            bk = os.path.join(thumbs, n + '.png')
            if not os.path.exists(bk): continue
            img, a = _matte(f, bk); img.save(os.path.join(td, n + '_top.png'), optimize=True)
            log[n] = {'alpha0': round(float((a < 0.01).mean()), 3), 'edge': round(float(((a > 0.01) & (a < 0.99)).mean()), 4)}
        shutil.rmtree(thumbs, ignore_errors=True)
        # 판 마스크 — 마스크 텍스처를 입힌 GLB 를 같은 각으로(흰 바탕 한 번 · 알파는 위 잎 알파)
        mk = os.path.join(OUT, sp, 'mask'); mg = os.path.join(OUT, '_work', sp + '_maskglb'); shutil.rmtree(mg, ignore_errors=True); os.makedirs(mg)
        for m in sorted(glob.glob(os.path.join(mk, '*_mask.png'))):
            n = os.path.basename(m)[:-9]; g = os.path.join(md, n + '.glb')
            if os.path.exists(g) and (not ONLY or any(o in n for o in ONLY.split(','))): put_tex(g, Image.open(m).convert('RGB'), os.path.join(mg, n + '.glb'), q=100)
        if os.listdir(mg):
            mt = _thumb_all(os.path.relpath(mg, SERVE_ROOT).replace(os.sep, '/'), '000000')
            for f in sorted(glob.glob(os.path.join(mt, '*.png'))):
                n = os.path.basename(f)[:-4]; top = os.path.join(td, n + '_top.png')
                if not os.path.exists(top): continue
                rgb = np.asarray(Image.open(f).convert('RGB')); al = np.asarray(Image.open(top))[..., 3]
                Image.fromarray(np.dstack([rgb[..., 0], rgb[..., 1], np.zeros_like(al), al]), 'RGBA').save(os.path.join(td, n + '_topmask.png'), optimize=True)
        print(f'★ {sp}: 위에서 {len(glob.glob(os.path.join(td, "*_top.png")))} · 판 마스크 {len(glob.glob(os.path.join(td, "*_topmask.png")))}', flush=True)
    lp = os.path.join(OUT, 'kit_log.json'); old = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
    old.setdefault('top', {}).update(log); json.dump(old, open(lp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    shutil.rmtree(WORK, ignore_errors=True)

def step_json():
    """U8 — plant_kit.json: 종 → 단계(메시 · 실측) · 무늬판(등급 · 한글명 · 쨍/차분 · 마스크 · 밑판 · 색 · 위에서). 유니티 ScriptableObject 로 읽는다.
       값은 다 저장소 정본에서 읽는다(manifest · varie_grades · species 표 · kit_log) — 여기서 새로 정하는 값 없음. 추정한 칸은 'guess' 로 적는다."""
    M = json.load(open(os.path.join(ROOT, 'assets/manifest.json'), encoding='utf-8'))
    V = json.load(open(os.path.join(ROOT, 'data/balance/varie_grades.json'), encoding='utf-8'))
    K = json.load(open(os.path.join(OUT, 'kit_log.json'), encoding='utf-8'))
    man = {os.path.basename(it.get('path', '')): it for it in M['items'] if str(it.get('path', '')).endswith('.glb')}
    fam = {}
    for g in V['grades']:
        for a in g.get('assets') or []: fam['mon_' + a['id']] = {'grade': g['id'], 'grade_ko': g['ko'], 'name_ko': a['ko'], 'stage': 'mature'}
    for a in V['midCommon']['pool']: fam[a['id']] = {'grade': None, 'grade_ko': '중간잎 통일 풀(등급과 무관 · midCommon)', 'name_ko': a.get('ko') or a['id'], 'stage': 'mid'}
    SPG = {'pinkmarble': ('marble', '산반'), 'pinkheavy': ('heavy', '하프문'), 'allpink': ('pink', '분홍 잎'), 'marble': ('marble', '산반'), 'half': ('sector', '하프문'), 'creamcenter': ('sector', '하프문')}
    def rel(p): return os.path.relpath(p, OUT).replace(os.sep, '/') if p and os.path.exists(p) else None
    out = {'version': 1, 'units': 'm', 'generated_by': 'tools/leaf/unity_kit.py json',
           'conventions': {'mesh': '웹 규약 GLB(높이 1 로 맞춰 쓰고 조정표로 키움 · 밑색 2048)', 'unity_mesh': '유니티 규약으로 구운 GLB — 자루 끝(맨 아래 8% 띠 XZ 무게중심) = 원점 · +Y 위 · 가장 긴 축 = real_max_m(미터) · 노드 변환은 정점에 녹임 · 잎의 돌림(조정표 ADJ)은 안 구움',
                           'mask': 'R = 무늬 몫 · G = 무늬 안 둘째 색 몫 · 그 GLB 의 UV 에 붙는다(다른 메시면 다시 뽑아야)',
                           'variants': 'vivid(_v1) · calm(_v2) 는 같은 메시 · 다른 밑색 — 마스크는 기본판 것을 같이 쓴다',
                           'top': '위에서 본 2048 투명 PNG(흰·검 두 판 차로 알파) · topmask = 같은 각의 마스크(알파 = 잎 알파)'},
           'species': {}}
    for sp in sorted(d for d in os.listdir(OUT) if os.path.isdir(os.path.join(OUT, d, 'mesh'))):
        S = out['species'].setdefault(sp, {'stages': {}, 'skins': []})
        for g in sorted(glob.glob(os.path.join(OUT, sp, 'mesh', '*.glb'))):
            n = os.path.basename(g)[:-4]; mi = man.get(n + '.glb', {})
            if n.endswith(('_v1', '_v2')): continue
            row = {'mesh': rel(g), 'real_max_m': mi.get('real_max_m'), 'category': mi.get('category'), 'name_ko': mi.get('name_ko'),
                   'tex2048': (K.get('tex', {}).get(n + '.glb') or {}).get('tex') == 2048,
                   'top': rel(os.path.join(OUT, sp, 'top', n + '_top.png')),
                   'unity_mesh': rel(os.path.join(OUT, sp, 'unity', n + '.glb'))}   # U1 — 자루 끝 원점 · +Y · 가장 긴 축 = real_max_m(미터)
            vv = {k: rel(os.path.join(OUT, sp, 'mesh', n + s + '.glb')) for k, s in (('vivid', '_v1'), ('calm', '_v2'))}
            if any(vv.values()): row['variants'] = vv
            mk = os.path.join(OUT, sp, 'mask', n + '_mask.png')
            if os.path.exists(mk):
                info = fam.get(n, {}); kl = K.get('mask', {}).get(n, {})
                if sp != 'monstera':
                    t = next((v for k, v in SPG.items() if n.endswith('_' + k)), None)
                    info = {'grade': t and t[0], 'grade_ko': t and t[1], 'name_ko': mi.get('name_ko'), 'stage': n.split('_')[2] if n.count('_') >= 2 else None,
                            **({'guess': '크림 중심(creamcenter)을 하프문(sector)으로 읽음 — species.js 등급표에 이 판 이름이 없다'} if n.endswith('_creamcenter') else {})}
                row.update({'key': n, **info, 'mask': rel(mk), 'base': rel(os.path.join(OUT, sp, 'mask', n + '_base.png')), 'colors': kl.get('colors'),
                            'mask_pct': kl.get('mask_pct'), 'topmask': rel(os.path.join(OUT, sp, 'top', n + '_topmask.png'))})
                S['skins'].append(row)
            else:
                S['stages'][n] = row
    p = os.path.join(OUT, 'plant_kit.json'); json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('★', p, {sp: (len(v['stages']), len(v['skins'])) for sp, v in out['species'].items()})

def _node_mats(js):
    """노드마다 월드 행렬(4×4) — matrix 또는 TRS · 장면 뿌리부터"""
    def local(n):
        if 'matrix' in n: return np.array(n['matrix'], np.float64).reshape(4, 4).T
        T = np.eye(4); T[:3, 3] = n.get('translation', [0, 0, 0])
        x, y, z, w = n.get('rotation', [0, 0, 0, 1])
        R = np.eye(4); R[:3, :3] = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                                    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                                    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
        S = np.diag(list(n.get('scale', [1, 1, 1])) + [1]); return T @ R @ S
    nodes = js.get('nodes', []); out = {}
    def walk(i, M):
        W = M @ local(nodes[i]); out[i] = W
        for c in nodes[i].get('children', []): walk(c, W)
    for s in js.get('scenes', [{}]):
        for r in s.get('nodes', []): walk(r, np.eye(4))
    return out

def step_bake():
    """U1 — 유니티 규약으로 굽는다: 자루 끝(맨 아래 8% 띠의 XZ 무게중심 · plant_grow normalizeAsset 의 anchorBottom 과 같은 셈) = 원점 · +Y 위 · 미터(manifest real_max_m = 가장 긴 축)
       노드 변환은 정점에 녹이고 노드는 단위 행렬로. 잎은 게임이 돌리지 않는다(LONGY 는 줄기·잎자루뿐) — 돌림은 ADJ(plant_grow 조정표)의 몫이라 굽지 않는다.
       → OUT/<종>/unity/<이름>.glb (mesh/ 는 웹 규약 그대로 둔다)"""
    import struct
    M = json.load(open(os.path.join(ROOT, 'assets/manifest.json'), encoding='utf-8'))
    real = {os.path.basename(it.get('path', '')): it.get('real_max_m') for it in M['items'] if str(it.get('path', '')).endswith('.glb')}
    log = {}
    for sp in sorted(d for d in os.listdir(OUT) if os.path.isdir(os.path.join(OUT, d, 'mesh'))):
        ud = os.path.join(OUT, sp, 'unity'); os.makedirs(ud, exist_ok=True)
        for g in sorted(glob.glob(os.path.join(OUT, sp, 'mesh', '*.glb'))):
            n = os.path.basename(g)
            if ONLY and not any(o in n for o in ONLY.split(',')): continue
            js, b = read_glb(g); b = bytearray(b); W = _node_mats(js)
            users = {}
            for i, nd in enumerate(js.get('nodes', [])):
                if 'mesh' in nd: users.setdefault(nd['mesh'], []).append(i)
            if any(len(set(map(lambda i: W[i].tobytes(), v))) > 1 for v in users.values()):
                log[n] = {'skip': '한 메시를 변환이 다른 노드 여럿이 쓴다'}; continue
            prims = []
            for mi, nis in users.items():
                Wm = W[nis[0]]
                for pr in js['meshes'][mi]['primitives']:
                    pa = pr['attributes']['POSITION']; P = np.array(_acc_read(js, b, pa)); P = (np.c_[P, np.ones(len(P))] @ Wm.T)[:, :3]
                    Nm = None
                    if 'NORMAL' in pr['attributes']:
                        Nm = np.array(_acc_read(js, b, pr['attributes']['NORMAL'])) @ np.linalg.inv(Wm[:3, :3]).T
                        Nm /= np.linalg.norm(Nm, axis=1, keepdims=True) + 1e-12
                    prims.append((pa, P, pr['attributes'].get('NORMAL'), Nm))
            allP = np.vstack([p for _, p, _, _ in prims]); y0 = allP[:, 1].min(); h = allP[:, 1].max() - y0
            band = allP[allP[:, 1] <= y0 + 0.08 * h]; ax, az = band[:, 0].mean(), band[:, 2].mean()
            rm = real.get(n) or real.get(n.replace('_v1.glb', '.glb').replace('_v2.glb', '.glb'))
            # real_max_m = «실제 세계 최대축 길이»(manifest _scale_convention) — 높이가 아니라 가장 긴 축을 맞춘다(10-10 첫 판은 높이로 맞춰 옆으로 넓은 중간잎이 1.27배 컸다)
            mx = float((allP.max(0) - allP.min(0)).max())
            s = (rm / mx) if rm else (1.0 / h)
            for pa, P, na, Nm in prims:
                Q = (P - [ax, y0, az]) * s; _acc_write(js, b, pa, Q)
                js['accessors'][pa]['min'] = Q.min(0).tolist(); js['accessors'][pa]['max'] = Q.max(0).tolist()
                if na is not None: _acc_write(js, b, na, Nm)
            for nd in js.get('nodes', []):
                for k in ('matrix', 'translation', 'rotation', 'scale'): nd.pop(k, None)
            views = [bytes(b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]) for v in js['bufferViews']]
            dst = os.path.join(ud, n)
            if os.path.exists(dst): os.remove(dst)
            write_glb(dst, js, views)
            log[n] = {'real_max_m': rm, 'scale': round(s, 5), 'anchor': [round(ax, 4), round(y0, 4), round(az, 4)], 'unit_only': rm is None}
        print(f'★ {sp}: 구움 {len(glob.glob(os.path.join(ud, "*.glb")))}', flush=True)
    lp = os.path.join(OUT, 'kit_log.json'); old = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
    old.setdefault('bake', {}).update(log); json.dump(old, open(lp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('실측 없음(높이 1 로만) :', [k for k, v in log.items() if v.get('unit_only')], '· 건너뜀 :', [k for k, v in log.items() if v.get('skip')])

_FMT = {5126: ('f', 4), 5123: ('H', 2), 5125: ('I', 4), 5121: ('B', 1)}
_NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def _acc_loc(js, i):
    a = js['accessors'][i]; v = js['bufferViews'][a['bufferView']]; f, sz = _FMT[a['componentType']]; n = _NC[a['type']]
    return a, v.get('byteOffset', 0) + a.get('byteOffset', 0), v.get('byteStride', sz * n), f, n
def _acc_read(js, b, i):
    import struct
    a, base, st, f, n = _acc_loc(js, i)
    return [struct.unpack_from('<' + f * n, b, base + k * st) for k in range(a['count'])]
def _acc_write(js, b, i, arr):
    import struct
    a, base, st, f, n = _acc_loc(js, i)
    for k, row in enumerate(arr): struct.pack_into('<' + f * n, b, base + k * st, *map(float, row))

if __name__ == '__main__':
    step = ARGS[0] if ARGS else 'tex'
    print('OUT =', OUT)
    {'tex': step_tex, 'mask': step_mask, 'top': step_top, 'json': step_json, 'bake': step_bake}[step]()
