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
try:
    import os
    from aiohttp import web
    from server import PromptServer

    @web.middleware
    async def _bsai_inject_script(request, handler):
        if request.path == "/":
            try:
                html_path = os.path.join(PromptServer.instance.web_root, "index.html")
                with open(html_path, "r", encoding="utf-8") as f:
                    html = f.read()
                tag = '<script src="/extensions/BSAI_Premiere_Pro/js/bsai_pp.js"></script>'
                if "</head>" in html:
                    html = html.replace("</head>", tag + "</head>")
                return web.Response(
                    text=html,
                    content_type="text/html",
                    headers={
                        "Cache-Control": "no-store, must-revalidate",
                        "Pragma": "no-cache",
                        "Expires": "0",
                    },
                )
            except Exception as e:
                print(f"[BSAI Premiere Pro] Script injection failed: {e}")
        return await handler(request)

    PromptServer.instance.app._middlewares.append(_bsai_inject_script)
    print("[BSAI Premiere Pro] HTML script injection middleware installed")
except Exception as e:
    print(f"[BSAI Premiere Pro] Middleware setup failed: {e}")
