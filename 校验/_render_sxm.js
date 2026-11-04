/* 神星门干 · 出样张（真盘，不打包）
 * 用法：NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_render_sxm.js
 * 产出：设计-神星门干/样张/尺-素白.png · 尺-玄夜.png · 尺-特写.png · 尺-导出.png
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'web', 'index.html');
const OUT = path.join(ROOT, '设计-神星门干', '样张');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL);
  await page.waitForTimeout(1200);

  /* 开插件 */
  await page.click('#tabbar button[data-view="set"]');
  await page.click('#setChips button[data-g="plugin"]');
  await page.click('#segPlugin_sxm button[data-v="1"]');
  await page.click('#tabbar button[data-view="home"]');
  await page.evaluate(() => {
    const el = document.getElementById('dtPick');
    el.value = '2026-11-01T17:00'; el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.click('#btnCast');
  await page.waitForTimeout(800);

  await page.locator('#panHost').screenshot({ path: path.join(OUT, '尺-素白.png') });

  /* 特写：巽四（又墓又刑）与艮八（又墓又刑）/ 离九（只击刑） */
  const pick = async (txt, name) => {
    const cell = page.locator('.qm-cell').filter({ has: page.locator('.qm-pal', { hasText: txt }) }).first();
    await cell.screenshot({ path: path.join(OUT, '尺-特写-' + name + '.png') });
  };
  await pick('巽', '巽四');
  await pick('艮', '艮八');
  await pick('离', '离九');

  /* 玄夜 */
  await page.click('#btnBack');
  await page.click('#tabbar button[data-view="set"]');
  await page.click('#setChips button[data-g="look"]');
  await page.waitForTimeout(150);
  await page.click('.swatch[data-t="blue"]');
  await page.click('#tabbar button[data-view="home"]');
  await page.waitForTimeout(200);
  await page.click('#btnCast');
  await page.waitForTimeout(800);
  await page.locator('#panHost').screenshot({ path: path.join(OUT, '尺-玄夜.png') });

  /* 导出图 */
  const cv = await page.evaluate(() => {
    const A = window.App;
    const c = A.Snap.render(A.state.chart, A.state.analysis, A.state.starMap, A.state.face, {});
    return { url: c.toDataURL('image/png'), w: c.width, h: c.height };
  });
  fs.writeFileSync(path.join(OUT, '尺-导出.png'), Buffer.from(cv.url.split(',')[1], 'base64'));
  console.log('导出', cv.w + 'x' + cv.h, 'errs', errs);
  await browser.close();
})();
