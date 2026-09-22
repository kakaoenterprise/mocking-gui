# 무결성 검증 보고 — PR #35 (chore/deps-batch-2026-09)

기준: 로컬, pnpm 9.15.9, 브랜치 head 3f1fa36

| 게이트 | 결과 |
|---|---|
| `pnpm install --frozen-lockfile` | 통과 |
| `pnpm lint` (tsc + eslint) | 통과, 3 tasks |
| `pnpm format:check` | 통과 |
| `pnpm test` | 통과, 6 files / 57 tests |
| `pnpm build` | 통과, 4 tasks (mocking-gui, react-csr 등) |

내용 대조

- workflow: checkout@v7 ×6, upload-artifact@v7 ×2, download-artifact@v8 ×1, auto-assign-action@v2.0.2 ×1 — 6개 PR 의도와 일치.
- `packages/mocking-gui/package.json`: radix 9개 버전 #31과 동일.
- `examples/next-app-router/package.json`: next / eslint-config-next 16.3.5, #32와 동일.
- `pnpm-lock.yaml`: main 대비 +/- 1,918줄 (#31 단독 557 + #32 단독 1,378 ≈ 1,935). 신규 항목 전부 #31/#32에 존재.

PR B (`dependabot.yml`)

- YAML 파싱 정상, prettier 통과. 스케줄 동작은 다음 월초 실행 시 확인 가능(즉시 검증 불가).
