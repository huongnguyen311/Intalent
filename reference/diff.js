async (page) => {
  // Read-only: navigates production pages, screenshots, and pixel-diffs against mockup files.
  const names = {'/':'dashboard','/candidates':'candidates','/upload':'upload','/upload-ultra':'upload-ultra','/assistant':'assistant','/jds':'jds','/taxonomy':'taxonomy','/system-config':'system-config','/users':'users','/ta-contribution':'ta-contribution'};
  const m = await page.context().newPage();
  await m.setViewportSize({ width: 1440, height: 900 });
  const blank = await page.context().newPage();
  await blank.goto('about:blank');
  const out = {};
  for (const [r, f] of Object.entries(names)) {
    await page.goto('https://talentpool.inapps.net' + r);
    try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
    await page.waitForTimeout(2500);
    const a = (await page.screenshot()).toString('base64');
    await m.goto('file:///d:/Design/InTalent/mockup/' + f + '.html');
    await m.waitForTimeout(1000);
    const b = (await m.screenshot({ path: 'd:/Design/InTalent/reference/mock-shots/' + f + '.png' })).toString('base64');
    out[f] = await blank.evaluate(async ([a, b]) => {
      const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
      const A = await load('data:image/png;base64,' + a), B = await load('data:image/png;base64,' + b);
      const W = Math.min(A.width, B.width), H = Math.min(A.height, B.height);
      const px = img => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, W, H).data; };
      const da = px(A), db = px(B); let diff = 0, minY = H, maxY = 0;
      for (let k = 0; k < da.length; k += 4) {
        if (Math.abs(da[k]-db[k]) + Math.abs(da[k+1]-db[k+1]) + Math.abs(da[k+2]-db[k+2]) > 30) {
          diff++; const y = Math.floor(k / 4 / W); if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
      return (100 * diff / (W * H)).toFixed(2) + '% rows ' + (diff ? minY + '-' + maxY : '-');
    }, [a, b]);
  }
  await m.close(); await blank.close();
  return out;
}
