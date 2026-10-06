# Web 重建要求与验收门禁

> 路径迁移说明（v0.1.4）：本文保留历史验收记录。当前运行文件位于 `game/`，开发工具位于 `development/`；现行命令与隔离验证方式见 [开发说明](DEVELOPMENT.md)。已完成使命的旧引擎清理与一次性截图脚本已回收。

审计日期：2026-09-05。本文是逐项验收清单，不是完成声明。判断以当前源码、真实运行结果和对应的测试范围为准；存在测试文件不能代替执行结果，逻辑模拟不能代替画面、声音与发布版验证。


## 2026-09-05 后续体验修正

当前用户要求修复短音效、画面/拖拽遮挡与随机地形，最新结果见[体验更新验收](CLARITY_UPDATE.md)。以下旧版数字是改动前的历史证据，当前版本以更新验收为准。新的120局已完成2003场战斗：20参考全胜，其余61胜39败；核心起止哈希一致。

## 2026-09-05 重建任务的历史交付状态

**Web游戏及离线发布验证完成；整个“重建并删除旧版本”任务尚未完成，剩余旧缓存/二进制清理由环境审批阻断。**

- 64/64测试通过；资源检查73项必需文件、107项源码资产哈希通过。
- 120局、2,050场战斗正常终局：20标准种子全部48节点/3首领通关；其余100局63胜37败；无超时、异常或运行中核心哈希变化。
- 浏览器整局完成48节点并胜利；19项基础流程、18项便携版流程、全部节点服务均通过。便携版覆盖真实HTML拖拽、同步尺寸更新、确认框顶部点击、九种尺寸/缩放组合、空阵实际失败、继续后不重复发奖及离线资源完整性。
- `browser-final-ui.js`通过最大深度说明、设置保存失败提示、累计压力说明；相应截图已经审看。素材使用紧凑升阶标记，避免大标签遮住构造。
- 最终发布包在`D:\game_build_release\Mindrealm-Web`，86文件逐项SHA256通过、Web源码与发布包逐项相同；包内没有Godot/GLB/导入缓存/旧UI资源。发布包自带Node24.12.0，在4187/4188/4189三个独立端口成功启动。根启动cmd和4173源码入口也已成功启动。
- 56个旧源码、数据、场景、测试及工具文件通过可审查文件补丁移除，另移除project.godot、export_presets.cfg和旧launcher/run_game.ps1。src/scenes/content/development/tests/development/tools当前文件数为0。
- 自动审批分别拒绝了整批递归删除、明确单目录删除、旧EXE逐文件删除，返回原文仅为`blocked by policy`。因此`.godot`、旧发布EXE、旧import旁文件、空旧目录和未使用旧UI仍存在；未宣称全部删除。
- 手动清理脚本：`development/web-tools/remove-old-godot.ps1`。已通过PowerShell语法检查及`-WhatIf`只读预览，**未执行实际删除**，不会由游戏/构建/测试自动调用。用户可以先用`-WhatIf`查看范围，再手动运行；它不触碰玩家存档、通用Godot安装或其他项目。
- 性能实测为RTX5060 Laptop，代表压力平均93.68 FPS、1%低帧48.08 FPS；GTX1050目标尚未实测。该限制不能写成通过。

最终原始记录位于`C:\Users\31258\AppData\Local\Temp\mindrealm-web-qa`、`mindrealm-render-qa`及`mindrealm-web-final-simulations.json`，不进入发行包。
## 依据、优先级与已知替代

1. 本次用户要求：依据 AGENTS.md、两份计划和现有毛坯，从头重建；允许 Web 等引擎；**新版本完成之后**才删除 Godot 版本。
2. [AGENTS.md](../AGENTS.md) 提供总体目标、完整规则、工作流程和完成标准。
3. [完整首发计划](plans/01_FULL_LAUNCH_PLAN.md) 将单一第17层最终战改为17/16/15层三幕、六名首领、完整内容与验证范围。
4. [像素重制计划](plans/02_PIXEL_REMAKE_PLAN.md) 优先于前一份计划的冲突项：41×41格、5×5火种、0–4高度、斜坡/峭壁、每格2专注、地形事务撤销、连续敌群、2.5D像素、连续旋转和自适应音乐。

计划副本为原文拷贝，原计划未修改。SHA-256：

| 副本 | SHA-256 |
| --- | --- |
| `01_FULL_LAUNCH_PLAN.md` | `2791fd635bd095ca2b2257cb4f175f4834043aaf343b2c9f8f7f7adf272885d5` |
| `02_PIXEL_REMAKE_PLAN.md` | `082e8892a2907ba3b4e673de1f437b49e86042e34be9cd0e3e8efbf6867d80cb` |

| 原基线 | 本次实施方向 | 完成前需要的证据 |
| --- | --- | --- |
| Godot/GDScript、Godot导出与Godot警告门禁 | 用户明确允许重新选择引擎；Web JavaScript、Canvas像素投影、Web Audio、Windows本地启动器 | 源码、离线Windows发布包、发布版实际启动、浏览器零脚本错误和零缺失资源 |
| 25×25/3×3火种/0–3/每格5专注 | 第二计划明确改为41×41/5×5/0–4/每格2专注 | 地形/部署/寻路/预览与战斗一致性测试及真实操作 |
| 第17层最终首领、单一战斗波 | 三幕17/16/15层；普通/精英/首领3/4/5群 | 完整48节点路线、幕间奖励、第三幕直接胜利 |
| 四向吸附镜头 | 55°正交、Q/E 90°/秒连续旋转 | 0°/45°/90°/225°/359°实测与输入回归 |
| 旧开发档直接清除 | 新 Web v2 使用独立命名空间；保留旧档并一次说明不兼容，避免误删真实用户数据 | 隔离存储测试、正式启动只访问自身命名空间 |
| 固定640×360内部画布、整屏整数倍显示 | 按CSS实际尺寸与最多1.5倍DPR清晰绘制、图集独立最近邻；界面独立缩放；[迁移说明](WEB_MIGRATION.md) 已明确替代原因、玩家收益与单局影响 | 替代说明与BP九种窗口/缩放布局及对应截图已验证 |
| 已有 Godot 文档与启动器 | 新启动入口、Web架构、构建/验证文档 | **旧 `docs/DEVELOPMENT.md` 等不能作为Web使用说明交付；需更新后再删Godot实现** |

## 证据约定

- **已核实（逻辑）**：本审计执行过对应测试并通过，只证明该行注明的逻辑范围。
- **已有实现，待整体验证**：已读权威调用链或测试，但尚缺当前全套、真实浏览器或最终发布证据。
- **待验证**：本审计没有足够证据，不能据此通过交付。
- **已知缺口**：本次审计发现明确实现/接线/说明差异，必须修正后重新验证。

文件简称：`state`=`web/core/state.js`，`rules`=`web/core/rules.js`，`battle`=`web/core/battle.js`，`content`=`web/core/content.js`，`save`=`web/core/save.js`，`app`=`web/app.js`，`screens`=`web/screens.js`，`field`=`web/view/battlefield.js`，`audio`=`web/view/audio.js`。

测试简称：`P`=progression.test.mjs，`R`=rules.test.mjs，`C`=combat.test.mjs，`V`=view.test.mjs；`B`=browser-flow.js，`BS`=browser-services.js，`BF`=browser-full-run.js；以上位于 `development/web-tests/`。`BP`为发布包浏览器验收。`120`=development/web-tools/simulations.mjs。

### 2026-09-05 最终运行证据

本表记录已实际完成的结果与范围，不把测试脚本的存在当作通过。主代理报告的单测、音频和性能结果明确标注来源；本审计另已直接读取以下浏览器结果与120 JSON。证据保存在仓库外，`%TEMP%`本次为`C:\Users\31258\AppData\Local\Temp`。

| 证据 | 实际结果 | 范围与限制 |
| --- | --- | --- |
| 64单测，主代理实际执行结果 | 55核心（P24/R8/C23）+9视图，全部通过 | 包含1000种子×3幕、全部事件/分支/效果、保存失败恢复、全部六首领、100敌人/35构造；逻辑/模拟不替代真实操作 |
| `%TEMP%/mindrealm-web-final-simulations.json` | ok=true；20参考全部胜；100终局63胜37败；共2050战；六首领全部出现；changed=[]；failures=[] | 真实规则/战斗步进与合法参考策略，无超时判胜；执行423.2055673秒，核心起止哈希一致 |
| BS，主代理从原生工具结果确认exit0 | MINDREALM_BROWSER_SERVICES_OK，18项全通过，errors=[] | 1366×768独立QA；营地/工坊/商店/宝库/事件/融合/导航/图鉴入口/致谢。未保存单独JSON；服务状态通过QA注入 |
| `%TEMP%/mindrealm-web-qa/final-browser-flow-result.txt` | MINDREALM_BROWSER_FLOW_OK，补丁后19项全通过，errors=[] | 真实鼠标部署、拒绝/取消、地形费用/撤销、暂停/战中锁定、战中退出还原、奖励不刷新、全部领奖与新局取消 |
| `%TEMP%/mindrealm-web-qa/full-act-2-result.txt`、`full-act-3-result.txt` | MINDREALM_BROWSER_48_NODES_WIN；won、48节点、三首领；181碎片、压力1、三个世界档案；页面/渲染/音频errors=[] | 1920×1080自然路线与真实UI选节点/服务/奖励；部署由合法参考命令执行，战斗使用真实模拟加速步进，不是纯手工实时通关；三幕首领战前/战斗/幕末截图已保留 |
| `%TEMP%/mindrealm-web-qa/release-browser-result.txt` | MINDREALM_PORTABLE_BROWSER_OK，17项全通过，errors=[]、badRequests=[] | portable包真实HTML拖拽首次免费、搬迁冻结预览/取消、三窗口尺寸×三缩放、空阵实际失败/继续幂等结算、离线资源完整 |
| 音频迁移验证，主代理实际执行 `development/web-tools/verify-audio.ps1` | calm/action均-18 LUFS、真峰值≤-1dB、时长均203.911837秒 | 双层同步与响度符合数值门槛；长期耳听疲劳没有独立量化结论 |
| 渲染性能，主代理RTX5060实测 | 平均93.68 FPS、低1% 48.08 FPS | 仅证明该实际运行环境；GTX1050目标未实测，不能据此声明已通过 |

发布布局矩阵为1920×1080、1366×768、960×540分别设置100%、125%、150%（九项）。对应`release-layout-*.png`、胜败、确认、节点、升级与融合截图位于同一QA目录，由主代理实际审看。该历史版的画布整数像素倍率现已由清晰画布方案替代；独立可缩放CSS/SVG界面及浏览器窗口控制仍保留；详见[迁移说明](WEB_MIGRATION.md)，不能继续沿用旧版固定640×360整屏显示声明。

尚待收尾的是Godot/无用资源清理、清理后最终build、目录/manifest复核与三次启动。GTX1050未实测及表内注明的人工抽样范围作为真实限制保留，不把它们隐藏为通过。

## 游戏目标、开局与路线

| ID | 要求与证明范围 | 权威实现 / 证据 | 当前状态 |
| --- | --- | --- | --- |
| G01 | 完整游戏可开始、选路、部署、战斗、成长、经历全部三幕首领并胜败结算；局势可读、决策有代价 | state / battle / app；120完整模拟、浏览器流程、最终发布完整通关 | 通过：120完整模拟；BF自然路线48节点、三幕首领与胜利结算；BP实际失败结算。BF采用合法参考部署命令与加速逻辑步进，不等于纯手工实时通关 |
| G02 | 偏频者、精神统治、醒觉火种、抽象且可理解的世界观；不是只有术语与占位文本 | content descriptions/archives；screens菜单/节点/结算 | 已核实内容；BS图鉴/致谢与BF三幕叙事、胜利画面已展示 |
| G03 | 新开局100精神、99专注、20带宽、深度1；3近战、3远程、1支援全部入仓 | state.newRun / P `new run uses exact resources...` | P通过；B实际开局资源与仓库通过 |
| G04 | 同种子保持地形、三幕地图、首领、奖励、未知揭示、商店和事件结果一致；界面查看不推进随机流 | state.generateTerrain/generateMap/candidates；P种子/保存/奖励测试 | P通过；B奖励退出继续不刷新；120核心哈希一致 |
| G05 | 每幕五轨道，普通层2–4节点，首层4普通战，倒数第二层单营地，末层单首领 | state.generateMap；P `1000 seeds...` | P通过（1000种子×3幕）；BF实际48层 |
| G06 | 拓扑先于节点类型；稳定节点ID独立随机；除固定层外至少两种类型 | state.generateMap；同上 | P通过（1000种子×3幕） |
| G07 | 所有节点从起点可达且可继续到首领；不能跳层、返回或重复确认节点 | state.availableNodes/enterNode/completeNode；P路线测试 | P通过；BF逐节点确认完成全部48层 |
| G08 | 中段宝库仅占某一节点；前四层无精英；同一路线不连续同种营地/商店/工坊，含未知揭示后的真实类型 | state.generateMap；P 1000种子测试 | P通过；约束为不连续同类型营地/商店/工坊，包括未知揭示后的真实类型 |
| G09 | 合法路线具备战斗、恢复、成长；约22–28场战斗的预期节奏 | 首层战斗、首领前营地、战斗单位奖励；1000随机路线平均23.625场 | 1000随机路线均值23.625战；120共2050战；BF参考路线20战。22–28为期望节奏，非每条路线硬限制 |
| G10 | 连接虚线、可达高亮、已走实线、不可达弱化；节点独立图标；名称/风险/收益/下一步连接可见 | screens.mapScreen/mapDetail，ui.icon | B首层四节点与BF三幕路线实际操作通过；地图截图已由主代理审看 |
| G11 | 路线选择立即生效、完成后只开放该节点连接下一层；进度不能回刷 | state / P路线与候选测试；app enter/save | P与B通过；BF全48节点无跳层/重复领取 |
| G12 | 三幕共用持久地形、仓库、防线、耐久、资源与构筑 | state.enterNextAct；P首领奖励衔接；完整参考策略 | P与120通过；BF跨幕保留构筑并完成第三幕 |
| G13 | 第一幕逐步1→3入口，第二幕3→4，第三幕4入口 | battle.makeEncounter；C编队测试；四入口视觉 | C入口解锁编队测试通过；BF三幕四向威胁实际运行 |
| G14 | 每幕两首领按种子抽取；幕初/中段/营地逐步揭示身份、风险、数值与阶段机制 | state.bossReveal；content.hint/mechanics；screens.bossIntel | 源码已核实逐步hint/mechanics；BF三幕首领情报与战前/战斗截图已展示 |

## 战前、部署、地形与镜头

| ID | 要求与证明范围 | 权威实现 / 证据 | 当前状态 |
| --- | --- | --- | --- |
| D01 | 41×41、5×5火种、四入口保护区；0–4高度、斜坡方向、保护标志；初始四向地面路线与可用高地 | state.generateTerrain；P开局，R路径 | P/R通过；B/BP实际合法高地/地面部署与保护区拒绝 |
| D02 | 战前看到精神、专注、已用/有效带宽、节点、所有入口数量/类型/每群到达时间、已部署和仓库 | screens.header/battleScreen，app.openEncounter | B开局资源通过；BP九种窗口×缩放组合布局可见，主代理已审图 |
| D03 | 仓库点击或拖拽、完整占地/范围/视线/费用/合法原因预览；首次部署免费 | rules.placement/deploy；R部署；V射界；B真实鼠标流程 | R/V通过；B实际鼠标点击部署，BP真实HTML拖拽首次免费通过 |
| D04 | 完整占地越界、不等高、远程非高台、近战非地面、斜坡、保护区、活单位重叠、带宽不足逐项拒绝 | rules.placement；R `deployment checks full footprint...` | R全失败原因及事务原子性通过；B保护区真实拒绝无扣费 |
| D05 | 支援任意等高；多格单位以2×2/3×2/2×3/3×3整体判定，不只鼠标单格 | content.footprint / rules.footprint；R | R全部多格与角色地形规则通过；40图集与实际部署经V/B核验 |
| D06 | 搬迁/撤回按维护费15%支付；确认前费用、位置和带宽可预判；取消不动资源/原位 | rules.moveCost/deploy/withdraw；app确认；R/B | R费用/失败边界通过；B/BP取消付费搬迁保留位置与资源，BP冻结预览通过 |
| D07 | 维修按缺失耐久与维护费付费；损坏单位可修；已部署维修后回仓 | rules.repairCost/repair；state节点维修；P/R/B | P/R通过；BS付费维修回仓、取消及节点持续服务通过 |
| D08 | 单位当前属性、效果、攻击对象、优先级、带宽、耐久、升级结果可查看 | screens.inspector；app.unitDialog/upgradeDialog；rules.unitStats | 单位属性共用Rules；BS实际升级/融合预览及BP检查器审图。战中检查器部分动态属性按选择刷新，HUD实时更新 |
| D09 | 最近/最远/最高当前生命优先级可在战前设置；战中拒绝 | rules.setPriority / battle目标排序；R/C；app priority | R/C战前优先级与实战目标排序通过；战中阶段守卫通过 |
| D10 | 单格/3×3/直线笔刷；升/降/铺设与旋转斜坡/铲平 | rules.previewTerrain/applyTerrain；screens.terrainTools；R/B | R全部笔刷/操作通过；B实际地形预览、确认、取消与撤销通过 |
| D11 | 地形操作每变化格2专注；批量事务全成或全不成；保护/占用/边界/资源不足拒绝；逐步撤销原额退款 | rules地形事务；R；B取消与退款 | R全事务与边界通过；B确认实际费用、取消不扣及原额撤销通过 |
| D12 | 确认前显示费用、改动格与新高度、入口路径、峭壁及受影响射程 | rules.previewTerrain，field.updateRange/drawRoutes，app确认 | R/V通过；补丁后B地形确认通过；BP冻结占地/范围保留且禁用战场输入，背景不模糊 |
| D13 | 等高通行、高差1按低格斜坡方向通行，其他边可破坏；最低代价破障；逐级永久降低高侧 | rules.edgeInfo/pathToCore；battle破障；R/C | R/C斜坡与最小代价永久破障通过；120无封路永久卡局 |
| D14 | 远程按相对高度每级射程+8%、伤害+10%，最多4级；低打高每级-12%，穿甲仅能减半保护 | rules.solveAttack/incomingDamage；R/C全高度组合 | R/C所有高度组合、护甲与穿甲保护测试通过 |
| D15 | 直接攻击插值视线；平台自身边缘不误挡低处；间接攻击只检查范围；预览与实战一致 | rules.solveAttack；field.updateRange；R/C/V | R/C/V共用判定与射界一致性通过；B/BP实际预览通过 |
| D16 | 地形变更立即刷新路径、破障、视线与范围，无视角旋转时无谓重算 | rules版本/field缓存；V路径与射界测试 | V路径缓存/破障刷新与射界测试通过；120实际地形与战斗执行无卡局 |
| D17 | 55°正交镜头；Q/E持续90°/秒/360°环绕；WASD严格屏幕方向；中键、缩放、F及常驻罗盘 | field；V指定五角度；浏览器键鼠 | V五个计划角度数学/输入测试通过；实际浏览器镜头操作与画面已由主代理抽检 |
| D18 | 八方向精灵随相机偏航选择；敌人移动和相机连续旋转不朝向错误 | field.directionFrame；V | V八方向与镜头联动通过；BF三幕敌人/首领画面已抽检 |
| D19 | 关闭检查器、确认框、帮助和设置后无残留拖拽、按键、选中状态 | app/field.setInteractive；V；B/BS | V输入释放通过；BS帮助→设置→帮助→战前通过，B/BP取消与冻结确认回归通过 |

## 战斗、敌人、成长与内容效用

| ID | 要求与证明范围 | 权威实现 / 证据 | 当前状态 |
| --- | --- | --- | --- |
| C01 | 开战前保存快照；战斗锁定部署/维修/升级/融合/搬迁/地形；开始时清空撤销栈 | battle.startBattle，rules阶段守卫，app start；R/C/P/B | P/R/C通过；B取消开战、战中锁定及退出恢复完整战前通过 |
| C02 | 20Hz逻辑、独立画面、1/2/3倍、暂停、离开页面暂停/恢复；无隐藏半场继续 | battle.stepBattle / app.frame；C/B | C通过；B暂停实际停止模拟；BF使用真实20Hz模拟推进，发布失败流程通过 |
| C03 | 普通/精英/首领3/4/5连续敌群，群间4–6秒不部署；精英倒数第二群/首领第四群 | battle.makeEncounter；C编队测试 | C确定性3/4/5群及中段特殊敌人通过；BF实际三幕连续战斗 |
| C04 | 第一/二/三幕普通队列16–28/24–38/32–50，约四分之一功能型，逐步加入新威胁 | battle.makeEncounter；C编队与压力测试 | C数量/功能型配比通过；120共2050战、涵盖三幕与0–10压力 |
| C05 | 初始编队10%共享增援预算；同时活动≤100；召唤/复制/分裂均不能绕过 | battle.reinforce；C预算和压力测试 | C共享预算与100活动上限通过；120无增援卡局 |
| C06 | 自动选合法射程/目标类型/视线/优先级目标；嘲讽可读；直接伤害至少攻击5%，单位受普通伤害至少1 | rules.solveAttack/incomingDamage，battle目标选择；R/C | R/C目标类型、视线、优先级及伤害下限通过 |
| C07 | 普通近战攻击阻挡近战；飞行越过；猎杀/攻城可攻击远程/支援；首领/精英到火种持续可选中 | battle移动与交战；C飞行/六首领目标测试 | C全部六首领到火种可选中、飞行/近战/猎杀通过；120遇到全部六首领，BF实际展示三个 |
| C08 | 敌方加速、治疗、护盾、干扰、迁跃、召唤、复制、分裂、爆炸、腐蚀与精神税有前摇/结果 | content描述，battle.ability；C功能测试；field警告 | C全部功能能力与前摇结果通过；BF代表性战斗和三首领已显示，未单独录制每种能力 |
| C09 | 首领70%/35%进入阶段、预告1.1秒、机制随阶段变化；压力9强化节奏 | battle / content.mechanics；C六首领阶段 | C六首领阶段与前摇通过；120遇到六首领；BF三幕三首领战前/战斗画面已记录 |
| C10 | 单位0耐久停止全部攻击/支援/带宽；过载按新到旧禁用，恢复自动重启；来源/名单/缺口可见 | rules.bandwidthState；battle；C过载与损坏；app HUD | R/C禁用顺序、毁坏支援与恢复通过；HUD来源/禁用名单接线已核实 |
| C11 | 支援维修最大实际缺损且不复活；强化/护甲/减速按明确范围；禁用支援不生效 | battle支援；C修理/重叠/禁用；content | C支援目标、分支、重叠与禁用测试通过 |
| C12 | 12基础构造每类4种、A/B分支及T3；每种定位/优势/弱点/组合独立 | content；P目录；C所有分支；UI属性预览 | P目录、R全部12构造双分支与C实际技能通过；120完整构筑策略通关 |
| C13 | 升阶前展示数值与差异；T1二选一、T2沿原分支；三同型同阶融合、T2材料同支；比例继承耐久和核心位置 | rules.upgrade/fuse；R；app升级融合确认 | R全12构造T1–T3与融合边界通过；BS取消、营地B/工坊A升级与50%耐久融合通过 |
| C14 | 18普通功能敌人、4精英、6首领、30收藏品、24天赋、24事件内容完整、引用有效 | content；P目录/事件；资源verify | P/R/C目录与全部效果通过；V40图集和音源路径通过 |
| C15 | 六构筑主题，全部收藏品/天赋有条件、对象、数值；没有仅描述无效果；获得后立即改变现有属性 | content.effects / rules / battle / state；P/C | P/C逐项触发条件/数值测试通过；奖励卡与预览共用Rules，B/BF真实奖励已操作 |
| C16 | 死亡压力平方衰减、抗性直接吸收、远杀风险低；全来源/原始/距离减免/吸收/最终有日志 | battle.killEnemy；C压力；app.openLog | C完整压力账目测试通过；日志显示来源/原始/距离/传入/抗性/最终值。特殊减免的详细分账保留在状态日志，UI采用合并展示 |
| C17 | 击杀即时经验；200起每级+125；上限12；每级最大精神+5/恢复10/带宽+1/抗性+1；偶数深度三选一 | state.addXP / battle.killEnemy；P深度，C场中升级 | P/C场中升级与奖励顺序通过；BF达到深度12，新版最大深度文字已明确 |
| C18 | 普通/精英恢复8/12；专注35/40/45与80/90/100；单位奖励+每级额外；普通20%收藏品/精英必得 | state.finishBattle；P首领/奖励/效果 | P战斗恢复/专注/奖励规则通过；120真实奖励流程通过。20%为确定性随机判定，未作独立长期概率拟合 |
| C19 | 奖励严格单位→收藏品→天赋，全部处理后返路线；无重复拥有项，足够池时持续三选一；保存不刷新 | state.queueGrowth/chooseReward；P多奖励、读档 | P通过；B全部奖励处理后返路线且读档不刷新；BF全三幕连续奖励通过 |
| C20 | 第一/二幕首领20%恢复、幕间专注与收藏品；第三幕35%恢复、立即胜利无普通奖励 | state.finishBattle；P三幕首领 | P通过；BF前两幕正常奖励衔接，第三幕第48节点直接won |
| C21 | 精神耗尽立即停止；最后首领死亡即时切断其压力，不被之后事件反杀 | battle终态；state.finishBattle；C首领/致命顺序 | C首领击杀/致命顺序通过；BP无防线实际败，BF第三幕实际胜 |
| C22 | 压力1–10逐级解锁、累计生效，开局前明示；不增强开局基础值 | content.pressureLevels / state / battle / rules；P压力解锁，C压力效果 | P/C压力0–10累计规则与解锁通过；新局已列全部累计效果；BF解锁压力1 |

## 非战斗节点、存档、局外与复盘

| ID | 要求与证明范围 | 权威实现 / 证据 | 当前状态 |
| --- | --- | --- | --- |
| N01 | 营地30%恢复/一单位免费维修/一单位免费升阶三选一；只能一次，取消不扣/不离开，满耐久/满阶有反馈 | state.nodeAction；P营地正常/取消/失败/边界；app campPick；BS | P通过；BS取消维修不离开、免费B分支升阶后离开；BF实际路线营地 |
| N02 | 工坊可反复付费维修/升阶、资源不足拒绝、主动离开 | state.nodeAction / rules；P工坊；screens服务；BS | P通过；BS付费维修回仓、取消/确认升阶及主动离开 |
| N03 | 商店3单位+3未持有收藏品，80/120基础价，压力费用，允许多购；售罄与读档不刷新 | state.nodeAction/enterNode；P商店全库存；BS | P货架全库存/耗尽/读档通过；BS取消、售罄禁用、多次购买通过；BF自然路线商店 |
| N04 | 宝库免费一选后离开；全池已持有有可离开的120专注补偿 | state.nodeAction；P耗尽；screens空宝库/dispatch empty-treasure；BS | P正常与空池边界通过；BS/BF正常免费领取后离开；空池UI未单独在浏览器注入 |
| N05 | 未知仅在进入后揭示事件/普通战/商店/宝库，种子固定；图标/当前节点/存档保持揭示结果 | state.enterNode；P全部4揭示 | P四种确定性揭示通过；BF路线流转通过，未知全部四分支由P覆盖 |
| N06 | 24事件×两选项：真实得失、具体目标、资源不足、致死提示、升阶无目标补偿、已满维修说明、单位受损回仓 | state.eventPreview/nodeAction；P所有事件及边界；BS | P全48选项/资源不足/致死/满阶等边界通过；BS取消/确认与BF自然事件通过，未逐一截取全部事件画面 |
| S01 | 仅一个活动单局，新游戏覆盖确认；取消不替换进度 | app.startNew / save；B新局取消 | B取消新开局保留进度；覆盖提示与实际新局流程已通过 |
| S02 | v2 envelope版本/校验/嵌套结构验证；pending→backup→primary事务；写入中断可恢复完整安全档 | save.createSaveStore；P每个写入边界/损坏checksum与schema | P每个写入边界/校验/结构损坏恢复通过；v2使用FNV-1a完整性校验，资产manifest才使用SHA-256 |
| S03 | 继续恢复路线/地形/仓库/部署/耐久/资源/候选/随机顺序；半场必须恢复完整战前 | save.save/load；P全快照；B真实退出继续 | P完整状态恢复；B战中退出与奖励退出继续通过；BP失败终态继续通过 |
| S04 | 已确认事件、购买、成长、选择节点和开战前保存；存储失败明确告知，不能默默丢进度 | app.save/sync/dispatch；save | P存储故障与事务测试通过；解锁先存draft，设置统一persistSettings失败toast，BP终态继续幂等通过。真实浏览器拒绝存储的人工故障注入未单列 |
| S05 | 旧版本不会静默损坏；一次不兼容提示，旧玩家数据和异应用键保留 | save独立命名空间 / migrationNotice；P v1保留测试 | P旧版本与异应用键保留、一次不兼容提示通过；未读取/修改玩家真实档 |
| S06 | 所有自动验证使用注入MemoryStorage或 `?qa=1` 隔离，不读改删真实存档/设置 | P MemoryStorage；app QA；browser-flow QA URL | 全部测试使用MemoryStorage或独立?qa=1会话；B/BS/BF/BP均按隔离约束执行 |
| M01 | 胜败按节点、精英、首领发碎片；同局重复settle幂等；胜利逐级解锁到压力10 | save.settleProfile；P失败碎片和11次压力胜利 | P失败碎片、重复settle及逐级压力10通过；BF胜利181碎片/压力1，BP失败继续不重复发奖 |
| M02 | 局外仅扩内容池/难度/档案，不加开局基础属性；购买对当前存档池无影响 | content.contentUnlocks/contentPool；state.newRun；save.unlockContent；P全六包；BS | P六包购买、失败与内容池冻结通过；BS六类入口可见。没有将局外购买直接加到开局基础属性 |
| M03 | 图鉴发现单位、敌人、收藏品、天赋；六首领分别解锁世界档案 | content.archive / state发现 / save汇总 / screens.codex | P发现记录与六档案规则通过；BF实际解锁noise_hive/memory_reforger/chorus_overseer三个档案，BS图鉴页面通过 |
| M04 | 结算到达幕层、节点、击杀/突破、精神损失、存活构造、核心构筑、精英、碎片、三个首领状态 | state.getSummary；screens.summaryScreen | BF胜利结算和BP失败结算已实际显示；181碎片、48节点、三首领记录与事件伤害面板已接入 |
| M05 | 失败原因指出突破/压力/过载/摧毁/对空/封路；事件致死单列；胜利保留路线与重要选择 | state.getSummary/history；app日志/构筑 | P事件致死与主要失败分类通过；BP实际突破失败、BF路线/构筑/关键选择复盘。封路破坏有战斗行为记录，未单列一种结算诊断标题 |

## 美术、音频、界面、工程与最终交付

| ID | 要求与证明范围 | 权威实现 / 证据 | 当前状态 |
| --- | --- | --- | --- |
| A01 | 2.5D像素风，深青/薄荷/珊瑚/暖黄/米白色板；轮廓/图标/文字不只颜色 | field / style.css / ui / assets | V40图集结构通过；主代理已审看B/BS/BF/BP像素风画面，含三幕首领与胜败 |
| A02 | 非简单几何单位占位；40套八方向透明像素图集；源GLB仅开发；原素材许可明确 | assets/game/sprites、development/assets/model_sources；V atlas、verify | V全部40套384×48透明八方向图集通过；许可/模型源保留；最终清理后发布过滤待最终构建记录 |
| A03 | 固定640×360、最近邻、整数倍；1080p3倍/1366×768居中1280×720；禁抗锯齿/雾/强辉光 | field.resize、style.css、WEB_MIGRATION | 按WEB_MIGRATION明确替代；BP三尺寸×三缩放共9种布局和对应截图通过 |
| A04 | 极简常驻资源/进度，工具栏与上下文检查器；图标地图无单字占位；不遮关键战场 | screens / ui / style / target screenshots | CSS面板/24px SVG图标作为独立可缩放UI替代；BP布局通过。教程已移至威胁栏下正常滚动，升级标记改紧凑金点，确认战场不模糊 |
| A05 | 1920×1080和1366×768，100%/125%/150%有效区域全部可操作；中文无裁切、布局不溢出 | app.applyScale、Screens；B截图 + 人工审图 | BP九项通过：1920×1080/1366×768/960×540 × 100%/125%/150%，已保存截图并由主代理审看 |
| A06 | 首三战分步教学镜头/部署/带宽/地形/视线/压力，可跳过可重看 | screens教学 / help / settings | 渐进提示可跳过、设置可重看，现位于威胁栏下正常滚动；当前按已完成节点推进三段提示，不是动作里程碑式强制教程 |
| A07 | CC0 Singularity calm/action同步等功率交叉，危险上升1.5s/下降4s、首领低频强化、不切尖锐曲 | audio / 音乐文件；V音频测试；响度扫描/实际聆听 | V同步/等功率/平滑控制通过；FFmpeg双层-18 LUFS、相同时长203.911837秒；BF无音频加载错误 |
| A08 | 主/音乐/战斗音效/UI四音量；暂停降噪、节点切换交叉、胜负声音正确；音效资源释放 | AudioDirector；V；app设置 | V四音量总线/暂停/场景别名/资源释放通过；B设置页面与BF三幕音频运行无错误，保存失败toast已接入 |
| A09 | 约-18 LUFS、真峰值≤-1dB、6kHz低通、限幅器、循环无接缝与点击/疲劳 | audio滤波；development音频验证工具；长时间试听 | verify-audio双层-18 LUFS、真峰值≤-1dB及相同时长通过；V与源码核验6kHz低通/压缩。长期耳听疲劳没有独立量化结果 |
| A10 | 每项第三方资源保留作者/来源URL/授权/日期/哈希/用途；无缺失资源、超规格纹理、无用原包 | THIRD_PARTY_ASSETS/ASSET_MANIFEST/verify | 逐引用审计确定56运行资源与107项许可/中立源清单；BP离线资源0坏请求。最终删除未用资产、刷新哈希与最终verify仍属清理收尾 |
| E01 | 新架构边界清楚，RunState唯一状态，重要判定单一权威，预览共享规则，渲染只消费 | core五模块 / field/audio / app；read-only审计 | Web职责与唯一权威调用链已审计；R/C/V验证共用规则与纯渲染消费。Web开发说明由主代理随清理同步 |
| E02 | 同类操作名称/位置一致，确认/取消/失败有反馈；面板焦点与中英文一致 | app模态/dispatch，screens，B/BS | BS18、B19、BP17项实际通过；确认/取消/导航/冻结预览均有真实回归，设置存储失败提示已接入 |
| E03 | 数值变更说明目的并检查前中后期/六首领；不以降低所有难度掩盖缺陷 | content及完整模拟统计；GAMEPLAY/平衡说明 | 120共2050战，六首领全部遇到；猎杀三次齐射后推进的原因/玩家收益已记录于迁移说明，原失败种子已通过 |
| E04 | 1000种子三幕全连通、特殊层、多样性、已揭示服务相邻约束 | P `1000 seeds...` | P 1000种子×3幕全连通、多样性和特殊层通过 |
| E05 | 100种子真实无界面胜败终局，无卡死；20标准参考种子全部通关；不能直接跳结算冒充模拟 | development/web-tools/simulations.mjs及真实battle.stepBattle；最终JSON+core起止SHA | 最终JSON ok=true；20/20参考全通，100终局63胜37败；2050战，六首领均遇到，changed=[]、failures=[] |
| E06 | 100活动敌人、最大可部署防线、全部增援/多阶段首领代表性压力 | C压力；模拟runner；浏览器渲染基准 | C 100敌人/35构造压力与有限增援测试通过；当前清晰画布实测见CLARITY_UPDATE，旧93.68FPS不作为本次证据；硬件范围见E07 |
| E07 | GTX1050级1080p中画质平均≥60FPS、1%低帧≥45FPS；41×41寻路刷新不卡顿 | 指定硬件或可论证等效环境的真实浏览器帧时间记录 | 限制保留：旧低分辨率实测为RTX5060（93.68平均/48.08低1%FPS）；当前画布结果见CLARITY_UPDATE；GTX1050未实测，不能宣称满足该目标硬件指标 |
| E08 | 实际看菜单/三幕地图/全部节点/部署地形/四入口/六首领/胜败/设置；每个视觉变更审图 | 隔离QA浏览器截图、人工审看记录 | 主代理已审看菜单、三幕路线、各服务、部署/地形、三幕三首领、胜败与设置截图；六首领全机制由C/120覆盖，未声称六名均有独立人工录像 |
| E09 | Windows x64离线包、自带固定运行时与许可 | 最终build、86文件SHA256、4187/4188/4189独立启动 | 已通过 |
| E10 | 干净启动、规则与资源检查、真实通关/失败/战中退出 | 64测试、120模拟、BF48、B19、BP18、发布Web与源码逐项哈希相同 | 已通过所述范围 |
| E11 | 发布包在仓库外且只包含运行资源 | 86文件清单，实际运行资源逐项复制，无Godot/GLB/导入缓存 | 已通过 |
| E12 | 工作区清洁与用途分明 | 新代码与文档完整；旧源码文件为0；缓存/旁文件/空目录仍在 | 部分完成；剩余删除被自动审批拒绝 |
| E13 | 新版验证后删除Godot版本且保留玩家数据 | 旧源码/场景/配置已用文件补丁移除；缓存与旧EXE仍在；手动清理脚本未执行 | 未完成：自动审批返回 blocked by policy，需要用户手动清理 |
| E14 | 保留计划、更新玩法/开发/启动说明并披露限制 | 两计划哈希保持；README、GAMEPLAY、DEVELOPMENT、迁移和授权已更新；启动cmd已指向Web | 已完成文档与启动切换；整体目标不宣称完成 |

## 本轮界面审计修复与回归记录

1. 导航栈已修复；BS实际验证帮助→设置→帮助→原战前。
2. 解锁先保存draft，终态继续幂等settle；设置统一检查保存结果并toast，BP验证失败终态继续不重复发奖。
3. 地形保留selectedUid与ctx.preview；冻结previewOrigin同时保留占地/射界绘制并禁用输入，V/B/BP均通过，确认背景不再模糊。
4. 奖励卡使用Rules.unitStats；boss情报使用hint/mechanics，图鉴使用archive，结算包含eventDamage/三首领状态，融合后贡献使用unitOrigins；BF完成全部三幕及最终结算。
5. 新局已明示所选压力所有累计效果；深度12显示达到最大深度；基础抗性明确不含支援/战况。
6. 教程放在威胁栏下正常滚动，不再覆盖战场；升级标记由菱形改为紧凑金点，BP九种布局与主代理审图通过。当前教程为三段可跳过提示，其推进条件与动作里程碑式教程的差异在A06明示。

## Godot 删除与引擎中立资产保留清单

这是只读引用审计，尚未执行删除。所有相对路径均以 `D:\game_build` 为根；删除操作须在执行前解析并核对每个绝对路径，且只在 E13 的新版验收前提满足后实施。Web 的运行代码、服务器和构建脚本没有引用以下旧玩法目录。

| 范围 | 处置 | 依据及边界 |
| --- | --- | --- |
| `src/`、`scenes/`、`content/`、`development/tests/` | 删除旧目录 | 分别为GDScript实现、Godot场景、旧JSON目录和Godot测试；新版权威在 `web/core/` 与 `development/web-tests/` |
| `project.godot`、`export_presets.cfg`、`.godot/`、`launcher/run_game.ps1` | 删除 | Godot工程、导出、缓存与运行入口 |
| `development/tools/bake_pixel_sprites.gd`、`build_windows.ps1`、`capture_visuals.ps1`、`setup_godot.ps1`、`test.ps1`、`verify_assets.ps1`、`versions.ps1` | 删除旧工具 | 烘焙器是GDScript；其余均调用Godot或已由Web工具替代。删除后不能声称已保留可执行的图集再烘焙工作流 |
| `development/tools/verify_audio.ps1` | **已迁至 `development/web-tools/verify-audio.ps1`，保留** | 纯FFmpeg EBU R128与双层时长验证，没有Godot依赖；迁移后双层验证已通过，删除旧tools不应删除新版工具 |
| 旧工程内 `*.import`、`*.uid`、`.gdignore` | 随Godot清理 | 引擎旁文件不等于原PNG/OGG/MP3/TTF/GLB；不要使用一个宽泛资源目录删除动作代替旁文件筛选 |
| `assets/game/sprites/towers/`、`assets/game/sprites/enemies/` | **保留** | 12构造+28敌人八方向PNG，field运行加载，verify逐项要求 |
| `assets/third_party/fusion-pixel-font/` | **保留字体和OFL** | `style.css`的中文字体和verify必需许可 |
| `assets/third_party/opengameart/singularity/` | **保留双MP3及LICENSE** | Web Audio的calm/action同步战斗层 |
| `assets/third_party/opengameart/dark-sci-fi-audio/` | **保留5个OGG及LICENSE** | title、sector、transmission、victory、hover均在AUDIO_FILES中 |
| `assets/third_party/kenney/sci-fi-sounds/` | **保留8个OGG及License** | computerNoise_001、doorOpen_001、laserSmall_000、laserLarge_001、impactMetal_002、lowFrequency_explosion_000、forceField_001、explosionCrunch_003均有Web引用 |
| `development/assets/model_sources/kenney/` | **保留GLB、纹理及三套许可** | 引擎中立素材源和图集授权来源；verify仍要求space-kit/modular-space-kit/tower-defense-kit的许可 |
| `assets/third_party/node/LICENSE.txt`、`ASSET_MANIFEST.sha256` | **保留并按最终资产同步manifest** | Node离线运行时许可证和资产完整性证明 |
| `assets/third_party/kenney/{pixel-ui,game-icons,input-prompts-pixel}/` | 可在最终未使用资源清理中删除 | 当前Web使用CSS面板与SVG图标，没有这些PNG引用；它们是中立素材，删除属于无用资源整理而非删除Godot。先同步manifest和THIRD_PARTY_ASSETS，避免校验引用悬空 |
| `assets/third_party/{polyhaven,quaternius}/` | 空目录确认后可删除 | 当前文件清单无文件，不将未知用户内容视为空目录 |
| `logs/`、`.playwright-cli/`等临时验收输出 | 证据移至仓库外后清理 | QA产物不应长期进入源码；不应因目录为空或当前不可见而宣称清理完成 |
| `README.md`、`docs/DEVELOPMENT.md`、`docs/GAMEPLAY.md`、`docs/THIRD_PARTY_ASSETS.md`、根启动cmd、`.gitignore` | 更新后保留 | 说明与入口切换到Web；不能让旧Godot安装/构建命令继续指导玩家 |
| 系统Godot工具目录、任何浏览器/Godot真实存档设置、仓库外其他用户文件 | **不在删除范围** | 本次仅移除本项目旧实现，不卸载通用工具、不清理真实玩家进度 |

## 最终签收记录格式

每项门禁闭合时记录：执行命令或操作、源码版本/哈希、运行环境、结果与覆盖范围、证据文件的仓库外路径。不要把截图、日志和发布包长期写进源码目录。收尾时补入E09–E14的清理、最终构建与启动结果；交付必须保留GTX1050未实测和明确技术替代，不能将人工抽样或本机性能扩大表述为所有硬件、所有画面均已验证。
