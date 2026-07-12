// Share-card fonts, bundled (no CDN at share time, per house rules).
//
// Both families ship as latin variable fonts (~31KB each) and are lazy-loaded
// the first time the share studio opens — never on the boot/logging path.
// Canvas fillText resolves weights through document.fonts, so registering the
// FontFace with the full weight range is all the wiring needed; this works in
// Safari/WebKit as well as Chromium (no html2canvas anywhere).

import jetbrainsMonoUrl from '../../assets/fonts/jetbrains-mono-var-latin.woff2?url'
import outfitUrl from '../../assets/fonts/outfit-var-latin.woff2?url'

export const MONO = 'JetBrains Mono'
export const SANS = 'Outfit'

let loadPromise = null

export function loadShareFonts() {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const faces = [
      new FontFace(MONO, `url(${jetbrainsMonoUrl})`, { weight: '100 800' }),
      new FontFace(SANS, `url(${outfitUrl})`, { weight: '100 900' }),
    ]
    const loaded = await Promise.all(faces.map((f) => f.load()))
    for (const f of loaded) document.fonts.add(f)
    // Belt & braces: make sure the specific styles the cards use are ready
    // before anything draws (Safari resolves canvas fonts from this set).
    await Promise.all([
      document.fonts.load(`500 16px "${MONO}"`),
      document.fonts.load(`800 64px "${SANS}"`),
    ])
  })()
  loadPromise.catch(() => {
    loadPromise = null // allow retry after a transient failure
  })
  return loadPromise
}
