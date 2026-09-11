---
version: 1.0.0
type: spec
task: 'Entry point policy — experimental 실험실 경로와 scenario API 정식 경로 설계'
date: 2026-09-11
tier: full
status: approved
run_id: 2026-09-11-entry-point-policy
related_pr: https://github.com/kakaoenterprise/mocking-gui/pull/18
related_adr: ADR-0006
---

# Entry point policy — Spec

## 1. 목표

PR #18(`1.0.6-alpha.1`)로 배포된 시나리오 저작·주입 API를 대상으로,

1. 앞으로 `-alpha` / `-beta`로 릴리즈될 **실험실 기능의 외부 export 경로와 정식화(graduation) 정책**을 확정하고,
2. 해당 API가 **정식 릴리즈될 때 놓일 경로**를 함수 성격 기준으로 확정하고,
3. 리뷰에서 제기된 **Readonly 타입 제공, `defineHandlers` 명칭, 서버 사이드 동작** 3건을 결론 낸다.

## 2. 배경 진단

### 2.1 현재 export 구조 (1.0.6-alpha.1)

| 엔트리 | 내용 | 성격 |
| --- | --- | --- |
| `.` | `HandlerConfigOption`, `MockingConfig`, `SwaggerSourceConfigOption` (type only) | 공유 타입 계약 |
| `./browser` | `MockingGUIBoundary` | 브라우저 런타임 |
| `./server` | `setupMockingServer` | Node SSR 런타임 |
| `./testing` | `defineHandlers`, `defineScenario`, `extendScenario`, `serializeScenario`, `applyScenario`, `Scenario` | **혼재** (아래 참조) |

### 2.2 확인된 문제

1. **실험실 표시가 없다.** `1.0.6-alpha.1`은 npm `alpha` dist-tag로만 구분되고, `./testing` 경로·심볼·JSDoc 어디에도 실험 표시가 없다. 정식화 시 경로가 바뀌면 alpha 사용자에게 예고 없는 변경이 된다.
2. **`testing`은 용도 추정이지 성격이 아니다.**
   - `defineHandlers`/`defineScenario`/`extendScenario`는 부수효과 없는 순수 선언 함수다. `defineScenario`가 만드는 `Scenario`는 GUI의 `initialScenarios` 런타임 입력과 같은 타입이고, 레지스트리의 핸들러는 `mocks`로 재사용 가능하다. 테스트 전용이 아니다.
   - `serializeScenario`는 localStorage 키/값을 만드는 순수 함수다. Cypress 커맨드, Storybook 데코레이터, 개발 서버의 시나리오 프리셋 URL, 디자인 리뷰용 공유 링크 등 "앱 부팅 전에 상태를 심는" 모든 곳에서 쓸 수 있다.
   - `applyScenario`는 `addInitScript` + `addCookies` 구조 타입을 받는다. 이 조합은 Playwright `BrowserContext` 형태이며, 브라우저 자동화 도구 전반(스크린샷·PDF 생성 등 비테스트 용도 포함)에서 쓰인다.
3. **`ReadonlyHandlerConfig`가 root에서 export되지 않는다.** stable한 `MockingConfig.mocks`의 타입이 이미 `readonly ReadonlyHandlerConfig[]`로 바뀌었는데, 사용자는 이 타입을 참조할 수 없다.
4. **`defineHandlers`는 반환 타입(`HandlerRegistry`)과 이름이 어긋난다.** 핸들러를 정의하는 것이 아니라 핸들러 컬렉션을 조회 가능한 레지스트리로 감싼다.
5. **서버 사이드 동작은 코드상 안전하지만 테스트로 보증되지 않는다.** `./testing` 의존 그래프(`api/*` → `constants/key`, `utils/common/keys`, `utils/browser/cookie`(type import + `document` 가드), `types/handler`(msw 값 import))에 모듈 로드 시 `window`/`document` 접근이 없다. 단, 이를 고정하는 Node 환경 테스트가 없다.

### 2.3 참고한 라이브러리 관리 방식

| 라이브러리 | 구조 | 교훈 |
| --- | --- | --- |
| msw | `msw` / `msw/browser` / `msw/node` / `msw/native` | 선언 계층과 런타임 어댑터 계층을 서브패스로 분리 |
| vitest | `vitest` / `vitest/config` / `vitest/node` / `vitest/browser` | root는 매일 쓰는 최소 표면. 역할별 진입점 |
| react-dom | `react-dom/client` / `react-dom/server` / `react-dom/test-utils` | 테스트 유틸도 "환경"의 하나로 별도 경로 |
| @apollo/client | `@apollo/client/testing` | `testing` 경로는 **테스트에서만 의미 있는 것**(MockedProvider 등)에 한정 |
| React / Remix / TanStack | `unstable_` · `experimental_` 심볼 접두 | 정식화 시 접두 제거 + 1 minor deprecated alias 유지 |
| Angular | JSDoc `@experimental` / `@developerPreview` | 경로 변경 없이 문서·타입 힌트로만 표시 |

브라우저 자동화 도구의 "부팅 전 스크립트 주입 + 쿠키 세팅" API 비교:

| 도구 | 주입 | 쿠키 | 현재 `applyScenario` 구조 타입 |
| --- | --- | --- | --- |
| Playwright | `context.addInitScript(fn, arg)` | `context.addCookies([...])` | 호환 |
| WebdriverIO v9 | `browser.addInitScript(fn, arg)` (WebDriver BiDi `script.addPreloadScript`) | `browser.setCookies([...])` | 메서드명 1개 차이 |
| Puppeteer | `page.evaluateOnNewDocument(fn, ...args)` | `browserContext.setCookie(...)` | 이름·시그니처 다름, 의미 동일 |
| Cypress | `cy.visit(url, { onBeforeLoad })` | `cy.setCookie` | 인프로세스 모델. `serializeScenario`만 필요 |
| Vitest browser mode / Storybook | 페이지 내부 실행 | 페이지 내부 실행 | 어댑터 불필요. `serializeScenario` 결과를 직접 씀 |

결론: 어댑터가 필요한 부류는 "프로세스 밖에서 브라우저를 조종하는 도구" 전부이고, 인프로세스 도구는 직렬화 함수만 필요하다. 두 함수는 같은 도메인(시나리오 주입)의 두 층이며, 어댑터 본체가 수십 줄이라 경로를 따로 나눌 관리 단위가 되지 않는다.

## 3. 결정

### 3.1 엔트리 구조 (정식화 후, 목표 `1.1.0`)

| 엔트리 | 성격 | 내용 |
| --- | --- | --- |
| `.` | **타입 계약만.** 기존 정체성 유지, 값 export 금지 | 기존 3 타입 + `ReadonlyHandlerConfig`, `Scenario` |
| `./browser` | 브라우저 런타임 | `MockingGUIBoundary` (변경 없음) |
| `./server` | Node SSR 런타임 | `setupMockingServer` (변경 없음) |
| `./scenario` | **시나리오 도메인.** 저작(순수) + 직렬화(순수) + 자동화 드라이버 주입 어댑터 | `defineRegistry`, `defineScenario`, `extendScenario`, `serializeScenario`, `applyScenario` + `HandlerRegistry`, `Selection`, `ScenarioOptions`, `ApplyScenarioOptions`, `InitScriptCapable` 타입 |
| `./experimental` | **실험실.** semver 보장 제외 | alpha/beta 단계 기능 전체 |

원칙:

- root에 값(함수)을 넣지 않는다. 타입과 함수가 섞이면 관리 포인트가 흐려지고, root가 "매일 쓰는 최소 표면"이라는 정체성을 잃는다.
- 서브패스는 **용도(testing/e2e)가 아니라 도메인·성격(scenario/browser/server)** 으로 이름 짓는다.
- `./testing`은 만들지 않는다. `1.0.6-alpha.1`의 `./testing`은 `alpha.2`에서 제거한다. prerelease이므로 alias 없이 changelog로 안내한다.

### 3.2 실험실(experimental) 정책

**라이프사이클**

```
[experimental]  ./experimental 에서만 export
    │           npm dist-tag: alpha → beta
    │           semver 보장 없음 (README 명시). latest 에 포함되어도 경로가 경고 역할
    ▼
[graduated]     성격에 맞는 정식 서브패스로 이동 (minor 릴리즈)
    │           ./experimental 에는 @deprecated re-export 를 "1 minor" 유지
    ▼
[removed]       다음 minor 에서 ./experimental 의 re-export 제거
```

**규칙**

1. 실험 기능은 `src/experimental.ts`에서만 re-export한다. 구현 파일은 정식화 후 옮길 필요가 없도록 처음부터 도메인 디렉터리(`src/api/scenario/…`)에 둔다. 정식화는 **barrel 파일 한 줄 이동**으로 끝나야 한다.
2. 실험 기능의 공개 타입에는 JSDoc `@experimental` 태그를 단다. 정식화 시 제거한다.
3. `./experimental`은 `package.json` `exports`와 README에 "semver 보장 제외, minor 릴리즈에서 breaking 가능"으로 명시한다.
4. prerelease 배포는 `test/vX.Y.Z-alpha.N` 브랜치 → `alpha` dist-tag(현행 유지). API가 동결되면 `beta` dist-tag. 정식화는 main 머지 + minor 범프.
5. 정식화 시 `./experimental`의 deprecated re-export는 `@deprecated Moved to '@kakaocloud/mocking-gui/<path>' in vX.Y.0. Will be removed in vX.(Y+1).0.` 문구를 단다.
6. **Export surface guard**: 5개 엔트리 각각에 `public-api.test.ts` 패턴의 surface 스냅샷 테스트를 둔다(`Object.keys(entry).sort()` 일치). 심볼의 추가·이동·삭제가 항상 테스트 변경을 동반하는 명시적 행위가 된다.

### 3.3 이번 사이클 변경 (`1.0.6-alpha.2`)

| # | 변경 | 근거 |
| --- | --- | --- |
| A | `src/experimental.ts` 신설, `./experimental` exports/typesVersions/vite entry 추가. `src/testing.ts`·`./testing` 제거 | §3.2 규칙 1 |
| B | `defineHandlers` → `defineRegistry` rename | 반환 타입 `HandlerRegistry`와 일치. `define*` 패밀리(`defineScenario`) 일관성. alpha 기간이므로 alias 없음 |
| C | `HandlerRegistry.handlers: T` 추가 | 선언한 핸들러를 `mocks`에 그대로 넘기는 재사용 경로(리뷰 Q2). 선언 API가 테스트 전용이 아님을 코드로 증명 |
| D | `ReadonlyHandlerConfig` root export. `Scenario`도 root로 승격 | stable `MockingConfig.mocks`의 타입. `Scenario`는 GUI 런타임 입력과 주입 API가 공유하는 계약 |
| E | `src/api/*` → `src/api/scenario/*`로 디렉터리 정리 | 정식화 때 barrel 한 줄만 바뀌게 |
| F | Node 환경 스모크 테스트: `// @vitest-environment node`에서 `../experimental` import 후 5개 심볼이 함수임을 확인, `applyScenario`를 fake `InitScriptCapable`로 end-to-end 실행 | §2.2-5 보증 |
| G | 5개 엔트리 surface 스냅샷 테스트 | §3.2 규칙 6 |
| H | 문서: `docs/guide/usage/api-guide.md`에 "Entry points" 절 + experimental 정책, `scenario-guide.md`에 "Programmatic scenarios & injection" 절 | PR Action item |
| I | `InitScriptCapable`의 쿠키 메서드를 `addCookies` 또는 `setCookies` 중 하나로 허용 | WebdriverIO v9 무비용 호환. 구조 타입 변경만 |

**Readonly 타입 가이드(문서에 명시)**

- 권장: `defineRegistry([...])`에 **인라인**으로 선언한다. `const T` 제네릭이 리터럴을 보존하므로 `as const`도 `satisfies`도 불필요하다.
- 변수로 분리하는 경우: `as const satisfies readonly ReadonlyHandlerConfig[]`. `satisfies`가 오타 필드를 잡고 `as const`가 리터럴을 보존한다.
- `HandlerConfigOption[]`로 어노테이션한 기존 배열도 `defineRegistry`에 넣을 수 있다. 이름·variant 자동완성만 `string`으로 퇴화하고 런타임 검증은 유지된다(현행 설계 유지).
- 추가 Readonly 타입(`ReadonlyMockingConfig` 등)은 만들지 않는다. 수요가 확인되지 않았다.

### 3.4 정식화 시 변경 (`1.1.0`)

- `src/scenario.ts` 신설, `./scenario` exports 추가. `src/experimental.ts`는 같은 심볼을 `@deprecated`로 re-export.
- `1.2.0`에서 `src/experimental.ts`의 해당 re-export 제거. 그 시점에 다른 실험 기능이 없다면 엔트리는 빈 파일로 유지한다(경로 자체는 삭제하지 않는다).

## 4. 범위 밖

- `responseVariantsFn` 기반 동적 응답의 시나리오 주입(리뷰 Q3). 별도 실험 기능으로 분리.
- `defineHandler`(단수), `serializeScenarioCookie` 공개. 내부 유지.
- Puppeteer/Cypress 전용 어댑터 추가. `./scenario` 경로 안에 `applyScenarioToPage` 등으로 추가할 수 있는 자리만 남긴다.
- 기존 `./browser`, `./server` 내용 변경.

## 5. 검증 기준

- `pnpm lint` (tsc + tsconfig.test.json + eslint), `pnpm test`, `pnpm build` 통과.
- `dist/experimental.{js,cjs,d.ts}` 생성, `dist/testing.*` 미생성.
- Node 스모크 테스트가 jsdom 없이 통과.
- `examples/` 중 하나에서 `@kakaocloud/mocking-gui/experimental` import로 Playwright 시나리오 주입이 동작(yalc 또는 workspace link).

## 6. 승인

- 승인자: ria.ang@kakaoenterprise.com
- 승인 일시: 2026-09-11 15:01
- 이 승인 이후 단계는 auto-approve로 진행한다.
