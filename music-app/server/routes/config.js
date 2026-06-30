import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const getEnvFilePath = () => path.resolve(process.cwd(), '.env');

// Parse .env helper
const parseEnv = (content) => {
  const env = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] || '';
      // Remove surrounding quotes if any
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      } else if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
        value = value.substring(1, value.length - 1);
      }
      env[key] = value.trim();
    }
  }
  return env;
};

// Stringify env object back to file format
const stringifyEnv = (envObj) => {
  return Object.entries(envObj)
    .map(([key, val]) => `${key}=${val}`)
    .join('\n') + '\n';
};

// Helper to check if a value is set and is not a placeholder
const isConfigured = (value) => {
  if (!value) return false;
  const valLower = value.toLowerCase();
  return !valLower.includes('your_') && !valLower.includes('placeholder');
};

// GET current configuration status
router.get('/', (req, res) => {
  try {
    const envPath = getEnvFilePath();
    let env = {};
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      env = parseEnv(content);
    }

    const spotifyClientId = env.SPOTIFY_CLIENT_ID || '';
    const spotifyClientSecret = env.SPOTIFY_CLIENT_SECRET || '';
    const spotifyRedirectUri = env.SPOTIFY_REDIRECT_URI || '';
    const youtubeApiKey = env.YOUTUBE_API_KEY || '';

    res.json({
      spotifyClientId: isConfigured(spotifyClientId) ? spotifyClientId : '',
      spotifyClientSecretSet: isConfigured(spotifyClientSecret),
      spotifyRedirectUri: spotifyRedirectUri || 'http://localhost:5000/api/spotify/callback',
      youtubeApiKeySet: isConfigured(youtubeApiKey),
      isConfigured: isConfigured(spotifyClientId) && isConfigured(spotifyClientSecret)
    });
  } catch (error) {
    console.error('Failed to read config:', error);
    res.status(500).json({ error: 'Failed to read configuration' });
  }
});

// POST to update configuration
router.post('/', (req, res) => {
  const { spotifyClientId, spotifyClientSecret, spotifyRedirectUri, youtubeApiKey } = req.body;

  try {
    const envPath = getEnvFilePath();
    let env = {};
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      env = parseEnv(content);
    }

    // Update with new values if provided
    if (spotifyClientId !== undefined) env.SPOTIFY_CLIENT_ID = spotifyClientId.trim();
    if (spotifyClientSecret !== undefined) env.SPOTIFY_CLIENT_SECRET = spotifyClientSecret.trim();
    if (spotifyRedirectUri !== undefined) env.SPOTIFY_REDIRECT_URI = spotifyRedirectUri.trim();
    if (youtubeApiKey !== undefined) env.YOUTUBE_API_KEY = youtubeApiKey.trim();

    // Write back to .env
    const newContent = stringifyEnv(env);
    fs.writeFileSync(envPath, newContent, 'utf8');

    // Dynamically update process.env so server route configures immediately
    if (env.SPOTIFY_CLIENT_ID) process.env.SPOTIFY_CLIENT_ID = env.SPOTIFY_CLIENT_ID;
    if (env.SPOTIFY_CLIENT_SECRET) process.env.SPOTIFY_CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;
    if (env.SPOTIFY_REDIRECT_URI) process.env.SPOTIFY_REDIRECT_URI = env.SPOTIFY_REDIRECT_URI;
    if (env.YOUTUBE_API_KEY) process.env.YOUTUBE_API_KEY = env.YOUTUBE_API_KEY;

    res.json({ success: true, message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Failed to update config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// GET download Windows launcher
router.get('/download-launcher', (req, res) => {
  const launcherPath = path.resolve(process.cwd(), '..', 'Run-App.bat');
  if (fs.existsSync(launcherPath)) {
    res.download(launcherPath, 'Run-App.bat');
  } else {
    res.status(404).json({ error: 'Launcher script not found' });
  }
});

// GET download macOS/Linux launcher
router.get('/download-launcher-sh', (req, res) => {
  const launcherPath = path.resolve(process.cwd(), '..', 'Run-App.sh');
  if (fs.existsSync(launcherPath)) {
    res.download(launcherPath, 'Run-App.sh');
  } else {
    res.status(404).json({ error: 'Launcher script not found' });
  }
});

export default router;
