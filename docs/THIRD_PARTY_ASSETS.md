# 第三方资源与授权

运行资源为本地 PNG、SVG、TTF、MP3、OGG；没有外部 CDN。保留的素材及模型源逐项 SHA-256 记录在 `assets/third_party/ASSET_MANIFEST.sha256`，由 `node development/web-tools/verify.mjs` 校验。发布包另生成覆盖全部文件的 `MANIFEST.sha256`。

| 作者 / 来源 | 许可 | 用途与保留位置 |
| --- | --- | --- |
| Lorc / [Game-icons.net](https://game-icons.net/) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 路线节点、道具瓶及 12 位精神使者的 SVG；`assets/third_party/game-icons`，保留作者、逐项来源和 `LICENSE.txt`。原图完整保存，界面以 CSS 蒙版着色 |
| Kenney [Space Kit](https://kenney.nl/assets/space-kit)、[Modular Space Kit](https://kenney.nl/assets/modular-space-kit)、[Tower Defense Kit](https://kenney.nl/assets/tower-defense-kit) | CC0 1.0 | 40套构造、敌人及首领八方向像素图集的模型来源；PNG在`assets/game/sprites`，GLB与三套许可在`development/assets/model_sources/kenney` |
| Kenney [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds) | CC0 1.0 | 武器、部署、护盾、错误和爆炸反馈；`assets/third_party/kenney/sci-fi-sounds` |
| TakWolf 与上游字体作者 [缝合像素字体](https://github.com/TakWolf/fusion-pixel-font) | SIL OFL 1.1 | 简体中文10px字体；`assets/third_party/fusion-pixel-font`，含`OFL.txt` |
| vitalezzz [Singularity](https://opengameart.org/content/singularity-0) | CC0 1.0 | 同步calm/action双层音乐；`assets/third_party/opengameart/singularity`，含`LICENSE.txt` |
| SRG774 [Dark Sci-Fi Audio Pack](https://opengameart.org/content/dark-sci-fi-audio-pack) | CC0 1.0 | 菜单、路线、安全节点、奖励和结算音乐；`assets/third_party/opengameart/dark-sci-fi-audio` |
| [Node.js v24.12.0](https://github.com/nodejs/node/tree/v24.12.0) 及其依赖作者 | MIT及所含第三方许可 | 发布版静态文件服务器运行时。完整官方许可在`assets/third_party/node/LICENSE.txt`，打包时复制到`runtime/LICENSE.txt` |

Node许可取自[官方v24.12.0 LICENSE](https://raw.githubusercontent.com/nodejs/node/v24.12.0/LICENSE)，2026-09-05核验，SHA-256为`537308465103a306d0e3eecf42632b4ff1b48aaaec044e9fc10a78c81fd00b34`。运行时版本改变时必须同时更新许可证。

40类实体由经过许可核验的 Kenney GLB 零件重新组合，包含 60 个塔阶级/分支外观、22 个普通/精英外观和 18 个首领阶段外观。80 张 PNG 分为界面静止图集和八方向动作图集，每格 80×80，共 8000 个动作帧。Blender 离线烘焙脚本、49 个实际引用 GLB 与许可保留供继续制作；运行包只加载 PNG，不包含 Blender、GLB 源或旧引擎资源。详细配方与复现说明见[模型和动作](ENTITY_MODELS_AND_ANIMATION.md)。

路线主图、道具瓶与精神使者肖像使用上述 Lorc 图标；资源图标、道具效果徽记、面板和按钮由本项目 SVG/CSS 实现。旧版Kenney UI/Game Icons/Input Prompts素材已不被新版使用，随旧资源清理。

音乐采用许可允许的响度处理与运行时混音。calm/action同起点、同长度循环，危险度控制等功率混合；其他曲目按实测响度补偿播放。源码和发行包均保留对应许可与来源信息。
