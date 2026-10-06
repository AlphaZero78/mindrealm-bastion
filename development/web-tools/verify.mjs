import {readFile,stat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {towers,enemies,relics,talents,events} from '../../game/web/core/content.js';
import {AUDIO_FILES} from '../../game/web/view/audio.js';
import {ENTITY_ART} from '../../game/web/view/entity-art.js';
import {runtimeAssetPaths} from './refresh-asset-manifest.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const required=['web/index.html','web/app.js','web/screens.js','web/style.css','web/ui.js','web/favicon.svg','web/core/state.js','web/core/content.js','web/core/rules.js','web/core/battle.js','web/core/save.js','web/view/battlefield.js','web/view/audio.js','launcher/server.mjs','launcher/web_game.ps1','launcher/start_web.cmd','assets/third_party/fusion-pixel-font/fusion-pixel-10px-zh_hans.ttf','assets/third_party/fusion-pixel-font/OFL.txt',...Object.keys(towers).map(id=>`assets/game/sprites/towers/${id}.png`),...Object.keys(enemies).map(id=>`assets/game/sprites/enemies/${id}.png`),...Object.values(AUDIO_FILES).map(path=>path.replace(/^\//,''))];
required.push('web/core/unit-details.js','web/view/display-settings.js','web/view/transitions.js','web/view/dialog-transitions.js','web/core/difficulty.js','web/view/entity-art.js','web/view/entity-motion.js',...Object.values(ENTITY_ART).map(art=>art.animationPath.slice(1)));
required.push('web/inventory-view.js','web/core/inventory.js','web/core/item-content.js','web/core/extra-events.js','web/core/nexus-content.js','web/nexus-view.js');
required.push('web/core/event-redesign.js','web/core/tower-progression.js','web/service-style.css');
required.push('web/core/event-stories.js','web/event-view.js','web/event-style.css','web/view/entity-renderer.js','web/view/model-portraits.js','web/view/nexus-art.js','web/run-seed.js',...(await runtimeAssetPaths(root)).map(file=>file.slice(5)));
for(const file of new Set(required)){const path=resolve(root,'game',file);if(!(await stat(path)).isFile()||!(await stat(path)).size)throw Error(`Missing or empty resource: ${file}`);}
const licenses=['assets/third_party/game-icons/LICENSE.txt','assets/third_party/opengameart/singularity/LICENSE.txt','assets/third_party/opengameart/dark-sci-fi-audio/LICENSE.txt','assets/third_party/kenney/sci-fi-sounds/License.txt','development/assets/model_sources/kenney/space-kit/License.txt','development/assets/model_sources/kenney/modular-space-kit/License.txt','development/assets/model_sources/kenney/tower-defense-kit/License.txt'];
licenses.push('assets/third_party/three/LICENSE.txt','assets/third_party/polyhaven/LICENSE.txt');
for(const file of licenses)if((await readFile(resolve(root,file.startsWith('development/')?file:'game/'+file),'utf8')).length<25)throw Error(`License incomplete: ${file}`);
const manifest=(await readFile(resolve(root,'development/assets/ASSET_MANIFEST.sha256'),'utf8')).trim().split(/\r?\n/);let checked=0;
for(const line of manifest){const match=line.match(/^([0-9a-fA-F]{64})\s+(.+)$/);if(!match)continue;const file=match[2].trim().replace(/^[*]/,'');const actual=createHash('sha256').update(await readFile(resolve(root,file))).digest('hex');if(actual!==match[1].toLowerCase())throw Error(`Asset checksum mismatch: ${file}`);checked++;}
if(checked<40)throw Error('Asset manifest coverage insufficient');
for(const [name,catalog]of Object.entries({towers,enemies,relics,talents,events})){for(const [id,item]of Object.entries(catalog))if(id!==item.id||!(item.name||item.title))throw Error(`Invalid ${name} ${id}`);}
const files=await readdir(resolve(root,'game/web'),{recursive:true});for(const relative of files.filter(x=>/\.js$/.test(x))){const source=await readFile(resolve(root,'game/web',relative),'utf8');if(/https?:\/\/.*(?:cdn|unpkg|jsdelivr)/.test(source))throw Error(`External runtime dependency: ${relative}`);}
console.log(`MINDREALM_ASSETS_OK required=${new Set(required).size} hashes=${checked} licenses=${licenses.length+1}`);
console.log(`MINDREALM_CONTENT_OK towers=${Object.keys(towers).length} enemies=${Object.keys(enemies).length} relics=${Object.keys(relics).length} talents=${Object.keys(talents).length} events=${Object.keys(events).length}`);
