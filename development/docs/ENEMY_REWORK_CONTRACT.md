# 怪物模型与动作制作合同

每种怪物由一个独立子代理负责。先读取 `game/web/core/content.js`、`enemy-expansion.js` 和 `battle.js` 中自己的行为；设计承重、推进、攻击和技能装置，再写独立模型与动作文件。主进程负责集成和逐项视觉检查。

## 文件与格式

- `development/assets/enemy_rework/<id>.mjs`：默认导出模型定义，是制作的权威来源。
- `game/web/view/enemy-animations/<id-with-hyphens>.js`：导出 `animate(context)`，只返回姿态，保持战斗规则独立。
- `development/assets/enemy_rework/<id>.md`：简短记录轮廓、承重与关节、攻击和能力动作、细节用途，以及需要主进程查看的角度。

模型定义包含 `id`、`kind:'enemies'`、`role`、`locomotion`、`rig`、`variants` 和 `design`。普通与精英使用 `base`；首领使用 `phase1`、`phase2`、`phase3`。`rig` 是按父节点在前排列的 `{id,pivot,parent}` 数组；pivot 为静止姿态下的全局模型坐标。每个部件使用具有实际面板、倒角和机械造型的现有 CC0 GLB，包含 `label,source,size,position,joint,rotation,finish,motion:'fixed'`。

可从 `development/web-tools/enemy-model-authoring.mjs` 导入 `part`、`joint`、`sp`、`td`、`mirrored`。坐标是 X 右、Y 后、Z 上，前方是 −Y；position 对应零件底面中心，size 是完整 XYZ 尺寸，静止 rotation 使用度数。source 必须是 `game/assets/game/models/models.json` 中已登记的 GLB；制作素材和许可继续保留。

动作模块可导入 `../enemy-rig.js`。输入包含 `action,progress,clock,travel,speed,moving,stage,ability,actionKind,phase,reducedMotion`，clock 使用毫秒。travel 和 speed 已按渲染缩放换算到模型坐标；worldTravel 保留游戏行程，modelScale 给出模型缩放。状态还包含 `sprinting,boosted,shieldFraction,abilityActive,hit`，分别表示实际冲刺、加速、护盾比例、持续能力和受击包络。预警 progress 按实际开始和结束时间归一化。返回 `{joints:{id:{rotation:[rx,ry,rz],position:[dx,dy,dz]}},root:{rotation,position}}`，旋转使用弧度、位移使用模型坐标。运动围绕关节 pivot，父节点带动子节点。没有变化的关节可省略。仅使用纯数学；禁止 DOM、随机数或修改输入。静止、预览、停机、减少动态效果保持可靠固定姿态。

## 模型要求

死亡姿态收到 `deathStartClock`（毫秒），是实际消散事件的固定起始时刻。需要保留风扇、飞轮等停转相位时，用这一时刻积分制动；减少动态效果直接呈现同一事件的完整固定末姿。共享渲染器负责飞行残骸从实际飞行高度落到地面，专属模块负责局部结构失压。

轮廓、壳体与能力装置必须具有本怪物的独立身份。每个零件应有结构用途：壳体、承重骨架、轴承、连杆、护板、管线、散热、传感或攻击设备。采用与建筑相同的加工边缘、材质和表面层次。普通模型通常有 24–44 件，精英 32–56 件，首领 36–68 件；数量仅用于控制制作与渲染成本，视觉质量由主进程实际检查。小型紧固件可标记 detail，远景省略；主体、步足和职责装置始终可读。

避免粗略的长方体、球、圆柱堆叠。采用现有完整机械外壳和细节网格形成连续、连接合理的结构。关节不能悬空；步足需有髋、膝、踝或其他能解释运动的机构，部件之间保留运动间隙。装饰不得遮盖传感器和武器功能。每个首领阶段须有实际展开、改装或危险装置变化。

## 动作要求

每种怪物均有独立移动、攻击、能力准备与释放、受击和死亡表现。步行应包含支撑脚接触、抬脚回摆、膝踝配合与重心转移；履带和车轮按行程驱动传动与悬架；飞行按推进和舵面表现转向与稳定。攻击采用蓄势、工作行程、后坐或接触、复位的完整因果过程。能力装置应按游戏规则在预警和释放时工作。严禁只使整体或四肢做正弦摇摆。

主进程将检查近景多角度、动画关键帧与连续动作、暂停和倍速、真实战斗，以及代表性压力。子代理只做小样本数学或语法检查，不重复运行完整测试、打包、启动浏览器或刷新共享资源清单。

代理只修改自己的三个文件；不修改渲染器、共享工具或其他怪物，不提交或发布。代理之间传文字和路径，图片处理与渲染留在本地。
