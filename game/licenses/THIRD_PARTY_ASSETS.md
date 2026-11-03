# 第三方资源与授权

《心域防线》的模型、插画、字体和音频均随游戏提供，可离线加载。以下文件保留素材来源和对应许可。

| 作者与来源 | 许可 | 游戏中的用途 |
| --- | --- | --- |
| Lorc / [Game-icons.net](https://game-icons.net/) | CC BY 3.0 | 路线与道具图标；通过 CSS 蒙版着色。逐项来源见 `assets/third_party/game-icons/LICENSE.txt` |
| Kenney [Space Kit](https://kenney.nl/assets/space-kit)、[Modular Space Kit](https://kenney.nl/assets/modular-space-kit)、[Tower Defense Kit](https://kenney.nl/assets/tower-defense-kit) | CC0 1.0 | 历史模型资源；当前原创模型与动作由项目制作。原来源许可见本目录的 `kenney-*.txt` |
| Sergej Majboroda / Poly Haven [Studio Small 09](https://polyhaven.com/a/studio_small_09) | CC0 1.0 | 历史环境光来源；当前环境反射由本地 Three.js 场景生成 |
| Rob Tuytel / Poly Haven [Blue Metal Plate](https://polyhaven.com/a/blue_metal_plate) | CC0 1.0 | 历史表面纹理来源；原授权说明保留于 `assets/third_party/polyhaven/LICENSE.txt` |
| [Three.js](https://github.com/mrdoob/three.js/tree/r186) 作者 | MIT | 本地 3D 渲染与模型加载库。完整许可见 `assets/third_party/three/LICENSE.txt` |
| Kenney [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds) | CC0 1.0 | 武器、部署、护盾与爆炸音效。许可见 `assets/third_party/kenney/sci-fi-sounds/License.txt` |
| TakWolf 与上游字体作者 / [缝合像素字体](https://github.com/TakWolf/fusion-pixel-font) | SIL OFL 1.1 | 简体中文界面字体。许可见 `assets/third_party/fusion-pixel-font/OFL.txt` |
| vitalezzz / [Singularity](https://opengameart.org/content/singularity-0) | CC0 1.0 | 战斗的双层音乐，采用响度处理与运行时混音。许可见对应音频目录的 `LICENSE.txt` |
| SRG774 / [Dark Sci-Fi Audio Pack](https://opengameart.org/content/dark-sci-fi-audio-pack) | CC0 1.0 | 菜单、路线、节点与结算音乐。许可见对应音频目录的 `LICENSE.txt` |
| [Node.js v24.12.0](https://github.com/nodejs/node/tree/v24.12.0) 及其依赖作者 | MIT 及所含第三方许可 | Windows 便携版的本地服务器运行时。完整许可见 `runtime/LICENSE.txt` |

36 幅事件插画与 12 幅精神使者插画依据游戏的故事、角色与选择设计。2026-10-20 的最终选图包含 33 幅 Codex 内置 ImageGen 作品（其中 17 幅沿用原图）和 15 幅 Cursor GenerateImage 作品。具体生图模型以工具披露为准。游戏标识、资源图标、面板和按钮由本项目绘制。

CC0 与 CC BY 素材的原作者保留以上署名。各许可证全文随对应资源一并提供。

主菜单的 135 秒游戏 PV 采用本项目原创文稿与剪辑，包含 MiniMax H3 生成影像和 Qwen3-TTS 合成旁白。发行方已确认取得覆盖全球分发的额外授权。影片、封面、制作说明与模型公开许可位于 `assets/game/pv/`；配乐沿用上表的 CC0 素材。播放器通过“制作与授权”链接提供来源说明。

当前建筑、敌人与追踪无人机采用项目原创几何和配套关节动作，使用程序化圆角外壳、筒体、轴承和工作机构。肖像与回退图集均从相同模型渲染；制作源保存在开发目录。

本地 Three.js 0.186.1 的 PMREM 采样公式按固定法线视角作了等价化简，消除 Windows ANGLE 着色器编译时的三角函数舍入警告。库的 MIT 许可保持完整。
