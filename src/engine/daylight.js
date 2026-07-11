/* ============================================================
   engine/daylight.js — 시간대 → 태양(창 채광용)
   ------------------------------------------------------------
   3D 렌더의 조명·하늘색을 위한 태양 상태. THREE·DOM 없음(순수).
   ※ lighting.js 의 sunState(격자 lx 계산용)와는 별개 목적:
     - daylight(t): 3D 조명 방향(radian)·하늘색·라벨 (보기용)
     - lighting.sunState(t): 조도 격자 계산용 물리량 (판정용)
     STEP4에서 하나로 통합 검토.
   t: 0~100 (12 미만·88 이상 = 밤)
============================================================ */

function hx(h){ h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function mix(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }

export function daylight(t){
  const dayPhase=(t-15)/70, daytime=t>12&&t<88;
  const alt=daytime?Math.sin(Math.max(0,Math.min(1,dayPhase))*Math.PI):0;
  const az=(dayPhase-0.5)*Math.PI*0.85;   // 라디안 (3D 태양 방위)
  let sky,label;
  if(t<12){ sky=hx('#1a2038'); label='한밤'; }
  else if(t<26){ sky=mix(hx('#26304e'),hx('#f0b888'),(t-12)/14); label='새벽'; }
  else if(t<44){ sky=mix(hx('#f0b888'),hx('#bfe0f0'),(t-26)/18); label='아침'; }
  else if(t<58){ sky=hx('#bfe0f0'); label='한낮'; }
  else if(t<74){ sky=mix(hx('#bfe0f0'),hx('#f0b070'),(t-58)/16); label='오후'; }
  else if(t<88){ sky=mix(hx('#f0b070'),hx('#d88a90'),(t-74)/14); label='해질녘'; }
  else{ sky=mix(hx('#d88a90'),hx('#1a2038'),(t-88)/12); label='한밤'; }
  const warm=(t<32||t>68)?Math.min(1,(t<32?(32-t):(t-68))/20):0;
  return { alt, az, sky, label, daytime, intensity:alt, warm };
}
