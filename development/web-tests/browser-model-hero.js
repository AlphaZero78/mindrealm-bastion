async page=>{
 if(new URL(page.url()).searchParams.get('qa')!=='1')throw Error('Isolated QA required');
 await page.reload();await page.waitForFunction(()=>window.__mindrealm?.field.realtime?.ready);
 const download=page.waitForEvent('download');
 await page.evaluate(async()=>{const r=window.__mindrealm.field.realtime,canvas=r.renderIcon('focus_rail','T3A',1024),blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),link=document.createElement('a');link.download='model-hero.png';link.href=URL.createObjectURL(blob);link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);});
 await (await download).saveAs('mindrealm-realtime-art/model-hero.png');return {ok:true};
}
