import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const router = express.Router();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

async function scrapeSpotifyEntity(entityType, entityId) {
  const url = `https://open.spotify.com/embed/${entityType}/${entityId}`;
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    timeout: 10000
  });

  const html = response.data;
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Could not parse public entity page');

  const parsedData = JSON.parse(match[1]);
  const entity = parsedData.props?.pageProps?.state?.data?.entity;
  if (!entity || !entity.trackList || !Array.isArray(entity.trackList)) {
    throw new Error('Invalid playlist/album data on public page');
  }

  const title = entity.name || (entityType === 'album' ? 'Spotify Album' : 'Spotify Playlist');
  const description = entity.subtitle || '';
  const thumbnail = entity.coverArt?.sources?.[0]?.url || 'https://via.placeholder.com/300?text=Spotify+Artwork';
  
  const tracks = entity.trackList.map(track => {
    const trackId = track.uri?.split(':').pop() || track.uid;
    return {
      id: trackId,
      title: track.title || 'Unknown Title',
      artist: track.subtitle || 'Unknown Artist',
      thumbnail: thumbnail, // Fallback to playlist/album thumbnail
      duration: Math.floor((track.duration || 0) / 1000),
      source: 'spotify',
      uri: track.uri
    };
  });

  return {
    id: entity.id || entityId,
    title,
    description,
    thumbnail,
    trackCount: tracks.length,
    tracks
  };
}

// Helper to check if credentials are set and configure spotifyApi dynamically
const checkCredentials = (req, res, next) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret || 
      clientId.includes('your_') || clientSecret.includes('your_') ||
      clientId.includes('placeholder') || clientSecret.includes('placeholder')) {
    return res.status(400).json({ 
      error: 'Spotify Client ID & Client Secret are not configured. Please click the Settings gear icon in the app, enter your Spotify Developer credentials, and click Save.',
      errorType: 'auth_missing'
    });
  }

  // Update spotifyApi dynamically with current environment variables
  spotifyApi.setClientId(clientId);
  spotifyApi.setClientSecret(clientSecret);
  if (process.env.SPOTIFY_REDIRECT_URI) {
    spotifyApi.setRedirectURI(process.env.SPOTIFY_REDIRECT_URI);
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

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/spotify-callback?access_token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}`);
  } catch (error) {
    console.error('Error during Spotify callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/error?message=spotify_auth_failed`);
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

// 4. Import playlist using client credentials — WITH PAGINATION for large playlists
router.get('/playlist', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Playlist URL or ID is required' });
  }

  // Extract playlist ID from URL
  let playlistId = url.trim();
  try {
    const spotifyUriMatch = playlistId.match(/spotify:playlist:([a-zA-Z0-9]+)/);
    if (spotifyUriMatch) {
      playlistId = spotifyUriMatch[1];
    } else {
      const urlMatch = playlistId.match(/\/playlist\/([a-zA-Z0-9]+)/);
      if (urlMatch && urlMatch[1]) {
        playlistId = urlMatch[1];
      }
    }
  } catch (e) {
    // assume it's already an ID
  }

  console.log(`[Spotify] Attempting public scrape for playlist: ${playlistId}`);

  try {
    const scraped = await scrapeSpotifyEntity('playlist', playlistId);
    return res.json(scraped);
  } catch (scrapeError) {
    console.warn(`[Spotify] Public scrape failed for playlist ${playlistId}, falling back to API:`, scrapeError.message);
  }

  // API Fallback (Only runs if client has configured Developer credentials)
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret || 
      clientId.includes('your_') || clientSecret.includes('your_') ||
      clientId.includes('placeholder') || clientSecret.includes('placeholder')) {
    return res.status(400).json({ 
      error: 'Failed to import playlist publicly, and Spotify Developer Credentials are not configured in settings.',
      errorType: 'auth_missing'
    });
  }

  // Configure api client with current credentials
  spotifyApi.setClientId(clientId);
  spotifyApi.setClientSecret(clientSecret);

  try {
    const clientCreds = await spotifyApi.clientCredentialsGrant();
    const token = clientCreds.body.access_token;

    const tempApi = new SpotifyWebApi({
      clientId,
      clientSecret
    });
    tempApi.setAccessToken(token);

    // Get playlist metadata first
    const playlistData = await tempApi.getPlaylist(playlistId, { fields: 'id,name,description,images,tracks.total' });
    const meta = playlistData.body;
    const totalTracks = meta.tracks.total;

    console.log(`[Spotify] Playlist "${meta.name}" has ${totalTracks} tracks`);

    // Paginate to get ALL tracks
    const allTracks = [];
    const pageSize = 100;
    const maxPages = 100; // Allow up to 10,000 tracks

    for (let offset = 0; offset < totalTracks && offset < maxPages * pageSize; offset += pageSize) {
      try {
        const tracksPage = await tempApi.getPlaylistTracks(playlistId, {
          offset,
          limit: pageSize,
          fields: 'items(track(id,name,artists,album(images),duration_ms,uri))'
        });

        const pageTracks = tracksPage.body.items
          .filter(item => item.track && item.track.id)
          .map(item => ({
            id: item.track.id,
            title: item.track.name,
            artist: item.track.artists.map(a => a.name).join(', '),
            thumbnail: item.track.album.images[0]?.url || 'https://via.placeholder.com/300?text=No+Thumbnail',
            duration: Math.floor(item.track.duration_ms / 1000),
            source: 'spotify',
            uri: item.track.uri
          }));

        allTracks.push(...pageTracks);
      } catch (pageError) {
        break;
      }
    }

    res.json({
      id: meta.id,
      title: meta.name,
      description: meta.description || '',
      thumbnail: meta.images?.[0]?.url || 'https://via.placeholder.com/300?text=No+Thumbnail',
      trackCount: allTracks.length,
      tracks: allTracks
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to import playlist' });
  }
});

// 5. Import album by URL
router.get('/album', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Album URL or ID is required' });
  }

  let albumId = url.trim();
  try {
    const match = albumId.match(/\/album\/([a-zA-Z0-9]+)/);
    if (match && match[1]) albumId = match[1];
  } catch (e) {}

  console.log(`[Spotify] Attempting public scrape for album: ${albumId}`);

  try {
    const scraped = await scrapeSpotifyEntity('album', albumId);
    return res.json(scraped);
  } catch (scrapeError) {
    console.warn(`[Spotify] Public scrape failed for album ${albumId}, falling back to API:`, scrapeError.message);
  }

  // API Fallback
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret || 
      clientId.includes('your_') || clientSecret.includes('your_') ||
      clientId.includes('placeholder') || clientSecret.includes('placeholder')) {
    return res.status(400).json({ 
      error: 'Failed to import album publicly, and Spotify Developer Credentials are not configured in settings.',
      errorType: 'auth_missing'
    });
  }

  spotifyApi.setClientId(clientId);
  spotifyApi.setClientSecret(clientSecret);

  try {
    const clientCreds = await spotifyApi.clientCredentialsGrant();
    const tempApi = new SpotifyWebApi({
      clientId,
      clientSecret
    });
    tempApi.setAccessToken(clientCreds.body.access_token);

    const albumData = await tempApi.getAlbum(albumId);
    const album = albumData.body;

    const tracks = album.tracks.items.map(track => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      thumbnail: album.images[0]?.url || 'https://via.placeholder.com/300?text=No+Thumbnail',
      duration: Math.floor(track.duration_ms / 1000),
      source: 'spotify',
      uri: track.uri
    }));

    res.json({
      id: album.id,
      title: album.name,
      description: `Album by ${album.artists.map(a => a.name).join(', ')} • ${album.release_date}`,
      thumbnail: album.images[0]?.url || 'https://via.placeholder.com/300?text=No+Thumbnail',
      trackCount: tracks.length,
      tracks
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to import album' });
  }
});

export default router;
