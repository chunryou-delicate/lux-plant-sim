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

/* ★★ 뒤쪽(반사광) 배율 — **직광보다 훨씬 약하다** (2026-08-06 박사님 확정 · §ppfdSum).
   실내 반사광은 재질에 따라 대략 직광의 5~20% 다(밝은 벽지가 위쪽, 어두운 벽이 아래쪽).
   반지하는 벽이 밝은 크림색이라 그 범위의 위쪽을 쓴다.
   ⚠ 이 값이 곧 **창턱이 등에서 받는 몫**이다 — 창턱이 두 등보다 0.56m 위에 있어서
     지금 그 자리에 가는 빛은 전부 반사광이다. 값을 바꾸면 창턱 DLI 가 바로 따라 움직인다.
   ⚠ **자르지 마라(0).** 자르면 현실이 아니라 계산 편의가 되고, 방이 반사광으로 밝다는
     사실이 게임에서 사라진다. 대신 **겨누면 직광이 된다**는 것이 이 설계의 답이다. */
export const BACK_REFLECT = 0.18;

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

   ★★ **뒤쪽은 반사광이다 — 0 이 아니고, 대신 아주 약하다** (2026-08-06 박사님 확정).
      원문: *"반사광도 OK인데 반사광은 좀 많이 약하게 해 주고 밑은 세고,
             근데 대가리를 식물 바라보게 하면 직광 아닌가"*

      ⚠ 왜 이 문제가 생겼나 — `banjiha-sill:0` 은 두 식물등보다 **0.56m 위**에 있다.
        옛 식은 `Math.abs(dy)` 라 등이 자기 **위쪽도 똑같이** 비췄고, 창턱의 등 PPFD 42.62 가
        전부 거기서 나온다. 등이 아래에서 위로 쏘아 준 값이라는 뜻이다.
      ⇒ 그렇다고 0 으로 자르면 그것도 거짓말이다. 현실에서 방은 **반사광**으로 밝다 —
        천장·벽·바닥이 되쏘아 광원 뒤쪽도 어느 정도 밝다. 다만 **직광보다 훨씬 약하다.**
      ⇒ 그래서 뒤쪽은 `BACK_REFLECT` 배로 준다. 자르지도 않고 그대로 두지도 않는다.

      ★★ **겨누면 직광이 된다.** 등 머리를 그 자리로 돌리면 `along > 0` 이 되어
        반사광 계수가 안 걸리고 온전한 세기가 간다 — 박사님 말씀 그대로다.
        ⇒ 창턱을 밝히고 싶으면 **집게등을 창턱 쪽으로 겨누면 된다.** 멀리서 쏴도 된다.
          그것이 "빛의 자리"를 고르는 일이고, 이 게임이 가르치려는 것과 같은 결이다.
      ⚠ 이 값은 **안 겨눈 등에도 걸린다.** 그래서 창턱의 등 몫이 줄어든다 —
        얼마나 줄고 그때 무엇을 해야 하는지는 아래 상수 주석에 잰 값으로 적었다. */
export function ppfdSum(list, pt){
  let sum=0;
  for(const it of list){
    if(it.on===false) continue;
    const p=it.pos||{x:0,y:0,z:0};
    const a=it.aim||AIM_DOWN;
    const vx=(pt.x??0)-(p.x??0), vy=(pt.y??0)-(p.y??0), vz=(pt.z??0)-(p.z??0);
    const along=vx*a.x + vy*a.y + vz*a.z;             // 광축 방향으로 얼마나 갔나
    /* 뒤쪽 = 반사광. 0 이 아니라 아주 약하다(위 ★★). 겨누면 직광이 되어 안 걸린다. */
    const back = along<=0;
    const px=vx-along*a.x, py=vy-along*a.y, pz=vz-along*a.z;
    const off=Math.hypot(px, py, pz);                 // 광축에서 옆으로
    const dist=Math.hypot(along, off);
    /* ★ 뒤쪽은 **광축에서 벗어난 각도로 또 깎지 않는다** — 반사광에는 광축이 없다.
       방 전체가 되쏘는 것이라 방향이 아니라 거리만 남는다. off=0 으로 넘겨 역제곱만 태운다. */
    sum += back ? ppfdAt(it.fx, dist, 0, it.spec) * BACK_REFLECT
                : ppfdAt(it.fx, dist, off, it.spec);
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
