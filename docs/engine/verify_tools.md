# 검증 도구 — 목적과 언제 돌리나

`http://localhost:8901/<파일>` (`python tools/serve.py 8901`)

## 상시 회귀 — 방 구조나 렌더 정책을 고치면 전부 돌린다

| 도구 | 무엇을 보나 | 통과 기준 |
|---|---|---|
| `_render_vs_calc.html` | **계산 ↔ 화면 대조**(양방향) | 갈래별 기준선 안 · `etc` 0 · A(외피) 0 |
| `_shadow_audit.html` | 그림자 정책 양방향 | 유리 castShadow 0 · 정책 미지정 0 · 필수 면 전부 차폐 |
| `_space_probe.html` | **공간 기준 조도 — 방 등급 정본** | `space.peak` 가 구조 변경 없이 바뀌면 안 됨 |
| `_dli_probe.html` | 슬롯 기준 조도 · 날씨/계절 표 | — |
| `_path_test.html` | 문·통로 막힘 | 전 방 통행 가능 |
| `_place_test.html` | 가구 배치 유효성 (**아파트**) | 제자리 판정 전부 가능 |
| `_portal_check.html` | 창 확산광 포털 분포 | 한 방만 몰리지 않을 것 |

## 반지하 첫 플레이 전용 — 그 슬롯을 건드리면 돌린다

| 도구 | 무엇을 보나 |
|---|---|
| `_bj_verify.html` | 반지하 슬롯 전수 DLI · `daily_light/1` 이 창턱을 정확히 고르나 |
| `_bj_place.html` | **창턱·서랍장 슬롯 배치 검증** + slotId 안정성 + CORE 의존 계약 |
| `_bj_siru.html` | 열린 콩나물 시루를 놓을 `≤0.3` 슬롯이 있나 |
| `_bj_shot.html` | 화면 증거 렌더 (`?v=wide` / `?v=near`) → `docs/engine/shots/` |

> ★ 아파트 `_place_test.html` 통과는 **반지하 슬롯의 증거가 아니다.** 방·슬롯이 다르다.
> 반지하는 `_bj_place.html` 로 따로 본다.

## 데이터 재생성

| 도구 | 무엇을 만드나 |
|---|---|
| `_profile_gen.html` | `data/profiles/room_profile.*.json` 6개 재생성 + **라이브 ↔ 정적 대조** |

**방 구조를 고치면 프로필이 낡는다.** `measured.roomRev` 와 프로필의 `measured.roomRev` 를
비교하면 어긋남을 잡을 수 있다.

## 일회성 (남기지 않음)

- `_bj_scan.html` — 창턱 자리를 찾을 때 쓴 좌표 스캔. 자리가 정해져서 지웠다
- `_space_perf.html` — 공간 격자 성능 확인. 결론(0.25m 격자 3.2초)이 나와 역할이 끝났지만,
  격자 해상도를 다시 논할 때 쓸 수 있어 남겨 둔다
