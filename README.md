# 心域防线

《心域防线》是使用 Godot 4.7.2 与标准 GDScript 从零开发的简体中文 3D 肉鸽塔防游戏。玩家作为“偏频者”，在三幕、48 层分支路线中维护醒觉火种、改造持久战场并构筑心智防线。

## 快速开始

```powershell
.\tools\setup_godot.ps1
.\tools\run_game.ps1
```

`setup_godot.ps1` 将 Godot 与 Windows x64 导出模板固定安装到用户工具目录，不向仓库写入引擎二进制。键鼠操作：WASD/中键平移，Q/E 四方向吸附旋转，滚轮缩放，F 聚焦火种，右键或 Esc 取消战前操作。

运行验证：

```powershell
.\tools\test.ps1
.\tools\verify_assets.ps1
.\tools\capture_visuals.ps1
.\tools\build_windows.ps1
```

发布包会写入仓库外的 `D:\game_build_release\心域防线`。测试使用隔离存档，不读取、修改或删除玩家真实存档。视觉脚本实际渲染 1920×1080、1366×768，以及 1080p 桌面在 Windows 125%/150% 缩放下的有效区域，并输出菜单、路线、战前、地形、战斗和六名首领截图供检查。

## 架构边界

- `RunState` 是三幕地图、持久地形、构造、资源、奖励、随机游标和复盘统计的单局唯一模型。
- `ContentCatalog` 按稳定 ID 载入并校验 12 种构造、18 种普通/功能敌人、4 名精英、6 名首领、30 件收藏品、24 项天赋和 24 个事件。
- `RuleService` 是部署、地形、射程、视线、伤害、压力、维修、融合和过载的唯一权威；预览与 20 Hz 战斗模拟调用同一规则。
- `BattleSimulation` 只接受确定性命令并产生类型化事件；`BattlefieldView` 使用外部 CC0 模型消费事件，不复制规则。
- `SaveService` 使用带版本与 SHA-256 校验的原子写入；战中退出只恢复战前快照。

## 目录约定

- `src/`：规则、模拟、存档和界面源码。
- `scenes/`：Godot 场景入口。
- `content/`：可审查的游戏内容与本地化数据。
- `assets/game/`：项目自有材质、VFX、图标与音频配置。
- `assets/third_party/`：仅保留实际使用的第三方运行资源和许可文件。
- `tests/`：规则、集成、完整流程和视觉验证。
- `tools/`：固定版本工具链、测试、资源检查和构建脚本。

完整规则见 `docs/GAMEPLAY.md`，第三方资源来源见 `docs/THIRD_PARTY_ASSETS.md`。
