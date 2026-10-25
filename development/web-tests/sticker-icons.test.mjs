import test from 'node:test';
import assert from 'node:assert/strict';
import {relics,talents,messengers} from '../../game/web/core/content.js';
import {items} from '../../game/web/core/item-content.js';
import {CONTENT_STICKERS,UI_STICKERS,contentIcon,stickerIcon} from '../../game/web/view/sticker-icons.js';
import {icon} from '../../game/web/ui.js';

const catalogs={relics,talents,items,messengers};
test('every collectible, talent, item and messenger has an explicit filled sticker',()=>{
 for(const [kind,catalog] of Object.entries(catalogs)){
  assert.deepEqual(Object.keys(CONTENT_STICKERS[kind]).sort(),Object.keys(catalog).sort(),kind);
  for(const id of Object.keys(catalog)){
   const svg=contentIcon(kind,id),recipe=CONTENT_STICKERS[kind][id];
   assert.ok(recipe.motif&&recipe.palette&&recipe.badge,`${kind}/${id}`);
   assert.match(svg,new RegExp(`data-sticker-key="${kind}:${id}"`));
   assert.match(svg,/viewBox="0 0 48 48"/);
   assert.match(svg,/<g class="sticker-object">/);
   assert.match(svg,/fill="#[a-fA-F0-9]{6}" stroke="#fff4f0" stroke-width="3.2"/,'filled silhouette and sticker border');
   assert.ok((svg.match(/fill="#/g)||[]).length>=5,'separate solid body, facets and accent');
   assert.ok(svg.length<4200,'small SVG budget per catalog icon');
   assert.doesNotMatch(svg,/\b(?:undefined|NaN)\b|<filter|<image|<script|<animate|url\(|href=|\sid=/i,'icons have no external data, animation or shared definition ids');
  }
 }
});

test('content recipes distinguish items by semantic shapes and companion symbols',()=>{
 const recipes=Object.values(CONTENT_STICKERS).flatMap(Object.values);
 const signatures=recipes.map(x=>`${x.motif}/${x.palette}/${x.badge}`);
 assert.equal(new Set(signatures).size,recipes.length,'every content sticker has a distinct authored recipe');
 assert.ok(new Set(recipes.map(x=>x.motif)).size>=40,'catalog art uses varied silhouettes');
 assert.ok(new Set(recipes.map(x=>`${x.motif}/${x.badge}`)).size>=130,'variation is not limited to color');
 const art=Object.entries(CONTENT_STICKERS).flatMap(([kind,entries])=>Object.keys(entries).map(id=>contentIcon(kind,id).replace(/data-sticker-key="[^"]+"/,'')));
 assert.equal(new Set(art).size,art.length,'different catalog entries produce different art');
});

test('the existing icon API is filled, safe and compatible with the shipped UI names',()=>{
 const legacy=['heart','repair','snow','attack','resistance','burst','armor','battle','elite','boss','camp','workshop','shop','treasure','event','unknown','spirit','focus','bandwidth','depth','map','settings','book','play','pause','close','check','arrow','lock','shield','ranged','melee','support','undo','raise','lower','ramp','flatten','sound'];
 for(const name of legacy){assert.ok(Object.hasOwn(UI_STICKERS,name),name);assert.equal(icon(name),stickerIcon(name));assert.match(icon(name),/class="icon sticker-icon /);}
 assert.equal(contentIcon('relic','elevated_lens'),contentIcon('relics','elevated_lens'));
 assert.equal(contentIcon('__proto__','constructor'),icon('unknown'));
 assert.equal(icon('__proto__'),icon('unknown'));
 assert.doesNotMatch(icon('focus','" onload="alert(1)'),/onload=|alert\(/);
 assert.match(contentIcon('items','clarity','item-sticker sticker-inline'),/class="icon sticker-icon item-sticker sticker-inline"/);
 assert.equal(contentIcon('talents','height_mastery'),contentIcon('talents','height_mastery'),'rendering is stable across calls');
});
