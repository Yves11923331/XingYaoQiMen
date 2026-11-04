/* 神星门干 · 多盘式冒烟：时家/飞盘/手动/阴盘/心盘
 * NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_probe_sxm_modes.js
 */
const path = require('path');
const { chromium } = require('playwright-core');
const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const URL = 'file://' + path.join(__dirname, '..', 'web', 'index.html');
(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text().slice(0, 140)); });
  await p.goto(URL);
  await p.waitForTimeout(1100);

  await p.click('#tabbar button[data-view="set"]');
  await p.click('#setChips button[data-g="plugin"]');
  await p.click('#segPlugin_sxm button[data-v="1"]');
  await p.click('#tabbar button[data-view="home"]');

  const count = () => p.evaluate(() => ({
    bands: document.querySelectorAll('.sxr').length,
    rows: document.querySelectorAll('.sxr-t').length,
    mu: document.querySelectorAll('.sxr-mu').length,
    xing: document.querySelectorAll('.sxr-xing').length,
    both: document.querySelectorAll('.sxr-both').length,
    cells: document.querySelectorAll('.qm-cell').length
  }));
  const cast = async (label) => {
    await p.click('#btnCast'); await p.waitForTimeout(600);
    console.log(label.padEnd(4), JSON.stringify(await count()));
  };
  const back = async () => { await p.click('#btnBack'); await p.waitForTimeout(250); };

  await cast('时家');

  await back();
  await p.click('#tabbar button[data-view="set"]');
  await p.click('#setChips button[data-g="rule"]');
  await p.waitForTimeout(200);
  await p.click('#segPanMode button[data-v="fei"]');
  await p.click('#tabbar button[data-view="home"]');
  await cast('飞盘');

  await back();
  await p.click('#segMode3 button[data-m="manual"]');
  await cast('手动');

  await back();
  /* 2026-11-02：阴盘入口移到 设置 → 定局 → 定局法（#segJu） */
  await p.evaluate(() => document.querySelector('#segJu button[data-v="yin"]').click());
  await cast('阴盘');

  await back();
  await p.click('#segMode3 button[data-m="xin"]');
  await p.waitForTimeout(300);
  await cast('心盘');

  console.log('errs:', errs.length ? errs.join(' | ') : '（无）');
  await b.close();
})();
