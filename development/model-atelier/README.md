# 原创模型制作源

本目录保存当前游戏的模型定义、动作、运行适配器和制作工具。12 类建筑各有五种阶级或分支，37 类敌人包括六名首领的三阶段，共 109 个外观；追踪无人机另有独立模型。

## 源码与运行文件

- `src/entities/`：分组模型定义、动作及机械连接约束。
- `src/models.js`：最初六个模型及完整目录的统一入口。
- `src/geometry.js`：圆角外壳、筒体、轴承、管线及几何合并。
- `src/animations.js`：动作关键帧烘焙，默认 30 Hz，重卫的快速动作使用 60 Hz。
- `src/runtime/`：完整 GLB 加载、动作采样、连接校正、接地和材质合批。
- `scripts/`：模型导出、图集制作、验证和安装。
- `vendor/three/`：制作使用的本地 Three.js 模块及 MIT 许可。

游戏实际加载 `game/assets/game/models/<id>/<variant>.glb`。每个模型内含 `idle`、`move`、`attack`、`windup`、`release`、`ability`、`shutdown` 七段动作。`models.json` 连接游戏 ID 与对应外观，肖像和回退图集由相同 GLB 生成。

## 在项目外重建

使用 Node.js 24.12.0。将本目录复制到新的项目外工作目录，避免把模型导出、缓存和检查图片混入仓库。以下示例中的工作目录和备份目录应当尚未存在。

```powershell
$modelWork = 'D:\game_build_archive\model-rebuild'
Copy-Item -LiteralPath 'D:\game_build\development\model-atelier' -Destination $modelWork -Recurse
Set-Location -LiteralPath $modelWork
$env:MINDREALM_GAME_CONTENT = 'D:/game_build/game/web/core/content.js'
$env:MINDREALM_GAME_VIEW = 'D:/game_build/game/web/view/battlefield.js'
npm.cmd ci
npm.cmd run build
npm.cmd run build:entities
npm.cmd run build:pack
npm.cmd run art:generate
```

`build` 更新六模型预览；`build:entities` 导出完整外观；`build:pack` 生成运行适配器和独立无人机。`art:generate` 输出并安装肖像、静态、动作及死亡图集，随后更新对应的运行索引。输出位于该工作目录的 `models/`、`release/mindrealm-entity-pack/` 和 `qa/entity-art/`。

导出通过顶点索引复用和恒定关键帧压缩减少体积，保留全部三角面、材质、关节及动作。导出时逐项比较顶点属性流，允许的数值差上限为 `1.01e-6`。

## 预览与验证

在外部工作目录执行 `npm.cmd start`，通过 `http://127.0.0.1:4179/review.html` 查看全部外观。`combat.html` 展示平滑重新锁定、轨炮射束、迫击高弧线、命中、缓速和消散；`index.html` 保留六模型预览。页面完全使用本地资源。

全量缩略图复用一个图形上下文，详情页使用独立上下文。弹道拖尾采用固定容量的动态缓冲区。后续预览请按“在项目外重建”生成新的工作目录，再从该目录启动。

2026-10-31 已复核主游戏接入，并将 Kimitry、旧会话导出、旧构建工作副本和预览缓存移入回收站。当前制作源完整保存在本目录，运行模型和图集位于 `game/assets/game/`；原始回滚备份及验收记录保留在项目外。

修改时用 `node scripts/validate-refinement.mjs --ids <逗号分隔的实体ID>` 检查受影响模型，完成后集中执行所需检查：

```powershell
npm.cmd run validate:refinement
npm.cmd test
npm.cmd run validate:grounding
```

连接检查覆盖源动作以及实际 GLB 重载后的移动施法。`MechanicalConnections` 在动画合成后按模型中保存的支点求解连杆方向与轴向行程，保持套筒搭接。视觉检查仍需查看最终 GLB 的外观与动作，数值检查用于补充证据。

## 安装到游戏

完成模型和图集后，从外部工作目录运行：

```powershell
node scripts/install-into-game.mjs --target D:/game_build --backup D:/game_build_archive/model-install-backup
Set-Location -LiteralPath 'D:\game_build'
node development/web-tools/refresh-asset-manifest.mjs --write
npm.cmd test
npm.cmd run verify
```

安装器先验证 49 个游戏 ID、109 个外观、七段动作和战场适配边界，再备份被替换的文件。旧模型零件及已停用的环境纹理移入外部备份；主界面、游戏规则、事件、PV 和浏览器存档由现有游戏继续管理。制作目录中的模型目录、构建统计和图集测量 JSON 保留在外部资产包，运行目录只接收实际使用的资源。

安装后使用独立开发端口检查新局、成长、首领阶段、暂停、倍速、移动施法、图形回退和完整远征。正式服务使用已有玩家存档，自动验证使用内存存档或新建浏览器上下文。

当前验收结果与性能边界见[模型与动作说明](../docs/ENTITY_MODELS_AND_ANIMATION.md)。游戏浏览器检查使用 `browser-whole-entity-catalog.js`、`browser-whole-entity-gameplay.js`、`browser-enemy-fallback.js` 和 `browser-model-performance.js`；制作页使用 `browser-model-atelier.js`。这些脚本均位于 `development/web-tests/`，通过 Playwright CLI 的 `run-code --filename` 执行，工作目录应设在项目外。
