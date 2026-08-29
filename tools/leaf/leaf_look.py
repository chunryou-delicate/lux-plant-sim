# -*- coding: utf-8 -*-
"""tools/leaf/leaf_look.py — 무늬 잎이 «어떻게 생겼나»를 잰다 (2026-08-29 · leaf)

    PYTHONIOENCODING=utf-8 python tools/leaf/leaf_look.py

★ 왜 — [Plan] 이 등급을 매기려는데 «그 잎들이 어떻게 생겼는지 모른다». 파일 이름만 안다.
  ⇒ 여기서 **생김만** 적는다. ⛔ 등급은 안 매긴다 — 자르는 것은 [Plan]·박사님이다.

재는 것 (전부 `assets/monstera/skins/thumbs/*.png` 위에서 본 그림)
  · 흰 조직 비율   초록기가 없고 밝은 화소 / 잎 전체
  · 금(노랑) 비율  색상 40~70° · 채도 0.35 이상
  · 분홍 비율      색상 300~360° 또는 0~20° · 채도 0.15 이상
  · 무늬가 «어떻게» 드는가
        큰덩이비   가장 큰 흰 덩이 / 흰 조직 전체   ⇒ 1 에 가까우면 «반쪽·큰 패치»
        덩이수     4화소 넘는 흰 덩이 개수         ⇒ 많으면 «점»
        좌우치우침 |왼쪽흰 − 오른쪽흰| / 흰 전체    ⇒ 1 에 가까우면 «하프문»

⚠ 이 자가 못 하는 것
  · 위에서 본 한 장이다. 잎이 접히거나 서 있으면 실제보다 좁게 잡힌다
  · 「닮았다」는 아래 수치의 거리로 낸다 — **눈으로 본 것이 아니다.** 그렇게 밝힌다
"""

# ── ⚠ 내 창에서만 도는 자가 되지 않게 (2026-08-30 · char 가 잡아 줬다) ──────────
#   ★ 나는 늘 `PYTHONIOENCODING=utf-8` 을 «붙여서» 돌려 왔다. 그래서 «한 번도 안 걸렸다».
#     char 의 cp949 콘솔에서는 이 파일 열 개가 «전부» 죽었다 — 그것도 **검사를 통과한 뒤**
#     마지막 「✔」 한 글자를 찍다가. ⇒ ⛔ 「통과」가 «실패»로 보이고 종료값도 1 이 된다.
#   ⇒ ★★ 「내 창에서만 도는 자」는 자가 아니라 «내 손버릇»이다.
import sys as _sys
for _s in (_sys.stdout, _sys.stderr):
    try: _s.reconfigure(encoding='utf-8')
    except Exception: pass
import glob, json, os, re, sys
import numpy as np
from PIL import Image

TH = 'assets/monstera/skins/thumbs'
WIRED = json.load(open('data/balance/varie_grades.json', encoding='utf-8'))

def famof(n): return re.sub(r'_(v[12])$', '', n)

def rgb2hsv(a):
    mx = a.max(2); mn = a.min(2); d = mx - mn
    h = np.zeros_like(mx)
    r, g, b = a[...,0], a[...,1], a[...,2]
    m = (d > 1e-6)
    i = m & (mx == r); h[i] = ((g-b)[i]/d[i]) % 6
    i = m & (mx == g); h[i] = ((b-r)[i]/d[i]) + 2
    i = m & (mx == b); h[i] = ((r-g)[i]/d[i]) + 4
    return h*60, np.where(mx > 0, d/np.maximum(mx,1e-9), 0), mx

def bg_mask(rgb):
    """★ 배경만 걷는다 — «가장자리에서 번져» 들어간다.

    ⚠⚠ 1판은 「밝고 채도 낮은 화소 = 흰 조직」으로 셌다. **못 쓰는 자였다** —
      이 썸네일들은 알파가 없고 **배경이 흰색으로 구워져** 있어서, 흰 배경을
      «흰 무늬»로 세고 있었다. 그래서 새까만 mon_charcoal 이 「흰 67%」로 나왔고
      큰덩이가 죄다 1.00 이었다(배경이 한 덩이니까). 자가 «안 움직이고» 있었다.
    ⇒ ★ 그냥 흰 것을 지우면 «정말 흰 잎»(monstera_leaf_fullalbo)까지 지운다.
      그래서 **가장자리에 닿은 흰 것**만 배경으로 본다."""
    L = 0.2126*rgb[...,0] + 0.7152*rgb[...,1] + 0.0722*rgb[...,2]
    mx = rgb.max(2); mn = rgb.min(2)
    whiteish = (L > 0.93) & ((mx-mn) < 0.06)
    H, W = whiteish.shape
    bg = np.zeros_like(whiteish)
    st = []
    for x in range(W):
        for y in (0, H-1):
            if whiteish[y,x] and not bg[y,x]: bg[y,x]=True; st.append((y,x))
    for y in range(H):
        for x in (0, W-1):
            if whiteish[y,x] and not bg[y,x]: bg[y,x]=True; st.append((y,x))
    while st:
        y,x = st.pop()
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            yy,xx = y+dy, x+dx
            if 0<=yy<H and 0<=xx<W and whiteish[yy,xx] and not bg[yy,xx]:
                bg[yy,xx]=True; st.append((yy,xx))
    return bg

def blobs(mask):
    """4-이웃 덩이 세기 — 라이브러리 없이 훑는다"""
    H, W = mask.shape
    lab = np.zeros((H,W), np.int32); cur = 0; sizes = []
    idx = np.argwhere(mask)
    seen = np.zeros((H,W), bool)
    for y0, x0 in idx:
        if seen[y0,x0]: continue
        cur += 1; st = [(y0,x0)]; seen[y0,x0] = True; n = 0
        while st:
            y,x = st.pop(); lab[y,x] = cur; n += 1
            for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
                yy,xx = y+dy, x+dx
                if 0<=yy<H and 0<=xx<W and mask[yy,xx] and not seen[yy,xx]:
                    seen[yy,xx] = True; st.append((yy,xx))
        sizes.append(n)
    return sizes

def look(png):
    im = Image.open(png).convert('RGB').resize((192,192), Image.LANCZOS)
    a = np.asarray(im).astype(float)/255.
    rgb = a
    leaf = ~bg_mask(rgb)
    if leaf.sum() < 50: return None
    h, s, v = rgb2hsv(rgb)
    pale = leaf & (s < 0.18) & (v > 0.55)                    # 흰·크림 조직
    gold = leaf & (h >= 40) & (h <= 70) & (s >= 0.35)
    pink = leaf & (((h >= 300) | (h <= 20)) & (s >= 0.15))
    n = leaf.sum()
    out = {'pale': pale.sum()/n, 'gold': gold.sum()/n, 'pink': pink.sum()/n}
    small = np.array(Image.fromarray((pale*255).astype('uint8')).resize((64,64), Image.NEAREST)) > 127
    sz = sorted(blobs(small), reverse=True)
    tot = sum(sz) or 1
    out['big'] = (sz[0]/tot) if sz else 0.0
    out['nblob'] = sum(1 for x in sz if x > 4)
    xs = np.argwhere(pale)[:,1] if pale.sum() else np.array([96])
    cx = np.argwhere(leaf)[:,1].mean()
    L = (xs < cx).sum(); R = (xs >= cx).sum()
    out['lean'] = abs(L-R)/max(L+R,1)
    # 바탕 초록의 밝기 — 「짙다/연하다」
    base = leaf & ~pale & ~gold & ~pink
    out['baseV'] = float(v[base].mean()) if base.sum() else 0.0
    return out

fams = {}
for p in sorted(glob.glob(TH + '/*.png')):
    n = os.path.basename(p)[:-4]
    f = famof(n)
    if f in fams: continue                # 갈래당 한 장(색 판 없는 것 우선)
    r = look(p)
    if r: fams[f] = r
for p in sorted(glob.glob(TH + '/*.png')):
    n = os.path.basename(p)[:-4]; f = famof(n)
    if f not in fams:
        r = look(p)
        if r: fams[f] = r

wired = set(re.findall(r'(?:mon_|heart_|pothos_|monstera_leaf_)[a-z0-9_]+',
                       json.dumps(WIRED, ensure_ascii=False)))
wired = {w for w in wired if w in fams}
keys = ['pale','gold','pink','big','lean','baseV']

def near(f):
    v = np.array([fams[f][k] for k in keys])
    best = sorted(((float(np.linalg.norm(v-np.array([fams[w][k] for k in keys]))), w)
                   for w in wired if w != f))
    return best[:2]

print('%-32s %5s %5s %5s %6s %6s %5s  %s' % ('갈래','흰%','금%','분홍%','큰덩이','치우침','바탕','붙은 16 중 가까운 것'))
for f in sorted(fams):
    r = fams[f]
    tag = '  ' if f in wired else '★ '
    nb = near(f)
    s = ' · '.join('%s(%.2f)' % (w, d) for d, w in nb) if nb else ''
    print('%s%-30s %5.1f %5.1f %5.1f %6.2f %6.2f %5.2f  %s'
          % (tag, f, 100*r['pale'], 100*r['gold'], 100*r['pink'], r['big'], r['lean'], r['baseV'], s))
print('\n★ = 게임이 아직 안 부르는 갈래 · 「가까운 것」은 위 여섯 수치의 거리다(눈으로 본 것이 아니다)')
