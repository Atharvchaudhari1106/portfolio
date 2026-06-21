import React, { useState, useRef, useEffect } from 'react';
import { 
  SkipBack, Play, Pause, SkipForward, Volume2, 
  VolumeX, Shuffle, Repeat, Music, Heart, Mic2, ListMusic, MonitorSpeaker, Download, Plus
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { downloadSong, searchMusic } from '../services/musicService';
import { getYoutubeAudioStream, searchYoutube } from '../services/youtubeService';

const PlayerBar = ({ onOpenNowPlaying }) => {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlay, 
    volume, 
    setVolume, 
    playNext, 
    playPrevious,
    isShuffled,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    setIsPlaying,
    library,
    addToLibrary,
    removeFromLibrary,
    playlists,
    addToPlaylist,
    createPlaylist
  } = useAudio();
  
  const [showPlaylists, setShowPlaylists] = useState(false);
  const playNextRef = useRef(playNext);
  const playPreviousRef = useRef(playPrevious);
  const togglePlayRef = useRef(togglePlay);

  useEffect(() => {
    playNextRef.current = playNext;
    playPreviousRef.current = playPrevious;
    togglePlayRef.current = togglePlay;
  }, [playNext, playPrevious, togglePlay]);

  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ytStreamUrl, setYtStreamUrl] = useState(null);
  const [ytLoading, setYtLoading] = useState(false);
  const audioRef = useRef(null);

  // Determine if current track is a YouTube or Spotify source
  const isYoutubeTrack = currentTrack?.source === 'youtube';
  const isSpotifyTrack = currentTrack?.source === 'spotify';

  // Resolve audio stream when a YouTube or Spotify track becomes active
  useEffect(() => {
    if (!currentTrack) {
      setYtStreamUrl(null);
      return;
    }

    let cancelled = false;
    setYtStreamUrl(null);
    setYtLoading(true);

    const resolveStream = async () => {
      try {
        if (isYoutubeTrack) {
          const url = await getYoutubeAudioStream(currentTrack.id);
          if (!cancelled) {
            setYtStreamUrl(url);
            setYtLoading(false);
          }
        } else if (isSpotifyTrack) {
          console.log(`[Spotify Match] Resolving stream for: ${currentTrack.title} - ${currentTrack.artist}`);
          
          // 1. Try JioSaavn first (high quality, fast loading, no proxy/scraping needed)
          try {
            const query = `${currentTrack.artist.split(',')[0]} ${currentTrack.title}`;
            const saavnResults = await searchMusic(query);
            const match = saavnResults.find(song => song.streamUrl);
            if (match && !cancelled) {
              console.log(`[Spotify Match] Found JioSaavn stream: ${match.title}`);
              setYtStreamUrl(match.streamUrl);
              setYtLoading(false);
              return;
            }
          } catch (e) {
            console.warn('[Spotify Match] JioSaavn fallback failed, trying YouTube...', e);
          }

          // 2. Try YouTube search
          if (!cancelled) {
            const query = `${currentTrack.artist} ${currentTrack.title}`;
            const ytResults = await searchYoutube(query);
            if (ytResults && ytResults.length > 0 && !cancelled) {
              const url = await getYoutubeAudioStream(ytResults[0].id);
              console.log(`[Spotify Match] Found YouTube stream: ${ytResults[0].title}`);
              setYtStreamUrl(url);
              setYtLoading(false);
              return;
            }
          }

          if (!cancelled) {
            throw new Error('No stream found in any service');
          }
        } else {
          // Standard track
          setYtLoading(false);
        }
      } catch (err) {
        console.error('[Spotify/YouTube Match] Failed to resolve audio stream:', err);
        if (!cancelled) {
          setYtStreamUrl(null);
          setYtLoading(false);
        }
      }
    };

    resolveStream();

    return () => { cancelled = true; };
  }, [currentTrack?.id, isYoutubeTrack, isSpotifyTrack]);

  // Configure Media Session API for mobile OS controls
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      const trackImage = currentTrack.thumbnail || '';
      
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: [
          { src: trackImage || 'https://via.placeholder.com/96', sizes: '96x96', type: 'image/jpeg' },
          { src: trackImage || 'https://via.placeholder.com/512', sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => togglePlayRef.current());
      navigator.mediaSession.setActionHandler('pause', () => togglePlayRef.current());
      navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousRef.current());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNextRef.current());
    }
  }, [currentTrack]);

  // The effective stream URL for the <audio> element
  const effectiveStreamUrl = (isYoutubeTrack || isSpotifyTrack) ? ytStreamUrl : currentTrack?.streamUrl;

  // === Standard <audio> element playback control ===
  useEffect(() => {
    if (!audioRef.current || !effectiveStreamUrl) return;
    if (isPlaying) {
      audioRef.current.play().catch(err => console.warn('Audio play error:', err));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, effectiveStreamUrl]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  // When track changes, reset progress
  useEffect(() => {
    setPlayedSeconds(0);
    setDuration(0);
  }, [currentTrack?.id]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setPlayedSeconds(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      if (isPlaying) {
        audioRef.current.play().catch(err => console.warn('Auto-play error:', err));
      }
    }
  };

  const handleVolumeChange = (e) => {
    setVolume(parseFloat(e.target.value));
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setPlayedSeconds(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  if (!currentTrack) return <div className="player-bar empty-debug" style={{ color: 'red' }}>NO CURRENT TRACK</div>;

  return (
    <div className="player-bar">
      {/* Left Section: Track Info — click to open Now Playing */}
      <div className="player-left" onClick={onOpenNowPlaying} style={{ cursor: 'pointer' }} title="Open Now Playing">
        <div className="player-art-container">
          {currentTrack.thumbnail ? (
            <img 
              src={currentTrack.thumbnail} 
              alt={currentTrack.title} 
              className="now-playing-art" 
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/96?text=No+Img';
              }}
            />
          ) : (
            <div className="art-placeholder"><Music size={20} /></div>
          )}
        </div>
        <div className="track-info">
          <h4 className="player-track-title">{currentTrack.title}</h4>
          <p className="player-track-artist">
            {ytLoading ? 'Loading stream...' : currentTrack.artist}
          </p>
        </div>
        <button 
          className="icon-btn heart-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (library.find(t => t.id === currentTrack.id)) {
              removeFromLibrary(currentTrack.id);
            } else {
              addToLibrary(currentTrack);
            }
          }}
        >
          <Heart 
            size={18} 
            fill={library.find(t => t.id === currentTrack.id) ? "var(--accent-primary)" : "none"} 
            color={library.find(t => t.id === currentTrack.id) ? "var(--accent-primary)" : "currentColor"}
          />
        </button>
      </div>

      {/* Middle Section: Controls & Progress */}
      <div className="player-center">
        <div className="player-controls">
          <button 
            className={`control-btn ${isShuffled ? 'active' : ''}`} 
            onClick={toggleShuffle}
            title="Shuffle"
          >
            <Shuffle size={16} />
          </button>
          <button 
            className="control-btn" 
            onClick={() => playPrevious()} 
            title="Previous"
          >
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button className="play-btn-circle" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" style={{ marginLeft: '4px' }} />}
          </button>
          <button 
            className="control-btn" 
            onClick={() => playNext()} 
            title="Next"
          >
            <SkipForward size={20} fill="currentColor" />
          </button>
          <button 
            className={`control-btn ${repeatMode !== 'off' ? 'active' : ''}`}
            onClick={toggleRepeat}
            title="Repeat"
          >
            <Repeat size={16} />
            {repeatMode === 'one' && <span className="repeat-badge">1</span>}
          </button>
        </div>
        
        <div className="playback-bar">
          <span className="time-text">{formatTime(playedSeconds)}</span>
          <div className="progress-bar-container">
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={playedSeconds}
              onChange={handleSeek}
              className="player-slider"
              style={{ '--progress': `${(playedSeconds / (duration || 1)) * 100}%` }}
            />
            <div 
              className="player-progress-fill" 
              style={{ width: `${(playedSeconds / (duration || 1)) * 100}%` }}
            ></div>
          </div>
          <span className="time-text">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right Section: Utilities */}
      <div className="player-right" style={{ position: 'relative' }}>
        <button 
          className="utility-btn" 
          title="Add to Playlist"
          onClick={() => setShowPlaylists(!showPlaylists)}
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
        {showPlaylists && (
          <div 
            className="playlist-dropdown animate-fade-in" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              position: 'absolute', 
              right: 0, 
              bottom: '100%', 
              marginBottom: '10px',
              zIndex: 100, 
              background: 'rgba(20, 20, 20, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '10px',
              minWidth: '180px',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.5)'
            }}
          >
            <div className="dropdown-header" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              Add to playlist
            </div>
            <div className="dropdown-content">
              <button 
                className="dropdown-item create" 
                onClick={(e) => {
                  e.stopPropagation();
                  const name = window.prompt("Playlist name:");
                  if (name) {
                    const newPlaylist = createPlaylist(name);
                    addToPlaylist(newPlaylist.id, currentTrack);
                  }
                  setShowPlaylists(false);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'transparent', border: 'none', color: 'white', padding: '8px', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }}
              >
                <Plus size={14} /> New Playlist
              </button>
              {playlists.map(p => (
                <button 
                  key={p.id} 
                  className="dropdown-item" 
                  onClick={(e) => {
                    e.stopPropagation();
                    addToPlaylist(p.id, currentTrack);
                    setShowPlaylists(false);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <button 
          className="utility-btn" 
          title="Download" 
          onClick={() => downloadSong(currentTrack)}
        >
          <Download size={16} />
        </button>

        <button className="utility-btn"><Mic2 size={16} /></button>
        <button className="utility-btn"><ListMusic size={16} /></button>
        <button className="utility-btn"><MonitorSpeaker size={16} /></button>
        <div className="volume-wrapper">
          {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          <div className="progress-bar-container volume-bar">
             <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="player-slider"
                style={{ '--progress': `${volume * 100}%` }}
              />
              <div 
                className="player-progress-fill" 
                style={{ width: `${volume * 100}%` }}
              ></div>
          </div>
        </div>
      </div>

      {/* Unified <audio> for all sources (JioSaavn + YouTube via Invidious) */}
      {effectiveStreamUrl && (
        <audio
          ref={audioRef}
          src={effectiveStreamUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={playNext}
          onError={(e) => {
            console.error('Audio element error:', e);
            if (isYoutubeTrack) {
              console.warn('YouTube stream failed, trying next track...');
              // Optional: playNext(); 
            }
          }}
          preload="auto"
          hidden
        />
      )}
    </div>
  );
};

export default PlayerBar;
