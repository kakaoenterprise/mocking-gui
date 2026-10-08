# 실행 로그 — Dependabot 일괄 머지 (PR A, #35)

## 결정 사항

- 범위: Approve된 #26, #27, #29, #32 + CI 통과·저위험 #28(download-artifact, #26과 짝), #31(radix minor 9개).
  #30(dev-tooling 31개), #33/#34(런타임 major)는 GUI 확인 필요로 제외.
- 방식: 통합 브랜치 `chore/deps-batch-2026-09` + 단일 PR. `@dependabot merge`는 `license/cla` pending 때문에 막힘.
- PR 분리: 의존성 범프(PR A)와 `dependabot.yml` 변경(PR B)을 별도 PR로 — 리뷰 단위 분리.

## 실행

1. `upstream/main` d597086에서 브랜치 생성, PR head 6개를 `refs/pull/N/head`로 fetch.
2. 머지 순서 #29 → #26 → #28 → #27 → #32 → #31, 모두 `--no-ff`.
3. #31에서 `pnpm-lock.yaml` 충돌.
   - 1차 시도: lockfile 삭제 후 `pnpm install --lockfile-only` → 전이 의존성까지 재해결되어 4,500줄 변경. **되돌림.**
   - 2차: `--ours`(#32 반영 lockfile) 유지 후 `packages/mocking-gui`에서 radix 9개만 `pnpm update --lockfile-only <pkg@ver>...`.
     결과 lockfile의 신규 항목이 모두 #31 또는 #32 lockfile에 존재함을 `comm`으로 대조 → 범위 초과 없음.

## 사이드이펙트

- lockfile 항목 배치가 dependabot 원본과 바이트 단위로 같지는 않음(재해결 순서 차이). 버전 집합은 동일.
- actions/checkout v7, upload v7 / download v8은 Node 24 런타임. ubuntu-latest에서 문제 없음.
- squash 머지 후 Dependabot이 원본 6개 PR을 자동 close할 것으로 예상. 남으면 수동 close 필요.
