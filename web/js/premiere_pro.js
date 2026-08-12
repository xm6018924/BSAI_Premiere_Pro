import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const NODE_TYPE = "BSAIPremiereProTimeline";
const POLL_INTERVAL = 3000;
const TRANSITIONS = ["cut", "fade", "black", "white"];
const TRANSITION_LABELS = { cut: "切镜", fade: "淡入淡出", black: "黑场", white: "白场" };

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
    flex: 1; overflow-x: auto; overflow-y: hidden; padding: 12px 16px;
    background: #1a1a1a;
}
.bsai-pp-timeline-track {
    display: flex; align-items: flex-start; gap: 0; min-height: 120px;
}
.bsai-pp-clip-block {
    background: #2a2a2a; border: 2px solid #3a3a3a; border-radius: 6px;
    width: 200px; min-width: 200px; cursor: pointer; overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s; position: relative;
}
.bsai-pp-clip-block:hover { border-color: #555; }
.bsai-pp-clip-block.selected {
    border-color: #4a90d9; box-shadow: 0 0 8px rgba(74,144,217,0.4);
}
.bsai-pp-clip-block.disabled { opacity: 0.4; }
.bsai-pp-clip-thumb {
    width: 100%; height: 90px; background: #111; display: flex;
    align-items: center; justify-content: center; overflow: hidden;
    position: relative;
}
.bsai-pp-clip-thumb img { width: 100%; height: 100%; object-fit: cover; }
.bsai-pp-clip-thumb .placeholder { color: #555; font-size: 24px; }
.bsai-pp-clip-badge {
    position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7);
    color: #aaa; font-size: 10px; padding: 2px 6px; border-radius: 3px;
}
.bsai-pp-clip-badge.audio-replaced { color: #ffc107; }
.bsai-pp-clip-info { padding: 6px 8px; }
.bsai-pp-clip-name {
    color: #ddd; font-size: 11px; white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; margin-bottom: 2px;
}
.bsai-pp-clip-duration { color: #888; font-size: 10px; }
.bsai-pp-clip-num {
    position: absolute; top: 4px; left: 4px; background: rgba(74,144,217,0.8);
    color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 3px;
    font-weight: 600;
}
.bsai-pp-transition-arrow {
    display: flex; align-items: center; justify-content: center;
    min-width: 40px; height: 120px; color: #666; font-size: 10px;
    writing-mode: vertical-rl; text-orientation: mixed;
}
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
                const clip = {
                    id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    file_path: file.file_path,
                    file_name: file.file_name,
                    created_time: file.created_time,
                    duration: meta.duration || 0,
                    width: meta.width || 1920,
                    height: meta.height || 1080,
                    fps: meta.fps || 30,
                    has_audio: meta.has_audio || false,
                    trim_start: 0,
                    trim_end: meta.duration || 0,
                    transition_in: "cut",
                    transition_out: "cut",
                    transition_duration: 0.5,
                    audio_replacement: null,
                    audio_fade_in: 0,
                    audio_fade_out: 0,
                    video_enabled: true,
                    audio_enabled: true,
                };
                td.clips.push(clip);
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
        const count = td.clips.length;
        const total = td.clips.reduce((s, c) => s + (c.trim_end - c.trim_start), 0);
        if (count > 0) {
            this.node.title = `🎬 Premiere Pro (${count} clips / ${formatTime(total)})`;
        } else {
            this.node.title = `🎬 Premiere Pro`;
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
        this.thumbCache = new Map();
        this.td = this._load();
    }

    _load() {
        const w = this.node.widgets?.find(w => w.name === "timeline_data");
        if (w?.value) {
            try { return JSON.parse(w.value); } catch { /* fall through */ }
        }
        return { clips: [], known_files: [] };
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
                    <input type="text" data-act="dir" value="${escapeHtml(this._getWidgetValue("watch_directory", "output"))}">
                    <label>仅带音频</label>
                    <input type="checkbox" data-act="filter-audio" ${this.td.filter_audio_only !== false ? "checked" : ""}>
                    <button class="bsai-pp-btn" data-act="scan">🔍 扫描</button>
                    <button class="bsai-pp-btn" data-act="manual-import">📥 手动导入</button>
                    <div class="bsai-pp-status">
                        <span><span class="dot ${this._getWidgetValue("auto_import", true) ? "on" : "off"}" data-dot></span> ${this._getWidgetValue("auto_import", true) ? "监控中" : "已停止"}</span>
                    </div>
                </div>
                <div class="bsai-pp-body">
                    <div class="bsai-pp-timeline-section">
                        <div class="bsai-pp-section-label">时间轴轨道</div>
                        <div class="bsai-pp-timeline-scroll">
                            <div class="bsai-pp-timeline-track" data-track></div>
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
        const track = this.modal.querySelector("[data-track]");
        if (!track) return;
        track.innerHTML = "";
        const clips = this.td.clips || [];
        if (clips.length === 0) {
            track.innerHTML = `<div class="bsai-pp-empty-timeline">暂无视频片段<br><small>请运行工作流生成视频，或点击「手动导入」添加视频文件</small></div>`;
            return;
        }
        clips.forEach((clip, i) => {
            if (i > 0) {
                const arrow = document.createElement("div");
                arrow.className = "bsai-pp-transition-arrow";
                arrow.textContent = TRANSITION_LABELS[clip.transition_in] || "切镜";
                track.appendChild(arrow);
            }
            track.appendChild(this._createClipBlock(clip, i));
        });
    }

    _createClipBlock(clip, index) {
        const block = document.createElement("div");
        block.className = "bsai-pp-clip-block";
        if (index === this.selectedIndex) block.classList.add("selected");
        if (!clip.video_enabled && !clip.audio_enabled) block.classList.add("disabled");
        const trimDur = (clip.trim_end || 0) - (clip.trim_start || 0);
        let badges = "";
        if (clip.audio_replacement) badges += `<span class="bsai-pp-clip-badge audio-replaced">🎵替换</span>`;
        else if (!clip.audio_enabled) badges += `<span class="bsai-pp-clip-badge">🔇静音</span>`;
        else if (!clip.has_audio) badges += `<span class="bsai-pp-clip-badge">无声</span>`;
        block.innerHTML = `
            <div class="bsai-pp-clip-thumb" data-thumb="${escapeHtml(clip.file_path)}">
                <span class="placeholder">🎬</span>
                ${badges}
            </div>
            <div class="bsai-pp-clip-info">
                <div class="bsai-pp-clip-name" title="${escapeHtml(clip.file_name)}">${escapeHtml(clip.file_name)}</div>
                <div class="bsai-pp-clip-duration">时长: ${formatTime(trimDur)} / ${formatTime(clip.duration)}</div>
            </div>
            <span class="bsai-pp-clip-num">${index + 1}</span>`;
        block.onclick = () => { this.selectedIndex = index; this._renderAll(); };
        return block;
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
            panel.innerHTML = `<div class="bsai-pp-no-selection">点击上方时间轴中的视频片段进行编辑</div>`;
            return;
        }
        const clip = this.td.clips[this.selectedIndex];
        const dur = clip.duration || 0;
        const trimStart = clip.trim_start || 0;
        const trimEnd = clip.trim_end || dur;
        const transIn = clip.transition_in || "cut";
        const transOut = clip.transition_out || "cut";
        const transDur = clip.transition_duration ?? 0.5;
        const audioRep = clip.audio_replacement || "";
        const aFadeIn = clip.audio_fade_in || 0;
        const aFadeOut = clip.audio_fade_out || 0;
        panel.innerHTML = `
            <div class="bsai-pp-edit-row">
                <label>文件名</label>
                <input type="text" value="${escapeHtml(clip.file_name)}" readonly style="opacity:0.6">
            </div>
            <div class="bsai-pp-edit-row">
                <label>裁剪起点</label>
                <input type="range" min="0" max="${dur}" step="0.1" value="${trimStart}" data-field="trim_start">
                <input type="number" min="0" max="${dur}" step="0.1" value="${trimStart}" data-field="trim_start">
                <label>裁剪终点</label>
                <input type="range" min="0" max="${dur}" step="0.1" value="${trimEnd}" data-field="trim_end">
                <input type="number" min="0" max="${dur}" step="0.1" value="${trimEnd}" data-field="trim_end">
            </div>
            <div class="bsai-pp-edit-row">
                <label>入场过渡</label>
                <select data-field="transition_in">
                    ${TRANSITIONS.map(t => `<option value="${t}" ${t === transIn ? "selected" : ""}>${TRANSITION_LABELS[t]}</option>`).join("")}
                </select>
                <label>出场过渡</label>
                <select data-field="transition_out">
                    ${TRANSITIONS.map(t => `<option value="${t}" ${t === transOut ? "selected" : ""}>${TRANSITION_LABELS[t]}</option>`).join("")}
                </select>
                <label>过渡时长</label>
                <input type="number" min="0" max="5" step="0.1" value="${transDur}" data-field="transition_duration">
            </div>
            <div class="bsai-pp-edit-row">
                <label>视频轨道</label>
                <input type="checkbox" data-field="video_enabled" ${clip.video_enabled !== false ? "checked" : ""}>
                <label>音频轨道</label>
                <input type="checkbox" data-field="audio_enabled" ${clip.audio_enabled !== false ? "checked" : ""}>
            </div>
            <div class="bsai-pp-edit-row">
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
            </div>
            <div class="bsai-pp-clip-actions">
                <button class="bsai-pp-btn" data-act="move-left">◀ 左移</button>
                <button class="bsai-pp-btn" data-act="move-right">右移 ▶</button>
                <button class="bsai-pp-btn" data-act="replace-video">替换视频文件</button>
                <button class="bsai-pp-btn bsai-pp-btn-danger" data-act="delete">🗑 删除片段</button>
            </div>`;
        this._attachEditEvents(clip);
    }

    _attachEditEvents(clip) {
        const panel = this.modal.querySelector("[data-edit]");

        panel.querySelectorAll("[data-field]").forEach(input => {
            const field = input.getAttribute("data-field");
            const handler = () => {
                let val;
                if (input.type === "checkbox") val = input.checked;
                else if (input.type === "number" || input.type === "range") val = parseFloat(input.value) || 0;
                else val = input.value;
                if (field === "trim_start") {
                    val = Math.min(val, clip.trim_end - 0.1);
                    val = Math.max(0, val);
                }
                if (field === "trim_end") {
                    val = Math.max(val, clip.trim_start + 0.1);
                    val = Math.min(clip.duration || val, val);
                }
                clip[field] = val;
                if (input.type === "range") {
                    const numInput = panel.querySelector(`input[type="number"][data-field="${field}"]`);
                    if (numInput) numInput.value = val;
                }
                if (input.type === "number") {
                    const rangeInput = panel.querySelector(`input[type="range"][data-field="${field}"]`);
                    if (rangeInput) rangeInput.value = val;
                }
                this._save();
                this._renderTimeline();
                this._renderFooter();
            };
            input.onchange = handler;
            if (input.type === "range") input.oninput = handler;
        });

        panel.querySelector('[data-act="move-left"]').onclick = () => this._moveClip(this.selectedIndex, -1);
        panel.querySelector('[data-act="move-right"]').onclick = () => this._moveClip(this.selectedIndex, 1);
        panel.querySelector('[data-act="delete"]').onclick = () => this._deleteClip(this.selectedIndex);
        panel.querySelector('[data-act="replace-video"]').onclick = () => this._replaceVideo(this.selectedIndex);
        panel.querySelector('[data-act="browse-audio"]').onclick = () => this._browseAudio(clip);
        panel.querySelector('[data-act="clear-audio"]').onclick = () => {
            clip.audio_replacement = null;
            const inp = panel.querySelector('[data-field="audio_replacement"]');
            if (inp) inp.value = "";
            this._save();
            this._renderTimeline();
        };
    }

    _renderFooter() {
        const info = this.modal.querySelector("[data-footer-info]");
        if (!info) return;
        const clips = this.td.clips || [];
        const enabled = clips.filter(c => c.video_enabled !== false || c.audio_enabled !== false);
        const total = enabled.reduce((s, c) => s + (c.trim_end - c.trim_start), 0);
        info.textContent = `共 ${clips.length} 个片段 (启用 ${enabled.length}) | 总时长: ${formatTime(total)}`;
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
            const clip = {
                id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                file_path: file.file_path,
                file_name: file.file_name,
                created_time: file.created_time || Date.now() / 1000,
                duration: meta.duration || 0,
                width: meta.width || 1920,
                height: meta.height || 1080,
                fps: meta.fps || 30,
                has_audio: meta.has_audio || false,
                trim_start: 0,
                trim_end: meta.duration || 0,
                transition_in: "cut",
                transition_out: "cut",
                transition_duration: parseFloat(this._getWidgetValue("transition_duration", 0.5)),
                audio_replacement: null,
                audio_fade_in: 0,
                audio_fade_out: 0,
                video_enabled: true,
                audio_enabled: true,
            };
            this.td.clips.push(clip);
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
        const newIndex = index + dir;
        if (newIndex < 0 || newIndex >= this.td.clips.length) return;
        const clips = this.td.clips;
        [clips[index], clips[newIndex]] = [clips[newIndex], clips[index]];
        this.selectedIndex = newIndex;
        this._save();
        this._renderAll();
    }

    _deleteClip(index) {
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
                default_transition: this._getWidgetValue("default_transition", "cut"),
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
                if (!tdWidget.value || tdWidget.value === "") {
                    tdWidget.value = '{"clips":[],"known_files":[]}';
                }
            }

            // Add button to open the editor
            this.addWidget("button", "open_editor", "🎬 打开时间轴编辑器", () => {
                const editor = new TimelineEditor(this);
                editor.open();
            });

            // Set a reasonable size
            this.size = [420, 260];

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
    },
});
