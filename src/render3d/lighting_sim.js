/* ============================================================
   render3d/lighting_sim.js — 조명 시뮬 (순수 계산, THREE 비의존)
   ------------------------------------------------------------
   게임 메커닉 5종을 데이터로 계산한다:
     ① 전기요금   dailyEnergy()  — W × 시간 → kWh × 단가
     ② 광주기     isOn(), photoperiodScore() — 하루 몇 시간 켜지나
     ③ 스펙트럼   spectrumOf()   — 효율(par_eff) vs 예쁨(beauty) 트레이드오프
     ④ 거리 감쇠  ppfdAt()       — 역제곱 + 반경 밖 감쇠 → '높이 조절'이 스킬이 됨
     ⑤ 밤 연출    (렌더 쪽에서 isOn 결과로 광원 on/off)

   PPFD 단위 µmol/m²/s. 창빛(lx)과는 별개 축이라 lightsToLux()로 환산 제공.
============================================================ */

/* ---- 스펙트럼 정보 (없으면 full 취급) ---- */
export function spectrumOf(LP, id){
  const s=(LP&&LP.spectra)||{};
  return s[id] || s.full || { name_ko:'풀스펙트럼', color:'#fff4e2', par_eff:1, beauty:1 };
}

/* ---- ④ 거리 감쇠: 기준거리 PPFD를 실제 거리로 환산 ----
   dist  = 광원~잎 거리(m)
   반경(coverage_r) 밖으로 벗어나면 옆으로 새는 만큼 추가 감쇠(코사인 근사).
   offAxis = 광축에서 옆으로 벗어난 거리(m) */
export function ppfdAt(fx, dist, offAxis=0, spec){
  if(!fx) return 0;
  const ref=fx.ref_dist_m||0.3, base=fx.ppfd_ref||0;
  const d=Math.max(0.06, dist);                       // 너무 가까우면 발산 방지
  let v = base * (ref*ref)/(d*d);                     // 역제곱
  const r=fx.coverage_r||0.4;
  const spread=r*(d/ref);                             // 거리가 멀수록 퍼짐 반경도 큼
  if(offAxis>0){
    const t=offAxis/Math.max(0.01,spread);
    v *= t<=1 ? (1-0.45*t*t) : Math.max(0, 1.15-t)*0.5;   // 중심 밝고 가장자리 급감
  }
  const eff=(spec&&spec.par_eff)!=null ? spec.par_eff : 1;
  return Math.max(0, v*eff);
}

/* 여러 기구가 한 지점에 주는 PPFD 합 (fixtures=[{fx,spec,pos:{x,y,z},on}]) */
export function ppfdSum(list, pt){
  let sum=0;
  for(const it of list){
    if(it.on===false) continue;
    const p=it.pos||{x:0,y:0,z:0};
    const dy=Math.abs((p.y??0)-(pt.y??0));
    const off=Math.hypot((p.x??0)-(pt.x??0), (p.z??0)-(pt.z??0));
    const dist=Math.hypot(dy, off);
    sum += ppfdAt(it.fx, dist, off, it.spec);
  }
  return sum;
}

/* ---- ② 광주기: 시각 h(0~24)에 켜져 있나 ---- */
export function isOn(sch, hour){
  if(!sch || !sch.hours) return false;
  if(sch.hours>=24) return true;
  const start=sch.on_hour%24, end=(start+sch.hours)%24;
  return (start<end) ? (hour>=start && hour<end) : (hour>=start || hour<end);
}

/* 광주기 적정성 0~1 (식물 요구치 대비). 부족·과다 모두 감점 */
export function photoperiodScore(hours, need){
  if(!need) return 1;
  const {min,best,max}=need;
  if(hours<=0) return 0;
  if(hours<min)  return Math.max(0, hours/min*0.7);
  if(hours<=best) return 0.7+0.3*((hours-min)/Math.max(0.001,best-min));
  if(hours<=max)  return 1-0.25*((hours-best)/Math.max(0.001,max-best));
  return Math.max(0.3, 0.75-0.1*(hours-max));            // 과다 = 스트레스
}

/* ---- ① 전기요금 ---- */
export function dailyEnergy(items, tariff){
  const rate=(tariff&&tariff.krw_per_kwh)||160;
  let wh=0;
  for(const it of items){
    const w=(it.fx&&it.fx.watts)||0;
    wh += w * (it.hours||0);
  }
  const kwh=wh/1000;
  return { kwh:+kwh.toFixed(3), krwDay:Math.round(kwh*rate), krwMonth:Math.round(kwh*rate*30) };
}

/* ---- ③ 예쁨(분위기) 점수: 켜진 기구들의 beauty 가중 평균 ---- */
export function moodScore(items){
  let num=0, den=0;
  for(const it of items){
    if(it.on===false) continue;
    const w=(it.fx&&it.fx.watts)||1;
    num += ((it.spec&&it.spec.beauty)!=null?it.spec.beauty:1)*w; den+=w;
  }
  return den? +(num/den).toFixed(2) : 1;
}

/* PPFD → 대략적 lx (백색광 기준 1 µmol/m²/s ≈ 54 lx). 창빛과 같은 축으로 볼 때만 참고용 */
export function ppfdToLux(ppfd){ return Math.round(ppfd*54); }

/* 방 하나의 조명 요약 — UI 표시용 한 방에 계산 */
export function summarize(items, tariff, needHours, need){
  const en=dailyEnergy(items, tariff);
  return {
    ...en,
    mood: moodScore(items),
    photoScore: +photoperiodScore(needHours, need).toFixed(2),
    growCount: items.filter(i=>i.fx&&i.fx.grow).length,
    totalWatts: items.reduce((s,i)=>s+((i.fx&&i.fx.watts)||0),0)
  };
}
