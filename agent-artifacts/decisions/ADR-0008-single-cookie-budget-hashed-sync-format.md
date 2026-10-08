---
version: 1.0.0
name: 'ADR-0008: Single-Cookie Budget and Hashed v2 Sync Format'
type: adr
status: accepted
run_id: 2026-10-08-ssr-sync-cookie-431
supersedes: ADR-0003
description: 'Replace multi-cookie splitting with one budgeted cookie whose entries reference handlers by hash and carry only the delta from default state'
---

# ADR-0008: Single-Cookie Budget and Hashed v2 Sync Format

**Status**: Accepted (supersedes ADR-0003)
**Date**: 2026-10-08
**Deciders**: System Architect, Frontend Engineer
**Affected Stakeholders**: Testing Specialist, library users running SSR with Swagger-sized handler sets
**Links**: upstream issue #45 · `agent-artifacts/workstreams/2026-10-08-ssr-sync-cookie-431/RUN.md`

---

## Context

### Background (Why?)

ADR-0003 assumed the constraint on the SSR sync cookie was the ~4 KB per-cookie limit and worked around it by splitting the payload into `mocking_gui_sync_N` chunks. Issue #45 showed that model is wrong in three ways:

1. The binding limit is the **request-header total** — 16 KB in Node (`--max-http-header-size`), 8 KB per line in nginx — shared with every other cookie on the site. Splitting does not reduce header bytes; it only multiplies cookies. Once the total crossed 16 KB the dev server answered `431` to every request and the app became unreachable.
2. The writer never deleted the cookies of the previous write (single vs. chunked, or longer chunk runs), so stale and fresh state accumulated for 7 days, and the server read the stale single cookie in preference to newer chunks.
3. The payload itself was ~124 bytes per handler (absolute-URL key, JSON envelope, `encodeURIComponent`), four times the 30 bytes ADR-0003 budgeted for.

### Technical Evaluation Criteria

- Total cookie bytes the library adds to a request: **Critical** (≤ 4 KB)
- Never leave stale cookies behind: **Critical**
- Deterministic server read of the last written state: High
- No additional network request or host-app route (keep ADR-0001): High
- Backward compatibility with cookies written by ≤ 1.0.6: Medium

---

## Decision

### Final Choice (What?)

**One cookie, one budget, hash references, delta-only entries.**

- The browser writes exactly one cookie, `mocking_gui_sync`, with value `v2~<entry>~<entry>~…` and `entry := <hash>[.<type>[.<variant>]]`.
  - `hash` is FNV-1a 32-bit of the handler key (`method.url`) in base36 (≤ 7 chars).
  - `type` (M/A/S) and `variant` appear only when they differ from the handler's determined default. Only enabled handlers are listed.
  - Every character belongs to `encodeURIComponent`'s unreserved set (`A-Z a-z 0-9 - _ . ! ~`). A variant is written verbatim when it matches `[A-Za-z0-9_-]*`, otherwise as `!` + base64url(UTF-8). Framework cookie APIs that re-serialize values — Next.js `cookies().toString()` runs `encodeURIComponent` on each value — therefore pass the bytes through unchanged, and `decodeURIComponent` is a no-op. The format is stable under decode → encode; this was a hard requirement discovered in review (a `|`/`:` envelope broke the documented Next App Router path).
- Budget `COOKIE_BUDGET = 3800` bytes for the value. Over budget, Swagger entries are dropped first (original order preserved for the kept ones), Manual/Auto entries are always kept, and a `console.warn` names the dropped handlers. If Manual/Auto entries alone exceed the budget a second warning says so; the browser may then reject the cookie.
- Before every write the browser expires every cookie whose name is `mocking_gui_sync` or starts with `mocking_gui_sync_`, as found in `document.cookie`. When nothing is enabled, no cookie is written at all.
- The server (`reconstructHandlerConfigsFromCookie(cookie, handlers)`) builds a hash → handler index from the handlers it registered (`mocks` + loaded `swagger`), restores defaults with `initialStoredHandlerVariants`, and skips unknown, colliding, or malformed entries individually with one aggregated warning per reason (never one line per entry, never discarding the whole cookie).
- Legacy values (JSON array, optionally chunked) are still parsed; when a legacy single cookie and `_0…` chunks coexist, the chunks are read first on the assumption that state grew (the common case in #45). This is a heuristic that only matters for the first request before the upgraded browser code clears every legacy cookie. A v2 single cookie always wins over leftover chunks.

### Rationale (Why this?)

1. **The server already knows the handlers.** Sending the key again is redundant; a hash reference is enough and shrinks an entry from ~124 B to 7–11 B. 143 enabled Swagger handlers encode to ~1.1–1.6 KB; 300 fit under 3.8 KB.
2. **A budget on one cookie is the only model that matches the real limit.** A single value can be bounded; a set of chunks cannot without tracking the header total.
3. **Cleanup on write is the only way to guarantee no accumulation** regardless of toggle order, and it also heals cookies left by older versions on the first page load with the new version.
4. **No public API change.** `setupMockingServer({ cookie })` keeps its signature; only the internal format and an internal function parameter change.

### Alternatives Considered

| Option                                         | Why not                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Cleanup + chunk-first read + lower cap only    | Fixes the 431 but still loses ~110 of 143 handlers at a 4 KB cap because entries stay 124 B                                          |
| Strip the origin from keys                     | 86 B/entry; still over budget for OpenAPI-sized sets                                                                                 |
| Server-side store keyed by a session-id cookie | Needs a route in the host app, state lost on HMR / per worker process, replaces ADR-0001 — tracked separately as a candidate feature |

---

## Consequences

### Positive Effects (Pros)

✅ Library share of the request header bounded at < 4 KB; 431 can no longer be caused by the sync cookie
✅ No stale cookies after any sequence of toggles; legacy cookies removed automatically
✅ Server always applies the last written state; no format guessing
✅ ~15× smaller payload with lossless sync for 300 enabled handlers

### Negative Effects (Cons)

❌ The cookie is no longer human-readable (hashes instead of keys)
❌ Browser and server must register the same handlers for hashes to resolve (already required for keys to match)
❌ A 32-bit hash can collide in theory; colliding entries are ignored with a warning (≈ 2×10⁻⁶ for 143 keys)

### Mitigations

| Risk                                         | Severity | Mitigation Strategy                                                                                     |
| -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| Budget exceeded with very large enabled sets | Low      | Swagger-first truncation with an explicit warning listing dropped handlers; panel banner is a follow-up |
| Hash collision                               | Very low | Server detects duplicates in its own index and refuses to apply ambiguous entries                       |
| Users stuck on 431 before upgrading          | Medium   | Troubleshooting entry: delete `mocking_gui_sync*` once; the new version keeps it clean afterwards       |

### Out of Scope (follow-ups)

- Syncing `delay` to the server (never synced; unchanged)
- Panel UI warning when the budget truncates entries
- Cookie-less SSR sync via a host-app endpoint (separate ADR if pursued)
