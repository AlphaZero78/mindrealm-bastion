import {unblessedRun as newRun} from './unblessed-run.mjs';
import {addUnit,enterNode,availableNodes} from '../../../web/core/state.js';
import {startBattle,stepBattle} from '../../../web/core/battle.js';
import {unitStats,footprint} from '../../../web/core/rules.js';

// Test-only in-memory fixtures. No browser storage or player profile is accessed.
export function fixture(seed='rules-fixture',{flat=true,revision=2}={}) {
  const state=newRun(seed);state.difficultyRevision=revision;enterNode(state,availableNodes(state)[0].id);state.units=[];
  if(flat)for(const cell of state.terrain.cells){cell.h=0;cell.ramp=-1;}state.terrain.revision++;
  return state;
}
export function place(state,type,x,z,{tier=1,branch=null,h=0,hp=null}={}) {
  const unit=addUnit(state,type,tier,branch);unit.x=x;unit.z=z;unit.everDeployed=true;unit.order=state.units.length;
  for(const p of footprint(state,unit))state.terrain.cells[p.z*41+p.x].h=h;
  state.terrain.revision++;unit.hp=hp??unitStats(state,unit).hp;return unit;
}
export function battle(state,types=['static_drifter']) {
  startBattle(state);state.battle.queue=types.map(type=>({type,entry:'north',at:0,group:0}));
  state.battle.reinforcementBudget=Math.floor(types.length*.1);state.battle.groups=[{index:0,at:0}];
  stepBattle(state,.001);return state.battle.enemies;
}
export function tick(state,seconds,dt=.05) {
  for(let n=0;n<Math.ceil(seconds/dt)&&!state.battle.result;n++)stepBattle(state,dt);
  return state.battle.result;
}
