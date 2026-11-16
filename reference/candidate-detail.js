// Turns the captured production Candidate Profile page into a fully fictional profile.
// Keeps the production layout/classes; replaces every piece of personal content.
const fs = require('fs');
const path = require('path');

const FAKE = {
  name: 'PHAM MINH KHOA',
  role: 'Head of Sales',
  email: 'khoa.pham@example.com',
  phone: '+84 0901 234 567',
  summary: 'Sales leader with 15+ years of experience in B2B software, payments and telecom. Builds and scales sales teams, designs go-to-market plans for new products, and manages long-term relationships with enterprise and banking clients. Comfortable working with cross-functional product and delivery teams.',
  jobs: [
    { title: 'Head of Sales', company: 'Nova Payments (demo)', start: '2024-01', end: '2026-06', desc: 'Built and led a sales team of 10. Launched the go-to-market plan for a new POS product line and reached 90% of the yearly target in the first two quarters. Set up the weekly pipeline review and forecasting process.' },
    { title: 'Key Account Manager', company: 'BlueRiver Systems (demo)', start: '2021-03', end: '2023-12', desc: 'Managed 25 enterprise accounts in banking and retail. Grew account revenue 35% year over year through upsell of managed services and cloud solutions. Coordinated with solution architects on tenders.' },
    { title: 'Sales Manager', company: 'Orion Tech JSC (demo)', start: '2017-06', end: '2021-02', desc: 'Sold system integration and IT managed services to FMCG and healthcare clients. Opened new accounts through outbound prospecting, partner referrals and industry events.' },
    { title: 'Sales Specialist', company: 'Sunrise Telecom (demo)', start: '2011-01', end: '2017-05', desc: 'Sold data center, network and leased-line services to domestic and international companies. Worked with technical teams to deliver projects on time and supported bid preparation.' },
  ],
  edu: [
    { degree: 'MBA in Marketing', school: 'Saigon Business School (demo)', year: '2015' },
    { degree: 'BA in Information Systems', school: 'City University (demo)', year: '2010' },
  ],
};

function fakeCvPaper() {
  const jobs = FAKE.jobs.map(j => `
      <p style="margin:10px 0 2px;font-weight:700">${j.title} | ${j.company}</p>
      <p style="margin:0 0 4px;color:#555">${j.start.replace('-', '/')} – ${j.end.replace('-', '/')}</p>
      <p style="margin:0">${j.desc}</p>`).join('');
  const edu = FAKE.edu.map(e => `<p style="margin:2px 0">${e.degree} — ${e.school}, ${e.year}</p>`).join('');
  return `<div style="position:absolute;inset:0;overflow:auto;padding:24px 0">
    <div style="width:min(92%,640px);margin:0 auto;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.35);padding:48px 52px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#111">
      <h1 style="text-align:center;font-size:24px;font-weight:700;margin:0 0 6px">${FAKE.name}</h1>
      <p style="text-align:center;font-weight:700;margin:0">${FAKE.role} | Business Development | MBA</p>
      <p style="text-align:center;margin:0 0 14px">Ho Chi Minh City · ${FAKE.phone} · ${FAKE.email}</p>
      <p style="color:#1f4e9c;font-weight:700;font-size:10px;text-transform:uppercase;margin:12px 0 4px">Professional Summary</p>
      <p style="margin:0">${FAKE.summary}</p>
      <p style="color:#1f4e9c;font-weight:700;font-size:10px;text-transform:uppercase;margin:14px 0 4px">Professional Experience</p>
      ${jobs}
      <p style="color:#1f4e9c;font-weight:700;font-size:10px;text-transform:uppercase;margin:14px 0 4px">Education</p>
      ${edu}
      <p style="margin-top:28px;text-align:center;color:#999;font-size:10px">Sample CV — fictional data for mockup</p>
    </div></div>`;
}

const BLOCK = '<div class="p-4 rounded-xl border border-[#e6dddb] dark:border-[#3a3433] bg-[#f8f6f6] dark:bg-[#251f1e]">';

function setInputs(block, values) {
  let i = 0;
  return block.replace(/(<input[^>]*value=")([^"]*)(")/g, (m, a, _v, c) => a + (values[i++] ?? '') + c);
}

function main(srcFile, outHtmlFile) {
  let h = fs.readFileSync(srcFile, 'utf8');
  if (h.startsWith('"')) h = JSON.parse(h);
  if (h.trim().startsWith('{')) h = JSON.parse(h).html;

  // Work experience: keep one template block per fake job.
  h = replaceBlocks(h, 'Work Experience', 'Education', FAKE.jobs, (tpl, j) =>
    setInputs(tpl, [j.title, j.company, j.start, j.end]).replace(/(<textarea[^>]*>)[\s\S]*?(<\/textarea>)/, `$1${j.desc}$2`));
  h = replaceBlocks(h, '>school</span>', 'Original Document:', FAKE.edu, (tpl, e) =>
    setInputs(tpl, [e.degree, e.school, e.year]));

  // Summary
  h = h.replace(/(rows="4">)[\s\S]*?(<\/textarea>)/, `$1${FAKE.summary}$2`);
  // Remove signed S3 link
  h = h.replace(/href="https:\/\/talent-pool-main\.s3[^"]*"/g, 'href="#"');
  // CV viewer: inject fictional CV
  h = h.replace('<div class="relative w-full h-full" style="overflow: hidden;">', '<div class="relative w-full h-full" style="overflow: hidden;">' + fakeCvPaper());
  fs.writeFileSync(outHtmlFile, h);
}

// Rebuilds the list of item blocks inside a section using the first block as template.
function replaceBlocks(h, startMarker, endMarker, items, fill) {
  const s = h.indexOf(startMarker);
  const e = h.indexOf(endMarker, s);
  const firstAbs = h.indexOf(BLOCK, s);
  if (s < 0 || e < 0 || firstAbs < 0 || firstAbs > e) throw new Error('section not found: ' + startMarker);
  // Walk balanced <div> tags from each block start to find its end.
  const blockEnd = (from) => {
    const re = /<div\b|<\/div>/g; re.lastIndex = from; let depth = 0, m;
    while ((m = re.exec(h))) { depth += m[0] === '</div>' ? -1 : 1; if (depth === 0) return re.lastIndex; }
    throw new Error('unbalanced');
  };
  const tplEnd = blockEnd(firstAbs);
  const tpl = h.slice(firstAbs, tplEnd);
  let lastEnd = tplEnd, next;
  while ((next = h.indexOf(BLOCK, lastEnd)) >= 0 && next < e && next === lastEnd) lastEnd = blockEnd(next);
  return h.slice(0, firstAbs) + items.map(it => fill(tpl, it)).join('') + h.slice(lastEnd);
}

module.exports = { FAKE };
if (require.main === module) {
  main(path.join(__dirname, 'dom', 'candidate-detail.json'), path.join(__dirname, 'dom', 'candidate-detail.fake.html'));
  console.log('ok');
}
