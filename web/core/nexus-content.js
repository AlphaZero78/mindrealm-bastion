// Exclusive, deterministic gifts. Ordinary shops and rewards never draw here.
const messenger = (id,act,name,title,art,color,quote,gifts) => ({id,act,name,title,art,color,quote,gifts});
const gift = (id,name,description,fx={},grant={}) => ({id,name,description,fx,grant,exclusive:'nexus'});
export const messengers = Object.fromEntries([
  messenger('far_watcher',0,'望隙者','在高处读懂来路','third-eye','#e7d59c','让视线先抵达危险。',[
    gift('nexus_horizon','远界之瞳','远程在二级及以上高地伤害 +35%；近战攻击 −15%。',{highground_damage:.35,melee_attack:-.15}),
    gift('nexus_lens','透隙长镜','直接攻击射程 +25%、远程忽略 6 点护甲；所有构造最大耐久 −15%。',{direct_range:.25,ranged_pierce:6,hp:-.15}),
    gift('nexus_terraces','浮阶印记','地形改造费用 −70%、搬迁费用 −50%；敌人在距火种 12 格外死亡时压力 −30%。',{terrain_discount:.7,move_discount:.5,far_pressure:.3})]),
  messenger('oath_keeper',0,'守诺人','为脆弱留下位置','templar-eye','#aac7cc','站在这里，本身就是一个回答。',[
    gift('nexus_bastion','不退誓碑','近战最大耐久 +60%、受到攻击伤害 −15%；远程攻击 −15%。',{melee_hp:.6,melee_reduction:.15,ranged_attack:-.15}),
    gift('nexus_thorns','回声荆冠','启用中的近战反射所受伤害的 65%，忽略敌人护甲；维修费用 +25%。',{melee_reflect:.65,repair_discount:-.25}),
    gift('nexus_sentinel','哨卫契约','最早部署的三个存活构造护甲 +10；每场开战时火种获得 18 点屏障。',{priority_armor:10,nexus_shield:18})]),
  messenger('seed_healer',0,'续火医师','修补仍在跳动的记忆','heart-organ','#d6aaa3','伤口可以留下，火种仍会生长。',[
    gift('nexus_second_skin','第二层心壁','最大精神稳定 +30，并恢复 30；战斗胜利额外恢复 6。',{nexus_post_heal:6},{maxSpirit:30}),
    gift('nexus_stitch','共生缝线','维修型支援维修量 +60%、支援范围 +25%；远程攻击 −10%。',{support_efficiency:.6,support_range:.25,ranged_attack:-.1}),
    gift('nexus_aftercare','余温护理箱','战斗胜利后所有存活构造恢复 20% 最大耐久；付费维修费用 −40%。',{nexus_post_repair:.2,repair_discount:.4})]),
  messenger('archive_child',0,'拾忆童子','拾回未被命名的可能','brain','#b7abd3','每一段碎片，都能换一种拼法。',[
    gift('nexus_credit','借明日之灯','立即获得 180 专注；最大精神稳定降低 20，当前值随上限降低。',{},{focus:180,maxSpirit:-20}),
    gift('nexus_blueprint','未完成蓝图','付费升阶费用 −45%、维修费用 −20%；所有构造最大耐久 −10%。',{upgrade_discount:.45,repair_discount:.2,hp:-.1}),
    gift('nexus_small_voices','微声合约','T1 构造带宽占用 −1（至少 1）、攻击 +30%；T2/T3 攻击 −10%。',{t1_bandwidth:1,nexus_t1_attack:.3,nexus_evolved_attack:-.1})]),
  messenger('crystal_cartographer',1,'晶图师','刻下山脊的频率','crystal-eye','#9bd5d1','改变落脚之处，也改变答案。',[
    gift('nexus_crown','山脊王冠','远程攻击低处目标时，每级高差额外 +8% 射程与伤害；所有构造最大耐久 −15%。',{height_bonus:.08,hp:-.15}),
    gift('nexus_skyfire','天穹炉芯','间接攻击伤害 +45%、爆炸半径 +35%；直接攻击伤害 −15%。',{nexus_indirect:.45,indirect_radius:.35,nexus_direct:-.15}),
    gift('nexus_airlock','空域封印','对空伤害 +60%、直接攻击射程 +15%；最大精神稳定降低 15。',{anti_air_damage:.6,direct_range:.15},{maxSpirit:-15})]),
  messenger('chorus_weaver',1,'和声织者','把孤独编入网络','gaze','#b3d59e','让每一个位置，都听见另一个位置。',[
    gift('nexus_choir','同频乐章','同时被至少两个支援覆盖时，维修、合唱强化和支援护甲效果 +65%；支援范围 +20%。',{support_overlap:.65,support_range:.2}),
    gift('nexus_clock','群星时钟','有启用中的支援覆盖时，攻击间隔缩短 25%、护甲 +4；所有构造最大耐久 −10%。',{support_rate:.25,support_armor:4,hp:-.1}),
    gift('nexus_open_channel','众声天线','永久有效带宽 +10、抵消 4 点敌方干扰；所有构造攻击 −10%。',{bandwidth:10,jam_resist:4,attack:-.1})]),
  messenger('winter_listener',1,'听雪客','使冲击缓慢抵达','brain-freeze','#b2cbe3','安静，是给自己留下反应的时间。',[
    gift('nexus_stillness','静止回廊','每名敌人出现时被减速 8 秒（基础减速 40%，受控制压力影响）；死亡压力降低 20%。',{nexus_spawn_slow:8,pressure_reduction:.2}),
    gift('nexus_silence','雪中钟舌','永久抗性 +5；每场战斗中完全吸收一次死亡压力，临时抗性 +1，最多 +5。',{resistance:5,resistance_stack:5}),
    gift('nexus_distance','千步雪线','敌人在距火种 12 格外死亡时压力 −65%；直接攻击射程 +20%。',{far_pressure:.65,direct_range:.2})]),
  messenger('pulse_diver',1,'潜潮者','从低谷取回力量','tentacle-heart','#cf9dae','我记得你仍在呼吸。',[
    gift('nexus_red_tide','绯潮心核','精神低于 35% 时全体攻击 +70%、范围 +20%；维修费用 +30%。',{low_spirit_damage:.7,crisis_range:.2,repair_discount:-.3}),
    gift('nexus_lifeline','归航缆绳','每场首次致命精神伤害后保留 1 精神；每场开战获得 25 点火种屏障。',{death_guard:1,nexus_shield:25}),
    gift('nexus_sacrifice','深潜筹码','立即损失最多 35 精神（至少保留 1），获得 140 专注；永久带宽 +7。',{bandwidth:7},{focus:140,spiritCost:35})]),
  messenger('star_judge',2,'星衡官','称量最后一次选择','star-pupil','#e5c791','权重属于仍能作出选择的人。',[
    gift('nexus_verdict','断讯判词','对首领伤害 +65%、对精英伤害 +30%；普通敌人死亡压力 +20%。',{nexus_boss_damage:.65,nexus_elite_damage:.3,nexus_normal_pressure:.2}),
    gift('nexus_precision','唯一答案','优先级设为最高生命时，远程伤害 +45%、忽略 10 点护甲；远程间隔变为原来的 1.15 倍。',{high_hp_damage:.45,ranged_pierce:10,nexus_ranged_delay:.15}),
    gift('nexus_quiet_end','终曲休止符','每场开战获得 50 点火种屏障、抗性 +3；付费升阶费用 +30%。',{nexus_shield:50,resistance:3,nexus_upgrade_tax:.3})]),
  messenger('foreign_voice',2,'异声旅人','保留不相同的声音','alien-stare','#a8d9bc','把不同留在这里，世界就还有出口。',[
    gift('nexus_ensemble','异声合奏','启用的构造同时含近战、远程、支援时，全体攻击 +40%；固定有效带宽 +6，维修费用 +20%。',{nexus_trinity:.4,bandwidth:6,repair_discount:-.2}),
    gift('nexus_few','少数者席位','部署且存活的构造不超过 8 个时，攻击 +65%、护甲 +8；超过后这两项加成消失。',{nexus_small_army:.65,nexus_small_armor:8}),
    gift('nexus_many','万千细语','T1 构造攻击 +80%、最大耐久 +60%、带宽占用 −1（至少 1）；T2/T3 攻击 −20%。',{nexus_t1_attack:.8,nexus_t1_hp:.6,t1_bandwidth:1,nexus_evolved_attack:-.2})]),
  messenger('gate_archivist',2,'门内记述者','在终点核对初心','octogonal-eye','#b9b2d5','你带来的选择，会替你作答。',[
    gift('nexus_legacy','未焚的档案','T3 构造攻击 +40%、最大耐久 +30%；付费升阶费用 −25%。',{nexus_t3_attack:.4,nexus_t3_hp:.3,upgrade_discount:.25}),
    gift('nexus_reserve','空白频段','每场开战时，每 1 点空闲有效带宽转为 4 点火种屏障，上限 60；固定有效带宽 +4。',{nexus_reserve_shield:4,bandwidth:4}),
    gift('nexus_home','回声归所','每场胜利额外恢复 15 精神，所有存活构造恢复 35% 最大耐久；立即恢复 30 精神。',{nexus_post_heal:15,nexus_post_repair:.35},{heal:30})]),
  messenger('scarred_dawn',2,'残曦','替最后一线光作证','one-eyed','#e3aa83','把伤痕带过去，它也属于你。',[
    gift('nexus_last_stand','破晓誓约','每场每个近战首次受到普通敌人的致命攻击时保留 1 耐久；近战攻击 +60%、受到攻击伤害 −20%。',{melee_guard:1,melee_attack:.6,melee_reduction:.2}),
    gift('nexus_rebirth','余烬再生','每场首次将要损毁的启用构造保留 50% 最大耐久；所有构造最大耐久 +20%。',{nexus_rebirth:1,hp:.2}),
    gift('nexus_final_charge','最后的电荷','立即获得 220 专注；全体攻击 +35%、间隔缩短为原来的 1/1.2；最大精神稳定降低 25。',{attack:.35,haste:.2},{focus:220,maxSpirit:-25})])
].map(x=>[x.id,x]));
const additionalGifts={
 far_watcher:[
  gift('nexus_watchline','三角观测镜','直接攻击射程 +18%、对空伤害 +35%；构造最大耐久 −10%。',{direct_range:.18,anti_air_damage:.35,hp:-.1}),
  gift('nexus_floating_stairs','可携浮阶','地形费用 −50%、远程范围 +15%；付费升阶费用 +15%。',{terrain_discount:.5,ranged_range:.15,nexus_upgrade_tax:.15}),
  gift('nexus_target_notes','标靶手记','远程忽略 4 护甲；最高生命优先时，远程伤害 +30%；维修费用 +15%。',{high_hp_damage:.3,ranged_pierce:4,repair_discount:-.15})],
 oath_keeper:[
  gift('nexus_shared_burden','共同承重','近战最大耐久 +35%；支援覆盖内友军护甲 +3；立即获得 50 专注。',{melee_hp:.35,support_armor:3},{focus:50}),
  gift('nexus_rebuke','裂甲誓言','近战攻击 +35%、攻击忽略 20% 护甲；最大精神 −10。',{melee_attack:.35,armor_pierce:.2},{maxSpirit:-10}),
  gift('nexus_watch_rotation','轮值旗','最早部署的三个构造护甲 +6；搬迁费用 −75%、维修费用 −25%。',{priority_armor:6,move_discount:.75,repair_discount:.25})],
 seed_healer:[
  gift('nexus_patchwork','补缀披肩','最大精神 +20 并恢复 20；付费维修费用 −30%。',{repair_discount:.3},{maxSpirit:20}),
  gift('nexus_calm_pulse','静频脉搏','永久抗性 +2；每场开战获得 12 点火种屏障，胜利额外恢复 5 精神。',{resistance:2,nexus_shield:12,nexus_post_heal:5}),
  gift('nexus_suture','远程缝合针','维修量 +35%、支援范围 +40%；支援构造最大耐久 −15%。',{support_efficiency:.35,support_range:.4,support_hp:-.15})],
 archive_child:[
  gift('nexus_portable_archive','折叠档案匣','背包容量 +4（最多 20 格）；T1 构造最大耐久 +20%。',{nexus_t1_hp:.2},{capacity:4}),
  gift('nexus_study_credit','未来学分','每次提升深度额外 +1 带宽；付费升阶费用 −25%。',{level_bandwidth:1,upgrade_discount:.25}),
  gift('nexus_thrifty','旧件账本','维修、搬迁费用 −40%，付费升阶费用 −20%；立即获得 40 专注。',{repair_discount:.4,move_discount:.4,upgrade_discount:.2},{focus:40})],
 crystal_cartographer:[
  gift('nexus_crossfire','交叉山脊','二级及以上高地的远程伤害 +45%；近战最大耐久 −20%。',{highground_damage:.45,melee_hp:-.2}),
  gift('nexus_survey_wings','测绘翼','对空伤害 +45%、远程范围 +20%；地形改造费用 −40%。',{anti_air_damage:.45,ranged_range:.2,terrain_discount:.4}),
  gift('nexus_moving_terrace','迁徙高台','搬迁费用 −90%、维修费用 −50%；固定有效带宽 +4。',{move_discount:.9,repair_discount:.5,bandwidth:4})],
 chorus_weaver:[
  gift('nexus_harmonic_bridge','谐波桥','支援范围 +35%；支援覆盖内友军护甲 +5；远程攻击 −10%。',{support_range:.35,support_armor:5,ranged_attack:-.1}),
  gift('nexus_auxiliary_bus','辅助母线','固定有效带宽 +8；中继自身带宽占用 −1；抵消 2 点敌方干扰。',{bandwidth:8,relay_cost:1,jam_resist:2}),
  gift('nexus_resonant_workshop','共振工位','支援效果强度 +30%、维修量 +35%；付费升阶费用 +20%。',{support_power:.3,support_efficiency:.35,nexus_upgrade_tax:.2})],
 winter_listener:[
  gift('nexus_quiet_margin','静默余量','永久抗性 +4、火种每场屏障 +20；固定有效带宽 −3。',{resistance:4,nexus_shield:20,bandwidth:-3}),
  gift('nexus_distant_snow','远雪标记','直接攻击射程 +30%；12 格外的死亡压力 −40%；近战攻击 −15%。',{direct_range:.3,far_pressure:.4,melee_attack:-.15}),
  gift('nexus_slow_echo','缓声层','敌人出生减速 5 秒；处于减速状态的敌人死亡压力 −30%。',{nexus_spawn_slow:5,slow_pressure:.3})],
 pulse_diver:[
  gift('nexus_deep_reserve','深潮储备','损失最多 25 精神（至少保留 1），获得 180 专注；维修费用 −35%。',{repair_discount:.35},{spiritCost:25,focus:180}),
  gift('nexus_survival_pulse','求生频率','精神低于 35% 时，全体攻击 +55%、范围 +15%；每场屏障 +15。',{low_spirit_damage:.55,crisis_range:.15,nexus_shield:15}),
  gift('nexus_return_tide','回潮线','近战攻击 +45%、最大耐久 +30%；战斗胜利额外恢复 10 精神。',{melee_attack:.45,melee_hp:.3,nexus_post_heal:10})],
 star_judge:[
  gift('nexus_decree_breaker','破令准星','对首领伤害 +50%、对精英伤害 +50%；所有攻击忽略 25% 护甲。',{nexus_boss_damage:.5,nexus_elite_damage:.5,armor_pierce:.25}),
  gift('nexus_last_measure','终末刻度','远程忽略 12 护甲、最高生命优先时伤害 +35%；近战攻击 −20%。',{ranged_pierce:12,high_hp_damage:.35,melee_attack:-.2}),
  gift('nexus_signal_dam','断讯堤坝','每场火种屏障 +70、抗性 +2；固定有效带宽 −4。',{nexus_shield:70,resistance:2,bandwidth:-4})],
 foreign_voice:[
  gift('nexus_open_ensemble','开放合奏','同时启用三类构造时全体攻击 +55%；背包容量 +2（最多 20 格）。',{nexus_trinity:.55},{capacity:2}),
  gift('nexus_soloist','独奏席','部署存活构造不超过 8 个时攻击 +80%、护甲 +10；最大精神 −20。',{nexus_small_army:.8,nexus_small_armor:10},{maxSpirit:-20}),
  gift('nexus_first_notes','最初的音符','T1 攻击 +95%、最大耐久 +45%、带宽占用 −1；固定有效带宽 +5。',{nexus_t1_attack:.95,nexus_t1_hp:.45,t1_bandwidth:1,bandwidth:5})],
 gate_archivist:[
  gift('nexus_last_blueprint','终局蓝图','T3 攻击 +50%、最大耐久 +25%；立即获得 100 专注。',{nexus_t3_attack:.5,nexus_t3_hp:.25},{focus:100}),
  gift('nexus_unspent_signal','留白信号','每点开战空闲带宽转为 5 点火种屏障（上限 60），固定有效带宽 +6；最大精神 −15。',{nexus_reserve_shield:5,bandwidth:6},{maxSpirit:-15}),
  gift('nexus_archive_cart','档案运输车','背包容量 +4（最多 20 格）、固定有效带宽 +8；付费升阶费用 −30%。',{bandwidth:8,upgrade_discount:.3},{capacity:4})],
 scarred_dawn:[
  gift('nexus_daybreak_guard','曙光防壁','近战最大耐久 +70%、承伤 −25%；支援覆盖内友军护甲 +4。',{melee_hp:.7,melee_reduction:.25,support_armor:4}),
  gift('nexus_ember_return','余烬回响','每场首个将损毁的启用构造恢复至半耐久；胜利后存活构造修复 25%。',{nexus_rebirth:1,nexus_post_repair:.25}),
  gift('nexus_dawn_overclock','破晓超频','全体攻速 +30%、攻击 +25%，固定有效带宽 +6；最大精神 −20。',{haste:.3,attack:.25,bandwidth:6},{maxSpirit:-20})]
};
for(const [id,gifts]of Object.entries(additionalGifts))messengers[id].gifts.push(...gifts);
export const nexusRelics = Object.fromEntries(Object.values(messengers).flatMap(m=>m.gifts.map(g=>[g.id,{...g,messenger:m.id,theme:`心神枢纽 · ${m.name}`,art:m.art}])));
