const choice=(label,effects)=>({label,effects});
export const extraEvents=[
 {id:'lost_courier',act:1,title:'失联信使',text:'信使留下三个密封匣。应急补给、运输空间与防线维修，你只能取走一份。',choices:[choice('领取清醒药剂',{item:'clarity'}),choice('扩充背包，支付25专注',{capacity:2,focus:-25}),choice('领取修复凝胶',{item:'repair_foam'})]},
 {id:'scrap_bridge',act:1,title:'废料桥',text:'旧运输桥要求一份金属配重。拆解一座库存构造，或用自己的频率稳住桥面。',choices:[choice('回收一座库存构造，获得55专注',{recycle:true,focus:55}),choice('承受10精神伤害，背包增加2格',{spirit:-10,capacity:2}),choice('留下路标，获得迟滞雾瓶',{item:'stasis'})]},
 {id:'cooling_well',act:1,title:'冷却井',text:'井底的静频液可以稳定火种，也可以配成持久的保护剂。',choices:[choice('饮用静频液，恢复18精神',{spirit:18}),choice('换出一瓶道具，最大精神增加6',{consume_item:true,max_spirit:6}),choice('封装火种护膜',{item:'barrier'})]},
 {id:'field_brewer',act:1,title:'游走调配师',text:'调配师愿意为这次远征准备一瓶试剂。配方决定它适合解决哪种危机。',choices:[choice('支付15专注，领取解调爆弹',{focus:-15,item:'pulse_bomb'}),choice('支付10专注，领取超频注射剂',{focus:-10,item:'overclock'}),choice('带走免费专注电池',{item:'focus_cell'})]},
 {id:'memory_press',act:2,title:'记忆压缩机',text:'压缩机可以把闲置构造转化为更轻的记忆，也能重新设计运输匣。',choices:[choice('回收一座库存构造，背包增加2格',{recycle:true,capacity:2}),choice('回收一座库存构造，最大精神增加10',{recycle:true,max_spirit:10}),choice('带走备用专注电池',{item:'focus_cell'})]},
 {id:'silent_exchange',act:2,title:'静默交换所',text:'收藏者愿意用一件收藏品交换尚未开封的道具。她也接受精神频率作为代价。',choices:[choice('交出一瓶道具，获得收藏品',{consume_item:true,relic:true}),choice('承受18精神伤害，获得收藏品',{spirit:-18,relic:true}),choice('离开并领取净频溶剂',{item:'cleanser'})]},
 {id:'defense_clinic',act:2,title:'防线诊所',text:'诊所只剩一次服务能源。储备下一战的应急药剂，或立即重整防线。',choices:[choice('维修两个受损构造',{free_repairs:2}),choice('背包增加2格，承受12精神伤害',{capacity:2,spirit:-12}),choice('获得装甲涂层与15专注',{item:'fortify',focus:15})]},
 {id:'signal_distillery',act:2,title:'信号蒸馏室',text:'蒸馏室将一种频率转成另一种。选择的配方会改变后续战斗的应对方式。',choices:[choice('交出一瓶道具，永久抗性增加3',{consume_item:true,resistance:3}),choice('承受10精神伤害，获得绝缘药剂与35专注',{spirit:-10,item:'insulator',focus:35}),choice('采集残余频率，获得15专注',{focus:15})]},
 {id:'last_logistics',act:3,title:'最后补给站',text:'最后的运输节点仍在运转。以库存换资源，或带走一份前线补给。',choices:[choice('回收一座库存构造，获得100专注',{recycle:true,focus:100}),choice('支付45专注，增加1个道具槽',{focus:-45,item_capacity:1}),choice('获得清醒药剂，恢复10精神',{item:'clarity',spirit:10})]},
 {id:'resonance_vault',act:3,title:'共振保管库',text:'保管库需要一份完整的频率样本才能开启。它会永久改变火种。',choices:[choice('交出一瓶道具，最大精神增加12',{consume_item:true,max_spirit:12}),choice('回收一座库存构造，永久带宽增加3',{recycle:true,bandwidth:3}),choice('取走门口的绝缘药剂',{item:'insulator'})]},
 {id:'breach_plan',act:3,title:'突破预案',text:'抵抗者留下三套应急预案。火力、净化与保护各有适用时机。',choices:[choice('获得解调爆弹，承受8精神伤害',{item:'pulse_bomb',spirit:-8}),choice('获得净频溶剂与35专注',{item:'cleanser',focus:35}),choice('获得火种护膜，恢复8精神',{item:'barrier',spirit:8})]},
 {id:'echo_foundry',act:3,title:'回声熔炉',text:'熔炉可以把剩余的空间和物资转成持久力量。选择代价，再继续向控制中枢前进。',choices:[choice('回收一座库存构造，全部构造攻击增加8%',{recycle:true,tower_damage_bonus:.08}),choice('交出一瓶道具，修复全体构造25%耐久',{consume_item:true,repair_all:.25}),choice('拾取余热，获得超频注射剂',{item:'overclock'})]}
];
