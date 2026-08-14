from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

try:
    from . import server
except Exception as e:
    print(f"[BSAI Premiere Pro] Server routes failed to load: {e}")

WEB_DIRECTORY = "./web"

# Inject <script> tag into index.html as classic script.
# ComfyUI 0.32.0 loads extensions via import() as ES modules,
# but browser module cache is very aggressive. A classic <script>
# tag bypasses that cache entirely.
#
# We use TWO injection mechanisms for maximum reliability:
# 1. Middleware (works before app is frozen)
# 2. on_response_prepare signal (works even after app is frozen)
import os
import time
from server import PromptServer

_FOLDER_NAME = os.path.basename(os.path.dirname(os.path.abspath(__file__)))

# Cache-busting: compute version dynamically on every request
# so browser ALWAYS fetches latest JS even without ComfyUI restart
_js_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "bsai_pp.js")
import re

_BSAI_TAG_RE = re.compile(
    r'<script[^>]*src="/extensions/' + re.escape(_FOLDER_NAME) + r'/bsai_pp\.js[^"]*"[^>]*></script>'
)


def _get_script_tag():
    """Build script tag with current file mtime+size (dynamic, not cached)."""
    if os.path.exists(_js_path):
        mtime = os.path.getmtime(_js_path)
        size = os.path.getsize(_js_path)
        v = f"{mtime:.6f}_{size}"
    else:
        v = str(time.time())
    return f'<script src="/extensions/{_FOLDER_NAME}/bsai_pp.js?v={v}"></script>'


def _inject_script_into_html(html):
    """Inject our script tag into HTML, always using latest mtime."""
    tag = _get_script_tag()
    if tag in html:
        return None  # Already injected with current version
    # Remove any older version of our script tag (stale cache)
    html = _BSAI_TAG_RE.sub('', html)
    if "</head>" in html:
        return html.replace("</head>", tag + "</head>")
    if "</body>" in html:
        return html.replace("</body>", tag + "</body>")
    return html + tag


# Mechanism 1: Middleware (works if app is not yet frozen)
try:
    from aiohttp import web

    @web.middleware
    async def _bsai_inject_middleware(request, handler):
        if request.path == "/":
            try:
                web_root = getattr(PromptServer.instance, "web_root", None)
                if not web_root:
                    import folder_paths
                    web_root = folder_paths.base_path
                html_path = os.path.join(web_root, "index.html")
                with open(html_path, "r", encoding="utf-8") as f:
                    html = f.read()
                modified = _inject_script_into_html(html)
                if modified is not None:
                    return web.Response(
                        text=modified,
                        content_type="text/html",
                        headers={
                            "Cache-Control": "no-store, must-revalidate",
                            "Pragma": "no-cache",
                            "Expires": "0",
                        },
                    )
            except Exception as e:
                print(f"[BSAI Premiere Pro] Middleware injection failed: {e}")
        return await handler(request)

    try:
        PromptServer.instance.app._middlewares.append(_bsai_inject_middleware)
        print("[BSAI Premiere Pro] Middleware injection installed")
    except Exception as e:
        print(f"[BSAI Premiere Pro] Middleware append failed (app may be frozen): {e}")
except Exception as e:
    print(f"[BSAI Premiere Pro] Middleware setup failed: {e}")


# Mechanism 2: on_response_prepare signal (works even after app is frozen)
try:
    async def _bsai_inject_on_response(request, response):
        """Inject script tag into HTML responses via on_response_prepare."""
        path = getattr(request, "path", "")
        # Force no-cache for our JS files so browser ALWAYS fetches latest
        if f"/extensions/{_FOLDER_NAME}/" in path and path.endswith(".js"):
            response.headers["Cache-Control"] = "no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            return
        if path != "/":
            return
        content_type = getattr(response, "content_type", "") or ""
        if "text/html" not in content_type:
            return
        try:
            body = response.body
            if isinstance(body, bytes):
                html = body.decode("utf-8", errors="ignore")
            elif isinstance(body, str):
                html = body
            else:
                return
            modified = _inject_script_into_html(html)
            if modified is not None:
                response.body = modified.encode("utf-8")
                # Prevent browser from caching HTML with stale script tags
                response.headers["Cache-Control"] = "no-store, must-revalidate"
                response.headers["Pragma"] = "no-cache"
        except Exception as e:
            print(f"[BSAI Premiere Pro] Response injection failed: {e}")

    PromptServer.instance.app.on_response_prepare.append(_bsai_inject_on_response)
    print("[BSAI Premiere Pro] on_response_prepare injection installed")
except Exception as e:
    print(f"[BSAI Premiere Pro] on_response_prepare setup failed: {e}")
