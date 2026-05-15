import express from 'express';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

// Import Playlist by URL
router.get('/playlist', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Playlist URL is required' });

  // Extract ID from URL
  let playlistId = url;
  try {
    const urlObj = new URL(url);
    playlistId = urlObj.searchParams.get('list') || url;
  } catch (e) {
    // Not a valid URL, treat as ID
  }

  try {
    const response = await youtube.playlists.list({
      part: ['snippet', 'contentDetails'],
      id: [playlistId]
    });

    if (!response.data.items || response.data.items.length === 0) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const playlistInfo = response.data.items[0];
    
    // Fetch items in the playlist
    const itemsResponse = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: playlistId,
      maxResults: 50
    });

    const tracks = itemsResponse.data.items.map(item => ({
      id: item.contentDetails.videoId,
      title: item.snippet.title,
      artist: item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      source: 'youtube',
      duration: 0 // YouTube API items list doesn't provide duration directly, needs another call or client-side handle
    }));

    res.json({
      title: playlistInfo.snippet.title,
      description: playlistInfo.snippet.description,
      thumbnail: playlistInfo.snippet.thumbnails.high?.url,
      tracks
    });
  } catch (error) {
    console.error('Error fetching YouTube playlist:', error);
    res.status(500).json({ error: 'Failed to fetch YouTube playlist' });
  }
});

// Search YouTube
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Search query is required' });

  try {
    const response = await youtube.search.list({
      part: ['snippet'],
      q: q,
      type: ['video'],
      maxResults: 10,
      videoCategoryId: '10' // Music category
    });

    const results = response.data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      source: 'youtube'
    }));

    res.json(results);
  } catch (error) {
    console.error('Error searching YouTube:', error);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
});

export default router;
