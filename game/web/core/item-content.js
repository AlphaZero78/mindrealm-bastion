// Consumables share this catalog across rule previews, shops and combat.
export const items = Object.fromEntries([
  {id:'clarity',name:'清醒药剂',icon:'heart',color:'#99ddb5',price:45,stage:'any',description:'立即恢复 20 点精神稳定。'},
  {id:'repair_foam',name:'修复凝胶',icon:'repair',color:'#8dd9c7',price:35,stage:'any',target:'unit',description:'为指定存活构造恢复 35% 最大耐久，保留当前位置。'},
  {id:'focus_cell',name:'专注电池',icon:'focus',color:'#e5ce86',price:40,stage:'safe',description:'战斗外获得 30 点专注。'},
  {id:'stasis',name:'迟滞雾瓶',icon:'snow',color:'#92c8ef',price:35,stage:'battle',description:'使当前全部敌人移动速度降低 40%，持续 8 秒；受控制抗性影响。'},
  {id:'overclock',name:'超频注射剂',icon:'attack',color:'#ef9d7e',price:50,stage:'battle',duration:12,effect:'attack',value:.35,description:'所有构造攻击提高 35%，持续 12 秒。'},
  {id:'barrier',name:'火种护膜',icon:'shield',color:'#c9bcf4',price:50,stage:'battle',description:'吸收接下来 25 点突破或死亡压力伤害，持续至本场结束。'},
  {id:'insulator',name:'绝缘药剂',icon:'resistance',color:'#b2b0f0',price:40,stage:'battle',duration:20,effect:'resistance',value:3,description:'死亡压力抗性提高 3 点，持续 20 秒。'},
  {id:'pulse_bomb',name:'解调爆弹',icon:'burst',color:'#f5a2ab',price:60,stage:'battle',description:'对当前全部敌人造成 120 点伤害，穿过护甲，先消耗护盾；击杀照常产生死亡压力。'},
  {id:'cleanser',name:'净频溶剂',icon:'bandwidth',color:'#9ce1e8',price:30,stage:'battle',description:'清除当前带宽干扰与抗性腐蚀，恢复被禁用构造；后续干扰仍可生效。'},
  {id:'fortify',name:'装甲涂层',icon:'armor',color:'#cad5a0',price:40,stage:'battle',duration:18,effect:'armor',value:5,description:'所有构造防御提高 5 点，持续 18 秒。'}
].map(item=>[item.id,item]));
