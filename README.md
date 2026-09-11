# 🎬 BSAI Premiere Pro ｜ BSAI Premiere Pro

**ComfyUI 时间轴视频编辑节点 / Timeline-based video editing node for ComfyUI**

> 中英双语文档 / Bilingual documentation.

一个功能强大的 ComfyUI 自定义节点，提供专业级时间轴视频编辑能力：自动导入、剪辑裁剪、转场特效、音视频关联、多轨道管理、实时预览、4K 超分高清修复，全套功能。

A powerful ComfyUI custom node offering professional timeline video editing: auto-import, trimming, transitions, audio-video linking, multi-track management, live preview and 4K upscale HD fix.

## 功能特性 / Features

- **自动导入 / Auto-import**：监视目录，新视频自动进时间轴
- **剪辑裁剪 / Trim & split**：拖拽裁剪、剪刀工具、框选批量操作
- **转场特效 / Transitions**：切镜 / 淡入淡出 / 黑屏 / 白屏
- **音视频关联 / A/V linking**：音画联动剪辑，支持替换音频
- **多轨道管理 / Multi-track**：视频轨 + 音频轨，任意排列
- **实时预览 / Live preview**：时间轴 + 视频双预览
- **4K 超分高清修复 / 4K upscale**：输出前对视频轨执行超分放大 + 人脸修复（桥接 BSAI-H3-upscale-4K）

---

## 安装方法 / Installation

1. 将 `BSAI_Premiere_Pro` 文件夹放入 ComfyUI 的 `custom_nodes` 目录 / Copy the folder into `ComfyUI/custom_nodes`
2. 重启 ComfyUI / Restart ComfyUI
3. 在节点列表中搜索 `BSAI` 或 `Premiere` 即可找到节点 / Search "BSAI" or "Premiere" in the node list
4. 硬刷新浏览器（Ctrl+Shift+R）确保最新脚本加载 / Hard-refresh the browser to load the latest scripts

> 节点会自动将脚本注入 ComfyUI 前端，无需手动配置。/ The node injects its frontend scripts automatically.

---

## 节点参数说明 / Node Parameters

| 参数 / Parameter | 类型 | 默认值 / Default | 说明 / Description |
|---|---|---|---|
| `watch_directory` | 字符串 | `.\ComfyUI\output` | 监视目录路径，自动扫描该目录下的视频文件 / Watch directory for auto-import |
| `auto_import` | 布尔值 | `True` | 自动导入监视目录中的新视频文件 / Auto-import new videos |
| `default_transition` | 下拉 | `cut` | 默认转场：切镜/淡入淡出/黑屏过渡/白屏过渡 / cut/fade/black/white |
| `transition_duration` | 浮点数 | `0.5` | 转场时长（秒），范围 0.0-5.0 / Transition duration (s) |
| `output_filename` | 字符串 | `premiere_pro_output` | 输出文件名（不含扩展名）/ Output filename |
| `format` | 下拉 | `video/h264-mp4` | 输出格式：H264/H265-MP4/MKV/MOV、VP9-WebM / Output container+codec |
| `pix_fmt` | 下拉 | `yuv420p` | 像素格式：yuv420p/yuv444p/yuv422p/rgb24/bgr0 |
| `crf` | 浮点数 | `19` | 编码质量（0=无损，51=最差，建议 18-23）/ CRF quality |
| `frame_rate` | 浮点数 | `24` | 输出帧率（1-120）/ Output frame rate |
| `upscale_enable` | 布尔值 | `False` | 4K 超分总开关：合并输出前先对视频轨执行超分放大 / Master upscale switch |
| `upscale_model` | 下拉 | `realesr-general-x4v3.pth` | 超分模型（由 BSAI-H3-upscale-4K 提供：FlashVSR / SeedVR2 / NVIDIA RTX VSR / DLSS 5 / Topaz / Real-ESRGAN，缺失自动静默下载）/ Upscale model |
| `upscale_scale` | 浮点数 | `4.0` | 放大倍数（1.0-8.0），4 = 4K 级 / Scale factor |
| `upscale_tile_size` | 整数 | `0` | 超分分块：0=整帧快速路径（推荐），爆显存时改正数分块 / Tile size (0=whole frame) |
| `upscale_batch` | 整数 | `4` | 超分批帧数：控制显存占用与速度 / Batch frames |
| `upscale_detail` | 浮点数 | `0.5` | 细节增强强度（高清修复），0=关闭 / Detail enhancement |
| `upscale_face` | 下拉 | `Off` | 人脸修复：Off / GFPGANv1.4 / CodeFormer / 小脸增强(CodeFormer) / Face restore |

### 输入端口 / Inputs

| 端口 / Port | 类型 | 说明 / Description |
|---|---|---|
| `image` | IMAGE（可选） | 连接后进入**自动模式**，将图片+音频合成为视频 / Connected = Auto mode |
| `audio` | AUDIO（可选） | 配合 image 使用，提供音频轨道 / Audio track with image |

### 输出端口 / Outputs

| 端口 / Port | 类型 | 说明 / Description |
|---|---|---|
| `video_path` | STRING | 输出视频文件的完整路径 / Full path of output video |

---

## 两种工作模式 / Two Modes

节点标题实时显示状态：`🎬 BSAI Premiere Pro (N clips / MM:SS) [模式]`

### ✋ 手动模式（默认）/ Manual Mode (default)

- **触发**：`image` 和 `audio` 均未连接 / Neither input connected
- **行为**：点击「渲染输出」后，将时间轴上所有片段合并为一个完整视频 / Click "Render Output" to merge all clips
- **适用**：编辑已有视频片段，添加转场、裁剪后输出 / Edit existing footage

### ⚡ 自动模式 / Auto Mode

- **触发**：`image` 和 `audio` 均已连接 / Both inputs connected
- **行为**：每次执行工作流时，自动将传入的图片+音频合成为独立视频文件并添加到时间轴 / Each run merges the incoming image+audio into a clip on the timeline
- **特点**：不合并已有片段，只处理当前传入的一组图片+音频 / Never re-merges existing clips

---

## 时间轴编辑器功能 / Timeline Editor

### 顶部工具栏 / Toolbar
导入视频、添加轨道、保存/加载工程（历史目录）、撤销/重做、渲染输出等。/ Import, add track, save/load project, undo/redo, render.

### 轨道管理 / Tracks
视频轨（V）+ 音频轨（A）任意添加/删除/重命名；片段在轨上自由拖动排列。/ Add/remove/rename video & audio tracks; drag clips freely.

### 片段编辑面板 / Clip Edit Panel
选中片段后：裁剪起止点、设置转场、调节音量、视频/音频分离、替换音频、删除等。/ Trim in/out, transition, volume, detach audio, replace audio, delete.

### 剪刀工具 / Razor Tool
在时间轴任意位置切断片段；支持框选后批量操作（删除/移动/复制）。/ Cut clips at any position; batch select & edit.

### 播放预览 / Playback Preview
时间轴支持逐帧/变速预览，视频预览窗实时显示当前帧与音频波形。/ Frame stepping, speed control, waveform display.

### 框选与批量操作 / Box-select & Batch
拖拽框选多个片段，批量移动、删除、复制、设置转场。/ Box-select multiple clips for batch ops.

### 缩放与面板调整 / Zoom & Layout
时间轴水平缩放、轨道高度调节、面板拖拽布局。/ Horizontal zoom, track height, draggable panels.

### 视频预览 / Video Preview
双预览：时间轴缩略图 + 输出视频实时预览。/ Thumbnails + live video preview.

---

## 音视频关联系统 / A/V Linking System

- **关联状态显示 / Status**：视频片段上显示音频波形条，绿点=已关联 / Linked clips show waveform + green dot
- **关联操作 / Actions**：一键关联 / 解除关联 / 替换音频 / Link, unlink, replace audio
- **关联行为 / Behavior**：移动视频时音频跟随；裁剪视频时音频同步裁剪 / Move/trim keeps audio in sync

---

## 输出渲染 / Rendering

- **手动模式渲染 / Manual**：点击「渲染输出」按钮，合并时间轴全部片段（含转场、裁剪）/ Render all clips with transitions
- **自动模式渲染 / Auto**：每次执行自动渲染当前传入的图片+音频 / Render incoming image+audio per run
- **无缝拼接技术 / Seamless join**：同编码/同参数片段用流拷贝（stream copy）直接拼接，零重编码、无画质损失；参数不一致时自动转码对齐 / Stream-copy fast path when parameters match, re-encode otherwise

---

## 4K 超分高清修复 / 4K Upscale HD Fix

- **处理顺序（硬约束）/ Pipeline order**：视频轨文件 → **超分放大** → 与音频轨合并 → 输出 / Video tracks → upscale → merge audio → output
- **支持的超分能力（来自 BSAI-H3-upscale-4K）**: FlashVSR / SeedVR2 / NVIDIA RTX VSR / DLSS 5 引擎、Topaz 生成式、Real-ESRGAN 系列；人脸修复 GFPGAN/CodeFormer / Engines & models from BSAI-H3-upscale-4K
- **低显存适配 / Low-VRAM**：`upscale_tile_size` 分块、`upscale_batch` 分批控制显存 / Tile & batch control VRAM usage

---

## 示例工作流 / Example Workflow

`example_workflows/` 下提供参考工作流，`Workflow → Open` 加载即可。/ Reference workflow in `example_workflows/`.

### `BSAI_Premiere_Pro_Timeline_Render.json` — 时间轴编辑 + 4K 超分渲染

单节点示例工作流（`BSAIPremiereProTimeline`），演示完整用法：

1. **手动模式**：不连 `image`/`audio`，加载后设置 `watch_directory` 指向你的视频目录（默认 `.\ComfyUI\output`），打开节点面板在时间轴上编辑片段（裁剪/转场/关联音频），点「渲染输出」合并为成片。
2. **4K 超分**：勾选 `upscale_enable`，选 `upscale_model`（如 FlashVSR / SeedVR2），`upscale_scale=4.0` → 渲染时自动先超分视频轨再合并音频；远景小脸模糊时开 `upscale_face`（CodeFormer）。
3. **自动模式**：把节点 `image`/`audio` 接到上游（如 H3 生成的图片+音频），每次执行自动合成新片段进时间轴。
4. 输出路径经 `video_path` 端口输出，可接保存/预览节点。

**快捷键速查 / Hotkeys**: `Space` 播放/暂停 · `S` 剪刀 · `Del` 删除 · `Ctrl+Z/Y` 撤销/重做 · `Ctrl+A` 全选 · `Ctrl+拖拽` 复制片段 · `Alt+拖拽` 仅移动视频或音频

---

## 常见问题 / FAQ

| 问题 / Question | 解答 / Answer |
|---|---|
| 底部按钮不显示？ | 硬刷新浏览器（Ctrl+Shift+R）；确认 custom_nodes 下目录名正确 |
| 导入后看不到视频缩略图？ | 确认 `watch_directory` 指向正确的输出目录且含视频文件 |
| 拼接后画面闪烁/音频断裂？ | 参数不一致的片段会被转码对齐；仍异常时降低 `transition_duration` 或改用 cut 转场 |
| 时间轴窗口太小？ | 拖拽面板边缘调整；节点宽度可拉大 |
| 如何只删除视频不删除音频？ | 用「视频/音频分离」后再单独删除 |
| 自动模式不合并已有片段？ | 正常行为：自动模式只处理当前传入的图片+音频 |
| 超分爆显存？ | `upscale_tile_size` 改正数分块、降低 `upscale_batch` |

---

## 技术架构 / Architecture

- 前端：`web/bsai_pp.js`（时间轴 UI + 交互）、`web/bsai_pp_loader.js`（脚本加载器）
- 后端：`nodes.py`（节点与渲染逻辑）、`server.py`（API 路由）、`utils.py`（FFmpeg/文件工具）
- 渲染：FFmpeg 流拷贝快路径 + 转码对齐 + 超分桥接

## License / 许可证

本插件代码 Apache-2.0。/ This plugin is Apache-2.0 licensed.
