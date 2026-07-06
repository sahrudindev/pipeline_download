"""FastAPI entrypoint + routes."""
from __future__ import annotations

import os
import uuid

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import extractor, storage
from .config import settings
from .ratelimit import check_rate_limit
from .schemas import (
    CheckResponse,
    DownloadRequest,
    DownloadResponse,
    InfoRequest,
    InfoResponse,
    StatusResponse,
)

app = FastAPI(title="Universal Video Downloader API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/check", response_model=CheckResponse)
def check(url: str):
    url = extractor.normalize_input(url)
    supported, level, platform = extractor.support_level(url)
    return CheckResponse(url=url, supported=supported, support_level=level, platform=platform)


@app.post("/api/info", response_model=InfoResponse)
def info(req: InfoRequest, request: Request, _=Depends(check_rate_limit)):
    url = extractor.normalize_input(req.url)  # terima URL polos ATAU kode embed
    supported, level, platform = extractor.support_level(url)
    if not supported:
        detail = (
            "Konten ber-DRM tidak bisa di-download."
            if level == "drm"
            else "URL / kode embed tidak didukung."
        )
        raise HTTPException(status_code=422, detail=detail)
    try:
        data = extractor.get_info(url)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Gagal mengambil info: {str(e)[:200]}")
    return InfoResponse(**data)


@app.post("/api/download", response_model=DownloadResponse, status_code=202)
def download(req: DownloadRequest, request: Request, _=Depends(check_rate_limit)):
    url = extractor.normalize_input(req.url)
    supported, level, _p = extractor.support_level(url)
    if not supported:
        raise HTTPException(status_code=422, detail="URL / kode embed tidak didukung / ber-DRM.")

    job_id = uuid.uuid4().hex[:12]
    storage.create_job(job_id, url, req.format_id)

    # Import lokal supaya API tidak butuh worker untuk start.
    from .tasks import download_task

    download_task.delay(job_id, url, req.format_id, req.convert_to)
    return DownloadResponse(job_id=job_id, status="queued")


@app.get("/api/status/{job_id}", response_model=StatusResponse)
def status(job_id: str):
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan atau kedaluwarsa.")
    download_url = f"/api/file/{job_id}" if job.get("status") == "done" else None
    return StatusResponse(
        job_id=job_id,
        status=job.get("status", "unknown"),
        progress=job.get("progress", 0.0),
        eta=job.get("eta"),
        filename=job.get("filename"),
        download_url=download_url,
        error=job.get("error"),
    )


@app.get("/api/file/{job_id}")
def file(job_id: str):
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=410, detail="File sudah kedaluwarsa/dihapus.")
    path = job.get("file_path")
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=410, detail="File tidak tersedia.")
    return FileResponse(
        path,
        filename=job.get("filename") or os.path.basename(path),
        media_type="application/octet-stream",
    )


@app.get("/api/supported")
def supported():
    """Daftar extractor aktif dari yt-dlp (untuk pencarian di frontend)."""
    from yt_dlp.extractor import gen_extractor_classes

    names = sorted({
        ie.IE_NAME for ie in gen_extractor_classes()
        if ie.IE_NAME and ie.IE_NAME != "generic" and not ie.IE_NAME.startswith("youtube:")
    })
    return {"count": len(names), "extractors": names}
