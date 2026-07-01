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
    <div 
      className="auth-modal-overlay" 
      style={{ 
        zIndex: 99999,
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div 
        className="auth-modal animate-scale-in" 
        style={{ 
          background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.8) 0%, rgba(36, 59, 85, 0.8) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '30px',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          color: '#fff',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            right: '20px', 
            top: '20px', 
            background: 'rgba(255, 255, 255, 0.05)', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.7)', 
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.transform = 'rotate(90deg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            e.currentTarget.style.transform = 'rotate(0deg)';
          }}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <header style={{ marginBottom: '24px' }}>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '800', 
            margin: '0', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            fontFamily: 'Outfit, sans-serif'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #1ed760 0%, #1db954 100%)',
              borderRadius: '12px',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px rgba(30, 215, 96, 0.3)'
            }}>
              <Download size={22} color="#000" />
            </div>
            <span>Install & Download App</span>
          </h2>
        </header>

        {/* Modal Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section 1: Standard PWA Web App Install */}
          <div 
            style={{ 
              padding: '20px', 
              background: 'rgba(255, 255, 255, 0.03)', 
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              transition: 'all 0.3s ease'
            }}
          >
            <h3 style={{ 
              margin: '0 0 10px 0', 
              fontSize: '16px', 
              fontWeight: '700', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              fontFamily: 'Outfit, sans-serif'
            }}>
              <Monitor size={18} style={{ color: '#1ed760' }} />
              <span>1. Install Web App (Recommended)</span>
            </h3>
            <p style={{ 
              fontSize: '13px', 
              color: 'rgba(255, 255, 255, 0.6)', 
              lineHeight: '1.6', 
              margin: '0 0 16px 0' 
            }}>
              Install AesthetiCore directly from your web browser. This creates an app shortcut on your home screen or desktop that runs instantly and supports full-screen borderless mode.
            </p>
            {hasPrompt ? (
              <button 
                className="btn-primary" 
                onClick={onInstallPrompt} 
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '12px',
                  fontWeight: '700',
                  fontSize: '14px',
                  background: 'linear-gradient(135deg, #1ed760 0%, #1db954 100%)',
                  color: '#000',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(30, 215, 96, 0.2)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(30, 215, 96, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 215, 96, 0.2)';
                }}
              >
                Install Now
              </button>
            ) : (
              <div style={{ 
                background: 'rgba(30, 215, 96, 0.08)', 
                padding: '12px 16px', 
                borderRadius: '12px', 
                fontSize: '12px', 
                color: '#1ed760',
                border: '1px solid rgba(30, 215, 96, 0.2)',
                lineHeight: '1.5'
              }}>
                💡 Click the <strong>Install Icon</strong> in your browser address bar next to the URL (or tap Share &gt; Add to Home Screen in iOS Safari).
              </div>
            )}
          </div>

          {/* Section 2: Portable Desktop Launcher Files */}
          <div 
            style={{ 
              padding: '20px', 
              background: 'rgba(255, 255, 255, 0.03)', 
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              transition: 'all 0.3s ease'
            }}
          >
            <h3 style={{ 
              margin: '0 0 10px 0', 
              fontSize: '16px', 
              fontWeight: '700', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              fontFamily: 'Outfit, sans-serif'
            }}>
              <Smartphone size={18} style={{ color: '#1ed760' }} />
              <span>2. Download Offline Desktop Launchers</span>
            </h3>
            <p style={{ 
              fontSize: '13px', 
              color: 'rgba(255, 255, 255, 0.6)', 
              lineHeight: '1.6', 
              margin: '0 0 16px 0' 
            }}>
              Download one-click launch scripts to run AesthetiCore locally on any other computer (installs dependencies and starts the app automatically).
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                onClick={handleDownloadWindows} 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.06)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: 'white', 
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Download size={15} style={{ color: '#1ed760' }} /> 
                <span>Windows (.bat)</span>
              </button>
              <button 
                onClick={handleDownloadUnix} 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.06)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: 'white', 
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Download size={15} style={{ color: '#1ed760' }} /> 
                <span>macOS/Linux (.sh)</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default InstallModal;
