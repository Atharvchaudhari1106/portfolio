import axios from 'axios';

const API_URL = 'http://localhost:5000/api/youtube';

export const importYoutubePlaylist = async (url) => {
  const response = await axios.get(`${API_URL}/playlist`, { params: { url } });
  return response.data;
};

export const searchYoutube = async (query) => {
  try {
    const response = await axios.get(`${API_URL}/search`, { 
      params: { q: query },
      timeout: 5000
    });
    return response.data;
  } catch (err) {
    // Gracefully return empty when backend is not running
    console.warn('YouTube search unavailable:', err.message);
    return [];
  }
};

export const getYoutubeStreamUrl = (videoId) => {
  return `https://www.youtube.com/watch?v=${videoId}`;
};
