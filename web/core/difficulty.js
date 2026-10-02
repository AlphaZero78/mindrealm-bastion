export const CURRENT_DIFFICULTY_REVISION=2;
const healthCurve=[1,1.10,1.22,1.36,1.53,1.73,1.96,2.22,2.51,2.84,3.2];
const bound=(value,min,max)=>Math.max(min,Math.min(max,value));

// A numeric argument describes a new run. Old saves deliberately retain their
// revision until the run ends; opening them never silently changes the rules.
export function normalizeDifficulty(value) {
  const level=typeof value==='object'&&value!==null?value.pressureLevel:value;
  return Number.isFinite(level)?bound(Math.floor(level),0,10):0;
}
export function difficultyProfile(value=0) {
  const level=normalizeDifficulty(value),legacy=typeof value==='object'&&value!==null&&value.difficultyRevision!==CURRENT_DIFFICULTY_REVISION;
  return {
    revision:legacy?1:CURRENT_DIFFICULTY_REVISION,level,legacy,
    hpMultiplier:legacy?(level>=1?1.1:1)*(level>=10?1.1:1):healthCurve[level],
    attackMultiplier:legacy?(level>=2?1.1:1)*(level>=10?1.1:1):1+.09*level,
    speedMultiplier:legacy?1:1+.016*level,
    breachMultiplier:legacy?1:1+.065*level,
    pressureMultiplier:legacy?(level>=6?1.15:1)*(level>=10?1.1:1):1+.06*level,
    armorBonus:legacy?0:Math.floor(level/3),
    abilityIntervalMultiplier:legacy?1:1-.02*level,
    bossIntervalMultiplier:legacy&&level>=9?.8:1,
    controlDurationMultiplier:legacy?1:1-Math.max(0,level-5)*.05,
    jamBonus:legacy&&level>=8?2:0,
    earlyEnemyAct:legacy&&level>=3?1:0,
    functionalDensity:legacy&&level>=4?.5:.25,
    serviceMultiplier:legacy&&level>=7?1.15:1,
    campHeal:legacy&&level>=5?.2:.3,
    surge:{enabled:!legacy&&level>=8,interval:12,warning:1.5,range:8,maxTargets:2,attackFraction:.55}
  };
}

export function enemyStats(state,spec) {
  const p=difficultyProfile(state),scale=1+(state.act||0)*.08+(state.floor||0)*.015;
  const baseHp=spec.hp*scale,maxHp=baseHp*p.hpMultiplier;
  return {...spec,baseHp,maxHp,hp:maxHp,
    supportHp:spec.kind==='boss'&&!p.legacy?baseHp*Math.sqrt(p.hpMultiplier):maxHp,
    attack:spec.attack*p.attackMultiplier,
    pressure:spec.pressure*p.pressureMultiplier*(1+(state.modifiers?.pressure_mult||0)),
    speed:spec.speed*1.5*p.speedMultiplier,
    armor:spec.armor+p.armorBonus,
    core_damage:spec.core_damage*p.breachMultiplier
  };
}

// Used for every source of boss healing/shielding, including ordinary support
// enemies, so a healer cannot bypass the cap by targeting a strengthened boss.
export function enemyRecoveryBase(state,enemy) {
  const p=difficultyProfile(state),maxHp=enemy.maxHp??enemyStats(state,enemy).maxHp;
  return enemy.kind==='boss'&&!p.legacy?maxHp/Math.sqrt(p.hpMultiplier):maxHp;
}
export function enemyAbilityProfile(state,spec,phase=spec.phase||0) {
  const p=difficultyProfile(state),boss=spec.kind==='boss',stage=bound(Math.floor(phase)||0,0,2);
  const cycle=(boss?6.5-stage*.8:7.5)*(boss?p.bossIntervalMultiplier:p.abilityIntervalMultiplier);
  const healFraction=spec.ability==='heal'?(boss?.07+stage*.015:.09):0;
  const shieldFraction=spec.ability==='group_shield'?(boss?.18:.12):spec.ability==='shield'?.15:boss&&spec.type==='mirror_censor'&&stage>=1?.025:boss&&spec.id==='mirror_censor'&&stage>=1?.025:0;
  const recoveryBase=enemyRecoveryBase(state,spec);
  const rawJamDuration=spec.ability==='jam'?(boss?5:3):boss&&['chorus_overseer'].includes(spec.type||spec.id)&&stage>=1?2:0;
  return {cycle,warning:1.1,healFraction,healAmount:recoveryBase*healFraction,
    shieldFraction,shieldAmount:recoveryBase*shieldFraction,
    jamDuration:p.legacy?rawJamDuration:Math.min(rawJamDuration,Math.max(0,cycle-1.1)),
    jamStrength:rawJamDuration?(spec.ability==='jam'&&boss?6+stage*2:boss?6:2):0,
    surge:{...p.surge,enabled:boss&&p.surge.enabled}
  };
}

export function difficultySummary(value=0) {
  const p=difficultyProfile(value),percent=n=>`${Math.round((n-1)*100)}%`;
  if(p.legacy){
    const lines=['旧版控制压力规则：本局按原难度继续。'];
    if(p.level>=1)lines.push(`敌人生命提高 ${percent(p.hpMultiplier)}。`);
    if(p.level>=2)lines.push(`敌人攻击提高 ${percent(p.attackMultiplier)}。`);
    if(p.level>=3)lines.push('后续幕敌人提前出现。');
    if(p.level>=4)lines.push('功能敌人槽位约占一半。');
    if(p.level>=5)lines.push('营地精神恢复为最大值的 20%。');
    if(p.level>=6)lines.push(`死亡压力提高 ${percent(p.pressureMultiplier)}。`);
    if(p.level>=7)lines.push('商店、维修和升级费用提高 15%。');
    if(p.level>=8)lines.push('存在带宽干扰时，额外降低 2 带宽。');
    if(p.level>=9)lines.push('首领能力间隔缩短 20%。');
    if(p.level===0)lines.push('标准敌人强度。');
    return lines;
  }
  const lines=[p.level===0?'标准：基础敌人强度。':`敌人生命提高 ${percent(p.hpMultiplier)}，攻击提高 ${percent(p.attackMultiplier)}，速度提高 ${percent(p.speedMultiplier)}。`,
    '相同种子的敌人编队、数量、出场间隔和击杀奖励保持一致；营地恢复 30%，服务价格不增加。'];
  if(p.level>0)lines.push(`突破伤害提高 ${percent(p.breachMultiplier)}，死亡压力提高 ${percent(p.pressureMultiplier)}；护甲增加 ${p.armorBonus}，普通与精英能力间隔缩短 ${Math.round((1-p.abilityIntervalMultiplier)*100)}%。`);
  if(p.controlDurationMultiplier<1)lines.push(`敌人承受的减速与定身时间缩短 ${Math.round((1-p.controlDurationMultiplier)*100)}%；高地保护保持有效。`);
  lines.push(`首领受到的治疗与护盾${p.level===0?'保持基础数值':`提高 ${percent(Math.sqrt(p.hpMultiplier))}`}；带宽征用后至少留下 1.1 秒恢复窗口。`);
  if(p.surge.enabled)lines.push('首领每 12 秒准备频震：预警 1.5 秒后，对 8 格内最多 2 座构造造成 55% 攻击力伤害；嘲讽优先，护甲与高地保护生效。');
  return lines;
}
