import type { ReactNode } from 'react'

export const metadata = {
  title: 'Weight Room Connector',
  description: 'API + MCP server for the Weight Room gym tracker.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0b0f17', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
