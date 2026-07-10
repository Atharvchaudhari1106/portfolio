/**
 * Dynamically resolves the backend server URL.
 * 
 * Priority:
 * 1. User-saved URL in localStorage (from Settings modal)
 * 2. If running on localhost/LAN → use same hostname with port 5000 (local dev)
 * 3. If running on a deployed frontend → use the Render backend URL
 */

// ⚠️ AFTER DEPLOYING TO RENDER: Replace this with your actual Render URL
// Example: 'https://aestheticore-backend.onrender.com'
const RENDER_BACKEND_URL = 'https://aestheticore-backend.onrender.com';

export const getBackendUrl = () => {
  const hostname = window.location.hostname;
  const isLocalActive = localStorage.getItem('LOCAL_BACKEND_ACTIVE') !== 'false';

  // 1. Check for user-configured URL in localStorage
  const savedUrl = localStorage.getItem('AESTHETICORE_BACKEND_URL');
  if (savedUrl) {
    const trimmed = savedUrl.replace(/\/$/, '');
    const isSavedLocal = trimmed.includes('localhost') || 
                          trimmed.includes('127.0.0.1') || 
                          trimmed.includes('192.168.') || 
                          trimmed.includes('10.') || 
                          trimmed.includes('172.');
    
    // Only use saved local backend URL if we are running locally OR the local server is verified active
    if (!isSavedLocal || isLocalActive || hostname === 'localhost' || hostname === '127.0.0.1') {
      return trimmed;
    }
  }

  // 2. Local / LAN development — connect to local backend only if active.
  if (
    isLocalActive &&
    (hostname === 'localhost' ||
     hostname === '127.0.0.1' ||
     hostname.startsWith('192.168.') ||
     hostname.startsWith('10.') ||
     hostname.startsWith('172.'))
  ) {
    return `http://${hostname}:5000`;
  }

  // 3. Deployed frontend — connect to Render backend
  if (RENDER_BACKEND_URL) {
    return RENDER_BACKEND_URL;
  }

  // Fallback
  return `http://${hostname}:5000`;
};
