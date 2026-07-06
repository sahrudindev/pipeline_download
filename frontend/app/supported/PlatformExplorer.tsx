"use client";

import { useEffect, useMemo, useState } from "react";
import {
  categoryLabel,
  Category,
  platforms,
  supportLabel,
} from "@/lib/platforms";
import { API_BASE } from "@/lib/api";

export default function PlatformExplorer() {
  const [cat, setCat] = useState<Category | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  // pencarian daftar lengkap dari backend
  const [query, setQuery] = useState("");
  const [allSites, setAllSites] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/supported`)
      .then((r) => r.json())
      .then((d) => setAllSites(d.extractors || []))
      .catch(() => setAllSites([]));
  }, []);

  const filtered = useMemo(
    () => platforms.filter((p) => cat === "all" || p.category === cat),
    [cat]
  );

  const siteResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allSites.filter((s) => s.toLowerCase().includes(q)).slice(0, 40);
  }, [query, allSites]);

  return (
    <div className="space-y-8">
      {/* Filter kategori */}
      <div className="flex flex-wrap gap-2">
        {(["all", "video", "social", "audio", "live"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              cat === c
                ? "border-brand bg-brand/10 text-brand-dark"
                : "border-slate-300 text-slate-500 hover:text-slate-700"
            }`}
          >
            {categoryLabel[c]}
          </button>
        ))}
      </div>

      {/* Grid kartu platform */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const badge = supportLabel[p.support];
          const open = expanded === p.id;
          return (
            <div
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{p.icon}</span>
                  <span className="font-semibold text-slate-900">{p.name}</span>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${badge.cls}`}>
                  {badge.text}
                </span>
              </div>

              <button
                onClick={() => setExpanded(open ? null : p.id)}
                className="mt-3 text-sm text-brand-dark hover:underline"
              >
                {open ? "Tutup" : "Cara pakai"}
              </button>

              {open && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-600">
                    {p.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  {p.support !== "drm" && (
                    <a
                      href={`/?url=${encodeURIComponent(p.urlExample)}`}
                      className="mt-1 inline-block break-all text-xs text-slate-400 hover:text-brand-dark"
                    >
                      Contoh: {p.urlExample}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pencarian daftar lengkap */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">
          Tidak ada di daftar? Cari di 1800+ situs
        </h3>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ketik nama situs, misal: bilibili, dailymotion…"
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand"
        />
        {query.trim() && (
          <div className="mt-3 flex flex-wrap gap-2">
            {siteResults.length === 0 ? (
              <p className="text-sm text-slate-400">Tidak ditemukan.</p>
            ) : (
              siteResults.map((s) => (
                <span
                  key={s}
                  className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-600"
                >
                  {s}
                </span>
              ))
            )}
          </div>
        )}
        {allSites.length > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            {allSites.length} situs terdeteksi dari engine.
          </p>
        )}
      </div>
    </div>
  );
}
