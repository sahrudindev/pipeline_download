# ⬇️ VidGrab — Universal Video Downloader

Website untuk men-download video dari YouTube, TikTok, Instagram, X, Facebook, dan
**1800+ situs** lain, dengan pilihan format (MP4/MP3) dan kualitas.

> ⚠️ **Disclaimer:** Gunakan hanya untuk konten milik sendiri atau berlisensi.
> Konten ber-DRM (Netflix, Disney+, Spotify berbayar) **tidak** bisa diunduh —
> itu batas teknologi, bukan keterbatasan aplikasi ini.

## Arsitektur

```
Next.js (frontend) ──HTTP──▶ FastAPI (API) ──enqueue──▶ Celery worker (yt-dlp + ffmpeg)
                                   │                            │
                                Redis (queue + job state)   Storage (auto-delete TTL)
```

- **Backend**: FastAPI + Celery + yt-dlp + ffmpeg
- **Frontend**: Next.js 14 (App Router) + Tailwind
- **Queue/State**: Redis

## Menjalankan (paling mudah — Docker)

```bash
cp .env.example .env      # sudah ada .env default, bouh dilewati
docker compose up --build
```

Lalu buka:
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

## Menjalankan manual (tanpa Docker)

Butuh: Python 3.12+, Node 20+, Redis, dan **ffmpeg** terpasang di sistem.

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# jalankan Redis dulu (redis-server)
export REDIS_URL=redis://localhost:6379/0 DOWNLOAD_DIR=./downloads
uvicorn app.main:app --reload --port 8000        # terminal 1
celery -A app.celery_app.celery worker --loglevel=info  # terminal 2
```

**Frontend**
```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev
```

## Endpoint API

| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/api/info` | Metadata + daftar format |
| POST | `/api/download` | Buat job download → `job_id` |
| GET | `/api/status/{job_id}` | Status & progress |
| GET | `/api/file/{job_id}` | Unduh file hasil |
| GET | `/api/check?url=` | Cek dukungan sebuah URL |
| GET | `/api/supported` | Daftar 1800+ situs |

## Konfigurasi (.env)

| Variabel | Default | Fungsi |
|----------|---------|--------|
| `FILE_TTL_SECONDS` | 1800 | Umur file sebelum auto-delete |
| `MAX_FILESIZE_MB` | 2048 | Batas ukuran per download |
| `RATE_LIMIT_PER_MIN` | 5 | Batas job per IP per menit |
| `YTDLP_COOKIES` | — | Path file cookies (untuk video login/privat) |

### Cookies untuk video privat / login
Ekspor cookies (format Netscape) dari browser, taruh di `backend/`, lalu set
`YTDLP_COOKIES=/app/cookies.txt` dan mount filenya via volume.

## Catatan
- File hasil otomatis dihapus setelah `FILE_TTL_SECONDS`.
- Update `yt-dlp` secara berkala (`pip install -U yt-dlp`) agar tetap kompatibel
  dengan perubahan platform.
