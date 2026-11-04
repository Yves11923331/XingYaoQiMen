/* 四柱ui 插件 · 上机自检（真浏览器）
 * 用法：NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_probe_sizhu.js
 * 做四件事：①开插件 → 四柱换形制、量高；②导出图同形制；③阴盘回默认；④手动盘回默认。
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'web', 'index.html');
const OUT = path.join(ROOT, '校验');

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 200)));
  let pass = 0, fail = 0;
  const ok = (c, m) => { c ? pass++ : (fail++, console.log('  ✗ ' + m)); };

  await page.goto(URL);
  await page.waitForTimeout(1300);

  /* 开插件：设置 → 插件 → 四柱 开启 */
  await page.click('#tabbar button[data-view="set"]');
  await page.click('#setChips button[data-g="plugin"]');
  const hasCard = await page.evaluate(() => !!document.getElementById('segPlugin_sizhu'));
  ok(hasCard, '插件页应出现「四柱」卡片');
  await page.click('#segPlugin_sizhu button[data-v="1"]');
  await page.click('#tabbar button[data-view="home"]');
  await page.click('#btnCast');
  await page.waitForTimeout(700);

  /* ① 屏幕：换形制、量高 */
  const m = await page.evaluate(() => {
    const gz = document.getElementById('gz');
    const pk = gz.querySelector('.pk-sz');
    const r = gz.getBoundingClientRect();
    const lb = document.getElementById('plabel');
    return {
      hasPlug: !!pk, cols: gz.querySelectorAll('.pk-sz .sz-p').length,
      gzH: +r.height.toFixed(1), lbHidden: lb.style.display === 'none',
      labelCount: gz.querySelectorAll('.pk-sz .sz-lb i').length,
      colored: gz.querySelectorAll('.pk-sz .sz-wood,.pk-sz .sz-fire,.pk-sz .sz-earth,.pk-sz .sz-metal,.pk-sz .sz-water').length,
      qheadH: +document.querySelector('.qhead').getBoundingClientRect().height.toFixed(1)
    };
  });
  console.log('屏幕：', JSON.stringify(m));
  ok(m.hasPlug, '四柱应换成插件形制');
  ok(m.cols === 4, '应四列');
  ok(m.labelCount === 4, '应有四个柱名');
  ok(m.colored === 8, '八个干支都应着色（4干+4支）');
  ok(m.gzH < 100 && m.qheadH <= 106, '四柱块不撑高抬头（实测块 ' + m.gzH + ' / 抬头 ' + m.qheadH + '）');
  ok(m.lbHidden, '默认柱名行应藏起来（避免叠两行）');
  await page.locator('#view-chart .info').screenshot({ path: path.join(OUT, '_sizhu_header.png') });

  /* ② 导出图：同形制，高度不变 */
  const cv = await page.evaluate(() => {
    const A = window.App;
    const c = A.Snap.render(A.state.chart, A.state.analysis, A.state.starMap, A.state.face, {});
    return { url: c.toDataURL('image/png'), w: c.width, h: c.height };
  });
  fs.writeFileSync(path.join(OUT, '_sizhu_export_full.png'), Buffer.from(cv.url.split(',')[1], 'base64'));
  console.log('导出图：', cv.w + 'x' + cv.h);

  /* ③ 阴盘：必须回默认（pluginsBlocked）。★ 阴盘 2026-11-02 起是定局法第三档，入口在设置页 */
  await page.click('#btnBack');
  await page.evaluate(() => document.querySelector('#segJu button[data-v="yin"]').click());
  await page.click('#btnCast');
  await page.waitForTimeout(600);
  const yin = await page.evaluate(() => ({
    pk: document.querySelectorAll('#gz .pk-sz').length,
    lbShown: document.getElementById('plabel').style.display !== 'none',
    tiles: document.querySelectorAll('#gz .tile').length
  }));
  console.log('阴盘：', JSON.stringify(yin));
  ok(yin.pk === 0, '阴盘不应出现插件四柱');
  ok(yin.lbShown && yin.tiles === 8, '阴盘应回到默认四柱（8 块）');
  await page.locator('#view-chart .info').screenshot({ path: path.join(OUT, '_sizhu_yin.png') });

  /* ④ 手动盘：没有年月日 → 回默认 */
  await page.click('#btnBack');
  await page.click('#segMode3 button[data-m="manual"]');
  await page.waitForTimeout(200);
  await page.click('#btnCast');
  await page.waitForTimeout(600);
  const man = await page.evaluate(() => ({
    pk: document.querySelectorAll('#gz .pk-sz').length,
    dashes: document.querySelectorAll('#gz .t-none').length
  }));
  console.log('手动盘：', JSON.stringify(man));
  ok(man.pk === 0 && man.dashes === 6, '手动盘应回默认、画六道「—」');

  console.log('\n结果：' + pass + ' 过 / ' + fail + ' 败');
  if (errs.length) { console.log('页面报错：\n' + errs.join('\n')); }
  await browser.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
