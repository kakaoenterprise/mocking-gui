---
version: 1.0.0
name: 'RUN: Tailwind / host-CSS edge cases for the shadow-rooted panel'
type: run
description: 'Light run — exhaustive audit of host-app CSS interactions (Tailwind v3/v4, plain CSS) with the Shadow DOM panel, following the Switch thumb double-translate bug (#42)'
run_id: 2026-10-08-tailwind-host-edge-cases
workflow: harness-dev-pipeline
size: light
status: completed # in_progress | awaiting_approval | completed
created_by: ria.ang@kakaoenterprise.com
---

# RUN: Shadow DOM 패널 × 호스트 CSS(Tailwind) 엣지케이스 전수조사

## 1. Background & Scope

- 계기: #42 (Switch thumb 2배 이동) — 호스트가 Tailwind v4 면 문서 레벨 `@property --tw-*` 등록이 shadow tree 안에도 적용되어, 패널 스타일시트 안의 (무시되는) `@property` 에 의존하던 유틸리티가 갑자기 유효해지는 "호스트 의존" 결함.
- 범위: 같은 계열의 다른 메커니즘 전부 — `@property` 커버리지, 상속 속성, 커스텀 프로퍼티 상속, light DOM 에 렌더되는 요소, 패널→호스트 누출, preflight/layer, rem/뷰포트, color-scheme, z-index.
- 방법: `HEAD d027162` 빌드 → `dist/index-*.js` 에 인라인된 Tailwind v4.1.11 시트 추출 → shadow root + 빌드 CSS + 호스트 시트 변형(none / tw4 / tw4+`*{}` / tw3 / misc) 조합을 headless Chromium 153(Playwright 1.58) 로 계측. 스크래치: `scratchpad/tw-audit/{built.css,run.mjs,run2.mjs}` (세션 임시 경로).

## 2. 구조 사실 (검증됨)

- CSS 주입: `useMockingGUIStyles.ts` 가 `index.css?inline` 을 import, `ShadowRootPortal.tsx:104-108` 이 shadow root 안에 `<style data-mocking-gui-isolated>` 로 삽입. dev/prod 동일. `document.head` 에는 아무것도 넣지 않음. `dist/*.css` 파일은 생성되지 않음.
- 빌드 시트: `@layer properties { @supports(구형 브라우저 전용) { *,:before,:after,::backdrop { --tw-* 기본값 } } }` + `@property --tw-*` 48개(shadow 안에서는 무시됨, 확인) → 비계층 `:root,:host { 테마 변수 }` + 유틸리티 → 끝에 `@layer base { preflight + 마운트 리셋 }`.
- `#mocking-gui-shadow-mount { all: initial }` 는 커스텀 프로퍼티·`direction`·`unicode-bidi` 를 리셋하지 않고, `display: inline` 이 됨.
- light DOM 렌더: `MockingGUIToggle.tsx`(고정 토글 버튼 + 전역 `<style>@keyframes spin`), `LoadingPage.tsx`(전체 화면 오버레이 + 동일 keyframes). Radix 포털은 `Select` 하나뿐이며 `container={shadow}` 로 shadow 안에 렌더. tooltip/popover/dialog/toast 없음.

## 3. 확인된 버그

| #   | 내용                                                                                                                                                                                                                                                                                            | 근거                                                                                                          | 심각도         | 수정                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| A1  | `ring-*`(focus ring 전부, 설정 섹션 선택 상태 `ring-1`) 이 Tailwind 없는 호스트에서 **전부 보이지 않음**. `.ring-N` 이 `calc(Npx + var(--tw-ring-offset-width))` 를 쓰는데 리셋에 `--tw-ring-offset-width` 가 없어 `box-shadow` 전체가 무효. 예제 3개가 모두 Tailwind v4 호스트라 가려져 있었음 | host=none: `.ring-1` → `box-shadow: none`; tw3/tw4: 정상. `index.css:59-69` 에 해당 변수 없음(소스 교차 확인) | High           | 리셋에 `--tw-ring-offset-width: 0px`                                                    |
| A2  | `ring-offset-*`(Badge, Resizable) 가 `--tw-ring-offset-color` 폴백 없음 → host=none 무효, host=tw4 + dark 패널에서 흰색 halo                                                                                                                                                                    | 계측                                                                                                          | Medium         | `--tw-ring-offset-color: var(--background)`, `--tw-ring-inset/--tw-ring-color: initial` |
| A3  | `after:*`/`before:*` 가 `--tw-content` 없이는 pseudo 를 만들지 않음 (현재 사용처 `Resizable.tsx` 는 미렌더)                                                                                                                                                                                     | host=none: `::after content: none`                                                                            | Low(잠재 High) | `--tw-content: ""`                                                                      |
| A4  | light DOM 토글 버튼·로딩 오버레이가 호스트 전역 CSS 에 노출 (`button{transform}`, `*{transition}`, `!important`)                                                                                                                                                                                | `button{transform:scale(2)…}` 호스트 → 토글에 그대로 적용                                                     | Medium         | 자체 shadow root 로 이동 또는 `all: unset` + 전체 인라인 재선언                         |
| A5  | 패널이 문서에 `@keyframes spin` 을 주입해 호스트의 동명 keyframes 를 덮음; `Loader2` 의 `animate-spin` 은 호스트 Tailwind 에 의존                                                                                                                                                               | 코드                                                                                                          | Low            | `mocking-gui-spin` 으로 네임스페이스, 클래스 제거                                       |
| A6  | `package.json` `exports["./style.css"]` → `dist/mocking-gui.css` 가 존재하지 않음                                                                                                                                                                                                               | `ls dist`                                                                                                     | Low            | export 제거 또는 파일 생성                                                              |
| A7  | `custom-scrollbar` 클래스가 어디에도 정의되지 않음(스크롤바 스타일 0건)                                                                                                                                                                                                                         | grep                                                                                                          | Trivial        | 제거 또는 정의                                                                          |

## 4. 호스트 의존 잠재 위험

| #   | 내용                                                                                                                                                        | 근거                              | 심각도        | 수정                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------- | ----------------------------------------------------------------------- |
| B1  | `rem` 기반 토큰(`--spacing`, `--text-*`, `--radius`)이 **호스트 `<html>` font-size** 를 따름. `html{font-size:62.5%}` 앱에서 `.text-sm` 8.75px, `.p-4` 10px | 계측                              | High(해당 앱) | `@theme` 토큰을 px 로 고정                                              |
| B2  | 호스트 `* { --spacing; --color-*; }` 처럼 **호스트 요소 자체에 매칭되는 규칙**은 shadow 의 `:host` 선언을 이김(`:root{}` 는 안 샘)                          | `*{--spacing:1rem}` → `.p-4` 64px | Low~Medium    | 소비 토큰을 `#mocking-gui-shadow-mount` 에 재선언                       |
| B3  | Tailwind v3 호스트의 `*,::before,::after{--tw-*}` 가 리셋이 고정하지 않은 변수로 상속(색 없는 `ring-N` 이 파란 링)                                          | 계측                              | Low           | A1/A2 수정으로 해소                                                     |
| B4  | `direction`/`unicode-bidi` 는 `all: initial` 로 리셋 안 됨 → RTL 호스트에서 패널 전체 미러링                                                                | 계측                              | Medium(RTL)   | 마운트에 `direction: ltr`                                               |
| B5  | 호스트 `*{user-select:none}` 이 shadow 안 텍스트 선택을 막음                                                                                                | 계측                              | Low           | 마운트 `user-select: text`                                              |
| B6  | `.dark` 마운트가 `color-scheme: dark` 를 설정하지 않아 네이티브 스크롤바·폼 컨트롤이 밝게 남음                                                              | 계측                              | Low           | `.dark { color-scheme: dark }`                                          |
| B7  | 호스트 z-index 9999 고정; 호스트 오버레이 10000 이면 패널 접근 불가. transform/filter 조상 아래 마운트 시 `fixed` 기준 변경                                 | `elementFromPoint`                | Medium        | `MockingConfig` 로 z-index 설정 가능, 기본값 상향, `document.body` 포털 |
| B8  | `vh` 만 사용(`dvh`·safe-area·reduced-motion 없음)                                                                                                           | grep                              | Low           | 선택                                                                    |
| B9  | Radix Select 열림 시 `document.body` `pointer-events:none` + head `<style>` 스크롤락(표준 동작)                                                             | 코드                              | Low           | 문서화                                                                  |
| B10 | 마운트 `display: inline`                                                                                                                                    | 계측                              | Low           | `display: block`                                                        |

## 5. 안전 확인 (누출 없음)

- 호스트 Tailwind v4 `@layer theme/base/components/utilities`, 호스트 preflight(`*{box-sizing:content-box;border:5px dashed}`), 호스트 `.border/.p-4 !important` → shadow 안 영향 없음(레이어·선택자는 tree 별).
- 호스트 `:root{--spacing/--color-*/--background/--foreground/--radius}`(shadcn/Tailwind v4 테마) → 패널 `:host`/마운트 선언이 이김.
- 호스트 `body{letter-spacing;text-transform;color;font-*}`, `*{cursor:wait}`, `:root{color-scheme:dark}` → `all: initial` + 마운트 폰트 선언으로 차단.
- 호스트 `@keyframes enter/spin` → shadow 시트의 동명 keyframes 가 이김(tree 범위).
- 패널 preflight 는 shadow 안에 완전히 포함; `html,:host`/`:root,:host` 블록은 호스트 문서에 도달하지 않음.
- 호스트 `@property` 등록 + 패널 `*` 리셋: 일반 선언이 `inherits:false` 초기값을 모든 요소에서 덮음(translate 16px, PR #42 수정 유효).
- 미사용이라 노출 없음: gradient, border-spacing, backdrop-filter, divide-x, space-x, `@container` 쿼리.

## 6. `--tw-*` 사용 vs 리셋 커버리지 (요약)

- 커버됨: translate-x/y/z, scale-x/y/z, rotate/skew(`var(--x,)` 폴백), border-style, outline-style, shadow 계열 5종, shadow-color.
- 자체 설정 또는 폴백 있음: space-y-reverse, divide-y-reverse, leading, duration/ease, filter 계열, enter/exit(animate 플러그인).
- **미커버(버그)**: `--tw-ring-offset-width`(A1), `--tw-ring-offset-color`(A2), `--tw-content`(A3).

## 7. 권고 조치 (우선순위)

1. 리셋 블록에 Tailwind 의 `@layer properties` 폴백 목록을 **전부** 미러링 (`--tw-ring-offset-width: 0px; --tw-ring-offset-color: var(--background); --tw-ring-inset/--tw-ring-color: initial; --tw-content: ""; …`). 더 견고한 대안: 빌드 시 `@layer properties` 안의 `@supports` 래퍼를 제거해 Tailwind 자체 폴백(`*,:before,:after,::backdrop{--tw-*}`)이 shadow 시트 안에서 항상 적용되게 함 — 새 유틸리티가 추가돼도 자동 대응.
2. 마운트 규칙: `all: initial` 뒤에 `display: block; direction: ltr; unicode-bidi: isolate; user-select: text; color-scheme: light;`, `.dark` 에 `color-scheme: dark`.
3. `@theme` rem 토큰을 px 로 고정 (B1).
4. 토글·로딩을 shadow root 로 이동, keyframes 네임스페이스 (A4/A5).
5. z-index 설정 옵션 + 기본값 상향 (B7).
6. `./style.css` export 와 `custom-scrollbar` 정리 (A6/A7).
7. 회귀 테스트: **호스트 Tailwind 없는** shadow root 에 빌드 시트를 넣고 `.ring-1` box-shadow ≠ none, `after:*` content, `translate-x-4` 를 단언하는 Playwright 테스트. 현재 예제 3개가 전부 Tailwind v4 호스트라 A1~A3 이 가려짐.

## 8. Execution Log

- 2026-10-08: 사용자 결정 — `index.css` 한 파일만 수정해 PR. 브랜치 `fix/shadow-css-host-fallbacks` (upstream/main `1067c60`, 별도 워크트리).
- 반영: 권고 1(리셋에 Tailwind `@layer properties` 폴백 전체 미러링, `--tw-ring-offset-color` 는 `var(--background)`) · 권고 2(마운트 `display/direction/unicode-bidi/user-select/color-scheme`, `.dark { color-scheme: dark }`) · 권고 3(`--spacing/--text-*/--container-sm/--radius` px 고정) → A1·A2·A3·B1·B3·B4·B5·B6·B10 해소.
- 미반영(범위 외): A4·A5(light DOM 토글/로딩 — 컴포넌트 변경), A6·A7(패키지/클래스 정리), B2(호스트 `*{--var}` 누출 — 토큰 재선언), B7(z-index 옵션), 권고 7(Playwright 회귀 테스트).
- 검증: 재빌드 시트를 호스트 조건 5종(none / tw4 / tw4+`*{}` / tw3 / `html{font-size:62.5%;direction:rtl}`+`*{user-select:none}`)으로 headless Chromium 계측 — 모든 조건에서 `.ring-1` 링 표시, `focus:ring-offset-2` 유효, `after:*` pseudo 생성, `translate-x-4` 16px, 마운트 `block/ltr/text/light`, `.text-sm` 14px·`.p-4` 16px·`rounded-lg` 10px. tw4+`*{--spacing:1rem}` 에서만 B2 누출(64px) 잔존.
- 품질 게이트: prettier 통과, lint 0 errors(경고 3건은 main 의 `cookie.test.ts` 기존 건), 102 tests 통과, build 통과.

## 9. Approval

| Item      | Value                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Decision  | approved — CSS 단일 파일 범위로 PR (사용자 지시)                                                      |
| Approver  | ria.ang@kakaoenterprise.com                                                                           |
| Time      | 2026-10-08T13:30:00+09:00                                                                             |
| Rationale | 리셋/마운트/토큰 보정만으로 확인된 버그 3건과 호스트 의존 위험 대부분이 해소되며 컴포넌트 변경이 없음 |
