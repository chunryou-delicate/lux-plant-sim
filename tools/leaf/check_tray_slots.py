# -*- coding: utf-8 -*-
"""tools/leaf/check_tray_slots.py — 재배판 칸이 **두 벌인데 안 어긋나는지** 잰다 (2026-08-23 · leaf)

    python tools/leaf/check_tray_slots.py        (0 = 같다 · 1 = 어긋난다)

⚠ 왜 있나 — `room_view.js` 의 `TRAY_S_SLOTS` 는 주석에 *"manifest 의 slots 12칸을 그대로
  옮긴 것"* 이라 적혀 있다. **옮겨 적은 것은 두 벌이고, 이 저장소에서 두 벌은 반드시 갈린다.**
  삽수 쪽은 `tools/probe_cutjar.mjs` 가 지키는데 **여기는 지키는 자가 없었다.**
  ⇒ 지금은 한 자리도 안 어긋난다. 그 상태를 **자로 굳혀 둔다.**
"""
import json, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
def p(*a): return os.path.join(ROOT, *a)

def code_slots():
    t = io.open(p('src', 'game', 'room_view.js'), encoding='utf-8').read()
    m = re.search(r'const\s+TRAY_S_SLOTS\s*=\s*Object\.freeze\(\[(.*?)\]\)', t, re.S)
    if not m:
        raise SystemExit('★ room_view.js 에서 TRAY_S_SLOTS 를 못 찾았다 — 이름이 바뀌었나')
    out = []
    for x, y, z in re.findall(r'\{\s*x:\s*(-?[\d.]+)\s*,\s*y:\s*(-?[\d.]+)\s*,\s*z:\s*(-?[\d.]+)\s*\}', m.group(1)):
        out.append((round(float(x), 4), round(float(y), 4), round(float(z), 4)))
    return out

def manifest_slots():
    M = json.load(io.open(p('assets', 'manifest.json'), encoding='utf-8'))['items']
    it = next((v for v in M if str(v.get('path', '')).endswith('container_tray_s.glb')), None)
    if not it: raise SystemExit('★ manifest 에 container_tray_s.glb 가 없다')
    return [(round(s['x'], 4), round(s['y'], 4), round(s['z'], 4)) for s in it['slots']]

if __name__ == '__main__':
    c, m = sorted(code_slots()), sorted(manifest_slots())
    print('room_view.js  %2d칸' % len(c))
    print('manifest      %2d칸' % len(m))
    if c == m:
        print('같다 — 두 벌이 한 자리도 안 어긋난다')
        sys.exit(0)
    print('★★ 어긋난다:')
    for a in m:
        if a not in c: print('   manifest 에만 :', a)
    for a in c:
        if a not in m: print('   코드에만      :', a)
    print('⇒ 어느 쪽이 옳은지는 사람이 정한다. 이 자는 「갈렸다」만 말한다.')
    sys.exit(1)
