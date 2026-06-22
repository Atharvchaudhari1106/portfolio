import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getRecommendations } from '../services/musicService';

const AudioContext = createContext();

export const useAudio = () => useContext(AudioContext);

export const AudioProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [queue, setQueue] = useState([]);
  const [originalQueue, setOriginalQueue] = useState([]);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'all' | 'one'
  
  const [library, setLibrary] = useState(() => {
    const saved = localStorage.getItem('music-library');
    try {
      const parsed = saved ? JSON.parse(saved) : [];
      let needsSave = false;
      const cleaned = parsed.map(t => {
        if (t.source === 'youtube') {
          const expectedThumb = `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`;
          if (t.thumbnail !== expectedThumb) {
            needsSave = true;
            return { ...t, thumbnail: expectedThumb };
          }
        }
        return t;
      });
      if (needsSave && cleaned.length > 0) {
        localStorage.setItem('music-library', JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return [];
    }
  });

  const [playlists, setPlaylists] = useState(() => {
    const saved = localStorage.getItem('music-playlists');
    try {
      const parsed = saved ? JSON.parse(saved) : [];
      let needsSave = false;
      const cleaned = parsed.map(p => {
        const firstTrackId = p.tracks?.[0]?.id;
        const fallbackPlaylistThumb = (p.tracks?.[0]?.source === 'youtube' && firstTrackId) ? `https://i.ytimg.com/vi/${firstTrackId}/hqdefault.jpg` : '';
        const origThumb = p.thumbnail || '';
        let cleanThumb = origThumb.includes('?') ? origThumb.split('?')[0] : origThumb;
        if (!cleanThumb && fallbackPlaylistThumb) {
          cleanThumb = fallbackPlaylistThumb;
          needsSave = true;
        }

        const tracks = p.tracks?.map(t => {
          if (t.source === 'youtube') {
            const expectedThumb = `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`;
            if (t.thumbnail !== expectedThumb) {
              needsSave = true;
              return { ...t, thumbnail: expectedThumb };
            }
          }
          return t;
        }) || [];

        return { ...p, thumbnail: cleanThumb, tracks };
      });
      if (needsSave && cleaned.length > 0) {
        localStorage.setItem('music-playlists', JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('music-library', JSON.stringify(library));
  }, [library]);

  useEffect(() => {
    localStorage.setItem('music-playlists', JSON.stringify(playlists));
  }, [playlists]);

  const toggleShuffle = () => {
    if (!isShuffled) {
      setOriginalQueue([...queue]);
      const shuffled = [...queue].sort(() => Math.random() - 0.5);
      // Ensure current track is still at the right place or handle it
      setQueue(shuffled);
    } else {
      setQueue(originalQueue);
    }
    setIsShuffled(!isShuffled);
  };

  const toggleRepeat = () => {
    const modes = ['off', 'all', 'one'];
    const nextMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    setRepeatMode(nextMode);
  };

  const playTrack = (track, newQueue = []) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    if (newQueue.length > 0) {
      setQueue(newQueue);
      setOriginalQueue(newQueue);
      if (isShuffled) {
        const shuffled = [...newQueue].sort(() => Math.random() - 0.5);
        setQueue(shuffled);
      }
    } else if (!queue.find(t => t.id === track.id)) {
      setQueue([track]);
      setOriginalQueue([track]);
    }
  };

  const playNext = async () => {
    console.log('AudioContext: playNext called', { queueLength: queue.length, currentTrackId: currentTrack?.id });
    if (!currentTrack || queue.length === 0) return;
    
    if (repeatMode === 'one') {
      const track = currentTrack;
      setCurrentTrack(null);
      setTimeout(() => setCurrentTrack(track), 10);
      return;
    }

    const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
    const nextIndex = currentIndex + 1;

    if (nextIndex < queue.length) {
      console.log(`AudioContext: skipping to next track at index ${nextIndex}`);
      setCurrentTrack(queue[nextIndex]);
    } else if (repeatMode === 'all') {
      console.log('AudioContext: end of queue reached, looping to start');
      setCurrentTrack(queue[0]);
    } else {
      console.log('AudioContext: end of queue reached, fetching recommendations...');
      const recommendations = await getRecommendations(currentTrack);
      
      if (recommendations && recommendations.length > 0) {
        // Add unique songs to the queue
        const newSongs = recommendations.filter(s => !queue.find(qS => qS.id === s.id));
        if (newSongs.length > 0) {
          setQueue([...queue, ...newSongs]);
          setCurrentTrack(newSongs[0]);
          return;
        }
      }
      
      console.log('AudioContext: no recommendations found, stopping playback');
      setIsPlaying(false);
    }
  };

  const playPrevious = () => {
    console.log('AudioContext: playPrevious called');
    if (!currentTrack || queue.length === 0) return;
    const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
    const prevIndex = currentIndex - 1;

    if (prevIndex >= 0) {
      console.log(`AudioContext: skipping to previous track at index ${prevIndex}`);
      setCurrentTrack(queue[prevIndex]);
    } else if (repeatMode === 'all') {
      console.log('AudioContext: start of queue reached, looping to end');
      setCurrentTrack(queue[queue.length - 1]);
    } else {
      // If at the beginning, just restart the song
      const track = currentTrack;
      setCurrentTrack(null);
      setTimeout(() => setCurrentTrack(track), 10);
    }
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const addToLibrary = (track) => {
    if (!library.find(t => t.id === track.id)) {
      setLibrary([...library, track]);
    }
  };

  const removeFromLibrary = (trackId) => {
    setLibrary(library.filter(t => t.id !== trackId));
  };

  const createPlaylist = (name = "New Playlist") => {
    const newPlaylist = {
      id: Date.now().toString(),
      name,
      tracks: [],
      createdAt: new Date().toISOString()
    };
    setPlaylists([...playlists, newPlaylist]);
    return newPlaylist;
  };

  const addToPlaylist = (playlistId, track) => {
    setPlaylists(playlists.map(p => {
      if (p.id === playlistId && !p.tracks.find(t => t.id === track.id)) {
        return { ...p, tracks: [...p.tracks, track] };
      }
      return p;
    }));
  };

  const value = {
    currentTrack,
    isPlaying,
    volume,
    library,
    queue,
    isShuffled,
    repeatMode,
    playlists,
    playTrack,
    playNext,
    playPrevious,
    togglePlay,
    toggleShuffle,
    toggleRepeat,
    setVolume,
    setIsPlaying,
    addToLibrary,
    removeFromLibrary,
    createPlaylist,
    addToPlaylist
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};



