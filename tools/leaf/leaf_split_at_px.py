# -*- coding: utf-8 -*-
"""tools/leaf/leaf_split_at_px.py — 잎이 «N px 일 때 몇 갈래로 갈리나» (2026-08-29 · leaf)

    PYTHONIOENCODING=utf-8 python tools/leaf/leaf_split_at_px.py 12 19 31 42 80 160

★ 왜 — [Plan] 이 무늬 등급 «수»를 정하려는데, 먼저 「사람이 폰 크기에서 몇 갈래를
  가를 수 있나」를 알아야 한다. 그것이 **등급 수의 천장**이다.
⛔ 등급을 매기지 않는다. 「몇 갈래가 갈리나」까지만 낸다.

## 어떻게 재나
  ① 썸네일에서 잎만 도려낸다(배경은 «가장자리에서 번져» 걷는다 — leaf_look.py 와 같은 규약)
  ② 잎을 **N × N 로 줄인다**. 그것이 「폰에서 그만큼밖에 안 보인다」는 뜻이다
  ③ 갈래끼리 **평균 색차(0~255)** 를 잰다
  ④ 색차가 문턱보다 작으면 «같아 보인다»로 묶는다 (한 줄 잇기 · single-link)
  ⑤ 문턱을 여럿 놓고 **묶음 수를 표로** 낸다

## ⚠⚠ 이 자가 «못» 하는 것 — 먼저 읽어라
  · **문턱이 사람 눈이 아니다.** 「색차 12 면 갈린다」는 내가 정한 수가 아니라 **재 볼 수 없는 수**다.
    ⇒ ★ 그래서 **한 문턱으로 답을 내지 않는다.** 표로 내고 «눈으로 본 것»을 따로 적는다
  · 배경 위에서 잰다 — 방에 놓이면 어둡고, 뒤에 벽이 있고, 가려진다. **더 안 갈린다**
  · 잎 «한 장»만 본다. 실제로는 여러 장이 겹쳐 보인다
  · 위에서 본 한 장이다. 기울면 좁아진다
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

def bg_mask(rgb):
    L = 0.2126*rgb[...,0] + 0.7152*rgb[...,1] + 0.0722*rgb[...,2]
    mx = rgb.max(2); mn = rgb.min(2)
    w = (L > 0.93) & ((mx-mn) < 0.06)
    H, W = w.shape
    bg = np.zeros_like(w); st = []
    for x in range(W):
        for y in (0, H-1):
            if w[y,x] and not bg[y,x]: bg[y,x]=True; st.append((y,x))
    for y in range(H):
        for x in (0, W-1):
            if w[y,x] and not bg[y,x]: bg[y,x]=True; st.append((y,x))
    while st:
        y,x = st.pop()
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            yy,xx = y+dy, x+dx
            if 0<=yy<H and 0<=xx<W and w[yy,xx] and not bg[yy,xx]:
                bg[yy,xx]=True; st.append((yy,xx))
    return bg

def leaf_at(png, N):
    """잎만 도려내 N×N 로 줄인다. 잎 밖은 NaN 으로 둔다(배경색이 답을 흔들지 않게)"""
    a = np.asarray(Image.open(png).convert('RGB').resize((192,192), Image.LANCZOS)).astype(float)/255.
    m = ~bg_mask(a)
    ys, xs = np.nonzero(m)
    if len(xs) < 50: return None
    box = (xs.min(), ys.min(), xs.max()+1, ys.max()+1)
    sub = a[box[1]:box[3], box[0]:box[2]]
    sm  = m[box[1]:box[3], box[0]:box[2]]
    im  = Image.fromarray((sub*255).astype('uint8')).resize((N,N), Image.LANCZOS)
    al  = Image.fromarray((sm*255).astype('uint8')).resize((N,N), Image.LANCZOS)
    v = np.asarray(im).astype(float)
    k = np.asarray(al).astype(float)/255.
    v[k < 0.5] = np.nan
    return v

def diff(a, b):
    m = ~(np.isnan(a).any(2) | np.isnan(b).any(2))
    if m.sum() < 4: return 255.0
    return float(np.abs(a[m]-b[m]).mean())

def groups(names, D, thr):
    """색차 < thr 이면 한 묶음 — 한 줄 잇기"""
    par = list(range(len(names)))
    def find(i):
        while par[i] != i: par[i] = par[par[i]]; i = par[i]
        return i
    for i in range(len(names)):
        for j in range(i+1, len(names)):
            if D[i,j] < thr:
                a, b = find(i), find(j)
                if a != b: par[a] = b
    g = {}
    for i, n in enumerate(names): g.setdefault(find(i), []).append(n)
    return list(g.values())

if __name__ == '__main__':
    Ns = [int(x) for x in (sys.argv[1:] or [12, 19, 31, 42, 80, 160])]
    fam = {}
    for p in sorted(glob.glob(TH + '/*.png')):
        n = os.path.basename(p)[:-4]
        f = re.sub(r'_(v[12])$', '', n)
        fam.setdefault(f, p)
    fam.pop('_gw_standing', None)                    # 잎이 아니라 줄기 에셋
    fam.pop('mon_variegata_greenwhite_stem', None)
    names = sorted(fam)
    print('갈래 %d개 · 잎을 N×N 로 줄여 놓고 잰다\n' % len(names))
    THRS = [8, 12, 16, 20, 25, 30]
    print('%5s |' % 'N px', ' '.join('%6s' % ('차<%d' % t) for t in THRS))
    print('-'*6 + '+' + '-'*(7*len(THRS)))
    keep = {}
    for N in Ns:
        A = [leaf_at(fam[f], N) for f in names]
        D = np.zeros((len(names), len(names)))
        for i in range(len(names)):
            for j in range(i+1, len(names)):
                D[i,j] = D[j,i] = diff(A[i], A[j])
        keep[N] = (names, D)
        print('%5d |' % N, ' '.join('%6d' % len(groups(names, D, t)) for t in THRS))
    print('\n★ 칸의 수 = 「그 크기·그 문턱에서 «서로 달라 보이는» 묶음이 몇 개인가」')
    print('⚠ 문턱은 «사람 눈이 아니다». 한 수로 답을 내지 마라 — 표로 읽고 눈으로 받아라.')
    # 제일 작은 N 에서 무엇이 뭉치는지 한 벌 보여 준다
    N0 = min(Ns); names0, D0 = keep[N0]
    gs = sorted(groups(names0, D0, 16), key=len, reverse=True)
    print('\n── %d px · 문턱 16 에서 뭉치는 묶음 (큰 것부터 다섯) ──' % N0)
    for g in gs[:5]:
        if len(g) > 1: print('  [%d] %s' % (len(g), ' · '.join(g)))
