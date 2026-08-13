/**
 * BSAI Premiere Pro - Loader
 * Ensures the main extension script is loaded even if the
 * __init__.py HTML middleware fails (e.g. on fresh GitHub install).
 * ComfyUI auto-discovers this file via WEB_DIRECTORY = "./web".
 *
 * Loads the main script IMMEDIATELY (without waiting for app ready)
 * to maximize the chance of registering beforeRegisterNodeDef hooks
 * before ComfyUI registers node types. The main script has its own
 * internal retry mechanism for waiting for the app.
 */
(function () {
    "use strict";

    function loadMainScript() {
        if (window.__bsai_pp_script_injected) return;
        window.__bsai_pp_script_injected = true;

        var script = document.createElement("script");
        script.src = "/extensions/BSAI_Premiere_Pro/bsai_pp.js?v=" + Date.now();
        script.onerror = function () {
            window.__bsai_pp_script_injected = false;
            console.error("[BSAI Premiere Pro] Failed to load bsai_pp.js");
            // Retry after 1 second
            setTimeout(function () {
                loadMainScript();
            }, 1000);
        };
        document.head.appendChild(script);
    }

    // Load immediately - the main script handles waiting for the app internally
    // via _registerBsaiPP() which retries every 200ms until app.registerExtension
    // is available.
    if (document.readyState === "loading") {
        // DOM still loading - inject as soon as possible
        document.addEventListener("DOMContentLoaded", loadMainScript);
    } else {
        // DOM already loaded - inject now
        loadMainScript();
    }
})();
