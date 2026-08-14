// BSAI Premiere Pro v5 - loaded via <script> tag injection
if (window.__bsai_pp_loaded) {
    // Already loaded (e.g. both import() and <script> tag), skip
} else {
window.__bsai_pp_loaded = true;
console.log("[BSAI Premiere Pro] Script loaded v5 from bsai_pp.js");

let api = window.comfyAPI?.api?.api ?? window.api;

const NODE_TYPE = "BSAIPremiereProTimeline";
const POLL_INTERVAL = 3000;
const TRANSITIONS = ["cut", "fade", "black", "white"];
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
    font-family: -apple-system, "Segoe UI", sans-serif;
}
.bsai-pp-modal {
    position: absolute;
    background: #1e1e1e; border: 1px solid #444; border-radius: 8px;
    width: 95vw; height: 92vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    resize: both; min-width: 600px; min-height: 400px;
    max-width: 100vw; max-height: 100vh;
}
.bsai-pp-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px; background: #252525; border-bottom: 1px solid #3a3a3a;
    flex-shrink: 0; cursor: move; user-select: none;
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
    min-height: 0;
}
.bsai-pp-divider {
    height: 6px; flex-shrink: 0; background: #2a2a2a; cursor: ns-resize;
    user-select: none; position: relative; border-top: 1px solid #1a1a1a;
    border-bottom: 1px solid #1a1a1a; transition: background 0.15s;
}
.bsai-pp-divider::before {
    content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 40px; height: 2px; background: #555; border-radius: 1px; transition: background 0.15s;
}
.bsai-pp-divider:hover, .bsai-pp-divider.dragging {
    background: #3a5a8a;
}
.bsai-pp-divider:hover::before, .bsai-pp-divider.dragging::before {
    background: #7ab0ff;
}
.bsai-pp-section-label {
    padding: 6px 16px; color: #888; font-size: 11px; text-transform: uppercase;
    letter-spacing: 1px; background: #232323; border-bottom: 1px solid #333;
}
.bsai-pp-timeline-scroll {
    flex: 1; overflow: auto; background: #1a1a1a; padding: 0;
}
.bsai-pp-timeline-container { min-width: 100%; display: flex; flex-direction: column; position: relative; }
.bsai-pp-time-ruler {
    display: flex; align-items: flex-end; height: 28px; background: #232323;
    border-bottom: 1px solid #3a3a3a; position: sticky; top: 0; z-index: 5;
}
.bsai-pp-ruler-spacer {
    min-width: 150px; flex-shrink: 0; border-right: 1px solid #3a3a3a;
}
.bsai-pp-ruler-marks { flex: 1; position: relative; height: 100%; }
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
    display: flex; border-bottom: 1px solid #111; min-height: 40px; flex-shrink: 0;
}
.bsai-pp-track-row.video-track { min-height: 90px; }
.bsai-pp-track-row.audio-track { min-height: 40px; }
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
    flex: 1; background: #1a1a1a; display: flex; align-items: stretch;
    gap: 0; padding: 3px 0; overflow-x: visible; position: relative; min-height: 34px;
}
.bsai-pp-track-row.video-track .bsai-pp-track-content { min-height: 82px; }
.bsai-pp-track-empty { color: #444; font-size: 11px; padding: 0 12px; }
.bsai-pp-clip-block {
    border: 1px solid #3a3a3a; border-radius: 4px; height: 52px; cursor: pointer;
    overflow: hidden; position: relative; transition: border-color 0.2s, box-shadow 0.2s;
    margin: 0; flex-shrink: 0; display: flex; flex-direction: column; min-width: 50px;
}
.bsai-pp-clip-block.video-clip { background: #2a3a4a; border-color: #3a5a7a; border-left: 3px solid #4a90d9; height: 100%; }
.bsai-pp-clip-block.audio-clip { background: #2a3a2a; border-color: #3a6a3a; border-left: 3px solid #4caf50; height: 100%; }
.bsai-pp-clip-block.linked { border-left-color: #ffa726; }
.bsai-pp-clip-block:hover { border-color: #6a8aaa; }
.bsai-pp-clip-block.drag-over { border-color: #ffa726; box-shadow: 0 0 12px rgba(255,167,38,0.6); transform: scale(1.02); transition: transform 0.15s; }
.bsai-pp-clip-block[draggable="true"] { cursor: grab; }
.bsai-pp-clip-block[draggable="true"]:active { cursor: grabbing; }
.bsai-pp-playhead {
    position: absolute; top: 0; bottom: 0; width: 2px; background: #ff4444;
    z-index: 100; pointer-events: none; box-shadow: 0 0 6px rgba(255,68,68,0.8);
}
.bsai-pp-playhead::before {
    content: "▼"; position: absolute; top: -2px; left: -6px; color: #ff4444; font-size: 10px;
}
.bsai-pp-timeline-playhead {
    position: absolute; top: 0; bottom: 0; width: 2px; background: #ff4444;
    z-index: 90; pointer-events: auto; cursor: ew-resize;
    box-shadow: 0 0 6px rgba(255,68,68,0.8);
}
.bsai-pp-timeline-playhead::before {
    content: "▼"; position: absolute; top: 0; left: -6px; color: #ff4444; font-size: 11px;
    text-shadow: 0 0 4px rgba(255,68,68,0.6);
}
.bsai-pp-timeline-container { position: relative; }
.bsai-pp-clip-block.selected { border-color: #4a90d9; box-shadow: 0 0 8px rgba(74,144,217,0.5); }
.bsai-pp-clip-block.batch-selected { border-color: #ff6b6b; box-shadow: 0 0 8px rgba(255,107,107,0.6); background: rgba(255,107,107,0.12); }
.bsai-pp-clip-block.batch-selected::after { content: "✓"; position: absolute; top: 2px; right: 4px; color: #ff6b6b; font-weight: bold; font-size: 12px; }
.bsai-pp-clip-block.disabled { opacity: 0.4; }
.bsai-pp-clip-block.track-locked { opacity: 0.6; cursor: not-allowed !important; }
.bsai-pp-clip-block.track-locked::after { content: "🔒"; position: absolute; top: 2px; right: 4px; font-size: 11px; opacity: 0.7; }
.bsai-pp-clip-thumb {
    flex: 1; background: #111; display: flex; align-items: center;
    justify-content: center; overflow: hidden; position: relative; min-height: 30px;
}
.bsai-pp-clip-block.video-clip .bsai-pp-clip-thumb { min-height: 50px; flex: 1 1 auto; }
.bsai-pp-clip-thumb img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; background: #000; }
.bsai-pp-clip-thumb .placeholder { color: #555; font-size: 14px; }
.bsai-pp-clip-waveform { width: 100%; height: 100%; object-fit: cover; background: #1a2a1a; }
.bsai-pp-clip-waveform-canvas { width: 100%; height: 100%; display: block; background: #1a2a1a; }
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
    width: 28px; height: calc(100% - 6px); cursor: pointer; color: #888; font-size: 8px;
    border-radius: 4px; transition: background 0.2s, color 0.2s; position: absolute;
    user-select: none; gap: 2px; z-index: 3; top: 3px;
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
    height: 260px; min-height: 200px; flex-shrink: 0; overflow-y: auto;
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
/* ── Timeline playback overlay (replaces separate preview window) ── */
.bsai-pp-timeline-preview {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: #000; z-index: 300; display: none;
    align-items: center; justify-content: center; overflow: hidden;
}
.bsai-pp-timeline-preview.visible { display: flex; }
.bsai-pp-timeline-preview.fullscreen {
    width: 100%; height: 100%; top: 0; left: 0; transform: none;
}
.bsai-pp-timeline-preview video {
    width: 100%; height: 100%; object-fit: contain; object-position: center; background: #000;
    transition: transform 0.1s ease;
}
.bsai-pp-timeline-preview .preview-close {
    position: absolute; top: 6px; right: 6px; z-index: 301;
    background: rgba(0,0,0,0.7); color: #fff; border: none;
    width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px;
}
.bsai-pp-timeline-preview .preview-close:hover { background: rgba(220,53,53,0.8); }
.bsai-pp-timeline-preview .preview-enlarge {
    position: absolute; top: 6px; right: 40px; z-index: 301;
    background: rgba(0,0,0,0.7); color: #fff; border: none;
    width: 28px; height: 28px; border-radius: 4px; cursor: pointer; font-size: 14px;
}
.bsai-pp-timeline-preview .preview-enlarge:hover { background: rgba(74,144,217,0.8); }
.bsai-pp-timeline-preview .preview-info {
    position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); z-index: 301;
    background: rgba(0,0,0,0.75); color: #fff; padding: 4px 12px;
    border-radius: 4px; font-size: 11px; font-family: monospace; white-space: nowrap;
}
.bsai-pp-timeline-preview .preview-progress {
    position: absolute; bottom: 0; left: 0; width: 0%; height: 3px;
    background: #4a90d9; z-index: 301; transition: width 0.1s linear;
}
.bsai-pp-timeline-preview .preview-zoom-info {
    position: absolute; top: 6px; left: 50%; transform: translateX(-50%); z-index: 301;
    background: rgba(0,0,0,0.75); color: #fff; padding: 3px 10px;
    border-radius: 4px; font-size: 11px; font-family: monospace; display: none;
}
.bsai-pp-timeline-preview .preview-zoom-info.visible { display: block; }
/* ── Zoom controls ── */
.bsai-pp-zoom-display { color: #aaa; font-size: 11px; min-width: 38px; text-align: center; user-select: none; }
/* ── Alignment controls ── */
.bsai-pp-align-select {
    background: #1a1a1a; border: 1px solid #444; color: #e0e0e0;
    padding: 3px 6px; border-radius: 3px; font-size: 11px;
}
.bsai-pp-pos-slider { width: 70px; cursor: pointer; vertical-align: middle; }
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
    padding: 20px; z-index: 100002; min-width: 400px; max-width: 700px;
    max-height: 85vh; overflow-y: auto;
}
.bsai-pp-import-dialog h3 { color: #e0e0e0; margin: 0 0 12px 0; font-size: 14px; }
.bsai-pp-import-list {
    max-height: 60vh; overflow-y: auto; margin: 10px 0;
}
.bsai-pp-import-list::-webkit-scrollbar { width: 8px; }
.bsai-pp-import-list::-webkit-scrollbar-track { background: #1a1a1a; border-radius: 4px; }
.bsai-pp-import-list::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
.bsai-pp-import-list::-webkit-scrollbar-thumb:hover { background: #777; }
.bsai-pp-import-list { scrollbar-width: thin; scrollbar-color: #555 #1a1a1a; }
/* ── Dialog header with maximize button ── */
.bsai-pp-dlg-header {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
}
.bsai-pp-dlg-header h3 { margin: 0; flex: 1; }
.bsai-pp-dlg-maximize {
    background: #3a3a3a; border: none; color: #ccc; cursor: pointer;
    width: 28px; height: 28px; border-radius: 4px; font-size: 14px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.bsai-pp-dlg-maximize:hover { background: #4a90d9; color: #fff; }
/* ── Maximized dialog state ── */
.bsai-pp-import-dialog.maximized {
    top: 0 !important; left: 0 !important; transform: none !important;
    width: 100vw !important; min-width: 100vw !important; max-width: 100vw !important;
    height: 100vh !important; max-height: 100vh !important; border-radius: 0 !important;
}
.bsai-pp-import-dialog.maximized .bsai-pp-import-list {
    max-height: calc(100vh - 180px) !important;
}
.bsai-pp-modal.maximized {
    left: 0 !important; top: 0 !important;
    width: 100vw !important; max-width: 100vw !important;
    height: 100vh !important; max-height: 100vh !important; border-radius: 0 !important;
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
/* ── Box selection ── */
.bsai-pp-select-box {
    position: absolute; border: 1px dashed #4a90d9; background: rgba(74,144,217,0.12);
    pointer-events: none; z-index: 10;
}
.bsai-pp-clip-block.box-selected {
    border-color: #ff6b6b !important; box-shadow: 0 0 8px rgba(255,107,107,0.5) !important;
}
/* ── Clip resize handles ── */
.bsai-pp-clip-handle {
    position: absolute; top: 0; width: 8px; height: 100%; cursor: ew-resize;
    z-index: 3; background: rgba(255,255,255,0.15); opacity: 0; transition: opacity 0.15s;
}
.bsai-pp-clip-handle.left { left: 0; border-radius: 4px 0 0 4px; }
.bsai-pp-clip-handle.right { right: 0; border-radius: 0 4px 4px 0; }
.bsai-pp-clip-block:hover .bsai-pp-clip-handle { opacity: 1; }
.bsai-pp-clip-handle:hover { background: rgba(74,144,217,0.6); }
/* ── Scissor tool mode ── */
.bsai-pp-toolbar .bsai-pp-btn.scissor-active {
    background: #ff9800; border-color: #ffa726; color: #fff;
}
.bsai-pp-clip-block.scissor-mode { cursor: crosshair !important; }
.bsai-pp-clip-block.scissor-mode:hover { border-color: #ff9800; box-shadow: 0 0 8px rgba(255,152,0,0.4); }
/* ── Breadcrumb navigation ── */
.bsai-pp-breadcrumb {
    display: flex; align-items: center; gap: 2px; flex-wrap: wrap;
    padding: 4px 8px; background: #1a1a1a; border-radius: 4px; margin-bottom: 8px;
    font-size: 12px;
}
.bsai-pp-breadcrumb-item {
    color: #4a90d9; cursor: pointer; padding: 2px 6px; border-radius: 3px;
    transition: background 0.15s; white-space: nowrap;
}
.bsai-pp-breadcrumb-item:hover { background: #2a3a4a; text-decoration: underline; }
.bsai-pp-breadcrumb-sep { color: #555; font-size: 10px; }
.bsai-pp-breadcrumb-current { color: #ccc; padding: 2px 6px; font-weight: 600; }
/* ── Directory history dropdown ── */
.bsai-pp-history-dropdown {
    position: absolute; z-index: 100010; background: #2a2a2a; border: 1px solid #555;
    border-radius: 6px; padding: 4px; min-width: 250px; max-height: 300px; overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}
.bsai-pp-history-item {
    display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 4px;
    cursor: pointer; color: #ccc; font-size: 12px; transition: background 0.15s;
}
.bsai-pp-history-item:hover { background: #3a3a3a; }
.bsai-pp-history-item .hist-clips { color: #666; font-size: 10px; margin-left: auto; }
.bsai-pp-history-item .hist-del { color: #d35454; cursor: pointer; padding: 2px 4px; }
.bsai-pp-history-item .hist-del:hover { background: #d35454; color: #fff; border-radius: 3px; }
`;

// Inject styles immediately so directory browser dialog has CSS
(function _bsaiInjectStyles() {
    if (document.getElementById("bsai-pp-styles")) return;
    const el = document.createElement("style");
    el.id = "bsai-pp-styles";
    el.textContent = STYLES;
    document.head.appendChild(el);
})();

// ── Helper: add maximize button to any dialog ──────────────────────
function _addMaximizeBtn(dialog) {
    // For the main modal (.bsai-pp-modal inside overlay)
    const modal = dialog.querySelector(".bsai-pp-modal");
    if (modal) {
        const header = modal.querySelector(".bsai-pp-header");
        if (header && !header.querySelector(".bsai-pp-dlg-maximize")) {
            const closeBtn = header.querySelector(".bsai-pp-close");
            const maxBtn = document.createElement("button");
            maxBtn.className = "bsai-pp-close bsai-pp-dlg-maximize";
            maxBtn.style.marginRight = "6px";
            maxBtn.innerHTML = "⛶";
            maxBtn.title = "最大化/还原";
            maxBtn.onclick = (e) => {
                e.stopPropagation();
                modal.classList.toggle("maximized");
                maxBtn.innerHTML = modal.classList.contains("maximized") ? "🗗" : "⛶";
            };
            header.insertBefore(maxBtn, closeBtn);
        }
        return;
    }
    // For small dialogs (.bsai-pp-import-dialog)
    if (dialog.querySelector(".bsai-pp-dlg-maximize")) return;
    const h3 = dialog.querySelector("h3");
    if (!h3) return;
    const header = document.createElement("div");
    header.className = "bsai-pp-dlg-header";
    h3.parentNode.insertBefore(header, h3);
    header.appendChild(h3);
    const maxBtn = document.createElement("button");
    maxBtn.className = "bsai-pp-dlg-maximize";
    maxBtn.innerHTML = "⛶";
    maxBtn.title = "最大化/还原";
    maxBtn.onclick = (e) => {
        e.stopPropagation();
        dialog.classList.toggle("maximized");
        maxBtn.innerHTML = dialog.classList.contains("maximized") ? "🗗" : "⛶";
    };
    header.appendChild(maxBtn);
}

// ── Standalone directory browser (usable from node button) ──────────
function browseDirectoryDialog(initialPath) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "bsai-pp-dialog-overlay";
        const dialog = document.createElement("div");
        dialog.className = "bsai-pp-import-dialog";
        dialog.style.minWidth = "560px";
        dialog.innerHTML = `
            <h3>📁 选择目录</h3>
            <div class="bsai-pp-breadcrumb" data-breadcrumb></div>
            <div style="display:flex;gap:6px;margin-bottom:8px;">
                <input type="text" data-manual-path style="flex:1;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;padding:5px 8px;border-radius:4px;font-size:12px;" placeholder="输入路径后回车前往，如 C:\\Users\\...">
                <button class="bsai-pp-btn" data-act="go">前往</button>
            </div>
            <div class="bsai-pp-import-list" data-dir-list></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
                <button class="bsai-pp-btn" data-cancel>取消</button>
                <button class="bsai-pp-btn bsai-pp-btn-primary" data-select>选择此目录</button>
            </div>`;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        _addMaximizeBtn(dialog);

        let currentPath = "";
        let loadingAbort = null;

        const renderBreadcrumb = (path) => {
            const bcEl = dialog.querySelector("[data-breadcrumb]");
            if (!path) {
                bcEl.innerHTML = `<span class="bsai-pp-breadcrumb-current">💻 我的电脑</span>`;
                return;
            }
            const sep = path.includes("/") ? "/" : "\\";
            const parts = path.split(sep).filter(p => p.length > 0);
            let html = "";
            // Root drive (Windows) or root /
            if (path[1] === ":") {
                const drive = parts[0];
                html += `<span class="bsai-pp-breadcrumb-item" data-bc-path="${drive}\\">💾 ${drive}</span>`;
                parts.shift();
            } else if (path.startsWith("/")) {
                html += `<span class="bsai-pp-breadcrumb-item" data-bc-path="/">💻 根目录</span>`;
            }
            let acc = path[1] === ":" ? parts.length > 0 ? path.split(sep)[0] + "\\" : "" : "/";
            for (let i = 0; i < parts.length; i++) {
                acc = (path[1] === ":" ? acc : "") + (i > 0 || path[1] === ":" ? (path[1] === ":" ? "" : "/") : "") + parts[i];
                if (path[1] === ":") {
                    acc = path.split(sep).slice(0, i + 2).join(sep);
                    if (!acc.endsWith("\\") && !acc.endsWith("/")) acc += "\\";
                } else {
                    acc = "/" + parts.slice(0, i + 1).join("/");
                }
                html += `<span class="bsai-pp-breadcrumb-sep">▸</span>`;
                if (i < parts.length - 1) {
                    html += `<span class="bsai-pp-breadcrumb-item" data-bc-path="${escapeHtml(acc)}">${escapeHtml(parts[i])}</span>`;
                } else {
                    html += `<span class="bsai-pp-breadcrumb-current">${escapeHtml(parts[i])}</span>`;
                }
            }
            bcEl.innerHTML = html;
            bcEl.querySelectorAll("[data-bc-path]").forEach(el => {
                el.onclick = () => loadDirs(el.getAttribute("data-bc-path"));
            });
        };

        const loadDirs = async (path) => {
            if (loadingAbort) { try { loadingAbort.abort(); } catch {} }
            loadingAbort = new AbortController();
            const listEl = dialog.querySelector("[data-dir-list]");
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
                currentPath = data.path || "";
                const isRoot = data.is_root === true;
                renderBreadcrumb(currentPath);
                const manualInput = dialog.querySelector("[data-manual-path]");
                if (manualInput && !manualInput.value && currentPath) manualInput.value = currentPath;
                else if (manualInput && currentPath) manualInput.value = currentPath;
                listEl.innerHTML = "";
                const countEl = document.createElement("div");
                countEl.style.cssText = "color:#888;font-size:11px;padding:4px 10px;border-bottom:1px solid #333;margin-bottom:4px;";
                countEl.textContent = `共 ${data.dirs.length} 个子目录${data.errors?.length ? ` (${data.errors.length} 个无法访问)` : ""}`;
                listEl.appendChild(countEl);
                if (data.dirs.length === 0) {
                    listEl.innerHTML = `<div style="color:#666;padding:10px;">📂 没有子目录</div>`;
                }
                for (const dir of data.dirs) {
                    const item = document.createElement("div");
                    item.className = "bsai-pp-import-item";
                    const icon = isRoot ? "💾" : "📁";
                    item.innerHTML = `<span>${icon}</span><span>${escapeHtml(dir)}</span>`;
                    if (isRoot) {
                        item.ondblclick = () => loadDirs(dir);
                        item.onclick = () => { /* single click selects */ };
                    } else {
                        const fullPath = currentPath + (currentPath.endsWith("\\") || currentPath.endsWith("/") ? "" : "\\") + dir;
                        item.ondblclick = () => loadDirs(fullPath);
                        item.onclick = () => {
                            listEl.querySelectorAll(".bsai-pp-import-item").forEach(i => i.style.background = "");
                            item.style.background = "#3a3a4a";
                        };
                    }
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

// ── File browser dialog (select actual files, not directories) ──────
function browseFilesDialog(initialPath) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "bsai-pp-dialog-overlay";
        const dialog = document.createElement("div");
        dialog.className = "bsai-pp-import-dialog";
        dialog.style.minWidth = "640px";
        dialog.innerHTML = `
            <h3>📂 选择文件（视频/音频/图片）</h3>
            <div class="bsai-pp-breadcrumb" data-breadcrumb></div>
            <div style="display:flex;gap:6px;margin-bottom:8px;">
                <input type="text" data-manual-path style="flex:1;background:#1a1a1a;border:1px solid #444;color:#e0e0e0;padding:5px 8px;border-radius:4px;font-size:12px;" placeholder="输入路径后回车前往">
                <button class="bsai-pp-btn" data-act="go">前往</button>
                <button class="bsai-pp-btn" data-act="up">⬆ 上级</button>
            </div>
            <div class="bsai-pp-import-list" data-file-list></div>
            <div style="display:flex;gap:8px;justify-content:space-between;margin-top:8px;align-items:center;">
                <span data-selected-count style="color:#888;font-size:12px;">未选择文件</span>
                <div style="display:flex;gap:8px;">
                    <button class="bsai-pp-btn" data-cancel>取消</button>
                    <button class="bsai-pp-btn bsai-pp-btn-primary" data-import>导入选中文件</button>
                </div>
            </div>`;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        _addMaximizeBtn(dialog);

        let currentPath = "";
        let currentParent = "";
        let loadingAbort = null;
        const selectedFiles = new Map();

        const FILE_ICONS = { video: "🎬", audio: "🎵", image: "🖼️" };

        const renderBreadcrumb = (path) => {
            const bcEl = dialog.querySelector("[data-breadcrumb]");
            if (!path) {
                bcEl.innerHTML = `<span class="bsai-pp-breadcrumb-current">💻 我的电脑</span>`;
                return;
            }
            const sep = path.includes("/") ? "/" : "\\";
            const parts = path.split(sep).filter(p => p.length > 0);
            let html = "";
            if (path[1] === ":") {
                const drive = parts[0];
                html += `<span class="bsai-pp-breadcrumb-item" data-bc-path="${drive}\\">💾 ${drive}</span>`;
                parts.shift();
            } else if (path.startsWith("/")) {
                html += `<span class="bsai-pp-breadcrumb-item" data-bc-path="/">💻 根目录</span>`;
            }
            for (let i = 0; i < parts.length; i++) {
                let acc;
                if (path[1] === ":") {
                    acc = path.split(sep).slice(0, i + 2).join(sep);
                    if (!acc.endsWith("\\") && !acc.endsWith("/")) acc += "\\";
                } else {
                    acc = "/" + parts.slice(0, i + 1).join("/");
                }
                html += `<span class="bsai-pp-breadcrumb-sep">▸</span>`;
                if (i < parts.length - 1) {
                    html += `<span class="bsai-pp-breadcrumb-item" data-bc-path="${escapeHtml(acc)}">${escapeHtml(parts[i])}</span>`;
                } else {
                    html += `<span class="bsai-pp-breadcrumb-current">${escapeHtml(parts[i])}</span>`;
                }
            }
            bcEl.innerHTML = html;
            bcEl.querySelectorAll("[data-bc-path]").forEach(el => {
                el.onclick = () => loadFiles(el.getAttribute("data-bc-path"));
            });
        };

        const updateSelectedCount = () => {
            const el = dialog.querySelector("[data-selected-count]");
            if (el) {
                el.textContent = selectedFiles.size > 0
                    ? `已选择 ${selectedFiles.size} 个文件`
                    : "未选择文件";
            }
        };

        const loadFiles = async (path) => {
            if (loadingAbort) { try { loadingAbort.abort(); } catch {} }
            loadingAbort = new AbortController();
            const listEl = dialog.querySelector("[data-file-list]");
            listEl.innerHTML = `<div style="color:#666;padding:10px;">⏳ 加载中...</div>`;
            const timeoutId = setTimeout(() => loadingAbort.abort(), 30000);
            try {
                // Try browse_files endpoint first (returns dirs + media files)
                let resp = await api.fetchApi(`/bsai_premiere_pro/browse_files?path=${encodeURIComponent(path)}`, {
                    signal: loadingAbort.signal
                });
                let data = await resp.json();
                // If browse_files fails (e.g. server not restarted), fallback to browse endpoint
                if (data.error && !path) {
                    resp = await api.fetchApi(`/bsai_premiere_pro/browse?path=${encodeURIComponent(path)}`, {
                        signal: loadingAbort.signal
                    });
                    data = await resp.json();
                    // browse endpoint returns dirs only, add empty files array
                    if (!data.error) {
                        data.files = [];
                    }
                }
                clearTimeout(timeoutId);
                if (data.error) {
                    listEl.innerHTML = `<div style="color:#d35454;padding:10px;">❌ ${escapeHtml(data.error)}<br><button class="bsai-pp-btn" style="margin-top:6px;" data-retry>重试</button></div>`;
                    listEl.querySelector("[data-retry]")?.addEventListener("click", () => loadFiles(path));
                    return;
                }
                currentPath = data.path || "";
                currentParent = data.parent || "";
                renderBreadcrumb(currentPath);
                const manualInput = dialog.querySelector("[data-manual-path]");
                if (manualInput && currentPath) manualInput.value = currentPath;
                listEl.innerHTML = "";

                // Count info
                const countEl = document.createElement("div");
                countEl.style.cssText = "color:#888;font-size:11px;padding:4px 10px;border-bottom:1px solid #333;margin-bottom:4px;";
                const dirCount = data.dirs?.length || 0;
                const fileCount = data.files?.length || 0;
                countEl.textContent = `📁 ${dirCount} 个子目录  |  📄 ${fileCount} 个媒体文件`;
                listEl.appendChild(countEl);

                // Directories
                for (const dir of (data.dirs || [])) {
                    const item = document.createElement("div");
                    item.className = "bsai-pp-import-item";
                    item.innerHTML = `<span>📁</span><span>${escapeHtml(dir)}</span>`;
                    const fullPath = currentPath + (currentPath.endsWith("\\") || currentPath.endsWith("/") ? "" : "\\") + dir;
                    item.ondblclick = () => loadFiles(fullPath);
                    item.onclick = () => {
                        listEl.querySelectorAll(".bsai-pp-import-item").forEach(i => i.style.background = "");
                        item.style.background = "#3a3a4a";
                    };
                    listEl.appendChild(item);
                }

                // Files
                for (const file of (data.files || [])) {
                    const item = document.createElement("div");
                    item.className = "bsai-pp-import-item";
                    const icon = FILE_ICONS[file.type] || "📄";
                    const sizeStr = file.size > 1024 * 1024
                        ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                        : `${(file.size / 1024).toFixed(0)} KB`;
                    item.innerHTML = `<span>${icon}</span><span>${escapeHtml(file.name)}</span><span class="size">${sizeStr}</span>`;
                    item.style.cursor = "pointer";
                    if (selectedFiles.has(file.path)) {
                        item.style.background = "#4a90d9";
                    }
                    item.onclick = (e) => {
                        if (selectedFiles.has(file.path)) {
                            selectedFiles.delete(file.path);
                            item.style.background = "";
                        } else {
                            selectedFiles.set(file.path, file);
                            item.style.background = "#4a90d9";
                        }
                        updateSelectedCount();
                    };
                    listEl.appendChild(item);
                }

                if (dirCount === 0 && fileCount === 0) {
                    listEl.innerHTML += `<div style="color:#666;padding:10px;">📂 没有子目录或媒体文件</div>`;
                }
            } catch (e) {
                clearTimeout(timeoutId);
                if (e.name === "AbortError") {
                    listEl.innerHTML = `<div style="color:#d35454;padding:10px;">⏱ 加载超时，请尝试手动输入路径<br><button class="bsai-pp-btn" style="margin-top:6px;" data-retry>重试</button></div>`;
                } else {
                    listEl.innerHTML = `<div style="color:#d35454;padding:10px;">❌ 加载失败: ${escapeHtml(e.message)}<br><button class="bsai-pp-btn" style="margin-top:6px;" data-retry>重试</button></div>`;
                }
                listEl.querySelector("[data-retry]")?.addEventListener("click", () => loadFiles(path));
            }
        };

        loadFiles(initialPath || "");

        const manualInput = dialog.querySelector("[data-manual-path]");
        const goToPath = () => {
            const val = manualInput.value.trim();
            if (val) loadFiles(val);
        };
        dialog.querySelector("[data-act='go']").onclick = goToPath;
        manualInput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); goToPath(); } };
        dialog.querySelector("[data-act='up']").onclick = () => {
            if (currentParent) loadFiles(currentParent);
        };

        dialog.querySelector("[data-cancel]").onclick = () => {
            if (loadingAbort) { try { loadingAbort.abort(); } catch {} }
            overlay.remove();
            resolve(null);
        };
        dialog.querySelector("[data-import]").onclick = () => {
            if (loadingAbort) { try { loadingAbort.abort(); } catch {} }
            overlay.remove();
            resolve(selectedFiles.size > 0 ? [...selectedFiles.values()] : null);
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

    _autoLinkAndAlign(td) {
        if (!td.clips || td.clips.length === 0) return;
        const allVideos = td.clips.filter(c => c.track_type === "video");
        const unlinkedAudios = td.clips.filter(c => c.track_type === "audio" && !c.linked_id && !c.is_gap);
        const removedAudioIds = new Set();
        for (const audio of unlinkedAudios) {
            let audioBase = (audio.file_name || "").replace(/\.[^.]+$/, "");
            audioBase = audioBase.replace(/[-_]audio[-_]?\d*$/i, "");
            let matchedVideo = null;
            // First try unlinked videos
            for (const video of allVideos) {
                if (video.linked_id) continue;
                let videoBase = (video.file_name || "").replace(/\.[^.]+$/, "");
                if (videoBase === audioBase) { matchedVideo = video; break; }
            }
            // Then try linked videos (replace embedded audio)
            if (!matchedVideo) {
                for (const video of allVideos) {
                    if (!video.linked_id) continue;
                    let videoBase = (video.file_name || "").replace(/\.[^.]+$/, "");
                    if (videoBase === audioBase) {
                        const oldAudio = td.clips.find(c => c.id === video.linked_id);
                        if (oldAudio) { oldAudio.linked_id = null; removedAudioIds.add(oldAudio.id); }
                        matchedVideo = video;
                        break;
                    }
                }
            }
            if (matchedVideo) {
                matchedVideo.linked_id = audio.id;
                audio.linked_id = matchedVideo.id;
                audio.trim_start = matchedVideo.trim_start;
                audio.trim_end = matchedVideo.trim_end;
                audio.transition_in = matchedVideo.transition_in;
                audio.transition_out = matchedVideo.transition_out;
                audio.transition_duration = matchedVideo.transition_duration;
            }
        }
        // Remove replaced embedded audio clips
        if (removedAudioIds.size > 0) {
            td.clips = td.clips.filter(c => !removedAudioIds.has(c.id));
        }
        const videoClips = td.clips.filter(c => c.track_type === "video");
        // Remove old gap clips first to prevent accumulation
        td.clips = td.clips.filter(c => !c.is_gap);
        const allAudioClips = td.clips.filter(c => c.track_type === "audio" && !c.is_gap);
        const usedAudioIds = new Set();
        const newClips = [];
        // Place unlinked audio at the beginning (aligned with first video)
        const remainingUnlinked = allAudioClips.filter(a => !a.linked_id);
        for (const aClip of remainingUnlinked) {
            newClips.push(aClip);
            usedAudioIds.add(aClip.id);
        }
        for (const vClip of videoClips) {
            newClips.push(vClip);
            const vDur = (vClip.trim_end - vClip.trim_start) || 0;
            if (vClip.linked_id) {
                const aClip = allAudioClips.find(c => c.id === vClip.linked_id);
                if (aClip && !usedAudioIds.has(aClip.id)) {
                    newClips.push(aClip);
                    usedAudioIds.add(aClip.id);
                    continue;
                }
            }
            newClips.push({
                id: `gap_${vClip.id}_${Date.now()}`,
                track_type: "audio", track_index: 0,
                file_path: null, file_name: "(gap)",
                duration: vDur, trim_start: 0, trim_end: vDur,
                is_gap: true, linked_id: null,
                transition_in: "cut", transition_out: "cut", transition_duration: 0,
            });
        }
        td.clips = newClips;
    }

    async addNewFiles(files) {
        let td;
        try { td = JSON.parse(this.node.properties?.bsai_td || '{}'); } catch { td = { clips: [], known_files: [], filter_audio_only: false }; }
        if (!td.clips) td.clips = [];
        if (!td.known_files) td.known_files = [];
        if (!td.deleted_files) td.deleted_files = [];
        if (td.filter_audio_only === undefined) td.filter_audio_only = false;
        if (!td.video_tracks) td.video_tracks = [{ name: "V1", locked: false, visible: true }];
        if (!td.audio_tracks) td.audio_tracks = [{ name: "A1", locked: false, muted: false, solo: false }];
        if (td.clips.length > 0 && !td.clips[0].track_type) {
            const editor = importerMap.get(this.node.id)?._editor;
            if (editor) td.clips = editor._migrateClips(td.clips);
        }
        const known = new Set(td.known_files);
        const deleted = new Set(td.deleted_files);
        const newFiles = files.filter(f => !known.has(f.file_name) && !deleted.has(f.file_name));
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
                const isAudioOnly = /\.(mp3|wav|aac|flac|ogg|m4a|wma|opus)$/i.test(file.file_name || "");
                const hasAudioSuffix = /[-_]audio[-_]?\d*\.\w+$/i.test(file.file_name || "");
                const hasVideoStream = (meta.width || 0) > 0 && (meta.height || 0) > 0;
                const treatAsAudioOnly = (isAudioOnly || hasAudioSuffix) && !hasVideoStream;
                const isImage = /\.(png|jpg|jpeg|bmp|gif|webp|tiff?|svg)$/i.test(file.file_name || "");
                const hasAudio = meta.has_audio || false;
                const clipDuration = isImage ? 5 : (meta.duration || 0);
                const base = {
                    file_path: file.file_path, file_name: file.file_name,
                    created_time: file.created_time, duration: clipDuration,
                    width: meta.width || (treatAsAudioOnly ? 0 : 1920), height: meta.height || (treatAsAudioOnly ? 0 : 1080), fps: meta.fps || 30,
                    has_audio: hasAudio,
                    trim_start: 0, trim_end: clipDuration,
                    transition_in: "cut", transition_out: "cut", transition_duration: 0.5,
                    audio_replacement: null, audio_fade_in: 0, audio_fade_out: 0,
                    video_enabled: true, audio_enabled: true,
                };
                if (treatAsAudioOnly) {
                    td.clips.push({ ...base, id: aId, track_type: "audio", track_index: 0, linked_id: null, is_video_part: false });
                } else if (isImage || !hasAudio) {
                    td.clips.push({ ...base, id: vId, track_type: "video", track_index: 0, linked_id: null, is_video_part: true, is_image: isImage || undefined });
                } else {
                    td.clips.push({ ...base, id: vId, track_type: "video", track_index: 0, linked_id: aId, is_video_part: true });
                    td.clips.push({ ...base, id: aId, track_type: "audio", track_index: 0, linked_id: vId, is_video_part: false });
                }
                td.known_files.push(file.file_name);
            } catch (e) {
                console.error("[BSAI PP] Failed to add file:", file.file_name, e);
            }
        }
        // Auto-link by name pattern and align audio to video order
        this._autoLinkAndAlign(td);

        // Re-read latest td to handle concurrent modifications (e.g., user cleared tracks during async metadata fetch)
        let latestTd = null;
        try {
            const raw = this.node.properties?.bsai_td;
            if (raw) latestTd = JSON.parse(raw);
        } catch { /* ignore */ }
        if (latestTd) {
            // Merge any deleted_files added during async operations
            if (latestTd.deleted_files) {
                const latestDeleted = new Set(latestTd.deleted_files);
                for (const fn of td.deleted_files) latestDeleted.add(fn);
                td.deleted_files = Array.from(latestDeleted);
                // Remove any clips that were deleted during async operations
                td.clips = td.clips.filter(c => !latestDeleted.has(c.file_name));
                td.known_files = td.known_files.filter(f => !latestDeleted.has(f));
            }
            // Preserve clips and known_files from latest td if user cleared them
            if (latestTd.clips.length === 0 && td.clips.length > 0) {
                // User cleared all clips during our async operations - respect that
                // But keep only clips we just added that aren't in deleted_files
            }
            // Merge any directory_history changes
            if (latestTd.directory_history) {
                td.directory_history = { ...latestTd.directory_history, ...(td.directory_history || {}) };
            }
        }

        const tdJson = JSON.stringify(td);
        if (!this.node.properties) this.node.properties = {};
        this.node.properties.bsai_td = tdJson;
        this.updateNodeTitle(td);
        api.fetchApi("/bsai_premiere_pro/timeline_save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ node_id: String(this.node.id), timeline_data: tdJson }),
        }).catch(() => {});
        if (this._editor) this._editor.refresh();
    }

    setEditor(editor) { this._editor = editor; }

    updateNodeTitle(td) {
        const vClips = td.clips.filter(c => c.track_type === "video" || !c.track_type);
        const count = vClips.length;
        const total = vClips.reduce((s, c) => s + (c.trim_end - c.trim_start), 0);
        // Check port connection state for mode label
        const imageConnected = this.node.inputs?.some(i => i.name === "image" && i.link != null);
        const audioConnected = this.node.inputs?.some(i => i.name === "audio" && i.link != null);
        const modeLabel = (imageConnected && audioConnected) ? "⚡自动" : "✋手动";
        if (count > 0) {
            this.node.title = `🎬 BSAI Premiere Pro (${count} clips / ${formatTime(total)}) [${modeLabel}]`;
        } else {
            this.node.title = `🎬 BSAI Premiere Pro [${modeLabel}]`;
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
        this.scissorMode = false;
        this.boxSelected = new Set();
        this.thumbCache = new Map();
        this._zoomLevel = 1;
        this._isPlaying = false;
        this._playClips = [];
        this._playClipIndex = 0;
        this._pausedClip = null;
        this._pausedVideoTime = null;
        this._previewVideoActive = false;
        this._startClipIndex = 0;
        this._playheadTime = null;
        this.td = this._load();
    }

    _load() {
        const val = this.node.properties?.bsai_td;
        if (val) {
            try {
                const td = JSON.parse(val);
                if (!td.clips) td.clips = [];
                if (!td.known_files) td.known_files = [];
                if (!td.deleted_files) td.deleted_files = [];
                if (!td.directory_history) td.directory_history = {};
                if (td.filter_audio_only === undefined) td.filter_audio_only = false;
                if (!td.video_tracks) td.video_tracks = [{ name: "V1", locked: false, visible: true }];
                if (!td.audio_tracks) td.audio_tracks = [{ name: "A1", locked: false, muted: false, solo: false }];
                if (td.clips.length > 0 && !td.clips[0].track_type) {
                    td.clips = this._migrateClips(td.clips);
                }
                return td;
            } catch { /* fall through */ }
        }
        return {
            clips: [], known_files: [], deleted_files: [], directory_history: {},
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
                transition_in: old.transition_in || "cut", transition_out: old.transition_out || "cut",
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
        const json = JSON.stringify(this.td);
        if (!this.node.properties) this.node.properties = {};
        this.node.properties.bsai_td = json;
        const importer = importerMap.get(this.node.id);
        if (importer) importer.updateNodeTitle(this.td);
        api.fetchApi("/bsai_premiere_pro/timeline_save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ node_id: String(this.node.id), timeline_data: json }),
        }).catch(() => {});
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
        this._stopPlayback();
        if (this._docKeydown) {
            document.removeEventListener("keydown", this._docKeydown);
            this._docKeydown = null;
        }
        if (this._dragCleanup) {
            this._dragCleanup();
            this._dragCleanup = null;
        }
        if (this._dividerCleanup) {
            this._dividerCleanup();
            this._dividerCleanup = null;
        }
        this.batchMode = false;
        this.batchSelected.clear();
        this.scissorMode = false;
        this.boxSelected.clear();
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
        // Always remove old styles and re-inject fresh to ensure latest CSS is applied
        const existing = document.getElementById("bsai-pp-styles");
        if (existing) existing.remove();
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
                    <div style="display:flex;gap:6px;">
                        <button class="bsai-pp-close bsai-pp-dlg-maximize" data-act="maximize" title="最大化/还原">⛶</button>
                        <button class="bsai-pp-close" data-act="close" title="关闭">✕</button>
                    </div>
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
                    <button class="bsai-pp-btn" data-act="manual-import">📥 导入文件</button>
                    <button class="bsai-pp-btn" data-act="dir-history">📚 历史目录</button>
                    <button class="bsai-pp-btn" data-act="scissor" id="bsai-pp-scissor-btn">✂️ 剪刀</button>
                    <button class="bsai-pp-btn" data-act="play" id="bsai-pp-play-btn">▶️ 播放</button>
                    <button class="bsai-pp-btn" data-act="add-vtrack">＋ 视频轨道</button>
                    <button class="bsai-pp-btn" data-act="add-atrack">＋ 音频轨道</button>
                    <button class="bsai-pp-btn bsai-pp-btn-danger" data-act="clear-all">🗑 清空全部</button>
                    <button class="bsai-pp-btn" data-act="batch-select" id="bsai-pp-batch-btn">☑ 批量选择</button>
                    <label>对齐</label>
                    <select class="bsai-pp-align-select" data-act="align-mode" title="横竖屏对齐方式">
                        <option value="height">高度对齐</option>
                        <option value="width">宽度对齐</option>
                    </select>
                    <button class="bsai-pp-btn" data-act="zoom-out" style="padding:3px 8px;font-size:14px;">－</button>
                    <span class="bsai-pp-zoom-display" data-zoom-display>100%</span>
                    <button class="bsai-pp-btn" data-act="zoom-in" style="padding:3px 8px;font-size:14px;">＋</button>
                    <div class="bsai-pp-status">
                        <span><span class="dot ${this._getWidgetValue("auto_import", true) ? "on" : "off"}" data-dot></span> ${this._getWidgetValue("auto_import", true) ? "监控中" : "已停止"}</span>
                    </div>
                </div>
                <div class="bsai-pp-body">
                    <div class="bsai-pp-timeline-section" style="position:relative;">
                        <div class="bsai-pp-timeline-scroll" data-timeline-scroll>
                            <div class="bsai-pp-timeline-container" data-track-container></div>
                        </div>
                    </div>
                    <div class="bsai-pp-divider" data-divider title="拖拽调整面板比例"></div>
                    <div class="bsai-pp-edit-section">
                        <div class="bsai-pp-section-label">剪辑面板</div>
                        <div class="bsai-pp-edit-content" data-edit></div>
                    </div>
                </div>
                <div class="bsai-pp-footer">
                    <div class="bsai-pp-footer-info" data-footer-info></div>
                    <button class="bsai-pp-btn bsai-pp-btn-primary" data-act="render">🎞️ 渲染输出</button>
                </div>
                <div class="bsai-pp-timeline-preview" data-timeline-preview>
                    <video data-preview-video></video>
                    <button class="preview-enlarge" data-act="enlarge-preview" title="放大/缩小">⛶</button>
                    <button class="preview-close" data-act="close-preview">✕</button>
                    <div class="preview-info" data-preview-info></div>
                    <div class="preview-zoom-info" data-preview-zoom-info></div>
                    <div class="preview-progress" data-preview-progress></div>
                </div>
            </div>`;
        this.modal.addEventListener("click", (e) => this._onClick(e));
        this.modal.querySelector('[data-act="close"]').onclick = () => this.close();
        this.modal.querySelector('[data-act="maximize"]').onclick = (e) => {
            e.stopPropagation();
            const modalEl = this.modal.querySelector(".bsai-pp-modal");
            const btn = e.currentTarget;
            const isMax = modalEl.classList.toggle("maximized");
            btn.innerHTML = isMax ? "🗗" : "⛶";
            if (!isMax) {
                // Restore: re-center the modal
                modalEl.style.left = "2.5vw";
                modalEl.style.top = "4vh";
                modalEl.style.width = "95vw";
                modalEl.style.height = "92vh";
                modalEl.style.maxWidth = "100vw";
                modalEl.style.maxHeight = "100vh";
            }
        };

        // ── Window dragging via header ──
        const modalEl = this.modal.querySelector(".bsai-pp-modal");
        const headerEl = this.modal.querySelector(".bsai-pp-header");
        // Center the modal initially
        modalEl.style.left = "2.5vw";
        modalEl.style.top = "4vh";

        if (headerEl && modalEl) {
            let isDragging = false;
            let dragStartX = 0, dragStartY = 0;
            let modalStartLeft = 0, modalStartTop = 0;

            headerEl.addEventListener("mousedown", (e) => {
                // Don't drag when clicking buttons in the header
                if (e.target.closest("button") || e.target.closest("[data-act]")) return;
                if (modalEl.classList.contains("maximized")) return;
                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                modalStartLeft = modalEl.offsetLeft;
                modalStartTop = modalEl.offsetTop;
                headerEl.style.userSelect = "none";
                e.preventDefault();
            });

            const onMove = (e) => {
                if (!isDragging) return;
                const deltaX = e.clientX - dragStartX;
                const deltaY = e.clientY - dragStartY;
                let newLeft = modalStartLeft + deltaX;
                let newTop = modalStartTop + deltaY;
                // Allow some overflow but keep at least part of the header visible
                newLeft = Math.max(-modalEl.offsetWidth + 100, Math.min(window.innerWidth - 100, newLeft));
                newTop = Math.max(0, Math.min(window.innerHeight - 40, newTop));
                modalEl.style.left = newLeft + "px";
                modalEl.style.top = newTop + "px";
            };

            const onUp = () => {
                isDragging = false;
                headerEl.style.userSelect = "";
            };

            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
            // Store references for cleanup on close
            this._dragCleanup = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
            };
        }

        // Mouse wheel on header to resize modal (without Ctrl; Ctrl+wheel = timeline zoom)
        if (headerEl) {
            headerEl.addEventListener("wheel", (e) => {
                e.preventDefault();
                if (!modalEl || modalEl.classList.contains("maximized")) return;
                const factor = e.deltaY < 0 ? 1.05 : 0.95;
                const curW = modalEl.offsetWidth;
                const curH = modalEl.offsetHeight;
                const newW = Math.max(600, Math.min(window.innerWidth, curW * factor));
                const newH = Math.max(400, Math.min(window.innerHeight, curH * factor));
                modalEl.style.width = newW + "px";
                modalEl.style.height = newH + "px";
                modalEl.style.maxWidth = "none";
                modalEl.style.maxHeight = "none";
            }, { passive: false });
        }

        // ── Draggable divider between timeline and edit panel ──
        const dividerEl = this.modal.querySelector("[data-divider]");
        if (dividerEl) {
            let divDragging = false;
            let divStartY = 0;
            let divTimelineStartH = 0;
            let divEditStartH = 0;

            dividerEl.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();
                divDragging = true;
                divStartY = e.clientY;
                dividerEl.classList.add("dragging");
                document.body.style.cursor = "ns-resize";
                document.body.style.userSelect = "none";

                const bodyEl = this.modal.querySelector(".bsai-pp-body");
                const timelineEl = this.modal.querySelector(".bsai-pp-timeline-section");
                const editEl = this.modal.querySelector(".bsai-pp-edit-section");
                if (bodyEl && timelineEl && editEl) {
                    // Switch from flex to explicit height for manual control
                    divTimelineStartH = timelineEl.offsetHeight;
                    divEditStartH = editEl.offsetHeight;
                    timelineEl.style.flex = "none";
                    timelineEl.style.height = divTimelineStartH + "px";
                }
            });

            const onDivMove = (e) => {
                if (!divDragging) return;
                e.preventDefault();
                const bodyEl = this.modal.querySelector(".bsai-pp-body");
                const timelineEl = this.modal.querySelector(".bsai-pp-timeline-section");
                const editEl = this.modal.querySelector(".bsai-pp-edit-section");
                if (!bodyEl || !timelineEl || !editEl) return;

                const bodyH = bodyEl.offsetHeight;
                const delta = e.clientY - divStartY;
                let newTimelineH = divTimelineStartH + delta;
                let newEditH = divEditStartH - delta;

                // Enforce minimums: timeline >= 120px, edit >= 200px
                const MIN_TIMELINE = 120;
                const MIN_EDIT = 200;
                if (newTimelineH < MIN_TIMELINE) {
                    newTimelineH = MIN_TIMELINE;
                    newEditH = bodyH - MIN_TIMELINE - 6; // 6px divider
                }
                if (newEditH < MIN_EDIT) {
                    newEditH = MIN_EDIT;
                    newTimelineH = bodyH - MIN_EDIT - 6;
                }

                timelineEl.style.height = newTimelineH + "px";
                editEl.style.height = newEditH + "px";
                editEl.style.flex = "none";
            };

            const onDivUp = () => {
                if (!divDragging) return;
                divDragging = false;
                dividerEl.classList.remove("dragging");
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
            };

            document.addEventListener("mousemove", onDivMove);
            document.addEventListener("mouseup", onDivUp);

            // Double-click to reset to default proportions
            dividerEl.addEventListener("dblclick", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const timelineEl = this.modal.querySelector(".bsai-pp-timeline-section");
                const editEl = this.modal.querySelector(".bsai-pp-edit-section");
                if (timelineEl && editEl) {
                    timelineEl.style.flex = "1";
                    timelineEl.style.height = "";
                    editEl.style.flex = "";
                    editEl.style.height = "260px";
                }
            });

            // Store cleanup
            this._dividerCleanup = () => {
                document.removeEventListener("mousemove", onDivMove);
                document.removeEventListener("mouseup", onDivUp);
            };
        }

        this.modal.querySelector('[data-act="close-preview"]').onclick = (e) => {
            e.stopPropagation();
            const overlay = this.modal.querySelector("[data-timeline-preview]");
            if (overlay) {
                overlay.classList.remove("visible", "fullscreen");
                overlay.style.cssText = "";
                const enlargeBtn = this.modal.querySelector('[data-act="enlarge-preview"]');
                if (enlargeBtn) enlargeBtn.textContent = "⛶";
            }
            const video = this.modal.querySelector("[data-preview-video]");
            if (video) {
                video.pause();
                video.ontimeupdate = null;
                video.onended = null;
                video.onloadedmetadata = null;
                video.style.transform = "";
                video.style.width = "";
                video.style.height = "";
                video.style.objectFit = "";
            }
            this._previewVideoActive = false;
            this._previewZoom = 1;
            this._stopPlayback();
        };
        this.modal.querySelector('[data-act="enlarge-preview"]').onclick = (e) => {
            e.stopPropagation();
            const overlay = this.modal.querySelector("[data-timeline-preview]");
            if (!overlay) return;
            // Toggle between fullscreen and windowed mode
            if (overlay.classList.contains("fullscreen")) {
                // Switch to windowed (small) mode
                overlay.classList.remove("fullscreen");
                overlay.style.width = "60%";
                overlay.style.height = "70%";
                overlay.style.top = "50%";
                overlay.style.left = "50%";
                overlay.style.transform = "translate(-50%,-50%)";
                overlay.style.borderRadius = "8px";
                overlay.style.boxShadow = "0 4px 20px rgba(0,0,0,0.6)";
                e.target.textContent = "⛶";
            } else {
                // Switch back to fullscreen mode
                overlay.classList.add("fullscreen");
                overlay.style.cssText = "";
                e.target.textContent = "🗗";
            }
        };
        // Mouse wheel to zoom preview video
        const previewOverlay = this.modal.querySelector("[data-timeline-preview]");
        const previewVideo = this.modal.querySelector("[data-preview-video]");
        if (previewOverlay && previewVideo) {
            this._previewZoom = 1;
            const wheelHandler = (e) => {
                if (!this._previewVideoActive) return;
                e.preventDefault();
                e.stopPropagation();
                const delta = e.deltaY < 0 ? 1.1 : 0.9;
                this._previewZoom = Math.max(0.5, Math.min(5, this._previewZoom * delta));
                previewVideo.style.transform = `scale(${this._previewZoom})`;
                previewVideo.style.transformOrigin = "center center";
                const zoomInfo = this.modal.querySelector("[data-preview-zoom-info]");
                if (zoomInfo) {
                    zoomInfo.textContent = `缩放: ${Math.round(this._previewZoom * 100)}%`;
                    zoomInfo.classList.add("visible");
                    clearTimeout(this._zoomInfoTimer);
                    this._zoomInfoTimer = setTimeout(() => zoomInfo.classList.remove("visible"), 1500);
                }
            };
            previewOverlay.addEventListener("wheel", wheelHandler, { passive: false });
            previewVideo.addEventListener("wheel", wheelHandler, { passive: false });
        }
        this.modal.querySelector('[data-act="zoom-in"]').onclick = () => this._adjustZoom(1.25);
        this.modal.querySelector('[data-act="zoom-out"]').onclick = () => this._adjustZoom(0.8);
        this.modal.querySelector('[data-act="align-mode"]').onchange = (e) => {
            this.td.align_mode = e.target.value;
            this._save();
            this._renderTimeline();
        };
        // Restore align mode from saved state
        const alignSelect = this.modal.querySelector('[data-act="align-mode"]');
        if (alignSelect && this.td.align_mode) alignSelect.value = this.td.align_mode;
        // Mouse wheel zoom on timeline - plain wheel = zoom, Shift+wheel = scroll
        const timelineScroll = this.modal.querySelector("[data-timeline-scroll]");
        if (timelineScroll) {
            timelineScroll.addEventListener("wheel", (e) => {
                if (e.shiftKey) {
                    // Shift+wheel: horizontal scroll, let default behavior
                    return;
                }
                // Plain wheel (or Ctrl+wheel): zoom timeline
                e.preventDefault();
                this._adjustZoom(e.deltaY < 0 ? 1.15 : 0.87);
            }, { passive: false });
        }
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
        this.modal.querySelector('[data-act="dir-history"]').onclick = (e) => this._showDirHistory(e);
        this.modal.querySelector('[data-act="scissor"]').onclick = () => this._toggleScissorMode();
        this.modal.querySelector('[data-act="play"]').onclick = () => this._togglePlayback();
        // Spacebar to play/pause - listen on document, only when editor is open
        this._docKeydown = (e) => {
            if (!this.modal || !document.body.contains(this.modal)) return;
            if (e.key === " " || e.code === "Space") {
                // Don't intercept when typing in input/textarea
                const tag = e.target?.tagName?.toLowerCase();
                if (tag === "input" || tag === "textarea" || tag === "select") return;
                e.preventDefault();
                // If preview video is active (after render), spacebar controls preview
                if (this._previewVideoActive) {
                    const previewVideo = this.modal.querySelector("[data-preview-video]");
                    if (previewVideo) {
                        if (previewVideo.paused) {
                            previewVideo.play().catch(() => {});
                        } else {
                            previewVideo.pause();
                        }
                    }
                } else {
                    this._togglePlayback();
                }
            }
            if (e.key === "Escape") this.close();
            // Delete key: delete selected clip
            if ((e.key === "Delete" || e.key === "Backspace") && !this._previewVideoActive) {
                const tag = e.target?.tagName?.toLowerCase();
                if (tag === "input" || tag === "textarea" || tag === "select") return;
                if (this.selectedIndex >= 0) {
                    e.preventDefault();
                    this._deleteClip(this.selectedIndex);
                }
            }
            // Don't intercept when typing in input/textarea
            const tag = e.target?.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select") return;
            // Home: jump to first frame
            if (e.key === "Home") {
                e.preventDefault();
                this._playheadTime = 0;
                this._renderTimelinePlayhead();
                this._scrollToPlayhead();
            }
            // End: jump to last frame
            if (e.key === "End") {
                e.preventDefault();
                const vClips = this.td.clips.filter(c => c.track_type === "video");
                if (vClips.length > 0) {
                    let totalDur = 0;
                    for (const c of vClips) totalDur += (c.trim_end - c.trim_start);
                    this._playheadTime = Math.max(0, totalDur - 0.001);
                    this._renderTimelinePlayhead();
                    this._scrollToPlayhead();
                }
            }
            // Arrow left: go back 1 frame
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                const fps = this._getCurrentFps();
                if (this._playheadTime === null) this._playheadTime = 0;
                this._playheadTime = Math.max(0, this._playheadTime - 1 / fps);
                this._renderTimelinePlayhead();
                this._scrollToPlayhead();
            }
            // Arrow right: go forward 1 frame
            if (e.key === "ArrowRight") {
                e.preventDefault();
                const fps = this._getCurrentFps();
                if (this._playheadTime === null) this._playheadTime = 0;
                const vClips = this.td.clips.filter(c => c.track_type === "video");
                let totalDur = 0;
                for (const c of vClips) totalDur += (c.trim_end - c.trim_start);
                this._playheadTime = Math.min(totalDur, this._playheadTime + 1 / fps);
                this._renderTimelinePlayhead();
                this._scrollToPlayhead();
            }
            // Arrow up: zoom in timeline
            if (e.key === "ArrowUp") {
                e.preventDefault();
                this._adjustZoom(1.2);
            }
            // Arrow down: zoom out timeline
            if (e.key === "ArrowDown") {
                e.preventDefault();
                this._adjustZoom(0.83);
            }
        };
        document.addEventListener("keydown", this._docKeydown);
        this.modal.querySelector('[data-act="browse-dir"]').onclick = () => this._browseDirectory();
        this.modal.querySelector('[data-act="add-vtrack"]').onclick = () => this._addVideoTrack();
        this.modal.querySelector('[data-act="add-atrack"]').onclick = () => this._addAudioTrack();
        this.modal.querySelector('[data-act="clear-all"]').onclick = () => this._clearAllClips();
        this.modal.querySelector('[data-act="batch-select"]').onclick = () => this._toggleBatchMode();
        this.modal.querySelector('[data-act="render"]').onclick = () => this._renderVideo();
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
        // Apply zoom level to pixels-per-second
        this._pps = Math.max(6, Math.min(30, availableWidth / totalDuration)) * (this._zoomLevel || 1);
        this._totalDuration = totalDuration;

        const ruler = document.createElement("div");
        ruler.className = "bsai-pp-time-ruler";
        const rulerWidth = Math.round((maxDuration + 10) * (this._pps || 15));
        ruler.innerHTML = `<div class="bsai-pp-ruler-spacer"></div><div class="bsai-pp-ruler-marks" style="min-width:${rulerWidth}px">${this._renderRulerMarks(maxDuration)}</div>`;
        container.appendChild(ruler);

        // Click on ruler to set playhead position
        const rulerMarks = ruler.querySelector(".bsai-pp-ruler-marks");
        if (rulerMarks) {
            rulerMarks.style.cursor = "pointer";
            rulerMarks.addEventListener("click", (e) => {
                const rect = rulerMarks.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const pps = this._pps || 15;
                const scrollContainer = this.modal.querySelector("[data-timeline-scroll]");
                const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
                const totalX = x + scrollLeft;
                this._playheadTime = totalX / pps;
                if (!this._isPlaying) {
                    const inlineVideo = this.modal.querySelector(".bsai-pp-inline-video");
                    if (inlineVideo) this._stopPlayback();
                }
                this._renderTimelinePlayhead();
                if (this.scissorMode) {
                    this._cutAtPlayhead();
                }
            });
        }

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
        // Auto-load thumbnails after timeline render so they always appear
        this._loadThumbnails();
        // Render persistent playhead if set
        this._renderTimelinePlayhead();
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

    _adjustZoom(factor) {
        const old = this._zoomLevel || 1;
        this._zoomLevel = Math.max(0.2, Math.min(20, old * factor));
        if (Math.abs(this._zoomLevel - old) < 0.01) return;
        const display = this.modal.querySelector("[data-zoom-display]");
        if (display) display.textContent = Math.round(this._zoomLevel * 100) + "%";

        // Check if playback is active — save state to restore after re-render
        const wasPlaying = this._isPlaying;

        // Preserve scroll center: focus on playhead, selected clip, or view center
        const scrollContainer = this.modal.querySelector("[data-timeline-scroll]");
        const oldPps = this._pps || 15;
        let focusTime = 0;
        if (scrollContainer) {
            if (this._playheadTime !== null && this._playheadTime !== undefined) {
                focusTime = this._playheadTime;
            } else if (this.selectedIndex >= 0 && this.td.clips[this.selectedIndex]) {
                const clip = this.td.clips[this.selectedIndex];
                const sameTypeClips = this.td.clips.filter(c => c.track_type === clip.track_type);
                const idx = sameTypeClips.indexOf(clip);
                let startTime = 0;
                for (let i = 0; i < idx; i++) {
                    startTime += (sameTypeClips[i].trim_end - sameTypeClips[i].trim_start);
                }
                focusTime = startTime + (clip.trim_end - clip.trim_start) / 2;
            } else {
                const visW = scrollContainer.clientWidth || 800;
                focusTime = (scrollContainer.scrollLeft + visW / 2) / oldPps;
            }
        }

        // Stop playback before re-rendering (re-render destroys inline video)
        if (wasPlaying) this._stopPlayback();

        this._renderTimeline();

        // After render, scroll to keep focusTime centered
        if (scrollContainer) {
            const newPps = this._pps || 15;
            const SPACER_W = 150;
            const newCenterPx = SPACER_W + focusTime * newPps;
            const visW = scrollContainer.clientWidth || 800;
            scrollContainer.scrollLeft = Math.max(0, newCenterPx - visW / 2);
        }

        // Restore playback from the current playhead position
        if (wasPlaying) {
            this._isPlaying = false;
            this._pausedClip = null;
            this._pausedVideoTime = null;
            this._playStartOffset = null;
            this._startPlayback();
        }
    }

    // Calculate dynamic track heights based on zoom level and available space
    _getTrackHeights() {
        const zoom = this._zoomLevel || 1;
        // Base heights at zoom=1
        const baseVideoH = 90;
        const baseAudioH = 40;
        // Scale video height with zoom linearly for bigger growth
        let videoH = Math.round(baseVideoH * zoom);
        let audioH = Math.round(baseAudioH * Math.max(1, zoom * 0.6));
        // Cap at generous maximums
        videoH = Math.min(videoH, 1000);
        audioH = Math.min(audioH, 300);
        return { videoH, audioH };
    }

    _createTrackRow(trackType, trackIndex, trackInfo) {
         const row = document.createElement("div");
        const isVideo = trackType === "video";
        row.className = "bsai-pp-track-row" + (isVideo ? " video-track" : " audio-track");
        // Apply dynamic track height based on zoom level
        const { videoH, audioH } = this._getTrackHeights();
        const trackH = isVideo ? videoH : audioH;
        row.style.minHeight = trackH + "px";
        row.style.height = trackH + "px";
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
        // Override fixed CSS min-height to use dynamic height
        content.style.minHeight = (trackH - 8) + "px";
        const rulerWidth = Math.round(((this._totalDuration || 30) + 10) * (this._pps || 15));
        content.style.minWidth = rulerWidth + "px";
        const trackClips = this._getClipsForTrack(trackType, trackIndex);
        if (trackClips.length === 0) {
            content.innerHTML = `<span class="bsai-pp-track-empty">空轨道</span>`;
        } else {
            trackClips.forEach((clip, i) => {
                const clipIdx = this.td.clips.indexOf(clip);
                content.appendChild(this._createClipBlock(clip, clipIdx));
            });
            for (let i = 1; i < trackClips.length; i++) {
                const clipIdx = this.td.clips.indexOf(trackClips[i]);
                const block = content.querySelector(`[data-clip-idx="${clipIdx}"]`);
                if (!block) continue;
                const arrow = document.createElement("div");
                arrow.className = "bsai-pp-transition-arrow";
                arrow.style.left = (block.offsetLeft - 14) + "px";
                const transIn = trackClips[i].transition_in || "cut";
                const icon = isVideo ? (TRANSITION_ICONS[transIn] || "🌫️") : "🎵";
                const label = isVideo ? (TRANSITION_LABELS[transIn] || "淡入淡出") : "音频过渡";
                arrow.innerHTML = `<span class="arrow-icon">${icon}</span><span class="arrow-label">${label}</span>`;
                arrow.title = isVideo
                    ? `点击切换过渡效果 (当前: ${TRANSITION_LABELS[transIn] || "淡入淡出"})`
                    : `音频过渡 (当前: ${TRANSITION_LABELS[transIn] || "淡入淡出"})`;
                arrow.onclick = (e) => { e.stopPropagation(); this._showTransitionPopup(arrow, clipIdx); };
                content.appendChild(arrow);
            }
        }
        row.appendChild(content);
        this._attachBoxSelection(content, trackType, trackIndex);
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
        const oldDir = this._getWidgetValue("watch_directory", "");
        // Use Windows Explorer folder picker via webkitdirectory
        const input = document.createElement("input");
        input.type = "file";
        input.setAttribute("webkitdirectory", "");
        input.style.display = "none";
        document.body.appendChild(input);

        input.onchange = async () => {
            const files = Array.from(input.files || []);
            document.body.removeChild(input);
            if (files.length === 0) return;
            // Filter media files only
            const mediaFiles = files.filter(f => {
                const name = f.name.toLowerCase();
                return /\.(mp4|avi|mov|mkv|webm|flv|wmv|m4v|mpg|mpeg|ts|3gp|mp3|wav|aac|flac|ogg|m4a|wma|opus|png|jpg|jpeg|bmp|gif|webp|tiff?|svg)$/i.test(name);
            });
            if (mediaFiles.length === 0) {
                this._toast("所选目录中没有媒体文件", "error");
                return;
            }
            this._toast(`正在从目录导入 ${mediaFiles.length} 个媒体文件...`, "info");
            // Save current timeline state to directory_history
            if (!this.td.directory_history) this.td.directory_history = {};
            if (oldDir) {
                this.td.directory_history[oldDir] = {
                    clips: JSON.parse(JSON.stringify(this.td.clips || [])),
                    known_files: JSON.parse(JSON.stringify(this.td.known_files || [])),
                    deleted_files: JSON.parse(JSON.stringify(this.td.deleted_files || [])),
                    video_tracks: JSON.parse(JSON.stringify(this.td.video_tracks || [])),
                    audio_tracks: JSON.parse(JSON.stringify(this.td.audio_tracks || [])),
                };
            }
            // Clear current timeline for new directory
            this.td.clips = [];
            this.td.known_files = [];
            this.td.deleted_files = [];
            this.selectedIndex = -1;
            // Upload all media files to server
            let imported = 0;
            for (const file of mediaFiles) {
                try {
                    const formData = new FormData();
                    formData.append("file", file, file.name);
                    const resp = await api.fetchApi("/bsai_premiere_pro/upload", {
                        method: "POST",
                        body: formData,
                    });
                    const result = await resp.json();
                    if (result.error) continue;
                    const fileInfo = (result.files || [])[0];
                    if (!fileInfo || fileInfo.error) continue;
                    await this._addClipFromFile(fileInfo);
                    imported++;
                } catch (e) {
                    // Skip failed files
                }
            }
            if (imported > 0) {
                // Set watch directory to the upload directory
                const uploadDir = "output/bsai_imports";
                const dirInput = this.modal.querySelector('[data-act="dir"]');
                if (dirInput) dirInput.value = uploadDir;
                const w = this._getWidget("watch_directory");
                if (w) w.value = uploadDir;
                this._toast(`成功从目录导入 ${imported} 个媒体文件`, "success");
            } else {
                this._toast("没有成功导入任何文件", "error");
            }
            this._autoLinkClips();
            this._save();
            this._renderAll();
        };
        input.click();
    }

    _showDirHistory(e) {
        // Remove existing dropdown
        document.querySelectorAll(".bsai-pp-history-dropdown").forEach(d => d.remove());
        if (!this.td.directory_history || Object.keys(this.td.directory_history).length === 0) {
            this._toast("暂无历史目录记录", "info");
            return;
        }
        const dropdown = document.createElement("div");
        dropdown.className = "bsai-pp-history-dropdown";
        const currentDir = this._getWidgetValue("watch_directory", "");
        let html = "";
        // Add current directory
        const currentClips = (this.td.clips || []).filter(c => c.track_type === "video").length;
        html += `<div class="bsai-pp-history-item" data-dir="${escapeHtml(currentDir)}" style="background:#2a3a4a;">
            <span>📍</span><span>${escapeHtml(currentDir || "未设置")}</span>
            <span class="hist-clips">${currentClips} 片段 (当前)</span>
        </div>`;
        // Add history entries
        for (const [dir, state] of Object.entries(this.td.directory_history)) {
            if (dir === currentDir) continue;
            const clipCount = (state.clips || []).filter(c => c.track_type === "video").length;
            html += `<div class="bsai-pp-history-item" data-dir="${escapeHtml(dir)}">
                <span>📁</span><span>${escapeHtml(dir)}</span>
                <span class="hist-clips">${clipCount} 片段</span>
                <span class="hist-del" data-del-dir="${escapeHtml(dir)}" title="删除历史">✕</span>
            </div>`;
        }
        dropdown.innerHTML = html;
        document.body.appendChild(dropdown);
        // Position near button
        const btnRect = e.target.getBoundingClientRect();
        dropdown.style.left = btnRect.left + "px";
        dropdown.style.top = (btnRect.bottom + 4) + "px";
        // Handle clicks
        dropdown.querySelectorAll(".bsai-pp-history-item").forEach(item => {
            item.onclick = async (ev) => {
                if (ev.target.classList.contains("hist-del")) {
                    ev.stopPropagation();
                    const delDir = ev.target.getAttribute("data-del-dir");
                    delete this.td.directory_history[delDir];
                    this._save();
                    dropdown.remove();
                    this._toast(`已删除历史记录: ${delDir}`, "info");
                    return;
                }
                const dir = item.getAttribute("data-dir");
                if (dir && dir !== currentDir) {
                    await this._switchToDirectory(dir);
                }
                dropdown.remove();
            };
        });
        // Close on outside click
        const closeHandler = (ev) => {
            if (!dropdown.contains(ev.target)) {
                dropdown.remove();
                document.removeEventListener("mousedown", closeHandler);
            }
        };
        setTimeout(() => document.addEventListener("mousedown", closeHandler), 10);
    }

    async _switchToDirectory(newDir) {
        const oldDir = this._getWidgetValue("watch_directory", "");
        if (newDir === oldDir) return;
        // Save current state
        if (!this.td.directory_history) this.td.directory_history = {};
        if (oldDir) {
            this.td.directory_history[oldDir] = {
                clips: JSON.parse(JSON.stringify(this.td.clips || [])),
                known_files: JSON.parse(JSON.stringify(this.td.known_files || [])),
                deleted_files: JSON.parse(JSON.stringify(this.td.deleted_files || [])),
                video_tracks: JSON.parse(JSON.stringify(this.td.video_tracks || [])),
                audio_tracks: JSON.parse(JSON.stringify(this.td.audio_tracks || [])),
            };
        }
        // Restore or initialize
        const hist = this.td.directory_history[newDir];
        if (hist) {
            this.td.clips = JSON.parse(JSON.stringify(hist.clips || []));
            this.td.known_files = JSON.parse(JSON.stringify(hist.known_files || []));
            this.td.deleted_files = JSON.parse(JSON.stringify(hist.deleted_files || []));
            this.td.video_tracks = JSON.parse(JSON.stringify(hist.video_tracks || [{ name: "V1", locked: false, visible: true }]));
            this.td.audio_tracks = JSON.parse(JSON.stringify(hist.audio_tracks || [{ name: "A1", locked: false, muted: false, solo: false }]));
            this._toast(`已切换到: ${newDir} (恢复 ${this.td.clips.filter(c=>c.track_type==="video").length} 个片段)`, "success");
        } else {
            this.td.clips = [];
            this.td.known_files = [];
            this.td.deleted_files = [];
            this._toast(`已切换到新目录: ${newDir}，正在扫描...`, "info");
        }
        this.selectedIndex = -1;
        const dirInput = this.modal.querySelector('[data-act="dir"]');
        if (dirInput) dirInput.value = newDir;
        const w = this._getWidget("watch_directory");
        if (w) w.value = newDir;
        this._save();
        this._renderAll();
        if (!hist) setTimeout(() => this._scanNow(), 100);
    }

    async _importExternalFiles() {
        // Use watch directory as initial path, fallback to output, then empty
        const watchDir = this._getWidgetValue("watch_directory", "output");
        let initialPath = "";
        if (watchDir && watchDir !== "output") {
            initialPath = watchDir;
        }
        const selected = await browseFilesDialog(initialPath);
        if (!selected || selected.length === 0) return;
        this._toast(`正在导入 ${selected.length} 个文件...`, "info");
        let imported = 0;
        for (const file of selected) {
            try {
                if (file.type === "video") {
                    // Get video metadata
                    const metaResp = await api.fetchApi(`/bsai_premiere_pro/metadata?file=${encodeURIComponent(file.path)}`);
                    const meta = await metaResp.json();
                    if (meta.error) {
                        this._toast(`无法读取 ${file.name}: ${meta.error}`, "error");
                        continue;
                    }
                    await this._addClipFromFile({
                        file_path: file.path,
                        file_name: file.name,
                        size: file.size,
                        duration: meta.duration || 0,
                        width: meta.width || 1920,
                        height: meta.height || 1080,
                        fps: meta.fps || 30,
                        has_audio: meta.has_audio || false,
                    });
                    imported++;
                } else if (file.type === "audio") {
                    // Fetch metadata for audio file to get correct duration
                    let audioDuration = 0;
                    try {
                        const metaResp = await api.fetchApi(`/bsai_premiere_pro/metadata?file=${encodeURIComponent(file.path)}`);
                        const meta = await metaResp.json();
                        if (!meta.error) audioDuration = meta.duration || 0;
                    } catch {}
                    if (audioDuration === 0) audioDuration = 5;
                    const clip = {
                        id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        file_path: file.path,
                        file_name: file.name,
                        track_type: "audio",
                        track_index: 0,
                        duration: audioDuration,
                        trim_start: 0,
                        trim_end: audioDuration,
                        video_enabled: false,
                        audio_enabled: true,
                        audio_replacement: null,
                        transition_in: "cut",
                        transition_out: "cut",
                        transition_duration: 0.5,
                    };
                    this.td.clips.push(clip);
                    if (!this.td.known_files.includes(file.name)) {
                        this.td.known_files.push(file.name);
                    }
                    imported++;
                } else if (file.type === "image") {
                    // Add image as a video clip (single frame)
                    const clip = {
                        id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        file_path: file.path,
                        file_name: file.name,
                        track_type: "video",
                        track_index: 0,
                        duration: 3,
                        trim_start: 0,
                        trim_end: 3,
                        width: 1920,
                        height: 1080,
                        fps: 24,
                        has_audio: false,
                        video_enabled: true,
                        audio_enabled: false,
                        is_image: true,
                        transition_in: "cut",
                        transition_out: "cut",
                        transition_duration: 0.5,
                    };
                    this.td.clips.push(clip);
                    if (!this.td.known_files.includes(file.name)) {
                        this.td.known_files.push(file.name);
                    }
                    imported++;
                }
            } catch (e) {
                this._toast(`导入 ${file.name} 失败: ${e.message}`, "error");
            }
        }
        if (imported > 0) {
            this._autoLinkClips();
            this._save();
            this._renderAll();
            this._toast(`成功导入 ${imported} 个文件`, "success");
        }
    }

    _toggleScissorMode() {
        // If playing, pause first to capture the paused position
        if (this._isPlaying) {
            this._pausePlayback();
        }
        // If there's a paused playback position, cut at that position immediately
        if (this._pausedClip && this._pausedVideoTime != null) {
            this._splitAtPausedPosition();
            return;
        }
        this.scissorMode = !this.scissorMode;
        const btn = this.modal.querySelector("#bsai-pp-scissor-btn");
        if (btn) {
            btn.classList.toggle("scissor-active", this.scissorMode);
            btn.textContent = this.scissorMode ? "✂️ 剪刀(开)" : "✂️ 剪刀";
        }
        if (this.scissorMode) {
            this.batchMode = false;
            this.batchSelected.clear();
            this._removeBatchBar();
            const batchBtn = this.modal.querySelector("#bsai-pp-batch-btn");
            if (batchBtn) {
                batchBtn.textContent = "☑ 批量选择";
                batchBtn.classList.remove("bsai-pp-btn-danger");
            }
        }
        this._renderTimeline();
        this._toast(this.scissorMode ? "剪刀模式已开启，点击片段进行分割" : "剪刀模式已关闭", this.scissorMode ? "info" : "success");
    }

    _isTrackLocked(clip) {
        const tracks = clip.track_type === "video" ? (this.td.video_tracks || []) : (this.td.audio_tracks || []);
        const track = tracks[clip.track_index || 0];
        return track?.locked || false;
    }

    _splitAtPausedPosition() {
        const clip = this._pausedClip;
        if (!clip) return;
        const splitTime = this._pausedVideoTime;
        const trimStart = clip.trim_start || 0;
        const trimEnd = clip.trim_end || clip.duration || 0;
        const clipDur = trimEnd - trimStart;
        const splitOffset = splitTime - trimStart;
        if (splitOffset < 0.2 || splitOffset > clipDur - 0.2) {
            this._toast("暂停位置太靠近片段边缘，无法分割", "info");
            // Clear paused state even if can't split
            this._pausedClip = null;
            this._pausedVideoTime = null;
            return;
        }
        // Check track locking
        const isVideoLocked = this._isTrackLocked(clip);
        const linkedAudio = clip.linked_id ? this.td.clips.find(c => c.id === clip.linked_id) : null;
        const isAudioLocked = linkedAudio ? this._isTrackLocked(linkedAudio) : false;
        if (isVideoLocked && (!linkedAudio || isAudioLocked)) {
            this._toast("相关轨道均已锁定，无法分割", "error");
            this._pausedClip = null;
            this._pausedVideoTime = null;
            return;
        }
        const willSplitVideo = !isVideoLocked;
        const willSplitAudio = linkedAudio && !isAudioLocked;
        const newVId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const newAId = `clip_${Date.now() + 1}_${Math.random().toString(36).substr(2, 6)}`;
        let videoInsertIdx = -1;
        // Split video clip
        if (willSplitVideo) {
            const clipIdx = this.td.clips.indexOf(clip);
            const videoPart2 = { ...clip, id: newVId, trim_start: splitTime, transition_in: "cut", transition_out: clip.transition_out };
            clip.trim_end = splitTime;
            clip.transition_out = "cut";
            if (willSplitAudio) {
                videoPart2.linked_id = newAId;
            } else {
                // Audio not split - unlink
                videoPart2.linked_id = null;
                clip.linked_id = null;
            }
            videoInsertIdx = clipIdx + 1;
            this.td.clips.splice(videoInsertIdx, 0, videoPart2);
        }
        // Split linked audio clip
        if (willSplitAudio) {
            const linkedIdx = this.td.clips.indexOf(linkedAudio);
            const audioPart2 = { ...linkedAudio, id: newAId, trim_start: splitTime, trim_end: linkedAudio.trim_end, transition_in: "cut", transition_out: linkedAudio.transition_out };
            linkedAudio.trim_end = splitTime;
            linkedAudio.transition_out = "cut";
            if (willSplitVideo) {
                audioPart2.linked_id = newVId;
            } else {
                audioPart2.linked_id = null;
                linkedAudio.linked_id = null;
            }
            // Calculate insert position accounting for video part2 insertion
            let linkedInsertIdx = linkedIdx + 1;
            if (willSplitVideo && linkedIdx >= videoInsertIdx) {
                linkedInsertIdx += 1;
            }
            this.td.clips.splice(linkedInsertIdx, 0, audioPart2);
        }
        // Stop playback and clear paused position
        this._stopPlayback();
        this._pausedClip = null;
        this._pausedVideoTime = null;
        this._save();
        this._renderAll();
        this._toast("已在暂停位置分割片段", "success");
    }

    _togglePlayback() {
        if (this._isPlaying) {
            this._pausePlayback();
        } else {
            this._startPlayback();
        }
    }

    _startPlayback() {
        const videoClips = (this.td.clips || [])
            .filter(c => c.track_type === "video" && c.video_enabled !== false);
        if (videoClips.length === 0) {
            this._toast("时间轴上没有可播放的视频片段", "error");
            return;
        }
        // If resuming from pause (inline video element still exists), just resume
        if (!this._isPlaying && this._playClips.length > 0) {
            const inlineVideo = this.modal.querySelector(".bsai-pp-inline-video");
            if (inlineVideo) {
                this._isPlaying = true;
                this._pausedClip = null;
                this._pausedVideoTime = null;
                const btn = this.modal.querySelector("#bsai-pp-play-btn");
                if (btn) btn.textContent = "⏸️ 暂停";
                if (inlineVideo.tagName === "VIDEO") {
                    inlineVideo.play().catch(() => {});
                    const inlineAudio = this.modal.querySelector(".bsai-pp-inline-audio");
                    if (inlineAudio) inlineAudio.play().catch(() => {});
                } else {
                    // Image: restart animation from paused position
                    const clip = this._playClips[this._playClipIndex];
                    if (clip && this._imageElapsed != null) {
                        this._playStartOffset = (clip.trim_start || 0) + this._imageElapsed;
                    }
                    this._playNextClip();
                }
                return;
            }
        }
        // Fresh start: play from playhead position, or selected clip, or first
        this._playClips = videoClips;
        let startIdx = 0;
        this._playStartOffset = null;
        // Priority 1: If playhead is set, find the clip at playhead position
        if (this._playheadTime !== null && this._playheadTime !== undefined && isFinite(this._playheadTime)) {
            const phTime = this._playheadTime;
            for (let i = 0; i < videoClips.length; i++) {
                const clip = videoClips[i];
                const clipStart = this._getClipStartTime(clip);
                const clipDur = (clip.trim_end || 0) - (clip.trim_start || 0);
                const clipEnd = clipStart + clipDur;
                if (phTime >= clipStart && phTime < clipEnd) {
                    const offset = (clip.trim_start || 0) + (phTime - clipStart);
                    // Safety: if offset is too close to trimEnd, start from beginning
                    if (offset < (clip.trim_end || 0) - 0.5) {
                        startIdx = i;
                        this._playStartOffset = offset;
                    }
                    break;
                }
            }
        }
        // Priority 2: Fall back to selected clip
        if (this._playStartOffset === null && this.selectedIndex >= 0 && this.td.clips[this.selectedIndex]) {
            const selectedClip = this.td.clips[this.selectedIndex];
            if (selectedClip.track_type === "video" && selectedClip.video_enabled !== false) {
                const foundIdx = videoClips.indexOf(selectedClip);
                if (foundIdx >= 0) startIdx = foundIdx;
            }
        }
        this._playClipIndex = startIdx;
        this._isPlaying = true;
        this._pausedClip = null;
        this._pausedVideoTime = null;
        const btn = this.modal.querySelector("#bsai-pp-play-btn");
        if (btn) btn.textContent = "⏸️ 暂停";
        // Play inline on timeline - NO popup window
        this._playNextClip();
    }

    _playNextClip() {
        if (!this._isPlaying || this._playClipIndex >= this._playClips.length) {
            this._playheadTime = null;
            this._stopPlayback();
            return;
        }
        const clip = this._playClips[this._playClipIndex];
        const filePath = clip.file_path || "";
        const trimStart = clip.trim_start || 0;
        const trimEnd = clip.trim_end || clip.duration || 3;
        // Safety: ensure minimum 0.1s duration to prevent instant-skip playback issues
        if (trimEnd <= trimStart) { clip.trim_end = trimStart + (clip.duration || 3); }

        // Remove any previous inline video/image
        this.modal.querySelectorAll(".bsai-pp-inline-video").forEach(v => { v.pause?.(); v.remove(); });
        this.modal.querySelectorAll(".bsai-pp-inline-image").forEach(v => { v.remove(); });

        // Find the clip block element on the timeline
        const clipIdx = this.td.clips.indexOf(clip);
        const clipBlock = this.modal.querySelector(`[data-clip-idx="${clipIdx}"]`);
        const thumbDiv = clipBlock?.querySelector(".bsai-pp-clip-thumb");

        if (!thumbDiv) {
            this._playClipIndex++;
            this._playNextClip();
            return;
        }

        // Update playhead position
        this._updatePlayhead(clip);
        const clipDur = trimEnd - trimStart;

        // ── Image clip: display as <img> for its timeline duration ──
        if (clip.is_image) {
            const img = document.createElement("img");
            img.className = "bsai-pp-inline-image bsai-pp-inline-video";
            img.style.cssText = "width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;background:#000;z-index:5;";
            img.src = `/bsai_premiere_pro/stream?file=${encodeURIComponent(filePath)}`;
            thumbDiv.appendChild(img);

            if (clipBlock) {
                clipBlock.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
            }

            // Calculate remaining duration if resuming from playhead offset
            let imgStartOffset = 0;
            if (this._playStartOffset != null) {
                imgStartOffset = Math.max(0, this._playStartOffset - trimStart);
                this._playStartOffset = null;
            }
            const remainingDur = Math.max(0.1, clipDur - imgStartOffset) * 1000;

            const imgStartTime = performance.now();
            const clipStartOffset = imgStartOffset;

            // Animate playhead across the image clip
            const animateImg = () => {
                if (!this._isPlaying) return;
                const elapsed = (performance.now() - imgStartTime) / 1000 + clipStartOffset;
                this._imageElapsed = elapsed;
                if (elapsed >= clipDur) {
                    img.remove();
                    this._playClipIndex++;
                    this._playNextClip();
                    return;
                }
                // Animate playhead
                const playhead = this.modal.querySelector(".bsai-pp-playhead");
                if (playhead) {
                    const container = this.modal.querySelector("[data-track-container]");
                    if (container && clipBlock) {
                        const containerRect = container.getBoundingClientRect();
                        const blockRect = clipBlock.getBoundingClientRect();
                        const blockLeft = blockRect.left - containerRect.left;
                        const pps = this._pps || 15;
                        playhead.style.left = (blockLeft + elapsed * pps) + "px";
                    }
                }
                // Update _playheadTime so zoom centers on current playback position
                const imgClipStart = this._getClipStartTime(clip);
                this._playheadTime = imgClipStart + elapsed;
                // Update footer
                const footerInfo = this.modal.querySelector("[data-footer-info]");
                if (footerInfo) {
                    footerInfo.textContent = `▶ ${clip.file_name || ""} | ${formatTime(elapsed)} / ${formatTime(clipDur)} | ${this._playClipIndex + 1}/${this._playClips.length}`;
                }
                requestAnimationFrame(animateImg);
            };
            requestAnimationFrame(animateImg);

            const footerInfo = this.modal.querySelector("[data-footer-info]");
            if (footerInfo) {
                footerInfo.textContent = `▶ 播放中: ${clip.file_name} (${this._playClipIndex + 1}/${this._playClips.length})`;
            }
            return;
        }

        // ── Video clip: create <video> element ──
        const videoSrc = `/bsai_premiere_pro/stream?file=${encodeURIComponent(filePath)}`;
        const video = document.createElement("video");
        video.className = "bsai-pp-inline-video";
        video.style.cssText = "width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;background:#000;z-index:5;";
        video.src = videoSrc;

        // Determine audio playback strategy
        let separateAudioEl = null;
        let shouldMuteVideo = false;

        if (clip.linked_id) {
            const linkedAudio = this.td.clips.find(c => c.id === clip.linked_id);
            if (linkedAudio && !linkedAudio.is_gap && linkedAudio.file_path && linkedAudio.audio_enabled !== false) {
                const audioTracks = this.td.audio_tracks || [];
                const aTrack = linkedAudio.track_index != null ? audioTracks[linkedAudio.track_index] : null;
                if (aTrack && aTrack.muted) {
                    shouldMuteVideo = true;
                } else {
                    shouldMuteVideo = true;
                    separateAudioEl = document.createElement("audio");
                    separateAudioEl.className = "bsai-pp-inline-audio";
                    separateAudioEl.src = `/bsai_premiere_pro/stream?file=${encodeURIComponent(linkedAudio.file_path)}`;
                    separateAudioEl.style.display = "none";
                }
            } else {
                shouldMuteVideo = (clip.has_audio === false);
            }
        } else {
            shouldMuteVideo = (clip.has_audio === false);
        }
        video.muted = shouldMuteVideo;

        thumbDiv.appendChild(video);
        if (separateAudioEl) thumbDiv.appendChild(separateAudioEl);

        const posX = clip.pos_x ?? 0;
        const posY = clip.pos_y ?? 0;
        video.style.transform = `translate(${posX}%, ${posY}%)`;

        if (clipBlock) {
            clipBlock.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }

        let clipEnded = false;
        const advanceToNext = () => {
            if (clipEnded) return;
            clipEnded = true;
            video.onended = null;
            video.ontimeupdate = null;
            video.onloadedmetadata = null;
            video.pause();
            video.remove();
            if (separateAudioEl) { separateAudioEl.pause(); separateAudioEl.remove(); }
            this._playClipIndex++;
            this._playNextClip();
        };

        video.onloadedmetadata = () => {
            const seekTo = this._playStartOffset != null ? this._playStartOffset : trimStart;
            this._playStartOffset = null;
            if (seekTo > 0) {
                try { video.currentTime = seekTo; } catch {}
            }
            video.play().catch(() => {});
            if (separateAudioEl) {
                try { separateAudioEl.currentTime = seekTo; } catch {}
                separateAudioEl.play().catch(() => {});
            }
        };

        video.ontimeupdate = () => {
            if (trimEnd > 0 && video.currentTime >= trimEnd) {
                advanceToNext();
                return;
            }
            this._animatePlayhead();
            const footerInfo = this.modal.querySelector("[data-footer-info]");
            if (footerInfo) {
                const elapsed = Math.max(0, video.currentTime - trimStart);
                footerInfo.textContent = `▶ ${clip.file_name || ""} | ${formatTime(elapsed)} / ${formatTime(clipDur)} | ${this._playClipIndex + 1}/${this._playClips.length}`;
            }
        };

        video.onended = () => {
            advanceToNext();
        };

        const footerInfo = this.modal.querySelector("[data-footer-info]");
        if (footerInfo) {
            footerInfo.textContent = `▶ 播放中: ${clip.file_name} (${this._playClipIndex + 1}/${this._playClips.length})`;
        }
    }

    _pausePlayback() {
        this._isPlaying = false;
        const inlineVideo = this.modal.querySelector(".bsai-pp-inline-video");
        if (inlineVideo) {
            const currentClip = this._playClips?.[this._playClipIndex];
            if (currentClip) {
                this._pausedClip = currentClip;
                if (inlineVideo.tagName === "VIDEO" && inlineVideo.currentTime != null) {
                    this._pausedVideoTime = inlineVideo.currentTime;
                } else if (this._imageElapsed != null) {
                    this._pausedVideoTime = (currentClip.trim_start || 0) + this._imageElapsed;
                }
            }
            if (inlineVideo.pause) inlineVideo.pause();
        }
        const inlineAudio = this.modal.querySelector(".bsai-pp-inline-audio");
        if (inlineAudio) inlineAudio.pause();
        const btn = this.modal.querySelector("#bsai-pp-play-btn");
        if (btn) btn.textContent = "▶️ 播放";
        const footerInfo = this.modal.querySelector("[data-footer-info]");
        if (footerInfo) {
            footerInfo.textContent = `⏸ 已暂停 (${this._playClipIndex + 1}/${this._playClips?.length || 0})`;
        }
    }

    _stopPlayback() {
        this._isPlaying = false;
        this._playClipIndex = 0;
        this._pausedClip = null;
        this._pausedVideoTime = null;
        // Remove all inline videos and audio from clip blocks
        this.modal.querySelectorAll(".bsai-pp-inline-video").forEach(v => { v.pause?.(); v.remove(); });
        this.modal.querySelectorAll(".bsai-pp-inline-audio").forEach(v => { v.pause?.(); v.remove(); });
        this.modal.querySelectorAll(".bsai-pp-inline-image").forEach(v => { v.remove(); });
        // Remove playhead
        this._removePlayhead();
        // Only hide timeline preview overlay if it was used for inline playback (not render preview)
        if (!this._previewVideoActive) {
            this.modal.querySelector("[data-timeline-preview]")?.classList.remove("visible");
            this.modal.querySelector("[data-timeline-preview]")?.classList.remove("fullscreen");
        }
        const btn = this.modal.querySelector("#bsai-pp-play-btn");
        if (btn) btn.textContent = "▶️ 播放";
        const footerInfo = this.modal.querySelector("[data-footer-info]");
        if (footerInfo) footerInfo.textContent = "";
    }

    _updatePlayhead(clip) {
        const container = this.modal.querySelector("[data-track-container]");
        if (!container) return;
        this._removePlayhead();
        // Use actual clip block DOM position for accurate alignment
        const clipIdx = this.td.clips.indexOf(clip);
        const clipBlock = this.modal.querySelector(`[data-clip-idx="${clipIdx}"]`);
        if (!clipBlock) return;
        const containerRect = container.getBoundingClientRect();
        const blockRect = clipBlock.getBoundingClientRect();
        const x = blockRect.left - containerRect.left;
        const playhead = document.createElement("div");
        playhead.className = "bsai-pp-playhead";
        playhead.style.left = x + "px";
        container.appendChild(playhead);
    }

    _animatePlayhead() {
        const playhead = this.modal.querySelector(".bsai-pp-playhead");
        if (!playhead || !this._isPlaying) return;
        const videoEl = this.modal.querySelector(".bsai-pp-inline-video");
        if (!videoEl) return;
        const currentClip = this._playClips[this._playClipIndex];
        if (!currentClip) return;
        // Find the clip block's actual position in the DOM
        const clipIdx = this.td.clips.indexOf(currentClip);
        const clipBlock = this.modal.querySelector(`[data-clip-idx="${clipIdx}"]`);
        if (!clipBlock) return;
        const container = this.modal.querySelector("[data-track-container]");
        if (!container) return;
        const containerRect = container.getBoundingClientRect();
        const blockRect = clipBlock.getBoundingClientRect();
        const blockLeft = blockRect.left - containerRect.left;
        const pps = this._pps || 15;
        const trimStart = currentClip.trim_start || 0;
        const elapsedInClip = videoEl.tagName === "VIDEO"
            ? Math.max(0, videoEl.currentTime - trimStart)
            : (this._imageElapsed || 0);
        const x = blockLeft + elapsedInClip * pps;
        playhead.style.left = x + "px";
        // Update _playheadTime so zoom centers on current playback position
        const clipStart = this._getClipStartTime(currentClip);
        this._playheadTime = clipStart + elapsedInClip;
    }

    _removePlayhead() {
        const existing = this.modal.querySelector(".bsai-pp-playhead");
        if (existing) existing.remove();
    }

    _renderTimelinePlayhead() {
        const container = this.modal.querySelector("[data-track-container]");
        if (!container) return;
        const old = container.querySelector(".bsai-pp-timeline-playhead");
        if (old) old.remove();
        if (this._playheadTime === null || this._playheadTime === undefined) return;
        const pps = this._pps || 15;
        const SPACER_W = 150;
        const x = SPACER_W + this._playheadTime * pps;
        const ph = document.createElement("div");
        ph.className = "bsai-pp-timeline-playhead";
        ph.style.left = x + "px";
        ph.title = `播放头: ${formatTime(this._playheadTime)} (双击清除)`;
        ph.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            this._playheadTime = null;
            this._renderTimelinePlayhead();
        });
        ph.addEventListener("click", (e) => {
            e.stopPropagation();
            if (this.scissorMode) {
                this._cutAtPlayhead();
            }
        });
        container.appendChild(ph);
    }

    _getCurrentFps() {
        if (this.selectedIndex >= 0 && this.td.clips[this.selectedIndex]) {
            return this.td.clips[this.selectedIndex].fps || 30;
        }
        const vClips = this.td.clips.filter(c => c.track_type === "video");
        if (vClips.length > 0) return vClips[0].fps || 30;
        return 30;
    }

    _scrollToPlayhead() {
        const scrollContainer = this.modal.querySelector("[data-timeline-scroll]");
        if (!scrollContainer) return;
        const pps = this._pps || 15;
        const playheadX = 150 + (this._playheadTime || 0) * pps;
        const visW = scrollContainer.clientWidth || 800;
        const left = scrollContainer.scrollLeft;
        const right = left + visW;
        if (playheadX < left + 50 || playheadX > right - 50) {
            scrollContainer.scrollLeft = Math.max(0, playheadX - visW / 2);
        }
    }

    _cutAtPlayhead() {
        if (this._playheadTime === null || this._playheadTime === undefined) {
            this._toast("请先点击标尺设置播放头位置", "info");
            return;
        }
        const cutTime = this._playheadTime;
        const videoClips = this.td.clips.filter(c => c.track_type === "video");
        let cutCount = 0;
        for (const clip of videoClips) {
            if (this._isTrackLocked(clip)) continue;
            const clipStart = this._getClipStartTime(clip);
            const clipEnd = clipStart + (clip.trim_end - clip.trim_start);
            if (cutTime > clipStart + 0.2 && cutTime < clipEnd - 0.2) {
                const splitTime = (clip.trim_start || 0) + (cutTime - clipStart);
                const clipIndex = this.td.clips.indexOf(clip);
                this._splitClipAt(clip, clipIndex, splitTime);
                cutCount++;
            }
        }
        if (cutCount > 0) {
            this._save();
            this._renderAll();
            this._toast(`已在播放头位置剪断 ${cutCount} 个片段`, "success");
        } else {
            this._toast("播放头位置没有可剪断的视频片段", "info");
        }
    }

    _getClipStartTime(clip) {
        const sameType = this.td.clips.filter(c => c.track_type === clip.track_type);
        const idx = sameType.indexOf(clip);
        let startTime = 0;
        for (let i = 0; i < idx; i++) {
            startTime += (sameType[i].trim_end - sameType[i].trim_start);
        }
        return startTime;
    }

    _splitClipAt(clip, clipIndex, splitTime) {
        const vId2 = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const aId2 = `clip_${Date.now() + 1}_${Math.random().toString(36).substr(2, 6)}`;
        const part2 = { ...clip, id: vId2, trim_start: splitTime, transition_in: "cut", transition_out: clip.transition_out };
        clip.trim_end = splitTime;
        clip.transition_out = "cut";
        const insertIdx = clipIndex + 1;
        const linkedAudio = clip.linked_id ? this.td.clips.find(c => c.id === clip.linked_id) : null;
        const isAudioLocked = linkedAudio ? this._isTrackLocked(linkedAudio) : false;
        const willSplitAudio = linkedAudio && !isAudioLocked;
        if (willSplitAudio) {
            const linked = linkedAudio;
            const linkedOrigTransOut = linked.transition_out;
            const linkedOrigTrimEnd = linked.trim_end;
            const linkedIdx = this.td.clips.indexOf(linked);
            const linkedPart2 = { ...linked, id: aId2, trim_start: splitTime, trim_end: linkedOrigTrimEnd, transition_in: "cut", transition_out: linkedOrigTransOut };
            linked.trim_end = splitTime;
            linked.transition_out = "cut";
            part2.linked_id = aId2;
            linkedPart2.linked_id = vId2;
            this.td.clips.splice(insertIdx, 0, part2);
            const linkedInsertIdx = linkedIdx < insertIdx ? linkedIdx + 2 : linkedIdx + 1;
            this.td.clips.splice(linkedInsertIdx, 0, linkedPart2);
        } else {
            part2.linked_id = null;
            if (clip.linked_id) clip.linked_id = null;
            this.td.clips.splice(insertIdx, 0, part2);
        }
    }

    _toggleBatchMode() {
        this.batchMode = !this.batchMode;
        if (!this.batchMode) {
            this.batchSelected.clear();
            this._removeBatchBar();
        } else {
            // Clear other selection modes
            this.boxSelected.clear();
            this._removeBoxBar();
            if (this.scissorMode) {
                this.scissorMode = false;
                const sBtn = this.modal.querySelector("#bsai-pp-scissor-btn");
                if (sBtn) { sBtn.classList.remove("scissor-active"); sBtn.textContent = "✂️ 剪刀"; }
            }
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
            <button class="bsai-pp-btn" data-batch-act="invert">🔄 反选</button>
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
        bar.querySelector('[data-batch-act="invert"]').onclick = () => {
            const newSel = new Set();
            for (let i = 0; i < total; i++) {
                if (!this.batchSelected.has(i)) newSel.add(i);
            }
            this.batchSelected = newSel;
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
        _addMaximizeBtn(dialog);
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
            // Track deleted files to prevent auto-reimport
            if (!this.td.deleted_files) this.td.deleted_files = [];
            for (const fn of fileNamesToDelete) {
                if (!this.td.deleted_files.includes(fn)) this.td.deleted_files.push(fn);
            }
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
        _addMaximizeBtn(dialog);
        dialog.querySelector("[data-cancel]").onclick = () => overlay.remove();
        dialog.querySelector("[data-confirm]").onclick = () => {
            // Track all deleted files to prevent auto-reimport
            if (!this.td.deleted_files) this.td.deleted_files = [];
            const allFileNames = new Set((this.td.clips || []).map(c => c.file_name));
            for (const fn of allFileNames) {
                if (!this.td.deleted_files.includes(fn)) this.td.deleted_files.push(fn);
            }
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
        block.setAttribute("data-clip-idx", clipIndex);
        const isVideo = clip.track_type === "video";

        // ── Gap clip: render as empty placeholder ──
        if (clip.is_gap) {
            block.classList.add("gap-clip");
            const clipDur = clip.trim_end || clip.duration || 0;
            const pps = this._pps || 15;
            const width = Math.max(60, Math.round(clipDur * pps));
            block.style.width = width + "px";
            block.innerHTML = `
                <div class="bsai-pp-clip-thumb" style="background:#1a1a1a;border:2px dashed #444;display:flex;align-items:center;justify-content:center;">
                    <span class="placeholder" style="color:#444;font-size:11px;">⬚ 空位</span>
                </div>
                <div class="bsai-pp-clip-info">
                    <div class="bsai-pp-clip-name" style="color:#555;">(已删除)</div>
                    <div class="bsai-pp-clip-dur" style="color:#444;">${formatTime(clipDur)}</div>
                </div>`;
            // Allow clicking gap to remove it (fill gap)
            block.onclick = (e) => {
                e.stopPropagation();
                if (confirm("移除此空位？后续片段会前移填充。")) {
                    this.td.clips = this.td.clips.filter((c, i) => i !== clipIndex);
                    if (this.selectedIndex >= this.td.clips.length) this.selectedIndex = -1;
                    this._save();
                    this._renderAll();
                }
            };
            return block;
        }

        const isLocked = this._isTrackLocked(clip);
        block.classList.add(isVideo ? "video-clip" : "audio-clip");
        if (clip.linked_id) block.classList.add("linked");
        if (clipIndex === this.selectedIndex) block.classList.add("selected");
        if (this.batchMode && this.batchSelected.has(clipIndex)) block.classList.add("batch-selected");
        if (!clip.video_enabled && !clip.audio_enabled) block.classList.add("disabled");
        if (isLocked) block.classList.add("track-locked");
        const clipDur = (clip.trim_end || clip.duration || 0) - (clip.trim_start || 0);
        const pps = this._pps || 15;
        const width = Math.max(60, Math.round(clipDur * pps));
        block.style.width = width + "px";
        let badges = "";
        if (clip.linked_id) {
            badges += `<span class="bsai-pp-clip-badge" style="color:#ffa726;" title="音视频已链接（点击编辑面板可解除）">🔗</span>`;
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
        const thumbAttr = isVideo
            ? `data-thumb="${escapeHtml(clip.file_path)}"`
            : `data-waveform="${escapeHtml(clip.file_path)}"`;
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
        } else if (this.scissorMode) {
            block.classList.add("scissor-mode");
            block.onclick = (e) => {
                e.stopPropagation();
                this._splitClip(clip, clipIndex, e);
            };
        } else {
            block.onclick = (e) => {
                if (e.shiftKey) {
                    // Shift+click for multi-select (auto-include linked partner)
                    if (this.boxSelected.has(clipIndex)) {
                        this.boxSelected.delete(clipIndex);
                        // Also remove linked partner
                        if (clip.linked_id) {
                            const linkedIdx = this.td.clips.findIndex(c => c.id === clip.linked_id);
                            if (linkedIdx >= 0) this.boxSelected.delete(linkedIdx);
                        }
                    } else {
                        this.boxSelected.add(clipIndex);
                        // Also select linked partner
                        if (clip.linked_id) {
                            const linkedIdx = this.td.clips.findIndex(c => c.id === clip.linked_id);
                            if (linkedIdx >= 0) this.boxSelected.add(linkedIdx);
                        }
                    }
                    this._renderTimeline();
                    this._renderBoxBar();
                } else {
                    this.selectedIndex = clipIndex;
                    this.boxSelected.clear();
                    this._renderAll();
                }
            };
        }
        // Add resize handles for trim (not on locked tracks)
        if (!this.batchMode && !this.scissorMode && !isLocked) {
            const leftHandle = document.createElement("div");
            leftHandle.className = "bsai-pp-clip-handle left";
            this._attachTrimHandler(leftHandle, clip, "start");
            block.appendChild(leftHandle);
            const rightHandle = document.createElement("div");
            rightHandle.className = "bsai-pp-clip-handle right";
            this._attachTrimHandler(rightHandle, clip, "end");
            block.appendChild(rightHandle);
        }
        // Drag-to-reorder (not in batch, scissor mode, or locked tracks)
        if (!this.batchMode && !this.scissorMode && !isLocked) {
            block.draggable = true;
            block.addEventListener("dragstart", (e) => {
                this._dragData = { clipIndex, trackType: clip.track_type, trackIndex: clip.track_index };
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(clipIndex));
                block.style.opacity = "0.5";
            });
            block.addEventListener("dragend", () => {
                block.style.opacity = "";
                this._dragData = null;
                this._renderTimeline();
            });
            block.addEventListener("dragover", (e) => {
                if (!this._dragData) return;
                if (this._dragData.trackType !== clip.track_type || this._dragData.trackIndex !== clip.track_index) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                block.classList.add("drag-over");
            });
            block.addEventListener("dragleave", () => {
                block.classList.remove("drag-over");
            });
            block.addEventListener("drop", (e) => {
                e.preventDefault();
                block.classList.remove("drag-over");
                if (!this._dragData) return;
                if (this._dragData.trackType !== clip.track_type || this._dragData.trackIndex !== clip.track_index) return;
                const fromIdx = this._dragData.clipIndex;
                const toIdx = clipIndex;
                if (fromIdx === toIdx) return;
                this._reorderClip(fromIdx, toIdx);
            });
        }
        // Box-selected indicator
        if (this.boxSelected.has(clipIndex)) {
            block.classList.add("box-selected");
        }
        return block;
    }

    _attachTrimHandler(handle, clip, which) {
        handle.onmousedown = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const pps = this._pps || 15;
            const origTrimStart = clip.trim_start || 0;
            const origTrimEnd = clip.trim_end || clip.duration || 0;
            const dur = clip.duration || 0;
            const linked = clip.linked_id ? this.td.clips.find(c => c.id === clip.linked_id) : null;
            const onMove = (ev) => {
                const dx = ev.clientX - startX;
                const dt = dx / pps;
                if (which === "start") {
                    let newStart = Math.max(0, Math.min(origTrimStart + dt, origTrimEnd - 0.1));
                    clip.trim_start = newStart;
                    if (linked) linked.trim_start = newStart;
                } else {
                    let newEnd = Math.max(origTrimStart + 0.1, Math.min(origTrimEnd + dt, dur));
                    clip.trim_end = newEnd;
                    if (linked) linked.trim_end = newEnd;
                }
                this._save();
                this._renderTimeline();
                this._renderFooter();
            };
            const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                this._renderEditPanel();
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
        };
    }

    _splitClip(clip, clipIndex, event) {
        // Check if this clip's track is locked
        if (this._isTrackLocked(clip)) {
            this._toast("该轨道已锁定，无法分割", "error");
            return;
        }
        const block = event.currentTarget;
        const rect = block.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const blockWidth = rect.width;
        const clipDur = (clip.trim_end || clip.duration || 0) - (clip.trim_start || 0);
        const pps = this._pps || 15;
        // Calculate split point in seconds relative to clip
        const splitOffset = clickX / pps;
        const splitTime = (clip.trim_start || 0) + splitOffset;
        if (splitOffset < 0.2 || splitOffset > clipDur - 0.2) {
            this._toast("请在片段中间位置点击进行分割", "info");
            return;
        }
        // Check linked audio track locking
        const linkedAudio = clip.linked_id ? this.td.clips.find(c => c.id === clip.linked_id) : null;
        const isAudioLocked = linkedAudio ? this._isTrackLocked(linkedAudio) : false;
        const willSplitAudio = linkedAudio && !isAudioLocked;
        // Create new IDs
        const vId2 = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const aId2 = `clip_${Date.now() + 1}_${Math.random().toString(36).substr(2, 6)}`;
        // Second part: splitTime to trim_end
        const part2 = { ...clip, id: vId2, trim_start: splitTime, transition_in: "cut", transition_out: clip.transition_out };
        // Update original clip to be part1
        clip.trim_end = splitTime;
        clip.transition_out = "cut";
        // Insert part2 after the original clip in the clips array
        const insertIdx = clipIndex + 1;
        // Handle linked audio
        if (willSplitAudio) {
            const linked = linkedAudio;
            // Split the linked audio clip too
            const linkedOrigTransOut = linked.transition_out;
            const linkedOrigTrimEnd = linked.trim_end;  // Save BEFORE modifying
            const linkedIdx = this.td.clips.indexOf(linked);
            // Create linkedPart2 BEFORE modifying linked (so it gets the original trim_end)
            const linkedPart2 = { ...linked, id: aId2, trim_start: splitTime, trim_end: linkedOrigTrimEnd, transition_in: "cut", transition_out: linkedOrigTransOut };
            // Now modify the original linked clip to be part1
            linked.trim_end = splitTime;
            linked.transition_out = "cut";
            // Update link IDs
            part2.linked_id = aId2;
            linkedPart2.linked_id = vId2;
            // Insert part2 clips
            this.td.clips.splice(insertIdx, 0, part2);
            const linkedInsertIdx = linkedIdx < insertIdx ? linkedIdx + 2 : linkedIdx + 1;
            this.td.clips.splice(linkedInsertIdx, 0, linkedPart2);
        } else {
            // Audio locked or no link: only split this clip, unlink if needed
            part2.linked_id = null;
            if (clip.linked_id) clip.linked_id = null;
            this.td.clips.splice(insertIdx, 0, part2);
        }
        this._save();
        this._renderAll();
        this._toast("片段已分割", "success");
    }

    _attachBoxSelection(contentEl, trackType, trackIndex) {
        let isSelecting = false;
        let selBox = null;
        let startX = 0, startY = 0;
        let dragStarted = false;
        const DRAG_THRESHOLD = 5;

        const onMDown = (e) => {
            // Only start box selection if clicking on empty area (not on a clip)
            if (e.target.closest(".bsai-pp-clip-block") || e.target.closest(".bsai-pp-transition-arrow")) return;
            if (e.button !== 0) return; // left button only
            if (this.batchMode || this.scissorMode) return;
            isSelecting = true;
            dragStarted = false;
            startX = e.clientX;
            startY = e.clientY;
            const rect = contentEl.getBoundingClientRect();
            e.preventDefault();
            const onMove = (ev) => {
                if (!isSelecting) return;
                const dx = Math.abs(ev.clientX - startX);
                const dy = Math.abs(ev.clientY - startY);
                if (!dragStarted && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
                    dragStarted = true;
                    // Create selection box only after drag threshold is met
                    selBox = document.createElement("div");
                    selBox.className = "bsai-pp-select-box";
                    contentEl.appendChild(selBox);
                }
                if (!dragStarted || !selBox) return;
                const curX = ev.clientX;
                const curY = ev.clientY;
                const left = Math.min(startX, curX) - rect.left;
                const top = Math.min(startY, curY) - rect.top;
                const width = Math.abs(curX - startX);
                const height = Math.abs(curY - startY);
                selBox.style.left = left + "px";
                selBox.style.top = top + "px";
                selBox.style.width = width + "px";
                selBox.style.height = height + "px";
            };
            const onUp = (ev) => {
                isSelecting = false;
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                if (!dragStarted || !selBox) return;
                // Check if selBox is still in the DOM
                if (!selBox.parentNode) return;
                // Select clips that intersect with the selection box
                const boxRect = selBox.getBoundingClientRect();
                const clips = this._getClipsForTrack(trackType, trackIndex);
                const newSelected = new Set();
                clips.forEach(clip => {
                    const clipIdx = this.td.clips.indexOf(clip);
                    const clipBlock = contentEl.querySelector(`[data-clip-idx="${clipIdx}"]`);
                    if (clipBlock) {
                        const clipRect = clipBlock.getBoundingClientRect();
                        if (!(boxRect.right < clipRect.left || boxRect.left > clipRect.right ||
                              boxRect.bottom < clipRect.top || boxRect.top > clipRect.bottom)) {
                            newSelected.add(clipIdx);
                        }
                    }
                });
                // Auto-select linked audio/video partners
                for (const idx of newSelected) {
                    const clip = this.td.clips[idx];
                    if (clip?.linked_id) {
                        const linkedIdx = this.td.clips.findIndex(c => c.id === clip.linked_id);
                        if (linkedIdx >= 0) newSelected.add(linkedIdx);
                    }
                }
                // Merge into boxSelected (additive selection)
                for (const idx of newSelected) this.boxSelected.add(idx);
                selBox.remove();
                selBox = null;
                if (this.boxSelected.size > 0) {
                    this._renderTimeline();
                    this._renderBoxBar();
                }
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
        };
        // Use addEventListener to avoid overwriting other handlers
        contentEl.addEventListener("mousedown", onMDown);
    }

    _renderBoxBar() {
        if (this.boxSelected.size === 0) {
            this._removeBoxBar();
            return;
        }
        let bar = this.modal.querySelector("#bsai-pp-box-bar");
        if (!bar) {
            bar = document.createElement("div");
            bar.id = "bsai-pp-box-bar";
            bar.className = "bsai-pp-batch-bar";
            this.modal.querySelector(".bsai-pp-modal").insertBefore(
                bar, this.modal.querySelector(".bsai-pp-footer")
            );
        }
        const count = this.boxSelected.size;
        bar.innerHTML = `
            <span class="bsai-pp-batch-info">框选 <strong>${count}</strong> 个片段</span>
            <button class="bsai-pp-btn" data-box-act="move-left">◀ 左移</button>
            <button class="bsai-pp-btn" data-box-act="move-right">右移 ▶</button>
            <button class="bsai-pp-btn bsai-pp-btn-danger" data-box-act="delete">🗑 删除选中</button>
            <button class="bsai-pp-btn" data-box-act="clear">取消选择</button>`;
        bar.querySelector('[data-box-act="move-left"]').onclick = () => {
            const indices = [...this.boxSelected].sort((a, b) => a - b);
            for (const idx of indices) this._moveClip(idx, -1);
            // Update boxSelected indices after move
            this.boxSelected.clear();
            this._renderTimeline();
            this._renderBoxBar();
        };
        bar.querySelector('[data-box-act="move-right"]').onclick = () => {
            const indices = [...this.boxSelected].sort((a, b) => b - a);
            for (const idx of indices) this._moveClip(idx, 1);
            this.boxSelected.clear();
            this._renderTimeline();
            this._renderBoxBar();
        };
        bar.querySelector('[data-box-act="delete"]').onclick = () => {
            const indices = [...this.boxSelected].sort((a, b) => b - a);
            // Collect all clip IDs to delete (including linked partners), skip locked tracks
            const clipIdsToDelete = new Set();
            const fileNamesToDelete = new Set();
            let skippedLocked = 0;
            for (const idx of indices) {
                const clip = this.td.clips[idx];
                if (!clip) continue;
                if (this._isTrackLocked(clip)) { skippedLocked++; continue; }
                clipIdsToDelete.add(clip.id);
                if (clip.linked_id) clipIdsToDelete.add(clip.linked_id);
                fileNamesToDelete.add(clip.file_name);
            }
            if (skippedLocked > 0) {
                this._toast(`${skippedLocked} 个片段在锁定轨道上，已跳过`, "info");
            }
            if (!this.td.deleted_files) this.td.deleted_files = [];
            for (const fn of fileNamesToDelete) {
                if (!this.td.deleted_files.includes(fn)) this.td.deleted_files.push(fn);
            }
            this.td.clips = this.td.clips.filter(c => !clipIdsToDelete.has(c.id));
            this.boxSelected.clear();
            this.selectedIndex = -1;
            this._save();
            this._renderAll();
            this._removeBoxBar();
            this._toast(`已删除 ${clipIdsToDelete.size} 个片段（含关联音视频）`, "success");
        };
        bar.querySelector('[data-box-act="clear"]').onclick = () => {
            this.boxSelected.clear();
            this._renderTimeline();
            this._removeBoxBar();
        };
    }

    _removeBoxBar() {
        const bar = this.modal.querySelector("#bsai-pp-box-bar");
        if (bar) bar.remove();
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
        // Load video thumbnails as filmstrips (multiple keyframes fill width)
        const thumbs = this.modal.querySelectorAll("[data-thumb]");
        for (const el of thumbs) {
            const path = el.getAttribute("data-thumb");
            if (!path || path === "null") continue;
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
                const elHeight = el.offsetHeight || 80;
                const resp = await api.fetchApi(`/bsai_premiere_pro/filmstrip?file=${encodeURIComponent(path)}&height=${elHeight}`);
                if (!resp.ok) { this.thumbCache.set(path, null); continue; }
                const data = await resp.json();
                if (data.filmstrip) {
                    this.thumbCache.set(path, data.filmstrip);
                    el.innerHTML = `<img src="${data.filmstrip}">`;
                    badges.forEach(b => el.appendChild(b));
                } else {
                    this.thumbCache.set(path, null);
                }
            } catch (e) { this.thumbCache.set(path, null); }
        }
        // Load audio waveforms
        if (!this.waveformCache) this.waveformCache = new Map();
        const waveEls = this.modal.querySelectorAll("[data-waveform]");
        for (const el of waveEls) {
            const path = el.getAttribute("data-waveform");
            if (!path || path === "null") continue;
            const badges = Array.from(el.querySelectorAll(".bsai-pp-clip-badge"));
            if (this.waveformCache.has(path)) {
                const cached = this.waveformCache.get(path);
                if (cached && cached.length > 0) {
                    this._drawWaveform(el, cached, badges);
                }
                continue;
            }
            try {
                const resp = await api.fetchApi(`/bsai_premiere_pro/waveform?file=${encodeURIComponent(path)}`);
                if (!resp.ok) { this.waveformCache.set(path, null); continue; }
                const data = await resp.json();
                if (data.waveform && data.waveform.length > 0) {
                    this.waveformCache.set(path, data.waveform);
                    this._drawWaveform(el, data.waveform, badges);
                } else {
                    this.waveformCache.set(path, null);
                }
            } catch (e) { this.waveformCache.set(path, null); }
        }
    }

    _drawWaveform(el, samples, badges) {
        el.innerHTML = "";
        const canvas = document.createElement("canvas");
        canvas.className = "bsai-pp-clip-waveform-canvas";
        const w = el.offsetWidth || 120;
        const h = el.offsetHeight || 50;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#1a2a1a";
        ctx.fillRect(0, 0, w, h);
        const n = samples.length;
        if (n > 0) {
            const barW = Math.max(1, w / n);
            const mid = h / 2;
            ctx.fillStyle = "#4caf50";
            for (let i = 0; i < n; i++) {
                const amp = Math.abs(samples[i]);
                const barH = Math.max(1, amp * mid * 0.9);
                const x = Math.floor(i * barW);
                ctx.fillRect(x, mid - barH, Math.max(1, barW - 0.5), barH * 2);
            }
        }
        el.appendChild(canvas);
        badges.forEach(b => el.appendChild(b));
    }

    _renderEditPanel() {
        const panel = this.modal.querySelector("[data-edit]");
        if (!panel) return;
        if (this.selectedIndex < 0 || this.selectedIndex >= (this.td.clips || []).length) {
            // Show global settings panel when no clip is selected
            const videoClips = (this.td.clips || []).filter(c => c.track_type === "video");
            const totalDur = videoClips.reduce((s, c) => s + (c.trim_end - c.trim_start), 0);
            const outputName = this._getWidgetValue("output_filename", "premiere_pro_output");
            const frameRate = this._getWidgetValue("frame_rate", 24);
            const defaultTrans = this._getWidgetValue("default_transition", "fade");
            const transDur = this._getWidgetValue("transition_duration", 0.5);
            panel.innerHTML = `
                <div class="bsai-pp-edit-row">
                    <label>输出文件名</label>
                    <input type="text" value="${escapeHtml(outputName)}" data-global="output_filename" style="flex:1;min-width:150px;">
                </div>
                <div class="bsai-pp-edit-row">
                    <label>帧率</label>
                    <input type="number" min="1" max="120" step="1" value="${frameRate}" data-global="frame_rate" style="width:70px;">
                    <label>默认过渡</label>
                    <select data-global="default_transition">
                        ${TRANSITIONS.map(t => `<option value="${t}" ${t === defaultTrans ? "selected" : ""}>${TRANSITION_LABELS[t]}</option>`).join("")}
                    </select>
                    <label>过渡时长</label>
                    <input type="number" min="0" max="5" step="0.1" value="${transDur}" data-global="transition_duration" style="width:70px;">
                </div>
                <div class="bsai-pp-edit-row">
                    <label>片段总数</label>
                    <span style="color:#4a90d9;font-size:13px;font-weight:600;">${videoClips.length} 个视频</span>
                    <label>总时长</label>
                    <span style="color:#4caf50;font-size:13px;font-weight:600;">${formatTime(totalDur)}</span>
                </div>
                <div class="bsai-pp-clip-actions">
                    <button class="bsai-pp-btn" data-act="scan">🔍 扫描目录</button>
                    <button class="bsai-pp-btn" data-act="manual-import">📥 导入文件</button>
                    <button class="bsai-pp-btn" data-act="play" id="bsai-pp-play-btn2">▶️ 播放</button>
                    <button class="bsai-pp-btn bsai-pp-btn-primary" data-act="render">🎞️ 渲染输出</button>
                    <button class="bsai-pp-btn bsai-pp-btn-danger" data-act="clear-all">🗑 清空全部</button>
                </div>
                <div style="color:#666;font-size:11px;margin-top:8px;">💡 点击时间轴中的片段可编辑其参数</div>`;
            // Attach global setting handlers
            panel.querySelectorAll("[data-global]").forEach(input => {
                const field = input.getAttribute("data-global");
                const handler = () => {
                    let val;
                    if (input.type === "checkbox") val = input.checked;
                    else if (input.type === "number") val = parseFloat(input.value) || 0;
                    else val = input.value;
                    const w = this._getWidget(field);
                    if (w) w.value = val;
                    this.td[field] = val;
                    this._save();
                    if (field === "default_transition" || field === "transition_duration") {
                        this._renderTimeline();
                    }
                };
                input.onchange = handler;
                if (input.type === "range") input.oninput = handler;
            });
            // Attach action button handlers
            const scanBtn = panel.querySelector('[data-act="scan"]');
            if (scanBtn) scanBtn.onclick = () => this._scanNow();
            const importBtn = panel.querySelector('[data-act="manual-import"]');
            if (importBtn) importBtn.onclick = () => this._manualImport();
            const playBtn = panel.querySelector('[data-act="play"]');
            if (playBtn) playBtn.onclick = () => this._togglePlayback();
            const renderBtn = panel.querySelector('[data-act="render"]');
            if (renderBtn) renderBtn.onclick = () => this._renderVideo();
            const clearBtn = panel.querySelector('[data-act="clear-all"]');
            if (clearBtn) clearBtn.onclick = () => this._clearAllClips();
            return;
        }
        const clip = this.td.clips[this.selectedIndex];
        if (clip.is_gap) {
            panel.innerHTML = `<div class="bsai-pp-no-selection">此位置是空位（已删除的片段）<br>点击空位块可选择移除它</div>`;
            return;
        }
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
            const posX = clip.pos_x ?? 0;
            const posY = clip.pos_y ?? 0;
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
                <label>画面位置</label>
                <span style="color:#888;font-size:11px;">X</span>
                <input type="range" class="bsai-pp-pos-slider" min="-100" max="100" step="1" value="${posX}" data-field="pos_x">
                <input type="number" min="-100" max="100" step="1" value="${posX}" data-field="pos_x" style="width:50px;">
                <span style="color:#888;font-size:11px;">Y</span>
                <input type="range" class="bsai-pp-pos-slider" min="-100" max="100" step="1" value="${posY}" data-field="pos_y">
                <input type="number" min="-100" max="100" step="1" value="${posY}" data-field="pos_y" style="width:50px;">
                <button class="bsai-pp-btn" data-act="reset-pos" style="padding:3px 8px;font-size:11px;">重置</button>
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
                ${isLinked
                    ? '<button class="bsai-pp-btn" data-act="toggle-link" style="border-color:#ffa726;color:#ffa726;">🔓 取消关联</button>'
                    : '<button class="bsai-pp-btn" data-act="toggle-link" style="border-color:#4a90d9;color:#4a90d9;">🔗 建立关联</button>'}
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

        const linkBadges = panel.querySelectorAll('[data-act="toggle-link"]');
        linkBadges.forEach(btn => btn.onclick = () => this._toggleLink(clip));

        panel.querySelector('[data-act="move-left"]').onclick = () => this._moveClip(this.selectedIndex, -1);
        panel.querySelector('[data-act="move-right"]').onclick = () => this._moveClip(this.selectedIndex, 1);
        panel.querySelector('[data-act="delete"]').onclick = () => {
            const c = this.td.clips[this.selectedIndex];
            if (c && c.linked_id) {
                const linked = this.td.clips.find(x => x.id === c.linked_id);
                const linkedName = linked ? linked.file_name : "";
                const overlay = document.createElement("div");
                overlay.className = "bsai-pp-dialog-overlay";
                const dialog = document.createElement("div");
                dialog.className = "bsai-pp-import-dialog";
                dialog.style.minWidth = "360px";
                dialog.innerHTML = `
                    <h3>🗑 删除确认</h3>
                    <div style="color:#ccc;font-size:13px;padding:10px 0;">
                        该片段已链接音视频，删除将同时移除：<br>
                        🎬 ${escapeHtml(c.file_name)}<br>
                        🎵 ${escapeHtml(linkedName)}<br>
                        <span style="color:#ff9800;">关联的音视频片段将一并删除</span>
                    </div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button class="bsai-pp-btn" data-cancel>取消</button>
                        <button class="bsai-pp-btn bsai-pp-btn-danger" data-confirm>确认删除</button>
                    </div>`;
                overlay.appendChild(dialog);
                document.body.appendChild(overlay);
                _addMaximizeBtn(dialog);
                dialog.querySelector("[data-cancel]").onclick = () => overlay.remove();
                dialog.querySelector("[data-confirm]").onclick = () => {
                    overlay.remove();
                    this._deleteClip(this.selectedIndex);
                };
            } else {
                this._deleteClip(this.selectedIndex);
            }
        };
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
        const resetPosBtn = panel.querySelector('[data-act="reset-pos"]');
        if (resetPosBtn) resetPosBtn.onclick = () => {
            clip.pos_x = 0;
            clip.pos_y = 0;
            this._save();
            this._renderEditPanel();
        };
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

    _autoLinkClips() {
        const allVideos = this.td.clips.filter(c => c.track_type === "video");
        const unlinkedAudios = this.td.clips.filter(c => c.track_type === "audio" && !c.linked_id && !c.is_gap);
        let linked = 0;
        const removedAudioIds = new Set();
        for (const audio of unlinkedAudios) {
            let audioBase = (audio.file_name || "").replace(/\.[^.]+$/, "");
            audioBase = audioBase.replace(/[-_]audio[-_]?\d*$/i, "");
            let matchedVideo = null;
            // First try unlinked videos
            for (const video of allVideos) {
                if (video.linked_id) continue;
                let videoBase = (video.file_name || "").replace(/\.[^.]+$/, "");
                if (videoBase === audioBase) { matchedVideo = video; break; }
            }
            // Then try linked videos (replace embedded audio with separate audio)
            if (!matchedVideo) {
                for (const video of allVideos) {
                    if (!video.linked_id) continue;
                    let videoBase = (video.file_name || "").replace(/\.[^.]+$/, "");
                    if (videoBase === audioBase) {
                        const oldAudio = this.td.clips.find(c => c.id === video.linked_id);
                        if (oldAudio) { oldAudio.linked_id = null; removedAudioIds.add(oldAudio.id); }
                        matchedVideo = video;
                        break;
                    }
                }
            }
            if (matchedVideo) {
                matchedVideo.linked_id = audio.id;
                audio.linked_id = matchedVideo.id;
                audio.trim_start = matchedVideo.trim_start;
                audio.trim_end = matchedVideo.trim_end;
                audio.transition_in = matchedVideo.transition_in;
                audio.transition_out = matchedVideo.transition_out;
                audio.transition_duration = matchedVideo.transition_duration;
                linked++;
            }
        }
        // Remove replaced embedded audio clips
        if (removedAudioIds.size > 0) {
            this.td.clips = this.td.clips.filter(c => !removedAudioIds.has(c.id));
        }
        // Rearrange clips: video first, paired audio immediately after, unlinked audio at end
        if (linked > 0 || unlinkedAudios.length > 0) {
            const videoClips = this.td.clips.filter(c => c.track_type === "video");
            const allAudioClips = this.td.clips.filter(c => c.track_type === "audio");
            const usedAudioIds = new Set();
            const newClips = [];
            for (const vClip of videoClips) {
                newClips.push(vClip);
                if (vClip.linked_id) {
                    const aClip = allAudioClips.find(c => c.id === vClip.linked_id);
                    if (aClip && !usedAudioIds.has(aClip.id)) {
                        newClips.push(aClip);
                        usedAudioIds.add(aClip.id);
                    }
                }
            }
            // Add unlinked audio clips at the end
            for (const aClip of allAudioClips) {
                if (!usedAudioIds.has(aClip.id)) newClips.push(aClip);
            }
            this.td.clips = newClips;
        }
        if (linked > 0) {
            this._toast(`自动配对 ${linked} 组音视频`, "success");
        }
        this._alignAudioToVideo();
    }

    _alignAudioToVideo() {
        // Remove old gap clips first to prevent accumulation
        this.td.clips = this.td.clips.filter(c => !c.is_gap);

        const videoClips = this.td.clips.filter(c => c.track_type === "video");
        const allAudioClips = this.td.clips.filter(c => c.track_type === "audio" && !c.is_gap);
        const usedAudioIds = new Set();
        const newClips = [];

        // Place unlinked audio at the beginning (aligned with first video)
        const unlinkedAudios = allAudioClips.filter(a => !a.linked_id);
        for (const aClip of unlinkedAudios) {
            newClips.push(aClip);
            usedAudioIds.add(aClip.id);
        }

        for (const vClip of videoClips) {
            newClips.push(vClip);
            const vDur = (vClip.trim_end - vClip.trim_start) || 0;
            if (vClip.linked_id) {
                const aClip = allAudioClips.find(c => c.id === vClip.linked_id);
                if (aClip && !usedAudioIds.has(aClip.id)) {
                    newClips.push(aClip);
                    usedAudioIds.add(aClip.id);
                    continue;
                }
            }
            newClips.push({
                id: `gap_${vClip.id}_${Date.now()}`,
                track_type: "audio",
                track_index: 0,
                file_path: null,
                file_name: "(gap)",
                duration: vDur,
                trim_start: 0,
                trim_end: vDur,
                is_gap: true,
                linked_id: null,
                transition_in: "cut",
                transition_out: "cut",
                transition_duration: 0,
            });
        }

        this.td.clips = newClips;
        this.selectedIndex = -1;
        this.boxSelected.clear();
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
                const deleted = new Set(this.td.deleted_files || []);
                const newFiles = data.files.filter(f => !known.has(f.file_name) && !deleted.has(f.file_name));
                if (newFiles.length > 0) {
                    let added = 0;
                    for (const file of newFiles) {
                        const ok = await this._addClipFromFile(file);
                        if (ok) added++;
                    }
                    this._autoLinkClips();
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
            // Use metadata from upload response if available, otherwise fetch it
            let meta;
            if (file.duration !== undefined) {
                // Upload response already has metadata
                meta = file;
            } else {
                const metaResp = await api.fetchApi(`/bsai_premiere_pro/metadata?file=${encodeURIComponent(file.file_path)}`);
                meta = await metaResp.json();
                if (meta.error) { this._toast(meta.error, "error"); return false; }
            }
            const isImage = /\.(png|jpg|jpeg|bmp|gif|webp|tiff?|svg)$/i.test(file.file_name || "");
            const isAudioOnly = /\.(mp3|wav|aac|flac|ogg|m4a|wma|opus)$/i.test(file.file_name || "");
            const hasAudioSuffix = /[-_]audio[-_]?\d*\.\w+$/i.test(file.file_name || "");
            const hasVideoStream = (meta.width || 0) > 0 && (meta.height || 0) > 0;
            const treatAsAudioOnly = (isAudioOnly || hasAudioSuffix) && !hasVideoStream;
            const duration = meta.duration || (isImage ? 5 : 0);
            const hasAudio = meta.has_audio || false;
            const vId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const aId = `clip_${Date.now() + 1}_${Math.random().toString(36).substr(2, 6)}`;
            const base = {
                file_path: file.file_path, file_name: file.file_name,
                created_time: file.created_time || Date.now() / 1000,
                duration: duration,
                width: meta.width || (treatAsAudioOnly ? 0 : 1080), height: meta.height || (treatAsAudioOnly ? 0 : 1920), fps: meta.fps || 30,
                has_audio: hasAudio,
                trim_start: 0, trim_end: duration,
                transition_in: "fade", transition_out: "fade",
                transition_duration: parseFloat(this._getWidgetValue("transition_duration", 0.5)),
                audio_replacement: null, audio_fade_in: 0, audio_fade_out: 0,
                video_enabled: true, audio_enabled: true,
            };
            if (treatAsAudioOnly) {
                // Pure audio or -audio suffix file: create audio clip only
                this.td.clips.push({ ...base, id: aId, track_type: "audio", track_index: 0, linked_id: null, is_video_part: false });
            } else if (isImage || !hasAudio) {
                // Image or video without audio: create video clip only, no audio clip
                this.td.clips.push({ ...base, id: vId, track_type: "video", track_index: 0, linked_id: null, is_video_part: true, is_image: isImage || undefined });
            } else {
                // Video with audio: create both linked clips
                this.td.clips.push({ ...base, id: vId, track_type: "video", track_index: 0, linked_id: aId, is_video_part: true });
                this.td.clips.push({ ...base, id: aId, track_type: "audio", track_index: 0, linked_id: vId, is_video_part: false });
            }
            if (!this.td.known_files) this.td.known_files = [];
            this.td.known_files.push(file.file_name);
            if (this.td.deleted_files) {
                this.td.deleted_files = this.td.deleted_files.filter(f => f !== file.file_name);
            }
            return true;
        } catch (e) {
            this._toast(`导入失败: ${file.file_name}`, "error");
            return false;
        }
    }

    async _manualImport() {
        // Use native Windows file picker, then upload files to server
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.accept = "video/*,audio/*,image/*";
        input.style.display = "none";
        document.body.appendChild(input);

        input.onchange = async () => {
            const files = Array.from(input.files || []);
            document.body.removeChild(input);
            if (files.length === 0) return;
            this._toast(`正在上传 ${files.length} 个文件...`, "info");
            let imported = 0;
            let lastClipId = null;
            const prevScrollLeft = this.modal.querySelector("[data-track-content]")?.scrollLeft || 0;
            for (const file of files) {
                const isVideo = /\.(mp4|avi|mov|mkv|webm|flv|wmv|m4v|mpg|mpeg|ts|3gp)$/i.test(file.name);
                const isAudio = /\.(mp3|wav|aac|flac|ogg|m4a|wma|opus)$/i.test(file.name);
                const isImage = /\.(png|jpg|jpeg|bmp|gif|webp|tiff?|svg)$/i.test(file.name);
                if (!isVideo && !isAudio && !isImage) {
                    this._toast(`跳过不支持的文件: ${file.name}`, "error");
                    continue;
                }
                try {
                    const formData = new FormData();
                    formData.append("file", file, file.name);
                    const resp = await api.fetchApi("/bsai_premiere_pro/upload", {
                        method: "POST",
                        body: formData,
                    });
                    const result = await resp.json();
                    if (result.error) {
                        this._toast(`上传 ${file.name} 失败: ${result.error}`, "error");
                        continue;
                    }
                    const fileInfo = (result.files || [])[0];
                    if (!fileInfo || fileInfo.error) {
                        this._toast(`上传 ${file.name} 失败: ${fileInfo?.error || "无返回数据"}`, "error");
                        continue;
                    }
                    // Track the clip ID for selection
                    const clipCountBefore = this.td.clips.length;
                    await this._addClipFromFile(fileInfo);
                    if (this.td.clips.length > clipCountBefore) {
                        lastClipId = this.td.clips[this.td.clips.length - 1].id;
                    }
                    imported++;
                } catch (e) {
                    this._toast(`导入 ${file.name} 失败: ${e.message}`, "error");
                }
            }
            if (imported > 0) {
                this._toast(`成功导入 ${imported} 个文件`, "success");
                this._autoLinkClips();
                this._save();
                this._renderAll();
                // Select the last imported clip, don't jump to first video
                if (lastClipId) {
                    const newIdx = this.td.clips.findIndex(c => c.id === lastClipId);
                    if (newIdx >= 0) {
                        this.selectedIndex = newIdx;
                        // Restore scroll position instead of jumping to first clip
                        const trackContent = this.modal.querySelector("[data-track-content]");
                        if (trackContent) trackContent.scrollLeft = prevScrollLeft;
                        this._renderEditPanel();
                    }
                }
            }
        };
        input.click();
    }

    _showImportDialog(files, knownSet) {
        const deletedSet = new Set(this.td.deleted_files || []);
        const overlay = document.createElement("div");
        overlay.className = "bsai-pp-dialog-overlay";
        const dialog = document.createElement("div");
        dialog.className = "bsai-pp-import-dialog";
        dialog.innerHTML = `
            <h3>选择要导入的视频文件</h3>
            <div class="bsai-pp-import-list">
                ${files.map(f => {
                    const icon = knownSet.has(f.file_name) ? "✅" : deletedSet.has(f.file_name) ? "❌" : "⬜";
                    const hint = deletedSet.has(f.file_name) ? ' title="此前已删除，可重新导入"' : "";
                    return `<div class="bsai-pp-import-item" data-path="${escapeHtml(f.file_path)}" data-name="${escapeHtml(f.file_name)}"${hint}>
                        <span>${icon}</span>
                        <span>${escapeHtml(f.file_name)}</span>
                        <span class="size">${(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>`;
                }).join("")}
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button class="bsai-pp-btn" data-cancel>取消</button>
                <button class="bsai-pp-btn bsai-pp-btn-primary" data-import>导入选中</button>
            </div>`;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        _addMaximizeBtn(dialog);
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
        // Check track locking
        if (this._isTrackLocked(clip)) {
            this._toast("该轨道已锁定，无法移动片段", "error");
            return;
        }
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

    _reorderClip(fromIdx, toIdx) {
        const clip = this.td.clips[fromIdx];
        if (!clip) return;
        // Check track locking
        if (this._isTrackLocked(clip)) {
            this._toast("该轨道已锁定，无法移动片段", "error");
            return;
        }
        const trackType = clip.track_type;
        const trackIndex = clip.track_index;

        // Collect all track clips arrays at once (these are filtered copies)
        const allTracks = [];
        for (let i = 0; i < (this.td.video_tracks || []).length; i++) {
            allTracks.push({ type: "video", index: i, clips: this._getClipsForTrack("video", i) });
        }
        for (let i = 0; i < (this.td.audio_tracks || []).length; i++) {
            allTracks.push({ type: "audio", index: i, clips: this._getClipsForTrack("audio", i) });
        }

        // Find the track to reorder
        const targetTrack = allTracks.find(t => t.type === trackType && t.index === trackIndex);
        if (!targetTrack) return;

        const fromTrackPos = targetTrack.clips.indexOf(clip);
        const targetClip = this.td.clips[toIdx];
        const toTrackPos = targetTrack.clips.indexOf(targetClip);
        if (fromTrackPos < 0 || toTrackPos < 0 || fromTrackPos === toTrackPos) return;

        // Reorder within the track (modify the filtered array directly)
        targetTrack.clips.splice(fromTrackPos, 1);
        targetTrack.clips.splice(toTrackPos, 0, clip);

        // If linked, also reorder the linked clip in its track
        if (clip.linked_id) {
            const linked = this.td.clips.find(c => c.id === clip.linked_id);
            if (linked) {
                const linkedTrack = allTracks.find(t => t.type === linked.track_type && t.index === linked.track_index);
                if (linkedTrack) {
                    const lFromPos = linkedTrack.clips.indexOf(linked);
                    const lNewPos = Math.min(toTrackPos, linkedTrack.clips.length - 1);
                    if (lFromPos >= 0 && lFromPos !== lNewPos) {
                        linkedTrack.clips.splice(lFromPos, 1);
                        linkedTrack.clips.splice(lNewPos, 0, linked);
                    }
                }
            }
        }

        // Rebuild full clips array from all track clips arrays
        const newClipsOrder = [];
        for (const t of allTracks) {
            newClipsOrder.push(...t.clips);
        }
        // Include any clips that don't belong to any track (safety)
        for (const c of this.td.clips) {
            if (!newClipsOrder.includes(c)) newClipsOrder.push(c);
        }
        this.td.clips = newClipsOrder;

        this.selectedIndex = this.td.clips.indexOf(clip);
        this._save();
        this._renderAll();
    }

    _deleteClip(index) {
        const clip = this.td.clips[index];
        if (!clip) return;
        // Check track locking
        if (this._isTrackLocked(clip)) {
            this._toast("该轨道已锁定，无法删除片段", "error");
            return;
        }
        // Track deleted file to prevent auto-reimport
        if (!this.td.deleted_files) this.td.deleted_files = [];
        if (!this.td.deleted_files.includes(clip.file_name)) {
            this.td.deleted_files.push(clip.file_name);
        }
        // If linked, also delete the linked partner (both removed, no gap - clips shift forward)
        if (clip.linked_id) {
            const idsToDelete = new Set([clip.id, clip.linked_id]);
            // Simply remove both clips - remaining clips naturally shift forward
            this.td.clips = this.td.clips.filter(c => !idsToDelete.has(c.id));
        } else {
            // Unlinked clip: replace with gap placeholder to preserve position alignment
            // (the partner on the other track stays, so gap maintains alignment)
            const gapClips = [];
            for (const c of this.td.clips) {
                if (c.id === clip.id) {
                    gapClips.push({
                        id: c.id + "_gap",
                        track_type: c.track_type,
                        track_index: c.track_index,
                        file_path: null,
                        file_name: "(gap)",
                        duration: c.duration || 0,
                        trim_start: 0,
                        trim_end: c.duration || 0,
                        is_gap: true,
                        linked_id: null,
                        transition_in: "cut",
                        transition_out: "cut",
                        transition_duration: 0,
                    });
                } else {
                    gapClips.push(c);
                }
            }
            this.td.clips = gapClips;
        }
        this.selectedIndex = -1;
        this.boxSelected.clear();
        this._save();
        this._renderAll();
    }

    async _replaceVideo(index) {
        const watchDir = this._getWidgetValue("watch_directory", "output");
        let initialPath = "";
        if (watchDir && watchDir !== "output") initialPath = watchDir;
        const selected = await browseFilesDialog(initialPath);
        if (!selected || selected.length === 0) return;
        const file = selected[0];
        try {
            const metaResp = await api.fetchApi(`/bsai_premiere_pro/metadata?file=${encodeURIComponent(file.path)}`);
            const meta = await metaResp.json();
            if (meta.error) { this._toast(`无法读取 ${file.name}: ${meta.error}`, "error"); return; }
            const clip = this.td.clips[index];
            clip.file_path = file.path;
            clip.file_name = file.name;
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
                    linked.file_path = file.path;
                    linked.file_name = file.name;
                    linked.duration = meta.duration || 0;
                    linked.has_audio = meta.has_audio || false;
                    linked.trim_start = 0;
                    linked.trim_end = meta.duration || 0;
                }
            }
            this.thumbCache.delete(file.path);
            this._save();
            this._renderAll();
            this._toast("视频已替换", "success");
        } catch (e) {
            this._toast("替换失败: " + e.message, "error");
        }
    }

    async _browseAudio(clip) {
        const watchDir = this._getWidgetValue("watch_directory", "output");
        let initialPath = "";
        if (watchDir && watchDir !== "output") initialPath = watchDir;
        const selected = await browseFilesDialog(initialPath);
        if (!selected || selected.length === 0) return;
        const file = selected[0];
        clip.audio_replacement = file.path;
        const inp = this.modal.querySelector('[data-field="audio_replacement"]');
        if (inp) inp.value = file.path;
        this._save();
        this._renderTimeline();
        this._toast("音频已替换", "success");
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
                format: this._getWidgetValue("format", "video/h264-mp4"),
                pix_fmt: this._getWidgetValue("pix_fmt", "yuv420p"),
                crf: parseFloat(this._getWidgetValue("crf", 19)),
                frame_rate: parseFloat(this._getWidgetValue("frame_rate", 24)),
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
        const overlay = this.modal.querySelector("[data-timeline-preview]");
        const video = this.modal.querySelector("[data-preview-video]");
        if (overlay && video) {
            video.src = `/view?filename=${encodeURIComponent(filename)}&type=output`;
            this._previewVideoActive = true;
            this._stopPlayback();
            overlay.classList.add("visible");
            overlay.classList.add("fullscreen");
            const enlargeBtn = this.modal.querySelector('[data-act="enlarge-preview"]');
            if (enlargeBtn) enlargeBtn.textContent = "🗗";
            const infoEl = this.modal.querySelector("[data-preview-info]");
            if (infoEl) infoEl.textContent = `🎞️ 渲染结果: ${filename}`;
            this._previewZoom = 1;
            video.style.transform = "";
            // Fill entire preview area, use contain to show full video without cropping
            overlay.style.width = "100%";
            overlay.style.height = "100%";
            overlay.style.left = "0";
            overlay.style.top = "0";
            overlay.style.transform = "none";
            video.style.width = "100%";
            video.style.height = "100%";
            video.style.objectFit = "contain";
            video.style.objectPosition = "center";
            video.play().catch(() => {});
            video.ontimeupdate = () => {
                const prog = this.modal.querySelector("[data-preview-progress]");
                if (prog && video.duration > 0) {
                    prog.style.width = (video.currentTime / video.duration * 100) + "%";
                }
            };
            video.onended = () => {
                const prog = this.modal.querySelector("[data-preview-progress]");
                if (prog) prog.style.width = "0%";
            };
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
function _registerBsaiPP() {
    const app = window.comfyAPI?.app?.app ?? window.app;
    if (!app || typeof app.registerExtension !== "function") {
        console.log("[BSAI Premiere Pro] Waiting for app...", !!window.comfyAPI, !!window.app);
        setTimeout(_registerBsaiPP, 200);
        return;
    }
    api = window.comfyAPI?.api?.api ?? window.api;
    console.log("[BSAI Premiere Pro] Registering extension, app found, api:", !!api);
    try {
    const _bsaiExt = {
    name: "BSAI.PremierePro",

    async beforeRegisterNodeDef(nodeType, nodeData, appInstance) {
        if (nodeData.name !== NODE_TYPE) return;

        const BTN_H = 26;
        const BTN_GAP = 4;
        const BTN_MARGIN = 10;
        const BTN_EXTRA = BTN_H * 2 + BTN_GAP + BTN_MARGIN;

        function _initTdProperty(node) {
            if (!node.properties) node.properties = {};
            if (!node.properties.bsai_td) {
                node.properties.bsai_td = '{"clips":[],"known_files":[],"deleted_files":[],"directory_history":{}}';
            }
        }

        function _syncToServer(node) {
            const json = node.properties?.bsai_td || '{"clips":[],"known_files":[],"deleted_files":[],"directory_history":{}}';
            api.fetchApi("/bsai_premiere_pro/timeline_save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ node_id: String(node.id), timeline_data: json }),
            }).catch(() => {});
        }

        function _forceResize(node) {
            requestAnimationFrame(() => {
                const computed = node.computeSize();
                node.setSize([Math.max(420, computed[0]), Math.max(computed[1], 260)]);
                node.setDirtyCanvas(true, true);
            });
        }

        // Check if image and audio input ports are both connected
        function _checkPortConnections(node) {
            const imageConnected = node.inputs?.some(i => i.name === "image" && i.link != null);
            const audioConnected = node.inputs?.some(i => i.name === "audio" && i.link != null);
            const bothConnected = !!(imageConnected && audioConnected);

            // Update node title to show mode
            const importer = importerMap.get(node.id);
            if (importer) {
                try {
                    const td = JSON.parse(node.properties?.bsai_td || '{"clips":[]}');
                    const clipCount = (td.clips || []).filter(c => c.track_type === "video").length;
                    const modeLabel = bothConnected ? "⚡自动" : "✋手动";
                    const dur = td.clips?.length > 0
                        ? formatTime(td.clips.filter(c => c.track_type === "video").reduce((s, c) => s + (c.trim_end - c.trim_start), 0))
                        : "00:00.00";
                    node.title = `🎬 BSAI Premiere Pro (${clipCount} clips / ${dur}) [${modeLabel}]`;
                } catch {}
            }

            // Only show dialog when transitioning to "both connected" state
            if (bothConnected && !node._bsaiBothConnected) {
                node._bsaiBothConnected = true;
                if (importer) {
                    const clips = importer.td?.clips || [];
                    if (clips.length > 0) {
                        _showClearTimelineDialog(node, importer);
                    }
                }
            } else if (!bothConnected) {
                node._bsaiBothConnected = false;
            }
        }

        function _showClearTimelineDialog(node, importer) {
            const clips = importer.td?.clips || [];
            const vCount = clips.filter(c => c.track_type === "video").length;
            const aCount = clips.filter(c => c.track_type === "audio").length;
            const overlay = document.createElement("div");
            overlay.className = "bsai-pp-dialog-overlay";
            const dialog = document.createElement("div");
            dialog.className = "bsai-pp-import-dialog";
            dialog.style.minWidth = "400px";
            dialog.innerHTML = `
                <h3>🔌 检测到 Image + Audio 已连接</h3>
                <div style="color:#ccc;font-size:13px;padding:10px 0;line-height:1.6;">
                    节点已切换为<b style="color:#4a90d9;">自动合并模式</b>。<br>
                    时间轴上已有 <b style="color:#ffa726;">${vCount}</b> 个视频片段和 <b style="color:#4caf50;">${aCount}</b> 个音频片段。<br>
                    <span style="color:#ff9800;">是否删除时间轴上的现有文件？</span><br>
                    <span style="color:#888;font-size:12px;">删除后将从头开始按时间顺序自动合并新文件。</span>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button class="bsai-pp-btn" data-keep>保留现有文件</button>
                    <button class="bsai-pp-btn bsai-pp-btn-danger" data-clear>删除现有文件</button>
                </div>`;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            _addMaximizeBtn(dialog);
            dialog.querySelector("[data-keep]").onclick = () => {
                overlay.remove();
            };
            dialog.querySelector("[data-clear]").onclick = () => {
                // Clear timeline
                importer.td.clips = [];
                importer.td.known_files = [];
                importer.td.deleted_files = [];
                importer._save();
                const editor = importer._editor;
                if (editor) editor.refresh();
                overlay.remove();
            };
        }

        // ── Draw buttons on canvas via onDrawForeground ──
        const oldDrawFg = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            oldDrawFg?.apply(this, arguments);
            if (this.flags?.collapsed) return;

            const w = this.size[0] - BTN_MARGIN * 2;
            const browseY = this.size[1] - BTN_EXTRA;
            const editorY = browseY + BTN_H + BTN_GAP;

            this._bsaiBtns = [
                { x: BTN_MARGIN, y: browseY, w: w, h: BTN_H, action: "browse" },
                { x: BTN_MARGIN, y: editorY, w: w, h: BTN_H, action: "editor" },
            ];

            for (const btn of this._bsaiBtns) {
                ctx.fillStyle = "#3a3a3a";
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 5);
                else ctx.rect(btn.x, btn.y, btn.w, btn.h);
                ctx.fill();

                ctx.fillStyle = "#ddd";
                ctx.font = "13px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const label = btn.action === "browse" ? "📂 浏览监视目录" : "🎬 打开时间轴编辑器";
                ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
            }
        };

        // ── Handle button clicks via onMouseDown ──
        const oldMouseDown = nodeType.prototype.onMouseDown;
        nodeType.prototype.onMouseDown = function (e, localPos, canvas) {
            const r = oldMouseDown?.apply(this, arguments);
            if (r) return r;
            if (!this._bsaiBtns) return r;

            for (const btn of this._bsaiBtns) {
                if (localPos[0] >= btn.x && localPos[0] <= btn.x + btn.w &&
                    localPos[1] >= btn.y && localPos[1] <= btn.y + btn.h) {
                    if (btn.action === "browse") {
                        const dirWidget = this.widgets?.find(w => w.name === "watch_directory");
                        const oldDir = dirWidget?.value || "";
                        // Use Windows Explorer folder picker via webkitdirectory
                        const dirInput = document.createElement("input");
                        dirInput.type = "file";
                        dirInput.setAttribute("webkitdirectory", "");
                        dirInput.style.display = "none";
                        document.body.appendChild(dirInput);
                        dirInput.onchange = async () => {
                            const files = Array.from(dirInput.files || []);
                            document.body.removeChild(dirInput);
                            if (files.length === 0) return;
                            // Filter media files
                            const mediaFiles = files.filter(f => /\.(mp4|avi|mov|mkv|webm|flv|wmv|m4v|mpg|mpeg|ts|3gp|mp3|wav|aac|flac|ogg|m4a|wma|opus|png|jpg|jpeg|bmp|gif|webp|tiff?|svg)$/i.test(f.name));
                            if (mediaFiles.length === 0) return;
                            // Save current state to directory_history
                            let td;
                            try { td = JSON.parse(this.properties?.bsai_td || '{}'); } catch { td = {}; }
                            if (!td.clips) td.clips = [];
                            if (!td.known_files) td.known_files = [];
                            if (!td.deleted_files) td.deleted_files = [];
                            if (!td.directory_history) td.directory_history = {};
                            if (!td.video_tracks) td.video_tracks = [{ name: "V1", locked: false, visible: true }];
                            if (!td.audio_tracks) td.audio_tracks = [{ name: "A1", locked: false, muted: false, solo: false }];
                            if (oldDir) {
                                td.directory_history[oldDir] = {
                                    clips: td.clips, known_files: td.known_files, deleted_files: td.deleted_files,
                                    video_tracks: td.video_tracks, audio_tracks: td.audio_tracks,
                                };
                            }
                            // Clear current timeline for new directory
                            td.clips = [];
                            td.known_files = [];
                            td.deleted_files = [];
                            // Upload all media files to server and create clips directly
                            for (const file of mediaFiles) {
                                try {
                                    const formData = new FormData();
                                    formData.append("file", file, file.name);
                                    const resp = await api.fetchApi("/bsai_premiere_pro/upload", { method: "POST", body: formData });
                                    const result = await resp.json();
                                    const fi = (result.files || [])[0];
                                    if (!fi || fi.error) continue;
                                    const isImg = /\.(png|jpg|jpeg|bmp|gif|webp|tiff?|svg)$/i.test(fi.file_name);
                                    const isAudioOnly = /\.(mp3|wav|aac|flac|ogg|m4a|wma|opus)$/i.test(fi.file_name);
                                    const hasAudSuffix = /[-_]audio[-_]?\d*\.\w+$/i.test(fi.file_name);
                                    const dur = fi.duration || (isImg ? 5 : 0);
                                    const hasAud = fi.has_audio || false;
                                    const vId = `clip_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
                                    const aId = `clip_${Date.now()+1}_${Math.random().toString(36).substr(2,6)}`;
                                    const base = {
                                        file_path: fi.file_path, file_name: fi.file_name,
                                        created_time: Date.now()/1000, duration: dur,
                                        width: fi.width || (isAudioOnly ? 0 : 1080), height: fi.height || (isAudioOnly ? 0 : 1920),
                                        fps: fi.fps || 30, has_audio: hasAud,
                                        trim_start: 0, trim_end: dur,
                                        transition_in: "fade", transition_out: "fade",
                                        transition_duration: 0.5, audio_replacement: null,
                                        audio_fade_in: 0, audio_fade_out: 0,
                                        video_enabled: true, audio_enabled: true,
                                    };
                                    if (isAudioOnly || hasAudSuffix) {
                                        td.clips.push({ ...base, id: aId, track_type: "audio", track_index: 0, linked_id: null, is_video_part: false });
                                    } else if (isImg || !hasAud) {
                                        td.clips.push({ ...base, id: vId, track_type: "video", track_index: 0, linked_id: null, is_video_part: true });
                                    } else {
                                        td.clips.push({ ...base, id: vId, track_type: "video", track_index: 0, linked_id: aId, is_video_part: true });
                                        td.clips.push({ ...base, id: aId, track_type: "audio", track_index: 0, linked_id: vId, is_video_part: false });
                                    }
                                    td.known_files.push(fi.file_name);
                                } catch (e) { /* skip failed */ }
                            }
                            // Set watch directory to upload directory
                            const uploadDir = "output/bsai_imports";
                            if (dirWidget) dirWidget.value = uploadDir;
                            this.properties.bsai_td = JSON.stringify(td);
                            _syncToServer(this);
                            const importer = importerMap.get(this.id);
                            if (importer) {
                                importer.updateNodeTitle(td);
                            }
                        };
                        dirInput.click();
                    } else if (btn.action === "editor") {
                        const editor = new TimelineEditor(this);
                        editor.open();
                    }
                    return true;
                }
            }
            return r;
        };

        // ── Add height for buttons via computeSize ──
        const oldComputeSize = nodeType.prototype.computeSize;
        nodeType.prototype.computeSize = function () {
            const size = oldComputeSize.apply(this, arguments);
            size[1] += BTN_EXTRA;
            return size;
        };

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);
            _initTdProperty(this);
            _syncToServer(this);
            const importer = new AutoImporter(this);
            importerMap.set(this.id, importer);
            importer.start();
            try {
                importer.updateNodeTitle(JSON.parse(this.properties?.bsai_td || '{"clips":[]}'));
            } catch {}
            _forceResize(this);
        };

        const onAdded = nodeType.prototype.onAdded;
        nodeType.prototype.onAdded = function () {
            onAdded?.apply(this, arguments);
            _forceResize(this);
            _checkPortConnections(this);
        };

        // Detect when image/audio ports are connected/disconnected
        const onConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (side, slot, connected, link, input) {
            onConnectionsChange?.apply(this, arguments);
            _checkPortConnections(this);
        };

        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            const importer = importerMap.get(this.id);
            if (importer) { importer.stop(); importerMap.delete(this.id); }
            onRemoved?.apply(this, arguments);
        };

        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (info) {
            const result = onConfigure?.apply(this, arguments);
            _initTdProperty(this);
            // Migrate old timeline_data from widgets_values if present
            if ((!this.properties.bsai_td || this.properties.bsai_td === '{"clips":[],"known_files":[]}') && info?.widgets_values) {
                for (const v of info.widgets_values) {
                    if (typeof v === "string" && v.includes('"clips"')) {
                        try { JSON.parse(v); this.properties.bsai_td = v; break; } catch {}
                    }
                }
            }
            _syncToServer(this);
            const importer = importerMap.get(this.id);
            if (!importer) {
                const imp = new AutoImporter(this);
                importerMap.set(this.id, imp);
                imp.start();
            }
            if (importer) {
                try {
                    importer.updateNodeTitle(JSON.parse(this.properties?.bsai_td || '{"clips":[]}'));
                } catch {}
            }
            _forceResize(this);
            _checkPortConnections(this);
            return result;
        };

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);
            // ComfyUI 0.32.0 wraps UI values in lists
            const tdVal = message?.timeline_data;
            const tdStr = Array.isArray(tdVal) ? tdVal[0] : tdVal;
            if (tdStr) {
                if (!this.properties) this.properties = {};
                this.properties.bsai_td = tdStr;
                _syncToServer(this);
                const importer = importerMap.get(this.id);
                if (importer) {
                    try {
                        importer.updateNodeTitle(JSON.parse(tdStr));
                    } catch {}
                    const editor = importer._editor;
                    if (editor) editor.refresh();
                }
                _forceResize(this);
            }
            const msgVal = message?.merge_msg;
            const msgStr = Array.isArray(msgVal) ? msgVal[0] : msgVal;
            if (msgStr) {
                const editor = importerMap.get(this.id)?._editor;
                if (editor) editor._toast(msgStr, "info");
            }
            _checkPortConnections(this);
        };

        // Mark hooks as applied so the fallback can detect
        nodeType.prototype._bsai_hooks_applied = true;
        nodeType.prototype.onDrawForeground._bsai = true;
    },
    };
    app.registerExtension(_bsaiExt);
    console.log("[BSAI Premiere Pro] Extension registered successfully");

    // Fallback: if node type was already registered before our extension
    // loaded (e.g. script loaded late via bsai_pp_loader.js), manually
    // apply hooks to the existing node type. Use retries for slower computers.
    let _fallbackAttempts = 0;
    const _fallbackInterval = setInterval(() => {
        _fallbackAttempts++;
        try {
            const lg = window.LiteGraph;
            if (lg && lg.registered_node_types && lg.registered_node_types[NODE_TYPE]) {
                const nt = lg.registered_node_types[NODE_TYPE];
                if (!nt.prototype._bsai_hooks_applied || !nt.prototype.onDrawForeground?._bsai) {
                    console.log("[BSAI Premiere Pro] Applying hooks to pre-registered node type (attempt " + _fallbackAttempts + ")");
                    _bsaiExt.beforeRegisterNodeDef(nt, { name: NODE_TYPE }, app);
                }
                // Also resize any existing node instances on canvas
                const canvas = app.canvas || window.canvas;
                if (canvas && canvas.graph && canvas.graph._nodes) {
                    for (const node of canvas.graph._nodes) {
                        if (node.type === NODE_TYPE) {
                            // Force resize to show buttons
                            requestAnimationFrame(() => {
                                const computed = node.computeSize();
                                node.setSize([Math.max(420, computed[0]), Math.max(computed[1], 260)]);
                                node.setDirtyCanvas(true, true);
                            });
                        }
                    }
                }
                clearInterval(_fallbackInterval);
                console.log("[BSAI Premiere Pro] Fallback completed successfully");
            }
        } catch (e) {
            console.error("[BSAI Premiere Pro] Fallback attempt " + _fallbackAttempts + " failed:", e);
        }
        if (_fallbackAttempts >= 30) { // 30 * 500ms = 15 seconds max
            clearInterval(_fallbackInterval);
            console.error("[BSAI Premiere Pro] Fallback: max attempts (30) reached. Node type '" + NODE_TYPE + "' not found.");
        }
    }, 500);

    // ── Continuous button visibility guard ──
    // Periodically check all BSAI nodes and ensure buttons are visible.
    // This handles late node creation, graph load/restore, and any edge case
    // where onDrawForeground or computeSize hooks were lost.
    setInterval(() => {
        try {
            const canvas = app.canvas || window.canvas;
            if (!canvas || !canvas.graph || !canvas.graph._nodes) return;
            for (const node of canvas.graph._nodes) {
                if (node.type !== NODE_TYPE) continue;
                // Check if onDrawForeground is still our function (not overwritten)
                if (!node.onDrawForeground || !node.onDrawForeground._bsai) {
                    // Delete instance-level override so prototype function is used
                    if (node.hasOwnProperty('onDrawForeground')) {
                        delete node.onDrawForeground;
                    }
                    if (node.hasOwnProperty('onMouseDown')) {
                        delete node.onMouseDown;
                    }
                    if (node.hasOwnProperty('computeSize')) {
                        delete node.computeSize;
                    }
                    const lg = window.LiteGraph;
                    const nt = lg?.registered_node_types?.[NODE_TYPE];
                    if (nt && (!nt.prototype._bsai_hooks_applied || !nt.prototype.onDrawForeground?._bsai)) {
                        console.log("[BSAI Premiere Pro] Re-applying hooks (guard: onDrawForeground missing)");
                        _bsaiExt.beforeRegisterNodeDef(nt, { name: NODE_TYPE }, app);
                    }
                }
                // Always force resize and redraw to ensure buttons are visible
                const BTN_H = 26, BTN_GAP = 4, BTN_MARGIN = 10;
                const BTN_EXTRA = BTN_H * 2 + BTN_GAP + BTN_MARGIN;
                const expectedMinH = (node.computeSize?.() || [0, 260])[1];
                if (node.size[1] < expectedMinH - 5) {
                    node.setSize([Math.max(420, node.size[0]), Math.max(expectedMinH, 260)]);
                }
                node.setDirtyCanvas?.(true, true);
            }
        } catch (e) {
            // Silent - guard should not spam console
        }
    }, 500);
    } catch (e) {
        console.error("[BSAI Premiere Pro] Extension registration failed:", e);
    }
}
_registerBsaiPP();
} // end else (not already loaded)
