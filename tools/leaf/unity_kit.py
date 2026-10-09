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

if __name__ == '__main__':
    step = ARGS[0] if ARGS else 'tex'
    print('OUT =', OUT)
    {'tex': step_tex, 'mask': step_mask}[step]()
