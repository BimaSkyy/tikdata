# TikTok REST API & Web UI (Ready for Vercel)

Aplikasi REST API dan Antarmuka Web untuk:
1. **Cek Video Upload Terbaru** (`/tiktok-new-video?username=...`)
2. **Cek Statistik Lengkap Video (Likes, Views, Comments, Shares, Favorites)** (`/tiktok-data-video?url=...`)
3. **Cek Profil & Statistik Akun** (`/tiktok-profile?username=...`)
4. **Web UI Interaktif** (`/`)

---

## 🚀 Cara Deploy ke Vercel

### Metode 1: Lewat GitHub (Paling Mudah)
1. Buat repository baru di [GitHub](https://github.com/new).
2. Upload semua file dalam folder ini (`api/`, `package.json`, `vercel.json`, `server.js`).
3. Buka dashboard [Vercel](https://vercel.com/) dan klik **"Add New Project"**.
4. Import repository GitHub tersebut.
5. Klik **"Deploy"** (tanpa perlu ubah pengaturan build apa pun).
6. Website & REST API langsung online dengan domain `https://proyek-anda.vercel.app`.

### Metode 2: Lewat Vercel CLI di Termux
```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## 💻 Menjalankan di Lokal (Termux / Komputer)

```bash
node server.js
```
Lalu buka browser di `http://localhost:3000`.

---

## 📡 Dokumentasi Endpoint REST API

### 1. Cek Video Upload Terbaru
- **URL**: `GET /tiktok-new-video?username={username}`
- **Contoh**: `/tiktok-new-video?username=lyren_for_help`
- **Output JSON**:
```json
{
  "success": true,
  "user": {
    "uniqueId": "lyren_for_help",
    "nickname": "nine one one apart",
    "totalVideos": 1,
    "totalLikes": 36,
    "totalFollowers": 1
  },
  "hasVideos": true,
  "latestVideo": {
    "videoId": "...",
    "videoUrl": "https://www.tiktok.com/@...",
    "title": "...",
    "playUrl": "...",
    "stats": {
      "views": 1500,
      "likes": 200,
      "comments": 40,
      "shares": 10,
      "favorites": 5
    }
  }
}
```

### 2. Cek Data & Statistik Video Lengkap
- **URL**: `GET /tiktok-data-video?url={video_url}`
- **Contoh**: `/tiktok-data-video?url=https://www.tiktok.com/@scout2015/video/6718335390845095173`
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "id": "6718335390845095173",
    "title": "Judul video...",
    "duration": 10,
    "cover": "https://...",
    "playUrl": "https://... (Video tanpa watermark)",
    "author": {
      "uniqueId": "scout2015",
      "nickname": "Scout, Suki & Stella"
    },
    "stats": {
      "views": 159614,
      "likes": 35188,
      "comments": 5716,
      "shares": 1517,
      "favorites": 649
    }
  }
}
```

### 3. Cek Profil & Pengikut
- **URL**: `GET /tiktok-profile?username={username}`
- **Contoh**: `/tiktok-profile?username=lyren_for_help`
