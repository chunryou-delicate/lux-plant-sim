# -*- coding: utf-8 -*-
"""
make_thumbs.py — 원화(2D)를 썸네일로 줄인다. 2026-08-09 신설

왜 있나
------
`assets/existing/` 의 원화는 2048x2048 PNG 라 **장당 2.5MB** 다. 변이 34종만 늘어놓아도
85MB 라서 폰에서 격자로 못 편다. `tools/varie_grade.html` 이 쓰려면 줄인 판이 있어야 한다.

규약
----
`assets/crops/thumbs/` · `assets/furniture/thumbs/` 가 이미 「원본 옆 thumbs 폴더에
줄인 판을 둔다」로 서 있다. 여기도 같은 자리다 — `assets/existing/thumbs/`.

⚠ 원본은 절대 안 건드린다. 읽기만 한다.

⚠ 형식이 저 둘과 다르다(.png → .jpg). 저쪽은 GLB 를 찍은 **알파 있는 렌더**라 PNG 라야 하고,
  여기는 흰 배경 위 그림이라 알파가 없다. 재서 골랐다 — 512px 기준 PNG 170KB · JPEG 36KB 다.
  100장이면 17MB 대 3.6MB 라, 폰에서 격자로 펴는 것이 목적인 이상 JPEG 여야 한다.

⚠ 긴 변 512px 이다(400 이 아니라). 이유 하나 — **산반과 스페클을 갈라 봐야 한다.**
  400 이면 잘게 흩뿌린 점이 뭉개진다. 512 는 `assets/crops/thumbs` 가 이미 쓰는 눈금이기도 하다.
  그래도 장당 36KB 라 무겁지 않다.

쓰는 법
-------
    python tools/make_thumbs.py                 # 변이- 몬스테라 잎 전부
    python tools/make_thumbs.py --force         # 이미 있는 것도 다시 만든다
    python tools/make_thumbs.py --prefix 기본-  # 다른 묶음
    python tools/make_thumbs.py --all           # 매니페스트의 래스터 전부

내는 것
-------
    assets/existing/thumbs/<원본파일명>.jpg
    assets/existing/thumbs/index.json   원본경로 -> 썸네일 이름 (화면이 이걸 읽는다)

★ index.json 을 따로 내는 이유: 「원본 이름 → 썸네일 이름」 규칙을 HTML 이 다시 짜면
  두 곳이 갈린다. 만든 쪽이 적어 주고 읽는 쪽은 찾아보기만 한다.
"""

import argparse
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
MANIFEST = os.path.join(ASSETS, 'manifest.json')
OUTDIR = os.path.join(ASSETS, 'existing', 'thumbs')
INDEX = os.path.join(OUTDIR, 'index.json')

RASTER = ('.png', '.jpg', '.jpeg', '.jfif', '.webp')
LONG_EDGE = 512
QUALITY = 85


def slug_of(path):
    """원본 경로 -> 썸네일 파일명. 폴더가 달라도 안 부딪히게 basename 을 쓰되,
    공백·괄호처럼 URL 에서 성가신 글자는 밑줄로 바꾼다."""
    base = os.path.basename(path)
    stem = os.path.splitext(base)[0]
    stem = re.sub(r'[^0-9A-Za-z가-힣_.-]+', '_', stem)
    return stem + '.jpg'


def pick_items(items, args):
    """썸네일을 만들 래스터 항목을 고른다. 한 이름(name_ko)에 그림이 여럿이면 첫 장만."""
    out, seen = [], set()
    for it in items:
        path = it.get('path') or ''
        if not path.lower().endswith(RASTER):
            continue
        if not args.all:
            name = str(it.get('name_ko') or '')
            cat = str(it.get('category') or '')
            if not name.startswith(args.prefix):
                continue
            if args.category and not cat.startswith(args.category):
                continue
            if name in seen:
                continue
            seen.add(name)
        out.append(it)
    return out


def main():
    ap = argparse.ArgumentParser(description='원화를 썸네일로 줄인다 (원본은 안 건드린다)')
    ap.add_argument('--prefix', default='변이-', help='name_ko 앞머리 (기본 변이-)')
    ap.add_argument('--category', default='잎·몬스테라', help='category 앞머리 (기본 잎·몬스테라)')
    ap.add_argument('--all', action='store_true', help='매니페스트의 래스터를 전부')
    ap.add_argument('--long', type=int, default=LONG_EDGE, help='긴 변 픽셀 (기본 512)')
    ap.add_argument('--quality', type=int, default=QUALITY, help='JPEG 품질 (기본 85)')
    ap.add_argument('--force', action='store_true', help='이미 있는 것도 다시 만든다')
    args = ap.parse_args()

    try:
        from PIL import Image
    except ImportError:
        sys.stderr.write('Pillow 가 없습니다: pip install pillow\n')
        return 2

    with io.open(MANIFEST, encoding='utf-8') as f:
        manifest = json.load(f)
    items = pick_items(manifest['items'], args)

    os.makedirs(OUTDIR, exist_ok=True)
    index = {}
    if os.path.exists(INDEX) and not args.force:
        with io.open(INDEX, encoding='utf-8') as f:
            index = json.load(f).get('thumbs', {})

    made = skipped = missing = 0
    for it in items:
        rel = it['path']
        src = os.path.join(ASSETS, rel.replace('/', os.sep))
        if not os.path.exists(src):
            sys.stderr.write('없는 파일: %s\n' % rel)
            missing += 1
            continue
        name = slug_of(rel)
        dst = os.path.join(OUTDIR, name)
        index[rel] = name
        if os.path.exists(dst) and not args.force and os.path.getmtime(dst) >= os.path.getmtime(src):
            skipped += 1
            continue
        with Image.open(src) as im:
            im = im.convert('RGB')          # 알파 없는 그림이라 흰 배경 그대로 굳는다
            w, h = im.size
            s = min(1.0, float(args.long) / max(w, h))
            if s < 1.0:
                im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
            im.save(dst, 'JPEG', quality=args.quality, optimize=True)
        made += 1

    with io.open(INDEX, 'w', encoding='utf-8') as f:
        json.dump({
            'note': 'tools/make_thumbs.py 가 만든다. 손으로 고치지 말 것. 원본경로 -> 썸네일 파일명',
            'longEdge': args.long, 'quality': args.quality,
            'thumbs': dict(sorted(index.items())),
        }, f, ensure_ascii=False, indent=1)
        f.write('\n')

    total = sum(os.path.getsize(os.path.join(OUTDIR, n))
                for n in index.values() if os.path.exists(os.path.join(OUTDIR, n)))
    print('만든 것 %d · 그대로 둔 것 %d · 없는 원본 %d · 색인 %d줄 · 합계 %.1fMB'
          % (made, skipped, missing, len(index), total / 1048576.0))
    return 0


if __name__ == '__main__':
    sys.exit(main())
