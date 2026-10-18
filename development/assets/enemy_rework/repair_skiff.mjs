import {part, joint, sp, handed} from '../../web-tools/enemy-model-authoring.mjs';

// One central keel and two plain pontoons meet at two load bridges.
// Four original vector pivots carry this single assembled airframe.
const lifts = [
  {id:'LF',x:-.64,y:-.44}, {id:'RF',x:.64,y:-.44},
  {id:'LR',x:-.64,y:.44}, {id:'RR',x:.64,y:.44},
];
const rig = [
  joint('chassis',[0,.04,.86]),
  joint('coverL',[-.34,.07,1.225],'chassis'),
  joint('coverR',[.34,.07,1.225],'chassis'),
  joint('pump',[0,.07,1.16],'chassis'),
  joint('distributor',[0,.04,.68],'chassis'),
  ...lifts.map(({id,x,y})=>joint('lift'+id,[x,y,.625],'chassis')),
  joint('trimL',[-.64,.70,.94],'chassis'),
  joint('trimR',[.64,.70,.94],'chassis'),
  joint('sensor',[0,-.63,1.015],'chassis'),
  joint('injector',[0,-.58,.89],'chassis'),
  joint('contact',[0,-.99,.89],'injector'),
];

const base = [
  part('贯通鼻尾的单根维修龙骨',sp('craft_racer'),[.66,1.60,.23],[0,-.04,.73],'chassis',[0,0,180],'dark'),
  handed(part('左侧单片折边浮梁',sp('corridor_wall'),[.50,1.72,.28],[-.64,0,.66],'chassis',[0,0,0],'ivory'),-1),
  handed(part('右侧单片折边浮梁',sp('corridor_wall'),[.50,1.72,.28],[.64,0,.66],'chassis',[0,0,0],'ivory'),1),
  part('前浮梁到维修龙骨的单根横桥',sp('corridor_wall'),[1.32,.16,.12],[0,-.44,.80],'chassis',[0,0,0],'metal'),
  part('后浮梁到维修龙骨的单根横桥',sp('corridor_wall'),[1.32,.16,.12],[0,.44,.80],'chassis',[0,0,0],'metal'),
  part('中央维修舱的连续开口侧壳',sp('rocket_sidesA'),[.70,.91,.32],[0,.07,.905],'chassis',[0,0,0],'metal'),
  handed(part('左侧可见复合液储筒',sp('rocket_fuelB'),[.16,.22,.20],[-.21,.09,1.015],'chassis',[0,0,0],'gold'),-1),
  handed(part('右侧可见复合液储筒',sp('rocket_fuelB'),[.16,.22,.20],[.21,.09,1.015],'chassis',[0,0,0],'accent'),1),
  part('后舱供压机与原生外管',sp('machine_generator'),[.46,.30,.25],[0,.58,.945],'chassis',[0,0,0],'native'),
  part('修复泵的捕获导筒',sp('rocket_sidesA'),[.27,.27,.20],[0,.07,1.01],'chassis',[0,0,0],'dark'),
  part('沿导筒滑动的整段泵柱与压头',sp('rocket_fuelB'),[.19,.19,.26],[0,.07,1.01],'pump',[0,0,0],'gold'),
  handed(part('左侧单片维修舱盖',sp('corridor_wall'),[.235,.86,.06],[-.2225,.07,1.225],'coverL',[0,0,0],'ivory'),-1),
  handed(part('右侧单片维修舱盖',sp('corridor_wall'),[.235,.86,.06],[.2225,.07,1.225],'coverR',[0,0,0],'ivory'),1),
  part('维修舱到腹盘的封闭供液导筒',sp('rocket_sidesA'),[.17,.17,.25],[0,.04,.93],'chassis',[180,0,0],'metal'),
  part('腹部旋转分配盘的储压外圈',sp('rocket_fuelB'),[.44,.44,.13],[0,.04,.615],'distributor',[0,0,0],'gold'),
];

for (let index=0;index<4;index++) {
  const theta=index*Math.PI/2;
  const side=index===3?-1:1;
  base.push(handed(part(`腹盘第${index+1}路径向短修复喷口`,sp('rocket_topA'),[.13,.13,.105],
    [.205*Math.sin(theta),.04-.205*Math.cos(theta),.68],
    'distributor',[90,0,index===3?-90:index*90],'glow'),side));
}

for (const {id,x,y} of lifts) {
  const side=Math.sign(x);
  base.push(
    handed(part(`升力单元${id}环形推力肩框`,sp('rocket_fuelB'),[.31,.31,.20],[x,y,.58],'chassis',[0,0,0],'metal'),side),
    handed(part(`升力单元${id}收敛喷口`,sp('rocket_topA'),[.27,.27,.22],[x,y,.625],'lift'+id,[180,0,0],'metal'),side),
  );
}

base.push(
  handed(part('左尾缘单片制动调平片',sp('corridor_wall'),[.24,.30,.06],[-.64,.81,.94],'trimL',[0,0,0],'armor'),-1),
  handed(part('右尾缘单片制动调平片',sp('corridor_wall'),[.24,.30,.06],[.64,.81,.94],'trimR',[0,0,0],'armor'),1),
  part('前向维修队列定位狭窗',sp('desk_computerScreen'),[.28,.105,.16],[0,-.67,.94],'sensor',[0,0,180],'glow'),
  part('鼻下接触针的加长捕获导筒',sp('rocket_sidesA'),[.17,.17,.43],[0,-.47,.89],'chassis',[90,0,0],'dark'),
  part('捕获导筒内的轴向接触针柱',sp('rocket_fuelA'),[.09,.09,.39],[0,-.60,.89],'injector',[90,0,0],'gold'),
  part('针柱前端可压缩的短接触帽',sp('rocket_topA'),[.15,.15,.095],[0,-.99,.89],'contact',[90,0,0],'blade'),
);

export default {
  id:'repair_skiff',kind:'enemies',role:'normal',locomotion:'hover',
  rig,variants:{base},
  design:{
    name:'修复穿梭艇',
    silhouette:'双侧平直浮梁、中央开口维修舱、双维修盖和腹部四向分配盘。四个短收敛喷口维持悬停。',
    loadPath:'两根单片横桥连接浮梁和中央龙骨，四个环形肩框直接托住浮梁。连续维修舱壳支撑舱盖、储筒及捕获泵柱。',
    locomotion:'原四路矢量升力、尾缘调平和固定机身高度保持原值。',
    attack:'接触针沿原捕获导筒完成回抽、前伸、触帽压缩和复位，全部接触关节坐标保持原值。',
    ability:'原 heal 预警开启双盖和提起泵柱；释放下压泵柱、旋转腹盘并复位。双盖内侧保留 0.21 宽中央通道，容纳 0.19 宽整段泵柱。',
    failure:'原四路喷口失锁、泵柱回落及盖板卸压末姿沿用现有动作。',
    materials:'44 件收为 33 件。删除内叠底舱、泵柱装饰帽、舱盖和尾片重复铰座、四枚喷口内芯及前窗承圈。左右浮梁、储筒、舱盖、尾片和升力组件执行源网格 X 镜像。',
    source:'Kenney Space Kit CC0；许可与原网格保留于 development/assets/model_sources/kenney/space-kit/。',
    partCount:33,
  },
};
