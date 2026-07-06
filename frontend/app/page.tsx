import DownloadClient from "./components/DownloadClient";

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Download Video dari Mana Saja
        </h1>
        <p className="mt-3 text-slate-500">
          Tempel <b>link</b> atau <b>kode embed</b> dari YouTube, TikTok, Instagram,
          X, Facebook, dan <span className="text-brand-dark">1800+ situs</span>{" "}
          lainnya. Pilih format & kualitas, langsung download.
        </p>
      </div>

      <DownloadClient />
    </div>
  );
}
