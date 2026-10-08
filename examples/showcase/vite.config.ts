import path from 'path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * `DEMO_BASE` / `DEMO_OUT` are set only by the `build:demo` script, which bundles
 * this app into the VitePress docs site (`docs/public/demo`). Local `dev` and
 * `build` runs are unaffected.
 */
export default defineConfig({
  base: process.env.DEMO_BASE ?? '/',
  build: {
    outDir: process.env.DEMO_OUT ?? 'dist',
    emptyOutDir: true,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
