/**
 * Analytics Service — Track user listening behavior for AI personalization
 * 
 * All data stays in localStorage — no cloud dependency.
 * Tracks: play events, skip events, completion rate, time-of-day patterns.
 */

const ANALYTICS_KEY = 'music_analytics';
const MAX_EVENTS = 500;

// ─── Event Types ────────────────────────────────────────────────
export const EventType = {
  PLAY: 'play',
  SKIP: 'skip',
  COMPLETE: 'complete',
  LIKE: 'like',
  UNLIKE: 'unlike',
  SEARCH: 'search',
  IMPORT_PLAYLIST: 'import_playlist'
};

// ─── Storage Helpers ────────────────────────────────────────────
function getAnalytics() {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    if (!raw) return { events: [], artistAffinity: {}, genreAffinity: {}, playCount: {}, skipCount: {} };
    const parsed = JSON.parse(raw) || {};
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      artistAffinity: parsed.artistAffinity || {},
      genreAffinity: parsed.genreAffinity || {},
      playCount: parsed.playCount || {},
      skipCount: parsed.skipCount || {}
    };
  } catch {
    return { events: [], artistAffinity: {}, genreAffinity: {}, playCount: {}, skipCount: {} };
  }
}

function saveAnalytics(data) {
  try {
    // Trim events to prevent localStorage from growing too large
    if (data.events.length > MAX_EVENTS) {
      data.events = data.events.slice(-MAX_EVENTS);
    }
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be full
  }
}

// ─── Track Events ───────────────────────────────────────────────
/**
 * Record a play event
 */
export function trackPlay(song) {
  if (!song) return;
  const data = getAnalytics();
  const hour = new Date().getHours();
  const day = new Date().getDay();

  data.events.push({
    type: EventType.PLAY,
    songId: song.id,
    title: song.title,
    artist: song.artist,
    source: song.source || 'jiosaavn',
    timestamp: Date.now(),
    hour,
    day
  });

  // Update play count
  data.playCount[song.id] = (data.playCount[song.id] || 0) + 1;

  // Update artist affinity
  const artists = (song.artist || '').split(',').map(a => a.trim());
  for (const artist of artists) {
    if (artist) {
      data.artistAffinity[artist] = (data.artistAffinity[artist] || 0) + 1;
    }
  }

  saveAnalytics(data);
}

/**
 * Record a skip event (user skipped before 30% of song played)
 */
export function trackSkip(song) {
  if (!song) return;
  const data = getAnalytics();

  data.events.push({
    type: EventType.SKIP,
    songId: song.id,
    title: song.title,
    artist: song.artist,
    timestamp: Date.now()
  });

  data.skipCount[song.id] = (data.skipCount[song.id] || 0) + 1;
  saveAnalytics(data);
}

/**
 * Record a song completion (listened to >80%)
 */
export function trackComplete(song) {
  if (!song) return;
  const data = getAnalytics();

  data.events.push({
    type: EventType.COMPLETE,
    songId: song.id,
    title: song.title,
    artist: song.artist,
    timestamp: Date.now()
  });

  saveAnalytics(data);
}

/**
 * Record a search event
 */
export function trackSearch(query) {
  if (!query) return;
  const data = getAnalytics();
  data.events.push({
    type: EventType.SEARCH,
    query,
    timestamp: Date.now(),
    hour: new Date().getHours()
  });
  saveAnalytics(data);
}

// ─── Analytics Queries ──────────────────────────────────────────

/**
 * Get top artists by play count
 */
export function getTopArtists(limit = 10) {
  const data = getAnalytics();
  return Object.entries(data.artistAffinity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([artist, count]) => ({ artist, count }));
}

/**
 * Get all known artist names (for spelling correction)
 */
export function getKnownArtists() {
  const data = getAnalytics();
  return Object.keys(data.artistAffinity);
}

/**
 * Get most played songs
 */
export function getMostPlayed(limit = 10) {
  const data = getAnalytics();
  return Object.entries(data.playCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([songId, count]) => ({ songId, count }));
}

/**
 * Get skip rate for a song (skips / total plays)
 */
export function getSkipRate(songId) {
  const data = getAnalytics();
  const plays = data.playCount[songId] || 0;
  const skips = data.skipCount[songId] || 0;
  if (plays === 0) return 0;
  return skips / plays;
}

/**
 * Get listening pattern by hour of day
 * Returns array of 24 values (0-23) representing play counts per hour
 */
export function getHourlyPattern() {
  const data = getAnalytics();
  const pattern = new Array(24).fill(0);

  for (const event of data.events) {
    if (event.type === EventType.PLAY && event.hour !== undefined) {
      pattern[event.hour]++;
    }
  }

  return pattern;
}

/**
 * Get recent play history (unique songs)
 */
export function getRecentPlays(limit = 20) {
  const data = getAnalytics();
  const seen = new Set();
  const recent = [];

  // Walk backwards through events
  for (let i = data.events.length - 1; i >= 0 && recent.length < limit; i--) {
    const event = data.events[i];
    if (event.type === EventType.PLAY && !seen.has(event.songId)) {
      seen.add(event.songId);
      recent.push({
        songId: event.songId,
        title: event.title,
        artist: event.artist,
        source: event.source,
        timestamp: event.timestamp
      });
    }
  }

  return recent;
}

/**
 * Get listening stats for display
 */
export function getListeningStats() {
  const data = getAnalytics();
  const playEvents = data.events.filter(e => e.type === EventType.PLAY);
  const uniqueSongs = new Set(playEvents.map(e => e.songId));
  const uniqueArtists = new Set();
  
  for (const event of playEvents) {
    if (event.artist) {
      const artists = event.artist.split(',').map(a => a.trim());
      for (const a of artists) uniqueArtists.add(a);
    }
  }

  // This week's plays
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeekPlays = playEvents.filter(e => e.timestamp > weekAgo).length;

  // Today's plays
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayPlays = playEvents.filter(e => e.timestamp > today.getTime()).length;

  return {
    totalPlays: playEvents.length,
    uniqueSongs: uniqueSongs.size,
    uniqueArtists: uniqueArtists.size,
    thisWeekPlays,
    todayPlays,
    topArtists: getTopArtists(5),
    hourlyPattern: getHourlyPattern()
  };
}

/**
 * Get an insight message based on analytics
 */
export function getInsight() {
  const stats = getListeningStats();
  const topArtists = stats.topArtists;

  if (stats.totalPlays < 5) {
    return {
      title: 'Getting Started',
      message: "Play more songs and I'll learn your taste!",
      icon: '🎵'
    };
  }

  const hour = new Date().getHours();
  const hourlyPattern = stats.hourlyPattern;
  const peakHour = hourlyPattern.indexOf(Math.max(...hourlyPattern));

  const insights = [];

  if (topArtists.length > 0) {
    insights.push({
      title: `You love ${topArtists[0].artist}`,
      message: `You've played their songs ${topArtists[0].count} times. Shall I find more like them?`,
      icon: '❤️'
    });
  }

  if (stats.thisWeekPlays > 20) {
    insights.push({
      title: 'Music Enthusiast!',
      message: `You've played ${stats.thisWeekPlays} songs this week across ${stats.uniqueArtists} artists.`,
      icon: '🔥'
    });
  }

  if (peakHour >= 0) {
    const period = peakHour < 12 ? 'morning' : peakHour < 17 ? 'afternoon' : peakHour < 21 ? 'evening' : 'night';
    insights.push({
      title: `${period.charAt(0).toUpperCase() + period.slice(1)} Listener`,
      message: `You listen the most around ${peakHour > 12 ? peakHour - 12 : peakHour}${peakHour >= 12 ? 'PM' : 'AM'}`,
      icon: peakHour < 12 ? '🌅' : peakHour < 17 ? '☀️' : peakHour < 21 ? '🌆' : '🌙'
    });
  }

  // Return a random insight
  return insights.length > 0 ? insights[Math.floor(Math.random() * insights.length)] : {
    title: 'Keep Exploring',
    message: `You've discovered ${stats.uniqueSongs} unique songs so far!`,
    icon: '🎶'
  };
}

/**
 * Clear all analytics data
 */
export function clearAnalytics() {
  localStorage.removeItem(ANALYTICS_KEY);
}
