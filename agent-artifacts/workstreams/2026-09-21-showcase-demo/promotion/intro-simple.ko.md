<!--
간결판: "무엇을 제공하는가 + 어떻게 쓰는가" 만 남긴 버전.
긴 버전(msw-show-and-tell-draft.ko.md)은 MSW Discussions 용, 이 버전은
README 상단 / 사내 공유 / 짧은 소개글 용.

게시 전: DEMO_URL 채우기, 상단 GIF 1장.
-->

# Mocking GUI

MSW로 만든 mock 응답을 **코드 수정 없이 GUI에서 전환**하는 패널입니다.
기존 handler를 대체하지 않고, 읽어서 런타임에 조작할 수 있게 해줍니다.

**▶ 라이브 데모: DEMO_URL** (서버 없이 브라우저 안에서 전부 동작합니다)

## 제공하는 기능

| 기능                 | 설명                                                                                             |
| :------------------- | :----------------------------------------------------------------------------------------------- |
| **응답 전환**        | 한 엔드포인트에 여러 응답을 등록해두고 드롭다운으로 전환. 200 / 404 / 500 / 429를 클릭 한 번으로 |
| **on/off**           | 끄면 실제 서버로 `passthrough()`. 켠 것만 가로챕니다                                             |
| **지연 주입**        | handler별 delay(ms). 로딩 상태를 멈춰 세워두고 볼 수 있습니다                                    |
| **동적 응답**        | 요청의 쿼리·path 파라미터·헤더·쿠키를 읽어 응답을 계산                                           |
| **JSON 외 응답**     | text · html · xml · formData · arrayBuffer                                                       |
| **OpenAPI 가져오기** | 문서 URL만 주면 response schema로 handler 자동 생성                                              |
| **시나리오**         | 여러 handler 상태를 묶어 저장하고, 코드 한 줄로 공유                                             |
| **SSR / RSC**        | 쿠키 동기화로 서버 렌더링도 같은 mock 상태를 사용                                                |

## 사용법

### 1. 설치

```bash
npm i -D @kakaocloud/mocking-gui
npx msw init public/     # 아직 안 하셨다면
```

peer: `msw@^2.8.0`, `react@^18 || ^19`

### 2. 앱 감싸기

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

worker 기동과 handler 등록이 끝날 때까지 렌더링을 붙잡아 두므로, 준비 전에 실제 요청이
새어 나가지 않습니다.

### 3. handler 정의

엔드포인트 하나와, 그 엔드포인트가 돌려줄 수 있는 상태들을 적습니다.
`responseVariants`의 항목 하나가 패널의 드롭다운 항목 하나가 됩니다.

```ts
import type { HandlerConfigOption } from '@kakaocloud/mocking-gui';

export const handlers: HandlerConfigOption[] = [
  {
    name: 'Get user',
    url: 'https://api.example.com/v1/users/:userId',
    method: 'get',
    responseVariants: [
      { name: 'Viewer', status: 200, body: { role: 'viewer' } },
      { name: 'Admin', status: 200, body: { role: 'admin' } },
      { name: 'Not found', status: 404, body: { error: { code: 'USER_NOT_FOUND' } } },
      {
        name: 'Rate limited',
        status: 429,
        headers: { 'Retry-After': '30' },
        body: { error: { code: 'RATE_LIMITED' } },
      },
    ],
  },
];
```

고정 목록으로 부족하면 `responseVariantsFn`으로 요청을 보고 계산합니다.
JSON이 아닌 응답은 `rawBody`를 씁니다.

```ts
// 요청에 따라 달라지는 응답
{
  name: 'Search',
  url: `${BASE}/search`,
  method: 'get',
  responseVariantsFn: ({ request, params, cookies }) => {
    const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
    return { name: 'Page', status: 200, body: { page, items: [] } };
  },
}

// JSON이 아닌 응답
{ name: 'CSV', status: 200, rawBody: { kind: 'text', value: csv } }
```

### 4. config 조립

```ts
import type { MockingConfig } from '@kakaocloud/mocking-gui';
import { graphql, HttpResponse } from 'msw';

export const mockConfig: MockingConfig = {
  mocks: handlers,

  // OpenAPI 문서에서 handler 자동 생성 (선택)
  swagger: [
    {
      name: 'My API',
      configUrl: 'https://api.example.com/openapi.json',
      serverUrl: 'https://api.example.com', // MSW가 가로챌 오리진
    },
  ],

  // 패널이 관리하지 않고 MSW로 바로 넘길 handler (선택)
  onDemandHandlers: [graphql.query('Me', () => HttpResponse.json({ data: { me } }))],
};
```

### 5. 패널에서 조작

화면 모서리의 버튼으로 패널을 엽니다.

1. **켜기** — handler는 처음에 모두 꺼져 있습니다. 필요한 것을 스위치로 켭니다.
2. **응답 고르기** — 드롭다운에서 variant 선택. 바로 다음 요청부터 적용됩니다.
3. **지연 주기** — `ms` 칸에 숫자를 넣으면 그만큼 늦게 응답합니다.
4. **시나리오로 묶기** — 여러 handler를 원하는 조합으로 맞춘 뒤 시나리오로 저장하면,
   코드 한 줄(base64)로 공유할 수 있습니다. 받은 사람은 *Scenarios → Import*에
   붙여넣으면 앱 전체가 그 상태가 됩니다.

### 6. SSR / RSC (선택)

패널 상태가 쿠키로도 동기화되므로, 서버 렌더링에서 같은 mock을 쓸 수 있습니다.

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

## 링크

- 라이브 데모: DEMO_URL
- GitHub: https://github.com/kakaoenterprise/mocking-gui
- npm: https://www.npmjs.com/package/@kakaocloud/mocking-gui
- 문서: https://kakaoenterprise.github.io/mocking-gui

MIT 라이선스입니다. 사용해보시고 불편한 점 알려주시면 반영하겠습니다.
