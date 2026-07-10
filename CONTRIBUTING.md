# Contributing to Mocking GUI

Thank you for your interest in contributing!

Before starting your contribution, please take a moment to read the following guidelines.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## AI-Agentic Contribution

Our team uses an **AI Agentic Harness** to maintain quality and consistency. We encourage contributors to use our specialized AI agents and workflows for a more streamlined development experience.

For detailed information on how to use our agentic workflows for library development, handler generation, or project migration, please refer to **[AI Agentic Harness Guide](docs/guide/agentic-harness.md)**.

## Reporting Issues

Use [GitHub Issues](https://github.com/kakaoenterprise/mocking-gui/issues) to report bugs or request features.

### Reporting Bugs

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce (Be specific! Give sample code if you can)
- What you expected would happen
- What actually happened
- Notes (why you think this might be happening, or stuff you tried)

### Suggesting Enhancements

Open a new issue to suggest an enhancement.

- Use a clear and descriptive title.
- Provide a step-by-step description of the suggested enhancement.
- Explain why this enhancement would be useful to most Mocking GUI users.

## Questions

If you have questions about using the library, please use [GitHub Discussions](https://github.com/kakaoenterprise/mocking-gui/discussions) or check the [documentation](https://github.com/kakaoenterprise/mocking-gui#readme).

## Contributing Code

### Setup Development Environment

**Prerequisites**:

- Node >= 22.0.0
- Pnpm >= 9.0.0
- MSW >= 2.8.0

Check your Node.js version:

```bash
node -v
```

**Install Dependencies**:

```bash
pnpm install
```

### Development Workflow

To develop the `mocking-gui` library with real-time feedback using an example app:

```bash
pnpm example:dev
```

This runs every example app in parallel under `turbo watch`. The `dev` task depends on `^build`, so editing library source re-runs the `mocking-gui` build and the running examples pick up the fresh `dist/` automatically. To work against a single example instead:

```bash
pnpm turbo watch dev --filter=react-csr
```

If you want to run everything (including documentation and all examples):

```bash
pnpm dev
```

### Style Guide

- We use [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) for code formatting.
- Please ensure your code passes linting before submitting a PR.

```bash
pnpm lint
```

### Submitting a Pull Request

1.  **Fork** the repository to your own GitHub account.
2.  **Clone** the repository to your local machine.
3.  **Checkout** a new branch from `main`.
4.  **Make your changes**. Add tests if applicable.
5.  **Run tests** to ensure all tests pass.
6.  **Lint and Format** your code.
7.  **Commit** your changes following our [Conventional Commits](https://www.conventionalcommits.org/) convention.
8.  **Submit** the Pull Request to the `main` branch.

## Contributor License Agreement

Please sign the [CLA](https://cla-assistant.io/kakaoenterprise/mocking-gui) for Individual, before sending a Pull Request.

For **Corporate CLA**, contact us at [kc-oss@kakaoenterprise.com](mailto:kc-oss@kakaoenterprise.com).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
