import React, { useState, useEffect } from 'react';
import { getTrending, getHomeSuggestions } from '../services/musicService';
import { getRecentSearchTerms } from '../services/searchHistory';
import { useAudio } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { generateMoodMixes, getTimeBasedGreeting, MOOD_COLORS } from '../services/aiEngine';
import { getInsight, getListeningStats } from '../services/analyticsService';
import { generateBecauseYouListened } from '../services/musicIntelligence';
import AIInsightCard from './AIInsightCard';
import SongCard from './SongCard';
import TrackRow from './TrackRow';
import { Play, Heart, Sparkles, Music2, TvMinimalPlay, Download } from 'lucide-react';

const Home = ({ onOpenAIMix, onOpenInstallModal }) => {
  const [categories, setCategories] = useState([]);
  const [featuredSong, setFeaturedSong] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [moodMixes, setMoodMixes] = useState([]);
  const [aiSections, setAiSections] = useState([]);
  const [insight, setInsight] = useState(null);
  const [stats, setStats] = useState(null);
  const [greeting, setGreeting] = useState(null);
  const { playTrack, currentTrack, isPlaying, library } = useAudio();

  useEffect(() => {
    setGreeting(getTimeBasedGreeting());
    setInsight(getInsight());
    setStats(getListeningStats());

    // Generate mood mixes from library
    if (library.length >= 3) {
      setMoodMixes(generateMoodMixes(library));
    }
  }, [library]);

  // Fetch AI "Because you listened to" sections
  useEffect(() => {
    if (library.length >= 2) {
      generateBecauseYouListened(library).then(sections => {
        setAiSections(sections);
      }).catch(err => console.warn('AI sections failed:', err));
    }
  }, [library.length]);

  useEffect(() => {
    const fetchMusic = async () => {
      setIsLoading(true);
      try {
        const searchTerms = getRecentSearchTerms(4);
        const allTrending = await getTrending();
        
        const newCategories = [];
        
        // Add Spotify Playlists
        const spotifyPlaylists = JSON.parse(localStorage.getItem('spotify_playlists') || '[]');
        if (spotifyPlaylists.length > 0) {
          newCategories.push({ id: 'spotify-playlists', title: 'Spotify Playlists', tracks: spotifyPlaylists[0].tracks.slice(0, 6) });
        }

        // Add YouTube Playlists
        const youtubeData = JSON.parse(localStorage.getItem('youtube_playlists') || '[]');
        if (youtubeData.length > 0) {
          newCategories.push({ id: 'yt-playlist', title: 'YouTube Playlists', tracks: youtubeData[0].tracks.slice(0, 6) });
        }
        
        if (searchTerms && searchTerms.length > 0) {
          const dynamicCats = await getHomeSuggestions(searchTerms);
          if (dynamicCats) newCategories.push(...dynamicCats);
        }
        
        if (allTrending && allTrending.length > 0) {
          setFeaturedSong(allTrending[0]);
          newCategories.push({ id: 'trending-1', title: 'Personalized Mixes', tracks: allTrending.slice(1, 5) });
        }
        
        setCategories(newCategories.filter(c => c && c.tracks && c.tracks.length > 0));
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMusic();
  }, []);

  // Source badge for track cards
  const getSourceBadge = (track) => {
    if (track.source === 'youtube') return { label: 'YT', color: '#FF0000' };
    if (track.source === 'spotify') return { label: 'SP', color: '#1DB954' };
    return null;
  };

  return (
    <div className="home-view animate-fade-in">
      {/* Greeting Header */}
      {greeting && (
        <div className="home-greeting" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
          <div>
            <h1 className="greeting-text" style={{ margin: 0 }}>
              <span className="greeting-icon">{greeting.icon}</span> {greeting.greeting}
            </h1>
            <p className="greeting-subtext" style={{ margin: '5px 0 0 0' }}>{greeting.subtext}</p>
          </div>
          <button 
            onClick={onOpenInstallModal}
            className="btn-primary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 18px', 
              borderRadius: '20px', 
              fontSize: '13px',
              fontWeight: '600',
              boxShadow: '0 0 15px rgba(29, 185, 84, 0.2)',
              cursor: 'pointer'
            }}
          >
            <Download size={16} /> Install App
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="loading-state">
          <div className="pulse-loading-spinner"></div>
          <span>Loading your music...</span>
        </div>
      ) : (
        <div className="home-content-sections">
          {/* AI Insight Card */}
          {insight && (
            <AIInsightCard insight={insight} stats={stats} onGenerateMix={onOpenAIMix} />
          )}

          {/* Mood Mixes Row */}
          {moodMixes.length > 0 && (
            <section className="home-section">
              <div className="section-header-flex">
                <h3 className="section-title">
                  <Sparkles size={18} className="section-ai-icon" /> Mood Mixes
                </h3>
              </div>
              <div className="mood-mixes-scroll">
                {moodMixes.map(mix => (
                  <div
                    key={mix.mood}
                    className="mood-mix-card"
                    style={{ background: mix.gradient }}
                    onClick={() => mix.tracks.length > 0 && playTrack(mix.tracks[0], mix.tracks)}
                  >
                    <span className="mood-mix-emoji">{mix.emoji}</span>
                    <h4 className="mood-mix-title">{mix.title}</h4>
                    <p className="mood-mix-count">{mix.tracks.length} tracks</p>
                    <div className="mood-mix-play">
                      <Play size={16} fill="white" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Featured Song Hero */}
          {featuredSong && (
            <section className="hero-section">
              <div className="hero-card group" onClick={() => playTrack(featuredSong, [featuredSong])}>
                <img className="hero-bg" src={featuredSong.thumbnail || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=400&fit=crop'} alt="Featured" />
                <div className="hero-overlay"></div>
                <div className="hero-content">
                  <span className="hero-badge">Featured Track</span>
                  <h2 className="hero-title">{featuredSong.title}</h2>
                  <p className="hero-desc">{featuredSong.artist}</p>
                  <button className="hero-play-btn neon-glow">
                    <Play size={20} fill="currentColor" /> Listen Now
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Dynamic Categories */}
          {categories.map((cat, catIdx) => (
            <section key={cat.id || catIdx} className="home-section">
              <div className="section-header-flex">
                <h3 className="section-title">{cat.title}</h3>
                <span className="see-all-link">See All</span>
              </div>
              {catIdx % 3 === 2 ? (
                // Every 3rd section: list view
                <div className="trending-list">
                  {cat.tracks.map((song, index) => (
                    <TrackRow key={song.id} track={song} index={index} queueContext={cat.tracks} />
                  ))}
                </div>
              ) : catIdx % 3 === 1 ? (
                // Every 2nd section: horizontal scroll
                <div className="releases-scroll">
                  {cat.tracks.map(song => (
                    <div key={song.id} className="release-card group" onClick={() => playTrack(song, cat.tracks)}>
                      <div className="release-image-container border-glow">
                        <img src={song.thumbnail} alt={song.title} />
                        {getSourceBadge(song) && (
                          <span className="yt-source-badge" style={{ background: getSourceBadge(song).color }}>
                            {getSourceBadge(song).label}
                          </span>
                        )}
                      </div>
                      <div className="release-info">
                        <h4 className="release-title">{song.title}</h4>
                        <p className="release-artist">{song.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Default: grid view
                <div className="mixes-grid">
                  {cat.tracks.map(song => (
                    <div key={song.id} className="mix-card glass-card group" onClick={() => playTrack(song, cat.tracks)}>
                      <div className="mix-image-container">
                        <img src={song.thumbnail} alt={song.title} />
                        <div className="mix-play-overlay">
                          <Play size={36} fill="white" className="text-white" />
                        </div>
                        {getSourceBadge(song) && (
                          <span className="yt-source-badge" style={{ background: getSourceBadge(song).color }}>
                            {getSourceBadge(song).label}
                          </span>
                        )}
                      </div>
                      <div className="mix-info">
                        <p className="mix-title">{song.title}</p>
                        <p className="mix-desc">{song.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}

          {/* AI "Because you listened to..." Sections */}
          {aiSections.map(section => (
            <section key={section.id} className="home-section ai-section">
              <div className="section-header-flex">
                <h3 className="section-title">
                  <Sparkles size={16} className="section-ai-icon" /> {section.title}
                </h3>
              </div>
              <div className="mixes-grid">
                {section.tracks.map(song => (
                  <div key={song.id} className="mix-card glass-card group" onClick={() => playTrack(song, section.tracks)}>
                    <div className="mix-image-container">
                      <img src={song.thumbnail} alt={song.title} />
                      <div className="mix-play-overlay">
                        <Play size={36} fill="white" />
                      </div>
                    </div>
                    <div className="mix-info">
                      <p className="mix-title">{song.title}</p>
                      <p className="mix-desc">{song.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
