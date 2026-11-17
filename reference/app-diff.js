async (page) => {
  // Pixel-diff React app (:5190, ?fixture=mockup) vs static mockup (:5181). Edit PAIRS as screens land.
  const PAIRS = [
    ['dashboard.html', '/?fixture=mockup'],
    ['login.html', '/login?fixture=mockup'],
    ['candidates.html', '/candidates?fixture=mockup'],
    ['candidate-detail.html', '/candidates/cand-mock-01?fixture=mockup'],
    ['upload.html', '/upload?fixture=mockup'],
    ['upload-ultra.html', '/upload-ultra?fixture=mockup'],
    ['jds.html', '/jds?fixture=mockup'],
    ['jd-detail.html', '/jds/jd-2026-002?fixture=mockup'],
    ['jd-matching.html', '/jd-matching?fixture=mockup'],
    ['assistant.html', '/assistant?fixture=mockup'],
    ['taxonomy.html', '/taxonomy?fixture=mockup'],
    ['system-config.html', '/system-config?fixture=mockup'],
    ['users.html', '/users?fixture=mockup'],
    ['ta-contribution.html', '/ta-contribution?fixture=mockup'],
  ];
  const ctx = page.context();
  const a = await ctx.newPage(); const b = await ctx.newPage(); const blank = await ctx.newPage();
  for (const p of [a, b]) await p.setViewportSize({ width: 1440, height: 900 });
  await blank.goto('about:blank');
  const out = {};
  for (const [m, r] of PAIRS) {
    await a.goto('http://localhost:5181/' + m); await b.goto('http://localhost:5190' + r);
    await a.waitForTimeout(1200); await b.waitForTimeout(2000);
    const A = (await a.screenshot()).toString('base64');
    const B = (await b.screenshot({ path: 'd:/Design/InTalent/reference/mock-shots/app-' + m.replace('.html', '') + '.png' })).toString('base64');
    out[m] = await blank.evaluate(async ([a, b]) => {
      const load = s => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + s; });
      const A = await load(a), B = await load(b); const W = A.width, H = A.height;
      const px = img => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, W, H).data; };
      const da = px(A), db = px(B); let d = 0; const rows = new Set();
      for (let k = 0; k < da.length; k += 4) if (Math.abs(da[k]-db[k]) + Math.abs(da[k+1]-db[k+1]) + Math.abs(da[k+2]-db[k+2]) > 30) { d++; rows.add(Math.floor(k/4/W/50)*50); }
      return (100*d/(W*H)).toFixed(2) + '% bands ' + [...rows].slice(0, 12).join(',');
    }, [A, B]);
  }
  await a.close(); await b.close(); await blank.close();
  return out;
}
