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
from server import PromptServer

_BSAI_SCRIPT_TAG = '<script src="/extensions/BSAI_Premiere_Pro/bsai_pp.js"></script>'


def _inject_script_into_html(html):
    """Inject our script tag into HTML if not already present."""
    if _BSAI_SCRIPT_TAG in html:
        return None  # Already injected
    if "</head>" in html:
        return html.replace("</head>", _BSAI_SCRIPT_TAG + "</head>")
    if "</body>" in html:
        return html.replace("</body>", _BSAI_SCRIPT_TAG + "</body>")
    return html + _BSAI_SCRIPT_TAG


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
        except Exception as e:
            print(f"[BSAI Premiere Pro] Response injection failed: {e}")

    PromptServer.instance.app.on_response_prepare.append(_bsai_inject_on_response)
    print("[BSAI Premiere Pro] on_response_prepare injection installed")
except Exception as e:
    print(f"[BSAI Premiere Pro] on_response_prepare setup failed: {e}")
