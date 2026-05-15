/**
 * YouTube Service — fully client-side, no backend required.
 *
 * Uses the public Invidious API to fetch playlist data, search results,
 * and direct audio stream URLs. Multiple Invidious instances are tried
 * in order so the feature stays reliable even when individual instances
 * go down.
 */

// Ordered list of public Invidious instances (most reliable first).
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://iv.datura.network',
  'https://invidious.jing.rocks',
  'https://vid.puffyan.us',
  'https://invidious.snopyta.org',
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Try each Invidious instance until one succeeds. */
async function invidiousFetch(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const suffix = qs ? `?${qs}` : '';

  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const url = `${base}/api/v1${path}${suffix}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      // instance unreachable — try the next one
    }
  }
  throw new Error('All Invidious instances are currently unreachable. Please try again later.');
}

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
function bestThumbnail(video) {
  if (video.videoThumbnails && video.videoThumbnails.length > 0) {
    // Prefer medium quality (good size vs. speed trade-off)
    const medium = video.videoThumbnails.find(t => t.quality === 'medium');
    if (medium) return medium.url;
    return video.videoThumbnails[0].url;
  }
  // Fallback to standard YouTube thumbnail CDN
  return `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`;
}

/**
 * Fetch a direct audio stream URL for a YouTube video via Invidious.
 * Returns a streamUrl that can be played with a standard <audio> element.
 */
export async function getYoutubeAudioStream(videoId) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const url = `${base}/api/v1/videos/${videoId}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const data = await res.json();

      // Prefer adaptive audio formats (audio-only, best quality)
      if (data.adaptiveFormats && data.adaptiveFormats.length > 0) {
        // Sort audio streams: prefer m4a/mp4a (wider browser support), then by bitrate
        const audioStreams = data.adaptiveFormats
          .filter(f => f.type && f.type.startsWith('audio/'))
          .sort((a, b) => {
            // Prefer audio/mp4 (m4a) over webm for compatibility
            const aIsMp4 = a.type.includes('mp4') ? 1 : 0;
            const bIsMp4 = b.type.includes('mp4') ? 1 : 0;
            if (bIsMp4 !== aIsMp4) return bIsMp4 - aIsMp4;
            // Then by bitrate descending
            return (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0);
          });

        if (audioStreams.length > 0) {
          return audioStreams[0].url;
        }
      }

      // Fallback to legacy combined formats (video+audio)
      if (data.formatStreams && data.formatStreams.length > 0) {
        return data.formatStreams[0].url;
      }
    } catch {
      // try next instance
    }
  }
  return null;
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Import a YouTube playlist by URL (or raw playlist ID).
 * Returns { title, description, thumbnail, tracks[] }.
 *
 * Each track includes a `source: 'youtube'` field.
 * The `streamUrl` is resolved lazily when the track is played (see PlayerBar).
 */
export const importYoutubePlaylist = async (playlistUrl) => {
  const playlistId = extractPlaylistId(playlistUrl);

  const data = await invidiousFetch(`/playlists/${playlistId}`);

  if (!data || !data.videos || data.videos.length === 0) {
    throw new Error('Playlist not found or is empty.');
  }

  const tracks = data.videos.map(v => ({
    id: v.videoId,
    title: v.title || 'Unknown',
    artist: (v.author || 'Unknown Artist').replace(' - Topic', ''),
    thumbnail: bestThumbnail(v),
    source: 'youtube',
    duration: v.lengthSeconds || 0,
  }));

  return {
    title: data.title || 'YouTube Playlist',
    description: data.description || '',
    thumbnail: tracks[0]?.thumbnail || '',
    tracks,
  };
};

/**
 * Search YouTube for music.
 * Returns an array of track objects.
 */
export const searchYoutube = async (query) => {
  try {
    const results = await invidiousFetch('/search', {
      q: query + ' music',
      type: 'video',
      sort_by: 'relevance',
    });

    if (!Array.isArray(results)) return [];

    return results
      .filter(item => item.type === 'video')
      .slice(0, 15)
      .map(item => ({
        id: item.videoId,
        title: item.title || 'Unknown',
        artist: (item.author || 'Unknown Artist').replace(' - Topic', ''),
        thumbnail: bestThumbnail(item),
        source: 'youtube',
        duration: item.lengthSeconds || 0,
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
