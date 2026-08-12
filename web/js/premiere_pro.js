import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const NODE_TYPE = "BSAIPremiereProTimeline";
const POLL_INTERVAL = 3000;
const TRANSITIONS = ["fade", "black", "white", "cut"];
const TRANSITION_LABELS = { cut: "切镜", fade: "淡入淡出", black: "黑屏过渡", white: "白屏过渡" };
const TRANSITION_ICONS = { cut: "✂️", fade: "🌫️", black: "⬛", white: "⬜" };
const TRANSITION_DESCS = { cut: "硬切", fade: "平滑过渡", black: "黑屏淡入", white: "白屏淡入" };

function formatTime(seconds) {
    if (!seconds || seconds < 0) return "00:00.00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}

// ── CSS ──────────────────────────────────────────────────────────────
const STYLES = `
.bsai-pp-overlay {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.7); z-index: 100000;
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, "Segoe UI", sans-serif;
}
.bsai-pp-modal {
    background: #1e1e1e; border: 1px solid #444; border-radius: 8px;
    width: 95vw; max-width: 1400px; height: 92vh; max-height: 900px;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}
.bsai-pp-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px; background: #252525; border-bottom: 1px solid #3a3a3a;
    flex-shrink: 0;
}
.bsai-pp-title { color: #e0e0e0; font-size: 15px; font-weight: 600; }
.bsai-pp-close {
    background: #3a3a3a; border: none; color: #ccc; cursor: pointer;
    width: 30px; height: 30px; border-radius: 4px; font-size: 16px;
}
.bsai-pp-close:hover { background: #e53935; color: #fff; }
.bsai-pp-toolbar {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    padding: 8px 16px; background: #2a2a2a; border-bottom: 1px solid #3a3a3a;
    flex-shrink: 0;
}
.bsai-pp-toolbar label { color: #aaa; font-size: 12px; }
.bsai-pp-toolbar input[type="text"] {
    background: #1a1a1a; border: 1px solid #444; color: #e0e0e0;
    padding: 4px 8px; border-radius: 4px; font-size: 12px; width: 180px;
}
.bsai-pp-toolbar input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
.bsai-pp-btn {
    background: #3a3a3a; border: 1px solid #555; color: #ddd; cursor: pointer;
    padding: 5px 12px; border-radius: 4px; font-size: 12px; white-space: nowrap;
}
.bsai-pp-btn:hover { background: #4a4a4a; }
.bsai-pp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.bsai-pp-btn-primary { background: #4a90d9; border-color: #5a9fe8; color: #fff; }
.bsai-pp-btn-primary:hover { background: #5a9fe8; }
.bsai-pp-btn-danger { background: #d35454; border-color: #e06464; color: #fff; }
.bsai-pp-btn-danger:hover { background: #e06464; }
.bsai-pp-btn-success { background: #4caf50; border-color: #5cbf60; color: #fff; }
.bsai-pp-btn-success:hover { background: #5cbf60; }
.bsai-pp-status {
    color: #888; font-size: 12px; margin-left: auto;
    display: flex; gap: 12px; align-items: center;
}
.bsai-pp-status .dot {
    width: 8px; height: 8px; border-radius: 50%; display: inline-block;
}
.bsai-pp-status .dot.on { background: #4caf50; }
.bsai-pp-status .dot.off { background: #666; }
.bsai-pp-body {
    flex: 1; display: flex; flex-direction: column; overflow: hidden;
}
.bsai-pp-timeline-section {
    flex: 1; display: flex; flex-direction: column; overflow: hidden;
    border-bottom: 1px solid #3a3a3a;
}
.bsai-pp-section-label {
    padding: 6px 16px; color: #888; font-size: 11px; text-transform: uppercase;
    letter-spacing: 1px; background: #232323; border-bottom: 1px solid #333;
}
.bsai-pp-timeline-scroll {
    flex: 1; overflow: auto; background: #1a1a1a; padding: 0;
}
.bsai-pp-timeline-container { min-width: 100%; display: flex; flex-direction: column; }
.bsai-pp-time-ruler {
    display: flex; align-items: flex-end; height: 28px; background: #232323;
    border-bottom: 1px solid #3a3a3a; position: sticky; top: 0; z-index: 5;
}
.bsai-pp-ruler-spacer {
    min-width: 150px; flex-shrink: 0; border-right: 1px solid #3a3a3a;
}
.bsai-pp-ruler-marks { flex: 1; position: relative; height: 100%; padding-left: 4px; }
.bsai-pp-ruler-mark {
    position: absolute; bottom: 0; font-size: 10px; color: #666;
    border-left: 1px solid #333; height: 8px; white-space: nowrap; padding-left: 3px;
}
.bsai-pp-track-section-label {
    padding: 4px 10px; color: #666; font-size: 10px; text-transform: uppercase;
    letter-spacing: 1px; background: #1e1e1e; border-bottom: 1px solid #2a2a2a;
    display: flex; align-items: center; gap: 8px;
}
.bsai-pp-track-row {
    display: flex; border-bottom: 1px solid #111; min-height: 64px;
}
.bsai-pp-track-header {
    min-width: 150px; flex-shrink: 0; background: #2a2a2a;
    border-right: 1px solid #3a3a3a; display: flex; flex-direction: column;
    padding: 6px 8px; gap: 4px; justify-content: center;
}
.bsai-pp-track-header-row { display: flex; align-items: center; gap: 4px; }
.bsai-pp-track-name { font-size: 12px; font-weight: 600; min-width: 28px; }
.bsai-pp-track-name.video { color: #4a90d9; }
.bsai-pp-track-name.audio { color: #4caf50; }
.bsai-pp-track-controls { display: flex; gap: 3px; }
.bsai-pp-track-btn {
    width: 22px; height: 22px; border-radius: 3px; background: #1a1a1a;
    border: 1px solid #444; color: #666; cursor: pointer; font-size: 10px;
    display: flex; align-items: center; justify-content: center; transition: all 0.15s;
}
.bsai-pp-track-btn:hover { background: #333; color: #ddd; }
.bsai-pp-track-btn.active { background: #4a90d9; color: #fff; border-color: #5a9fe8; }
.bsai-pp-track-btn.danger:hover { background: #d35454; color: #fff; }
.bsai-pp-track-content {
    flex: 1; background: #1a1a1a; display: flex; align-items: center;
    gap: 0; padding: 4px 4px; overflow-x: visible; position: relative; min-height: 56px;
}
.bsai-pp-track-empty { color: #444; font-size: 11px; padding: 0 12px; }
.bsai-pp-clip-block {
    border: 1px solid #3a3a3a; border-radius: 4px; height: 52px; cursor: pointer;
    overflow: hidden; position: relative; transition: border-color 0.2s, box-shadow 0.2s;
    margin: 0 1px; flex-shrink: 0; display: flex; flex-direction: column; min-width: 50px;
}
.bsai-pp-clip-block.video-clip { background: #2a3a4a; border-color: #3a5a7a; border-left: 3px solid #4a90d9; }
.bsai-pp-clip-block.audio-clip { background: #2a3a2a; border-color: #3a6a3a; border-left: 3px solid #4caf50; }
.bsai-pp-clip-block.linked { border-left-color: #ffa726; }
.bsai-pp-clip-block:hover { border-color: #6a8aaa; }
.bsai-pp-clip-block.selected { border-color: #4a90d9; box-shadow: 0 0 8px rgba(74,144,217,0.5); }
.bsai-pp-clip-block.batch-selected { border-color: #ff6b6b; box-shadow: 0 0 8px rgba(255,107,107,0.6); background: rgba(255,107,107,0.12); }
.bsai-pp-clip-block.batch-selected::after { content: "✓"; position: absolute; top: 2px; right: 4px; color: #ff6b6b; font-weight: bold; font-size: 12px; }
.bsai-pp-clip-block.disabled { opacity: 0.4; }
.bsai-pp-clip-thumb {
    flex: 1; background: #111; display: flex; align-items: center;
    justify-content: center; overflow: hidden; position: relative; min-height: 30px;
}
.bsai-pp-clip-thumb img { width: 100%; height: 100%; object-fit: cover; }
.bsai-pp-clip-thumb .placeholder { color: #555; font-size: 14px; }
.bsai-pp-clip-badge {
    position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7);
    color: #aaa; font-size: 8px; padding: 1px 4px; border-radius: 2px;
}
.bsai-pp-clip-badge.audio-replaced { color: #ffc107; }
.bsai-pp-clip-info { padding: 2px 6px; }
.bsai-pp-clip-name {
    color: #ddd; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.bsai-pp-clip-dur {
    color: #888; font-size: 8px; font-family: monospace;
}
.bsai-pp-clip-num {
    position: absolute; top: 2px; left: 2px; background: rgba(74,144,217,0.8);
    color: #fff; font-size: 8px; padding: 1px 4px; border-radius: 2px; font-weight: 600;
}
.bsai-pp-transition-arrow {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-width: 28px; height: 52px; cursor: pointer; color: #888; font-size: 8px;
    border-radius: 4px; transition: background 0.2s, color 0.2s; position: relative;
    user-select: none; gap: 2px; flex-shrink: 0;
}
.bsai-pp-transition-arrow:hover { background: #333; color: #ddd; }
.bsai-pp-transition-arrow .arrow-icon { font-size: 12px; writing-mode: horizontal-tb; }
.bsai-pp-transition-arrow .arrow-label { writing-mode: vertical-rl; text-orientation: mixed; font-size: 8px; }
.bsai-pp-add-track-row {
    display: flex; gap: 8px; padding: 6px 10px; background: #1e1e1e; border-bottom: 1px solid #2a2a2a;
}
.bsai-pp-add-track-btn {
    background: #2a2a2a; border: 1px dashed #555; color: #888; cursor: pointer;
    padding: 4px 12px; border-radius: 4px; font-size: 11px; transition: all 0.15s;
    display: flex; align-items: center; gap: 4px;
}
.bsai-pp-add-track-btn:hover { background: #333; border-color: #4a90d9; color: #4a90d9; }
.bsai-pp-link-badge {
    display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px;
    border-radius: 3px; font-size: 10px; cursor: pointer; transition: all 0.15s;
}
.bsai-pp-link-badge.linked { background: #3a3a1a; color: #ffa726; border: 1px solid #5a5a2a; }
.bsai-pp-link-badge.unlinked { background: #1a1a1a; color: #666; border: 1px solid #333; }
.bsai-pp-link-badge:hover { opacity: 0.8; }
.bsai-pp-transition-popup {
    position: fixed; z-index: 100010; background: #2a2a2a; border: 1px solid #555;
    border-radius: 8px; padding: 8px; min-width: 160px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}
.bsai-pp-transition-popup .popup-title {
    color: #888; font-size: 10px; padding: 4px 8px 8px; text-transform: uppercase;
    letter-spacing: 1px; border-bottom: 1px solid #3a3a3a; margin-bottom: 4px;
}
.bsai-pp-transition-option {
    display: flex; align-items: center; gap: 10px; padding: 8px 12px;
    border-radius: 4px; cursor: pointer; color: #ccc; font-size: 12px;
    white-space: nowrap; transition: background 0.15s;
}
.bsai-pp-transition-option:hover { background: #3a3a3a; }
.bsai-pp-transition-option.selected { background: #4a90d9; color: #fff; }
.bsai-pp-transition-option .opt-icon { font-size: 16px; width: 20px; text-align: center; }
.bsai-pp-transition-option .opt-desc { color: #666; font-size: 10px; margin-left: auto; }
.bsai-pp-empty-timeline {
    color: #555; font-size: 13px; padding: 40px; text-align: center;
    width: 100%;
}
.bsai-pp-edit-section {
    height: 260px; flex-shrink: 0; overflow-y: auto;
    background: #222; display: flex; flex-direction: column;
}
.bsai-pp-edit-content { padding: 12px 16px; }
.bsai-pp-edit-row {
    display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;
}
.bsai-pp-edit-row label {
    color: #aaa; font-size: 12px; min-width: 100px; text-align: right;
}
.bsai-pp-edit-row input[type="number"] {
    background: #1a1a1a; border: 1px solid #444; color: #e0e0e0;
    padding: 3px 6px; border-radius: 3px; font-size: 12px; width: 70px;
}
.bsai-pp-edit-row input[type="text"] {
    background: #1a1a1a; border: 1px solid #444; color: #e0e0e0;
    padding: 3px 6px; border-radius: 3px; font-size: 12px; flex: 1; min-width: 120px;
}
.bsai-pp-edit-row select {
    background: #1a1a1a; border: 1px solid #444; color: #e0e0e0;
    padding: 3px 6px; border-radius: 3px; font-size: 12px;
}
.bsai-pp-edit-row input[type="range"] { width: 200px; cursor: pointer; }
.bsai-pp-edit-row input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
.bsai-pp-clip-actions { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.bsai-pp-no-selection {
    color: #555; font-size: 13px; padding: 30px; text-align: center;
}
.bsai-pp-preview-section {
    padding: 10px 16px; background: #1e1e1e; border-top: 1px solid #3a3a3a;
    flex-shrink: 0; display: none;
}
.bsai-pp-preview-section.visible { display: block; }
.bsai-pp-preview-section video { max-width: 100%; max-height: 200px; border-radius: 4px; }
.bsai-pp-footer {
    padding: 10px 16px; background: #252525; border-top: 1px solid #3a3a3a;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
}
.bsai-pp-footer-info { color: #888; font-size: 12px; }
.bsai-pp-batch-bar {
    padding: 8px 16px; background: #2a1a1a; border-top: 1px solid #5a3a3a;
    display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}
.bsai-pp-batch-info { color: #ccc; font-size: 13px; margin-right: auto; }
.bsai-pp-batch-info strong { color: #ff6b6b; }
.bsai-pp-toast {
    position: fixed; bottom: 30px; right: 30px; padding: 12px 20px;
    border-radius: 6px; color: #fff; font-size: 13px; z-index: 100001;
    opacity: 0; transition: opacity 0.3s; pointer-events: none;
}
.bsai-pp-toast.show { opacity: 1; }
.bsai-pp-toast.error { background: #d35454; }
.bsai-pp-toast.success { background: #4caf50; }
.bsai-pp-toast.info { background: #4a90d9; }
.bsai-pp-progress {
    position: fixed; bottom: 30px; right: 30px;
    background: #2a2a2a; border: 1px solid #444; border-radius: 6px;
    padding: 16px 24px; z-index: 100001; display: none;
}
.bsai-pp-progress.visible { display: block; }
.bsai-pp-progress-text { color: #e0e0e0; font-size: 13px; margin-bottom: 8px; }
.bsai-pp-progress-bar {
    width: 250px; height: 6px; background: #1a1a1a; border-radius: 3px; overflow: hidden;
}
.bsai-pp-progress-fill {
    height: 100%; background: #4a90d9; width: 0%; transition: width 0.3s;
}
.bsai-pp-import-dialog {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
    background: #2a2a2a; border: 1px solid #444; border-radius: 8px;
    padding: 20px; z-index: 100002; min-width: 400px; max-width: 600px;
    max-height: 70vh; overflow-y: auto;
}
.bsai-pp-import-dialog h3 { color: #e0e0e0; margin: 0 0 12px 0; font-size: 14px; }
.bsai-pp-import-list {
    max-height: 300px; overflow-y: auto; margin: 10px 0;
}
.bsai-pp-import-item {
    display: flex; align-items: center; gap: 8px; padding: 6px 10px;
    border-radius: 4px; cursor: pointer; color: #ccc; font-size: 12px;
}
.bsai-pp-import-item:hover { background: #3a3a3a; }
.bsai-pp-import-item .size { color: #666; margin-left: auto; font-size: 10px; }
.bsai-pp-dialog-overlay {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.5); z-index: 100001;
}
`;

// ── Standalone directory browser (usable from node button) ──────────
function browseDirectoryDialog(initialPath) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "bsai-pp-dialog-overlay";
        const dialog = document.createElement("div");
        dialog.className = "bsai-pp-import-dialog";
        dialog.style.minWidth = "500px";
        dialog.innerHTML = `
            <h3>📁 选择监视目录</h3>
            <div style="display:flex;gap:6px;margin-bottom:8px;">
                <button class="bsai-pp-btn" data-act="up">⬆ 上级</button>
                <input type="text" data-manual-path style="flex:1;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;padding:4px 8px;border-radius:4px;font-size:12px;" placeholder="手动输入路径后回车...">
                <button class="bsai-pp-btn" data-act="go">前往</button>
            </div>
            <div style="margin-bottom:8px;padding:4px 8px;background:#1a1a1a;border-radius:4px;font-size:11px;color:#888;" data-path-display>当前: </div>
            <div class="bsai-pp-import-list" data-dir-list style="max-height:300px;"></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button class="bsai-pp-btn" data-cancel>取消</button>
                <button class="bsai-pp-btn bsai-pp-btn-primary" data-select>选择此目录</button>
            </div>`;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        let currentPath = "";
        let loadingAbort = null;

        const loadDirs = async (path) => {
            if (loadingAbort) { try { loadingAbort.abort(); } catch {} }
            loadingAbort = new AbortController();
            const listEl = dialog.querySelector("[data-dir-list]");
            const pathDisplay = dialog.querySelector("[data-path-display]");
            listEl.innerHTML = `<div style="color:#666;padding:10px;">⏳ 加载中...</div>`;
            const timeoutId = setTimeout(() => loadingAbort.abort(), 12000);
            try {
                const resp = await api.fetchApi(`/bsai_premiere_pro/browse?path=${encodeURIComponent(path)}`, {
                    signal: loadingAbort.signal
                });
                clearTimeout(timeoutId);
                const data = await resp.json();
                if (data.error) {
                    listEl.innerHTML = `<div style="color:#d35454;padding:10px;">❌ ${escapeHtml(data.error)}<br><button class="bsai-pp-btn" style="margin-top:6px;" data-retry>重试</button></div>`;
                    listEl.querySelector("[data-retry]")?.addEventListener("click", () => loadDirs(path));
                    return;
                }
                currentPath = data.path;
                pathDisplay.textContent = `当前: ${currentPath}`;
                const manualInput = dialog.querySelector("[data-manual-path]");
                if (manualInput && !manualInput.value) manualInput.value = currentPath;
                listEl.innerHTML = "";
                if (data.dirs.length === 0) {
                    listEl.innerHTML = `<div style="color:#666;padding:10px;">📂 没有子目录</div>`;
                }
                for (const dir of data.dirs) {
                    const item = document.createElement("div");
                    item.className = "bsai-pp-import-item";
                    item.innerHTML = `<span>📁</span><span>${escapeHtml(dir)}</span>`;
                    item.onclick = () => loadDirs(data.path + (data.path.endsWith("\\") || data.path.endsWith("/") ? "" : "\\") + dir);
                    listEl.appendChild(item);
                }
            } catch (e) {
                clearTimeout(timeoutId);
                if (e.name === "AbortError") {
                    listEl.innerHTML = `<div style="color:#d35454;padding:10px;">⏱ 加载超时，请尝试手动输入路径<br><button class="bsai-pp-btn" style="margin-top:6px;" data-retry>重试</button></div>`;
                } else {
                    listEl.innerHTML = `<div style="color:#d35454;padding:10px;">❌ 加载失败: ${escapeHtml(e.message)}<br><button class="bsai-pp-btn" style="margin-top:6px;" data-retry>重试</button></div>`;
                }
                listEl.querySelector("[data-retry]")?.addEventListener("click", () => loadDirs(path));
            }
        };

        loadDirs(initialPath || "");

        dialog.querySelector("[data-act='up']").onclick = async () => {
            try {
                const resp = await api.fetchApi(`/bsai_premiere_pro/browse?path=${encodeURIComponent(currentPath)}`);
                const data = await resp.json();
                if (data.parent !== undefined) loadDirs(data.parent);
            } catch (e) {
                loadDirs(currentPath);
            }
        };

        const manualInput = dialog.querySelector("[data-manual-path]");
        const goToPath = () => {
            const val = manualInput.value.trim();
            if (val) loadDirs(val);
        };
        dialog.querySelector("[data-act='go']").onclick = goToPath;
        manualInput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); goToPath(); } };

        dialog.querySelector("[data-cancel]").onclick = () => {
            if (loadingAbort) { try { loadingAbort.abort(); } catch {} }
            overlay.remove();
            resolve(null);
        };
        dialog.querySelector("[data-select]").onclick = () => {
            if (loadingAbort) { try { loadingAbort.abort(); } catch {} }
            const manualVal = manualInput.value.trim();
            overlay.remove();
            resolve(manualVal || currentPath);
        };
    });
}

// ── AutoImporter ─────────────────────────────────────────────────────
class AutoImporter {
    constructor(node) {
        this.node = node;
        this.timer = null;
        this._stopped = false;
    }

    start() {
        if (this.timer) return;
        this._stopped = false;
        setTimeout(() => this.poll(), 2000);
        this.timer = setInterval(() => this.poll(), POLL_INTERVAL);
    }

    stop() {
        this._stopped = true;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }

    getWidget(name) {
        return this.node.widgets?.find(w => w.name === name);
    }

    async poll() {
        if (this._stopped) return;
        const autoWidget = this.getWidget("auto_import");
        if (!autoWidget?.value) return;
        const dirWidget = this.getWidget("watch_directory");
        const directory = dirWidget?.value || "output";
        try {
            const resp = await api.fetchApi(`/bsai_premiere_pro/scan?directory=${encodeURIComponent(directory)}`);
            const data = await resp.json();
            if (data.files && data.files.length > 0) {
                await this.addNewFiles(data.files);
            }
        } catch (e) {
            // Silent fail for polling
        }
    }

    async addNewFiles(files) {
        const tdWidget = this.getWidget("timeline_data");
        if (!tdWidget) return;
        let td;
        try { td = JSON.parse(tdWidget.value); } catch { td = { clips: [], known_files: [], filter_audio_only: true }; }
        if (!td.clips) td.clips = [];
        if (!td.known_files) td.known_files = [];
        if (td.filter_audio_only === undefined) td.filter_audio_only = true;
        if (!td.video_tracks) td.video_tracks = [{ name: "V1", locked: false, visible: true }];
        if (!td.audio_tracks) td.audio_tracks = [{ name: "A1", locked: false, muted: false, solo: false }];
        if (td.clips.length > 0 && !td.clips[0].track_type) {
            const editor = importerMap.get(this.node.id)?._editor;
            if (editor) td.clips = editor._migrateClips(td.clips);
        }
        const known = new Set(td.known_files);
        const newFiles = files.filter(f => !known.has(f.file_name));
        if (newFiles.length === 0) return;
        let skipped = 0;
        for (const file of newFiles) {
            try {
                const metaResp = await api.fetchApi(`/bsai_premiere_pro/metadata?file=${encodeURIComponent(file.file_path)}`);
                const meta = await metaResp.json();
                if (meta.error) { console.warn("[BSAI PP]", meta.error); continue; }
                if (td.filter_audio_only && !meta.has_audio) {
                    td.known_files.push(file.file_name);
                    skipped++;
                    continue;
                }
                const vId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                const aId = `clip_${Date.now() + 1}_${Math.random().toString(36).substr(2, 6)}`;
                const base = {
                    file_path: file.file_path, file_name: file.file_name,
                    created_time: file.created_time, duration: meta.duration || 0,
                    width: meta.width || 1920, height: meta.height || 1080, fps: meta.fps || 30,
                    has_audio: meta.has_audio || false,
                    trim_start: 0, trim_end: meta.duration || 0,
                    transition_in: "fade", transition_out: "fade", transition_duration: 0.5,
                    audio_replacement: null, audio_fade_in: 0, audio_fade_out: 0,
                    video_enabled: true, audio_enabled: true,
                };
                td.clips.push({ ...base, id: vId, track_type: "video", track_index: 0, linked_id: aId, is_video_part: true });
                td.clips.push({ ...base, id: aId, track_type: "audio", track_index: 0, linked_id: vId, is_video_part: false });
                td.known_files.push(file.file_name);
            } catch (e) {
                console.error("[BSAI PP] Failed to add file:", file.file_name, e);
            }
        }
        tdWidget.value = JSON.stringify(td);
        this.updateNodeTitle(td);
        if (this._editor) this._editor.refresh();
    }

    setEditor(editor) { this._editor = editor; }

    updateNodeTitle(td) {
        const vClips = td.clips.filter(c => c.track_type === "video" || !c.track_type);
        const count = vClips.length;
        const total = vClips.reduce((s, c) => s + (c.trim_end - c.trim_start), 0);
        if (count > 0) {
            this.node.title = `🎬 BSAI Premiere Pro (${count} clips / ${formatTime(total)})`;
        } else {
            this.node.title = `🎬 BSAI Premiere Pro`;
        }
        this.node.setDirtyCanvas(true, true);
    }
}

const importerMap = new Map();

// ── TimelineEditor ──────────────────────────────────────────────────
class TimelineEditor {
    constructor(node) {
        this.node = node;
        this.modal = null;
        this.selectedIndex = -1;
        this.batchMode = false;
        this.batchSelected = new Set();
        this.thumbCache = new Map();
        this.td = this._load();
    }

    _load() {
        const w = this.node.widgets?.find(w => w.name === "timeline_data");
        if (w?.value) {
            try {
                const td = JSON.parse(w.value);
                if (!td.clips) td.clips = [];
                if (!td.known_files) td.known_files = [];
                if (td.filter_audio_only === undefined) td.filter_audio_only = true;
                if (!td.video_tracks) td.video_tracks = [{ name: "V1", locked: false, visible: true }];
                if (!td.audio_tracks) td.audio_tracks = [{ name: "A1", locked: false, muted: false, solo: false }];
                if (td.clips.length > 0 && !td.clips[0].track_type) {
                    td.clips = this._migrateClips(td.clips);
                }
                return td;
            } catch { /* fall through */ }
        }
        return {
            clips: [], known_files: [],
            video_tracks: [{ name: "V1", locked: false, visible: true }],
            audio_tracks: [{ name: "A1", locked: false, muted: false, solo: false }],
        };
    }

    _migrateClips(oldClips) {
        const newClips = [];
        for (const old of oldClips) {
            const vId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const aId = `clip_${Date.now() + 1}_${Math.random().toString(36).substr(2, 6)}`;
            const base = {
                file_path: old.file_path, file_name: old.file_name,
                created_time: old.created_time, duration: old.duration || 0,
                width: old.width || 1920, height: old.height || 1080, fps: old.fps || 30,
                has_audio: old.has_audio !== false,
                trim_start: old.trim_start || 0, trim_end: old.trim_end || old.duration || 0,
                transition_in: old.transition_in || "fade", transition_out: old.transition_out || "fade",
                transition_duration: old.transition_duration ?? 0.5,
                audio_replacement: old.audio_replacement || null,
                audio_fade_in: old.audio_fade_in || 0, audio_fade_out: old.audio_fade_out || 0,
                video_enabled: old.video_enabled !== false, audio_enabled: old.audio_enabled !== false,
            };
            newClips.push({ ...base, id: vId, track_type: "video", track_index: 0, linked_id: aId, is_video_part: true });
            newClips.push({ ...base, id: aId, track_type: "audio", track_index: 0, linked_id: vId, is_video_part: false });
        }
        return newClips;
    }

    _getClipsForTrack(trackType, trackIndex) {
        return (this.td.clips || []).filter(c => c.track_type === trackType && c.track_index === trackIndex);
    }

    _save() {
        const w = this.node.widgets?.find(w => w.name === "timeline_data");
        if (w) w.value = JSON.stringify(this.td);
        const importer = importerMap.get(this.node.id);
        if (importer) importer.updateNodeTitle(this.td);
    }

    _getWidget(name) {
        return this.node.widgets?.find(w => w.name === name);
    }
    _getWidgetValue(name, fallback) {
        const w = this._getWidget(name);
        return w ? w.value : fallback;
    }

    open() {
        if (this.modal) return;
        this._injectStyles();
        this._createModal();
        document.body.appendChild(this.modal);
        this._renderAll();
        const importer = importerMap.get(this.node.id);
        if (importer) importer.setEditor(this);
    }

    close() {
        this.batchMode = false;
        this.batchSelected.clear();
        this._save();
        const importer = importerMap.get(this.node.id);
        if (importer) importer.setEditor(null);
        if (this.modal) { this.modal.remove(); this.modal = null; }
    }

    refresh() {
        if (!this.modal) return;
        this.td = this._load();
        this._renderAll();
    }

    _injectStyles() {
        if (document.getElementById("bsai-pp-styles")) return;
        const el = document.createElement("style");
        el.id = "bsai-pp-styles";
        el.textContent = STYLES;
        document.head.appendChild(el);
    }

    _createModal() {
        this.modal = document.createElement("div");
        this.modal.className = "bsai-pp-overlay";
        this.modal.innerHTML = `
            <div class="bsai-pp-modal">
                <div class="bsai-pp-header">
                    <span class="bsai-pp-title">🎬 BSAI Premiere Pro - 时间轴编辑器</span>
                    <button class="bsai-pp-close" data-act="close">✕</button>
                </div>
                <div class="bsai-pp-toolbar">
                    <label>自动导入</label>
                    <input type="checkbox" data-act="auto-import" ${this._getWidgetValue("auto_import", true) ? "checked" : ""}>
                    <label>监视目录</label>
                    <input type="text" data-act="dir" value="${escapeHtml(this._getWidgetValue("watch_directory", "output"))}" style="width:120px;">
                    <button class="bsai-pp-btn" data-act="browse-dir">📁 浏览</button>
                    <label>仅带音频</label>
                    <input type="checkbox" data-act="filter-audio" ${this.td.filter_audio_only !== false ? "checked" : ""}>
                    <button class="bsai-pp-btn" data-act="scan">🔍 扫描</button>
                    <button class="bsai-pp-btn" data-act="manual-import">📥 手动导入</button>
                    <button class="bsai-pp-btn" data-act="add-vtrack">＋ 视频轨道</button>
                    <button class="bsai-pp-btn" data-act="add-atrack">＋ 音频轨道</button>
                    <button class="bsai-pp-btn bsai-pp-btn-danger" data-act="clear-all">🗑 清空全部</button>
                    <button class="bsai-pp-btn" data-act="batch-select" id="bsai-pp-batch-btn">☑ 批量选择</button>
                    <div class="bsai-pp-status">
                        <span><span class="dot ${this._getWidgetValue("auto_import", true) ? "on" : "off"}" data-dot></span> ${this._getWidgetValue("auto_import", true) ? "监控中" : "已停止"}</span>
                    </div>
                </div>
                <div class="bsai-pp-body">
                    <div class="bsai-pp-timeline-section">
                        <div class="bsai-pp-timeline-scroll">
                            <div class="bsai-pp-timeline-container" data-track-container></div>
                        </div>
                    </div>
                    <div class="bsai-pp-edit-section">
                        <div class="bsai-pp-section-label">剪辑面板</div>
                        <div class="bsai-pp-edit-content" data-edit></div>
                    </div>
                    <div class="bsai-pp-preview-section" data-preview>
                        <div class="bsai-pp-section-label">预览</div>
                        <video controls data-preview-video></video>
                    </div>
                </div>
                <div class="bsai-pp-footer">
                    <div class="bsai-pp-footer-info" data-footer-info></div>
                    <button class="bsai-pp-btn bsai-pp-btn-primary" data-act="render">🎞️ 渲染输出</button>
                </div>
            </div>`;
        this.modal.addEventListener("click", (e) => this._onClick(e));
        this.modal.querySelector('[data-act="close"]').onclick = () => this.close();
        this.modal.querySelector('[data-act="auto-import"]').onchange = (e) => {
            const w = this._getWidget("auto_import");
            if (w) w.value = e.target.checked;
            const dot = this.modal.querySelector("[data-dot]");
            if (dot) { dot.className = `dot ${e.target.checked ? "on" : "off"}`; }
            dot.parentElement.innerHTML = `<span class="dot ${e.target.checked ? "on" : "off"}" data-dot></span> ${e.target.checked ? "监控中" : "已停止"}`;
        };
        this.modal.querySelector('[data-act="dir"]').onchange = (e) => {
            const w = this._getWidget("watch_directory");
            if (w) w.value = e.target.value;
        };
        this.modal.querySelector('[data-act="filter-audio"]').onchange = (e) => {
            this.td.filter_audio_only = e.target.checked;
            this._save();
        };
        this.modal.querySelector('[data-act="scan"]').onclick = () => this._scanNow();
        this.modal.querySelector('[data-act="manual-import"]').onclick = () => this._manualImport();
        this.modal.querySelector('[data-act="browse-dir"]').onclick = () => this._browseDirectory();
        this.modal.querySelector('[data-act="add-vtrack"]').onclick = () => this._addVideoTrack();
        this.modal.querySelector('[data-act="add-atrack"]').onclick = () => this._addAudioTrack();
        this.modal.querySelector('[data-act="clear-all"]').onclick = () => this._clearAllClips();
        this.modal.querySelector('[data-act="batch-select"]').onclick = () => this._toggleBatchMode();
        this.modal.querySelector('[data-act="render"]').onclick = () => this._renderVideo();
        this.modal.addEventListener("keydown", (e) => { if (e.key === "Escape") this.close(); });
    }

    _renderAll() {
        this._renderTimeline();
        this._renderEditPanel();
        this._renderFooter();
        this._loadThumbnails();
    }

    _renderTimeline() {
        const container = this.modal.querySelector("[data-track-container]");
        if (!container) return;
        container.innerHTML = "";
        const clips = this.td.clips || [];
        const videoTracks = this.td.video_tracks || [{ name: "V1", locked: false, visible: true }];
        const audioTracks = this.td.audio_tracks || [{ name: "A1", locked: false, muted: false, solo: false }];

        let maxDuration = 0;
        for (let i = 0; i < videoTracks.length; i++) {
            const dur = this._getClipsForTrack("video", i).reduce((s, c) => s + (c.trim_end - c.trim_start), 0);
            maxDuration = Math.max(maxDuration, dur);
        }
        for (let i = 0; i < audioTracks.length; i++) {
            const dur = this._getClipsForTrack("audio", i).reduce((s, c) => s + (c.trim_end - c.trim_start), 0);
            maxDuration = Math.max(maxDuration, dur);
        }

        const scrollEl = container.parentElement;
        const containerWidth = scrollEl?.clientWidth || 1000;
        const availableWidth = containerWidth - 150 - 20;
        const totalDuration = Math.max(maxDuration, 10);
        this._pps = Math.max(6, Math.min(30, availableWidth / totalDuration));
        this._totalDuration = totalDuration;

        const ruler = document.createElement("div");
        ruler.className = "bsai-pp-time-ruler";
        const rulerWidth = Math.round((maxDuration + 10) * (this._pps || 15));
        ruler.innerHTML = `<div class="bsai-pp-ruler-spacer"></div><div class="bsai-pp-ruler-marks" style="min-width:${rulerWidth}px">${this._renderRulerMarks(maxDuration)}</div>`;
        container.appendChild(ruler);

        const vLabel = document.createElement("div");
        vLabel.className = "bsai-pp-track-section-label";
        vLabel.innerHTML = `<span>📹 视频轨道</span>`;
        container.appendChild(vLabel);
        for (let i = videoTracks.length - 1; i >= 0; i--) {
            container.appendChild(this._createTrackRow("video", i, videoTracks[i]));
        }

        const aLabel = document.createElement("div");
        aLabel.className = "bsai-pp-track-section-label";
        aLabel.innerHTML = `<span>🎵 音频轨道</span>`;
        container.appendChild(aLabel);
        for (let i = 0; i < audioTracks.length; i++) {
            container.appendChild(this._createTrackRow("audio", i, audioTracks[i]));
        }

        if (clips.length === 0) {
            const empty = document.createElement("div");
            empty.style.cssText = "color:#555;font-size:13px;padding:40px;text-align:center;";
            empty.textContent = "暂无视频片段，请运行工作流生成视频或手动导入";
            container.appendChild(empty);
        }
    }

    _renderRulerMarks(totalDuration) {
        if (totalDuration <= 0) totalDuration = 30;
        const interval = totalDuration > 120 ? 30 : totalDuration > 60 ? 15 : totalDuration > 30 ? 10 : 5;
        const pps = this._pps || 15;
        const span = totalDuration + interval;
        let html = "";
        for (let t = 0; t <= span; t += interval) {
            const left = t * pps;
            html += `<span class="bsai-pp-ruler-mark" style="left:${left}px">${formatTime(t)}</span>`;
        }
        return html;
    }

    _createTrackRow(trackType, trackIndex, trackInfo) {
        const row = document.createElement("div");
        row.className = "bsai-pp-track-row";
        const isVideo = trackType === "video";
        const trackName = trackInfo.name || (isVideo ? `V${trackIndex + 1}` : `A${trackIndex + 1}`);

        const header = document.createElement("div");
        header.className = "bsai-pp-track-header";
        let controls;
        if (isVideo) {
            controls = `
                <div class="bsai-pp-track-controls">
                    <button class="bsai-pp-track-btn ${trackInfo.visible !== false ? "active" : ""}" data-track-act="visible" title="显示/隐藏">👁</button>
                    <button class="bsai-pp-track-btn ${trackInfo.locked ? "active" : ""}" data-track-act="lock" title="锁定">${trackInfo.locked ? "🔒" : "🔓"}</button>
                    <button class="bsai-pp-track-btn danger" data-track-act="remove" title="删除轨道">✕</button>
                </div>`;
        } else {
            controls = `
                <div class="bsai-pp-track-controls">
                    <button class="bsai-pp-track-btn ${trackInfo.muted ? "active" : ""}" data-track-act="mute" title="静音">🔇</button>
                    <button class="bsai-pp-track-btn ${trackInfo.solo ? "active" : ""}" data-track-act="solo" title="独奏">🎧</button>
                    <button class="bsai-pp-track-btn ${trackInfo.locked ? "active" : ""}" data-track-act="lock" title="锁定">${trackInfo.locked ? "🔒" : "🔓"}</button>
                    <button class="bsai-pp-track-btn danger" data-track-act="remove" title="删除轨道">✕</button>
                </div>`;
        }
        header.innerHTML = `<div class="bsai-pp-track-header-row"><span class="bsai-pp-track-name ${isVideo ? "video" : "audio"}">${trackName}</span></div>${controls}`;
        header.querySelectorAll("[data-track-act]").forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); this._handleTrackAction(trackType, trackIndex, btn.getAttribute("data-track-act")); };
        });
        row.appendChild(header);

        const content = document.createElement("div");
        content.className = "bsai-pp-track-content";
        const rulerWidth = Math.round(((this._totalDuration || 30) + 10) * (this._pps || 15));
        content.style.minWidth = rulerWidth + "px";
        const trackClips = this._getClipsForTrack(trackType, trackIndex);
        if (trackClips.length === 0) {
            content.innerHTML = `<span class="bsai-pp-track-empty">空轨道</span>`;
        } else {
            trackClips.forEach((clip, i) => {
                if (i > 0) {
                    const arrow = document.createElement("div");
                    arrow.className = "bsai-pp-transition-arrow";
                    const transIn = clip.transition_in || "fade";
                    const icon = isVideo ? (TRANSITION_ICONS[transIn] || "🌫️") : "🎵";
                    const label = isVideo ? (TRANSITION_LABELS[transIn] || "淡入淡出") : "音频过渡";
                    arrow.innerHTML = `<span class="arrow-icon">${icon}</span><span class="arrow-label">${label}</span>`;
                    arrow.title = isVideo
                        ? `点击切换过渡效果 (当前: ${TRANSITION_LABELS[transIn] || "淡入淡出"})`
                        : `音频过渡 (当前: ${TRANSITION_LABELS[transIn] || "淡入淡出"})`;
                    const clipIdx = this.td.clips.indexOf(clip);
                    arrow.onclick = (e) => { e.stopPropagation(); this._showTransitionPopup(arrow, clipIdx); };
                    content.appendChild(arrow);
                }
                const clipIdx = this.td.clips.indexOf(clip);
                content.appendChild(this._createClipBlock(clip, clipIdx));
            });
        }
        row.appendChild(content);
        return row;
    }

    _handleTrackAction(trackType, trackIndex, action) {
        const tracks = trackType === "video" ? this.td.video_tracks : this.td.audio_tracks;
        const track = tracks[trackIndex];
        if (!track) return;
        if (action === "lock") {
            track.locked = !track.locked;
        } else if (action === "visible" && trackType === "video") {
            track.visible = track.visible === false;
        } else if (action === "mute" && trackType === "audio") {
            track.muted = !track.muted;
        } else if (action === "solo" && trackType === "audio") {
            track.solo = !track.solo;
        } else if (action === "remove") {
            if (track.locked) { this._toast("轨道已锁定，请先解锁再删除", "error"); return; }
            if (tracks.length <= 1) { this._toast("至少保留一个轨道", "info"); return; }
            const trackClips = this._getClipsForTrack(trackType, trackIndex);
            if (trackClips.length > 0) {
                for (const clip of trackClips) {
                    if (clip.linked_id) {
                        const linked = this.td.clips.find(c => c.id === clip.linked_id);
                        if (linked) linked.linked_id = null;
                    }
                    const idx = this.td.clips.indexOf(clip);
                    if (idx >= 0) this.td.clips.splice(idx, 1);
                }
            }
            for (const c of this.td.clips) {
                if (c.track_type === trackType && c.track_index > trackIndex) c.track_index--;
            }
            tracks.splice(trackIndex, 1);
            this._toast(`已删除轨道 ${track.name} (${trackClips.length}个片段)`, "success");
        }
        this._save();
        this._renderTimeline();
    }

    _addVideoTrack() {
        if (!this.td.video_tracks) this.td.video_tracks = [{ name: "V1", locked: false, visible: true }];
        const idx = this.td.video_tracks.length;
        this.td.video_tracks.push({ name: `V${idx + 1}`, locked: false, visible: true });
        this._save();
        this._renderTimeline();
        this._toast(`已添加视频轨道 V${idx + 1}`, "success");
    }

    _addAudioTrack() {
        if (!this.td.audio_tracks) this.td.audio_tracks = [{ name: "A1", locked: false, muted: false, solo: false }];
        const idx = this.td.audio_tracks.length;
        this.td.audio_tracks.push({ name: `A${idx + 1}`, locked: false, muted: false, solo: false });
        this._save();
        this._renderTimeline();
        this._toast(`已添加音频轨道 A${idx + 1}`, "success");
    }

    async _browseDirectory() {
        const selected = await browseDirectoryDialog(this._getWidgetValue("watch_directory", ""));
        if (selected) {
            const dirInput = this.modal.querySelector('[data-act="dir"]');
            if (dirInput) dirInput.value = selected;
            const w = this._getWidget("watch_directory");
            if (w) w.value = selected;
            this._toast(`已选择目录: ${selected}`, "success");
        }
    }

    _toggleBatchMode() {
        this.batchMode = !this.batchMode;
        if (!this.batchMode) {
            this.batchSelected.clear();
            this._removeBatchBar();
        }
        const btn = this.modal.querySelector("#bsai-pp-batch-btn");
        if (btn) {
            btn.textContent = this.batchMode ? "✕ 退出批量" : "☑ 批量选择";
            btn.classList.toggle("bsai-pp-btn-danger", this.batchMode);
        }
        this._renderTimeline();
        if (this.batchMode) this._renderBatchBar();
    }

    _renderBatchBar() {
        if (!this.batchMode) return;
        let bar = this.modal.querySelector("#bsai-pp-batch-bar");
        if (!bar) {
            bar = document.createElement("div");
            bar.id = "bsai-pp-batch-bar";
            bar.className = "bsai-pp-batch-bar";
            this.modal.querySelector(".bsai-pp-modal").insertBefore(
                bar, this.modal.querySelector(".bsai-pp-footer")
            );
        }
        const count = this.batchSelected.size;
        const total = (this.td.clips || []).length;
        bar.innerHTML = `
            <span class="bsai-pp-batch-info">已选 <strong>${count}</strong> / ${total} 个片段</span>
            <button class="bsai-pp-btn" data-batch-act="select-all">${count === total ? "取消全选" : "全选"}</button>
            <button class="bsai-pp-btn bsai-pp-btn-danger" data-batch-act="delete" ${count === 0 ? "disabled" : ""}>🗑 删除选中 (${count})</button>
            <button class="bsai-pp-btn" data-batch-act="exit">退出批量</button>`;
        bar.querySelector('[data-batch-act="select-all"]').onclick = () => {
            if (this.batchSelected.size === total) {
                this.batchSelected.clear();
            } else {
                for (let i = 0; i < total; i++) this.batchSelected.add(i);
            }
            this._renderTimeline();
            this._renderBatchBar();
        };
        bar.querySelector('[data-batch-act="delete"]').onclick = () => this._deleteBatchClips();
        bar.querySelector('[data-batch-act="exit"]').onclick = () => this._toggleBatchMode();
    }

    _removeBatchBar() {
        const bar = this.modal.querySelector("#bsai-pp-batch-bar");
        if (bar) bar.remove();
    }

    _deleteBatchClips() {
        if (this.batchSelected.size === 0) { this._toast("未选中任何片段", "info"); return; }
        const indices = [...this.batchSelected].sort((a, b) => b - a);
        const overlay = document.createElement("div");
        overlay.className = "bsai-pp-dialog-overlay";
        const dialog = document.createElement("div");
        dialog.className = "bsai-pp-import-dialog";
        dialog.style.minWidth = "380px";
        const sampleNames = indices.slice(0, 5).map(i => this.td.clips[i]?.file_name || "").filter(Boolean);
        dialog.innerHTML = `
            <h3>🗑 批量删除确认</h3>
            <div style="color:#ccc;font-size:13px;padding:10px 0;">
                确认删除选中的 <strong style="color:#ff6b6b;">${indices.length}</strong> 个片段？<br>
                ${sampleNames.length > 0 ? `<div style="margin-top:8px;color:#888;font-size:12px;">${sampleNames.map(n => `• ${escapeHtml(n)}`).join("<br>")}${indices.length > 5 ? `<br>...等 ${indices.length} 个` : ""}</div>` : ""}
                <div style="margin-top:8px;color:#ff9800;font-size:12px;">关联的音视频片段将一并删除</div>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button class="bsai-pp-btn" data-cancel>取消</button>
                <button class="bsai-pp-btn bsai-pp-btn-danger" data-confirm>确认删除</button>
            </div>`;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        dialog.querySelector("[data-cancel]").onclick = () => overlay.remove();
        dialog.querySelector("[data-confirm]").onclick = () => {
            const clipIdsToDelete = new Set();
            for (const idx of indices) {
                const clip = this.td.clips[idx];
                if (!clip) continue;
                clipIdsToDelete.add(clip.id);
                if (clip.linked_id) clipIdsToDelete.add(clip.linked_id);
            }
            const fileNamesToDelete = new Set();
            for (const idx of indices) {
                const clip = this.td.clips[idx];
                if (clip) fileNamesToDelete.add(clip.file_name);
            }
            this.td.clips = this.td.clips.filter(c => !clipIdsToDelete.has(c.id));
            this.td.known_files = (this.td.known_files || []).filter(f => !fileNamesToDelete.has(f));
            this.batchSelected.clear();
            this.selectedIndex = -1;
            this._save();
            this._renderAll();
            this._renderBatchBar();
            overlay.remove();
            this._toast(`已删除 ${clipIdsToDelete.size} 个片段`, "success");
        };
    }

    _clearAllClips() {
        const clips = this.td.clips || [];
        if (clips.length === 0) { this._toast("时间轴上没有片段", "info"); return; }
        const vCount = clips.filter(c => c.track_type === "video").length;
        const aCount = clips.filter(c => c.track_type === "audio").length;
        const overlay = document.createElement("div");
        overlay.className = "bsai-pp-dialog-overlay";
        const dialog = document.createElement("div");
        dialog.className = "bsai-pp-import-dialog";
        dialog.style.minWidth = "380px";
        dialog.innerHTML = `
            <h3>🗑 清空全部片段</h3>
            <div style="color:#ccc;font-size:13px;padding:10px 0;">
                将删除所有轨道上的全部片段：<br>
                📹 ${vCount} 个视频片段<br>
                🎵 ${aCount} 个音频片段<br>
                <span style="color:#d35454;">此操作不可撤销</span>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button class="bsai-pp-btn" data-cancel>取消</button>
                <button class="bsai-pp-btn bsai-pp-btn-danger" data-confirm>确认清空</button>
            </div>`;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        dialog.querySelector("[data-cancel]").onclick = () => overlay.remove();
        dialog.querySelector("[data-confirm]").onclick = () => {
            this.td.clips = [];
            this.td.known_files = [];
            this.selectedIndex = -1;
            this._save();
            this._renderAll();
            overlay.remove();
            this._toast("已清空全部片段", "success");
        };
    }

    _createClipBlock(clip, clipIndex) {
        const block = document.createElement("div");
        block.className = "bsai-pp-clip-block";
        const isVideo = clip.track_type === "video";
        block.classList.add(isVideo ? "video-clip" : "audio-clip");
        if (clip.linked_id) block.classList.add("linked");
        if (clipIndex === this.selectedIndex) block.classList.add("selected");
        if (this.batchMode && this.batchSelected.has(clipIndex)) block.classList.add("batch-selected");
        if (!clip.video_enabled && !clip.audio_enabled) block.classList.add("disabled");
        const clipDur = (clip.trim_end || clip.duration || 0) - (clip.trim_start || 0);
        const pps = this._pps || 15;
        const width = Math.max(60, Math.round(clipDur * pps));
        block.style.width = width + "px";
        let badges = "";
        if (clip.linked_id) {
            const linked = this.td.clips.find(c => c.id === clip.linked_id);
            if (linked) {
                const lDur = (linked.trim_end || linked.duration || 0) - (linked.trim_start || 0);
                if (Math.abs(lDur - clipDur) > 0.01) {
                    badges += `<span class="bsai-pp-clip-badge" style="color:#ff9800;" title="音视频时长不一致">⚠</span>`;
                }
            }
        }
        if (!isVideo) {
            if (clip.audio_replacement) badges += `<span class="bsai-pp-clip-badge audio-replaced">🎵</span>`;
            else if (!clip.audio_enabled) badges += `<span class="bsai-pp-clip-badge">🔇</span>`;
        }
        const icon = isVideo ? "🎬" : "🎵";
        const thumbAttr = isVideo ? `data-thumb="${escapeHtml(clip.file_path)}"` : "";
        const durLabel = formatTime(clipDur);
        block.innerHTML = `
            <div class="bsai-pp-clip-thumb" ${thumbAttr}>
                <span class="placeholder">${icon}</span>
                ${badges}
            </div>
            <div class="bsai-pp-clip-info">
                <div class="bsai-pp-clip-name" title="${escapeHtml(clip.file_name)}">${escapeHtml(clip.file_name)}</div>
                <div class="bsai-pp-clip-dur">${durLabel}</div>
            </div>`;
        if (this.batchMode) {
            block.onclick = (e) => {
                e.stopPropagation();
                if (this.batchSelected.has(clipIndex)) {
                    this.batchSelected.delete(clipIndex);
                } else {
                    this.batchSelected.add(clipIndex);
                }
                this._renderTimeline();
                this._renderBatchBar();
            };
        } else {
            block.onclick = () => { this.selectedIndex = clipIndex; this._renderAll(); };
        }
        return block;
    }

    _showTransitionPopup(anchor, clipIndex) {
        document.querySelectorAll(".bsai-pp-transition-popup").forEach(p => p.remove());
        const clip = this.td.clips[clipIndex];
        if (!clip) return;
        const currentTrans = clip.transition_in || "fade";
        const popup = document.createElement("div");
        popup.className = "bsai-pp-transition-popup";
        popup.innerHTML = `
            <div class="popup-title">切换过渡效果</div>
            ${TRANSITIONS.map(t => `
                <div class="bsai-pp-transition-option ${t === currentTrans ? "selected" : ""}" data-trans="${t}">
                    <span class="opt-icon">${TRANSITION_ICONS[t]}</span>
                    <span>${TRANSITION_LABELS[t]}</span>
                    <span class="opt-desc">${TRANSITION_DESCS[t]}</span>
                </div>
            `).join("")}`;
        document.body.appendChild(popup);
        const rect = anchor.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - popupRect.width / 2;
        let top = rect.bottom + 6;
        if (left < 8) left = 8;
        if (left + popupRect.width > window.innerWidth - 8) left = window.innerWidth - popupRect.width - 8;
        if (top + popupRect.height > window.innerHeight - 8) top = rect.top - popupRect.height - 6;
        popup.style.left = left + "px";
        popup.style.top = top + "px";
        popup.querySelectorAll(".bsai-pp-transition-option").forEach(opt => {
            opt.onclick = (e) => {
                e.stopPropagation();
                const newTrans = opt.getAttribute("data-trans");
                clip.transition_in = newTrans;
                const trackClips = this._getClipsForTrack(clip.track_type, clip.track_index);
                const trackIdx = trackClips.indexOf(clip);
                if (trackIdx > 0) trackClips[trackIdx - 1].transition_out = newTrans;
                if (clip.linked_id) {
                    const linked = this.td.clips.find(c => c.id === clip.linked_id);
                    if (linked) {
                        linked.transition_in = newTrans;
                        const lTrackClips = this._getClipsForTrack(linked.track_type, linked.track_index);
                        const lIdx = lTrackClips.indexOf(linked);
                        if (lIdx > 0) lTrackClips[lIdx - 1].transition_out = newTrans;
                    }
                }
                this._save();
                this._renderTimeline();
                this._renderEditPanel();
                popup.remove();
                this._toast(`过渡效果已切换为: ${TRANSITION_LABELS[newTrans]}`, "success");
            };
        });
        const closeHandler = (e) => {
            if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener("mousedown", closeHandler); }
        };
        setTimeout(() => document.addEventListener("mousedown", closeHandler), 10);
    }

    async _loadThumbnails() {
        const thumbs = this.modal.querySelectorAll("[data-thumb]");
        for (const el of thumbs) {
            const path = el.getAttribute("data-thumb");
            const badges = Array.from(el.querySelectorAll(".bsai-pp-clip-badge"));
            if (this.thumbCache.has(path)) {
                const cached = this.thumbCache.get(path);
                if (cached) {
                    el.innerHTML = `<img src="${cached}">`;
                    badges.forEach(b => el.appendChild(b));
                }
                continue;
            }
            try {
                const resp = await api.fetchApi(`/bsai_premiere_pro/thumbnail?file=${encodeURIComponent(path)}`);
                const data = await resp.json();
                if (data.thumbnail) {
                    this.thumbCache.set(path, data.thumbnail);
                    el.innerHTML = `<img src="${data.thumbnail}">`;
                    badges.forEach(b => el.appendChild(b));
                } else {
                    this.thumbCache.set(path, null);
                }
            } catch { /* ignore */ }
        }
    }

    _renderEditPanel() {
        const panel = this.modal.querySelector("[data-edit]");
        if (!panel) return;
        if (this.selectedIndex < 0 || this.selectedIndex >= (this.td.clips || []).length) {
            panel.innerHTML = `<div class="bsai-pp-no-selection">点击时间轴中的片段进行编辑</div>`;
            return;
        }
        const clip = this.td.clips[this.selectedIndex];
        const isVideo = clip.track_type === "video";
        const dur = clip.duration || 0;
        const trimStart = clip.trim_start || 0;
        const trimEnd = clip.trim_end || dur;
        const transIn = clip.transition_in || "fade";
        const transOut = clip.transition_out || "fade";
        const transDur = clip.transition_duration ?? 0.5;
        const audioRep = clip.audio_replacement || "";
        const aFadeIn = clip.audio_fade_in || 0;
        const aFadeOut = clip.audio_fade_out || 0;
        const isLinked = !!clip.linked_id;
        const trackName = isVideo
            ? (this.td.video_tracks?.[clip.track_index]?.name || `V${clip.track_index + 1}`)
            : (this.td.audio_tracks?.[clip.track_index]?.name || `A${clip.track_index + 1}`);
        const trackOptions = isVideo
            ? (this.td.video_tracks || []).map((t, i) => `<option value="${i}" ${i === clip.track_index ? "selected" : ""}>${t.name || `V${i+1}`}</option>`).join("")
            : (this.td.audio_tracks || []).map((t, i) => `<option value="${i}" ${i === clip.track_index ? "selected" : ""}>${t.name || `A${i+1}`}</option>`).join("");

        let html = `
            <div class="bsai-pp-edit-row">
                <label>文件名</label>
                <input type="text" value="${escapeHtml(clip.file_name)}" readonly style="opacity:0.6">
                <span class="bsai-pp-link-badge ${isLinked ? "linked" : "unlinked"}" data-act="toggle-link" title="点击${isLinked ? "解除" : "建立"}音视频链接">
                    ${isLinked ? "🔗 已链接" : "🔓 未链接"}
                </span>
            </div>
            <div class="bsai-pp-edit-row">
                <label>轨道</label>
                <span style="color:${isVideo ? "#4a90d9" : "#4caf50"};font-size:12px;font-weight:600;">${isVideo ? "📹" : "🎵"} ${trackName}</span>
                <label>移动到</label>
                <select data-field="track_index">${trackOptions}</select>
            </div>
            <div class="bsai-pp-edit-row">
                <label>裁剪起点</label>
                <input type="range" min="0" max="${dur}" step="0.1" value="${trimStart}" data-field="trim_start" data-sync="1">
                <input type="number" min="0" max="${dur}" step="0.1" value="${trimStart}" data-field="trim_start" data-sync="1">
                <label>裁剪终点</label>
                <input type="range" min="0" max="${dur}" step="0.1" value="${trimEnd}" data-field="trim_end" data-sync="1">
                <input type="number" min="0" max="${dur}" step="0.1" value="${trimEnd}" data-field="trim_end" data-sync="1">
            </div>`;
        if (isVideo) {
            html += `
            <div class="bsai-pp-edit-row">
                <label>入场过渡</label>
                <select data-field="transition_in" data-sync="1">
                    ${TRANSITIONS.map(t => `<option value="${t}" ${t === transIn ? "selected" : ""}>${TRANSITION_LABELS[t]}</option>`).join("")}
                </select>
                <label>出场过渡</label>
                <select data-field="transition_out" data-sync="1">
                    ${TRANSITIONS.map(t => `<option value="${t}" ${t === transOut ? "selected" : ""}>${TRANSITION_LABELS[t]}</option>`).join("")}
                </select>
                <label>过渡时长</label>
                <input type="number" min="0" max="5" step="0.1" value="${transDur}" data-field="transition_duration" data-sync="1">
            </div>
            <div class="bsai-pp-edit-row">
                <label>视频启用</label>
                <input type="checkbox" data-field="video_enabled" ${clip.video_enabled !== false ? "checked" : ""}>
            </div>`;
        } else {
            html += `
            <div class="bsai-pp-edit-row">
                <label>音频启用</label>
                <input type="checkbox" data-field="audio_enabled" ${clip.audio_enabled !== false ? "checked" : ""}>
                <label>音频淡入</label>
                <input type="number" min="0" max="10" step="0.1" value="${aFadeIn}" data-field="audio_fade_in">
                <label>音频淡出</label>
                <input type="number" min="0" max="10" step="0.1" value="${aFadeOut}" data-field="audio_fade_out">
            </div>
            <div class="bsai-pp-edit-row">
                <label>替换音频</label>
                <input type="text" value="${escapeHtml(audioRep)}" placeholder="留空使用原音频" data-field="audio_replacement">
                <button class="bsai-pp-btn" data-act="browse-audio">浏览...</button>
                <button class="bsai-pp-btn" data-act="clear-audio">清除</button>
            </div>`;
        }
        html += `
            <div class="bsai-pp-clip-actions">
                <button class="bsai-pp-btn" data-act="move-left">◀ 左移</button>
                <button class="bsai-pp-btn" data-act="move-right">右移 ▶</button>
                ${isVideo ? '<button class="bsai-pp-btn" data-act="replace-video">替换视频文件</button>' : ""}
                ${isLinked ? '<button class="bsai-pp-btn" data-act="sync-linked">🔄 同步链接</button>' : ""}
                <button class="bsai-pp-btn bsai-pp-btn-danger" data-act="delete">🗑 删除片段</button>
            </div>`;
        panel.innerHTML = html;
        this._attachEditEvents(clip);
    }

    _attachEditEvents(clip) {
        const panel = this.modal.querySelector("[data-edit]");
        const linked = clip.linked_id ? this.td.clips.find(c => c.id === clip.linked_id) : null;

        panel.querySelectorAll("[data-field]").forEach(input => {
            const field = input.getAttribute("data-field");
            const shouldSync = input.hasAttribute("data-sync") && linked;
            const handler = () => {
                let val;
                if (input.type === "checkbox") val = input.checked;
                else if (input.type === "number" || input.type === "range") val = parseFloat(input.value) || 0;
                else if (field === "track_index") val = parseInt(input.value) || 0;
                else val = input.value;
                if (field === "trim_start") { val = Math.min(val, clip.trim_end - 0.1); val = Math.max(0, val); }
                if (field === "trim_end") { val = Math.max(val, clip.trim_start + 0.1); val = Math.min(clip.duration || val, val); }
                clip[field] = val;
                if (shouldSync && ["trim_start","trim_end","transition_in","transition_out","transition_duration"].includes(field)) {
                    linked[field] = val;
                }
                if (input.type === "range") { const n = panel.querySelector(`input[type="number"][data-field="${field}"]`); if (n) n.value = val; }
                if (input.type === "number") { const r = panel.querySelector(`input[type="range"][data-field="${field}"]`); if (r) r.value = val; }
                this._save();
                this._renderTimeline();
                this._renderFooter();
            };
            input.onchange = handler;
            if (input.type === "range") input.oninput = handler;
        });

        const linkBadge = panel.querySelector('[data-act="toggle-link"]');
        if (linkBadge) linkBadge.onclick = () => this._toggleLink(clip);

        panel.querySelector('[data-act="move-left"]').onclick = () => this._moveClip(this.selectedIndex, -1);
        panel.querySelector('[data-act="move-right"]').onclick = () => this._moveClip(this.selectedIndex, 1);
        panel.querySelector('[data-act="delete"]').onclick = () => this._deleteClip(this.selectedIndex);
        const replaceBtn = panel.querySelector('[data-act="replace-video"]');
        if (replaceBtn) replaceBtn.onclick = () => this._replaceVideo(this.selectedIndex);
        const browseBtn = panel.querySelector('[data-act="browse-audio"]');
        if (browseBtn) browseBtn.onclick = () => this._browseAudio(clip);
        const clearBtn = panel.querySelector('[data-act="clear-audio"]');
        if (clearBtn) clearBtn.onclick = () => {
            clip.audio_replacement = null;
            const inp = panel.querySelector('[data-field="audio_replacement"]');
            if (inp) inp.value = "";
            this._save();
            this._renderTimeline();
        };
        const syncBtn = panel.querySelector('[data-act="sync-linked"]');
        if (syncBtn) syncBtn.onclick = () => this._syncLinkedClip(clip);
    }

    _toggleLink(clip) {
        if (clip.linked_id) {
            const linked = this.td.clips.find(c => c.id === clip.linked_id);
            if (linked) linked.linked_id = null;
            clip.linked_id = null;
            this._toast("已解除音视频链接", "info");
        } else {
            const partner = this.td.clips.find(c => c.file_path === clip.file_path && c.id !== clip.id && !c.linked_id && c.track_type !== clip.track_type);
            if (partner) {
                clip.linked_id = partner.id;
                partner.linked_id = clip.id;
                const src = clip.track_type === "video" ? clip : partner;
                const dst = clip.track_type === "video" ? partner : clip;
                dst.trim_start = src.trim_start;
                dst.trim_end = src.trim_end;
                dst.transition_in = src.transition_in;
                dst.transition_out = src.transition_out;
                dst.transition_duration = src.transition_duration;
                this._toast("已建立音视频链接并同步裁剪参数", "success");
            } else {
                this._toast("没有可链接的对应片段", "info");
                return;
            }
        }
        this._save();
        this._renderAll();
    }

    _syncLinkedClip(clip) {
        if (!clip.linked_id) { this._toast("该片段未链接", "info"); return; }
        const linked = this.td.clips.find(c => c.id === clip.linked_id);
        if (!linked) return;
        const src = clip.track_type === "video" ? clip : linked;
        const dst = clip.track_type === "video" ? linked : clip;
        dst.trim_start = src.trim_start;
        dst.trim_end = src.trim_end;
        dst.transition_in = src.transition_in;
        dst.transition_out = src.transition_out;
        dst.transition_duration = src.transition_duration;
        this._save();
        this._renderAll();
        this._toast("已同步音视频裁剪参数", "success");
    }

    _renderFooter() {
        const info = this.modal.querySelector("[data-footer-info]");
        if (!info) return;
        const clips = this.td.clips || [];
        const vClips = clips.filter(c => c.track_type === "video");
        const aClips = clips.filter(c => c.track_type === "audio");
        const vTotal = vClips.filter(c => c.video_enabled !== false).reduce((s, c) => s + (c.trim_end - c.trim_start), 0);
        const aTotal = aClips.filter(c => c.audio_enabled !== false).reduce((s, c) => s + (c.trim_end - c.trim_start), 0);
        info.textContent = `📹 ${vClips.length}个视频片段 (${formatTime(vTotal)}) | 🎵 ${aClips.length}个音频片段 (${formatTime(aTotal)}) | ${this.td.video_tracks?.length || 1}视频轨道 ${this.td.audio_tracks?.length || 1}音频轨道`;
    }

    _onClick(e) {
        if (e.target === this.modal) this.close();
    }

    async _scanNow() {
        const dir = this._getWidgetValue("watch_directory", "output");
        this._toast("正在扫描目录...", "info");
        try {
            const resp = await api.fetchApi(`/bsai_premiere_pro/scan?directory=${encodeURIComponent(dir)}`);
            const data = await resp.json();
            if (data.files && data.files.length > 0) {
                const known = new Set(this.td.known_files || []);
                const newFiles = data.files.filter(f => !known.has(f.file_name));
                if (newFiles.length > 0) {
                    let added = 0;
                    for (const file of newFiles) {
                        const ok = await this._addClipFromFile(file);
                        if (ok) added++;
                    }
                    this._save();
                    this._renderAll();
                    const skipped = newFiles.length - added;
                    if (added > 0) {
                        this._toast(`成功导入 ${added} 个视频` + (skipped > 0 ? ` (跳过 ${skipped} 个无音频)` : ""), "success");
                    } else if (skipped > 0) {
                        this._toast(`所有 ${skipped} 个视频均无音频，已跳过`, "info");
                    }
                } else {
                    this._toast("没有发现新视频文件", "info");
                }
            } else {
                this._toast("目录中没有视频文件", "info");
            }
        } catch (e) {
            this._toast("扫描失败: " + e.message, "error");
        }
    }

    async _addClipFromFile(file) {
        try {
            const metaResp = await api.fetchApi(`/bsai_premiere_pro/metadata?file=${encodeURIComponent(file.file_path)}`);
            const meta = await metaResp.json();
            if (meta.error) { this._toast(meta.error, "error"); return false; }
            if (this.td.filter_audio_only !== false && !meta.has_audio) {
                if (!this.td.known_files) this.td.known_files = [];
                this.td.known_files.push(file.file_name);
                return false;
            }
            const vId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const aId = `clip_${Date.now() + 1}_${Math.random().toString(36).substr(2, 6)}`;
            const base = {
                file_path: file.file_path, file_name: file.file_name,
                created_time: file.created_time || Date.now() / 1000,
                duration: meta.duration || 0,
                width: meta.width || 1920, height: meta.height || 1080, fps: meta.fps || 30,
                has_audio: meta.has_audio || false,
                trim_start: 0, trim_end: meta.duration || 0,
                transition_in: "fade", transition_out: "fade",
                transition_duration: parseFloat(this._getWidgetValue("transition_duration", 0.5)),
                audio_replacement: null, audio_fade_in: 0, audio_fade_out: 0,
                video_enabled: true, audio_enabled: true,
            };
            this.td.clips.push({ ...base, id: vId, track_type: "video", track_index: 0, linked_id: aId, is_video_part: true });
            this.td.clips.push({ ...base, id: aId, track_type: "audio", track_index: 0, linked_id: vId, is_video_part: false });
            if (!this.td.known_files) this.td.known_files = [];
            this.td.known_files.push(file.file_name);
            return true;
        } catch (e) {
            this._toast(`导入失败: ${file.file_name}`, "error");
            return false;
        }
    }

    async _manualImport() {
        const dir = this._getWidgetValue("watch_directory", "output");
        try {
            const resp = await api.fetchApi(`/bsai_premiere_pro/scan?directory=${encodeURIComponent(dir)}`);
            const data = await resp.json();
            const known = new Set(this.td.known_files || []);
            const available = (data.files || []).filter(f => !known.has(f.file_name));
            if (available.length === 0 && (data.files || []).length === 0) {
                this._toast("目录中没有视频文件", "info");
                return;
            }
            const allFiles = data.files || [];
            if (allFiles.length === 0) {
                this._toast("没有可导入的视频", "info");
                return;
            }
            this._showImportDialog(allFiles, known);
        } catch (e) {
            this._toast("获取文件列表失败: " + e.message, "error");
        }
    }

    _showImportDialog(files, knownSet) {
        const overlay = document.createElement("div");
        overlay.className = "bsai-pp-dialog-overlay";
        const dialog = document.createElement("div");
        dialog.className = "bsai-pp-import-dialog";
        dialog.innerHTML = `
            <h3>选择要导入的视频文件</h3>
            <div class="bsai-pp-import-list">
                ${files.map(f => `
                    <div class="bsai-pp-import-item" data-path="${escapeHtml(f.file_path)}" data-name="${escapeHtml(f.file_name)}">
                        <span>${knownSet.has(f.file_name) ? "✅" : "⬜"}</span>
                        <span>${escapeHtml(f.file_name)}</span>
                        <span class="size">${(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                `).join("")}
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button class="bsai-pp-btn" data-cancel>取消</button>
                <button class="bsai-pp-btn bsai-pp-btn-primary" data-import>导入选中</button>
            </div>`;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        const selected = new Set();
        dialog.querySelectorAll(".bsai-pp-import-item").forEach(item => {
            item.onclick = () => {
                const name = item.getAttribute("data-name");
                if (selected.has(name)) {
                    selected.delete(name);
                    item.style.background = "";
                } else {
                    selected.add(name);
                    item.style.background = "#4a90d9";
                }
            };
        });
        dialog.querySelector("[data-cancel]").onclick = () => overlay.remove();
        dialog.querySelector("[data-import]").onclick = async () => {
            const toImport = files.filter(f => selected.has(f.file_name));
            if (toImport.length === 0) { this._toast("请选择至少一个文件", "info"); return; }
            overlay.remove();
            this._toast(`正在导入 ${toImport.length} 个视频...`, "info");
            for (const file of toImport) {
                await this._addClipFromFile(file);
            }
            this._save();
            this._renderAll();
            this._toast(`成功导入 ${toImport.length} 个视频`, "success");
        };
    }

    _moveClip(index, dir) {
        const clip = this.td.clips[index];
        if (!clip) return;
        const trackClips = this._getClipsForTrack(clip.track_type, clip.track_index);
        const trackPos = trackClips.indexOf(clip);
        const newTrackPos = trackPos + dir;
        if (newTrackPos < 0 || newTrackPos >= trackClips.length) return;
        const clip2 = trackClips[newTrackPos];
        const idx1 = this.td.clips.indexOf(clip);
        const idx2 = this.td.clips.indexOf(clip2);
        [this.td.clips[idx1], this.td.clips[idx2]] = [this.td.clips[idx2], this.td.clips[idx1]];
        if (clip.linked_id) {
            const linked = this.td.clips.find(c => c.id === clip.linked_id);
            if (linked) {
                const lTrackClips = this._getClipsForTrack(linked.track_type, linked.track_index);
                const lPos = lTrackClips.indexOf(linked);
                const lNewPos = lPos + dir;
                if (lNewPos >= 0 && lNewPos < lTrackClips.length) {
                    const lClip2 = lTrackClips[lNewPos];
                    const lIdx1 = this.td.clips.indexOf(linked);
                    const lIdx2 = this.td.clips.indexOf(lClip2);
                    [this.td.clips[lIdx1], this.td.clips[lIdx2]] = [this.td.clips[lIdx2], this.td.clips[lIdx1]];
                }
            }
        }
        this.selectedIndex = this.td.clips.indexOf(clip);
        this._save();
        this._renderAll();
    }

    _deleteClip(index) {
        const clip = this.td.clips[index];
        if (!clip) return;
        if (clip.linked_id) {
            const linked = this.td.clips.find(c => c.id === clip.linked_id);
            if (linked) linked.linked_id = null;
        }
        this.td.clips.splice(index, 1);
        if (this.selectedIndex >= this.td.clips.length) this.selectedIndex = this.td.clips.length - 1;
        this._save();
        this._renderAll();
    }

    async _replaceVideo(index) {
        const dir = this._getWidgetValue("watch_directory", "output");
        try {
            const resp = await api.fetchApi(`/bsai_premiere_pro/scan?directory=${encodeURIComponent(dir)}`);
            const data = await resp.json();
            const files = data.files || [];
            if (files.length === 0) { this._toast("目录中没有视频文件", "info"); return; }
            const overlay = document.createElement("div");
            overlay.className = "bsai-pp-dialog-overlay";
            const dialog = document.createElement("div");
            dialog.className = "bsai-pp-import-dialog";
            dialog.innerHTML = `
                <h3>替换视频 - 选择新视频文件</h3>
                <div class="bsai-pp-import-list">
                    ${files.map(f => `
                        <div class="bsai-pp-import-item" data-path="${escapeHtml(f.file_path)}" data-name="${escapeHtml(f.file_name)}">
                            <span>🎬</span>
                            <span>${escapeHtml(f.file_name)}</span>
                            <span class="size">${(f.size / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                    `).join("")}
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button class="bsai-pp-btn" data-cancel>取消</button>
                </div>`;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            dialog.querySelector("[data-cancel]").onclick = () => overlay.remove();
            dialog.querySelectorAll(".bsai-pp-import-item").forEach(item => {
                item.onclick = async () => {
                    const filePath = item.getAttribute("data-path");
                    const fileName = item.getAttribute("data-name");
                    overlay.remove();
                    try {
                        const metaResp = await api.fetchApi(`/bsai_premiere_pro/metadata?file=${encodeURIComponent(filePath)}`);
                        const meta = await metaResp.json();
                        const clip = this.td.clips[index];
                        clip.file_path = filePath;
                        clip.file_name = fileName;
                        clip.duration = meta.duration || 0;
                        clip.width = meta.width || 1920;
                        clip.height = meta.height || 1080;
                        clip.fps = meta.fps || 30;
                        clip.has_audio = meta.has_audio || false;
                        clip.trim_start = 0;
                        clip.trim_end = meta.duration || 0;
                        if (clip.linked_id) {
                            const linked = this.td.clips.find(c => c.id === clip.linked_id);
                            if (linked) {
                                linked.file_path = filePath;
                                linked.file_name = fileName;
                                linked.duration = meta.duration || 0;
                                linked.has_audio = meta.has_audio || false;
                                linked.trim_start = 0;
                                linked.trim_end = meta.duration || 0;
                            }
                        }
                        this.thumbCache.delete(filePath);
                        this._save();
                        this._renderAll();
                        this._toast("视频已替换", "success");
                    } catch (e) {
                        this._toast("替换失败: " + e.message, "error");
                    }
                };
            });
        } catch (e) {
            this._toast("获取文件列表失败: " + e.message, "error");
        }
    }

    async _browseAudio(clip) {
        const dir = this._getWidgetValue("watch_directory", "output");
        try {
            const resp = await api.fetchApi(`/bsai_premiere_pro/audio_files?directory=${encodeURIComponent(dir)}`);
            const data = await resp.json();
            const files = data.files || [];
            if (files.length === 0) { this._toast("目录中没有音频文件", "info"); return; }
            const overlay = document.createElement("div");
            overlay.className = "bsai-pp-dialog-overlay";
            const dialog = document.createElement("div");
            dialog.className = "bsai-pp-import-dialog";
            dialog.innerHTML = `
                <h3>选择替换音频文件</h3>
                <div class="bsai-pp-import-list">
                    ${files.map(f => `
                        <div class="bsai-pp-import-item" data-path="${escapeHtml(f.file_path)}">
                            <span>🎵</span>
                            <span>${escapeHtml(f.file_name)}</span>
                            <span class="size">${(f.size / 1024).toFixed(0)} KB</span>
                        </div>
                    `).join("")}
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button class="bsai-pp-btn" data-cancel>取消</button>
                </div>`;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            dialog.querySelector("[data-cancel]").onclick = () => overlay.remove();
            dialog.querySelectorAll(".bsai-pp-import-item").forEach(item => {
                item.onclick = () => {
                    clip.audio_replacement = item.getAttribute("data-path");
                    const inp = this.modal.querySelector('[data-field="audio_replacement"]');
                    if (inp) inp.value = clip.audio_replacement;
                    overlay.remove();
                    this._save();
                    this._renderTimeline();
                    this._toast("音频已替换", "success");
                };
            });
        } catch (e) {
            this._toast("获取音频列表失败: " + e.message, "error");
        }
    }

    async _renderVideo() {
        this._save();
        const clips = this.td.clips || [];
        if (clips.length === 0) { this._toast("时间轴上没有视频片段", "error"); return; }
        const btn = this.modal.querySelector('[data-act="render"]');
        btn.disabled = true;
        btn.textContent = "渲染中...";
        this._showProgress("正在处理视频片段...");
        try {
            const body = {
                timeline_data: JSON.stringify(this.td),
                output_filename: this._getWidgetValue("output_filename", "premiere_pro_output"),
                output_format: this._getWidgetValue("output_format", "mp4"),
                video_codec: this._getWidgetValue("video_codec", "libx264"),
                quality: this._getWidgetValue("quality", "high"),
                default_transition: this._getWidgetValue("default_transition", "fade"),
                transition_duration: parseFloat(this._getWidgetValue("transition_duration", 0.5)),
            };
            this._updateProgress(30, "合并视频片段...");
            const resp = await api.fetchApi("/bsai_premiere_pro/render", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const result = await resp.json();
            this._hideProgress();
            if (result.error) {
                this._toast("渲染失败: " + result.error, "error");
            } else {
                this._toast("渲染成功! " + result.filename, "success");
                this._showPreview(result.filename);
            }
        } catch (e) {
            this._hideProgress();
            this._toast("渲染失败: " + e.message, "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "🎞️ 渲染输出";
        }
    }

    _showPreview(filename) {
        const section = this.modal.querySelector("[data-preview]");
        const video = this.modal.querySelector("[data-preview-video]");
        if (section && video) {
            video.src = `/view?filename=${encodeURIComponent(filename)}&type=output`;
            section.classList.add("visible");
            video.play().catch(() => {});
        }
    }

    _toast(msg, type) {
        const existing = document.querySelector(".bsai-pp-toast");
        if (existing) existing.remove();
        const toast = document.createElement("div");
        toast.className = `bsai-pp-toast ${type || "info"}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add("show"), 10);
        setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, 3500);
    }

    _showProgress(text) {
        let prog = document.querySelector(".bsai-pp-progress");
        if (!prog) {
            prog = document.createElement("div");
            prog.className = "bsai-pp-progress";
            prog.innerHTML = `<div class="bsai-pp-progress-text"></div><div class="bsai-pp-progress-bar"><div class="bsai-pp-progress-fill"></div></div>`;
            document.body.appendChild(prog);
        }
        prog.querySelector(".bsai-pp-progress-text").textContent = text;
        prog.querySelector(".bsai-pp-progress-fill").style.width = "10%";
        prog.classList.add("visible");
    }

    _updateProgress(pct, text) {
        const prog = document.querySelector(".bsai-pp-progress");
        if (prog) {
            if (text) prog.querySelector(".bsai-pp-progress-text").textContent = text;
            prog.querySelector(".bsai-pp-progress-fill").style.width = pct + "%";
        }
    }

    _hideProgress() {
        const prog = document.querySelector(".bsai-pp-progress");
        if (prog) {
            prog.querySelector(".bsai-pp-progress-fill").style.width = "100%";
            setTimeout(() => prog.classList.remove("visible"), 500);
        }
    }
}

// ── Extension Registration ──────────────────────────────────────────
app.registerExtension({
    name: "BSAI.PremierePro",

    async beforeRegisterNodeDef(nodeType, nodeData, appInstance) {
        if (nodeData.name !== NODE_TYPE) return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);

            // Hide the timeline_data multiline widget
            const tdWidget = this.widgets?.find(w => w.name === "timeline_data");
            if (tdWidget) {
                tdWidget.computeSize = () => [0, -4];
                tdWidget.hidden = true;
                tdWidget.draw = () => {};
                tdWidget.mouse = () => {};
                if (!tdWidget.value || tdWidget.value === "") {
                    tdWidget.value = '{"clips":[],"known_files":[]}';
                }
            }

            // Add button to browse watch directory
            this.addWidget("button", "browse_directory", "📂 浏览监视目录", async () => {
                const dirWidget = this.widgets?.find(w => w.name === "watch_directory");
                const selected = await browseDirectoryDialog(dirWidget?.value || "");
                if (selected) {
                    if (dirWidget) dirWidget.value = selected;
                    const importer = importerMap.get(this.id);
                    if (importer) importer.updateNodeTitle(
                        JSON.parse(this.widgets?.find(w => w.name === "timeline_data")?.value || '{"clips":[]}')
                    );
                }
            });

            // Add button to open the editor
            this.addWidget("button", "open_editor", "🎬 打开时间轴编辑器", () => {
                const editor = new TimelineEditor(this);
                editor.open();
            });

            // Set a reasonable size
            this.size = [420, 300];

            // Start auto-import polling
            const importer = new AutoImporter(this);
            importerMap.set(this.id, importer);
            importer.start();

            // Update title
            try {
                const td = JSON.parse(tdWidget?.value || '{"clips":[]}');
                importer.updateNodeTitle(td);
            } catch {}
        };

        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            const importer = importerMap.get(this.id);
            if (importer) { importer.stop(); importerMap.delete(this.id); }
            onRemoved?.apply(this, arguments);
        };

        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const result = onConfigure?.apply(this, arguments);
            const tdWidget = this.widgets?.find(w => w.name === "timeline_data");
            if (tdWidget) {
                tdWidget.computeSize = () => [0, -4];
                tdWidget.hidden = true;
                tdWidget.draw = () => {};
                tdWidget.mouse = () => {};
                const importer = importerMap.get(this.id);
                if (importer) {
                    try {
                        const td = JSON.parse(tdWidget.value || '{"clips":[]}');
                        importer.updateNodeTitle(td);
                    } catch {}
                }
            }
            return result;
        };

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);
            if (message?.timeline_data) {
                const tdWidget = this.widgets?.find(w => w.name === "timeline_data");
                if (tdWidget) {
                    tdWidget.value = message.timeline_data;
                    tdWidget.computeSize = () => [0, -4];
                    tdWidget.hidden = true;
                    tdWidget.draw = () => {};
                    tdWidget.mouse = () => {};
                    const importer = importerMap.get(this.id);
                    if (importer) {
                        try {
                            const td = JSON.parse(message.timeline_data);
                            importer.updateNodeTitle(td);
                        } catch {}
                        const editor = importer._editor;
                        if (editor) editor.refresh();
                    }
                }
            }
            if (message?.merge_msg) {
                const editor = importerMap.get(this.id)?._editor;
                if (editor) editor._toast(message.merge_msg, "info");
            }
        };
    },
});
