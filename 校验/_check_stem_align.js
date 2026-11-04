/* 天地盘干对齐自检（2026-11-03）
 *
 * 锁的是「同一宫里天盘干列右缘 == 地盘干列右缘」。
 * 背景：.qm-line 原来是 flex + space-between，星名 1.18em 比门名 1.14em 宽 2.02px；
 *       360/320 屏两行都放不进内容盒时 space-between 退化成 flex-start，
 *       干列改成紧贴各自名字 —— 两行差 2.02px（390 屏差 0.47px）。
 *       现在 .qm-line 是 grid（1fr + auto），干列恒贴右内边距。
 *
 * 用法（工程根）：
 *   NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_check_stem_align.js
 * 退出码 0 = 全过。
 */
const { chromium } = require('playwright-core');
const path = require('path');

const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const ROOT = path.resolve(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'web', 'index.html');
const TOL = 0.01;            /* px */

function measure(page) {
  return page.evaluate(() => {
    const OVERLAP_TOL = 0.5;
    const out = { rows: 0, max: 0, worst: null, overlaps: [] };
    document.querySelectorAll('#qm_text_pan .qm-cell').forEach(cell => {
      const rows = [...cell.querySelectorAll('.qm-line')];
      if (rows.length < 2) return;
      const g = rows.map(r => r.querySelector('.qm-gans').getBoundingClientRect());
      const d = Math.abs(g[0].right - g[1].right);
      out.rows++;
      if (d > out.max) {
        out.max = d;
        out.worst = { pal: cell.dataset.pal, starGansR: g[0].right, menGansR: g[1].right };
      }
      rows.forEach((r, i) => {
        const name = r.querySelector('.qm-name');
        const gans = r.querySelector('.qm-gans');
        if (!name || !gans) return;
        const nb = name.getBoundingClientRect();
        const gb = gans.getBoundingClientRect();
        /* 干字是 gans 里除寄干（absolute）之外的那一颗，右对齐；按实测字宽取左缘 */
        const chip = [...r.querySelectorAll('.qm-gan')].find(x => !x.classList.contains('qm-gan-mid'));
        if (chip) {
          const cb = chip.getBoundingClientRect();
          const over = nb.right - cb.left;
          if (over > OVERLAP_TOL) out.overlaps.push((cell.dataset.pal) + ':' + i + ':' + over.toFixed(2));
        }
      });
    });
    return out;
  });
}

async function open(browser, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(PAGE);
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const el = document.getElementById('dtPick');
    el.value = '2026-01-01T04:00';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(250);
  return { ctx, page };
}

(async () => {
  const bad = [];
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--no-sandbox'] });
  const check = (label, r) => {
    if (!r.rows) { bad.push(label + '：没量到星/门两行'); return; }
    if (r.max > TOL) bad.push(label + '：干列右缘差 ' + r.max.toFixed(2) + 'px（' + JSON.stringify(r.worst) + '）');
    if (r.overlaps.length) bad.push(label + '：名字压到干字 ' + r.overlaps.join(','));
    console.log('  ' + label + ' → ' + r.rows + ' 对行，最大差 ' + r.max.toFixed(2) + 'px' +
      (r.overlaps.length ? '，压字 ' + r.overlaps.length : ''));
  };

  for (const W of [320, 340, 360, 375, 390, 412, 430]) {
    const { ctx, page } = await open(browser, W);
    await page.click('#btnCast');
    await page.waitForTimeout(600);
    check('标准盘 ' + W + 'px', await measure(page));
    await ctx.close();
  }

  /* 阴盘：设置 → 定局 → 阴盘，再起盘 */
  {
    const { ctx, page } = await open(browser, 360);
    await page.evaluate(() => document.querySelector('#segJu button[data-v="yin"]').click());
    await page.evaluate(() => document.getElementById('btnCast').click());
    await page.waitForTimeout(700);
    const sub = await page.evaluate(() => document.querySelector('#qm_text_pan').dataset.sub);
    if (sub !== 'yin') bad.push('阴盘 360px：没进阴盘（data-sub=' + sub + '）');
    check('阴盘 360px', await measure(page));
    await ctx.close();
  }

  /* 老 UI：插件开启时 data-ui="old"（这里直接挂钩子，只验排布，不加载插件逻辑） */
  {
    const { ctx, page } = await open(browser, 360);
    await page.click('#btnCast');
    await page.waitForTimeout(600);
    await page.evaluate(() => { document.querySelector('#qm_text_pan').dataset.ui = 'old'; });
    await page.waitForTimeout(200);
    check('老 UI 360px', await measure(page));
    await ctx.close();
  }

  await browser.close();
  if (bad.length) { console.log('✗ 未过：'); bad.forEach(x => console.log('   - ' + x)); process.exit(1); }
  console.log('✓ 天地盘干对齐全过（7 档标准盘 + 阴盘 + 老 UI）');
})();
