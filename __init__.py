from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

try:
    from . import server
except Exception as e:
    print(f"[BSAI Premiere Pro] Server routes failed to load: {e}")

WEB_DIRECTORY = "./web"
