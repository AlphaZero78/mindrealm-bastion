# Web 版开发说明

《心域防线》使用原生 JavaScript ES Modules、Three.js、Canvas 2D 与 Web Audio。规则模拟不依赖浏览器，本地 Node HTTP 服务提供页面和资源；图形库和素材均随项目保存，游戏离线运行。

## 当前验证入口

使用独立开发服务运行 `browser-tactical-flow.js`、`browser-event-confirmation.js` 与 `helpers/revision-five-browser.mjs`。正式页面使用 `browser-pages.js` 的全新浏览器上下文。旧版 `browser-flow.js`、`browser-release.js`、`browser-portable-entity.js`、`browser-final-ui.js`、`browser-art-build-smoke.js` 与 `browser-model-hero.js` 已被现行流程覆盖并移入回收站；历史文档中的结果保留。

## 环境与启动

源码与发布构建使用 **Node.js 24.12.0**、Windows PowerShell 和现代桌面浏览器。`package.json` 接受 Node 22 以上，但发布工具严格检查 24.12.0，以保证内置运行时与已保存许可证对应。项目没有需要安装的 npm 依赖。

在 `D:\game_build` 执行：

```powershell
node --version
# 预期 v24.12.0

# 启动服务并打开默认浏览器
.\game\launcher\web_game.ps1

# 或只在当前终端运行服务，随后手动打开页面
npm start
```

正式地址为 `http://127.0.0.1:4173/`，服务只监听本机回环地址。启动器复用通过健康检查的服务，后台日志放在系统临时目录；前台执行 `npm start` 时用 Ctrl+C 停止服务。

便携发布包自带 `game/runtime/node.exe`。玩家完整解压 ZIP 后，双击顶层的 `启动游戏.exe`，启动器会打开系统默认浏览器。`启动游戏.cmd` 是备用入口。继续游戏使用相同浏览器与 4173 端口，因为正式存档属于该浏览器的本地站点存储。

EXE 源码为 `development/launcher/GameLauncher.cs`，使用 Windows 自带 .NET Framework 编译器构建为图形启动器。游戏服务在后台运行。启动器根据自身所在目录定位 `game/`，并兼容旧包的平铺结构。重复启动会复用健康检查通过的服务；其他程序占用端口时会显示错误。`--port N --no-browser` 用于隔离自动验证，正式启动器始终打开玩家页面，开发验证通过独立开发服务进行。

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

默认输出在仓库同级的 `game_build_release` 目录，文件名为 `心域防线-Windows.zip`，旁边是 ZIP 的 SHA-256 文件。ZIP 内保留一个游戏文件夹。文件夹顶层放 `启动游戏.exe`、备用 CMD、`README.txt` 和 `MANIFEST.sha256`；`game/` 集中存放 `game/web/`、`game/assets/`、`game/launcher/`、`runtime/`、`licenses/` 与 `version.json`。

`build-launcher.ps1 -OutputExe <绝对路径>` 可单独编译启动器，输出必须位于源码目录外。`package-windows.ps1` 支持 `-ReleaseDirectory` 和 `-OutputZip`。版本化发布可以使用独立目录，例如 `v0.1.2/Mindrealm-Bastion`，并输出 `Mindrealm-Bastion-v0.1.2-windows-x64.zip`。打包前逐项校验文件清单，打包后再次核对所有 ZIP 条目的哈希。

`portable-zip.test.ps1` 将 ZIP 解压到临时中文与空格路径，从其他工作目录启动，并从子进程 PATH 中排除全局 Node.js。启动器测试使用隔离端口并且不打开浏览器，结束后关闭自己启动的服务。正式版本浏览器验收使用全新浏览器上下文；开发脚本使用下述内存存档服务。

## 目录与职责

| 位置 | 职责 |
| --- | --- |
| `game/web/core/content.js` | 稳定内容 ID、内容目录、种子随机与效果描述 |
| `game/web/core/difficulty.js` | 0–10 累计难度、修订 1/2/3/4 兼容、实际敌人属性、能力/恢复参数与玩家说明的唯一来源 |
| `game/web/core/state.js` | 三幕路线、节点服务、成长、奖励队列、幕间等待与结算 |
| `game/web/core/world.js` | 三入口、南侧火种、五类地貌和种子通路生成 |
| `game/web/core/enemy-expansion.js` | 新增九种敌人和按幕前排编队 |
| `game/web/core/rules.js` | 部署、完整占地、地形事务、通路、射程、视线、伤害、维修、融合与带宽的唯一判定来源 |
| `game/web/core/battle.js` | 遭遇编队、20 Hz 固定步长模拟、敌我行为与事件 |
| `game/web/core/inventory.js`、`item-content.js` | 背包、道具目录、增减与容量判定；使用效果由 `battle.js` 结算 |
| `game/web/core/nexus-content.js`、`game/web/nexus-view.js` | 三幕的 12 位精神使者、72 件专属赠礼与枢纽房间视图 |
| `game/web/view/nexus-art.js` | 12 位精神使者的独立 CG 路径与场景说明，供枢纽视图和资源打包共同使用 |
| `game/web/core/extra-events.js`、`event-balance.js` | 三选事件与按幕风险、收益；沿用同一节点事务 |
| `game/web/core/unit-details.js`、`tower-text.js` | 构造当前累计效果和简明目录文本 |
| `game/web/core/event-stories.js`、`game/web/event-view.js`、`game/web/event-style.css` | 事件故事、分支发展、CG 路径和场景布局；实际得失仍来自 `state.js` 的节点事务 |
| `game/web/inventory-view.js` | 背包、道具、事件选材和商店的中文视图 |
| `game/web/core/save.js` | 可注入存储、版本与结构检查、战前快照、备份恢复 |
| `game/web/app.js` | 状态、界面、输入、保存和画面循环的连接 |
| `game/web/run-seed.js` | 新局表单的 16 位随机种子；局内随机序列仍由核心模块根据保存的种子生成 |
| `game/web/screens.js`、`game/web/ui.js`、`game/web/style.css` | 中文页面、上下文面板与响应式布局 |
| `game/web/view/` | 战场投影、实时模型、镜头和音频表现；不复制游戏规则 |
| `game/web/view/entity-renderer.js`、`entity-motion.js` | 实例化机械零件、连续关节动作与显示插值；不修改模拟 |
| `game/web/view/model-portraits.js`、`entity-art.js` | 256 像素肖像索引，以及保留的回退图集与变体合同 |
| `game/assets/` | 运行资源、第三方许可证及资源哈希清单 |
| `game/launcher/` | 本机服务器与玩家启动入口 |
| `development/web-tests/` | 规则、流程、存档和视图验证；参考与分区防守策略位于 `helpers/` |
| `development/web-tools/` | 资源核验、完整模拟、音频检查与发布工具 |
| `development/assets/model_sources/` | 原始 CC0 模型与许可证，派生的运行 GLB 位于 `game/assets/game/models` |
| `development/assets/event_art/` | 36 幅事件插画的最终提示词、生成记录、尺寸与哈希 |
| `development/assets/nexus_art/` | 12 幅精神使者 CG 的最终提示词、生成记录、尺寸与哈希 |
| `development/docs/` | 长期玩法、开发与第三方资源说明 |

预览和实战必须调用 `rules.js` 的同一规则。模拟帧可复用规则缓存，但地形破坏、单位状态或效果发生变化时必须失效。核心模块不得直接访问 DOM 或玩家存档。日志、截图、浏览器配置、下载压缩包、测试报告和发布产物均写到仓库外；不要恢复旧版引擎工程或历史构建产物。

实体模型的配方、GLB 导出、肖像生成、连续动画和当前性能证据见[模型与动作](ENTITY_MODELS_AND_ANIMATION.md)。修改战斗事件时须保留原有规则结果，演出只能消费实体身份、目标、朝向、技能倒计时和模拟时钟。

难度相关属性由 `difficultyProfile`、`enemyStats`、`enemyAbilityProfile`、`enemyRecoveryBase` 提供，界面用 `difficultySummary` 展示累计规则，不在界面重写阈值。新局使用规则修订 5，当前变更见 [v0.1.4 更新](RELEASE_V014.md)。每次升深度增加 3 点基础带宽；敌群按幕分池，后两幕进一步提高生命和攻击。经验、升阶门槛与中继递减沿用修订 3。道具及构造总容量通过背包模块管理。各压力级别保持相同种子编队和基础奖励。当前规则、兼容边界与实测结果见[战术规则更新](TACTICAL_UPDATE.md)，修订 3 见[平衡与背包更新](BALANCE_INVENTORY_UPDATE.md)，压力倍率与旧修订记录见[难度说明](DIFFICULTY_BALANCE.md)。

## 新局地形生成

新局表单通过 `createRunSeed()` 调用浏览器的 `crypto.getRandomValues()`，生成 16 位大小写字母与数字，确保两类字符同时出现。生成器跳过会导致取模偏差的字节。每次打开表单、点击“重新随机”，或确认空白输入时重新生成；取消保留原远征。手动输入沿用原有的 64 字符上限和首尾空白处理。

随机生成只用于填写新局种子。`newRun(seed)`、地形、路线、奖励与存档的确定性算法沿用原实现，日期格式的旧种子和其他手动种子可继续使用。`run-seed.test.mjs` 检查混合字符、同一时刻的随机性、边界字节及保存回读；`browser-run-seed.js` 检查实际输入、重新随机、取消、空白确认与继续游戏。

`world.generateTerrain(seed)` 使用独立的 `${seed}:terrain:2` 随机流。五类地貌叠加随机旋转山脊、平滑形变、分叉谷道与南侧高台。北、西、东入口的位置沿边变化，南侧原入口区域改为火种。三条宽度变化的通路连接火种；拐弯逐格衔接，保证零高度通路无需斜坡或破障即可通行。最后仅降低过陡的格子，使初始相邻高差不超过一级，不抬高谷道或保护格。斜坡初始为空，继续由玩家按现有规则铺设。

本次移除固定四块方形补台和笔直十字道路，以增加新局地形差异与部署选择；41×41、0–4高度、5×5火种及入口保护不变。连续平坦区域仍须允许初始三个远程构造免费部署，不应逼迫玩家先花专注改地。`terrain.test.mjs` 覆盖种子复现、三入口零地连通、坡度与保护、轮廓多样性、多格部署、实际寻路及旧地形存档回读。

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

规则测试包含 1000 个种子地图检查，以及独立的自然地形连通和多格部署回归。完整模拟由 20 个标准难度参考种子和 100 个终局场景构成：两组都必须到达胜负终态，所有胜局须完成 48 个节点和三名首领；标准参考组须包含完整胜局。后者覆盖控制压力 0–10，以及空防线、仅开局部署和参考策略。正常败局用于检查提高挑战性后的失败流程。空防线失败是预期的失败流程验证。模拟只使用内存状态，前后核对核心文件哈希，运行期间不要修改核心或参考策略文件。

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

成功需退出码 0、最终 `DIFFICULTY_SWEEP.ok: true` 且 `changed`、`failures`、`countMismatches` 为空。脚本允许正常败局，每个胜局还须核对 48 个完成节点和三名首领，正常败局保留其到达位置与损失；标准难度应包含完整胜局。胜率仅代表所选脚本策略样本，不是人类胜率；早败缩短了可累计的伤害，应同时查看到达节点、每战损失和构造损毁。

`reference-strategy.mjs` 的 `runReference` 提供可选 `{hooks:{prepare,reward,node}}`；不传钩子时行为保持原样。`defensive-strategy.mjs` 通过公开命令构建 B 中继、多个前排、分区维修和侧翼远程，所有等级使用同一套参数。`opening` 只在第一战进行部署准备，`empty` 不进行战前部署准备；两者仍使用合法路线、奖励与节点循环。

历史基线（2026-09-05，本次自然地形、实际分辨率显示与短音效调整之前）：64/64 Node 测试通过（55 项核心、9 项视图）；120 场模拟耗时 423.206 秒，合计 2050 场战斗。20 个参考种子全部完成 48 节点和三名首领，其中包含 430 场战斗；100 个额外场景为 63 胜、37 败，全部到达终局。源码变动与失败列表均为空，资源与授权核验通过。**这些数字仅对应旧基线；当前改版的完整模拟与最终验收须以新版终态报告为准，不能沿用旧结果宣称通过。**

## 独立浏览器 QA

在单独的 PowerShell 终端中执行：

```powershell
$env:MINDREALM_PORT = '4175'
$env:MINDREALM_DEV_PORT = '4191'
npm run dev
```

打开 **`http://127.0.0.1:4191/?qa=1`**。独立开发服务器将内存存储与验证桥接注入响应，源码 `game/web/app.js` 保持玩家实现。开发服务始终使用内存存档，不接触玩家存档。`qa=1` 只供开发脚本识别页面，正式服务和在线版均忽略该参数。

QA 模式提供 `window.__mindrealm` 供浏览器验证设置独立场景。不得向真实玩家存档注入测试数据。真实交互需覆盖部署、取消、失败提示、搬迁、维修、升级、融合、地形预览与撤销、暂停与速度、奖励顺序、节点服务、继续游戏和结算。模态窗口打开时相机与战场输入停止，待确认预览仍可见。

原生 HTML 拖拽可能暂停浏览器的 `requestAnimationFrame`。`app.js` 的 `dragover` 在更新指针与悬停后立即调用战场绘制，让占地与范围始终跟随拖动；不能只验证普通 `pointermove`。布局和 UI 缩放通过同步 `applyScale()` 更新画布位置与尺寸，防止紧随其后的拖拽使用旧坐标。

窗口与缩放回归矩阵为 1920×1080、1366×768、960×540 × UI 缩放 100%/125%/150%。旧布局曾检查核心按钮可见；当前左信息栏、右战场与底部状态条改版后，应重新检查这九种组合的中文、实际拖拽、取消、滚动、资源加载和控制台。纯模拟不能替代当前画面验收。

## 画面与性能

战场使用固定 55° 俯角的正交投影。12 种构造与 37 种敌人由 Three.js 实时绘制，采用两级几何、实例合批、预先过滤的环境反射和按需更新的阴影。地形投影和装饰缓存独立于模拟；连续转动镜头时暂时省略细网格装饰，停止后恢复。事件、路线等完整页面遮住战场时，停止持续绘制隐藏的模型。

`renderResolution` 以战场实际 CSS 宽高作为相机与拾取坐标，画布后备分辨率按设备 DPR 提高，DPR 上限为 1.5，并限制额外像素倍率带来的绘制面积。地形、实时模型与射界共用该分辨率，Canvas 和 WebGL 相机保持同一投影。界面肖像使用独立的 256 像素原图。

响应式 DOM 将界面划分为可独立滚动的左侧信息栏、右侧战场与底部工具栏/部署状态条。左栏承载威胁、教学和检查器，合法性与成本提示位于底部正常文档流中，各自预留空间，不覆盖战场。设置支持浏览器全屏、100%/125%/150% UI 缩放，以及自动或960×540至2560×1440的渲染分辨率。

分辨率唯一来源为`game/web/view/display-settings.js`。固定档位以整个窗口为像素预算，战场按所占CSS比例分配，两轴使用同一个倍率，不改变相机与鼠标拾取坐标。`Battlefield.resize()`在CSS尺寸和后备像素未改变时保留画布及拖拽状态。新设置字段不改变游戏存档版本；旧设置补为auto，不重置音量或缩放。

`game/web/view/transitions.js`负责240ms交叉淡化，`dialog-transitions.js`负责弹窗180ms淡入/120ms淡出。app根据场景身份只在导航、节点/阶段、奖励队列或图鉴页签改变时捕获旧画面；同步提交新DOM、滚动位置、画布布局与首帧后开始动画。状态变更与保存不依赖动画回调。动画期间输入、模拟暂时锁定；减少动态、resize、隐藏、Escape与异常兜底均能清理装饰层。快照无重复ID或可执行动作属性，最多一张1920×1080画布位图。

历史性能证据：2026-09-05 **旧低分辨率画布版本**的隔离浏览器压力实测，不能作为当前实际 CSS 分辨率+DPR 版本的帧率结论：

| 场景与环境 | 结果 |
| --- | --- |
| Chromium 152，1920×1080，RTX 5060 Laptop，NVIDIA D3D11 | 1000 个画面帧 |
| 四入口、35 座构造、100 名敌人，其中包含六类首领；持续旋转，每秒使地形缓存失效四次 | 平均 **93.68 FPS**，1% low **48.08 FPS** |
| 同场景 CPU 绘制耗时 | 平均 **3.91 ms**，P95 **6.5 ms**，P99 **7.4 ms** |

该旧图形场景固定生命与敌人位移以保持负载，包含正常 20 Hz 模拟和范围显示。当时浏览器控制台无错误，平衡和策略通关由独立测试判断。当前实时模型的 220 实体渲染测量见[模型和动作](ENTITY_MODELS_AND_ANIMATION.md#性能测量边界)。该测量单独统计绘制耗时，完整战斗 AI 开销和 GTX 1050 性能仍需另行测量。

## 音频

第一次用户交互解锁 Web Audio，主音量、音乐、音效、界面音分别控制。菜单、路线、战前、节点、奖励、胜利与失败使用对应场景音乐；战斗 calm/action 层在同一时刻启动且时长相同。危险度按等功率混合，上升约 1.5 秒、下降约 4 秒；首领提高 action 下限并加强低频。音乐经过 6 kHz 低通及压缩，暂停时降低音量。音效有节流、并发上限和结束回收，切换场景不积累旧音源。

短交互音统一由 `audio.js` 的 `UI_CUES` 配置。点击与部署都截取已有 CC0 `computerNoise_001.ogg` 的短段，不重写原资源；部署不再完整播放开门音源的长高频扫音。点击持续 65 ms、部署持续 180 ms，分别使用约 1.9 kHz 与 1.65 kHz 低通，并加高通和音量包络消除突兀起止；悬停使用更轻的短提示。这些交互音接入独立 UI 音量总线，战斗音效总线规则保持不变。

交互音采用单声部替换策略：新提示到来时旧音在约 8 ms 内淡出，按优先级与节流避免点击、悬停和部署连续叠音；过时的异步加载请求不会迟到补播。音源在指定时长结束后断开节点并回收。数值、生命周期与播放反馈应同时验证，音乐文件响度检查不能代替短提示音的实际听感验收。

`verify-audio.ps1` 从自身位置解析项目路径，可从仓库外运行；缺少 FFmpeg 时默认下载到 `%LOCALAPPDATA%\MindrealmTools\ffmpeg`，`-SkipSetup` 则直接报缺失。脚本只读取两条战斗音乐，不重新编码；检查 −18±0.2 LUFS、真峰值不高于 −1 dBTP、时长差不超过 0.01 秒。它不替代浏览器播放与听感检查。

迁移后已从仓库外运行通过：calm/action 均为 −18 LUFS，真峰值分别 −3.8/−4.5 dBTP，时长均为 203.911837 秒。其他背景曲按已测响度在播放时补偿增益，不改动原始资源哈希。

## 存档与版本

正式存档前缀 `mindrealm.web.v2`、版本 2，使用结构验证与 `hashSeed(payload)` 校验。该校验用于发现数据损坏。保存使用主记录、`.backup` 和 `.pending` 恢复机制。

仅保存安全状态与战前快照；退出战斗后回到该场战前，不能恢复半场或借刷新重抽奖励。路线、地形、单位、耐久、资源、商店、奖励与随机顺序一同恢复。旧 Web v1 数据保留并提示不兼容，不自动当作 v2 读取；旧引擎存档不自动转换或删除。新游戏替换现有单局前需要确认。

本次难度更新不改变存档命名空间或结构版本。`newRun` 写入 `difficultyRevision: 4`；缺少该字段按修订 1 处理；修订 1、2、3 的旧 Web v2 单局继续调用原难度、编队、事件与带宽成长分支。读取时保留原值。旧局内容池、随机顺序、货架、奖励、地形、`runId`、结算记录和局外解锁均保留；未知修订号不作为有效单局读取，原始记录不删除。

## 发布

```powershell
npm run build

# 可选：指定仓库外的全新输出目录
$env:MINDREALM_BUILD_DIR = 'D:\game_build_release\Mindrealm-Web-check'
npm run build
```

默认输出 `D:\game_build_release\Mindrealm-Web`。构建先执行 Node 测试与资源检查，再复制运行资源、Node 24.12.0、许可证、启动器，并生成 `MANIFEST.sha256`。它**不自动执行** 120 场模拟、音频检查或真实浏览器验收；这些仍是独立发布门槛。建议使用新的仓库外输出目录，避免旧文件混入。

发布后应从发布目录实际启动，核对首页、战前、战斗、音频与继续游戏，并检查日志及资源加载。只有必要检查均取得终态结果后才交付。

## 规则修订 2 的历史验证

规则修订 2 在当时界面修复后通过 `npm run build`：144/144 项源码测试，73 项必要运行资源、107 项哈希、7 项许可证检查；发布包 90 个文件全部通过清单核对，17 个 Web 源码文件与工作区逐一 SHA-256 一致。0–10 × 10 个共同种子的 110 局矩阵及额外 10 个标准种子已取得终态，合计 120 局、2415 战；20 个标准种子全部通关，100 个其他难度为 90 胜、10 败。

源码浏览器通过 75 项难度/兼容/首领情报/频震交互检查，并分别以压力 0、10 从真实新游戏菜单完成 48 节点和三名首领胜利。便携版本经正式 CMD 启动后通过 11 项新局、战斗、退出继续和失败复盘检查；最终样式另通过三窗口共 9 项首领路线普通点击与侧栏滚动检查。全部无脚本、资源、渲染或音频错误。完整步骤、数值边界、样本策略限制以及预览/长弹窗/首领进入遮挡修复见[难度与平衡说明](DIFFICULTY_BALANCE.md)。

历史显示与转场构建的 118 项源码测试、源码和便携版各 38 项显示/交互验证，以及独立浏览器的 48 节点胜利和空阵失败，见[分辨率与转场验收](DISPLAY_TRANSITIONS.md)。此前 120 局、2003 场战斗和清晰画布压力证据见[体验更新验收](CLARITY_UPDATE.md)；本次已修改核心难度与战斗，不能沿用旧哈希与旧完整流程结果。旧压力样本平均 67.66 FPS、1% low 33.31 FPS，不能宣称稳定 60 FPS，也不能用转场耗时代替战斗帧率。

压力复现：在独立QA服务器和浏览器中先运行`development/web-tests/browser-perf-clarity-setup.js`，再运行`browser-perf-clarity-sample.js`，将返回结果保存在仓库外，并注明硬件与同期其他负载。

## 2026-10-02 交互更新

[交互与画面验收](EXPERIENCE_UPDATE.md) 记录本轮十项改动及验证范围。部署朝向、地形批次和支援距离继续由 `rules.js` 统一判断。新增单元测试在 `experience.test.mjs`；实际浏览器检查使用 `browser-experience.js`、`browser-terrain-batch.js` 和 `browser-occlusion.js`，通过 Playwright CLI 的 `run-code --filename` 执行。

这些浏览器脚本使用独立的 `4191` 端口与 `?qa=1` 内存存档。`browser-experience.js` 也可复用当前页面所属的其他独立本机端口，并拒绝玩家使用的 `4173`。截图和结果输出到执行目录下的 `mindrealm-experience-qa`，执行目录应设为系统临时目录。完整界面通关仍使用 `browser-full-run.js`，每次检查一幕，三次运行延续同一个浏览器页面。

## v0.1.1 性能与项目审计

本轮覆盖规则、渲染、存档、本地服务、音频与发布流程。具体修复、测量边界和复验命令见[审计报告](PERFORMANCE_AUDIT_V011.md)。浏览器性能对照需要分别保留优化前、后的独立服务；使用临时目录保存基线与结果。

## 规则修订 3：道具、背包与事件验证

当前验收见[平衡与背包更新](BALANCE_INVENTORY_UPDATE.md)。`inventory-items.test.mjs` 覆盖容量阻断、交易原子性、十类道具、持续效果到期、事件边界、旧存档和战前回滚。地图悬停在自动滚动后保持可见的回归包含在 `browser-full-run.js` 中。

```powershell
node .\development\web-tools\balance-sweep.mjs --output "$env:TEMP\mindrealm-balance-report.json"
```

此脚本使用 76 个内存场景，包含 20 对相同种子的旧、新平衡比较、空防线、仅首战部署、高压力和另一种防守策略。比较规则修订时，两组共享新内容池和道具系统。终态报告需 `ok: true`，并且 `changed`、`failures` 为空。

`browser-inventory.js` 在当前独立 QA 页面检查背包、删除确认、满槽替换、商店服务、事件选材、营地高亮与实际战斗道具。先在系统临时目录建立 `mindrealm-v3-ui` 文件夹，再通过 Playwright CLI 的 `run-code --filename` 执行。它拒绝玩家端口 4173。截图等待弹窗与提示动画结束后记录；完整通关使用 `browser-full-run.js`，每幕一次，三次延续同一页面。

`browser-inventory-layout.js` 另检查三窗口与三种界面缩放的组合，验证四道具槽顶部布局和背包长弹窗边界。CSS 的弹窗最大高度需要除以实际界面缩放，避免 125% / 150% 下标题或关闭按钮移出视口。

## v0.1.2 枢纽与整页节点验收

当前结果见 [v0.1.2 更新说明](RELEASE_V012.md)。`nexus.test.mjs` 使用真实新局，检查入口、赠礼、旧存档、屏障、再生和合并信号。既有独立规则测试使用 `unblessed-run.mjs`，显式去除枢纽加成，避免一个随机赠礼污染另一条规则的期望值。完整策略模拟与浏览器通关会正常选择三次赠礼。

`browser-nexus-layout.js` 覆盖开局空槽、赠礼取消与继续游戏，以及枢纽、商店、7/40 座构造工坊、营地、事件、宝库的 63 组窗口与缩放组合。它与其余浏览器脚本一样，在项目外通过 Playwright CLI 执行，使用隔离端口与 `?qa=1`。当前的 `browser-nexus-catalog.js` 覆盖 12 位使者的独立 CG、72 件赠礼、216 组布局、72 次取消及 24 次确认、保存和继续。完整流程继续运行 `browser-full-run.js`，在同一页面按幕执行三次。

使者 CG 的路径来自 `game/web/view/nexus-art.js`，赠礼与路线图标来自内容目录。`refresh-asset-manifest.mjs` 同时扫描这些声明和 CSS 引用，保证 CG 与动态蒙版图像进入运行包和哈希清单。

## 2026-10-04 事件与实时模型

事件确认后先保存 `eventData.outcome`，停留在故事发展页；`event-continue` 再完成节点并开放奖励或路线。重复确认和提前继续保持状态不变。旧存档缺少 `outcome` 时正常进入选择页；致命交换直接进入带故事记录的失败结算。状态结构版本继续为 Web v2。

`browser-event-stories.js` 检查 36 幅 CG、324 个布局组合、84 次取消和 84 条发展分支。`browser-event-presentation.js` 在图片解码完成后保存参考尺寸截图。`browser-realtime-validation.js` 覆盖 109 种外观、连续关节、暂停和倍速、升级分支、继续游戏与常驻经验条。`browser-model-performance.js` 测量 100 敌人、24 座 T3 构造及 96 架无人机的渲染负载。

事件检查可按幕运行：页面追加 `qaAct=1`、`qaAct=2` 或 `qaAct=3`，每次覆盖 12 个事件、108 组布局和 28 条选择分支；三份结果齐全后才代表 36 个事件全部通过。`browser-run-seed.js` 通过真实新局窗口检查默认种子、重新随机、取消、继续、手动重放与两个窗口尺寸。当前 CG 与种子的验收记录见[叙事重绘与随机种子验证](EVENT_PRESENTATION.md#2026-10-05-叙事重绘与随机种子验证)。

以上脚本通过现有 Playwright CLI 的 `run-code --filename` 执行，工作目录设在项目外，页面使用隔离端口与 `?qa=1`。资源索引会将事件图、GLB、肖像、表面纹理、环境光和本地 Three.js 纳入构建与哈希检查。事件与模型首轮结果见[事件呈现更新](EVENT_PRESENTATION.md)与[模型和动作](ENTITY_MODELS_AND_ANIMATION.md)，写实 CG 及最终便携包验收见 [v0.1.3 更新](RELEASE_V013.md)。

## 规则修订 4：战术与推进

[战术规则更新](TACTICAL_UPDATE.md) 记录本轮玩法与验证。`tactical-revision.test.mjs` 覆盖光环、背包总数、带宽成长、事件数值、六选三赠礼、框选原子性、追踪无人机、首领清场和幕间手动进入。`browser-tactical-flow.js` 使用实际鼠标拖拽、确认、取消和三窗口布局检查；经验栏检查同时要求可见宽高，避免将隐藏元素判为通过。

`unitAuras` 和 `auraCoverage` 统一光环显示与目标覆盖。地形矩形通过 `previewTerrain` 的 `brush: box` 与两个角点生成一笔事务；批次提交沿用原有累计计价和一次撤销。指针取消、Esc、右键与失焦都清理正在框选的状态。

无人机在 `battle.drones` 中按 20 Hz 移动、重新锁定和命中；渲染只插值并复用已有飞船零件。发射源停机或损毁会取消无人机，单场最多同时 96 架。首领死亡只切断其信号，清场判定继续等待全部计划敌人与增援。

首领持续与维修防线交战时，六次攻击后触发预警和破阵推进。参数由 `bossAdvanceProfile` 提供，敌人详情、蓄力、方向标识与实战共用数值。`interlude` 是可保存的安全阶段，等待手动 `continueAct`；继续游戏保留这一等待。

## 规则修订 5：经济、成长与事件

当前规则与实际验收见[平衡与背包更新](BALANCE_INVENTORY_UPDATE.md)。`revision-five.test.mjs` 覆盖阶梯费用、击杀收益累计、升阶带宽、单中继、同类光环、24 条 T3 分支、六件商品、108 个事件选择、线索、概率和旧存档。`event-story.test.mjs` 与修订 4 的事件检查使用旧目录，专门保护存档兼容。

`event-redesign.js` 保存当前事件数据，`eventFor` 与 `eventStory` 按存档修订选择目录。随机结果、按职责筛选的单位候选、线索与已确认结果均写入本局。`tower-progression.js` 保存 T3 的新增机制；`unitStats`、`unitAuras` 和 `unitEffectLines` 为实战与界面提供相同的判定和说明。

`service-style.css` 管理服务页横向布局与内部滚动。`helpers/revision-five-browser.mjs` 可在独立 QA 页面按时间片推进同一局，并记录资源、带宽和安全存档点。验收策略会按维护费用撤回因事件带宽缩减而停机的构造。

按当前工作约定，修改中抽样，完成后集中验证一次；失败时只复查相关项。`build.mjs` 直接打包已验证的源码；`npm test` 与 `npm run verify` 保留为独立命令。
