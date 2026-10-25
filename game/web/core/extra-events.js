const choice=(label,effects)=>({label,effects});
export const extraEvents=[
 {id:'lost_courier',act:1,title:'失联信使',choices:[choice('领取清醒药剂',{item:'clarity'}),choice("支付 25 专注，背包增加 2 格",{capacity:2,focus:-25}),choice('领取修复凝胶',{item:'repair_foam'})]},
 {id:'scrap_bridge',act:1,title:'废料桥',choices:[choice("回收一座库存构造，获得 55 专注",{recycle:true,focus:55}),choice("承受 10 精神伤害，背包增加 2 格",{spirit:-10,capacity:2}),choice('留下路标，获得迟滞雾瓶',{item:'stasis'})]},
 {id:'cooling_well',act:1,title:'冷却井',choices:[choice("饮用静频液，恢复 18 精神",{spirit:18}),choice("交出一瓶道具，最大精神增加 6",{consume_item:true,max_spirit:6}),choice('封装火种护膜',{item:'barrier'})]},
 {id:'field_brewer',act:1,title:'游走调配师',choices:[choice("支付 15 专注，领取解调爆弹",{focus:-15,item:'pulse_bomb'}),choice("支付 10 专注，领取超频注射剂",{focus:-10,item:'overclock'}),choice('带走免费专注电池',{item:'focus_cell'})]},
 {id:'memory_press',act:2,title:'记忆压缩机',choices:[choice("回收一座库存构造，背包增加 2 格",{recycle:true,capacity:2}),choice("回收一座库存构造，最大精神增加 10",{recycle:true,max_spirit:10}),choice('带走备用专注电池',{item:'focus_cell'})]},
 {id:'silent_exchange',act:2,title:'静默交换所',choices:[choice('交出一瓶道具，获得收藏品',{consume_item:true,relic:true}),choice("承受 18 精神伤害，获得收藏品",{spirit:-18,relic:true}),choice('协助净频校准，领取净频溶剂',{item:'cleanser'})]},
 {id:'defense_clinic',act:2,title:'防线诊所',choices:[choice("维修 2 座受损构造",{free_repairs:2}),choice("承受 12 精神伤害，背包增加 2 格",{capacity:2,spirit:-12}),choice("获得装甲涂层与 15 专注",{item:'fortify',focus:15})]},
 {id:'signal_distillery',act:2,title:'信号蒸馏室',choices:[choice("交出一瓶道具，永久抗性增加 3",{consume_item:true,resistance:3}),choice("承受 10 精神伤害，获得绝缘药剂与 35 专注",{spirit:-10,item:'insulator',focus:35}),choice("采集残余频率，获得 15 专注",{focus:15})]},
 {id:'last_logistics',act:3,title:'最后补给站',choices:[choice("回收一座库存构造，获得 100 专注",{recycle:true,focus:100}),choice("支付 45 专注，增加 1 个道具槽",{focus:-45,item_capacity:1}),choice("获得清醒药剂，恢复 10 精神",{item:'clarity',spirit:10})]},
 {id:'resonance_vault',act:3,title:'共振保管库',choices:[choice("交出一瓶道具，最大精神增加 12",{consume_item:true,max_spirit:12}),choice("回收一座库存构造，永久带宽增加 3",{recycle:true,bandwidth:3}),choice('取走门口的绝缘药剂',{item:'insulator'})]},
 {id:'breach_plan',act:3,title:'突破预案',choices:[choice("承受 8 精神伤害，获得解调爆弹",{item:'pulse_bomb',spirit:-8}),choice("获得净频溶剂与 35 专注",{item:'cleanser',focus:35}),choice("获得火种护膜，恢复 8 精神",{item:'barrier',spirit:8})]},
 {id:'echo_foundry',act:3,title:'回声熔炉',choices:[choice("回收一座库存构造，全部构造攻击增加 8%",{recycle:true,tower_damage_bonus:.08}),choice("交出一瓶道具，修复全体构造 25% 耐久",{consume_item:true,repair_all:.25}),choice('拾取余热，获得超频注射剂',{item:'overclock'})]}
];
