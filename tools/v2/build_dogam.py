#!/usr/bin/env python3
"""빛식물 도감 — docs/dogam/data_*.json + gaps.json 을 한 장짜리 HTML(썸네일은 data URI)로 굽는다.
쓰기: python tools/v2/build_dogam.py  → docs/dogam/index.html"""
import base64, html, io, json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
D = os.path.join(ROOT, 'docs', 'dogam')
ORDER = ['characters', 'plants', 'house', 'items']
DOMAIN_KO = {'characters': '캐릭터·옷·머리', 'plants': '식물', 'house': '집·가구', 'items': '물건·그림'}
STATUS = [('v2', '새로 만듦'), ('ok', '쓰는 중'), ('old', '옛 모양'), ('unused', '안 씀'), ('missing', '없음')]
SK = dict(STATUS)


def esc(s):
    return html.escape(str(s if s is not None else ''), quote=True)


def data_uri(rel):
    if not rel:
        return None
    p = rel if os.path.isabs(rel) else os.path.join(D, rel)
    if not os.path.isfile(p):
        p2 = os.path.join(ROOT, rel)
        if not os.path.isfile(p2):
            return None
        p = p2
    ext = os.path.splitext(p)[1].lower().lstrip('.')
    mime = {'webp': 'image/webp', 'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg'}.get(ext)
    if not mime:
        return None
    b = open(p, 'rb').read()
    if len(b) > 120_000:          # 썸네일이 아닌 큰 그림이 섞이면 줄인다
        try:
            from PIL import Image
            im = Image.open(io.BytesIO(b)).convert('RGB'); im.thumbnail((220, 220))
            buf = io.BytesIO(); im.save(buf, 'WEBP', quality=78); b = buf.getvalue(); mime = 'image/webp'
        except Exception:
            return None
    return f'data:{mime};base64,' + base64.b64encode(b).decode()


def load():
    doms = []
    for k in ORDER:
        p = os.path.join(D, f'data_{k}.json')
        if os.path.isfile(p):
            doms.append(json.load(open(p, encoding='utf-8')))
    gaps = None
    gp = os.path.join(D, 'gaps.json')
    if os.path.isfile(gp):
        gaps = json.load(open(gp, encoding='utf-8'))
    return doms, gaps


CSS = r"""
:root{--ground:#ebe9e3;--surface:#f8f7f3;--tile:#2a2723;--ink:#24211d;--muted:#6b665d;--line:#d6d2c8;
 --amber:#b87a22;--amber-bg:#f3e3c4;--leaf:#2f7446;--leaf-bg:#dcebdd;--coral:#b44a36;--coral-bg:#f5ddd6;--grey-bg:#e2e0da;
 color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#1b1a17;--surface:#24221e;--tile:#141310;--ink:#ece8df;--muted:#a39d91;--line:#3a3731;
 --amber:#e3ab52;--amber-bg:#3d3120;--leaf:#86c496;--leaf-bg:#213428;--coral:#ea8a72;--coral-bg:#3d2520;--grey-bg:#2e2c27;color-scheme:dark}}
:root[data-theme="dark"]{--ground:#1b1a17;--surface:#24221e;--tile:#141310;--ink:#ece8df;--muted:#a39d91;--line:#3a3731;
 --amber:#e3ab52;--amber-bg:#3d3120;--leaf:#86c496;--leaf-bg:#213428;--coral:#ea8a72;--coral-bg:#3d2520;--grey-bg:#2e2c27;color-scheme:dark}
body{background:var(--ground);color:var(--ink);font:15px/1.6 "IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding-inline:18px;padding-block:28px 72px;display:grid;gap:34px}
h1,h2,h3{font-family:"Do Hyeon","IBM Plex Sans KR","Malgun Gothic",sans-serif;font-weight:400;margin:0;text-wrap:balance;letter-spacing:.01em}
h1{font-size:2.3rem;line-height:1.15}
h2{font-size:1.6rem;line-height:1.2}
h3{font-size:1.15rem;line-height:1.3}
.lede{margin:6px 0 0;color:var(--muted);max-width:68ch}
.mono{font-family:"IBM Plex Mono",ui-monospace,Consolas,monospace;font-size:.72rem;color:var(--muted);word-break:break-all}
header{display:grid;gap:14px}
.tally{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 11px;font-size:.8rem;font-variant-numeric:tabular-nums;white-space:nowrap;border:1px solid transparent}
.s-v2{background:var(--leaf-bg);color:var(--leaf)} .s-ok{background:var(--grey-bg);color:var(--ink)}
.s-old{background:var(--amber-bg);color:var(--amber)} .s-unused{background:transparent;color:var(--muted);border-color:var(--line);border-style:dashed}
.s-missing{background:var(--coral-bg);color:var(--coral)}
.filters{display:flex;flex-wrap:wrap;gap:8px;position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--ground);padding-block:10px;border-bottom:1px solid var(--line)}
.filters button{font:inherit;font-size:.85rem;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:4px 13px;cursor:pointer}
.filters button[aria-pressed="true"]{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.filters button:focus-visible,.nav a:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
.nav{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.9rem}
.nav a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--line)}
.gaps{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:20px;display:grid;gap:14px}
.gaps ol{margin:0;padding-left:1.6em;display:grid;gap:12px}
.gaps li{padding-left:4px}
.gaps .gt{font-weight:600}
.gaps .gw{color:var(--muted);font-size:.9rem}
.gaps .gm{font-size:.88rem}
.gaps .gc{font-size:.8rem;color:var(--amber);font-variant-numeric:tabular-nums}
.domain{display:grid;gap:22px;scroll-margin-top:64px}
.dhead{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px 16px;border-bottom:2px solid var(--ink);padding-bottom:8px}
.sec{display:grid;gap:10px}
.sec .note{color:var(--muted);font-size:.9rem;margin:0;max-width:72ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow:hidden;display:grid;grid-template-rows:auto 1fr}
.card.st-missing{border-color:var(--coral)}
.thumb{aspect-ratio:1/1;max-width:100%;background:var(--tile);display:grid;place-items:center;overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:contain}
.thumb .none{color:#8f887b;font-size:.8rem;text-align:center;padding:10px}
.meta{padding:9px 10px 11px;display:grid;gap:5px;align-content:start}
.nm{font-size:.9rem;font-weight:600;line-height:1.35}
.nt{font-size:.78rem;color:var(--muted);line-height:1.45}
.row{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.use{font-size:.72rem;color:var(--muted)}
.empty{color:var(--muted);font-size:.9rem}
@media (max-width:520px){h1{font-size:1.8rem}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (prefers-reduced-motion:no-preference){.card{transition:transform .15s ease}.card:hover{transform:translateY(-2px)}}
"""

JS = r"""
(function(){
  const btns=[...document.querySelectorAll('.filters button')];
  function apply(f){
    btns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.f===f)));
    document.querySelectorAll('.card').forEach(c=>{c.hidden=!(f==='all'||c.dataset.s===f)});
    document.querySelectorAll('.sec').forEach(s=>{const any=[...s.querySelectorAll('.card')].some(c=>!c.hidden);s.hidden=!any});
    try{localStorage.setItem('dogam.f',f)}catch(e){}
  }
  btns.forEach(b=>b.addEventListener('click',()=>apply(b.dataset.f)));
  let f='all';try{f=localStorage.getItem('dogam.f')||'all'}catch(e){}
  if(!btns.some(b=>b.dataset.f===f))f='all';
  apply(f);
})();
"""


def build():
    doms, gaps = load()
    total = {k: 0 for k, _ in STATUS}
    per = {}
    for d in doms:
        c = {k: 0 for k, _ in STATUS}
        for s in d.get('sections', []):
            for it in s.get('items', []):
                st = it.get('status') if it.get('status') in SK else 'ok'
                c[st] += 1; total[st] += 1
        per[d.get('domain')] = c
    n_all = sum(total.values())
    out = []
    out.append('<title>빛식물 도감</title>')
    out.append('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>')
    out.append('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Do+Hyeon&family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans+KR:wght@400;600&display=swap">')
    out.append(f'<style>{CSS}</style>')
    out.append('<div class="wrap">')
    out.append('<header><div><h1>빛식물 도감</h1>'
               f'<p class="lede">게임에 들어간 캐릭터·식물·가구·물건을 한 장에 모았습니다. 칸마다 지금 상태를 붙였고, 맨 앞은 이번에 새로 만든 캐릭터·옷·머리입니다. 모두 {n_all}칸.</p></div>')
    out.append('<div class="tally">' + ''.join(f'<span class="chip s-{k}">{esc(lab)} {total[k]}</span>' for k, lab in STATUS) + '</div>')
    out.append('<nav class="nav" aria-label="구역">' + ''.join(
        f'<a href="#{esc(d.get("domain"))}">{esc(DOMAIN_KO.get(d.get("domain"), d.get("domain")))}</a>' for d in doms)
        + ('<a href="#gaps">부족한 것</a>' if gaps else '') + '</nav></header>')
    out.append('<div class="filters" role="group" aria-label="상태로 거르기">'
               '<button id="f-all" data-f="all" aria-pressed="true">전부</button>'
               + ''.join(f'<button id="f-{k}" data-f="{k}" aria-pressed="false">{esc(lab)}</button>' for k, lab in STATUS) + '</div>')
    def domain_block(d):
        dk = d.get('domain')
        c = per.get(dk, {})
        out.append(f'<section class="domain" id="{esc(dk)}"><div class="dhead"><h2>{esc(DOMAIN_KO.get(dk, dk))}</h2>'
                   + ''.join(f'<span class="chip s-{k}">{esc(lab)} {c.get(k,0)}</span>' for k, lab in STATUS if c.get(k)) + '</div>')
        for s in d.get('sections', []):
            items = s.get('items', [])
            out.append(f'<div class="sec"><h3>{esc(s.get("title_ko"))} <span class="mono">· {len(items)}</span></h3>')
            if s.get('note_ko'):
                out.append(f'<p class="note">{esc(s["note_ko"])}</p>')
            out.append('<div class="grid">')
            for it in items:
                st = it.get('status') if it.get('status') in SK else 'ok'
                uri = data_uri(it.get('thumb'))
                th = (f'<img src="{uri}" alt="{esc(it.get("name_ko"))}" loading="lazy">' if uri
                      else f'<div class="none">{"그림 없음" if st == "missing" else "썸네일 없음"}</div>')
                files = it.get('files') or []
                f0 = esc(os.path.basename(files[0])) if files else ''
                more = f' 외 {len(files)-1}' if len(files) > 1 else ''
                use = '게임에서 씀' if it.get('used_in_game') else '게임에서 안 씀'
                out.append(f'<article class="card st-{st}" data-s="{st}"><div class="thumb">{th}</div><div class="meta">'
                           f'<div class="nm">{esc(it.get("name_ko") or it.get("id"))}</div>'
                           f'<div class="row"><span class="chip s-{st}">{esc(SK[st])}</span><span class="use">{use}</span></div>'
                           + (f'<div class="nt">{esc(it.get("note_ko"))}</div>' if it.get('note_ko') else '')
                           + (f'<div class="mono">{f0}{esc(more)}</div>' if f0 else '')
                           + '</div></article>')
            out.append('</div></div>')
        out.append('</section>')
    def gaps_emit():
        if gaps:
            out.append('<section class="gaps" id="gaps"><h2>부족한 것</h2>')
            if gaps.get('summary_ko'):
                out.append(f'<p class="lede" style="margin:0">{esc(gaps["summary_ko"])}</p>')
            out.append('<ol>')
            for g in gaps.get('top', []):
                out.append(f'<li><div class="gt">{esc(g.get("title_ko"))}</div>'
                       f'<div class="gw">{esc(g.get("why_ko"))}</div>'
                       f'<div class="gm">만들 것 — {esc(g.get("what_to_make_ko"))}</div>'
                       f'<div class="gc">{esc(g.get("cost_ko"))}</div></li>')
            out.append('</ol></section>')
    first = [d for d in doms if d.get('domain') == 'characters']
    rest = [d for d in doms if d.get('domain') != 'characters']
    for d in first: domain_block(d)
    gaps_emit()
    for d in rest: domain_block(d)
    out.append('</div>')
    out.append(f'<script>{JS}</script>')
    html_s = '\n'.join(out)
    op = os.path.join(D, 'index.html')
    open(op, 'w', encoding='utf-8', newline='\n').write(html_s)
    print('✔', op, f'{len(html_s)/1e6:.2f} MB', 'items', n_all, total)


if __name__ == '__main__':
    build()
