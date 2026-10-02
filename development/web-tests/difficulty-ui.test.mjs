import test from 'node:test';
import assert from 'node:assert/strict';
import {newRun,enterNode} from '../../web/core/state.js';
import {acts,enemies} from '../../web/core/content.js';
import {difficultyProfile,difficultySummary,enemyStats,enemyAbilityProfile} from '../../web/core/difficulty.js';
import {pressureOptions,pressurePreviewLevels,difficultyDetails,enemyDetails,bossIntel,nodeScreen,summaryScreen,menu} from '../../web/screens.js';
import {n,escapeHTML} from '../../web/ui.js';

test('all eleven pressures stay visible and locked levels remain previewable without being selectable',()=>{
  for(const unlocked of [0,4,10]){
    const options=[...pressureOptions(unlocked).matchAll(/<option value="(\d+)"([^>]*)>([^<]+)<\/option>/g)];
    assert.equal(options.length,11);
    for(const [,level,attributes,label]of options){assert.equal(attributes.includes('disabled'),Number(level)>unlocked);assert.match(label,Number(level)>unlocked?/未解锁/:/已解锁/);}
    const preview=pressurePreviewLevels(unlocked);assert.equal((preview.match(/data-pressure-preview=/g)||[]).length,11);
    assert.equal(preview.includes('disabled'),false);assert.match(preview,/不会修改本次选择/);
    assert.ok(preview.includes(escapeHTML(difficultySummary(10).join('\n'))));
  }
});

test('difficulty summaries use the selected revision and distinguish locked-level previews from the actual selection',()=>{
  const current=newRun('difficulty-ui',10),legacy={...current};delete legacy.difficultyRevision;
  for(const state of [current,legacy]){const html=difficultyDetails(state);for(const line of difficultySummary(state))assert.ok(html.includes(escapeHTML(line)));assert.equal(html.includes('沿用旧规则'),difficultyProfile(state).legacy);}
  assert.match(difficultyDetails(10,true),/效果预览/);assert.doesNotMatch(difficultyDetails(10,true),/本次累计生效/);
  assert.match(difficultyDetails(10),/本次累计生效/);
});

test('camp and shop UI follow current and legacy service rules at pressure ten',()=>{
  for(const legacy of [false,true])for(const type of ['camp','shop']){
    const state=newRun(`difficulty-${type}`,10);if(legacy)delete state.difficultyRevision;
    const node=state.maps[0].nodes.find(node=>node.type===type);state.nextNodes=[node.id];enterNode(state,node.id);state.spirit=1;
    const html=nodeScreen(state);
    if(type==='camp')assert.match(html,legacy?/恢复最大值的 20%/:/恢复最大值的 30%/);
    else{assert.match(html,legacy?/92 专注/:/80 专注/);assert.match(html,legacy?/138 专注/:/120 专注/);}
  }
});

test('encounter details display actual floor, pressure and all boss phase values while codex stays explicitly basic',()=>{
  for(const revision of [1,2])for(const id of ['static_drifter','memory_reforger','chorus_overseer','bandwidth_requisitioner','mirror_censor']){
    const state=newRun('enemy-details',10);state.difficultyRevision=revision;state.act=2;state.floor=13;state.modifiers.pressure_mult=.15;
    const spec=enemies[id],actual=enemyStats(state,spec),html=enemyDetails(state,spec);
    for(const [title,value]of [['生命上限',actual.hp],['攻击',actual.attack],['护甲',actual.armor],['死亡原始压力',actual.pressure],['突破伤害',actual.core_damage],['移动速度',actual.speed]])assert.ok(html.includes(`${title} ${n(value)}`));
    if(spec.kind==='boss'){
      const phases=[0,1,2].map(phase=>enemyAbilityProfile(state,actual,phase));assert.ok(html.includes(phases.map(p=>n(p.cycle)).join(' / ')));
      for(const key of ['healAmount','shieldAmount','jamDuration'])if(phases.some(p=>p[key]))assert.ok(html.includes(phases.map(p=>n(p[key])).join(' / ')));
      assert.equal(html.includes('额外频震：'),difficultyProfile(state).surge.enabled);
    }
    const catalog=enemyDetails(null,spec);assert.match(catalog,/图鉴基础数值 · 未计入幕、层与控制压力/);assert.ok(catalog.includes(`基础生命 ${n(spec.hp)}`));assert.doesNotMatch(catalog,/本场实际数值/);
  }
});

test('boss intel reveals progressively and forecasts the boss floor rather than the preceding camp floor',()=>{
  const state=newRun('boss-intel',10);state.act=1;state.floor=14;const boss=enemies[state.maps[1].boss];
  state.bossReveal=1;assert.equal(bossIntel(state).includes(boss.name),false);
  state.bossReveal=2;assert.ok(bossIntel(state).includes(boss.name));assert.equal(bossIntel(state).includes('首领战预计'),false);
  state.bossReveal=3;const intel=bossIntel(state),actual=enemyStats({...state,floor:acts[state.act].floors-1},boss);
  assert.ok(intel.includes(`生命 ${n(actual.hp)}`));assert.match(intel,/data-boss-preview="true"/);assert.match(intel,/查看完整首领情报/);
});

test('menu and results distinguish the played pressure, retained unlock ceiling and next victory unlock',()=>{
  assert.match(menu(false,{unlockedPressure:7}),/已解锁最高压力 7\/10/);
  const state=newRun('result-pressure',4);state.phase='won';state.act=2;state.floor=14;
  const won=summaryScreen(state,{unlockedPressure:8});assert.match(won,/控制压力 4/);assert.match(won,/已解锁最高压力 8\/10/);assert.match(won,/压力 5 已开放/);
  state.phase='lost';const lost=summaryScreen(state,{unlockedPressure:8});assert.match(lost,/通关压力 4 后可解锁压力 5/);assert.doesNotMatch(lost,/压力 5 已开放/);
  state.pressureLevel=10;state.phase='won';assert.match(summaryScreen(state,{unlockedPressure:10}),/已完成最高控制压力 10/);
});
