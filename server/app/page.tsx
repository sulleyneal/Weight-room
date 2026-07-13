export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 22 }}>Weight Room Connector</h1>
      <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>
        This is the API + MCP server for the Weight Room gym tracker. It has no UI.
      </p>
      <ul style={{ color: '#94a3b8', lineHeight: 1.8, fontSize: 14 }}>
        <li>
          MCP endpoint (add as a custom connector in Claude): <code style={{ color: '#f97316' }}>/mcp</code>
        </li>
        <li>
          Health check: <code style={{ color: '#f97316' }}>/api/health</code>
        </li>
      </ul>
    </main>
  )
}
