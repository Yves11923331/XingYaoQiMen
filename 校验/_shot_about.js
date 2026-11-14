/* ============================================================================
 * _shot_about.js —— 「关于」弹层四主题实拍（改关于界面前后对比用）
 * ----------------------------------------------------------------------------
 * 跑法：python3 -m http.server 8799 --bind 127.0.0.1 --directory web &
 *       NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules \
 *       node 校验/_shot_about.js [输出目录]
 * 默认输出到 设计-关于-20261114/（目录不存在会自动建）。
 * ========================================================================== */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const URL_ = process.env.URL || 'http://127.0.0.1:8799/';
const OUT = process.argv[2] || path.join(process.cwd(), '设计-关于-20261114');
const THEMES = [['white', '素白'], ['blue', '玄夜'], ['slate', '墨玉'], ['brown', '铜仪']];
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  for (const [theme, cn] of THEMES) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true, locale: 'zh-CN'
    });
    await ctx.addInitScript((t) => {
      localStorage.setItem('xymq.set.v1', JSON.stringify({ rev: 3, theme: t }));
    }, theme);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).split('\n')[0]));
    await page.goto(URL_, { waitUntil: 'load' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('booting'));
    await page.evaluate(() => document.fonts.ready);
    await page.click('#tabbar button[data-view="set"]');
    await page.waitForTimeout(250);
    await page.click('#btnAbout');
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(OUT, `关于-${cn}-${new Date().toISOString().slice(0, 10)}.png`) });
    console.log(cn, 'ok', errs.length ? 'errs=' + errs.join('|') : '');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
