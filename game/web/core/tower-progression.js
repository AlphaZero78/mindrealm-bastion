// T3 adds a second mechanic while retaining the selected T2 branch.
export const tierThree = Object.freeze({
 anchor_bulwark:{A:{effect:'root',name:'锁定反震'},B:{effect:'self_repair',name:'基座复原'}},
 phase_blade:{A:{effect:'execute',name:'收割回路'},B:{effect:'chain',name:'横切连击'}},
 boundary_riveter:{A:{effect:'guard',name:'稳固屏障'},B:{effect:'armor_break',name:'解甲束缚'}},
 resonance_guard:{A:{effect:'regeneration',name:'共振复原'},B:{effect:'slow_aura',name:'迟滞导流'}},
 pulse_array:{A:{effect:'mark',name:'协同标记'},B:{effect:'pierce',name:'穿甲防空'}},
 focus_rail:{A:{effect:'armor_break',name:'破甲贯穿'},B:{effect:'mark',name:'处决标定'}},
 arc_mortar:{A:{effect:'mark',name:'区域标定'},B:{effect:'pressure_filter',name:'静频腐蚀'}},
 drone_loom:{A:{effect:'armor_break',name:'拆甲蜂群'},B:{effect:'anti_air',name:'空域追猎'}},
 bandwidth_relay:{A:{effect:'regeneration',name:'维修信道'},B:{effect:'jam_immunity',name:'隔离信道'}},
 memory_mechanic:{A:{effect:'repair_shield',name:'急救护层'},B:{effect:'repair_link',name:'联结维修'}},
 frequency_choir:{A:{effect:'armor_aura',name:'护甲节拍'},B:{effect:'pressure_filter',name:'消噪节拍'}},
 resistance_beacon:{A:{effect:'pressure_filter',name:'净化灯域'},B:{effect:'guard',name:'护卫灯域'}}
});
export const hasUnitEffect=(stats,effect)=>stats.effects?stats.effects.includes(effect):stats.effect===effect;
