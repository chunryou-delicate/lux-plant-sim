#!/usr/bin/env python
"""3차 마젠타 시트(_raw/v3_*) → 투명 배경 초상화 낱장. 크레딧 추가 없음.

`derive.py` 의 규약을 그대로 따른다(assets/ui/_credit_log.md 「배경 키잉 규약」).
바뀐 점은 **한 인물이 시트 여러 장에 걸친다**는 것 하나다. 자취생은 표정이 6개라
한 시트에 다 안 들어가서 3+3 으로 나눠 뽑았다.

★ 시트가 둘이면 배율을 시트 안에서만 맞추면 안 된다
  「같은 인물의 표정들은 같은 배율·같은 기준선 — 파일만 바꿔 교체되어야 한다」가
  납품 규격이다. 시트 A 와 시트 B 는 생성기가 머리 크기를 조금 다르게 그린다.
  그래서 **시트별 보정 배율**을 하나씩 잡는다 — 그 시트 인물들의 **머리폭**
  중앙값(`head_width`)이 전체 중앙값과 같아지게. 시트 안의 상대 크기는 그대로
  두므로 표정 간 관계는 안 깨지고, 시트끼리만 맞는다.
  실측: 여 A 시트가 여 B 보다 0.91 배로 작게 그려져 있었다.

★ 흉상은 **정수리**로 세로를 맞춘다
  아래는 프레임 밖으로 흘러나가니 바닥 정렬이 뜻이 없다. bbox 위쪽(정수리)을
  모든 칸에서 같은 y 에 놓으면 눈높이가 저절로 맞는다.

★ 흉상 시트는 연결 성분만으로는 안 갈린다 — **골짜기**를 찾아 자른 뒤 성분을 본다
  2차 창은 「1/N 로 자르지 말고 연결 성분으로」였는데, 3차는 크롭이 더 타이트해져
  세 인물의 어깨·옷자락이 **시트 아래쪽에서 서로 닿는다**. 그러면 `label` 이 셋을
  한 덩어리(bbox 폭 3168)로 묶어 버린다(실제로 그렇게 나왔다).
  그렇다고 정확히 1/3 로 자르면 머리가 잘린다 — 생성기가 칸을 균등하게 안 준다.
  그래서 **열별 전경 화소 수의 골짜기**를 기대 경계 ±12% 안에서 찾아 거기서 자른다.
  실측 골짜기는 1344 중 0~134px 라 인물을 건드리지 않는다. 자른 다음 칸마다
  제일 큰 성분 하나만 고르면 구분선·티끌은 저절로 빠진다.
  몬이(격자·통짜)는 서로 안 닿으므로 예전대로 연결 성분만 쓴다.

  python derive3.py
"""
import os
import statistics

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, find_objects, label

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)

AR = 3 / 4          # 대화창 초상화 비율
DELIV_H = 800       # 납품 세로
QUANT = 192         # 팔레트 색수. 얼굴 그라데이션이 있어 96 까지는 못 줄인다.
LO = 90             # 마젠타다움 이 값 이하면 완전 불투명
FGT = 150           # 성분 분리용 전경 문턱
PAD = 10            # 성분 bbox 여유
MARGIN = 0.055      # whole 배치의 사방 여백

# 인물 하나 = 시트 여러 장. rows 는 격자 시트일 때만(2x2 면 2).
GROUPS = [
    dict(mode="bust", sheets=[
        ("v3_jachwi_f_a_raw.png", 1,
         ["portrait_jachwi_neutral", "portrait_jachwi_worry",
          "portrait_jachwi_tired"]),
        ("v3_jachwi_f_b_raw.png", 1,
         ["portrait_jachwi_cry", "portrait_jachwi_surprise",
          "portrait_jachwi_happy"]),
        # 덤. 코어가 찾는 키는 아니지만 있으면 쓸 데가 있다.
        ("v3_jachwi_f_c_raw.png", 1,
         ["portrait_jachwi_think", "portrait_jachwi_proud",
          "portrait_jachwi_blank"]),
    ]),
    dict(mode="bust", sheets=[
        ("v3_jachwi_m_a_raw.png", 1,
         ["portrait_jachwi_m_neutral", "portrait_jachwi_m_worry",
          "portrait_jachwi_m_tired"]),
        ("v3_jachwi_m_b_raw.png", 1,
         ["portrait_jachwi_m_cry", "portrait_jachwi_m_surprise",
          "portrait_jachwi_m_happy"]),
        ("v3_jachwi_m_c_raw.png", 1,
         ["portrait_jachwi_m_think", "portrait_jachwi_m_proud",
          "portrait_jachwi_m_blank"]),
    ]),
    dict(mode="whole", sheets=[
        ("v3_moni_raw.png", 2,
         ["portrait_moni_neutral", "portrait_moni_excited",
          "portrait_moni_sad", "portrait_moni_curious"]),
    ]),
    # ★★ 2026-08-26 — 「알아보는 놀람」 한 장. **별도 그룹**이다.
    #   ⚠ 처음엔 위 그룹에 같이 넣었더니 **기존 넷이 다 바뀌었다**(배율 x1.078).
    #     배율은 «그룹 안 head_width 중앙값»으로 정해지는데, 새 그림이 그 중앙값을
    #     끌어당긴 것이다. ⇒ **한 장을 더하려다 넷을 흔들 뻔했다.**
    #   ⇒ 그룹을 갈라 기존 넷은 손대지 않는다. 대신 **새 그림이 기존과 같은 크기인지**
    #     따로 재야 한다 — 그룹이 다르면 서로 맞춰 주지 않는다.
    # fit_like = (전체높이, 바닥y) — 위 그룹(몬이 넷)의 실측 중앙값이다.
    #   ⚠ 그 넷이 바뀌면 이 수도 다시 재야 한다. 안 그러면 놀람만 크기가 어긋난다.
    dict(mode="whole", target_bw=612, fit_like=(383.5, 622), sheets=[
        # target_bw 는 위 그룹(몬이 넷)이 실제로 쓴 기준값이다.
        # 아래 「기준값 재기」 주석 참조. 여기 수를 바꾸면 크기가 어긋난다.
        ("v4_moni_surprise_a_raw.png", 1, ["portrait_moni_surprise"]),
    ]),
]


def foreground(rgb):
    """마젠타다움 = min(r,b) - g. 초록 잎·테라코타 화분·분홍 볼은 안 걸린다."""
    a = rgb.astype(np.int32)
    return (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) < FGT


def valleys(mask, n, search=0.12):
    """가로 n칸 시트의 칸 경계. 기대 위치 ±search 안에서 열 합이 제일 작은 곳."""
    cs = mask.sum(axis=0)
    w = len(cs)
    cuts = []
    for k in range(1, n):
        c = int(k * w / n)
        lo, hi = max(0, c - int(w * search)), min(w, c + int(w * search))
        j = lo + int(np.argmin(cs[lo:hi]))
        print(f"    칸 경계 {k}: 기대 {c} → 골짜기 {j} (전경 {cs[j]}px)")
        cuts.append(j)
    return [0] + cuts + [w]


def components(rgb, n_take, rows=1, split=False):
    """칸마다 (라벨, bbox). split 이면 골짜기로 먼저 자르고 칸별 최대 성분을 쓴다."""
    fg = foreground(rgb)
    lab, n = label(fg)
    objs = find_objects(lab)

    if split:
        # 칸 경계로 잘라 칸마다 제일 큰 성분 하나. 어깨가 닿아도 갈린다.
        got = []
        edges = valleys(fg, n_take)
        for a, b in zip(edges[:-1], edges[1:]):
            band = lab[:, a:b]
            sizes = np.bincount(band.ravel(), minlength=n + 1)
            sizes[0] = 0
            ident = int(sizes.argmax())
            ys = np.where(band == ident)[0]
            xs = np.where((band == ident).any(axis=0))[0]
            got.append((ident, (slice(ys.min(), ys.max() + 1),
                                slice(a + xs.min(), a + xs.max() + 1))))
        return lab, got

    sizes = np.bincount(lab.ravel())
    sizes[0] = 0
    top = sorted(range(1, n + 1), key=lambda i: -sizes[i])[:n_take]
    got = [(i, objs[i - 1]) for i in top]

    if rows <= 1:
        got.sort(key=lambda t: t[1][1].start)
        return lab, got
    # 격자: y 중심으로 행을 가르고 행마다 x 로 정렬한다.
    got.sort(key=lambda t: (t[1][0].start + t[1][0].stop) / 2)
    per = len(got) // rows
    out = []
    for r in range(rows):
        band = got[r * per:(r + 1) * per]
        band.sort(key=lambda t: t[1][1].start)
        out += band
    return lab, out


def key_out(px, mask):
    """조각 하나를 투명 배경 RGBA 로.

    키 색은 **그 조각의 배경 화소 중 최빈색**이다. 칸마다 마젠타 색조가 미세하게
    다르므로(#FE01FC ~ #FF23FF) 칸별로 재야 테두리가 안 남는다.
    ★ 조각 전체의 최빈색으로 잡으면 안 된다 — 흉상 크롭이 타이트하면 제일 흔한
      색이 마젠타가 아니라 **크림색 티셔츠**라, 티셔츠를 배경으로 알고 인물을
      통째로 지워 버린다(실제로 두 장이 그렇게 날아갔다).
    완전 투명 기준도 255 가 아니라 키 색이어야 배경 알파가 정확히 0 이 된다.
    """
    px = px.astype(np.float32)
    body = binary_dilation(mask, iterations=6)
    bg = px[~body] if (~body).any() else px.reshape(-1, 3)
    flat = bg.reshape(-1, 3).astype(np.uint32)
    packed = (flat[:, 0] << 16) | (flat[:, 1] << 8) | flat[:, 2]
    vals, cnt = np.unique(packed, return_counts=True)
    v = int(vals[cnt.argmax()])
    key = np.array([(v >> 16) & 255, (v >> 8) & 255, v & 255], np.float32)

    mag = np.minimum(px[..., 0], px[..., 2]) - px[..., 1]
    hi = float(min(key[0], key[2]) - key[1])
    a = np.clip((hi - mag) / max(hi - LO, 1.0), 0.0, 1.0)
    a *= binary_dilation(mask, iterations=3)     # 안티에일리어스 테두리는 살린다

    safe = np.maximum(a, 1e-3)[..., None]
    fg = (px - key * (1 - a)[..., None]) / safe   # 언프리멀티플라이 = 디스필
    fg = np.where(a[..., None] > 0.02, fg, px)
    rgb = np.clip(fg, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, (a * 255).astype(np.uint8)]), "RGBA")


PROF = (0.10, 0.20, 0.30, 0.40, 0.50)


def head_width(mask):
    """머리 크기 대용치 — 정수리에서 일정 비율 내려간 지점들의 가로폭 중앙값.

    ★ bbox 폭을 쓰면 안 된다. 인물이 크게 그려진 시트에서는 머리카락이 칸 경계에
      닿아 bbox 폭이 **칸 너비로 잘려** 시트가 달라도 같은 값이 나온다.
      가로폭 프로필은 안 잘리고, 실측해 보면 시트 안에서는 거의 똑같고
      시트끼리는 곡선 모양이 같은 채 배율만 다르다(여 A/B 가 0.91 로 일정했다).
    """
    rows = np.where(mask.any(axis=1))[0]
    if not len(rows):
        return 1.0
    c0 = rows.min()
    span = max(mask.shape[0] - c0, 1)
    return float(np.median([mask[min(c0 + int(span * f), mask.shape[0] - 1)].sum()
                            for f in PROF]))


def cut(src, lab, ident, box):
    """bbox(+여유)로 잘라 키잉. 정수리 위치와 머리 크기 대용치도 같이 돌려준다."""
    h, w = lab.shape
    ys, xs = box
    r = (max(0, ys.start - PAD), max(0, xs.start - PAD),
         min(h, ys.stop + PAD), min(w, xs.stop + PAD))
    sub = np.asarray(src)[r[0]:r[2], r[1]:r[3]]
    mask = lab[r[0]:r[2], r[1]:r[3]] == ident
    return key_out(sub, mask), ys.start - r[0], head_width(mask)


def collect(group):
    """그룹의 모든 칸을 잘라 모으고, 시트별 보정 배율까지 매긴다."""
    items = []
    for sheet, rows, names in group["sheets"]:
        path = os.path.join(HERE, sheet)
        if not os.path.exists(path):
            print("  없음(건너뜀):", sheet)
            continue
        print("   ", sheet)
        src = Image.open(path).convert("RGB")
        lab, got = components(np.asarray(src), len(names), rows,
                              split=(group["mode"] == "bust"))
        if len(got) != len(names):
            print(f"  ! {sheet}: 칸 {len(got)}개 / 이름 {len(names)}개")
        for (ident, box), name in zip(got, names):
            im, crown, bw = cut(src, lab, ident, box)
            items.append(dict(name=name, im=im, crown=crown, bw=bw,
                              sheet=sheet))
    if not items:
        return items
    # 시트별 폭 중앙값을 전체 중앙값에 맞춘다 → 시트끼리 배율이 맞는다.
    med = {}
    for s in {it["sheet"] for it in items}:
        med[s] = statistics.median(it["bw"] for it in items
                                   if it["sheet"] == s)
    # ★ 그룹이 「기준 머리폭」을 못박아 둘 수 있다.
    #   ⚠ 안 그러면 **그룹이 다르면 서로 크기가 안 맞는다.**
    #     실제로 「놀람」을 별도 그룹으로 뺐더니 머리폭 301 이 나왔다 —
    #     기존 넷은 186~191 이라 나란히 놓으면 몬이가 커 보인다.
    #   ⇒ 같은 인물을 여러 그룹으로 나눌 때는 **기준을 손으로 물려야** 한다.
    target = group.get("target_bw") or statistics.median(med.values())
    for it in items:
        it["s"] = target / med[it["sheet"]]
        print(f"    {it['name']:32s} 머리폭 {it["bw"]:6.0f}  보정 x{it['s']:.3f}")
    return items


def lay_bust(items):
    """흉상: 정수리를 공통 y 에 맞춘다. 아래·좌우는 프레임 밖으로 흘러나간다."""
    tops = [it["crown"] * it["s"] for it in items]
    c = max(tops)
    hs = [c - t + it["im"].size[1] * it["s"] for it, t in zip(items, tops)]
    h = int(round(max(hs)))
    w = int(round(h * AR))
    out = []
    for it, t in zip(items, tops):
        nw = max(1, int(round(it["im"].size[0] * it["s"])))
        nh = max(1, int(round(it["im"].size[1] * it["s"])))
        sub = it["im"].resize((nw, nh), Image.LANCZOS)
        cv = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        cv.paste(sub, ((w - nw) // 2, int(round(c - t))), sub)
        out.append((it["name"], cv))
    return out


def lay_whole(items):
    """몬이: 잎·화분까지 통째로. 공통 배율·공통 바닥선. 프레임을 다 안 채운다."""
    h = int(round(max(it["im"].size[1] * it["s"] for it in items)))
    w = int(round(h * AR))
    uw, uh = w * (1 - 2 * MARGIN), h * (1 - 2 * MARGIN)
    k = min(min(uw / (it["im"].size[0] * it["s"]),
                uh / (it["im"].size[1] * it["s"])) for it in items)
    base = int((h + max(it["im"].size[1] * it["s"] * k for it in items)) / 2)
    out = []
    for it in items:
        nw = max(1, int(round(it["im"].size[0] * it["s"] * k)))
        nh = max(1, int(round(it["im"].size[1] * it["s"] * k)))
        sub = it["im"].resize((nw, nh), Image.LANCZOS)
        cv = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        cv.paste(sub, ((w - nw) // 2, base - nh), sub)
        out.append((it["name"], cv))
    return out


def fit_like(im, want_bw, want_bottom):
    """★ 이미 만들어진 낱장을 **다른 그룹의 결과에 맞춘다.**

    ⚠ 왜 필요한가 — `lay_whole` 은 **그룹에서 제일 큰 것이 프레임에 맞도록** 배율을 정한다.
      그래서 **한 장짜리 그룹은 그 한 장이 프레임을 꽉 채운다.** 실제로 「놀람」을 따로 뽑았더니
      머리폭이 304 로 나왔다 — 기존 넷은 186~191 이라 나란히 놓으면 몬이가 커 보인다.
    ⇒ 같은 인물을 **여러 그룹으로 나누면 크기가 서로 안 맞는다.** 그래서 손으로 맞춘다.
    ⚠ 기존 넷을 같은 그룹에 넣어 해결하려 했지만, 그러면 **그 넷이 다시 계산되어 바뀐다.**
      **한 장을 더하려고 넷을 흔들 수는 없다.**"""
    a = np.asarray(im.convert("RGBA"))
    al = a[..., 3] > 40
    ys, xs = np.where(al)
    if not len(ys):
        return im
    top, bot = ys.min(), ys.max()
    # ★ 머리폭이 아니라 **전체 높이**로 맞춘다.
    #   ⚠ 머리폭으로 맞췄더니 크기는 같은데 **위가 텅 비고 아래로 쏠렸다.**
    #     이 raw 는 인물 대비 화분·잎 비율이 기존 시트와 달라서, 한 척도를 맞추면
    #     다른 척도가 어긋난다. 대화창에서 중요한 것은 **상자를 채우는 정도**라
    #     전체 높이를 기준으로 삼는다.
    k = want_bw / float(bot - top)
    nw, nh = max(1, int(round(im.size[0] * k))), max(1, int(round(im.size[1] * k)))
    sub = im.resize((nw, nh), Image.LANCZOS)
    cv = Image.new("RGBA", im.size, (0, 0, 0, 0))
    # 바닥선을 맞춘다 — 세로는 「화분 밑」이 기준이다
    cv.paste(sub, ((im.size[0] - nw) // 2,
                   int(round(want_bottom - bot * k))), sub)
    return cv


def main():
    for group in GROUPS:
        print(group["sheets"][0][0], "…")
        items = collect(group)
        if not items:
            continue
        laid = (lay_bust if group["mode"] == "bust" else lay_whole)(items)
        for name, im in laid:
            im = im.resize((int(round(DELIV_H * AR)), DELIV_H), Image.LANCZOS)
            if group.get("fit_like"):
                im = fit_like(im, *group["fit_like"])
            im = im.quantize(colors=QUANT, method=Image.FASTOCTREE)
            dst = os.path.join(OUT, name + ".png")
            im.save(dst, optimize=True)
            print(f"  {name}.png  {im.size[0]}x{im.size[1]}  "
                  f"{os.path.getsize(dst) / 1024:.0f}KB")


if __name__ == "__main__":
    main()
