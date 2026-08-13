import os
import json
import time
import traceback

from .utils import (
    process_and_merge, get_video_info, scan_video_directory, format_time,
    merge_image_audio_to_video,
)


class BSAIPremiereProTimeline:
    """BSAI Premiere Pro - Timeline-based video editing node.

    Auto-imports video files from a watch directory, displays them on a
    timeline, and provides transition / trim / audio-replacement editing.
    When executed (user clicks Run), merges all clips into one output video.

    Optional IMAGE + AUDIO inputs allow the workflow to pass generated
    images and audio directly to the node, which merges them into a video
    and adds it to the timeline (no duplicate imports).
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "watch_directory": ("STRING", {
                    "default": "output",
                    "multiline": False,
                }),
                "auto_import": ("BOOLEAN", {"default": True}),
                "default_transition": (["cut", "fade", "black", "white"], {
                    "default": "cut",
                }),
                "transition_duration": ("FLOAT", {
                    "default": 0.5, "min": 0.0, "max": 5.0, "step": 0.1,
                }),
                "output_filename": ("STRING", {
                    "default": "premiere_pro_output",
                    "multiline": False,
                }),
                "format": (["video/h264-mp4", "video/h265-mp4", "video/h264-mkv",
                             "video/h265-mkv", "video/h264-mov", "video/vp9-webm"], {
                    "default": "video/h264-mp4",
                }),
                "pix_fmt": (["yuv420p", "yuv444p", "yuv422p", "rgb24", "bgr0"], {
                    "default": "yuv420p",
                }),
                "crf": ("FLOAT", {
                    "default": 19, "min": 0, "max": 51, "step": 1,
                }),
                "frame_rate": ("FLOAT", {
                    "default": 24, "min": 1, "max": 120, "step": 1,
                }),
            },
            "optional": {
                "image": ("IMAGE",),
                "audio": ("AUDIO",),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("video_path",)
    FUNCTION = "render"
    CATEGORY = "BSAI"
    OUTPUT_NODE = True

    def render(self, watch_directory, auto_import, default_transition,
               transition_duration, output_filename, format,
               pix_fmt, crf, frame_rate, image=None, audio=None, unique_id=None):

        from .server import _timeline_store
        timeline_data = _timeline_store.get(unique_id, '{"clips":[],"known_files":[],"deleted_files":[],"directory_history":{}}')

        if not timeline_data or not timeline_data.strip():
            timeline_data = '{"clips":[],"known_files":[],"deleted_files":[],"directory_history":{}}'

        try:
            data = json.loads(timeline_data)
        except json.JSONDecodeError:
            return {"result": ("",), "ui": {"error": ["Invalid timeline data JSON"]}}

        if not data.get("clips"):
            data["clips"] = []
        if not data.get("known_files"):
            data["known_files"] = []
        if not data.get("deleted_files"):
            data["deleted_files"] = []
        if not data.get("directory_history"):
            data["directory_history"] = {}
        if not data.get("video_tracks"):
            data["video_tracks"] = [{"name": "V1", "locked": False, "visible": True}]
        if not data.get("audio_tracks"):
            data["audio_tracks"] = [{"name": "A1", "locked": False, "muted": False, "solo": False}]

        timeline_updated = False
        merge_msg = ""

        # ── Merge IMAGE + AUDIO into a video and add to timeline ──
        if image is not None:
            try:
                import folder_paths
                output_dir = folder_paths.get_output_directory()
            except Exception:
                output_dir = os.getcwd()

            ts = int(time.time() * 1000)
            merged_name = f"bsai_merged_{ts}.mp4"
            merged_path = os.path.join(output_dir, merged_name)

            ok, result_info = merge_image_audio_to_video(image, audio, merged_path)
            if ok:
                file_name = result_info["file_name"]
                known_files = set(data.get("known_files", []))
                existing_clips = data.get("clips", [])
                already_exists = any(c.get("file_name") == file_name for c in existing_clips)

                if file_name not in known_files and not already_exists:
                    vId = f"clip_{ts}_{id(data)}"
                    aId = f"clip_{ts + 1}_{id(data)}"
                    base = {
                        "file_path": merged_path,
                        "file_name": file_name,
                        "created_time": time.time(),
                        "duration": result_info.get("duration", 0),
                        "width": result_info.get("width", 1920),
                        "height": result_info.get("height", 1080),
                        "fps": result_info.get("fps", 30),
                        "has_audio": result_info.get("has_audio", True),
                        "trim_start": 0,
                        "trim_end": result_info.get("duration", 0),
                        "transition_in": default_transition,
                        "transition_out": default_transition,
                        "transition_duration": transition_duration,
                        "audio_replacement": None,
                        "audio_fade_in": 0,
                        "audio_fade_out": 0,
                        "video_enabled": True,
                        "audio_enabled": True,
                    }
                    data["clips"].append({**base, "id": vId, "track_type": "video", "track_index": 0, "linked_id": aId, "is_video_part": True})
                    data["clips"].append({**base, "id": aId, "track_type": "audio", "track_index": 0, "linked_id": vId, "is_video_part": False})
                    data["known_files"].append(file_name)
                    timeline_updated = True
                    merge_msg = f"Merged image+audio -> {file_name}"
                    print(f"[BSAI Premiere Pro] {merge_msg}")
                else:
                    merge_msg = f"Skipped duplicate: {file_name}"
                    print(f"[BSAI Premiere Pro] {merge_msg}")
            else:
                merge_msg = f"Merge failed: {result_info}"
                print(f"[BSAI Premiere Pro] {merge_msg}")

            # When image+audio are connected, only merge the incoming pair into
            # an independent file. Do NOT merge all timeline clips into one.
            ui = {
                "video_path": [merged_path if ok else ""],
                "filename": [merged_name if ok else ""],
                "clip_count": [str(len(data.get("clips", [])))],
                "merge_msg": [merge_msg or ""],
            }
            if timeline_updated:
                ui["timeline_data"] = [json.dumps(data)]
                _timeline_store[unique_id] = json.dumps(data)
            return {"result": (merged_path if ok else "",), "ui": ui}

        # ── Manual mode: no image+audio connected, merge all timeline clips ──
        clips = data.get("clips", [])
        if not clips:
            ui = {"error": ["No clips on timeline"]}
            if timeline_updated:
                ui["timeline_data"] = [json.dumps(data)]
            return {"result": ("",), "ui": ui}

        enabled = [c for c in clips if c.get("video_enabled", True) or c.get("audio_enabled", True)]
        if not enabled:
            ui = {"error": ["No enabled clips"]}
            if timeline_updated:
                ui["timeline_data"] = [json.dumps(data)]
            return {"result": ("",), "ui": ui}

        output_path, error = process_and_merge(
            data, output_filename, format, pix_fmt, crf, frame_rate,
            default_transition, transition_duration
        )

        if error:
            ui = {"error": [error]}
            if timeline_updated:
                ui["timeline_data"] = [json.dumps(data)]
            return {"result": ("",), "ui": ui}

        filename = os.path.basename(output_path) if output_path else ""
        ui = {
            "video_path": [output_path or ""],
            "filename": [filename],
            "clip_count": [str(len(enabled))],
            "clips": [json.dumps({"file_name": c.get("file_name", ""), "duration": c.get("duration", 0)}) for c in enabled],
        }
        if timeline_updated:
            ui["timeline_data"] = [json.dumps(data)]
            _timeline_store[unique_id] = json.dumps(data)
        if merge_msg:
            ui["merge_msg"] = [merge_msg]

        return {
            "result": (output_path or "",),
            "ui": ui,
        }


NODE_CLASS_MAPPINGS = {
    "BSAIPremiereProTimeline": BSAIPremiereProTimeline,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "BSAIPremiereProTimeline": "BSAI Premiere Pro Timeline",
}
