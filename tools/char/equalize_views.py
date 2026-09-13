#!/usr/bin/env python3
"""잘라 낸 4뷰의 «키»를 앞 칸에 맞춰 확대·축소한다 — 칸마다 사람 크기가 다르게 나온 시트용. 크레딧 0.
쓰기: python tools/char/equalize_views.py <접두>   ⇒ cut_<접두>_{front,left,back,right}.png 를 제자리에서 고친다"""
import sys, numpy as np
from PIL import Image
B='assets/characters/_bodybase/'; pre=sys.argv[1]
def h(im):
    a=np.array(im)[:,:,3]>8; ys=np.where(a.any(1))[0]; return ys[-1]-ys[0]+1
ims={n:Image.open(B+f'cut_{pre}_{n}.png').convert('RGBA') for n in ('front','left','back','right')}; H0=h(ims['front'])
for n,im in ims.items():
    s=H0/h(im)
    if abs(s-1)>0.02:
        im2=im.resize((int(im.size[0]*s),int(im.size[1]*s)),Image.LANCZOS); a=np.array(im2)[:,:,3]>8
        ys=np.where(a.any(1))[0]; xs=np.where(a.any(0))[0]; crop=im2.crop((xs[0],ys[0],xs[-1]+1,ys[-1]+1))
        cv=Image.new('RGBA',im.size,(0,0,0,0)); cv.paste(crop,((im.size[0]-crop.size[0])//2, max(0,im.size[1]-crop.size[1]-20)),crop); cv.save(B+f'cut_{pre}_{n}.png'); print(n,'배율 %.3f'%s)
print(pre,'키',[h(Image.open(B+f'cut_{pre}_{n}.png').convert('RGBA')) for n in ('front','left','back','right')])
