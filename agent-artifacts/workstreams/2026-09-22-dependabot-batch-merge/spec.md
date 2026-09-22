# Dependabot 일괄 머지 & 스케줄 조정 — 설계 spec

- 날짜: 2026-09-22
- 대상 레포: kakaoenterprise/mocking-gui (upstream), 작업 fork: kep-ria-ang/mocking-gui (origin)
- 기준 커밋: upstream/main d597086 (v1.0.6)

## 배경

Dependabot이 weekly로 PR을 만들어 upstream에 9개(#26~#34)가 쌓였다. 봇 PR은 `license/cla` 상태가 pending으로 남아
개별 머지가 막히고, 각 PR을 하나씩 머지하면 나머지가 rebase·CI를 반복한다. 사용자 명의의 통합 PR 1개로 한 번에
반영하고, 이후 누적을 줄이기 위해 주기를 월 1회로 늦추고 npm 그룹을 넓힌다.

## 범위

**포함 (6개)**

| PR | 내용 | 상태 |
|---|---|---|
| #29 | actions/checkout 4 → 7 | Approved, CI pass |
| #26 | actions/upload-artifact 4 → 7 | Approved, CI pass |
| #28 | actions/download-artifact 4 → 8 | 미승인, CI pass. #26과 짝(release.yml)이라 함께 반영 |
| #27 | kentaro-m/auto-assign-action 2.0.0 → 2.0.2 | Approved, CI pass |
| #32 | examples-next 그룹(next, eslint-config-next) 2개 | Approved, CI pass |
| #31 | @radix-ui/* 마이너·패치 9개 | 미승인, CI pass, 마이너 범위 |

**제외**: #30 dev-tooling 31개, #33 lucide-react 0.294 → 1.47 (major), #34 react-resizable-panels 3 → 4 (major).
GUI 렌더링 확인이 필요해 별도 작업으로 남긴다.

## 산출물: PR 2개

### PR A — `chore/deps-batch-2026-09` (의존성 범프)

1. 별도 워크트리에서 `upstream/main`으로부터 브랜치 생성.
2. dependabot 브랜치를 upstream에서 fetch하고 아래 순서로 `git merge --no-ff`:
   #29 → #26 → #28 → #27 → #32 → #31.
3. 충돌 처리
   - `pnpm-lock.yaml` 충돌: 양쪽 `package.json` 병합 결과를 유지하고, lockfile은 버린 뒤 `pnpm install`로 재생성.
   - 그 외 파일 충돌은 예상되지 않음(actions는 서로 다른 줄, npm 2개는 서로 다른 package.json). 발생 시 중단·보고.
4. 검증 (모두 통과해야 완료)
   - `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`
   - 6개 PR의 `package.json`·workflow 변경이 모두 반영됐는지 `git diff upstream/main` 으로 대조
   - release.yml에서 upload-artifact v7 / download-artifact v8이 함께 올라갔는지 확인
5. origin에 push, upstream `main` 대상 PR. 제목:
   `chore(deps): batch-merge approved dependabot updates` (commitlint 준수).
   본문에 6개 PR 링크와 "squash 머지 후 Dependabot이 원본 PR을 자동 종료" 명시.
6. 머지는 squash. 머지 후 Dependabot이 닫지 않은 PR이 남으면 수동 close.

### PR B — `chore/dependabot-monthly-grouping` (`.github/dependabot.yml`)

1. **주기**: npm, github-actions 모두 `interval: weekly` → `interval: monthly` (`day` 제거).
2. **npm 그룹 재설계** (A안). 축은 "배포되는 런타임 의존성 / 리포 내부 도구 / examples·docs 전용" 과 major 여부다.
   Dependabot은 먼저 매칭되는 그룹을 적용하므로 구체적 그룹을 앞에 둔다.
   ```yaml
   groups:
     examples-next:                       # next 계열은 minor도 파급이 커 별도
       patterns: ['next', 'eslint-config-next', '@next/*']
     docs-site:
       patterns: ['vitepress', 'vue', 'gh-pages']
     lint-format-tooling:
       dependency-type: development
       patterns: ['eslint*', '@eslint/*', 'typescript-eslint', 'prettier',
                  '@commitlint/*', 'husky', 'lint-staged', 'globals']
     build-test-tooling:                  # 나머지 dev 전부 (vite, vitest, typescript, tailwind, @types/* …)
       dependency-type: development
       patterns: ['*']
     runtime-minor-patch:                 # packages/mocking-gui dependencies 의 minor/patch
       dependency-type: production
       patterns: ['*']
       update-types: ['minor', 'patch']
   ```
   - 런타임 major(lucide-react 1.x, react-resizable-panels 4.x 등)는 어떤 그룹에도 걸리지 않아 패키지별 개별 PR로 온다.
     GUI 확인 후 하나씩 머지한다.
   - dev 도구는 major까지 그룹에 포함한다. CI가 안전망이고 vite/vitest처럼 세트로 올려야 하는 것이 한 PR에 모인다.
   - 기존 `radix-ui` 그룹은 제거한다. runtime-minor-patch에 포함된다.
   - `react`, `react-dom`, `msw` ignore는 디렉터리 구분 없이 유지한다. examples의 react도 봇이 올리지 않는다
     (next ↔ react 버전 짝 문제, 라이브러리 peer 범위와 함께 수동 범프).
3. **github-actions 그룹 추가**: `github-actions: { patterns: ['*'] }` — 액션 범프를 PR 1개로 묶는다.
4. `open-pull-requests-limit: 5`, `ignore`(react, react-dom, msw), `commit-message` prefix는 유지.
5. 검증: YAML 파싱 확인. 실제 스케줄 동작은 다음 월초 실행으로 확인(머지 시점에 즉시 확인 불가).
6. 이 spec 및 작업 산출물(`agent-artifacts/workstreams/2026-09-22-dependabot-batch-merge/`)은 PR B에 함께 커밋.

## 순서

PR A → PR B. 두 PR은 파일이 겹치지 않아 병렬 리뷰 가능하나, PR B는 PR A 머지 후 rebase 없이 그대로 머지 가능.

## 리스크

- `pnpm install` 재생성 lockfile이 dependabot이 잡은 버전과 미세하게 다를 수 있다(전이 의존성). CI 통과를 기준으로 수용.
- actions/checkout v7, upload/download-artifact v7/v8은 Node 24 런타임 기반. ubuntu-latest 러너에서는 문제 없음.
- Dependabot의 자동 close가 늦을 수 있어 수동 정리 단계를 둔다.
