# Contributing Guide

Thank you for your interest in contributing to Mocking GUI! 🙌 <br/>
We welcome all forms of contribution, including bug reports, feature suggestions, documentation improvements, and code contributions.

## 🐛 Bug Reports

If you find a bug, please create an issue using the Bug Report issue template.

## 🌟 Feature Suggestions

If you have a new idea, please use the Feature Request issue template.

## 🚀 Code Contribution

### Development Environment Setup

1. **Clone Repository**

```bash
git clone https://github.com/kakaoenterprise/mocking-gui.git
cd mocking-gui
```

2. **Install Dependencies**

Mocking GUI uses [pnpm](https://pnpm.io/) for package management. Node.js v22 or higher is required.

```bash
nvm use 22
pnpm install
```

3. **Start Development Environment**

```bash
# Start all example environments; the library rebuilds automatically on source changes
pnpm example:dev
```

To test a specific example environment:

```bash
# Test specific example
pnpm turbo watch dev --filter=next-app-router  # Next.js SSR/RSC example
pnpm turbo watch dev --filter=react-csr        # React (CSR) example
```

### Project Structure

```
mocking-gui/
├── packages/
│   └── mocking-gui/              # Main library package (@kakaocloud/mocking-gui)
│      ├── src/
│      │  ├── browser/     # Browser environment (MSW, DevTools)
│      │  ├── server/      # Server environment (Node.js, SSR)
│      │  └── ...
├── examples/              # Usage examples and verification projects
│   ├── react-csr/         # React + Vite (CSR) example
│   └── next-app-router/   # Next.js App Router (SSR/RSC) example
└── docs/                  # Documentation site
```

### PR Process

1. **Fork & Branch**: Fork the repository and create a new branch.
   - Branch name: `feat/feature-name`, `fix/bug-fix`, etc.
2. **Commit**: Follow [Conventional Commits](https://www.conventionalcommits.org/) rules.
   - Ex: `feat: add new handler util`, `fix: resolve race condition`
3. **Code Quality Check**: Ensure your code meets quality standards:

   ```bash
   # Run lint check
   pnpm lint
   pnpm lint:fix

   # Run format check
   pnpm format:check
   pnpm format
   ```

4. **Test**: Add tests for your changes and ensure all tests pass.
5. **Pull Request**: Create a PR and describe your changes in detail.

### Code Style

- **Lint**: Run `pnpm lint` to check for lint errors.
- **Naming**:
  - Constants: `UPPER_SNAKE_CASE`
  - Variables/Functions: `camelCase`
  - Components: `PascalCase`

## 📄 Documentation Contribution

We welcome improvements to documentation! Here's how you can contribute to docs:

### Documentation Development Setup

1. **Setup Environment** (follow steps 1-3 from Code Contribution above)

2. **Start Documentation Server**

```bash
pnpm docs:dev
```

### Documentation Structure

```
docs/
├── guide/                 # User guides
│   ├── introduction.md    # Getting started
│   ├── quick-start.md     # Quick setup guide
│   ├── contributing.md    # Contributing guide
│   └── usage/            # Usage examples
│       ├── api-guide.md
│       ├── gui-guide.md
│       └── ...
└── mocking-gui-docs/            # API documentation (auto-generated)
```

### Types of Documentation Contributions

- **Fix typos or grammar**: Small improvements to existing content
- **Improve clarity**: Make explanations clearer or add missing context
- **Add examples**: Practical code examples and use cases
- **Translate content**: Help make Mocking GUI accessible in other languages
- **API documentation**: Improve JSDoc comments in source code

### Documentation Guidelines

- Use clear, concise language
- Include practical examples where helpful
- Follow the existing structure and formatting
- Test code examples to ensure they work
