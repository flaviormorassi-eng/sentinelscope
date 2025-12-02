import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
  test: {
    environment: 'jsdom',
    include: [
      'client/src/**/__tests__/**/*.{test,spec}.ts?(x)',
      'server/tests/**/*.{test,spec}.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['html', 'text', 'json-summary'],
    },
  },
});
