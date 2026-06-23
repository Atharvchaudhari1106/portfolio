import express from 'express';
import axios from 'axios';
import ytsr from '@distube/ytsr';
import ytdl from '@distube/ytdl-core';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ytdlpPath = path.join(__dirname, '..', 'yt-dlp.exe');

const router = express.Router();

// Extract playlist ID from various YouTube & YouTube Music URL formats
const extractPlaylistId = (url) => {
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
};

// Import Playlist by URL
router.get('/playlist', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Playlist URL is required' });

  const playlistId = extractPlaylistId(url);
  console.log(`[YouTube] Fetching playlist: ${playlistId} using yt-dlp`);

  const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

  execFile(
    ytdlpPath,
    ['--dump-single-json', '--flat-playlist', '--playlist-end', '100', playlistUrl],
    { maxBuffer: 15 * 1024 * 1024 }, // 15MB buffer
    (error, stdout, stderr) => {
      if (error) {
        console.error('[YouTube] yt-dlp playlist fetch failed:', error.message, stderr);
        let errorMsg = 'Failed to fetch playlist';
        if (stderr.includes('The playlist does not exist') || stderr.includes('does not exist') || error.message.includes('does not exist')) {
          errorMsg = 'The playlist does not exist or is private. If it is your playlist, please change its visibility to Public or Unlisted in YouTube/YouTube Music settings.';
        } else if (stderr.includes('404')) {
          errorMsg = 'Playlist not found (404). Check the URL/ID.';
        }
        return res.status(404).json({ error: errorMsg });
      }

      try {
        const data = JSON.parse(stdout);
        const tracks = (data.entries || [])
          .filter(entry => entry && entry.id)
          .map(entry => {
            const thumbnail = entry.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
            return {
              id: entry.id,
              title: entry.title || 'Unknown',
              artist: entry.uploader || entry.channel || data.uploader || data.channel || 'YouTube',
              thumbnail: thumbnail,
              duration: entry.duration || 0,
              source: 'youtube'
            };
          });

        const playlistThumbnail = data.thumbnails?.[0]?.url || (tracks[0]?.thumbnail || 'https://via.placeholder.com/300?text=No+Thumbnail');

        res.json({
          title: data.title || 'YouTube Playlist',
          description: data.description || '',
          thumbnail: playlistThumbnail,
          tracks
        });
      } catch (err) {
        console.error('[YouTube] Failed to parse yt-dlp output:', err.message);
        res.status(500).json({ error: 'Failed to parse playlist data: ' + err.message });
      }
    }
  );
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

  console.log(`[YouTube] Resolving stream for video: ${videoId} using yt-dlp`);

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  execFile(
    ytdlpPath,
    ['--js-runtime', 'node', '-f', 'ba', '-g', videoUrl],
    (error, stdout, stderr) => {
      if (error) {
        console.error('[YouTube] yt-dlp resolution failed:', error.message, stderr);
        return res.status(500).json({ error: 'Failed to resolve stream URL' });
      }

      const streamUrl = stdout.trim();
      if (!streamUrl) {
        return res.status(404).json({ error: 'No stream URL returned' });
      }

      // Redirect to the direct stream URL on YouTube CDN
      res.redirect(streamUrl);
    }
  );
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
