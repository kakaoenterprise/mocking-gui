---
version: 1.0.0
name: 'RUN: Escaped colon (\:) collapses handler keys in panel'
type: run
description: 'Light run — root cause analysis and work design for upstream issue: escaped colon action endpoints merge into one handler'
run_id: 2026-10-07-escaped-colon-handler-key
workflow: harness-dev-pipeline
size: light
status: completed # in_progress | awaiting_approval | completed
created_by: ria.ang@kakaoenterprise.com
---

# RUN: 이스케이프된 콜론(`\:`) 핸들러 키 붕괴 수정

## 1. Background & Scope

### 1.1 이슈 요약 (upstream kakaoenterprise/mocking-gui 제보)

- 이슈: https://github.com/kakaoenterprise/mocking-gui/issues/44 — _[BUG] Escaped colon (\:) in handler URL is turned into a path segment by URL normalization, merging colon-action handlers into one key_
- 브랜치: `fix/escaped-colon-handler-key` (upstream/main 2cb9d7f 기준, 2026-10-09 생성). main 에서 `pathParams.ts` · `merge.ts` · `keys.ts` 는 분석 시점 이후 변경 없음 확인.

`POST /v1/subscriptions/:subscription_id\:cancel` 처럼 콜론 액션(Google AIP‑136 스타일)을 MSW 규칙대로 `\:` 로 이스케이프해 등록하면, 같은 리소스의 액션 핸들러들이 패널에서 **하나로 합쳐지고 나머지는 사라진다**. 제보자 환경에서는 OpenAPI 141 operation / 핸들러 142개 중 23개(14개 묶음)가 소실되어 119개만 표시됐다.

- 제보 패키지 버전: `@kakaocloud/mocking-gui 1.0.6-alpha.1` (이 워크트리 `main` = v1.0.6, 해당 코드 동일 확인)
- 제보자가 지목한 위치: `packages/mocking-gui/src/utils/handler/pathParams.ts` — `generateNormalizedUrl` → `maskDynamicSegmentsIndexed`

### 1.2 범위

| 포함                                                           | 제외                                                                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 키 정규화에서 `\:`(및 일반 `\x` 이스케이프) 보존               | MSW/path-to-regexp 자체가 이스케이프 없는 `:action` 에 예외를 던지는 동작 (상류 라이브러리 동작, 문서로만 안내) |
| `*` 접두 URL · 절대 URL 동일 규칙 적용                         | 핸들러 키(`getHandlerKey`) 포맷 변경 — 영향 없음, 변경 불필요                                                   |
| 회귀 테스트 추가 (`pathParams`, `merge`)                       | 패널 UI 변경                                                                                                    |
| 문서: `url` 옵션에 `\:` 이스케이프 규칙 명시 + 트러블슈팅 항목 |                                                                                                                 |

---

## 2. 원인 분석 (Phase 1 — 실측 기반)

### 2.1 제보 내용 중 정정할 점

제보는 "`getHandlerKey` 를 쓰는 모든 곳"이 영향받는다고 했으나, 실제 코드는 다음과 같다 (`src/utils/common/keys.ts`).

| 함수                  | 구현                                      | 정규화 사용 | 용도                                                   |
| --------------------- | ----------------------------------------- | ----------- | ------------------------------------------------------ |
| `getHandlerKey`       | `${method}.${url}` (원문 그대로)          | ✗           | 패널 항목 key, `handlerConfigs` 저장 키, 시나리오 매칭 |
| `getHandlerUniqueKey` | `${method}.${generateNormalizedUrl(url)}` | **✓**       | `mergeHandlersWithSwagger` 의 `Map` 키                 |

즉 **붕괴 지점은 `getHandlerKey` 가 아니라 `mergeHandlersWithSwagger`** (`src/utils/swagger/merge.ts`) 다. 이 함수는 `mocks` 배열을 `new Map(baseHandlers.map(h => [getHandlerUniqueKey(h), h]))` 로 적재하므로, **Swagger 소스가 하나도 없어도** 정규화 키가 같은 핸들러는 "마지막 것만 남는" 방식으로 중복 제거된다. 제보자의 "142 → 119" 는 정확히 이 `Map` 축약 결과다.

호출 경로 (두 곳 모두 동일):

- 브라우저: `hooks/useSetupMockingGUIWorker.ts:91` → `mergeHandlersWithSwagger(memoizedMocks, swaggerHandlers)` → `setupInitialState` → 스토어 `handlers` → 패널 목록 · MSW 등록
- SSR: `utils/server/setup.ts:23` → 동일

따라서 영향은 **패널 표시뿐 아니라 MSW 등록 자체에서 핸들러가 빠지는 것**이다 (사라진 액션은 목킹 자체가 안 됨). `handlerConfigs` 와 시나리오는 원문 URL 키를 쓰므로 영향이 없고, 데이터 마이그레이션도 필요 없다.

### 2.2 붕괴 메커니즘 — 두 가지 (제보는 하나만 지목)

`generateNormalizedUrl` (pathParams.ts:41) 재현 결과 (`node`, path-to-regexp 6.3.0 = msw 2.x 고정 버전):

```
https://api.example.com/v1/subscriptions/:subscription_id\:cancel          => …/subscriptions/:param1/:param2
https://api.example.com/v1/subscriptions/:subscription_id\:accept-pending  => …/subscriptions/:param1/:param2   ← 충돌
*/v1/subscriptions/:subscription_id\:cancel                                => */v1/subscriptions/:param1
*/v1/subscriptions/:subscription_id\:accept-pending                        => */v1/subscriptions/:param1        ← 충돌
https://api.example.com/v1/catalog/products\:compare                       => …/catalog/products/:param1
https://api.example.com/v1/catalog/products/:slug                          => …/catalog/products/:param1        ← 충돌
```

| #   | 메커니즘                                     | 해당 분기                    | 설명                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | **WHATWG URL 파서의 백슬래시 → 슬래시 치환** | 절대 URL (`new URL` 성공)    | special scheme(http/https)의 path state 에서 `\` 는 `/` 로 취급. `…/:subscription_id\:cancel` → pathname `…/:subscription_id/:cancel`. 이후 M2 가 두 세그먼트를 모두 `:paramN` 으로 바꿔 액션명이 소실됨.                                                   |
| M2  | **세그먼트 단위 전체 마스킹**                | 절대 URL · `*` 접두 URL 모두 | `maskDynamicSegmentsIndexed` 는 `seg.startsWith(':')` 이면 세그먼트 **전체**를 `:paramN` 으로 교체. `*` URL 은 `new URL` 이 throw 해 fallback 으로 가므로 M1 은 안 겪지만, 세그먼트 `:subscription_id\:cancel` 이 통째로 `:param1` 이 되어 똑같이 충돌한다. |

**제보의 "제안 1(URL 파싱 전 자리표시자 치환)" 만으로는 M2 가 남아 `*` 접두 URL 에서 버그가 그대로 재현된다.** 두 메커니즘을 모두 고쳐야 한다.

### 2.3 MSW 측 동작 확인 (설계 전제)

```
parse('/v1/subscriptions/:subscription_id\\:cancel')
  → ["/v1/subscriptions", {name:"subscription_id", prefix:"/"}, ":cancel"]   // 이스케이프 콜론은 literal 토큰
http.post('…/:subscription_id\\:cancel').run(POST …/abc:cancel)  → params { subscription_id: 'abc' }  ✓ 매칭
                                       .run(POST …/abc:reject)  → null                                 ✓ 구분됨
http.post('*/v1/subscriptions/:subscription_id\\:cancel')        → 동일하게 매칭                        ✓
parse('/v1/subscriptions/:subscription_id:cancel')               → throws "Must have text between two parameters…"
http.post('…/:subscription_id:cancel', …)                        → 생성 시점엔 안 던짐(lazy) → 매칭 시점(워커)에서 throw
```

- `\:` 는 MSW 에서 정상 동작하는 유일한 표기이며, 키 정규화만 이를 깨고 있다. 즉 **런타임 매칭은 맞고, 등록·표시 단계에서 핸들러가 탈락**하는 버그다.
- 이스케이프 없이 쓴 경우의 "모든 요청 500" 은 path-to-regexp 가 lazy 하게 매칭 시점에 던지기 때문에 생기는 **MSW 고유 동작**이다. 본 수정 범위 밖이며 문서로 안내한다 (§6 선택 과제 참고).

### 2.4 최근 변경 이력

- `486af05 fix(swagger): normalize kebab-case OpenAPI path params (#12)` — `normalizePathParams` 추가 (ADR‑0005). `maskDynamicSegmentsIndexed` · `generateNormalizedUrl` 은 초기 커밋(`2719a1a`) 이후 변경 없음. 회귀가 아니라 **초기 설계부터 이스케이프를 고려하지 않은 결함**이다.

---

## 3. Decisions (설계) — v2 (2026‑10‑09, 사용자 방향 반영)

### 3.0 방향 변경

v1(§3 이전 판)은 "사용자가 MSW 규칙대로 `\:` 를 쓰고, 키 정규화만 이를 보존"하는 안이었다. 사용자 결정: **MSW 와 동작은 맞추되 `\:` 트릭을 사용자에게 요구하지 않는다.** 라이브러리 자체 URL 포맷을 정의하고, 이스케이프는 MSW 경계에서만 처리해 다른 곳(패널 표시·저장 키·시나리오·Swagger 변환)에 사이드이펙트를 남기지 않는다.

### 3.1 라이브러리 URL 포맷 (사용자 계약)

| 표기                        | 의미                                                                      | 예                                                                          |
| --------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 세그먼트 **시작**의 `:name` | 경로 파라미터 (MSW/path-to-regexp 와 동일)                                | `/v1/subscriptions/:subscription_id`                                        |
| 세그먼트 **중간**의 `:`     | 글자 그대로의 콜론 (액션 접미사)                                          | `/v1/subscriptions/:subscription_id:cancel`, `/v1/catalog/products:compare` |
| `\:`                        | 하위호환: 글자 콜론으로 동일 취급                                         | `…/:id\:cancel` ≡ `…/:id:cancel`                                            |
| `{name}`                    | OpenAPI 스타일 파라미터 (기존 `normalizePathParams` 가 `:name` 으로 변환) | `/v1/subscriptions/{id}:cancel` → `/v1/subscriptions/:id:cancel`            |

판별 규칙은 단 하나다: **`:` 앞 글자가 `/` 이면 파라미터, 아니면 글자**. Google AIP‑136 의 `{id}:action` 과 OpenAPI 경로 템플릿 모두 이 규칙 안에 자연스럽게 들어오고, path-to-regexp 의 커스텀 패턴(`:id(\d+)`)·수식어(`?*+`)·그룹(`(cancel)?`) 은 그대로 통과한다. origin 부분(`http://localhost:3000`)의 포트 콜론은 path 와 분리해 건드리지 않는다.

### 3.2 처리 지점 (3곳, 각각 하나의 순수 함수)

```
사용자 url (라이브러리 포맷) ─┬─ 패널 표시 · getHandlerKey(저장 키) · 시나리오   → 원문 그대로 (변경 없음)
                              ├─ getHandlerUniqueKey → generateNormalizedUrl(url)   → 파라미터 토큰만 :paramN 마스킹
                              └─ convertToMswHandler → http[method](toMswPath(url)) → 글자 콜론을 \: 로 이스케이프
Swagger path ── normalizePathParams ──→ 라이브러리 포맷 (위 흐름에 합류; 추가 처리 없음)
```

1. **`toMswPath(url)`** (신규, `utils/handler/pathParams.ts`): origin 을 분리한 뒤 path 에서 `(?<=[^/\\]):` 를 `\:` 로 치환. 이미 이스케이프된 `\:` 는 건드리지 않아 멱등. **`convertToMsw.ts` 의 `http[method](url, …)` 4곳에만 적용**한다. MSW 가 받는 문자열은 지금 사용자가 수동으로 쓰던 것과 동일하므로 매칭·`params` 추출 동작이 MSW 와 완전히 같다.
2. **`generateNormalizedUrl(url)`** (수정): `\:` → `:` 로 정규화한 뒤(하위호환), **세그먼트 시작 `:name` 토큰만** `:paramN` 으로 마스킹한다(현재는 세그먼트 전체). 라이브러리 포맷에는 백슬래시가 없으므로 `new URL` 의 `\`→`/` 치환 문제(M1)가 사라지고, 토큰 단위 마스킹으로 M2 도 해소된다. 키 예: `…/:param1:cancel`, `…/products:compare` vs `…/products/:param1`.
3. **`normalizePathParams`** (변경 없음): `{id}:cancel` → `:id:cancel` 이 곧 라이브러리 포맷이다. 지금까지 Swagger 의 콜론 액션 경로는 MSW 에서 매칭 시점 예외(모든 요청 500)를 냈는데, 1번이 경계에서 이스케이프하므로 **Swagger 콜론 액션도 함께 고쳐진다.**

### 3.3 프로토타입 검증 (msw 2.12.10 / path-to-regexp 6.3.0)

```
입력 url                                                → MSW 로 전달되는 문자열                    | 정규화 키
…/v1/subscriptions/:subscription_id:cancel               → …/:subscription_id\:cancel               | …/:param1:cancel
…/v1/subscriptions/:subscription_id:accept-pending       → …/:subscription_id\:accept-pending       | …/:param1:accept-pending   ← 구분
…/v1/subscriptions/:subscription_id\:cancel (하위호환)   → 동일 (멱등)                              | …/:param1:cancel (같은 키 = 같은 엔드포인트)
*/v1/subscriptions/:subscription_id:cancel               → */v1/subscriptions/:subscription_id\:cancel | */v1/subscriptions/:param1:cancel
…/v1/catalog/products:compare                            → …/products\:compare                      | …/products:compare
…/v1/catalog/products/:slug                              → 그대로                                   | …/products/:param1          ← 구분
http://localhost:3000/v1/items/:id:cancel                → http://localhost:3000/v1/items/:id\:cancel | (포트 콜론 보존)
…/v1/x/:id(\d+)?/y                                       → 그대로                                   | …/v1/x/:param1/y
…/:request_id\:cancel/(cancel)?  (제보자 우회)           → 그대로                                   | …/:param1:cancel/(cancel)

MSW 런타임: ':subscription_id:cancel' 핸들러 → abc:cancel 매칭 {subscription_id:'abc'} / abc:reject 미매칭 / abc 미매칭
            '*' 접두 · 포트 포함 origin · products:compare · 하위호환 \: · 제보자 우회 모두 매칭
            이스케이프 없이 MSW 에 직접 넘기면 매칭 시점 throw 재확인 → 경계 이스케이프가 필수임을 입증
```

### 3.4 검토한 대안

| 안                                                                 | 판정 | 이유                                                                               |
| ------------------------------------------------------------------ | ---- | ---------------------------------------------------------------------------------- |
| v1: 사용자가 `\:` 작성 + 키 정규화만 보존                          | ❌   | 사용자에게 MSW 트릭을 요구하고 패널에 `\:` 가 그대로 노출됨. 사용자 결정으로 기각. |
| 키 정규화를 path-to-regexp `parse()` 토큰으로                      | ❌   | 직접 의존성 추가·`*` coercePath 재현 필요. 3.1 의 단일 규칙으로 충분.              |
| `toMswPath` 를 스토어 적재 시점에 적용(저장 url 자체를 이스케이프) | ❌   | 패널·저장 키·시나리오 export 에 `\:` 가 번짐. "사이드이펙트 없이" 요구에 반함.     |

### 3.5 ADR

ADR 1건: _"Handler URL format: colon after a non-slash is a literal; escaping for path-to-regexp happens only at the MSW boundary"_. 번호는 승인 시 `decisions/INDEX.md` 와 upstream 의 다음 번호로 확정.

---

## 4. 작업 분해 (승인 후 auto‑approve 로 진행)

| #   | 태스크                                                                                                                                                                                                    | 파일                                                           | 산출  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----- |
| T1  | 실패 테스트 — `toMswPath` (§3.3 표 9케이스 + 멱등성) · `generateNormalizedUrl` (키 열)                                                                                                                    | `src/utils/handler/pathParams.test.ts`                         | RED   |
| T2  | 실패 테스트 — `mergeHandlersWithSwagger` 가 콜론 액션 핸들러 3개를 3개로 유지, `*` 접두 동일, `:kubeflow_id` ↔ `:kubeflowId` 병합 유지, `\:` 와 `:` 표기가 같은 엔드포인트로 병합                        | `src/utils/swagger/merge.test.ts` (신규)                       | RED   |
| T3  | 실패 테스트 — `convertToMswHandler` 로 만든 핸들러가 `abc:cancel` 매칭 / `abc:reject` 미매칭 / Swagger 변환 핸들러(`{id}:cancel`)가 500 없이 매칭                                                         | `src/utils/handler/convertToMsw.test.ts` (신규 또는 기존 확장) | RED   |
| T4  | `toMswPath` 구현 + `convertToMsw.ts` 4곳 적용                                                                                                                                                             | `pathParams.ts`, `convertToMsw.ts`                             | GREEN |
| T5  | `generateNormalizedUrl` / `maskDynamicSegmentsIndexed` 토큰 마스킹으로 수정, `\:` 하위호환                                                                                                                | `pathParams.ts`                                                | GREEN |
| T6  | 문서 — `handler-guide.md` `url` 행에 포맷 규칙(세그먼트 시작 `:name` = 파라미터, 그 외 `:` = 글자, `\:` 불필요) 추가 · `troubleshooting.md` "콜론 액션 엔드포인트" 항목 · `HandlerConfigOption.url` JSDoc | docs 2개, `types/config.ts`                                    | 문서  |
| T7  | ADR + `INDEX.md`                                                                                                                                                                                          | `agent-artifacts/decisions/`                                   | ADR   |
| T8  | `pnpm lint` · `test` · `build`, 결과를 §5 에 기록                                                                                                                                                         | —                                                              | 검증  |

예상 규모: 소스 ~50줄, 테스트 ~150줄, 문서 ~25줄.

---

## 5. Validation

- Lint: 0 errors, 3 warnings (모두 기존 `cookie.test.ts` 의 `no-explicit-any`, 이번 변경과 무관)
- Test: 11 files / 102 tests 통과 (기준선 9 files / 77 tests 에서 신규 `convertToMsw.test.ts`, `merge.test.ts`, `pathParams.test.ts` 확장분 추가)
- Build: `tsc && vite build` 통과
- Prettier: 통과

---

## 6. 리스크 · 사이드이펙트 · 선택 과제

| 항목                                        | 평가                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 기존 사용자의 `\:` 표기                     | 계속 동작(`toMswPath` 멱등, 키는 `:` 와 동일). 패널엔 쓴 그대로 `\:` 표시 — 문서에서 `:` 표기를 권장.                                                                                                                                                                                                                                              |
| `getHandlerKey`(저장 키)                    | 원문 url 그대로 → localStorage/cookie 마이그레이션 없음. `\:` → `:` 로 바꿔 쓰면 저장 설정이 초기화되는 것은 url 변경과 같은 정상 동작.                                                                                                                                                                                                            |
| 병합 동작 변화                              | `:id(\d+)` 와 `:id` 병합은 유지. 새로 **구분**되는 것은 글자 콜론이 다른 경우뿐(= 수정 목적).                                                                                                                                                                                                                                                      |
| 세그먼트 중간 `:` 를 파라미터로 쓰던 사용자 | path-to-regexp 상 `/a:b` 의 `:b` 는 원래 파라미터였으나 MSW 에서 앞 토큰 없이는 예외가 나던 형태라 실사용 불가 → 사실상 영향 없음. ADR 에 명시.                                                                                                                                                                                                    |
| **MSW 첫‑매칭 순서**                        | `/:id` 핸들러가 `/:id:cancel` 보다 **앞에** 등록되면 MSW 는 `abc:cancel` 을 `/:id` 로 먼저 매칭한다(`id = 'abc:cancel'`, 프로토타입 확인). 이는 MSW 고유 동작이며 본 수정 전에도 같았다. 문서에 "액션 핸들러를 기본 리소스 핸들러보다 먼저 등록" 안내. 라이브러리가 자동 정렬하는 것은 `mocks` 순서 계약을 바꾸므로 이번 범위에서 제외(선택 과제). |
| dev‑time 검증(선택 과제)                    | 경계 이스케이프로 "이스케이프 누락 → 전체 500" 시나리오 자체가 사라지므로 **v1 에서 제안했던 검증 경고는 불필요해짐.**                                                                                                                                                                                                                             |

## 7. Approval

| Item      | Value                                                                                   |
| --------- | --------------------------------------------------------------------------------------- |
| Decision  | approved                                                                                |
| Approver  | ria.ang@kakaoenterprise.com                                                             |
| Time      | 2026-10-09                                                                              |
| Rationale | v2 설계(라이브러리 포맷 + MSW 경계 이스케이프) 확인 후 "수정 후 브랜치따서 PR 생성해줘" |

### 6.1 제보자 측 임시 우회 (참고)

제보자 프로젝트 `src/_mocks/openApiHandlers.ts` 의 `toMswPath` 가 액션 경로 끝에 path-to-regexp 선택 그룹 `/(cancel)?` 을 덧붙여 키를 갈라 놓고 있다. `new URL` 뒤에 세그먼트 `(cancel)?` 은 `:` 로 시작하지 않아 마스킹을 피하고, MSW 는 `/r1:cancel` 과 `/r1:cancel/cancel` 을 모두 매칭한다. 대신 패널에 `…/:request_id/:cancel/(cancel)?` 로 표시된다. 본 수정이 머지되면 이 우회는 제거 가능하며, 우회가 남아 있어도 A안 키 규칙에서는 `…/:param1\:cancel/(cancel)?` 로 여전히 고유하므로 충돌하지 않는다.

## 8. Execution Log

- 2026‑10‑09 — 승인 후 T1~T8 수행: 테스트 3파일, `pathParams.ts`·`convertToMsw.ts` 구현, 문서 2건 + JSDoc, ADR‑0006, 품질 게이트 통과.
- 2026‑10‑09 — 설계 v2: 사용자 방향(\: 트릭 비요구, 라이브러리 포맷 + MSW 경계 이스케이프)으로 §3·4·6 교체, 프로토타입 재검증.
- 2026‑10‑09 — 이슈 #44 공식 등록 확인, 브랜치 `fix/escaped-colon-handler-key` 생성. 최신 main 기준 원인 재검증(해당 파일 변경 없음).
- 2026‑10‑07 — Phase 1 원인 분석 완료 (재현 스크립트: node + msw 2.x / path-to-regexp 6.3.0). 본 문서 작성, 승인 대기.
