/**
 * Dynamically resolves the backend server URL based on the current hostname.
 * Falls back to localhost:5000 if hosted on a public domain (like GitHub Pages)
 * so it can connect to the local server running on the user's computer.
 */
export const getBackendUrl = () => {
  const hostname = window.location.hostname;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.')
  ) {
    return `http://${hostname}:5000`;
  }
  return 'http://localhost:5000';
};
