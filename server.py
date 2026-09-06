import os
import json
import string
import urllib.parse

from server import PromptServer
from aiohttp import web

from .utils import (
    scan_video_directory, scan_audio_files,
    get_video_info, generate_thumbnail, generate_waveform,
    generate_filmstrip,
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


@PromptServer.instance.routes.get("/bsai_premiere_pro/filmstrip")
async def get_filmstrip(request):
    import asyncio
    file_path = request.query.get("file", "")
    file_path = urllib.parse.unquote(file_path)
    if not file_path or not os.path.exists(file_path):
        return web.json_response({"error": "File not found"}, status=404)
    count = int(request.query.get("count", "10"))
    height = int(request.query.get("height", "80"))
    try:
        strip = await asyncio.to_thread(generate_filmstrip, file_path, count, height)
        if strip is None:
            return web.json_response({"error": "Failed to generate filmstrip"}, status=500)
        return web.json_response({"filmstrip": strip})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.get("/bsai_premiere_pro/waveform")
async def get_waveform(request):
    """Generate waveform amplitude data for an audio/video file."""
    import asyncio
    file_path = request.query.get("file", "")
    file_path = urllib.parse.unquote(file_path)
    if not file_path or not os.path.exists(file_path):
        return web.json_response({"error": "File not found"}, status=404)
    try:
        waveform = await asyncio.to_thread(generate_waveform, file_path, 200)
        if waveform is None:
            return web.json_response({"error": "Failed to generate waveform"}, status=500)
        return web.json_response({"waveform": waveform})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.get("/bsai_premiere_pro/audio_files")
async def list_audio_files(request):
    directory = request.query.get("directory", "output")
    try:
        files = scan_audio_files(directory)
        return web.json_response({"files": files})
    except Exception as e:
        return web.json_response({"files": [], "error": str(e)}, status=500)


import mimetypes

_CONTENT_TYPE_OVERRIDES = {
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".aac": "audio/aac",
    ".flac": "audio/flac", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
    ".wma": "audio/x-ms-wma", ".opus": "audio/opus",
}


@PromptServer.instance.routes.get("/bsai_premiere_pro/stream")
async def stream_video(request):
    """Stream a video/audio/image file for timeline playback with Range support."""
    file_path = request.query.get("file", "")
    file_path = urllib.parse.unquote(file_path)
    if not file_path or not os.path.exists(file_path):
        return web.Response(status=404, text="File not found")

    file_size = os.path.getsize(file_path)
    ext = os.path.splitext(file_path)[1].lower()
    content_type = _CONTENT_TYPE_OVERRIDES.get(ext)
    if not content_type:
        guessed, _ = mimetypes.guess_type(file_path)
        content_type = guessed or "video/mp4"

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
                    "Content-Type": content_type,
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
            "Content-Type": content_type,
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


@PromptServer.instance.routes.post("/bsai_premiere_pro/add_clip")
async def add_clip(request):
    """Add a video file to the timeline by path (used by H3 per-clip WebSocket push)."""
    try:
        import json as _json
        import os as _os
        import time as _time
        body = await request.json()
        node_id = str(body.get("node_id", ""))
        file_path = str(body.get("file_path", ""))
        clip_name = str(body.get("clip_name", ""))
        if not node_id or not file_path or not _os.path.exists(file_path):
            return web.json_response({"error": "missing node_id or file_path not found"}, status=400)

        td_raw = _timeline_store.get(node_id, '{"clips":[],"known_files":[],"deleted_files":[],"directory_history":{}}')
        td = _json.loads(td_raw)
        if not td.get("clips"):
            td["clips"] = []
        if not td.get("known_files"):
            td["known_files"] = []
        if not td.get("video_tracks"):
            td["video_tracks"] = [{"name": "V1", "locked": False, "visible": True}]
        if not td.get("audio_tracks"):
            td["audio_tracks"] = [{"name": "A1", "locked": False, "muted": False, "solo": False}]

        file_name = _os.path.basename(file_path)
        # Skip duplicate
        if file_name in td["known_files"] or any(c.get("file_name") == file_name for c in td["clips"]):
            return web.json_response({"ok": True, "skipped": "duplicate"})

        # Probe metadata with ffprobe if available
        dur, w, h, fps = 0.0, 1920, 1080, 24.0
        try:
            import subprocess as _sp
            _ffprobe = None
            for _cand in ["ffprobe"]:
                from shutil import which as _which
                _ffprobe = _which(_cand)
                if _ffprobe:
                    break
            if _ffprobe:
                _r = _sp.run([_ffprobe, "-v", "error", "-select_streams", "v:0",
                               "-show_entries", "stream=width,height,r_frame_rate:format=duration",
                               "-of", "json", file_path], capture_output=True, text=True, timeout=10)
                _meta = _json.loads(_r.stdout)
                if _meta.get("streams"):
                    w = int(_meta["streams"][0].get("width", 1920))
                    h = int(_meta["streams"][0].get("height", 1080))
                    _rfr = _meta["streams"][0].get("r_frame_rate", "24/1")
                    if "/" in _rfr:
                        _n, _d = _rfr.split("/")
                        fps = float(_n) / float(_d) if float(_d) > 0 else 24.0
                if _meta.get("format"):
                    dur = float(_meta["format"].get("duration", 0))
        except Exception:
            pass

        _ts = int(_time.time() * 1000)
        _vId = f"h3clip_{_ts}_{node_id}"
        _aId = f"h3clip_{_ts+1}_{node_id}"
        _base = {
            "file_path": file_path,
            "file_name": file_name,
            "created_time": _time.time(),
            "duration": round(dur, 3),
            "width": w,
            "height": h,
            "fps": fps,
            "has_audio": True,
            "trim_start": 0,
            "trim_end": round(dur, 3),
            "transition_in": "cut",
            "transition_out": "cut",
            "transition_duration": 0.5,
            "audio_replacement": None,
            "audio_fade_in": 0,
            "audio_fade_out": 0,
            "video_enabled": True,
            "audio_enabled": True,
            "label": clip_name or file_name,
        }
        td["clips"].append({**_base, "id": _vId, "track_type": "video", "track_index": 0, "linked_id": _aId, "is_video_part": True})
        td["clips"].append({**_base, "id": _aId, "track_type": "audio", "track_index": 0, "linked_id": _vId, "is_video_part": False})
        td["known_files"].append(file_name)

        _timeline_store[node_id] = _json.dumps(td, ensure_ascii=False)
        print(f"[BSAI Premiere Pro] add_clip: '{file_name}' ({dur:.1f}s, {w}x{h}) added to node {node_id}")
        return web.json_response({"ok": True, "clip_count": len(td["clips"]) // 2})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.post("/bsai_premiere_pro/upload")
async def upload_file(request):
    """Upload one or more media files and return their saved paths + metadata."""
    import asyncio
    import tempfile
    try:
        import folder_paths
        output_dir = os.path.join(folder_paths.base_path, "output", "bsai_imports")
    except Exception:
        output_dir = os.path.join(tempfile.gettempdir(), "bsai_imports")
    os.makedirs(output_dir, exist_ok=True)

    reader = await request.multipart()
    results = []
    while True:
        part = await reader.next()
        if part is None:
            break
        if part.filename is None:
            continue
        # Sanitize filename
        filename = os.path.basename(part.filename)
        save_path = os.path.join(output_dir, filename)
        # Handle duplicate names
        base, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(save_path):
            save_path = os.path.join(output_dir, f"{base}_{counter}{ext}")
            counter += 1
        # Save file in chunks
        try:
            with open(save_path, "wb") as f:
                while True:
                    chunk = await part.read_chunk(8192)
                    if not chunk:
                        break
                    f.write(chunk)
        except Exception as e:
            results.append({"file_name": filename, "error": str(e)})
            continue
        # Get metadata based on file type
        ext = os.path.splitext(filename)[1].lower()
        image_exts = {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".tiff", ".tif", ".svg"}
        audio_exts = {".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma", ".opus"}
        if ext in image_exts:
            # Image file: get dimensions via PIL, no audio, no duration
            try:
                from PIL import Image
                img = Image.open(save_path)
                w, h = img.size
                img.close()
            except Exception:
                w, h = 0, 0
            results.append({
                "file_path": save_path, "file_name": os.path.basename(save_path),
                "size": os.path.getsize(save_path), "duration": 0,
                "width": w, "height": h, "fps": 30, "has_audio": False,
            })
        elif ext in audio_exts:
            # Audio file: get duration via ffprobe, no video dimensions
            info = await asyncio.to_thread(get_video_info, save_path)
            results.append({
                "file_path": save_path, "file_name": os.path.basename(save_path),
                "size": os.path.getsize(save_path),
                "duration": (info or {}).get("duration", 0),
                "width": 0, "height": 0, "fps": 30,
                "has_audio": True,
            })
        else:
            # Video file: full ffprobe metadata
            info = await asyncio.to_thread(get_video_info, save_path)
            results.append({
                "file_path": save_path, "file_name": os.path.basename(save_path),
                "size": os.path.getsize(save_path),
                "duration": (info or {}).get("duration", 0),
                "width": (info or {}).get("width", 0),
                "height": (info or {}).get("height", 0),
                "fps": (info or {}).get("fps", 30),
                "has_audio": (info or {}).get("has_audio", False),
            })
    return web.json_response({"files": results})


@PromptServer.instance.routes.get("/bsai_premiere_pro/open_explorer")
async def open_explorer(request):
    """Open Windows Explorer at the specified directory path."""
    raw_path = request.query.get("path", "")
    dir_path = urllib.parse.unquote(raw_path)
    if not dir_path:
        return web.json_response({"error": "No path provided"}, status=400)
    try:
        # Resolve relative paths (e.g. "output" → ComfyUI/output)
        if not os.path.isabs(dir_path):
            try:
                import folder_paths
                base = folder_paths.base_path
            except Exception:
                base = os.getcwd()
            candidate = os.path.join(base, dir_path)
            if os.path.exists(candidate):
                dir_path = candidate
        if not os.path.exists(dir_path):
            return web.json_response({"error": f"Path not found: {dir_path}"}, status=404)
        if os.name == "nt":
            import subprocess
            subprocess.Popen(["explorer", dir_path])
        else:
            import subprocess
            subprocess.Popen(["xdg-open", dir_path])
        return web.json_response({"success": True, "path": dir_path})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)
