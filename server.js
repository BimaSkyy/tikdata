import http from 'http';
import handler from './api/index.js';

const PORT = process.env.PORT || 3000;

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`\n🚀 Server TikTok API aktif di http://localhost:${PORT}`);
  console.log(`Endpoints tersedia:`);
  console.log(` - Web UI:              http://localhost:${PORT}/`);
  console.log(` - Video Upload Baru:   http://localhost:${PORT}/tiktok-new-video?username=lyren_for_help`);
  console.log(` - Data Video Lengkap:  http://localhost:${PORT}/tiktok-data-video?url=https://www.tiktok.com/@scout2015/video/6718335390845095173`);
  console.log(` - Profil Pengguna:     http://localhost:${PORT}/tiktok-profile?username=lyren_for_help\n`);
});
