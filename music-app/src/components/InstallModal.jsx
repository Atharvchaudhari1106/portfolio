import React from 'react';
import { X, Download, Monitor, Smartphone } from 'lucide-react';
import { getBackendUrl } from '../utils/api';

const InstallModal = ({ isOpen, onClose, onInstallPrompt, hasPrompt }) => {
  if (!isOpen) return null;

  const handleDownloadWindows = () => {
    window.open(`${getBackendUrl()}/api/config/download-launcher`, '_blank');
  };

  const handleDownloadUnix = () => {
    window.open(`${getBackendUrl()}/api/config/download-launcher-sh`, '_blank');
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-container glass-card animate-scale-in" style={{ maxWidth: '500px', width: '90%' }}>
        <header className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Download size={22} className="text-accent" />
            <span>Install & Download App</span>
          </h2>
          <button className="icon-btn close-btn" onClick={onClose}><X size={20} /></button>
        </header>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section 1: Standard PWA Web App Install */}
          <div className="install-section glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Monitor size={16} /> 1. Install Web App (Recommended)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Install AesthetiCore directly from your web browser. This creates an app shortcut on your home screen or desktop that runs instantly and supports full-screen borderless mode.
            </p>
            {hasPrompt ? (
              <button className="btn-primary" onClick={onInstallPrompt} style={{ width: '100%' }}>
                Install Now
              </button>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                💡 Click the <strong>Install Icon</strong> in your browser address bar next to the URL (or tap Share &gt; Add to Home Screen in iOS Safari).
              </div>
            )}
          </div>

          {/* Section 2: Portable Desktop Launcher Files */}
          <div className="install-section glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Smartphone size={16} /> 2. Download Offline Desktop Launchers
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Download one-click launch scripts to run AesthetiCore locally on any other computer (installs dependencies and starts the app automatically).
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button className="pill-btn" onClick={handleDownloadWindows} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Download size={14} /> Windows (.bat)
              </button>
              <button className="pill-btn" onClick={handleDownloadUnix} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Download size={14} /> macOS/Linux (.sh)
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default InstallModal;
