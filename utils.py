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

    track_type = clip.get("track_type")

    # --- Video-only clip (multi-track mode) ---
    if track_type == "video":
        if trim_start > 0:
            cmd.extend(["-ss", str(trim_start)])
        cmd.extend(["-i", input_path])
        cmd.extend(["-t", str(clip_duration)])

        vf_filters = _build_vf_filters(
            clip, clip_duration, clip_index, total_clips,
            default_transition, transition_duration, target_w, target_h, target_fps
        )
        cmd.extend(["-vf", ",".join(vf_filters)])
        cmd.extend(["-map", "0:v:0", "-an"])
        cmd.extend([
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-r", str(target_fps),
            "-pix_fmt", "yuv420p",
            output_file
        ])
        return cmd

    # --- Audio-only clip (multi-track mode) ---
    if track_type == "audio":
        if trim_start > 0:
            cmd.extend(["-ss", str(trim_start)])
        cmd.extend(["-i", input_path])

        audio_replacement = clip.get("audio_replacement")
        has_audio = clip.get("has_audio", True)
        audio_enabled = clip.get("audio_enabled", True)

        next_input = 1
        audio_input_idx = None
        if audio_replacement and os.path.exists(audio_replacement):
            cmd.extend(["-i", audio_replacement])
            audio_input_idx = next_input
            next_input += 1
        elif not has_audio or not audio_enabled:
            cmd.extend(["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"])
            audio_input_idx = next_input
            next_input += 1

        # Dummy black video stream for concat compatibility
        black_input_idx = next_input
        cmd.extend(["-f", "lavfi", "-i", f"color=black:s={target_w}x{target_h}:r={target_fps}:d={clip_duration}"])

        cmd.extend(["-t", str(clip_duration)])

        af_filters = _build_af_filters(
            clip, clip_duration, clip_index, total_clips,
            default_transition, transition_duration
        )
        if af_filters and (audio_input_idx is not None or (has_audio and audio_enabled)):
            cmd.extend(["-af", ",".join(af_filters)])

        if audio_input_idx is not None:
            cmd.extend(["-map", f"{black_input_idx}:v:0", "-map", f"{audio_input_idx}:a:0"])
        else:
            cmd.extend(["-map", f"{black_input_idx}:v:0", "-map", "0:a:0"])

        cmd.extend([
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            "-r", str(target_fps),
            "-pix_fmt", "yuv420p",
            "-ar", "48000", "-ac", "2",
            "-shortest",
            output_file
        ])
        return cmd

    # --- Legacy clip (no track_type: both video and audio) ---
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


def _process_track_clips(clips, track_type, track_index, temp_dir, target_w, target_h, target_fps,
                         default_transition, transition_duration):
    """Process all clips in a single track and concatenate them.

    Returns the path to the merged track file, or None on failure.
    Uses track-local clip indices for fade/transition logic.
    """
    ffmpeg = get_ffmpeg()
    if not ffmpeg or not clips:
        return None

    # Filter clips whose source file exists
    valid_clips = [c for c in clips if os.path.exists(c.get("file_path", ""))]
    if not valid_clips:
        return None

    track_temp_dir = os.path.join(temp_dir, f"track_{track_type}_{track_index}")
    os.makedirs(track_temp_dir, exist_ok=True)

    processed_files = []
    total_clips = len(valid_clips)
    for i, clip in enumerate(valid_clips):
        output_file = os.path.join(track_temp_dir, f"clip_{i:04d}.mp4")
        cmd = _build_clip_command(
            clip, output_file, target_w, target_h, target_fps,
            default_transition, transition_duration, i, total_clips
        )
        if not cmd:
            print(f"[BSAI Premiere Pro] Skipping clip {i} in {track_type} track {track_index}: file not found or invalid")
            continue
        print(f"[BSAI Premiere Pro] Processing {track_type} track {track_index} clip {i+1}/{total_clips}: {clip.get('file_name', 'unknown')}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            print(f"[BSAI Premiere Pro] Failed to process clip {i} in {track_type} track {track_index}:\n{result.stderr}")
            continue
        processed_files.append(output_file)

    if not processed_files:
        return None

    if len(processed_files) == 1:
        return processed_files[0]

    # Concatenate clips within the track
    concat_file = os.path.join(track_temp_dir, "concat_list.txt")
    with open(concat_file, "w", encoding="utf-8") as f:
        for pf in processed_files:
            escaped = pf.replace("\\", "/").replace(":", "\\:")
            f.write(f"file '{escaped}'\n")

    merged_file = os.path.join(temp_dir, f"merged_{track_type}_{track_index}.mp4")

    # Try stream copy first (fast), fall back to re-encode if it fails
    concat_cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", concat_file,
        "-c", "copy",
        merged_file
    ]
    result = subprocess.run(concat_cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        print(f"[BSAI Premiere Pro] Stream copy concat failed for {track_type} track {track_index}, re-encoding...")
        concat_cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", concat_file,
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-ar", "48000", "-ac", "2",
            merged_file
        ]
        result = subprocess.run(concat_cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            print(f"[BSAI Premiere Pro] Failed to merge {track_type} track {track_index}:\n{result.stderr}")
            return None

    return merged_file


def _overlay_video_tracks(track_files, temp_dir, target_w, target_h, target_fps):
    """Overlay multiple video tracks. V1 is base, V2+ are overlaid on top.

    Returns the path to the overlaid video file, or None on failure.
    """
    ffmpeg = get_ffmpeg()
    if not ffmpeg or not track_files:
        return None

    if len(track_files) == 1:
        return track_files[0]

    output_file = os.path.join(temp_dir, "overlaid_video.mp4")
    cmd = [ffmpeg, "-y", "-loglevel", "error"]
    for tf in track_files:
        cmd.extend(["-i", tf])

    # Build overlay filter chain: [0:v][1:v]overlay=0:0[v1];[v1][2:v]overlay=0:0[vout]; ...
    filter_parts = []
    prev_label = "0:v"
    for i in range(1, len(track_files)):
        out_label = f"v{i}" if i < len(track_files) - 1 else "vout"
        filter_parts.append(f"[{prev_label}][{i}:v]overlay=0:0[{out_label}]")
        prev_label = out_label
    filter_complex = ";".join(filter_parts)

    cmd.extend([
        "-filter_complex", filter_complex,
        "-map", f"[{prev_label}]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-r", str(target_fps),
        output_file
    ])

    print(f"[BSAI Premiere Pro] Overlaying {len(track_files)} video tracks")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        print(f"[BSAI Premiere Pro] Failed to overlay video tracks:\n{result.stderr}")
        return None

    return output_file


def _mix_audio_tracks(track_files, temp_dir):
    """Mix multiple audio tracks using ffmpeg amix filter.

    Returns the path to the mixed audio file, or None on failure.
    """
    ffmpeg = get_ffmpeg()
    if not ffmpeg or not track_files:
        return None

    if len(track_files) == 1:
        return track_files[0]

    output_file = os.path.join(temp_dir, "mixed_audio.mp4")
    cmd = [ffmpeg, "-y", "-loglevel", "error"]
    for tf in track_files:
        cmd.extend(["-i", tf])

    inputs_str = "".join(f"[{i}:a]" for i in range(len(track_files)))
    filter_complex = f"{inputs_str}amix=inputs={len(track_files)}:duration=longest[aout]"

    cmd.extend([
        "-filter_complex", filter_complex,
        "-map", "[aout]",
        "-c:a", "aac", "-b:a", "192k",
        "-ar", "48000", "-ac", "2",
        output_file
    ])

    print(f"[BSAI Premiere Pro] Mixing {len(track_files)} audio tracks")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        print(f"[BSAI Premiere Pro] Failed to mix audio tracks:\n{result.stderr}")
        return None

    return output_file


def process_and_merge(timeline_data, output_filename, output_format, video_codec,
                      quality, default_transition, transition_duration):
    ffmpeg = get_ffmpeg()
    if not ffmpeg:
        return None, "ffmpeg not found"
    clips = timeline_data.get("clips", [])

    # Detect multi-track mode: any clip has track_type field
    is_multitrack = any("track_type" in c for c in clips)

    # Filter enabled clips
    if is_multitrack:
        enabled_clips = []
        for c in clips:
            tt = c.get("track_type")
            if tt == "video":
                if c.get("video_enabled", True):
                    enabled_clips.append(c)
            elif tt == "audio":
                if c.get("audio_enabled", True):
                    enabled_clips.append(c)
            else:
                # Clip without track_type in multi-track mode: treat as enabled
                if c.get("video_enabled", True) or c.get("audio_enabled", True):
                    enabled_clips.append(c)
    else:
        enabled_clips = [c for c in clips if c.get("video_enabled", True) or c.get("audio_enabled", True)]

    if not enabled_clips:
        return None, "No clips to merge"

    # Determine target dimensions and FPS from all enabled clips
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

    # Resolve output path
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

    temp_dir = tempfile.mkdtemp(prefix="bsai_pp_")
    try:
        if is_multitrack:
            return _process_multitrack(
                timeline_data, enabled_clips, temp_dir, output_path,
                target_w, target_h, target_fps, crf, video_codec,
                default_transition, transition_duration, ffmpeg
            )
        else:
            return _process_legacy(
                enabled_clips, temp_dir, output_path,
                target_w, target_h, target_fps, crf, video_codec,
                default_transition, transition_duration, ffmpeg
            )
    except Exception as e:
        return None, f"Error during processing: {str(e)}"
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def _process_legacy(enabled_clips, temp_dir, output_path,
                    target_w, target_h, target_fps, crf, video_codec,
                    default_transition, transition_duration, ffmpeg):
    """Legacy mode: sequential concat with both video and audio from each clip."""
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


def _process_multitrack(timeline_data, enabled_clips, temp_dir, output_path,
                        target_w, target_h, target_fps, crf, video_codec,
                        default_transition, transition_duration, ffmpeg):
    """Multi-track mode: process video and audio tracks separately, then combine."""
    video_tracks = timeline_data.get("video_tracks", [])
    audio_tracks = timeline_data.get("audio_tracks", [])

    # Group clips by track_type and track_index
    video_clips_by_track = {}
    audio_clips_by_track = {}
    for clip in enabled_clips:
        tt = clip.get("track_type", "video")
        ti = clip.get("track_index", 0)
        if tt == "audio":
            audio_clips_by_track.setdefault(ti, []).append(clip)
        else:
            video_clips_by_track.setdefault(ti, []).append(clip)

    # --- Process video tracks ---
    video_track_files = []
    for ti in sorted(video_clips_by_track.keys()):
        track_info = video_tracks[ti] if ti < len(video_tracks) else {}
        if not track_info.get("visible", True):
            print(f"[BSAI Premiere Pro] Skipping hidden video track V{ti+1}")
            continue
        track_clips = video_clips_by_track[ti]
        track_clips.sort(key=lambda c: c.get("start_time", c.get("start", 0)))
        merged = _process_track_clips(
            track_clips, "video", ti, temp_dir,
            target_w, target_h, int(target_fps),
            default_transition, transition_duration
        )
        if merged:
            video_track_files.append(merged)
        else:
            print(f"[BSAI Premiere Pro] Video track V{ti+1} produced no output")

    # --- Process audio tracks ---
    has_solo = any(at.get("solo", False) for at in audio_tracks)
    audio_track_files = []
    for ti in sorted(audio_clips_by_track.keys()):
        track_info = audio_tracks[ti] if ti < len(audio_tracks) else {}
        if track_info.get("muted", False):
            print(f"[BSAI Premiere Pro] Skipping muted audio track A{ti+1}")
            continue
        if has_solo and not track_info.get("solo", False):
            print(f"[BSAI Premiere Pro] Skipping non-solo audio track A{ti+1}")
            continue
        track_clips = audio_clips_by_track[ti]
        track_clips.sort(key=lambda c: c.get("start_time", c.get("start", 0)))
        merged = _process_track_clips(
            track_clips, "audio", ti, temp_dir,
            target_w, target_h, int(target_fps),
            default_transition, transition_duration
        )
        if merged:
            audio_track_files.append(merged)
        else:
            print(f"[BSAI Premiere Pro] Audio track A{ti+1} produced no output")

    if not video_track_files and not audio_track_files:
        return None, "No tracks were successfully processed"

    # --- Overlay video tracks (V1 base, V2+ on top) ---
    final_video = None
    if video_track_files:
        final_video = _overlay_video_tracks(
            video_track_files, temp_dir, target_w, target_h, int(target_fps)
        )

    # --- Mix audio tracks ---
    final_audio = None
    if audio_track_files:
        final_audio = _mix_audio_tracks(audio_track_files, temp_dir)

    # --- Combine final video and audio into output ---
    if final_video and final_audio:
        combine_cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-i", final_video, "-i", final_audio,
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", video_codec, "-preset", "medium", "-crf", crf,
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-shortest",
            output_path
        ]
        print(f"[BSAI Premiere Pro] Combining video and audio -> {output_path}")
        result = subprocess.run(combine_cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            return None, f"Failed to combine video and audio:\n{result.stderr}"

    elif final_video:
        # Video only: re-encode to output with specified codec
        cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-i", final_video,
            "-map", "0:v:0",
            "-c:v", video_codec, "-preset", "medium", "-crf", crf,
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            output_path
        ]
        print(f"[BSAI Premiere Pro] Saving video-only output -> {output_path}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            return None, f"Failed to save video:\n{result.stderr}"

    elif final_audio:
        # Audio only: output with black video background
        cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-i", final_audio,
            "-f", "lavfi", "-i", f"color=black:s={target_w}x{target_h}:r={int(target_fps)}",
            "-map", "1:v:0", "-map", "0:a:0",
            "-c:v", video_codec, "-preset", "medium", "-crf", crf,
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-shortest",
            "-movflags", "+faststart",
            output_path
        ]
        print(f"[BSAI Premiere Pro] Saving audio-only output with black video -> {output_path}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            return None, f"Failed to save audio:\n{result.stderr}"

    else:
        return None, "No output could be produced"

    print(f"[BSAI Premiere Pro] Output saved: {output_path}")
    return output_path, None
