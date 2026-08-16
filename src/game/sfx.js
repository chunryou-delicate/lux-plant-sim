/* ============================================================
   game/sfx.js — 효과음 (2026-08-16 신설)
   ------------------------------------------------------------
   박사님: "버튼 누를 때나 창 열릴 때 대사 넘길 때 (탭할 때) **딸칵** 효과음 좀 들리게 해 줄래?
            그리고 심을 때 수확할 때 등 게이지 찰 때 **사각사각** …
            물 뿌릴 때는 **물 뿌리는** 비슷한 소리 … 이동할 때 **저벅저벅** …
            뭐 줄 때(몬스테라 등) 또는 이벤트 발생 시 **띠로롱** 같이 …
            인벤에서 화면으로 뭔가 배치하거나 … 둘 때 **턱** 하는 효과음도"

   ⇒ 여섯이다: 딸칵 · 사각사각 · 물 · 저벅저벅 · 띠로롱 · 턱

   ★★ 왜 음원 파일이 아니라 **합성**인가 — music.js 와 같은 근거 셋에 하나가 더 붙는다.
     ① **받을 바이트가 0 이다.** 이 저장소는 방금 428MB 를 줄인 참이다. 효과음 여섯을
        wav 로 받으면 짧아도 200~600KB 이고, 그건 첫 화면이 뜨는 시간을 그만큼 늦춘다.
     ② **로딩이 없다.** 파일이면 「아직 안 받아졌을 때 누르면 소리가 안 난다」는 구간이
        반드시 생긴다. 합성은 부르는 순간 그 자리에서 만들어진다.
     ③ **저작권을 확인할 데가 없다.** 이 환경은 오프라인일 수 있다.
     ④ ★ **같은 소리를 조금씩 다르게 낼 수 있다.** 발소리·사각사각처럼 되풀이되는 것은
        매번 똑같으면 기계 소리로 들린다. 잡음 버퍼에서 읽는 자리를 옮기는 것만으로
        결이 달라진다 — 파일로는 못 하는 일이다.

   ★ 이 파일은 THREE 도 DOM 도 모른다. `AudioContext` 하나만 받는다 —
     그래서 `OfflineAudioContext` 로 렌더해 **소리가 실제로 실렸는지 숫자로 잰다**
     (tools/test_sfx.mjs). 귀로 확인 못 하는 것을 숫자로 확인한다.

   ★ 들어 보려면 — `docs/sfx.html` 을 열면 여섯을 하나씩 눌러 볼 수 있다.
============================================================ */

/* ============================================================
   ① 표 — 여섯 소리를 **왜 그렇게 정했나**
   ------------------------------------------------------------
   ⚠ 이 표는 주석이 아니라 **값의 정본**이다. 아래 목소리 함수들이 이 상수를 읽는다.
     숫자를 두 곳에 두면 반드시 한쪽이 낡는다(START-HERE §2.6 이 겪은 그것이다).

   ⚠⚠ **길이가 둘이다.** 헷갈리면 「표가 거짓말한다」가 된다:
     · **예약** — 그래프에 걸어 둔 길이(`dur`). 오실레이터를 언제 멈추는가.
     · **들림** — 실제로 귀에 닿는 길이. 지수 감쇠라 예약보다 짧다.
       tools/test_sfx.mjs 가 **최댓값의 0.3%(≈−50dB) 를 넘는 구간**으로 잰 값이다.
     아래 표의 「들림·최대·RMS」는 **2026-08-16 에 실제로 렌더해서 잰 것**이다. 짐작이 아니다.

   | 이름       | 파형                          | 예약 | 들림 | 최대 | RMS | 왜 그렇게 |
   |------------|-------------------------------|------|------|------|-----|-----------|
   | 딸칵 tap   | 밴드패스 잡음(2.2kHz) + 삼각파 틱 1900→950Hz | 95ms | 32ms | 0.254 | 0.0066 | 진짜 딸칵은 **넓은 띠의 순간음**이다. 사인만 쓰면 「삐」가 되고 잡음만 쓰면 「치익」이 된다. 둘을 겹쳐야 플라스틱 단추가 된다. ⚠ 들림이 30ms 대라야 한다 — 그보다 길면 대사를 빨리 넘길 때 「딸-깍」이 겹쳐 들린다 |
   | 사각사각 scrape | 밴드패스 잡음(1.7/1.45kHz) **두 덩이** | 245ms | 203ms | 0.119 | 0.0044 | 스치는 소리는 1~3kHz 잡음이다. 덩이를 **둘** 두는 것이 핵심 — 하나면 「슥」이고 둘이라야 「사각-사각」이다. 되풀이되는 소리라 **일부러 제일 여리게** 뒀다(RMS 가 여섯 중 최소) |
   | 물 water   | 중심이 800→2600Hz 로 오르는 잡음 + 물방울 셋 | 520ms | 402ms | 0.176 | 0.0122 | 뿌리는 소리는 **밝아지는 쉭** 이다(입자가 퍼지며 고음이 는다). 그것만이면 바람이라, 짧은 사인 물방울 셋을 얹어야 「물」로 읽힌다 |
   | 저벅 step  | 사인 132/118→50Hz + 로우패스(520Hz) 잡음 | 140ms | 65ms | 0.307 | 0.0154 | 발소리는 **몸이 닿는 둔탁함**(저음) + **바닥을 쓰는 소리**(눌린 잡음)다. 사인만이면 북이 된다. 좌우 발을 14Hz 다르게 낸다 — 같으면 기계다. 걷는 동안 420ms 마다, **멈추면 멈춘다** |
   | 띠로롱 chime | 5음 아르페지오 A4·C5·E5·A5 (삼각+옥타브 사인) | 585ms | 461ms | 0.204 | 0.0235 | **배경 음악과 안 부딪히게** music.js 가 쓰는 5음 음계(A C D E G)에서 뽑았다. 75ms 간격으로 올라가 「좋은 일」로 읽힌다. 3화음을 한 번에 쌓으면 씩씩해져 선물의 결이 아니다 |
   | 턱 thud    | 사인 190→58Hz + 로우패스 잡음 + 380Hz 좁은 울림 | 165ms | 78ms | 0.449 | 0.0225 | 「놓았다」는 **질량이 멈추는 소리**다. 저벅보다 높게 시작해 더 낮게 떨어지고 더 세다(0.449 vs 0.307) — 그 차이가 「걷는다」와 「놓았다」를 가른다. 380Hz Q4 울림 하나가 「바닥」이 아니라 「가구 위」로 만든다 |

   ★ 세기를 왜 저렇게 갈랐나 — **한 번 나는 소리는 세게, 되풀이되는 소리는 여리게.**
     딸칵·턱·띠로롱은 사건이라 들려야 하고, 저벅·사각사각은 몇 초씩 이어지므로
     같은 세기로 두면 그것만 들린다. 첫 판은 딸칵이 0.157 로 턱(0.487)의 3분의 1이라
     **단추가 제일 안 들렸다** — 재서 올렸다.
   ★ 감쇠는 전부 **지수**다. 선형으로 떨구면 끝에서 딱 끊겨 '틱' 이 덧난다(music.js §envGain).
============================================================ */
export const SPEC = {
  /* dur 은 **예약 길이**다(들리는 길이가 아니다 — 위 ⚠ 를 보라).
     tools/test_sfx.mjs 가 「들림이 예약을 크게 안 넘나」의 자로만 쓴다. */
  tap:    { ko: '딸칵',     dur: 0.095, throttleMs: 30 },
  scrape: { ko: '사각사각', dur: 0.245, throttleMs: 30, loopMs: 300 },
  /* ★ 물만 삼킴이 길다(600ms). 물주기는 `doAct` 의 `onProgress` 가 **프레임마다** 부르는데
     (room_view §prog(p01,'act')), 삼킴이 짧으면 초당 열몇 번 겹쳐 터진다.
     600ms 로 두면 소리 하나(520ms)가 끝나고 조금 쉬었다가 다시 나서 **뿌리는 동작이
     되풀이되는 것처럼** 들리고, 게이지가 멈추면 그 자리에서 저절로 그친다 —
     따로 끄는 배선이 필요 없다. */
  water:  { ko: '물',       dur: 0.520, throttleMs: 600 },
  step:   { ko: '저벅',     dur: 0.140, throttleMs: 30, loopMs: 420 },
  chime:  { ko: '띠로롱',   dur: 0.585, throttleMs: 80 },
  thud:   { ko: '턱',       dur: 0.165, throttleMs: 40 }
};
export const NAMES = Object.keys(SPEC);

/* ============================================================
   ② 재료 — 잡음 버퍼와 포락선
   ------------------------------------------------------------
   ⚠ 잡음은 **씨앗 난수로** 만든다. `Math.random()` 을 쓰면 같은 소리를 두 번 렌더해도
     파형이 달라져 **검사가 스스로 재현이 안 된다.** music.js 가 이미 그것으로 한 번
     데었다(probe_music §hat 주석). 소리는 똑같이 들리지만, 재현되지 않는 검사는
     무언가 깨졌을 때 그게 내 탓인지 잡음 탓인지 못 가린다.
============================================================ */
function rngOf(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/* 1초짜리 잡음을 **컨텍스트마다 한 번만** 만들어 돌려 쓴다.
   ★ 되풀이되는 소리(발소리·사각사각)는 읽는 자리(`off`)를 옮겨 결을 바꾼다 —
     같은 자리를 계속 읽으면 발소리가 기계처럼 똑같아진다. */
const NOISE_SEC = 1.0;
const noiseCache = new WeakMap();
function noiseBuf(ctx) {
  let b = noiseCache.get(ctx);
  if (b) return b;
  const rng = rngOf(20260816);
  b = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * NOISE_SEC)), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
  noiseCache.set(ctx, b);
  return b;
}

/* 포락선 하나. 지수로 떨군다 — 0 에서 시작하면 지수 램프가 영영 안 올라오므로 0.0001 에서 뜬다 */
function envGain(ctx, at, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + Math.max(attack, 0.001));
  g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(attack, 0.001) + Math.max(decay, 0.005));
  return g;
}

/* 눌린 잡음 한 덩이. `off` 는 1초 버퍼에서 읽기 시작하는 자리(0~0.9) */
function noiseHit(ctx, dest, at, { peak, attack, decay, type = 'bandpass', hz, q = 1, sweepTo = 0, off = 0, dur }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(hz, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + (dur || (attack + decay)));
  f.Q.value = q;
  const g = envGain(ctx, at, peak, attack, decay);
  src.connect(f).connect(g).connect(dest);
  const len = dur || (attack + decay + 0.02);
  src.start(at, Math.min(Math.max(off, 0), NOISE_SEC - len - 0.01), len);
  src.stop(at + len);
}

/* 음 하나 */
function tone(ctx, dest, at, { hz, to = 0, type = 'triangle', peak, attack, decay }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(hz, at);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + Math.max(attack, 0.001) + decay * 0.6);
  const g = envGain(ctx, at, peak, attack, decay);
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + attack + decay + 0.05);
}

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

/* ============================================================
   ③ 여섯 목소리
   ------------------------------------------------------------
   ★ 전부 `(ctx, dest, at, opt)` 를 받는 **순수 함수**다 — 상태가 없다.
     그래서 `OfflineAudioContext` 에 그대로 걸어 파형을 잴 수 있다(tools/test_sfx.mjs).
     상태(연타 삼킴 · 켬/끔 · 되풀이)는 아래 `createSfx` 만 갖는다.
============================================================ */

/* 딸칵 — 단추 · 창 열림 · 대사 넘김 */
function vTap(ctx, dest, at, o = {}) {
  const v = o.gain == null ? 1 : o.gain;
  noiseHit(ctx, dest, at, { peak: 0.52 * v, attack: 0.001, decay: 0.030, hz: 2200, q: 1.2, off: o.off || 0, dur: 0.045 });
  tone(ctx, dest, at, { hz: 1900, to: 950, type: 'triangle', peak: 0.26 * v, attack: 0.002, decay: 0.042 });
}

/* 사각사각 — 게이지가 차는 동안. **두 덩이**라야 「사각-사각」이 된다 */
function vScrape(ctx, dest, at, o = {}) {
  const v = o.gain == null ? 1 : o.gain;
  const off = o.off || 0;
  for (let i = 0; i < 2; i++) {
    noiseHit(ctx, dest, at + i * 0.130, {
      peak: (i ? 0.20 : 0.26) * v, attack: 0.018, decay: 0.085,
      hz: i ? 1450 : 1700, q: 0.9, off: (off + i * 0.17) % 0.8, dur: 0.115
    });
  }
}

/* 물 — 밝아지는 쉭 + 물방울 셋 */
function vWater(ctx, dest, at, o = {}) {
  const v = o.gain == null ? 1 : o.gain;
  noiseHit(ctx, dest, at, {
    peak: 0.40 * v, attack: 0.05, decay: 0.45, hz: 800, sweepTo: 2600, q: 0.7,
    off: o.off || 0.3, dur: 0.52
  });
  const drop = [0.10, 0.24, 0.38], hz = [640, 820, 700];
  for (let i = 0; i < 3; i++)
    tone(ctx, dest, at + drop[i], { hz: hz[i], to: hz[i] * 2.2, type: 'sine', peak: 0.13 * v, attack: 0.004, decay: 0.045 });
}

/* 저벅 — 한 걸음. 걷는 동안 `walk(true)` 가 되풀이한다 */
function vStep(ctx, dest, at, o = {}) {
  const v = o.gain == null ? 1 : o.gain;
  const lo = o.right ? 118 : 132;                       // 좌우 발을 살짝 다르게 — 같으면 기계다
  tone(ctx, dest, at, { hz: lo, to: 50, type: 'sine', peak: 0.34 * v, attack: 0.004, decay: 0.085 });
  noiseHit(ctx, dest, at + 0.004, {
    peak: 0.16 * v, attack: 0.002, decay: 0.048, type: 'lowpass', hz: 520, q: 0.7,
    off: o.off || 0, dur: 0.055
  });
}

/* 띠로롱 — 선물 · 이벤트. music.js 의 5음 음계(A C D E G)에서 뽑아 배경과 안 부딪힌다 */
const CHIME_MIDI = [69, 72, 76, 81];                    // A4 C5 E5 A5
function vChime(ctx, dest, at, o = {}) {
  const v = o.gain == null ? 1 : o.gain;
  for (let i = 0; i < CHIME_MIDI.length; i++) {
    const t = at + i * 0.075;
    tone(ctx, dest, t, { hz: midiHz(CHIME_MIDI[i]), type: 'triangle', peak: 0.16 * v, attack: 0.008, decay: 0.30 });
    tone(ctx, dest, t, { hz: midiHz(CHIME_MIDI[i] + 12), type: 'sine', peak: 0.055 * v, attack: 0.014, decay: 0.22 });
  }
}

/* 턱 — 놓았다. 저벅보다 낮게 시작해 더 빨리 죽고, 좁은 울림 하나가 「가구 위」로 만든다 */
function vThud(ctx, dest, at, o = {}) {
  const v = o.gain == null ? 1 : o.gain;
  tone(ctx, dest, at, { hz: 190, to: 58, type: 'sine', peak: 0.46 * v, attack: 0.003, decay: 0.11 });
  noiseHit(ctx, dest, at, {
    peak: 0.20 * v, attack: 0.001, decay: 0.042, type: 'lowpass', hz: 900, q: 0.5,
    off: o.off || 0.5, dur: 0.05
  });
  noiseHit(ctx, dest, at + 0.006, {
    peak: 0.09 * v, attack: 0.002, decay: 0.085, type: 'bandpass', hz: 380, q: 4,
    off: (o.off || 0.5) + 0.1, dur: 0.10
  });
}

export const VOICES = { tap: vTap, scrape: vScrape, water: vWater, step: vStep, chime: vChime, thud: vThud };

/* ============================================================
   ④ 바깥에서 쓰는 것
   ------------------------------------------------------------
     import { sfx } from './src/game/sfx.js';
     sfx.tap();                 // 딸칵
     sfx.walk(true) / (false);  // 저벅저벅 — ★ 걷는 동안만
     sfx.gauge(true) / (false); // 사각사각 — ★ 차는 동안만
     sfx.setEnabled(false);     // 끈다

   ★★ §자동재생 — 브라우저는 **사용자가 만지기 전에는 소리를 안 내준다.**
     그래서 `AudioContext` 를 미리 만들지 않는다. 만들어 두면 `suspended` 로 태어나고
     그 상태로 굳으면 나중에 눌러도 안 난다(game.html 이 음악에서 이미 겪은 그것이다).
     ⇒ **처음 부르는 순간** 만든다. 딸칵은 언제나 손짓(click/pointerdown) 안에서 불리므로
       그 자리가 곧 「사용자가 만진 순간」이다 — 따로 해금 배선이 필요 없다.
       그래도 `unlock()` 을 열어 둔다(첫 손짓에 미리 깨워 두고 싶을 때).

   ★★ §연타 — 같은 소리가 `throttleMs`(딸칵은 30ms) 안에 또 오면 **삼킨다.**
     안 그러면 대사를 빨리 넘길 때 딸칵이 겹쳐 터져 귀가 아프다.
     ⚠ 시각은 **오디오 시계**(`ctx.currentTime`)로 잰다. `Date.now` 로 재면 본줄기가
       잠깐 막혔다 풀릴 때 쌓였던 손짓이 한꺼번에 배달되면서 전부 통과한다
       (game.html §bindFurnitureTap 이 8.3초짜리로 겪은 그 사고와 같은 결이다).

   ★★ §안 멈춘다 — 바깥 창구는 전부 `try/catch` 안에서 돈다. 소리 하나가 던져도
     게임은 계속 돌아야 한다. 소리는 곁들이지 규칙이 아니다.
============================================================ */
export function createSfx(ctx, opt = {}) {
  if (!ctx || typeof ctx.createGain !== 'function')
    throw new Error('[효과음] AudioContext 가 필요합니다 — 소리를 낼 데가 없습니다');

  const master = ctx.createGain();
  master.gain.value = opt.volume == null ? 0.7 : opt.volume;
  /* 여러 소리가 한 순간에 겹쳐도 안 찢어지게 살짝 눌러 준다(music.js 와 같은 손) */
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 8; comp.attack.value = 0.002; comp.release.value = 0.12;
  master.connect(comp).connect(ctx.destination);

  let enabled = opt.enabled !== false;
  const last = Object.create(null);            // 이름 → 마지막으로 낸 오디오 시각
  let offRot = 0;                              // 잡음 버퍼에서 읽는 자리 — 매번 조금씩 민다

  function fire(name, o = {}) {
    if (!enabled) return false;
    const spec = SPEC[name]; const voice = VOICES[name];
    if (!spec || !voice) return false;
    const now = ctx.currentTime;
    const gap = (spec.throttleMs || 30) / 1000;
    if (!o.force && last[name] != null && now - last[name] < gap) return false;   // ★연타를 삼킨다
    last[name] = now;
    offRot = (offRot + 0.137) % 0.8;
    /* 지금 시각에 딱 걸면 이미 지나간 시각이 되어 첫 밀리초가 잘린다 — 아주 조금 뒤에 건다 */
    voice(ctx, master, now + 0.005, { off: offRot, ...o });
    return true;
  }

  /* ── 되풀이(저벅저벅 · 사각사각) ────────────────────────────────
     ⚠ `requestAnimationFrame` 을 안 쓴다 — 이 게임은 **바뀔 때만 그린다**(room_view 의
       needsRender). 걷는 동안 화면이 안 바뀌면 rAF 가 안 돌아 발소리가 끊긴다.
       music.js 가 같은 이유로 setInterval 을 쓴다. */
  function looper(name, mkOpt) {
    let timer = null, n = 0;
    return {
      set(on) {
        if (!!on === (timer != null)) return;
        if (on) {
          if (!enabled) return;
          n = 0;
          fire(name, mkOpt(n++));
          if (typeof setInterval === 'function')
            timer = setInterval(() => { try { fire(name, mkOpt(n++)); } catch { } }, SPEC[name].loopMs);
        } else if (timer != null) { clearInterval(timer); timer = null; }
      },
      stop() { if (timer != null) { clearInterval(timer); timer = null; } },
      on: () => timer != null
    };
  }
  const walker = looper('step', n => ({ right: n % 2 === 1 }));
  const gauger = looper('scrape', () => ({}));

  const api = {};
  for (const name of NAMES) api[name] = (o) => { try { return fire(name, o); } catch (e) { console.warn('[효과음]', name, e && e.message); return false; } };

  /* ★ 저벅저벅은 **걷는 동안만.** 멈추면 멈춘다 — `walk(false)` 를 반드시 부르는 쪽이 있어야 한다.
     그 자리는 doAct 의 onProgress/onDone/onFail 이다(docs/handoff/sfx-to-plan.md §붙일 줄). */
  api.walk  = (on) => { try { walker.set(on); } catch (e) { console.warn('[효과음] walk', e && e.message); } };
  api.gauge = (on) => { try { gauger.set(on); } catch (e) { console.warn('[효과음] gauge', e && e.message); } };
  api.isWalking = () => walker.on();
  api.isGauging = () => gauger.on();
  /* 어느 쪽이 끝났는지 모를 때 — 한 방에 조용해진다 */
  api.stopAll = () => { try { walker.stop(); gauger.stop(); } catch { } };

  api.setEnabled = (on) => {
    enabled = !!on;
    if (!enabled) api.stopAll();
    try { master.gain.setValueAtTime(enabled ? (opt.volume == null ? 0.7 : opt.volume) : 0, ctx.currentTime); } catch { }
  };
  api.isEnabled = () => enabled;
  api.setVolume = (v) => { try { master.gain.setValueAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime); } catch { } };
  api.ctx = () => ctx;
  api.dispose = () => { api.stopAll(); try { master.disconnect(); comp.disconnect(); } catch { } };
  return api;
}

/* ============================================================
   ⑤ 게임이 쓰는 하나 — `sfx`
   ------------------------------------------------------------
   ★ **AudioContext 를 미리 안 만든다.** 처음 부를 때(= 손짓 안에서) 만든다.
     그 전까지 모든 창구는 조용한 빈 함수다 — 던지지 않고 아무 일도 안 한다.
   ★ 켬/끔은 **부르는 쪽이 기억한다.** 여기서 localStorage 를 안 읽는다 —
     읽으면 열쇠가 둘이 되고, 그러면 「어느 쪽이 참인가」를 아무도 못 가린다.
     game.html 에 이미 `byeot.music` 이 있으니 그 하나를 정본으로 쓴다
     (근거는 docs/handoff/sfx-to-plan.md §스위치).
============================================================ */
function makeLazy() {
  let real = null, wanted = true, failed = false;
  function get(make) {
    if (real) return real;
    if (failed || !make) return null;
    try {
      const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (!AC) { failed = true; return null; }
      const ctx = new AC();
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      real = createSfx(ctx, { enabled: wanted });
      return real;
    } catch (e) { failed = true; console.warn('[효과음] 소리를 열지 못했습니다 —', e && e.message); return null; }
  }
  const out = {};
  for (const name of NAMES) out[name] = (o) => { const r = get(true); return r ? r[name](o) : false; };
  out.walk  = (on) => { const r = on ? get(true) : real; if (r) r.walk(on); };
  out.gauge = (on) => { const r = on ? get(true) : real; if (r) r.gauge(on); };
  out.stopAll = () => { if (real) real.stopAll(); };
  out.setEnabled = (on) => { wanted = !!on; if (real) real.setEnabled(wanted); else if (!wanted) { /* 아직 안 열었다 — 열 때 반영된다 */ } };
  out.isEnabled = () => (real ? real.isEnabled() : wanted);
  /* 첫 손짓에 미리 깨워 두고 싶을 때. 안 불러도 첫 `tap()` 이 같은 일을 한다 */
  out.unlock = () => { const r = get(true); if (r && r.ctx && r.ctx().state === 'suspended') { try { r.ctx().resume(); } catch { } } return !!r; };
  out.isOpen = () => !!real;
  return out;
}
export const sfx = makeLazy();
export default sfx;
