// Each new act adds a different formation: escorts, repair convoys, then siege.
export const actEnemies=[
 {id:'scrap_bulwark',name:'废响重盾',act:1,hp:156,speed:.64,attack:18,armor:7,pressure:6,xp:28,focus:4,core_damage:6,air:false,ability:'armored',kind:'normal',frontline:true,description:'低速重甲前排，攻击穿透35%护甲。用高伤单发或破甲构造处理。'},
 {id:'echo_glider',name:'回声滑翔翼',act:1,hp:78,speed:1.16,attack:9,armor:0,pressure:5,xp:27,focus:4,core_damage:5,air:true,ability:'haste',kind:'normal',description:'飞行护航机。预警后让6格内敌人移速提高20%，持续4秒；优先用对空火力打断编队。'},
 {id:'noise_bell',name:'噪声丧钟',act:1,hp:670,speed:.7,attack:27,armor:6,pressure:25,xp:185,focus:22,core_damage:17,air:false,ability:'pressure_aura',kind:'elite',description:'预警后开启4秒压力场，使6格内敌人的死亡压力提高25%。在远处优先击杀，避免与敌群一起进入火种近区。'},
 {id:'memory_runner',name:'记忆赶工者',act:2,hp:172,speed:1.2,attack:25,armor:4,pressure:8,xp:42,focus:6,core_damage:8,air:false,ability:'sprint',kind:'normal',frontline:true,description:'工厂快速突击体。预警后冲刺2.5秒，移速提高65%；比边境奔袭体更耐打，适合用定身与近战拦截。'},
 {id:'repair_skiff',name:'修复穿梭艇',act:2,hp:152,speed:.95,attack:11,armor:3,pressure:8,xp:48,focus:7,core_damage:7,air:true,ability:'heal',kind:'normal',healFraction:.11,description:'飞行维修艇。预警后为6格内敌人恢复11%生命；护航重甲队列时威胁很大，需要对空集火。'},
 {id:'archive_warden',name:'档案典狱长',act:2,hp:1080,speed:.68,attack:37,armor:12,pressure:31,xp:270,focus:30,core_damage:23,air:false,ability:'group_shield',kind:'elite',shieldFraction:.18,description:'预警后为6格内敌人提供18%生命值的护盾。群体护盾取较高值；集火典狱长能截断后续补盾。'},
 {id:'ordered_sentinel',name:'秩序重卫',act:3,hp:385,speed:.68,attack:41,armor:15,pressure:15,xp:78,focus:11,core_damage:12,air:false,ability:'armored',kind:'normal',frontline:true,pierce:.45,description:'统御核心的重装前排，攻击穿透45%护甲。生命、护甲和突破伤害都更高；破甲火力与持续维修需要配合。'},
 {id:'null_wing',name:'缄默巡翼',act:3,hp:218,speed:1.07,attack:19,armor:7,pressure:14,xp:75,focus:11,core_damage:10,air:true,ability:'jam',kind:'normal',jamBaseStrength:3,jamDuration:4,description:'飞行干扰机。预警后压低3点带宽，持续4秒；多机效果叠加，预留带宽或提前击落能避免防线过载。'},
 {id:'entropy_engine',name:'熵蚀攻城机',act:3,hp:1530,speed:.57,attack:68,armor:18,pressure:42,xp:355,focus:38,core_damage:29,air:false,ability:'siege',kind:'elite',attackRange:4.4,pierce:.3,description:'4.4格内攻击构造，穿透30%护甲，对地形屏障造成3倍伤害。三次齐射后推进2.5秒；在高地布置远程火力并分散防线。'},
];

export const frontlineByAct=[
 ['static_drifter','spike_runner','scrap_bulwark'],
 ['memory_runner','remote_hunter','siege_ram'],
 ['armored_worm','ordered_sentinel','detonation_shell'],
];
