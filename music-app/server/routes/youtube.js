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
    const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    const response = await axios.get(playlistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });

    const html = response.data;
    const match = html.match(/ytInitialData\s*=\s*({.+?});/);
    if (!match) {
      return res.status(404).json({ error: 'Could not find playlist data on YouTube' });
    }

    const data = JSON.parse(match[1]);
    const seenIds = new Set();
    const tracks = [];

    // Helper function to recursively search for video metadata structures
    function searchLockups(obj) {
      if (!obj || typeof obj !== 'object') return;

      if (obj.lockupViewModel) {
        const lv = obj.lockupViewModel;
        const id = lv.contentId;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          const title = lv.metadata?.lockupMetadataViewModel?.title?.content || 'Unknown';
          let artist = 'Unknown Artist';
          const metadataRows = lv.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows;
          if (metadataRows && metadataRows.length > 0) {
            const part = metadataRows[0].metadataParts?.[0];
            if (part?.text?.content) {
              artist = part.text.content.replace(' - Topic', '');
            }
          }
          const sources = lv.contentImage?.thumbnailViewModel?.image?.sources;
          let thumbnail = sources && sources.length > 0 ? sources[sources.length - 1].url : '';
          if (thumbnail) {
            thumbnail = thumbnail.split('?')[0];
          }

          let durationText = '';
          const overlays = lv.contentImage?.thumbnailViewModel?.overlays || [];
          for (const overlay of overlays) {
            const badge = overlay.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel;
            if (badge && badge.text) {
              durationText = badge.text;
              break;
            }
          }
          const duration = parseDuration(durationText);

          tracks.push({
            id,
            title: cleanTitle(title),
            artist,
            thumbnail,
            source: 'youtube',
            duration
          });
        }
      } else if (obj.playlistVideoRenderer) {
        const pvr = obj.playlistVideoRenderer;
        const id = pvr.videoId;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          const title = pvr.title?.runs?.[0]?.text || pvr.title?.simpleText || 'Unknown';
          const artist = (pvr.shortBylineText?.runs?.[0]?.text || pvr.author?.name || 'Unknown Artist').replace(' - Topic', '');
          const sources = pvr.thumbnail?.thumbnails;
          let thumbnail = sources && sources.length > 0 ? sources[sources.length - 1].url : '';
          if (thumbnail) {
            thumbnail = thumbnail.split('?')[0];
          }
          const duration = parseInt(pvr.lengthSeconds) || 0;

          tracks.push({
            id,
            title: cleanTitle(title),
            artist,
            thumbnail,
            source: 'youtube',
            duration
          });
        }
      } else {
        for (const key in obj) {
          searchLockups(obj[key]);
        }
      }
    }

    searchLockups(data);

    if (tracks.length === 0) {
      return res.status(404).json({ error: 'Playlist is empty or could not be parsed' });
    }

    const metadata = data.metadata?.playlistMetadataRenderer || {};
    const microformat = data.microformat?.microformatDataRenderer || {};

    const playlistTitle = microformat.title || metadata.title || 'YouTube Playlist';
    const playlistDescription = microformat.description || '';
    let playlistThumbnail = microformat.thumbnail?.thumbnails?.[0]?.url || (tracks[0]?.thumbnail || '');
    if (playlistThumbnail) {
      playlistThumbnail = playlistThumbnail.split('?')[0];
    }

    console.log(`[YouTube] Found ${tracks.length} tracks in "${playlistTitle}"`);

    res.json({
      title: playlistTitle,
      description: playlistDescription,
      thumbnail: playlistThumbnail,
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
