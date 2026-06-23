import axios from 'axios';
import { getBackendUrl } from '../utils/api';

const API_URL = `${getBackendUrl()}/api/youtube`;

/** Extract the playlist ID from various YouTube & YouTube Music URL formats. */
function extractPlaylistId(url) {
  if (!url) return '';
  url = url.trim();

  let testUrl = url;
  if (!/^https?:\/\//i.test(url)) {
    testUrl = 'https://' + url;
  }

  try {
    const urlObj = new URL(testUrl);

    // 1. Check for 'list' query parameter (common in standard YouTube / YT Music URLs)
    const listParam = urlObj.searchParams.get('list');
    if (listParam) return listParam;

    // 2. Check for browse path: /browse/VL<ID>
    if (urlObj.pathname.includes('/browse/VL')) {
      const match = urlObj.pathname.match(/\/browse\/VL([^?/]+)/);
      if (match && match[1]) return match[1];
    }
  } catch (e) {
    // Fallback to regex below
  }

  // Fallback regex matching
  const listRegex = /[&?]list=([^&]+)/;
  const listMatch = url.match(listRegex);
  if (listMatch && listMatch[1]) return listMatch[1];

  const browseRegex = /\/browse\/VL([^?/&]+)/;
  const browseMatch = url.match(browseRegex);
  if (browseMatch && browseMatch[1]) return browseMatch[1];

  return url;
}

/** Build the best thumbnail URL for a video. */
function bestThumbnail(videoId) {
  if (!videoId) return 'https://via.placeholder.com/300?text=No+Thumbnail';
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

/**
 * Fetch a direct audio stream URL for a YouTube video.
 * Returns a streamUrl (our backend proxy/redirect URL) that can be played with a standard <audio> element.
 */
export async function getYoutubeAudioStream(videoId) {
  if (!videoId) return null;
  // We return the backend stream endpoint which will redirect to the direct audio stream CDN URL
  return `${API_URL}/stream?videoId=${videoId}`;
}

/**
 * Import a YouTube playlist by URL (or raw playlist ID).
 * Returns { title, description, thumbnail, tracks[] }.
 */
export const importYoutubePlaylist = async (playlistUrl) => {
  const playlistId = extractPlaylistId(playlistUrl);
  
  try {
    const response = await axios.get(`${API_URL}/playlist`, {
      params: { url: playlistId },
      timeout: 15000
    });
    
    const data = response.data;
    if (!data || !data.tracks || data.tracks.length === 0) {
      throw new Error('Playlist not found or is empty.');
    }

    return {
      title: data.title || 'YouTube Playlist',
      description: data.description || '',
      thumbnail: data.thumbnail || bestThumbnail(data.tracks[0]?.id),
      tracks: data.tracks.map(t => ({
        ...t,
        thumbnail: t.thumbnail || bestThumbnail(t.id),
        source: 'youtube'
      }))
    };
  } catch (err) {
    console.error('YouTube playlist import failed:', err.message);
    throw new Error(err.response?.data?.error || err.message || 'Failed to import YouTube playlist');
  }
};

/**
 * Search YouTube for music.
 * Returns an array of track objects.
 */
export const searchYoutube = async (query) => {
  if (!query.trim()) return [];
  try {
    const response = await axios.get(`${API_URL}/search`, {
      params: { q: query },
      timeout: 10000
    });

    const results = response.data;
    if (!Array.isArray(results)) return [];

    return results.map(item => ({
      ...item,
      thumbnail: item.thumbnail || bestThumbnail(item.id),
      source: 'youtube'
    }));
  } catch (err) {
    console.warn('YouTube search unavailable:', err.message);
    return [];
  }
};

/**
 * Build a YouTube watch URL for a given video ID.
 */
export const getYoutubeStreamUrl = (videoId) => {
  return `https://www.youtube.com/watch?v=${videoId}`;
};
