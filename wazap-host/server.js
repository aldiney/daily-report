// Local WhatsApp gateway used by daily-report v1.1. Adapted from the
// container-only version of multi-autoinstall to run cwd-relative, without
// hardcoded Linux paths.
//
// Environment variables (all optional, sensible defaults applied):
//   WAZAP_PORT_INTERNAL   port to listen on (default 4001)
//   WAZAP_API_KEY         require this key on POST endpoints (empty = open)
//   WAZAP_DATA_DIR        directory for `.wwebjs_auth/` session (default cwd)
//   PUPPETEER_EXECUTABLE_PATH   Chromium binary to use (default: whatever
//                               whatsapp-web.js / puppeteer ship with)
//   TZ                    timezone for log timestamps (default America/Sao_Paulo)

const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const path = require('path');

const PORT = parseInt(process.env.WAZAP_PORT_INTERNAL || '4001', 10);
const API_KEY = process.env.WAZAP_API_KEY || '';
const DATA_DIR = process.env.WAZAP_DATA_DIR || process.cwd();
const TZ = process.env.TZ || 'America/Sao_Paulo';
const MAX_RECONNECT = 5;

let sessionStatus = 'initializing';
let reconnectAttempts = 0;

const timestamp = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date());

const log = (msg) => console.log(`${timestamp()} - ${msg}`);
const logError = (msg) => console.error(`${timestamp()} - ${msg}`);

// --- WhatsApp client ---

const puppeteerOpts = {
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
  ],
};
if (process.env.PUPPETEER_EXECUTABLE_PATH) {
  puppeteerOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(DATA_DIR, '.wwebjs_auth') }),
  puppeteer: puppeteerOpts,
});

client.on('qr', (qr) => {
  sessionStatus = 'qr_pending';
  reconnectAttempts = 0;
  log('QR code received - scan with your WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
  log(`Loading: ${percent}% - ${message}`);
});

client.on('authenticated', () => {
  log('Authenticated');
  reconnectAttempts = 0;
});

client.on('auth_failure', (msg) => {
  logError(`Auth failure: ${msg}`);
  sessionStatus = 'qr_pending';
});

client.on('ready', () => {
  sessionStatus = 'connected';
  reconnectAttempts = 0;
  log('Client ready');
});

client.on('disconnected', (reason) => {
  logError(`Disconnected: ${reason}`);
  sessionStatus = 'disconnected';
  tryReconnect();
});

function tryReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT) {
    logError(`Reconnect failed after ${MAX_RECONNECT} attempts - waiting for new QR`);
    sessionStatus = 'qr_pending';
    client.initialize().catch((err) => logError(`Reinit error: ${err.message}`));
    return;
  }
  reconnectAttempts++;
  const delay = reconnectAttempts * 5000;
  log(`Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT} in ${delay / 1000}s...`);
  setTimeout(() => {
    client.initialize().catch((err) => logError(`Reconnect error: ${err.message}`));
  }, delay);
}

// --- Auth middleware ---

function requireAuth(req, res, next) {
  if (!API_KEY) return next();
  const key = req.headers['x-api-key'];
  if (key === API_KEY) return next();
  return res.status(401).json({ error: 'invalid or missing API key' });
}

// --- Helpers ---

function formatChatId(to) {
  if (typeof to !== 'string') return to;
  if (to.includes('@')) return to;
  const clean = to.replace(/\D/g, '');
  // Brazilian number: 55 + DDD (2) + 8 or 9 digits
  if (clean.startsWith('55') && clean.length >= 12 && clean.length <= 13) {
    return `${clean}@c.us`;
  }
  // Fallback: assume international number for contact
  if (clean.length >= 10) return `${clean}@c.us`;
  return `${clean}@g.us`;
}

// --- Express setup ---

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Endpoints ---

app.get('/api/status', (_req, res) => {
  res.json({ status: sessionStatus, port: PORT });
});

app.post('/api/send/text', requireAuth, async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'required fields: to, message' });
  }
  if (sessionStatus !== 'connected') {
    return res.status(503).json({ error: 'WhatsApp not connected', status: sessionStatus });
  }
  try {
    const chatId = formatChatId(to);
    await client.sendMessage(chatId, message);
    log(`Text sent to ${chatId}`);
    res.json({ success: true, to: chatId });
  } catch (err) {
    logError(`Send text error: ${err.message}`);
    res.status(500).json({ error: err.message || 'failed to send' });
  }
});

app.get('/api/groups', requireAuth, async (_req, res) => {
  if (sessionStatus !== 'connected') {
    return res.status(503).json({ error: 'WhatsApp not connected', status: sessionStatus });
  }
  try {
    const chats = await client.getChats();
    const groups = chats
      .filter((c) => c.isGroup)
      .map((c) => ({ id: c.id._serialized, name: c.name }));
    res.json(groups);
  } catch (err) {
    logError(`List groups error: ${err.message}`);
    res.status(500).json({ error: err.message || 'failed to list groups' });
  }
});

// --- Start ---

const server = app.listen(PORT, () => {
  log(`Server listening on port ${PORT}; data dir: ${DATA_DIR}`);
});

client.initialize().catch((err) => {
  logError(`Client init error: ${err.message}`);
  sessionStatus = 'qr_pending';
});

// Graceful shutdown for `daily-report wazap stop`.
function shutdown(signal) {
  log(`Received ${signal}, shutting down...`);
  server.close(() => log('HTTP server closed.'));
  client.destroy().then(() => {
    log('WhatsApp client destroyed.');
    process.exit(0);
  }).catch((err) => {
    logError(`Shutdown error: ${err.message}`);
    process.exit(1);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
