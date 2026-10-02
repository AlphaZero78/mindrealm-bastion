async page=>{
 await page.goto('http://127.0.0.1:4191/?qa=1');await page.waitForFunction(()=>window.__mindrealm);await page.setViewportSize({width:1440,height:900});
 const result=await page.evaluate(async()=>{
  const q=window.__mindrealm,Run=await import('/web/core/state.js'),R=await import('/web/core/rules.js'),H=await import('/development/web-tests/helpers/reference-strategy.mjs');
  const s=Run.newRun('reference-0');Run.enterNode(s,Run.availableNodes(s)[0].id);H.prepareReference(s);q.loadState(s);q.transitions.finish();
  const f=q.field;f.camera.x=20;f.camera.z=18;f.zoomLevel=1.8;f.updateScale();f.setSelection({reducedMotion:true});
  const originals={};for(const method of ['drawRoutes','drawCore','drawEntry','drawWorldLabels','drawCompass']){originals[method]=f[method];f[method]=()=>{};}
  const units=s.units,checks=[];
  // The terrain outside actual sprite rectangles must be pixel-identical
  // before and after entity compositing, at every tested camera angle.
  for(const yaw of [0,45,90,135,225,315]){
   f.camera.yaw=yaw*Math.PI/180;f.dirty=true;const real=f.state.units;f.state.units=[];f.render(1000);const before=f.ctx.getImageData(0,0,f.canvas.width,f.canvas.height).data;
   f.state.units=real;f.render(1000);const after=f.ctx.getImageData(0,0,f.canvas.width,f.canvas.height).data;
   const bounds=real.filter(R.onField).map(u=>{const g=f.entityGeometry(u),p=f.p(g.x,g.z,g.h),size=f.modelSize(u,g);return{x:p.x-size,y:p.y-size*1.6,w:size*2,h:size*2.2};});
   let outside=0,changed=0;const rx=f.canvas.width/f.camera.width,ry=f.canvas.height/f.camera.height;
   for(let y=0;y<f.canvas.height;y++)for(let x=0;x<f.canvas.width;x++){const i=(y*f.canvas.width+x)*4;if(before[i]===after[i]&&before[i+1]===after[i+1]&&before[i+2]===after[i+2])continue;changed++;if(!bounds.some(b=>x/rx>=b.x-2&&x/rx<=b.x+b.w+2&&y/ry>=b.y-2&&y/ry<=b.y+b.h+2))outside++;}
   if(outside)throw Error(`Terrain repainted beyond entities at ${yaw} degrees: ${outside} pixels`);if(!changed)throw Error('No visible units in occlusion test');checks.push({yaw,changed,outside});
  }
  for(const [name,fn]of Object.entries(originals))f[name]=fn;
  return {checks,units:units.length};
 });
 for(const yaw of [45,135,225,315]){await page.evaluate(yaw=>{const f=window.__mindrealm.field;f.camera.yaw=yaw*Math.PI/180;f.dirty=true;f.render(performance.now());},yaw);await page.screenshot({path:`mindrealm-experience-qa/occlusion-${yaw}.png`});}
 return {status:'OCCLUSION_PIXELS_OK',...result};
}
