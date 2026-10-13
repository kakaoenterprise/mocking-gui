# Agentic Harness: Workflow Overview

Mocking GUI goes beyond being a simple library — it is an **Agentic Harness** system where a team of specialized AI agents builds and maintains an optimized mocking ecosystem for your environment.

The harness operates across two professional tracks: core library development and solution engineering. All agents work with deep expertise in Mocking GUI's core architecture and browser/frontend engineering.

## 1. Core Development Track

An internal engineering pipeline responsible for the completeness and architecture of the Mocking GUI library itself.

### Primary Workflow: `/harness-dev-pipeline`

1. **Scenario-Driven Design**: Define how a feature behaves in code before implementation, and validate architectural consistency upfront.
2. **High-Precision Engineering**: Implement stable, extensible core logic using TypeScript's strict type system.
3. **Integrated Quality Gate**: Changes must pass a rigorous verification pipeline combining Lint, Vitest, and Build before release eligibility.
4. **Documentation Auto-Sync**: The run's draft spec is promoted to the canonical spec registry on approval, and user guides are kept up-to-date in real time.

#### Artifact Trail

Every run of `/harness-dev-pipeline` creates one dated folder under `agent-artifacts/workstreams/`, and nothing is written outside it while the run is in progress:

```text
agent-artifacts/workstreams/2026-07-01-ssr-state-sync/
├── manifest.yaml            # current phase / status — the run's state machine
├── spec.md                  # Phase 1 deliverable: the draft feature spec
├── approvals/
│   ├── phase1-gate.md       # who approved Phase 1, when, and why
│   ├── phase2-gate.md
│   ├── phase3-gate.md
│   └── phase4-gate.md
├── executions/
│   ├── phase1-analysis.md   # what each phase actually did
│   ├── phase2-implementation.md
│   ├── phase3-verification.md
│   └── phase4-documentation.md
└── reports/
    ├── integrity-report.md  # final Lint/Vitest/Build results
    └── release-briefing.md
```

Once the spec is approved, it is copied to `agent-artifacts/specs/{feature}.md` as the living, canonical version (the run's `spec.md` stays frozen as history). Any architecture decision made along the way is recorded once, globally, in `agent-artifacts/decisions/ADR-{NNNN}-{slug}.md` and indexed in `decisions/INDEX.md` — so a decision made in one run is discoverable and reusable by every later run. Bug fixes and small changes skip this full structure and instead get a single `agent-artifacts/workstreams/{date}-{slug}/RUN.md` covering decision, approval, and log in one file.

## 2. Solution Engineering Track

A strategic support pipeline for successfully adopting Mocking GUI in user projects and building a productive mock ecosystem.

### Primary Workflow: `/technical-solution-support`

1. **Deterministic Project Audit**: Precisely analyzes the target project's environment (package manager, framework, API scale) to formulate the optimal onboarding strategy.
2. **Adaptive Infrastructure Setup**: Integrates Service Worker (MSW) and applies browser-level network optimization based on audit results.
3. **Professional Mock Architecture**: Applies the Handlers / Constants / Factories layer separation principle for a maintainable data environment.
4. **Skill & Reference Deployment**: Distributes project-specific agent skill sets and technical references to maximize collaboration efficiency.

## Shared Knowledge Base

Both tracks serve different purposes but share the same level of expertise in **Mocking GUI interfaces and frontend engineering**:

- **Service Worker & Browser**: Internals of request interception, caching, and latency simulation in the browser network stack.
- **Mocking GUI Core Interface**: Deep understanding of core specs such as `HandlerConfigOption`, `responseVariants`, and `responseVariantsFn`.
- **Professional Engineering**: Immutable state management with Immer, deterministic data generation with Faker seed patterns, and relational data integrity.
