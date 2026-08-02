# -*- coding: utf-8 -*-
"""폰 세로(390x844 @2x) 배치·이동 UI 2D 에셋 최종 빌드.
   - bar_plate / chip_plate : _raw 재활용 (재생성 없음)
   - ring_spot*             : 절차적 (크레딧 0)
   - icon_* / item_*        : ui9_raw.png 3x3 시트 1장에서 9개 잘라냄
"""
import os
from collections import Counter

import numpy as np
from PIL import Image, ImageFilter

UI = os.environ["UI_DIR"]
RAW = os.path.join(UI, "_raw")


# ---------------- 앞 워커의 마젠타 키잉 규약 ----------------
def key_color(im, key=(255, 0, 255), t0=70.0, t1=170.0):
    """지정한 배경색과의 거리로 알파를 만든다. 디스필은 마젠타 물듦(r,b > g)만 건드린다."""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    kr, kg, kb = key
    d = np.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2)
    alpha = np.clip((d - t0) / (t1 - t0), 0.0, 1.0)
    m = np.minimum(r, b)
    over = np.maximum(m - g, 0.0)
    r = r - over * 0.9
    b = b - over * 0.9
    return Image.fromarray(np.stack([np.clip(r, 0, 255), np.clip(g, 0, 255),
                                     np.clip(b, 0, 255), alpha * 255.0], -1).astype(np.uint8), "RGBA")


def crop_alpha(im, pad=0):
    bb = im.split()[3].getbbox()
    if not bb:
        return im
    x0, y0, x1, y1 = bb
    return im.crop((max(0, x0 - pad), max(0, y0 - pad),
                    min(im.width, x1 + pad), min(im.height, y1 + pad)))


def pad_square(im):
    s = max(im.size)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    return out


def save(im, name, size=None, colors=96):
    if size:
        im = im.resize(size, Image.LANCZOS)
    p = os.path.join(UI, name)
    if colors:
        im.convert("RGBA").quantize(colors=colors, method=Image.FASTOCTREE).save(p, optimize=True)
    else:
        im.save(p, optimize=True)
    print("  %-26s %-11s %5.1fKB" % (name, "%dx%d" % im.size, os.path.getsize(p) / 1024))
    return im


def corner_radius(im):
    a = np.asarray(im.split()[3])
    for y in range(a.shape[0]):
        xs = np.nonzero(a[y] > 200)[0]
        if len(xs) and xs[0] <= 1:
            return y
    return 0


def make_9slice_clean(im, s):
    """9-slice 로 늘릴 때 이음매가 안 생기게 가장자리·중앙을 균질화. 모서리 s×s 는 원본 유지."""
    a = np.asarray(im).astype(np.float32).copy()
    h, w = a.shape[:2]
    for y0, y1 in ((0, s), (h - s, h)):
        a[y0:y1, s:w - s, :] = np.median(a[y0:y1, s:w - s, :], axis=1, keepdims=True)
    for x0, x1 in ((0, s), (w - s, w)):
        a[s:h - s, x0:x1, :] = np.median(a[s:h - s, x0:x1, :], axis=0, keepdims=True)
    c = np.median(a[s:h - s, s:w - s, :].reshape(-1, 4), axis=0)
    a[s:h - s, s:w - s, :] = c
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA"), c


def soften(im, k=0.55, mul=(255, 255, 255)):
    """베벨 대비를 눌러 '액자'처럼 튀지 않게 한다. UI 가 3D 방보다 눈에 띄면 안 된다."""
    a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3]
    m = rgb.reshape(-1, 3).mean(0)
    rgb = m + (rgb - m) * k
    rgb *= np.array(mul, np.float32) / 255.0
    a[..., :3] = np.clip(rgb, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def tint(im, rgb):
    a = np.asarray(im).astype(np.float32)
    a[..., :3] = np.clip(a[..., :3] * (np.array(rgb, np.float32) / 255.0), 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


# ==================================================================
# 1) bar_plate — 상단 상태 바 · 하단 액션 바 공용 9-slice 판
#    _raw/slot_raw.png 재활용. 재생성 없음.
# ==================================================================
print("bar_plate   <- _raw/slot_raw.png  (재활용)")
sp = crop_alpha(key_color(Image.open(os.path.join(RAW, "slot_raw.png"))))
R = corner_radius(sp)
s_src = int(R * 1.15)
clean, cmid = make_9slice_clean(sp, s_src)
clean = soften(clean, 0.5, (236, 230, 222))          # 대비↓ + 살짝 따뜻하게
OUT = 192
sl = round(s_src / sp.width * OUT)
save(clean, "bar_plate.png", (OUT, OUT))
c2 = np.asarray(soften(Image.fromarray(np.asarray(clean).astype(np.uint8), "RGBA"), 1.0))
print("     crop=%s 모서리R=%d -> slice=%d  중앙색=rgb(%d,%d,%d)"
      % (sp.size, R, sl, *np.asarray(clean.resize((OUT, OUT)))[OUT // 2, OUT // 2][:3]))

print("chip_plate  <- _raw/button_raw.png (재활용)")
bp = crop_alpha(key_color(Image.open(os.path.join(RAW, "button_raw.png"))))
bp = bp.resize((512, round(bp.height / bp.width * 512)), Image.LANCZOS)
sb = int(corner_radius(bp) * 1.15)
cb, _ = make_9slice_clean(bp, sb)
cb = soften(cb, 0.6, (150, 143, 132))                 # 저채도 따뜻한 회색
slb = round(sb / 512 * 192)
save(cb.resize((192, 192), Image.LANCZOS), "chip_plate.png")
print("     -> slice=%d" % slb)

# ==================================================================
# 2) ring_spot — 3D 위에 겹치는 '선택된 자리' 링 + 글로우 (절차적)
# ==================================================================
print("ring_spot   (절차적, 크레딧 0)")
W, H, SS = 512, 288, 4
w, h = W * SS, H * SS
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
d = np.sqrt(((xx - w / 2) / (w * 0.375)) ** 2 + ((yy - h / 2) / (h * 0.375)) ** 2)
core = np.clip(1.0 - np.abs(d - 1.0) / 0.048, 0, 1) ** 0.75 * 0.92      # 주 링
inner = np.clip(1.0 - d, 0, 1) ** 1.8 * 0.13                            # 안쪽 바닥 광
outer = np.where(d > 1.0, np.exp(-((d - 1.0) / 0.13) ** 2), 0.0) * 0.26  # 바깥으로만 번짐
tick = np.clip(1.0 - np.abs(d - 1.14) / 0.016, 0, 1) * 0.20             # 가는 보조 링
alpha = np.clip(core + inner + outer + tick, 0, 1)
a8 = Image.fromarray((alpha * 255).astype(np.uint8), "L").resize((W, H), Image.LANCZOS)
a8 = a8.filter(ImageFilter.GaussianBlur(0.5))
white = Image.new("L", (W, H), 255)
ring = Image.merge("RGBA", (white, white, white, a8))
ea = np.asarray(a8)
print("     가장자리 알파 max = %d (0 이어야 잘린 테가 안 보인다)"
      % max(ea[0].max(), ea[-1].max(), ea[:, 0].max(), ea[:, -1].max()))
save(ring, "ring_spot.png", colors=None)
save(tint(ring, (168, 206, 130)), "ring_spot_ok.png", colors=None)
save(tint(ring, (214, 126, 100)), "ring_spot_no.png", colors=None)

# ==================================================================
# 3) ui9_raw 3x3 시트 → 아이콘 9개 (생성 1장 = 2크레딧)
# ==================================================================
print("아이콘 9개  <- _raw/ui9_raw.png (3x3 시트 1장)")
sheet = Image.open(os.path.join(RAW, "ui9_raw.png")).convert("RGB")
Q = sheet.width // 3
cells = [
    ("icon_move.png", 0, 0, 128), ("icon_cancel.png", 1, 0, 128), ("icon_confirm.png", 2, 0, 128),
    ("icon_light_sun.png", 0, 1, 96), ("icon_light_half.png", 1, 1, 96), ("icon_light_cloud.png", 2, 1, 96),
    ("item_siru_open.png", 0, 2, 128), ("item_siru_closed.png", 1, 2, 128), ("item_beansprout.png", 2, 2, 128),
]
cut = {}
for name, cx, cy, px in cells:
    tile = sheet.crop((cx * Q, cy * Q, (cx + 1) * Q, (cy + 1) * Q))
    # 칸마다 마젠타 색조가 조금씩 다르다 — 그 칸에서 제일 흔한 색을 키 색으로 쓴다
    small = tile.resize((64, 64))
    key = Counter(small.getdata()).most_common(1)[0][0]
    ic = pad_square(crop_alpha(key_color(tile, key=key, t0=60.0, t1=150.0), pad=6))
    cut[name] = save(ic, name, (px, px))
    print("       (키색 %s)" % (key,))

# 스프라이트 시트 — background-position 으로 상태만 바꾸고 싶을 때
strip = Image.new("RGBA", (96 * 3, 96), (0, 0, 0, 0))
for i, n in enumerate(["icon_light_sun.png", "icon_light_half.png", "icon_light_cloud.png"]):
    strip.paste(Image.open(os.path.join(UI, n)).convert("RGBA"), (i * 96, 0))
save(strip, "sheet_light.png")

strip2 = Image.new("RGBA", (128 * 3, 128), (0, 0, 0, 0))
for i, n in enumerate(["icon_move.png", "icon_cancel.png", "icon_confirm.png"]):
    strip2.paste(Image.open(os.path.join(UI, n)).convert("RGBA"), (i * 128, 0))
save(strip2, "sheet_mode.png")

print("done")
