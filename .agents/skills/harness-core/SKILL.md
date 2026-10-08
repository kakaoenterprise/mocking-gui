---
version: 1.0.0
description: 'Integrated expert knowledge of the Mocking GUI library architecture, engine behavior, and MSW integration'
name: harness-core
---

# Skill: Mocking GUI Core Knowledge & Architecture

An integrated knowledge base covering the technical identity and internal operating principles of the Mocking GUI library.

## 1. Core Architectural Pillars

### 1.1. Handler Atomic Specification (CRITICAL)

- **Mocking GUI Specification First**: All handlers must be defined as `HandlerConfigOption` objects, not direct `msw` calls.
- **Engine Awareness**: Only defined objects are recognized by the Mocking GUI and the state synchronization engine.
- **Reference**: [Mocking GUI Atomic Spec: HandlerConfigOption](./reference/handler-specification.md)

### 1.2. Internal Module & Directory Structure

- **Entry Points**: Browser(`browser.ts`), Server(`server.ts`), Common Types(`index.ts`).
- **Logic Layers**: `utils/handler` (MSW Adapter), `utils/server` (Cookie Sync), `store/` (Zustand state).
- **Reference**: [Library Internal Architecture & Structure](./reference/library-structure.md)

### 1.3. Interception & State Sync (The "Soul")

- **Interception Mechanism**: All network requests are intercepted by the MSW 2.x `http` namespace interceptor.
  - **Relative Path**: Only intercepts same-origin requests currently being served.
  - **Absolute Path**: Required for intercepting requests to other domains or external APIs (cross-origin). When configuring Mocking GUI, external API mocking must use absolute paths including the domain.
- **Cookie Bridge**: Browser state is passed to the SSR/RSC server via the `mocking_gui_sync` cookie. Applied when `setupMockingServer({ cookie })` is called.
- **Reference**: [Mocking GUI System Architecture & Logic](./reference/mocking-gui-system-architecture.md)

### 1.4. Handler Scope & HTTP-Only Constraint

- **GUI Managed (mocks)**: Only handlers defined as `HandlerConfigOption` can be controlled in real time from the GUI.
- **HTTP Only (GUI-managed)**: Only the MSW `http` namespace is GUI-managed. GraphQL/WebSocket handlers can be passed through `MockingConfig.onDemandHandlers`, an escape hatch that goes straight to MSW: not shown in the panel, not toggleable, browser-only. `http.*` handlers must never be placed there. See [Handler Specification](./reference/handler-specification.md).
- **Swagger Auto Handlers**: Handlers loaded via `swagger[]` configuration are controlled in the GUI via `swaggerResponseVariants`.

## 2. Decision Tree: Technical Diagnosis

- **Q1. Mocking state is not reflected on the server side (Next.js, etc.)?**
  - **Action**: Inspect the cookie parsing logic in `utils/server/setup.ts` and check whether the client is generating the cookie.
- **Q2. A specific API request is passing through to the real server without being intercepted?**
  - **Action**: Check the handler active state (`active`) and the `passthrough()` condition in `convertToMswHandler`.
- **Q3. The GUI panel styles are broken or affected by external styles?**
  - **Action**: Inspect the Shadow DOM mount logic in `MockingGUIBoundary` and the style injection approach.

## 3. Engineering Constraints

- **Type Safety**: Use of `any` is prohibited; common interfaces under `types/` must always be extended.
- **Immutability**: All state changes must be performed exclusively through the Zustand Store, maintaining immutability.
- **Standard Compliance**: Only MSW 2.x and browser Service Worker standard APIs are used.
