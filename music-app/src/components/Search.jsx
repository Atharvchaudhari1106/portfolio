import React, { useState, useEffect } from 'react';
import { searchMusic } from '../services/musicService';
import { searchSpotify } from '../services/spotifyService';
import { searchYoutube } from '../services/youtubeService';
import { useAudio } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { addToSearchHistory, getSearchHistory, removeFromSearchHistory, clearSearchHistory } from '../services/searchHistory';
import TrackRow from './TrackRow';
import { Music2, TvMinimalPlay, Search as SearchIcon, Clock, X, Play } from 'lucide-react';

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const { playTrack, currentTrack, isPlaying } = useAudio();
  const { spotifyToken } = useMusic();
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'spotify', 'youtube'

  const browseCategories = [
    { title: 'Electronic', color: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', icon: '⚡' },
    { title: 'Hip-Hop', color: 'linear-gradient(135deg, #F472B6, #DB2777)', icon: '🎤' },
    { title: 'Pop', color: 'linear-gradient(135deg, #06B6D4, #0891B2)', icon: '🎵' },
    { title: 'Rock', color: 'linear-gradient(135deg, #EF4444, #DC2626)', icon: '🎸' },
    { title: 'Lo-Fi', color: 'linear-gradient(135deg, #10B981, #059669)', icon: '☁️' },
    { title: 'Jazz', color: 'linear-gradient(135deg, #F59E0B, #D97706)', icon: '🎷' },
    { title: 'Classical', color: 'linear-gradient(135deg, #3B82F6, #2563EB)', icon: '🎻' },
    { title: 'R&B', color: 'linear-gradient(135deg, #EC4899, #BE185D)', icon: '💜' },
  ];

  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    const handleSearch = async () => {
      if (query.trim()) {
        setIsLoading(true);
        try {
          let combinedResults = [];
          
          if (activeTab === 'all' || activeTab === 'saavn') {
            const saavn = await searchMusic(query);
            combinedResults = [...combinedResults, ...saavn];
          }
          
          if (spotifyToken && (activeTab === 'all' || activeTab === 'spotify')) {
            const spotify = await searchSpotify(query, spotifyToken);
            combinedResults = [...combinedResults, ...spotify];
          }
          
          if (activeTab === 'all' || activeTab === 'youtube') {
            const yt = await searchYoutube(query);
            combinedResults = [...combinedResults, ...yt];
          }

          setResults(combinedResults);
          if (combinedResults.length > 0) {
            addToSearchHistory(query);
            setHistory(getSearchHistory());
          }
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
      }
    };

    const timer = setTimeout(handleSearch, 500);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="pulse-search animate-fade-in">
      <header className="pulse-search-header">
        <h1 className="pulse-page-title">Search</h1>
        <div className="pulse-search-bar">
          <SearchIcon size={20} className="pulse-search-icon" />
          <input
            type="text"
            placeholder="Artists, songs, or podcasts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="pulse-search-clear" onClick={() => setQuery('')}>
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      <div className="pulse-search-content">
        {query ? (
          isLoading ? (
            <div className="pulse-loading">
              <div className="pulse-loading-spinner"></div>
              <span>Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="pulse-results">
              <h2 className="pulse-section-title">Results</h2>
              <div className="pulse-results-list">
                {results.map((song, index) => (
                  <TrackRow 
                    key={song.id} 
                    track={song} 
                    index={index} 
                    queueContext={results} 
                    showIndex={false}
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
            {history.length > 0 && (
              <section className="pulse-history-section">
                <div className="pulse-section-header">
                  <h2 className="pulse-section-title">Trending Now</h2>
                </div>
                <div className="pulse-trending-cards">
                  {history.slice(0, 2).map((item, index) => (
                    <div key={index} className="pulse-trending-card glass-card" onClick={() => setQuery(item.query)}>
                      <div className="pulse-trending-card-gradient"></div>
                      <div className="pulse-trending-card-content">
                        <h3>{item.query}</h3>
                        <p>Based on your recent plays</p>
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
