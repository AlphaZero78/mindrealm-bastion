# 第三方资源与授权

运行资源包括本地 GLB、PNG、纹理、环境光、SVG、TTF、MP3 和 OGG；Three.js 同样保存在本地。保留的素材及模型源逐项 SHA-256 记录在 `assets/third_party/ASSET_MANIFEST.sha256`，由 `node development/web-tools/verify.mjs` 校验。发布包另生成覆盖全部文件的 `MANIFEST.sha256`。

| 作者 / 来源 | 许可 | 用途与保留位置 |
| --- | --- | --- |
| Lorc / [Game-icons.net](https://game-icons.net/) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 路线节点、道具瓶及 12 位精神使者的 SVG；`assets/third_party/game-icons`，保留作者、逐项来源和 `LICENSE.txt`。原图完整保存，界面以 CSS 蒙版着色 |
| Kenney [Space Kit](https://kenney.nl/assets/space-kit)、[Modular Space Kit](https://kenney.nl/assets/modular-space-kit)、[Tower Defense Kit](https://kenney.nl/assets/tower-defense-kit) | CC0 1.0 | 49 类构造、敌人与首领的机械零件来源；运行 GLB 位于 `assets/game/models`，原始 GLB 与三套许可位于 `development/assets/model_sources/kenney` |
| Sergej Majboroda / Poly Haven [Studio Small 09](https://polyhaven.com/a/studio_small_09) | [CC0 1.0](https://polyhaven.com/license) | 金属环境反射；原始 1K HDR 位于 `assets/third_party/polyhaven`，预先过滤的运行纹理位于 `assets/game/lighting` |
| Rob Tuytel / Poly Haven [Blue Metal Plate](https://polyhaven.com/a/blue_metal_plate) | [CC0 1.0](https://polyhaven.com/license) | 原始 1K 颜色、法线与粗糙度纹理，提供机械表面磨损；位于 `assets/third_party/polyhaven`，同目录保留许可与来源 |
| [Three.js](https://github.com/mrdoob/three.js/tree/r186) 作者 | MIT | 0.186.1 本地渲染库、GLTFLoader 和制作时使用的 HDRLoader；`assets/third_party/three` 保留模块包与 `LICENSE.txt` |
| Kenney [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds) | CC0 1.0 | 武器、部署、护盾、错误和爆炸反馈；`assets/third_party/kenney/sci-fi-sounds` |
| TakWolf 与上游字体作者 [缝合像素字体](https://github.com/TakWolf/fusion-pixel-font) | SIL OFL 1.1 | 简体中文10px字体；`assets/third_party/fusion-pixel-font`，含`OFL.txt` |
| vitalezzz [Singularity](https://opengameart.org/content/singularity-0) | CC0 1.0 | 同步calm/action双层音乐；`assets/third_party/opengameart/singularity`，含`LICENSE.txt` |
| SRG774 [Dark Sci-Fi Audio Pack](https://opengameart.org/content/dark-sci-fi-audio-pack) | CC0 1.0 | 菜单、路线、安全节点、奖励和结算音乐；`assets/third_party/opengameart/dark-sci-fi-audio` |
| [Node.js v24.12.0](https://github.com/nodejs/node/tree/v24.12.0) 及其依赖作者 | MIT及所含第三方许可 | 发布版静态文件服务器运行时。完整官方许可在`assets/third_party/node/LICENSE.txt`，打包时复制到`runtime/LICENSE.txt` |

Node许可取自[官方v24.12.0 LICENSE](https://raw.githubusercontent.com/nodejs/node/v24.12.0/LICENSE)，2026-09-05核验，SHA-256为`537308465103a306d0e3eecf42632b4ff1b48aaaec044e9fc10a78c81fd00b34`。运行时版本改变时必须同时更新许可证。

49 类实体由 Kenney GLB 零件重新组合，包含 60 个塔阶级／分支外观、31 个普通／精英外观和 18 个首领阶段外观。制作脚本为 49 个零件增加倒角、加权法线、UV 和两级几何。运行时直接加载 GLB，界面使用同一模型导出的 256 像素肖像。原始零件、组装配方与许可保留供继续制作，详细流程见[模型和动作](ENTITY_MODELS_AND_ANIMATION.md)。旧像素图集用于回退及源资产检查，正常运行采用实时模型。

36 幅事件 CG 由本项目通过内置 ImageGen 生成，内容依据《心域防线》的事件故事。v0.1.3 采用写实科幻、赛博、巨构与废土风格，三幕分别表现边境聚落、工业设施和统御核心。主体位于左中部，为故事和选项保留空间；光照涵盖雨夜、荒漠日光、冷却井、室内工作灯与电磁风暴。

最终原始 PNG 位于 `assets/game/events`，保留工具输出的原始字节。完整提示词、生成与编辑步骤、输入源文件名、实测尺寸和 SHA-256 位于 `development/assets/event_art/prompts.json`。记录同时保留前一轮图像的来源信息，角色和地点采用本作原创内容。

路线主图、道具瓶与精神使者肖像使用上述 Lorc 图标；资源图标、道具效果徽记、面板和按钮由本项目 SVG/CSS 实现。旧版Kenney UI/Game Icons/Input Prompts素材已不被新版使用，随旧资源清理。

音乐采用许可允许的响度处理与运行时混音。calm/action同起点、同长度循环，危险度控制等功率混合；其他曲目按实测响度补偿播放。源码和发行包均保留对应许可与来源信息。
