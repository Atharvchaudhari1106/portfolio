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
  // 1. Check for user-configured URL in localStorage
  const savedUrl = localStorage.getItem('AESTHETICORE_BACKEND_URL');
  if (savedUrl) {
    return savedUrl.replace(/\/$/, ''); // Trim trailing slash
  }

  const hostname = window.location.hostname;

  // 2. Local / LAN development — ALWAYS connect to local backend.
  //    The backend is co-started by vite.config.js, so if the frontend
  //    is running on localhost / a LAN IP, the backend is guaranteed
  //    to be available on the same host at port 5000.
  //    This removes the previous race condition where LOCAL_BACKEND_ACTIVE
  //    had to be set by a health check *before* any API call was made.
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.')
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
