# -*- coding: utf-8 -*-
"""tools/leaf/matgrid_read.py — 성숙 무늬 19가족이 «방 거리(잎 한 장 ≈15px)»에서 등급별로 갈려 보이나
   _shot_matgrid.mjs 가 찍은 판들을 읽어 · 식물 자리만 오려 · 15px·30px 로 줄여 · 등급끼리/등급 사이 색 거리를 잰다.
   ⇒ 「등급 사이 거리 > 등급 안 거리」면 «색으로» 갈린다. 아니면 그 크기에서는 등급이 안 읽힌다.
   ⚠ 15px 는 08월 잰 값(성숙잎 먼 거리 14×15px · 위쪽 한계)이다."""
import sys, os, json, glob
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def F(n,b=False):
    try: return ImageFont.truetype('C:/Windows/Fonts/malgun%s.ttf'%('bd' if b else ''),n)
    except: return ImageFont.load_default()

def grade_of(mode='mat'):
    d = json.load(open('data/balance/varie_grades.json', encoding='utf-8'))
    m = {}
    for g in d['grades']:
        if mode == 'mid':
            for a in g.get('midAssets') or []:
                for n in (a.get('midNums') or []): m[n] = (g['id'], a.get('ko'))
        else:
            for a in g.get('assets') or []:
                if a.get('matNum'): m[a['matNum']] = (g['id'], a.get('ko'))
    return m

def lab(rgb):
    a = np.asarray(rgb, float) / 255
    a = np.where(a <= 0.04045, a/12.92, ((a+0.055)/1.055)**2.4)
    M = np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]])
    xyz = a @ M.T / np.array([0.9505,1.0,1.089])
    f = np.where(xyz > 216/24389, np.cbrt(xyz), (24389/27*xyz+16)/116)
    return np.stack([116*f[...,1]-16, 500*(f[...,0]-f[...,1]), 200*(f[...,1]-f[...,2])], -1)

def read(indir, out_png):
    mode = 'mid' if glob.glob(os.path.join(indir, 'mid_*.png')) else 'mat'
    G = grade_of(mode); rows = []
    files = sorted(glob.glob(os.path.join(indir, mode + '_*.png')))
    bg = None
    for f in files:
        n = int(os.path.basename(f)[4:6])
        a = np.asarray(Image.open(f).convert('RGB')).astype(float)
        # ★ 식물만 — 밝은 화소(잎·줄기·화분)의 «가장 큰 덩어리». 격자선·등 점은 작거나 어둡다
        from scipy import ndimage
        L = 0.2126*a[...,0]+0.7152*a[...,1]+0.0722*a[...,2]
        m = L > 70
        lab_, k = ndimage.label(ndimage.binary_dilation(m, iterations=4))
        if k:
            sizes = ndimage.sum(m, lab_, range(1, k+1)); big = 1 + int(np.argmax(sizes))
            m = m & (lab_ == big)
        ys, xs = np.where(m)
        box = (xs.min(), ys.min(), xs.max()+1, ys.max()+1)
        crop = Image.fromarray(a.astype('uint8')).crop(box)
        mm = m[box[1]:box[3], box[0]:box[2]]; c = np.asarray(crop).astype(float)
        h = c.shape[0]; top = c[: int(h*0.65)]; tm = mm[: int(h*0.65)]
        # 잎 화소만: 화분(아래)·줄기(가늘다)를 대충 빼려고 위 65% 의 밝은 화소
        mean = top[tm].mean(0) if tm.any() else np.array([0,0,0])
        rows.append((n, G.get(n, ('?', '?')), crop, mean))
    # 등급별 색 거리
    labs = {r[0]: lab(r[3]) for r in rows}
    by = {}
    for n, (g, ko), *_ in rows: by.setdefault(g, []).append(n)
    def d(a,b): return float(np.linalg.norm(labs[a]-labs[b]))
    print('★ 등급별 가족 수:', {g: len(v) for g, v in by.items()})
    for g, v in by.items():
        if len(v) > 1:
            ds = [d(a,b) for i,a in enumerate(v) for b in v[i+1:]]
            print('  %-9s 안쪽 색거리 중앙 %.1f (가족끼리 얼마나 다른가)' % (g, np.median(ds)))
    gs = list(by)
    for i in range(len(gs)):
        for j in range(i+1, len(gs)):
            ds = [d(a,b) for a in by[gs[i]] for b in by[gs[j]]]
            print('  %-9s ↔ %-9s 사이 색거리 중앙 %.1f · 제일 가까운 %.1f' % (gs[i], gs[j], np.median(ds), min(ds)))
    # 그림: 등급별 줄 · 크게 / 30px / 15px
    order = sorted(rows, key=lambda r: (r[1][0], r[0]))
    W = 150; out = Image.new('RGB', (40 + len(order)*(W+6), 340), (250,250,248)); dr = ImageDraw.Draw(out)
    for i, (n, (g, ko), crop, _) in enumerate(order):
        x = 20 + i*(W+6)
        big = crop.copy(); big.thumbnail((W, W)); out.paste(big, (x, 40))
        # 그루 너비 120px·60px 로 줄인다 — 60px 이면 성숙잎 한 장 ≈15px(08월 잰 방 거리 값)
        for k, pw in enumerate((120, 60)):
            f = pw / crop.width
            sm = crop.resize((pw, max(1,int(crop.height*f))), Image.LANCZOS)
            if pw == 60: sm = sm.resize((sm.width*2, sm.height*2), Image.NEAREST)   # 60px 는 2배로 늘려 보임
            out.paste(sm.crop((0,0,min(sm.width,W//2-4),min(sm.height,120))), (x + k*(W//2), 200))
        dr.text((x, 8), '%s · %d' % (g, n), fill=(20,20,26), font=F(12, True))
        dr.text((x, 24), ko[:9], fill=(90,90,96), font=F(11))
    dr.text((20, 322), '아래 왼쪽 = 그루 120px · 오른쪽 = 그루 60px(잎 ≈15px · 방 거리)을 2배로 늘려 보임', fill=(110,110,118), font=F(12))
    out.save(out_png); print('★ 그림:', out_png)
    # ★ 헷갈리는 짝 — 등급이 «다른» 가족끼리 색이 제일 가까운 것
    pairs = []
    for i, a in enumerate(rows):
        for b in rows[i+1:]:
            if a[1][0] != b[1][0]: pairs.append((d(a[0], b[0]), a, b))
    pairs.sort(key=lambda t: t[0])
    print('★ 등급이 다른데 색이 가까운 짝 (ΔE 작을수록 방 거리에서 헷갈림 · 대략 ΔE<10 이면 눈으로 못 가름)')
    for dd, a, b in pairs[:8]:
        print('   ΔE %5.1f   %-9s %2d %-14s ↔ %-9s %2d %s' % (dd, a[1][0], a[0], a[1][1], b[1][0], b[0], b[1][1]))

if __name__ == '__main__':
    read(sys.argv[1], sys.argv[2])
