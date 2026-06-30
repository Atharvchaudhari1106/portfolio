/**
 * StreamResolver — Multi-tier audio stream resolution engine
 * 
 * Resolution chain:
 *   Tier 1: Direct stream URL (JioSaavn tracks already have one)
 *   Tier 2: JioSaavn fuzzy match (search "artist + title", score results)
 *   Tier 3: YouTube audio stream via backend yt-dlp
 *   Tier 4: YouTube search → stream (search "artist title official audio")
 * 
 * Features:
 *   - Fuzzy matching with Levenshtein distance + normalized scoring
 *   - Stream URL caching in localStorage with TTL
 *   - Automatic retry with exponential backoff
 *   - Progress callbacks for UI feedback
 */

import { searchMusic } from './musicService';
import { getYoutubeAudioStream, searchYoutube } from './youtubeService';

// ─── Cache Configuration ────────────────────────────────────────
const CACHE_KEY = 'stream_cache';
const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours in ms
const MAX_CACHE_SIZE = 200;

// ─── Levenshtein Distance (for fuzzy matching) ─────────────────
function levenshtein(a, b) {
  const matrix = [];
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  for (let i = 0; i <= bLen; i++) matrix[i] = [i];
  for (let j = 0; j <= aLen; j++) matrix[0][j] = j;

  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[bLen][aLen];
}

// ─── Normalize text for comparison ──────────────────────────────
function normalize(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\(.*?\)/g, '')       // remove parenthetical content
    .replace(/\[.*?\]/g, '')       // remove bracket content
    .replace(/feat\.?.*$/i, '')    // remove "feat." onwards
    .replace(/ft\.?.*$/i, '')      // remove "ft." onwards
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/[^\w\s]/g, '')       // remove special chars
    .replace(/\s+/g, ' ')         // collapse whitespace
    .trim();
}

// ─── Score a candidate match against target metadata ────────────
function scoreMatch(candidate, targetTitle, targetArtist, targetDuration) {
  const candTitle = normalize(candidate.title || '');
  const candArtist = normalize(candidate.artist || '');
  const normTitle = normalize(targetTitle);
  const normArtist = normalize(targetArtist);

  // Title similarity (0-1) using Levenshtein
  const titleMaxLen = Math.max(candTitle.length, normTitle.length, 1);
  const titleDist = levenshtein(candTitle, normTitle);
  const titleSim = 1 - (titleDist / titleMaxLen);

  // Artist similarity — check if any artist name appears in either field
  const targetArtists = normArtist.split(/[,&]/).map(a => a.trim()).filter(Boolean);
  const candArtists = candArtist.split(/[,&]/).map(a => a.trim()).filter(Boolean);
  
  let artistSim = 0;
  for (const ta of targetArtists) {
    for (const ca of candArtists) {
      const maxLen = Math.max(ta.length, ca.length, 1);
      const dist = levenshtein(ta, ca);
      const sim = 1 - (dist / maxLen);
      artistSim = Math.max(artistSim, sim);
    }
  }

  // Duration similarity (if available)
  let durationSim = 0.5; // neutral if unknown
  if (targetDuration && candidate.duration) {
    const diff = Math.abs(targetDuration - candidate.duration);
    durationSim = Math.max(0, 1 - (diff / 30)); // 30s tolerance
  }

  // Penalty for instrumentals, remixes, covers, karaoke
  let penalty = 0;
  const titleLower = (candidate.title || '').toLowerCase();
  const badKeywords = ['instrumental', 'karaoke', 'ringtone', 'bgm', 'background', 'cover', '8d audio', 'slowed', 'reverb'];
  for (const kw of badKeywords) {
    if (titleLower.includes(kw)) {
      penalty += 0.15;
    }
  }

  // Bonus for high play count (indicates original version)
  let playCountBonus = 0;
  if (candidate.playCount > 100000) playCountBonus = 0.05;
  if (candidate.playCount > 1000000) playCountBonus = 0.1;

  // Weighted composite score
  const score = (titleSim * 0.45) + (artistSim * 0.35) + (durationSim * 0.15) + playCountBonus - penalty + 0.05;
  
  return Math.max(0, Math.min(1, score));
}

// ─── Cache Management ───────────────────────────────────────────
function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const cache = JSON.parse(raw);
    // Prune expired entries
    const now = Date.now();
    const pruned = {};
    for (const [key, entry] of Object.entries(cache)) {
      if (now - entry.timestamp < CACHE_TTL) {
        pruned[key] = entry;
      }
    }
    return pruned;
  } catch {
    return {};
  }
}

function setCache(cache) {
  try {
    // Limit cache size
    const entries = Object.entries(cache);
    if (entries.length > MAX_CACHE_SIZE) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      cache = Object.fromEntries(entries.slice(0, MAX_CACHE_SIZE));
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage might be full
  }
}

function getCacheKey(track) {
  return `${normalize(track.title)}_${normalize(track.artist)}`;
}

function getCachedStream(track) {
  const cache = getCache();
  const key = getCacheKey(track);
  const entry = cache[key];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry;
  }
  return null;
}

function cacheStream(track, streamUrl, resolvedVia) {
  const cache = getCache();
  const key = getCacheKey(track);
  cache[key] = {
    streamUrl,
    resolvedVia,
    timestamp: Date.now()
  };
  setCache(cache);
}

// ─── Sleep utility for retry backoff ────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Tier 1: Direct Stream ──────────────────────────────────────
async function tryDirectStream(track) {
  if (track.streamUrl) {
    let url = track.streamUrl;
    if (url.includes('saavncdn.com')) {
      url = url.replace('https://', 'http://');
    }
    return { streamUrl: url, resolvedVia: 'direct' };
  }
  return null;
}

// ─── Tier 2: JioSaavn Fuzzy Match ───────────────────────────────
async function tryJioSaavnMatch(track) {
  const mainArtist = (track.artist || '').split(',')[0].trim();
  const query = `${mainArtist} ${track.title}`;
  
  try {
    const results = await searchMusic(query);
    if (!results || results.length === 0) return null;

    // Score all results
    const scored = results
      .filter(r => r.streamUrl) // Only candidates with stream URLs
      .map(r => ({
        ...r,
        matchScore: scoreMatch(r, track.title, track.artist, track.duration)
      }))
      .sort((a, b) => b.matchScore - a.matchScore);

    // Accept if score is above threshold
    if (scored.length > 0 && scored[0].matchScore > 0.4) {
      console.log(`[StreamResolver] JioSaavn match: "${scored[0].title}" (score: ${scored[0].matchScore.toFixed(2)})`);
      let url = scored[0].streamUrl;
      if (url.includes('saavncdn.com')) {
        url = url.replace('https://', 'http://');
      }
      return { streamUrl: url, resolvedVia: 'jiosaavn', matchScore: scored[0].matchScore };
    }
  } catch (err) {
    console.warn('[StreamResolver] JioSaavn search failed:', err.message);
  }
  return null;
}

// ─── Tier 3: YouTube Direct Stream ──────────────────────────────
async function tryYoutubeDirectStream(track) {
  if (track.source === 'youtube' && track.id) {
    try {
      const streamUrl = await getYoutubeAudioStream(track.id);
      if (streamUrl) {
        return { streamUrl, resolvedVia: 'youtube-direct' };
      }
    } catch (err) {
      console.warn('[StreamResolver] YouTube direct stream failed:', err.message);
    }
  }
  return null;
}

// ─── Tier 4: YouTube Search → Stream ────────────────────────────
async function tryYoutubeSearchStream(track) {
  const mainArtist = (track.artist || '').split(',')[0].trim();
  const query = `${mainArtist} ${track.title} official audio`;
  
  try {
    const results = await searchYoutube(query);
    if (!results || results.length === 0) return null;

    // Score and pick best match
    const scored = results
      .map(r => ({
        ...r,
        matchScore: scoreMatch(r, track.title, track.artist, track.duration)
      }))
      .sort((a, b) => b.matchScore - a.matchScore);

    if (scored.length > 0 && scored[0].matchScore > 0.25) {
      const streamUrl = await getYoutubeAudioStream(scored[0].id);
      if (streamUrl) {
        console.log(`[StreamResolver] YouTube search match: "${scored[0].title}" (score: ${scored[0].matchScore.toFixed(2)})`);
        return { streamUrl, resolvedVia: 'youtube-search', matchScore: scored[0].matchScore };
      }
    }
  } catch (err) {
    console.warn('[StreamResolver] YouTube search stream failed:', err.message);
  }
  return null;
}

// ─── Main Resolver ──────────────────────────────────────────────
/**
 * Resolve a playable stream URL for any track.
 * 
 * @param {Object} track - Track object with { id, title, artist, source, streamUrl?, duration? }
 * @param {Object} options
 * @param {Function} options.onProgress - Callback: (tier, message) => void
 * @param {AbortSignal} options.signal - AbortController signal for cancellation
 * @param {number} options.maxRetries - Max retry attempts (default: 2)
 * @returns {Promise<{ streamUrl: string, resolvedVia: string }>}
 */
export async function resolveStream(track, options = {}) {
  const { onProgress, signal, maxRetries = 2 } = options;

  if (!track) throw new Error('No track provided');

  // Check abort
  if (signal?.aborted) throw new Error('Aborted');

  // Check cache first
  const cached = getCachedStream(track);
  if (cached) {
    onProgress?.('cache', 'Using cached stream');
    return { streamUrl: cached.streamUrl, resolvedVia: `cache(${cached.resolvedVia})` };
  }

  const tiers = [
    { name: 'direct', label: 'Checking direct stream...', fn: tryDirectStream },
    { name: 'jiosaavn', label: 'Searching JioSaavn...', fn: tryJioSaavnMatch },
    { name: 'youtube-direct', label: 'Resolving YouTube stream...', fn: tryYoutubeDirectStream },
    { name: 'youtube-search', label: 'Searching YouTube...', fn: tryYoutubeSearchStream },
  ];

  // For non-YouTube, non-Spotify tracks (JioSaavn), try direct first
  // For Spotify tracks, skip direct (no streamUrl), go straight to JioSaavn match
  // For YouTube tracks, try direct YouTube stream first
  let orderedTiers;
  if (track.source === 'youtube') {
    orderedTiers = [tiers[0], tiers[2], tiers[1], tiers[3]]; // direct → yt-direct → saavn → yt-search
  } else if (track.source === 'spotify') {
    orderedTiers = [tiers[1], tiers[3], tiers[2]]; // saavn → yt-search → yt-direct
  } else {
    orderedTiers = tiers; // default order
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    for (const tier of orderedTiers) {
      if (signal?.aborted) throw new Error('Aborted');

      onProgress?.(tier.name, tier.label);

      try {
        const result = await tier.fn(track);
        if (result && result.streamUrl) {
          // Cache the successful result
          cacheStream(track, result.streamUrl, result.resolvedVia);
          return result;
        }
      } catch (err) {
        console.warn(`[StreamResolver] Tier ${tier.name} error:`, err.message);
      }
    }

    // If we haven't found anything and have retries left, wait and try again
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
      onProgress?.('retry', `Retrying in ${delay / 1000}s... (attempt ${attempt + 2}/${maxRetries + 1})`);
      await sleep(delay);
    }
  }

  throw new Error(`Could not resolve stream for "${track.title}" by ${track.artist}`);
}

/**
 * Batch resolve streams for multiple tracks (for playlist pre-loading)
 * Resolves concurrently with a concurrency limit.
 * 
 * @param {Array} tracks - Array of track objects
 * @param {Object} options
 * @param {Function} options.onTrackResolved - (index, result) => void
 * @param {Function} options.onTrackFailed - (index, error) => void
 * @param {number} options.concurrency - Max concurrent resolutions (default: 3)
 * @returns {Promise<Array<{ streamUrl, resolvedVia, error? }>>}
 */
export async function batchResolveStreams(tracks, options = {}) {
  const { onTrackResolved, onTrackFailed, concurrency = 3 } = options;
  const results = new Array(tracks.length).fill(null);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tracks.length) {
      const index = nextIndex++;
      const track = tracks[index];

      try {
        const result = await resolveStream(track, { maxRetries: 1 });
        results[index] = result;
        onTrackResolved?.(index, result);
      } catch (err) {
        results[index] = { error: err.message };
        onTrackFailed?.(index, err);
      }
    }
  }

  // Start workers
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, tracks.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}

/**
 * Clear the stream cache
 */
export function clearStreamCache() {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const cache = getCache();
  const entries = Object.entries(cache);
  const sources = {};
  for (const [, entry] of entries) {
    const via = entry.resolvedVia || 'unknown';
    sources[via] = (sources[via] || 0) + 1;
  }
  return {
    totalCached: entries.length,
    maxSize: MAX_CACHE_SIZE,
    bySource: sources
  };
}
