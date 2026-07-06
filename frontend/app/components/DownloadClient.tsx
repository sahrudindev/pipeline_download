"use client";

import { useEffect, useState } from "react";
import {
  fileUrl,
  getInfo,
  getStatus,
  startDownload,
  VideoInfo,
} from "@/lib/api";
import ProgressBar from "./ProgressBar";

function humanSize(bytes: number | null): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}

function humanDuration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Ekstrak URL dari kode embed (<iframe src="...">) atau teks bebas.
function extractUrl(input: string): string {
  const t = input.trim();
  const src = t.match(/src\s*=\s*["']([^"']+)["']/i);
  if (src) return src[1].trim();
  if (t.includes("<") || /\s/.test(t)) {
    const u = t.match(/https?:\/\/[^\s"'<>]+/i);
    if (u) return u[0].trim();
  }
  return t;
}

export default function DownloadClient() {
  const [inputMode, setInputMode] = useState<"link" | "embed">("link");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [mode, setMode] = useState<"video" | "audio">("video");
  const [selectedFormat, setSelectedFormat] = useState("best");

  // status download
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Prefill dari ?url= (dipakai oleh contoh link di halaman Platform Didukung).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("url");
    if (prefill) setUrl(prefill);
  }, []);

  const resolvedUrl = extractUrl(url);

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvedUrl) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    setReadyUrl(null);
    setDownloadError(null);
    try {
      const data = await getInfo(resolvedUrl);
      setInfo(data);
      setSelectedFormat("best");
    } catch (err: any) {
      setError(err.message || "Gagal mengambil info video.");
    } finally {
      setLoading(false);
    }
  }

  // Deteksi otomatis: kalau user menempel kode <iframe>, pindah ke mode Embed.
  function onInputChange(value: string) {
    setUrl(value);
    if (/<\s*iframe|src\s*=/i.test(value)) setInputMode("embed");
  }

  async function handleDownload() {
    if (!info) return;
    setDownloading(true);
    setProgress(0);
    setReadyUrl(null);
    setDownloadError(null);
    try {
      const convertTo = mode === "audio" ? "mp3" : null;
      const fmt = mode === "audio" ? "best" : selectedFormat;
      const { job_id } = await startDownload(info.webpage_url, fmt, convertTo);

      // polling
      const poll = setInterval(async () => {
        try {
          const st = await getStatus(job_id);
          setProgress(st.progress);
          if (st.status === "done" && st.download_url) {
            clearInterval(poll);
            setReadyUrl(fileUrl(st.download_url));
            setDownloading(false);
          } else if (st.status === "error") {
            clearInterval(poll);
            setDownloadError(st.error || "Download gagal.");
            setDownloading(false);
          }
        } catch {
          clearInterval(poll);
          setDownloadError("Koneksi ke server terputus.");
          setDownloading(false);
        }
      }, 1500);
    } catch (err: any) {
      setDownloadError(err.message || "Gagal memulai download.");
      setDownloading(false);
    }
  }

  const videoFormats =
    info?.formats.filter((f) => f.vcodec !== "none") ?? [];

  return (
    <div className="space-y-6">
      {/* Input dengan tab Link / Embed */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setInputMode("link")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              inputMode === "link"
                ? "border-brand bg-brand/10 text-brand-dark"
                : "border-slate-300 text-slate-500 hover:text-slate-700"
            }`}
          >
            🔗 Link URL
          </button>
          <button
            type="button"
            onClick={() => setInputMode("embed")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              inputMode === "embed"
                ? "border-brand bg-brand/10 text-brand-dark"
                : "border-slate-300 text-slate-500 hover:text-slate-700"
            }`}
          >
            {"</>"} Kode Embed
          </button>
        </div>

        <form onSubmit={handleFetch} className="space-y-3">
          {inputMode === "link" ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Tempel link video (YouTube, TikTok, IG, CBS, ...)"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {loading ? "Memuat…" : "Cek"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={url}
                onChange={(e) => onInputChange(e.target.value)}
                rows={3}
                placeholder={'Tempel kode embed di sini, misal:\n<iframe src="https://..." ...></iframe>'}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-mono text-xs text-slate-900 outline-none focus:border-brand"
              />
              {url && resolvedUrl && resolvedUrl !== url.trim() && (
                <p className="truncate text-xs text-slate-500">
                  URL terdeteksi: <span className="text-brand-dark">{resolvedUrl}</span>
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !resolvedUrl}
                className="w-full rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {loading ? "Memuat…" : "Cek dari Embed"}
              </button>
            </div>
          )}
        </form>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Preview + pilihan */}
      {info && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex gap-4">
            {info.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={info.thumbnail}
                alt=""
                className="h-24 w-40 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-2 font-semibold text-slate-900">{info.title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {info.uploader} {info.duration ? `· ${humanDuration(info.duration)}` : ""}
              </p>
            </div>
          </div>

          {/* Mode */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("video")}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm ${
                mode === "video"
                  ? "border-brand bg-brand/10 text-brand-dark"
                  : "border-slate-300 text-slate-500 hover:text-slate-700"
              }`}
            >
              🎬 Video (MP4)
            </button>
            <button
              onClick={() => setMode("audio")}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm ${
                mode === "audio"
                  ? "border-brand bg-brand/10 text-brand-dark"
                  : "border-slate-300 text-slate-500 hover:text-slate-700"
              }`}
            >
              🎵 Audio (MP3)
            </button>
          </div>

          {/* Pilihan kualitas video */}
          {mode === "video" && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">Kualitas</label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand"
              >
                <option value="best">Terbaik (otomatis)</option>
                {videoFormats.map((f) => (
                  <option key={f.format_id} value={f.format_id}>
                    {f.resolution} · {f.ext} · {humanSize(f.filesize)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tombol download */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {downloading ? "Memproses…" : "⬇ Download"}
          </button>

          {downloading && (
            <div className="space-y-2">
              <ProgressBar value={progress} />
              <p className="text-center text-xs text-slate-500">
                {progress.toFixed(0)}%
              </p>
            </div>
          )}

          {downloadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {downloadError}
            </div>
          )}

          {readyUrl && (
            <a
              href={readyUrl}
              className="block w-full rounded-lg bg-green-600 px-4 py-3 text-center font-semibold text-white hover:bg-green-500"
            >
              ✅ Simpan file
            </a>
          )}
        </div>
      )}
    </div>
  );
}
