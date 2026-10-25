import {newRun,addUnit,enterNode} from './state.js';
import {startBattle} from './battle.js';
import {cellAt,placement} from './rules.js';

export const TUTORIAL_SEED='mindrealm-tutorial-0';
export const TUTORIAL_TARGETS=Object.freeze({
 melee:Object.freeze({uid:'u1',type:'anchor_bulwark',x:20,z:25,w:2,d:2}),
 ranged:Object.freeze({uid:'u2',type:'pulse_array',x:16,z:24,w:2,d:2}),
 terrain:Object.freeze({x:18,z:24,w:1,d:1}),
 core:Object.freeze({x:20,z:34,size:5}),
 entrance:Object.freeze({id:'north',name:'北入口',x:20,z:5}),
 battleId:'tutorial-battle',campId:'tutorial-camp'
});

const steps=['intro','deploy-melee','deploy-ranged','terrain','start','battle','reward','route','camp'];
const yes={ok:true},no=reason=>({ok:false,reason});
const unitFor=(state,key)=>state.units.find(unit=>unit.uid===TUTORIAL_TARGETS[key].uid);
const isDeployed=(state,key)=>{const unit=unitFor(state,key),target=TUTORIAL_TARGETS[key];return !!unit&&unit.hp>0&&unit.x===target.x&&unit.z===target.z;};
const terrainReady=state=>cellAt(state,TUTORIAL_TARGETS.terrain.x,TUTORIAL_TARGETS.terrain.z)?.h===1;

function tutorialTerrain(){
 const size=41,core={...TUTORIAL_TARGETS.core},entries=[{...TUTORIAL_TARGETS.entrance}];
 const cells=Array.from({length:size*size},(_,index)=>{
  const x=index%size,z=Math.floor(index/size);
  const plateau=x>=14&&x<=17&&z>=21&&z<=28;
  const shoulder=(x>=9&&x<=11||x>=28&&x<=30)&&z>=12&&z<=29;
  return {h:plateau||shoulder?1:0,ramp:-1,
   protected:Math.abs(x-core.x)<=2&&Math.abs(z-core.z)<=2||entries.some(entry=>Math.abs(x-entry.x)<=1&&Math.abs(z-entry.z)<=1)};
 });
 return {size,core,entries,cells,revision:0,generation:2,landform:'固定练习场'};
}

/** Every attempt starts from fresh in-memory data. The caller owns save isolation. */
export function createTutorialSession(){
 const state=newRun(TUTORIAL_SEED,0);
 state.terrain=tutorialTerrain();state.units=[];state.unitCounter=0;state.unitOrigins={};
 state.discoveries={towers:[],enemies:[],relics:[],talents:[],archives:[]};
 addUnit(state,'anchor_bulwark');addUnit(state,'pulse_array');
 state.spirit=72;state.focus=40;state.bandwidth=12;
 state.inventory.items=[];state.inventory.pity=0;
 state.nexus.forEach(room=>{room.skipped=true;});
 state.maps[0]={id:'tutorial-route',name:'引导练习 · 防线与补给',floors:2,boss:'noise_hive',nodes:[
  {id:TUTORIAL_TARGETS.battleId,floor:0,lane:2,type:'battle',name:'练习战斗',risk:'北入口 · 6 个静噪漂移体',reward:'构造三选一',map_icon_id:'battle',next:[TUTORIAL_TARGETS.campId],completed:false},
  {id:TUTORIAL_TARGETS.campId,floor:1,lane:2,type:'camp',name:'练习营地',risk:'安全区 · 选择一项服务',reward:'休息恢复精神稳定',map_icon_id:'camp',next:[],completed:false}
 ]};
 state.phase='map';state.nextNodes=[TUTORIAL_TARGETS.battleId];
 enterNode(state,TUTORIAL_TARGETS.battleId);
 return {state,session:{version:1,step:'intro',hasPaused:false,hasChangedSpeed:false}};
}

export function tutorialEncounter(state){
 const entry={...state.terrain.entries[0],count:6,groundCount:6,airCount:0};
 const queue=Array.from({length:6},(_,index)=>({type:'static_drifter',entry:entry.id,at:1+index*2.2,group:0}));
 return {queue,groups:[{index:0,at:1,count:6,entries:[entry.id],types:['static_drifter'],label:'练习敌群'}],
  entries:[entry],total:6,kind:'battle',reinforcementBudget:0,duration:queue.at(-1).at+2};
}

export function startTutorialBattle(state){
 if(!isDeployed(state,'melee')||!isDeployed(state,'ranged')||!terrainReady(state))return no('先按引导完成两座构造的部署与一格地形改造。');
 const result=startBattle(state);
 if(result.ok)Object.assign(state.battle,tutorialEncounter(state),{nextGroupIn:1});
 return result;
}

/** Progress follows successful game transactions, never clicks or previews alone. */
export function advanceTutorial(session,state,ctx={},action=''){
 if(!session||!state)return false;
 const before=JSON.stringify(session),signal=typeof action==='string'?action:action?.action;
 if(signal==='pause'&&ctx.paused)session.hasPaused=true;
 if(signal==='speed'&&ctx.speed>1)session.hasChangedSpeed=true;
 if(state.phase==='lost'&&session.step!=='done'){session.step='failed';return JSON.stringify(session)!==before;}
 if(session.step==='failed'||session.step==='done')return false;
 if(session.step==='intro'&&['next','tutorial-next'].includes(signal))session.step='deploy-melee';
 if(session.step==='deploy-melee'&&isDeployed(state,'melee'))session.step='deploy-ranged';
 if(session.step==='deploy-ranged'&&isDeployed(state,'ranged'))session.step='terrain';
 if(session.step==='terrain'&&terrainReady(state))session.step='start';
 if(session.step==='start'&&['battle','reward'].includes(state.phase))session.step='battle';
 if(session.step==='battle'&&['reward','map'].includes(state.phase))session.step='reward';
 if(session.step==='reward'&&state.phase==='map'&&!state.rewardQueue.length)session.step='route';
 if(session.step==='route'&&state.phase==='node'&&state.currentNode?.id===TUTORIAL_TARGETS.campId)session.step='camp';
 if(session.step==='camp'&&state.currentNode?.id===TUTORIAL_TARGETS.campId&&state.currentNode.completed)session.step='done';
 return JSON.stringify(session)!==before;
}

export function currentTutorialStep(session,state,ctx={}){
 const id=session?.step||'intro',index=steps.indexOf(id),base={id,index:index<0?steps.length:index,total:steps.length,canContinue:false};
 if(id==='intro')return {...base,title:'先认识你的防线',body:'保护南侧的醒觉火种。精神稳定耗尽时远征结束；专注用于改造和维护，带宽决定能同时部署多少构造。',hint:'这是一张固定练习地图，约 2 分钟。正式远征进度单独保留。',target:{selector:'.resources',label:'四项核心资源'},canContinue:true,buttonLabel:'开始练习'};
 if(id==='deploy-melee'||id==='deploy-ranged'){
  const key=id==='deploy-melee'?'melee':'ranged',target=TUTORIAL_TARGETS[key],selected=ctx.deployUid===target.uid;
  return {...base,title:key==='melee'?'把近战放到地面':'把远程放上高台',
   body:key==='melee'?'点击底部的“锚定壁垒”，再点击标记的地面格。它会吸引附近敌人，为后排争取攻击时间。':'点击底部的“脉冲针列”，再点击标记高台。远程构造部署在高地，高度还会增加射程。',
   hint:'首次部署免费；两座构造共占用 6 点带宽。也可以把卡片拖到标记处。',
   target:{selector:selected?null:`[data-action="select-unit"][data-uid="${target.uid}"]`,cell:target,label:key==='melee'?'地面部署点':'高台部署点'}};
 }
 if(id==='terrain'){
  const pending=!!ctx.terrainBatch,selector=ctx.toolTab!=='terrain'?'[data-action="tab-terrain"]':ctx.terrainTool!=='raise'?'[data-action="terrain-tool"][data-tool="raise"]':ctx.brush!=='single'?'[data-action="brush"]':pending?'[data-action="terrain-commit"]':null;
  return {...base,title:'花 5 专注扩一格高台',body:'在“地形改造”中使用升高、单格笔刷。点击高亮格，再点击“确认全部”并确认费用。',hint:pending?'草稿已经画好。确认后才会扣除专注；取消草稿可以重新选择。':'本场前 8 格次各花 5 专注。已部署构造、入口和火种所在的格子受到保护。',target:{selector,cell:TUTORIAL_TARGETS.terrain,label:pending?'等待确认':'升高这一格'}};
 }
 if(id==='start')return {...base,title:'准备好就开始战斗',body:'近战守住地面，远程在高台射击。点击“确认并开始战斗”，再确认一次。战斗中构造会自动攻击。',hint:'开始后部署和地形操作锁定；下一场战前可以继续调整。',target:{selector:'[data-action="start"]',label:'开始这波练习'}};
 if(id==='battle')return {...base,title:ctx.paused?'观察后继续战斗':'守住这一小波敌人',body:ctx.paused?'暂停时可以查看敌我状态。点击“继续战斗”或按空格，防线便会继续运作。':'只有北入口的 6 个敌人。观察高台射程与近战接敌；清理完这波敌人后会自动发放奖励。',hint:'空格可以暂停，1 / 2 / 3 切换倍速。现在可以试试 2×。',target:{selector:ctx.paused?'[data-action="pause"]':'[data-action="speed"][data-speed="2"]',label:ctx.paused?'继续战斗':'试试 2×'}};
 if(id==='reward')return {...base,title:'选择一座新构造',body:'战斗胜利后，从三座构造中选一座。新构造进入仓库，下一次战前才能部署。',hint:'收藏品与天赋也会在远征中强化整局构筑。先查看说明，再选择适合防线的奖励。',target:{selector:'[data-action="reward"]',label:'选择一份奖励'}};
 if(id==='route')return {...base,title:'沿连接选择下一节点',body:'地图上的亮点代表现在可以进入的位置。点击营地，体验一次战后的补给。',hint:'正式远征会出现分支：战斗、营地、商店和未知信号有各自的收益与风险。',target:{selector:`[data-action="map-node"][data-id="${TUTORIAL_TARGETS.campId}"]`,label:'前往练习营地'}};
 if(id==='camp')return {...base,title:'在营地恢复精神',body:'点击休息并确认，恢复 30% 最大精神稳定。营地只能选择一项服务，选好后就会离开。',hint:'正式远征也可以在营地免费维修或升阶一座构造。',target:{selector:'[data-action="camp-heal"]',label:'休息恢复精神'}};
 if(id==='failed')return {...base,title:'再练一次就好',body:'这次火种熄灭了。重新练习会还原固定地图、构造与资源，再按高亮位置布置防线。',hint:'正式远征进度单独保留。',canContinue:true,buttonLabel:'重新练习',failed:true};
 return {...base,title:'你已完成基础练习',body:'你已经完成部署、地形改造、战斗、领取奖励和营地补给。正式远征中，让近战、远程和支援互相配合，再沿路线不断成长。',hint:'现在可以回到主界面，开始自己的远征。',canContinue:true,buttonLabel:'完成教程',complete:true};
}

const navigationActions=new Set(['help','settings','back','menu','fullscreen','build','unit-info','clear-selection','toggle-footer','warehouse-tab','priority','tab-units','nexus-recap','enemy-info','enemy-intel','inspect-enemy','log','camera','encounter','codex','codex-tab','catalog-info','credits','motion-setting','resolution-setting','ui-scale','volume','tutorial-setting']);
export function tutorialActionAllowed(session,state,action,payload={}){
 if(!session)return yes;
 if(navigationActions.has(action)||action.startsWith('tutorial-'))return yes;
 const step=session.step,key=step==='deploy-melee'?'melee':step==='deploy-ranged'?'ranged':null;
 if(key){
  const target=TUTORIAL_TARGETS[key];
  if(action==='select-unit')return payload.uid===target.uid?yes:no(`先选择${key==='melee'?'锚定壁垒':'脉冲针列'}，完成当前部署练习。`);
  if(action==='cell'){
   const cell=payload.cell||payload,unit=payload.unit;
   if(unit?.uid!==target.uid)return no('先点击底部高亮的构造卡片。');
   if(cell.x!==target.x||cell.z!==target.z)return no('请点击带有教程标记的部署格。');
   return placement(state,unit,cell.x,cell.z);
  }
 }
 if(step==='terrain'){
  if(action==='tab-terrain'||['terrain-commit','terrain-cancel','undo'].includes(action))return yes;
  if(action==='terrain-tool')return payload.tool==='raise'?yes:no('这一步练习升高地形，请选择“升高”。');
  if(action==='brush')return (payload.value||payload.brush)==='single'?yes:no('这一步只改造一格，请使用“单格”笔刷。');
  if(action==='cell'){
   const cell=payload.cell||payload,target=TUTORIAL_TARGETS.terrain;
   return cell.x===target.x&&cell.z===target.z&&payload.terrainTool==='raise'?yes:no('使用升高工具，点击高亮的一格。');
  }
 }
 if(step==='start'&&action==='start')return yes;
 if(step==='battle'&&['pause','speed','toggle-threat','enemy-queue'].includes(action))return yes;
 if(step==='reward'&&action==='reward')return yes;
 if(step==='route'&&['map-node','enter'].includes(action))return payload.id===TUTORIAL_TARGETS.campId?yes:no('先进入高亮的练习营地。');
 if(step==='camp'&&action==='camp-heal')return yes;
 return no(step==='intro'?'先阅读简短说明，再点击“开始练习”。':step==='failed'?'点击“重新练习”还原这张固定地图。':'先完成右侧引导中的当前操作。');
}
