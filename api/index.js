import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cleanUsername(raw) {
  let clean = (raw || '').trim();
  if (clean.includes('tiktok.com/')) {
    const match = clean.match(/@([^/?#]+)/);
    if (match) clean = match[1];
  }
  return clean.replace(/^@/, '').replace(/[^a-zA-Z0-9_.-]/g, '').trim();
}

// 1. Scraping Profil TikTok (SSR Rehydration)
async function getTikTokProfile(rawUsername) {
  const clean = cleanUsername(rawUsername);
  if (!clean) throw new Error('Parameter username wajib diisi.');

  const targetUrl = `https://www.tiktok.com/@${clean}`;
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.google.com/'
    }
  });

  if (!response.ok && response.status !== 200) {
    throw new Error(`Gagal menghubungi TikTok (HTTP ${response.status})`);
  }

  const html = await response.text();
  const match = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s);
  if (!match) {
    throw new Error('Data profil tidak ditemukan atau dibatasi oleh WAF TikTok.');
  }

  const parsed = JSON.parse(match[1]);
  const scope = parsed.__DEFAULT_SCOPE__ || {};
  const userDetail = scope['webapp.user-detail'] || {};
  const userInfo = userDetail.userInfo || {};

  if (!userInfo.user || userDetail.statusCode === 10202) {
    throw new Error(`Pengguna @${clean} tidak ditemukan di TikTok.`);
  }

  const user = userInfo.user;
  const stats = userInfo.stats || {};

  return {
    id: user.id,
    uniqueId: user.uniqueId,
    nickname: user.nickname,
    signature: user.signature || '',
    verified: Boolean(user.verified),
    privateAccount: Boolean(user.privateAccount),
    secUid: user.secUid,
    avatar: user.avatarLarger || user.avatarMedium || user.avatarThumb,
    profileUrl: `https://www.tiktok.com/@${user.uniqueId}`,
    createTime: user.createTime ? new Date(user.createTime * 1000).toISOString() : null,
    stats: {
      followers: Number(stats.followerCount || 0),
      following: Number(stats.followingCount || 0),
      likes: Number(stats.heart || stats.heartCount || 0),
      videos: Number(stats.videoCount || 0),
      friends: Number(stats.friendCount || 0)
    }
  };
}

// 2. Data Statistik Video Lengkap (Likes, Views, Comments, Shares, Favorites)
async function getTikTokVideoData(videoUrl) {
  if (!videoUrl) throw new Error('Parameter url video wajib diisi.');

  const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl.trim())}`;
  const response = await fetch(api, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Gagal menghubungi server resolver (HTTP ${response.status})`);
  }

  const result = await response.json();
  if (result.code !== 0 || !result.data) {
    throw new Error(result.msg || 'URL video tidak valid atau video bersifat privat.');
  }

  const d = result.data;
  return {
    id: d.id,
    title: d.title || '',
    duration: d.duration || 0,
    cover: d.cover,
    playUrl: d.play, // Video tanpa watermark
    music: {
      id: d.music_info?.id,
      title: d.music_info?.title,
      author: d.music_info?.author,
      playUrl: d.music_info?.play
    },
    author: {
      id: d.author?.id,
      uniqueId: d.author?.unique_id,
      nickname: d.author?.nickname,
      avatar: d.author?.avatar
    },
    stats: {
      views: Number(d.play_count || 0),
      likes: Number(d.digg_count || 0),
      comments: Number(d.comment_count || 0),
      shares: Number(d.share_count || 0),
      favorites: Number(d.collect_count || 0),
      downloads: Number(d.download_count || 0)
    }
  };
}

// 3. Cek Video Terbaru User
async function getTikTokNewVideo(rawUsername) {
  const profile = await getTikTokProfile(rawUsername);

  let latestVideo = null;
  let source = 'direct';

  // Coba ambil list video via TikWM (biasanya berhasil di IP Vercel/US)
  try {
    const postApi = `https://tikwm.com/api/user/posts?unique_id=${encodeURIComponent(profile.uniqueId)}&count=5&cursor=0`;
    const res = await fetch(postApi, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (res.ok) {
      const j = await res.json();
      if (j.code === 0 && j.data?.videos && j.data.videos.length > 0) {
        const v = j.data.videos[0];
        source = 'tikwm';
        latestVideo = {
          videoId: v.video_id || v.id,
          videoUrl: `https://www.tiktok.com/@${profile.uniqueId}/video/${v.video_id || v.id}`,
          title: v.title || '',
          cover: v.cover,
          playUrl: v.play,
          duration: v.duration,
          createdAt: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
          stats: {
            views: Number(v.play_count || 0),
            likes: Number(v.digg_count || 0),
            comments: Number(v.comment_count || 0),
            shares: Number(v.share_count || 0),
            favorites: Number(v.collect_count || 0)
          }
        };
      }
    }
  } catch (err) {
    // Abaikan jika fallback gagal
  }

  return {
    user: {
      id: profile.id,
      uniqueId: profile.uniqueId,
      nickname: profile.nickname,
      avatar: profile.avatar,
      profileUrl: profile.profileUrl,
      totalVideos: profile.stats.videos,
      totalLikes: profile.stats.likes,
      totalFollowers: profile.stats.followers
    },
    hasVideos: profile.stats.videos > 0,
    latestVideo: latestVideo,
    source: source,
    note: latestVideo
      ? 'Berhasil mengambil video upload terbaru.'
      : (profile.stats.videos > 0
          ? 'Akun memiliki video, namun feed privat atau diproteksi WAF oleh TikTok.'
          : 'Pengguna belum pernah mengunggah video.')
  };
}

// 4. HTML Web Interface Sederhana & Elegan
function getHtmlUI() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TikTok Scraper & Analytics API</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #0f172a;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 30px 15px;
    }
    .container { width: 100%; max-width: 800px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 {
      font-size: 2.2rem;
      background: linear-gradient(90deg, #00f2fe, #4facfe, #ff007f);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .header p { color: #94a3b8; font-size: 0.95rem; }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    }
    .card h2 { font-size: 1.25rem; margin-bottom: 15px; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    .form-group { display: flex; gap: 10px; margin-bottom: 12px; }
    input {
      flex: 1;
      padding: 12px 16px;
      background: #0f172a;
      border: 1px solid #475569;
      border-radius: 8px;
      color: #fff;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus { border-color: #38bdf8; }
    button {
      padding: 12px 24px;
      background: linear-gradient(135deg, #2563eb, #0284c7);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
    }
    button:hover { opacity: 0.9; }
    button:active { transform: scale(0.98); }
    .endpoint-badge {
      display: inline-block;
      font-family: monospace;
      background: #0f172a;
      border: 1px solid #334155;
      color: #a78bfa;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.85rem;
      margin-bottom: 12px;
    }
    pre {
      background: #0b1120;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 15px;
      color: #34d399;
      font-size: 0.85rem;
      max-height: 350px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>TikTok Scraper & REST API</h1>
      <p>Cek Video Upload Terbaru & Statistik Lengkap Video TikTok Tanpa Browser</p>
    </div>

    <!-- Section 1: Video Upload Terbaru -->
    <div class="card">
      <h2>🎬 1. Cek Video Upload Terbaru</h2>
      <div class="endpoint-badge">GET /tiktok-new-video?username={username}</div>
      <div class="form-group">
        <input type="text" id="inputUsername" placeholder="Masukkan username (contoh: lyren_for_help)">
        <button onclick="checkNewVideo()">Cek Video</button>
      </div>
      <pre id="outputNewVideo">// Hasil respon JSON akan muncul di sini</pre>
    </div>

    <!-- Section 2: Data Video (Likes/Views/Comments/Shares/Favorites) -->
    <div class="card">
      <h2>📊 2. Cek Statistik Lengkap Video</h2>
      <div class="endpoint-badge">GET /tiktok-data-video?url={video_url}</div>
      <div class="form-group">
        <input type="text" id="inputVideoUrl" placeholder="Masukkan link video TikTok (contoh: https://www.tiktok.com/@.../video/...)">
        <button onclick="checkVideoData()">Cek Data Video</button>
      </div>
      <pre id="outputVideoData">// Hasil respon JSON akan muncul di sini</pre>
    </div>

    <!-- Section 3: Data Profil Lengkap -->
    <div class="card">
      <h2>👤 3. Cek Profil & Pengikut</h2>
      <div class="endpoint-badge">GET /tiktok-profile?username={username}</div>
      <div class="form-group">
        <input type="text" id="inputProfile" placeholder="Masukkan username TikTok">
        <button onclick="checkProfile()">Cek Profil</button>
      </div>
      <pre id="outputProfile">// Hasil respon JSON akan muncul di sini</pre>
    </div>

    <div class="footer">
      Dibuat untuk deployment langsung di Vercel Serverless
    </div>
  </div>

  <script>
    async function callApi(endpoint, outputId) {
      const output = document.getElementById(outputId);
      output.innerText = 'Sedang memuat data dari TikTok...';
      try {
        const res = await fetch(endpoint);
        const data = await res.json();
        output.innerText = JSON.stringify(data, null, 2);
      } catch (err) {
        output.innerText = JSON.stringify({ success: false, error: err.message }, null, 2);
      }
    }

    function checkNewVideo() {
      const user = document.getElementById('inputUsername').value.trim();
      if (!user) return alert('Silakan masukkan username TikTok!');
      callApi('/tiktok-new-video?username=' + encodeURIComponent(user), 'outputNewVideo');
    }

    function checkVideoData() {
      const vUrl = document.getElementById('inputVideoUrl').value.trim();
      if (!vUrl) return alert('Silakan masukkan link URL video TikTok!');
      callApi('/tiktok-data-video?url=' + encodeURIComponent(vUrl), 'outputVideoData');
    }

    function checkProfile() {
      const user = document.getElementById('inputProfile').value.trim();
      if (!user) return alert('Silakan masukkan username TikTok!');
      callApi('/tiktok-profile?username=' + encodeURIComponent(user), 'outputProfile');
    }
  </script>
</body>
</html>`;
}

// 5. Main Request Handler (Vercel Serverless & Node HTTP Server compatible)
export default async function handler(req, res) {
  // Aktifkan CORS untuk akses public API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  // Root Homepage (HTML Web UI)
  if (pathname === '/' || pathname === '/index.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    try {
      const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
      if (fs.existsSync(htmlPath)) {
        res.end(fs.readFileSync(htmlPath, 'utf-8'));
        return;
      }
    } catch (e) {}
    res.end(getHtmlUI());
    return;
  }

  // 1. Endpoint: /tiktok-new-video?username=
  if (pathname === '/tiktok-new-video') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const username = searchParams.get('username');
      const data = await getTikTokNewVideo(username);
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, ...data }, null, 2));
    } catch (err) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: err.message }, null, 2));
    }
    return;
  }

  // 2. Endpoint: /tiktok-data-video?url=
  if (pathname === '/tiktok-data-video') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const videoUrl = searchParams.get('url');
      const data = await getTikTokVideoData(videoUrl);
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, data }, null, 2));
    } catch (err) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: err.message }, null, 2));
    }
    return;
  }

  // 3. Endpoint: /tiktok-profile?username=
  if (pathname === '/tiktok-profile') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const username = searchParams.get('username');
      const data = await getTikTokProfile(username);
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, data }, null, 2));
    } catch (err) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: err.message }, null, 2));
    }
    return;
  }

  // Not Found
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = 404;
  res.end(JSON.stringify({ success: false, message: 'Endpoint tidak ditemukan.' }));
}
