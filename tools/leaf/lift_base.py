# -*- coding: utf-8 -*-
"""tools/leaf/lift_base.py — GLB 밑색 텍스처의 «어두운 바탕»만 밝힌다(무늬·색상은 그대로) · [leaf] 10-09 · Meshy 결과 손질(크레딧 0)
   Meshy retexture(meshy-6 · remove_lighting)가 무늬 견본보다 바탕을 짙게 칠한다(M1 제브라: 잎 밝기 평균 118 → 68).
   ⇒ HSV 의 V 에 감마(<1)를 걸어 어두운 쪽만 끌어올린다 — 밝은 무늬(줄·반점)는 거의 안 움직인다.
   쓰기: python tools/leaf/lift_base.py <in.glb> <out.glb> <gamma> [<채도배>] [<색상 도>] [--max=1024]   (옛 가족의 바탕 H·S·V 를 재서 맞춘다)
         gamma 0.55 면 V 0.12 → 0.31 · 0.5 → 0.68 · 0.9 → 0.94
   GLB 는 손으로 다시 묶는다(이미지 bufferView 만 바꾸고 뒤 오프셋을 다시 셈 · 4바이트 맞춤). 원본은 안 건드린다(out 이 있으면 안 돈다)."""
import sys, io, os, json, struct
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from PIL import Image

def read_glb(path):
    b = open(path, 'rb').read(); assert b[:4] == b'glTF'
    off = 12; js = None; bin_ = None
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off); off += 8
        ch = b[off:off + ln]; off += ln
        if ty == 0x4E4F534A: js = json.loads(ch)
        elif ty == 0x004E4942: bin_ = bytes(ch)
    return js, bin_

def write_glb(path, js, views):
    """views: bufferView 마다 bytes(차례 그대로) — 오프셋을 다시 매겨 BIN 하나로 묶는다"""
    out = bytearray()
    for i, data in enumerate(views):
        while len(out) % 4: out += b'\0'
        js['bufferViews'][i]['byteOffset'] = len(out); js['bufferViews'][i]['byteLength'] = len(data)
        out += data
    while len(out) % 4: out += b'\0'
    js['buffers'][0]['byteLength'] = len(out)
    jb = json.dumps(js, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    while len(jb) % 4: jb += b' '
    total = 12 + 8 + len(jb) + 8 + len(out)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A)); f.write(jb)
        f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)

def lift(img, gamma, satk=1.0, hue_deg=0.0):
    hsv = np.asarray(img.convert('HSV')).astype(np.float64) / 255.0
    hsv[..., 2] = np.power(hsv[..., 2], gamma)
    if satk != 1.0: hsv[..., 1] = np.clip(hsv[..., 1] * satk, 0, 1)
    if hue_deg: hsv[..., 0] = (hsv[..., 0] + hue_deg / 360.0) % 1.0
    return Image.fromarray((hsv * 255).clip(0, 255).astype(np.uint8), 'HSV').convert('RGB')

if __name__ == '__main__':
    flags = [a for a in sys.argv[1:] if a.startswith('--')]; argv = [a for a in sys.argv[1:] if not a.startswith('--')]
    src, dst, gamma = argv[0], argv[1], float(argv[2]); satk = float(argv[3]) if len(argv) > 3 else 1.0; hue = float(argv[4]) if len(argv) > 4 else 0.0
    TMAX = next((int(f[6:]) for f in flags if f.startswith('--max=')), 0)   # --max=1024 — 텍스처 긴 변을 이만큼으로(옛 잎이 1024 JPEG)
    if os.path.exists(dst): print('⛔ 이미 있다', dst); sys.exit(2)
    js, b = read_glb(src)
    views = [b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']] for v in js['bufferViews']]
    # 밑색 텍스처의 이미지만 바꾼다
    srcs = set()
    for mt in js.get('materials') or []:
        bc = (mt.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
        if bc is not None: srcs.add(js['textures'][bc['index']]['source'])
    for si in sorted(srcs):
        im = js['images'][si]; vi = im['bufferView']
        pil = Image.open(io.BytesIO(views[vi]))
        mode_alpha = pil.mode in ('RGBA', 'LA')
        rgb = lift(pil.convert('RGB'), gamma, satk, hue)
        if TMAX and max(rgb.size) > TMAX: rgb = rgb.resize((TMAX, TMAX * rgb.size[1] // rgb.size[0]), Image.LANCZOS); pil = pil.resize(rgb.size, Image.LANCZOS)
        bio = io.BytesIO()
        if mode_alpha:
            out = rgb.convert('RGBA'); out.putalpha(pil.getchannel('A')); out.save(bio, 'PNG'); im['mimeType'] = 'image/png'
        elif im.get('mimeType') == 'image/jpeg':
            rgb.save(bio, 'JPEG', quality=92)
        else:
            rgb.save(bio, 'PNG'); im['mimeType'] = 'image/png'
        views[vi] = bio.getvalue()
        print(f'이미지 {si}: {pil.size} {pil.mode} → γ{gamma} 채도×{satk} 색상{hue:+}° · {len(views[vi])}B')
    write_glb(dst, js, views)
    print('★', dst, os.path.getsize(dst))
