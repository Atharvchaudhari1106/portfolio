import axios from 'axios';
import { getBackendUrl } from '../utils/api';

// Use a function to always get the current backend URL (avoids stale cached URL)
const getApiUrl = () => `${getBackendUrl()}/api/youtube`;

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
 * Resolve a direct YouTube audio CDN URL via the backend /stream-url endpoint.
 * Returns the raw CDN URL (e.g., https://rr5---sn-...googlevideo.com/...).
 * Returns null if the backend can't resolve it.
 */
export async function resolveDirectStreamUrl(videoId) {
  if (!videoId) return null;
  try {
    const response = await axios.get(`${getApiUrl()}/stream-url`, {
      params: { videoId },
      timeout: 35000
    });
    if (response.data?.streamUrl) {
      return response.data.streamUrl;
    }
    return null;
  } catch (err) {
    console.warn('[YT] /stream-url failed:', err.message);
    return null;
  }
}

/**
 * Fetch an audio stream URL for a YouTube video.
 * Tries the /stream-url endpoint first (returns a direct CDN URL).
 * Falls back to the /stream endpoint (server-side redirect to CDN).
 */
export async function getYoutubeAudioStream(videoId) {
  if (!videoId) return null;

  // Try to get the direct CDN URL first
  const directUrl = await resolveDirectStreamUrl(videoId);
  if (directUrl) {
    console.log('[YT] Got direct CDN URL for', videoId);
    return directUrl;
  }

  // Fallback: the /stream endpoint which does a 302 redirect
  console.log('[YT] Falling back to redirect-based /stream for', videoId);
  return `${getApiUrl()}/stream?videoId=${videoId}`;
}

/**
 * Import a YouTube playlist by URL (or raw playlist ID).
 * Returns { title, description, thumbnail, tracks[] }.
 */
export const importYoutubePlaylist = async (playlistUrl) => {
  const playlistId = extractPlaylistId(playlistUrl);
  
  try {
    const response = await axios.get(`${getApiUrl()}/playlist`, {
      params: { url: playlistId },
      timeout: 45000
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
    const response = await axios.get(`${getApiUrl()}/search`, {
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

/**
 * Build the backend stream redirect URL for a given video ID.
 * This is the fallback URL that does a 302 redirect to the CDN.
 */
export const getStreamRedirectUrl = (videoId) => {
  return `${getApiUrl()}/stream?videoId=${videoId}`;
};
