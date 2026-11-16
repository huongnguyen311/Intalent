async (page) => {
  const p = await page.context().newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  const res = {};
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('requestfailed', r => errs.push('failed ' + r.url()));
  for (const f of ['index', 'dashboard', 'candidates', 'candidate-detail', 'jds', 'jd-detail', 'jd-matching', 'users', 'ta-contribution']) {
    await p.goto('http://localhost:5181/' + f + '.html');
    await p.waitForTimeout(1000);
    await p.screenshot({ path: 'd:/Design/InTalent/reference/mock-shots/' + f + '.png' });
    res[f] = await p.title();
  }
  // click-through checks
  await p.goto('http://localhost:5181/candidates.html');
  await p.locator('tbody tr').first().locator('td').nth(3).click();
  await p.waitForTimeout(500);
  res.rowClick = p.url();
  await p.goto('http://localhost:5181/jd-detail.html');
  await p.getByText('Run AI Match').click();
  await p.waitForTimeout(500);
  res.runMatch = p.url();
  await p.close();
  res.errors = errs;
  return res;
}
