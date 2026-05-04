import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Only run files under tests/ — never pick up e2e/ Playwright specs.
    include: ['tests/**/*.test.ts'],
    // Explicitly exclude e2e to prevent accidental pickup if glob semantics change.
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
