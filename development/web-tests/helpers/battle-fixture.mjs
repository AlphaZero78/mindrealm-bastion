import {unblessedRun as newRun} from './unblessed-run.mjs';
import {addUnit,enterNode,availableNodes} from '../../../game/web/core/state.js';
import {startBattle,stepBattle} from '../../../game/web/core/battle.js';
import {unitStats,footprint} from '../../../game/web/core/rules.js';

// Test-only in-memory fixtures. No browser storage or player profile is accessed.
export function fixture(seed='rules-fixture',{flat=true,revision=2}={}) {
  const state=newRun(seed);state.difficultyRevision=revision;enterNode(state,availableNodes(state)[0].id);state.units=[];
  // Legacy combat fixtures deliberately keep their historical coordinates.
  // Revision 4 terrain and route behavior have dedicated generated-world tests.
  if(revision<4){state.terrain.generation=1;state.terrain.core={x:20,z:24,size:5};state.terrain.entries=[{id:'north',x:20,z:0},{id:'west',x:0,z:24},{id:'east',x:40,z:24},{id:'south',x:20,z:40}];for(let i=0;i<state.terrain.cells.length;i++){const x=i%41,z=Math.floor(i/41);state.terrain.cells[i].protected=Math.abs(x-20)<=2&&Math.abs(z-24)<=2||state.terrain.entries.some(e=>Math.abs(e.x-x)<=1&&Math.abs(e.z-z)<=1);}}
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
