import {unitStats,unitAuras,ruleEffects} from './rules.js';
import {difficultyProfile,CURRENT_DIFFICULTY_REVISION} from './difficulty.js';
import {hasUnitEffect} from './tower-progression.js';

const number=value=>Number(value.toFixed(2));
const neutralState={difficultyRevision:CURRENT_DIFFICULTY_REVISION,spirit:100,maxSpirit:100,units:[],relics:[],talents:[],modifiers:{},terrain:{size:41,cells:[]}};
export function unitEffectLines(state,unit){
 state||=neutralState;const s=unitStats(state,unit),m=ruleEffects(state),auras=unitAuras(state,unit),parts=[],current=difficultyProfile(state).revision>=5;
 const add=(id,text)=>parts.push({id,text});
 if(s.attack_kind!=='support')add('target',s.ability==='drone'?'追踪无人机 · 对地 / 对空 · 越过地形':s.attack_kind==='indirect'?'间接攻击 · 对地 · 越过地形':s.role==='melee'?'近战 · 对地':`直接射击 · ${s.targets==='all'?'对地 / 对空':'对地'}`);
 if(s.ability==='taunt')add('taunt','嘲讽攻击范围内的敌人');
 if(s.ability==='lifesteal')add('lifesteal',`吸血 ${hasUnitEffect(s,'lifesteal_plus')?22:10}%`);
 if(s.ability==='siege_resist')add('siege','受到的攻城伤害 −45%');
 if(s.ability==='high_hp_priority')add('priority','默认优先最高生命目标');
 if(s.ability==='splash')add('splash',`爆炸半径 ${number((hasUnitEffect(s,'large_splash')?3.4:2.3)*(1+(m.indirect_radius||0)))} 格；溅射伤害 65%；${hasUnitEffect(s,'large_splash')?`主目标减速 ${number(2.5*difficultyProfile(state).controlDurationMultiplier)} 秒，` : ''}溅射减速 ${number(1.2*difficultyProfile(state).controlDurationMultiplier)} 秒`);
 for(const a of auras){
  if(a.id==='guard')add('guard',`${a.radius} 格内其他友军减伤 ${number(a.reduction*100)}%，同类不叠加`);
  if(a.id==='pressure')add('pressure',`${number(a.radius)} 格内敌人死亡压力 −${number(a.reduction*100)}%${current?'；同类取最强':''}`);
  if(a.id==='haste')add('haste',`范围内友军攻速 +${number(a.haste*100)}%，攻击力 +${number(a.damage*100)}%${current?'；同类取最强':''}`);
  if(a.id==='repair')add('repair',`每 ${number(a.interval)} 秒维修 ${number(a.amount)} 耐久，优先缺损最多的存活友军`);
  if(a.id==='slow')add('slow',`范围内敌人移速 −${number(a.slow*100)}%`);
  if(a.id==='bandwidth')add('bandwidth',`额定全局带宽 +${a.value}${current?'；战场限 1 座中继（所有阶级共用）':difficultyProfile(state).revision>=3?'；前三座按 100% / 60% / 40% 供给':''}`);
  if(a.id==='resistance')add('resistance',`全局抗性 +${number(a.value)}${current?'；同类取最强':''}`);
  if(a.id==='regeneration')add('regeneration',`${number(a.radius)} 格内其他启用的友军每秒恢复 ${number(a.recovery*100)}% 最大耐久；同类取最强`);
  if(a.id==='armor')add('armor_aura',`${number(a.radius)} 格内其他友军护甲 +${a.armor}；同类护甲光环取最强`);
  if(a.id==='network')add('network',`支援覆盖内友军${a.armor?`护甲 +${number(a.armor)}`:''}${a.armor&&a.rate?'，':''}${a.rate?`攻击间隔 −${number(a.rate*100)}%`:''}`);
 }
 const extras={counter:'受击反击：攻击力 ×65%，无视护甲',guard:`分支护甲 +${5*(unit.tier||1)}`,armor_break:'命中削减 2 护甲，最低 0',self_repair:'4 秒未受击后，每秒修复 2.5% 最大耐久',root:`命中定身 ${number(.65*difficultyProfile(state).controlDurationMultiplier)} 秒`,chain:'连锁 3.5 格内另一目标，伤害 60%',anti_air:'对空伤害 +80%',pierce:'忽略 60% 护甲；贯穿目标承受 65% 伤害',execute:'目标生命低于 30% 时，伤害 +65%',corrosion:'爆炸命中削减 2 护甲，最低 0',extra_drone:'每轮追加一架无人机攻击另一目标，伤害 60%',mark:'标记 4 秒：目标后续承伤 +15%',jam_resist:'抵消 3 点带宽干扰，同类不叠加',jam_immunity:'启用时屏蔽全部带宽干扰；损坏或停机后失效',critical_repair:'目标耐久低于 35% 时，维修量 +60%',armor_repair:'维修后护甲 +3，持续 3 秒',repair_shield:'维修后获得 18% 减伤，持续 3 秒；与同类减伤取最强',repair_link:'每次维修额外修复第二名受损友军，数值为本次维修的 60%'};
 for(const effect of s.effects||[s.effect])if(extras[effect])add(effect,extras[effect]);
 if(s.evolution)add('evolution',`T3 特性：${s.evolution.name}`);
 return parts;
}
export function unitEffectText(state,unit){return unitEffectLines(state,unit).map(p=>p.text).join('；')+'。';}
