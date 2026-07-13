import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

// Stamp the built service worker's cache name with a content-derived build id,
// so every deploy that changes assets ships a byte-different sw.js. Browsers
// (notably iOS home-screen PWAs) then install the new worker, which purges the
// old cache — otherwise a fixed cache name lets a stale cache shadow a fresh
// deploy indefinitely.
function stampServiceWorker() {
  let buildId = 'dev'
  let outDir = 'dist'
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    generateBundle(options, bundle) {
      if (options.dir) outDir = options.dir
      const names = Object.keys(bundle).sort().join('|')
      buildId = createHash('sha256').update(names).digest('hex').slice(0, 12)
    },
    closeBundle() {
      const swPath = resolve(outDir, 'sw.js')
      if (!existsSync(swPath)) return
      const src = readFileSync(swPath, 'utf8')
      if (src.includes('__BUILD_ID__')) {
        writeFileSync(swPath, src.replace(/__BUILD_ID__/g, buildId))
      }
    },
  }
}

// Static-site friendly config. Use a relative base so the built app works
// from any sub-path (GitHub Pages, file://, etc.).
export default defineConfig({
  base: './',
  plugins: [react(), stampServiceWorker()],
  test: {
    environment: 'jsdom',
  },
})
