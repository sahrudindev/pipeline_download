export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type FormatInfo = {
  format_id: string;
  ext: string;
  resolution: string;
  filesize: number | null;
  vcodec: string;
  acodec: string;
  note: string;
};

export type VideoInfo = {
  id: string;
  title: string;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  webpage_url: string;
  formats: FormatInfo[];
};

export type JobStatus = {
  job_id: string;
  status: "queued" | "processing" | "done" | "error";
  progress: number;
  eta: number | null;
  filename: string | null;
  download_url: string | null;
  error: string | null;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Error ${res.status}`);
  }
  return res.json();
}

export const getInfo = (url: string) => post<VideoInfo>("/api/info", { url });

export const startDownload = (
  url: string,
  format_id: string,
  convert_to: string | null
) => post<{ job_id: string; status: string }>("/api/download", { url, format_id, convert_to });

export async function getStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/status/${jobId}`);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json();
}

export const fileUrl = (path: string) => `${API_BASE}${path}`;
