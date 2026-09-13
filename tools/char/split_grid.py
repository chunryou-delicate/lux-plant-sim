#!/usr/bin/env python3
"""2x2 격자 시트를 넷으로 잘라 배경을 도려낸다 — 좌상 front · 우상 left · 좌하 back · 우하 right.
쓰기: python tools/char/split_grid.py <시트.png> <접두> [--tol=60]   ⇒ cut_<접두>_{front,left,back,right}.png
⚠ 격자선·글자는 «배경색»으로 덮는다. 배경색은 (12, 높이/2) 에서 뽑는다 — 거기 사람이 있으면 틀린다."""
import sys, subprocess, numpy as np
from PIL import Image, ImageDraw
sheet, pre = sys.argv[1], sys.argv[2]; tol = next((x.split('=')[1] for x in sys.argv if x.startswith('--tol=')), '60')
B = sheet.rsplit('/', 1)[0] + '/'
im = Image.open(sheet).convert('RGB'); W, H = im.size; bg = im.getpixel((12, H // 2)); hs = []
for name, (cx, cy) in {'front': (0, 0), 'left': (1, 0), 'back': (0, 1), 'right': (1, 1)}.items():
    c = im.crop((cx * W // 2, cy * H // 2, (cx + 1) * W // 2, (cy + 1) * H // 2)); d = ImageDraw.Draw(c)
    for r in [(0, 0, c.size[0], 5), (0, 0, 5, c.size[1]), (c.size[0] - 5, 0, c.size[0], c.size[1]), (0, c.size[1] - 5, c.size[0], c.size[1])]: d.rectangle(r, fill=bg)
    p = B + f'{pre}_{name}.png'; c.save(p)
    subprocess.run([sys.executable, 'tools/char/cut_bg_alpha.py', p, B + f'cut_{pre}_{name}.png', f'--tol={tol}'], capture_output=True)
    a = np.array(Image.open(B + f'cut_{pre}_{name}.png'))[:, :, 3] > 8; ys = np.where(a.any(1))[0]; hs.append(int(ys[-1] - ys[0] + 1))
print(f'{pre}: 키 {hs} 어긋남 {100*(max(hs)-min(hs))/max(hs):.1f}%')
