import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {relics,talents,messengers} from '../../game/web/core/content.js';
import {items} from '../../game/web/core/item-content.js';
import {CONTENT_STICKERS,UI_STICKERS,contentIcon,stickerIcon} from '../../game/web/view/sticker-icons.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=process.argv[2]&&resolve(process.argv[2]);
if(!output)throw Error('Pass an external preview output directory.');
const rel=relative(root,output);
if(!rel||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..\\')&&!rel.startsWith('../')))throw Error('Preview output belongs outside the repository.');
await mkdir(output,{recursive:true});
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const css=await readFile(join(root,'game/web/sticker-style.css'),'utf8');
const document=body=>`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>心域防线 · 彩色贴纸图标</title><style>${css}
*{box-sizing:border-box}body{margin:0;width:1200px;padding:20px 24px;color:#eef2ff;background:#111a30;font:12px/1.4 system-ui,'Microsoft YaHei',sans-serif}h1{font-size:20px;margin:0 0 4px}header p{color:#b8c9e7;margin:0 0 14px}h2{font-size:13px;letter-spacing:.08em;margin:12px 0 5px;color:#d5c3ff}.grid{display:grid;grid-template-columns:repeat(14,1fr);gap:2px}.tile{height:68px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:1px solid #ffffff0b;border-radius:8px;background:linear-gradient(140deg,#26314a65,#27304530)}.tile svg{width:44px;height:44px}.tile span{max-width:100%;font-size:9px;white-space:nowrap;text-align:center;color:#dde5f5}.tile .ui-name{font-size:9px}</style><header><h1>心域防线 · 彩色贴纸图标</h1><p>实心轮廓 · 奶油白边 · 冷暖高光 · 语义辅件</p></header>${body}</html>`;
const catalogs={relics,talents,items,messengers},names={relics:'收藏品',talents:'天赋',items:'道具',messengers:'精神使者'};
const content=Object.entries(catalogs).map(([kind,catalog])=>`<section><h2>${names[kind]} / ${Object.keys(catalog).length}</h2><div class="grid">${Object.entries(catalog).map(([id,item])=>`<div class="tile" title="${escape(id)}">${contentIcon(kind,id)}<span>${escape(item.name)}</span></div>`).join('')}</div></section>`).join('');
const ui=`<section><h2>资源与操作 / ${Object.keys(UI_STICKERS).length}</h2><div class="grid">${Object.keys(UI_STICKERS).map(name=>`<div class="tile">${stickerIcon(name)}<span class="ui-name">${name}</span></div>`).join('')}</div></section>`;
const files=[join(output,'stickers-content.html'),join(output,'stickers-ui.html')];
await Promise.all([writeFile(files[0],document(content)),writeFile(files[1],document(ui))]);
console.log(JSON.stringify({files,counts:Object.fromEntries(Object.entries(CONTENT_STICKERS).map(([kind,list])=>[kind,Object.keys(list).length])),ui:Object.keys(UI_STICKERS).length}));
