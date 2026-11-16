// Mockup interactions: page-to-page navigation only. No network calls.
(function () {
  const page = location.pathname.split('/').pop() || 'index.html';
  const go = (url) => () => { location.href = url; };
  const byText = (sel, text) => [...document.querySelectorAll(sel)].find(el => el.textContent.trim().includes(text));
  const isControl = (t) => t.closest('button, a, input, label, textarea, select');

  // Forms never submit; the mock login form goes to the dashboard.
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.matches('[data-mock-login]')) location.href = 'dashboard.html';
  }, true);

  // Table rows → detail pages
  const rowTarget = { 'candidates.html': 'candidate-detail.html', 'jds.html': 'jd-detail.html' }[page];
  if (rowTarget) {
    document.querySelectorAll('tbody tr').forEach((tr) => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', (e) => { if (!isControl(e.target)) location.href = rowTarget; });
    });
  }

  if (page === 'jd-detail.html') {
    const run = byText('button', 'Run AI Match');
    if (run) run.addEventListener('click', go('jd-matching.html'));
    const back = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'arrow_back');
    if (back) back.addEventListener('click', go('jds.html'));
  }

  if (page === 'candidate-detail.html') {
    const crumb = byText('header a, header button, header span', 'Candidate Pool');
    if (crumb) { crumb.style.cursor = 'pointer'; crumb.addEventListener('click', go('candidates.html')); }
  }

  // Segmented period filters (Ngày / Tuần / 3M / 6M / All): visual toggle only
  document.querySelectorAll('button').forEach((b) => {
    if (!['Ngày', 'Tuần', '3M', '6M', 'All'].includes(b.textContent.trim())) return;
    b.addEventListener('click', () => {
      const group = [...b.parentElement.children];
      const on = group.find(x => x.classList.contains('bg-slate-900'));
      if (!on || on === b) return;
      const onCls = on.className, offCls = b.className;
      on.className = offCls; b.className = onCls;
    });
  });
})();
