import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.js';
import spotifyRoutes from './routes/spotify.js';
import youtubeRoutes from './routes/youtube.js';
import musicRoutes from './routes/music.js';
import configRoutes from './routes/config.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/config', configRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'AesthetiCore Music API',
    endpoints: ['/api/spotify', '/api/youtube', '/api/auth', '/api/music']
  });
});

// MongoDB is optional — only connect if URI is properly configured
// (Removed mandatory mongoose import to prevent crash when no DB is needed)

app.listen(PORT, () => {
  console.log(`\n🎵 AesthetiCore Music Server running on http://localhost:${PORT}`);
  console.log(`   Spotify: ${process.env.SPOTIFY_CLIENT_ID ? '✅ Configured' : '❌ Not configured (set SPOTIFY_CLIENT_ID in .env)'}`);
  console.log(`   YouTube: ${process.env.YOUTUBE_API_KEY ? '✅ Configured' : '❌ Not configured (set YOUTUBE_API_KEY in .env)'}`);
  console.log('');
});
