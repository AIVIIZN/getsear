import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
