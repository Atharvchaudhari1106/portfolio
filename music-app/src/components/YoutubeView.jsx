import React, { useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { importYoutubePlaylist } from '../services/youtubeService';
import { TvMinimalPlay, Plus, Play, Pause, Trash2, Link, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const YoutubeView = () => {
  const { youtubePlaylists, setYoutubePlaylists } = useMusic();
  const { playTrack, currentTrack, isPlaying } = useAudio();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importProgress, setImportProgress] = useState(null);

  const handleImport = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setImportProgress({ phase: 'Connecting to YouTube...', percent: 15 });

    try {
      setImportProgress({ phase: 'Fetching playlist data (this may take a moment)...', percent: 40 });
      const data = await importYoutubePlaylist(url.trim());
      
      setImportProgress({ phase: `Found ${data.tracks?.length || 0} tracks!`, percent: 90 });

      // Check for duplicate playlists
      const isDuplicate = youtubePlaylists.some(p => 
        p.title === data.title && p.tracks.length === data.tracks.length
      );

      if (isDuplicate) {
        setError('This playlist has already been imported.');
        setImportProgress(null);
        setLoading(false);
        return;
      }

      const newPlaylists = [...youtubePlaylists, data];
      setYoutubePlaylists(newPlaylists);
      localStorage.setItem('youtube_playlists', JSON.stringify(newPlaylists));
      setUrl('');
      
      setImportProgress({ phase: `Successfully imported "${data.title}"!`, percent: 100 });
      setTimeout(() => setImportProgress(null), 2500);
    } catch (e) {
      console.error('Failed to import YouTube playlist', e);
      
      let errorMsg = e.message || 'Failed to import playlist.';
      if (errorMsg.includes('private') || errorMsg.includes('exist')) {
        errorMsg += ' Make sure the playlist is set to Public or Unlisted.';
      }
      
      setError(errorMsg);
      setImportProgress(null);
    } finally {
      setLoading(false);
    }
  };

  const removePlaylist = (index) => {
    const newPlaylists = youtubePlaylists.filter((_, i) => i !== index);
    setYoutubePlaylists(newPlaylists);
    localStorage.setItem('youtube_playlists', JSON.stringify(newPlaylists));
  };

  const handlePlayAll = (playlist) => {
    if (playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks);
    }
  };

  return (
    <div className="youtube-view animate-fade-in">
      <div className="service-header">
        <div className="service-header-icon youtube-icon-bg">
          <TvMinimalPlay size={28} />
        </div>
        <div className="service-header-text">
          <h1>YouTube Music</h1>
          <p>Import and stream your favorite YouTube playlists</p>
        </div>
      </div>

      {/* Import Form */}
      <form onSubmit={handleImport} className="yt-import-form glass-card">
        <div className="yt-import-input-wrap">
          <Link size={18} className="yt-import-icon" />
          <input
            type="text"
            placeholder="Paste YouTube or YouTube Music Playlist URL..."
            className="yt-import-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary yt-import-btn" disabled={loading || !url.trim()}>
          {loading ? (
            <><Loader2 size={18} className="spin" /> Importing...</>
          ) : (
            <><Plus size={18} /> Import</>
          )}
        </button>
      </form>

      {/* Progress Bar */}
      {importProgress && (
        <div className="import-progress glass-card">
          <div className="import-progress-bar">
            <div className="import-progress-fill yt-progress" style={{ width: `${importProgress.percent}%` }} />
          </div>
          <div className="import-progress-text">
            {importProgress.percent === 100 ? <CheckCircle size={16} color="#FF0000" /> : <Loader2 size={16} className="spin" />}
            <span>{importProgress.phase}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="yt-error-msg">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="yt-info-note glass-card">
        <p><strong>Tip:</strong> Paste any public or <strong>unlisted</strong> playlist URL. Both YouTube and YouTube Music URLs are supported.</p>
        <p><strong>Supported formats:</strong></p>
        <ul style={{ margin: '4px 0', paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <li><code>https://youtube.com/playlist?list=...</code></li>
          <li><code>https://music.youtube.com/playlist?list=...</code></li>
          <li><code>https://music.youtube.com/browse/VL...</code></li>
        </ul>
      </div>

      {/* Playlists */}
      {youtubePlaylists.length === 0 ? (
        <div className="service-empty">
          <TvMinimalPlay size={56} />
          <h3>No playlists imported yet</h3>
          <p>Paste a public YouTube playlist link above to get started</p>
        </div>
      ) : (
        <div className="yt-playlists">
          {youtubePlaylists.map((playlist, pIndex) => (
            <section key={pIndex} className="home-section">
              <div className="section-header-flex">
                <h3 className="section-title">
                  {playlist.title}
                  <span className="playlist-track-count">({playlist.tracks.length} tracks)</span>
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn-primary"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                    onClick={() => handlePlayAll(playlist)}
                  >
                    <Play size={14} fill="currentColor" /> Play All
                  </button>
                  <button
                    className="yt-remove-btn"
                    onClick={() => removePlaylist(pIndex)}
                    title="Remove playlist"
                  >
                    <Trash2 size={16} /> Remove
                  </button>
                </div>
              </div>
              <div className="mixes-grid">
                {playlist.tracks.slice(0, 12).map(song => (
                  <div
                    key={song.id}
                    className={`mix-card glass-card group ${currentTrack?.id === song.id ? 'active-card' : ''}`}
                    onClick={() => playTrack(song, playlist.tracks)}
                  >
                    <div className="mix-image-container">
                      <img src={song.thumbnail} alt={song.title} />
                      <div className="mix-play-overlay">
                        {currentTrack?.id === song.id && isPlaying
                          ? <Pause size={32} fill="white" />
                          : <Play size={32} fill="white" />
                        }
                      </div>
                      <span className="yt-source-badge">YT</span>
                    </div>
                    <div className="mix-info">
                      <p className="mix-title">{song.title}</p>
                      <p className="mix-desc">{song.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
              {playlist.tracks.length > 12 && (
                <p className="show-more-text" onClick={() => handlePlayAll(playlist)}>
                  + {playlist.tracks.length - 12} more tracks — Play All to hear them
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default YoutubeView;
