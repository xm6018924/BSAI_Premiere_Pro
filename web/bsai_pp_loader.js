/**
 * BSAI Premiere Pro - Loader
 * Ensures the main extension script is loaded even if the
 * __init__.py HTML middleware fails (e.g. on fresh GitHub install).
 * ComfyUI auto-discovers this file via WEB_DIRECTORY = "./web".
 */
(function () {
    "use strict";

    function loadMainScript() {
        // The main script sets window.__bsai_pp_loaded itself;
        // we only check it here to avoid double-injecting the <script> tag.
        if (window.__bsai_pp_script_injected) return;
        window.__bsai_pp_script_injected = true;

        var script = document.createElement("script");
        script.src = "/extensions/BSAI_Premiere_Pro/js/bsai_pp.js?v=" + Date.now();
        script.onerror = function () {
            window.__bsai_pp_script_injected = false;
            console.error("[BSAI Premiere Pro] Failed to load bsai_pp.js");
        };
        document.head.appendChild(script);
    }

    // Wait for ComfyUI app to be ready before loading
    function tryLoad() {
        var app = (window.comfyAPI && window.comfyAPI.app && window.comfyAPI.app.app) || window.app;
        if (app && typeof app.registerExtension === "function") {
            loadMainScript();
        } else {
            if (!window.__bsai_pp_retry_count) window.__bsai_pp_retry_count = 0;
            if (window.__bsai_pp_retry_count < 50) {
                window.__bsai_pp_retry_count++;
                setTimeout(tryLoad, 200);
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", tryLoad);
    } else {
        tryLoad();
    }
})();
