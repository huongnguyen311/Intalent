// Pixel-diff the React app (?fixture=mockup) against the static mockup at 1440x900.
// Expects mockup on :5181 and app on :5190 (starts nothing).
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs';
import path from 'node:path';

const MOCK = 'http://localhost:5181/';
const APP = 'http://localhost:5190';
const LIMIT = 0.5; // percent
const OUT = path.resolve('fidelity-out');
const PAIRS = [
  ['dashboard', '/?fixture=mockup'],
  ['login', '/login?fixture=mockup'],
  ['index', '/login?fixture=mockup'], // mockup/index.html is the login page
  ['candidates', '/candidates?fixture=mockup'],
  ['candidate-detail', '/candidates/cand-mock-01?fixture=mockup'],
  ['upload', '/upload?fixture=mockup'],
  ['upload-ultra', '/upload-ultra?fixture=mockup'], // animated background: excluded from fail
  ['jds', '/jds?fixture=mockup'],
  ['jd-detail', '/jds/jd-2026-002?fixture=mockup'],
  ['jd-matching', '/jd-matching?fixture=mockup'],
  ['assistant', '/assistant?fixture=mockup'],
  ['taxonomy', '/taxonomy?fixture=mockup'],
  ['system-config', '/system-config?fixture=mockup'],
  ['users', '/users?fixture=mockup'],
  ['ta-contribution', '/ta-contribution?fixture=mockup'],
];
const EXCLUDED = new Set(['upload-ultra']);

async function launch() {
  try { return await chromium.launch({ channel: 'chrome' }); }
  catch { return await chromium.launch(); }
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const a = await ctx.newPage();
const b = await ctx.newPage();
const rows = [];
let failed = false;
for (const [name, route] of PAIRS) {
  await a.goto(`${MOCK}${name}.html`);
  await b.goto(APP + route);
  await a.waitForTimeout(1200);
  await b.waitForTimeout(2000);
  const A = PNG.sync.read(await a.screenshot());
  const B = PNG.sync.read(await b.screenshot());
  const { width, height } = A;
  const diff = new PNG({ width, height });
  const n = pixelmatch(A.data, B.data, diff.data, width, height, { threshold: 0.1 });
  fs.writeFileSync(path.join(OUT, `${name}.diff.png`), PNG.sync.write(diff));
  const pct = (100 * n) / (width * height);
  const excluded = EXCLUDED.has(name);
  const ok = pct <= LIMIT || excluded;
  if (!ok) failed = true;
  rows.push({ page: name, 'diff %': pct.toFixed(2), result: excluded ? 'excluded' : ok ? 'ok' : 'FAIL' });
}
await browser.close();
console.table(rows);
console.log(failed ? `FAIL: pages above ${LIMIT}%` : `OK: all pages <= ${LIMIT}%`);
process.exit(failed ? 1 : 0);
