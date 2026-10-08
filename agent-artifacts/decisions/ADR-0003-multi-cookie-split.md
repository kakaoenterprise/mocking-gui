---
version: 1.0.0
name: 'ADR-0003: Overcoming Cookie Size Limits with Multi-Cookie Split'
type: adr
status: superseded
superseded_by: ADR-0008
run_id: 2026-07-01-ssr-state-sync
description: 'Adopting multi-cookie splitting to resolve the 4KB cookie size limit and silent failures'
---

# ADR-0003: Overcoming Cookie Size Limits with Multi-Cookie Split

**Status**: Superseded by ADR-0008 (2026-10-08)  
**Date**: 2026-07-01  
**Deciders**: System Architect, Frontend Engineer  
**Affected Stakeholders**: Testing Specialist, library users (microservice-scale)  
**Links**: `executions/phase1-analysis.md` (Issue #2), `spec.md` §3.2

---

## Context

### Background (Why?)

Browser cookies have a limit of approximately 4KB per cookie. The existing code left only a `console.warn` when the size was exceeded and still attempted the write, but the browser **silently rejected (silent failure)** it, causing a serious problem where the server could not read the state and fell back to the real backend API.

Scale analysis:

- 1 handler ≈ 30 bytes (JSON)
- 100 handlers ≈ 3300 bytes (JSON) → ~30% expansion from `encodeURIComponent` → ~4290 bytes
- 4290 > 4096 (4KB) → browser rejection → state loss

In microservice environments (50+ services × 3–5 endpoints = 100–150 handlers), this is reproduced essentially 100% of the time and is a common case.

### Technical Evaluation Criteria

- Support for 100+ handlers: **Critical**
- Additional dependencies: none preferred (High)
- Server reconstruction complexity: Medium
- Backward compatibility: High

---

## Decision

### Final Choice (What?)

**We introduce Multi-Cookie Split, which divides the encoded state into 3000-byte chunks and stores them across multiple cookies (`mocking_gui_sync`, `mocking_gui_sync_1`, ...).** A 3-Tier approach:

- **Tier 1** (≤3800 bytes): single cookie
- **Tier 2** (3800–10000 bytes): multi-cookie split
- **Tier 3** (>10000 bytes): explicit error raised (not silent)

### Rationale (Why this?)

1. **Proven standard pattern**: Used by Google Analytics and others, supported across all browsers.
2. **Zero dependencies**: Pure JavaScript, requiring no additional dependencies such as compression libraries.
3. **Easy server reconstruction**: The server first attempts a single cookie, then merges chunks by iterating over indices (`getMultiCookieValue`).
4. **Backward compatible**: The existing single-cookie (Tier 1) path continues to work as-is.
5. **Negligible performance impact**: Multi-cookie overhead ~0.2ms, network header increase about 0.02%.

---

## Consequences

### Positive Effects (Pros)

✅ Support for 100+ handlers (practical extension up to 10KB)  
✅ Elimination of silent failures → explicit error on overflow (Tier 3)  
✅ No additional dependencies, backward compatibility maintained

### Negative Effects (Cons)

❌ Slight increase in HTTP cookie header size in overflow cases  
❌ Additional server-side reconstruction logic (possibility of parsing errors)

### Mitigations

| Risk                         | Severity | Mitigation Strategy                                                        |
| ---------------------------- | -------- | -------------------------------------------------------------------------- |
| Header size increase         | Low      | Split only when necessary (>3800 bytes); single cookie for the common case |
| Server reconstruction errors | Low      | Clear parsing logic + validation, safe fallback to baseConfigs on failure  |
| Browser compatibility        | Very Low | Multi-cookie is a standard feature across all browsers                     |

---

## Alternatives Considered

### Alternative A: Compression (gzip, etc.)

**Description**: Compress the state and store it in a single cookie.  
**Pros**: Keeps the number of cookies unchanged.  
**Cons**: Adds a compression library dependency, increases complexity, and an upper bound still exists even after compression.  
**Verdict**: ❌ Rejected due to dependency/complexity.

### Alternative B: Keep warning only (current)

**Description**: Attempt the write after a `console.warn` when the size is exceeded.  
**Cons**: State loss from browser silent rejection, triggering real API calls (Critical).  
**Verdict**: ❌ Deprecated due to a fundamental flaw.

---

## Related ADRs

- ADR-0001: Cookie-based SSR state synchronization storage (parent decision)
- ADR-0004: Environment-aware error handling (linked to Tier 3 explicit errors)

---

## Implementation Notes

### Design Considerations

- Client side: `packages/mocking-gui/src/utils/browser/cookie.ts` — added `syncMultiCookie()` (3000-byte chunks).
- Server side: `packages/mocking-gui/src/utils/server/state.ts` — added `getMultiCookieValue()`; `reconstructHandlerConfigsFromCookie()` automatically falls back from single to multiple in order.
- 4-Layer: Change within the Business Logic layer; no type/UI changes.

### Testing Approach

- Unit: Verify that `_0` and `_1` cookies are created for large state (>3800 bytes).
- Unit (server): Validate state reconstruction merging from multiple cookies.
- E2E: Verify no overflow in the 100+ handler scenario.

### Monitoring

- **Overflow Failures**: Target 0% (previously 5–10%).

---

## References

- `executions/phase1-analysis.md` Issue #2 (scale/silent failure analysis)
- `executions/phase2-implementation.md` Task 2 (`syncMultiCookie`, `getMultiCookieValue`)

---

## Notes

- Initially authored: 2026-07-03 (promoted from the decision log of run 2026-07-01-ssr-state-sync)
- Version: v1.0
