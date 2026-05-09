// Use 96kbps quality - this quality tier on Saavn's CDN is unencrypted
// and plays with full audio including vocals. Higher quality (160/320kbps)
// uses DRM encryption that browsers cannot decrypt, resulting in only
// background/instrumental audio playing.

const SAAVN_API = 'https://jiosaavn-api-v4.vercel.app/api';
const PREFERRED_QUALITY = '96kbps'; // DO NOT change - higher qualities are DRM encrypted

const mapSongItem = (item) => {
  // Extract download URLs
  const downloadUrls = item.downloadUrl || [];
  
  // Find highest quality unencrypted stream (96kbps is safe)
  // Fallback chain: 96kbps → 48kbps → 12kbps
  const qualities = ['96kbps', '48kbps', '12kbps'];
  let streamUrl = null;
  
  for (const q of qualities) {
    const found = downloadUrls.find(u => u.quality === q);
    if (found) {
      streamUrl = found.url || found.link;
      if (streamUrl) break;
    }
  }

  // If none of those, take the first available one as last resort
  if (!streamUrl && downloadUrls.length > 0) {
    streamUrl = downloadUrls[0].url || downloadUrls[0].link;
  }

  // Handle image structure variations
  let thumbnail = 'https://via.placeholder.com/300';
  if (Array.isArray(item.image) && item.image.length > 0) {
    const img = item.image[item.image.length - 1];
    thumbnail = img.url || img.link;
  } else if (typeof item.image === 'string') {
    thumbnail = item.image;
  } else if (item.thumbnail) {
    thumbnail = item.thumbnail;
  }

  // Ensure HTTPS
  if (thumbnail.startsWith('http:')) {
    thumbnail = thumbnail.replace('http:', 'https:');
  }

  return {
    id: item.id,
    title: item.name?.replace(/&quot;/g, '"')?.replace(/&amp;/g, '&') || 'Unknown',
    artist: item.primaryArtists || 'Unknown Artist',
    thumbnail,
    duration: parseInt(item.duration) || 0,
    streamUrl,
    album: item.album?.name || '',
    year: item.year || '',
    playCount: parseInt(item.playCount) || 0
  };
};

export const searchMusic = async (query) => {
  try {
    const response = await fetch(
      `${SAAVN_API}/search/songs?query=${encodeURIComponent(query)}&limit=20`
    );
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();

    const results = data.data?.results || data.results;
    if ((data.status === 'SUCCESS' || data.success === true || data.status === 'success') && results) {
      const mapped = results.map(mapSongItem);
      
      // Deduplicate songs by title and artist to fix duplicate UI issues
      const seen = new Set();
      return mapped.filter(song => {
        // Create normalized key "title-artist"
        const key = `${song.title.toLowerCase().trim()}-${song.artist.split(',')[0].toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return [];
  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
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

  const results = [];

  for (const hit of hits) {
    try {
      const res = await searchMusic(hit);

      // Pick the first result that:
      // 1. Has a valid stream URL
      // 2. Is NOT an instrumental/remix/lofi (filter by name keywords)
      // 3. Has the HIGHEST play count (most popular = original version)
      const filtered = res.filter(song => {
        if (!song.streamUrl) return false;
        const lower = song.title.toLowerCase();
        const badKeywords = ['instrumental', 'karaoke', 'ringtone', 'bgm', 'background'];
        return !badKeywords.some(k => lower.includes(k));
      });

      // Sort by play count to get original version first
      const sorted = filtered.sort((a, b) => b.playCount - a.playCount);

      if (sorted.length > 0) {
        results.push(sorted[0]);
      }
    } catch (err) {
      console.error(`Failed to fetch: ${hit}`, err);
    }
  }

  return results;
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
