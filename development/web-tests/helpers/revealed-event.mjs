import {previousEvents,towers,seededRandom,shuffle} from '../../../game/web/core/content.js';
// Recreate a previously revealed offer, preserving its older edition for save tests.
export function revealOldEvent(state,node,version=(state.difficultyRevision||1)>=5?1:0){
 const rng=seededRandom(`${state.seed}:service:${node.id}`),pick=list=>list[Math.floor(rng()*list.length)];
 node.eventData={id:node.event,designVersion:version,unit:pick(state.contentPool.towers),relic:pick(state.contentPool.relics.filter(id=>!state.relics.includes(id)))||null,targets:shuffle(state.units.map(u=>u.uid),rng),branch:rng()<.5?'A':'B'};
 if(version===1){node.eventData.rolls=previousEvents[node.event].choices.map((_,i)=>seededRandom(`${state.seed}:event-risk:${node.id}:${i}`)());node.eventData.unitsByRole=Object.fromEntries(['melee','ranged','support'].map(role=>[role,pick(state.contentPool.towers.filter(id=>towers[id].role===role))]));}
 return node;
}
