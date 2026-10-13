# AI Agentic Harness Guide

Mocking GUI is developed with high quality and consistency through an **AI Agentic Harness** system. All contributors can leverage specialized agents and workflows to contribute to the project more easily and systematically.

## Mission Map: Workflow Selection Guide

Choose the agent mission that matches your contribution goal.

### Case 1: Improve or Add Features to Mocking GUI

- **When**: You want to modify the GUI panel UI or add new functionality to the core engine.
- **How**: Run `/harness-dev-pipeline` in your AI assistant.
- **Result**: The `harness-dev-pipeline` workflow orchestrates four sequential phases — Product Planning → Architecture Design → Implementation → Quality Verification — with each phase delegated to a specialized sub-agent. Small fixes get a lightweight single-file run instead of the full artifact set, so the process scales down to the size of the change.

### Case 2: Generate Service Mocking Handlers

- **When**: You want to build high-quality mocking handlers and data based on an API specification.
- **How**: `@handler-specialist, generate handlers based on [Swagger URL or API spec].`
- **Result**: A complete handler set following the 4-Layer architecture (Handlers, Constants, Factories, Utils) is generated in compliance with the `handler-specification` standard.

### Case 3: Project Onboarding and Migration

- **When**: You want to integrate Mocking GUI into an existing project, or refactor an existing MSW setup to the Mocking GUI standard.
- **How**: Run `/technical-solution-support` in your AI assistant.
- **Result**: The `technical-solution-support` workflow analyzes your project environment and provides an optimized migration strategy and onboarding guide.

## Agentic Quality Gate

Every workflow automatically performs the following to reduce contributor burden:

1. **Automated Test & Build**: Runs `vitest` and `build` checks to ensure changes don't break existing functionality.
2. **Technical Standards Enforcement**: Validates real-time compliance with `technical-guardrail` rules and architecture standards.
3. **Documentation Automation**: Keeps technical docs and reports in sync with code changes.

Contributors only need to **give the agent a clear mission** and **review and approve the decision report** generated at each phase — every artifact (spec, approval gate, ADR) is saved under `agent-artifacts/` so it can be reviewed alongside the code change.
