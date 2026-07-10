import { getBackendUrl } from '../utils/api';
import { searchYoutube } from './youtubeService';

const getSaavnApiUrl = () => `${getBackendUrl()}/api/music/saavn`;

/**
 * Map a JioSaavn API song item to our internal track format.
 * NOTE: JioSaavn CDN (aac.saavncdn.com) is broken — all audio URLs return 404.
 * We use JioSaavn ONLY for metadata (title, artist, album art, play count).
 * Stream URLs are never extracted from JioSaavn responses.
 */
const mapSaavnMetadata = (item) => {
  // Handle image structure variations — image CDN (c.saavncdn.com) still works
  let thumbnail = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300"><rect width="100%" height="100%" fill="%23121212"/><circle cx="150" cy="150" r="60" fill="%23181818" stroke="%23333" stroke-width="2"/><path d="M145 100v75c-5-3-12-5-20-5-16 0-30 11-30 25s14 25 30 25 30-11 30-25v-65h40v-30h-50z" fill="%231ed760"/></svg>';
  if (Array.isArray(item.image) && item.image.length > 0) {
    const img = item.image[item.image.length - 1];
    thumbnail = img.url || img.link;
  } else if (typeof item.image === 'string') {
    thumbnail = item.image;
  } else if (item.thumbnail) {
    thumbnail = item.thumbnail;
  }

  // Ensure HTTPS for images
  if (thumbnail.startsWith('http:')) {
    thumbnail = thumbnail.replace('http:', 'https:');
  }

  return {
    id: item.id,
    title: item.name?.replace(/&quot;/g, '"')?.replace(/&amp;/g, '&') || 'Unknown',
    artist: item.primaryArtists || 'Unknown Artist',
    thumbnail,
    duration: parseInt(item.duration) || 0,
    streamUrl: null, // JioSaavn CDN is broken — do NOT use download URLs
    album: item.album?.name || '',
    year: item.year || '',
    playCount: parseInt(item.playCount) || 0
  };
};

/**
 * Normalize a string for fuzzy comparison.
 */
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/feat\.?.*$/i, '')
    .replace(/ft\.?.*$/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const searchMusic = async (query) => {
  // Search YouTube and JioSaavn in PARALLEL
  // YouTube = streaming source, JioSaavn = metadata enrichment
  const [ytResult, saavnResult] = await Promise.allSettled([
    // YouTube search — primary source for playable tracks
    searchYoutube(query).then(tracks => {
      if (!tracks || tracks.length === 0) return [];
      return tracks.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        thumbnail: track.thumbnail,
        duration: track.duration || 0,
        streamUrl: `${getBackendUrl()}/api/youtube/stream?videoId=${track.id}`,
        source: 'youtube',
        album: track.album || '',
        year: track.year || '',
        playCount: track.playCount || 0
      }));
    }).catch(err => {
      console.warn('YouTube search failed:', err.message);
      return [];
    }),

    // JioSaavn search — metadata only (better album art, play counts, accurate titles)
    fetch(`${getSaavnApiUrl()}/search/songs?query=${encodeURIComponent(query)}&limit=20`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        const results = data.data?.results || data.results;
        if (results) {
          return results.map(mapSaavnMetadata);
        }
        return [];
      })
      .catch(err => {
        console.warn('JioSaavn metadata fetch failed:', err.message);
        return [];
      })
  ]);

  const ytTracks = ytResult.status === 'fulfilled' ? ytResult.value : [];
  const saavnMeta = saavnResult.status === 'fulfilled' ? saavnResult.value : [];

  // Enrich YouTube tracks with JioSaavn metadata (better thumbnails, play counts)
  const enriched = ytTracks.map(yt => {
    const normYtTitle = normalize(yt.title);
    const normYtArtist = normalize(yt.artist);

    // Find a matching JioSaavn entry by title similarity
    const match = saavnMeta.find(s => {
      const normSTitle = normalize(s.title);
      const normSArtist = normalize(s.artist);
      // Check if titles share significant overlap
      return normSTitle && normYtTitle &&
        (normYtTitle.includes(normSTitle) || normSTitle.includes(normYtTitle));
    });

    if (match) {
      return {
        ...yt,
        // Use JioSaavn's higher-quality album art if available
        thumbnail: match.thumbnail && !match.thumbnail.includes('placeholder')
          ? match.thumbnail : yt.thumbnail,
        // Use JioSaavn's more accurate metadata
        album: match.album || yt.album,
        year: match.year || yt.year,
        playCount: match.playCount || yt.playCount,
        duration: match.duration || yt.duration,
      };
    }
    return yt;
  });

  // Find JioSaavn tracks that were NOT matched into YouTube tracks
  const unmatchedSaavn = saavnMeta.filter(s => {
    const normSTitle = normalize(s.title);
    return !ytTracks.some(yt => {
      const normYtTitle = normalize(yt.title);
      return normSTitle && normYtTitle &&
        (normYtTitle.includes(normSTitle) || normSTitle.includes(normYtTitle));
    });
  });

  // Combine enriched YouTube tracks and unmatched JioSaavn tracks
  const combined = [...enriched, ...unmatchedSaavn];

  // Deduplicate by normalized title + primary artist
  const seen = new Set();
  return combined.filter(song => {
    const key = `${(song.title || '').toLowerCase().trim()}-${(song.artist || '').split(',')[0].toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const getTrending = async () => {
  // Use specific album/artist searches so the first result is always the original
  // Include album name to avoid instrumentals/remixes being returned first
  const hits = [
    'Tauba Tauba Bad Newz Karan Aujla',
    'Kesariya Brahmastra Arijit Singh',
    'Aayi Nai AP Dhillon',
    'Sajni Jal The Band',
    'O Maahi Dunki Arijit Singh',
    'Heeriye Arijit Singh',
    'Tum Se Hi Jab We Met',
    'Raataan Lambiyan Shershaah',
  ];

  const promises = hits.map(async (hit) => {
    try {
      const res = await searchMusic(hit);
      const filtered = res.filter(song => {
        if (!song.streamUrl) return false;
        const lower = song.title.toLowerCase();
        const badKeywords = ['instrumental', 'karaoke', 'ringtone', 'bgm', 'background'];
        return !badKeywords.some(k => lower.includes(k));
      });

      // Sort by play count to get original version first
      const sorted = filtered.sort((a, b) => b.playCount - a.playCount);
      return sorted.length > 0 ? sorted[0] : null;
    } catch (err) {
      console.warn(`Failed to fetch: ${hit}`, err.message);
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter(Boolean);
};

export const getRecommendations = async (song) => {
  if (!song || !song.artist) return [];
  
  try {
    // Search for the primary artist to find similar/related tracks
    // Extracting first name or main artist to broaden the search if needed
    const mainArtist = song.artist.split(',')[0].trim();
    const results = await searchMusic(mainArtist);
    
    // Filter out the current song and ensure we have unique recommendations
    return results.filter(s => s.id !== song.id).slice(0, 10);
  } catch (error) {
    console.error('Failed to get recommendations:', error);
    return [];
  }
};

export const getHomeSuggestions = async (searchTerms) => {
  if (!searchTerms || searchTerms.length === 0) {
    return null;
  }
  
  const categories = [];
  // Use up to 4 recent terms to build personalized sections
  const termsToUse = searchTerms.slice(0, 4);
  
  for (const term of termsToUse) {
    try {
      const results = await searchMusic(term);
      const filtered = results.filter(song => {
        if (!song.streamUrl) return false;
        const lower = song.title.toLowerCase();
        const badKeywords = ['instrumental', 'karaoke', 'ringtone', 'bgm'];
        return !badKeywords.some(k => lower.includes(k));
      });
      
      // Ensure we have enough tracks to make a section look good
      if (filtered.length >= 4) {
        categories.push({
          id: `suggestion-${term}`,
          title: `Inspired by "${term}"`,
          tracks: filtered.slice(0, 6)
        });
      }
    } catch (err) {
      console.error(`Failed to fetch suggestions for: ${term}`, err);
    }
  }
  
  return categories.length > 0 ? categories : null;
};

export const downloadSong = async (song) => {
  if (!song || !song.streamUrl) {
    alert("This song is not available for download.");
    return;
  }
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Show a toast notification since fetch can take a few seconds
  const toast = document.createElement('div');
  toast.innerText = `Preparing download for "${song.title}"...`;
  toast.style.position = 'fixed';
  toast.style.bottom = '120px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.background = 'var(--accent-primary, #1ed760)';
  toast.style.color = '#000';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '50px';
  toast.style.zIndex = '9999';
  toast.style.fontWeight = 'bold';
  toast.style.fontSize = '14px';
  toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
  toast.style.transition = 'opacity 0.3s ease';
  document.body.appendChild(toast);

  // For mobile, open a tab SYNCHRONOUSLY before the async fetch
  let mobileTab = null;
  if (isMobile) {
    mobileTab = window.open('', '_blank');
    if (mobileTab) {
      mobileTab.document.write(`
        <html>
          <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="background:#121212;color:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;margin:0;">
            <h3 style="color:#1ed760;margin-bottom:10px;">Downloading</h3>
            <p style="text-align:center;padding:0 20px;">${song.title}</p>
            <p style="font-size:12px;color:#aaa;text-align:center;">You can close this tab once the download starts.</p>
          </body>
        </html>
      `);
    }
  }

  try {
    const response = await fetch(song.streamUrl, { mode: 'cors' });
    if (!response.ok) throw new Error("Network response was not ok");
    
    const originalBlob = await response.blob();
    // Use the original blob's type if possible, or fallback to audio/mpeg or audio/mp4
    const blob = new Blob([originalBlob], { type: originalBlob.type || 'audio/mp4' });
    const url = window.URL.createObjectURL(blob);
    
    if (isMobile && mobileTab) {
      toast.innerText = "Download ready! Tap 'Download' in the new tab.";
      mobileTab.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${song.title.replace(/[\\/:"*?<>|]/g, '')} - ${song.artist.replace(/[\\/:"*?<>|]/g, '')}.m4a`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 5000);
    }
    
    toast.innerText = "Download starting!";
    toast.style.background = '#28a745'; 
    toast.style.color = '#fff';
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(toast)) document.body.removeChild(toast);
      }, 300);
    }, 2500);

  } catch (err) {
    console.error("Direct download failed:", err);
    toast.innerText = "Opening file directly for download...";
    toast.style.background = '#ffc107';
    toast.style.color = '#000';
    
    if (isMobile && mobileTab) {
      mobileTab.location.href = song.streamUrl;
    } else {
      window.location.href = song.streamUrl;
    }

    setTimeout(() => { 
      if (document.body.contains(toast)) document.body.removeChild(toast); 
    }, 4000);
  }
};

export const getStreamUrl = async () => null;
