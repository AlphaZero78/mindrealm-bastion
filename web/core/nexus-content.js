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
export const nexusRelics = Object.fromEntries(Object.values(messengers).flatMap(m=>m.gifts.map(g=>[g.id,{...g,messenger:m.id,theme:`心神枢纽 · ${m.name}`,art:m.art}])));
