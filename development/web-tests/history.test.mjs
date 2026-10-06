import test from 'node:test';
import assert from 'node:assert/strict';
import {historyLabel} from '../../game/web/ui.js';
import {newRun} from '../../game/web/core/state.js';
import {summaryScreen} from '../../game/web/screens.js';

test('failure history renders timed breaches alongside route choices without NaN or undefined',()=>{
 const route={act:0,floor:1,text:'进入营地'},breach={type:'breach',enemy:'噪声游体',time:38.25};
 assert.equal(historyLabel(route),'1-2 进入营地');
 assert.match(historyLabel(breach),/^战斗 38\.\d+ 秒 · 噪声游体突破$/);
 assert.equal(historyLabel({type:'breach',enemy:'干扰者'}),'战斗 · 干扰者突破');
 const state=newRun('HISTORY-UI');state.phase='lost';state.spirit=0;state.stats.history.push(route,breach);
 const html=summaryScreen(state);
 assert.match(html,/1-2 进入营地/);assert.match(html,/噪声游体突破/);
 assert.doesNotMatch(html,/NaN|undefined/);
});
