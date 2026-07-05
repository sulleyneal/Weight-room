import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { buildCoachPrompt } from '../lib/coachPrompt.js'
import { IconSparkle } from './Icons.jsx'

// Keep ?q= prefill URLs comfortably under browser/app URL limits.
const MAX_PREFILL_URL = 7000

/**
 * "Ask Claude" coach button: builds the coaching prompt from current state and
 * hands it off — share sheet on mobile (pick the Claude app), otherwise copy
 * to clipboard and open claude.ai (with the prompt prefilled when short enough).
 */
export default function AskClaudeButton({ className = 'btn-ghost', label = 'Ask Claude' }) {
  const { state } = useStore()
  const [note, setNote] = useState(null)

  async function askClaude() {
    const prompt = buildCoachPrompt(state)
    if (!prompt) {
      setNote('Log a workout first — then Claude has something to analyze.')
      return
    }

    // Mobile: the share sheet lets you pick the Claude app directly.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Coach my next workout', text: prompt })
        return
      } catch (err) {
        if (err.name === 'AbortError') return // user closed the sheet
        // fall through to clipboard + claude.ai
      }
    }

    let copied = false
    try {
      await navigator.clipboard.writeText(prompt)
      copied = true
    } catch {
      // clipboard unavailable — the prefill URL below still carries the prompt
    }
    const encoded = encodeURIComponent(prompt)
    const url =
      encoded.length <= MAX_PREFILL_URL
        ? `https://claude.ai/new?q=${encoded}`
        : 'https://claude.ai/new'
    window.open(url, '_blank', 'noopener')
    setNote(
      copied ? 'Prompt copied — paste it into Claude if it didn’t prefill.' : 'Opened claude.ai.',
    )
  }

  return (
    <>
      <button className={className} onClick={askClaude}>
        <IconSparkle size={20} /> {label}
      </button>
      {note && <p className="col-span-2 text-xs text-slate-400 text-center">{note}</p>}
    </>
  )
}
