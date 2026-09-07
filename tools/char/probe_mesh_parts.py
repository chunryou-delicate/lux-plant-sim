# -*- coding: utf-8 -*-
"""캐릭터 GLB 가 **몇 덩이로 갈려 있나**를 잰다 — 옷을 갈아입힐 수 있나의 답.

2026-09-07 · [Char] · 크레딧 0

■ 왜

총괄 물음: 「옷이 «구워져» 있습니까, «따로» 있습니까」
⇒ 몸/옷/머리가 갈린 덩이면 옷만 바꿔 낄 수 있다. 한 덩이면 못 한다.

■ ⛔ 이 자가 «못» 하는 것

  · 「이 덩이가 «옷»인가」는 못 정한다. **이름과 수만 낸다.** 이름이 Wolf3D_Outfit_Top
    이면 사람이 「옷이구나」 하는 것이지 자가 아는 게 아니다
  · 재질이 «몇 가지 색을 지는지»는 못 잰다. 텍스처 그림을 봐야 안다
"""
import io, json, os, struct, sys, glob
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

def gltf_json(path):
    with open(path, 'rb') as f:
        magic, ver, total = struct.unpack('<4sII', f.read(12))
        if magic != b'glTF': raise ValueError('glTF 가 아니다: ' + path)
        while f.tell() < total:
            ln, kind = struct.unpack('<I4s', f.read(8))
            data = f.read(ln)
            if kind == b'JSON': return json.loads(data.decode('utf-8'))
    raise ValueError('JSON 청크가 없다')

def probe(path):
    g = gltf_json(path)
    meshes = g.get('meshes', [])
    mats = g.get('materials', [])
    skins = g.get('skins', [])
    imgs = g.get('images', [])
    prims = sum(len(m.get('primitives', [])) for m in meshes)
    print('■ %s' % os.path.basename(path))
    print('  메시 덩이 %d · 프리미티브 %d · 재질 %d · 스킨 %d · 그림 %d'
          % (len(meshes), prims, len(mats), len(skins), len(imgs)))
    for i, m in enumerate(meshes):
        nm = m.get('name', '(이름없음)')
        pm = []
        for p in m.get('primitives', []):
            mi = p.get('material')
            pm.append(mats[mi].get('name', '#%d' % mi) if (mi is not None and mi < len(mats)) else '(재질없음)')
        print('    [%d] %-28s ← 재질 %s' % (i, nm, ', '.join(pm) or '-'))
    if len(meshes) == 1 and prims == 1:
        print('  ⇒ ⛔ **한 덩이 · 한 재질** — 옷을 «따로» 못 벗긴다')
    elif prims > 1:
        print('  ⇒ ★ **%d 조각**으로 갈려 있다 — 조각별로 손댈 수 있다' % prims)
    return dict(meshes=len(meshes), prims=prims, mats=len(mats), skins=len(skins))

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    paths = []
    for a in (args or ['assets/characters/3d/*_rigged.glb']):
        paths += sorted(glob.glob(a)) if ('*' in a or '?' in a) else [a]
    rows = []
    for p in paths:
        try: rows.append((p, probe(p)))
        except Exception as e: print('  ✗ %s: %s' % (p, e))
    if len(rows) > 1:
        kinds = set((r[1]['meshes'], r[1]['prims'], r[1]['mats']) for r in rows)
        print('\n★ %d개 중 «꼴»이 %d가지' % (len(rows), len(kinds)))
        if len(kinds) == 1:
            print('  ⇒ 전부 같은 꼴이다: 메시 %d · 조각 %d · 재질 %d' % list(kinds)[0])
        else:
            for k in sorted(kinds): print('  · 메시 %d · 조각 %d · 재질 %d' % k)
