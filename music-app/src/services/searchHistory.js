// Search History Service
// Tracks user search queries in localStorage to power dynamic home suggestions

const HISTORY_KEY = 'music-search-history';
const MAX_HISTORY = 20;

/**
 * Get all search history entries (most recent first)
 * Each entry: { query: string, timestamp: number }
 */
export const getSearchHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Add a search query to the history
 * - Deduplicates (case-insensitive, moves existing to top)
 * - Caps at MAX_HISTORY entries
 */
export const addToSearchHistory = (query) => {
  if (!query || !query.trim()) return;
  
  const trimmed = query.trim();
  const history = getSearchHistory();
  
  // Remove existing entry if present (case-insensitive)
  const filtered = history.filter(
    entry => entry.query.toLowerCase() !== trimmed.toLowerCase()
  );
  
  // Add to the beginning
  filtered.unshift({
    query: trimmed,
    timestamp: Date.now()
  });
  
  // Cap the list
  const capped = filtered.slice(0, MAX_HISTORY);
  
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(capped));
  } catch (e) {
    console.error('Failed to save search history:', e);
  }
};

/**
 * Remove a specific search from history
 */
export const removeFromSearchHistory = (query) => {
  const history = getSearchHistory();
  const filtered = history.filter(
    entry => entry.query.toLowerCase() !== query.toLowerCase()
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
};

/**
 * Clear all search history
 */
export const clearSearchHistory = () => {
  localStorage.removeItem(HISTORY_KEY);
};

/**
 * Get unique search terms for building home suggestions
 * Returns the most recent N unique search terms
 */
export const getRecentSearchTerms = (count = 6) => {
  const history = getSearchHistory();
  return history.slice(0, count).map(entry => entry.query);
};
