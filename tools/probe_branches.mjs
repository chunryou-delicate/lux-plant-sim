/* ============================================================
   tools/probe_branches.mjs — **갈래 판** · 사람이 이리 튀고 저리 튀어도 판이 매끄러운가 (2026-10-08 · core)
   ------------------------------------------------------------
   박사님(10-08 13:1x): «모든 것이 다 매끄럽도록. 게임하는 사람이 이리 튈지 저리 튈지 모르니 그것도 생각해서.»
   총괄 13:20 · 12:25(M3 — 원룸에서 자르기를 막는 «실제 말»과 «삽수에서 다시 자르기»가 길이 되나)

     node tools/probe_branches.mjs                       (사람 아홉 × 씨앗 g·1~5 · 4판씩 같이 · g = 게임이 실제로 주는 그루)
     node tools/probe_branches.mjs --persona guide,lazy --seeds 1-10 --jobs 6
     node tools/probe_branches.mjs --targets 5000000,10000000 --days 660
     node tools/probe_branches.mjs --noprologue           (잎 2·3 무늬 보장 끔 — 게임은 켠다 · 견주기용)
     node tools/probe_branches.mjs --rent 275000          (D8 — 이사하는 순간 원룸 월세 R 을 «짝»으로 꽂는다 · 없으면 게임 그대로(원룸 월세 미정 = 반지하 월세))
     node tools/probe_branches.mjs --trace                   (판마다 날마다 기록 → tools/_out/trace/<사람>_<씨앗>.json · [plan] 원룸 «주마다» 표용)
     node tools/probe_branches.mjs --boost 2                 (D40 — 삽수 «어린 그루» 무늬 배율을 이 판에서만 바꿔 끼운다 · 상한 0.9 · 1 = 캐논)
     node tools/probe_branches.mjs --grades <varie_grades.json>   (재는 판에서만 무늬 등급 표를 그 파일로 바꿔 끼운다 — 전/후 견주기용 · 게임 값은 안 건드림)
     node tools/probe_branches.mjs --persona guide --seeds g --targets 5000000 --days 1500 --rent 275000 --ledger
                                                           (이사 뒤 30일마다 장부 — 들어온 돈 · 나간 돈 · 판 삽수 · 달말 지갑)

   ══ 무엇을 하나 ═══════════════════════════════════════════════════════════
   브라우저 없이(tools/lib/byeot_harness · 진짜 생장 수) 반지하 → 이사 → 원룸 → 엔딩을 «사람 성격 손잡이»대로 하루씩 굴린다.
   손잡이(이름은 plan «갈래 지도»와 맞춘다):
     lamps        0 · 1 · 2          식물등을 몇 개까지 사나(열리면 · 돈 되면)
     siruCap      1 · 2 · 5 · 16     콩나물 시루를 몇 개까지 두나
     cut          none · asap · keep1   안 자름 · 자를 수 있으면 자름(무늬 먼저) · 자르되 모주에 무늬 잎 하나는 남김
     sellMother   never · early      모주를 안 팖 · 시장 문이 열리면(잎 3장) 내놓음
     move         asap · withCuttings   이사 문이 열리면 바로 · 무늬 삽수를 하나 들고 갈 때까지 기다림(60일 넘으면 그냥 감)
     lazy         0 · 1              1 이면 홀수 날엔 아무것도 안 한다([다음 날]만)
     follow       true · false       열린 퀘스트가 말하는 대로 시루를 늘리고(5·8·16) 무순을 들이나(crop_mix 1 · radish5 5)
     grow         true               원룸에서 처음 뿌리낸 무늬 삽수 하나를 안 팔고 키워 거기서 다시 자른다(«삽수에서 자르기» 단추 · 4e70d1e9)
   날마다 적는 것:
     ★ 막힘 — 퀘스트가 열려 있고 «기다림»(nudge_wait)도 아닌데 14일 넘게 안 풀린 구간(퀘스트 · 시작 날 · 길이)
     첫 0원 · 굶음 · 이사 날 · 엔딩 닿은 날(가정 목표 둘 · --targets · 현금 / 다 팔면)
     ★ 자르기를 막은 말(cutBlockedReason) — 그날 자를 마디 후보 중 «가장 앞» 마디의 말을 날마다 센다(반지하/원룸 따로)
     ★ 삽수에서 다시 자르기(원룸) — 흙에 자리 잡은 삽수에서 잘라 봤나 · 됐나 · 막혔으면 그 말
   ⚠ 이 자의 «사람»은 화면을 안 거친다 — 손가락·대사 차례는 night_play(총괄) 몫. 여기는 «규칙이 길을 막는 날»을 센다.
   ⚠ 값을 하나도 안 바꾼다(월세·목표는 지금 게임 그대로 · 목표만 가정값을 준다 — 엔딩 목표가 아직 null 이라).
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeGrowth, makeSwitchingLight, questSnapshotOf, atOf, RULES, TUT_RULES, ROOT, cutLeafGradesOf, setGrowthTuningPatch, addProfileSlot, addProfileSlots,
         unpackCropsAfterMove } from './lib/byeot_harness.mjs';
import { newState, pot0, setPotSlot, resowCrop, waterCrop, waterPot, sellCropSurplus, sellPantryCrop, placedItems } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { placeBeansprout, moveMonstera, beansproutReady, pantrySaleQuote, pantryKeepStatus, setPantryLegacyRule } from '../src/game/first_play.js';
import { orderItem, stockOf, incomingOf, listCutting, listPot, dealListing, marketStatus, marketGate, listingFor,
         SELLABLE_CUTTING_STATUS, assignPotLeafGrades, installVarieGrades } from '../src/game/shop.js';
import { useStock, creditSpeciesSale, furnitureItemIdOf } from '../src/game/shop.js';
import * as SPM from '../src/game/species.js';   /* ★ D45 — 새 두 종(guide45)이 쓰는 손 */
import { canMoveOut, varieView, buyLamp } from '../src/game/tutorial.js';
import { takeCutting, repotCutting, cuttableNow, cutBudgetOf, motherStatsNow, cuttingsOf, cutBlockedReason,
         cuttingStatsNow, cuttableNodesOfCutting, installVarieBoost, setCuttingAt, cutDoorOpen, varieMaturedLeavesOf } from '../src/game/propagation.js';
import { lightOptsOf } from '../src/game/loop.js';
import { moveIntoOneroom } from '../src/game/oneroom.js';
import { endingRulesFrom, endingProgress, finishEnding } from '../src/game/ending.js';
import * as JSHOP from '../src/game/job_shop.js';   /* ★ D59 «가게 사람» */
import * as JCARE from '../src/game/job_care.js';   /* ★ 2026-10-24 B «돌봄 사람» */
import * as JBREED from '../src/game/job_breed.js';   /* ★ 2026-10-24 C «육종 사람» */
import * as JSWITCH from '../src/game/job_switch.js';   /* ★ 2026-10-24 D 나머지 «바꾸기 걸음» */
import { hangSpotsOf, hangPoseOf } from '../src/game/hang_spots.js';
import { giveFurniture } from '../src/game/state.js';
/* 바꾸기 걸음(switchW)만 — 진로 첫날 창 옆 판을 게임처럼 건다(game.html startShopNow 와 같은 자리·손). 다른 사람은 예전 그대로(잰 값이 안 흔들리게 · 판은 세이브에만 · 빛 셈엔 안 넣음) */
const HOUSE_ROOMS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house_rooms.json'), 'utf8'));
const FURN_PRESETS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/furniture_presets.json'), 'utf8')).presets;
function hangJobBoard(S, light, preset) {
  const def = HOUSE_ROOMS.rooms[S.home.room], sp = hangSpotsOf(def).find(x => x.only === 'order_board');
  if (!sp || !FURN_PRESETS[preset]) return null;
  return giveFurniture(S, preset, hangPoseOf(sp, (def && def.size) || HOUSE_ROOMS.size, FURN_PRESETS[preset].size_m || {}), { size: light.room.size });
}
import { jobOfQuest } from '../src/game/quest.js';
/* C 관리하는 사람의 손이 읽는 growth 값(AL 구근 찾기 · PP 분홍) — 읽기만 */
const BREED_SPEC = (() => { const j = JSON.parse(fs.readFileSync(new URL('../data/growth_species.json', import.meta.url), 'utf8')); return { alProp: j.species.alocasia_frydek.propagation, pink: j.species.pink_princess.pink }; })();
import { careSpotsOf } from '../src/game/loop.js';
import { moveIntoOwnedHome } from '../src/game/oneroom.js';
import { creditShopOrder, buyPriceOf } from '../src/game/shop.js';
import { serialize as serializeSave, deserialize as deserializeSave } from '../src/game/save.js';   /* --dump — 단계마다 게임 세이브 꼴(byeot/save/1)로 뜬다 */
import { stepQuests, questView, questRoomOk } from '../src/game/quest.js';
import { nudgeWaiting, noteQuestWaits, nudgeWaitReason } from '../src/game/nudge_wait.js';
import { grantStaminaQuest } from '../src/game/stamina.js';
/* ★ 2026-10-09 (총괄 · plan 청) — 대사 고르기도 같이 돌린다(화면과 무관한 순수 함수 · game.html §story 와 같은 것) */
import { createStoryteller } from '../src/game/dialogue.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
/* ⚖ 재는 손잡이(--d31 · 10-10) — 안내대로가 D31 «첫 달 월세가 모자라» 말을 따르나. 자식 판에도 가게 env 로도 넘긴다 */
const D31FOLLOW = !!arg('d31', false) || process.env.BRANCH_D31 === '1';
if (D31FOLLOW) process.env.BRANCH_D31 = '1';
const list = v => String(v).split(',').map(x => x.trim()).filter(Boolean);
const range = v => list(v).flatMap(t => { const m = t.match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : [t === 'g' ? 'g' : Number(t)]; });
/* ★ 씨앗 'g' = **게임이 실제로 주는 판** — 모주 생장 씨앗 92158(plant_grow 기본 · room_view 도 같은 값 · headroom.js §씨앗) · S.sim.seed 0(newState 기본).
     게임은 새 판마다 이 둘을 안 바꾼다 ⇒ 박사님·사람이 받는 그루는 언제나 이 판이다. 숫자 씨앗은 «그루가 달랐다면»(흔들기)이다 */
const GAME_PLANT_SEED = 92158;

/* ══ 사람 — 손잡이 묶음(이름은 plan «갈래 지도»와 맞춘다 · 다르면 이름만 바꾼다) ═══════════════ */
export const PERSONAS = {
  guide:   { ko: '안내대로',          lamps: 1, siruCap: 5,  cut: 'asap',  sellMother: 'never', move: 'asap',         lazy: 0, follow: true },
  nolamp:  { ko: '등 안 삼',          lamps: 0, siruCap: 5,  cut: 'asap',  sellMother: 'never', move: 'asap',         lazy: 0, follow: true },
  tiny:    { ko: '시루 하나',          lamps: 1, siruCap: 1,  cut: 'asap',  sellMother: 'never', move: 'asap',         lazy: 0, follow: false },
  keep1:   { ko: '무늬 하나는 남김',    lamps: 1, siruCap: 5,  cut: 'keep1', sellMother: 'never', move: 'asap',         lazy: 0, follow: true },
  seller:  { ko: '모주 일찍 팖',       lamps: 1, siruCap: 5,  cut: 'asap',  sellMother: 'early', move: 'asap',         lazy: 0, follow: true },
  carrier: { ko: '삽수 들고 이사',      lamps: 1, siruCap: 5,  cut: 'asap',  sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true },
  lazy:    { ko: '게으름(이틀에 한 번)', lamps: 1, siruCap: 5,  cut: 'asap',  sellMother: 'never', move: 'asap',         lazy: 1, follow: true },
  nocut:   { ko: '안 자름',            lamps: 1, siruCap: 5,  cut: 'none',  sellMother: 'never', move: 'asap',         lazy: 0, follow: true },
  big:     { ko: '크게(시루 16 · 등 2)', lamps: 2, siruCap: 16, cut: 'asap',  sellMother: 'never', move: 'asap',         lazy: 0, follow: true },
  /* ★ 2026-10-30 총괄 D90 #10 — 세 사람(자르기 문을 지킨 판 · propagation §takeCutting 이 varieMaturedLeaves 를 문에 싣는다 · growth 039185e8):
       human    «사람 손» — 손가락대로 [확인](자동 자리 = 버그 1 뒤 판: 몬스테라 창턱 · 시루 어두운 데) · 시루 8 까지만(할 일이 16 을 말해도) ·
                남는 채소는 판다(안내대로와 같은 손 · 닷새마다 · ★ growth 10-30: 곳간에 «이레치 밥상 몫» = 14끼(keepMeals)를 남기고 판다 — PANTRY_KEEP 10판은 30끼 ≈ 15일치라 이레가 아니다) · 등은 사지 않고 가을 첫날(Day 45) 공짜 등 하나를 바로 단다
       doctor   «박사님식» — 사람 손 + house 줄(창 밑 쌓기 3칸 · banjiha-stack:0~2)을 방 표에 붙이고, 뿌리낸 삽수를 그 자리에서 그루로 키워(안 팔고) 거기서 다시 자른다
       default2 «기본 2자리» — 사람 손 + house 줄(창턱 받침 하나 더 · banjiha-sill-2:0) · 거기 삽수 하나를 키운다
       ⚠ house 줄은 등 0·1 만 믿는다(등 2·3 은 집게등이 책상을 따라가는 것을 안 셌다) · 박사님식의 옮긴 가구(책상·서랍장·협탁) 제 자리 줄은 기본 값 그대로(house 주석) */
  human:   { ko: '사람 손(손가락대로 [확인] · 시루 8 · 남는 채소 팖 · Day 45 공짜 등을 담)', lamps: 'free', siruCap: 5, siruMax: 8, cut: 'asap', sellMother: 'never', move: 'asap', lazy: 0, follow: true, keepMeals: 14 },
  doctor:  { ko: '박사님식(사람 손 + 창 밑 쌓기 3칸에 삽수를 키워 다시 자름)', lamps: 'free', siruCap: 5, siruMax: 8, cut: 'asap', sellMother: 'never', move: 'asap', lazy: 0, follow: true, keepMeals: 14, rows: 'doctor', keepBanjiha: true },
  default2:{ ko: '기본 2자리(사람 손 + 창턱 받침 하나 더에 삽수 하나를 키움)', lamps: 'free', siruCap: 5, siruMax: 8, cut: 'asap', sellMother: 'never', move: 'asap', lazy: 0, follow: true, keepMeals: 14, rows: 'default2', keepBanjiha: true },
  /* ★ 2026-10-30 총괄 D91(growth) — siru16 되살림(plan ab821458 · siru8 → sell_surplus → siru16) 뒤의 «사람 손»: 할 일 사슬대로 시루를 늘린다(8 에서 안 멈춤).
       human · default2 는 D90 #10 그대로(시루 8 에서 멈춤) 견줌으로 남긴다 */
  humanQ:  { ko: '사람 손 · 할 일 사슬대로(시루 8 → 남는 건 판다 → 16 · 남는 채소 팖 · Day 45 공짜 등을 담)', lamps: 'free', siruCap: 5, cut: 'asap', sellMother: 'never', move: 'asap', lazy: 0, follow: true, keepMeals: 14 },
  default2Q:{ ko: '사람 손 · 할 일 사슬대로 + 창턱 받침 하나 더(sill-2)에 삽수 하나를 키움', lamps: 'free', siruCap: 5, cut: 'asap', sellMother: 'never', move: 'asap', lazy: 0, follow: true, keepMeals: 14, rows: 'default2', keepBanjiha: true },
  /* ★ 2026-10-09 (총괄 11:12 ①) — 원룸에서 처음 뿌리낸 무늬 삽수 하나는 «안 팔고» 키워(혹 → 흙) 거기서 다시 자른다 · 등 1 · 오늘 가장 밝은 빈 창턱 */
  grower:  { ko: '늘리는 사람(삽수 하나 남겨 키움)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'asap', lazy: 0, follow: true, grow: true },
  /* ★ 2026-10-09 (총괄 D40 표) — «D41 안내대로»: 이사 때 무늬 삽수 하나를 들고 가고(D27 말림을 따름 · 삽수 들고 이사와 같은 손) ·
       원룸에서 그 그루(들고 간 것 · 없으면 처음 뿌리낸 무늬 삽수)를 팔지 않고 키워 거기서 다시 자른다 · 나머지는 안내대로 */
  guide41: { ko: 'D41 안내대로(하나 들고 가 키움)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true },
  /* ★ 2026-10-09 (총괄 D47) — «화분대를 사는 사람»: D41 안내대로 + 가구점이 열리면(가을) 화분대 둘을 산다.
       ⚠ 돈 쪽만 잰다 — 이 자의 빛은 정적 방 표라 «화분대로 창에 바짝 올린 빛 이득»(house: 여름엔 등 없이 자람)은 못 잰다 */
  stand:   { ko: '화분대를 사는 사람(D41 + 계단식 플랜트대 · 미니 온실장)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             buyFurn: ['furn_plant_step_3', 'furn_greenhouse_cabinet'] },
  /* ★ 2026-10-09 (총괄 D45 «같은 돈, 다른 길» 10% 선) — D41 안내대로 + 새 두 종:
       PP 교환은 늘 «바꾼다»(남긴 삽수는 안 내줌) · AL 구근은 열리면 하나 산다 · 찾은 구근은 심는다 · 가방 그루는 가장 밝은 빈 창턱 ·
       PP 잎 4장 넘으면 맨 위 산반·하프문 마디 위를 잘라 윗부분을 바로 판다 · 찾은 구근에서 난 AL 은 잎 2장이면 판다(어미 AL·받은 PP 는 남김) */
  /* ★ 2026-10-10 (총괄 D59 · plan-shop-spec §7 «가게 사람» 판) — D41 안내대로로 500만에 닿으면 집을 사고(엔딩) 가게를 연다 →
       산 투룸 · 1년(shopDays) 동안 날마다 맞는 것이 있는 주문을 납품 · 가게를 연 뒤엔 중고에 안 올린다(주문 몫으로 남김).
       잰다: 주문 맞춤 몫(납품 ÷ (납품 + 기한 지남) · ⚖ 7할 이상) · 단골 10명(간판)까지 날 · 못 맞춘 주문의 kind(«할 수 없는 주문»이 샜나) */
  shop:    { ko: '가게 사람(D41 안내대로 → 500만 엔딩 → 식물 가게 1년)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             shop: true, shopDays: 365 },
  /* ★ 10-10 총괄 — «따라 하는 가게 사람»: 몬이 말대로 구근 하나 · AL 주문이 붙으면 구근 하나 더(지갑 > 구근값 + 관리비 한 달) ·
       교환이 오면 받아서 핑크프린세스 하나를 남긴다(가게 전엔 PP 를 안 자르고 안 판다) */
  shopF:   { ko: '따라 하는 가게 사람(몬이 말 → 구근 · AL 주문 붙으면 하나 더 · 교환 PP 하나 남김)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             shop: true, shopDays: 365, shopFollow: true },
  /* 가게 사람 + 새 두 종(guide45 손) — PP·AL·구근 주문이 열리는지 */
  shop45:  { ko: '가게 사람 + 새 두 종', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             shop: true, shopDays: 365, species: true },
  /* ★ 2026-10-23 D71(박사님 «추천대로») — 가게 사람 + 둘째 묶음 두 종: 단골 5(sc_ask) 날 «줄기 삽수»를 사서 가장 높은 빈 자리에(물꽂이 → 뿌리 → 늘어짐) ·
       sc_cutting 주문에 맞는 삽수가 없으면 지킴이 줄기(첫 그루)에서 끝 마디를 잘라 놓는다 · 지킴이는 다른 SC 가 있을 때만 납품 ·
       맡은 칼라테아(ca_care)는 «알맞은 빛»(growth spotFit fit · 가운데에 가까운) 빈 자리 · 너무 밝으면(avg7) 옮긴다 · 2년(단골 5·8 이 뒤에 오므로) */
  shop71:  { ko: '가게 사람 + 새 두 종 + 둘째 두 종(D71 · 스킨답서스 높은 데 · 칼라테아 알맞은 데)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             shop: true, shopDays: 730, species: true, sp2: true },
  /* 대조 — 둘째 두 종 손 없이 같은 2년(shop45 와 같은 손 · 굶음·지갑이 D71 탓인지 가른다 · 사건 sc_ask·ca_care 는 나도 손을 안 댄다) */
  shop45L: { ko: '대조: 가게 사람 + 새 두 종(D71 손 없음 · 2년)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             shop: true, shopDays: 730, species: true },
  /* ★ 2026-10-24 B 판 «식물 돌봄»(plan-care-career-spec §7 · 총괄 D73 ⑤ 이빨 기준) — 500만 엔딩 뒤 돌봄을 고른다 · 2년 · 시루는 잇는다
       careR «돌봄 사람»(읽는 사람): 고장 id 대로 고치는 손 — 칼라테아 가운데 빛 · PP 끝은 분홍 줄 아래 자르기 · 분홍 빠짐은 분홍 남은 마디 위 자르고 밝은 데 ·
             AL 은 어둡지 않은 데서 기다림 · SC 바닥은 가장 높은 데 · SC 무늬는 밝고 자랄 높이가 있는 데 · 나으면 바로 돌려줌
       careB «밝은 데만 두는 사람»(대조): 맡은 것을 늘 가장 밝은 빈 자리에 둔다 · 안 자른다 · 안 옮긴다 · 나으면 돌려줌
       ⚖ 목표(D73 ⑤): 살린 몫 careR ≥ 8할 · careB ≤ 6할 */
  careR:   { ko: '돌봄 사람(읽고 고친다)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             care: true, careRead: true, shopDays: 730, species: true },
  careB:   { ko: '돌봄 대조(밝은 데만 둔다)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             care: true, careRead: false, shopDays: 730, species: true },
  /* ★ 2026-10-24 C «무늬 육종»(plan-breed-career-spec §7 · 총괄 D83) — 500만 → 집 → 육종 2년(같은 씨앗 두 사람)
       breedR «관리하는 사람»: 무늬 마디 삽수를 가장 밝은 빈 자리에서 뿌리내림(하네스 기본 손 · 밝음 = 그날 DLI ≥ 7.0 — growth 10-24) ·
                              무늬 어미 구근 먼저 심음 · 무늬 AL 은 안 팜(어미) · PP 를 분홍 많음에 붙잡게 자름(분홍 잎 둘 잇달면 그 아래 · 초록이면 분홍 남은 마디 위)
       breedB «아무렇게나 사람»: 빈 데 아무 데나 뿌리내림(씨앗 무작위) · 구근은 찾는 대로 · PP 안 자름
       두 사람 다 무늬 삽수는 새 잎 셋을 낸 뒤 판다(자리가 모자라다 · 표본은 적힌 순간 남는다)
       ⚖ 목표(plan §7): breedR 품종 3 ≤ 진로 한 해 안팎 · breedB 품종 3 이 1.5~2배 이상 · 칸마다 «투룸에서 한 해에 서나» */
  breedR:  { ko: '육종 — 관리하는 사람', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             breed: true, breedCare: true, shopDays: 730, species: true },
  breedB:  { ko: '육종 — 아무렇게나 사람', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             breed: true, breedCare: false, shopDays: 730, species: true },
  /* ★ 총괄 D86 ① — «다리»를 잰다: breedB 에 몬이 귀띔을 더한다. 귀띔이 실제로 뜬 날(게임 대사 고르기 story.turn 이 낸 id · 하네스가 날을 정하지 않음) 다음 날부터 그 말대로:
       hintBreedAlSleep «어두운 데 오래 두면 잠들어 · 잎이 다 질 때까지» → 구근을 찾을 수 있는 무늬 AL 을 그 그루 min 아래 가장 어두운 빈 자리에 · 잠들면 다시 밝은 데(깨움)
       hintBreedFullmoon «뿌리 낼 삽수를 제일 밝은 데 · 모자라면 등» → 뿌리낼 삽수는 가장 밝은 빈 자리 · 등을 셋까지(돈이 되는 대로 · 10만 남김)
       ⚖ 기준(D86): 2년 안 품종 3 이 5/10 이상이면 귀띔 그대로 */
  breedH:  { ko: '육종 — 귀띔을 듣는 사람', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             breed: true, breedCare: false, breedHint: true, shopDays: 730, species: true },
  /* 대조 — 높이 먼저인데 가게를 연 뒤 시루를 «안» 잇는 사람(D79 전 하네스 손버릇 · 굶음이 밥값인지 가른 판) */
  shop71n: { ko: '가게 사람 + 둘째 두 종 · 높이 먼저 · 가게에선 시루 안 함(D79 전 손버릇 대조)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             shop: true, shopDays: 730, species: true, sp2: true, sp2Hold: true, shopCrops: false },
  /* 같은 사람인데 «높이 먼저» — 지킴이 줄기가 «높은 자리에서만 닿는 길이»에 닿을 때(sc_hang)까지 안 자른다(곁줄 몇 날에 끝나나 · 그동안 삽수 주문은 놓친다) */
  shop71h: { ko: '가게 사람 + 둘째 두 종 · 높이 먼저(곁줄 sc_hang 끝날 때까지 지킴이 줄기를 안 자름)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             shop: true, shopDays: 730, species: true, sp2: true, sp2Hold: true },
  /* ★ 총괄(10-23) «sc_hang 길 둘» — ② 창가 화분걸이(house tworoom-hang-sun · dropM 1.132) + 등 3: sc_ask 날 화분걸이를 사서 걸고 등을 셋까지 산다 · 높이 먼저 */
  /* ★ 2026-10-24 D 나머지 «바꾸기 걸음»(plan-career-endings-spec §6-2 · §6-3) — 가게(shop71h 손) 끝맺음 → 돌봄(careR 손) → 돌봄 끝맺음 → 육종(breedR 손) →
       육종 끝맺음(마지막 덮개) → 돌봄으로 돌아감 → 90일. 끝맺음 본 아침에 job_switch §switchJob(화면 [다른 진로도 해 본다]와 같은 손 · 판은 이미 걸림 boardKept).
       잰다: 이사 없음 · 내려놓은 진로의 걸린 주문·맡김이 기한까지 다 끝나고 새로 안 남 · 쉬는 줄이 칩을 안 쥠 · hasJob/movedHome 그대로 · 간판 한 자리(signKept · signBy) ·
       세이브 왕복(진로 이력 · 바꾼 자국) · 숨은 손해 0(돈 · 그루 · 셈이 옮기기 앞뒤 같음) · 손님 이음(첫 맡김 손님 = 가게 단골)
       node tools/probe_branches.mjs --persona switchW --seeds g --days 3200 · 세이브 뜨기: --one '{"name":"switchW","seed":"g","targets":[5000000],"days":3200,"dump":"<폴더>"}' */
  switchW: { ko: '바꾸기 걸음(가게 → 돌봄 → 육종 → 돌봄)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             shop: true, shopDays: 5000, species: true, sp2: true, sp2Hold: true, switchSeq: ['shop', 'care', 'breed', 'care'] },
  shop71w: { ko: '가게 사람 + 둘째 두 종 · 창가 화분걸이 + 등 3(높이 먼저)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             shop: true, shopDays: 730, species: true, sp2: true, sp2Hold: true, sp2Wall: true },
  guide45: { ko: 'D45 새 두 종도 키움(D41 안내대로 + PP 교환 · AL 구근)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true,
             species: true }
};
const DARK = 'banjiha-dresser:1', SILL = 'banjiha-sill:0', ONE_SILL = 'oneroom-sill:0', ONE_BRIGHT = ['oneroom-sill:1', 'oneroom-sill:2', 'oneroom-sill:3'];
const STUCK_DAYS = 14;
const PANTRY_KEEP = 10;               /* 남겨 둘 판 수 — night_play KEEP_LOTS 와 같은 손버릇(값 아님)
                                         ★ growth 10-30 잼(guide·nolamp 씨앗 1-3 · 160일 · 판매 168번): 남긴 10판 = 끼니 중앙 30끼(최소 20) = **15일치**(최소 10일)
                                           · 곳간은 하루 두 끼(한 끼 2,500원 · 하루 5,000원 상한 · first_play §dailyCropMealCap) ⇒ «이레치»가 아니다. 이레치는 P.keepMeals 14 */
const MUSUN_AT = 'banjiha-desk:0';    /* 무순 판 자리 — 반지하 책상(원룸에도 짐으로 같은 이름이 선다) */
/* ★ 2026-10-31 — 투룸(산 집) 이삿짐 작물을 푸는 칸 — 콩나물은 아래 날마다 다시 심기(tworoom-shelf-low:0)와 같은 칸 · 무순은 옆 칸 */
const TWO_BEAN_AT = 'tworoom-shelf-low:0', TWO_MUSUN_AT = 'tworoom-shelf-low:1';
const reasonKey = m => String(m || '')
  .replace(/n[\d.]+#\d+/g, '마디').replace(/\d[\d,.]*/g, 'N').replace(/\s+/g, ' ').slice(0, 46);
function pickNode(nodes, budget, varieOnly) {
  const varie = nodes.filter(n => n.variegatedLeaves > 0 && (!budget || n.leaves <= budget.leftLeaves - 1)).sort((a, b) => a.leaves - b.leaves);
  if (varie.length) return varie[0];
  if (varieOnly) return null;
  const one = nodes.filter(n => n.leaves === 1 && (!budget || budget.leftLeaves - 1 >= 1));
  return one.length ? one[0] : null;
}

/* ══ 한 판 ═════════════════════════════════════════════════════════════ */
export async function play(name, seed, opt = {}) {
  const P = PERSONAS[name] ? { ...PERSONAS[name] } : null;   /* 판마다 제 꼴 — 바꾸기 걸음(switchSeq)이 진로 깃발을 갈아 끼운다 */
  if (!P) throw new Error('모르는 사람: ' + name);
  /* ★ 2026-10-09 D30 전/후 — 이 판(자식 프로세스)에서만 등급 표를 바꿔 끼운다 */
  if (opt.grades) installVarieGrades(JSON.parse(fs.readFileSync(opt.grades, 'utf8')));
  /* D40 전/후 — 삽수(코어 propagation)와 모주(plant_grow · 하네스가 생장 정본 칸을 덮어씀) 둘 다 같은 배율 */
  if (Number.isFinite(opt.boost)) { const vb = { pre_mature_mult: opt.boost, cap: 0.9 }; installVarieBoost(vb); setGrowthTuningPatch({ varie_boost: vb }); }
  const targets = opt.targets || [5_000_000, 10_000_000];
  const maxDays = opt.days || 660;
  const light = makeSwitchingLight('banjiha');
  /* ★ 2026-10-30 D90 #10 — house 반지하 밝은 자리 줄(docs/handoff/house-d90-banjiha-rows.json · 다시 뽑기 node tools/probe_d90_banjiha_rows.mjs --write)을 이 판의 방 표에 붙인다(자식 프로세스마다 따로) */
  const extraSlots = [];
  if (P.rows) {
    const H = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'handoff', 'house-d90-banjiha-rows.json'), 'utf8'));
    for (const r of (((H.personas || {})[P.rows] || {}).rows || [])) {
      if (!r || !r.row || r.row.slotId === SILL) continue;
      extraSlots.push(r.row.slotId);
    }
    /* ★ 10-30 growth — 하나씩 붙이면 마지막 줄만 남는다(addProfileSlot 은 원본에서 다시 시작) ⇒ 한 번에(§addProfileSlots) */
    addProfileSlots('banjiha', (((H.personas || {})[P.rows] || {}).rows || []).filter(r => r && r.row && r.row.slotId !== SILL).map(r => r.row));
    light.build('banjiha'); light.clearCache();
  }
  const io = { light, growth: await makeGrowth(seed === 'g' ? GAME_PLANT_SEED : seed, { prologue: !opt.noprologue }) };
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES, tutorialRules: TUT_RULES });   /* D8 — 게임과 같은 살림 규칙 */
  S.sim.seed = seed === 'g' ? 0 : seed;
  light.clearCache();
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });
  const ts = S.tutorial;
  /* ⚖ 재는 손잡이(--movecost N · 총괄 10-10 이사비 판) — 이 판에서만 반지하 이사비를 바꿔 끼운다(게임 값은 안 건드림) */
  if (Number.isFinite(opt.movecost)) ts.rules = Object.freeze({ ...ts.rules, moveOutCostWon: opt.movecost });
  const out = { name, seed, persona: P, moveDay: null, firstBrokeDay: null, starvedDay: null, endDay: null,
                reach: Object.fromEntries(targets.map(t => [t, null])), reachNet: Object.fromEntries(targets.map(t => [t, null])),
                cuts: { banjiha: 0, oneroom: 0, fromCutting: 0 }, cutWhy: { banjiha: {}, oneroom: {} }, recut: { tried: 0, ok: 0, why: {} },
                stuck: [], questDone: {}, questOpen: {}, sold: { varie: 0, plain: 0, pot: 0 }, cashAt: {},
                varieDay: null, moneyDay: null, leafAt: {}, cashDaily: [], rootBands: {},
                rentWon: null, minCashAfterMove: null, firstBrokeAfterMove: null,
                talk: { daysAfterMove: 0, silentAfterMove: 0, longestSilence: 0, linesAfterMove: 0 } };   /* 이사 뒤 말 없는 날 · 최장 침묵(연속) · 줄 수 */
  const story = createStoryteller();
  let silentRun = 0, saidToday = 0;
  /* ★ 2026-10-09 (총괄 · 박사님 «왜 못 닿아? 돈이 안 벌려?») — 이사 뒤 30일마다 장부. 지갑이 움직이는 부름마다 앞뒤 차이를 칸에 적고,
       그날 끝 지갑 − 그날 첫 지갑 − 적은 칸 = «기타»(퀘스트 보상 · 하루 결산 수입 등 칸 없는 것). ⇒ 칸을 다 더하면 달 차이와 꼭 맞는다 */
  let LG = null;   // { start, today } — 이사한 순간부터
  const bucket = () => {
    const i = Math.max(0, Math.floor((S.day - out.moveDay - 1) / 30));
    while (out.ledger.length <= i) out.ledger.push({ m: out.ledger.length + 1, days: 0, varie: 0, mother: 0, plain: 0, veg: 0, other: 0,
                                                     rent: 0, living: 0, power: 0, buy: 0, relief: 0, nVarie: 0, nPlain: 0, endCash: null });
    return out.ledger[i];
  };
  /* ★ 2026-10-09 --trace — 그날 들어온 돈(갈래별 · 장부와 같은 부름에서) · 그날 자른 수 · 그날 처음 정해진 등급 */
  let dayIn = {}, dayCuts = 0, dayGrades = [];
  /* ★ 2026-10-10 --dump <폴더> — 한 판 걸어 보기(총괄): 단계마다 게임이 읽는 세이브 꼴로 뜬다(probe_day_walk 가 게임 localStorage 에 싣는다).
       moved(이사 다음 날) · trade(PP 교환 뒤) · ready(500만 닿음 · 엔딩 «전») · shop0(가게 연 날) · shop30(연 뒤 30일) */
  const dumped = new Set();
  const dump = stage => {
    if (!opt.dump || dumped.has(stage)) return;
    dumped.add(stage);
    try { fs.mkdirSync(opt.dump, { recursive: true });
          const f = path.join(opt.dump, `${name}_${seed}_${stage}.json`);
          fs.writeFileSync(f, JSON.stringify(serializeSave(S)));
          (out.dumps = out.dumps || {})[stage] = { day: S.day, file: path.relative(ROOT, f) }; }
    catch (e) { (out.dumpErr = out.dumpErr || {})[stage] = String(e && e.message || e).slice(0, 200); }
  };
  /* ★ 2026-10-23 총괄 «가게 2년 굶음 가르기» — 가게를 연 날부터 30일씩 따로 적는다(돈 흐름 · 무엇이 바닥을 내나) */
  const shopMonth = () => { const i = Math.floor((S.day - out.shop.openDay) / 30); const M = out.shop.months = out.shop.months || [];
    while (M.length <= i) M.push({ m: M.length + 1, orders: 0, other: 0, veg: 0, varie: 0, plain: 0, mother: 0, relief: 0, living: 0, power: 0, rent: 0, buy: 0, saved: 0, cashEnd: null, regulars: null, done: 0, expired: 0 });
    return M[i]; };
  const book = (cat, dw) => { if (dw > 0) dayIn[cat] = (dayIn[cat] || 0) + dw; if (out.shop && dw) { const sm = shopMonth(); sm[cat] = (sm[cat] || 0) + dw; } if (!LG || !dw) return; bucket()[cat] += dw; LG.today += dw; };
  const led = (cat, fn) => { const c0 = ts.cashWon; const r = fn(); book(cat, ts.cashWon - c0); return r; };
  /* ★ 2026-10-30 총괄 D91 ③(growth) — 반지하 «손일 수». 화면이 한 번씩 누르는 단위로 센다: 거두기·심기는 시루마다(game.html §harvestOne · resowCrop potIds:[id]) ·
       물은 작물 종류마다 실제로 준 날만(§waterCrop kind) · 화분 물 · 채소 팔기 · 자르기 · 올리기 · 흥정 · 주문 · 앉히기 · 옮겨 심기. 이사 뒤는 안 센다 */
  const hand = (k, n = 1) => { if (ts.movedOut || !(n > 0)) return; const H = out.hands = out.hands || {}; H[k] = (H[k] || 0) + n; out._dayHand = (out._dayHand || 0) + n; };
  const ord = (id, n) => { const r = led('buy', () => orderItem(S, id, n)); hand('order'); return r; };   /* D8 — 원룸 월세 · 이사 뒤 최저 지갑 · 이사 뒤 첫 0원 날 */
  /* cashDaily[i] = i+1 일 끝의 지갑(총괄 봇 기록 days[].cash 와 대 보기) · rootBands = 뿌리내린 무늬 삽수의 빛 띠(반지하/원룸) */   /* leafAt[날] = [잎 · 무늬 잎 · 무늬이면서 다 자란 잎 · 유효 생장일] (30일마다) */   /* 이사 두 축이 처음 선 날(canMoveOut · 무늬 잎을 낸 적 · 이사 자금) */
  const qOpen = new Map();          // id → { since, run }
  const cutKeys = new Set();        // 모주에서 이미 잘려 나간 잎의 열쇠(leafKeys) — 진단용(§ghostCuts)
  const seenBirth = new Set();      // 모주 잎(leafBirth) — 처음 본 날 센다(§leafMonths)
  const seenRoot = new Set();       // 뿌리내림을 이미 센 삽수 id
  /* 원룸 삽수 자리 — 안내대로(follow)는 «오늘 그 자리의 빛»을 재어 가장 밝은 빈 창턱을 고른다(퀘스트 «밝은 자리에서 뿌리내리세요»를 따르는 손).
     안 따르는 사람은 예전대로 ONE_BRIGHT 앞에서부터. 모주 자리(ONE_SILL)는 비운 자리로 안 본다 */
  /* ★ C — «아무렇게나 사람»의 뿌리 자리: 투룸 빈 자리 중 아무 데나(씨앗·날로 정한 무작위 · 재현됨) · 관리하는 사람은 가장 밝은 데(brightestFree) */
  let rootPick = 0;
  const anyFree = () => {
    const occ = new Set(placedItems(S).map(x => x.slotId).filter(Boolean));
    const free = (light.room.slots || []).filter(sl => !occ.has(sl.slotId));
    if (!free.length) return null;
    const h = Math.abs(Math.sin((String(seed).split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) + S.day * 97 + (rootPick++) * 13) * 12.9898) * 43758.5453) % 1;
    return free[Math.floor(h * free.length)].slotId;
  };
  const rootFree = live => (out.breed && !P.breedCare && !(P.breedHint && out.breed.knowBright != null && S.day >= out.breed.knowBright)
    ? (anyFree() || brightestFree(live)) : brightestFree(live));   /* D86 — 귀띔을 들은 사람은 그 뒤로 가장 밝은 데 */
  const brightestFree = live => {
    /* ★ D59 — 산 집(투룸)은 자리 이름이 원룸과 다르다 — 방 전체 빈 자리 중 오늘 가장 밝은 데 */
    if (S.home && S.home.room !== 'oneroom' && S.home.room !== 'banjiha') {
      const occ = new Set(placedItems(S).map(x => x.slotId).filter(Boolean));
      let sky = null; try { sky = light.skyFor(S.day, S.sim); } catch { }
      let best = null, bd = -1;
      for (const sl of light.room.slots || []) { if (occ.has(sl.slotId)) continue; let d = -1; try { d = light.dliOfSlot(sl.slotId, lightOptsOf(S, sky)); } catch { } if (d > bd) { bd = d; best = sl.slotId; } }
      return best;
    }
    const free = ONE_BRIGHT.filter(id => !live.some(c => c && c.slotId === id));
    if (!free.length) return ONE_BRIGHT[0];
    if (!P.follow) return free[0];
    let sky = null; try { sky = light.skyFor(S.day, S.sim); } catch { }
    const dl = id => { try { return light.dliOfSlot(id, lightOptsOf(S, sky)); } catch { return -1; } };
    return free.slice().sort((a, b) => dl(b) - dl(a))[0];
  };
  const eRules = endingRulesFrom({ targetWon: 1e12 });
  let meals = [];
  let followSiru = 0;               /* 안내를 따른 시루 목표(한 번 오르면 안 내린다) */
  for (let d = 1; d <= maxDays; d++) {
    /* ★ 2026-10-30 core(D90 버그 2 재현) — --one 의 dumpDays:[N,…] — 그날 아침(손 대기 전) 세이브를 «d<N>» 으로 뜬다(게임 localStorage 꼴 · 화면 걸음이 싣는다) */
    if (opt.dump && Array.isArray(opt.dumpDays) && opt.dumpDays.includes(S.day)) dump('d' + S.day);
    const moved = !!ts.movedOut;
    const rest = P.lazy && (d % 2 === 1);
    out._dayHand = 0;
    if (!rest) { try { const w = waterPot(S); if (w && w.watered) hand('potWater'); } catch { } }
    let turn = null;
    dayIn = {}; dayCuts = 0; dayGrades = [];
    /* ★ D71 --dump — 둘째 두 종 사건 «전날» 세이브(게임에서 [다음 날]을 눌러 그 대사를 제 손으로 보게 · probe_species2_walk) */
    const preSave = opt.dump && ((P.sp2 && out.shop) || out.care || out.breed) ? JSON.stringify(serializeSave(S)) : null;   /* B 돌봄 · C 육종도(화면 걸음) */
    try { turn = nextDay(S, io).turn; } catch (e) { out.crash = (e && e.message) || String(e); break; }
    /* ★ 2026-10-09 (D30 «먼저 확인») — 모주 무늬 잎 등급(game.html §noteTurn → noteLeafGrades 와 같게: 이 턴의 밴드로 · 한 번 정하면 안 바뀜).
         ⚠ 예전엔 이 줄이 없어 장부가 비었고 무늬 삽수는 모두 legacy 산반(35만)으로 값이 매겨졌다 — lightGrade 를 바꿔도 이 판은 안 움직였다 */
    if (pot0(S)) { try { const gr = assignPotLeafGrades(S, { leafState: io.growth.leafState(), band: (turn && turn.growthSpeed && turn.growthSpeed.band) || null });
                         for (const g of (gr && gr.graded) || []) dayGrades.push({ who: 'mother', leafBirth: g.leafBirth, grade: g.grade }); } catch { } }
    for (const e of ((turn && turn.cuttings && turn.cuttings.events) || [])) if (e && e.id === 'cutting_leaf' && e.grade) dayGrades.push({ who: e.cuttingId, grade: e.grade });
    /* 결산 수입(구호금 · 반찬가게 결산 길) — 장부 밖에서도 그날 들어온 돈으로 센다 */
    for (const e of ((turn && turn.tutorial && turn.tutorial.events) || [])) if (e && (e.id === 'relief' || e.id === 'neighbor_order') && !LG) dayIn[e.id] = (dayIn[e.id] || 0) + (e.won || 0);
    if (LG) { const t = (turn && turn.tutorial) || {};   /* 하루 결산 — 월세 · 생활비(밥값 − 콩나물로 아낀 것) · 전기 */
              book('rent', -(t.rentWon || 0)); book('power', -(t.electricityWon || 0)); book('living', -((t.spentWon || 0) - (t.electricityWon || 0)));
              /* ⚠ 구호금(tutorial §reliefWon · 처음 0원이 된 그날 한 번)은 결산 «안에서» 지갑을 메운다 — 끝 지갑만 보면 0원이 된 날이 안 보인다 */
              for (const e of t.events || []) if (e && e.id === 'relief') { book('relief', e.won || 0); if (out.firstBrokeAfterMove == null) out.firstBrokeAfterMove = S.day; out.reliefAfterMove = S.day; } }
    /* 하루 대사(game.html: noteQuestWaits → homeTarget → story.turn) — 퀘스트 사건 대사는 아래 §퀘스트 에서 더한다 */
    saidToday = 0;
    let saidIds = [];
    try { noteQuestWaits(S, S.day); turn.homeTarget = targets[0]; saidIds = story.turn(turn, S) || []; saidToday += saidIds.length; } catch { }
    /* ★ 총괄 D88 ① 가름(육종 판) — 손이 심거나 팔기 «전»에 센다: 찾은 구근 출처 · AL 잠듦 · 싹(출처 × 무늬) · 늘 적는다(일꾼은 --one 만 받는다) */
    if (out.breed) {
      const B = out.breed; B.g = B.g || { cormFound: {}, cormSeen: {}, alSleeps: 0, alSleepCorms: 0, sprout: {} };
      for (const c of ((S.species && S.species.corms) || [])) if (c && !B.g.cormSeen[c.id]) { B.g.cormSeen[c.id] = 1; const k = c.origin || '?'; B.g.cormFound[k] = (B.g.cormFound[k] || 0) + 1; }
      for (const e of ((turn && turn.species && turn.species.events) || [])) {
        if (e && e.id === 'al_asleep') { B.g.alSleeps++; B.g.alSleepCorms += e.corms || 0; }
        if (e && e.id === 'al_sprout') { const q = SPM.speciesPotOf(S, e.potId); const k = `${(q && q.plant && q.plant.origin) || '?'}:${(q && q.plant && q.plant.varie) || 'plain'}`; B.g.sprout[k] = (B.g.sprout[k] || 0) + 1; }
      }
    }
    meals = ((turn && turn.firstPlayEvent && turn.firstPlayEvent.portions) || []).map(p => p && p.kind).filter(Boolean);
    try { if (S.pots && S.pots.length) marketGate(S, { leaves: io.growth.leafStats().leaves }); } catch { }
    if (!rest) {
      /* ── 작물 ── 안내를 따르는 사람은 열린 퀘스트가 말하는 시루 수를 맞춘다(5·8·16) · 무순도 들인다(crop_mix 1 · radish5 5) */
      const stm = S.stamina || {}, openQ = id => (stm.questsOpenedOn || {})[id] != null, doneQ = id => (stm.questsTaken || []).includes(id);
      if (P.follow) { for (const [id, n] of [['siru5_cycle5', 5], ['siru8', 8], ['siru16', 16]]) if (openQ(id) || doneQ(id)) followSiru = Math.max(followSiru, n); }
      const b = S.firstPlay.beansprout, want = Math.min(Math.max(P.siruCap, followSiru), Number.isFinite(P.siruMax) ? P.siruMax : Infinity);   /* ★ 10-30 사람 손 — 시루 8 까지만 */
      /* ★ 2026-10-08 (총괄 13:55) — 안내를 따르는 사람의 손버릇은 night_play guided 와 같게: 시루는 «시키는 수 > 놓인 수 · 재고 0 · 오는 중 0»일 때 하루 하나 ·
           씨앗은 놓인 시루 수만큼. 열리자마자 다 사들이면 사람보다 가난한 판이 된다(첫 판 d60 364,830 ↔ 봇 d45 741,666) */
      if (P.follow) {
        if (want > b.sirus && stockOf(S, 'siru') === 0 && incomingOf(S, 'siru') === 0) { try { ord('siru', 1); } catch { } }
      } else {
        const needSiru = want - b.sirus - stockOf(S, 'siru') - incomingOf(S, 'siru');
        if (needSiru > 0) { try { ord('siru', needSiru); } catch { } }
      }
      const target = Math.min(want, b.sirus + stockOf(S, 'siru'));
      const needSeed = (P.follow ? b.sirus : target * 2) - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed');
      if (needSeed > 0) { try { ord('bean_seed', needSeed); } catch { } }
      let hv = null; if (beansproutReady(S.firstPlay)) { try { hv = led('veg', () => harvestCrop(S, io)); } catch { } }
      if (hv && Number.isFinite(hv.harvestedPots)) hand('harvest', hv.harvestedPots);
      if (hv && hv.arrived) { setPotSlot(S, pot0(S), SILL, light.room.slots); moveMonstera(S.firstPlay, SILL, { slots: light.room.slots }); }
      /* ★ D59 — 산 집(투룸)엔 반지하 가구 자리 이름이 없다 — 가게를 연 뒤엔 콩나물·무순 다시 심기를 그만둔다(옮길 때 reseatCrops 가 앉힌 그대로) */
      if (!out.shop && !out.care && !out.breed) { try { const rs = resowCrop(S, { sirus: target, at: moved ? 'banjiha-dresser:1' : DARK, slots: light.room.slots }); if (rs) hand('sow', rs.resown || 0); } catch { } }
      /* ★ 2026-10-23 총괄 D79 «시루가 밥 · 식물이 돈» — 가게 사람도 시루를 잇는다(기본): 투룸 가장 어두운 낮은 선반에 다시 심는다.
           (예전엔 «투룸엔 반지하 자리 이름이 없다»로 끊어 굶음 3~7/10 이 하네스 손버릇이었다 · shopCrops:false 는 그 대조) */
      else if (P.shopCrops !== false) {   /* 가게 · 돌봄 판(투룸) */ try { resowCrop(S, { sirus: target, at: 'tworoom-shelf-low:0', slots: light.room.slots }); { const J0 = out.shop || out.care || out.breed; J0.cropsOk = (J0.cropsOk || 0) + 1; } } catch (e) { (out.shop || out.care || out.breed).cropErr = String(e && e.message).slice(0, 120); } }
      try { const w = waterCrop(S, { all: true }); if (w && w.watered) hand('water'); } catch { }
      if (P.follow && (openQ('crop_mix') || openQ('radish5'))) {
        const mw = (openQ('radish5') || doneQ('radish5')) ? 5 : 1;
        const site = (S.firstPlay.crops || []).find(x => x && x.kind === 'musun');
        const have = site ? (site.pots || []).length : 0;
        if (mw > have && stockOf(S, 'sprout_tray') === 0 && incomingOf(S, 'sprout_tray') === 0) { try { ord('sprout_tray', 1); } catch { } }   /* 하루 하나 */
        const needRad = Math.max(1, have) - stockOf(S, 'radish_seed') - incomingOf(S, 'radish_seed');   /* 씨앗은 놓인 판 수만큼 */
        if (needRad > 0) { try { ord('radish_seed', needRad); } catch { } }
        const mt = Math.min(mw, have + stockOf(S, 'sprout_tray'));
        if (mt > 0 && !out.shop && !out.care && !out.breed) { try { const rs = resowCrop(S, { kind: 'musun', sirus: mt, at: MUSUN_AT, slots: light.room.slots }); if (rs) hand('sow', rs.resown || 0); } catch { } }   /* 투룸엔 반지하 책상 자리 이름이 없다 */
        try { const w = waterCrop(S, { kind: 'musun', all: true }); if (w && w.watered) hand('water'); } catch { }
      }
      if (!P.follow || S.day % 5 === 0) { try { const r = led('veg', () => sellCropSurplus(S)); if (r && r.won > 0) hand('sell'); } catch { } }   /* 안내대로는 닷새마다 남는 채소를 판다(night_play 와 같게) */
      /* ★ 보유 채소 팔기 — night_play §sellSurplus 손버릇: 닷새마다 · 이레치 밥값(10판)은 남기고 나머지를 판다(값은 안 건드린다) */
      if (P.follow && S.day % 5 === 0) {
        try { const q = pantrySaleQuote(S.firstPlay, 0);
              /* ★ 10-30 keepMeals — first_play §pantryKeepStatus(core 975f4c67 · 새 꾸러미부터 끼니를 세어 그 몫만 남김 · sellLots = 앞의 남는 판 수)와 한 자리 */
              /* ★ 10-31 core D93 ⑤ M3 — 게임과 같은 자(작물마다 이레치 g · 남는 몫 먼저 판다 · sellPantryCrop 의 앞 n판 = 남는 몫) · --legacy-pantry 면 옛 14끼 · 앞에서부터 */
              const n = Number.isFinite(P.keepMeals) ? pantryKeepStatus(S.firstPlay).sellLots : (q && q.maxLots || 0) - PANTRY_KEEP;
              if (n > 0) { hand('sell'); const r = led('veg', () => sellPantryCrop(S, n)); out.pantrySoldWon = (out.pantrySoldWon || 0) + ((r && r.won) || 0); } } catch { }
      }
      /* ── 가구(화분대) — 가구점이 열리면 한 번씩(D47 · 돈만) ── */
      if (P.buyFurn && ts.lamp && ts.lamp.unlocked) {
        out.boughtFurn = out.boughtFurn || {};
        for (const id of P.buyFurn) if (!out.boughtFurn[id]) { try { ord(id, 1); out.boughtFurn[id] = S.day; } catch { } }
      }
      /* ── 등 ── */
      /* ★ 10-30 사람 손 — 가을 첫날 화면이 가방에 넣어 주는 공짜 등(game.html §lamp_unlocked: owned 1)을 그날 단다(placed 1) · 더 사지는 않는다 */
      if (P.lamps === 'free' && ts.lamp.unlocked && !(ts.lamp.owned || 0) && !(ts.lamp.placed || 0)) {
        ts.lamp.owned = 1; ts.lamp.placed = 1; S.lamps.count = Math.min(1, light.growLampCount()); light.clearCache(); out.freeLampDay = S.day;
      }
      if (P.lamps >= 1 && ts.lamp.unlocked && (ts.lamp.owned || 0) < P.lamps && ts.cashWon >= (ts.rules.lampPriceWon || 0)) {
        try { led('buy', () => buyLamp(ts)); S.lamps.count = ts.lamp.owned; if (ts.lamp) ts.lamp.placed = ts.lamp.owned; light.clearCache(); } catch { }
      }
    }
    /* ── ★ 10-30 D90 #10 반지하 그루 키우기(박사님식 · 기본 2자리) — 밝은 덧자리(house 줄)마다 뿌리낸 삽수 하나를 앉혀 흙에 옮기고(안 판다) · 잎 둘이면 거기서 다시 자른다 ── */
    if (!rest && P.keepBanjiha && !ts.movedOut && extraSlots.length) {
      const bk = out.bkeep = out.bkeep || { seat: {}, seated: 0, potted: 0, recut: 0, recutWhy: {} };
      const live = cuttingsOf(S).filter(c => c && c.status !== 'dead');
      const keeperIds = new Set(Object.values(bk.seat).filter(id => live.some(c => c.id === id)));
      for (const sid of extraSlots) {
        if (bk.seat[sid] && keeperIds.has(bk.seat[sid])) continue;
        const c = live.find(x => !keeperIds.has(x.id) && !listingFor(S, x) && x.status !== 'rooting' && Number.isFinite(x.rootedOnDay) && x.varieFromCut)
               || live.find(x => !keeperIds.has(x.id) && !listingFor(S, x) && x.status !== 'rooting' && Number.isFinite(x.rootedOnDay));
        if (!c) break;
        try { setCuttingAt(S, c, atOf(light, sid), { slots: light.room.slots, size: light.room.size }); bk.seat[sid] = c.id; keeperIds.add(c.id); bk.seated++; hand('place'); if (bk.firstSeat == null) bk.firstSeat = S.day; } catch (e) { bk.seatErr = String(e && e.message).slice(0, 80); }
      }
      for (const id of keeperIds) {
        const c = live.find(x => x.id === id); if (!c) continue;
        if (c.status === 'node') {
          if (stockOf(S, 'pot') < 1 && incomingOf(S, 'pot') < 1) { try { ord('pot', 1); } catch { } }
          if (stockOf(S, 'pot') >= 1) { try { repotCutting(S, c.id); bk.potted++; hand('repot'); } catch { } }
        }
        if (c.status === 'established' && P.cut !== 'none') {
          let lv = 0; try { lv = cuttingStatsNow(c).leaves; } catch { }
          if (lv >= 2) {
            if (stockOf(S, 'jar') < 1 && incomingOf(S, 'jar') < 1) { try { ord('jar', 1); } catch { } }
            if (stockOf(S, 'jar') >= 1) {
              const cn = cuttableNodesOfCutting(c), pick = cn.find(n => n.variegatedLeaves > 0) || cn[0];
              if (pick) { try { takeCutting(S, { motherCuttingId: c.id, nodes: cn, nodeId: pick.nodeId, container: 'jar', at: atOf(light, SILL), slots: light.room.slots }); bk.recut++; out.cuts.fromCutting++; dayCuts++; if (bk.firstRecut == null) bk.firstRecut = S.day; }
                          catch (e) { const k = reasonKey(e && e.message); bk.recutWhy[k] = (bk.recutWhy[k] || 0) + 1; } }
            }
          }
        }
      }
      out._bkeepIds = keeperIds;
    }
    /* ── 자르기(막은 말은 쉬는 날에도 센다 — 규칙이 막는지가 물음이다) ── */
    if (pot0(S)) {
      let v = null;
      try { const vv = varieView(S, { nodes: io.growth.cuttableNodes(), stats: io.growth.leafStats() });
            v = { nodes: cuttableNow(S, vv.nodes || []), all: vv.nodes || [], stats: motherStatsNow(S, vv.stats), budget: cutBudgetOf(S, vv.nodes || []) }; } catch { v = null; }
      let vm = null; try { const ls = io.growth.leafState(); vm = varieMaturedLeavesOf(ls);   /* ★ 10-30 propagation §varieMaturedLeavesOf — 화면과 같은 셈 */
                           if (S.day % 30 === 0 && Array.isArray(ls)) { const on = ls.filter(r => r && !r.dropped);
                             out.leafAt[S.day] = [on.length, on.filter(r => r.varie).length, vm, (() => { try { return Math.round(io.growth.growthDays()); } catch { return null; } })()]; } } catch { }
      const room = moved ? 'oneroom' : 'banjiha';
      if (v) {
        const cand = v.nodes.length ? v.nodes.slice().sort((a, b) => (b.variegatedLeaves > 0) - (a.variegatedLeaves > 0) || a.leaves - b.leaves)[0] : null;
        let why = '자를 마디 0(총량·잎)';
        if (cand) { try { why = cutBlockedReason(S, v.all, cand.nodeId, { potId: pot0(S).id, varieMaturedLeaves: vm }) || '자를 수 있음'; } catch (e) { why = (e && e.message) || '알 수 없음'; } }
        const k = reasonKey(why); out.cutWhy[room][k] = (out.cutWhy[room][k] || 0) + 1;
        if (!rest && P.cut !== 'none') {
          if (stockOf(S, 'jar') + incomingOf(S, 'jar') < 1) { try { ord('jar', 1); } catch { } }
          if (stockOf(S, 'pot') + incomingOf(S, 'pot') < 1) { try { ord('pot', 1); } catch { } }
          let node = pickNode(v.nodes, v.budget, false);
          /* ★★ 2026-10-30 D90 #10(growth) — 자르기 문(propagation §cutDoorOpen · 무늬이면서 다 자란 잎 ≥ 2). 게임은 화면이 단추를 회색으로 막는데
               takeCutting 은 문을 안 물어 이 자의 사람이 문 열리기 전에 잘랐다(growth 039185e8 · 이사 135일이 게임보다 5~10일 이름).
               모주 자르기만 막는다(삽수에서 다시 자르기는 문을 안 탄다) · --nodoor 면 옛 판(견주기용) */
          if (node && !opt.nodoor && !cutDoorOpen(vm)) { node = null; out.doorShut = (out.doorShut || 0) + 1; }
          /* ★ D59 가게 사람 — 가게를 연 뒤엔 게임과 같은 자로 고른다(cutBlockedReason 이 안 막는 마디 · 무늬 먼저 · 잎 적은 것) —
               pickNode 의 «잎 예산 − 1»은 게임 문(S.cutOpenToday)보다 엄격해 열린 마디를 안 잘랐다(원룸 «자를 수 있음» 265일 · 자름 3) */
          if (out.shop && !node) {
            const ok = v.nodes.filter(n => { try { return !cutBlockedReason(S, v.all, n.nodeId, { potId: pot0(S).id, varieMaturedLeaves: vm }); } catch { return false; } });
            node = ok.sort((a, b) => (b.variegatedLeaves > 0) - (a.variegatedLeaves > 0) || a.leaves - b.leaves)[0] || null;
          }
          if (node && P.cut === 'keep1' && node.variegatedLeaves > 0 && ((v.stats && v.stats.variegatedLeaves) || 0) - node.variegatedLeaves < 1) node = null;
          if (node && out.breed && P.breedCare && cuttingsOf(S).filter(c => c && c.status !== 'dead' && c.varieFromCut).length >= (out.breed.cap ?? 8)) node = null;   /* C ⑤ 상한 */
          /* ★ D59 가게 사람 — 가게를 연 뒤엔 잎 여러 장 마디도 흙 포트로 자른다(병은 잎 한 장만 받는다 · 게임 사람도 고를 수 있는 손) */
          const contNow = (out.shop && node && node.leaves > 1 && stockOf(S, 'pot') >= 1) ? 'soil' : 'jar';
          if (node && (contNow === 'soil' || stockOf(S, 'jar') >= 1)) {
            const live = cuttingsOf(S).filter(c => c.status !== 'dead');
            const slot = moved ? rootFree(live) : SILL;
            /* ⚠⚠ 2026-10-09 자의 구멍 — 예전엔 «거른 목록»(v.nodes = cuttableNow)을 넘겼다. takeCutting 은 넘긴 목록으로 모주 잎 수를 센다
                 (propagation §motherLeavesOf = 가장 큰 마디의 잎 · 거른 목록엔 밑동 마디가 없다) ⇒ 모주 잎 4장이 2장으로 읽혀
                 «잎 2장 중 2장을 이미 잘랐습니다»로 원룸 자르기가 거의 다 던졌고 catch 가 삼켰다(씨앗 g: 원룸 자르기 2번 · 던짐 수백).
                 게임(game.html §doCutFrom)은 growth 가 낸 «전체» 목록을 넘긴다 — 같게 v.all. 던진 말은 셈해 둔다(삼키지 않는다) */
            /* 등급은 화면처럼 모주 장부에서(game.html §cutLeafGradesOf) — 못 읽으면 안 넘긴다(코어가 확정문 §5 로) */
            const lg = (() => { try { return cutLeafGradesOf(pot0(S), v.all.find(x => x.nodeId === node.nodeId)); } catch { return null; } })();
            /* ★ 2026-10-09 진단 — «이미 잘려 나간 잎»(leafKeys)을 싣고 나가는 자르기를 센다. growth 는 자른 것을 모르고(형태 정본 · 잎을 안 지움)
                 cuttableNow 는 자른 «마디 이름»만 빼서, 같은 가지의 위쪽 마디가 이미 판 끝잎을 다시 싣고 잘린다(씨앗 3: 프롤로그 하프문 잎 3번) */
            const carried = (() => { const nn = v.all.find(x => x.nodeId === node.nodeId); return (nn && Array.isArray(nn.leafKeys)) ? nn.leafKeys : null; })();
            const ghost = carried ? carried.filter(k => cutKeys.has(k)).length : 0;
            try { takeCutting(S, { nodes: v.all, nodeId: node.nodeId, container: contNow, at: atOf(light, slot), slots: light.room.slots, varieMaturedLeaves: vm, ...(lg ? { leafGrades: lg } : {}) }); out.cuts[room]++; dayCuts++;
                  if (carried) { if (ghost) { out.ghostCuts = (out.ghostCuts || 0) + 1; out.ghostLeaves = (out.ghostLeaves || 0) + ghost; } for (const k of carried) cutKeys.add(k); } }
            catch (e) { const k = reasonKey(e && e.message); (out.cutThrow = out.cutThrow || {})[k] = (out.cutThrow[k] || 0) + 1; }
          }
        }
      }
    }
    if (!rest && ts.movedOut) {
      /* ★ 2026-10-09 — **가방 삽수(그릇에 담겼는데 자리가 없는 것)를 놓는다.** 이사가 물건 자리를 다 비우고(oneroom §clearPlacements)
           삽수는 회수 대상이 아니라(자리 없는 것은 건너뜀) 들고 간 삽수가 가방에 남는다 — 가방 속 삽수는 하루가 안 간다(D29).
           게임은 «가방에 든 삽수는 하루가 안 가. 방에 놓아 줘.»로 알린다 ⇒ 사람은 놓는다(가장 밝은 빈 창턱).
           ⚠ 예전 갈래 판엔 이 손이 없어 들고 간 삽수가 이사 뒤 영영 멈췄다(«D41 안내대로» 7/10 이 원룸 ② 에 못 감) */
      for (const c of [...cuttingsOf(S)]) {
        if (!c || c.status === 'dead' || c.status === 'bag' || !c.method || c.at || c.slotId) continue;
        const slot = rootFree(cuttingsOf(S).filter(x => x && x.status !== 'dead'));
        try { setCuttingAt(S, c, atOf(light, slot), { slots: light.room.slots, size: light.room.size }); out.placedFromBag = (out.placedFromBag || 0) + 1; } catch { }
      }
    }
    if (!rest) {
      /* ── 원룸: 흙에 자리 잡은 삽수에서 다시 자르기(cutBlockedReason 주석: «삽수에서 다시 자르기는 이 문을 안 탄다») ── */
      if (ts.movedOut && P.cut !== 'none') {
        for (const c of cuttingsOf(S)) {
          if (!c || c.status !== 'established') continue;
          let lv = 0; try { lv = cuttingStatsNow(c).leaves; } catch { }
          if (lv < 2 || stockOf(S, 'jar') < 1) continue;
          out.recut.tried++;
          /* ⚠ 2026-10-08 — nodeId 를 안 넘겨 «모르는 마디: undefined» 로 늘 깨졌다(자의 버그). 삽수 마디는 코어가 자기 잎에서 읽는다(cuttableNodesOfCutting).
               ⚠ 화면(game.html)에는 삽수에서 자르는 단추가 «없다» — 여기 숫자는 «규칙은 되나»이지 «사람이 할 수 있나»가 아니다 */
          if (out.breed && P.breedCare && cuttingsOf(S).filter(x => x && x.status !== 'dead' && x.varieFromCut).length >= (out.breed.cap ?? 8)) break;   /* C ⑤ 상한 */
          const cn = cuttableNodesOfCutting(c), pick = cn.find(n => n.variegatedLeaves > 0) || cn[0];
          if (!pick) { out.recut.why['마디 없음'] = (out.recut.why['마디 없음'] || 0) + 1; break; }
          try { takeCutting(S, { motherCuttingId: c.id, nodes: cn, nodeId: pick.nodeId, container: 'jar', at: atOf(light, rootFree(cuttingsOf(S).filter(x => x.status !== 'dead'))), slots: light.room.slots }); out.recut.ok++; out.cuts.fromCutting++; dayCuts++; }
          catch (e) { const k = reasonKey(e && e.message); out.recut.why[k] = (out.recut.why[k] || 0) + 1; }
          break;
        }
      }
      for (const c of [...cuttingsOf(S)]) if (c.status === 'node' && stockOf(S, 'pot') >= 1) { try { repotCutting(S, c.id); } catch { } }
      /* ── ★ D45 새 두 종(guide45) ── */
      /* ★ 10-10 총괄 (가) — 가게 첫날 몬이가 «구근 하나 들여 놓자»(shop_no_species)라 하면 «가게 사람»도 그 말을 따른다:
           구근을 사서 심고 새 종 손질(찾은 구근 심기·놓기)을 한다. PP 교환 대답은 새 두 종 사람(P.species)만 */
      if ((P.species || P.shopFollow || (out.shop && out.shop.followNoSpecies)) && ts.movedOut) {
        const o = out.sp = out.sp || { trade: null, cormBuy: null, cuts: 0, sold: 0, soldWon: 0, found: 0, sprout: 0, bagDays: 0 };
        /* 교환 — 남긴 삽수 말고 내줄 것이 생길 때까지 물음을 «들고 있다»(거절하지 않는다 · 카드를 닫아 두는 사람) */
        if ((P.species || P.shopFollow) && SPM.ppTradePending(S)) {
          const cands = SPM.ppTradeCandidates(S).filter(c => c.id !== out.keeperId);
          if (cands.length) { try { SPM.answerPPTrade(S, true, { cuttingId: cands[0].id }); o.trade = S.day; } catch { } }
        }
        if (o.cormBuy == null && (P.species || (out.shop && out.shop.followNoSpecies)) && SPM.speciesShopOpen(S, 'al_corm')) { try { ord('al_corm', 1); o.cormBuy = S.day; } catch { } }
        if (stockOf(S, 'al_corm') > 0) { try { SPM.unpackSpeciesStock(S, 'al_corm', stockOf, useStock); } catch { } }
        /* ★ D56 — 찾은 구근: 빈 자리가 있으면 심고(놓기는 아래) · 없으면 상점에 되판다(한 알 1만 · 가방이 구근으로 안 막히게) */
        const cormList = [...((S.species && S.species.corms) || [])];
        if (out.breed && P.breedCare) cormList.sort((a, b) => (b.origin === 'from_varie_mother') - (a.origin === 'from_varie_mother'));   /* C — 무늬 어미 먼저 */
        for (const c of cormList) {
          if (out.breed && P.breedCare) break;   /* C — 관리하는 사람은 육종 손이 쓸모 있는 구근만 심는다(무지 어미 구근이 AL 화분 상한을 채우던 것) */
          const occ = new Set(placedItems(S).map(x => x.slotId).filter(Boolean));
          const bagged = SPM.speciesPotsOf(S).filter(q => !SPM.speciesPlaced(q)).length;
          const free = (light.room.slots || []).filter(sl => !occ.has(sl.slotId)).length - bagged;
          if (free > 0) { try { SPM.plantCorm(S, c.id); o.found++; } catch { } }
          else { try { const r = SPM.takeCormForSale(S, c.id); led('other', () => creditSpeciesSale(S, r.won)); o.cormSold = (o.cormSold || 0) + 1; } catch { } }
        }
        for (const q of SPM.speciesPotsOf(S).filter(q => q.species === 'pink_princess' && q.origin !== 'cut' && SPM.speciesPlaced(q) && !q.care)) {   /* 맡은 그루는 돌봄 손 */
          if (!P.species && !out.shop) break;   /* 따라 하는 사람은 가게 전엔 PP 를 안 자른다(하나 남김) */
          if (out.breed) break;   /* C — 육종 판은 아래 육종 손이 자른다(관리하는 사람만) */
          if (q.plant.leaves.length < 4) continue;
          const nodes = SPM.ppCuttableNodes(q).filter(n => n.grade === 'marble' || n.grade === 'heavy');
          const n = nodes[nodes.length - 1]; if (!n) continue;
          try { SPM.cutSpecies(S, q.id, n.no); o.cuts++; } catch { }
        }
        for (const q of [...SPM.speciesPotsOf(S)]) {
          if (out.shop) break;   /* ★ D59 가게 사람 — 가게를 연 뒤엔 그루도 중고에 안 판다(삽수와 같이 · 주문 몫 — 잎 2 AL 을 팔아 «AL 잎 2» 주문이 기한을 넘겼다) */
          if (out.breed && ((q.species === 'alocasia_frydek' && q.plant && q.plant.varie) || (P.breedCare && q.species === 'pink_princess' && q.origin !== 'cut'))) continue;   /* C — 무늬 AL 은 어미 · PP 줄은 어미 그루가 잇는다(잘라 낸 끝은 판다 — growth runPP 결 · 10-24 씨앗 g: 끝을 쌓아 방이 차 구근 화분이 가방에 갇혔다) */
          const sellNow = q.origin === 'cut' || (q.origin === 'corm' && q.plant.leaves.length >= 2);
          if (!sellNow || SPM.speciesSellBlockedReason(q)) continue;
          try { const r = SPM.takeSpeciesForSale(S, q.id); led('other', () => creditSpeciesSale(S, r.won)); o.sold++; o.soldWon += r.won; } catch { }
        }
        /* 놓기 — 방 전체에서 «빈 자리 중 오늘 가장 밝은 데»(창턱은 삽수가 먼저 차지한다) */
        for (const q of SPM.speciesPotsOf(S)) if (!SPM.speciesPlaced(q)) {
          if (q.species === 'scindapsus' || q.species === 'calathea' || q.care) continue;   /* D71 — 아래 손이 고른다 · B 맡은 그루는 돌봄 손 */
          const occ = new Set(placedItems(S).map(x => x.slotId).filter(Boolean));
          let sky = null; try { sky = light.skyFor(S.day, S.sim); } catch { }
          let best = null, bd = -1;
          for (const sl of light.room.slots || []) { if (occ.has(sl.slotId)) continue;
            let d = -1; try { d = light.dliOfSlot(sl.slotId, lightOptsOf(S, sky)); } catch { }
            if (d > bd) { bd = d; best = sl.slotId; } }
          const at = best ? atOf(light, best) : null;
          if (best && at) { SPM.setSpeciesAt(S, q.id, { slotId: best, at }); (o.spots = o.spots || {})[best] = (o.spots[best] || 0) + 1; }
          else o.bagDays++;
        }
      }
      /* ── ★ D71 둘째 두 종(shop71) ── */
      if (P.sp2 && out.shop && SPM.speciesKnown('scindapsus') && SPM.speciesKnown('calathea')) {
        const o2 = out.sp2 = out.sp2 || { scBuy: null, cuts: 0, caMoves: 0, noHigh: 0, scHighDays: 0, scLowDays: 0, caFitDays: 0, caOffDays: 0 };
        const R2 = SPM.speciesRules();
        let sky2 = null; try { sky2 = light.skyFor(S.day, S.sim); } catch { }
        const occ2 = () => new Set(placedItems(S).map(x => x.slotId).filter(Boolean));
        const dli2 = sid => { try { return light.dliOfSlot(sid, lightOptsOf(S, sky2)); } catch { return null; } };
        if (o2.scBuy == null && SPM.speciesShopOpen(S, 'sc_cutting')) { try { ord('sc_cutting', 1); o2.scBuy = S.day; } catch (e) { o2.scBuyErr = String(e && e.message).slice(0, 80); } }
        /* ② 길 — 화분걸이(가구점 · sc_ask 날 열림)를 사서 창가 걸이 자리에 건다(그 자리 줄을 방 표에 붙임) + 등을 셋까지 */
        if (P.sp2Wall && o2.wallOn == null && SPM.speciesShopOpen(S, 'sc_cutting')) {
          try {
            ord(furnitureItemIdOf('wall_planter'), 1);
            const pl = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'handoff', 'growth-tworoom-shop.json'), 'utf8')).d71.planter;
            const row = { ...pl.row, slotId: 'add-wall_planter-1:0' };
            addProfileSlot('tworoom', row, { dropM: pl.dropM, high: true });
            light.build('tworoom'); light.clearCache();
            while ((ts.lamp.owned || 0) < 3) led('buy', () => buyLamp(ts));
            S.lamps.count = Math.min(ts.lamp.owned, light.growLampCount()); ts.lamp.placed = S.lamps.count; light.clearCache();
            o2.wallOn = S.day; o2.wallLamps = S.lamps.count;
          } catch (e) { o2.wallErr = String(e && e.message).slice(0, 120); o2.wallOn = -1; }
        }
        if (stockOf(S, 'sc_cutting') > 0) { try { SPM.unpackSpeciesStock(S, 'sc_cutting', stockOf, useStock); } catch (e) { o2.unpackErr = String(e && e.message).slice(0, 80); } }
        const scs = SPM.speciesPotsOf(S).filter(q => q.species === 'scindapsus');
        if (!o2.keeper || !scs.some(q => q.id === o2.keeper)) o2.keeper = scs.length ? scs[0].id : null;
        const keeper = scs.find(q => q.id === o2.keeper);
        /* 줄기 삽수 주문에 맞는 것이 없으면 지킴이 끝 마디를 자른다(모주에 둘은 남김) */
        const J2 = JSHOP.jobShopOf(S);
        const wantCut = J2.orders.find(x => x.kind === 'sc_cutting' && !JSHOP.candidatesFor(S, x).length);
        if (wantCut && keeper && !SPM.scRooting(keeper) && !(P.sp2Hold && out.shop.longVineOn == null)) {
          const need = (wantCut.need && wantCut.need.nodes) || 1;
          const n = SPM.ppCuttableNodes(keeper).filter(x => x.take >= need && x.keep >= 2).pop();
          if (n) { try { SPM.cutSpecies(S, keeper.id, n.no); o2.cuts++; } catch (e) { o2.cutErr = String(e && e.message).slice(0, 80); } }
        }
        /* 둘째 그루 — 뿌리낸 SC 가 하나뿐이고 물꽂이 중인 것도 없으면 지킴이 끝 두 마디를 잘라 물꽂이로(그루 주문은 둘 이상일 때만 난다) */
        if (keeper && !SPM.scRooting(keeper) && !(P.sp2Hold && out.shop.longVineOn == null)) {
          const sc2 = SPM.speciesPotsOf(S).filter(q => q.species === 'scindapsus');
          if (sc2.filter(q => !SPM.scRooting(q)).length < 2 && !sc2.some(SPM.scRooting)) {
            const n = SPM.ppCuttableNodes(keeper).filter(x => x.take >= 2 && x.keep >= 2).pop();
            if (n) { try { SPM.cutSpecies(S, keeper.id, n.no); o2.grow2 = (o2.grow2 || 0) + 1; } catch (e) { o2.cutErr = String(e && e.message).slice(0, 80); } }
          }
        }
        /* 놓기 — 스킨답서스는 «줄기가 가장 길게 떨어지는» 빈 자리(house dropM · 받침 높이 y 가 아니다 — 진열대 윗단은 아랫단에 닿는다) · 높은 자리가 없으면 센다 */
        const dropOfSlot = sid => { const sl = (light.room.slots || []).find(x => x.slotId === sid); return sl && Number.isFinite(sl.dropM) ? sl.dropM : null; };
        for (const q of SPM.speciesPotsOf(S)) if (q.species === 'scindapsus' && !SPM.speciesPlaced(q)) {
          const oc = occ2(); let best = null;
          for (const sl of light.room.slots || []) { if (oc.has(sl.slotId) || !Number.isFinite(sl.dropM)) continue; if (!best || sl.dropM > best.dropM) best = sl; }
          if (best) { SPM.setSpeciesAt(S, q.id, { slotId: best.slotId, at: atOf(light, best.slotId) }); if (!R2.isHighSpot(best.dropM)) o2.noHigh++; }
        }
        for (const q of scs) if (SPM.speciesPlaced(q) && !SPM.scRooting(q)) { const h = dropOfSlot(q.slotId); if (Number.isFinite(h) && R2.isHighSpot(h)) o2.scHighDays++; else o2.scLowDays++; }
        /* 칼라테아 — 가방이거나 너무 밝으면 «알맞은 빛» 빈 자리 중 가운데에 가까운 데로 */
        const band = R2.bandOf('calathea'), mid = (band.lo + band.hi) / 2;
        for (const q of SPM.speciesPotsOf(S)) if (q.species === 'calathea') {
          const placed = SPM.speciesPlaced(q), sm = R2.summary(q.plant);
          if (placed) { const d = q.slotId ? dli2(q.slotId) : null; if (Number.isFinite(d) && R2.spotFit('calathea', d) === 'fit') o2.caFitDays++; else o2.caOffDays++; }
          if (placed && !sm.tooBright) continue;
          const oc = occ2(); let best = null, bd = Infinity;
          for (const sl of light.room.slots || []) {
            if (oc.has(sl.slotId) && sl.slotId !== q.slotId) continue;
            const d = dli2(sl.slotId); if (!Number.isFinite(d) || R2.spotFit('calathea', d) !== 'fit') continue;
            if (Math.abs(d - mid) < bd) { bd = Math.abs(d - mid); best = sl; }
          }
          if (best && best.slotId !== q.slotId) { SPM.setSpeciesAt(S, q.id, { slotId: best.slotId, at: atOf(light, best.slotId) }); if (placed) o2.caMoves++; }
          else if (!best) o2.caNoFit = (o2.caNoFit || 0) + 1;
        }
      }
      /* ── 팔기 ── */
      const keepVarie = !ts.movedOut && P.move === 'withCuttings' && ts.varieSale && ts.varieSale.count >= 1;
      /* 늘리는 사람의 «남긴 삽수» — 원룸에서 처음 뿌리낸 무늬 삽수(죽으면 다음 것으로 갈아 듦)
         ★ 2026-10-09 D41 — 안내대로(follow)는 원룸 «흙에 옮겨 키우기»·«다시 자르기» 줄이 열리면 그 안내를 따라 같은 손을 쓴다 */
      const stmG = S.stamina || {}, openedG = id => (stmG.questsOpenedOn || {})[id] != null;
      /* ★ 10-10 — 안내대로(follow)는 원룸에 들어서면 곧 «키울 하나»를 정한다. 예전엔 ③ 줄이 «열린 뒤»에만 정해서, 들고 간 삽수가 뿌리내린 그날
           (③ 이 열리기 바로 전 · 같은 날 차례)에 먼저 올려 팔아 버렸다(guide g: 145일 뿌리 → 올림 → ③ 영영 못 끝냄) */
      const growNow = P.grow || (P.follow && ts.movedOut);
      if (growNow && ts.movedOut) {
        const k = out.keeperId && cuttingsOf(S).find(c => c && c.id === out.keeperId);
        if (!k || k.status === 'dead') {
          const nk = cuttingsOf(S).find(c => c && c.varieFromCut && c.status !== 'dead' && c.status !== 'rooting' && Number.isFinite(c.rootedOnDay) &&
                                             (P.carryKeep || P.follow || c.rootedOnDay >= (out.moveDay || 0)) && !listingFor(S, c));   /* D41 안내대로는 들고 간 것도 ·
                                             ★ 10-10 안내를 따르는 사람(follow)도 — ③ 은 «언제 뿌리냈든 흙에 자리 잡으면» 끝난다(plan 71ff1a5c) */
          out.keeperId = nk ? nk.id : null;
          if (nk) out.keepers = (out.keepers || 0) + 1;
        }
      }
      for (const c of [...cuttingsOf(S)]) {
        if (out.shop) break;   /* ★ D59 가게 사람 — 가게를 연 뒤엔 중고에 안 올린다(주문 몫) */
        if (out.breed && c.varieFromCut && (c.grewLeaves || 0) < 3) continue;   /* C — 무늬 삽수는 새 잎 셋(표본) 낸 뒤 판다 */
        if (!SELLABLE_CUTTING_STATUS.includes(c.status) || listingFor(S, c)) continue;
        if (growNow && c.id === out.keeperId) continue;
        if (out._bkeepIds && !ts.movedOut && out._bkeepIds.has(c.id)) continue;   /* ★ 10-30 반지하에서 키우는 그루(박사님식 · 기본 2자리)는 안 판다 */
        const varie = (c.variegatedLeaves || 0) > 0 || !!c.varieFromCut;
        if (varie && keepVarie) continue;
        /* ★ 2026-10-10 [plan] a0e86638 — 안내대로(follow)는 반지하 무늬 삽수를 퀘스트대로 판다: sell_varie(«무늬 삽수가 둘이면 하나를 팔아 보세요»)와
             sell_keep_one(«이건 남겨 두자») — 마지막 «안 죽고 안 올린» 무늬 삽수는 안 판다(첫 판매도 · 이사 둘째 축은 «잎 낸 적 ∨ 판 적»이라 팔 까닭이 아니다).
             민무늬 삽수는 예전대로 판다 */
        if (P.follow && !ts.movedOut && c.varieFromCut &&
            !cuttingsOf(S).some(x => x && x !== c && x.varieFromCut && x.status !== 'dead' && !listingFor(S, x))) { out.keptOne = (out.keptOne || 0) + 1; continue; }
        if (!ts.movedOut && c.varieFromCut && out.varieListAxis == null) { try { out.varieListAxis = { day: S.day, axis: !!canMoveOut(ts).varie, money: !!canMoveOut(ts).money }; } catch { } }
        try { listCutting(S, c.id); hand('list'); } catch { }
      }
      if (P.sellMother === 'early' && pot0(S) && !listingFor(S, pot0(S))) {
        try { const st = io.growth.leafStats(); if (st.leaves >= 3) listPot(S, { leaves: st.leaves, variegatedLeaves: st.variegatedLeaves }); } catch { }
      }
      for (const l of (() => { try { return marketStatus(S).contacted; } catch { return []; } })()) {
        /* 팔린 삽수의 잎 등급(팔기 전에 읽는다 — 팔면 목록에서 빠진다) · 무늬 판매 기록(날 · 방 · 값 · 등급) */
        let soldGrades = null;
        try { const c = (S.cuttings || []).find(x => x && x.id === l.refId); if (c && l.kind !== 'pot') soldGrades = (cuttingStatsNow(c).leafGrades || []).filter(Boolean); } catch { }
        try { const c0 = ts.cashWon; const r = dealListing(S, l.listingId), dw = ts.cashWon - c0; hand('deal');
              if (r.kind !== 'pot' && l.variegatedLeaves > 0) (out.varieSales = out.varieSales || []).push({ day: S.day, room: S.home.room, won: dw, grades: soldGrades });
              const cat = r.kind === 'pot' ? 'mother' : (l.variegatedLeaves > 0 ? 'varie' : 'plain');
              if (r.kind === 'pot') out.sold.pot++; else if (l.variegatedLeaves > 0) out.sold.varie++; else out.sold.plain++;
              book(cat, dw); if (LG && cat === 'varie') bucket().nVarie++; if (LG && cat === 'plain') bucket().nPlain++; } catch { }
      }
      /* ── 이사 ── */
      if (!ts.movedOut) { const c = canMoveOut(ts); if (c.varie && out.varieDay == null) out.varieDay = S.day; if (c.money && out.moneyDay == null) out.moneyDay = S.day; }
      if (!ts.movedOut && canMoveOut(ts).ok) {
        const holding = cuttingsOf(S).some(c => c && c.status !== 'dead' && ((c.variegatedLeaves || 0) > 0 || c.varieFromCut));
        const waited = out.moveReadyDay != null && S.day - out.moveReadyDay > 60;
        if (out.moveReadyDay == null) out.moveReadyDay = S.day;
        /* ★ 2026-10-10 [plan] 03a35d6b — 안내대로(follow)는 이사 되묻기의 몬이 한 줄(move_no_cutting)을 따른다:
             무늬 모주는 있는데 무늬 삽수 0 · 오늘 자를 수 있는 무늬 마디가 있으면 «하나 잘라 들고» 간다(오늘은 안 가고 위 자르기 손이 내일 자른다).
             자르기가 안 열리면(마디 0) 기다리지 않는다 — 화면도 그때는 아무 말을 안 한다 */
        let waitForCut = false;
        if (P.follow && holding && !out.moveCheck) out.moveCheck = { day: S.day, holding: true };
        if (P.follow && !holding && pot0(S)) {
          try {
            const st = io.growth.leafStats(); const a = st && st.variegatedLeaves > 0;
            const nodes = io.growth.cuttableNodes(); const ls = io.growth.leafState();
            const vm = Array.isArray(ls) ? ls.filter(r => r && r.varie && r.matured && !r.dropped).length : null;
            const open = cuttableNow(S, nodes, { potId: pot0(S).id }).filter(n => (n.variegatedLeaves || 0) > 0 &&
              !cutBlockedReason(S, nodes, n.nodeId, { potId: pot0(S).id, ...(Number.isInteger(vm) ? { varieMaturedLeaves: vm } : {}) })).length;
            waitForCut = !!a && open > 0 && (out.moveCutWait || 0) < 20;
            if (!out.moveCheck) out.moveCheck = { day: S.day, holding, motherVarie: !!a, varieCutOpen: open };
            if (waitForCut) out.moveCutWait = (out.moveCutWait || 0) + 1;
          } catch { waitForCut = false; }
        }
        /* ★ 10-10 D31 — 안내대로(follow)는 «이사비 내면 첫 달 월세가 모자라. 조금만 더 모으고 가자.»를 따른다(--d31 일 때 · 재는 손잡이):
             지갑 − 이사비 < 원룸 첫 달 월세면 오늘은 안 간다 */
        let waitForRent = false;
        if (D31FOLLOW && P.follow) {
          const rent1 = Number.isFinite(ts.rules.oneroomRentWon) ? ts.rules.oneroomRentWon : ts.rules.rentWon;
          waitForRent = (ts.cashWon - ts.rules.moveOutCostWon) < rent1;
          if (waitForRent) out.d31Wait = (out.d31Wait || 0) + 1;
        }
        if (!waitForCut && !waitForRent && (P.move === 'asap' || holding || waited)) {
          try {
            /* D31 — 이사 되묻기 «이사비 내면 첫 달 월세가 모자라»(move_low_cash)가 서는 판인가: 지갑 − 이사비 < 원룸 첫 달 월세 */
            { const need = ts.rules.moveOutCostWon, rent1 = Number.isFinite(ts.rules.oneroomRentWon) ? ts.rules.oneroomRentWon : ts.rules.rentWon;
              out.lowCashAtMove = (ts.cashWon - need) < rent1; out.cashAfterMoveCost = ts.cashWon - need; }
            moveIntoOneroom(S, io);
            out.moveDay = S.day;
            /* ★ 2026-10-31 총괄 D92 ㉰ — 이사가 작물을 이삿짐으로 가방에 넣는다 · 사람처럼 푼다(기본 ㉮ · --legacy-seat 면 옛 sill:0 한 점 ㉯) */
            out.unpack = unpackCropsAfterMove(S, light, { legacy: !!opt.legacySeat, musunAt: MUSUN_AT });
            /* ★ 2026-10-09 D8 — 원룸 월세 후보를 «짝»으로 꽂는다(probe_oneroom_econ §pairRules 그대로 · 월세 밖 하루치는 그대로):
                 oneroomRentWon = R · dailySpendWon = 반지하 dailySpend + (R − 반지하 월세)/주기 */
            if (Number.isFinite(opt.rent)) {
              const base = ts.rules, per = base.rentPeriodDays || 30;
              /* ★ D8 뒤 — 원룸 하루 지출 합(oneroomDailySpendWon)이 있으면 그 칸을 같은 짝 셈으로 옮긴다(반지하 칸은 그대로) */
              ts.rules = Number.isFinite(base.oneroomDailySpendWon)
                ? Object.freeze({ ...base, oneroomRentWon: opt.rent, oneroomDailySpendWon: Math.round(base.oneroomDailySpendWon + (opt.rent - (base.oneroomRentWon ?? base.rentWon)) / per) })
                : Object.freeze({ ...base, oneroomRentWon: opt.rent, dailySpendWon: Math.round(base.dailySpendWon + (opt.rent - base.rentWon) / per) });
            }
            out.rentWon = Number.isFinite(opt.rent) ? opt.rent : null;
            out.ledger = []; LG = { start: ts.cashWon, today: 0 }; out.cashAtMove = ts.cashWon;
            /* ⚖ 재는 손잡이(--cropmult X · 총괄 10-23 가게 굶음 판) — 이사 뒤(원룸 이후) 콩나물·무순 수확 배수를 이 판에서만 바꿔 끼운다
                 (first_play §CROP_HARVEST_MULT · D79 로 어디서나 2.0 — 1.3 이었다면 어떻게 되나를 재는 손잡이 · 게임 값은 안 건드림) */
            if (Number.isFinite(opt.cropmult) && S.firstPlay && S.firstPlay.rules) S.firstPlay.rules = Object.freeze({ ...S.firstPlay.rules, cropHarvestMult: opt.cropmult });
            if (pot0(S)) { try { setPotSlot(S, pot0(S), ONE_SILL, light.room.slots); } catch { } }
            S.lamps.count = ts.lamp.owned || 0; if (ts.lamp) ts.lamp.placed = S.lamps.count; light.clearCache();
          } catch (e) { out.moveErr = (e && e.message) || String(e); }
        }
      }
    }
    /* ── 퀘스트 · 막힘 ── */
    try {
      const snap = questSnapshotOf(S, io, { mealKinds: meals, targetWon: targets[0] });
      const qr = stepQuests(S, snap);
      if (opt.trace) { out._qDone = (qr && qr.finished) || []; out._qEv = ((qr && qr.events) || []).map(e => e && e.id).filter(Boolean);
                       try { const cur = questView(S, snap, { waitReason: id => nudgeWaitReason(S, id) }).chip; out._chip = cur ? cur.id : null; } catch { out._chip = null; } }
      for (const id of (qr && qr.finished) || []) { try { grantStaminaQuest(S, id); } catch { } }   /* 게임 checkQuests 와 같다 — 끝낸 것은 stamina.questsTaken 이 기억한다 */
      try { if (qr && qr.events && qr.events.length) { const q2 = story.events(qr.events, S) || []; saidToday += q2.length; saidIds = saidIds.concat(q2); } } catch { }
      noteQuestWaits(S, S.day);
      /* ★ 10-10 plan ㉮ — 반지하 Day 100 ~ 이사 날: 칩 «글»(game.html §questChipLineOf 와 같은 셈)이 30일 넘게 그대로인 날 */
      if (!ts.movedOut && S.day >= 100) {
        try { const v = questView(S, snap, { waitReason: id => nudgeWaitReason(S, id) }); const c = v.chip;
              const line = !c ? '(없음)' : (c.waiting && c.waitDo) ? c.waitDo : (c.waiting && c.waitWhat) ? `기다리는 중 — ${c.waitWhat}` : (c.todo || c.id);
              const cs = out.chipStay = out.chipStay || { days: 0, stale: 0, line: null, run: 0, longest: 0, longestLine: null };
              cs.days++; if (line === cs.line) cs.run++; else { cs.line = line; cs.run = 1; }
              if (cs.run > 30) cs.stale++; if (cs.run > cs.longest) { cs.longest = cs.run; cs.longestLine = line; } } catch { }
      }
      /* ★ 2026-10-09 ([plan] 7d3b2e4f 청) — «지금 할 일» 칩이 이사 뒤 어느 줄에 며칠 머물렀나
           ★ D50 — 게임 칩과 같은 자(questView(…, { waitReason }).chip · 기다림 줄을 건너뜀). 다 기다림이면 «id(기다림)» 으로 센다 */
      if (ts.movedOut) { try { const cur = questView(S, snap, { waitReason: id => nudgeWaitReason(S, id) }).chip;
        const k = cur ? (cur.waiting ? `${cur.id}(기다림)` : cur.id) : '(없음)'; (out.chipDays = out.chipDays || {})[k] = (out.chipDays[k] || 0) + 1; } catch { } }
      const stm = S.stamina || {}, done = new Set(stm.questsTaken || []);
      for (const [id, on] of Object.entries(stm.questsOpenedOn || {})) {
        if (out.questOpen[id] == null) out.questOpen[id] = on;
        if (done.has(id)) { if (out.questDone[id] == null) out.questDone[id] = S.day; qOpen.delete(id); continue; }
        /* ★ 2026-10-10 (총괄 — shop45 g sell_varie 563일 «막힘») — 게임은 방 표지(room)가 지금 방과 다른 줄을 숨기고 셈하지도 않는다(quest §questRoomOk).
             이사 날 판 무늬는 게임이면 거래 순간(doDeal → checkQuests · 반지하)에 닫히는데, 하네스는 퀘스트를 하루 한 번(이사 «뒤»)만 세어 반지하 줄이 열린 채 남았다.
             ⇒ 같은 자로 거른다: 방이 바뀌어 닫힌 줄은 막힘이 아니라 roomClosed 로 따로 적는다 */
        if (!questRoomOk(id, snap)) { if (qOpen.has(id)) (out.roomClosed = out.roomClosed || {})[id] = S.day; qOpen.delete(id); continue; }
        const waiting = (() => { try { return nudgeWaiting(S, id, S.day); } catch { return false; } })();
        const q = qOpen.get(id) || { since: null, run: 0 };
        if (waiting) { if (q.run >= STUCK_DAYS) out.stuck.push({ id, from: q.since, days: q.run, room: S.home.room }); q.since = null; q.run = 0; }
        else { if (q.since == null) q.since = S.day; q.run++; }
        qOpen.set(id, q);
      }
    } catch (e) { out.questErr = (e && e.message) || String(e); }
    /* ── 살림 · 엔딩 ── */
    const cash = ts.cashWon;
    if (out.firstBrokeDay == null && (ts.bankrupt || cash <= 0)) out.firstBrokeDay = S.day;
    if (ts.starved && out.starvedDay == null) { out.starvedDay = S.day; break; }
    if ([60, 120, 180, 240, 360].includes(S.day)) out.cashAt[S.day] = cash;
    out.cashDaily.push(cash);
    if (!ts.movedOut) { hand('cut', dayCuts); (out.handDays = out.handDays || []).push(out._dayHand || 0); }   /* ★ D91 ③ 반지하 하루 손일 */
    if (opt.trace) (out._trace = out._trace || []).push({ day: S.day, room: S.home.room, cash,
      cashIn: Object.keys(dayIn).length ? dayIn : null, said: saidIds.length ? saidIds : null,
      events: [...new Set([...((turn && turn.events) || []).map(e => e && e.id), ...(out._qEv || [])].filter(Boolean))],
      questsDone: (out._qDone || []).length ? out._qDone : null, chip: out._chip ?? null,
      newGrades: dayGrades.length ? dayGrades : null, cuts: dayCuts || null,
      /* 10-10 — 삽수마다 상태(무늬 · 자리 · 올림) — «들고 간 삽수가 원룸 ③ 까지 가나»를 날마다 본다 */
      cutsNow: cuttingsOf(S).map(c => `${c.id}:${c.status}${c.varieFromCut ? 'V' : ''}${c.slotId || c.at ? '' : '(가방)'}${listingFor(S, c) ? '(올림)' : ''}`).join(' ') || null,
      keeper: out.keeperId || null, potStock: stockOf(S, 'pot') });
    out._qDone = []; out._qEv = [];
    if (ts.movedOut) { const g = cuttingsOf(S).filter(c => c && c.status === 'established' && c.varieFromCut && !listingFor(S, c)).length;
                       if (g > (out.grownMax || 0)) out.grownMax = g; }   /* D41 — 원룸에서 키운 무늬 그루(흙에 자리 잡은 · 안 내놓은) 최대 */
    /* ★ 2026-10-09 (총괄 D36 ③) — 원룸에서 «새 잎»이 달마다 몇 장 나나: 모주(leafState 의 새 leafBirth) · 삽수(cutting_leaf 사건) · 그중 무늬 */
    { let ls = null; try { ls = pot0(S) ? io.growth.leafState() : null; } catch { }
      const fresh = (Array.isArray(ls) ? ls : []).filter(r => r && Number.isFinite(r.leafBirth) && !seenBirth.has(r.leafBirth));
      for (const r of fresh) seenBirth.add(r.leafBirth);
      if (ts.movedOut && out.moveDay != null) {
        const i = Math.max(0, Math.floor((S.day - out.moveDay - 1) / 30));
        out.leafMonths = out.leafMonths || [];
        while (out.leafMonths.length <= i) out.leafMonths.push({ mLeaves: 0, mVarie: 0, cLeaves: 0, cVarie: 0, grown: 0 });
        const b = out.leafMonths[i];
        b.grown = cuttingsOf(S).filter(c => c && c.status === 'established' && c.varieFromCut && !listingFor(S, c)).length;   /* 달말 키운 무늬 그루 수 */
        for (const r of fresh) { b.mLeaves++; if (r.varie) b.mVarie++; }
        for (const e of ((turn && turn.cuttings && turn.cuttings.events) || [])) if (e && e.id === 'cutting_leaf') { b.cLeaves++; if (e.variegated) b.cVarie++; }
      } }
    if (LG) { const b = bucket(); const rest0 = cash - LG.start - LG.today; if (rest0) b.other += rest0;
              if (rest0 && (out.otherLog = out.otherLog || []).length < 10)
                out.otherLog.push({ day: S.day, won: rest0, ev: [...new Set([...((turn && turn.events) || []), ...(((turn && turn.tutorial) || {}).events || [])].map(e => e && e.id).filter(Boolean))] });
              b.days++; b.endCash = cash; LG.start = cash; LG.today = 0; }
    if (ts.movedOut) {
      if (out.moveDay != null && S.day >= out.moveDay + 1) dump('moved');
      if (out.sp && out.sp.trade != null) dump('trade');
      const T = out.talk; T.daysAfterMove++; T.linesAfterMove += saidToday;
      T.ids = T.ids || {}; for (const id of saidIds) T.ids[id] = (T.ids[id] || 0) + 1;
      if (saidToday === 0) { T.silentAfterMove++; silentRun++; if (silentRun > T.longestSilence) T.longestSilence = silentRun; } else silentRun = 0;
    }
    if (ts.movedOut) {
      if (out.minCashAfterMove == null || cash < out.minCashAfterMove) out.minCashAfterMove = cash;
      if (out.firstBrokeAfterMove == null && (ts.bankrupt || cash <= 0)) out.firstBrokeAfterMove = S.day;
    }
    for (const c of cuttingsOf(S)) {
      if (!c || !c.varieFromCut || !Number.isFinite(c.rootedOnDay) || seenRoot.has(c.id)) continue;
      seenRoot.add(c.id); const k = `${ts.movedOut ? 'oneroom' : 'banjiha'}:${c.varieLightBand || '?'}`; out.rootBands[k] = (out.rootBands[k] || 0) + 1;
    }
    if (ts.movedOut) {
      let net = null; try { net = endingProgress(S, io, { rules: eRules, nodes: pot0(S) ? io.growth.cuttableNodes() : null, stats: pot0(S) ? io.growth.leafStats() : null }).netWorthWon; } catch { }
      for (const t of targets) { if (out.reach[t] == null && cash >= t) out.reach[t] = S.day; if (out.reachNet[t] == null && net != null && net >= t) out.reachNet[t] = S.day; }
      if (LG && net != null) bucket().netWorth = net;   /* 장부 — 달말 «다 팔면»(엔딩 netWorth · 모주·삽수 값까지) */
      if (P.care && out.reach[5_000_000] != null && !JSHOP.hasJob(S)) {
        /* ★ B — 집을 사고 돌봄을 고른다(가게와 같은 이사 · 같은 놓기) */
        dump('ready');   /* 엔딩 «전» — probe_care_walk 가 엔딩·진로 카드·[돌봄을 시작한다]를 화면 손으로 */
        try {
          finishEnding(S, io, { rules: endingRulesFrom({ targetWon: 5_000_000 }), nodes: pot0(S) ? io.growth.cuttableNodes() : null, stats: pot0(S) ? io.growth.leafStats() : null });
          JCARE.startCareJob(S);
          moveIntoOwnedHome(S, io, {});
          /* ★ 2026-10-31 총괄(fe78bb38 진로 걸음 빨강) — 투룸 이사도 작물을 이삿짐으로 가방에 넣는다(D92 oneroom §clearPlacements · moveIntoOwnedHome 같은 손).
               원룸 이사 뒤만 풀어 투룸에선 작물이 가방에 남았다 → 채소 0 · 짐 풀기(home/care/breed_unpack · bagPlants) 영영 안 끝남 → 굶음.
               ⇒ 그루 · 삽수를 놓기 «전»에 푼다(옛 §reseatCrops 처럼 작물 칸이 먼저 서 그루 고르기에서 빠진다) · 콩나물은 날마다 다시 심는 그 칸(TWO_BEAN_AT) */
          out.unpackHome = unpackCropsAfterMove(S, light, { legacy: !!opt.legacySeat, beanAt: TWO_BEAN_AT, musunAt: TWO_MUSUN_AT });
          S.lamps.count = ts.lamp.owned || 0; if (ts.lamp) ts.lamp.placed = S.lamps.count; light.clearCache();
          const placeBest = (setFn) => { const occ = new Set(placedItems(S).map(x => x.slotId).filter(Boolean)); let sky = null; try { sky = light.skyFor(S.day, S.sim); } catch (e) { out.carePlaceErr = String(e && e.message || e).slice(0, 120); }
            let best = null, bd = -1; for (const sl of light.room.slots || []) { if (occ.has(sl.slotId)) continue; let d = -1; try { d = light.dliOfSlot(sl.slotId, lightOptsOf(S, sky)); } catch (e) { out.carePlaceErr = String(e && e.message || e).slice(0, 120); } if (d > bd) { bd = d; best = sl; } }
            if (best) setFn(best); return best; };
          if (pot0(S)) placeBest(sl => setPotSlot(S, pot0(S), sl.slotId, light.room.slots));
          for (const c of cuttingsOf(S)) if (c && c.status !== 'dead' && !c.slotId && !c.at) placeBest(sl => setCuttingAt(S, c, atOf(light, sl.slotId), { slots: light.room.slots, size: light.room.size }));
          const opened = JCARE.openCare(S, { spots7: careSpotsOf(S, io), lamps: S.lamps.count });
          out.care = { openDay: S.day, cashAtOpen: ts.cashWon, wonTotal: 0, byProblem: {}, firstProblem: (opened.events.find(e => e.id === 'care_new') || {}).problem || null, ms: {} };
          dump('care0');
        } catch (e) { out.careErr = (e && e.message) || String(e); }
      }
      if (P.breed && out.reach[5_000_000] != null && !JSHOP.hasJob(S)) {
        /* ★ C — 집을 사고 육종을 고른다(가게·돌봄과 같은 이사 · 같은 놓기) */
        dump('ready');
        try {
          finishEnding(S, io, { rules: endingRulesFrom({ targetWon: 5_000_000 }), nodes: pot0(S) ? io.growth.cuttableNodes() : null, stats: pot0(S) ? io.growth.leafStats() : null });
          JBREED.startBreedJob(S);
          moveIntoOwnedHome(S, io, {});
          /* ★ 2026-10-31 총괄(fe78bb38 진로 걸음 빨강) — 투룸 이사도 작물을 이삿짐으로 가방에 넣는다(D92 oneroom §clearPlacements · moveIntoOwnedHome 같은 손).
               원룸 이사 뒤만 풀어 투룸에선 작물이 가방에 남았다 → 채소 0 · 짐 풀기(home/care/breed_unpack · bagPlants) 영영 안 끝남 → 굶음.
               ⇒ 그루 · 삽수를 놓기 «전»에 푼다(옛 §reseatCrops 처럼 작물 칸이 먼저 서 그루 고르기에서 빠진다) · 콩나물은 날마다 다시 심는 그 칸(TWO_BEAN_AT) */
          out.unpackHome = unpackCropsAfterMove(S, light, { legacy: !!opt.legacySeat, beanAt: TWO_BEAN_AT, musunAt: TWO_MUSUN_AT });
          S.lamps.count = ts.lamp.owned || 0; if (ts.lamp) ts.lamp.placed = S.lamps.count; light.clearCache();
          const placeBest = (setFn) => { const occ = new Set(placedItems(S).map(x => x.slotId).filter(Boolean)); let sky = null; try { sky = light.skyFor(S.day, S.sim); } catch (e) { out.breedPlaceErr = String(e && e.message || e).slice(0, 120); }
            let best = null, bd = -1; for (const sl of light.room.slots || []) { if (occ.has(sl.slotId)) continue; let d = -1; try { d = light.dliOfSlot(sl.slotId, lightOptsOf(S, sky)); } catch (e) { out.breedPlaceErr = String(e && e.message || e).slice(0, 120); } if (d > bd) { bd = d; best = sl; } }
            if (best) setFn(best); return best; };
          if (pot0(S)) placeBest(sl => setPotSlot(S, pot0(S), sl.slotId, light.room.slots));
          for (const c of cuttingsOf(S)) if (c && c.status !== 'dead' && !c.slotId && !c.at) placeBest(sl => setCuttingAt(S, c, atOf(light, sl.slotId), { slots: light.room.slots, size: light.room.size }));
          JBREED.openBreed(S);
          out.breed = { openDay: S.day, cashAtOpen: ts.cashWon, prizeWon: 0, vDays: [], slotDay: {}, cand: {}, ppCuts: 0, minCash: ts.cashWon,
                        v0: cuttingsOf(S).filter(c => c && c.status !== 'dead' && c.varieFromCut).length };   /* D84 — 진로 첫날 무늬 마디 삽수 수(판마다) */
          dump('breed0');
        } catch (e) { out.breedErr = (e && e.message) || String(e); }
      }
      if (P.shop && out.reach[5_000_000] != null && !JSHOP.isShopJob(S)) {
        /* ★ D59 — 집을 사고(엔딩 · 목표 500만) 가게를 연다 */
        dump('ready');   /* 엔딩 «전» — 화면이 엔딩·진로 카드·가게 열기를 제 손으로 걷게 */
        try {
          finishEnding(S, io, { rules: endingRulesFrom({ targetWon: 5_000_000 }), nodes: pot0(S) ? io.growth.cuttableNodes() : null, stats: pot0(S) ? io.growth.leafStats() : null });
          JSHOP.startShopJob(S);
          moveIntoOwnedHome(S, io, {});
          /* ★ 2026-10-31 총괄(fe78bb38 진로 걸음 빨강) — 투룸 이사도 작물을 이삿짐으로 가방에 넣는다(D92 oneroom §clearPlacements · moveIntoOwnedHome 같은 손).
               원룸 이사 뒤만 풀어 투룸에선 작물이 가방에 남았다 → 채소 0 · 짐 풀기(home/care/breed_unpack · bagPlants) 영영 안 끝남 → 굶음.
               ⇒ 그루 · 삽수를 놓기 «전»에 푼다(옛 §reseatCrops 처럼 작물 칸이 먼저 서 그루 고르기에서 빠진다) · 콩나물은 날마다 다시 심는 그 칸(TWO_BEAN_AT) */
          out.unpackHome = unpackCropsAfterMove(S, light, { legacy: !!opt.legacySeat, beanAt: TWO_BEAN_AT, musunAt: TWO_MUSUN_AT });
          /* 가방에 든 그루·삽수를 빈 자리 중 가장 밝은 데로(투룸 자리 이름은 원룸과 다르다 — 방 전체에서 고른다) */
          const placeBest = (setFn) => { const occ = new Set(placedItems(S).map(x => x.slotId).filter(Boolean)); let sky = null; try { sky = light.skyFor(S.day, S.sim); } catch { }
            let best = null, bd = -1; for (const sl of light.room.slots || []) { if (occ.has(sl.slotId)) continue; let d = -1; try { d = light.dliOfSlot(sl.slotId, lightOptsOf(S, sky)); } catch { } if (d > bd) { bd = d; best = sl; } }
            if (best) setFn(best); return best; };
          /* 등부터 켜고 고른다(먼저 고르면 겨울 창가가 «가장 밝은 자리»로 잡혀 모주가 등 밖에 선다 — 첫 판 연 날 모주 DLI 중앙 2.3) */
          S.lamps.count = ts.lamp.owned || 0; if (ts.lamp) ts.lamp.placed = S.lamps.count; light.clearCache();
          if (pot0(S)) placeBest(sl => setPotSlot(S, pot0(S), sl.slotId, light.room.slots));
          for (const c of cuttingsOf(S)) if (c && c.status !== 'dead' && !c.slotId && !c.at) placeBest(sl => setCuttingAt(S, c, atOf(light, sl.slotId), { slots: light.room.slots, size: light.room.size }));
          if (P.switchSeq) { try { out.boardHung = !!hangJobBoard(S, light, 'order_board'); } catch (e) { out.boardErr = String(e && e.message).slice(0, 120); } }
          const opened = JSHOP.openShop(S, { cutOpen: (S.cutOpenToday && S.cutOpenToday.n) || 0 });
          out.shop = { openDay: S.day, cashAtOpen: ts.cashWon, done: 0, expired: 0, wonTotal: 0, expiredKinds: {}, doneKinds: {} };
          out.shop.noSpecies = opened.events.some(e => e && e.id === 'shop_no_species');
          out.shop.followNoSpecies = out.shop.noSpecies;   /* 말을 따른다 */
          dump('shop0');
          /* 연 날 그루 사정 — 모주 자리 DLI · 산 삽수 · 등 */
          try { const sky = light.skyFor(S.day, S.sim); const p0 = pot0(S);
                out.shop.atOpen = { room: light.room && light.room.id, potSlot: p0 && p0.slotId, potDli: p0 && p0.slotId ? +light.dliOfSlot(p0.slotId, lightOptsOf(S, sky)).toFixed(2) : null,
                                    lamps: S.lamps.count, cuts: cuttingsOf(S).filter(c => c && c.status !== 'dead').length,
                                    motherLeaves: p0 && io.growth.leafStats ? (io.growth.leafStats() || {}).total ?? null : null }; } catch (e) { out.shop.atOpen = { err: String(e && e.message || e) }; }
        } catch (e) { out.shopErr = (e && e.message) || String(e); }
      }
      if (!P.shop && !P.care && !P.breed && targets.every(t => out.reach[t] != null)) { out.endDay = S.day; break; }
    }
    /* ★ D 나머지 «바꾸기 걸음»(switchW · 위 사람 표) — 끝맺음 본 아침에 다음 진로 · 쉬는 진로 걸린 것 · 칩 · 간판 · 덮개 · 세이브 왕복 · 숨은 손해 */
    if (P.switchSeq && JSHOP.hasJob(S)) {
      const W = out.sw = out.sw || { at: 0, steps: [], rest: [], fails: [], cover: null, sign: [] };
      const cur = JSHOP.jobOf(S).id;
      for (const e of ((turn && turn.events) || [])) if (e && ((e.id === 'regulars_milestone' || e.id === 'care_milestone') && e.n === 10)) W.sign.push({ day: S.day, ev: e.id, kept: e.signKept === true });
      for (const R of W.rest) if (!R.done) {
        const J = R.job === 'shop' ? S.jobShop : S.jobCare, list = R.job === 'shop' ? J.orders : J.requests;
        R.newOpen = Math.max(R.newOpen || 0, list.filter(x => !R.ids.includes(x.id)).length);
        if (J.seq !== R.seq0) R.rolled = true;
        if (R.job === cur) { R.done = true; R.endedBy = 'back'; }
        else if (S.day > R.lastDue) { R.done = true; R.endedBy = 'due'; R.leftAfterDue = list.filter(x => R.ids.includes(x.id)).length; }
      }
      try { const v = questView(S, questSnapshotOf(S, io, { mealKinds: meals, targetWon: targets[0] }));
            const cj = v.chip ? jobOfQuest(v.chip.id) : null; if (cj && cj !== cur) W.fails.push(`${S.day}일 쉬는 ${cj} 줄 ${v.chip.id} 이 칩을 쥠`);
            W.restingMax = Math.max(W.restingMax || 0, (v.restingIds || []).length); W.skipped = (v.skippedIds || []).length; }
      catch (e) { W.qErr = String(e && e.message).slice(0, 120); }
      if (W.cover == null && JSWITCH.finalCoverDue(S)) { const r = JSWITCH.markFinalCover(S); W.cover = { day: S.day, events: r.events.map(e => e.id) }; dump('swCover'); }
      const next = P.switchSeq[W.at + 1];
      if (next && JSWITCH.jobEndedOn(S, cur) != null && S.day > JSWITCH.jobEndedOn(S, cur)) {   /* 끝맺음 아침(사건·사진 단계가 그날 돈다) 다음 날 */
        const plantsOf = () => (S.pots || []).length + cuttingsOf(S).filter(c => c && c.status !== 'dead').length + SPM.speciesPotsOf(S).filter(q => q && !q.care).length;
        const tally = () => ({ cash: ts.cashWon, plants: plantsOf(), room: S.home.room, shopDone: S.jobShop ? S.jobShop.done : null, regulars: S.jobShop ? S.jobShop.regulars.length : null,
                               careSaved: S.jobCare ? S.jobCare.saved : null, varieties: S.jobBreed ? S.jobBreed.varieties.length : null, samples: S.jobBreed ? S.jobBreed.sampleCount : null,
                               ended: JSON.stringify(Object.fromEntries(Object.entries(S.story.jobs || {}).filter(([, h]) => h && h.endedOn != null).map(([k, h]) => [k, h.endedOn]))),
                               sign: JSON.stringify({ shop: S.jobShop ? S.jobShop.signOnDay : null, care: S.jobCare ? S.jobCare.signOnDay : null }) });
        const Jc = cur === 'shop' ? S.jobShop : cur === 'care' ? S.jobCare : null, list = Jc ? (cur === 'shop' ? Jc.orders : Jc.requests) : [];
        if (list.length) W.rest.push({ job: cur, since: S.day, ids: list.map(x => x.id), lastDue: Math.max(...list.map(x => x.dueOn)), seq0: Jc.seq });
        const b0 = tally();
        let r = null;
        const boardKept = ((S.home && S.home.furnitureAdded) || []).some(f => f && ['order_board', 'care_board', 'memo_board'].includes(f.preset));
        try { r = JSWITCH.switchJob(S, next, { boardKept, cutOpen: (S.cutOpenToday && S.cutOpenToday.n) || 0, spots7: careSpotsOf(S, io), lamps: (S.lamps && S.lamps.count) || 0 }); }
        catch (e) { W.fails.push(`${S.day}일 옮기기 실패 ${cur}→${next}: ${e && e.message}`); P.switchSeq = P.switchSeq.slice(0, W.at + 1); }
        if (r) {
          const b1 = tally(), skip = new Set(r.back ? [] : next === 'shop' ? ['shopDone', 'regulars'] : next === 'care' ? ['careSaved'] : ['varieties', 'samples']);   /* 처음 해 보는 진로 칸은 새로 선다 */
          const loss = Object.keys(b0).filter(k => !skip.has(k) && JSON.stringify(b0[k]) !== JSON.stringify(b1[k])).map(k => `${k} ${b0[k]}→${b1[k]}`);
          let rt = null;
          try { const back = deserializeSave(JSON.parse(JSON.stringify(serializeSave(S))), { firstPlayRules: RULES, allowMissingGrowth: true });
                rt = JSON.stringify(back.story.jobs) === JSON.stringify(S.story.jobs) && back.story.job.id === next && JSON.stringify(back.story.jobSwitches) === JSON.stringify(S.story.jobSwitches); }
          catch (e) { rt = 'err ' + String(e && e.message).slice(0, 80); }
          const nw = r.events.find(e => e.id === 'care_new' || e.id === 'order_new'), lk = r.events.find(e => e.id === 'customer_link');
          W.steps.push({ day: S.day, from: cur, to: next, back: r.back, events: r.events.map(e => e.id + (e.boardKept ? '{판 그대로}' : '') + (e.switched ? (e.back ? '{돌아옴}' : '{옮김}') : '')),
                         loss, rt, hasJob: JSHOP.hasJob(S), movedHome: JSHOP.movedHome(S), room: S.home.room,
                         link: lk ? (S.jobShop && S.jobShop.regulars.includes(lk.customerId) ? '가게 단골' : (S.jobCare && S.jobCare.served.includes(lk.customerId) ? '돌봄 손님' : '?')) : (nw ? '이음 없음' : null),
                         signBy: (questSnapshotOf(S, io).signBy) ?? null, titles: JSWITCH.jobTitles(S).map(t => t.title) });
          if (cur === 'shop') { out.shopRest = out.shop; out.shop = null; P.shop = false; }
          if (cur === 'care') { out.careRest = out.care; out.care = null; P.care = false; }
          if (cur === 'breed') { out.breedRest = out.breed; out.breed = null; P.breed = false; P.breedCare = false; }
          if (next === 'care') { if (r.back && out.careRest) { out.care = out.careRest; out.careRest = null; }
                                 else out.care = { openDay: S.day, cashAtOpen: ts.cashWon, wonTotal: 0, byProblem: {}, firstProblem: (nw && nw.problem) || null, ms: {} };
                                 P.care = true; P.careRead = true; }
          if (next === 'breed') { out.breed = { openDay: S.day, cashAtOpen: ts.cashWon, prizeWon: 0, vDays: [], slotDay: {}, cand: {}, ppCuts: 0, minCash: ts.cashWon,
                                                v0: cuttingsOf(S).filter(c => c && c.status !== 'dead' && c.varieFromCut).length };
                                  P.breed = true; P.breedCare = true; }
          if (next === 'shop') { out.shop = r.back && out.shopRest ? out.shopRest : { openDay: S.day, cashAtOpen: ts.cashWon, done: 0, expired: 0, wonTotal: 0, expiredKinds: {}, doneKinds: {} }; P.shop = true; }
          W.at += 1;
          dump(`sw${W.at}`);
        }
      }
      if (W.at >= P.switchSeq.length - 1 && W.lastAt == null) W.lastAt = S.day;
      if (W.lastAt != null && S.day - W.lastAt >= 90) { out.endDay = S.day; break; }
    }
    /* ★ C «육종 사람» — 날마다: 대기 품종은 바로 등록(자동 이름 · 상금) · 관리하는 사람은 PP 를 분홍 많음에 붙잡게 자른다 · 날 수·돈을 센다 */
    if (out.breed) {
      const B = out.breed, Jb = JBREED.jobBreedOf(S);
      for (const e of ((turn && turn.events) || [])) {
        if (!e) continue;
        if (e.id === 'breed_candidate' && B.cand[e.slot] == null) B.cand[e.slot] = S.day - B.openDay;
        if (e.id === 'breed_ending') B.endedAt = S.day - B.openDay;
        /* 화면 걸음(probe_breed_walk) «전날» 세이브 — 첫 표본 · 첫 후보 · 끝맺음 */
        const bst = (e.id === 'breed_sample' && e.first) ? 'breedSample' : e.id === 'breed_candidate' ? 'breedCand' : e.id === 'breed_ending' ? 'breedEnd' : null;
        if (bst && preSave && !dumped.has(bst + '_pre')) { dumped.add(bst + '_pre'); dump(bst);
          try { fs.writeFileSync(path.join(opt.dump, `${name}_${seed}_${bst}_pre.json`), preSave); (out.dumps = out.dumps || {})[bst + '_pre'] = { day: S.day - 1 }; }
          catch (er) { (out.dumpErr = out.dumpErr || {})[bst + '_pre'] = String(er && er.message || er).slice(0, 200); } }
      }
      /* 등록 대기가 오늘 섰다 — 그 «전날»(이름 칸이 뜨는 날을 화면이 걷게) · 셋째 품종 대기는 따로(끝맺음 앞) */
      { const regSt = Jb.pending.length ? (Jb.varieties.length === 2 ? 'breedReg3' : 'breedReg') : null;
        if (regSt && preSave && !dumped.has(regSt + '_pre')) { dumped.add(regSt + '_pre');
          try { fs.writeFileSync(path.join(opt.dump, `${name}_${seed}_${regSt}_pre.json`), preSave); (out.dumps = out.dumps || {})[regSt + '_pre'] = { day: S.day - 1 }; }
          catch (er) { (out.dumpErr = out.dumpErr || {})[regSt + '_pre'] = String(er && er.message || er).slice(0, 200); } } }
      for (let k = 0; k < 6 && JBREED.pendingBreed(S); k++) {
        const p = JBREED.pendingBreed(S);
        try { const r = JBREED.registerBreed(S, p.slot, ''); led('other', () => creditShopOrder(S, r.won)); B.prizeWon += r.won; B.slotDay[p.slot] = S.day - B.openDay; B.vDays.push(S.day - B.openDay);
              if (opt.dump && Jb.varieties.length === 3) dump('breed3'); }
        catch (e) { B.regErr = String(e && e.message).slice(0, 80); break; }
      }
      /* ④ PP — 오늘 새 잎이 났고 분홍 많음이 아니면 «다음 잎 분홍 많음 몫»이 가장 큰 잎 위를 자른다(growth runPP) · 관리하는 사람 · 귀띔(hintBreedPpHeavy)을 들은 사람 */
      const ppHeavyCut = () => {
        const R0 = SPM.speciesRules(), PK = BREED_SPEC.pink;
        const heavyOdds = (x, drift) => { const lo = x + drift - PK.jitter, hi = x + drift + PK.jitter;
          return x <= PK.green_max ? 0 : Math.max(0, Math.min(hi, PK.pink_leaf_min) - Math.max(lo, PK.heavy_min)) / (hi - lo); };
        B.ppSeen = B.ppSeen || {};
        for (const q of SPM.speciesPotsOf(S).filter(q => q.species === 'pink_princess' && SPM.speciesPlaced(q) && !q.care)) {
          const rows = R0.leafRows(q.plant); if (!rows.length) continue;
          const top = rows[rows.length - 1], seen = B.ppSeen[q.id];
          B.ppSeen[q.id] = top.no;
          if (seen == null || top.no <= seen || top.grade === 'heavy') continue;
          let a7 = null, bestLo = null; try { a7 = R0.avg7(q.plant); bestLo = R0.thresholdsOf(q.plant).best_lo; } catch (e) { a7 = null; }
          const drift = Number.isFinite(a7) && Number.isFinite(bestLo) && a7 < bestLo ? PK.drift_low_light : 0;
          let best = null; for (const L of q.plant.leaves) { const o = heavyOdds(L.pink, drift); if (!best || o > best.o + 1e-9) best = { L, o }; }
          if (best && best.L.no !== top.no) { try { SPM.cutSpecies(S, q.id, best.L.no); B.ppCuts++; } catch (e) { const k = reasonKey(e && e.message); (B.ppCutWhy = B.ppCutWhy || {})[k] = (B.ppCutWhy[k] || 0) + 1; } }
        }
      };
      if (P.breedHint) {
        /* D86 ① — 귀띔이 뜬 날(그날 대사 id) → 다음 날부터 그 말대로 */
        if (B.knowSleep == null && saidIds.includes('hintBreedAlSleep')) { B.knowSleep = S.day + 1; B.hintSleepAt = S.day - B.openDay; }
        if (B.knowBright == null && saidIds.includes('hintBreedFullmoon')) { B.knowBright = S.day + 1; B.hintBrightAt = S.day - B.openDay; }
        /* D87 — plan fed58db3 귀띔 셋 */
        if (B.knowShopCorm == null && saidIds.includes('hintBreedAlShopCorm')) { B.knowShopCorm = S.day + 1; B.hintShopCormAt = S.day - B.openDay; }
        if (B.knowPpCut == null && saidIds.includes('hintBreedPpHeavy')) { B.knowPpCut = S.day + 1; B.hintPpCutAt = S.day - B.openDay; }
        if (B.knowPpShop == null && saidIds.includes('hintBreedPpShop')) { B.knowPpShop = S.day + 1; B.hintPpShopAt = S.day - B.openDay; }
        /* D88 ②③ — plan c1ad629b · b04f4e4e 귀띔 둘 */
        if (B.knowRoot == null && saidIds.includes('hintBreedRootSpot')) { B.knowRoot = S.day + 1; B.hintRootAt = S.day - B.openDay; }
        if (B.knowAlKinds == null && saidIds.includes('hintBreedAlKinds')) { B.knowAlKinds = S.day + 1; B.hintAlKindsAt = S.day - B.openDay; }
        /* hintBreedAlShopCorm «상점 구근을 들여 봐 · 무늬 그루가 나오면 어미가 돼» → 무늬 AL(그루 · 무늬 어미 구근)이 없으면 상점 구근을 들인다(싹 기다리는 것까지 둘 ·
             10만 남김) · 심고 놓기는 일반 손(재고 풀기 · 가장 밝은 빈 자리) · 무지 싹은 일반 손이 잎 2 에 판다 · 무늬 싹은 남긴다(어미) */
        if (((B.knowShopCorm != null && S.day >= B.knowShopCorm) || (B.knowAlKinds != null && S.day >= B.knowAlKinds)) && SPM.speciesShopOpen(S, 'al_corm')) {
          const mineAL = SPM.speciesPotsOf(S).filter(q => q && !q.care && q.species === 'alocasia_frydek' && q.plant);
          const bagC = (S.species && S.species.corms) || [];
          /* hintBreedAlKinds «무늬 갈래는 어미를 따라가 · 다른 갈래가 필요하면 상점 구근을 또» 를 들은 뒤엔 갈래마다 — 끝 안 난 갈래(등록·대기 아님)에 그 갈래 어미(그루 · 무늬 어미 구근)가 없으면 산다 */
          const kindDone = k => Jb.varieties.some(v => v.slot === 'al_' + k) || Jb.pending.some(x => x.slot === 'al_' + k);
          const kindSrc = k => mineAL.some(q => q.plant.varie === k) || mineAL.some(q => q.plant.phase === 'corm' && q.plant.origin === 'from_varie_mother' && q.plant.motherKind === k)
                               || bagC.some(c => c && c.origin === 'from_varie_mother' && c.motherKind === k);
          const hasMother = (B.knowAlKinds != null && S.day >= B.knowAlKinds)
            ? ['marble', 'sector'].every(k => kindDone(k) || kindSrc(k))
            : (mineAL.some(q => q.plant.varie === 'marble' || q.plant.varie === 'sector')
               || mineAL.some(q => q.plant.phase === 'corm' && q.plant.origin === 'from_varie_mother')
               || bagC.some(c => c && c.origin === 'from_varie_mother'));
          const waiting = mineAL.filter(q => q.plant.phase === 'corm').length + incomingOf(S, 'al_corm') + stockOf(S, 'al_corm');
          for (let i = waiting; !hasMother && i < 2 && ts.cashWon > buyPriceOf('al_corm') + 100_000; i++) {
            try { ord('al_corm', 1); B.shopCormsBought = (B.shopCormsBought || 0) + 1; } catch (e) { B.cormErr = String(e && e.message).slice(0, 80); break; } }
        }
        /* hintBreedRootSpot «뿌리 낼 동안만이라도 밝은 자리를 비워 줘 · 무늬는 뿌리 낸 날 자리로 정해져 · 그 뒤엔 자랄 만큼만 밝으면 어디든 돼»(plan · 총괄 D88 ②) →
             뿌리 밝기가 아직 안 정해진 무늬 마디 삽수(물꽂이 뿌리내리는 중)는 그날 빛이 가장 밝은 자리에 — 빈 데가 없으면 AL·PP 화분과 자리를 맞바꾼다 ·
             뿌리 밝기가 정해진 다음 날 맞바꾼 화분에 자리를 돌려주고, 삽수는 7일 평균 ≥ 3.78(무늬 잎이 자라는 빛 · breedR ⑤ 와 같은 자)인 빈 데로(없으면 맞바꾼 자리 그대로) */
        if (B.knowRoot != null && S.day >= B.knowRoot) {
          let sky = null; try { sky = light.skyFor(S.day, S.sim); } catch (e) { sky = null; }
          const today = sid => { try { return light.dliOfSlot(sid, lightOptsOf(S, sky)); } catch (e) { return -1; } };
          let fw = null; try { fw = careSpotsOf(S, io); } catch (e) { fw = null; }
          const avg = new Map((fw || []).filter(x => Number.isFinite(x.dli)).map(x => [x.slotId, x.dli]));
          const occBy = new Map();
          for (const it of placedItems(S)) if (it && it.slotId) occBy.set(it.slotId, it);
          for (const q of SPM.speciesPotsOf(S)) if (q && SPM.speciesPlaced(q) && q.slotId) occBy.set(q.slotId, q);
          const moveCut = (c, sid) => { c.slotId = null; c.at = null; setCuttingAt(S, c, atOf(light, sid), { slots: light.room.slots, size: light.room.size }); };
          const movePot = (q, sid) => SPM.setSpeciesAt(S, q.id, { slotId: sid, at: atOf(light, sid) });
          B.rootSwap = B.rootSwap || {};
          for (const c of cuttingsOf(S).filter(c => c && c.status !== 'dead' && c.varieFromCut && !c.varieLightBand && c.slotId)) {
            const here = today(c.slotId);
            const best = (light.room.slots || []).map(x => x.slotId).filter(sid => { const o = occBy.get(sid); return !o || o === c || (o.species && (o.species === 'alocasia_frydek' || o.species === 'pink_princess') && !o.care); })
              .sort((a, b) => today(b) - today(a))[0];
            if (!best || best === c.slotId || today(best) <= here + 0.3) continue;
            const o = occBy.get(best), from = c.slotId;
            try {
              if (o && o !== c && o.species) { movePot(o, from); B.rootSwap[c.id] = { potId: o.id, bright: best }; B.rootSwaps = (B.rootSwaps || 0) + 1; occBy.set(from, o); }
              else occBy.delete(from);
              moveCut(c, best); occBy.set(best, c);
            } catch (e) { B.rootSwapErr = String(e && e.message).slice(0, 80); }
          }
          for (const [cid, sw] of Object.entries(B.rootSwap)) {
            const c = cuttingsOf(S).find(x => x && x.id === cid);
            if (c && c.status !== 'dead' && !c.varieLightBand) continue;   /* 아직 뿌리 밝기 안 정해짐 */
            delete B.rootSwap[cid];
            const q = SPM.speciesPotOf(S, sw.potId);
            if (!c || c.status === 'dead' || !q || !SPM.speciesPlaced(q) || c.slotId !== sw.bright) continue;
            const potSid = q.slotId;
            const grow = [...avg.entries()].filter(([sid, v]) => v >= 3.78 && !occBy.get(sid)).sort((a, b) => b[1] - a[1])[0];
            try { if (grow) { moveCut(c, grow[0]); occBy.set(grow[0], c); occBy.delete(sw.bright); movePot(q, sw.bright); occBy.delete(potSid); }
                  else { moveCut(c, potSid); movePot(q, sw.bright); }
                  B.rootGiveBack = (B.rootGiveBack || 0) + 1; }
            catch (e) { B.rootSwapErr = String(e && e.message).slice(0, 80); }
          }
        }
        /* hintBreedPpHeavy «분홍 많은 잎이 맨 위에 오게 잘라» → ④ 손(growth runPP) · 잘라 낸 끝은 일반 손이 판다 */
        if (B.knowPpCut != null && S.day >= B.knowPpCut) ppHeavyCut();
        /* hintBreedPpShop «핑크프린세스가 없으면 상점에서 어린 그루를 들여 봐» → 가진 PP(맡은 것 빼고) 0 이면 하나 사서 풀기(놓기는 일반 손) */
        if (B.knowPpShop != null && S.day >= B.knowPpShop) {
          const ownPP = SPM.speciesPotsOf(S).filter(q => q && !q.care && q.species === 'pink_princess').length;
          if (ownPP === 0 && stockOf(S, 'pp_young') === 0 && incomingOf(S, 'pp_young') === 0 && SPM.speciesShopOpen(S, 'pp_young') && ts.cashWon > buyPriceOf('pp_young') + 100_000) {
            try { ord('pp_young', 1); B.ppBought = (B.ppBought || 0) + 1; } catch (e) { B.ppBuyErr = String(e && e.message).slice(0, 80); } }
          if (stockOf(S, 'pp_young') > 0) { try { SPM.unpackSpeciesStock(S, 'pp_young', stockOf, useStock); } catch (e) { B.ppBuyErr = String(e && e.message).slice(0, 80); } }
        }
        if (B.knowBright != null && S.day >= B.knowBright) {
          const lampWon = (ts.rules && ts.rules.lampPriceWon) || 0;
          while ((ts.lamp.owned || 0) < 3 && ts.cashWon >= lampWon + 100_000) { try { led('buy', () => buyLamp(ts)); B.lampsBought = (B.lampsBought || 0) + 1; } catch (e) { B.lampErr = String(e && e.message).slice(0, 80); break; } }
          let rigs = null; try { rigs = light.growLampCount(); } catch (e) { rigs = null; }
          const want = Math.min(ts.lamp.owned || 0, Number.isFinite(rigs) ? rigs : 0);
          if (S.lamps.count !== want) { S.lamps.count = want; ts.lamp.placed = want; light.clearCache(); }
        }
        if (B.knowSleep != null && S.day >= B.knowSleep) {
          const R0 = SPM.speciesRules(), maxF = BREED_SPEC.alProp.max_finds_lifetime, minS = BREED_SPEC.alProp.min_leaves_since_find;
          let fw = null; try { fw = careSpotsOf(S, io); } catch (e) { fw = null; }
          const avg = new Map((fw || []).filter(x => Number.isFinite(x.dli)).map(x => [x.slotId, x.dli]));
          const thMin = q => { try { return R0.thresholdsOf(q.plant).min; } catch (e) { return 0; } };
          const occ = new Set([...placedItems(S).map(x => x.slotId), ...SPM.speciesPotsOf(S).filter(q => SPM.speciesPlaced(q)).map(q => q.slotId)].filter(Boolean));
          const freeIds = (light.room.slots || []).map(x => x.slotId).filter(id => !occ.has(id) && avg.has(id));
          for (const q of SPM.speciesPotsOf(S).filter(q => q.species === 'alocasia_frydek' && !q.care && q.plant && SPM.speciesPlaced(q))) {
            const p = q.plant, here = avg.get(q.slotId);
            const canFind = (p.varie === 'marble' || p.varie === 'sector') && p.finds < maxF && (p.sinceFind ?? 0) >= minS && (p.phase === 'growing' || p.phase === 'dropping');
            let to = null;
            if (canFind && !(Number.isFinite(here) && here < thMin(q))) to = freeIds.filter(id => avg.get(id) < thMin(q)).sort((a, b) => avg.get(a) - avg.get(b))[0];
            else if (p.phase === 'asleep' && Number.isFinite(here) && here < thMin(q) + 0.3) to = freeIds.filter(id => avg.get(id) >= thMin(q) + 0.3).sort((a, b) => avg.get(a) - avg.get(b))[0];
            if (to) { occ.delete(q.slotId); SPM.setSpeciesAt(S, q.id, { slotId: to, at: atOf(light, to) }); freeIds.splice(freeIds.indexOf(to), 1); if (q.slotId) freeIds.push(q.slotId); B.alForce = (B.alForce || 0) + 1; }
          }
        }
      }
      if (P.breedCare) {
        /* ★ 관리하는 사람 — growth c5639fd6(docs/handoff/growth-breed-tworoom.json · probe_breed_tworoom runMonstera · runAL · runPP)의 손 그대로(총괄 D84)
             ① 등을 셋까지(밝은 뿌리 자리 · 돈이 되는 대로 · 10만 남김)
             ② AL — 쓸모 없는 그루(무지 싹 · 끝난 갈래 · 두 번 찾음)·구근(무늬 어미 아님 · 끝난 갈래)은 판다 · 끝 안 난 갈래의 무늬 어미가 없으면 상점 구근을 화분 6까지 ·
                재우기: 아직 찾을 수 있는 무늬 그루(찾음 < 평생 2 · 찾은 뒤 잎 ≥ 1 · 자람/지는 중)는 7일 평균이 그 그루 min 아래인 가장 어두운 자리에
             ③ 자리 다시 나누기(날마다) — 뿌리내리는 무늬 삽수(그날 빛 가장 밝은 데) → PP → 재울 AL → 흙의 무늬 삽수 → 잎 AL → 구근 · 모주·시루·나머지는 그대로
             ④ PP — 새 잎이 분홍 많음이 아니면 «다음 잎이 분홍 많음일 몫»이 가장 큰 잎 위를 자른다
             ⑤ 몬스테라 삽수 상한 = min(8, 7일 평균 ≥ 3.78(무늬 min × 1.4 · 잎이 나는 빛)인 자리 수) — 넘으면 새로 안 자른다(자르기 손이 B.cap 을 읽음) */
        const lampWon = (ts.rules && ts.rules.lampPriceWon) || 0;
        while ((ts.lamp.owned || 0) < (P.breedLamps || 3) && ts.cashWon >= lampWon + 100_000) {
          try { led('buy', () => buyLamp(ts)); B.lampsBought = (B.lampsBought || 0) + 1; } catch (e) { B.lampErr = String(e && e.message).slice(0, 80); break; } }
        { let rigs = null; try { rigs = light.growLampCount(); } catch (e) { rigs = null; B.lampErr = String(e && e.message).slice(0, 80); }
          const want = Math.min(ts.lamp.owned || 0, Number.isFinite(rigs) ? rigs : 0);
          if (S.lamps.count !== want) { S.lamps.count = want; ts.lamp.placed = want; light.clearCache(); B.lampsOn = want; } }
        const R0 = SPM.speciesRules();
        /* ⑥ PP 가 하나도 없으면(가게 손이 다 판 판 · 바꾸기 걸음) 상점 어린 그루 하나 — 육종 판 진열(species §speciesShopOpen pp_young) · 놓기는 ③ */
        if (!SPM.speciesPotsOf(S).some(q => q && !q.care && q.species === 'pink_princess') && stockOf(S, 'pp_young') === 0 && incomingOf(S, 'pp_young') === 0 &&
            SPM.speciesShopOpen(S, 'pp_young') && ts.cashWon > buyPriceOf('pp_young') + 100_000) { try { ord('pp_young', 1); B.ppBought = (B.ppBought || 0) + 1; } catch (e) { B.ppBuyErr = String(e && e.message).slice(0, 80); } }
        if (stockOf(S, 'pp_young') > 0) { try { SPM.unpackSpeciesStock(S, 'pp_young', stockOf, useStock); } catch (e) { B.ppBuyErr = String(e && e.message).slice(0, 80); } }
        const AL_KINDS = ['marble', 'sector'], AL_MAX_FINDS = BREED_SPEC.alProp.max_finds_lifetime, AL_MIN_SINCE = BREED_SPEC.alProp.min_leaves_since_find, AL_CAP = 6;
        const doneK = k => Jb.varieties.some(v => v.slot === 'al_' + k) || Jb.pending.some(x => x.slot === 'al_' + k);
        const ALS = () => SPM.speciesPotsOf(S).filter(q => q.species === 'alocasia_frydek' && !q.care && q.plant);
        const corms = () => (S.species && S.species.corms) || [];
        for (const q of ALS()) {
          const p = q.plant; if (p.phase === 'corm') continue;
          if (!(!p.varie || doneK(p.varie) || p.finds >= AL_MAX_FINDS) || SPM.speciesSellBlockedReason(q)) continue;
          try { const r = SPM.takeSpeciesForSale(S, q.id); led('other', () => creditSpeciesSale(S, r.won)); B.alSold = (B.alSold || 0) + 1; } catch (e) { B.alSellErr = String(e && e.message).slice(0, 80); }
        }
        for (const c of [...corms()]) {
          if (c.origin === 'from_varie_mother' && AL_KINDS.includes(c.motherKind) && !doneK(c.motherKind)) continue;
          try { const r = SPM.takeCormForSale(S, c.id); led('other', () => creditSpeciesSale(S, r.won)); B.cormSold = (B.cormSold || 0) + 1; } catch (e) { B.cormSellErr = String(e && e.message).slice(0, 80); }
        }
        const sourceOf = k => ALS().some(q => (q.plant.varie === k && q.plant.finds < AL_MAX_FINDS) || (q.plant.phase === 'corm' && q.plant.origin === 'from_varie_mother' && q.plant.motherKind === k))
                              || corms().some(c => c.origin === 'from_varie_mother' && c.motherKind === k);
        for (const c of [...corms()]) if (ALS().length < AL_CAP) { try { SPM.plantCorm(S, c.id); B.cormPlanted = (B.cormPlanted || 0) + 1; } catch (e) { B.cormErr = String(e && e.message).slice(0, 80); } }
        if (stockOf(S, 'al_corm') > 0) { try { SPM.unpackSpeciesStock(S, 'al_corm', stockOf, useStock); } catch (e) { B.cormErr = String(e && e.message).slice(0, 80); } }
        if (AL_KINDS.some(k => !doneK(k) && !sourceOf(k)) && SPM.speciesShopOpen(S, 'al_corm')) {
          const room = AL_CAP - ALS().length - incomingOf(S, 'al_corm') - stockOf(S, 'al_corm') - corms().length;
          for (let i = 0; i < room && ts.cashWon > buyPriceOf('al_corm') + 100_000; i++) { try { ord('al_corm', 1); B.cormsBought = (B.cormsBought || 0) + 1; } catch (e) { B.cormErr = String(e && e.message).slice(0, 80); break; } }
        }
        /* ③ 자리 다시 나누기 */
        { let sky = null; try { sky = light.skyFor(S.day, S.sim); } catch (e) { sky = null; }
          const today = sid => { try { return light.dliOfSlot(sid, lightOptsOf(S, sky)); } catch (e) { return -1; } };
          let fw = null; try { fw = careSpotsOf(S, io); } catch (e) { fw = null; }
          const avg = new Map((fw || []).filter(x => Number.isFinite(x.dli)).map(x => [x.slotId, x.dli]));
          const avgOf = sid => (avg.has(sid) ? avg.get(sid) : today(sid));
          const cuts = cuttingsOf(S).filter(c => c && c.status !== 'dead' && c.varieFromCut && (c.slotId || c.at));
          /* ⚠ 10-24 씨앗 g — «놓인 것»만 나누면 새로 심은 구근 화분이 가방에 남아 하루가 안 갔다(무늬 어미 구근 열 알이 2년 내내 안 싹틈) · 가방의 PP·AL 도 나눈다 */
          const pps = SPM.speciesPotsOf(S).filter(q => q && !q.care && q.species === 'pink_princess');
          const als = ALS();
          const mine = new Set([...cuts.map(c => c.slotId), ...pps.map(q => q.slotId), ...als.map(q => q.slotId)].filter(Boolean));
          const occ = new Set([...placedItems(S).map(x => x.slotId), ...SPM.speciesPotsOf(S).filter(q => SPM.speciesPlaced(q)).map(q => q.slotId)].filter(Boolean));
          const free = new Set((light.room.slots || []).map(x => x.slotId).filter(id => !occ.has(id) || mine.has(id)));
          const take = (list, key, desc, ok = () => true) => { const out = []; for (const it of list) {
            const c = [...free].filter(id => ok(it, id)).sort((a, b) => desc ? key(b) - key(a) : key(a) - key(b))[0]; if (c != null) { free.delete(c); out.push([it, c]); } } return out; };
          const thMin = q => { try { return R0.thresholdsOf(q.plant).min; } catch (e) { return 0; } };
          const forceIt = q => q.plant.varie && !doneK(q.plant.varie) && q.plant.finds < AL_MAX_FINDS && (q.plant.sinceFind ?? 0) >= AL_MIN_SINCE && (q.plant.phase === 'growing' || q.plant.phase === 'dropping');
          /* 깨울 AL·잎 AL 은 «그 그루 min(+0.3)을 넘는 자리 중 가장 덜 밝은 데»(더 밝은 데는 삽수 몫) — 없으면 남은 가장 밝은 데.
               ⚠ 10-24 씨앗 g: 이 차례가 자란 삽수 뒤였을 때 잠든 무늬 그루 넷이 밝은 데를 못 얻어 안 깨고(찾은 뒤 잎 0) 둘째 재우기가 막혔다 */
          const wakeAL = als.filter(q => !forceIt(q) && q.plant.phase !== 'corm');
          const wakePlan = []; for (const q of wakeAL) {
            const ok = [...free].filter(id => avgOf(id) >= thMin(q) + 0.3).sort((x, y) => avgOf(x) - avgOf(y));
            const c = ok[0] ?? [...free].sort((x, y) => avgOf(y) - avgOf(x))[0]; if (c != null) { free.delete(c); wakePlan.push([q, c]); } }
          const plan = [
            ...take(cuts.filter(c => c.status === 'rooting'), today, true),
            ...take(pps, avgOf, true),
            ...take(als.filter(forceIt), avgOf, false, (q, id) => avgOf(id) < thMin(q)),
            ...wakePlan,
            ...take(cuts.filter(c => c.status !== 'rooting'), avgOf, true),
            ...take(als.filter(q => q.plant.phase === 'corm'), avgOf, false)
          ];
          const planned = new Set(plan.map(([it]) => it));
          for (const it of [...cuts, ...pps, ...als]) if (!planned.has(it)) { const c = free.has(it.slotId) ? it.slotId : [...free][0]; if (c != null) { free.delete(c); plan.push([it, c]); } }
          let moves = 0;
          for (const [it] of plan) { if (it.species) { it.slotId = null; it.at = null; } }
          for (const [it, sid] of plan) {
            if (it.species) { SPM.setSpeciesAt(S, it.id, { slotId: sid, at: atOf(light, sid) }); }
            else if (it.slotId !== sid) { try { it.slotId = null; it.at = null; setCuttingAt(S, it, atOf(light, sid), { slots: light.room.slots, size: light.room.size }); moves++; } catch (e) { B.moveErr = String(e && e.message).slice(0, 80); } }
          }
          B.moves = (B.moves || 0) + moves;
          B.cap = Math.min(8, [...avg.values()].filter(v => v >= 3.78).length);
          B.alForce = (B.alForce || 0) + als.filter(forceIt).length;
          /* 가름 — 재울 그루가 실제로 어두운 데(그 그루 min 아래)에 섰나 · AL 꼴(phase:varie:finds:sinceFind) 마지막 모습 */
          for (const [it, sid] of plan) if (it.species === 'alocasia_frydek' && forceIt(it)) { if (avgOf(sid) < thMin(it)) B.alDarkOk = (B.alDarkOk || 0) + 1; else B.alDarkMiss = (B.alDarkMiss || 0) + 1; }
          B.alLook = ALS().map(q => `${q.plant.phase}:${q.plant.varie || '-'}:${q.plant.finds}:${q.plant.sinceFind ?? '?'}:${(thMin(q) || 0).toFixed(1)}`).join(' ');
          B.darkMin = Math.min(...[...avg.values()]);
          if ((S.day - B.openDay) % 15 === 0) {   /* 자국은 늘 적는다(일꾼은 --one 만 받는다) · 찍기는 부모가 --breedtrace 로 */
            let sea = null; try { sea = light.skyFor(S.day, S.sim).season; } catch (e) { sea = null; }
            (B.trace = B.trace || []).push(`${S.day - B.openDay}일 ${sea} AL[${ALS().map(q => `${q.plant.phase[0]}${q.plant.varie ? q.plant.varie[0] : ''}${q.plant.origin === 'from_varie_mother' ? '*' : q.plant.origin === 'shop' ? '$' : ''}${q.plant.finds}${q.plant.sinceFind ?? ''}@${(avgOf(q.slotId) || 0).toFixed(1)}`).join(' ')}] 구근 ${corms().map(c => (c.origin === 'from_varie_mother' ? '*' + (c.motherKind || '?')[0] : c.origin[5])).join('')} 들어옴 ${incomingOf(S, 'al_corm')} 재고 ${stockOf(S, 'al_corm')} 돈 ${Math.round(ts.cashWon / 1000)}k`);
          }
        }
        ppHeavyCut();   /* ④ */
      }
      if (ts.cashWon < B.minCash) B.minCash = ts.cashWon;
      if (B.brokeOn == null && (ts.bankrupt || ts.cashWon <= 0)) B.brokeOn = S.day - B.openDay;
      B.samples = Jb.sampleCount; B.varieties = Jb.varieties.length;
      /* ★ 총괄 D88 ① 가름 — 무늬 마디 삽수(산 것) 첫날 · 1년 · 2년 · 가장 많을 때 · 연 뒤 다시 자르기(삽수에서) · 몬스테라 칸 셈(밝기별 서로 다른 삽수) */
      { const g = B.g = B.g || { cormFound: {}, cormSeen: {}, alSleeps: 0, alSleepCorms: 0, sprout: {} }, dd = S.day - B.openDay;
        const live = cuttingsOf(S).filter(c => c && c.status !== 'dead' && c.varieFromCut);
        g.vc = g.vc || {}; if (g.vc.d0 == null) g.vc.d0 = live.length; if (dd === 365) g.vc.d365 = live.length; if (dd === 729) g.vc.d730 = live.length;
        g.vcMax = Math.max(g.vcMax || 0, live.length);
        if (g.recut0 == null) g.recut0 = out.recut.ok; g.recut = out.recut.ok - g.recut0;
        g.rootedBand = {}; for (const c of live) if (c.varieLightBand) g.rootedBand[c.varieLightBand] = (g.rootedBand[c.varieLightBand] || 0) + 1;
        g.mRepro = {}; for (const id of ['monstera_halfmoon', 'monstera_fullmoon', 'al_marble', 'al_sector', 'pp_heavy']) { const box = Jb.repro[id] || {}; g.mRepro[id] = Object.fromEntries(Object.entries(box).map(([k, r]) => [k, (r && r.n) || 0])); }
        if (B.knowShopCorm != null && S.day >= B.knowShopCorm) g.cormAfterHint = (B.shopCormsBought || 0); }
      B.tally = Jb.tally; B.lines = ['monstera', 'al', 'pp'].filter(k => Object.keys(Jb.tally[k] || {}).length).length;
      /* 가름 — 칸마다 같은 조건 셈(가장 큰 것) · 뿌리 밝기별 뿌리낸 무늬 삽수(서로 다른) · 무늬 AL(그 판에 있었던) · 그날 방에서 가장 밝은 자리 DLI */
      B.repro = Object.fromEntries(Object.entries(Jb.repro).map(([k, box]) => [k, Math.max(0, ...Object.values(box).map(r => (r && r.n) || 0))]));
      B.rooted = B.rooted || {}; for (const c of cuttingsOf(S)) if (c && c.varieFromCut && c.varieLightBand) (B.rooted[c.varieLightBand] = B.rooted[c.varieLightBand] || {})[c.id] = 1;   /* 일꾼 사이 JSON — Set 대신 객체 */
      B.alVarie = B.alVarie || {}; for (const q of SPM.speciesPotsOf(S)) if (q.species === 'alocasia_frydek' && q.plant && q.plant.varie) B.alVarie[q.id] = 1;
      if ((S.day - B.openDay) % 7 === 0) { let sky = null; try { sky = light.skyFor(S.day, S.sim); } catch (e) { sky = null; } let mx = -1; for (const sl of light.room.slots || []) { let d = -1; try { d = light.dliOfSlot(sl.slotId, lightOptsOf(S, sky)); } catch (e) { d = -1; } if (d > mx) mx = d; } (B.maxDli = B.maxDli || []).push(+mx.toFixed(2)); }
      if (S.day - B.openDay >= (P.shopDays || 730)) { B.cashEnd = ts.cashWon; out.endDay = S.day; break; }
    }
    /* ★ B «돌봄 사람» — 날마다: 맡김 사건을 센다 · 나은 것은 돌려준다 · 맡은 그루를 고장대로(읽는 사람) 또는 가장 밝은 데(대조) */
    if (out.care) {
      const C = out.care, Jc = JCARE.jobCareOf(S), R2 = SPM.speciesRules();
      const bp = id => (C.byProblem[id] = C.byProblem[id] || { given: 0, saved: 0, expired: 0, days: [] });
      for (const e of ((turn && turn.events) || [])) {
        if (!e) continue;
        if (e.id === 'care_new') { bp(e.problem).given++; (C.openedOn = C.openedOn || {})[e.requestId] = S.day; }
        if (e.id === 'care_expired') bp(e.problem).expired++;
        if (e.id === 'care_return' && e.auto) { bp(e.problem).saved++; C.wonTotal += e.won || 0; }
        if (e.id === 'care_saved') { const o = (C.openedOn || {})[e.requestId]; if (o != null) bp(e.problem).days.push(S.day - o); }
        if (e.id === 'care_milestone') C.ms[e.n] = S.day - C.openDay;
        if (e.id === 'care_ending') C.endedAt = S.day - C.openDay;
        /* 사진 단계 «전날» 세이브 — 처음 나은 날 · 살린 10(칠판 간판 — 돌려준 날) · 끝맺음 */
        const cst = e.id === 'care_saved' ? 'careSaved' : e.id === 'care_ending' ? 'careEnd' : null;
        if (cst) { dump(cst); if (preSave && !dumped.has(cst + '_pre')) { dumped.add(cst + '_pre'); try { fs.writeFileSync(path.join(opt.dump, `${name}_${seed}_${cst}_pre.json`), preSave); (out.dumps = out.dumps || {})[cst + '_pre'] = { day: S.day - 1 }; } catch (er) { (out.dumpErr = out.dumpErr || {})[cst + '_pre'] = String(er && er.message || er).slice(0, 200); } } }
      }
      /* 살린 10 은 돌려주는 손에서 난다 — 그 «전날» = 오늘 아침 세이브(preSave) · 나은 것이 아홉 번째 돌려준 뒤라야 */
      const care10Pre = preSave && Jc.saved === 9 && Jc.requests.some(r => r.savedOn != null) && !dumped.has('care10_pre');
      if (care10Pre) { dumped.add('care10_pre'); try { fs.writeFileSync(path.join(opt.dump, `${name}_${seed}_care10_pre.json`), preSave); (out.dumps = out.dumps || {}).care10_pre = { day: S.day - 1 }; } catch (er) { (out.dumpErr = out.dumpErr || {}).care10_pre = String(er && er.message || er).slice(0, 200); } }
      /* 첫 맡김(돌봄 첫날)은 사건 목록 밖에서 났다 */
      for (const r of Jc.requests) if (!(C.openedOn || {})[r.id]) { (C.openedOn = C.openedOn || {})[r.id] = r.openedOn; bp(r.problem).given++; }
      /* 나은 것 — 바로 돌려준다 */
      for (const r of [...Jc.requests]) if (r.savedOn != null) {
        try { const ret = JCARE.returnCare(S, r.id); led('other', () => creditShopOrder(S, ret.won)); C.wonTotal += ret.won; bp(r.problem).saved++;
              for (const e of ret.events) if (e.id === 'care_milestone') C.ms[e.n] = S.day - C.openDay; } catch (e) { C.retErr = String(e && e.message).slice(0, 80); }
      }
      /* 자리 — 오늘부터 7일 평균 빛(가드와 같은 자) · 빈 자리 = 모주·삽수·새 종이 안 앉은 자리 */
      const spots = (careSpotsOf(S, io) || []).filter(x => Number.isFinite(x.dli));
      const occ = new Set([...placedItems(S).map(x => x.slotId), ...SPM.speciesPotsOf(S).filter(q => SPM.speciesPlaced(q)).map(q => q.slotId)].filter(Boolean));
      const put = (q, sl) => { if (!sl || q.slotId === sl.slotId) return; occ.delete(q.slotId); SPM.setSpeciesAt(S, q.id, { slotId: sl.slotId, at: atOf(light, sl.slotId), dropM: sl.dropM }); occ.add(sl.slotId); };
      const free = q => spots.filter(x => !occ.has(x.slotId) || x.slotId === q.slotId);
      const fitOf = (q, x) => { try { return R2.spotFitOf(q.plant, x.dli); } catch { return 'dark'; } };
      for (const r of Jc.requests) {
        const q = SPM.speciesPotOf(S, r.potId); if (!q) continue;
        const cand = free(q);
        if (!P.careRead) { if (!SPM.speciesPlaced(q)) put(q, cand.sort((a, b) => b.dli - a.dli)[0]); continue; }
        const band = R2.bandOf(q.species), mid = (band.lo + band.hi) / 2;
        const L0 = Number.isFinite(r.lengthM0) ? r.lengthM0 : 0;
        let want = null;
        if (r.problem === 'ca_bright' || r.problem === 'ca_dark') {
          const ok = cand.filter(x => fitOf(q, x) === 'fit'); want = (ok.length ? ok : cand.filter(x => fitOf(q, x) === 'slow')).sort((a, b) => Math.abs(a.dli - mid) - Math.abs(b.dli - mid))[0];
        } else if (r.problem === 'pp_tip' || r.problem === 'pp_green') {
          if (!q.care.cutDone) {
            const nodes = SPM.ppCuttableNodes(q);
            /* 끝 시듦 — 분홍 줄 아래(맨 아래 마디 위) · 분홍 빠짐 — 분홍이 남은 가장 높은 마디 위 */
            const n = r.problem === 'pp_tip' ? nodes[0] : nodes.filter(x => x.grade !== 'green').pop();
            if (n) { try { SPM.cutSpecies(S, q.id, n.no); q.care.cutDone = true; } catch (e) { C.cutErr = String(e && e.message).slice(0, 80); } }
          }
          want = cand.filter(x => ['fit', 'over'].includes(fitOf(q, x))).sort((a, b) => b.dli - a.dli)[0] || cand.sort((a, b) => b.dli - a.dli)[0];
        } else if (r.problem === 'al_dark' || r.problem === 'al_winter') {
          want = cand.filter(x => fitOf(q, x) === 'fit').sort((a, b) => b.dli - a.dli)[0] || cand.filter(x => fitOf(q, x) !== 'dark').sort((a, b) => b.dli - a.dli)[0];
        } else if (r.problem === 'sc_floor') {
          want = cand.filter(x => Number.isFinite(x.dropM) && R2.scStemCapM(x.dropM) > L0 + 1e-9 && fitOf(q, x) !== 'dark').sort((a, b) => b.dropM - a.dropM)[0];
        } else if (r.problem === 'sc_plain') {
          want = cand.filter(x => Number.isFinite(x.dropM) && R2.scStemCapM(x.dropM) > L0 + 1e-9 && ['fit', 'over'].includes(fitOf(q, x))).sort((a, b) => b.dli - a.dli)[0];
        }
        /* 지금 자리가 이미 맞으면 안 옮긴다(날씨로 흔들리는 평균에 끌려다니지 않게) */
        const here = SPM.speciesPlaced(q) ? spots.find(x => x.slotId === q.slotId) : null;
        const hereOk = here && (r.problem.startsWith('ca_') ? fitOf(q, here) === 'fit' : r.problem.startsWith('al_') ? fitOf(q, here) !== 'dark'
                      : r.problem === 'sc_floor' ? R2.scStemCapM(here.dropM) > L0 + 1e-9 : ['fit', 'over'].includes(fitOf(q, here)));
        if (!hereOk) put(q, want || (!SPM.speciesPlaced(q) ? cand.sort((a, b) => b.dli - a.dli)[0] : null));
      }
      C.saved = Jc.saved; C.expired = Jc.expired;
      if (C.brokeOn == null && (ts.bankrupt || ts.cashWon <= 0)) C.brokeOn = S.day - C.openDay;
      if (S.day - C.openDay >= (P.shopDays || 730)) { C.cashEnd = ts.cashWon; out.endDay = S.day; break; }
    }
    /* ★ D59 «가게 사람» — 가게를 연 뒤: 날마다 맞는 것이 있는 주문을 납품(가장 싼 후보부터 — 값진 것은 남긴다) · 기한 지남은 사건으로 센다 */
    if (out.shop) {
      for (const e of ((turn && turn.events) || [])) {
        if (e && e.id === 'order_expired') { const k = `${e.kind}/${e.tier}${e.need && e.need.grade ? '/' + e.need.grade : e.need && e.need.leaves ? '/잎' + e.need.leaves : ''}`; out.shop.expiredKinds[k] = (out.shop.expiredKinds[k] || 0) + 1;
          if (process.env.SHOP_DEBUG && e.kind === 'al') { let sky = null; try { sky = light.skyFor(S.day, S.sim); } catch { }
            const od = (e.orderId && out.shop.alOpen && out.shop.alOpen[e.orderId]) || null;
            console.error('[al 기한]', S.day, 'opened', od && od.day, od && od.season, 'lamps', S.lamps.count, JSON.stringify(SPM.speciesPotsOf(S).filter(q => q.species === 'alocasia_frydek').map(q => ({ id: q.id, o: q.origin, ph: q.plant.phase, L: (q.plant.leaves || []).length, slot: q.slotId,
              dli: q.slotId ? +(() => { try { return light.dliOfSlot(q.slotId, lightOptsOf(S, sky)); } catch { return -1; } })().toFixed(2) : null })))); } }
        if (e && e.id === 'order_new' && e.kind === 'al') { let sea = null; try { sea = light.skyFor(S.day, S.sim).season; } catch { } (out.shop.alOpen = out.shop.alOpen || {})[e.orderId] = { day: S.day, season: sea }; }
        /* 따라 하는 사람 — AL 주문이 붙으면 구근 하나 더(지갑 > 구근값 + 관리비 한 달) */
        if (P.shopFollow && e && e.id === 'order_new' && (e.kind === 'al' || e.kind === 'al_corm') && SPM.speciesShopOpen(S, 'al_corm') &&
            ts.cashWon > buyPriceOf('al_corm') + 80_000) { try { ord('al_corm', 1); out.shop.cormMore = (out.shop.cormMore || 0) + 1; } catch { } }
        if (e && e.id === 'order_new') { const k = `${e.kind}/${e.tier}`; (out.shop.newKinds = out.shop.newKinds || {})[k] = (out.shop.newKinds[k] || 0) + 1; shopMonth().newN = (shopMonth().newN || 0) + 1; }
        if (e && e.id === 'order_expired') shopMonth().expN = (shopMonth().expN || 0) + 1;
        /* ★ D71 — 둘째 두 종 사건 날(연 날부터) · 사진 단계(sc5 · ca8 · caSaved) */
        if (e && /^(sc_ask|sc_rooted|ca_care|ca_saved|shop_ending)$/.test(e.id)) {
          const ev2 = out.shop.ev2 = out.shop.ev2 || {};
          if (ev2[e.id] == null) ev2[e.id] = S.day - out.shop.openDay;
          const st = e.id === 'sc_ask' ? 'sc5' : e.id === 'ca_care' ? 'ca8' : e.id === 'ca_saved' ? 'caSaved' : e.id === 'shop_ending' ? 'end30' : null;
          if (st) { dump(st); if (preSave && !dumped.has(st + '_pre')) { dumped.add(st + '_pre'); try { fs.writeFileSync(path.join(opt.dump, `${name}_${seed}_${st}_pre.json`), preSave); (out.dumps = out.dumps || {})[st + '_pre'] = { day: S.day - 1 }; } catch (er) { (out.dumpErr = out.dumpErr || {})[st + '_pre'] = String(er && er.message || er).slice(0, 200); } } }
        }
      }
      const J = JSHOP.jobShopOf(S);
      for (const o of [...J.orders]) {
        const keepSC = P.sp2 && out.sp2 && out.sp2.keeper && SPM.speciesPotsOf(S).filter(q => q.species === 'scindapsus').length < 2 ? out.sp2.keeper : null;
        const cands = JSHOP.candidatesFor(S, o).filter(c => !(keepSC && c.ref.type === 'species' && c.ref.id === keepSC)).sort((a, b) => a.won - b.won);
        if (!cands.length) continue;
        try { const r = JSHOP.deliverOrder(S, o.id, cands[0].ref); led('other', () => creditShopOrder(S, r.won)); shopMonth().orders += r.won; shopMonth().done += 1; out.shop.done++; out.shop.wonTotal += r.won; out.shop.doneKinds[o.kind] = (out.shop.doneKinds[o.kind] || 0) + 1;
              (out.shop.wonKinds = out.shop.wonKinds || {})[o.kind] = (out.shop.wonKinds[o.kind] || 0) + r.won; } catch { }
      }
      out.shop.regulars = J.regulars.length; out.shop.sign = J.milestones[10] != null ? J.milestones[10] - out.shop.openDay : null;
      out.shop.ms3 = J.milestones[3] != null ? J.milestones[3] - out.shop.openDay : null;
      out.shop.ms30 = J.milestones[30] != null ? J.milestones[30] - out.shop.openDay : null;   /* 단골 30 — 가게 끝맺음(D75) */
      { const sm = shopMonth(); sm.cashEnd = ts.cashWon; sm.regulars = J.regulars.length; sm.saved += ((turn && turn.tutorial && turn.tutorial.savedWon) || 0);
        /* 달말 가진 것 — 보낼 것이 남았나(주문 원천) */
        const cl = cuttingsOf(S).filter(c => c && c.status !== 'dead'), spp = SPM.speciesPotsOf(S);
        sm.stock = { pot: (S.pots || []).length, cut: cl.filter(c => c.status !== 'established').length, est: cl.filter(c => c.status === 'established').length,
                     pp: spp.filter(q => q.species === 'pink_princess').length, al: spp.filter(q => q.species === 'alocasia_frydek' && q.plant && (q.plant.leaves || []).length).length,
                     sc: spp.filter(q => q.species === 'scindapsus').length, ca: spp.filter(q => q.species === 'calathea').length, open: J.orders.length,
                     cutOpen: (S.cutOpenToday && S.cutOpenToday.n) || 0,
                     mLeaves: (() => { try { const st = pot0(S) && io.growth.leafStats ? io.growth.leafStats() : null; return st ? (st.total ?? st.leaves ?? null) : null; } catch { return null; } })(),
                     mDli: (() => { try { const p0 = pot0(S); if (!p0 || !p0.slotId) return null; const sky = light.skyFor(S.day, S.sim); return +light.dliOfSlot(p0.slotId, lightOptsOf(S, sky)).toFixed(1); } catch { return null; } })(),
                     lamps: (S.lamps && S.lamps.count) || 0 };
        sm.expired = J.expired - (out.shop._exp0 || 0); }
      for (const n of [5, 8]) if (out.shop['reg' + n] == null && J.regulars.length >= n) out.shop['reg' + n] = S.day - out.shop.openDay;   /* D71 들이는 때 */
      if (P.sp2) { const q2 = questSnapshotOf(S, io); if (out.shop.longVineOn == null && q2.scLongVine >= 1) out.shop.longVineOn = S.day - out.shop.openDay; }
      out.shop.expired = J.expired;
      if (out.shop.brokeOn == null && (ts.bankrupt || ts.cashWon <= 0)) out.shop.brokeOn = S.day - out.shop.openDay;   /* 연 뒤 첫 0원(날) */
      if (S.day - out.shop.openDay === 30) dump('shop30');
      if (S.day - out.shop.openDay >= (P.shopDays || 365)) { out.shop.cashEnd = ts.cashWon; out.endDay = S.day; break; }
    }
  }
  /* 끝까지 안 풀린 막힘 */
  if (out.sw) out.sw.signEnd = { shop: S.jobShop ? S.jobShop.signOnDay : null, care: S.jobCare ? S.jobCare.signOnDay : null, by: questSnapshotOf(S, io).signBy ?? null };
  if (out.sw) out.sw.restDone = out.sw.rest.map(R => ({ job: R.job, n: R.ids.length, endedBy: R.endedBy || null, left: R.leftAfterDue ?? null, newOpen: R.newOpen || 0, rolled: !!R.rolled }));
  for (const [id, q] of qOpen) if (q.run >= STUCK_DAYS) out.stuck.push({ id, from: q.since, days: q.run, room: S.home.room, open: true });
  out.lastDay = S.day; out.cashEnd = ts.cashWon;
  if (opt.trace && out._trace) {
    const dir = path.join(ROOT, 'tools', '_out', 'trace'); fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `${name}_${seed}.json`);
    fs.writeFileSync(f, JSON.stringify({ name, seed, moveDay: out.moveDay, days: out._trace }));
    out.traceFile = path.relative(ROOT, f);
  }
  delete out._trace; delete out._qDone; delete out._qEv; delete out._chip;
  out.neighborOrderDay = ts.neighborOrderDay ?? null;   /* D35 반찬가게 주문이 난 날 */
  return out;
}

/* ══ 자식 판(--one) ══ */
if (arg('one', null)) {
  const o = JSON.parse(arg('one'));
  if (o.legacyPantry) setPantryLegacyRule(true);   /* ★ D93 ⑤ 옛 곳간 규칙(14끼 · 앞에서부터)과 견주기 */
  const r = await play(o.name, o.seed, o);
  process.stdout.write(JSON.stringify(r) + '\n');
  process.exit(0);
}

/* ══ 여러 판 — node 자식 프로세스로 같이(램 규칙: 크롬 없음) ══ */
const NAMES = arg('persona', null) ? list(arg('persona')) : Object.keys(PERSONAS);
const SEEDS = range(arg('seeds', 'g,1-5'));
const TARGETS = list(arg('targets', '5000000,10000000')).map(Number);
const DAYS = Number(arg('days', 660));
const JOBS = Number(arg('jobs', 4));
const SELF = fileURLToPath(import.meta.url);
const RENT = arg('rent', null) == null ? null : Number(arg('rent'));
const GRADES = arg('grades', null);
const BOOST = arg('boost', null) == null ? null : Number(arg('boost'));
const MOVECOST = arg('movecost', null) == null ? null : Number(arg('movecost'));
const CROPMULT = arg('cropmult', null) == null ? null : Number(arg('cropmult'));
const TRACE = !!arg('trace', false);
const LEGACY_SEAT = !!arg('legacy-seat', false);   /* ★ D92 ㉯ — 이사 뒤 작물을 옛 손(sill:0 한 점)으로 · 옛 숫자와 견주기 */
const LEGACY_PANTRY = !!arg('legacy-pantry', false);   /* ★ D93 ⑤ — 곳간을 옛 규칙(14끼 · 앞에서 n판)으로 · 옛 숫자와 견주기 */
const tasks = NAMES.flatMap(name => SEEDS.map(seed => ({ name, seed, targets: TARGETS, days: DAYS, noprologue: !!arg('noprologue', false), nodoor: !!arg('nodoor', false),
                                                         ...(Number.isFinite(RENT) ? { rent: RENT } : {}), ...(GRADES ? { grades: GRADES } : {}),
                                                         ...(Number.isFinite(BOOST) ? { boost: BOOST } : {}), ...(TRACE ? { trace: true } : {}),
                                                         ...(Number.isFinite(MOVECOST) ? { movecost: MOVECOST } : {}),
                                                         ...(Number.isFinite(CROPMULT) ? { cropmult: CROPMULT } : {}),
                                                         ...(LEGACY_SEAT ? { legacySeat: true } : {}),
                                                         ...(LEGACY_PANTRY ? { legacyPantry: true } : {}) })));
const results = [];
let next = 0;
async function worker() {
  while (next < tasks.length) {
    const t = tasks[next++];
    const r = await new Promise(res => {
      const ch = spawn(process.execPath, [SELF, '--one', JSON.stringify(t)], { stdio: ['ignore', 'pipe', 'pipe'] });
      let buf = '', err = '';
      ch.stdout.on('data', d => buf += d); ch.stderr.on('data', d => err += d);
      ch.on('close', () => { try { res(JSON.parse(buf.trim().split('\n').pop())); } catch { res({ ...t, crash: (err || buf).slice(-300) }); } });
    });
    results.push(r);
    process.stderr.write(`  · ${t.name} ${t.seed} — 이사 ${r.moveDay ?? '-'} · 굶음 ${r.starvedDay ?? '-'} · 엔딩 ${r.endDay ?? '-'}\n`);
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: Math.max(1, JOBS) }, worker));
const med = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
/* 90% — 닿은 판 가운데 90% 가 이 날까지 닿았다(못 닿은 판은 안 셈 · 닿은 판 수를 같이 읽을 것) */
const p90 = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)] : null; };
const won = v => (v == null ? '—' : Math.round(v).toLocaleString());
console.log(`■ 갈래 판 — 사람 ${NAMES.length} × 씨앗 ${SEEDS.length} · 최대 ${DAYS}일 · 목표 가정 ${TARGETS.map(won).join('/')} · ${Math.round((Date.now() - t0) / 1000)}초`);
console.log('  (월세·규칙은 지금 게임 그대로 · 엔딩 목표만 가정값 · 막힘 = 열려 있고 «기다림»도 아닌데 14일 넘게 안 풀린 퀘스트)');
for (const name of NAMES) {
  const rs = results.filter(r => r.name === name);
  const N = rs.length, P = PERSONAS[name];
  const crash = rs.filter(r => r.crash);
  const stuckBy = {}; for (const r of rs) for (const s of (r.stuck || [])) { const k = `${s.id}(${s.room === 'oneroom' ? '원룸' : '반지하'})`; stuckBy[k] = (stuckBy[k] || 0) + 1; }
  const why = room => { const t = {}; for (const r of rs) for (const [k, v] of Object.entries((r.cutWhy || {})[room] || {})) t[k] = (t[k] || 0) + v;
                        const tot = Object.values(t).reduce((a, b) => a + b, 0) || 1;
                        return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${Math.round(v / tot * 100)}%`).join(' · '); };
  const recut = rs.reduce((a, r) => ({ tried: a.tried + ((r.recut || {}).tried || 0), ok: a.ok + ((r.recut || {}).ok || 0) }), { tried: 0, ok: 0 });
  const recutWhy = {}; for (const r of rs) for (const [k, v] of Object.entries((r.recut || {}).why || {})) recutWhy[k] = (recutWhy[k] || 0) + v;
  console.log(`\n■ ${name} · ${P.ko} (등 ${P.lamps} · 시루 ${P.siruCap} · 자르기 ${P.cut} · 모주 ${P.sellMother} · 이사 ${P.move} · 게으름 ${P.lazy})`);
  if (crash.length) console.log(`  ⚠ 깨진 판 ${crash.length}/${N} — ${crash[0].crash}`);
  console.log(`  이사 ${rs.filter(r => r.moveDay != null).length}/${N}(중앙 ${med(rs.map(r => r.moveDay))}일) · 첫 0원 ${rs.filter(r => r.firstBrokeDay != null).length}/${N}(중앙 ${med(rs.map(r => r.firstBrokeDay))}일) · ` +
              `★굶음 ${rs.filter(r => r.starvedDay != null).length}/${N}(중앙 ${med(rs.map(r => r.starvedDay))}일) · 엔딩 둘 다 ${rs.filter(r => r.endDay != null).length}/${N}`);
  /* ★ 총괄 14:25 ③ — D9(엔딩 금액) 판단용: 목표마다 «현금 닿는 날» 중앙·90% 와 «이사 뒤 날수» 중앙·90% */
  for (const t of TARGETS) {
    const hit = rs.filter(r => (r.reach || {})[t] != null);
    const d = hit.map(r => r.reach[t]), after = hit.map(r => r.reach[t] - r.moveDay);
    console.log(`  ◇ ${won(t)} 현금 — ${hit.length}/${N} · 날 중앙 ${med(d) ?? '—'} · 90% ${p90(d) ?? '—'} · 이사 뒤 중앙 ${med(after) ?? '—'} · 90% ${p90(after) ?? '—'}`);
  }
  console.log('  엔딩 닿은 날(현금 · 다 팔면) — ' + TARGETS.map(t => `${won(t)}: ${rs.filter(r => (r.reach || {})[t] != null).length}/${N} 중앙 ${med(rs.map(r => (r.reach || {})[t]))} · 다팔면 ${rs.filter(r => (r.reachNet || {})[t] != null).length}/${N} 중앙 ${med(rs.map(r => (r.reachNet || {})[t]))}`).join(' | '));
  /* D8 — 이사 뒤 살림(월세 후보 판정용): 이사 뒤 첫 0원 · 굶음 · 이사 뒤 최저 지갑 중앙 */
  { const mv = rs.filter(r => r.moveDay != null);
    if (mv.length) console.log(`  ▣ 이사 뒤 — 월세 ${won(mv[0].rentWon ?? null)} · 첫 0원 ${mv.filter(r => r.firstBrokeAfterMove != null).length}/${mv.length}` +
                               `(그중 구호금으로 메움 ${mv.filter(r => r.reliefAfterMove != null).length} · 이사 뒤 날 중앙 ${med(mv.filter(r => r.firstBrokeAfterMove != null).map(r => r.firstBrokeAfterMove - r.moveDay)) ?? '—'})` +
                               ` · 굶음 ${mv.filter(r => r.starvedDay != null).length}/${mv.length} · 최저 지갑 중앙 ${won(med(mv.map(r => r.minCashAfterMove)))}` +
                               ` · 제일 낮은 판 ${won(Math.min(...mv.map(r => r.minCashAfterMove ?? Infinity)))}`); }
  /* 대사 — 이사 뒤 말 없는 날(story.turn · 퀘스트 사건 둘 다 빈 날) · 최장 침묵 */
  { const mv = rs.filter(r => r.moveDay != null && r.talk && r.talk.daysAfterMove);
    if (mv.length) console.log(`  ✎ 이사 뒤 대사 — 날 중앙 ${med(mv.map(r => r.talk.daysAfterMove))} · 말 없는 날 중앙 ${med(mv.map(r => r.talk.silentAfterMove))}` +
                               `(${Math.round(100 * med(mv.map(r => r.talk.silentAfterMove / r.talk.daysAfterMove)))}%) · 최장 침묵 중앙 ${med(mv.map(r => r.talk.longestSilence))}일 · 제일 긴 판 ${Math.max(...mv.map(r => r.talk.longestSilence))}일` +
                               ` · 줄 수 중앙 ${med(mv.map(r => r.talk.linesAfterMove))}`);
    const tot = {}; for (const r of mv) for (const [k, v] of Object.entries(r.talk.ids || {})) tot[k] = (tot[k] || 0) + v;
    const top = Object.entries(tot).sort((a, b) => b[1] - a[1]);
    if (top.length) console.log(`    줄 종류 ${top.length} · 판당 자주 나온 줄: ` + top.slice(0, 8).map(([k, v]) => `${k} ${Math.round(v / mv.length)}`).join(' · '));
    /* «지금 할 일» 칩 — 이사 뒤 머문 날(판당) · 원룸 줄이 열린 날(이사 뒤 · 중앙 · 열린 판 수) */
    const chip = {}; for (const r of mv) for (const [k, v] of Object.entries(r.chipDays || {})) chip[k] = (chip[k] || 0) + v;
    const ct = Object.entries(chip).sort((a, b) => b[1] - a[1]);
    if (ct.length) console.log(`    칩(지금 할 일) 이사 뒤 머문 날 · 판당: ` + ct.slice(0, 6).map(([k, v]) => `${k} ${Math.round(v / mv.length)}`).join(' · '));
    const oq = ['oneroom_settle_cutting', 'oneroom_sell', 'oneroom_home_fund'];
    console.log(`    원룸 줄 열린 날(이사 뒤 중앙 · 열린 판) — ` + oq.map(id => { const h = mv.filter(r => (r.questOpen || {})[id] != null);
      return `${id} ${med(h.map(r => r.questOpen[id] - r.moveDay)) ?? '—'}일 ${h.length}/${mv.length}`; }).join(' · ')); }
  /* ★ 무늬 삽수 판매 — 반지하 첫 판매 날 · 원룸 판매 간격(중앙) · 등급 나눔(팔린 삽수의 무늬 잎 등급 · 판 전체 합) */
  { const vs = rs.filter(r => (r.varieSales || []).length);
    const first = vs.map(r => (r.varieSales.find(x => x.room === 'banjiha') || {}).day).filter(x => x != null);
    const gaps = []; for (const r of vs) { const d = r.varieSales.filter(x => x.room === 'oneroom').map(x => x.day); const all = [r.moveDay, ...d];
                                           for (let i = 1; i < all.length; i++) gaps.push(all[i] - all[i - 1]); }
    const gc = {}; let unk = 0; for (const r of vs) for (const x of r.varieSales) { if (!x.grades || !x.grades.length) { unk++; continue; } for (const g of x.grades) gc[g] = (gc[g] || 0) + 1; }
    const n1 = rs.reduce((a, r) => a + (r.varieSales || []).filter(x => x.room === 'oneroom').length, 0);
    console.log(`  ◆ 무늬 삽수 판매 — 반지하 첫 판매 중앙 ${med(first) ?? '—'}일(${first.length}/${N}) · 원룸 판매 판당 ${(n1 / N).toFixed(1)}개 · 간격 중앙 ${med(gaps) ?? '—'}일` +
                ` · 등급(잎) ${Object.entries(gc).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}${unk ? ` · 등급 모름 ${unk}개` : ''}` +
                ` · 값 평균 ${won(Math.round(vs.flatMap(r => r.varieSales.map(x => x.won)).reduce((a, b) => a + b, 0) / Math.max(1, vs.reduce((a, r) => a + r.varieSales.length, 0))))}`); }
  /* ★ D45 새 두 종(guide45) — 교환한 날 · 구근 산 날 · 자른 수 · 판 수·값 · 가방에 갇힌 그루-날(빈 창턱 없음) */
  { const sp = rs.filter(r => r.sp);
    if (sp.length) {
      const m = k => med(sp.map(r => r.sp[k]).filter(x => x != null));
      console.log(`  🌸 새 두 종 — 교환 판 ${sp.filter(r => r.sp.trade != null).length}/${N}(이사 뒤 중앙 ${med(sp.filter(r => r.sp.trade != null).map(r => r.sp.trade - r.moveDay)) ?? '—'}일) · ` +
                  `구근 산 판 ${sp.filter(r => r.sp.cormBuy != null).length} · PP 자름 판당 ${(sp.reduce((a, r) => a + r.sp.cuts, 0) / N).toFixed(1)} · ` +
                  `판 것 판당 ${(sp.reduce((a, r) => a + r.sp.sold, 0) / N).toFixed(1)}개 · ${won(Math.round(sp.reduce((a, r) => a + r.sp.soldWon, 0) / N))}/판 · ` +
                  `찾은 구근 심음 판당 ${(sp.reduce((a, r) => a + r.sp.found, 0) / N).toFixed(1)} · 되판 구근 판당 ${(sp.reduce((a, r) => a + (r.sp.cormSold || 0), 0) / N).toFixed(1)} · ` +
                  `가방에 갇힌 그루-날 판당 ${Math.round(sp.reduce((a, r) => a + r.sp.bagDays, 0) / N)}`);
    } }
  /* ★ D59 «가게 사람» — 주문 맞춤 몫 · 단골 3/10 까지 날 · 못 맞춘 주문 kind */
  { const sh = rs.filter(r => r.shop);
    if (sh.length || rs.some(r => r.shopErr)) {
      const done = sh.reduce((a, r) => a + r.shop.done, 0), exp = sh.reduce((a, r) => a + r.shop.expired, 0);
      const kinds = {}; for (const r of sh) for (const [k, v] of Object.entries(r.shop.doneKinds || {})) kinds[k] = (kinds[k] || 0) + v;
      console.log(`  🪧 가게 — 연 판 ${sh.length}/${N}${rs.some(r => r.shopErr) ? ` · ⚠ ${rs.filter(r => r.shopErr).map(r => r.shopErr).slice(0, 1)}` : ''} · 연 날 중앙 ${med(sh.map(r => r.shop.openDay)) ?? '—'} · ` +
                  `맞춤 몫 ${done + exp ? Math.round(done / (done + exp) * 100) : '—'}%(납품 ${done} · 기한 지남 ${exp}) · 판당 받은 돈 ${won(Math.round(sh.reduce((a, r) => a + r.shop.wonTotal, 0) / Math.max(1, sh.length)))} · ` +
                  `단골 3명까지 중앙 ${med(sh.map(r => r.shop.ms3)) ?? '—'}일 · 10명(간판) ${sh.filter(r => r.shop.sign != null).length}/${sh.length} 중앙 ${med(sh.map(r => r.shop.sign)) ?? '—'}일 · 1년 뒤 단골 중앙 ${med(sh.map(r => r.shop.regulars)) ?? '—'} · ` +
                  `납품 kind ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`);
      const ek = {}; for (const r of sh) for (const [k, v] of Object.entries(r.shop.expiredKinds || {})) ek[k] = (ek[k] || 0) + v;
      const nk = {}; for (const r of sh) for (const [k, v] of Object.entries(r.shop.newKinds || {})) nk[k] = (nk[k] || 0) + v;
      const ao = sh.map(r => r.shop.atOpen || {});
      console.log(`    지갑 — 연 날 중앙 ${won(med(sh.map(r => r.shop.cashAtOpen)) ?? 0)} · 1년 뒤 중앙 ${won(med(sh.map(r => r.shop.cashEnd).filter(Number.isFinite)) ?? 0)} · ` +
                  `연 뒤 첫 0원 ${sh.filter(r => r.shop.brokeOn != null).length}/${sh.length}(중앙 ${med(sh.map(r => r.shop.brokeOn).filter(v => v != null)) ?? '—'}일) · ` +
                  `연 날 모주 자리 DLI 중앙 ${med(ao.map(a => a.potDli).filter(Number.isFinite)) ?? '—'} · 산 삽수 중앙 ${med(ao.map(a => a.cuts).filter(Number.isFinite)) ?? '—'} · ` +
                  `«새 종 0» 권함 ${sh.filter(r => r.shop.noSpecies).length}/${sh.length} · 따라 구근 산 판 ${sh.filter(r => r.shop.noSpecies && r.sp && r.sp.cormBuy != null && r.sp.cormBuy >= r.shop.openDay).length}` +
                  ` · AL 주문 따라 더 산 구근 판당 ${(sh.reduce((a, r) => a + (r.shop.cormMore || 0), 0) / Math.max(1, sh.length)).toFixed(1)} · 교환 받은 판 ${sh.filter(r => r.sp && r.sp.trade != null).length}`);
      console.log(`    기한 지남 갈래(판 합) — ${Object.entries(ek).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`);
      console.log(`    새 주문 갈래(판 합 · 첫 주문 빼고) — ${Object.entries(nk).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`);
      /* ★ D71 — 둘째 두 종(연 날부터 · 중앙) */
      const s2 = sh.filter(r => r.shop.ev2 || r.sp2);
      if (s2.length) {
        const ev = k => { const v = s2.map(r => (r.shop.ev2 || {})[k]).filter(x => x != null); return `${med(v) ?? '—'}(${v.length}/${s2.length})`; };
        const gap = (a, b) => { const v = s2.map(r => r.shop.ev2 && r.shop.ev2[a] != null && r.shop.ev2[b] != null ? r.shop.ev2[b] - r.shop.ev2[a] : null).filter(x => x != null); return `${med(v) ?? '—'}(${v.length})`; };
        const sm = k => s2.reduce((a, r) => a + ((r.sp2 || {})[k] || 0), 0);
        console.log(`    ◈ 둘째 두 종 — 단골 5 ${med(s2.map(r => r.shop.reg5).filter(x => x != null)) ?? '—'}일 · 단골 8 ${med(s2.map(r => r.shop.reg8).filter(x => x != null)) ?? '—'}일 · ` +
                    `sc_ask ${ev('sc_ask')} · 첫 뿌리 ${ev('sc_rooted')} · sc_ask→첫 뿌리 ${gap('sc_ask', 'sc_rooted')} · 곁줄 sc_hang 끝(높은 자리 줄기 ≥ longVineM) ${med(s2.map(r => r.shop.longVineOn).filter(x => x != null)) ?? '—'}(${s2.filter(r => r.shop.longVineOn != null).length}) · ` +
                    `ca_care ${ev('ca_care')} · ca_saved ${ev('ca_saved')} · 맡김→펴짐 ${gap('ca_care', 'ca_saved')} · 가게 끝맺음(D75) ${ev('shop_ending')}`);
        console.log(`      SC 자름(주문) 판당 ${(sm('cuts') / s2.length).toFixed(1)} · 둘째 그루로 자름 ${(sm('grow2') / s2.length).toFixed(1)} · 높은 자리 없어 낮게 놓음 ${sm('noHigh')} · SC 그루-날 높은 ${sm('scHighDays')}/낮은 ${sm('scLowDays')} · ` +
                    `CA 옮김 ${sm('caMoves')} · CA 그루-날 알맞음 ${sm('caFitDays')}/벗어남 ${sm('caOffDays')} · 알맞은 빈 자리 없음 ${sm('caNoFit')}` +
                    ` · 산 날 ${s2.filter(r => r.sp2 && r.sp2.scBuy != null).length}/${s2.length}` +
                    (s2.some(r => r.sp2 && r.sp2.wallOn != null) ? ` · 화분걸이 건 판 ${s2.filter(r => r.sp2 && r.sp2.wallOn > 0).length} · 등 ${med(s2.map(r => r.sp2 && r.sp2.wallLamps).filter(x => x != null)) ?? '—'}${s2.some(r => r.sp2 && r.sp2.wallErr) ? ' · ⚠ ' + s2.map(r => r.sp2 && r.sp2.wallErr).filter(Boolean)[0] : ''}` : '') +
                    `${s2.some(r => r.sp2 && (r.sp2.scBuyErr || r.sp2.unpackErr || r.sp2.cutErr)) ? ' · ⚠ ' + s2.map(r => r.sp2 && (r.sp2.scBuyErr || r.sp2.unpackErr || r.sp2.cutErr)).filter(Boolean)[0] : ''}`);
        const dk = {}; for (const r of s2) for (const k of ['sc_cutting', 'sc_pot', 'ca_pot']) dk[k] = (dk[k] || 0) + ((r.shop.doneKinds || {})[k] || 0);
        const ek2 = {}; for (const r of s2) for (const [k, v] of Object.entries(r.shop.expiredKinds || {})) if (/^(sc_|ca_)/.test(k)) ek2[k] = (ek2[k] || 0) + v;
        const won2 = {}; for (const r of s2) for (const [k, v] of Object.entries(r.shop.wonKinds || {})) if (/^(sc_|ca_)/.test(k)) won2[k] = (won2[k] || 0) + v;
        console.log(`      납품(판 합) ${Object.entries(dk).map(([k, v]) => `${k} ${v}`).join(' · ')} · 받은 돈(판 합) ${Object.entries(won2).map(([k, v]) => `${k} ${won(v)}`).join(' · ') || '—'} · 기한 지남 ${Object.entries(ek2).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`);
      }
    } }
  /* ★ 원룸 새 잎 — 달마다(판 평균) · 모주 / 자란 삽수 · 무늬 */
  { const lm = rs.filter(r => (r.leafMonths || []).length);
    if (lm.length) {
      const M = Math.max(...lm.map(r => r.leafMonths.length));
      const cell = (i, k) => { const v = lm.map(r => (r.leafMonths[i] || {})[k]).filter(x => x != null); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length) : null; };
      const f = x => x == null ? '—' : x.toFixed(1);
      const rows = []; for (let i = 0; i < Math.min(M, 24); i++) rows.push(`${i + 1}달 ${f(cell(i, 'mLeaves'))}(${f(cell(i, 'mVarie'))})/${f(cell(i, 'cLeaves'))}(${f(cell(i, 'cVarie'))})`);
      const tot = k => lm.reduce((a, r) => a + r.leafMonths.reduce((x, b) => x + b[k], 0), 0) / lm.reduce((a, r) => a + r.leafMonths.length, 0);
      console.log(`  ✿ 원룸 새 잎 — 한 달 평균: 모주 잎 ${tot('mLeaves').toFixed(2)}장(무늬 ${tot('mVarie').toFixed(2)}) · 자란 삽수 잎 ${tot('cLeaves').toFixed(2)}장(무늬 ${tot('cVarie').toFixed(2)}) · 판 ${lm.length}`);
      console.log(`    달마다 «모주 잎(무늬)/삽수 잎(무늬)»: ` + rows.join(' · '));
    } }
  /* 장부(--ledger) — 판마다 이사 뒤 30일씩 · 단위 만 원 */
  /* ★ 2026-10-24 D 나머지 «바꾸기 걸음» — 판마다: 옮긴 날 · 사건 · 숨은 손해 · 세이브 왕복 · 손님 이음 · 쉬는 진로 걸린 것 · 칩 · 간판 · 덮개 */
  { const sw = rs.filter(r => r.sw);
    for (const r of sw) {
      const W = r.sw;
      console.log(`  🔀 바꾸기 걸음 ${r.seed} — 옮김 ${W.steps.length}/${(P.switchSeq || []).length - 1} · 덮개 ${W.cover ? W.cover.day + '일 ' + W.cover.events.join(',') : '—'} · 칩 어긋남 ${W.fails.length}${W.fails.length ? ' (' + W.fails.slice(0, 3).join(' | ') + ')' : ''} · 쉬는 줄 최대 ${W.restingMax ?? '—'} · 건너뛴 줄 ${W.skipped ?? '—'}${W.qErr ? ' · 할 일 오류 ' + W.qErr : ''}`);
      for (const st of W.steps) console.log(`     ${st.day}일 ${st.from}→${st.to}${st.back ? '(돌아감)' : ''} · ${st.events.join(' ')} · 숨은 손해 ${st.loss.length ? st.loss.join(' / ') : '0'} · 왕복 ${st.rt} · 방 ${st.room} · hasJob ${st.hasJob} · movedHome ${st.movedHome} · 손님 이음 ${st.link ?? '—'} · signBy ${st.signBy} · 칭호 ${st.titles.join('·') || '—'}`);
      for (const R of (W.restDone || [])) console.log(`     쉬는 ${R.job} — 걸린 것 ${R.n} · 끝 ${R.endedBy || '아직'} · 기한 뒤 남음 ${R.left ?? '—'} · 새로 남 ${R.newOpen} · 새로 굴림 ${R.rolled}`);
      console.log(`     간판 — 선 날 ${JSON.stringify(W.signEnd || {})} · 하루 사건 10 ${(W.sign || []).map(x => `${x.day}일 ${x.ev}${x.kept ? '{signKept}' : ''}`).join(' · ') || '—'}`);
    } }
  /* ★ 2026-10-24 C «육종 사람» — 품종 1/3/5 날 · 칸마다 «투룸에서 한 해에 서나»(연 날부터 365일 안에 등록된 판 수) · 표본 · 상금 · 돈 바닥 */
  { const br = rs.filter(r => r.breed);
    if (br.length || rs.some(r => r.breedErr)) {
      const vd = k => br.map(r => (r.breed.vDays || [])[k - 1]).filter(x => x != null);
      const slots = JBREED.breedSlots().map(s => s.id);
      console.log(`  🧬 육종 — 연 판 ${br.length}/${N}${rs.some(r => r.breedErr) ? ' · ⚠ ' + rs.find(r => r.breedErr).breedErr : ''} · 품종 1/3/5 중앙 ${[1, 3, 5].map(k => med(vd(k)) ?? '—').join('/')}일` +
                  `(닿은 판 ${[1, 3, 5].map(k => vd(k).length).join('/')}) · 2년 품종 중앙 ${med(br.map(r => r.breed.varieties || 0))} · 표본 중앙 ${med(br.map(r => r.breed.samples || 0))} · 줄 중앙 ${med(br.map(r => r.breed.lines || 0))}` +
                  ` · 판당 상금 ${won(Math.round(br.reduce((a, r) => a + (r.breed.prizeWon || 0), 0) / Math.max(1, br.length)))} · 최저 지갑 중앙 ${won(med(br.map(r => r.breed.minCash)) ?? 0)}` +
                  ` · 연 뒤 첫 0원 ${br.filter(r => r.breed.brokeOn != null).length} · 굶음 ${br.filter(r => r.starvedDay != null).length} · PP 자름 판당 ${(br.reduce((a, r) => a + (r.breed.ppCuts || 0), 0) / Math.max(1, br.length)).toFixed(1)}` +
                  ` · 산 등 판당 ${(br.reduce((a, r) => a + (r.breed.lampsBought || 0), 0) / Math.max(1, br.length)).toFixed(1)} · 산 구근 판당 ${(br.reduce((a, r) => a + (r.breed.cormsBought || 0), 0) / Math.max(1, br.length)).toFixed(1)} · PP 옮김 판당 ${(br.reduce((a, r) => a + (r.breed.ppMoves || 0), 0) / Math.max(1, br.length)).toFixed(1)}`);
      console.log('    가름 — 칸마다 같은 조건 셈 최대(판 중앙) ' + slots.map(id => `${id} ${med(br.map(r => (r.breed.repro || {})[id] || 0))}`).join(' · ') +
                  ` · 뿌리낸 무늬 삽수(판 중앙) ${['dark', 'mid', 'bright'].map(b => `${b} ${med(br.map(r => Object.keys((r.breed.rooted || {})[b] || {}).length))}`).join(' · ')}` +
                  ` · 무늬 AL 판 ${br.filter(r => Object.keys(r.breed.alVarie || {}).length).length}/${br.length} · 방 가장 밝은 자리 DLI(주마다 · 판 중앙의 중앙) ${med(br.map(r => med(r.breed.maxDli || [])))} · 최대 ${Math.max(...br.flatMap(r => r.breed.maxDli || [0]))}`);
      const noFull = br.filter(r => Object.keys(r.breed.slotDay || {}).filter(k => k !== 'monstera_fullmoon').length >= 3).length;
      console.log(`    D84 — 진로 첫날 무늬 마디 삽수(판마다 · 씨앗 차례) ${br.map(r => `${r.seed}:${r.breed.v0 ?? '—'}`).join(' ')} · 풀문 없이 품종 3 닿은 판 ${noFull}/${br.length} · ` +
                  `판마다 세운 칸 수 ${br.map(r => Object.keys(r.breed.slotDay || {}).length).join(' ')} · 칸 셈 상한 중앙 ${med(br.map(r => r.breed.cap).filter(x => x != null)) ?? '—'} · 자리 옮김 판당 ${(br.reduce((a, r) => a + (r.breed.moves || 0), 0) / Math.max(1, br.length)).toFixed(0)} · AL 판 것/산 구근/판 구근 판당 ` +
                  `${['alSold', 'cormsBought', 'cormSold'].map(k => (br.reduce((a, r) => a + (r.breed[k] || 0), 0) / Math.max(1, br.length)).toFixed(1)).join('/')}` +
                  ` · 재우기 그루-날 판당 ${(br.reduce((a, r) => a + (r.breed.alForce || 0), 0) / Math.max(1, br.length)).toFixed(0)}(어두운 데 섬 ${br.reduce((a, r) => a + (r.breed.alDarkOk || 0), 0)} · 못 섬 ${br.reduce((a, r) => a + (r.breed.alDarkMiss || 0), 0)}) · 방 가장 어두운 7일 평균 중앙 ${med(br.map(r => r.breed.darkMin).filter(Number.isFinite))}`);
      if (br.some(r => r.persona && r.persona.breedHint)) console.log(`    D86 귀띔 — 재우기 귀띔 뜬 판 ${br.filter(r => r.breed.hintSleepAt != null).length}/${br.length}(연 뒤 날 중앙 ${med(br.map(r => r.breed.hintSleepAt).filter(x => x != null)) ?? '—'}) · ` +
                  `풀문 귀띔 뜬 판 ${br.filter(r => r.breed.hintBrightAt != null).length}/${br.length}(중앙 ${med(br.map(r => r.breed.hintBrightAt).filter(x => x != null)) ?? '—'}) · 2년 안 품종 3 ${br.filter(r => (r.breed.varieties || 0) >= 3).length}/${br.length}`);
      if (br.some(r => r.persona && r.persona.breedHint)) {
        const hk = (k, ko) => `${ko} ${br.filter(r => r.breed[k] != null).length}/${br.length}(중앙 ${med(br.map(r => r.breed[k]).filter(x => x != null)) ?? '—'})`;
        console.log(`    D88 귀띔 — ${hk('hintRootAt', '뿌리 자리 비우기')} · ${hk('hintAlKindsAt', 'AL 다른 갈래')} · 자리 맞바꿈 합 ${br.reduce((a, r) => a + (r.breed.rootSwaps || 0), 0)} · 돌려줌 합 ${br.reduce((a, r) => a + (r.breed.rootGiveBack || 0), 0)}${br.some(r => r.breed.rootSwapErr) ? ' · 맞바꿈 오류 ' + br.find(r => r.breed.rootSwapErr).breed.rootSwapErr : ''}`);
        console.log(`    D87 귀띔 — ${hk('hintShopCormAt', '상점 구근')} · ${hk('hintPpCutAt', 'PP 맨 위 자르기')} · ${hk('hintPpShopAt', 'PP 상점')} · ` +
                    `산 상점 구근 합 ${br.reduce((a, r) => a + (r.breed.shopCormsBought || 0), 0)} · 산 PP 합 ${br.reduce((a, r) => a + (r.breed.ppBought || 0), 0)} · PP 자름 합 ${br.reduce((a, r) => a + (r.breed.ppCuts || 0), 0)}`);
      }
      if (arg('breedlook', false)) for (const r of br) console.log(`      ${r.seed} AL 마지막 — ${r.breed.alLook || '—'}`);
      if (arg('breedgap', false)) for (const r of br) { const B = r.breed, g = B.g || {};
        const sp = Object.entries(g.sprout || {}).map(([k, v]) => `${k.replace('from_', '').replace('_mother', '어미')} ${v}`).join(' · ') || '—';
        const cf = Object.entries(g.cormFound || {}).map(([k, v]) => `${k.replace('from_', '').replace('_mother', '어미')} ${v}`).join(' · ') || '—';
        const rp = id => Object.entries((g.mRepro || {})[id] || {}).map(([k, v]) => `${k}:${v}`).join(' ') || '—';
        console.log(`      ${r.seed} 품종 ${B.varieties} | AL 귀띔 뒤 산 구근 ${g.cormAfterHint ?? '—'} · 싹 ${sp} · 잠듦 ${g.alSleeps || 0}(찾은 구근 ${g.alSleepCorms || 0}) · 찾은 구근 출처 ${cf} · 셈 마블 ${rp('al_marble')} · 반달 ${rp('al_sector')}` +
                    ` | 몬 무늬 삽수 첫날 ${g.vc ? g.vc.d0 : '—'} → 1년 ${g.vc && g.vc.d365 != null ? g.vc.d365 : '—'} → 2년 ${g.vc && g.vc.d730 != null ? g.vc.d730 : '—'}(최대 ${g.vcMax ?? '—'}) · 산 삽수 밝기 ${JSON.stringify(g.rootedBand || {})} · 연 뒤 다시 자르기 ${g.recut ?? '—'} · 하프문 셈 ${rp('monstera_halfmoon')} · 풀문 셈 ${rp('monstera_fullmoon')}`); }
      if (arg('breedtrace', false)) for (const r of br) for (const line of (r.breed.trace || [])) console.log(`      ${r.seed} ${line}`);
      console.log('    칸마다(한 해 안 등록 판 · 2년 안 등록 판 · 등록 날 중앙 · 후보 날 중앙) — ' + slots.map(id => {
        const d = br.map(r => (r.breed.slotDay || {})[id]).filter(x => x != null), c = br.map(r => (r.breed.cand || {})[id]).filter(x => x != null);
        return `${id} ${d.filter(x => x <= 365).length}·${d.length}/${br.length}·${med(d) ?? '—'}일·${med(c) ?? '—'}일`; }).join(' | '));
      const tl = {}; for (const r of br) for (const [line, T] of Object.entries(r.breed.tally || {})) for (const [cond, row] of Object.entries(T || {})) for (const [o, n] of Object.entries(row || {})) {
        const k = line === 'pp' ? `pp` : `${line}:${cond}`; (tl[k] = tl[k] || {})[o] = (tl[k][o] || 0) + n; }
      console.log('    셈(판 합) — ' + Object.entries(tl).map(([k, row]) => `${k} ${Object.entries(row).map(([o, n]) => `${o} ${n}`).join('·')}`).join(' | '));
    } }
  /* ★ 2026-10-24 B «돌봄 사람» — 살린 몫(돌려줌 ÷ (돌려줌 + 찾아감)) · 고장마다 · 살린 10/30 날 · 돈 */
  { const cr = rs.filter(r => r.care);
    if (cr.length || rs.some(r => r.careErr)) {
      const tot = k => cr.reduce((a, r) => a + Object.values(r.care.byProblem || {}).reduce((b, x) => b + (x[k] || 0), 0), 0);
      const sv = tot('saved'), ex = tot('expired'), gv = tot('given');
      console.log(`  🩺 돌봄 — 연 판 ${cr.length}/${N}${rs.some(r => r.careErr) ? ' · ⚠ ' + rs.find(r => r.careErr).careErr : ''} · 맡음 ${gv} · 살림 ${sv} · 찾아감 ${ex} · ★살린 몫 ${sv + ex ? Math.round(sv / (sv + ex) * 100) : '—'}%` +
                  ` · 살린 3/10/30 중앙 ${[3, 10, 30].map(n => med(cr.map(r => r.care.ms[n]).filter(x => x != null)) ?? '—').join('/')}일(30 닿은 판 ${cr.filter(r => r.care.ms[30] != null).length}) · 판당 수고비 ${won(Math.round(cr.reduce((a, r) => a + r.care.wonTotal, 0) / cr.length))}` +
                  ` · 굶음 ${cr.filter(r => r.starvedDay != null).length} · 첫 맡김 ${[...new Set(cr.map(r => r.care.firstProblem))].join('/')}${rs.some(r => r.care && (r.care.cutErr || r.care.retErr)) ? ' · ⚠ ' + rs.map(r => r.care && (r.care.cutErr || r.care.retErr)).filter(Boolean)[0] : ''}`);
      const ids = [...new Set(cr.flatMap(r => Object.keys(r.care.byProblem || {})))].sort();
      console.log('    고장마다(맡음 · 살림 · 찾아감 · 살린 몫 · 나은 날 중앙) — ' + ids.map(id => { const g = k => cr.reduce((a, r) => a + (((r.care.byProblem || {})[id] || {})[k] || 0), 0);
        const d = cr.flatMap(r => (((r.care.byProblem || {})[id] || {}).days) || []); const s2 = g('saved'), e2 = g('expired');
        return `${id} ${g('given')}·${s2}·${e2}·${s2 + e2 ? Math.round(s2 / (s2 + e2) * 100) : '—'}%·${med(d) ?? '—'}일`; }).join(' | '));
    } }
  /* ★ 2026-10-23 총괄 «가게 2년 굶음» — 연 날부터 30일씩 · 단위 만 원 */
  if (arg('shopledger', false)) {
    const sh = rs.filter(r => r.shop && r.shop.months && r.shop.months.length);
    const m1 = v => (v / 10000).toFixed(1);
    const starvedRel = r => r.starvedDay != null ? r.starvedDay - r.shop.openDay : null;
    console.log(`  ▤ 가게 장부 — 굶은 판 ${sh.filter(r => r.starvedDay != null).length}/${sh.length} · 굶은 날(연 뒤) ${sh.filter(r => r.starvedDay != null).map(r => `${r.seed}:${starvedRel(r)}`).join(' ')} · 단골 30(연 뒤) ${sh.map(r => `${r.seed}:${r.shop.ms30 ?? '—'}`).join(' ')}`);
    const half = (rows, a, b) => { const xs = rows.flatMap(r => r.shop.months.slice(a, b)); const n = Math.max(1, xs.length);
      const S2 = k => xs.reduce((t, x) => t + (x[k] || 0), 0) / n;
      return `주문 ${m1(S2('orders'))} · 그 밖 들어옴 ${m1(S2('other') - S2('orders') + S2('veg') + S2('varie') + S2('plain') + S2('mother'))} · 아낀 밥값 ${m1(S2('saved'))} · 살림 ${m1(S2('living'))} · 전기 ${m1(S2('power'))} · 산 것 ${m1(S2('buy'))} · 남음 ${m1(S2('orders') + (S2('other') - S2('orders')) + S2('veg') + S2('varie') + S2('plain') + S2('mother') + S2('living') + S2('power') + S2('buy'))} (${xs.length}달)`; };
    for (const [ko, rows] of [['굶은 판', sh.filter(r => r.starvedDay != null)], ['안 굶은 판', sh.filter(r => r.starvedDay == null)]]) {
      if (!rows.length) continue;
      console.log(`    ${ko} ${rows.length} — 달 평균(만 원)`);
      for (const [a, b, k] of [[0, 6, '1~6달'], [6, 12, '7~12달'], [12, 18, '13~18달'], [18, 25, '19~25달']]) console.log(`      ${k}: ${half(rows, a, b)}`);
    }
    for (const r of sh.filter(x => x.starvedDay != null)) {
      console.log(`    · 씨앗 ${r.seed} — 연 날 ${r.shop.openDay} · 굶음 연 뒤 ${starvedRel(r)}일 · 단골 30 ${r.shop.ms30 ?? '못 닿음'} · 달(주문/살림/전기/산 것/달말 지갑/단골):`);
      console.log('      ' + r.shop.months.map(x => `${x.m}:${m1(x.orders)}/${m1(x.living)}/${m1(x.power)}/${m1(x.buy)}/${x.cashEnd == null ? '—' : m1(x.cashEnd)}/${x.regulars ?? '—'}`).join(' · '));
      console.log('      새 주문/납품/기한 지남 · 달말 가진 것(화분 · 삽수 · 자리 잡은 삽수 · PP · 잎 있는 AL · SC · CA · 열린 주문 · 오늘 자를 마디): ' +
                  r.shop.months.map(x => `${x.m}:${x.newN || 0}/${x.done || 0}/${x.expN || 0}[${x.stock ? [x.stock.pot, x.stock.cut, x.stock.est, x.stock.pp, x.stock.al, x.stock.sc, x.stock.ca, x.stock.open, x.stock.cutOpen].join(',') + ` 모주잎${x.stock.mLeaves ?? '?'}·DLI${x.stock.mDli ?? '?'}·등${x.stock.lamps}` : '—'}]`).join(' '));
    }
  }
  if (arg('ledger', false)) for (const r of rs.filter(x => x.ledger && x.ledger.length)) {
    const m = v => (v / 1e4).toFixed(1).replace(/\.0$/, '');
    const avg = (w, n) => n ? m(w / n) : '—';
    console.log(`  ▤ 장부 — 씨앗 ${r.seed} · 월세 ${won(r.rentWon ?? null)} · 이사 ${r.moveDay}일(지갑 ${m(r.cashAtMove)}만) · 단위 만 원` +
                ` · 5백만 ${(r.reach || {})[5000000] ?? '못 닿음'}일`);
    console.log('    달 | 날 | 무늬삽수 개·평균·합 | 민삽수 개·합 | 모주 | 채소·무순 | 구호금 | 기타(0원 밑 지움) | 월세 | 생활비 | 전기 | 산 것 | 남은 돈 | 달말 지갑 | 다 팔면');
    for (const b of r.ledger) {
      const inn = b.varie + b.mother + b.plain + b.veg + b.relief, outt = b.rent + b.living + b.power + b.buy, net = inn + outt + b.other;
      console.log(`    ${String(b.m).padStart(2)} | ${String(b.days).padStart(2)} | ${b.nVarie}개·${avg(b.varie, b.nVarie)}·${m(b.varie)} | ${b.nPlain}개·${m(b.plain)} | ${m(b.mother)} | ${m(b.veg)} | ${m(b.relief)} | ${m(b.other)}` +
                  ` | ${m(b.rent)} | ${m(b.living)} | ${m(b.power)} | ${m(b.buy)} | ${m(net)} | ${m(b.endCash)} | ${b.netWorth == null ? '—' : m(b.netWorth)}`);
    }
    if (r.otherLog && r.otherLog.length) console.log('    기타 — ' + r.otherLog.map(o => `${o.day}일 ${won(o.won)}(${o.ev.join(',') || '사건 없음'})`).join(' · '));
  }
  const stay = rs.filter(r => r.moveDay == null && r.starvedDay == null);
  { const no = rs.filter(r => r.neighborOrderDay != null); console.log(`  🧺 반찬가게 주문 — ${no.length}/${N}판 · 날 중앙 ${med(no.map(r => r.neighborOrderDay)) ?? '—'}`); }
  { const rc = rs.filter(r => (r.questDone || {}).oneroom_recut != null && r.moveDay != null);
    console.log(`  🌿 키워서 늘리기(D41) — 키운 무늬 그루 최대 중앙 ${med(rs.map(r => r.grownMax || 0))} · oneroom_recut 끝남 ${rc.length}/${N}(이사 뒤 중앙 ${med(rc.map(r => r.questDone.oneroom_recut - r.moveDay)) ?? '—'}일)`); }
  if (stay.length) console.log(`  이사 못 한 판 ${stay.length} — 무늬 잎을 낸 적 없음 ${stay.filter(r => r.varieDay == null).length} · 이사 자금 모자람 ${stay.filter(r => r.moneyDay == null).length}` +
                               ` · (이사한 판의 무늬 첫날 중앙 ${med(rs.filter(r => r.moveDay != null).map(r => r.varieDay))}일)`);
  console.log(`  ★막힘 — ${Object.keys(stuckBy).length ? Object.entries(stuckBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}판`).join(' · ') : '없음'}`);
  console.log(`  ⚠ 이미 자른 잎을 싣고 나간 자르기 — ${rs.reduce((a, r) => a + (r.ghostCuts || 0), 0)}번(잎 ${rs.reduce((a, r) => a + (r.ghostLeaves || 0), 0)}장) · 모주 자르기 ${rs.reduce((a, r) => a + r.cuts.banjiha + r.cuts.oneroom, 0)}번 중`);
  console.log(`  자르기 — 반지하 ${rs.reduce((a, r) => a + r.cuts.banjiha, 0)} · 원룸 ${rs.reduce((a, r) => a + r.cuts.oneroom, 0)} · 삽수에서 ${recut.ok}/${recut.tried}` +
              (Object.keys(recutWhy).length ? `(막힘: ${Object.entries(recutWhy).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${v}`).join(' · ')})` : ''));
  { const t = {}; for (const r of rs) for (const [k, v] of Object.entries(r.cutThrow || {})) t[k] = (t[k] || 0) + v;
    const top = Object.entries(t).sort((a, b) => b[1] - a[1]);
    console.log(`  자르기가 던진 말(고른 마디를 실제로 잘랐을 때) — ${top.length ? top.slice(0, 3).map(([k, v]) => `${k} ${Math.round(v / N)}/판`).join(' · ') : '없음'}`); }
  console.log(`  ★자르기를 막은 말(날마다 · 가장 앞 마디) — 반지하: ${why('banjiha') || '—'}`);
  console.log(`                                          원룸: ${why('oneroom') || '—'}`);
}
try {
  const f = path.join(ROOT, 'tools', '_out', 'branches.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ args: { NAMES, SEEDS, TARGETS, DAYS }, results }, null, 1));
  console.log(`\n  판별 기록 — ${path.relative(ROOT, f)}`);
} catch (e) { console.log('  ⚠ 기록 파일 —', e.message); }
