import crypto from 'crypto';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer } from 'ws';

const router = express.Router();

// In-memory session store
// Each entry: { sessionId, token, createdAt, browserWs, phoneWs, timeout }
const sessions = new Map();

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cleanupSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  clearTimeout(session.timeout);

  if (session.browserWs) {
    try { session.browserWs.close(1000, 'Session expired'); } catch {}
  }
  if (session.phoneWs) {
    try { session.phoneWs.close(1000, 'Session expired'); } catch {}
  }

  sessions.delete(sessionId);
}

// POST /create - Generate a new web session
router.post('/create', (req, res) => {
  const sessionId = uuidv4();
  const token = crypto.randomBytes(32).toString('hex');

  const timeout = setTimeout(() => {
    cleanupSession(sessionId);
  }, SESSION_TTL_MS);

  sessions.set(sessionId, {
    sessionId,
    token,
    createdAt: Date.now(),
    browserWs: null,
    phoneWs: null,
    timeout,
  });

  // Build relay URL that the phone can reach
  const protocol = req.protocol === 'https' ? 'wss' : 'ws';
  const host = req.get('host');
  const relay = `${protocol}://${host}/ws/signaling`;

  res.json({ sessionId, token, relay });
});

// Set up WebSocket signaling on the given HTTP server
function setupSignaling(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname !== '/ws/signaling') {
      return; // Let other upgrade handlers (if any) handle it
    }

    const sessionId = url.searchParams.get('sessionId');
    const role = url.searchParams.get('role');

    if (!sessionId || !sessions.has(sessionId)) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    if (role !== 'browser' && role !== 'phone') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const session = sessions.get(sessionId);

    // Reject duplicate role connections
    if (role === 'browser' && session.browserWs) {
      socket.write('HTTP/1.1 409 Conflict\r\n\r\n');
      socket.destroy();
      return;
    }
    if (role === 'phone' && session.phoneWs) {
      socket.write('HTTP/1.1 409 Conflict\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, { sessionId, role });
    });
  });

  wss.on('connection', (ws, req, { sessionId, role }) => {
    console.log(`[SIGNALING] connection: role=${role} sessionId=${sessionId}`);
    const session = sessions.get(sessionId);
    if (!session) {
      console.log(`[SIGNALING] session not found: ${sessionId}`);
      ws.close(1008, 'Session not found');
      return;
    }

    if (role === 'browser') {
      session.browserWs = ws;
      console.log(`[SIGNALING] browser connected for session ${sessionId}`);

      ws.on('close', () => {
        if (session.browserWs === ws) {
          session.browserWs = null;
        }
      });

      ws.on('error', () => {
        if (session.browserWs === ws) {
          session.browserWs = null;
        }
      });

    } else if (role === 'phone') {
      session.phoneWs = ws;
      console.log(`[SIGNALING] phone connected for session ${sessionId}`);

      ws.on('message', (data) => {
        console.log(`[SIGNALING] phone message:`, data.toString());
        let msg;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
          return;
        }

        if (msg.type === 'phone-ready') {
          console.log(`[SIGNALING] phone-ready: ip=${msg.ip} port=${msg.port}`);
          // Verify the token
          if (msg.token !== session.token) {
            console.log(`[SIGNALING] token mismatch!`);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
            ws.close(1008, 'Invalid token');
            return;
          }

          // Forward to browser (without the token)
          const browserReady = session.browserWs && session.browserWs.readyState === ws.OPEN;
          console.log(`[SIGNALING] browserWs exists: ${!!session.browserWs}, readyState: ${session.browserWs?.readyState}, wsOPEN: ${ws.OPEN}, browserReady: ${browserReady}`);
          if (browserReady) {
            session.browserWs.send(JSON.stringify({
              type: 'phone-ready',
              ip: msg.ip,
              port: msg.port,
            }));
            console.log(`[SIGNALING] forwarded phone-ready to browser`);
          } else {
            console.log(`[SIGNALING] browser NOT ready, cannot forward`);
          }

          // Close both connections and clean up the session
          try { ws.close(1000, 'Signaling complete'); } catch {}
          try { if (session.browserWs) session.browserWs.close(1000, 'Signaling complete'); } catch {}

          clearTimeout(session.timeout);
          sessions.delete(sessionId);
        }
      });

      ws.on('close', () => {
        if (session.phoneWs === ws) {
          session.phoneWs = null;
        }
      });

      ws.on('error', () => {
        if (session.phoneWs === ws) {
          session.phoneWs = null;
        }
      });
    }
  });

  return wss;
}

export default router;
export { setupSignaling };
