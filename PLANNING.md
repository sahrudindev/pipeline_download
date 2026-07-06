# Planning Detail — Universal Video Downloader

> Stack: **FastAPI (Python)** + **Next.js + Tailwind** · Engine: **yt-dlp + ffmpeg**
> Status: Design phase · Terakhir diperbarui: 2026-07-06

---

## ⚖️ 1. Catatan Legal & Etika

Mengunduh dari YouTube melanggar ToS YouTube; konten berhak cipta punya batasan hukum.
Arsitektur ini bersifat *dual-use* (seperti `yt-dlp` sendiri). Mitigasi yang WAJIB ada:

- Disclaimer jelas di UI ("gunakan hanya untuk konten milik sendiri / berlisensi").
- Rate limiting per IP (cegah penyalahgunaan sebagai layanan gratis).
- Tidak menyimpan riwayat/log konten yang bisa mengekspos user.
- Auto-delete file hasil (TTL).

---

## 🎯 2. Ruang Lingkup Fitur

### MVP (Fase 1)
- [ ] Input satu link → deteksi metadata (judul, thumbnail, durasi, channel).
- [ ] Tampilkan daftar format tersedia (resolusi, ukuran, codec).
- [ ] Download async via job queue.
- [ ] Preview / embed player.
- [ ] Auto-delete file setelah TTL (default 30 menit).

### Fase 2
- [ ] Progress real-time (WebSocket/SSE).
- [ ] Ekstraksi audio → MP3.
- [ ] Pilihan resolusi + muxing video+audio otomatis.
- [ ] Rate limiting + anti-abuse.
- [ ] **Halaman "Platform Didukung"** — daftar situs yang bisa di-download + cara pakainya (lihat Bagian 13 & 14).

### Fase 3
- [ ] Playlist / batch download (ZIP).
- [ ] Caching hasil populer.
- [ ] Multi-worker & CDN.

---

## 🏗️ 3. Arsitektur

```
┌──────────────┐   HTTP/WS   ┌──────────────┐   enqueue   ┌──────────────────┐
│   Next.js    │ ──────────▶ │   FastAPI    │ ──────────▶ │  Celery Worker   │
│  (frontend)  │ ◀────────── │   (API)      │ ◀────────── │  yt-dlp + ffmpeg │
└──────────────┘   progress  └──────┬───────┘   status    └────────┬─────────┘
                                     │                              │
                              ┌──────▼──────┐              ┌─────────▼────────┐
                              │    Redis    │              │  Storage + TTL   │
                              │ (broker+kv) │              │  (local / S3)    │
                              └─────────────┘              └──────────────────┘
```

**Kenapa job queue?** Proses download bisa 10 detik–beberapa menit. Tidak boleh
memblokir request HTTP. FastAPI hanya menerima job → worker mengerjakan → status
dipantau lewat polling atau WebSocket.

---

## 🔌 4. API Specification (MVP)

### `POST /api/info`
Ambil metadata + daftar format tanpa mengunduh.
```jsonc
// Request
{ "url": "https://youtube.com/watch?v=..." }

// Response 200
{
  "id": "dQw4w9WgXcQ",
  "title": "Judul Video",
  "thumbnail": "https://...",
  "duration": 213,          // detik
  "uploader": "Channel",
  "formats": [
    { "format_id": "137", "ext": "mp4", "resolution": "1080p",
      "filesize": 45000000, "vcodec": "avc1", "acodec": "none", "note": "video only" },
    { "format_id": "140", "ext": "m4a", "resolution": "audio",
      "filesize": 3400000, "vcodec": "none", "acodec": "mp4a" }
  ]
}
```

### `POST /api/download`
Membuat job download. Mengembalikan `job_id`.
```jsonc
// Request
{ "url": "...", "format_id": "137+140", "convert_to": null }  // atau "mp3"

// Response 202
{ "job_id": "a1b2c3", "status": "queued" }
```

### `GET /api/status/{job_id}`
Polling status job.
```jsonc
{ "job_id": "a1b2c3", "status": "processing",   // queued|processing|done|error
  "progress": 62.5, "eta": 12,
  "download_url": null, "error": null }
```

### `GET /api/file/{job_id}`
Streaming file hasil (Content-Disposition attachment). 410 jika sudah expired.

### `WS /ws/{job_id}` (Fase 2)
Push event progress real-time: `{ "progress": 62.5, "speed": "3.4MiB/s", "eta": 12 }`.

---

## 🗄️ 5. Model Data

MVP cukup pakai **Redis** (tanpa DB relasional). Setiap job disimpan sebagai hash
dengan TTL.

```
job:{job_id}  →  {
  status, progress, url, format_id,
  file_path, filename, filesize,
  created_at, error
}
TTL = 1800 detik (30 menit)
```

Kalau butuh riwayat/analytics (Fase 2+), tambahkan PostgreSQL tabel `jobs`.

---

## 📁 6. Struktur Folder

```
pipeline_download/
├── docker-compose.yml
├── PLANNING.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py          # FastAPI entrypoint + routes
│   │   ├── config.py        # settings (TTL, storage path, limits)
│   │   ├── schemas.py       # Pydantic models (request/response)
│   │   ├── extractor.py     # wrapper yt-dlp: info + download
│   │   ├── tasks.py         # Celery tasks
│   │   ├── storage.py       # simpan + cleanup file
│   │   └── ratelimit.py     # middleware rate limit
│   └── downloads/           # file sementara (auto-delete)
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tailwind.config.js
    └── app/
        ├── page.tsx         # halaman utama (input link)
        ├── components/
        │   ├── UrlInput.tsx
        │   ├── VideoPreview.tsx
        │   ├── FormatSelector.tsx
        │   └── ProgressBar.tsx
        └── lib/api.ts       # fetch wrapper ke backend
```

---

## 🔄 7. Alur Kerja (End-to-End)

1. User paste link → frontend `POST /api/info`.
2. Backend jalankan `yt-dlp -J` (dump JSON) → kembalikan metadata + format.
3. Frontend tampilkan preview + dropdown format.
4. User klik download → `POST /api/download` → dapat `job_id`.
5. Worker Celery ambil job → `yt-dlp` unduh → `ffmpeg` mux/convert bila perlu.
6. Frontend polling `GET /api/status/{job_id}` (atau WebSocket) → update progress bar.
7. Status `done` → tombol "Simpan" → `GET /api/file/{job_id}` (streaming).
8. Scheduler hapus file setelah TTL.

---

## ⚙️ 8. Konfigurasi Kunci

| Env var | Default | Fungsi |
|---------|---------|--------|
| `DOWNLOAD_DIR` | `./downloads` | Lokasi file sementara |
| `FILE_TTL_SECONDS` | `1800` | Umur file sebelum dihapus |
| `MAX_FILESIZE_MB` | `2048` | Batas ukuran per download |
| `RATE_LIMIT_PER_MIN` | `5` | Job per IP per menit |
| `REDIS_URL` | `redis://redis:6379` | Broker + KV store |
| `YTDLP_COOKIES` | `-` | (opsional) cookies untuk bypass anti-bot |

---

## ⚠️ 9. Risiko Teknis & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| YouTube anti-bot / format berubah | Auto-update `yt-dlp` (pin + jadwal update); cookies/proxy opsional |
| File besar bikin OOM | Streaming download & response, jangan buffer ke memory |
| Disk penuh | TTL cleanup + batas ukuran + monitoring |
| Abuse (dipakai orang lain gratis) | Rate limit, captcha (Fase 2), disclaimer |
| Proses lama blok server | Job queue async (Celery) |
| Biaya bandwidth | Auto-delete, batas ukuran, opsi CDN nanti |

---

## 🐳 10. Deployment

- **Docker Compose** 4 service: `frontend`, `backend`, `worker`, `redis`.
- Bukan serverless — butuh binary `ffmpeg` & `yt-dlp` + proses lama.
- Target: VPS 2 vCPU / 4GB RAM untuk MVP.
- Reverse proxy: Caddy/Nginx + HTTPS.

---

## ✅ 11. Definition of Done (MVP)

- Bisa paste link YouTube → lihat metadata → download MP4 720p/1080p yang benar (video+audio ter-mux).
- Bisa download audio-only.
- File otomatis terhapus setelah TTL.
- Rate limit dasar aktif.
- Jalan penuh via `docker-compose up`.

---

## 🚀 12. Urutan Implementasi yang Disarankan

1. Scaffold `docker-compose` + Redis + FastAPI "hello".
2. `extractor.py` — bungkus yt-dlp untuk `/info`. Uji via curl.
3. `tasks.py` + Celery worker — job download + storage.
4. Endpoint `/download`, `/status`, `/file`.
5. Frontend: input → preview → format → download + polling.
6. Cleanup scheduler + rate limit.
7. Polish UI + disclaimer.
8. (Fase 2) WebSocket progress, MP3, dsb.

---

## 🌐 13. Cakupan Dukungan (Supported Sites & Limitations)

Engine `yt-dlp` mendukung **~1800 situs**. Berikut peta jujurnya:

### ✅ Bisa di-download
| Kategori | Contoh platform |
|----------|-----------------|
| Video sosial | YouTube, TikTok, Instagram (Reels/Post), Twitter/X, Facebook, Reddit |
| Platform video | Vimeo, Dailymotion, Twitch (VOD/clip), Bilibili, Rumble, Odysee |
| Media langsung | URL file `.mp4`, `.webm`, `.mov` |
| Streaming | HLS `.m3u8`, DASH `.mpd` (butuh ffmpeg untuk merge) |
| Audio | SoundCloud, Bandcamp, podcast RSS |

### ⚠️ Bisa tapi bersyarat
| Kondisi | Kebutuhan |
|---------|-----------|
| Video privat / age-restricted | Cookies / login akun |
| Region-locked | Proxy |
| Rate-limited oleh platform | Delay / rotasi IP |

### ❌ TIDAK bisa (batas teknologi — universal, bukan bug kode)
| Layanan | Alasan |
|---------|--------|
| Netflix, Disney+, Amazon Prime, HBO Max, Apple TV+ | **DRM (Widevine/PlayReady)** — konten terenkripsi |
| Spotify (track berbayar), Apple Music | DRM |
| Live stream ber-DRM / token dinamis ketat | Proteksi enkripsi |

> **Prinsip:** apa pun yang **tidak ber-DRM dan bisa diakses publik** → bisa. Apa pun
> yang **dienkripsi DRM** → tidak ada tool mana pun di dunia yang bisa (legal maupun teknis).

### Cara mendeteksi dukungan secara runtime
- Backend punya endpoint `GET /api/supported` yang mengembalikan daftar extractor
  aktif dari `yt-dlp.extractor.list_extractors()` (di-cache).
- Saat user paste link, backend cek domain → beri label: `✅ Didukung`,
  `⚠️ Perlu login`, atau `❌ Tidak didukung (DRM)` **sebelum** user klik download.

---

## 📖 14. Fitur "Platform Didukung + Cara Download"

Halaman/section yang menampilkan daftar platform populer beserta panduannya.

### Sumber data
- **Kurasi manual** untuk platform populer (data statis JSON) → tampil rapi dengan
  ikon, kategori, dan instruksi. Ini yang ditampilkan di UI utama.
- **Daftar lengkap** (~1800) dari `/api/supported` → ditampilkan sebagai daftar
  yang bisa dicari (search box), karena terlalu banyak untuk kartu.

### Struktur data kurasi (`frontend/lib/platforms.ts`)
```ts
type Platform = {
  id: string;              // "youtube"
  name: string;            // "YouTube"
  icon: string;            // path/emoji
  category: "video" | "social" | "audio" | "live";
  support: "full" | "login" | "drm";   // status dukungan
  urlExample: string;      // "https://youtube.com/watch?v=..."
  steps: string[];         // langkah cara download
};
```

### Contoh entri
```jsonc
{
  "id": "youtube",
  "name": "YouTube",
  "icon": "▶️",
  "category": "video",
  "support": "full",
  "urlExample": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "steps": [
    "Salin URL video dari browser atau tombol Share.",
    "Tempel di kolom input di halaman utama.",
    "Pilih format (MP4/MP3) dan kualitas.",
    "Klik Download dan tunggu prosesnya."
  ]
}
```

### Tampilan UI
```
┌──────────────── Platform yang Didukung ─────────────────┐
│  🔍 [ cari platform... ]        Kategori: [ Semua ▼ ]    │
├──────────────┬──────────────┬──────────────┬────────────┤
│  ▶️ YouTube   │  🎵 TikTok    │  📷 Instagram │  🐦 X       │
│  ✅ Penuh     │  ✅ Penuh     │  ⚠️ Login     │  ✅ Penuh   │
│  [Cara pakai]│  [Cara pakai]│  [Cara pakai]│  [Cara...] │
├──────────────┴──────────────┴──────────────┴────────────┤
│  ...klik kartu → expand langkah 1-2-3-4 cara download    │
├─────────────────────────────────────────────────────────┤
│  Tidak ada di daftar? Cari di 1800+ situs: [_________]   │
└─────────────────────────────────────────────────────────┘
```

Setiap kartu menampilkan **badge status** (✅ Penuh / ⚠️ Login / ❌ DRM) dan tombol
"Cara pakai" yang membuka langkah-langkah. Contoh URL bisa diklik → langsung
mengisi kolom input di halaman utama.

### Komponen frontend tambahan
```
frontend/app/
├── supported/page.tsx        # halaman daftar platform
├── components/
│   ├── PlatformCard.tsx      # kartu + badge + steps
│   ├── PlatformGrid.tsx      # grid + filter kategori
│   └── SearchSites.tsx       # search daftar lengkap dari /api/supported
└── lib/platforms.ts          # data kurasi statis
```

### Endpoint backend tambahan
```
GET /api/supported          → daftar lengkap extractor (dicache)
GET /api/check?url=...       → cek satu URL: { supported, support_level, platform }
```
