import React, { useState } from 'react';
import { Plus, Play, Heart, Music2, MoreVertical, X, Check, Settings, TvMinimalPlay } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import TrackRow from './TrackRow';

const Library = ({ setView, onOpenSettings }) => {
  const { library, playlists, createPlaylist, playTrack, addToPlaylist, currentTrack } = useAudio();
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleCreatePlaylist = () => {
    setShowNewPlaylist(true);
    setNewPlaylistName('My Playlist #' + (playlists.length + 1));
  };

  const confirmCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      createPlaylist(newPlaylistName.trim());
      setShowNewPlaylist(false);
      setNewPlaylistName('');
    }
  };

  const cancelCreatePlaylist = () => {
    setShowNewPlaylist(false);
    setNewPlaylistName('');
  };

  const handlePlayPlaylist = (e, tracks) => {
    e.stopPropagation();
    if (tracks && tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  return (
    <div className="pulse-library animate-fade-in">
      <header className="pulse-library-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="pulse-page-title" style={{ margin: 0 }}>Your Library</h1>
        <button 
          onClick={onOpenSettings} 
          className="icon-btn settings-mobile-btn" 
          title="API Settings"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'all 0.2s ease'
          }}
        >
          <Settings size={22} />
        </button>
      </header>

      {/* Import Shortcuts for Mobile & Desktop */}
      <div className="pulse-imports-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '15px',
        marginBottom: '25px'
      }}>
        <div 
          className="import-shortcut-card glass-card group" 
          onClick={() => setView('spotify')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px',
            cursor: 'pointer',
            borderRadius: '16px',
            textAlign: 'center',
            transition: 'all 0.2s ease',
            border: '1px solid rgba(255,255,255,0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div className="import-icon-wrap" style={{
            background: 'rgba(29, 185, 84, 0.1)',
            color: '#1DB954',
            borderRadius: '50%',
            padding: '10px',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Music2 size={22} />
          </div>
          <h4 style={{ margin: '4px 0 2px 0', fontSize: '13px', fontWeight: 'bold' }}>Spotify Import</h4>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Play public lists</span>
        </div>

        <div 
          className="import-shortcut-card glass-card group" 
          onClick={() => setView('youtube')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px',
            cursor: 'pointer',
            borderRadius: '16px',
            textAlign: 'center',
            transition: 'all 0.2s ease',
            border: '1px solid rgba(255,255,255,0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div className="import-icon-wrap" style={{
            background: 'rgba(255, 0, 0, 0.1)',
            color: '#FF0000',
            borderRadius: '50%',
            padding: '10px',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TvMinimalPlay size={22} />
          </div>
          <h4 style={{ margin: '4px 0 2px 0', fontSize: '13px', fontWeight: 'bold' }}>YouTube Import</h4>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Play any playlist</span>
        </div>
      </div>

      {/* Liked Songs Hero */}
      <div className="pulse-liked-hero glass-card" onClick={() => library.length > 0 && playTrack(library[0], library)}>
        <div className="pulse-liked-gradient"></div>
        <div className="pulse-liked-content">
          <div className="pulse-liked-icon-wrap">
            <Heart size={32} fill="white" />
          </div>
          <div className="pulse-liked-info">
            <h2>Liked Songs</h2>
            <p>{library.length} tracks</p>
          </div>
        </div>
        {library.length > 0 && (
          <button className="pulse-liked-play neon-glow" onClick={(e) => handlePlayPlaylist(e, library)}>
            <Play size={24} fill="currentColor" />
          </button>
        )}
      </div>

      {/* Followed Artists */}
      {library.length > 0 && (
        <section className="pulse-lib-section">
          <h3 className="pulse-section-title">Followed Artists</h3>
          <div className="pulse-artists-scroll">
            {/* Deduplicate artists */}
            {[...new Map(library.map(t => [t.artist, t])).values()].slice(0, 6).map((track, idx) => (
              <div key={idx} className="pulse-artist-chip">
                <div className="pulse-artist-avatar">
                  <img src={track.thumbnail} alt={track.artist} />
                </div>
                <span className="pulse-artist-name">{track.artist}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Custom Playlists */}
      <section className="pulse-lib-section">
        <div className="pulse-section-header">
          <h3 className="pulse-section-title">Custom Playlists</h3>
          <button className="pulse-add-btn" onClick={handleCreatePlaylist}>
            <Plus size={20} />
          </button>
        </div>

        {/* Inline Playlist Creator */}
        {showNewPlaylist && (
          <div className="pulse-new-playlist-form glass-card">
            <input
              type="text"
              className="pulse-playlist-input"
              placeholder="Playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmCreatePlaylist()}
              autoFocus
            />
            <div className="pulse-playlist-form-actions">
              <button className="pulse-form-btn cancel" onClick={cancelCreatePlaylist}>
                <X size={18} />
              </button>
              <button className="pulse-form-btn confirm" onClick={confirmCreatePlaylist}>
                <Check size={18} />
              </button>
            </div>
          </div>
        )}

        <div className="pulse-playlists-list">
          {playlists.map((playlist) => (
            <div key={playlist.id} className="pulse-playlist-row glass-card" onClick={(e) => handlePlayPlaylist(e, playlist.tracks)}>
              <div className="pulse-playlist-art">
                {playlist.tracks.length > 0 ? (
                  <img src={playlist.tracks[0].thumbnail} alt={playlist.name} />
                ) : (
                  <div className="pulse-playlist-placeholder">
                    <Music2 size={20} />
                  </div>
                )}
              </div>
              <div className="pulse-playlist-info">
                <h4>{playlist.name}</h4>
                <p>Playlist • {playlist.tracks.length} songs</p>
              </div>
              <Play size={20} className="pulse-playlist-play-icon" />
            </div>
          ))}
          {playlists.length === 0 && !showNewPlaylist && (
            <div className="pulse-empty-playlists glass-card">
              <Music2 size={32} strokeWidth={1} />
              <p>Create your first playlist</p>
              <button className="pulse-create-btn neon-glow" onClick={handleCreatePlaylist}>
                <Plus size={16} /> New Playlist
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Liked Tracks List */}
      {library.length > 0 && (
        <section className="pulse-lib-section">
          <h3 className="pulse-section-title">Recently Liked</h3>
          <div className="trending-list">
            {library.slice(0, 8).map((track, index) => (
              <TrackRow 
                key={track.id} 
                track={track} 
                index={index} 
                queueContext={library} 
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Library;
