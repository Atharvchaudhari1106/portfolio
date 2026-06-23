import React, { useState } from 'react';
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
import { useAuth } from './context/AuthContext';

function App() {
  const [activeView, setActiveView] = useState('home');
  const [prevView, setPrevView] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { user } = useAuth();

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
      case 'home': return <Home />;
      case 'search': return <Search />;
      case 'library': return <Library setView={handleSetView} onOpenSettings={() => setIsSettingsOpen(true)} />;
      case 'spotify': return <SpotifyView />;
      case 'youtube': return <YoutubeView />;
      case 'spotify-callback': return <SpotifyCallback />;
      case 'nowplaying': return <NowPlaying goBack={() => handleSetView(prevView)} />;
      default: return <Home />;
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
    </div>
  );
}

export default App;
