// URL constants used in documentation
export const URLS = {
  GITHUB: 'https://github.com/kakaoenterprise/mocking-gui',
  GITHUB_ISSUES: 'https://github.com/kakaoenterprise/mocking-gui/issues',
  GITHUB_DISCUSSIONS: 'https://github.com/kakaoenterprise/mocking-gui/discussions',
  NPM: 'https://www.npmjs.com/package/@kakaocloud/mocking-gui',
  DOCS: '/mocking-gui/',
  /**
   * The showcase app, published beside the docs by `pnpm demo:build`.
   *
   * Written without the base — VitePress prepends it — and deliberately left as
   * a site-relative path so the link follows whichever host the docs are on,
   * including a fork's Pages. It only exists after a build that ran
   * `demo:build`; plain `vitepress dev` will 404 on it.
   */
  DEMO: '/demo/',
} as const;

// Link constants in documentation
export const DOC_LINKS = {
  GUIDE: '/guide/',
  EXAMPLES: '/examples/',
  API: '/api/',
  QUICK_START: '/guide/quick-start',
  BASIC_USAGE: '/guide/basic-usage',
  ADVANCED: '/guide/advanced',
  CLI: '/guide/cli',
  CONFIGURATION: '/guide/configuration',
  FAQ: '/guide/faq',
  TROUBLESHOOTING: '/guide/troubleshooting',
} as const;

// Example links
export const EXAMPLE_LINKS = {
  SIMPLE_HANDLER: '/examples/basic/simple-handler',
  RESPONSE_VARIANTS: '/examples/basic/response-variants',
  ERROR_HANDLING: '/examples/basic/error-handling',
  DYNAMIC_HANDLERS: '/examples/advanced/dynamic-handlers',
  CUSTOM_THEMES: '/examples/advanced/custom-themes',
  INTEGRATION: '/examples/advanced/integration',
  USER_MANAGEMENT: '/examples/real-world/user-management',
  FILE_UPLOAD: '/examples/real-world/file-upload',
} as const;

// API links
export const API_LINKS = {
  COMPONENTS: '/api/components',
  HOOKS: '/api/hooks',
  STORES: '/api/stores',
  TYPES: '/api/types',
} as const;

// Environment settings
export const ENV_CONFIG = {
  IS_DEV: process.env.NODE_ENV === 'development',
  IS_PROD: process.env.NODE_ENV === 'production',
} as const;
