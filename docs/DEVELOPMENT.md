# 开发说明

## 环境准备

项目固定使用 Godot 4.7.2。工具链安装在用户工具目录，不向仓库写入引擎二进制：

```powershell
.\development\tools\setup_godot.ps1
```

只需运行游戏时不必手动准备环境，根目录的 `启动游戏.cmd` 会按需完成轻量安装。

## 常用命令

```powershell
# 启动当前源码版本
.\launcher\run_game.ps1

# 规则、集成、确定性完整流程和性能验证
.\development\tools\test.ps1

# 第三方资源哈希、授权文件和 Godot 资源加载检查
.\development\tools\verify_assets.ps1

# 自适应音乐的 -18 LUFS、真峰值和双层时长检查（工具仅装到用户目录）
.\development\tools\verify_audio.ps1

# 多种分辨率与 Windows 缩放有效区域的视觉截图
.\development\tools\capture_visuals.ps1

# 从 development/assets 中的 CC0 GLB 重新烘焙八方向像素图集
& "$env:LOCALAPPDATA\MindrealmTools\Godot\4.7.2\Godot_v4.7.2-stable_win64_console.exe" --display-driver windows --rendering-driver opengl3 --audio-driver Dummy --path . --script res://development/tools/bake_pixel_sprites.gd

# 完整验证后导出 Windows x64 发布包
.\development\tools\build_windows.ps1
```

发布包写入仓库外的 `D:\game_build_release\心域防线`。测试使用隔离存档，不读取、修改或删除玩家真实存档；视觉截图属于临时验证产物，不应提交到仓库。

自动验证依次覆盖1000种子地图与规则断言、100个完整单局胜负终局、20个标准难度参考通关种子，以及100敌人/最大防线压力场景。

## 架构边界

- `RunState` 是三幕地图、持久地形、构造、资源、奖励、随机游标和复盘统计的单局唯一模型。
- `ContentCatalog` 按稳定 ID 载入并校验单位、敌人、首领、收藏品、天赋和事件。
- `RuleService` 是部署、地形事务、斜坡/峭壁路径、射程、视线、伤害、压力、维修、融合和过载的唯一权威；预览与战斗模拟调用同一规则。
- `BattleSimulation` 只接受确定性命令并产生类型化事件；`BattlefieldView` 消费事件，不复制规则。
- `SaveService` 使用带版本与 SHA-256 校验的原子写入；战中退出只恢复战前快照。

## 目录边界

- 玩家入口只进入 `launcher/`；不要把测试或构建逻辑放回入口目录。
- 开发设施统一放在 `development/tools/` 与 `development/tests/`；`development/assets/model_sources/` 由 `.gdignore` 隔离，不参与编辑器扫描或发布导出。
- 可运行源码放在 `src/`，Godot 场景放在 `scenes/`，配置化内容放在 `content/`。
- 长期说明放在 `docs/`；缓存、日志、截图、导出包和引擎二进制不得进入仓库。
- `project.godot`、`export_presets.cfg`、`AGENTS.md` 必须保留在仓库根目录。
