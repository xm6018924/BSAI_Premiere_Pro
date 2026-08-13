import os
import json
import string
import urllib.parse

from server import PromptServer
from aiohttp import web

from .utils import (
    scan_video_directory, scan_audio_files,
    get_video_info, generate_thumbnail,
    process_and_merge, format_time,
    _resolve_directory,
)

# In-memory timeline data store, keyed by node unique_id.
# Frontend POSTs timeline JSON here; backend render() reads from here.
_timeline_store = {}


@PromptServer.instance.routes.get("/bsai_premiere_pro/scan")
async def scan_directory(request):
    directory = request.query.get("directory", "output")
    try:
        files = scan_video_directory(directory)
        return web.json_response({"files": files, "directory": directory})
    except Exception as e:
        return web.json_response({"files": [], "error": str(e)}, status=500)


@PromptServer.instance.routes.get("/bsai_premiere_pro/metadata")
async def get_metadata(request):
    file_path = request.query.get("file", "")
    file_path = urllib.parse.unquote(file_path)
    if not file_path or not os.path.exists(file_path):
        return web.json_response({"error": "File not found"}, status=404)
    info = get_video_info(file_path)
    if info is None:
        return web.json_response({"error": "Failed to get video info"}, status=500)
    return web.json_response(info)


@PromptServer.instance.routes.get("/bsai_premiere_pro/thumbnail")
async def get_thumbnail(request):
    file_path = request.query.get("file", "")
    file_path = urllib.parse.unquote(file_path)
    if not file_path or not os.path.exists(file_path):
        return web.json_response({"error": "File not found"}, status=404)
    thumb = generate_thumbnail(file_path)
    if thumb is None:
        return web.json_response({"error": "Failed to generate thumbnail"}, status=500)
    return web.json_response({"thumbnail": thumb})


@PromptServer.instance.routes.get("/bsai_premiere_pro/audio_files")
async def list_audio_files(request):
    directory = request.query.get("directory", "output")
    try:
        files = scan_audio_files(directory)
        return web.json_response({"files": files})
    except Exception as e:
        return web.json_response({"files": [], "error": str(e)}, status=500)


@PromptServer.instance.routes.get("/bsai_premiere_pro/stream")
async def stream_video(request):
    """Stream a video file for timeline playback with Range support."""
    file_path = request.query.get("file", "")
    file_path = urllib.parse.unquote(file_path)
    if not file_path or not os.path.exists(file_path):
        return web.Response(status=404, text="File not found")

    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("Range")

    if range_header:
        # Parse Range header: bytes=start-end
        import re
        m = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if m:
            start = int(m.group(1))
            end = int(m.group(2)) if m.group(2) else file_size - 1
            chunk_size = end - start + 1
            with open(file_path, "rb") as f:
                f.seek(start)
                chunk = f.read(chunk_size)
            return web.Response(
                body=chunk,
                status=206,
                headers={
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(chunk_size),
                    "Content-Type": "video/mp4",
                },
            )

    # No Range header - serve entire file
    with open(file_path, "rb") as f:
        data = f.read()
    return web.Response(
        body=data,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": "video/mp4",
        },
    )


@PromptServer.instance.routes.post("/bsai_premiere_pro/render")
async def render_video(request):
    try:
        data = await request.json()
        timeline_str = data.get("timeline_data", "")
        output_filename = data.get("output_filename", "premiere_pro_output")
        format_str = data.get("format", "video/h264-mp4")
        pix_fmt = data.get("pix_fmt", "yuv420p")
        crf = data.get("crf", 19)
        frame_rate = data.get("frame_rate", 24)
        default_transition = data.get("default_transition", "fade")
        transition_duration = float(data.get("transition_duration", 0.5))

        if not timeline_str:
            return web.json_response({"error": "No timeline data"})

        timeline_data = json.loads(timeline_str)
        clips = timeline_data.get("clips", [])
        if not clips:
            return web.json_response({"error": "No clips to merge"})

        output_path, error = process_and_merge(
            timeline_data, output_filename, format_str, pix_fmt,
            crf, frame_rate, default_transition, transition_duration
        )

        if error:
            return web.json_response({"error": error})

        filename = os.path.basename(output_path) if output_path else ""
        return web.json_response({
            "output_path": output_path,
            "filename": filename,
            "clip_count": len(clips),
        })
    except json.JSONDecodeError:
        return web.json_response({"error": "Invalid JSON data"}, status=400)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.get("/bsai_premiere_pro/status")
async def get_status(request):
    from .utils import get_ffmpeg, get_ffprobe
    ffmpeg = get_ffmpeg()
    ffprobe = get_ffprobe()
    return web.json_response({
        "ffmpeg": ffmpeg or "not found",
        "ffprobe": ffprobe or "not found",
    })


@PromptServer.instance.routes.get("/bsai_premiere_pro/browse")
async def browse_directories(request):
    import asyncio
    raw_path = request.query.get("path", "")
    path = urllib.parse.unquote(raw_path)

    def _scan_dir(p):
        if not p or p == "":
            if os.name == "nt":
                import ctypes
                buf = ctypes.create_unicode_buffer(1024)
                buf_len = ctypes.windll.kernel32.GetLogicalDriveStringsW(
                    ctypes.sizeof(buf) // 2, buf
                )
                drives = []
                for i in range(0, buf_len, 4):
                    d = buf[i:i+3]
                    if d and len(d) == 3 and d[1] == ":":
                        drives.append(d)
                return {"path": "", "parent": "", "dirs": drives, "is_root": True, "count": len(drives)}, None
            else:
                p = "/"
        if not os.path.exists(p):
            return None, f"路径不存在: {p}"
        if not os.path.isdir(p):
            return None, f"不是目录: {p}"
        parent = os.path.dirname(p.rstrip(os.sep)) or p
        if parent == p:
            parent = ""
        dirs = []
        errors = []
        try:
            with os.scandir(p) as entries:
                for entry in entries:
                    try:
                        is_d = entry.is_dir()
                        if not is_d:
                            # Fallback: some special dirs/junctions fail is_dir()
                            full = os.path.join(p, entry.name)
                            if os.path.isdir(full):
                                is_d = True
                        if is_d:
                            dirs.append(entry.name)
                    except OSError as e:
                        # Try fallback before giving up
                        try:
                            full = os.path.join(p, entry.name)
                            if os.path.isdir(full):
                                dirs.append(entry.name)
                            else:
                                errors.append(f"{entry.name}: {e}")
                        except Exception:
                            errors.append(f"{entry.name}: {e}")
        except PermissionError:
            errors.append("Permission denied")
        except Exception as e:
            errors.append(str(e))
        dirs.sort()
        return {"path": p, "parent": parent, "dirs": dirs, "is_root": False, "count": len(dirs), "errors": errors}, None

    resolved = _resolve_directory(path) if path else ""

    try:
        result, error = await asyncio.wait_for(
            asyncio.to_thread(_scan_dir, resolved),
            timeout=30.0
        )
        if error:
            return web.json_response({"error": error, "path": path}, status=400)
        return web.json_response(result)
    except asyncio.TimeoutError:
        return web.json_response({"error": f"目录扫描超时(30s): {path}", "path": path}, status=504)
    except Exception as e:
        return web.json_response({"error": str(e), "path": path}, status=500)


@PromptServer.instance.routes.get("/bsai_premiere_pro/browse_files")
async def browse_files(request):
    """Browse files (video/audio/image) in a directory."""
    import asyncio
    raw_path = request.query.get("path", "")
    path = urllib.parse.unquote(raw_path)

    VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv", ".m4v"}
    AUDIO_EXTS = {".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma"}
    IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".tiff"}
    ALL_EXTS = VIDEO_EXTS | AUDIO_EXTS | IMAGE_EXTS

    def _scan_files(p):
        if not p or p == "":
            # Empty path: show drives (Windows) or root (Unix), same as directory browser
            if os.name == "nt":
                import ctypes
                buf = ctypes.create_unicode_buffer(1024)
                buf_len = ctypes.windll.kernel32.GetLogicalDriveStringsW(
                    ctypes.sizeof(buf) // 2, buf
                )
                drives = []
                for i in range(0, buf_len, 4):
                    d = buf[i:i+3]
                    if d and len(d) == 3 and d[1] == ":":
                        drives.append(d)
                return {"path": "", "parent": "", "dirs": drives, "files": [], "is_root": True, "count": len(drives)}, None
            else:
                p = "/"
        if not os.path.exists(p):
            return None, f"路径不存在: {p}"
        if not os.path.isdir(p):
            return None, f"不是目录: {p}"
        parent = os.path.dirname(p.rstrip(os.sep)) or p
        if parent == p:
            parent = ""
        dirs = []
        files = []
        try:
            with os.scandir(p) as entries:
                for entry in entries:
                    try:
                        is_d = entry.is_dir()
                        if not is_d:
                            full = os.path.join(p, entry.name)
                            if os.path.isdir(full):
                                is_d = True
                        if is_d:
                            dirs.append(entry.name)
                        elif entry.is_file():
                            ext = os.path.splitext(entry.name)[1].lower()
                            if ext in ALL_EXTS:
                                stat = entry.stat()
                                file_type = "video" if ext in VIDEO_EXTS else \
                                           "audio" if ext in AUDIO_EXTS else "image"
                                files.append({
                                    "name": entry.name,
                                    "path": os.path.join(p, entry.name),
                                    "size": stat.st_size,
                                    "type": file_type,
                                    "ext": ext,
                                })
                    except OSError:
                        try:
                            full = os.path.join(p, entry.name)
                            if os.path.isdir(full):
                                dirs.append(entry.name)
                        except Exception:
                            pass
        except PermissionError:
            pass
        dirs.sort()
        files.sort(key=lambda f: f["name"])
        return {"path": p, "parent": parent, "dirs": dirs, "files": files}, None

    resolved = _resolve_directory(path) if path else ""

    try:
        result, error = await asyncio.wait_for(
            asyncio.to_thread(_scan_files, resolved),
            timeout=30.0
        )
        if error:
            return web.json_response({"error": error, "path": path}, status=400)
        return web.json_response(result)
    except asyncio.TimeoutError:
        return web.json_response({"error": f"文件扫描超时(30s): {path}", "path": path}, status=504)
    except Exception as e:
        return web.json_response({"error": str(e), "path": path}, status=500)


@PromptServer.instance.routes.post("/bsai_premiere_pro/timeline_save")
async def save_timeline(request):
    try:
        body = await request.json()
        node_id = str(body.get("node_id", ""))
        timeline_data = body.get("timeline_data", '{"clips":[],"known_files":[],"deleted_files":[],"directory_history":{}}')
        if node_id:
            _timeline_store[node_id] = timeline_data
        return web.json_response({"ok": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.get("/bsai_premiere_pro/timeline_load")
async def load_timeline(request):
    node_id = str(request.query.get("node_id", ""))
    data = _timeline_store.get(node_id, '{"clips":[],"known_files":[],"deleted_files":[],"directory_history":{}}')
    return web.json_response({"timeline_data": data})
