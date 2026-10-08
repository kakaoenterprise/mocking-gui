---
version: 1.0.0
name: 'ADR Master Index'
description: 'Global ADR list — all ADRs exist only in this folder and follow a global sequence (ADR-NNNN)'
---

# ADR Master Index

| ID                                                              | Title                                                                                            | Status                 | Run                                      | Date       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------- | ---------------------------------------- | ---------- |
| [ADR-0001](ADR-0001-cookie-based-ssr-state-store.md)            | Selecting a Cookie-Based SSR State Synchronization Store                                         | Accepted               | 2026-07-01-ssr-state-sync                | 2026-07-01 |
| [ADR-0002](ADR-0002-remove-debounce-immediate-sync.md)          | Removing Debounce from Cookie Synchronization for Immediate Sync                                 | Accepted               | 2026-07-01-ssr-state-sync                | 2026-07-01 |
| [ADR-0003](ADR-0003-multi-cookie-split.md)                      | Overcoming Cookie Size Limits with Multi-Cookie Split                                            | Superseded by ADR-0008 | 2026-07-01-ssr-state-sync                | 2026-07-01 |
| [ADR-0004](ADR-0004-environment-aware-error-handling.md)        | Environment-Aware Error Handling Strategy for State Synchronization                              | Accepted               | 2026-07-01-ssr-state-sync                | 2026-07-01 |
| [ADR-0005](ADR-0005-normalize-kebab-case-path-params.md)        | Normalize kebab-case OpenAPI path params to underscore identifiers                               | Proposed               | 2026-07-16-swagger-hyphen-param-mismatch | 2026-07-23 |
| [ADR-0006](ADR-0006-handler-url-colon-literal-format.md)        | Handler URL format — colon after a non-slash is a literal; MSW escaping only at the MSW boundary | Proposed               | 2026-10-07-escaped-colon-handler-key     | 2026-10-09 |
| [ADR-0008](ADR-0008-single-cookie-budget-hashed-sync-format.md) | Single-Cookie Budget and Hashed v2 Sync Format (supersedes ADR-0003)                             | Accepted               | 2026-10-08-ssr-sync-cookie-431           | 2026-10-08 |
