# -*- coding: utf-8 -*-
"""tools/leaf/hf_review1009.py — Higgsfield 10-09 leaf 카드 최종 검수·손질 ([leaf] · 크레딧 0)
   카드(투명 PNG · 저장소 1024 사본)를 재고 손본다. 2k 원본(_hf_masters)은 안 건드린다.
     ① 잎끝 꼭지 지우기 — 주문 글이 «잎자루는 아래로»라 했는데 참조 썸네일은 잎자루가 위 홈에 있다(주문표 쪽 충돌 · 장부 set_notes).
        그래서 여러 장이 «잎 끝(아래)에서 줄기»가 났다 — 몬스테라·PP·AL 은 잎자루가 홈(위)에 붙는다. 아래 끝의 «가늘고 폭이 고른 줄»만 지운다(tip_stub 머리말).
     ② 어두운 가족 밝히기 — 잎 화소(알파>128) Rec.709 밝기 평균 < 0.25 면 V 에 감마를 걸어 0.25 로(무늬·색상 그대로)
   쓰기: python tools/leaf/hf_review1009.py measure            — 재기만(손질 없음 · 표)
         python tools/leaf/hf_review1009.py fix <png>...       — 그 파일들을 손봐 제자리에 쓴다(_hf_masters 에 원본이 있어야 돈다)"""
import sys, os, glob, json
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
MASTERS = os.path.abspath(os.path.join(ROOT, '..', '_hf_masters'))
LUMA_MIN = 0.25

def luma(img):
    a = np.asarray(img.convert('RGBA')).astype(np.float64) / 255.0
    m = a[..., 3] > 0.5
    y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    return float(y[m].mean()) if m.any() else 0.0

def _seg_at(row, cx):
    """그 줄에서 x=cx 를 품는(없으면 ±12 안 가장 가까운) 불투명 토막 (x0, x1) — 없으면 None"""
    xs = np.where(row)[0]
    if not len(xs): return None
    cuts = np.where(np.diff(xs) > 1)[0]; starts = np.r_[xs[0], xs[cuts + 1]]; ends = np.r_[xs[cuts], xs[-1]]
    best = None
    for x0, x1 in zip(starts, ends):
        d = 0 if x0 <= cx <= x1 else min(abs(cx - x0), abs(cx - x1))
        if d <= 12 and (best is None or d < best[0]): best = (d, int(x0), int(x1))
    return best and (best[1], best[2])

def tip_stub(img):
    """(아래 꼭지 줄 수, 그 줄 폭 중앙값, 지울 토막 [(y, x0, x1)…]) — 없으면 (0, 0, None)
       줄기 = 맨 아래부터 «줄기 토막»(그 줄에서 줄기 자리를 품는 불투명 토막 — 줄 전체 폭이 아니다: 아래쪽 잎 갈래가 줄기 윗토막과 같은 줄에 걸친다 · 10-09 첫 판이 그래서 윗토막을 남겼다)이
       폭 ≤ 4.5% 로 36줄 넘게 고르게(10~90 분위 차 ≤ 0.6 × 중앙값) 이어질 때. 뾰족한 잎끝은 폭이 한결같이 늘어 이 조건을 못 채운다(몬스테라 민잎·알로카시아 민잎 재 봄).
       지우는 곳은 «맨 아래부터 토막 폭이 1.6 × 중앙값을 처음 넘기 바로 전»까지 — 그 토막만(같은 줄의 잎 갈래는 그대로)."""
    if any(k in os.path.basename(getattr(img, 'filename', '') or '') for k in STUB_SKIP): return 0, 0, None
    A = np.asarray(img.convert('RGBA'))[..., 3] > 128; H, W = A.shape
    rows = np.where(A.any(1))[0]
    if not len(rows): return 0, 0, None
    thin = W * 0.045
    y = rows[-1]; cx = float(np.where(A[y])[0].mean()); segs = []
    while y >= 0:
        sg = _seg_at(A[y], cx)
        if sg is None or (sg[1] - sg[0] + 1) > thin: break
        segs.append((y, sg[0], sg[1])); cx = (sg[0] + sg[1]) / 2; y -= 1
    if len(segs) < 36: return 0, 0, None
    ws = np.array([x1 - x0 + 1 for _, x0, x1 in segs], np.float64); med = float(np.median(ws)); core = ws[ws >= 0.6 * med]
    if len(core) < 36 or (np.percentile(core, 90) - np.percentile(core, 10)) > 0.6 * med: return 0, 0, None
    cut = segs
    for i, (yy, x0, x1) in enumerate(segs):
        if (x1 - x0 + 1) > 1.6 * med and i > 0: cut = segs[:i]; break
    return len(segs), med, cut

STUB_SKIP = ('variegata_pink',)   # 둥근 잎 · 갈래가 방사로 길게 뻗어 맨 아래 갈래 끝이 «폭 고른 줄»로 읽힌다 — 이 가족 카드엔 줄기가 없다(10-09 모아 보기로 확인)

def remove_stub(img, segs):
    """그 토막(±4px)과 토막 맨 아래 밑으로 끝까지(줄기 끝의 옅은 알파 · 그림자) 지운다 — 10-09 첫 판은 ±1px 라 옅은 줄이 남았다"""
    a = np.asarray(img.convert('RGBA')).copy(); H, W = a.shape[:2]
    for y, x0, x1 in segs: a[y, max(0, x0 - 4): min(W, x1 + 5), 3] = 0
    xl = max(0, min(x0 for _, x0, _ in segs) - 6); xr = min(W, max(x1 for _, _, x1 in segs) + 7)
    a[max(y for y, _, _ in segs):, xl:xr, 3] = 0
    # 자른 자리 바로 위 두 줄은 그 토막 폭만큼 알파를 낮춘다 — 칼로 자른 티를 줄인다
    yt, x0, x1 = segs[-1]
    for k, f in ((1, 0.5), (2, 0.75)):
        if yt - k >= 0: a[yt - k, max(0, x0 - 1): x1 + 2, 3] = (a[yt - k, max(0, x0 - 1): x1 + 2, 3] * f).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')

def lift(img, target=LUMA_MIN):
    rgba = img.convert('RGBA'); a = np.asarray(rgba).astype(np.float64)
    hsv = np.asarray(rgba.convert('RGB').convert('HSV')).astype(np.float64)
    lo, hi, best = 0.3, 1.0, None
    for _ in range(18):                                  # 감마를 반으로 쪼개 찾는다(낮을수록 밝다)
        g = (lo + hi) / 2; h2 = hsv.copy(); h2[..., 2] = 255 * (hsv[..., 2] / 255) ** g
        rgb = np.asarray(Image.fromarray(h2.astype(np.uint8), 'HSV').convert('RGB')).astype(np.float64)
        out = np.dstack([rgb, a[..., 3]]); y = luma(Image.fromarray(out.astype(np.uint8), 'RGBA'))
        if y >= target: best = (g, out); lo = g
        else: hi = g
    if best is None: return img, None
    return Image.fromarray(best[1].astype(np.uint8), 'RGBA'), round(best[0], 3)

def cards():
    return sorted(glob.glob(os.path.join(ROOT, 'assets/illust/cards/*.png')) + glob.glob(os.path.join(ROOT, 'assets/illust/cards/_styleB/*.png'))
                  + glob.glob(os.path.join(ROOT, 'assets/illust/cards/_pilot/*.png')))

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'measure'
    if cmd == 'measure':
        rows = []
        for f in cards():
            im = Image.open(f); n, med, top = tip_stub(im)
            rows.append({'file': os.path.relpath(f, ROOT).replace(os.sep, '/'), 'luma': round(luma(im), 3), 'stub_rows': n, 'stub_w': med})
        for r in rows: print(f"{r['file']:62s} 밝기 {r['luma']:.3f} {'⚠어두움' if r['luma'] < LUMA_MIN else '       '} 꼭지 {r['stub_rows']:3d}줄 폭 {r['stub_w']}")
        print('꼭지 있는 것', sum(1 for r in rows if r['stub_rows']), '/', len(rows), '· 어두운 것', sum(1 for r in rows if r['luma'] < LUMA_MIN))
    elif cmd == 'fix':
        for f in sys.argv[2:]:
            rel = os.path.relpath(os.path.abspath(f), ROOT); m = os.path.join(MASTERS, rel)
            if not os.path.exists(m): print('⛔ 원본이 _hf_masters 에 없다 — 안 손댐', rel); continue
            im = Image.open(f); did = []
            n, med, top = tip_stub(im)
            if top is not None: im = remove_stub(im, top); did.append(f'꼭지 {n}줄 지움')
            if luma(im) < LUMA_MIN:
                im, g = lift(im); did.append(f'밝힘 γ{g}')
            if did: im.save(f, optimize=True); print(rel.replace(os.sep, '/'), '·', ' · '.join(did), '· 밝기', round(luma(im), 3))
            else: print(rel.replace(os.sep, '/'), '· 손질 없음')
