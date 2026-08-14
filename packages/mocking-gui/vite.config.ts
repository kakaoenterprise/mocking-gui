import { resolve } from 'path';
import { fileURLToPath } from 'url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { ConfigEnv, defineConfig, UserConfig } from 'vite';
import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';

import type { Plugin } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Plugin to enforce insertion of 'use client'; directive for browser environment
const ensureUseClientDirective = (): Plugin => ({
  name: 'ensure-client-directive-output',
  generateBundle(_, bundle) {
    const directive = '"use client";';
    for (const [fileName, output] of Object.entries(bundle)) {
      if (output.type === 'chunk' && fileName.startsWith('browser')) {
        const code = output.code as string;
        const trimmed = code.trimStart();
        if (!trimmed.startsWith(directive)) {
          output.code = `${directive}\n${code}`;
        }
      }
    }
  },
});

export default defineConfig(({ mode }: ConfigEnv) => {
  const isProd = mode === 'production';

  const config: UserConfig = {
    publicDir: isProd ? false : 'public',
    plugins: [
      dts({
        insertTypesEntry: true,
        rollupTypes: false,
      }),
      react(),
      tailwindcss(),
      tsconfigPaths(),
    ],
    build: {
      lib: {
        entry: {
          index: resolve(__dirname, 'src/index.ts'),
          browser: resolve(__dirname, 'src/browser.ts'),
          server: resolve(__dirname, 'src/server.ts'),
          testing: resolve(__dirname, 'src/testing.ts'),
        },
        name: 'mocking-gui',
        formats: ['es', 'cjs'],
      },
      terserOptions: {
        compress: {
          drop_console: false, // Do not remove console.log
        },
      },
      rollupOptions: {
        external: ['react', 'react-dom', 'react/jsx-runtime', 'msw', 'msw/browser', 'msw/node'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
            'react/jsx-runtime': 'ReactJsxRuntime',
          },
          assetFileNames: assetInfo => {
            const names = assetInfo.names;
            const name = names?.[0] || 'asset';
            if (name.endsWith('.css')) return 'mocking-gui.css';
            return name;
          },
          plugins: [ensureUseClientDirective()],
        },
      },
      sourcemap: true,
      emptyOutDir: isProd,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  };

  if (isProd) {
    config.define = {
      'process.env.NODE_ENV': 'process.env.NODE_ENV',
    };
  }

  return {
    ...config,
    test: {
      globals: true,
    },
  };
});
