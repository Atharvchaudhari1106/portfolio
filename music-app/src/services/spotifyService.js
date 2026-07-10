import axios from 'axios';
import { getBackendUrl } from '../utils/api';

const getApiUrl = () => `${getBackendUrl()}/api/spotify`;

export const getSpotifyLoginUrl = async () => {
  const response = await axios.get(`${getApiUrl()}/login`, { timeout: 5000 });
  return response.data.url;
};

export const refreshSpotifyToken = async (refresh_token) => {
  const response = await axios.post(`${getApiUrl()}/refresh`, { refresh_token }, { timeout: 5000 });
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
    const match = url.match(/\/playlist\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch {
    // maybe it's already an ID
  }
  return url;
};

export const importSpotifyPlaylist = async (url) => {
  const isAlbum = url.includes('/album/');
  const endpoint = isAlbum ? '/album' : '/playlist';
  try {
    const response = await axios.get(`${getApiUrl()}${endpoint}`, {
      params: { url },
      timeout: 30000
    });
    return response.data;
  } catch (err) {
    console.warn(`Spotify import failed for ${isAlbum ? 'album' : 'playlist'}:`, err.message);
    throw new Error(err.response?.data?.error || err.message || `Failed to import Spotify ${isAlbum ? 'album' : 'playlist'}`);
  }
};
