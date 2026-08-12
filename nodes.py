import os
import json
import traceback

from .utils import process_and_merge, get_video_info, scan_video_directory, format_time


class BSAIPremiereProTimeline:
    """BSAI Premiere Pro - Timeline-based video editing node.

    Auto-imports video files from a watch directory, displays them on a
    timeline, and provides transition / trim / audio-replacement editing.
    When executed (user clicks Run), merges all clips into one output video.
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
                "output_format": (["mp4", "mov", "mkv", "webm"], {
                    "default": "mp4",
                }),
                "video_codec": (["libx264", "libx265", "libvpx-vp9", "mpeg4"], {
                    "default": "libx264",
                }),
                "quality": (["high", "medium", "low"], {
                    "default": "high",
                }),
                "timeline_data": ("STRING", {
                    "default": '{"clips":[],"known_files":[]}',
                    "multiline": True,
                }),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("video_path",)
    FUNCTION = "render"
    CATEGORY = "BSAI"
    OUTPUT_NODE = True

    def render(self, watch_directory, auto_import, default_transition,
               transition_duration, output_filename, output_format,
               video_codec, quality, timeline_data):

        if not timeline_data or not timeline_data.strip():
            return {"result": ("",), "ui": {"error": "No timeline data"}}

        try:
            data = json.loads(timeline_data)
        except json.JSONDecodeError:
            return {"result": ("",), "ui": {"error": "Invalid timeline data JSON"}}

        clips = data.get("clips", [])
        if not clips:
            return {"result": ("",), "ui": {"error": "No clips on timeline"}}

        enabled = [c for c in clips if c.get("video_enabled", True) or c.get("audio_enabled", True)]
        if not enabled:
            return {"result": ("",), "ui": {"error": "No enabled clips"}}

        output_path, error = process_and_merge(
            data, output_filename, output_format, video_codec,
            quality, default_transition, transition_duration
        )

        if error:
            return {"result": ("",), "ui": {"error": error}}

        filename = os.path.basename(output_path) if output_path else ""
        return {
            "result": (output_path or "",),
            "ui": {
                "video_path": output_path or "",
                "filename": filename,
                "clip_count": len(enabled),
                "clips": [{"file_name": c.get("file_name", ""), "duration": c.get("duration", 0)} for c in enabled],
            },
        }


NODE_CLASS_MAPPINGS = {
    "BSAIPremiereProTimeline": BSAIPremiereProTimeline,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "BSAIPremiereProTimeline": "BSAI Premiere Pro Timeline",
}
