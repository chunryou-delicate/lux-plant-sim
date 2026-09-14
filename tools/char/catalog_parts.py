#!/usr/bin/env python3
"""부품 «전부»를 몸에 하나씩 얹어 걷는 자세로 찍어 종류별 한 장씩 낸다 — 크레딧 0. 눈으로 고르는 표.

⛔ 왜 있나 (2026-09-14 · 총괄) — 박사님 「지직지직하고 매칭이 안 되는데 확인함?」
  세트 렌더 몇 장만 보고 넘겼다. 부품 140벌을 «하나도 빠짐없이» 같은 자세·같은 크기로 찍어 놓아야 고를 수 있다.

쓰기
  python tools/char/catalog_parts.py [--w=160] [--out=docs/handoff/img/bodytest/catalog]
  · 옷·신발: 몸(맨몸 v19 리깅) + 그 부품 + 눈 · 머리·모자: 몸 + 부품 + 눈 · q34 · t=0.3
  · 칸마다 파일 이름을 적는다. 종류별 PNG(catalog_yeoja_top.png …) 와 전체 목록 한 장
"""
import os, re, sys, subprocess
from PIL import Image, ImageDraw
B='assets/characters/_bodybase'
o={x.split('=')[0]:x.split('=')[1] for x in sys.argv[1:] if x.startswith('--')}
W=int(o.get('--w',160)); OUT=o.get('--out','docs/handoff/img/bodytest/catalog'); os.makedirs(OUT,exist_ok=True)
tmp=os.environ.get('TEMP','.')+'/cat'; os.makedirs(tmp,exist_ok=True); os.makedirs(B+'/masks',exist_ok=True)
groups={}
for f in sorted(os.listdir(B)):
    m=re.match(r'(yeoja|namja)_(hair|top|bottom|shoes|dress|set|acc|hat)\d*(?:_\w+?)?_rigged\.glb$',f)
    if m: groups.setdefault((m.group(1),m.group(2)),[]).append(f)
for (who,kind),files in groups.items():
    clip=f'{B}/{who}_v19_walk.glb'; body=f'{B}/char_{who}_base_v19_rigged.glb'; eyes=f'{B}/{who}_face_eyes1.glb'
    tiles=[]
    for f in files:
        png=f'{tmp}/{f[:-4]}.png'
        bd=body
        if kind in ('top','bottom','shoes','dress','set','acc'):          # ★ 옷은 그 옷 밑 몸 면을 지운 몸으로(게임과 같은 조건)
            bd=f'{tmp}/{f[:-4]}_body.glb'
            subprocess.run([sys.executable,'tools/char/glb_cull_under.py',body,f'{B}/{f}',bd,'--dmax='+('0.05' if kind in ('bottom','dress','set') else '0.03'),f'--mask={B}/masks/{f[:-11]}_mask.json'],capture_output=True,text=True,encoding='utf-8')
        r=subprocess.run([sys.executable,'tools/char/glb_pose_shot.py',clip,png,bd,f'{B}/{f}',eyes,'--t='+o.get('--t','0.3'),'--view='+o.get('--view','q34'),f'--w={W}'],capture_output=True,text=True,encoding='utf-8')
        if not os.path.exists(png): print('⛔',f,r.stderr[-200:]); continue
        im=Image.open(png).convert('RGB'); d=ImageDraw.Draw(im); d.text((3,3),f.replace('_rigged.glb',''),fill=(255,255,120)); tiles.append(im)
    if not tiles: continue
    cols=int(o.get('--cols',8)); rows=(len(tiles)+cols-1)//cols; tw,th=tiles[0].size
    sheet=Image.new('RGB',(cols*tw,rows*th),(18,18,18))
    for i,t in enumerate(tiles): sheet.paste(t,((i%cols)*tw,(i//cols)*th))
    p=f'{OUT}/catalog_{who}_{kind}{o.get("--suffix","")}.png'; sheet.save(p); print('✔',p,len(tiles))
