import React, { useState, useEffect } from 'react';
import { Home, Search, Library, Plus, ArrowRight, LogOut, Download, Disc, Music2, TvMinimalPlay, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { getSpotifyLoginUrl } from '../services/spotifyService';
import SettingsModal from './SettingsModal';
import logo from '../assets/logo.png';

const Sidebar = ({ setView, activeView }) => {
  const { logout, user } = useAuth();
  const { createPlaylist } = useAudio();
  const { spotifyToken } = useMusic();
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSpotifyLogin = async () => {
    try {
      const url = await getSpotifyLoginUrl();
      window.location.href = url;
    } catch (e) {
      console.error('Failed to get Spotify login URL', e);
      alert('Failed to connect to Spotify. Is the server running?');
    }
  };

  const handleCreatePlaylist = () => {
    const name = window.prompt("Playlist name:");
    if (name) {
      createPlaylist(name);
    }
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);
    
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(isStandaloneMode);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        setDeferredPrompt(null);
      });
    } else if (isIOS) {
      alert("📱 To install AesthetiCore on your iPhone:\n\n1. Tap the 'Share' icon (square with up arrow) at the bottom.\n2. Scroll down and tap 'Add to Home Screen'.\n3. Tap 'Add' in the top right.");
    } else {
      alert("📱 To install AesthetiCore:\n\n1. Tap the menu icon (three dots) in your browser.\n2. Tap 'Install App' or 'Add to Home Screen'.\n\nThis will add a shortcut to your home screen for a full-screen experience!");
    }
  };

  const showInstallButton = (deferredPrompt || isIOS || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) && !isStandalone;

  return (
    <div className="sidebar">
      <div className="sidebar-logo" onClick={() => setView('home')} style={{ cursor: 'pointer' }}>
        <img src={logo} alt="AesthetiCore Logo" />
        <span>AesthetiCore</span>
      </div>
      {/* Block 1: Navigation */}
      <div className="sidebar-section nav-section">
        <button
          className={`nav-item ${activeView === 'home' ? 'active' : ''}`}
          onClick={() => setView('home')}
        >
          <Home size={24} />
          <span>Home</span>
        </button>
        <button
          className={`nav-item ${activeView === 'search' ? 'active' : ''}`}
          onClick={() => setView('search')}
        >
          <Search size={24} />
          <span>Search</span>
        </button>
        <button
          className={`nav-item ${activeView === 'spotify' ? 'active' : ''}`}
          onClick={() => setView('spotify')}
        >
          <Music2 size={24} color="#1DB954" />
          <span>Spotify</span>
        </button>
        <button
          className={`nav-item ${activeView === 'youtube' ? 'active' : ''}`}
          onClick={() => setView('youtube')}
        >
          <TvMinimalPlay size={24} color="#FF0000" />
          <span>YouTube</span>
        </button>

        {showInstallButton && (
          <div className="install-banner" style={{ padding: '8px 16px', marginTop: '8px' }}>
            <button
              className="pill-btn"
              onClick={handleInstallClick}
              style={{ 
                width: '100%', 
                background: 'var(--accent-primary)', 
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Download size={18} />
              <span>Install App</span>
            </button>
          </div>
        )}
      </div>

      {/* Block 2: Your Library */}
      <div className="sidebar-section library-section">
        <div className="library-header">
          <button 
            className={`nav-item ${activeView === 'library' ? 'active' : ''}`}
            onClick={() => setView('library')}
          >
            <Library size={24} />
            <span>Your Library</span>
          </button>
          <div className="library-actions">
            <button className="icon-btn" title="Create playlist" onClick={handleCreatePlaylist}><Plus size={20} /></button>
            <button className="icon-btn" title="Show more"><ArrowRight size={20} /></button>
          </div>
        </div>
        
        <div className="library-content">
          <div className="sidebar-card spotify-card">
            <Music2 size={24} color="#1DB954" />
            <h4>Import Spotify</h4>
            <p>Paste a playlist URL to stream</p>
            <button className="pill-btn spotify-btn" onClick={() => setView('spotify')}>Import</button>
          </div>
          
          <div className="sidebar-card youtube-card">
            <TvMinimalPlay size={24} color="#FF0000" />
            <h4>Import YouTube</h4>
            <p>Paste a playlist URL to stream</p>
            <button className="pill-btn youtube-btn" onClick={() => setView('youtube')}>Import</button>
          </div>

          <div className="sidebar-footer">
            <div className="user-profile">
              <div className="user-info">
                <span className="user-name">{user?.name || 'User'}</span>
              </div>
              <button className="logout-btn" onClick={() => setIsSettingsOpen(true)} title="API Settings" style={{ marginRight: '8px' }}>
                <Settings size={20} />
              </button>
              <button className="logout-btn" onClick={logout} title="Logout">
                <LogOut size={20} />
              </button>
            </div>
            <div className="footer-links">
              <a href="#">Legal</a>
              <a href="#">Safety & Privacy Center</a>
              <a href="#">Privacy Policy</a>
              <a href="#">Cookies</a>
              <a href="#">About Ads</a>
              <a href="#">Accessibility</a>
            </div>
            <button className="lang-btn">
               English
            </button>
          </div>
        </div>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default Sidebar;
