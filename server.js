const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { Server } = require('socket.io');
const { Redis } = require('@upstash/redis');

const config = require('./config');

const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// ---- Persistence (optional) ---------------------------------------------
// If Upstash credentials are configured, queue history/room status survive
// restarts (important on hosts like Render where local disk/memory resets
// on every restart). Without them, the app just runs in-memory only.
const STATE_KEY = 'alfa-queue:state';
const redis = config.upstash.url && config.upstash.token
  ? new Redis({ url: config.upstash.url, token: config.upstash.token })
  : null;

function persistState() {
  if (!redis) return;
  redis.set(STATE_KEY, JSON.stringify({ history, lastCallByRoom })).catch((err) => {
    console.error('Failed to persist queue state:', err.message);
  });
}

async function loadState() {
  if (!redis) return;
  try {
    const saved = await redis.get(STATE_KEY);
    if (saved) {
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
      history = parsed.history || [];
      Object.assign(lastCallByRoom, parsed.lastCallByRoom || {});
      console.log(`Loaded persisted queue state (${history.length} history entries)`);
    }
  } catch (err) {
    console.error('Failed to load persisted queue state:', err.message);
  }
}

// ---- In-memory state -------------------------------------------------
// history: newest call first. Each entry: { id, room, number, timestamp }
let history = [];
const HISTORY_LIMIT = 100;

// lastCallByRoom[room] = { id, number } | undefined
const lastCallByRoom = {};

// currently uploaded display image, relative to /uploads
let currentImageFile = null;

function top3() {
  return history.slice(0, config.maxHistoryRows);
}

function roomNumber(room) {
  const last = lastCallByRoom[room];
  return last ? last.number : null;
}

// ---- REST API ----------------------------------------------------------

app.get('/api/rooms', (req, res) => {
  res.json({ rooms: config.rooms });
});

app.post('/api/login', (req, res) => {
  const { username, password, room } = req.body || {};
  const creds = config.doctorCredentials;
  if (!config.rooms.includes(room)) {
    return res.status(400).json({ ok: false, error: 'Invalid room' });
  }
  if (username === creds.username && password === creds.password) {
    return res.json({ ok: true, room });
  }
  return res.status(401).json({ ok: false, error: 'Invalid username or password' });
});

app.post('/api/admin-login', (req, res) => {
  const { password } = req.body || {};
  if (password === config.adminPassword) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Invalid password' });
});

app.get('/api/room-status/:room', (req, res) => {
  const room = req.params.room;
  if (!config.rooms.includes(room)) {
    return res.status(400).json({ error: 'Invalid room' });
  }
  res.json({ room, number: roomNumber(room) });
});

app.get('/api/current-image', (req, res) => {
  if (!currentImageFile) return res.json({ url: null });
  res.json({ url: `/uploads/${currentImageFile}?t=${Date.now()}` });
});

const upload = multer({ dest: UPLOADS_DIR });

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No file uploaded' });
  }

  const ext = path.extname(req.file.originalname) || '';
  const newFilename = req.file.filename + ext;
  fs.renameSync(req.file.path, path.join(UPLOADS_DIR, newFilename));

  const previousFile = currentImageFile;
  currentImageFile = newFilename;

  if (previousFile) {
    fs.unlink(path.join(UPLOADS_DIR, previousFile), () => {});
  }

  const url = `/uploads/${currentImageFile}?t=${Date.now()}`;
  io.emit('image-updated', { url });
  res.json({ ok: true, url });
});

// ---- HTTP + Socket.IO ----------------------------------------------------

const server = require('http').createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  socket.emit('queue-update', { top3: top3(), justCalledId: null });

  socket.on('call', ({ room, number }) => {
    if (!config.rooms.includes(room)) return;
    const value = String(number || '').trim();
    if (!value) return;

    const entry = {
      id: crypto.randomUUID(),
      room,
      number: value,
      timestamp: Date.now(),
    };

    history.unshift(entry);
    if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
    lastCallByRoom[room] = { id: entry.id, number: entry.number };
    persistState();

    io.emit('queue-update', { top3: top3(), justCalledId: entry.id });
    io.emit('room-status', { room, number: entry.number });
  });

  socket.on('recall', ({ room }) => {
    if (!config.rooms.includes(room)) return;
    const last = lastCallByRoom[room];
    if (!last) return;

    history = history.filter((entry) => entry.id !== last.id);

    const nextForRoom = history.find((entry) => entry.room === room);
    lastCallByRoom[room] = nextForRoom
      ? { id: nextForRoom.id, number: nextForRoom.number }
      : undefined;
    persistState();

    io.emit('queue-update', { top3: top3(), justCalledId: null });
    io.emit('room-status', { room, number: roomNumber(room) });
  });
});

loadState().then(() => server.listen(config.port, '0.0.0.0', () => {
  console.log(`Alfa Queue System running on port ${config.port}`);
  console.log('Open on this machine:');
  console.log(`  Display:      http://localhost:${config.port}/`);
  console.log(`  Doctor panel: http://localhost:${config.port}/doctor.html`);
  console.log(`  Admin upload: http://localhost:${config.port}/admin.html`);

  const nets = os.networkInterfaces();
  const lanAddresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) lanAddresses.push(net.address);
    }
  }
  if (lanAddresses.length) {
    console.log('\nFrom other devices on the same network, use:');
    lanAddresses.forEach((ip) => console.log(`  http://${ip}:${config.port}/`));
  }
}));
