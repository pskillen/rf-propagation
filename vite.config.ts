/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const buildEnv = process.env.BUILD_ENV || 'local';
const buildVersion = process.env.BUILD_VERSION || 'local';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@core': path.resolve(import.meta.dirname, 'src/core'),
      '@integrations': path.resolve(import.meta.dirname, 'src/integrations'),
      '@app': path.resolve(import.meta.dirname, 'src/app'),
    },
  },
  define: {
    __BUILD_ENV__: JSON.stringify(buildEnv),
    __BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
