import PlatformExplorer from "./PlatformExplorer";

export default function SupportedPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Platform yang Didukung
        </h1>
        <p className="mt-2 text-slate-500">
          Daftar platform populer beserta cara download-nya. Konten ber-DRM
          (Netflix, Disney+, Spotify berbayar) tidak bisa diunduh — itu batas
          teknologi, bukan keterbatasan aplikasi.
        </p>
      </div>
      <PlatformExplorer />
    </div>
  );
}
