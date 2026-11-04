/* 四柱ui 样张出图（playwright-core + 无头 chromium）
 * 用法：NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_shot_sizhu_preview.js
 * 产出：设计-四柱ui/样张/<theme>.png（#grid 全幅）与 <theme>-窄屏.png
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const ROOT = path.resolve(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, '设计-四柱ui', '预览.html');
const OUT = path.join(ROOT, '设计-四柱ui', '样张');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--no-sandbox'] });
  const errs = [];
  for (const theme of ['white', 'blue', 'slate', 'brown']) {
    const page = await browser.newPage({ viewport: { width: 780, height: 1200 }, deviceScaleFactor: 2 });
    page.on('console', m => { if (m.type() === 'error') errs.push(theme + ' console: ' + m.text().slice(0, 160)); });
    page.on('pageerror', e => errs.push(theme + ' pageerror: ' + String(e).slice(0, 160)));
    await page.goto(PAGE + '?theme=' + theme);
    await page.waitForTimeout(700);
    await page.evaluate(() => document.fonts.ready);
    if (theme === 'white') {
      const info = await page.evaluate(() => {
        const o = { font: document.fonts.check('16px "QM Serif"'), rows: [] };
        document.querySelectorAll('.pvcard').forEach(c => {
          const sz = c.querySelector('.sz'); const r = sz.getBoundingClientRect();
          o.rows.push(c.dataset.v + ' ' + Math.round(r.width) + 'x' + (Math.round(r.height * 10) / 10));
        });
        return o;
      });
      console.log('font QM Serif:', info.font);
      console.log(info.rows.join(' | '));
    }
    await page.locator('#grid').screenshot({ path: path.join(OUT, theme + '.png') });
    await page.locator('#narrow').screenshot({ path: path.join(OUT, theme + '-窄屏.png') });
    await page.close();
  }
  await browser.close();
  if (errs.length) { console.log('页面报错：\n' + errs.join('\n')); process.exit(1); }
  console.log('样张：' + OUT);
})();
