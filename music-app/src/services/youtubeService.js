import axios from 'axios';

const API_URL = `http://${window.location.hostname}:5000/api/youtube`;

/** Extract the playlist ID from various YouTube / YT Music URL formats. */
function extractPlaylistId(url) {
  try {
    const u = new URL(url);
    const list = u.searchParams.get('list');
    if (list) return list;
  } catch {
    // not a URL — assume it's a raw playlist ID
  }
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
    throw new Error(err.response?.data?.error || 'Failed to import YouTube playlist');
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
