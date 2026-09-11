---
version: 1.0.0
description: 'Consulting competency for diagnosing user project environments and designing the optimal Mocking GUI adoption strategy and infrastructure configuration'
name: solution-delivery
---

# Skill: Mocking GUI Solution Expert (Deployment Strategy)

A strategic consulting skill for identifying the technical constraints of a target project and designing the adoption process so that Mocking GUI operates most effectively.

## 1. Core Competencies

- **Deterministic Project Audit**: Precise analysis of the project's framework, mocking maturity, and scale.
- **Adaptive Infrastructure Design**: Proposing tailored infrastructure configurations for each environment such as Next.js and Vite.
- **Migration & Integration Strategy**: Planning a safe transition from legacy MSW and integration with external tools (Swagger, etc.).

## 2. Reference & Detailed Specs

- **Audit Criteria**: [Project Diagnosis and Analysis Criteria](./reference/audit-criteria.md)
- **Infra Setup Guide**: [Infrastructure Setup Instructions per Environment](./reference/infra-setup.md)

## 3. Decision Tree / Standard Workflow

- **Q1. Is the project using SSR (Next.js App Router)?** -> **Action**: Apply `dynamic({ ssr: false })` wrapper + `setupMockingServer({ cookie })` as required. A Client Component wrapper is needed in Next.js.
- **Q2. Is MSW currently being used manually?** -> **Action**: Write a migration roadmap to convert existing handlers to the Mocking GUI 4-Layer pattern (`HandlerConfigOption`).
- **Q3. Does the project have a base path?** -> **Action**: Specify `${BASE_PATH}/mockServiceWorker.js` in `worker.serviceWorker.url` and verify that the MSW init path matches.
- **Q4. Want to use Swagger documentation?** -> **Action**: Add `configUrl` (OpenAPI JSON URL) to the `swagger[]` array. Proactively verify CORS allowance.
- **Q5. Are there GraphQL/WebSocket handlers?** -> **Action**: Pass them unchanged via `MockingConfig.onDemandHandlers` (escape hatch, browser-only, not shown in the panel). All `http.*` handlers still go to `mocks` as `HandlerConfigOption` — never to `onDemandHandlers`.

## 4. Engineering Constraints & Mandates

- "All solutions must be designed within the Mocking GUI technical guardrail (`technical-guardrail`)."
- "Follow the framework's standard patterns and minimize breaking changes."
- "Adoption reports must present both business value and technical validity."
