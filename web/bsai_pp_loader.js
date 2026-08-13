/**
 * BSAI Premiere Pro - Loader
 * Ensures the main extension script is loaded even if the
 * __init__.py HTML middleware fails (e.g. on fresh GitHub install).
 * ComfyUI auto-discovers this file via WEB_DIRECTORY = "./web".
 *
 * Uses dynamic folder name detection so it works regardless of
 * how the custom node folder is named on different computers.
 */
(function () {
    "use strict";

    function getBaseUrl() {
        // Try to get the base URL from the current script's src
        try {
            var scripts = document.getElementsByTagName("script");
            for (var i = scripts.length - 1; i >= 0; i--) {
                var s = scripts[i];
                if (s.src && s.src.indexOf("bsai_pp_loader") !== -1) {
                    return s.src.substring(0, s.src.lastIndexOf("/") + 1);
                }
            }
        } catch (e) {}
        // Fallback: try common folder names
        return "/extensions/BSAI_Premiere_Pro/";
    }

    function loadMainScript() {
        if (window.__bsai_pp_script_injected) return;
        window.__bsai_pp_script_injected = true;

        var baseUrl = getBaseUrl();
        var script = document.createElement("script");
        script.src = baseUrl + "bsai_pp.js?v=" + Date.now();
        script.onerror = function () {
            window.__bsai_pp_script_injected = false;
            console.error("[BSAI Premiere Pro] Failed to load bsai_pp.js from: " + baseUrl);
            // Try alternate folder names
            var altNames = ["BSAI_Premiere_Pro", "ComfyUI-BSAI_Premiere_Pro", "bsai_premiere_pro"];
            var found = false;
            altNames.forEach(function (name) {
                if (found) return;
                var altUrl = "/extensions/" + name + "/bsai_pp.js?v=" + Date.now();
                var altScript = document.createElement("script");
                altScript.src = altUrl;
                altScript.onload = function () { found = true; };
                altScript.onerror = function () {};
                document.head.appendChild(altScript);
            });
            // Retry original after 2 seconds
            setTimeout(function () {
                loadMainScript();
            }, 2000);
        };
        script.onload = function () {
            console.log("[BSAI Premiere Pro] Main script loaded successfully");
        };
        document.head.appendChild(script);
    }

    // Load immediately - the main script handles waiting for the app internally
    // via _registerBsaiPP() which retries every 200ms until app.registerExtension
    // is available.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadMainScript);
    } else {
        loadMainScript();
    }
})();
