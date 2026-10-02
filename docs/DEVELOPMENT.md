# Web 版开发说明

《心域防线》使用原生 JavaScript ES Modules、Canvas 2D 与 Web Audio。规则模拟不依赖浏览器，本地 Node HTTP 服务提供页面和资源；运行时无需外部 CDN、联网账户或游戏引擎。

## 环境与启动

源码与发布构建使用 **Node.js 24.12.0**、Windows PowerShell 和现代桌面浏览器。`package.json` 接受 Node 22 以上，但发布工具严格检查 24.12.0，以保证内置运行时与已保存许可证对应。项目没有需要安装的 npm 依赖。

在 `D:\game_build` 执行：

```powershell
node --version
# 预期 v24.12.0

# 启动服务并打开默认浏览器
.\launcher\web_game.ps1

# 或只在当前终端运行服务，随后手动打开页面
npm start
```

正式地址为 `http://127.0.0.1:4173/`，服务只监听本机回环地址。启动器复用通过健康检查的服务，后台日志放在系统临时目录；前台执行 `npm start` 时用 Ctrl+C 停止服务。

便携发布包自带 `game/runtime/node.exe`。玩家完整解压 ZIP 后，双击顶层的 `启动游戏.exe`，启动器会打开系统默认浏览器。`启动游戏.cmd` 是备用入口。继续游戏使用相同浏览器与 4173 端口，因为正式存档属于该浏览器的本地站点存储。

EXE 源码为 `launcher/GameLauncher.cs`，使用 Windows 自带 .NET Framework 编译器构建为图形启动器。游戏服务在后台运行。启动器根据自身所在目录定位 `game/`，并兼容旧包的平铺结构。重复启动会复用健康检查通过的服务；其他程序占用端口时会显示错误。`--port N --no-browser` 用于隔离自动验证，`MINDREALM_QA=1` 会让自动打开的页面带 `?qa=1`。

### 构建 EXE 与 ZIP

```powershell
# 编译启动器、构建便携目录，并核验全部 ZIP 条目哈希。
npm run package

# 只压缩已经构建且通过清单校验的发布目录。
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\development\web-tools\package-windows.ps1

# 隔离端口、内存存档；编译并验证 GUI EXE 的成功、失败与并发行为。
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\development\web-tests\launcher-exe.test.ps1

# 从 ZIP 全新解压，检查哈希、内置运行时、EXE、备用 CMD 和重复启动。
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\development\web-tests\portable-zip.test.ps1 -ZipPath 'D:\game_build_release\心域防线-Windows.zip'
```

默认输出在仓库同级的 `game_build_release` 目录，文件名为 `心域防线-Windows.zip`，旁边是 ZIP 的 SHA-256 文件。ZIP 内保留一个游戏文件夹。文件夹顶层放 `启动游戏.exe`、备用 CMD、`README.txt` 和 `MANIFEST.sha256`；`game/` 集中存放 `web/`、`assets/`、`launcher/`、`runtime/`、`licenses/` 与 `version.json`。

`build-launcher.ps1 -OutputExe <绝对路径>` 可单独编译启动器，输出必须位于源码目录外。`package-windows.ps1` 支持 `-ReleaseDirectory` 和 `-OutputZip`。版本化发布可以使用独立目录，例如 `v0.1.0/Mindrealm-Bastion`，并输出 `Mindrealm-Bastion-v0.1.0-windows-x64.zip`。打包前逐项校验文件清单，打包后再次核对所有 ZIP 条目的哈希。

`portable-zip.test.ps1` 将 ZIP 解压到临时中文与空格路径，从其他工作目录启动，并从子进程 PATH 中排除全局 Node.js。测试使用隔离端口与内存存档，结束后关闭自己启动的服务。实际浏览器验收同样使用 `MINDREALM_QA=1` 与独立端口。

## 目录与职责

| 位置 | 职责 |
| --- | --- |
| `web/core/content.js` | 稳定内容 ID、内容目录、种子随机与效果描述 |
| `web/core/difficulty.js` | 0–10 累计难度、修订 1/2 兼容、实际敌人属性、能力/恢复参数与玩家说明的唯一来源 |
| `web/core/state.js` | 种子地形、三幕路线、节点服务、成长、奖励队列与结算 |
| `web/core/rules.js` | 部署、完整占地、地形事务、通路、射程、视线、伤害、维修、融合与带宽的唯一判定来源 |
| `web/core/battle.js` | 遭遇编队、20 Hz 固定步长模拟、敌我行为与事件 |
| `web/core/save.js` | 可注入存储、版本与结构检查、战前快照、备份恢复 |
| `web/app.js` | 状态、界面、输入、保存和画面循环的连接 |
| `web/screens.js`、`web/ui.js`、`web/style.css` | 中文页面、上下文面板与响应式布局 |
| `web/view/` | 战场投影、像素图集、镜头和音频表现；不复制游戏规则 |
| `web/view/entity-art.js`、`entity-motion.js` | 模型图集共享合同、依赖战斗时间的表现状态；不修改模拟 |
| `assets/` | 运行资源、第三方许可证及资源哈希清单 |
| `launcher/` | 本机服务器与玩家启动入口 |
| `development/web-tests/` | 规则、流程、存档和视图验证；参考与分区防守策略位于 `helpers/` |
| `development/web-tools/` | 资源核验、完整模拟、音频检查与发布工具 |
| `development/assets/model_sources/` | 像素图集的 CC0 模型来源及许可证，不进入运行时 |
| `docs/` | 长期玩法、开发与第三方资源说明 |

预览和实战必须调用 `rules.js` 的同一规则。模拟帧可复用规则缓存，但地形破坏、单位状态或效果发生变化时必须失效。核心模块不得直接访问 DOM 或玩家存档。日志、截图、浏览器配置、下载压缩包、测试报告和发布产物均写到仓库外；不要恢复旧版引擎工程或历史构建产物。

实体模型的配方、动作行合同、Blender 烘焙、逐帧检查和运行内存说明见[模型与动作](ENTITY_MODELS_AND_ANIMATION.md)。修改战斗事件时须保留原有规则结果，演出只能消费实体身份、目标、朝向、技能倒计时和模拟时钟。

难度相关属性由 `difficultyProfile`、`enemyStats`、`enemyAbilityProfile`、`enemyRecoveryBase` 提供，界面用 `difficultySummary` 展示累计规则，不在界面重写阈值。新局规则修订 2 保持同种子同节点的计划编队、出场时间和击杀奖励，取消旧版营地与服务惩罚，改用敌人数值、控制时间和高阶首领频震。各级表、兼容边界与实测结果见[难度与平衡说明](DIFFICULTY_BALANCE.md)。

## 新局地形生成

`state.generateTerrain(seed)` 使用独立的 `${seed}:terrain` 随机流，叠加随机旋转的椭圆山脊和平滑形变，生成不规则轮廓与连续阶梯高台。四条随种子弯曲、宽度变化的谷道从各入口连接火种；拐弯逐格衔接，保证零高度通路无需斜坡或破障即可通行。最后仅降低过陡的格子，使初始相邻高差不超过一级，不抬高谷道或保护格。斜坡初始为空，继续由玩家按现有规则铺设。

本次移除固定四块方形补台和笔直十字道路，以增加新局地形差异与部署选择；41×41、0–4高度、5×5火种及入口保护不变。连续平坦区域仍须允许初始三个远程构造免费部署，不应逼迫玩家先花专注改地。`terrain.test.mjs` 覆盖种子复现、四入口零地连通、坡度与保护、轮廓多样性、多格部署、实际寻路及旧地形存档回读。

生成器只在新开局调用。`save.js` 继续保存和加载现有 `terrain`，不按种子重新计算已保存地形，也不迁移覆盖玩家的斜坡、改造或破坏记录；保存结构版本保持 Web v2。

## 验证命令

```powershell
# 规则、节点、取消/失败/边界、存档及视图接口
npm test

# 内容、必要资源、许可证、第三方 SHA-256 清单与外链依赖
npm run verify

# 既有完整闭环回归：20 个标准参考种子 + 100 个终局场景
node .\development\web-tools\simulations.mjs --output "$env:TEMP\mindrealm-web-simulations.json"

# 仅供迭代的 7 场快速检查，不能替代完整验收
node .\development\web-tools\simulations.mjs --quick

# 两条战斗音乐的响度、真峰值与同步时长
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\development\web-tools\verify-audio.ps1

# 已有 FFmpeg 时不安装工具，直接校验
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\development\web-tools\verify-audio.ps1 -SkipSetup
```

规则测试包含 1000 个种子地图检查，以及独立的自然地形连通和多格部署回归。完整模拟由 20 个标准难度参考种子和 100 个终局场景构成：前者必须完成 48 个节点、击败三名首领并获胜；后者覆盖控制压力 0–10，以及空防线、仅开局部署和参考策略，必须到达胜负终态。空防线失败是预期的失败流程验证。模拟只使用内存状态，前后核对核心文件哈希，运行期间不要修改核心或参考策略文件。

仅当进程退出码为 0，且最终 `WEB_SIMULATIONS` 显示 `ok: true` 时才算通过；中间进度行不能作为终态证据。其他成功标记为 `MINDREALM_ASSETS_OK`、`MINDREALM_CONTENT_OK` 和 `AUDIO_VERIFY_OK`。

### 按难度配对的完整矩阵

难度校准使用独立的 `difficulty-sweep.mjs`，按相同种子比较各级，不能把不同随机种子的胜负差异直接归因于难度。下面的 110 局矩阵加额外 10 个标准种子，共组成 20 个标准难度与 100 个其他难度的 120 局检查；它与上面的既有混合策略闭环脚本是两种不同测试安排。

```powershell
$pairedSeeds = (0..9 | ForEach-Object { "reference-$_" }) -join ','
node .\development\web-tools\difficulty-sweep.mjs --levels 0-10 --seeds $pairedSeeds --strategy reference --workers 2 --output "$env:TEMP\mindrealm-difficulty-v2-all-levels-110.json"

$extraStandard = (10..19 | ForEach-Object { "reference-$_" }) -join ','
node .\development\web-tools\difficulty-sweep.mjs --levels 0 --seeds $extraStandard --strategy reference --workers 1 --output "$env:TEMP\mindrealm-difficulty-v2-standard-extra10.json"

# 第二种构筑样本；opening、empty 可分别替换 defensive 验证失败流程
$sampleSeeds = (0..2 | ForEach-Object { "reference-$_" }) -join ','
node .\development\web-tools\difficulty-sweep.mjs --levels 0,5,10 --seeds $sampleSeeds --strategy defensive --workers 2 --output "$env:TEMP\mindrealm-difficulty-defensive.json"
```

`--levels` 支持逗号列表和范围，`--seeds` 为逗号分隔的种子，`--workers` 为 1–4。输出文件必须位于仓库外；脚本只用新建的内存单局，哈希守卫覆盖核心、难度模块与两个策略文件。运行中不得修改这些文件。报告记录每战/每幕损失、时长、计划与实际敌数、构筑、带宽和规则修订号，并核对同节点的计划数量、群数、入口分配和增援预算。

成功需退出码 0、最终 `DIFFICULTY_SWEEP.ok: true` 且 `changed`、`failures`、`countMismatches` 为空。脚本允许正常败局，标准难度门槛还须单独核对 20 个参考种子均完成 48 节点、击败三名首领并胜利。胜率仅代表所选脚本策略样本，不是人类胜率；早败缩短了可累计的伤害，应同时查看到达节点、每战损失和构造损毁。

`reference-strategy.mjs` 的 `runReference` 提供可选 `{hooks:{prepare,reward,node}}`；不传钩子时行为保持原样。`defensive-strategy.mjs` 通过公开命令构建 B 中继、多个前排、分区维修和侧翼远程，所有等级使用同一套参数。`opening` 只在第一战进行部署准备，`empty` 不进行战前部署准备；两者仍使用合法路线、奖励与节点循环。

历史基线（2026-09-05，本次自然地形、实际分辨率显示与短音效调整之前）：64/64 Node 测试通过（55 项核心、9 项视图）；120 场模拟耗时 423.206 秒，合计 2050 场战斗。20 个参考种子全部完成 48 节点和三名首领，其中包含 430 场战斗；100 个额外场景为 63 胜、37 败，全部到达终局。源码变动与失败列表均为空，资源与授权核验通过。**这些数字仅对应旧基线；当前改版的完整模拟与最终验收须以新版终态报告为准，不能沿用旧结果宣称通过。**

## 独立浏览器 QA

在单独的 PowerShell 终端中执行：

```powershell
$env:MINDREALM_PORT = '4175'
$env:MINDREALM_QA = '1'
node .\launcher\server.mjs
```

打开 **`http://127.0.0.1:4175/?qa=1`**。查询参数 `qa=1` 让应用使用 `MemoryStorage`，不读取、修改或删除玩家正式存档与设置；刷新页面即重新建立内存存储。服务器的 `MINDREALM_QA=1` 只开放测试帮助模块，不能代替 URL 参数。独立端口 4175 进一步隔离测试与正式游戏的站点来源。关闭这个终端后，正式游戏仍使用 4173。

QA 模式提供 `window.__mindrealm` 供浏览器验证设置独立场景。不得向真实玩家存档注入测试数据。真实交互需覆盖部署、取消、失败提示、搬迁、维修、升级、融合、地形预览与撤销、暂停与速度、奖励顺序、节点服务、继续游戏和结算。模态窗口打开时相机与战场输入停止，待确认预览仍可见。

原生 HTML 拖拽可能暂停浏览器的 `requestAnimationFrame`。`app.js` 的 `dragover` 在更新指针与悬停后立即调用战场绘制，让占地与范围始终跟随拖动；不能只验证普通 `pointermove`。布局和 UI 缩放通过同步 `applyScale()` 更新画布位置与尺寸，防止紧随其后的拖拽使用旧坐标。

窗口与缩放回归矩阵为 1920×1080、1366×768、960×540 × UI 缩放 100%/125%/150%。旧布局曾检查核心按钮可见；当前左信息栏、右战场与底部状态条改版后，应重新检查这九种组合的中文、实际拖拽、取消、滚动、资源加载和控制台。纯模拟不能替代当前画面验收。

## 画面与性能

战场使用固定 55° 俯角的正交投影。12 种构造与 28 种敌人对应 40 张八方向 PNG 图集，每帧 48×48，每张 384×48；不在运行时加载原模型。地形投影和装饰缓存独立于模拟；连续转动镜头时暂时省略细网格装饰，停止后恢复。

Web 布局明确替代第二份计划的整屏固定 640×360。`renderResolution` 以战场实际 CSS 宽高作为相机与拾取坐标，画布后备分辨率按设备 DPR 提高，DPR 上限为 1.5，并限制额外像素倍率带来的绘制面积。地形与射界按该分辨率绘制，不再缩成低分辨率整屏再放大；像素 atlas 独立保持最近邻采样，避免把单位像素美术的采样要求错误应用为整个战场降采样。

响应式 DOM 将界面划分为可独立滚动的左侧信息栏、右侧战场与底部工具栏/部署状态条。左栏承载威胁、教学和检查器，合法性与成本提示位于底部正常文档流中，各自预留空间，不覆盖战场。设置支持浏览器全屏、100%/125%/150% UI 缩放，以及自动或960×540至2560×1440的渲染分辨率。

分辨率唯一来源为`web/view/display-settings.js`。固定档位以整个窗口为像素预算，战场按所占CSS比例分配，两轴使用同一个倍率，不改变相机与鼠标拾取坐标。`Battlefield.resize()`在CSS尺寸和后备像素未改变时保留画布及拖拽状态。新设置字段不改变游戏存档版本；旧设置补为auto，不重置音量或缩放。

`web/view/transitions.js`负责240ms交叉淡化，`dialog-transitions.js`负责弹窗180ms淡入/120ms淡出。app根据场景身份只在导航、节点/阶段、奖励队列或图鉴页签改变时捕获旧画面；同步提交新DOM、滚动位置、画布布局与首帧后开始动画。状态变更与保存不依赖动画回调。动画期间输入、模拟暂时锁定；减少动态、resize、隐藏、Escape与异常兜底均能清理装饰层。快照无重复ID或可执行动作属性，最多一张1920×1080画布位图。

历史性能证据：2026-09-05 **旧低分辨率画布版本**的隔离浏览器压力实测，不能作为当前实际 CSS 分辨率+DPR 版本的帧率结论：

| 场景与环境 | 结果 |
| --- | --- |
| Chromium 152，1920×1080，RTX 5060 Laptop，NVIDIA D3D11 | 1000 个画面帧 |
| 四入口、35 座构造、100 名敌人，其中包含六类首领；持续旋转，每秒使地形缓存失效四次 | 平均 **93.68 FPS**，1% low **48.08 FPS** |
| 同场景 CPU 绘制耗时 | 平均 **3.91 ms**，P95 **6.5 ms**，P99 **7.4 ms** |

该旧图形场景固定生命与敌人位移以保持负载，包含正常 20 Hz 模拟和范围显示；它不用于证明平衡或策略通关，当时浏览器控制台无错误。**当前画布分辨率、自然地形和布局已变化，性能待新版实测。GTX 1050 仍未实测**，不能沿用表中结果宣称当前版本或目标显卡达到稳定 60 FPS，也不能将平均帧率解读成所有帧均达到 60 FPS。

## 音频

第一次用户交互解锁 Web Audio，主音量、音乐、音效、界面音分别控制。菜单、路线、战前、节点、奖励、胜利与失败使用对应场景音乐；战斗 calm/action 层在同一时刻启动且时长相同。危险度按等功率混合，上升约 1.5 秒、下降约 4 秒；首领提高 action 下限并加强低频。音乐经过 6 kHz 低通及压缩，暂停时降低音量。音效有节流、并发上限和结束回收，切换场景不积累旧音源。

短交互音统一由 `audio.js` 的 `UI_CUES` 配置。点击与部署都截取已有 CC0 `computerNoise_001.ogg` 的短段，不重写原资源；部署不再完整播放开门音源的长高频扫音。点击持续 65 ms、部署持续 180 ms，分别使用约 1.9 kHz 与 1.65 kHz 低通，并加高通和音量包络消除突兀起止；悬停使用更轻的短提示。这些交互音接入独立 UI 音量总线，战斗音效总线规则保持不变。

交互音采用单声部替换策略：新提示到来时旧音在约 8 ms 内淡出，按优先级与节流避免点击、悬停和部署连续叠音；过时的异步加载请求不会迟到补播。音源在指定时长结束后断开节点并回收。数值、生命周期与播放反馈应同时验证，音乐文件响度检查不能代替短提示音的实际听感验收。

`verify-audio.ps1` 从自身位置解析项目路径，可从仓库外运行；缺少 FFmpeg 时默认下载到 `%LOCALAPPDATA%\MindrealmTools\ffmpeg`，`-SkipSetup` 则直接报缺失。脚本只读取两条战斗音乐，不重新编码；检查 −18±0.2 LUFS、真峰值不高于 −1 dBTP、时长差不超过 0.01 秒。它不替代浏览器播放与听感检查。

迁移后已从仓库外运行通过：calm/action 均为 −18 LUFS，真峰值分别 −3.8/−4.5 dBTP，时长均为 203.911837 秒。其他背景曲按已测响度在播放时补偿增益，不改动原始资源哈希。

## 存档与版本

正式存档前缀 `mindrealm.web.v2`、版本 2，使用结构验证与 `hashSeed(payload)` 校验。该校验用于发现损坏，不是密码学签名。保存使用主记录、`.backup` 和 `.pending` 恢复机制。

仅保存安全状态与战前快照；退出战斗后回到该场战前，不能恢复半场或借刷新重抽奖励。路线、地形、单位、耐久、资源、商店、奖励与随机顺序一同恢复。旧 Web v1 数据保留并提示不兼容，不自动当作 v2 读取；旧引擎存档不自动转换或删除。新游戏替换现有单局前需要确认。

本次难度更新不改变存档命名空间或结构版本。`newRun` 写入 `difficultyRevision: 2`；缺少该字段和显式修订 1 的旧 Web v2 单局继续调用旧难度分支，不能在读取时补成 2。旧局内容池、随机顺序、货架、奖励、地形、`runId`、结算记录和局外解锁均保留；未知修订号不作为有效单局读取，原始记录不删除。

## 发布

```powershell
npm run build

# 可选：指定仓库外的全新输出目录
$env:MINDREALM_BUILD_DIR = 'D:\game_build_release\Mindrealm-Web-check'
npm run build
```

默认输出 `D:\game_build_release\Mindrealm-Web`。构建先执行 Node 测试与资源检查，再复制运行资源、Node 24.12.0、许可证、启动器，并生成 `MANIFEST.sha256`。它**不自动执行** 120 场模拟、音频检查或真实浏览器验收；这些仍是独立发布门槛。建议使用新的仓库外输出目录，避免旧文件混入。

发布后应从发布目录实际启动，核对首页、战前、战斗、音频与继续游戏，并检查日志及资源加载。只有必要检查均取得终态结果后才交付。

## 当前难度修订的验证

当前难度修订在全部界面修复后通过 `npm run build`：144/144 项源码测试，73 项必要运行资源、107 项哈希、7 项许可证检查；发布包 90 个文件全部通过清单核对，17 个 Web 源码文件与工作区逐一 SHA-256 一致。0–10 × 10 个共同种子的 110 局矩阵及额外 10 个标准种子已取得终态，合计 120 局、2415 战；20 个标准种子全部通关，100 个其他难度为 90 胜、10 败。

源码浏览器通过 75 项难度/兼容/首领情报/频震交互检查，并分别以压力 0、10 从真实新游戏菜单完成 48 节点和三名首领胜利。便携版本经正式 CMD 启动后通过 11 项新局、战斗、退出继续和失败复盘检查；最终样式另通过三窗口共 9 项首领路线普通点击与侧栏滚动检查。全部无脚本、资源、渲染或音频错误。完整步骤、数值边界、样本策略限制以及预览/长弹窗/首领进入遮挡修复见[难度与平衡说明](DIFFICULTY_BALANCE.md)。

历史显示与转场构建的 118 项源码测试、源码和便携版各 38 项显示/交互验证，以及独立浏览器的 48 节点胜利和空阵失败，见[分辨率与转场验收](DISPLAY_TRANSITIONS.md)。此前 120 局、2003 场战斗和清晰画布压力证据见[体验更新验收](CLARITY_UPDATE.md)；本次已修改核心难度与战斗，不能沿用旧哈希与旧完整流程结果。旧压力样本平均 67.66 FPS、1% low 33.31 FPS，不能宣称稳定 60 FPS，也不能用转场耗时代替战斗帧率。

压力复现：在独立QA服务器和浏览器中先运行`development/web-tests/browser-perf-clarity-setup.js`，再运行`browser-perf-clarity-sample.js`，将返回结果保存在仓库外，并注明硬件与同期其他负载。
