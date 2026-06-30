import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Home from './components/Home';
import Search from './components/Search';
import Library from './components/Library';
import NowPlaying from './components/NowPlaying';
import PlayerBar from './components/PlayerBar';
import AuthModal from './components/AuthModal';
import BottomNav from './components/BottomNav';
import SpotifyView from './components/SpotifyView';
import YoutubeView from './components/YoutubeView';
import SpotifyCallback from './components/SpotifyCallback';
import SettingsModal from './components/SettingsModal';
import AIMixModal from './components/AIMixModal';
import InstallModal from './components/InstallModal';
import { useAuth } from './context/AuthContext';

function App() {
  const [activeView, setActiveView] = useState('home');
  const [prevView, setPrevView] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAIMixOpen, setIsAIMixOpen] = useState(false);
  const [isInstallOpen, setIsInstallOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { user } = useAuth();

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

  const handleSetView = (view) => {
    if (view !== activeView) {
      setPrevView(activeView);
      setActiveView(view);
    }
  };

  if (!user) {
    return <AuthModal />;
  }

  const renderView = () => {
    switch (activeView) {
      case 'home': return <Home onOpenAIMix={() => setIsAIMixOpen(true)} onOpenInstallModal={() => setIsInstallOpen(true)} />;
      case 'search': return <Search />;
      case 'library': return (
        <Library 
          setView={handleSetView} 
          onOpenSettings={() => setIsSettingsOpen(true)} 
          onInstall={handleInstallClick}
          showInstallButton={showInstallButton}
          onOpenAIMix={() => setIsAIMixOpen(true)}
        />
      );
      case 'spotify': return <SpotifyView />;
      case 'youtube': return <YoutubeView />;
      case 'spotify-callback': return <SpotifyCallback />;
      case 'nowplaying': return <NowPlaying goBack={() => handleSetView(prevView)} />;
      default: return <Home onOpenAIMix={() => setIsAIMixOpen(true)} onOpenInstallModal={() => setIsInstallOpen(true)} />;
    }
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const isNowPlaying = activeView === 'nowplaying';

  return (
    <div className={`app-container ${isNowPlaying ? 'np-mode' : ''}`}>
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />
      <div className={`sidebar-wrapper ${isSidebarOpen ? 'active' : ''}`}>
        <Sidebar 
          setView={(view) => {
            handleSetView(view);
            setIsSidebarOpen(false);
          }} 
          activeView={activeView} 
          onOpenSettings={() => setIsSettingsOpen(true)}
          onInstall={handleInstallClick}
          showInstallButton={showInstallButton}
          onOpenAIMix={() => setIsAIMixOpen(true)}
          onOpenInstallModal={() => setIsInstallOpen(true)}
        />
      </div>
      
      <main className="main-content">
        <div className="content-overflow-wrapper">
          <div key={activeView} className="animate-fade-in">
            {renderView()}
          </div>
        </div>
      </main>

      {/* Always render player-wrapper to maintain grid, but hide its content in NP mode */}
      <div className="player-wrapper" style={isNowPlaying ? { display: 'none' } : {}}>
        <PlayerBar onOpenNowPlaying={() => handleSetView('nowplaying')} />
      </div>

      <BottomNav 
        activeView={activeView} 
        setView={handleSetView} 
        toggleSidebar={toggleSidebar} 
      />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <AIMixModal isOpen={isAIMixOpen} onClose={() => setIsAIMixOpen(false)} />
      <InstallModal isOpen={isInstallOpen} onClose={() => setIsInstallOpen(false)} onInstallPrompt={handleInstallClick} hasPrompt={!!deferredPrompt} />
    </div>
  );
}

export default App;
