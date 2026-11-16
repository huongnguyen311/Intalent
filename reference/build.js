// Builds the static mockup from captured production DOM snapshots + designed pages.
// All real people/contacts are replaced with fictional data (see anonymize.js).
// Usage: node reference/build.js
const fs = require('fs');
const path = require('path');
const { anonymize, forbidden } = require('./anonymize');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'mockup');
const DOM = path.join(__dirname, 'dom');
const readJsonHtml = (f) => { let v = JSON.parse(fs.readFileSync(path.join(DOM, f), 'utf8')); if (typeof v === 'string' && v.trim().startsWith('{')) v = JSON.parse(v); return typeof v === 'string' ? v : v.html; };

const dom = JSON.parse(fs.readFileSync(path.join(DOM, 'all.json'), 'utf8'));
const ROUTES = ['/', '/candidates', '/upload', '/upload-ultra', '/assistant', '/jds', '/taxonomy', '/system-config', '/users', '/ta-contribution'];
const fileFor = (route) => (route === '/' ? 'dashboard.html' : route.slice(1) + '.html');

const NAV_IDLE = 'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-[#e6dddb] hover:bg-white/5 hover:text-white';
const NAV_ACTIVE = 'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors bg-primary text-white';
const JD_MATCH_DISABLED = '<div class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#896a61] cursor-not-allowed opacity-50"><span class="material-symbols-outlined text-[20px]">fact_check</span><span class="text-sm font-medium">JD Matching</span></div>';

function setActiveNav(html, href) {
  // reset all nav items, then activate one
  html = html.split(`class="${NAV_ACTIVE}"`).join(`class="${NAV_IDLE}"`);
  html = html.replace(/(<span class="material-symbols-outlined text-\[20px\] )icon-filled(">)/g, '$1$2');
  if (href) {
    html = html.replace(`<a class="${NAV_IDLE}" href="${href}"`, `<a class="${NAV_ACTIVE}" href="${href}"`);
  }
  return html;
}

function transform(html, { active } = {}) {
  html = html.replace(/<link rel="stylesheet" crossorigin="" href="\/assets\/index-[^"]+\.css">/, '<link rel="stylesheet" href="assets/app.css">');
  html = html.replace(/<link rel="preconnect"[^>]*>/g, '');
  html = html.replace(/<link id="googleidentityservice"[^>]*>/g, '');
  html = html.replace(/href="\/favicon\.svg"/, 'href="assets/favicon.svg"');
  for (const r of ROUTES) html = html.split(`href="${r}"`).join(`href="${fileFor(r)}"`);
  // Enable JD Matching in the sidebar (designed screen)
  html = html.split(JD_MATCH_DISABLED).join(`<a class="${NAV_IDLE}" href="jd-matching.html"><span class="material-symbols-outlined text-[20px] ">fact_check</span><span class="text-sm font-medium">JD Matching</span></a>`);
  if (active !== undefined) html = setActiveNav(html, active);
  // Signed storage links must never ship
  html = html.replace(/href="https:\/\/[^"]*amazonaws\.com[^"]*"/g, 'href="#"');
  html = anonymize(html);
  html = html.replace('</body>', '<script src="assets/mock.js"></script>\n</body>');
  return html;
}

const written = {};
const write = (file, html) => { fs.writeFileSync(path.join(OUT, file), html); written[file] = html; };

// 1) Captured production pages
for (const r of ROUTES) write(fileFor(r), transform(dom[r].html));

// 2) Detail pages (captured, anonymized)
write('jd-detail.html', transform(readJsonHtml('jd-detail.json'), { active: 'jds.html' }));
write('candidate-detail.html', transform(fs.readFileSync(path.join(DOM, 'candidate-detail.fake.html'), 'utf8'), { active: 'candidates.html' }));

// 3) Designed page: JD Matching — production shell (sidebar) + designed content
{
  const shell = dom['/jds'].html;
  const a = shell.indexOf('<header'), b = shell.indexOf('</main>') + '</main>'.length;
  const page = shell.slice(0, a) + fs.readFileSync(path.join(__dirname, 'pages', 'jd-matching.html'), 'utf8') + shell.slice(b);
  write('jd-matching.html', transform(page, { active: 'jd-matching.html' }));
}

// 4) Login (head from dashboard + captured login body)
{
  const head = dom['/'].html.split('<body')[0];
  const body = fs.readFileSync(path.join(DOM, 'login-body.html'), 'utf8');
  const login = transform(head + body + '\n</html>');
  write('login.html', login);
  write('index.html', login);
}

// 5) Safety check: no real data left
const problems = [];
for (const [file, html] of Object.entries(written)) {
  for (const s of forbidden) if (html.includes(s)) problems.push(`${file}: "${s}"`);
  for (const m of html.match(/[\w.+-]+@(gmail|yahoo|hotmail|inapps)\.[\w.]+/g) || []) problems.push(`${file}: email ${m}`);
  if (/amazonaws\.com/.test(html)) problems.push(`${file}: storage URL`);
}
console.log('wrote', Object.keys(written).join(', '));
if (problems.length) { console.error('REAL DATA LEFT:\n' + problems.join('\n')); process.exit(1); }
console.log('anonymization check: OK');
