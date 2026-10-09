# -*- coding: utf-8 -*-
"""tools/leaf/web_leaf.py — 받은 잎 GLB(Tripo 등 · PBR 4096)를 «웹 잎 규약»으로 ([leaf] 10-10 · 크레딧 0)
   웹 잎 규약 = 핑크프린세스·알로카시아 잎 그대로: 재질 하나(metallic 0 · roughness 0.8 · doubleSided · OPAQUE) · 밑색 텍스처 하나(1024 JPEG q88 4:4:4)
   · 거칠기·법선 텍스처는 뺀다(웹은 밑색만 쓴다 — 유니티 키트는 원본 PBR 을 따로 쓴다). 메시·UV·정점은 한 바이트도 안 바꾼다.
   쓰기: python tools/leaf/web_leaf.py <in.glb> <out.glb>   (out 이 있으면 안 돈다)"""
import sys, os, io
sys.stdout.reconfigure(encoding='utf-8')
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lift_base import read_glb, write_glb

def web_leaf(src, dst, size=1024):
    js, b = read_glb(src)
    views = [b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']] for v in js['bufferViews']]
    mt = js['materials'][0]; bc = mt['pbrMetallicRoughness']['baseColorTexture']['index']
    img_i = js['textures'][bc]['source']; im = js['images'][img_i]
    pil = Image.open(io.BytesIO(views[im['bufferView']])).convert('RGB')
    if max(pil.size) > size: pil = pil.resize((size, size), Image.LANCZOS)
    bio = io.BytesIO(); pil.save(bio, 'JPEG', quality=88, subsampling=0)
    keep_view = im['bufferView']; views[keep_view] = bio.getvalue()
    drop = {js['images'][i]['bufferView'] for i in range(len(js['images'])) if i != img_i}
    order = [i for i in range(len(js['bufferViews'])) if i not in drop]; remap = {o: n for n, o in enumerate(order)}
    js['bufferViews'] = [js['bufferViews'][i] for i in order]; views = [views[i] for i in order]
    for a in js.get('accessors', []):
        if 'bufferView' in a: a['bufferView'] = remap[a['bufferView']]
    js['images'] = [{'mimeType': 'image/jpeg', 'bufferView': remap[keep_view]}]
    js['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
    js['textures'] = [{'sampler': 0, 'source': 0}]
    js['materials'] = [{'pbrMetallicRoughness': {'baseColorFactor': [1.0, 1.0, 1.0, 1.0], 'metallicFactor': 0.0, 'roughnessFactor': 0.8,
                                                 'baseColorTexture': {'index': 0, 'texCoord': 0}}, 'alphaMode': 'OPAQUE', 'doubleSided': True}]
    for m in js['meshes']:
        for pr in m['primitives']: pr['material'] = 0
    write_glb(dst, js, views)

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    if os.path.exists(dst): print('⛔ 이미 있다', dst); sys.exit(2)
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    web_leaf(src, dst); print('★', dst, os.path.getsize(dst) // 1024, 'KB')
