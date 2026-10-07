<!--
msw-show-and-tell-draft.md 의 한국어판.
국내 채널(GeekNews / 기술 블로그 / 사내 공유)용.

게시 전 확인:
  [ ] DEMO_URL — 아직 미배포 (feat/showcase-demo PR 대기)
  [ ] GIF 또는 스크린샷 — 상단에 하나 필요
  [ ] "규모 있는 콘솔 프론트엔드" 표현 — 사내 사용 언급 수위 확인
  [ ] rough edges 4건이 게시 시점에도 열려 있는지

영문판과 다른 점:
  - MSW 자체를 모르는 독자가 섞이므로 MSW 한 줄 설명을 추가했다.
  - 맺음말의 "Thanks for MSW"는 MSW 저장소 맥락이라 국내판에서는 톤을 조정했다.
-->

# Mocking GUI — MSW handler를 GUI로 조작하는 패널

안녕하세요 👋

규모가 좀 있는 콘솔 프론트엔드를 개발하면서 MSW를 꽤 오래 써왔는데, 같은 불편이
반복해서 나타났습니다.

1. **응답 하나 바꾸려면 코드를 고쳐야 했습니다.** 500 한 번, 429 한 번, 빈 목록 한 번
   보려면 수정 세 번에 리로드 세 번이었습니다.
2. **동료가 겪은 버그를 재현하려면 그 사람의 mock 설정을 손으로 다시 만들어야 했습니다.**
   채팅에 적힌 설명만 보고요.

그래서 MSW 위에 GUI 레이어를 만들어 MIT로 공개했습니다. 기존 handler를 대체하지 않고,
**읽어서 런타임에 조작할 수 있는 패널을 붙여주는** 방식입니다.

> MSW(Mock Service Worker)를 처음 보신다면 — Service Worker로 네트워크 요청을 가로채
> 가짜 응답을 돌려주는 라이브러리입니다. 애플리케이션 코드는 실제 API를 부르는 그대로
> 두고, 응답만 바꿔치기할 수 있습니다.

<!-- GIF: 왼쪽에 패널을 열어두고 오른쪽 응답이 200 → 429 로 바뀌는 장면 -->

**▶ 라이브 데모: DEMO_URL** — 저 페이지 뒤에는 서버가 없습니다. 모든 응답은 브라우저
안의 MSW가 만들고, 무엇을 돌려줄지는 패널이 정합니다.

## 설치

```bash
npm i -D @kakaocloud/mocking-gui
npx msw init public/     # 아직 안 하셨다면
```

peer: `msw@^2.8.0`, `react@^18 || ^19`.

## 설정

```tsx
import { MockingGUIBoundary } from '@kakaocloud/mocking-gui/browser';

import { mockConfig } from './mocks/config';

export default function App() {
  if (process.env.NODE_ENV !== 'development') return <AppContent />;

  return (
    <MockingGUIBoundary config={mockConfig}>
      <AppContent />
    </MockingGUIBoundary>
  );
}
```

이 boundary가 worker를 기동하고, **모킹 준비가 끝날 때까지 렌더링을 붙잡아 둡니다** —
handler가 등록되기 전에 실제 요청이 새어 나가는 걸 막기 위해서입니다. 패널 자체는
shadow root 안에 마운트되므로 패널의 CSS가 앱에 닿지 않습니다.

## 응답 정의하기

handler는 엔드포인트 하나와 그 엔드포인트가 돌려줄 수 있는 상태들의 목록입니다.
variant 하나가 패널의 드롭다운 항목 하나가 됩니다.

```ts
import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

export const handlers: HandlerConfigOption[] = [
  {
    name: 'Get user',
    description: '패널에서 엔드포인트 옆에 표시됩니다',
    url: 'https://api.example.com/v1/users/:userId',
    method: 'get',
    responseVariants: [
      { name: 'Viewer', status: 200, body: { role: 'viewer' } },
      { name: 'Admin', status: 200, body: { role: 'admin' } },
      { name: 'Not found', status: 404, body: { error: { code: 'USER_NOT_FOUND' } } },
      {
        name: 'Rate limited',
        status: 429,
        headers: { 'Retry-After': '30', 'X-RateLimit-Remaining': '0' },
        body: { error: { code: 'RATE_LIMITED' } },
      },
    ],
  },
];
```

variant 드롭다운 옆에는 handler마다 on/off 스위치와 delay(ms) 입력칸이 있습니다.
off는 실제 서버로 `passthrough()`고, delay는 **로딩 상태를 실제로 멈춰 세워 볼 수 있는
가장 빠른 방법**입니다.

<details>
<summary><b>고정 목록으로 부족할 때 — 응답을 계산하기</b></summary>

목록 대신 함수를 넘기면 됩니다. 요청 객체를 받으므로 쿼리 파라미터, path 파라미터,
헤더, 쿠키에 따라 응답을 달리 만들 수 있습니다. 패널에는 `Auto`로 표시되고, 고를
variant가 없습니다 — 요청이 결정하니까요.

```ts
{
  name: 'Search',
  url: `${BASE}/search`,
  method: 'get',
  responseVariantsFn: ({ request, params, cookies }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));

    const matched = CORPUS.filter(item => item.includes(query));
    if (query && matched.length === 0) {
      return { name: 'No matches', status: 404, body: { error: { code: 'NO_RESULTS' } } };
    }

    return {
      name: 'Page',
      status: 200,
      body: { query, page, total: matched.length, items: matched.slice((page - 1) * 20, page * 20) },
    };
  },
}
```

</details>

<details>
<summary><b>JSON이 아닌 응답</b></summary>

`rawBody`는 응답 본문과 content type을 직접 지정합니다. 파일 다운로드, 레거시 XML
엔드포인트, `multipart/form-data` 응답 같은 경우에 씁니다.

```ts
responseVariants: [
  { name: 'CSV', status: 200, rawBody: { kind: 'text', value: csv } },
  { name: 'Invoice', status: 200, rawBody: { kind: 'html', value: html } },
  { name: 'Feed', status: 200, rawBody: { kind: 'xml', value: feed } },
  { name: 'Receipt', status: 201, rawBody: { kind: 'formData', value: formData } },
  { name: 'Archive', status: 200, rawBody: { kind: 'arrayBuffer', value: buffer } },
];
```

</details>

<details>
<summary><b>OpenAPI 문서로 handler 자동 생성</b></summary>

```ts
import type { MockingConfig } from '@kakaocloud/mocking-gui';

export const mockConfig: MockingConfig = {
  mocks: handlers,
  swagger: [
    {
      name: 'My API',
      configUrl: 'https://api.example.com/openapi.json',
      serverUrl: 'https://api.example.com', // MSW가 가로챌 오리진
      docsUrl: 'https://api.example.com/docs', // 선택. 패널에서 문서로 링크됩니다
    },
  ],
};
```

문서의 response schema에서 응답을 샘플링해 handler를 만들고, 직접 작성한 handler와
병합합니다(직접 작성한 쪽이 우선). 주로 **아무도 손대지 않은 나머지 엔드포인트들**을
위한 기능입니다 — 일일이 적지 않아도 일단 토글할 무언가가 생깁니다.

</details>

## 시나리오 — 결국 가장 많이 쓰게 된 기능

시나리오는 **여러 handler의 상태를 한 번에 묶은 스냅샷**입니다. _결제는 503, 지표는
degraded, 알림은 읽지 않음_ 같은 조합이죠. 패널에서 handler들을 원하는 조합으로 맞추고
저장한 뒤, 코드로 공유합니다.

```
eyJpZCI6ImRlbW8tcGF5bWVudC1vdXRhZ2UiLCJuYW1lIjoiUGF5bWVudCBwcm92aWRlciBvdXRhZ2Ui...
```

작은 JSON 객체의 base64입니다. **Scenarios → Import**에 붙여넣으면 앱 전체가 그 상태로
이동합니다. 저희는 이제 버그 리포트에 재현 절차를 나열하는 대신 이 코드 한 줄을 넣습니다.

## 패널이 건드리지 않았으면 하는 handler

```ts
import { graphql, HttpResponse } from 'msw';

export const mockConfig: MockingConfig = {
  mocks: handlers,
  onDemandHandlers: [graphql.query('Me', () => HttpResponse.json({ data: { me } }))],
};
```

이 handler들은 MSW로 그대로 전달됩니다. 토글도 variant도 없습니다. GraphQL, WebSocket,
항상 떠 있어야 하는 인프라성 라우트는 그대로 두고 주변 REST handler만 마음대로 바꿀 수
있습니다.

## SSR / RSC

패널 상태는 쿠키로도 동기화되기 때문에, 서버 렌더링에서도 브라우저와 **같은 모킹 상태**를
보게 만들 수 있습니다. Next.js App Router 기준:

```tsx
import { setupMockingServer } from '@kakaocloud/mocking-gui/server';
import { cookies } from 'next/headers';

export default async function Page() {
  const server = await setupMockingServer({
    ...mockingConfig,
    cookie: (await cookies()).toString(),
  });

  server?.listen();
  try {
    return await ServerComponent();
  } finally {
    server?.close();
  }
}
```

가장 까다로웠던 부분이고, 쿠키 동기화가 존재하는 이유이기도 합니다.

## MSW 공개 API만 사용합니다

`http` · `HttpResponse` · `passthrough` · `delay` · `setupWorker` · `setupServer` ·
`resetHandlers`. MSW 내부를 패치하지 않기 때문에 지금까지 버전 업이 조용히 지나갔습니다.

## 아직 거친 부분

직접 부딪히시기 전에 미리 적어둡니다.

- **새 브라우저에서는 handler가 전부 비활성으로 시작합니다.** 패널을 열어 필요한 것을
  켜야 합니다. 기본값을 활성으로 선언할 방법이 아직 없는데, **가장 먼저 고치고 싶은
  부분**입니다. 스크립트로 상태를 세팅하는 것도 이것 때문에 막혀 있습니다.
- **프로그래매틱 API가 없습니다.** 상태가 `localStorage`와 동기화 쿠키에 있어서,
  Playwright나 코딩 에이전트로 조작하려면 지금은 그 둘을 직접 써야 합니다.
- `rawBody: { kind: 'binary' }`는 타입에는 있는데 구현이 없습니다. 에러 없이 JSON 응답으로
  빠집니다. 수정 중입니다.
- `Auto` handler는 아직 응답 `headers`를 전달하지 않습니다. variant 목록 방식과 다릅니다.

## 링크

- **라이브 데모:** DEMO_URL
- **GitHub:** https://github.com/kakaoenterprise/mocking-gui
- **npm:** https://www.npmjs.com/package/@kakaocloud/mocking-gui
- **문서:** https://kakaoenterprise.github.io/mocking-gui

## 의견을 듣고 싶은 것

1. 시나리오 코드가 이슈에 붙여넣기 좋은 형태인가요, 아니면 파일이나 URL 파라미터가 더
   나을까요?
2. 테스트나 코딩 에이전트에서 MSW를 조작하시는 분들 — `applyMockState(configs)` 같은
   프로그래매틱 API가 맞는 방향일까요, 아니면 표면적을 좁게 두고 쿠키·스토리지를 직접
   쓰는 편이 나을까요?
3. handler 설정 구조가 기존에 MSW handler를 정리하시던 방식과 어긋나는 지점이 있나요?
   저희 코드베이스 밖에서도 통할지 가장 확신이 없는 부분입니다.

피드백은 무엇이든 환영합니다. 특히 "이건 X로 이미 되는데"류의 지적이 지금 가장 도움이
됩니다. 🙏
