import express from 'express';
import axios from 'axios';
import https from 'https';

const router = express.Router();

const agent = new https.Agent({
  rejectUnauthorized: false
});

// Proxy JioSaavn API search requests to avoid CORS and local client network blocks
router.get('/saavn/search/songs', async (req, res) => {
  const queryParams = req.query;
  const targetUrl = 'https://jiosaavn-api-beta.vercel.app/search/songs';

  try {
    const response = await axios.get(targetUrl, {
      params: queryParams,
      timeout: 15000,
      httpsAgent: agent
    });
    res.json(response.data);
  } catch (error) {
    console.error(`[Saavn Proxy] Error fetching from ${targetUrl}:`, error.message);
    res.status(error.response?.status || 500).json({
      error: error.message || 'Failed to fetch from JioSaavn API'
    });
  }
});

export default router;
