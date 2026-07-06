from typing import Optional
from pydantic import BaseModel


class InfoRequest(BaseModel):
    url: str


class FormatInfo(BaseModel):
    format_id: str
    ext: str
    resolution: str
    filesize: Optional[int] = None
    vcodec: str
    acodec: str
    note: str


class InfoResponse(BaseModel):
    id: str
    title: str
    thumbnail: Optional[str] = None
    duration: Optional[int] = None
    uploader: Optional[str] = None
    webpage_url: str
    formats: list[FormatInfo]


class DownloadRequest(BaseModel):
    url: str
    format_id: str = "best"
    convert_to: Optional[str] = None  # None | "mp3"


class DownloadResponse(BaseModel):
    job_id: str
    status: str


class StatusResponse(BaseModel):
    job_id: str
    status: str  # queued | processing | done | error
    progress: float = 0.0
    eta: Optional[int] = None
    filename: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[str] = None


class CheckResponse(BaseModel):
    url: str
    supported: bool
    support_level: str  # full | login | drm | unknown
    platform: str
