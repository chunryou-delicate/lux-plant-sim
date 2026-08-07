/* ============================================================
   game/music.js — 배경 음악 (2026-08-04 신설)
   ------------------------------------------------------------
   박사님: "음악도 아무거나좀 넣어줄래? 활기찬걸로."

   ★★ 왜 음원 파일이 아니라 **연주**인가 — 근거 셋.

     ① **받을 바이트가 0 이다.** 이 저장소는 바로 앞에서 물뿌리개 3D(559KB)를 쟀다가
        화면에서 18×24 픽셀로 보이는 것을 확인하고 **안 쓰기로** 했다. 음악은 그보다 무겁다.
        2~3분짜리 배경 음악은 mp3 로도 2~4MB 이고, 폰 회선에서 그건 게임이 뜨는 시간이다.
     ② **박사님이 지금 프레임이 떨어진다고 하셨다.** 그러니 음악이 프레임을 더 먹으면 안 된다.
        오실레이터 몇 개는 오디오 스레드에서 돌아 **메인 스레드를 안 건드린다.**
        ★그래서 `requestAnimationFrame` 을 쓰지 않는다 — 아래 §예약 참고.
     ③ **끝없이 이어진다.** 파일은 이어 붙인 자리가 들리는데, 연주는 이음매가 없고
        마디마다 가락이 조금씩 달라져 오래 틀어 놔도 덜 물린다.

   ★ 이 파일은 THREE 도 DOM 도 모른다. `AudioContext` 하나만 받는다 —
     그래서 `OfflineAudioContext` 로 **소리가 실제로 나는지 검사할 수 있다**
     (tools/probe_music.mjs). 귀로 확인 못 하는 것을 숫자로 확인한다.
============================================================ */

/* ============================================================
   ① 곡 — **서정적인 것** (박사님 2026-08-07: "음악이 구려. 약간 서정적인 음악 스타일로")
   ------------------------------------------------------------
   ★ 2026-08-04 판은 "활기찬 것"이었다(BPM 126 · I-V-vi-IV · 사각파 가락 · 북과 하이햇).
     밝고 굴러가는 곡이라 **반지하에서 혼자 콩나물을 키우는 화면과 안 맞았다.**
     서정으로 가는 길은 넷이고, 넷 다 「덜어내는」 쪽이다:

       ① 느리게      126 → **72**. 한 박이 0.83초라 음 하나하나가 숨을 쉰다
       ② 그늘에서 시작 I-V-vi-IV → **vi-IV-I-V**(Am-F-C-G). 같은 네 화음인데 **시작이 단조**다.
                      밝은 데서 시작해 돌아오는 것과, 그늘에서 시작해 열리는 것은 다른 이야기다
       ③ 북을 뺀다    서정에는 **박을 세어 주는 소리가 없어야 한다.** 북이 있으면 그건 걷는 음악이다
       ④ 파형을 눕힌다 사각파(옛 게임기) → **삼각파·사인**. 가락은 길고 느리게 붙는다

   ★ 가락은 그대로 **5음 음계**에서 뽑는다 — 어느 음을 골라도 화음과 안 부딪혀서
     무작위로 굴려도 틀린 음이 안 나온다. 그게 "매번 조금씩 다른 가락"을 공짜로 만든다.
   ★ 화음에 **9음**을 얹었다. 3화음만 쌓으면 또렷하고 씩씩한데, 9음이 들어가면
     가장자리가 흐려져 서정으로 읽힌다. 5음 음계 안의 음이라 가락과도 안 부딪힌다.
============================================================ */
export const BPM = 72;                  // 숨 쉬는 속도. 60 밑은 처지고 90 위는 다시 걷는 음악이 된다
export const BEAT = 60 / BPM;           // 한 박(초)
export const BAR = BEAT * 4;            // 한 마디 = 4박

/* 화음 넷이 한 바퀴 — **vi-IV-I-V**. 그늘에서 시작해 열린다.
   근음(MIDI)과 그 화음에서 쓸 5음 음계. */
const CHORDS = [
  { root: 45, scale: [57, 60, 62, 64, 67] },   // Am — 여기서 시작한다. 그늘
  { root: 41, scale: [57, 60, 62, 65, 67] },   // F  — 넓어진다
  { root: 48, scale: [59, 60, 62, 64, 67] },   // C  — 잠깐 볕이 든다
  { root: 43, scale: [59, 62, 64, 66, 69] }    // G  — 되돌아가며 여운을 남긴다
];

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

/* 씨앗 있는 난수. ★`Math.random` 을 쓰면 검사가 매번 다른 곡을 재게 되어
   "소리가 나나"를 재현 가능하게 확인할 수 없다. */
function rngOf(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/* ============================================================
   ② 소리 하나하나
   ------------------------------------------------------------
   전부 오실레이터와 짧은 포락선이다. 샘플이 없다 = 받을 것이 없다.
   ★ 모든 음은 `stop()` 시각을 함께 예약한다 — 안 그러면 오실레이터가 쌓여
     시간이 갈수록 소리가 뭉개지고 CPU 를 먹는다.
============================================================ */

/* 포락선 하나. `setValueAtTime` 으로 시작을 못 박고 지수로 떨군다 —
   선형으로 떨구면 끝에서 딱 끊겨 '틱' 소리가 난다. */
function envGain(ctx, at, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

function tone(ctx, dest, { at, hz, dur, type = 'triangle', peak = 0.2, attack = 0.01, detune = 0 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(hz, at);
  if (detune) o.detune.setValueAtTime(detune, at);
  const g = envGain(ctx, at, peak, attack, Math.max(dur - attack, 0.02));
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + dur + 0.05);
}

/* 북 — 사인파의 음을 뚝 떨어뜨리면 '둥' 이 된다. 샘플 없이 나는 소리 중 가장 그럴듯하다. */
function kick(ctx, dest, at) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, at);
  o.frequency.exponentialRampToValueAtTime(45, at + 0.11);
  const g = envGain(ctx, at, 0.5, 0.005, 0.16);
  o.connect(g).connect(dest);
  o.start(at); o.stop(at + 0.3);
}

/* 하이햇 — 짧은 잡음을 높은 쪽만 통과시킨다. 박을 세어 주는 역할이라 아주 작게.
   ⚠ 잡음도 **씨앗 난수로** 만든다. 처음엔 `Math.random()` 을 썼는데,
     그러면 같은 씨앗으로 두 번 렌더해도 파형이 달라져 검사가 스스로 재현이 안 됐다
     (probe_music 의 ⑤가 그걸 잡았다). 소리는 똑같이 들리지만 **재현되지 않는 검사는
     검사가 아니다** — 무언가 깨졌을 때 그게 내 탓인지 잡음 탓인지 못 가린다. */
function hat(ctx, dest, at, rng, peak = 0.055) {
  const n = 0.05, buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * n), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (rng() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
  const g = envGain(ctx, at, peak, 0.002, 0.04);
  src.connect(hp).connect(g).connect(dest);
  src.start(at); src.stop(at + n);
}

/* ============================================================
   ③ 한 마디를 예약한다
   ------------------------------------------------------------
   ★ **미리 예약한다.** 소리를 낼 때 내는 것이 아니라, 오디오 시계 기준으로
     "몇 초 뒤에 울려라"를 걸어 둔다. 그래야 메인 스레드가 잠깐 막혀도(3D 가 그린다)
     박자가 안 밀린다 — 화면이 버벅여도 음악은 안 흔들린다.
============================================================ */
function scheduleBar(ctx, bus, barIndex, rng, intensity) {
  const at0 = bus.startAt + barIndex * BAR;
  const ch = CHORDS[barIndex % CHORDS.length];
  const lively = Math.max(0, Math.min(1, intensity));

  /* 베이스 — **마디에 한 번**, 길게 눕힌다. 8분음으로 통통 튀던 것을 걷어낸 자리다.
     통통 튀는 저음은 그 자체가 박을 세어 주는 소리라 서정이 안 된다.
     반 마디 뒤 5도를 아주 여리게 하나만 얹어 바닥이 죽지 않게 한다. */
  tone(ctx, bus.bass, { at: at0, hz: midiHz(ch.root), dur: BAR * 0.92,
                        type: 'triangle', peak: 0.26, attack: 0.06 });
  tone(ctx, bus.bass, { at: at0 + BEAT * 2, hz: midiHz(ch.root + 7), dur: BAR * 0.42,
                        type: 'triangle', peak: 0.10, attack: 0.08 });

  /* 화음 깔개 — **이 곡의 몸통**이다. 예전엔 "있는 줄 모르는" 크기였는데,
     북을 뺀 자리를 이것이 메운다. 천천히 붙고 천천히 사라진다(attack 0.9초).
     9음(+14)을 얹어 가장자리를 흐린다 — 3화음만 쌓으면 또렷하고 씩씩해진다. */
  for (const iv of [0, 7, 12, 14, 19]) {
    tone(ctx, bus.pad, { at: at0, hz: midiHz(ch.root + 12 + iv), dur: BAR * 1.15,
                         type: 'sine', peak: iv >= 14 ? 0.045 : 0.075, attack: 0.9 });
  }

  /* 가락 — 5음 음계에서 뽑되 **4분음**으로 성기게. 예전엔 8분음이라 조급했다.
     ★ 쉬는 자리가 노래를 만든다. 한 마디 네 자리 중 한둘만 울린다.
     ⚠ `lively`(intensity)는 그대로 쓰되 폭을 좁혔다 — 최대로 올려도 촘촘해지지 않는다.
       서정은 밀도가 아니라 여백이라, 활기 손잡이가 그 성격을 뒤집으면 안 된다. */
  for (let i = 0; i < 4; i++) {
    if (i !== 0 && rng() > 0.30 + 0.18 * lively) continue;
    const at = at0 + i * BEAT;
    const m = ch.scale[Math.floor(rng() * ch.scale.length)] + (rng() < 0.30 ? 12 : 0);
    /* 삼각파 하나 + 한 옥타브 위 사인을 아주 여리게 — 사각파의 각을 지운다.
       길게(1.6박) 끌어 다음 음과 살짝 겹치게 두면 이어져 들린다. */
    tone(ctx, bus.lead, { at, hz: midiHz(m), dur: BEAT * 1.6,
                          type: 'triangle', peak: 0.085, attack: 0.10 });
    tone(ctx, bus.lead, { at, hz: midiHz(m + 12), dur: BEAT * 1.2,
                          type: 'sine', peak: 0.030, attack: 0.16 });
  }

  /* ★ 북·하이햇은 **없다.** 박을 세어 주는 소리가 있으면 그건 걷는 음악이지 서정이 아니다.
     `kick`·`hat` 함수는 지우지 않고 둔다 — 다른 곡(가게·엔딩)에서 다시 쓸 자리다. */
}

/* ============================================================
   ④ 바깥에서 쓰는 것
   ------------------------------------------------------------
     const m = createMusic(new AudioContext());
     m.start();                 // ★반드시 사용자가 화면을 만진 뒤에. 아래 §자동재생
     m.setEnabled(false);       // 음소거
     m.setIntensity(0.8);       // 0~1. 높을수록 가락이 촘촘해진다

   ★★ §자동재생 — 브라우저는 **사용자가 만지기 전에는 소리를 안 내준다.**
     그래서 `start()` 를 페이지 뜨자마자 부르면 조용히 실패한다(예외도 안 난다).
     화면을 처음 누른 뒤에 불러야 한다. 그 판단은 부르는 쪽 몫이라 여기서 안 한다.

   ★★ §예약 — `setTimeout` 으로 앞을 내다보며 예약한다. `requestAnimationFrame` 을 쓰면
     **화면이 안 그려질 때 음악이 멈춘다**(이 게임은 바뀔 때만 그린다 — room_view 의
     needsRender). 게다가 탭이 뒤로 가면 rAF 가 아예 안 돈다.
============================================================ */
export function createMusic(ctx, opt = {}) {
  if (!ctx || typeof ctx.createGain !== 'function')
    throw new Error('[음악] AudioContext 가 필요합니다 — 소리를 낼 데가 없습니다');

  const LOOKAHEAD_S = 1.2;      // 이만큼 앞을 미리 예약해 둔다
  const TICK_MS = 250;          // 이만큼마다 앞을 채운다. 둘 다 넉넉해서 잠깐 막혀도 안 끊긴다

  const master = ctx.createGain();
  master.gain.value = 0;         // ★0 에서 시작해 켤 때 서서히 올린다. 갑자기 나면 놀란다
  /* 전체를 살짝 눌러 준다 — 여러 음이 겹치는 순간 찢어지는 것을 막는다 */
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 6; comp.attack.value = 0.004;
  master.connect(comp).connect(ctx.destination);

  const mk = (v, dest) => { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; };
  const bus = {
    startAt: 0,
    bass: mk(0.55, master), pad: mk(0.5, master),
    lead: mk(0.55, master), drum: mk(0.5, master)
  };

  let rng = rngOf(opt.seed || 20260804);
  let timer = null, nextBar = 0, playing = false, enabled = opt.enabled !== false;
  let intensity = opt.intensity == null ? 0.6 : opt.intensity;
  const vol = opt.volume == null ? 0.5 : opt.volume;

  function pump() {
    /* 오디오 시계로 지금 어디쯤인가 — 여기서 벽시계(Date.now)를 쓰면 둘이 어긋나 박자가 밀린다 */
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    let guard = 0;
    while (bus.startAt + nextBar * BAR < horizon && guard++ < 64) {
      scheduleBar(ctx, bus, nextBar, rng, intensity);
      nextBar++;
    }
  }

  function start() {
    if (playing) return;
    playing = true;
    /* 조금 뒤에서 시작한다 — 지금 시각에 걸면 첫 마디가 이미 지나가 잘려 들린다 */
    bus.startAt = ctx.currentTime + 0.12;
    nextBar = 0;
    pump();
    if (typeof setInterval === 'function') timer = setInterval(pump, TICK_MS);
    fade(enabled ? vol : 0, 0.8);
  }

  function fade(to, sec) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
    master.gain.linearRampToValueAtTime(Math.max(to, 0), t + sec);
  }

  function stop() {
    if (!playing) return;
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    fade(0, 0.4);
  }

  return {
    start, stop,
    isPlaying: () => playing,
    /* ★끄는 것은 **소리만** 끈다 — 예약을 멈추지 않는다. 그래야 다시 켰을 때
       곡이 처음으로 돌아가지 않고 흐르던 자리에서 이어진다. */
    setEnabled(on) { enabled = !!on; if (playing) fade(enabled ? vol : 0, 0.5); },
    isEnabled: () => enabled,
    setIntensity(x) { intensity = Math.max(0, Math.min(1, x)); },
    /* 검사용 — 오프라인 렌더에서는 타이머가 없으므로 직접 채운다 */
    _pumpUntil(sec) {
      bus.startAt = bus.startAt || 0;
      let g = 0;
      while (bus.startAt + nextBar * BAR < sec && g++ < 512) { scheduleBar(ctx, bus, nextBar, rng, intensity); nextBar++; }
      master.gain.setValueAtTime(vol, 0);
    },
    dispose() { stop(); try { master.disconnect(); comp.disconnect(); } catch { } }
  };
}
