const scene=(id,description)=>({path:`/assets/game/nexus/${id}.png`,description});

// Each messenger has a dedicated narrative scene. Icons remain on gift cards
// and the route map, where the same compact symbol identifies their patron.
export const NEXUS_ART={
 far_watcher:scene('far_watcher','望隙者在高处调焦三镜观测器，仔细观察远处来路。'),
 oath_keeper:scene('oath_keeper','守诺人在门边稳住护板，为脆弱的构造扣好防护束带。'),
 seed_healer:scene('seed_healer','续火医师在来访者身边修复便携火种，耐心观察火光和对方的神情。'),
 archive_child:scene('archive_child','拾忆童子在工作台上拼接记忆碎片，尝试新的组合。'),
 crystal_cartographer:scene('crystal_cartographer','晶图师沿山脊测量，在金属测量台上记录地形。'),
 chorus_weaver:scene('chorus_weaver','和声织者连接各处的通信线路，让分散的人重新听见彼此。'),
 winter_listener:scene('winter_listener','听雪客在雪中的哨所监听远处冲击，抬手示意同行者暂缓前进。'),
 pulse_diver:scene('pulse_diver','潜潮者收紧归航缆绳，在潮湿的回收舱里帮助同伴恢复呼吸。'),
 star_judge:scene('star_judge','星衡官校准瞄准与防护部件，望向来访者，等待最后的选择。'),
 foreign_voice:scene('foreign_voice','异声旅人在避雨处递出独立麦克风，鼓励安静的同行者说出自己的声音。'),
 gate_archivist:scene('gate_archivist','门内记述者在档案推车旁核对旧凭证，交接尚未焚毁的记录。'),
 scarred_dawn:scene('scarred_dawn','残曦在晨光中收紧修补过的护臂，带着旧伤与最后一枚电池准备出发。'),
};
