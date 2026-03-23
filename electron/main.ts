import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import express from 'express';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let db: Database.Database;

function initDB() {
  const dbPath = path.join(app.getPath('userData'), 'escola.db');
  console.log('Database path:', dbPath);
  db = new Database(dbPath);

  // Criar tabelas
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      cpf TEXT UNIQUE,
      name TEXT,
      password TEXT,
      role TEXT
    );
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT
    );
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT,
      school_id TEXT
    );
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT,
      matricula TEXT UNIQUE,
      class_id TEXT,
      guardian_id TEXT,
      photo_base64 TEXT
    );
    CREATE TABLE IF NOT EXISTS access_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      matricula TEXT,
      event_type TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      photo_base64 TEXT
    );
  `);

  // Seed do usuário
  const stmt = db.prepare('SELECT id FROM users WHERE cpf = ?');
  const admin = stmt.get('000.000.000-00');
  if (!admin) {
    db.prepare('INSERT INTO users (cpf, password, role, name) VALUES (?, ?, ?, ?)').run(
      '000.000.000-00', 'admin', 'secretaria', 'Secretaria Admin'
    );
  }
}

function startWebhookServer() {
  const expressApp = express();
  expressApp.use(express.json({ limit: '50mb' }));
  
  expressApp.post(/^\/api\/notificacoes/, (req, res) => {
    const payload = req.body;
    
    if (mainWindow) {
      mainWindow.webContents.send('device:webhook', payload);
    }
    
    res.status(200).send('OK');
  });

  expressApp.listen(3000, '0.0.0.0', () => {
    console.log('Webhook server running on port 3000');
  });
}

function createWindow() {
  // Verificando a extensão gerada do preload pelo vite-plugin-electron
  const preloadExt = fs.existsSync(path.join(__dirname, 'preload.mjs')) ? 'preload.mjs' : 'preload.js';

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, preloadExt),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  initDB();
  startWebhookServer();
  
  ipcMain.handle('auth:login', (event, cpf, password) => {
    try {
      const stmt = db.prepare('SELECT id, cpf, name, role FROM users WHERE cpf = ? AND password = ?');
      const user = stmt.get(cpf, password);
      return { success: !!user, user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:createStudent', (event, data) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO students (name, matricula, class_id, guardian_id)
        VALUES (?, ?, ?, ?) RETURNING id
      `);
      const row = stmt.get(data.name, data.matricula, data.class_id, data.guardian_id) as { id: string };
      return { success: true, id: row.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('device:enrollUser', async (event, { ip, id, name, matricula }) => {
    try {
      const userPayload = {
        object: 'users',
        values: [{ name: name, registration: matricula }]
      };
      
      const resUser = await fetch(`http://${ip}/create_objects.fcgi?session=`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload)
      });
      
      if (!resUser.ok) throw new Error('Falha HTTP ao criar utilizador no iDFace');
      const dataUser = await resUser.json();
      const deviceUserId = dataUser?.ids?.[0];

      if (!deviceUserId) throw new Error('Aparelho não retornou o ID do utilizador.');

      const enrollPayload = {
        type: 'face',
        user_id: deviceUserId,
        save: true
      };

      const resEnroll = await fetch(`http://${ip}/remote_enroll.fcgi?session=`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrollPayload)
      });

      if (!resEnroll.ok) throw new Error('Falha HTTP ao iniciar câmara do iDFace');

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
