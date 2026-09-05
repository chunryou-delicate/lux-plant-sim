# -*- coding: utf-8 -*-
"""tools/leaf/pill_contrast.py — 찍힌 판에서 «알약 하나»의 대비를 잰다
   ------------------------------------------------------------------
   ⚠ 2026-09-04 에 배운 것: 백분위 «값 하나»(아래10%↔위90%)로 글·바탕을 가르면
     상자가 거의 다 바탕일 때 「아래 10%」가 «글»이 아니라 «가장자리 흐린 화소»를
     잡는다. 그래서 대비를 통째로 낮게 냈다.
   ⇒ 여기서는 극단 «무리의 평균»으로 가른다. 그리고 «몇 화소를 글로 봤나»를
     같이 찍는다 — 글이 5% 밑이면 그 수는 못 믿는다고 스스로 말하게 한다.
"""
import sys, io, json
sys.stdout.reconfigure(encoding='utf-8'); sys.stderr.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image

def _lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def relL(rgb):
    r = _lin(np.asarray(rgb, dtype=float))
    return 0.2126 * r[..., 0] + 0.7152 * r[..., 1] + 0.0722 * r[..., 2]
def ratio(a, b):
    la, lb = float(relL(a)), float(relL(b))
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

def otsu(L):
    """★ 두 무리를 «골»에서 가른다 — 글이 몇 %든 상관없다.
       ⚠ 백분위로 가르면 바탕이 평평할 때 위쪽 무리가 «텅 빈다»(2026-09-06 자가시험)."""
    hi, lo = float(L.max()), float(L.min())
    if hi - lo < 1e-6: return None
    h, e = np.histogram(L, bins=256, range=(lo, hi))
    h = h.astype(float); mid = (e[:-1] + e[1:]) / 2
    w0 = np.cumsum(h); w1 = w0[-1] - w0
    m0 = np.cumsum(h * mid); tot = m0[-1]
    with np.errstate(invalid='ignore', divide='ignore'):
        mu0 = m0 / w0; mu1 = (tot - m0) / w1
        var = w0 * w1 * (mu0 - mu1) ** 2
    var[~np.isfinite(var)] = -1
    return float(mid[int(np.argmax(var))])

def measure(img, box, dpr=1, inset=0.0):
    """box = (x, y, w, h) in CSS px. ★ 오츠로 글·바탕을 가르고 무리의 «평균»을 쓴다."""
    x, y, w, h = [v * dpr for v in box]
    dx, dy = w * inset, h * inset
    x0, y0 = int(round(x + dx)), int(round(y + dy))
    x1, y1 = int(round(x + w - dx)), int(round(y + h - dy))
    a = np.asarray(img.convert('RGB')).astype(float)
    H, W = a.shape[:2]
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, x1), min(H, y1)
    crop = a[y0:y1, x0:x1]
    if crop.size == 0: raise SystemExit('⛔ 상자가 판 밖이다')
    flat = crop.reshape(-1, 3)
    L = 0.2126 * flat[:, 0] + 0.7152 * flat[:, 1] + 0.0722 * flat[:, 2]
    t = otsu(L)
    if t is None: raise SystemExit('⛔ 상자가 한 색이다 — 글이 없다')
    ink_m, bg_m = L <= t, L > t
    if ink_m.sum() < 8 or bg_m.sum() < 8: raise SystemExit('⛔ 한쪽 무리가 너무 작다')
    ink, bg = flat[ink_m].mean(0), flat[bg_m].mean(0)
    return {
        'crop': (x0, y0, x1, y1), 'px': int(flat.shape[0]), 'thr': round(t, 1),
        'ink': [round(float(v)) for v in ink], 'bg': [round(float(v)) for v in bg],
        'ink_px': int(ink_m.sum()), 'bg_px': int(bg_m.sum()),
        'ratio': round(ratio(ink, bg), 2),
    }

if __name__ == '__main__':
    img = Image.open(sys.argv[1])
    boxes = json.loads(sys.argv[2])          # [{"이름":..,"x":..,"y":..,"w":..,"h":..}, ..]
    dpr = float(sys.argv[3]) if len(sys.argv) > 3 else 1
    print('판 %dx%d · dpr %g' % (img.width, img.height, dpr))
    for b in boxes:
        r = measure(img, (b['x'], b['y'], b['w'], b['h']), dpr, inset=b.get('inset', 0.0))
        ok = '✔ 넘는다' if r['ratio'] >= 4.5 else ('큰 글만' if r['ratio'] >= 3 else '⛔ 못 넘는다')
        f = lambda v: '%3d,%3d,%3d' % tuple(v)
        print('  %-24s 글 %s   바탕 %s  ⇒ ★ %5.2f:1  %-10s (글 %5d / %5d 화소)'
              % (b.get('이름', '?'), f(r['ink']), f(r['bg']), r['ratio'], ok, r['ink_px'], r['px']))
