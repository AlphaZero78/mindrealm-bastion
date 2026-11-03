async page => {
  const url = new URL(page.url());
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port === '4173' || url.searchParams.get('qa') !== '1') throw Error('Use isolated QA storage');
  const issues = [], onError = error => issues.push(error.message), onConsole = message => {
    if (['error', 'warning'].includes(message.type())) issues.push(message.text());
  };
  page.on('pageerror', onError); page.on('console', onConsole);
  await page.waitForFunction(() => window.__mindrealm?.field.realtime?.ready);
  const loaded = await page.evaluate(async () => {
    const q = window.__mindrealm, renderer = q.field.realtime;
    if (q.getState()?.phase === 'battle') throw Error('Catalog review requires a noncombat screen');
    await renderer.preload();
    return { assets: renderer.modelAssets.size, sources: renderer.sources.size, failures: [...renderer.failedAssets.keys()] };
  });
  if (loaded.assets !== 110 || loaded.failures.length) throw Error(JSON.stringify(loaded));
  const groups = [];
  for (const group of ['towers-1', 'towers-2', 'enemies', 'bosses']) {
    const download = page.waitForEvent('download');
    const result = await page.evaluate(async group => {
      const q = window.__mindrealm, r = q.field.realtime, content = await import('/web/core/content.js');
      let entries = Object.entries(r.catalog.entities).filter(([id, d]) => id !== 'tracking_drone' &&
        (group.startsWith('towers') ? d.kind === 'towers' : group === 'bosses' ? d.role === 'boss' : d.kind === 'enemies' && d.role !== 'boss'));
      if (group === 'towers-1') entries = entries.slice(0, 6);
      if (group === 'towers-2') entries = entries.slice(6);
      const rows = group.startsWith('towers') ? 5 : group === 'bosses' ? 3 : Math.ceil(entries.length / 6);
      const cell = group === 'enemies' ? 180 : 200, canvas = document.createElement('canvas');
      canvas.width = cell * 6; canvas.height = cell * rows;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#17282d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center'; ctx.font = '13px SimSun';
      const records = [], pixels = document.createElement('canvas'); pixels.width = pixels.height = cell;
      const pc = pixels.getContext('2d', { willReadFrequently: true });
      const transform = () => {
        const node = [...r.instances.values()][0].model.root, values = [];
        node.traverse(n => values.push(n.name, ...n.position.toArray(), ...n.quaternion.toArray(), ...n.scale.toArray()));
        return JSON.stringify(values);
      };
      for (let i = 0; i < entries.length; i++) {
        const [id, definition] = entries[i], variants = Object.keys(definition.variants), variantImages = new Set();
        for (let j = 0; j < variants.length; j++) {
          const variant = variants[j];
          r.renderStudy(id, variant, { cell, action: 'idle', clock: 0 });
          pc.clearRect(0, 0, cell, cell); pc.drawImage(r.canvas, 0, 0);
          const data = pc.getImageData(0, 0, cell, cell).data;
          let visible = 0; for (let k = 3; k < data.length; k += 4) if (data[k] > 10) visible++;
          if (visible < 150) throw Error(`Empty model ${id}/${variant}`);
          variantImages.add(pixels.toDataURL());
          const col = i % 6, row = group === 'enemies' ? Math.floor(i / 6) : j;
          ctx.drawImage(r.canvas, col * cell + 5, row * cell, cell - 10, cell - 18);
          ctx.fillStyle = '#e4edeb'; ctx.fillText(`${(content.towers[id] || content.enemies[id]).name} ${variant}`, col * cell + cell / 2, (row + 1) * cell - 5);
        }
        if (variantImages.size !== variants.length) throw Error(`Duplicate appearances ${id}`);
        const variant = variants[0], motion = {};
        for (const action of ['move', 'attack', 'cast', 'death']) {
          r.renderStudy(id, variant, { cell: 96, action, progress: .21, shutdownProgress: .21, travel: .21, clock: 210 });
          const first = transform();
          r.renderStudy(id, variant, { cell: 96, action, progress: .49, shutdownProgress: .49, travel: .49, clock: 490 });
          motion[action] = first !== transform();
        }
        if (definition.kind === 'enemies' && !motion.move) throw Error(`Missing movement ${id}`);
        if (!motion.attack && !motion.cast) throw Error(`Missing functional action ${id}`);
        r.renderStudy(id, variant, { cell: 96, action: 'disabled', clock: 100 }); const disabled = transform();
        r.renderStudy(id, variant, { cell: 96, action: 'disabled', clock: 900 });
        if (disabled !== transform()) throw Error(`Disabled model moves ${id}`);
        r.renderStudy(id, variant, { cell: 96, action: 'move', travel: .2, clock: 100, reducedMotion: true }); const reduced = transform();
        r.renderStudy(id, variant, { cell: 96, action: 'move', travel: .9, clock: 900, reducedMotion: true });
        if (reduced !== transform()) throw Error(`Reduced motion drifts ${id}`);
        records.push({ id, variants: variants.length, motion, disabled: true, reducedMotion: true });
      }
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .82));
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `final-models-${group}.jpg`; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      return { group, records, contactBytes: blob.size, dimensions: [canvas.width, canvas.height] };
    }, group);
    await (await download).saveAs(`output/playwright/final-models-${group}.jpg`);
    groups.push(result);
  }
  const final = await page.evaluate(() => ({ models: window.__mindrealm.field.realtime.snapshot(), errors: window.__mindrealm.field.errors }));
  page.off('pageerror', onError); page.off('console', onConsole);
  const count = groups.reduce((sum, group) => sum + group.records.length, 0), appearances = groups.flatMap(group => group.records).reduce((sum, record) => sum + record.variants, 0);
  if (count !== 49 || appearances !== 109 || issues.length || final.errors.length || final.models.errors.length) throw Error(JSON.stringify({ count, appearances, issues, final }));
  return { status: 'WHOLE_ENTITY_CATALOG_OK', count, appearances, loaded, groups, issues, final };
}
