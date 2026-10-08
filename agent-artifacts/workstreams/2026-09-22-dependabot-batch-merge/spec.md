# Dependabot 일괄 머지 & 스케줄 조정 — 설계 spec

- 날짜: 2026-09-22
- 대상 레포: kakaoenterprise/mocking-gui (upstream), 작업 fork: kep-ria-ang/mocking-gui (origin)
- 기준 커밋: upstream/main d597086 (v1.0.6)

## 배경

Dependabot이 weekly로 PR을 만들어 upstream에 9개(#26~#34)가 쌓였다. 봇 PR은 `license/cla` 상태가 pending으로 남아
개별 머지가 막히고, 각 PR을 하나씩 머지하면 나머지가 rebase·CI를 반복한다. 사용자 명의의 통합 PR 1개로 한 번에
반영하고, 이후 누적을 줄이기 위해 주기를 분기 1회로 늦추고 통합 브랜치로 받으며 npm 그룹을 넓힌다.

## 범위

**포함 (6개)**

| PR  | 내용                                             | 상태                                                 |
| --- | ------------------------------------------------ | ---------------------------------------------------- |
| #29 | actions/checkout 4 → 7                           | Approved, CI pass                                    |
| #26 | actions/upload-artifact 4 → 7                    | Approved, CI pass                                    |
| #28 | actions/download-artifact 4 → 8                  | 미승인, CI pass. #26과 짝(release.yml)이라 함께 반영 |
| #27 | kentaro-m/auto-assign-action 2.0.0 → 2.0.2       | Approved, CI pass                                    |
| #32 | examples-next 그룹(next, eslint-config-next) 2개 | Approved, CI pass                                    |
| #31 | @radix-ui/\* 마이너·패치 9개                     | 미승인, CI pass, 마이너 범위                         |

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

### PR B — `chore/dependabot-monthly-grouping` (`.github/dependabot.yml`, `ci.yml`)

> 2026-10-08 개정: 월 1회(monthly) → 분기 1회(quarterly) + 통합 브랜치 `deps-batch` 로 봇 PR을 받는 구조로 변경.
> 사용자 요청은 "2달 주기 + `deps-batch-YYYY-MM` 브랜치"였으나 Dependabot 제약으로 아래와 같이 조정했다.
>
> - `interval` 은 daily/weekly/monthly/quarterly/semiannually/yearly/cron 만 지원. 2달은 cron으로만 가능해 quarterly 선택.
> - `target-branch` 는 고정 문자열이라 연월을 담을 수 없다. 봇 목적지는 `deps-batch` 고정, 연월은 main 행 PR의
>   브랜치명·제목(`deps-batch-2027-09`)에 담는다.

1. **주기**: npm, github-actions 모두 `interval: quarterly` (1·4·7·10월 초 실행).
2. **통합 브랜치**: 두 ecosystem 모두 `target-branch: deps-batch`. 봇 PR이 전부 deps-batch로 열려
   main으로 가는 PR은 사용자 명의 1개가 되고, 봇 PR의 `license/cla` pending 문제가 사라진다.
   - Dependabot은 target-branch의 manifest/lockfile만 읽는다. 사이클 종료마다 deps-batch를 main으로 리셋해야
     옛 버전 기준 범프·충돌이 생기지 않는다.
   - 보안 업데이트는 target-branch를 무시하고 main으로 온다. 종전처럼 개별 처리.
3. **CI**: `ci.yml` `pull_request.branches` 에 `deps-batch` 추가. 없으면 봇 PR에 Lint/Test/Build가 돌지 않는다.
4. **npm 그룹 재설계**. 축은 "배포되는 런타임 의존성 / 리포 내부 도구 / examples·docs 전용" 과 major 여부다.
   Dependabot은 먼저 매칭되는 그룹을 적용하므로 구체적 그룹을 앞에 둔다.

   ```yaml
   groups:
     examples-next: # next 계열은 minor도 파급이 커 별도
       patterns: ['next', 'eslint-config-next', '@next/*']
     docs-site:
       patterns: ['vitepress', 'vue', 'gh-pages']
     lint-format-tooling:
       dependency-type: development
       patterns:
         [
           'eslint*',
           '@eslint/*',
           'typescript-eslint',
           'prettier',
           '@commitlint/*',
           'husky',
           'lint-staged',
           'globals',
         ]
     build-test-tooling: # 나머지 dev (vite, vitest, typescript, tailwind, @types/* …) minor/patch
       dependency-type: development
       patterns: ['*']
       update-types: ['minor', 'patch']
     runtime-minor-patch: # packages/mocking-gui dependencies 의 minor/patch
       dependency-type: production
       patterns: ['*']
       update-types: ['minor', 'patch']
   ```

   - 런타임 major(lucide-react 1.x, react-resizable-panels 4.x 등)와 **dev major**는 어떤 그룹에도 걸리지 않아
     패키지별 개별 PR로 온다. 배치 구조에서 그룹의 역할은 "깨졌을 때 범인 찾기 단위"이므로 major를 분리한다
     (#30/#41: dev 30여 개 묶음이 Lint·Build를 함께 깨뜨려 원인 분리가 어려웠다).
   - 개별 PR이 늘어나므로 `open-pull-requests-limit` 5 → 10.
   - 기존 `radix-ui` 그룹은 제거한다. runtime-minor-patch에 포함된다.
   - `react`, `react-dom`, `msw` ignore는 디렉터리 구분 없이 유지한다. examples의 react도 봇이 올리지 않는다
     (next ↔ react 버전 짝 문제, 라이브러리 peer 범위와 함께 수동 범프).

5. **github-actions 그룹**: `github-actions: { patterns: ['*'] }` — 액션 범프를 PR 1개로 묶는다.
6. 검증: YAML 파싱·prettier 확인. 실제 스케줄 동작은 다음 분기 초 실행으로 확인.
7. 이 spec 및 작업 산출물(`agent-artifacts/workstreams/2026-09-22-dependabot-batch-merge/`)은 PR B에 함께 커밋.

### 분기 사이클 운영 (Quarterly cycle)

0. **최초 1회**: PR B 머지 직후 `git push upstream main:deps-batch` 로 브랜치 생성. 브랜치가 없으면 Dependabot이
   실행 시 에러를 낸다.
1. 분기 첫 달 초, 봇 PR이 deps-batch로 열린다 (그룹당 1개 + major 개별).
2. CI 초록이면 deps-batch로 머지. deps-batch에는 ruleset도 CLA 요구도 없다. 빨간 PR은 close 하거나 보류.
3. deps-batch에서 `pnpm example:dev` 로 GUI 렌더링 확인 (특히 런타임 major).
4. `deps-batch` 에서 `deps-batch-YYYY-MM` 브랜치를 따 main 대상 PR 생성. 제목 예:
   `chore(deps): quarterly dependency batch 2027-09`. 리뷰 1명 + CODEOWNERS 승인 후 squash 머지.
   연월 브랜치는 머지 후 삭제해도 된다. 기록은 PR에 남는다.
5. **리셋**: `git push -f upstream main:deps-batch`. squash 머지로 갈라진 히스토리를 main과 맞춘다.
   빼먹으면 다음 사이클 PR에 지난 분기 커밋이 중복으로 보이고, 봇이 옛 lockfile 기준으로 범프한다.
6. 보안 업데이트 PR(main 대상)은 사이클과 무관하게 개별 처리.

대안으로 cla-assistant.io 대시보드에 `dependabot[bot]` allowlist를 추가하면 봇 PR의 CLA pending이 바로 풀린다.
보안 업데이트 PR까지 편해지므로 병행을 권한다. 리포 ruleset에는 필수 status check가 없어 CLA가 실제로 머지를
막는 주체는 org 레벨 설정으로 추정되나 admin:org 권한이 없어 미확인.

## 순서

PR A → PR B. 두 PR은 파일이 겹치지 않아 병렬 리뷰 가능하나, PR B는 PR A 머지 후 rebase 없이 그대로 머지 가능.

## 리스크

- `pnpm install` 재생성 lockfile이 dependabot이 잡은 버전과 미세하게 다를 수 있다(전이 의존성). CI 통과를 기준으로 수용.
- actions/checkout v7, upload/download-artifact v7/v8은 Node 24 런타임 기반. ubuntu-latest 러너에서는 문제 없음.
- Dependabot의 자동 close가 늦을 수 있어 수동 정리 단계를 둔다.
