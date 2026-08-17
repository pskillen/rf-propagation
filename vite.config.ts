/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

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
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
  },
});
