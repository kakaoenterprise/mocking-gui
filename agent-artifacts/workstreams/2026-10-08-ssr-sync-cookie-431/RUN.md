---
version: 1.0.0
name: 'RUN: mocking_gui_sync cookies overflow Node 16 KB header limit (431)'
type: run
description: 'Light run — root cause analysis and improvement design for upstream issue #45: stale sync cookies accumulate, server reads the stale one, payload is 4x larger than necessary'
run_id: 2026-10-08-ssr-sync-cookie-431
workflow: harness-dev-pipeline
size: light
status: completed # in_progress | awaiting_approval | completed
created_by: ria.ang@kakaoenterprise.com
---

# RUN: SSR 동기화 쿠키가 Node 헤더 한도(16 KB)를 넘어 431 발생

## 1. Background & Scope

### 1.1 이슈 요약 (upstream kakaoenterprise/mocking-gui 제보)

- 이슈: https://github.com/kakaoenterprise/mocking-gui/issues/45 — _[BUG] mocking_gui_sync cookies grow past Node's 16 KB header limit (431 on every request)_
- 기준 커밋: upstream/main `2cb9d7f` (v1.0.6 + 3 커밋). 구현 브랜치 `fix/ssr-sync-cookie-431` 은 승인 후 upstream/main `11674cc` 에서 별도 워크트리로 생성(원 워크트리에 #44 세션의 미커밋 변경이 있어 분리). `cookie.ts` · `state.ts` 는 `c4feff8`(#5) 이후 main 에서 변경 없음 → 제보 dist(1.0.6-alpha.1)와 동일 코드.

패널에서 핸들러를 켜고 끄다 보면 `mocking_gui_sync` 계열 쿠키가 **누적**되어 요청 헤더가 Node 기본 한도 16 384 바이트를 넘고, 그 순간부터 **Next dev 서버가 모든 요청에 431 을 반환**한다. 페이지·청크·패널이 전부 안 열리므로 앱 안에서는 복구할 수 없고 DevTools 에서 쿠키를 손으로 지워야 한다. 라이브러리가 호스트 앱을 통째로 멈추게 하는, 가장 높은 심각도의 결함이다.

### 1.2 범위

| 포함                                                      | 제외 (후속 과제로 기록)                                        |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| 쓰기 시 이전 쿠키 정리(자가 치유)                         | 패널 UI 배너(예산 초과 경고) — 설계만 남김                     |
| 서버 읽기 순서를 결정적으로 수정                          | `delay` 값 SSR 동기화(현재도 미동기화)                         |
| 페이로드 포맷 v2 (해시 키 · 기본값 생략 · 단일 쿠키 예산) | 서버측 상태 저장소 + 세션 id 쿠키 (§3.2 옵션 C, 별도 ADR 후보) |
| 레거시(v1) 쿠키 읽기 호환 + 자동 청소                     | `setupMockingServer` 공개 API 변경 — 없음                      |
| 회귀 테스트, 문서(api-guide · 트러블슈팅 431)             |                                                                |

---

## 2. 원인 분석 (실측 기반)

### 2.1 제보 내용 중 정정·보강할 점

| 제보 주장                                                       | 실측 결과                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 결함 1 — 쓰기가 이전 쿠키를 지우지 않아 single 과 chunk 가 공존 | **그대로 확인.** `setCookie` 만 있고 삭제 경로가 없다 (`cookie.ts:8-15`, `:50-56`, `:127-135`).                                                                                                                                                                                                                            |
| 결함 2 — 서버가 stale single 쿠키를 chunk 보다 우선 읽음        | **그대로 확인.** `state.ts:13-30`. 게다가 이 동작은 `state.test.ts:98-114` 가 _의도된 동작_ 으로 고정하고 있어 수정 시 테스트도 뒤집어야 한다.                                                                                                                                                                             |
| 결함 3 — "기본 상태의 Swagger auto 핸들러까지 전부 직렬화"      | **부분 정정.** 직렬화 대상은 `active: true` 항목뿐이고 기본값은 `active: false` 다 (`core.ts:51-65`, `cookie.ts:87-92`). 143 개가 실린 것은 사용자가 143 개를 모두 켠 상태(개별 토글 또는 시나리오 활성화)였기 때문. 다만 _켜진_ 항목은 type/variant 가 기본값과 같아도 매번 실리며, 1 항목 ≈ 124 B 라는 크기 자체는 사실. |
| "10 000 cap 에 걸리면 Swagger 항목이 드롭된다"                  | 절삭 로직 자체는 정상 동작(실측). 문제는 cap 값이 헤더 예산보다 2.5 배 크다는 점.                                                                                                                                                                                                                                          |

### 2.2 재현 (실제 소스 `syncStateToCookie` / `reconstructHandlerConfigsFromCookie` 를 vitest 로 직접 구동)

절대 URL 키 `get.https://api.local.kakaocloud.com/v1/...` 143 개, 브라우저 쿠키 저장소를 모킹. 한 세션에서 활성 개수를 60 → 20 → 45 → 143 으로 바꿔가며 쓰기.

| 단계           | 쓰기 결과(쿠키별 바이트)                                                      | 총합             | SSR 가 복원한 항목 수        |
| -------------- | ----------------------------------------------------------------------------- | ---------------- | ---------------------------- |
| ① 60 개 활성   | `_0` 3000 · `_1` 3000 · `_2` 1435                                             | 7 489            | 60                           |
| ② 20 개로 축소 | 위 chunk 3 개 **그대로 남음** + `sync` 2486                                   | 9 991            | 20                           |
| ③ 45 개로 확대 | `_0` 3000 · `_1` 2600(덮어씀) · `_2` 1435(**stale**) · `sync` 2486(**stale**) | 9 591            | **20 (② 의 stale single)**   |
| ④ 143 개 활성  | chunk `_0`~`_5` + `sync` 2486                                                 | **20 369 → 431** | **20 (여전히 stale single)** |

- ③ 에서 chunk 가 다시 써졌는데도 SSR 은 ② 의 single 을 읽는다 → 결함 2.
- ④ 에서 17 759 B 페이로드는 cap(10 000) 초과로 Swagger 항목 드롭 후 재인코딩되지만, 남은 쿠키 전체 합계는 이미 Node 한도를 넘는다 → 결함 1 + 3 결합.
- 쓰기 1 회 뒤 즉시 재현되는 것이 아니라 "축소 후 확대" 순서에서 발생하므로 기존 단위 테스트(매 테스트마다 빈 쿠키 저장소)로는 잡히지 않았다.

### 2.3 페이로드 크기 실측 (143 항목)

| 인코딩                                                          | 바이트    | 항목당  |
| --------------------------------------------------------------- | --------- | ------- |
| 현재: 절대 URL 키 · JSON · `encodeURIComponent`                 | 17 759    | 124     |
| origin 제거만                                                   | 12 325    | 86      |
| origin 제거 + 비 JSON + %-인코딩 없음                           | 6 223     | 44      |
| **v2 제안: 키 해시(fnv1a-32, base36) + 기본 type/variant 생략** | **1 065** | **7.4** |
| v2 + 모든 항목에 variant 명시(`200`)                            | 1 637     | 11.4    |

143 개 키에서 32 bit 해시 충돌 0 건.

### 2.4 근본 원인 (4 개 층위)

1. **쓰기가 무상태(stateless)다.** 작성기는 "지금 쓸 형태(single 또는 chunk n 개)" 만 알고 "이전에 쓴 형태" 를 모르며, 삭제 API 가 없다. 7 일짜리 쿠키라 한 번 남으면 일주일 간 모든 요청에 실린다.
2. **읽기 우선순위가 쓰기 형태와 무관하게 고정됐다.** single 을 "하위 호환" 명목으로 먼저 읽기 때문에, 쓰기가 chunk 로 넘어간 순간부터 서버는 영원히 과거 상태를 본다. 테스트가 이를 명시적으로 보증한다.
3. **페이로드 설계가 3중 팽창한다.** 핸들러 키(절대 URL 포함)를 그대로 싣고, JSON 배열로 감싼 뒤, `encodeURIComponent` 로 `:`·`/` 를 3 바이트로 늘린다. ADR‑0003 의 "1 핸들러 ≈ 30 B" 가정은 상대 경로 수동 핸들러 기준이라 Swagger 절대 URL 에서는 4 배 틀린다.
4. **예산 기준이 잘못됐다.** ADR‑0003 은 "쿠키 1 개 4 KB" 만 고려해 chunk 로 우회했지만, 실제 상한은 **요청 헤더 총량** 이다 — Node `--max-http-header-size` 16 KB, nginx `large_client_header_buffers` 기본 8 KB(한 줄). 다른 쿠키(세션·분석 등)와 예산을 공유하므로 라이브러리 몫은 4 KB 이하여야 한다. chunk 분할은 이 한도를 회피하지 못하고 오히려 쿠키 수만 늘린다.

영향 등급: **Critical** — 라이브러리가 호스트 앱을 unreachable 상태로 만들고 앱 내 자가 복구가 불가능.

---

## 3. 개선 방향 설계 (Phase 1 산출물)

### 3.1 목표와 제약

- **G1 자가 치유**: 라이브러리가 쓴 쿠키는 라이브러리가 모두 책임지고 치운다. 어떤 토글 순서로도 쓰레기가 남지 않는다.
- **G2 예산**: `mocking_gui_sync*` 합계 ≤ 4 KB. 활성 핸들러 300 개까지 손실 없이 동기화.
- **G3 결정적 읽기**: 서버는 항상 "마지막으로 쓴 상태" 를 읽는다. 형태 추측 없음.
- **G4 하위 호환**: 신 서버는 브라우저에 남은 v1 쿠키를 읽을 수 있고, 신 클라이언트는 첫 쓰기에서 v1 을 전부 치운다. `setupMockingServer` 공개 시그니처 불변.
- **C1** 추가 네트워크 요청·인프라 없음 (ADR‑0001 "쿠키 기반 SSR 동기화" 유지).
- **C2** 서버는 자신의 `mocks`/`swagger` 설정으로 핸들러 목록을 이미 알고 있다 → 쿠키는 _키_ 가 아니라 _참조_ 만 실으면 된다.

### 3.2 옵션 비교

| 옵션                       | 내용                                                               | 143 개 활성 시                                | 평가                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. 최소 패치               | 쓰기 전 정리 + chunk 우선 읽기 + cap 4 KB 하향                     | 17.7 KB → 4 KB 로 절삭, **~110 개 상태 유실** | 431 은 막지만 증상 완화. ADR‑0003 의 잘못된 예산 가정이 그대로 남음                                                                                                |
| **B. 포맷 v2 + A 의 정리** | 키 해시 · 기본값 생략 · 쿠키 안전 문자 · 단일 쿠키 · 버전 접두     | **1.1–1.6 KB, 손실 없음**                     | 근본 원인 1–4 모두 해소. 서버 파서 변경 필요, 공개 API 불변                                                                                                        |
| C. 서버측 저장소           | `__MOCKING_GUI_SSR_SERVER__` 싱글톤에 상태 보관, 쿠키엔 세션 id 만 | 수십 B                                        | 라이브러리가 호스트 앱의 라우트를 소유하지 못해 사용자가 dev 전용 엔드포인트를 등록해야 함. HMR·멀티 프로세스에서 싱글톤 휘발. ADR‑0001 전면 대체 → 별도 기능 설계 |

**권고: B.** 이번 수정의 본체이며, C 는 "쿠키 없는 SSR 동기화" 라는 독립 기능으로 후속 ADR 후보에 올린다.

### 3.3 v2 상세 설계

**쿠키 이름·수명**

- `mocking_gui_sync` 단일 쿠키만 사용. chunk(`_N`) 폐지 — chunk 가 필요한 크기는 이미 헤더 예산 초과이므로 분할의 존재 이유가 없다.
- 쓰기 직전 `document.cookie` 를 스캔해 `mocking_gui_sync` 로 시작하는 **모든** 이름(`_0…_N` 포함, 과거 버전이 남긴 것 전부)을 `expires=Thu, 01 Jan 1970` 로 만료시킨 뒤 새 값을 쓴다. 이름 목록을 하드코딩(`_0…_99`)하지 않고 실제 존재하는 것만 지운다.
- 패널 마운트 시(`setupInitialState` 이후) 1 회 즉시 sync 하여 레거시 쿠키를 청소한다 → G1, G4.

**값 포맷** (최종 — 리뷰 C1 반영: `encodeURIComponent` 가 건드리지 않는 unreserved 문자만 사용)

```
v2~<entry>~<entry>~…
entry := <hash>[.<type>[.<variant>]]        예) 1k3f9z  ·  1k3f9z.S  ·  1k3f9z..400-error  ·  1k3f9z.M.200
hash  := fnv1a-32(handlerKey) → base36 (≤ 7 자)
type  := M | A | S  — 서버가 핸들러 구조로 결정하는 기본 타입과 다를 때만
variant := `[A-Za-z0-9_-]*` 이면 그대로, 아니면 `!` + base64url(UTF-8) — 기본 variant 와 다를 때만
```

- 초안의 `|`/`:` 구분자는 Next `cookies().toString()` 이 값마다 `encodeURIComponent` 를 적용해 `%7C`/`%3A` 로 바뀌면서 파싱이 깨졌다(리뷰에서 발견, 실제 Next `RequestCookies` 로 재현). 최종 알파벳은 decode→encode 에 대해 바이트 불변이며 실제 `RequestCookies.toString()` 통과를 확인했다.
- 엔트리는 **active 인 항목만** (현행 유지). 비활성은 서버 기본값(= 비활성)과 같으므로 생략 — "기본값과의 델타" 원칙을 type/variant 까지 확장한 것.

**예산·초과 처리**

- `COOKIE_BUDGET = 3800` (이름·속성 포함 4 096 미만). 초과 시 현행 우선순위 절삭(S 먼저 드롭) 유지 + `console.warn` 에 "드롭된 개수 / 어떤 핸들러" 명시. 패널 배너는 후속.
- 300 개 활성 × 11 B ≈ 3.3 KB 로 G2 충족.

**서버 읽기** (`reconstructHandlerConfigsFromCookie`)

- 시그니처를 `(cookieString, handlers: HandlerState[])` 로 바꿔 서버가 `hash → handlerKey` 역맵을 만든다 (`createMockingServer` 는 이미 `finalHandlers` 를 보유, `setup.ts:24-28`). 내부 함수라 공개 API 영향 없음.
- 값이 `v2|` 로 시작 → v2 파서. 그 외(`%5B`/`[` 로 시작하는 JSON) → **레거시 파서**. 레거시 경로에서는 `_0` 가 존재하면 chunk 를 우선 읽도록 순서를 뒤집어 결함 2 를 함께 수정한다.
- 해시 충돌(같은 해시에 핸들러 2 개 이상): 경고 로그 후 해당 엔트리 무시. 143 개 기준 충돌 확률 ≈ 2×10⁻⁶.
- 서버/클라이언트가 같은 `mocks`/`swagger` 설정을 쓰면 해시는 동일. `serverUrl` 이 다르면 현재도 키가 달라 매칭되지 않으므로 동작 변화 없음.

**호환 매트릭스**

| 서버 \ 브라우저 쿠키 | v1 (남아 있던 것)       | v2                                                                                             |
| -------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| 구 서버(≤1.0.6)      | 현행                    | 파싱 실패 → catch → 기본값 + 에러 로그 (패키지는 단일 버전이라 빌드 캐시 수준의 과도기만 존재) |
| 신 서버              | 레거시 파서(chunk 우선) | v2 파서                                                                                        |

**ADR**

- ADR‑0003(Multi‑Cookie Split) 을 **supersede** 하는 ADR 신규: "단일 쿠키 예산(≤ 4 KB)과 해시 기반 v2 포맷". 근거: 실제 상한은 쿠키 1 개가 아니라 요청 헤더 총량이며 분할은 이를 회피하지 못한다 (§2.4‑4).
- ADR‑0001(쿠키 기반 저장소) 유지. 옵션 C 는 별도 Proposed ADR 로 분리.
- 번호는 승인 시점에 `decisions/` 의 다음 번호로 부여 (레포 최고 번호 ADR‑0005, 동시 진행 중인 #44 run 이 ADR‑0006 작성 중 → 이 run 은 ADR‑0008 예정).

### 3.4 테스트 계획 (Phase 2 TDD 선행 작성)

- `cookie.test.ts`: ① 60→20→45 순서 쓰기 후 `mocking_gui_sync` 1 개만 존재 ② 레거시 `_0…_5` + single 이 있는 저장소에서 첫 쓰기 후 전부 제거 ③ 300 개 활성 ≤ 3 800 B ④ 기본 type/variant 생략, 비기본 포함 round‑trip ⑤ 예산 초과 시 S 우선 드롭 + warn 내용.
- `state.test.ts`: ① v2 round‑trip(해시 역매핑, 기본값 복원) ② 레거시 single ③ 레거시 chunk ④ **single + chunk 공존 시 chunk 우선** (현행 테스트 `should handle mixed single and multi-cookies` 의 기대값 반전) ⑤ 해시 충돌 시 경고·무시 ⑥ 미등록 해시 무시.
- `setup.test.ts`: `createMockingServer` 가 핸들러 목록을 파서에 넘기는지.

### 3.5 문서·릴리스

- `docs/guide/usage/api-guide.md` cookie 항목: 동기화되는 것(활성 핸들러의 type/variant 델타), 예산 4 KB, 초과 시 동작.
- 트러블슈팅 신설: "431 Request Header Fields Too Large" — 원인, 쿠키 수동 삭제, `NODE_OPTIONS=--max-http-header-size` 는 임시책이라는 점.
- 버전: patch(1.0.7). 쿠키 포맷은 내부 계약이고 공개 API 는 변하지 않는다.

### 3.6 Phase 2 작업 분해 (승인 후 `frontend-engineer` 위임)

1. `cookie.ts`: `clearSyncCookies()` + v2 인코더(`encodeSyncState(handlerConfigs, handlers)`) + 예산 절삭. 기본값 비교를 위해 `handlers` 를 subscribe 콜백에서 함께 넘김 (`useHandlerStore.ts:249-253`).
2. `state.ts`: v2/레거시 분기 파서, 해시 역맵, chunk 우선 레거시 읽기.
3. `setup.ts`: 파서에 `finalHandlers` 전달.
4. 공용 `hashHandlerKey()` 를 `utils/common/keys.ts` 에 두어 양쪽이 같은 구현을 쓰도록.
5. 테스트(§3.4) → 문서(§3.5) → ADR 승격·INDEX 갱신.

---

## 4. Decisions

- 쿠키 기반 동기화(ADR‑0001)는 유지하고, 분할 전략(ADR‑0003)은 폐기·대체한다 — 상한의 정체가 "쿠키 1 개" 가 아니라 "헤더 총량" 이기 때문.
- 키 전송 대신 해시 참조를 쓴다 — 서버가 핸들러 목록을 이미 가지고 있어 키를 다시 보낼 이유가 없다.
- 레거시 읽기 호환은 유지하되 레거시 _쓰기_ 는 즉시 중단한다 — 호환을 위해 쓰레기를 계속 만들 이유가 없다.
- 옵션 C(서버측 저장소)는 이번 범위에서 제외하고 별도 ADR 후보로 둔다.

## 5. Execution Log

- 2026-10-08: 이슈 #45 분석. 실제 소스 기반 재현 스크립트로 결함 1·2·3 확인, 페이로드 크기 5 종 비교 측정. 임시 테스트 파일은 삭제(레포 변경 없음). 구현 브랜치는 승인 후 생성 예정(동시 작업 보호).

- 2026-10-08 (PR): upstream/main 1067c60(v1.0.7 + #46) 위로 rebase, INDEX.md·troubleshooting.md 충돌 해결, ADR 번호 0007→0008(동시 진행 PR #22 가 0007 사용). PR https://github.com/kakaoenterprise/mocking-gui/pull/47 생성, 인라인 코멘트 3건.
- 2026-10-08 (Phase 2, 구현): TDD — 실패 테스트 29건 선작성 후 구현.
  - 신규 `utils/common/syncFormat.ts`: 쿠키 이름·예산(3800)·`v2|` 접두·구분자·type↔char 매핑·`getCookie`/`listCookieNames` 공용화
  - `utils/common/keys.ts`: `hashHandlerKey` (fnv1a-32 → base36) 추가
  - `utils/browser/cookie.ts` 재작성: `clearSyncCookies`(실존 `mocking_gui_sync*` 전부 만료) → `encodeSyncState`(활성 항목만, 기본 type/variant 생략, 예산 초과 시 S 우선 드롭 + warn) → 단일 쿠키 쓰기, 활성 0 이면 쓰지 않음
  - `utils/server/state.ts` 재작성: `v2|` 감지 → 해시 역맵(충돌/미등록 경고·무시) + 기본값 복원; 레거시 JSON 파서 유지, single+chunk 공존 시 chunk 우선
  - `utils/server/setup.ts`: 파서에 `finalHandlers` 전달 · `store/useHandlerStore.ts`: subscribe 에서 `state.handlers` 전달
  - 테스트: `cookie.test.ts`(15) · `state.test.ts`(16) · `state.collision.test.ts`(1, `vi.mock` 으로 충돌 강제) · `keys.test.ts`(3) · `setup.node.test.ts` 통합 3건(v2 variant 적용 / 기본값 / 레거시) · 테스트 더블 `src/test/cookieStore.ts`
  - 문서: `api-guide.md` cookie 동작 절 · `troubleshooting.md` 431 항목 · ADR‑0008 신규(ADR‑0003 superseded) · `decisions/INDEX.md`

## 6. Validation

| Gate                                                  | 결과                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm lint` (turbo: tsc --noEmit + eslint, 4 패키지)  | 통과                                                                                                |
| `pnpm --filter @kakaocloud/mocking-gui test:coverage` | 11 files / 84 tests 통과 (기존 77 → 84)                                                             |
| `pnpm --filter @kakaocloud/mocking-gui build`         | 통과 (`dist/server.cjs` 2.85 kB)                                                                    |
| `prettier --check` (변경 파일 전체)                   | 통과                                                                                                |
| 코드 리뷰 (서브에이전트, general-purpose)             | Critical 1 · Important 3 · Minor 6 → 전부 반영 (아래)                                               |
| 재검증 (리뷰 반영 후)                                 | lint 통과 · 12 files / 92 tests 통과 · build 통과 · 실제 Next `RequestCookies.toString()` 통과 확인 |

**리뷰 반영 내역**

| #     | 지적                                                                                                                | 조치                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1    | `v2                                                                                                                 | …:…`가 Next`cookies().toString()`의`encodeURIComponent` 로 깨져 문서화된 App Router 경로에서 SSR 동기화 전면 상실 | 구분자를 `~`/`.` 로, variant 는 plain 또는 `!`+base64url 로 변경. 라운드트립 테스트(raw / encodeURIComponent / decodeURIComponent) 및 통합 테스트 추가 |
| I1    | 미등록 해시마다 warn 1줄 → SSR 요청당 수백 줄                                                                       | 사유별(미등록·충돌·malformed) 1줄로 집계, 샘플 5개                                                                |
| I2    | variant 디코드 실패 1건이 쿠키 전체를 버림                                                                          | 엔트리 단위 try/catch, 나머지 유지 (테스트 추가)                                                                  |
| I3    | Manual/Auto 만으로 예산 초과 시 무경고                                                                              | 두 번째 warn 추가 + 문서 반영 (테스트 추가)                                                                       |
| Minor | subscribe 주석 과장 · chunk 우선 "보장" 표현 · `isSyncCookieName` 과매칭 · 문서 버전 하드코딩 · 절삭 후 순서 미검증 | 주석/ADR 문구 수정 · `_\d+` 정규식 · 버전 문구 제거 · 순서 테스트 추가                                            |

## 7. Approval

| Item      | Value                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Decision  | approved — Phase 1 (분석·설계), 옵션 B 채택. Phase 2~4 auto-approve (사용자 지시). 구현·검증·문서 완료, 커밋/PR 은 사용자 요청 시 |
| Approver  | ria.ang@kakaoenterprise.com                                                                                                       |
| Time      | 2026-10-08T10:30:00+09:00                                                                                                         |
| Rationale | 서버가 핸들러 목록을 이미 보유하므로 해시 참조 + 델타 전송으로 예산 내 무손실 동기화가 가능하며 공개 API 가 불변                  |
