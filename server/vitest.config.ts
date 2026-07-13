import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${dir}/` }],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
