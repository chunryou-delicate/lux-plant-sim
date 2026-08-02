#!/usr/bin/env python
"""생성기에 넣을 참조 이미지를 만든다 — 3D 신원 참조 · 화풍 참조.

`render_ref.py` 가 뽑아 둔 정사영 렌더를 **전신 + 얼굴** 두 칸으로 이어 붙인다.
2차 창이 손으로 만든 `ref_in_jachwi_f.png` 와 같은 규약이다.

화풍 참조(`_style/*.png`)는 투명 PNG 라 그대로 올리면 업로드 쪽에서 검은
배경으로 합성될 수 있다. **흰 배경으로 눌러서** 올린다.

★ 화풍 참조 1번의 정수리 회색 띠를 지우고 올린다
  1번은 3D 저폴리 원본의 머리 하이라이트를 그대로 물려받아 정수리에 **밝은 회색
  띠**가 있다. 「참조가 잘려 있으면 결과도 잘린다」와 같은 이야기다 — 이걸 그냥
  넣으면 생성물마다 머리띠를 쓴 사람이 나온다(실제로 세 번 다 나왔다).
  띠는 검은 머리에 둘러싸인 **구멍**이라, 어두운 머리 마스크를 채워서(fill_holes)
  차집합을 잡으면 정확히 띠만 골라진다. 거기를 머리 기본색으로 덮는다.

  python make_ref_in.py
  -> _ref/ref_in_jachwi_m.png            (1280x640)
  -> _ref/_in_style_1.png · _in_style_2.png   (600x800, 흰 배경 RGB)
"""
import os

import numpy as np
from PIL import Image
from scipy.ndimage import binary_closing, binary_dilation, binary_fill_holes

HERE = os.path.dirname(os.path.abspath(__file__))
STYLE = os.path.join(os.path.dirname(HERE), "_style")

MAGENTA = (255, 0, 255)


def contact(tag, views=("front", "face"), size=640):
    ims = [Image.open(os.path.join(HERE, f"ref_{tag}_{v}.png")).convert("RGB")
           for v in views]
    sheet = Image.new("RGB", (size * len(ims), size), MAGENTA)
    for i, im in enumerate(ims):
        sheet.paste(im.resize((size, size), Image.LANCZOS), (i * size, 0))
    dst = os.path.join(HERE, f"ref_in_{tag}.png")
    sheet.save(dst)
    print(f"  ref_in_{tag}.png  {sheet.size[0]}x{sheet.size[1]}")
    return dst


def deband(im, hair=(73, 62, 61), tol=45, y_full=0.19, y_fade=0.23):
    """정수리를 머리 기본색으로 눌러 밝은 띠를 지운다.

    구멍(fill_holes)만 잡으면 띠가 머리 실루엣 가장자리에 닿는 데서 새고,
    문턱을 얼굴까지 내리면 **눈이 구멍으로 잡혀** 눈두덩이 시커멓게 막힌다
    (한 번 그렇게 나왔다). 그래서 눈보다 한참 위인 **정수리 띠(y_full)만**
    통째로 덮고, 눈썹 위(y_fade)까지 선형으로 풀어 이음매를 없앤다.
    """
    a = np.asarray(im).astype(np.float32)
    h = np.array(hair, np.float32)
    H = a.shape[0]
    dark = np.abs(a - h).max(axis=2) < tol
    head = binary_fill_holes(binary_closing(dark, np.ones((9, 9))))
    # 띠가 실루엣 가장자리에 닿은 데는 채움에서 새어 밝은 점으로 남는다.
    # 조금 부풀리되 흰 배경은 빼서 머리 밖으로 번지지 않게 한다.
    head = binary_dilation(head, iterations=7) & (a.min(axis=2) < 235)

    ramp = np.clip((H * y_fade - np.arange(H)) / (H * (y_fade - y_full)), 0, 1)
    w = (head * ramp[:, None]).astype(np.float32)[..., None]
    out = a * (1 - w) + h * w
    print(f"    정수리 {int((w[..., 0] > 0.5).sum()):,}px 를 머리색으로 덮음")
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def flatten(src, dst, bg=(255, 255, 255), fix_band=False):
    im = Image.open(src).convert("RGBA")
    flat = Image.new("RGB", im.size, bg)
    flat.paste(im, (0, 0), im)
    if fix_band:
        flat = deband(flat)
    flat.save(dst)
    print(f"  {os.path.basename(dst)}  {flat.size[0]}x{flat.size[1]}")


if __name__ == "__main__":
    contact("jachwi_m")
    flatten(os.path.join(STYLE, "style_pick_jachwi_neutral.png"),
            os.path.join(HERE, "_in_style_1.png"), fix_band=True)
    flatten(os.path.join(STYLE, "style_2_cleareye.png"),
            os.path.join(HERE, "_in_style_2.png"))
