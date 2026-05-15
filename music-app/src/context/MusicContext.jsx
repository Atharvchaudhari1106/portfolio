import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { refreshSpotifyToken } from '../services/spotifyService';

const MusicContext = createContext();

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useMusic must be used within MusicProvider');
  return context;
};

export const MusicProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  
  // Spotify State
  const [spotifyToken, setSpotifyToken] = useState(localStorage.getItem('spotify_access_token'));
  const [spotifyRefreshToken, setSpotifyRefreshToken] = useState(localStorage.getItem('spotify_refresh_token'));
  
  // YouTube State
  const [youtubePlaylists, setYoutubePlaylists] = useState(
    JSON.parse(localStorage.getItem('youtube_playlists') || '[]')
  );

  // Playback Control
  const playTrack = (track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    setHistory(prev => [track, ...prev.filter(t => t.id !== track.id)].slice(0, 50));
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const nextTrack = () => {
    const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      playTrack(queue[currentIndex + 1]);
    }
  };

  const prevTrack = () => {
    const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
    if (currentIndex > 0) {
      playTrack(queue[currentIndex - 1]);
    }
  };

  // Spotify Auth Sync
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const access = params.get('access_token');
    const refresh = params.get('refresh_token');
    
    if (access && refresh) {
      setSpotifyToken(access);
      setSpotifyRefreshToken(refresh);
      localStorage.setItem('spotify_access_token', access);
      localStorage.setItem('spotify_refresh_token', refresh);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Token Refresh Logic
  useEffect(() => {
    if (spotifyRefreshToken) {
      const interval = setInterval(async () => {
        try {
          const data = await refreshSpotifyToken(spotifyRefreshToken);
          setSpotifyToken(data.access_token);
          localStorage.setItem('spotify_access_token', data.access_token);
        } catch (e) {
          console.error('Failed to refresh Spotify token', e);
        }
      }, 50 * 60 * 1000); // Refresh every 50 mins
      return () => clearInterval(interval);
    }
  }, [spotifyRefreshToken]);

  // Favorites logic
  const toggleFavorite = (track) => {
    setFavorites(prev => {
      const isFav = prev.some(t => t.id === track.id);
      if (isFav) return prev.filter(t => t.id !== track.id);
      return [...prev, track];
    });
  };

  const value = {
    currentTrack,
    setCurrentTrack,
    isPlaying,
    setIsPlaying,
    queue,
    setQueue,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    history,
    favorites,
    toggleFavorite,
    spotifyToken,
    youtubePlaylists,
    setYoutubePlaylists
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
};
