// Rasterizes public/icon.svg into the PNG app icons referenced by index.html
// and the web manifest. Run with: node scripts/generate-icons.mjs
//
// Requires `sharp` (install transiently: `npm install --no-save sharp`).
// The generated PNGs are committed, so this only needs re-running when the
// icon artwork changes.
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
const svg = await readFile(join(pub, 'icon.svg'))

// Square icons rendered straight from the SVG (which already has its own padding).
const square = [
  ['favicon-32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]
for (const [name, size] of square) {
  await sharp(svg).resize(size, size).png().toFile(join(pub, name))
  console.log('wrote', name)
}

// Maskable icon: extra safe-zone padding so Android's mask never clips the mark.
const maskSize = 512
const inner = Math.round(maskSize * 0.78)
const pad = Math.round((maskSize - inner) / 2)
const markOnly = await sharp(svg).resize(inner, inner).png().toBuffer()
await sharp({
  create: {
    width: maskSize,
    height: maskSize,
    channels: 4,
    background: '#0b0f17',
  },
})
  .composite([{ input: markOnly, top: pad, left: pad }])
  .png()
  .toFile(join(pub, 'icon-maskable-512.png'))
console.log('wrote icon-maskable-512.png')

// Plain .ico-style favicon fallback (PNG is fine for modern browsers).
await writeFile(join(pub, 'favicon.ico'), await sharp(svg).resize(32, 32).png().toBuffer())
console.log('wrote favicon.ico')
