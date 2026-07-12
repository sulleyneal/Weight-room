import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Static-site friendly config. Use a relative base so the built app works
// from any sub-path (GitHub Pages, file://, etc.).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
})
