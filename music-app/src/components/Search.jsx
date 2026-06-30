import React, { useState, useEffect } from 'react';
import { searchMusic } from '../services/musicService';
import { searchSpotify } from '../services/spotifyService';
import { searchYoutube } from '../services/youtubeService';
import { useAudio } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { addToSearchHistory, getSearchHistory, removeFromSearchHistory, clearSearchHistory } from '../services/searchHistory';
import { parseNaturalLanguageQuery, correctArtistSpelling, classifyByMood, MOOD_COLORS } from '../services/aiEngine';
import { getKnownArtists, trackSearch } from '../services/analyticsService';
import TrackRow from './TrackRow';
import { Music2, TvMinimalPlay, Search as SearchIcon, Clock, X, Play, Sparkles, Zap } from 'lucide-react';

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [nlpParsed, setNlpParsed] = useState(null);
  const { playTrack, currentTrack, isPlaying, library } = useAudio();
  const { spotifyToken } = useMusic();

  const browseCategories = [
    { title: 'Electronic', color: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', icon: '⚡' },
    { title: 'Hip-Hop', color: 'linear-gradient(135deg, #F472B6, #DB2777)', icon: '🎤' },
    { title: 'Pop', color: 'linear-gradient(135deg, #06B6D4, #0891B2)', icon: '🎵' },
    { title: 'Rock', color: 'linear-gradient(135deg, #EF4444, #DC2626)', icon: '🎸' },
    { title: 'Lo-Fi', color: 'linear-gradient(135deg, #10B981, #059669)', icon: '☁️' },
    { title: 'Jazz', color: 'linear-gradient(135deg, #F59E0B, #D97706)', icon: '🎷' },
    { title: 'Classical', color: 'linear-gradient(135deg, #3B82F6, #2563EB)', icon: '🎻' },
    { title: 'R&B', color: 'linear-gradient(135deg, #EC4899, #BE185D)', icon: '💜' },
    { title: 'Bollywood', color: 'linear-gradient(135deg, #FF6B35, #F7931E)', icon: '🎬' },
    { title: 'Punjabi', color: 'linear-gradient(135deg, #FF4444, #FF8C00)', icon: '🥁' },
  ];

  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    const handleSearch = async () => {
      if (query.trim()) {
        setIsLoading(true);
        try {
          // Parse natural language
          const parsed = parseNaturalLanguageQuery(query);
          setNlpParsed(parsed.isNLP ? parsed : null);

          let searchQuery = query;

          // If NLP detected, adjust the search query
          if (parsed.isNLP) {
            if (parsed.artist) {
              // Correct artist spelling
              const knownArtists = getKnownArtists();
              const correctedArtist = correctArtistSpelling(parsed.artist, knownArtists);
              searchQuery = `${correctedArtist} ${parsed.mood || ''}`.trim();
            } else if (parsed.mood) {
              const moodQueries = {
                happy: 'happy songs bollywood',
                sad: 'sad songs arijit singh',
                energetic: 'party songs punjabi',
                chill: 'lo-fi chill music',
                romantic: 'romantic songs bollywood',
                dark: 'dark aesthetic music'
              };
              searchQuery = moodQueries[parsed.mood] || `${parsed.mood} songs`;
            }
          }

          let combinedResults = [];
          
          // Search JioSaavn & YouTube (now combined and parallel inside searchMusic)
          const musicResults = await searchMusic(searchQuery);
          combinedResults = [...combinedResults, ...musicResults];
          
          // Search Spotify if connected
          if (spotifyToken) {
            const spotify = await searchSpotify(searchQuery, spotifyToken);
            combinedResults = [...combinedResults, ...spotify];
          }

          // If NLP mood filter was detected, sort by mood relevance
          if (parsed.isNLP && parsed.mood) {
            const classified = classifyByMood(combinedResults);
            const moodTracks = classified[parsed.mood] || [];
            const otherTracks = combinedResults.filter(t => !moodTracks.find(m => m.id === t.id));
            combinedResults = [...moodTracks, ...otherTracks];
          }

          setResults(combinedResults);
          if (combinedResults.length > 0) {
            addToSearchHistory(query);
            trackSearch(query);
            setHistory(getSearchHistory());
          }
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
        setNlpParsed(null);
      }
    };

    const timer = setTimeout(handleSearch, 500);
    return () => clearTimeout(timer);
  }, [query]);

  // "Feeling Lucky" — play a random song from library or trending
  const handleFeelingLucky = () => {
    if (library.length > 0) {
      const random = library[Math.floor(Math.random() * library.length)];
      playTrack(random, library);
    }
  };

  // Get source badge
  const getSourceLabel = (source) => {
    if (source === 'youtube') return { label: 'YT', color: '#FF0000' };
    if (source === 'spotify') return { label: 'SP', color: '#1DB954' };
    return { label: 'JS', color: '#1ed760' };
  };

  return (
    <div className="pulse-search animate-fade-in">
      <header className="pulse-search-header">
        <h1 className="pulse-page-title">Search</h1>
        <div className="pulse-search-bar">
          <SearchIcon size={20} className="pulse-search-icon" />
          <input
            type="text"
            placeholder='Try "chill music for studying" or "sad songs by Arijit"...'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="pulse-search-clear" onClick={() => setQuery('')}>
              <X size={18} />
            </button>
          )}
        </div>
        {/* NLP Indicator */}
        {nlpParsed && (
          <div className="nlp-indicator">
            <Sparkles size={14} />
            <span>AI understood: </span>
            {nlpParsed.mood && <span className="nlp-tag" style={{ background: MOOD_COLORS[nlpParsed.mood]?.color + '33', color: MOOD_COLORS[nlpParsed.mood]?.color }}>Mood: {nlpParsed.mood}</span>}
            {nlpParsed.artist && <span className="nlp-tag">Artist: {nlpParsed.artist}</span>}
            {nlpParsed.activity && <span className="nlp-tag">Activity: {nlpParsed.activity}</span>}
          </div>
        )}
      </header>

      <div className="pulse-search-content">
        {query ? (
          isLoading ? (
            <div className="pulse-loading">
              <div className="pulse-loading-spinner"></div>
              <span>Searching across all sources...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="pulse-results">
              <h2 className="pulse-section-title">Results ({results.length})</h2>
              <div className="pulse-results-list">
                {results.map((song, index) => (
                  <TrackRow 
                    key={`${song.source}-${song.id}`} 
                    track={song} 
                    index={index} 
                    queueContext={results} 
                    showIndex={false}
                    showSource={true}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="pulse-empty">
              <SearchIcon size={48} strokeWidth={1} />
              <h2>No results found</h2>
              <p>Try different keywords or check spelling</p>
            </div>
          )
        ) : (
          <>
            {/* Feeling Lucky Button */}
            {library.length > 0 && (
              <div className="feeling-lucky-section">
                <button className="feeling-lucky-btn" onClick={handleFeelingLucky}>
                  <Zap size={18} /> I'm Feeling Lucky
                </button>
              </div>
            )}

            {history.length > 0 && (
              <section className="pulse-history-section">
                <div className="pulse-section-header">
                  <h2 className="pulse-section-title">Recent Searches</h2>
                </div>
                <div className="pulse-trending-cards">
                  {history.slice(0, 4).map((item, index) => (
                    <div key={index} className="pulse-trending-card glass-card" onClick={() => setQuery(item.query)}>
                      <div className="pulse-trending-card-gradient"></div>
                      <div className="pulse-trending-card-content">
                        <h3>{item.query}</h3>
                        <p>Tap to search again</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="pulse-browse-section">
              <h2 className="pulse-section-title">Browse All</h2>
              <div className="pulse-browse-grid">
                {browseCategories.map((cat, index) => (
                  <div
                    key={index}
                    className="pulse-browse-card"
                    style={{ background: cat.color }}
                    onClick={() => setQuery(cat.title)}
                  >
                    <span className="pulse-browse-emoji">{cat.icon}</span>
                    <h3>{cat.title}</h3>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default Search;
