import { chromium } from 'playwright';

(async () => {
  const logs = [];
  const errors = [];
  const requests = [];

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => {
    try {
      logs.push({ type: msg.type(), text: msg.text(), location: msg.location() });
    } catch (e) {
      logs.push({ type: msg.type(), text: msg.text() });
    }
  });

  page.on('pageerror', err => {
    errors.push(String(err && err.stack ? err.stack : err));
  });

  page.on('requestfailed', req => {
    const f = req.failure();
    requests.push({ url: req.url(), method: req.method(), error: f && f.errorText ? f.errorText : (f && f.message) });
  });

  const url = process.env.PREVIEW_URL || 'http://localhost:4173';
  console.log('Navigating to', url);

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  } catch (e) {
    console.error('Navigation error:', e && e.message ? e.message : e);
  }

  // wait a bit for async runtime errors
  await page.waitForTimeout(3000);

  console.log('--- console messages ---');
  logs.forEach((l) => {
    if (l.location && l.location.url) {
      console.log(l.type + ': ' + l.text + ' (' + l.location.url + ':' + l.location.line + ':' + l.location.column + ')');
    } else {
      console.log(l.type + ': ' + l.text);
    }
  });

  if (requests.length) {
    console.log('--- failed requests ---');
    requests.forEach(r => console.log(r.method + ' ' + r.url + ' -> ' + r.error));
  }

  if (errors.length) {
    console.log('--- uncaught/page errors ---');
    errors.forEach(e => console.log(e));
  }

  await browser.close();

  if (errors.length) {
    console.error('Playwright detected page errors.');
    process.exit(2);
  }

  console.log('Playwright check finished with no page-level errors.');
  process.exit(0);
})();
