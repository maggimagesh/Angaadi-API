const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { WebSocketServer } = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3300', 10)
const app = next({ dev })
const handle = app.getRequestHandler()

// Global set of connected WebSocket clients
const clients = new Set()

/**
 * Broadcast a message to every connected WebSocket client.
 * Called from API routes (e.g. stock.ts) via `global.__wsBroadcast`.
 */
function broadcast(data) {
  const payload = JSON.stringify(data)
  for (const ws of clients) {
    if (ws.readyState === 1 /* WebSocket.OPEN */) {
      try {
        ws.send(payload)
      } catch {
        clients.delete(ws)
      }
    }
  }
}

// Expose broadcast globally so API routes can access it
global.__wsBroadcast = broadcast

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  // Attach WebSocket server on the `/ws` path
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url, true)
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    } else {
      socket.destroy()
    }
  })

  wss.on('connection', (ws) => {
    clients.add(ws)
    console.log(`[WS] Client connected (total: ${clients.size})`)

    ws.on('close', () => {
      clients.delete(ws)
      console.log(`[WS] Client disconnected (total: ${clients.size})`)
    })

    ws.on('error', () => {
      clients.delete(ws)
    })
  })

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
    console.log(`> WebSocket server on ws://localhost:${port}/ws`)
  })
})
