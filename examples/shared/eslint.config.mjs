import { config } from '@mocking-gui/eslint-config/base';

/**
 * `examples/shared` is a plain directory, not a workspace package, so `turbo run lint`
 * never reaches it. The root `lint:shared` script points ESLint at this config, and
 * editors pick it up when a file here is opened.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  ...config,
  {
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          // Running from the repo root makes the preset's glob match every example's
          // tsconfig; this directory only needs one of them to resolve `@shared/*`.
          project: 'examples/react-csr/tsconfig.json',
        },
        node: true,
      },
    },
  },
];
