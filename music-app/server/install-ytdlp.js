import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
const outputPath = path.join(__dirname, 'yt-dlp');

// Download only on Linux (Render / production)
if (process.platform === 'linux') {
  console.log('[Postinstall] Linux detected. Downloading yt-dlp binary...');
  
  const file = fs.createWriteStream(outputPath);
  
  function download(url) {
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        download(response.headers.location);
        return;
      }
      
      if (response.statusCode !== 200) {
        console.error(`[Postinstall] Failed to download yt-dlp: Status code ${response.statusCode}`);
        process.exit(1);
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close(() => {
          console.log('[Postinstall] yt-dlp download complete. Making it executable...');
          try {
            fs.chmodSync(outputPath, '755');
            console.log('[Postinstall] yt-dlp is now executable!');
          } catch (err) {
            console.error('[Postinstall] Failed to make yt-dlp executable:', err.message);
          }
        });
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      console.error('[Postinstall] Download error:', err.message);
      process.exit(1);
    });
  }
  
  download(YTDLP_URL);
} else {
  console.log(`[Postinstall] Platform is ${process.platform}. Skipping yt-dlp download (using local files).`);
}
