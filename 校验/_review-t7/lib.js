'use strict';
const { chromium } = require('playwright-core');
const EXE = '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const URL_ = process.env.T7URL || 'http://127.0.0.1:8799/';
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) { pass++; } else { fail++; fails.push(m); console.log('  ✗ ' + m); } };
const eq = (a, b, m) => ok(String(a) === String(b), m + `  期望「${b}」实得「${a}」`);
const info = (m) => console.log('  · ' + m);

async function boot(opts) {
  opts = opts || {};
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: opts.w || 390, height: opts.h || 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, locale: 'zh-CN', acceptDownloads: true
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  const page2 = page;
  const bootPage = async (settings) => {
    await page2.goto(URL_, { waitUntil: 'load' });
    if (settings) {
      await page2.evaluate((s) => {
        const raw = localStorage.getItem('xymq.set.v1');
        const cur = raw ? JSON.parse(raw) : {};
        Object.assign(cur, s);
        localStorage.setItem('xymq.set.v1', JSON.stringify(cur));
      }, settings);
      await page2.reload({ waitUntil: 'load' });
    }
    await page2.waitForFunction(() => !document.documentElement.classList.contains('booting'));
    await page2.evaluate(() => document.fonts.ready);
    await page2.waitForTimeout(250);
  };
  return { browser, ctx, page: page2, errs, init: bootPage };
}
module.exports = { boot, ok, eq, info, stats: () => ({ pass, fail, fails }), chromium, EXE, URL_ };
