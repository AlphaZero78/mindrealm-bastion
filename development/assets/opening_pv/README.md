# 心域防线开场影片制作

目标成片长 135 秒，导出为 1920 × 1080、24 帧/秒的横版视频。影片介绍精神控制、记忆工厂、偏频者和醒觉火种，以悲壮、压迫的末世氛围承接游戏开始。源镜头为 1344 × 768，合成时裁切为 16:9，再放大至导出尺寸。

当前音频修订采用用户选定的 F“沧桑微沙”声线。Qwen3-TTS VoiceDesign 生成试听样例，Base 模型以这个原创合成样例为参考，继续生成 12 段旁白。剪辑保留自然音高，并放慢朗读速度。全片源镜头的音轨已移出混音，当前声音由新旁白和已清理的配乐组成。

片尾使用共同文字基线，修正“一”字上浮的问题。中文沿用宋体，英文沿用 Times New Roman，标语字号调整为 34 像素。

当前制作状态见 `production-session.json`。已取回的镜头记录在 `media-manifest.json`，其中保留原始请求编号和文件校验值。`creativeReviewed` 表示实际画面已完成审阅。

| 文件 | 用途 |
| --- | --- |
| `creative-brief.json`、`shotlist.json` | 世界观、画面和叙事时间安排。 |
| `narration.zh-CN.txt` | 便于阅读和修改的完整旁白。 |
| `cloud-shots.json` | 14 段源镜头的生成提示词和剪辑位置。 |
| `build-cloud-requests.py`、`cloud/` | 生成云端请求，执行分阶段渲染并保存检查结果。 |
| `generate-designed-voices.py`、`build-designed-voice-auditions.py` | 生成可选择的原创声线，制作等时长、等响度试听。 |
| `generate-selected-narration.py` | 以用户选定的合成试听为参考，生成同一声线的完整旁白。 |
| `align-selected-narration.py` | 放慢新旁白，并按实际录音安排时间和字幕。 |
| `align-professional-voice.py`、`refine-voice-word.py` | 保留第二版 HeyGen 配音的剪辑和同字音节修订方法。 |
| `build-narration.py` | 保留初版 Kokoro 旁白的制作方法。 |
| `score-plan.json`、`build-score.py` | 音乐、音效和音量变化。 |
| `patch-score-window.py` | 将去除电子信号音效后的音乐接回 19–25 秒，保留其他时段的配乐分轨。 |
| `make-title-card.py` | 使用游戏徽记和标准字体生成片尾。 |
| `collect-clip.py` | 取回已完成的镜头，核对文件校验值。 |
| `assemble-film.py`、`validate-film.py` | 合成成片，检查实际视频、声音和字幕。 |
| `verify-audio-revision.py` | 集中检查修订成片，并对照新配音和被移除的原音效核对实际音轨。 |

修改旁白时，同时更新 `narration.zh-CN.txt` 和 `shotlist.json` 中对应的 `voice`。重新生成镜头时，先增加 `cloud-shots.json` 的 `revision`，再运行 `build-cloud-requests.py`。新请求使用独立编号，旧镜头和中间结果继续保留。

本机素材与缓存位于 `D:\game_build_archive\opening-pv-20261025`。云端画面项目位于 `/home/scc/pb25331949/projects/minimax_h3`，语音项目位于同级的 `qwen3_tts`。连接和登录会话管理沿用 `D:\training\cluster.ps1` 及现有云端工作流程。当前使用 Python 传输通道，大模型文件直接在云端下载。

当前配音原件、时间标记、新字幕和片尾位于本机素材目录的 `audio-revision-r3/`。`native/` 保存原始录音，`narration/` 保存剪辑后的旁白与字幕，`edit/` 保存画面和混音，`final-review/` 保存实际成片的检查证据。

第二版 HeyGen 录音与旧成片继续保留在 `audio-revision-r2/`。19 秒至 25 秒的尖锐电子音已在第二版中移除，第三版沿用其 `score-cleaned.wav` 配乐分轨。

语音转写提供字幕时间参考。少数短录音的尾部会诱发零时长的自动字幕文字，原始转写结果保留在 `native/narration-timing.json`。剪辑工具记录并排除这种异常转写片段，完整保留录音。普通字幕的显示区间覆盖整句声音，片尾两句话分别匹配火种镜头与片名卡。

云端批处理使用固定的 MiniMax H3 Turbo 8 步适配器。`cloud/turbo-loader.py` 在独立生成进程中完整应用适配器，再释放回退权重，为画面计算腾出显存。原始模型文件保留；这个节点只向生成流程提供应用适配器后的模型。对应的云端入口为 `scripts/opening_generate_batch_v2.sbatch`。

三幕场景的剪辑点按实际旁白停顿安排在 115.25、117.25 和 118.75 秒。`media-manifest.json` 中的 `editSourceIn` 可为已审阅的具体素材指定入点，合成时优先采用该值。

`media-manifest.json` 的 `editOverrides` 保存成片的素材选择与入点，优先于素材本身的入点。第 04、05 段分别使用源镜头 05、04，使记忆消除的画面对应“记忆被修整”，人流画面对应“街道越发整齐”。原始生成请求编号继续保留，便于追溯。

全部镜头取回后，可在 PowerShell 中重新合成：

```powershell
Set-Location D:\game_build
$pvWork = 'D:\game_build_archive\opening-pv-20261025'
$pvPython = Join-Path $pvWork 'tts-env\Scripts\python.exe'
$pvFFmpeg = Join-Path $pvWork 'python-runtime\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
& $pvPython development/assets/opening_pv/assemble-film.py --ffmpeg $pvFFmpeg --media-dir "$pvWork\source-clips" --media-manifest development/assets/opening_pv/media-manifest.json --narration-dir "$pvWork\audio-revision-r3\narration" --score "$pvWork\audio-revision-r2\score-cleaned.wav" --title-card "$pvWork\audio-revision-r3\title-card.png" --cached-edits-dir "$pvWork\edit\edits" --no-scene-audio --work-dir "$pvWork\audio-revision-r3\edit" --output 'D:\game_build_release\心域防线_开场PV\心域防线_世界观开场PV_沧桑男声版_135s.mp4'
```

合成脚本会检查全部镜头是否齐全，并复用已经完成的剪辑片段。`--no-scene-audio` 明确排除全部源镜头音轨。混音来源及校验值记录在 `soundtrack-provenance.json`。最终检查针对实际成片，包括完整解码、时长、帧数、字幕原文、音轨数据和片尾画面。声音风格的偏好以用户试听选择为准。

来源和许可见 `licenses/`。MiniMax H3 的许可包含成片使用与分发的地域限制。当前声线由 Qwen3-TTS 生成，模型使用 Apache-2.0 许可。生成参考来自用户选定的原创合成试听。音乐和音效使用游戏现有的 CC0 素材。公开展示时，按保留的许可要求说明 AI 生成影像。
