const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const deviceService = require('./src/services/deviceService');

const PORT = 3000;
// O frontend (Vite) pode rodar em portas diferentes durante o desenvolvimento.
// Mantemos uma lista explícita porque `credentials: true` não funciona com `origin: '*'`.
const FRONTEND_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://192.168.0.2:8080',
  'http://10.0.0.10:8080',
];
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGINS,
    methods: ['GET', 'POST'],
  },
});

app.use(
  cors({
    origin: FRONTEND_ORIGINS,
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));

function jsonError(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

app.post('/api/connect', async (req, res) => {
  const { ip } = req.body || {};
  if (!ip) {
    return jsonError(res, 400, 'Informe o ip do aparelho no corpo da requisição.');
  }
  try {
    const result = await deviceService.checkConnection(ip);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Connection error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/capture', async (req, res) => {
  const { ip, internalUserId, userId } = req.body || {};
  const uid = internalUserId ?? userId;
  if (!ip || uid == null) {
    return jsonError(res, 400, 'Informe ip e internalUserId (ou userId) no corpo da requisição.');
  }
  try {
    const result = await deviceService.startFaceCapture(ip, String(uid));
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Face capture error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { ip, userData } = req.body || {};
  if (!ip || !userData || userData.name == null || userData.id == null) {
    return jsonError(
      res,
      400,
      'Informe ip e userData com name e id no corpo da requisição.'
    );
  }
  try {
    const result = await deviceService.registerUser(ip, userData);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('User registration error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sync-users', async (req, res) => {
  const { ip, users } = req.body || {};
  if (!ip || !Array.isArray(users)) {
    return jsonError(res, 400, 'Informe ip e users (array) no corpo da requisição.');
  }

  try {
    let created = 0;
    const failed = [];

    // Mantemos sequencial para reduzir carga na ponte e reutilizar sessionToken.
    for (const u of users) {
      try {
        if (!u || u.id == null || u.name == null) continue;
        await deviceService.registerUser(ip, {
          id: u.id,
          name: u.name,
          begin_time: u.begin_time ?? u.beginTime ?? null,
          end_time: u.end_time ?? u.endTime ?? null,
        });
        created += 1;
      } catch (e) {
        failed.push({ id: u?.id ?? null, error: e?.message || String(e) });
      }
    }

    return res.json({
      success: true,
      data: {
        created,
        failedCount: failed.length,
        failed,
      },
    });
  } catch (error) {
    console.error('Sync users error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Webhooks do aparelho (mesma lógica do servidor anterior; emite via Socket.IO)
app.use((req, res) => {
  const rota = req.path;

  if (rota.includes('device_is_alive') || rota.includes('secbox')) {
    return res.status(200).json({ status: 'success' });
  }

  if (rota.includes('dao')) {
    if (
      req.body &&
      req.body.object_changes &&
      req.body.object_changes[0] &&
      req.body.object_changes[0].object === 'access_logs'
    ) {
      console.log('\n[Webhook Server] 📝 Log de Acesso Recebido!');
      console.log(JSON.stringify(req.body.object_changes[0].values, null, 2));
      io.emit('device:accessLog', {
        type: 'log',
        data: req.body.object_changes[0].values,
      });
    }
    return res.status(200).json({ status: 'success' });
  }

  if (rota.includes('access_photo')) {
    console.log('\n[Webhook Server] 📸 Foto Biométrica Recebida!');
    if (req.body) {
      io.emit('device:accessLog', { type: 'photo', data: req.body });
    }
    return res.status(200).json({ status: 'success' });
  }

  return res.status(200).json({ status: 'success' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[Server] HTTP + WebSocket escutando em 0.0.0.0:${PORT} (CORS: http://localhost:5173)`
  );
});
