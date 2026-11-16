async (page) => {
  // READ-ONLY: only navigates and reads. No clicks on any action buttons.
  const routes = ['/', '/candidates', '/upload', '/upload-ultra', '/assistant', '/jds', '/taxonomy', '/system-config', '/users', '/ta-contribution'];
  const out = [];
  let i = 2;
  for (const r of routes) {
    await page.goto('https://talentpool.inapps.net' + r);
    try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
    await page.waitForTimeout(2500);
    const name = String(i).padStart(2, '0') + '-' + (r === '/' ? 'dashboard' : r.slice(1));
    // 1) clean DOM snapshot (viewport layout, before expanding)
    const html = await page.evaluate(() => {
      const d = document.documentElement.cloneNode(true);
      d.querySelectorAll('script, iframe, link[rel=modulepreload], link[rel=preload]').forEach(s => s.remove());
      // keep scroll position info
      return '<!doctype html>\n' + d.outerHTML;
    });
    // 2) expand inner scrollers for a tall screenshot
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) {
          el.style.overflow = 'visible'; el.style.height = 'auto'; el.style.maxHeight = 'none';
        }
      }
      for (const el of [document.documentElement, document.body, document.getElementById('root'), ...document.querySelectorAll('.h-screen,.h-full')]) {
        if (el) { el.style.height = 'auto'; el.style.minHeight = '100vh'; el.style.overflow = 'visible'; }
      }
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'd:/Design/InTalent/reference/prod/' + name + '.png', fullPage: true });
    out.push(name + " " + html.length);
    i++;
  }
  return out;
}
