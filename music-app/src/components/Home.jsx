import React, { useState, useEffect } from 'react';
import { getTrending, getHomeSuggestions } from '../services/musicService';
import { getRecentSearchTerms } from '../services/searchHistory';
import { useAudio } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { getSpotifyLikedSongs } from '../services/spotifyService';
import SongCard from './SongCard';
import TrackRow from './TrackRow';
import { Play, Heart, MoreVertical, Music2, TvMinimalPlay } from 'lucide-react';

const Home = () => {
  const [categories, setCategories] = useState([]);
  const [featuredSong, setFeaturedSong] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const { playTrack, currentTrack, isPlaying } = useAudio();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If already in standalone mode, don't show the prompt
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      // We've used the prompt, and can't use it again, so clear it
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  useEffect(() => {
    const fetchMusic = async () => {
      setIsLoading(true);
      try {
        const searchTerms = getRecentSearchTerms(4);
        const allTrending = await getTrending();
        
        const newCategories = [];
        
        // Add Spotify Content if logged in
        const spotifyToken = localStorage.getItem('spotify_access_token');
        if (spotifyToken) {
          try {
            const liked = await getSpotifyLikedSongs(spotifyToken);
            if (liked && liked.length > 0) {
              newCategories.push({ id: 'spotify-liked', title: 'From your Spotify', tracks: liked.slice(0, 6) });
            }
          } catch (e) { console.error(e); }
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

  return (
    <div className="home-view animate-fade-in">


      {isLoading ? (
        <div className="loading-state">Loading your music...</div>
      ) : (
        <div className="home-content-sections">
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

          {categories[0] && (
            <section className="home-section">
              <div className="section-header-flex">
                <h3 className="section-title">{categories[0].title}</h3>
                <span className="see-all-link">See All</span>
              </div>
              <div className="mixes-grid">
                {categories[0].tracks.map(song => (
                  <div key={song.id} className="mix-card glass-card group" onClick={() => playTrack(song, categories[0].tracks)}>
                    <div className="mix-image-container">
                      <img src={song.thumbnail} alt={song.title} />
                      <div className="mix-play-overlay">
                        <Play size={36} fill="white" className="text-white" />
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
          )}

          {categories[1] && (
            <section className="home-section">
              <h3 className="section-title">{categories[1].title}</h3>
              <div className="releases-scroll">
                {categories[1].tracks.map(song => (
                  <div key={song.id} className="release-card group" onClick={() => playTrack(song, categories[1].tracks)}>
                    <div className="release-image-container border-glow">
                      <img src={song.thumbnail} alt={song.title} />
                    </div>
                    <div className="release-info">
                      <h4 className="release-title">{song.title}</h4>
                      <p className="release-artist">{song.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {categories[2] && (
            <section className="home-section">
              <h3 className="section-title">{categories[2].title}</h3>
              <div className="trending-list">
                {categories[2].tracks.map((song, index) => (
                  <TrackRow 
                    key={song.id} 
                    track={song} 
                    index={index} 
                    queueContext={categories[2].tracks} 
                  />
                ))}
              </div>
            </section>
          )}

          {showInstallPrompt && (
            <section className="home-section install-section">
              <div className="install-banner-wide glass-card">
                <div className="install-content">
                  <h3>Get the AesthetiCore App</h3>
                  <p>Install our app for a full-screen, premium experience with offline-like performance.</p>
                </div>
                <button className="pill-btn neon-glow" onClick={handleInstall}>
                  Install Now
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
