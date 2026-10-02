# 心域防线

《心域防线》是一款简体中文像素肉鸽塔防游戏。扮演“偏频者”，沿三幕、48 层分支路线收集心智构造，在持久的阶梯战场上规划通路、高地和防线，最终切断控制信号。

项目使用 JavaScript、Canvas 和 Web Audio。游戏离线运行，战斗按固定时间步长计算；Windows 便携包内含本地运行时。

12 种构造具有各自的五种阶级/分支外观，28 种敌人包含六名首领的三阶段形态。八方向模型带有步行、履带、飞行、攻击和施法动作，暂停与倍速同步；详见[模型与动作说明](docs/ENTITY_MODELS_AND_ANIMATION.md)。

## 启动

### 下载 Windows 版

打开 [v0.1.0 发布页](https://github.com/AlphaZero78/mindrealm-bastion/releases/tag/v0.1.0)，下载 `Mindrealm-Bastion-v0.1.0-windows-x64.zip`。右键选择“全部解压”，打开解压后的文件夹，再双击 **`启动游戏.exe`**。游戏会自动在默认浏览器打开。

便携包适用于 Windows 10/11 x64，内置 Node.js 运行时、音乐、字体和素材，解压后即可离线游玩。请将入口与 `game/` 文件夹一起保留。GitHub 自动生成的 `Source code` 压缩包用于源码开发；玩家使用上述 Windows ZIP。

```text
Mindrealm-Bastion/
├─ 启动游戏.exe       双击进入游戏
├─ 启动游戏.cmd       备用入口
├─ README.txt         使用说明
├─ MANIFEST.sha256    文件校验清单
└─ game/             游戏内容、运行时和许可证
```

### 从源码运行

安装 [Node.js](https://nodejs.org/) 22 或更新版本，再执行以下命令。项目直接使用 Node.js 标准库，克隆后即可启动。

```sh
git clone https://github.com/AlphaZero78/mindrealm-bastion.git
cd mindrealm-bastion
npm start
```

在浏览器打开 `http://127.0.0.1:4173/`。服务只监听本机；在终端按 Ctrl+C 可停止服务。Windows 用户也可以双击根目录的 `启动游戏.cmd`，启动器会自动打开浏览器。

关闭网页后，再次启动可继续远征；战斗中途退出会回到该场战前。请使用同一个浏览器和端口，存档保存在该浏览器的本机存储中。旧 Godot 存档继续保留，新版采用独立存档。

### 构建 Windows 便携包

在 Windows 上使用 Node.js 24.12.0，执行 `npm run package`。构建工具会在仓库同级的 `game_build_release` 目录生成 `心域防线-Windows.zip`。详细步骤见[开发与验证](docs/DEVELOPMENT.md)。

将 ZIP 全部解压后，双击包内的 **`启动游戏.exe`**。便携包自带运行时，另有 `启动游戏.cmd` 备用入口。请保留同目录的资源、运行时与启动支持文件。

## 验证

```sh
npm test
npm run verify
```

这两条命令分别检查自动测试，以及资源完整性、哈希和许可证。完整模拟、浏览器交互和发布包验收步骤见[开发与验证](docs/DEVELOPMENT.md)。

## 开始第一局

1. 新建远征，输入种子；同一种子决定相同战场、路线和奖励顺序。
2. 在路线选一个可达节点，进入战前。仓库中的远程放高地、近战放地面，支援可放任意等高平台。首次部署免费。
3. 先看入口数量、敌群类型和到达时间，再确认开战。战斗中防线锁定，可以暂停或加速。
4. 领取单位、收藏品和天赋，选择下一个节点；维修、搬迁、成长和路线服务会消耗专注。

WASD／中键拖动平移；Q/E 连续旋转；滚轮缩放；F 聚焦火种；右键／Esc 取消。战斗中空格暂停，1/2/3 切换速度。设置提供四路音量、自动或 960×540 至 2560×1440 画面渲染分辨率、100%／125%／150% 界面缩放、减少动态效果及浏览器全屏。画面设置即时生效并保存，界面切换与确认弹窗带平滑淡入淡出。

控制压力从 0 开始，通关后逐级解锁至 10。新局通过敌人生命、攻击、速度、护甲与高阶首领频震提高难度；同种子同节点的计划编队、数量、出场时间和击杀奖励不变，营地仍恢复 30%，服务不因压力加价。已有 Web v2 远征保留其原难度规则，新局采用规则修订 2。累计数值和脚本评测见[难度说明](docs/DIFFICULTY_BALANCE.md)。

## 项目结构

- `web/core/`：规则、战斗、进度、内容与存档的唯一权威实现；`difficulty.js` 统一难度属性、能力参数与玩家说明。
- `web/view/`：战场绘制和声音；`web/app.js`、`screens.js`、`style.css`：界面与操作。
- `assets/`：运行图集、字体、音频与许可证。
- `launcher/`：本地启动器与静态文件服务。
- `development/web-tests/`、`development/web-tools/`：验证和打包；截图、日志与发布包放在项目外。
- `development/assets/model_sources/`：保留来源的中立 GLB 素材；游戏不加载它们。
- `docs/`：规则、开发说明、原计划、迁移决策和验收记录。

[玩法](docs/GAMEPLAY.md) · [难度与平衡](docs/DIFFICULTY_BALANCE.md) · [开发与验证](docs/DEVELOPMENT.md) · [迁移说明](docs/WEB_MIGRATION.md) · [要求与验收](docs/WEB_REQUIREMENTS.md) · [资源授权](docs/THIRD_PARTY_ASSETS.md)
