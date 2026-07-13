import express from 'express';
import axios from 'axios';
import ytsr from '@distube/ytsr';
import ytdl from '@distube/ytdl-core';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';
import { Innertube } from 'youtubei.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use local .exe on Windows, check downloaded binary or system path on Linux (Render)
const localYtdlpPath = path.join(__dirname, '..', 'yt-dlp');
const ytdlpPath = os.platform() === 'win32'
  ? path.join(__dirname, '..', 'yt-dlp.exe')
  : (fs.existsSync(localYtdlpPath) ? localYtdlpPath : 'yt-dlp');

const router = express.Router();

let ytInstance = null;
async function getYTInstance() {
  if (!ytInstance) {
    console.log('[YouTube] Initializing Innertube instance...');
    ytInstance = await Innertube.create();
  }
  return ytInstance;
}

async function resolveYTStream(videoId) {
  // Try yt-dlp first (since we just downloaded the official binary and it is extremely reliable)
  try {
    console.log(`[YouTube] Resolving stream for video: ${videoId} using yt-dlp`);
    return await new Promise((resolve, reject) => {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      execFile(
        ytdlpPath,
        [
          '--js-runtimes', 'node',
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          '-f', 'ba',
          '-g', videoUrl
        ],
        { timeout: 30000 },
        (error, stdout, stderr) => {
          if (error) {
            return reject(error);
          }
          const url = stdout.trim();
          if (!url) {
            return reject(new Error('No stream URL returned by yt-dlp'));
          }
          resolve(url);
        }
      );
    });
  } catch (err) {
    console.warn('[YouTube] yt-dlp resolution failed, trying youtubei.js fallback:', err.message);
  }

  // Fallback to youtubei.js
  try {
    console.log(`[YouTube] Resolving stream for video: ${videoId} using youtubei.js`);
    const yt = await getYTInstance();
    const info = await yt.getInfo(videoId);
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    if (format) {
      let url = format.url;
      if (!url && typeof format.decipher === 'function') {
        url = await format.decipher(yt.session.player);
      }
      if (url) {
        console.log(`[YouTube] youtubei.js resolved stream successfully: ${url.slice(0, 50)}...`);
        return url;
      }
    }
    console.warn('[YouTube] youtubei.js did not return a valid audio format');
  } catch (err) {
    console.warn('[YouTube] youtubei.js resolution failed, trying ytdl-core:', err.message);
  }

  // Fallback to ytdl-core
  console.log(`[YouTube] Resolving stream for video: ${videoId} using ytdl-core`);
  const info = await ytdl.getInfo(videoId);
  // Filter for audio formats manually to avoid chooseFormat throw
  const formats = ytdl.filterFormats(info.formats, 'audioonly');
  if (formats.length === 0) {
    throw new Error('No audio formats found in ytdl-core fallback');
  }
  const format = formats[0];
  if (format && format.url) {
    console.log(`[YouTube] ytdl-core resolved stream successfully`);
    return format.url;
  }
  throw new Error('No stream URL found in ytdl-core formats');
}

// ─── In-Memory Stream Cache (TTL: 2 hours) ─────────────────────
const streamCache = new Map();
const STREAM_CACHE_TTL = 2 * 60 * 60 * 1000;

function getCachedStream(videoId) {
  const entry = streamCache.get(videoId);
  if (entry && Date.now() - entry.timestamp < STREAM_CACHE_TTL) {
    return entry.url;
  }
  streamCache.delete(videoId);
  return null;
}

function setCachedStream(videoId, url) {
  // Limit cache size
  if (streamCache.size > 500) {
    const oldest = streamCache.keys().next().value;
    streamCache.delete(oldest);
  }
  streamCache.set(videoId, { url, timestamp: Date.now() });
}

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

// Import Playlist by URL — with better error handling
router.get('/playlist', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Playlist URL is required' });

  const playlistId = extractPlaylistId(url);
  console.log(`[YouTube] Fetching playlist: ${playlistId} using yt-dlp`);

  const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

  execFile(
    ytdlpPath,
    ['--dump-single-json', '--flat-playlist', '--playlist-end', '10000', playlistUrl],
    { maxBuffer: 25 * 1024 * 1024, timeout: 60000 }, // 25MB buffer, 60s timeout
    (error, stdout, stderr) => {
      if (error) {
        console.error('[YouTube] yt-dlp playlist fetch failed:', error.message, stderr);
        let errorMsg = 'Failed to fetch playlist';
        let statusCode = 500;
        
        if (stderr.includes('The playlist does not exist') || stderr.includes('does not exist') || error.message.includes('does not exist')) {
          errorMsg = 'The playlist does not exist or is private. If it is your playlist, please change its visibility to Public or Unlisted in YouTube/YouTube Music settings.';
          statusCode = 404;
        } else if (stderr.includes('404')) {
          errorMsg = 'Playlist not found (404). Check the URL/ID.';
          statusCode = 404;
        } else if (error.killed || stderr.includes('timed out')) {
          errorMsg = 'Playlist fetch timed out. The playlist might be too large. Try a playlist with fewer than 200 tracks.';
          statusCode = 408;
        } else if (stderr.includes('HTTP Error 429') || stderr.includes('Too Many Requests')) {
          errorMsg = 'YouTube rate limit hit. Please wait a minute and try again.';
          statusCode = 429;
        } else if (stderr.includes('Sign in') || stderr.includes('age-restricted')) {
          errorMsg = 'This playlist contains age-restricted content. Try a different playlist.';
          statusCode = 403;
        }
        
        return res.status(statusCode).json({ error: errorMsg, errorType: statusCode === 404 ? 'not_found' : statusCode === 429 ? 'rate_limit' : 'server_error' });
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

        console.log(`[YouTube] Successfully fetched ${tracks.length} tracks from "${data.title}"`);

        res.json({
          title: data.title || 'YouTube Playlist',
          description: data.description || '',
          thumbnail: playlistThumbnail,
          trackCount: tracks.length,
          tracks
        });
      } catch (err) {
        console.error('[YouTube] Failed to parse yt-dlp output:', err.message);
        res.status(500).json({ error: 'Failed to parse playlist data: ' + err.message });
      }
    }
  );
});

function findVideoRenderers(obj, results = []) {
  if (!obj || typeof obj !== 'object') return results;
  
  if (obj.videoRenderer) {
    results.push(obj.videoRenderer);
    // Don't recurse deeper into this branch to avoid duplicate matches
    return results;
  }
  
  for (const key of Object.keys(obj)) {
    findVideoRenderers(obj[key], results);
  }
  
  return results;
}

async function fallbackSearchYoutube(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' music')}&sp=EgIQAQ%253D%253D`;
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    timeout: 10000
  });

  const html = response.data;
  
  // Industrial-grade brace counter parser for ytInitialData
  let data = null;
  const startIdx = html.indexOf('ytInitialData = ');
  if (startIdx !== -1) {
    try {
      const contentStart = html.indexOf('{', startIdx);
      let dataStr = '';
      let braceCount = 0;
      let inString = false;
      let escaped = false;
      
      for (let i = contentStart; i < html.length; i++) {
        const char = html[i];
        dataStr += char;
        if (char === '"' && !escaped) {
          inString = !inString;
        }
        if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') {
            braceCount--;
            if (braceCount === 0) break;
          }
        }
        escaped = (char === '\\' && !escaped);
      }
      data = JSON.parse(dataStr);
    } catch (e) {
      console.warn('[YouTube] Brace-counter HTML parser failed:', e.message);
    }
  }

  // Fallback to regex if brace counter failed
  if (!data) {
    const regex = /ytInitialData\s*=\s*({.+?});/;
    const match = html.match(regex);
    if (!match) throw new Error('Could not find ytInitialData in response');
    data = JSON.parse(match[1]);
  }
  
  const videoRenderers = findVideoRenderers(data);
  if (videoRenderers.length === 0) throw new Error('No video items found in ytInitialData');

  const results = [];
  for (const video of videoRenderers) {
    const id = video.videoId;
    if (!id) continue;

    const title = video.title?.runs?.[0]?.text || '';
    const artist = video.ownerText?.runs?.[0]?.text || 'Unknown Artist';
    const thumbnail = video.thumbnail?.thumbnails?.[0]?.url || '';
    
    const durationText = video.lengthText?.simpleText || '';
    const duration = parseDuration(durationText);

    results.push({
      id,
      title: cleanTitle(title),
      artist: artist.replace(' - Topic', ''),
      thumbnail,
      source: 'youtube',
      duration
    });
  }
  return results;
}

// Search YouTube
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Search query is required' });

  // 1. Try official YouTube Data API first if a valid key is present (starts with AIzaSy and is 39 chars long)
  const apiKey = process.env.YOUTUBE_API_KEY;
  const isRealApiKey = apiKey && apiKey.startsWith('AIzaSy') && apiKey.length === 39;
  if (isRealApiKey) {
    try {
      console.log(`[YouTube] Performing official API search for: "${q}"`);
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: q + ' music',
          type: 'video',
          maxResults: 15,
          key: apiKey
        }
      });
      const items = response.data.items || [];
      const results = items
        .filter(item => item.id && item.id.videoId)
        .map(item => ({
          id: item.id.videoId,
          title: cleanTitle(item.snippet.title),
          artist: cleanTitle(item.snippet.channelTitle).replace(' - Topic', ''),
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
          source: 'youtube',
          duration: 0
        }));
      if (results.length > 0) {
        return res.json(results);
      }
    } catch (apiError) {
      console.warn('[YouTube] Official search API failed, falling back to scrapers:', apiError.message);
    }
  } else {
    console.log('[YouTube] YouTube API key is missing or dummy. Skipping official API search.');
  }

  // 2. Try the custom fast working HTML scraper first (it is highly reliable and fast)
  try {
    console.log(`[YouTube] Performing custom HTML scraper search for: "${q}"`);
    const results = await fallbackSearchYoutube(q);
    if (results && results.length > 0) {
      return res.json(results);
    }
    throw new Error('Custom HTML scraper returned empty results');
  } catch (error) {
    console.warn('[YouTube] Custom HTML scraper failed, trying ytsr scraper:', error.message);
    // 3. Fallback to ytsr scraper
    try {
      console.log(`[YouTube] Performing ytsr scraper search for: "${q}"`);
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
    } catch (fallbackError) {
      console.error('[YouTube] All search methods failed:', fallbackError.message);
      res.status(500).json({ error: 'Failed to search YouTube' });
    }
  }
});

router.get('/stream', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Video ID is required' });

  try {
    let streamUrl = getCachedStream(videoId);
    if (!streamUrl) {
      streamUrl = await resolveYTStream(videoId);
      setCachedStream(videoId, streamUrl);
    }

    console.log(`[YouTube] Redirecting stream for video: ${videoId}`);

    // Redirect the browser to the direct YouTube CDN URL.
    // This is critical for deployed environments (Render, etc.) where
    // proxying fails because YouTube blocks cloud server IPs.
    // The browser (with a residential IP) fetches audio directly.
    res.redirect(302, streamUrl);
  } catch (err) {
    console.error('[YouTube] Stream resolution failed:', err.message);
    res.status(500).json({ error: err.message || 'Failed to resolve audio stream' });
  }
});

// Return the raw stream URL as JSON (for clients that need to set <audio> src directly)
router.get('/stream-url', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Video ID is required' });

  try {
    let streamUrl = getCachedStream(videoId);
    if (!streamUrl) {
      streamUrl = await resolveYTStream(videoId);
      setCachedStream(videoId, streamUrl);
    }

    console.log(`[YouTube] Returning stream URL for video: ${videoId}`);
    res.json({ streamUrl });
  } catch (err) {
    console.error('[YouTube] Stream URL resolution failed:', err.message);
    res.status(500).json({ error: err.message || 'Failed to resolve audio stream' });
  }
});

// Batch stream resolution (for playlist pre-loading)
router.post('/batch-stream', async (req, res) => {
  const { videoIds } = req.body;
  if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ error: 'videoIds array is required' });
  }

  // Limit to 10 at a time
  const ids = videoIds.slice(0, 10);
  const results = {};

  for (const videoId of ids) {
    // Check cache
    const cached = getCachedStream(videoId);
    if (cached) {
      results[videoId] = { streamUrl: cached, cached: true };
      continue;
    }

    try {
      const streamUrl = await resolveYTStream(videoId);
      setCachedStream(videoId, streamUrl);
      results[videoId] = { streamUrl, cached: false };
    } catch (err) {
      results[videoId] = { error: err.message };
    }
  }

  res.json(results);
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

// Pre-initialize Innertube at startup in the background
getYTInstance().catch(err => console.error('[YouTube] Pre-initialize Innertube failed:', err.message));

export default router;
