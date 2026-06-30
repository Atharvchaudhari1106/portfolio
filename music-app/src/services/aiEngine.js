/**
 * AI Engine — Client-side intelligence for AesthetiCore Music
 * 
 * Features:
 *   1. Mood Detection — classify songs by mood using keyword analysis
 *   2. Smart Recommendations — TF-IDF vector space model for content-based filtering
 *   3. Natural Language Search — parse intent from queries like "play something sad"
 *   4. AI Mix Generator — create themed playlists from user library
 *   5. Time-aware suggestions — morning calm, evening energy, night chill
 */

// ─── Mood Classification ────────────────────────────────────────

const MOOD_KEYWORDS = {
  happy: {
    title: ['happy', 'joy', 'celebrate', 'party', 'dance', 'fun', 'sunshine', 'smile', 'good', 'best', 'alive', 'beautiful', 'perfect', 'wonderful', 'amazing', 'cheers', 'yaari', 'masti', 'dhamaal', 'badtameez', 'gallan goodiyaan', 'nachde'],
    artist: [],
    weight: 1.0
  },
  sad: {
    title: ['sad', 'cry', 'tears', 'pain', 'broken', 'alone', 'lonely', 'miss', 'lost', 'gone', 'hurt', 'sorrow', 'blue', 'empty', 'farewell', 'goodbye', 'dard', 'tanha', 'judai', 'alvida', 'bewafa', 'dil', 'roya', 'tadap', 'intezaar', 'judaai'],
    artist: ['arijit singh', 'atif aslam', 'adele', 'lana del rey'],
    weight: 1.0
  },
  energetic: {
    title: ['energy', 'power', 'fire', 'wild', 'fast', 'run', 'fight', 'beast', 'warrior', 'unstoppable', 'thunder', 'bang', 'boom', 'pump', 'hype', 'swag', 'desi', 'jatt', 'gangster', 'tiger', 'sher'],
    artist: ['ap dhillon', 'diljit dosanjh', 'yo yo honey singh', 'badshah', 'raftaar', 'eminem', 'travis scott'],
    weight: 1.0
  },
  chill: {
    title: ['chill', 'relax', 'calm', 'peace', 'easy', 'soft', 'gentle', 'breeze', 'ocean', 'waves', 'float', 'dream', 'sleep', 'ambient', 'lo-fi', 'lofi', 'cafe', 'rain', 'sukoon', 'chain', 'aasman'],
    artist: ['prateek kuhad', 'anuv jain', 'billie eilish', 'tame impala'],
    weight: 1.0
  },
  romantic: {
    title: ['love', 'heart', 'kiss', 'darling', 'baby', 'forever', 'romance', 'sweetheart', 'beloved', 'desire', 'passion', 'together', 'ishq', 'pyaar', 'mohabbat', 'sanam', 'janam', 'tujhe', 'tere', 'tum', 'sajni', 'piya', 'mehbooba', 'jannat'],
    artist: ['arijit singh', 'shreya ghoshal', 'ed sheeran', 'john legend'],
    weight: 1.0
  },
  dark: {
    title: ['dark', 'night', 'shadow', 'demon', 'devil', 'hell', 'death', 'blood', 'black', 'rage', 'revenge', 'destroy', 'chaos', 'villain', 'wicked', 'sinister', 'haunted'],
    artist: ['the weeknd', 'billie eilish', 'imagine dragons'],
    weight: 1.0
  }
};

const MOOD_COLORS = {
  happy: { gradient: 'linear-gradient(135deg, #FFD700, #FFA500)', emoji: '☀️', color: '#FFD700' },
  sad: { gradient: 'linear-gradient(135deg, #4A90D9, #2C3E6B)', emoji: '🌧️', color: '#4A90D9' },
  energetic: { gradient: 'linear-gradient(135deg, #FF4444, #FF6B35)', emoji: '⚡', color: '#FF4444' },
  chill: { gradient: 'linear-gradient(135deg, #4ECDC4, #2C7873)', emoji: '🌊', color: '#4ECDC4' },
  romantic: { gradient: 'linear-gradient(135deg, #FF69B4, #C71585)', emoji: '💕', color: '#FF69B4' },
  dark: { gradient: 'linear-gradient(135deg, #2C003E, #5C2D91)', emoji: '🌑', color: '#5C2D91' }
};

/**
 * Detect the mood of a song based on its metadata
 * Returns { mood, confidence, color, emoji, gradient }
 */
export function detectMood(song) {
  if (!song) return { mood: 'chill', confidence: 0.1, ...MOOD_COLORS.chill };

  const titleLower = (song.title || '').toLowerCase();
  const artistLower = (song.artist || '').toLowerCase();
  const albumLower = (song.album || '').toLowerCase();
  const combined = `${titleLower} ${artistLower} ${albumLower}`;

  const scores = {};

  for (const [mood, config] of Object.entries(MOOD_KEYWORDS)) {
    let score = 0;

    // Title keyword matches (strongest signal)
    for (const kw of config.title) {
      if (combined.includes(kw)) {
        score += 2.0 * config.weight;
      }
    }

    // Artist matches (moderate signal)
    for (const artist of config.artist) {
      if (artistLower.includes(artist)) {
        score += 1.5 * config.weight;
      }
    }

    scores[mood] = score;
  }

  // Find the mood with highest score
  let bestMood = 'chill';
  let bestScore = 0;

  for (const [mood, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestMood = mood;
    }
  }

  // Normalize confidence to 0-1
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? bestScore / totalScore : 0.15;

  return {
    mood: bestMood,
    confidence: Math.min(confidence, 1),
    ...MOOD_COLORS[bestMood]
  };
}

/**
 * Classify an array of songs by mood
 * Returns { [mood]: Song[] }
 */
export function classifyByMood(songs) {
  const classified = {};
  for (const mood of Object.keys(MOOD_KEYWORDS)) {
    classified[mood] = [];
  }

  for (const song of songs) {
    const { mood } = detectMood(song);
    if (!classified[mood]) classified[mood] = [];
    classified[mood].push(song);
  }

  return classified;
}

/**
 * Generate mood-based playlist sections from a library
 * Returns array of { mood, title, emoji, gradient, color, tracks }
 */
export function generateMoodMixes(library) {
  if (!library || library.length < 3) return [];

  const classified = classifyByMood(library);
  const mixes = [];

  const moodTitles = {
    happy: 'Good Vibes Only',
    sad: 'In My Feelings',
    energetic: 'Pump It Up',
    chill: 'Chill & Relax',
    romantic: 'Love Songs',
    dark: 'After Dark'
  };

  for (const [mood, tracks] of Object.entries(classified)) {
    if (tracks.length >= 2) {
      mixes.push({
        mood,
        title: moodTitles[mood] || mood,
        tracks: tracks.slice(0, 8),
        ...MOOD_COLORS[mood]
      });
    }
  }

  return mixes.sort((a, b) => b.tracks.length - a.tracks.length);
}

// ─── TF-IDF Recommendation Engine ───────────────────────────────

/**
 * Build a term frequency vector from song metadata
 */
function buildTermVector(song) {
  const terms = {};
  const text = `${song.title || ''} ${song.artist || ''} ${song.album || ''}`.toLowerCase();
  
  // Split into tokens
  const tokens = text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  for (const token of tokens) {
    terms[token] = (terms[token] || 0) + 1;
  }

  // Add artist tokens with higher weight
  const artists = (song.artist || '').toLowerCase().split(/[,&]/).map(a => a.trim());
  for (const artist of artists) {
    const artistTokens = artist.split(/\s+/).filter(t => t.length > 1);
    for (const t of artistTokens) {
      terms[`artist:${t}`] = (terms[`artist:${t}`] || 0) + 3; // Higher weight for artist
    }
  }

  return terms;
}

/**
 * Cosine similarity between two term vectors
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  
  for (const term of allTerms) {
    const a = vecA[term] || 0;
    const b = vecB[term] || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Build a user preference profile from listening history
 */
export function buildUserProfile(likedSongs, recentPlays = []) {
  const profile = {};

  // Weight liked songs
  for (const song of likedSongs) {
    const vec = buildTermVector(song);
    for (const [term, count] of Object.entries(vec)) {
      profile[term] = (profile[term] || 0) + count * 2; // Double weight for liked
    }
  }

  // Weight recent plays (with recency decay)
  for (let i = 0; i < recentPlays.length; i++) {
    const song = recentPlays[i];
    const recencyWeight = 1 / (1 + i * 0.1); // Decay factor
    const vec = buildTermVector(song);
    for (const [term, count] of Object.entries(vec)) {
      profile[term] = (profile[term] || 0) + count * recencyWeight;
    }
  }

  return profile;
}

/**
 * Score a candidate song against a user profile
 * Returns 0-1 similarity score
 */
export function scoreForUser(song, userProfile) {
  const songVec = buildTermVector(song);
  return cosineSimilarity(songVec, userProfile);
}

/**
 * Get personalized recommendations from a candidate pool
 * @param {Array} candidates - Available songs to recommend from
 * @param {Object} userProfile - Built from buildUserProfile()
 * @param {Array} excludeIds - Song IDs to exclude (already in library)
 * @param {number} limit - Max results
 * @returns {Array} Scored and sorted recommendations
 */
export function getSmartRecommendations(candidates, userProfile, excludeIds = [], limit = 10) {
  const excludeSet = new Set(excludeIds);

  const scored = candidates
    .filter(c => !excludeSet.has(c.id))
    .map(candidate => ({
      ...candidate,
      aiScore: scoreForUser(candidate, userProfile)
    }))
    .filter(c => c.aiScore > 0.05)
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, limit);

  return scored;
}

// ─── Natural Language Search Parser ─────────────────────────────

const NLP_PATTERNS = [
  // "play something sad by Arijit Singh"
  { regex: /(?:play|find|get|give)\s+(?:me\s+)?(?:something|songs?|tracks?|music)\s+(happy|sad|chill|energetic|romantic|dark)\s+(?:by|from)\s+(.+)/i, extract: (m) => ({ mood: m[1].toLowerCase(), artist: m[2].trim() }) },
  // "sad songs by Arijit Singh"
  { regex: /(happy|sad|chill|energetic|romantic|dark)\s+(?:songs?|tracks?|music)\s+(?:by|from)\s+(.+)/i, extract: (m) => ({ mood: m[1].toLowerCase(), artist: m[2].trim() }) },
  // "play something chill"
  { regex: /(?:play|find|get|give)\s+(?:me\s+)?(?:something|songs?|tracks?|music)\s+(happy|sad|chill|energetic|romantic|dark)/i, extract: (m) => ({ mood: m[1].toLowerCase() }) },
  // "songs for studying / workout / sleep / party"
  { regex: /(?:songs?|music|playlist)\s+(?:for|to)\s+(study|studying|work|workout|exercise|sleep|sleeping|relax|relaxing|party|partying|drive|driving|cooking|running|meditation|focus|coding)/i, extract: (m) => ({ activity: m[1].toLowerCase() }) },
  // "morning music" / "night songs"
  { regex: /(morning|evening|night|afternoon)\s+(?:songs?|music|vibes|playlist)/i, extract: (m) => ({ timeOfDay: m[1].toLowerCase() }) },
  // "happy songs" / "sad music"
  { regex: /(happy|sad|chill|energetic|romantic|dark)\s+(?:songs?|music|vibes|playlist)/i, extract: (m) => ({ mood: m[1].toLowerCase() }) },
];

const ACTIVITY_TO_MOOD = {
  study: 'chill', studying: 'chill', focus: 'chill', coding: 'chill',
  work: 'energetic', workout: 'energetic', exercise: 'energetic', running: 'energetic',
  sleep: 'chill', sleeping: 'chill', relax: 'chill', relaxing: 'chill', meditation: 'chill',
  party: 'energetic', partying: 'energetic',
  drive: 'happy', driving: 'happy',
  cooking: 'happy'
};

const TIME_TO_MOOD = {
  morning: 'chill',
  afternoon: 'happy',
  evening: 'romantic',
  night: 'chill'
};

/**
 * Parse a natural language music query
 * Returns { isNLP: boolean, mood?: string, artist?: string, activity?: string, rawQuery: string }
 */
export function parseNaturalLanguageQuery(query) {
  if (!query || query.trim().length < 3) {
    return { isNLP: false, rawQuery: query };
  }

  const trimmed = query.trim();

  for (const pattern of NLP_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      const extracted = pattern.extract(match);
      
      // Map activity to mood
      if (extracted.activity) {
        extracted.mood = ACTIVITY_TO_MOOD[extracted.activity] || 'chill';
      }
      if (extracted.timeOfDay) {
        extracted.mood = TIME_TO_MOOD[extracted.timeOfDay] || 'chill';
      }

      return { isNLP: true, ...extracted, rawQuery: trimmed };
    }
  }

  return { isNLP: false, rawQuery: trimmed };
}

// ─── AI Mix Generator ───────────────────────────────────────────

const MIX_PROMPTS = {
  // activity-based
  'workout': { mood: 'energetic', searchTerms: ['workout', 'gym', 'pump', 'energy', 'power'], title: '💪 Workout Mode' },
  'study': { mood: 'chill', searchTerms: ['lo-fi', 'study', 'ambient', 'calm', 'focus'], title: '📚 Study Session' },
  'party': { mood: 'energetic', searchTerms: ['party', 'dance', 'club', 'dj', 'remix'], title: '🎉 Party Anthems' },
  'sleep': { mood: 'chill', searchTerms: ['sleep', 'rain', 'ambient', 'soft', 'lullaby'], title: '🌙 Sleep Sounds' },
  'drive': { mood: 'happy', searchTerms: ['drive', 'road trip', 'highway', 'travel'], title: '🚗 Road Trip' },
  'romance': { mood: 'romantic', searchTerms: ['love', 'romantic', 'heart', 'slow dance'], title: '💕 Date Night' },
  'focus': { mood: 'chill', searchTerms: ['focus', 'concentrate', 'instrumental', 'lo-fi'], title: '🎯 Deep Focus' },
  'morning': { mood: 'happy', searchTerms: ['morning', 'fresh', 'good day', 'sunrise'], title: '🌅 Morning Vibes' },
  'cooking': { mood: 'happy', searchTerms: ['jazz', 'bossa nova', 'cafe', 'kitchen'], title: '👨‍🍳 Cooking Tunes' },
  'rainy': { mood: 'sad', searchTerms: ['rain', 'monsoon', 'baarish', 'storm'], title: '🌧️ Rainy Day' },
};

/**
 * Parse a user's mix prompt and return mix configuration
 */
export function parseMixPrompt(prompt) {
  const lower = prompt.toLowerCase().trim();
  
  // Check direct matches
  for (const [key, config] of Object.entries(MIX_PROMPTS)) {
    if (lower.includes(key)) {
      return config;
    }
  }

  // Check mood keywords
  for (const mood of Object.keys(MOOD_KEYWORDS)) {
    if (lower.includes(mood)) {
      return {
        mood,
        searchTerms: MOOD_KEYWORDS[mood].title.slice(0, 5),
        title: `${MOOD_COLORS[mood].emoji} ${mood.charAt(0).toUpperCase() + mood.slice(1)} Mix`
      };
    }
  }

  // Fallback — use the prompt as search terms
  return {
    mood: null,
    searchTerms: lower.split(/\s+/).filter(t => t.length > 2).slice(0, 5),
    title: `🎵 Custom Mix: ${prompt}`
  };
}

// ─── Time-based Greetings ───────────────────────────────────────

/**
 * Get time-appropriate greeting and mood suggestion
 */
export function getTimeBasedGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return {
      greeting: 'Good Morning',
      subtext: 'Start your day with some calm tunes',
      suggestedMood: 'chill',
      icon: '🌅'
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: 'Good Afternoon',
      subtext: 'Keep the energy going',
      suggestedMood: 'happy',
      icon: '☀️'
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      greeting: 'Good Evening',
      subtext: 'Wind down with your favorites',
      suggestedMood: 'romantic',
      icon: '🌆'
    };
  } else {
    return {
      greeting: 'Good Night',
      subtext: 'Late night vibes',
      suggestedMood: 'chill',
      icon: '🌙'
    };
  }
}

// ─── Artist Spelling Correction ─────────────────────────────────

/**
 * Find the closest known artist name from user's history
 * Uses Levenshtein distance for fuzzy matching
 */
export function correctArtistSpelling(input, knownArtists) {
  if (!input || !knownArtists || knownArtists.length === 0) return input;

  const inputLower = input.toLowerCase().trim();
  let bestMatch = input;
  let bestDistance = Infinity;

  for (const artist of knownArtists) {
    const artistLower = artist.toLowerCase().trim();
    
    // Exact match
    if (artistLower === inputLower) return artist;

    // Calculate distance
    const dist = levenshtein(inputLower, artistLower);
    const threshold = Math.floor(artistLower.length * 0.35); // 35% tolerance

    if (dist < bestDistance && dist <= threshold) {
      bestDistance = dist;
      bestMatch = artist;
    }
  }

  return bestMatch;
}

// ─── Levenshtein (reuse from streamResolver concept) ────────────
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
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[bLen][aLen];
}

export { MOOD_COLORS, MOOD_KEYWORDS, MIX_PROMPTS };
