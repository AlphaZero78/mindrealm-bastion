# 第三方资源与授权

运行包只包含实际加载的 PNG、TTF、MP3、OGG 与许可证。所有 `assets/third_party/` 文件的 SHA-256 记录在 `assets/third_party/ASSET_MANIFEST.sha256`，构建前由 `development/tools/verify_assets.ps1` 逐项校验；下载压缩包、Godot 导入缓存和验证截图不进入仓库。

| 来源/作者 | 资源与原页面 | 许可 | 下载日期 | 下载包/原文件 SHA-256 | 项目内用途 |
|---|---|---|---|---|---|
| Kenney | [Space Kit](https://kenney.nl/assets/space-kit) | CC0 1.0 | 2026-08-27 | `D5D7CDF2635ED5A43A9187DEAF409B6F47484E402321128341D3C3698E9EF4D9` | 八方向构造、敌人与首领像素图集的离线 GLB 源 |
| Kenney | [Modular Space Kit](https://kenney.nl/assets/modular-space-kit) | CC0 1.0 | 2026-08-27 | `F394F7FD9EAF29C9DE7E090E55B69926F699841AF33B0B116F5CC0088DE8A4DC` | 首领像素图集的离线 GLB 源 |
| Kenney | [Tower Defense Kit](https://kenney.nl/assets/tower-defense-kit) | CC0 1.0 | 2026-08-27 | `D4C887680B709218315E4E1C17AE18C160635DCDFC4199763EEBA97C02C77F00` | 构造与飞行敌人像素图集的离线 GLB 源 |
| Kenney | [Pixel UI Pack](https://kenney.nl/assets/pixel-ui-pack) | CC0 1.0 | 2026-08-28 | `B76F2F60F2BE76EB8E66511038FA4D48FAEC11E638316FA37D06084878CDF0C7` | 深青像素面板、按钮与交互状态 |
| Kenney | [Game Icons](https://kenney.nl/assets/game-icons) | CC0 1.0 | 2026-08-28 | `7A86D8D58E0B851E22004B3C70BF90B003632BBF9AC633424DAA3BB17D9E7E4E` | 九类路线节点、核心资源和状态叠层图标 |
| Kenney | [Input Prompts Pixel](https://kenney.nl/assets/input-prompts-pixel) | CC0 1.0 | 2026-08-28 | `64478174064B77E9C0EBB8271FD38AF598CEC922650157CE1E564DF1272575CC` | 16×16 键鼠提示源图集 |
| Kenney | [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds) | CC0 1.0 | 2026-08-27 | `119340F351A5098AD814F78719438C0DA355A9CE8A4C8A3AF6A8D48AA3D49E04` | 部署、拒绝、武器、护盾、爆炸与环境音 |
| TakWolf 与上游字体作者 | [缝合像素字体](https://github.com/TakWolf/fusion-pixel-font) | SIL OFL 1.1 | 2026-08-28 | `6DC153F9F671DB3C053A65BADBF519998CDE5106064B4962DF950628DF3F7324` | 简体中文 10px 像素界面字体 |
| vitalezzz / OpenGameArt | [Singularity](https://opengameart.org/content/singularity-0) | CC0 1.0 | 2026-08-28 | calm `73F5628439C4EBB2A3242F1CF40A194CE3C552CAAD155646C32DCE8B02337D09`; action `09C93408A9A4EF47B336D7009B8C8C85E6B8946A4BEBFF17BC43ECE8381DE310` | 同步 calm/action 战斗层，按危险度等功率交叉淡化 |
| SRG774 / OpenGameArt | [Dark Sci-Fi Audio Pack](https://opengameart.org/content/dark-sci-fi-audio-pack) | CC0 1.0 | 2026-08-27 | `C17C40F2B5FF32A51016D121A017CF1A307E0065C7ACFCC30C66F05F1D047CE1` | 菜单、路线、节点、奖励和结算循环；旧战斗循环已删除 |

## 运行资产与开发源的边界

- 40 套八方向 PNG 图集位于 `assets/game/sprites/`，由 `development/tools/bake_pixel_sprites.gd` 生成；运行时不加载 GLB。
- 原始 GLB 与各自许可证保留在 `development/assets/model_sources/kenney/`，由 `.gdignore` 排除编辑器导入，并由 Windows 导出规则排除发布包。
- 所有运行素材保留原许可证文件。删除或替换素材前必须先通过 `rg` 与 Godot 资源加载检查确认没有引用。
