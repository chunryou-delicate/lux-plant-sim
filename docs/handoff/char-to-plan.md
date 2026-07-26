# 2026-07-26 · char → plan

## 요청 · 보고

박사님 지시로 **`tools/` 를 하위 폴더로 쪼갰습니다.** `data/` 에서 겪은 것과 같은
충돌을 막기 위한 것입니다. 제 도구 8개를 `tools/char/` 로 옮겼고, 경로 참조도
제 소유 파일 안에서는 전부 갱신했습니다.

`docs/handoff/README.md` 의 소유표에 반영이 필요한데 **`docs/*` 는 plan 소유라
직접 안 고쳤습니다.** 제가 읽은 직후 README 가 이미 갱신돼 있었어서(동시 편집)
더더욱 직접 손대면 안 되는 상황이었습니다. 아래를 붙여 주세요.

---

## 붙일 것 ① 소유표에 `tools/*` 추가

`docs/handoff/README.md` 의 소유표에서 두 줄을 고치고 한 줄을 추가합니다.

```markdown
| `house` | `src/engine/*` · `src/render3d/*` · `data/*`(구조·에셋 정의) · `_dli_probe.html` · **`docs/engine/*`** · **`tools/house/*`** |
| `char` | `assets/characters/*` · **`assets/derived/*`** · **`tools/char/*`** |
| (공용) | `tools/serve.py` |
```

> `assets/derived/` 도 char 소유로 확정됐습니다(박사님 2026-07-26).
> 제 도구(`make_lq_glb` · `strip_anim_glb`)의 산출물이고 원본이 `assets/characters/`
> 라 파생물도 같은 창이 관리하는 게 자연스럽다는 판단입니다.
> 그 안의 옛 경로 2곳은 **제가 직접 고쳤습니다**(더는 남의 파일이 아니므로).

## 붙을 것 ② `tools/` 분할 규칙 (소유표 아래 새 절)

```markdown
### tools/ 도 하위 폴더로 나눈다 (박사님 확정 2026-07-26)

성격이 섞인 폴더를 통째로 주면 `data/` 와 같은 충돌이 난다.

​```
tools/char/    char 소유   rescale_char_glb · make_lq_glb · make_part_mask ·
                          preview_mask · preview_recolor · strip_anim_glb ·
                          normalize_anim_scale · check_anim
tools/house/   house 소유  _dli_probe · _slotlist 등
tools/         공용        serve.py
​```

**공용 파일 규칙** — 고치기 전 handoff로 알린다. 급하면 고치되 **사후 보고**.
웹서버는 다 같이 쓰는 거라 막으면 오히려 불편하다.
```

---

## 붙일 것 ③ `docs/character_material_constraint.md` 경로 갱신

이 문서는 제가 썼지만 `docs/*` 라 plan 소유입니다. **경로 문자열만** 바뀌었습니다.
`tools/` → `tools/char/` 로 4곳입니다.

| 줄 | 지금 | 바꿀 것 |
|---|---|---|
| 32 | `` 도구: `tools/make_part_mask.py` `` | `` 도구: `tools/char/make_part_mask.py` `` |
| 101 | `` - `tools/make_part_mask.py` — 마스크 생성 `` | `` - `tools/char/make_part_mask.py` — 마스크 생성 `` |
| 103 | `` - `tools/rescale_char_glb.py` — 실스케일 `` | `` - `tools/char/rescale_char_glb.py` — 실스케일 `` |
| 104 | `` - `tools/make_lq_glb.py` — 경량본 `` | `` - `tools/char/make_lq_glb.py` — 경량본 `` |

한 번에 하시려면:

```bash
sed -i 's|tools/make_part_mask.py|tools/char/make_part_mask.py|g;
        s|tools/rescale_char_glb.py|tools/char/rescale_char_glb.py|g;
        s|tools/make_lq_glb.py|tools/char/make_lq_glb.py|g' docs/character_material_constraint.md
```

> 처음엔 제가 직접 고쳤다가 소유 규칙에 걸려 **되돌려 놨습니다.** 지금 저장소에는
> 옛 경로가 그대로 있습니다.

---

## 참고 — 옮긴 도구가 하는 일

| 도구 | 용도 |
|---|---|
| `rescale_char_glb.py` | 캐릭터 키·발바닥 정렬. 재실행 안전 |
| `make_lq_glb.py` | 게임용 경량본(폴리곤 1/10) 생성 |
| `strip_anim_glb.py` | 애니 GLB에서 메시 제거 (15MB → 68KB) |
| `normalize_anim_scale.py` | 본 스케일 1.0 정규화 |
| `check_anim.py` | 척추 비틀림·스케일·루트이동 점검 |
| `make_part_mask.py` | 부위 마스크 생성 (색시프트용, 현재 보류) |
| `preview_mask.py` · `preview_recolor.py` | 브라우저 없이 3D 정사영으로 검증 |

---

## 미해결

- [ ] 위 ①②③ 반영 부탁드립니다.
- [x] `assets/derived/` 소유 — **char 로 확정됨**(박사님 2026-07-26).
      옛 경로 2곳은 제가 직접 고쳤습니다. 소유표 ① 에 반영해 주세요.
- [ ] 캐릭터 창 산출물을 한 문서로 모아 `assets/characters/README.md` 에 뒀습니다
      (제 소유라 직접 관리). `docs/` 에 중복 문서를 만들지 않았습니다.
      기획 쪽에서 캐릭터 규격이 필요하면 그 파일을 보시면 됩니다.
