import os
import sys
import json
import shutil
import subprocess
import tempfile
import time
import base64
import wave

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv", ".m4v", ".mpg", ".mpeg", ".ts", ".3gp"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma", ".opus"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".tif", ".tiff", ".svg"}
MEDIA_EXTENSIONS = VIDEO_EXTENSIONS | AUDIO_EXTENSIONS | IMAGE_EXTENSIONS


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
        result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=30)
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


def generate_filmstrip(file_path, num_frames=10, height=80):
    """Generate a horizontal filmstrip of evenly-spaced frames.

    Uses ffmpeg's fps + tile filters to extract N frames at evenly-spaced
    timestamps and arrange them in a single wide image. Each frame is scaled
    to the target height, preserving aspect ratio. This fills wide thumbnail
    areas for vertical videos without black bars.
    """
    ffmpeg = get_ffmpeg()
    if not ffmpeg or not os.path.exists(file_path):
        return None
    info = get_video_info(file_path)
    if not info or info["duration"] <= 0:
        return generate_thumbnail(file_path)
    duration = info["duration"]
    num_frames = max(3, min(num_frames, 20))
    fps = num_frames / duration
    temp_file = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    temp_file.close()
    try:
        vf = (
            f"fps={fps},"
            f"scale=-1:{height},"
            f"tile={num_frames}x1"
        )
        cmd = [
            ffmpeg, "-i", file_path,
            "-frames:v", "1", "-vf", vf, "-q:v", "5",
            "-y", temp_file.name
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=20)
        if result.returncode != 0 or not os.path.exists(temp_file.name):
            return generate_thumbnail(file_path)
        with open(temp_file.name, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        return f"data:image/jpeg;base64,{data}"
    except Exception as e:
        print(f"[BSAI Premiere Pro] Error generating filmstrip: {e}")
        return generate_thumbnail(file_path)
    finally:
        try:
            os.unlink(temp_file.name)
        except Exception:
            pass


def generate_waveform(file_path, num_samples=200):
    """Generate waveform amplitude data from an audio/video file.

    Returns a list of floats in [0, 1] representing normalized peak amplitudes.
    Uses ffmpeg to downsample to mono PCM and computes per-bucket peaks.
    """
    ffmpeg = get_ffmpeg()
    if not ffmpeg or not os.path.exists(file_path):
        return None
    try:
        # Get duration first
        info = get_video_info(file_path)
        duration = info["duration"] if info else 0
        if duration <= 0:
            return None

        # Use ffmpeg to extract raw 8-bit mono PCM at low sample rate
        # Sample rate chosen so we get enough data points
        sample_rate = max(800, num_samples * 4)
        cmd = [
            ffmpeg, "-i", file_path,
            "-vn",  # no video
            "-ac", "1",  # mono
            "-ar", str(sample_rate),
            "-f", "u8",  # unsigned 8-bit PCM
            "-acodec", "pcm_u8",
            "-",  # output to stdout
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        if result.returncode != 0:
            return None

        raw = result.stdout
        if not raw or len(raw) < 2:
            return None

        # Convert bytes to amplitudes (unsigned 8-bit: 128 = silence)
        # Each byte is a sample; 128 is silence
        total_samples = len(raw)
        bucket_size = max(1, total_samples // num_samples)
        waveform = []
        for i in range(num_samples):
            start = i * bucket_size
            end = min(start + bucket_size, total_samples)
            if start >= end:
                waveform.append(0.0)
                continue
            # Find peak amplitude in this bucket
            peak = 0
            for j in range(start, end):
                val = abs(raw[j] - 128) / 128.0
                if val > peak:
                    peak = val
            waveform.append(round(peak, 4))

        return waveform
    except Exception as e:
        print(f"[BSAI Premiere Pro] Error generating waveform: {e}")
        return None


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
                if ext not in MEDIA_EXTENSIONS:
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


def _build_vf_filters(clip, clip_duration, clip_index, total_clips, default_transition, transition_duration, target_w, target_h, target_fps, align_mode="height"):
    pos_x = int(clip.get("pos_x", 0))
    pos_y = int(clip.get("pos_y", 0))

    # Scale to fit entirely within target dimensions (contain mode).
    # Specify BOTH dimensions explicitly so force_original_aspect_ratio=decrease
    # can properly constrain the output. Using -2 for one dimension lets the
    # auto-calculated value exceed the other target dimension, causing
    # "Padded dimensions cannot be smaller than input dimensions" errors.
    scale_filter = f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease"
    # Pad to exact target dimensions, centering the scaled image with position offset
    pad_x = f"(ow-iw)/2+{pos_x}*iw/100"
    pad_y = f"(oh-ih)/2+{pos_y}*ih/100"
    pad_filter = f"pad={target_w}:{target_h}:{pad_x}:{pad_y}:black"

    filters = [
        scale_filter,
        pad_filter,
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
                        default_transition, transition_duration, clip_index, total_clips, align_mode="height"):
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
    ext = os.path.splitext(input_path)[1].lower()
    is_image = ext in IMAGE_EXTENSIONS or clip.get("is_image", False)

    # --- Video-only clip (multi-track mode) ---
    if track_type == "video":
        if is_image:
            cmd.extend(["-loop", "1"])
        if trim_start > 0 and not is_image:
            cmd.extend(["-ss", str(trim_start)])
        cmd.extend(["-i", input_path])
        cmd.extend(["-t", str(clip_duration)])

        vf_filters = _build_vf_filters(
            clip, clip_duration, clip_index, total_clips,
            default_transition, transition_duration, target_w, target_h, target_fps, align_mode
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
    if is_image:
        cmd.extend(["-loop", "1"])
    if trim_start > 0 and not is_image:
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


def _generate_gap_filler(ffmpeg, output_file, duration, target_w, target_h, target_fps, track_type):
    """Generate a black video (and silent audio for audio tracks) filler segment."""
    duration = max(0.1, min(duration, 3600))
    if track_type == "video":
        cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", f"color=black:s={target_w}x{target_h}:r={target_fps}:d={duration}",
            "-t", str(duration),
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-r", str(target_fps), "-pix_fmt", "yuv420p",
            "-an",
            output_file
        ]
    else:
        cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", f"color=black:s={target_w}x{target_h}:r={target_fps}:d={duration}",
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-t", str(duration),
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            "-r", str(target_fps), "-pix_fmt", "yuv420p",
            "-ar", "48000", "-ac", "2",
            "-shortest",
            output_file
        ]
    result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=120)
    if result.returncode != 0:
        print(f"[BSAI Premiere Pro] Failed to generate gap filler:\n{result.stderr}")
        return False
    return os.path.exists(output_file)


def _process_track_clips(clips, track_type, track_index, temp_dir, target_w, target_h, target_fps,
                         default_transition, transition_duration, align_mode="height"):
    """Process all clips in a single track and concatenate them.

    Returns the path to the merged track file, or None on failure.
    Uses track-local clip indices for fade/transition logic.
    Inserts black filler segments for timeline gaps to preserve sync.
    """
    ffmpeg = get_ffmpeg()
    if not ffmpeg or not clips:
        return None

    # Filter clips whose source file exists (also excludes gap placeholders)
    valid_clips = [c for c in clips if c.get("file_path") and os.path.exists(c["file_path"])]
    if not valid_clips:
        return None

    # Sort by start_time to ensure correct timeline order
    valid_clips.sort(key=lambda c: c.get("start_time", 0))

    track_temp_dir = os.path.join(temp_dir, f"track_{track_type}_{track_index}")
    os.makedirs(track_temp_dir, exist_ok=True)

    processed_files = []
    expected_end = 0.0  # Track the expected end time on the timeline
    total_clips = len(valid_clips)
    for i, clip in enumerate(valid_clips):
        clip_start = float(clip.get("start_time", 0))
        trim_start = float(clip.get("trim_start", 0))
        trim_end = float(clip.get("trim_end", clip.get("duration", 0)))
        clip_dur = trim_end - trim_start

        # Insert black filler for timeline gap before this clip
        gap = clip_start - expected_end
        if gap > 0.1:
            gap_file = os.path.join(track_temp_dir, f"gap_{len(processed_files):04d}.mp4")
            if _generate_gap_filler(ffmpeg, gap_file, gap, target_w, target_h, target_fps, track_type):
                processed_files.append(gap_file)
                print(f"[BSAI Premiere Pro] Inserted {gap:.2f}s gap filler for {track_type} track {track_index}")

        output_file = os.path.join(track_temp_dir, f"clip_{len(processed_files):04d}.mp4")
        cmd = _build_clip_command(
            clip, output_file, target_w, target_h, target_fps,
            default_transition, transition_duration, i, total_clips, align_mode
        )
        if not cmd:
            print(f"[BSAI Premiere Pro] Skipping clip {i} in {track_type} track {track_index}: file not found or invalid")
            continue
        print(f"[BSAI Premiere Pro] Processing {track_type} track {track_index} clip {i+1}/{total_clips}: {clip.get('file_name', 'unknown')}")
        result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=600)
        if result.returncode != 0:
            print(f"[BSAI Premiere Pro] Failed to process clip {i} in {track_type} track {track_index}:\n{result.stderr}")
            continue
        processed_files.append(output_file)
        expected_end = max(expected_end, clip_start) + clip_dur

    if not processed_files:
        return None

    if len(processed_files) == 1:
        return processed_files[0]

    # Use filter_complex concat for gapless merging
    # The concat demuxer (-f concat) relies on keyframe alignment and can introduce
    # tiny gaps/seams at clip boundaries causing video flash and audio pop.
    # filter_complex concat decodes all clips and joins at frame level = seamless.
    merged_file = os.path.join(temp_dir, f"merged_{track_type}_{track_index}.mp4")
    n = len(processed_files)

    concat_cmd = [ffmpeg, "-y", "-loglevel", "error"]
    for pf in processed_files:
        concat_cmd.extend(["-i", pf])

    if track_type == "video":
        # Video-only clips have no audio stream
        concat_parts = "".join(f"[{i}:v]" for i in range(n))
        filter_complex = f"{concat_parts}concat=n={n}:v=1:a=0[vout]"
        concat_cmd.extend([
            "-filter_complex", filter_complex,
            "-map", "[vout]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-r", str(int(target_fps)),
        ])
    else:
        # Audio clips have both video (black) and audio streams
        concat_parts = "".join(f"[{i}:v][{i}:a]" for i in range(n))
        filter_complex = (
            f"{concat_parts}concat=n={n}:v=1:a=1[vout][aout];"
            f"[aout]aresample=async=1:first_pts=0[afixed]"
        )
        concat_cmd.extend([
            "-filter_complex", filter_complex,
            "-map", "[vout]", "-map", "[afixed]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-r", str(int(target_fps)),
            "-ar", "48000", "-ac", "2",
        ])

    concat_cmd.extend([
        "-avoid_negative_ts", "make_zero",
        "-movflags", "+faststart",
        merged_file
    ])

    print(f"[BSAI Premiere Pro] Concatenating {n} clips (filter_complex) for {track_type} track {track_index}")
    result = subprocess.run(concat_cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=600)
    if result.returncode != 0:
        # Fallback: concat demuxer with re-encode (less seamless but more compatible)
        print(f"[BSAI Premiere Pro] filter_complex concat failed, falling back to concat demuxer:\n{result.stderr}")
        concat_file = os.path.join(track_temp_dir, "concat_list.txt")
        with open(concat_file, "w", encoding="utf-8") as f:
            for pf in processed_files:
                escaped = pf.replace("\\", "/")
                f.write(f"file '{escaped}'\n")
        fallback_cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", concat_file,
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-r", str(int(target_fps)),
            "-ar", "48000", "-ac", "2",
            "-avoid_negative_ts", "make_zero",
            "-fflags", "+genpts",
            "-movflags", "+faststart",
            merged_file
        ]
        result = subprocess.run(fallback_cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=600)
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
    result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=600)
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
    result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=600)
    if result.returncode != 0:
        print(f"[BSAI Premiere Pro] Failed to mix audio tracks:\n{result.stderr}")
        return None

    return output_file


def process_and_merge(timeline_data, output_filename, format_str, pix_fmt,
                      crf, frame_rate, default_transition, transition_duration):
    ffmpeg = get_ffmpeg()
    if not ffmpeg:
        return None, "ffmpeg not found"
    clips = timeline_data.get("clips", [])

    codec_map = {"h264": "libx264", "h265": "libx265", "vp9": "libvpx-vp9"}
    parts = format_str.split("/")
    codec_key = parts[1].split("-")[0] if len(parts) > 1 else "h264"
    container = parts[1].split("-", 1)[1] if len(parts) > 1 and "-" in parts[1] else "mp4"
    video_codec = codec_map.get(codec_key, "libx264")
    output_format = container

    crf = str(int(crf)) if crf else "19"

    is_multitrack = any("track_type" in c for c in clips)
    align_mode = timeline_data.get("align_mode", "height")

    # Filter out gap clips (deleted clips that left a placeholder)
    clips = [c for c in clips if not c.get("is_gap", False)]

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
                if c.get("video_enabled", True) or c.get("audio_enabled", True):
                    enabled_clips.append(c)
    else:
        enabled_clips = [c for c in clips if c.get("video_enabled", True) or c.get("audio_enabled", True)]

    if not enabled_clips:
        return None, "No clips to merge"

    target_w = 0
    target_h = 0
    for clip in enabled_clips:
        w = clip.get("width", 0)
        h = clip.get("height", 0)
        if w > 0 and h > 0:
            if w > target_w or (w == target_w and h > target_h):
                target_w = w
                target_h = h
    if target_w == 0:
        target_w = 1920
    if target_h == 0:
        target_h = 1080
    if target_w % 2 != 0:
        target_w += 1
    if target_h % 2 != 0:
        target_h += 1

    target_fps = float(frame_rate) if frame_rate else 24.0

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
                target_w, target_h, target_fps, crf, video_codec, pix_fmt,
                default_transition, transition_duration, ffmpeg
            )
        else:
            return _process_legacy(
                enabled_clips, temp_dir, output_path,
                target_w, target_h, target_fps, crf, video_codec, pix_fmt,
                default_transition, transition_duration, ffmpeg, align_mode
            )
    except Exception as e:
        return None, f"Error during processing: {str(e)}"
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def _process_legacy(enabled_clips, temp_dir, output_path,
                    target_w, target_h, target_fps, crf, video_codec, pix_fmt,
                    default_transition, transition_duration, ffmpeg, align_mode="height"):
    """Legacy mode: sequential concat with both video and audio from each clip."""
    processed_files = []
    for i, clip in enumerate(enabled_clips):
        output_file = os.path.join(temp_dir, f"clip_{i:04d}.mp4")
        cmd = _build_clip_command(
            clip, output_file, target_w, target_h, int(target_fps),
            default_transition, transition_duration, i, len(enabled_clips), align_mode
        )
        if not cmd:
            print(f"[BSAI Premiere Pro] Skipping clip {i}: file not found or invalid")
            continue
        print(f"[BSAI Premiere Pro] Processing clip {i+1}/{len(enabled_clips)}: {clip.get('file_name', 'unknown')}")
        result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=600)
        if result.returncode != 0:
            return None, f"Failed to process clip {i} ({clip.get('file_name', '')}):\n{result.stderr}"
        processed_files.append(output_file)
    if not processed_files:
        return None, "No clips were successfully processed"

    # Use filter_complex concat for gapless merging (same as multitrack mode)
    n = len(processed_files)
    if n == 1:
        # Single clip: just copy/re-encode to output
        shutil.copy2(processed_files[0], output_path)
        print(f"[BSAI Premiere Pro] Single clip, copied -> {output_path}")
        return output_path, None

    concat_cmd = [ffmpeg, "-y", "-loglevel", "error"]
    for pf in processed_files:
        concat_cmd.extend(["-i", pf])

    # Legacy clips have both video and audio
    concat_parts = "".join(f"[{i}:v][{i}:a]" for i in range(n))
    filter_complex = (
        f"{concat_parts}concat=n={n}:v=1:a=1[vout][aout];"
        f"[aout]aresample=async=1:first_pts=0[afixed]"
    )
    concat_cmd.extend([
        "-filter_complex", filter_complex,
        "-map", "[vout]", "-map", "[afixed]",
        "-c:v", video_codec, "-preset", "medium", "-crf", crf,
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", pix_fmt,
        "-r", str(int(target_fps)),
        "-ar", "48000", "-ac", "2",
        "-avoid_negative_ts", "make_zero",
        "-movflags", "+faststart",
        output_path
    ])

    print(f"[BSAI Premiere Pro] Merging {n} clips (filter_complex) -> {output_path}")
    result = subprocess.run(concat_cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=600)
    if result.returncode != 0:
        # Fallback: concat demuxer with re-encode
        print(f"[BSAI Premiere Pro] filter_complex concat failed, falling back to concat demuxer:\n{result.stderr}")
        concat_file = os.path.join(temp_dir, "concat_list.txt")
        with open(concat_file, "w", encoding="utf-8") as f:
            for pf in processed_files:
                escaped = pf.replace("\\", "/")
                f.write(f"file '{escaped}'\n")
        fallback_cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", concat_file,
            "-c:v", video_codec, "-preset", "medium", "-crf", crf,
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", pix_fmt,
            "-r", str(int(target_fps)),
            "-ar", "48000", "-ac", "2",
            "-avoid_negative_ts", "make_zero",
            "-fflags", "+genpts",
            "-movflags", "+faststart",
            output_path
        ]
        result = subprocess.run(fallback_cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=600)
        if result.returncode != 0:
            return None, f"Failed to merge clips:\n{result.stderr}"
    print(f"[BSAI Premiere Pro] Output saved: {output_path}")
    return output_path, None


def _process_multitrack(timeline_data, enabled_clips, temp_dir, output_path,
                        target_w, target_h, target_fps, crf, video_codec, pix_fmt,
                        default_transition, transition_duration, ffmpeg):
    """Multi-track mode: process video and audio tracks separately, then combine."""
    video_tracks = timeline_data.get("video_tracks", [])
    audio_tracks = timeline_data.get("audio_tracks", [])
    align_mode = timeline_data.get("align_mode", "height")

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
            default_transition, transition_duration, align_mode
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
        v_info = get_video_info(final_video)
        a_info = get_video_info(final_audio)
        v_dur = v_info["duration"] if v_info else 0
        a_dur = a_info["duration"] if a_info else 0
        if a_dur > v_dur + 0.5:
            trailing = a_dur - v_dur
            combine_cmd = [
                ffmpeg, "-y", "-loglevel", "error",
                "-i", final_video, "-i", final_audio,
                "-filter_complex",
                f"[0:v]tpad=stop_mode=on:stop_duration={trailing}[vout]; [1:a]apad[aout]",
                "-map", "[vout]", "-map", "[aout]",
                "-c:v", video_codec, "-preset", "medium", "-crf", crf,
                "-c:a", "aac", "-b:a", "192k",
                "-pix_fmt", pix_fmt,
                "-movflags", "+faststart",
                "-shortest",
                output_path
            ]
            print(f"[BSAI Premiere Pro] Combining video and audio (tpad {trailing:.2f}s + apad) -> {output_path}")
        else:
            combine_cmd = [
                ffmpeg, "-y", "-loglevel", "error",
                "-i", final_video, "-i", final_audio,
                "-filter_complex", "[1:a]apad[aout]",
                "-map", "0:v:0", "-map", "[aout]",
                "-c:v", video_codec, "-preset", "medium", "-crf", crf,
                "-c:a", "aac", "-b:a", "192k",
                "-pix_fmt", pix_fmt,
                "-movflags", "+faststart",
                "-shortest",
                output_path
            ]
            print(f"[BSAI Premiere Pro] Combining video and audio (apad) -> {output_path}")
        result = subprocess.run(combine_cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=600)
        if result.returncode != 0:
            return None, f"Failed to combine video and audio:\n{result.stderr}"

    elif final_video:
        # Video only: re-encode to output with specified codec
        cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-i", final_video,
            "-map", "0:v:0",
            "-c:v", video_codec, "-preset", "medium", "-crf", crf,
            "-pix_fmt", pix_fmt,
            "-movflags", "+faststart",
            output_path
        ]
        print(f"[BSAI Premiere Pro] Saving video-only output -> {output_path}")
        result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=600)
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
            "-pix_fmt", pix_fmt,
            "-shortest",
            "-movflags", "+faststart",
            output_path
        ]
        print(f"[BSAI Premiere Pro] Saving audio-only output with black video -> {output_path}")
        result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=600)
        if result.returncode != 0:
            return None, f"Failed to save audio:\n{result.stderr}"

    else:
        return None, "No output could be produced"

    print(f"[BSAI Premiere Pro] Output saved: {output_path}")
    return output_path, None


def save_image_tensor(tensor, output_path):
    """Save a PyTorch image tensor (B,H,W,C or H,W,C) as PNG."""
    import numpy as np
    try:
        from PIL import Image
    except ImportError:
        return False
    try:
        arr = tensor.cpu().numpy()
    except Exception:
        return False
    if arr.ndim == 4:
        arr = arr[0]
    arr = (arr * 255).clip(0, 255).astype(np.uint8)
    try:
        Image.fromarray(arr).save(output_path)
        return True
    except Exception as e:
        print(f"[BSAI Premiere Pro] Failed to save image: {e}")
        return False


def save_audio_to_wav(audio_dict, output_path):
    """Save a ComfyUI AUDIO dict {waveform, sample_rate} as a WAV file."""
    import numpy as np
    if not audio_dict or "waveform" not in audio_dict:
        return False
    try:
        waveform = audio_dict["waveform"]
        sample_rate = int(audio_dict.get("sample_rate", 44100))
        arr = waveform.cpu().numpy()
        if arr.ndim == 3:
            arr = arr[0]
        if arr.ndim == 1:
            arr = arr.reshape(1, -1)
        channels = arr.shape[0]
        audio_int16 = (arr * 32767).clip(-32768, 32767).astype(np.int16)
        with wave.open(output_path, "w") as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(audio_int16.T.tobytes())
        return True
    except Exception as e:
        print(f"[BSAI Premiere Pro] Failed to save audio: {e}")
        return False


def merge_image_audio_to_video(image_tensor, audio_dict, output_path, fps=30, duration=None):
    """Merge an image tensor and audio dict into a video file.

    If image_tensor has batch > 1, creates a video from the image sequence.
    If audio is provided, it is added to the video.
    Returns (True, info_dict) on success, (False, error_msg) on failure.
    """
    ffmpeg = get_ffmpeg()
    if not ffmpeg:
        return False, "ffmpeg not found"
    if image_tensor is None:
        return False, "No image provided"

    temp_dir = tempfile.mkdtemp(prefix="bsai_merge_")
    try:
        batch = image_tensor.shape[0] if image_tensor.dim() == 4 else 1

        if batch > 1:
            for i in range(batch):
                frame = image_tensor[i] if image_tensor.dim() == 4 else image_tensor
                frame_path = os.path.join(temp_dir, f"frame_{i:06d}.png")
                if not save_image_tensor(frame, frame_path):
                    return False, "Failed to save image frames"
            img_input = os.path.join(temp_dir, "frame_%06d.png")
            is_sequence = True
        else:
            img_path = os.path.join(temp_dir, "frame.png")
            if not save_image_tensor(image_tensor, img_path):
                return False, "Failed to save image"
            img_input = img_path
            is_sequence = False

        audio_path = None
        if audio_dict and "waveform" in audio_dict:
            audio_path = os.path.join(temp_dir, "audio.wav")
            if not save_audio_to_wav(audio_dict, audio_path):
                audio_path = None

        cmd = [ffmpeg, "-y", "-loglevel", "error"]

        if is_sequence:
            cmd.extend(["-framerate", str(fps), "-i", img_input])
        else:
            cmd.extend(["-loop", "1", "-i", img_input])

        if audio_path:
            cmd.extend(["-i", audio_path])

        if not is_sequence and not audio_path and duration:
            cmd.extend(["-t", str(duration)])
        elif not is_sequence and not audio_path:
            cmd.extend(["-t", "5"])

        if audio_path:
            cmd.extend([
                "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                "-pix_fmt", "yuv420p", "-r", str(fps),
                "-c:a", "aac", "-b:a", "192k",
                "-shortest",
            ])
        else:
            cmd.extend([
                "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                "-pix_fmt", "yuv420p", "-r", str(fps),
            ])

        cmd.append(output_path)

        print(f"[BSAI Premiere Pro] Merging image+audio -> {output_path}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            return False, f"ffmpeg failed: {result.stderr[:500]}"

        info = get_video_info(output_path)
        if info is None:
            info = {"duration": 0, "width": 1920, "height": 1080, "fps": fps, "has_audio": audio_path is not None}
        info["file_path"] = output_path
        info["file_name"] = os.path.basename(output_path)
        return True, info
    except Exception as e:
        return False, f"Error merging: {str(e)}"
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
