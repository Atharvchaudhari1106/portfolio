import axios from 'axios';

const API_URL = 'http://localhost:5000/api/spotify';

export const getSpotifyLoginUrl = async () => {
  const response = await axios.get(`${API_URL}/login`, { timeout: 5000 });
  return response.data.url;
};

export const refreshSpotifyToken = async (refresh_token) => {
  const response = await axios.post(`${API_URL}/refresh`, { refresh_token }, { timeout: 5000 });
  return response.data;
};

export const getSpotifyPlaylists = async (access_token) => {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
      headers: { Authorization: `Bearer ${access_token}` },
      timeout: 10000
    });
    return response.data.items;
  } catch (err) {
    console.warn('Spotify playlists fetch failed:', err.message);
    return [];
  }
};

export const getSpotifyLikedSongs = async (access_token) => {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/tracks', {
      headers: { Authorization: `Bearer ${access_token}` },
      timeout: 10000
    });
    return response.data.items.map(item => ({
      id: item.track.id,
      title: item.track.name,
      artist: item.track.artists.map(a => a.name).join(', '),
      thumbnail: item.track.album.images[0]?.url,
      duration: Math.floor(item.track.duration_ms / 1000),
      source: 'spotify',
      uri: item.track.uri
    }));
  } catch (err) {
    console.warn('Spotify liked songs fetch failed:', err.message);
    return [];
  }
};

export const searchSpotify = async (query, access_token) => {
  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`, 
      {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 10000
      }
    );
    return response.data.tracks.items.map(track => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      thumbnail: track.album.images[0]?.url,
      duration: Math.floor(track.duration_ms / 1000),
      source: 'spotify',
      uri: track.uri
    }));
  } catch (err) {
    console.warn('Spotify search failed:', err.message);
    return [];
  }
};

export const extractSpotifyPlaylistId = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname === 'open.spotify.com' && u.pathname.startsWith('/playlist/')) {
      return u.pathname.split('/playlist/')[1].split('?')[0];
    }
  } catch {
    // maybe it's already an ID
  }
  return url;
};

export const importSpotifyPlaylist = async (url, access_token) => {
  try {
    const playlistId = extractSpotifyPlaylistId(url);
    const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${access_token}` },
      timeout: 10000
    });
    
    const data = response.data;
    const tracks = data.tracks.items
      .filter(item => item.track)
      .map(item => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map(a => a.name).join(', '),
        thumbnail: item.track.album.images[0]?.url,
        duration: Math.floor(item.track.duration_ms / 1000),
        source: 'spotify',
        uri: item.track.uri
      }));

    return {
      id: data.id,
      title: data.name,
      description: data.description || '',
      thumbnail: data.images[0]?.url || '',
      tracks
    };
  } catch (err) {
    console.warn('Spotify playlist import failed:', err.message);
    throw new Error('Failed to import Spotify playlist');
  }
};
