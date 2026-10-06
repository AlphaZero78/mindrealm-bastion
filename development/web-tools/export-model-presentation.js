async page=>{
 const url=new URL(page.url());if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use isolated QA storage');
 await page.reload();await page.waitForFunction(()=>window.__mindrealm?.field.realtime?.ready);
 const outputs=[];
 const downloadAsset=async(kind,id)=>{
  const downloading=page.waitForEvent('download');
  const info=await page.evaluate(async({kind,id})=>{
   const r=window.__mindrealm.field.realtime;let blob,name,info;
   if(kind==='environment'){
    // PMREM is an authoring operation. Players load the baked CubeUV texture.
    const T=await import('/assets/third_party/three/three.bundle.js'),hdr=await new T.HDRLoader().loadAsync('/development/assets/lighting/studio_small_09_1k.hdr'),pmrem=new T.PMREMGenerator(r.renderer),target=pmrem.fromEquirectangular(hdr),bytes=new Uint16Array(target.width*target.height*4);r.renderer.readRenderTargetPixels(target,0,0,target.width,target.height,bytes);
    if(new Set(bytes).size<100)throw Error('Environment export is empty');
    blob=new Blob([bytes],{type:'application/octet-stream'});name='studio_small_09_pmrem.bin';info={width:target.width,height:target.height,format:'RGBA16F',bytes:bytes.byteLength};target.dispose();hdr.dispose();pmrem.dispose();
   }else{
    const model=r.catalog.entities[id],variants=Object.keys(model.variants),cell=256,canvas=document.createElement('canvas');canvas.width=cell;canvas.height=cell*variants.length;
    const context=canvas.getContext('2d');for(let i=0;i<variants.length;i++)context.drawImage(r.renderIcon(id,variants[i],cell),0,i*cell);
    blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));name=id+'.png';info={id,variants,cell,width:canvas.width,height:canvas.height,bytes:blob.size};
   }
   const a=document.createElement('a'),href=URL.createObjectURL(blob);a.href=href;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
   return {name,...info};
  },{kind,id});
  const download=await downloading;await download.saveAs(`mindrealm-realtime-art/${kind}/${info.name}`);outputs.push(info);
 };
 if(url.searchParams.get('bakeEnvironment')==='1')await downloadAsset('environment');
 const ids=await page.evaluate(()=>Object.keys(window.__mindrealm.field.realtime.catalog.entities));
 for(const id of ids)await downloadAsset('portraits',id);
 return {ok:true,outputs};
}
