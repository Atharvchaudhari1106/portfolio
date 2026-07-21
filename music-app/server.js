import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

import authRoutes from './server/routes/auth.js';
import spotifyRoutes from './server/routes/spotify.js';
import youtubeRoutes from './server/routes/youtube.js';
import musicRoutes from './server/routes/music.js';
import configRoutes from './server/routes/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server/.env if available, or root .env
const serverEnvPath = path.join(__dirname, 'server', '.env');
if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 5000;

// Helper to resolve network Wi-Fi/LAN IPv4 addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Filter for IPv4 non-internal addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ name, address: iface.address });
      }
    }
  }
  return addresses;
}

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/config', configRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const ips = getLocalIpAddresses();
  res.json({
    status: 'running',
    message: 'AesthetiCore Music Server',
    wifiEndpoints: ips.map(ip => `http://${ip.address}:${PORT}`)
  });
});

// Serve built frontend static files if available
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // Single Page Application (SPA) fallback
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>AesthetiCore Music Server</title>
          <style>
            body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; text-align: center; }
            .card { background: #1e293b; padding: 2rem; border-radius: 12px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
            code { background: #334155; padding: 0.2rem 0.5rem; border-radius: 4px; color: #38bdf8; }
            h1 { color: #38bdf8; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🎵 AesthetiCore Music Backend Server</h1>
            <p>API endpoints are active and listening on your Wi-Fi network!</p>
            <p>To serve the full user interface on this port, build the app first:</p>
            <p><code>npm run build</code></p>
            <p>Or run <code>npm run dev</code> for Vite live development mode.</p>
          </div>
        </body>
      </html>
    `);
  });
}

// Start Server listening on 0.0.0.0 (All IP interfaces)
app.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalIpAddresses();

  console.log('\n================================================================');
  console.log('🎵  AESTHETICORE MUSIC SERVER (SAME WI-FI / LAN ACCESS ENABLED)');
  console.log('================================================================');
  console.log(`\n💻 Local Access (This Machine):`);
  console.log(`   👉 http://localhost:${PORT}`);

  if (localIps.length > 0) {
    console.log(`\n📱 Same Wi-Fi / Local Network Access (Other Devices):`);
    localIps.forEach(ip => {
      console.log(`   👉 http://${ip.address}:${PORT}  (${ip.name})`);
    });
  } else {
    console.log(`\n⚠️  No active Wi-Fi / LAN network interfaces detected.`);
  }

  console.log('\n----------------------------------------------------------------');
  console.log('💡 INSTRUCTIONS FOR WI-FI USERS ON OTHER DEVICES:');
  console.log(' 1. Connect your phone/tablet/laptop to the SAME Wi-Fi as this PC.');
  console.log(' 2. Open any web browser on your phone.');
  if (localIps.length > 0) {
    console.log(` 3. Enter URL: http://${localIps[0].address}:${PORT}`);
  }
  console.log(' 4. Enjoy full music streaming across devices!');
  console.log('================================================================\n');
});
