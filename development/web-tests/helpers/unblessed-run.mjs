import {newRun} from '../../../game/web/core/state.js';

// Rule-isolation fixture: no messenger gift modifies the mechanic under test.
// Real opening, all three rooms and gift effects are covered in nexus.test.mjs.
export function unblessedRun(...args){
 const state=newRun(...args);
 for(const room of state.nexus)room.skipped=true;
 state.phase='map';
 return state;
}
