"""Pembungkus yt-dlp: ambil metadata, daftar format, dan proses download."""
from __future__ import annotations

import os
import re
import time
import html as _html
import threading
from typing import Optional, Callable

import yt_dlp

from .config import settings

# Regex untuk mengekstrak URL dari kode embed (<iframe src="...">) atau teks bebas.
_SRC_RE = re.compile(r"""src\s*=\s*["']([^"']+)["']""", re.IGNORECASE)
_URL_RE = re.compile(r"""https?://[^\s"'<>]+""", re.IGNORECASE)


def normalize_input(text: str) -> str:
    """Terima URL polos ATAU kode embed (<iframe>), kembalikan URL video.

    - Jika ada atribut src="..." (khas iframe/embed), ambil itu.
    - Jika tidak, ambil URL http(s) pertama yang muncul.
    - Jika sudah berupa URL polos, kembalikan apa adanya.
    """
    if not text:
        return text
    text = text.strip()
    # Kode embed mengandung src="..." → prioritaskan.
    m = _SRC_RE.search(text)
    if m:
        return _html.unescape(m.group(1).strip())
    # Teks bebas yang memuat URL.
    if "<" in text or " " in text:
        m = _URL_RE.search(text)
        if m:
            return _html.unescape(m.group(0).strip())
    return text

# Domain layanan ber-DRM yang tidak mungkin di-download (batas teknologi).
DRM_DOMAINS = {
    "netflix.com", "disneyplus.com", "primevideo.com", "amazon.com",
    "hbomax.com", "max.com", "tv.apple.com", "spotify.com", "hulu.com",
}

# Domain yang biasanya butuh login/cookies.
LOGIN_DOMAINS = {"instagram.com", "facebook.com", "fb.watch"}


def _base_opts() -> dict:
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
    }
    if settings.ytdlp_cookies and os.path.exists(settings.ytdlp_cookies):
        opts["cookiefile"] = settings.ytdlp_cookies
    return opts


def _domain(url: str) -> str:
    from urllib.parse import urlparse

    host = (urlparse(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def support_level(url: str) -> tuple[bool, str, str]:
    """Kembalikan (supported, level, platform_label) untuk sebuah URL."""
    domain = _domain(url)
    base = ".".join(domain.split(".")[-2:]) if domain else ""
    if base in DRM_DOMAINS:
        return False, "drm", base
    if base in LOGIN_DOMAINS:
        return True, "login", base
    # Cek apakah yt-dlp punya extractor untuk URL ini.
    try:
        ie = yt_dlp.YoutubeDL(_base_opts()).extract_info(url, download=False, process=False)
        return True, "full", (ie.get("extractor_key") or base)
    except Exception:
        # Fallback: cek berdasarkan pola extractor yang tersedia.
        from yt_dlp.extractor import gen_extractors

        for ie in gen_extractors():
            if ie.suitable(url) and ie.IE_NAME != "generic":
                return True, "full", ie.IE_NAME
        return False, "unknown", base or "unknown"


def _with_impersonate(opts: dict) -> dict:
    """Aktifkan impersonasi TLS Chrome untuk bypass anti-bot (mis. CBS HTTP 406)."""
    opts = dict(opts)
    # aria2c tak mendukung impersonasi TLS → lepas agar downloader native (yang
    # menghormati impersonasi) dipakai. Paralel fragmen tetap aktif.
    opts.pop("external_downloader", None)
    opts.pop("external_downloader_args", None)
    try:
        from yt_dlp.networking.impersonate import ImpersonateTarget

        opts["impersonate"] = ImpersonateTarget("chrome")
    except Exception:
        pass
    return opts


def get_info(url: str) -> dict:
    """Ambil metadata + daftar format. Coba normal dulu, fallback ke impersonasi."""
    try:
        with yt_dlp.YoutubeDL(_base_opts()) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError:
        # Situs mungkin memblokir bot (406/403). Coba lagi dengan impersonasi TLS.
        with yt_dlp.YoutubeDL(_with_impersonate(_base_opts())) as ydl:
            info = ydl.extract_info(url, download=False)

    formats = []
    for f in info.get("formats", []):
        if f.get("format_id") is None:
            continue
        vcodec = f.get("vcodec") or "none"
        acodec = f.get("acodec") or "none"
        if vcodec == "none" and acodec == "none":
            continue
        if vcodec != "none" and acodec != "none":
            note = "video+audio"
        elif vcodec != "none":
            note = "video only"
        else:
            note = "audio only"
        formats.append({
            "format_id": f["format_id"],
            "ext": f.get("ext") or "",
            "resolution": f.get("resolution") or (f.get("format_note") or "audio"),
            "filesize": f.get("filesize") or f.get("filesize_approx"),
            "vcodec": vcodec,
            "acodec": acodec,
            "note": note,
        })

    return {
        "id": info.get("id", ""),
        "title": info.get("title", "Untitled"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "uploader": info.get("uploader") or info.get("channel"),
        "webpage_url": info.get("webpage_url", url),
        "formats": formats,
    }


def _dir_size(path: str) -> int:
    """Total byte semua file di sebuah folder (abaikan file kontrol .aria2)."""
    total = 0
    try:
        for name in os.listdir(path):
            if name.endswith(".aria2"):
                continue
            fp = os.path.join(path, name)
            if os.path.isfile(fp):
                try:
                    total += os.path.getsize(fp)
                except OSError:
                    pass
    except OSError:
        pass
    return total


def _estimate_total(url: str, opts: dict) -> Optional[int]:
    """Perkiraan total byte format terpilih (untuk progress berbasis disk)."""
    probe = {k: v for k, v in opts.items() if k not in ("progress_hooks",)}
    probe["skip_download"] = True
    for o in (probe, _with_impersonate(probe)):
        try:
            with yt_dlp.YoutubeDL(o) as ydl:
                info = ydl.extract_info(url, download=False)
            rf = info.get("requested_formats")
            if rf:
                tot = sum((f.get("filesize") or f.get("filesize_approx") or 0) for f in rf)
            else:
                tot = info.get("filesize") or info.get("filesize_approx") or 0
            if tot:
                return int(tot)
        except Exception:
            continue
    return None


def download(
    url: str,
    format_id: str,
    convert_to: Optional[str],
    out_dir: str,
    on_progress: Optional[Callable[[float, Optional[int]], None]] = None,
) -> tuple[str, str]:
    """Unduh video. Kembalikan (path_file, nama_file).

    Progress dipantau dari ukuran file di disk (downloader-agnostic) sehingga
    tetap mulus meski memakai aria2c yang tak melapor progress ke yt-dlp.
    """
    os.makedirs(out_dir, exist_ok=True)
    outtmpl = os.path.join(out_dir, "%(title).80s.%(ext)s")

    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "outtmpl": outtmpl,
        "max_filesize": settings.max_filesize_mb * 1024 * 1024,
        "merge_output_format": "mp4",
        # ── Optimasi kecepatan ──
        # #1 HLS/DASH: unduh banyak fragmen sekaligus (paling berdampak).
        "concurrent_fragment_downloads": 8,
        # #2 File langsung: aria2c multi-koneksi (jauh lebih cepat dari downloader bawaan).
        "external_downloader": "aria2c",
        "external_downloader_args": {
            "aria2c": ["-x", "16", "-s", "16", "-k", "1M", "--summary-interval=1"],
        },
    }
    if settings.ytdlp_cookies and os.path.exists(settings.ytdlp_cookies):
        opts["cookiefile"] = settings.ytdlp_cookies

    # Progress dari native yt-dlp (berguna untuk HLS/fragmen) sebagai cadangan.
    native = {"pct": 0.0, "eta": None}

    def _native_hook(d: dict):
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            done = d.get("downloaded_bytes") or 0
            if total:
                native["pct"] = min(99.0, done / total * 100)
                native["eta"] = d.get("eta")

    opts["progress_hooks"] = [_native_hook]

    if convert_to == "mp3":
        opts["format"] = "bestaudio/best"
        opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }]
    else:
        # Muxing video-only + best audio. Prioritaskan mp4+m4a → merge = copy (instan).
        if format_id in ("best", "", None):
            opts["format"] = (
                "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best"
            )
        elif "+" in format_id:
            opts["format"] = format_id
        else:
            opts["format"] = f"{format_id}+bestaudio[ext=m4a]/{format_id}+bestaudio/best"

    # Perkiraan total byte → progress berbasis disk (mulus untuk aria2c).
    total_expected = _estimate_total(url, opts) if on_progress else None

    stop = threading.Event()

    def _monitor():
        while not stop.is_set():
            if on_progress:
                disk_pct = (
                    min(99.0, _dir_size(out_dir) / total_expected * 100)
                    if total_expected
                    else 0.0
                )
                # Pakai nilai tertinggi antara disk vs native (fragmen HLS).
                pct = max(disk_pct, native["pct"])
                if pct > 0:
                    on_progress(round(pct, 1), native["eta"])
            time.sleep(1)

    monitor_thread = threading.Thread(target=_monitor, daemon=True)
    if on_progress:
        monitor_thread.start()

    def _run(o: dict):
        with yt_dlp.YoutubeDL(o) as ydl:
            info = ydl.extract_info(url, download=True)
            path = ydl.prepare_filename(info)
            if convert_to == "mp3":
                path = os.path.splitext(path)[0] + ".mp3"
            elif not os.path.exists(path):
                base = os.path.splitext(path)[0]
                for ext in (".mp4", ".mkv", ".webm"):
                    if os.path.exists(base + ext):
                        path = base + ext
                        break
            return path

    try:
        try:
            final_path = _run(opts)
        except yt_dlp.utils.DownloadError:
            # Fallback: bypass anti-bot dengan impersonasi TLS.
            final_path = _run(_with_impersonate(opts))
    finally:
        stop.set()

    return final_path, os.path.basename(final_path)
