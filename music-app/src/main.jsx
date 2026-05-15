import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { AudioProvider } from './context/AudioContext.jsx';
import { MusicProvider } from './context/MusicContext.jsx';
import './index.css';
import './App.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AudioProvider>
        <MusicProvider>
          <App />
        </MusicProvider>
      </AudioProvider>
    </AuthProvider>
  </React.StrictMode>,
);
