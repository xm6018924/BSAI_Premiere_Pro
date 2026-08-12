import os
import json
import urllib.parse

from server import PromptServer
from aiohttp import web

from .utils import (
    scan_video_directory, scan_audio_files,
    get_video_info, generate_thumbnail,
    process_and_merge, format_time,
)


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


@PromptServer.instance.routes.post("/bsai_premiere_pro/render")
async def render_video(request):
    try:
        data = await request.json()
        timeline_str = data.get("timeline_data", "")
        output_filename = data.get("output_filename", "premiere_pro_output")
        output_format = data.get("output_format", "mp4")
        video_codec = data.get("video_codec", "libx264")
        quality = data.get("quality", "high")
        default_transition = data.get("default_transition", "cut")
        transition_duration = float(data.get("transition_duration", 0.5))

        if not timeline_str:
            return web.json_response({"error": "No timeline data"})

        timeline_data = json.loads(timeline_str)
        clips = timeline_data.get("clips", [])
        if not clips:
            return web.json_response({"error": "No clips to merge"})

        output_path, error = process_and_merge(
            timeline_data, output_filename, output_format, video_codec,
            quality, default_transition, transition_duration
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
