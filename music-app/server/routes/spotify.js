import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// Helper to check if credentials are set and configure spotifyApi dynamically
const checkCredentials = (req, res, next) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret || 
      clientId.includes('your_') || clientSecret.includes('your_') ||
      clientId.includes('placeholder') || clientSecret.includes('placeholder')) {
    return res.status(400).json({ 
      error: 'Spotify Client ID & Client Secret are not configured. Please click the Settings gear icon in the app, enter your Spotify Developer credentials, and click Save.' 
    });
  }

  // Update spotifyApi dynamically with current environment variables
  spotifyApi.setClientId(clientId);
  spotifyApi.setClientSecret(clientSecret);
  if (process.env.SPOTIFY_REDIRECT_URI) {
    spotifyApi.setRedirectUri(process.env.SPOTIFY_REDIRECT_URI);
  }

  next();
};

// 1. Get Login URL
router.get('/login', checkCredentials, (req, res) => {
  const scopes = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    'user-top-read',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming'
  ];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  res.json({ url: authorizeURL });
});

// 2. Callback
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = data.body;

    // In a real app, you'd store these in a database linked to the user
    // For now, we'll send them back to the frontend to be stored in localStorage/Context
    res.redirect(`http://localhost:5173/spotify-callback?access_token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}`);
  } catch (error) {
    console.error('Error during Spotify callback:', error);
    res.redirect('http://localhost:5173/error?message=spotify_auth_failed');
  }
});

// 3. Refresh Token
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'Refresh token is required' });

  const tempApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    refreshToken: refresh_token
  });

  try {
    const data = await tempApi.refreshAccessToken();
    res.json({
      access_token: data.body.access_token,
      expires_in: data.body.expires_in
    });
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// 4. Import playlist using client credentials (no user login required)
router.get('/playlist', checkCredentials, async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Playlist URL or ID is required' });
  }

  let playlistId = url;
  try {
    const u = new URL(url);
    if (u.hostname === 'open.spotify.com' && u.pathname.startsWith('/playlist/')) {
      playlistId = u.pathname.split('/playlist/')[1].split('?')[0];
    }
  } catch (e) {
    // assume it's already an ID
  }

  try {
    const clientCreds = await spotifyApi.clientCredentialsGrant();
    const token = clientCreds.body.access_token;

    const tempApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    });
    tempApi.setAccessToken(token);

    const playlistData = await tempApi.getPlaylist(playlistId);
    const data = playlistData.body;

    const tracks = data.tracks.items
      .filter(item => item.track)
      .map(item => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map(a => a.name).join(', '),
        thumbnail: item.track.album.images[0]?.url || 'https://via.placeholder.com/300?text=No+Thumbnail',
        duration: Math.floor(item.track.duration_ms / 1000),
        source: 'spotify',
        uri: item.track.uri
      }));

    res.json({
      id: data.id,
      title: data.name,
      description: data.description || '',
      thumbnail: data.images[0]?.url || 'https://via.placeholder.com/300?text=No+Thumbnail',
      tracks
    });
  } catch (error) {
    console.error('Error importing Spotify playlist via client credentials:', error);
    res.status(500).json({ error: error.message || 'Failed to import Spotify playlist' });
  }
});

export default router;
