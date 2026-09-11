// Runs only on staged files. ESLint must run from the package that owns the flat config.
export default {
  'packages/mocking-gui/**/*.{ts,tsx}': files =>
    `pnpm --filter @kakaocloud/mocking-gui exec eslint --fix --max-warnings=0 ${files.join(' ')}`,
  '*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml}': 'prettier --write',
};
