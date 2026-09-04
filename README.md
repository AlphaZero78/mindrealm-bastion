# 心域防线

《心域防线》是使用 Godot 4.7.2 与标准 GDScript 开发的简体中文 2.5D 像素肉鸽塔防游戏。玩家作为“偏频者”，在三幕、48 层图标化分支路线中维护醒觉火种、改造持久战场并构筑心智防线。

## 启动游戏

Windows 下直接双击根目录的 **`启动游戏.cmd`**。首次启动会自动准备固定版本的 Godot，之后会直接进入游戏。

也可以在 PowerShell 中运行：

```powershell
.\launcher\run_game.ps1
```

键鼠操作：WASD 始终按屏幕方向平移，中键拖拽平移，按住 Q/E 以每秒 90° 连续旋转并可完整环绕 360°，滚轮缩放，F 聚焦火种，右键或 Esc 取消战前操作。

## 文件在哪里

- `launcher/`：只放玩家启动逻辑。
- `development/`：开发工具、自动测试、视觉验证，以及不进入发布包的 GLB 烘焙源素材。
- `docs/`：玩法规则、开发说明和第三方资源授权。
- `src/`：GDScript 游戏代码。
- `scenes/`：Godot 场景与主场景入口。
- `content/`：单位、敌人、事件等可审查内容数据。
- `assets/`：项目自有资源与经过授权的第三方运行资源。

`project.godot` 与 `export_presets.cfg` 必须留在资源根目录，`AGENTS.md` 是项目开发规则；它们不是散落的游戏代码。

开发、测试和构建命令见 [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)，完整玩法规则见 [`docs/GAMEPLAY.md`](docs/GAMEPLAY.md)，第三方资源来源见 [`docs/THIRD_PARTY_ASSETS.md`](docs/THIRD_PARTY_ASSETS.md)。
