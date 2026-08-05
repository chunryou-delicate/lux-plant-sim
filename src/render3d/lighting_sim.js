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

/* ---- ★ 겨누기 (2026-08-06 · docs/growlight_aim.md §2) ----------------------
   등 머리를 좌우(yaw)로 돌리고 위아래(tilt)로 꺾는다. 빛의 축이 따라 움직인다.

     yaw   좌우 회전(도). +y 축(위)에서 내려다볼 때의 방위각
     tilt  똑바로 아래에서 꺾어 올린 각(도). 0 = 수직 아래, 90 = 수평

   ⚠ tilt 는 **0 이 아래**다(하늘에서 재는 천정각이 아니라 바닥에서 재는 각). 등은 아래를
     비추는 물건이라 "안 건드린 상태 = 0" 이 되게 맞춘 것이다 — 기본값이 0 이어야
     겨누지 않은 등이 옛 동작과 같아진다.
   ★ tilt=0 이면 sin(0)=0 · cos(0)=1 이라 결과가 **정확히** (0,-1,0) 이다(부동소수 오차 없음).
     그 정확한 0 이 아래 ppfdSum 의 회귀를 떠받친다. */
export const AIM_DOWN = Object.freeze({ x:0, y:-1, z:0 });

export function aimVector(yaw=0, tilt=0){
  const a=(yaw||0)*Math.PI/180, b=(tilt||0)*Math.PI/180;
  const s=Math.sin(b);
  return { x:s*Math.sin(a), y:-Math.cos(b), z:s*Math.cos(a) };
}

/* ---- ★ 꼬리 (2026-08-06 · docs/growlight_aim.md §3) ------------------------
   옛 곡선은 `t>1` 에서 `(1.15-t)*0.5` 로 꺾여 t=1.15 에 0 이 됐다. 두 가지가 문제였다:
     ① t=1 에서 0.55 → 0.075 로 **뚝 떨어진다**(불연속). 겨누면 그 계단이 방에 보인다
     ② t>1.15 는 **0** 이라 원뿔 밖이 아무것도 못 받는다
   그래서 t>1 을 멱함수 꼬리로 바꾼다. t<=1 은 **글자 그대로 그대로** 둔다 — 회귀를
   "거의"가 아니라 **비트 단위로** 지키기 위해서다(폭 0. 근거는 handoff 문서 표).

     f(t) = 1 - 0.45t²          (t <= 1)   ← 옛 식 그대로
     f(t) = 0.55 · t^(-K)       (t >  1)

   K 는 지어낸 값이 아니라 **t=1 에서 기울기가 이어지게** 푼 것이다:
     왼쪽 기울기 f'(1) = -0.9 ,  오른쪽 f'(1) = -0.55K   ⇒  K = 0.9/0.55 = 1.6363…
   이러면 f 도 f' 도 이어져 눈에 보이는 꺾임이 없다. t→∞ 에서 0 으로 간다. */
export const TAIL_K = 0.9/0.55;                       // ≈1.63636 — C¹ 연속 조건의 해

export function offAxisFalloff(t){
  if(!(t>0)) return 1;
  return t<=1 ? (1-0.45*t*t) : 0.55*Math.pow(t, -TAIL_K);
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
  if(offAxis>0) v *= offAxisFalloff(offAxis/Math.max(0.01,spread));
  const eff=(spec&&spec.par_eff)!=null ? spec.par_eff : 1;
  return Math.max(0, v*eff);
}

/* 여러 기구가 한 지점에 주는 PPFD 합
   fixtures=[{fx, spec, pos:{x,y,z}, on, aim?}]

   ★★ 회귀 — `aim` 이 없거나 (0,-1,0) 이면 옛 식과 **비트 단위로 같다.** 분기가 아니라
      식이 그렇게 되게 짰다. 아래가 그 증명이다(a=(0,-1,0), v=잰점−등):
        along = v·a = -vy
        perp  = v - (v·a)a = (vx-0, vy-(-along), vz-0) = (vx, vy+along, vz)
                vy+along = vy+(-vy) = 0  ← IEEE754 에서 **정확히** 0
        off   = |perp| = hypot(vx, 0, vz) = 옛 hypot(dx, dz)
        dist  = hypot(along, off)        = 옛 hypot(dy, off)   (hypot 은 부호에 무관)
      즉 옛 코드의 두 줄이 일반식의 특수해로 그대로 떨어진다.
      ⚠ dist 를 hypot(vx,vy,vz) 로 구하면 안 된다 — 수학은 같아도 마지막 자리가 갈린다.
        직교 성분 둘로 hypot(along, off) 을 쓰는 쪽이 옛 식과 **같은 연산 순서**다.

   ★★ 「뒤쪽을 안 비춘다」는 **겨눈 등에만** 건다 (`aim` 이 실제로 실린 등).
      ⚠ 이건 편의가 아니라 잰 결과다 — `banjiha-sill:0` 은 두 식물등보다 **0.52m 위**에 있다.
        옛 식은 `Math.abs(dy)` 라 등 위쪽도 똑같이 비췄고, 창턱의 등 PPFD 42.62 가
        전부 거기서 나온다. 겨누지 않은 등에까지 뒤쪽 차단을 걸면 그 42.62 가 0 이 되어
        창턱 DLI 가 6.64 → 4.80 으로 내려앉는다(= 갈라짐 문턱 6.0 아래).
        그래서 **축이 없는 등(안 겨눔)은 옛 대칭 모형 그대로** 두고, 축이 생긴 등만
        원뿔이 된다. 자세한 숫자와 판단 요청은 docs/handoff/lampaim-to-plan.md 에 있다. */
export function ppfdSum(list, pt){
  let sum=0;
  for(const it of list){
    if(it.on===false) continue;
    const p=it.pos||{x:0,y:0,z:0};
    const a=it.aim||AIM_DOWN;
    const vx=(pt.x??0)-(p.x??0), vy=(pt.y??0)-(p.y??0), vz=(pt.z??0)-(p.z??0);
    const along=vx*a.x + vy*a.y + vz*a.z;             // 광축 방향으로 얼마나 갔나
    if(it.aim && along<=0) continue;                  // 겨눈 등은 뒤쪽을 안 비춘다
    const px=vx-along*a.x, py=vy-along*a.y, pz=vz-along*a.z;
    const off=Math.hypot(px, py, pz);                 // 광축에서 옆으로
    const dist=Math.hypot(along, off);
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
