---
version: 1.0.0
type: spec
task: 'Standalone mock server: 앱 밖에서 실행하는 mock 서버, session별 상태, HTTP 조작 API'
date: 2026-11-19
tier: full
status: draft
related_adr: ADR-0009
---

# Standalone mock server — Spec

## 1. 목표

1. 기존 `mocks`와 시나리오를 고치지 않고 앱 밖의 서버 프로세스에서 응답합니다.
2. mock 상태를 session 단위로 나눠, 테스트 worker와 캡처 도구와 Agent가 서버 하나를 동시에 씁니다.
3. 상태를 만들고 읽는 방법을 HTTP 호출 하나로 통일합니다.
4. 실험 기능으로 `./experimental`에서만 내보냅니다(ADR-0007). worker 경로와 `setupMockingServer`는 지금 동작 그대로 둡니다.

## 2. 배경 진단

### 2.1 지금 구조

| 위치     | 하는 일                                                                                   |
| -------- | ----------------------------------------------------------------------------------------- |
| 브라우저 | 패널이 상태를 localStorage에 저장하고, service worker가 브라우저의 API 요청에 응답합니다. |
| 쿠키     | 켜진 핸들러의 상태를 `mocking_gui_sync`에 담아 서버로 보냅니다(ADR-0001, ADR-0008).       |
| 서버     | `setupMockingServer`가 요청마다 쿠키를 읽어 프로세스에 하나뿐인 MSW 서버에 적용합니다.    |

mock 상태의 원본이 브라우저 한 곳에만 있고, 서버는 요청이 올 때마다 그 사본을 받습니다.

### 2.2 확인한 문제

Next.js 16 App Router 앱(핸들러 170개, 시나리오 66개, Playwright E2E 145건, 아래에서 앱 A)과 다른 앱의 mock 정의(핸들러 402개, 앱 B)에서 측정했습니다. 측정 조건은 `reports/integrity-validation.md`에 있습니다.

| 문제                                             | 원인                                                                                                                        | 측정                                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 브라우저가 아닌 도구는 상태를 만들거나 읽지 못함 | 상태가 그 브라우저의 localStorage와 쿠키에만 있습니다.                                                                      | 화면 상태 하나를 만드는 데 임시 테스트 파일 18줄과 test runner 실행이 필요했고 1,561ms가 걸렸습니다(3회 중앙값).      |
| SSR 중 서버가 호출한 API를 밖에서 볼 수 없음     | 요청 기록이 없습니다.                                                                                                       | 브라우저에서 보이는 요청만 남습니다.                                                                                  |
| 쿠키가 여전히 한도                               | 켜진 핸들러 전체를 쿠키 하나(3,800byte)에 담습니다.                                                                         | 앱 B의 핸들러 402개를 모두 켜면 119개의 설정이 버려집니다.                                                            |
| 빌드 결과물을 mock으로 검증하지 못함             | Quick Start 안내대로 `NODE_ENV === 'development'`일 때만 켜므로 worker, 패널, 서버 안 mock이 운영 빌드에 들어가지 않습니다. | 빌드 결과물로 실행할 수 있는 E2E가 없었습니다.                                                                        |
| 서버 상태가 프로세스에 하나                      | 요청의 쿠키를 프로세스 전체의 MSW 서버에 적용합니다.                                                                        | 실제 요청 1,280건에서는 섞이지 않았지만, 적용과 응답 사이에 await를 넣은 단위 실험에서는 400건 중 190건이 섞였습니다. |
| 화면이 worker 준비를 기다림                      | `MockingGUIBoundary`가 worker 준비 전에는 children을 그리지 않습니다.                                                       | 목록 화면의 SSR HTML 본문이 35자였고 화면 완성까지 500.8ms가 걸렸습니다(dev 서버, 10회 중앙값).                       |
| 스트리밍과 파일 응답을 핸들러로 만들지 못함      | 핸들러가 variant 객체로만 응답합니다.                                                                                       | 앱 A는 스트리밍 응답용 route를 앱 안에 따로 두고 있습니다.                                                            |

### 2.3 PoC에서 맞지 않았던 전제

1. 병렬 실행은 이 기능만의 효과가 아닙니다. 기존 경로로도 앱 A의 E2E 145건을 worker 4개로 실행하면 통과와 실패 목록이 같았습니다(324.3초에서 110.6초). mock 서버가 같은 worker 수에서 더 줄인 시간은 18%입니다(112.6초에서 92.4초). 다만 2.2절의 단위 실험처럼 기존 구조는 섞이지 않는다고 보장하지 않습니다.
2. 경로 prefix(`/s/<id>`)만으로는 빌드 결과물의 E2E를 병렬로 실행하지 못했습니다. 요청 경로를 정확히 비교하는 테스트 파일 12개가 요청을 찾지 못했습니다. 그래서 session 값이 없는 요청을 받는 기본 session(`defaultScenario`)을 더했습니다.
3. 캡처 케이스 하나의 시간은 12%만 줄었습니다(2,113ms에서 1,854ms). 케이스 시간의 대부분은 캡처 도구의 고정 대기입니다.
4. 조회 한 번으로 이름을 모두 얻지 못했습니다. 핸들러 170개의 목록 응답이 71,098byte라 Agent 도구의 출력 한도를 넘었습니다. 검색 조건이 필요합니다.
5. 기존 코드를 전혀 바꾸지 않을 수는 없었습니다. 앱 B는 요청 body를 읽는 async `responseVariantsFn` 때문에 1.0.9에 patch를 적용하고 있었고, 같은 수정이 기존 Auto 핸들러에 필요했습니다.

## 3. 결정

### 3.1 구조

| 위치                | 하는 일                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------- |
| 브라우저            | mock 코드가 없습니다. API 요청이 mock 서버로 갑니다.                                     |
| 앱 서버             | API 주소만 mock 서버로 지정합니다. dev 서버와 빌드 결과물에서 같습니다.                  |
| mock 서버           | session마다 응답 선택과 요청 기록을 가집니다. 기존 `mocks`와 시나리오를 그대로 읽습니다. |
| 테스트, 도구, Agent | 조작 API(HTTP)로 session을 만들고, 응답을 바꾸고, 요청 기록을 읽습니다.                  |

### 3.2 공개 API

`@kakaocloud/mocking-gui/experimental`에서만 내보냅니다.

```ts
createMockServer(options: MockServerOptions): MockServer

interface MockServerOptions {
  mocks: readonly StandaloneHandler[]; // MockingConfig.mocks 와 같은 입력에 respond 를 더할 수 있음
  scenarios?: readonly Scenario[];
  baseUrl?: string; // 핸들러 url 을 만들 때 쓴 base. 잘라내고 남은 부분이 route path
  defaultScenario?: string; // session 값이 없는 요청을 받을 시나리오
  root?: string; // 서버를 실행한 폴더. health 응답에 그대로 나옴
}

interface MockServer {
  handle(request: Request): Promise<Response>; // socket 없이 요청 하나를 처리
  listen(port?: number, host?: string): Promise<{ url: string; port: number }>; // 기본 127.0.0.1
  close(): Promise<void>;
}
```

- `handle`은 웹 표준 `Request`와 `Response`만 씁니다. `listen`은 Node 전용이고 `process.getBuiltinModule`로 `node:http`를 얻습니다. 이 entry를 브라우저 번들도 읽기 때문에 module graph에 Node import를 두지 않습니다.
- 핸들러는 `respond(request, { params })`를 더할 수 있습니다. 웹 `Response`를 반환하고 stream body는 만들어지는 대로 보냅니다.

### 3.3 session 값 전달

먼저 맞는 것을 씁니다.

1. 요청 header `x-mogu-session`
2. 경로 prefix `/s/<session id>`. prefix는 경로를 비교하기 전에 잘라냅니다.
3. 쿠키 `mogu_session`
4. `defaultScenario`가 있으면 `default` session. 없으면 400 `session_required`

### 3.4 조작 API

경로는 `/__mogu` 아래이고 핸들러와 비교하지 않습니다.

| 호출                                            | 동작                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET /__mogu/health`                            | 핸들러, 시나리오, session의 수와 `root`를 반환합니다.                                                          |
| `GET /__mogu/handlers`, `GET /__mogu/scenarios` | 핸들러의 이름, 경로, variant 이름과 시나리오 목록을 반환합니다.                                                |
| `POST /__mogu/sessions`                         | `scenario`, `from`(다른 session 복제), `configs`로 session을 만들고 header, 쿠키, 경로 prefix 값을 반환합니다. |
| `GET /__mogu/sessions`                          | session 목록을 반환합니다.                                                                                     |
| `GET`, `DELETE /__mogu/sessions/:id`            | session의 설정과 pick을 반환하거나 session을 지웁니다.                                                         |
| `PUT /__mogu/sessions/:id/scenario`             | 시나리오를 바꾸고 pick을 모두 지웁니다.                                                                        |
| `POST`, `DELETE /__mogu/sessions/:id/picks`     | pick 하나를 더하거나 모두 지웁니다.                                                                            |
| `POST /__mogu/sessions/:id/mark`                | 이후 요청에 화면 이름을 붙입니다.                                                                              |
| `GET /__mogu/sessions/:id/log`                  | 요청 기록을 반환합니다. `since`, `handler`, `screen`으로 거릅니다.                                             |
| `GET /__mogu/sessions/:id/wait`                 | 지정한 핸들러가 `count`번 응답하면 바로 응답합니다. `timeout` 기본값은 5초, 최대 60초입니다.                   |

오류는 `{ error, message, ... }` JSON이고, 이름을 찾지 못하면 가까운 핸들러 이름을 최대 3개 함께 반환합니다.

### 3.5 pick 규칙

- 답은 `variant`, `auto`, `response`(상태 코드와 body를 직접 적음), `fail: 'network'` 가운데 하나입니다. `delay`만 줄 수도 있습니다.
- 나중에 더한 pick이 먼저 적용됩니다. 답이 있는 첫 pick이 응답을 정합니다.
- `delay`만 있는 pick은 그 아래에서 정해진 응답을 늦춥니다.
- `after`는 지정한 핸들러가 요청된 뒤부터 적용됩니다. `times`는 그 횟수만큼 적용된 뒤 멈춥니다.

### 3.6 응답 규칙

- 응답은 기존 변환 함수(`createManualHandler`)로 만듭니다. `rawBody`, header, delay의 규칙이 worker 경로와 같습니다.
- mock이 응답하지 못한 요청은 501 `not_mocked`입니다. 사유(`no_handler`, `inactive`, `variant_missing`, `swagger_unsupported`)와 가까운 핸들러 이름을 반환합니다. 실제 backend로 넘기지 않습니다.
- 응답 header `x-mogu-handler`, `x-mogu-variant`, `x-mogu-source`에 어떤 핸들러의 어떤 variant가 응답했는지 적습니다.
- 요청 기록은 session마다 5,000건까지 보관합니다.

### 3.7 이 run의 변경

| #   | 변경                                                                                                            | 근거                                                     |
| --- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| A   | `src/api/standalone/` 구현. `src/experimental.ts`에서만 export하고 `experimental.surface.test.ts`의 목록을 갱신 | ADR-0007 규칙 1, 4                                       |
| B   | `responseVariantsFn`의 반환 타입에 Promise 허용, 기존 Auto 핸들러가 결과를 await                                | 2.3절 5번                                                |
| C   | `createMockServer`의 `mocks`가 `MockingConfig.mocks`와 같은 입력을 받는지 고정하는 타입 테스트                  | 정의 하나를 worker, `setupMockingServer`, mock 서버가 씀 |
| D   | `docs/guide/usage/api-guide.md`에 `createMockServer` 절 추가                                                    | 실험 기능 문서화                                         |
| E   | ADR-0009(Proposed)                                                                                              | ADR-0008이 별도 후보로 남긴 서버 상태 저장소             |

## 4. 범위 밖

- 만든 항목이 목록에 나오게 하는 데이터 보관
- 응답을 OpenAPI 스펙과 대조하는 검사
- 패널이 session을 보거나 조작하는 화면
- 일부 API만 mock으로 응답하고 나머지를 backend로 보내는 proxy
- Swagger 핸들러의 응답, 명령줄 실행 도구, session 만료
- worker 경로와 `setupMockingServer`의 제거나 변경

## 5. 검증 기준

- `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`가 통과합니다.
- `experimental.surface.test.ts`가 jsdom 없이 통과하고, build 결과물에 `node:` import가 없습니다.
- 예제 앱(`react-csr`, `next-app-router`, `showcase`)의 build가 통과합니다.
- 소비 앱에 build를 설치했을 때 타입 검사와 단위 테스트가 통과하고, E2E의 통과와 실패 목록이 worker 경로와 mock 서버 경로에서 같습니다.

## 6. 미결 사항

1. 정식화할 경로. `./standalone`, 다른 이름, 별도 package 가운데 정해야 합니다.
2. Node 전용 실험 기능의 entry. 지금은 `./experimental` 하나라서 시나리오 API만 쓰는 브라우저 번들도 mock 서버 코드를 읽습니다(`dist/experimental.js` 4.0KB에서 35.5KB).
3. 이름. `/__mogu`, `x-mogu-session`, `mogu_session`을 기존 `mocking_gui_*` 이름에 맞출지 정해야 합니다.
4. worker 경로의 앞날. 수동 조작용으로 남길지, 패널을 mock 서버에 연결하고 걷어낼지 정해야 합니다.
5. 핸들러 목록 조회의 검색 조건(2.3절 4번).
6. 기존 Auto 핸들러 수정(변경 B)을 이 PR에 둘지, 별도 fix로 먼저 낼지 정해야 합니다.

## 7. 승인

- 상태: 승인 대기
- 이 run은 파이프라인 밖에서 진행한 PoC를 정리한 것입니다. Phase별 persona 위임과 gate 기록이 없습니다.
- 2026-11-19에 프로젝트 오너가 실험 entry(`./experimental`)로 옮겨 PR로 올리도록 정했습니다. spec과 ADR-0009의 승인은 그 PR의 리뷰에서 받습니다.
