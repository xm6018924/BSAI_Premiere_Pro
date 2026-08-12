import os
import sys
import json
import shutil
import subprocess
import tempfile
import time
import base64

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv", ".m4v"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma"}


def find_ffmpeg():
    try:
        import imageio_ffmpeg
        path = imageio_ffmpeg.get_ffmpeg_exe()
        if os.path.exists(path):
            return path
    except Exception:
        pass
    try:
        import folder_paths
        base = folder_paths.base_path
        candidates = [
            os.path.join(base, ".ce", ".pixi", "envs", "comfyui", "Library", "bin", "ffmpeg.exe"),
            os.path.join(os.path.dirname(base), ".ce", ".pixi", "envs", "comfyui", "Library", "bin", "ffmpeg.exe"),
        ]
        for p in candidates:
            if os.path.exists(p):
                return p
    except Exception:
        pass
    return shutil.which("ffmpeg")


def find_ffprobe():
    try:
        import folder_paths
        base = folder_paths.base_path
        candidates = [
            os.path.join(base, ".ce", ".pixi", "envs", "comfyui", "Library", "bin", "ffprobe.exe"),
            os.path.join(os.path.dirname(base), ".ce", ".pixi", "envs", "comfyui", "Library", "bin", "ffprobe.exe"),
        ]
        for p in candidates:
            if os.path.exists(p):
                return p
    except Exception:
        pass
    ffmpeg = find_ffmpeg()
    if ffmpeg:
        ffprobe = os.path.join(os.path.dirname(ffmpeg), "ffprobe.exe")
        if os.path.exists(ffprobe):
            return ffprobe
        ffprobe = os.path.join(os.path.dirname(ffmpeg), "ffprobe")
        if os.path.exists(ffprobe):
            return ffprobe
    return shutil.which("ffprobe")


FFMPEG_PATH = None
FFPROBE_PATH = None

def get_ffmpeg():
    global FFMPEG_PATH
    if FFMPEG_PATH is None:
        FFMPEG_PATH = find_ffmpeg()
    return FFMPEG_PATH

def get_ffprobe():
    global FFPROBE_PATH
    if FFPROBE_PATH is None:
        FFPROBE_PATH = find_ffprobe()
    return FFPROBE_PATH


def get_video_info(file_path):
    ffprobe = get_ffprobe()
    if not ffprobe or not os.path.exists(file_path):
        return None
    try:
        cmd = [
            ffprobe, "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return None
        data = json.loads(result.stdout)
        info = {
            "duration": 0.0,
            "width": 0,
            "height": 0,
            "fps": 30.0,
            "has_audio": False,
            "audio_codec": None,
            "video_codec": None,
            "sample_rate": 44100,
            "channels": 2,
        }
        fmt = data.get("format", {})
        try:
            info["duration"] = float(fmt.get("duration", 0))
        except (ValueError, TypeError):
            info["duration"] = 0.0
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                info["width"] = int(stream.get("width", 0))
                info["height"] = int(stream.get("height", 0))
                info["video_codec"] = stream.get("codec_name")
                fps_str = stream.get("avg_frame_rate", "30/1")
                try:
                    num, den = fps_str.split("/")
                    info["fps"] = float(num) / float(den) if float(den) != 0 else 30.0
                except Exception:
                    info["fps"] = 30.0
            elif stream.get("codec_type") == "audio":
                info["has_audio"] = True
                info["audio_codec"] = stream.get("codec_name")
                try:
                    info["sample_rate"] = int(stream.get("sample_rate", 44100))
                except (ValueError, TypeError):
                    pass
                try:
                    info["channels"] = int(stream.get("channels", 2))
                except (ValueError, TypeError):
                    pass
        return info
    except Exception as e:
        print(f"[BSAI Premiere Pro] Error getting video info: {e}")
        return None


def generate_thumbnail(file_path, thumb_time=None, width=160):
    ffmpeg = get_ffmpeg()
    if not ffmpeg or not os.path.exists(file_path):
        return None
    info = get_video_info(file_path)
    if not info:
        return None
    if thumb_time is None:
        thumb_time = min(info["duration"] * 0.1, 2.0)
    if thumb_time <= 0:
        thumb_time = 0.1
    temp_file = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    temp_file.close()
    try:
        cmd = [
            ffmpeg, "-ss", str(thumb_time), "-i", file_path,
            "-vframes", "1", "-vf", f"scale={width}:-1", "-q:v", "5",
            "-y", temp_file.name
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=15)
        if result.returncode != 0 or not os.path.exists(temp_file.name):
            return None
        with open(temp_file.name, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        return f"data:image/jpeg;base64,{data}"
    except Exception as e:
        print(f"[BSAI Premiere Pro] Error generating thumbnail: {e}")
        return None
    finally:
        try:
            os.unlink(temp_file.name)
        except Exception:
            pass


def _resolve_directory(directory):
    if not directory or directory.strip() == "":
        try:
            import folder_paths
            return folder_paths.get_output_directory()
        except Exception:
            return os.getcwd()
    if os.path.isabs(directory):
        return directory
    try:
        import folder_paths
        output_dir = folder_paths.get_output_directory()
    except Exception:
        output_dir = os.getcwd()
    if directory.lower() in ("output", "output/", "output\\", "."):
        return output_dir
    return os.path.join(output_dir, directory)


def scan_video_directory(directory, recursive=True):
    directory = _resolve_directory(directory)
    if not os.path.isdir(directory):
        return []
    current_time = time.time()
    files = []

    def _scan_dir(dir_path):
        try:
            for f in os.listdir(dir_path):
                full_path = os.path.join(dir_path, f)
                if os.path.isdir(full_path) and recursive:
                    _scan_dir(full_path)
                    continue
                ext = os.path.splitext(f)[1].lower()
                if ext not in VIDEO_EXTENSIONS:
                    continue
                try:
                    stat = os.stat(full_path)
                    if current_time - stat.st_mtime < 1.5:
                        continue
                    rel_name = os.path.relpath(full_path, directory)
                    files.append({
                        "file_name": f,
                        "rel_path": rel_name,
                        "file_path": os.path.abspath(full_path),
                        "created_time": stat.st_ctime,
                        "modified_time": stat.st_mtime,
                        "size": stat.st_size,
                    })
                except OSError:
                    continue
        except PermissionError:
            pass

    _scan_dir(directory)
    files.sort(key=lambda x: x["created_time"])
    return files


def scan_audio_files(directory):
    directory = _resolve_directory(directory)
    if not os.path.isdir(directory):
        return []
    files = []
    for f in os.listdir(directory):
        ext = os.path.splitext(f)[1].lower()
        if ext not in AUDIO_EXTENSIONS:
            continue
        full_path = os.path.join(directory, f)
        try:
            stat = os.stat(full_path)
            files.append({
                "file_name": f,
                "file_path": os.path.abspath(full_path),
                "size": stat.st_size,
            })
        except OSError:
            continue
    files.sort(key=lambda x: x["file_name"])
    return files


def format_time(seconds):
    if seconds is None or seconds < 0:
        return "00:00.00"
    minutes = int(seconds // 60)
    secs = seconds % 60
    return f"{minutes:02d}:{secs:05.2f}"


def _build_vf_filters(clip, clip_duration, clip_index, total_clips, default_transition, transition_duration, target_w, target_h, target_fps):
    filters = [
        f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease",
        f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:black",
        f"fps={target_fps}",
        "setsar=1",
    ]
    trans_in = clip.get("transition_in", default_transition)
    trans_out = clip.get("transition_out", default_transition)
    trans_dur = float(clip.get("transition_duration", transition_duration))
    if trans_dur <= 0:
        trans_dur = 0.5

    if trans_in != "cut" and clip_index > 0:
        color = "white" if trans_in == "white" else "black"
        filters.append(f"fade=t=in:st=0:d={trans_dur}:color={color}")

    if trans_out != "cut" and clip_index < total_clips - 1:
        fade_out_start = max(0, clip_duration - trans_dur)
        color = "white" if trans_out == "white" else "black"
        filters.append(f"fade=t=out:st={fade_out_start}:d={trans_dur}:color={color}")

    if clip_index == 0 and trans_in != "cut":
        color = "white" if trans_in == "white" else "black"
        filters.append(f"fade=t=in:st=0:d={trans_dur}:color={color}")
    if clip_index == total_clips - 1 and trans_out != "cut":
        fade_out_start = max(0, clip_duration - trans_dur)
        color = "white" if trans_out == "white" else "black"
        filters.append(f"fade=t=out:st={fade_out_start}:d={trans_dur}:color={color}")

    return filters


def _build_af_filters(clip, clip_duration, clip_index, total_clips, default_transition, transition_duration):
    filters = []
    trans_in = clip.get("transition_in", default_transition)
    trans_out = clip.get("transition_out", default_transition)
    trans_dur = float(clip.get("transition_duration", transition_duration))
    if trans_dur <= 0:
        trans_dur = 0.5
    audio_fade_in = float(clip.get("audio_fade_in", 0))
    audio_fade_out = float(clip.get("audio_fade_out", 0))

    if trans_in != "cut" and clip_index > 0:
        filters.append(f"afade=t=in:st=0:d={trans_dur}")
    elif audio_fade_in > 0:
        filters.append(f"afade=t=in:st=0:d={audio_fade_in}")

    if trans_out != "cut" and clip_index < total_clips - 1:
        fade_out_start = max(0, clip_duration - trans_dur)
        filters.append(f"afade=t=out:st={fade_out_start}:d={trans_dur}")
    elif audio_fade_out > 0:
        fade_out_start = max(0, clip_duration - audio_fade_out)
        filters.append(f"afade=t=out:st={fade_out_start}:d={audio_fade_out}")

    if clip_index == 0 and trans_in != "cut":
        filters.append(f"afade=t=in:st=0:d={trans_dur}")
    if clip_index == total_clips - 1 and trans_out != "cut":
        fade_out_start = max(0, clip_duration - trans_dur)
        filters.append(f"afade=t=out:st={fade_out_start}:d={trans_dur}")

    return filters


def _build_clip_command(clip, output_file, target_w, target_h, target_fps,
                        default_transition, transition_duration, clip_index, total_clips):
    ffmpeg = get_ffmpeg()
    if not ffmpeg:
        return None
    cmd = [ffmpeg, "-y", "-loglevel", "error"]
    trim_start = float(clip.get("trim_start", 0))
    trim_end = float(clip.get("trim_end", clip.get("duration", 0)))
    if trim_end <= trim_start:
        trim_end = trim_start + 0.1
    clip_duration = trim_end - trim_start
    input_path = clip["file_path"]
    if not os.path.exists(input_path):
        return None
    if trim_start > 0:
        cmd.extend(["-ss", str(trim_start)])
    cmd.extend(["-i", input_path])
    cmd.extend(["-t", str(clip_duration)])

    audio_replacement = clip.get("audio_replacement")
    has_audio = clip.get("has_audio", True)
    audio_enabled = clip.get("audio_enabled", True)
    need_silence = False
    if audio_replacement and os.path.exists(audio_replacement):
        cmd.extend(["-i", audio_replacement])
    elif not has_audio or not audio_enabled:
        need_silence = True
        cmd.extend(["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"])

    vf_filters = _build_vf_filters(
        clip, clip_duration, clip_index, total_clips,
        default_transition, transition_duration, target_w, target_h, target_fps
    )
    cmd.extend(["-vf", ",".join(vf_filters)])

    af_filters = _build_af_filters(
        clip, clip_duration, clip_index, total_clips,
        default_transition, transition_duration
    )
    if af_filters and (has_audio and audio_enabled or audio_replacement or need_silence):
        cmd.extend(["-af", ",".join(af_filters)])

    if audio_replacement and os.path.exists(audio_replacement):
        cmd.extend(["-map", "0:v:0", "-map", "1:a:0"])
        cmd.extend(["-shortest"])
    elif need_silence:
        cmd.extend(["-map", "0:v:0", "-map", "1:a:0"])
        cmd.extend(["-shortest"])
    else:
        cmd.extend(["-map", "0:v:0", "-map", "0:a:0"])

    cmd.extend([
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-r", str(target_fps),
        "-pix_fmt", "yuv420p",
        "-ar", "48000", "-ac", "2",
        output_file
    ])
    return cmd


def process_and_merge(timeline_data, output_filename, output_format, video_codec,
                      quality, default_transition, transition_duration):
    ffmpeg = get_ffmpeg()
    if not ffmpeg:
        return None, "ffmpeg not found"
    clips = timeline_data.get("clips", [])
    enabled_clips = [c for c in clips if c.get("video_enabled", True) or c.get("audio_enabled", True)]
    if not enabled_clips:
        return None, "No clips to merge"
    target_w = 0
    target_h = 0
    target_fps = 30.0
    for clip in enabled_clips:
        w = clip.get("width", 0)
        h = clip.get("height", 0)
        fps = clip.get("fps", 30)
        if w > 0 and h > 0:
            if w > target_w or (w == target_w and h > target_h):
                target_w = w
                target_h = h
            target_fps = max(target_fps, float(fps))
    if target_w == 0:
        target_w = 1920
    if target_h == 0:
        target_h = 1080
    if target_w % 2 != 0:
        target_w += 1
    if target_h % 2 != 0:
        target_h += 1
    crf_map = {"high": "18", "medium": "23", "low": "28"}
    crf = crf_map.get(quality, "18")
    temp_dir = tempfile.mkdtemp(prefix="bsai_pp_")
    try:
        processed_files = []
        for i, clip in enumerate(enabled_clips):
            output_file = os.path.join(temp_dir, f"clip_{i:04d}.mp4")
            cmd = _build_clip_command(
                clip, output_file, target_w, target_h, int(target_fps),
                default_transition, transition_duration, i, len(enabled_clips)
            )
            if not cmd:
                print(f"[BSAI Premiere Pro] Skipping clip {i}: file not found or invalid")
                continue
            print(f"[BSAI Premiere Pro] Processing clip {i+1}/{len(enabled_clips)}: {clip.get('file_name', 'unknown')}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            if result.returncode != 0:
                return None, f"Failed to process clip {i} ({clip.get('file_name', '')}):\n{result.stderr}"
            processed_files.append(output_file)
        if not processed_files:
            return None, "No clips were successfully processed"
        concat_file = os.path.join(temp_dir, "concat_list.txt")
        with open(concat_file, "w", encoding="utf-8") as f:
            for pf in processed_files:
                escaped = pf.replace("\\", "/").replace(":", "\\:")
                f.write(f"file '{escaped}'\n")
        try:
            import folder_paths
            output_dir = folder_paths.get_output_directory()
        except Exception:
            output_dir = os.getcwd()
        safe_name = "".join(c for c in output_filename if c.isalnum() or c in "-_") or "premiere_pro_output"
        output_path = os.path.join(output_dir, f"{safe_name}.{output_format}")
        counter = 1
        while os.path.exists(output_path):
            output_path = os.path.join(output_dir, f"{safe_name}_{counter}.{output_format}")
            counter += 1
        concat_cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", concat_file,
            "-c:v", video_codec, "-preset", "medium", "-crf", crf,
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            output_path
        ]
        print(f"[BSAI Premiere Pro] Merging {len(processed_files)} clips -> {output_path}")
        result = subprocess.run(concat_cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            return None, f"Failed to merge clips:\n{result.stderr}"
        print(f"[BSAI Premiere Pro] Output saved: {output_path}")
        return output_path, None
    except Exception as e:
        return None, f"Error during processing: {str(e)}"
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
