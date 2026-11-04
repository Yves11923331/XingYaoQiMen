/* 阴盘 · 导出图（canvas）单盘出图 —— 用来肉眼比对宫内排版
 * 用法：NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules \
 *        node 校验/_probe_yin_export.js 2026-01-01T04:00 out.png
 */
const path = require('path');
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const URL = process.env.URL || 'http://127.0.0.1:8767/';
const WHEN = process.argv[2] || '2026-01-01T04:00';
const OUT = process.argv[3] || path.join(__dirname, '_yin_export.png');

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  /* 2026-11-02：阴盘入口移到 设置 → 定局 → 定局法（#segJu） */
  await page.evaluate(() => document.querySelector('#segJu button[data-v="yin"]').click());
  await page.evaluate(v => {
    const el = document.getElementById('dtPick');
    el.value = v;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, WHEN);
  await page.evaluate(() => document.getElementById('btnCast').click());
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => {
    const A = window.App;
    const cv = A.Snap.render(A.state.chart, A.state.analysis, A.state.starMap, A.state.face, {});
    return { url: cv.toDataURL('image/png'), w: cv.width, h: cv.height };
  });
  fs.writeFileSync(OUT, Buffer.from(data.url.split(',')[1], 'base64'));
  console.log('saved', OUT, data.w + 'x' + data.h);
  if (errs.length) console.log('ERRORS:', errs);
  await browser.close();
})();
