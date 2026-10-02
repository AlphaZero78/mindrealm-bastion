import {cp,mkdir,readFile,writeFile,stat,readdir,rm,lstat} from 'node:fs/promises';
import {resolve,dirname,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inventoryAssets} from './refresh-asset-manifest.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const destination=resolve(process.env.MINDREALM_BUILD_DIR||join(dirname(root),'game_build_release','Mindrealm-Web'));
const gameRoot=join(destination,'game');
const metadata=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
if(process.platform!=='win32'||process.arch!=='x64')throw Error('The portable package requires Windows x64.');
if(process.version!=='v24.12.0')throw Error('The bundled runtime license is pinned to Node.js v24.12.0. Update the version and license together.');
const pathKey=path=>process.platform==='win32'?path.toLowerCase():path;
if(pathKey(destination)===pathKey(root)||pathKey(destination).startsWith(pathKey(root+sep)))throw Error('Release must be outside the repository.');
if(pathKey(process.execPath).startsWith(pathKey(destination+sep)))throw Error('Run the build with a Node.js executable outside the output directory.');
// Validate before tests or output changes: an external-looking junction must
// never redirect replacement of generated folders into the source checkout.
for(let ancestor=destination;;ancestor=dirname(ancestor)){
 try {if((await lstat(ancestor)).isSymbolicLink())throw Error('Release must not traverse a junction or symbolic link.');}
 catch(error){if(error.code!=='ENOENT')throw error;}
 if(dirname(ancestor)===ancestor)break;
}
for(const args of [['--test',...((await readdir(join(root,'development/web-tests'))).filter(f=>f.endsWith('.test.mjs')).map(f=>'development/web-tests/'+f))],['development/web-tools/verify.mjs']]){
 const run=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(run.status!==0)process.exit(run.status||1);
}
await mkdir(destination,{recursive:true});
// Only replace generated directories in a previously identified game release.
// Browser saves live outside this directory and are never touched by the build.
const previous=await readFile(join(destination,'MANIFEST.sha256'),'utf8').catch(()=>null);
if(previous){
 if(!/^\w{64}  (?:game\/)?web\/app\.js$/m.test(previous))throw Error('Existing output is not an identified Mindrealm release.');
 async function rejectOutputLinks(folder){
  for(const entry of await readdir(folder)){
   const file=join(folder,entry),info=await lstat(file);
   if(info.isSymbolicLink())throw Error('Existing release must not contain a junction or symbolic link.');
   if(info.isDirectory())await rejectOutputLinks(file);
  }
 }
 await rejectOutputLinks(destination);
 for(const directory of ['game','web','assets','licenses','launcher','runtime']){
  const target=resolve(destination,directory);
  if(!target.startsWith(destination+sep)||dirname(target)!==destination)throw Error('Unsafe generated directory.');
  await rm(target,{recursive:true,force:true});
 }
 await rm(join(destination,'Start Game.cmd'),{force:true});
}else if((await readdir(destination)).length)throw Error('Refusing to overwrite an unrecognized output directory.');
await mkdir(gameRoot,{recursive:true});
await cp(join(root,'web'),join(gameRoot,'web'),{recursive:true});
const assets=await inventoryAssets(root);
for(const file of assets.retained.filter(file=>file.startsWith('assets/'))){const target=join(gameRoot,file);await mkdir(dirname(target),{recursive:true});await cp(join(root,file),target);}
await mkdir(join(gameRoot,'launcher'),{recursive:true});
for(const file of ['server.mjs','web_game.ps1','start_web.cmd'])await cp(join(root,'launcher',file),join(gameRoot,'launcher',file));
await mkdir(join(gameRoot,'runtime'),{recursive:true});
const runtimeTarget=join(gameRoot,'runtime','node.exe'),runtimeBytes=await readFile(process.execPath),existingRuntime=await readFile(runtimeTarget).catch(()=>null);
if(!existingRuntime||!runtimeBytes.equals(existingRuntime))await cp(process.execPath,runtimeTarget);
const nodeLicense=join(root,'assets/third_party/node/LICENSE.txt');await cp(nodeLicense,join(gameRoot,'runtime','LICENSE.txt'));
await writeFile(join(destination,'启动游戏.cmd'),'@echo off\r\ncall "%~dp0game\\launcher\\start_web.cmd" %*\r\nexit /b %ERRORLEVEL%\r\n');
const launcherBuild=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'development/web-tools/build-launcher.ps1'),'-OutputExe',join(destination,'启动游戏.exe')],{cwd:root,stdio:'inherit',windowsHide:true});
if(launcherBuild.status!==0)process.exit(launcherBuild.status||1);
await writeFile(join(destination,'README.txt'),'\uFEFF心域防线 / Mindrealm Bastion v'+metadata.version+'\r\n\r\n适用系统：Windows 10/11 x64，使用现代桌面浏览器。\r\n\r\n1. 右键 ZIP，选择“全部解压”。\r\n2. 打开解压后的文件夹，双击“启动游戏.exe”。\r\n3. 默认浏览器会自动打开游戏，点击“开始新远征”。\r\n\r\n运行时、音乐、字体与素材已包含在 game 文件夹，解压后即可离线游玩。\r\n请保持启动游戏.exe 与 game 文件夹位于同一目录，整个文件夹可以一起移动。\r\n关闭网页后可再次启动并继续；战斗退出后回到该场战前。\r\n存档位于本机浏览器，请使用相同浏览器和端口继续游戏。\r\n备用启动入口：启动游戏.cmd。\r\n本机地址：http://127.0.0.1:4173/\r\n资源授权：game/licenses/THIRD_PARTY_ASSETS.md\r\n');
await mkdir(join(gameRoot,'licenses'),{recursive:true});
for(const kit of ['space-kit','modular-space-kit','tower-defense-kit'])await cp(join(root,'development/assets/model_sources/kenney',kit,'License.txt'),join(gameRoot,'licenses',`kenney-${kit}.txt`));
await cp(join(root,'docs/THIRD_PARTY_ASSETS.md'),join(gameRoot,'licenses','THIRD_PARTY_ASSETS.md'));
await writeFile(join(gameRoot,'version.json'),JSON.stringify({name:metadata.name,version:metadata.version,platform:'windows-x64'},null,2)+'\n');
const manifest=[];async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){const file=join(path,entry.name);if(entry.isDirectory())await walk(file);else if(entry.name!=='MANIFEST.sha256')manifest.push(`${createHash('sha256').update(await readFile(file)).digest('hex')}  ${file.slice(destination.length+1).replaceAll('\\','/')}`);}}await walk(destination);await writeFile(join(destination,'MANIFEST.sha256'),manifest.sort().join('\n')+'\n');
console.log(`MINDREALM_WEB_BUILD_OK ${destination} files=${manifest.length}`);
