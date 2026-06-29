// Minimal inline SVG icon set (stroke-based, inherits currentColor).
// Keeping these local avoids an icon-library dependency.

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconHome({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  )
}

export function IconDumbbell({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" />
    </svg>
  )
}

export function IconPlus({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconMinus({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M5 12h14" />
    </svg>
  )
}

export function IconChart({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M4 4v16h16" />
      <path d="M7 14l3-4 3 3 4-6" />
    </svg>
  )
}

export function IconSettings({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.2A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 2.6 14H2.5a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.2-2.9 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 2.6h.1A1.7 1.7 0 0 0 10.3 1 2 2 0 0 1 14 1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

export function IconCamera({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

export function IconTrash({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  )
}

export function IconEdit({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </svg>
  )
}

export function IconClose({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function IconChevronLeft({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

export function IconChevronRight({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function IconTrophy({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M7 4h10v3a5 5 0 0 1-10 0z" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
      <path d="M12 12v4M9 20h6M10 16h4l1 4H9z" />
    </svg>
  )
}

export function IconCopy({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  )
}

export function IconRepeat({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

export function IconCalendar({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  )
}

export function IconImage({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5L5 21" />
    </svg>
  )
}

export function IconList({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  )
}

export function IconDownload({ size = 24, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}
