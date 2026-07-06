export type Support = "full" | "login" | "drm";
export type Category = "video" | "social" | "audio" | "live";

export type Platform = {
  id: string;
  name: string;
  icon: string;
  category: Category;
  support: Support;
  urlExample: string;
  steps: string[];
};

export const platforms: Platform[] = [
  {
    id: "youtube",
    name: "YouTube",
    icon: "▶️",
    category: "video",
    support: "full",
    urlExample: "https://youtube.com/watch?v=dQw4w9WgXcQ",
    steps: [
      "Salin URL video dari browser atau tombol Share.",
      "Tempel di kolom input pada halaman utama.",
      "Pilih format (MP4 / MP3) dan kualitas.",
      "Klik Download lalu tunggu prosesnya selesai.",
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "🎵",
    category: "social",
    support: "full",
    urlExample: "https://www.tiktok.com/@user/video/1234567890",
    steps: [
      "Buka video, tekan Share → Copy link.",
      "Tempel link di halaman utama.",
      "Biasanya tersedia tanpa watermark.",
      "Klik Download.",
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📷",
    category: "social",
    support: "login",
    urlExample: "https://www.instagram.com/reel/Cxxxxxx/",
    steps: [
      "Salin link Reel/Post dari menu (⋯) → Copy link.",
      "Video privat membutuhkan cookies login (lihat README).",
      "Tempel link di halaman utama.",
      "Klik Download.",
    ],
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    icon: "🐦",
    category: "social",
    support: "full",
    urlExample: "https://x.com/user/status/1234567890",
    steps: [
      "Salin URL tweet yang berisi video.",
      "Tempel di halaman utama.",
      "Pilih kualitas.",
      "Klik Download.",
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "👍",
    category: "social",
    support: "login",
    urlExample: "https://www.facebook.com/watch?v=1234567890",
    steps: [
      "Salin URL video (bukan URL feed).",
      "Video privat membutuhkan cookies login.",
      "Tempel di halaman utama.",
      "Klik Download.",
    ],
  },
  {
    id: "vimeo",
    name: "Vimeo",
    icon: "🎬",
    category: "video",
    support: "full",
    urlExample: "https://vimeo.com/123456789",
    steps: [
      "Salin URL video Vimeo.",
      "Tempel di halaman utama.",
      "Pilih kualitas.",
      "Klik Download.",
    ],
  },
  {
    id: "twitch",
    name: "Twitch",
    icon: "🎮",
    category: "live",
    support: "full",
    urlExample: "https://www.twitch.tv/videos/123456789",
    steps: [
      "Gunakan URL VOD atau Clip (bukan live yang sedang berlangsung).",
      "Tempel di halaman utama.",
      "Pilih kualitas.",
      "Klik Download.",
    ],
  },
  {
    id: "soundcloud",
    name: "SoundCloud",
    icon: "🔊",
    category: "audio",
    support: "full",
    urlExample: "https://soundcloud.com/artist/track",
    steps: [
      "Salin URL track.",
      "Tempel di halaman utama.",
      "Pilih mode Audio (MP3).",
      "Klik Download.",
    ],
  },
  {
    id: "reddit",
    name: "Reddit",
    icon: "🤖",
    category: "social",
    support: "full",
    urlExample: "https://www.reddit.com/r/sub/comments/xxxx/",
    steps: [
      "Salin URL post yang berisi video.",
      "Tempel di halaman utama.",
      "Audio akan digabung otomatis.",
      "Klik Download.",
    ],
  },
  {
    id: "netflix",
    name: "Netflix / DRM",
    icon: "🔒",
    category: "video",
    support: "drm",
    urlExample: "https://www.netflix.com/watch/12345678",
    steps: [
      "Konten ini terlindungi DRM (enkripsi).",
      "Tidak ada tool mana pun yang bisa mengunduhnya — ini batas teknologi.",
      "Berlaku juga untuk Disney+, Prime Video, Spotify berbayar, dll.",
    ],
  },
];

export const supportLabel: Record<Support, { text: string; cls: string }> = {
  full: { text: "✅ Penuh", cls: "text-green-700 border-green-300 bg-green-50" },
  login: { text: "⚠️ Perlu login", cls: "text-amber-700 border-amber-300 bg-amber-50" },
  drm: { text: "❌ DRM", cls: "text-red-700 border-red-300 bg-red-50" },
};

export const categoryLabel: Record<Category | "all", string> = {
  all: "Semua",
  video: "Video",
  social: "Sosial",
  audio: "Audio",
  live: "Live",
};
