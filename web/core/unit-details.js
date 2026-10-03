import {towers} from './content.js';
import {unitStats} from './rules.js';
import {difficultyProfile} from './difficulty.js';

// Descriptions explain the current stage; numeric growth is a before/after table.
export function unitEffectText(state,unit){
  const base=towers[unit.type],s=unitStats(state,unit),parts=[base.description];
  if(unit.tier>1&&unit.branch)parts.push(base.branches[unit.branch].description);
  const fmt=value=>Number(value.toFixed(2));
  if(s.effect==='guard')parts.push(`当前分支额外护甲 +${5*unit.tier}。`);
  if(s.ability==='bandwidth_plus')parts.push(difficultyProfile(state).revision>=3?`额定带宽 +${Math.round(s.support_value)}。启用中继按额定供给排序，前三座分别提供 100% / 60% / 40%（向下取整），其余作为备份；失效后自动递补。`:`当前全局带宽 +${Math.round(s.support_value)}。`);
  if(s.ability==='resistance_plus')parts.push(`当前全局抗性 +${fmt(s.support_value)}。`);
  if(s.ability==='repair')parts.push(`每 ${fmt(s.rate)} 秒维修 ${fmt(s.attack)} 耐久；作用半径 ${fmt(s.range)} 格。`);
  if(s.ability==='haste_aura'){const haste=s.support_value+(s.effect==='strong_haste'?.12:0);parts.push(`范围内友军攻击频率 +${fmt(haste*100)}%，伤害 +${fmt(haste*50)}%。`);}
  return parts.join(' ');
}
