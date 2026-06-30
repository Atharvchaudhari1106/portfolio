import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function startBackendServerPlugin() {
  let serverProcess = null;
  return {
    name: 'start-backend-server',
    configureServer(server) {
      // Skip if backend is deployed on Render (not needed locally)
      if (process.env.SKIP_LOCAL_BACKEND === 'true') {
        console.log('⏭️  [Vite] Skipping local backend (using remote Render backend)');
        return;
      }

      console.log('🚀 [Vite] Starting backend server in server directory...');
      
      const serverDir = path.resolve(__dirname, 'server');
      
      // Spawn node index.js in the server directory
      serverProcess = spawn('node', ['index.js'], {
        cwd: serverDir,
        stdio: 'inherit',
        shell: true
      });

      serverProcess.on('error', (err) => {
        console.error('❌ [Vite] Failed to start backend server:', err);
      });

      // Kill the child process on exit
      process.on('exit', () => {
        if (serverProcess) {
          serverProcess.kill();
        }
      });

      process.on('SIGINT', () => {
        if (serverProcess) {
          serverProcess.kill();
        }
        process.exit();
      });

      process.on('SIGTERM', () => {
        if (serverProcess) {
          serverProcess.kill();
        }
        process.exit();
      });
    },
    closeBundle() {
      if (serverProcess) {
        serverProcess.kill();
      }
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    startBackendServerPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true
      },
      includeAssets: ['favicon.svg', 'logo.png'],
      manifest: {
        name: 'AesthetiCore Music',
        short_name: 'AesthetiCore',
        description: 'A premium music streaming experience.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  server: {
    open: true,
    host: true
  },
  base: './',
})
