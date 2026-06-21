import express from 'express';
import ytpl from '@distube/ytpl';
import ytsr from '@distube/ytsr';
import ytdl from '@distube/ytdl-core';

const router = express.Router();

// Extract playlist ID from various YouTube URL formats
const extractPlaylistId = (url) => {
  try {
    const urlObj = new URL(url);
    // Handle youtube.com, music.youtube.com, youtu.be
    const listParam = urlObj.searchParams.get('list');
    if (listParam) return listParam;
  } catch (e) {
    // Not a valid URL — treat as raw playlist ID
  }
  return url;
};

// Import Playlist by URL
router.get('/playlist', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Playlist URL is required' });

  const playlistId = extractPlaylistId(url);
  console.log(`[YouTube] Fetching playlist: ${playlistId}`);

  try {
    const playlist = await ytpl(playlistId, { limit: 100 });

    if (!playlist || !playlist.items || playlist.items.length === 0) {
      return res.status(404).json({ error: 'Playlist not found or is empty' });
    }

    const tracks = playlist.items.map(item => ({
      id: item.id,
      title: cleanTitle(item.title || 'Unknown'),
      artist: (item.author?.name || 'Unknown Artist').replace(' - Topic', ''),
      thumbnail: item.bestThumbnail?.url || item.thumbnails?.[0]?.url || '',
      source: 'youtube',
      duration: item.durationSec || 0
    }));

    console.log(`[YouTube] Found ${tracks.length} tracks in "${playlist.title}"`);

    res.json({
      title: playlist.title || 'YouTube Playlist',
      description: playlist.description || '',
      thumbnail: playlist.bestThumbnail?.url || (tracks[0]?.thumbnail || ''),
      tracks
    });
  } catch (error) {
    console.error('[YouTube] Error fetching playlist:', error.message);
    res.status(500).json({ error: 'Failed to fetch playlist: ' + error.message });
  }
});

// Search YouTube
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Search query is required' });

  try {
    const searchResults = await ytsr(q + ' music', { limit: 15 });

    const results = searchResults.items
      .filter(item => item.type === 'video')
      .map(item => ({
        id: item.id,
        title: cleanTitle(item.name || 'Unknown'),
        artist: (item.author?.name || 'Unknown Artist').replace(' - Topic', ''),
        thumbnail: item.bestThumbnail?.url || item.thumbnails?.[0]?.url || '',
        source: 'youtube',
        duration: parseDuration(item.duration)
      }));

    res.json(results);
  } catch (error) {
    console.error('[YouTube] Error searching:', error.message);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
});

// Stream YouTube Video Audio
router.get('/stream', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Video ID is required' });

  console.log(`[YouTube] Resolving stream for video: ${videoId}`);

  try {
    const info = await ytdl.getInfo(videoId);
    const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
    
    if (!format || !format.url) {
      return res.status(404).json({ error: 'No audio format found' });
    }

    // Redirect to the direct stream URL on YouTube CDN
    res.redirect(format.url);
  } catch (error) {
    console.error('[YouTube] Stream resolution failed:', error.message);
    res.status(500).json({ error: 'Failed to resolve stream URL' });
  }
});

// Parse "3:45" duration string to seconds
function parseDuration(str) {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

// Clean HTML entities
function cleanTitle(title) {
  return title
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export default router;
