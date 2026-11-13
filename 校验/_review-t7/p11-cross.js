/* 跨组件一致性（补 p9 判据 3 到四主题 × 五色）：app.css 的 --el-* 与 pan.css 的 --qm-el-* 同值，
 * 且「盘面某宫干的渲染色」与「串星课同五行的渲染色」逐色相同。
 * 跑法：T7URL=http://127.0.0.1:8801/ NODE_PATH=… node 校验/_review-t7/p11-cross.js
 */
'use strict';
const { boot, ok, eq, info, stats } = require('./lib.js');
const TH = [['white', '素白'], ['blue', '玄夜'], ['slate', '墨玉'], ['brown', '铜仪']];
const KEY = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };
const rgb = (v) => {
  const t = String(v).trim();
  const h = /^#([0-9a-f]{6})$/i.exec(t);
  if (h) return [0, 2, 4].map(i => parseInt(h[1].substr(i, 2), 16));
  return (t.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);
};
const near = (a, b) => Math.max(...[0, 1, 2].map(i => Math.abs(a[i] - b[i]))) <= 1;

(async () => {
  const { browser, page, errs, init } = await boot();
  await init({ theme: 'white', cxMode: 'six', juMethod: 'chaibu', plugins: {} });
  for (const [th, cn] of TH) {
    /* 盘面：起一张时家盘，取 .qm-el-* 各色元素的实际渲染色 */
    await page.evaluate((t) => { const s = JSON.parse(localStorage.getItem('xymq.set.v1') || '{}'); s.theme = t; s.juMethod = 'chaibu'; s.plugins = {}; localStorage.setItem('xymq.set.v1', JSON.stringify(s)); }, th);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('booting'));
    await page.waitForTimeout(280);
    await page.click('#btnCast'); await page.waitForTimeout(900);
    const pan = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      /* ⚠ --qm-el-* 是**作用在盘面容器上**的（pan.css: html[data-theme=..] .qm-text-pan），
         在 documentElement 上读会是空串 —— 必须从 .qm-text-pan 取 */
      const panEl = document.querySelector('.qm-text-pan');
      const pcs = getComputedStyle(panEl);
      const out = { tok: {}, panTok: {}, render: {}, n: {} };
      ['木', '火', '土', '金', '水'].forEach(wx => {
        const k = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' }[wx];
        out.tok[wx] = root.getPropertyValue('--el-' + k).trim();
        out.panTok[wx] = pcs.getPropertyValue('--qm-el-' + k).trim();
        /* 只取「天盘干」那颗裸字（.qm-gan.qm-el-*），别误抓门/神/星的同色类 */
        /* 排除两颗有自己形制的：时干（.qm-hour 高亮）与寄干（.qm-gan-mid 压成 ink-soft），
           只看普通的天盘干裸字 */
        const els = [...document.querySelectorAll('.qm-text-pan .qm-gan.qm-el-' + k)]
          .filter(e => (e.offsetWidth || e.offsetHeight)
            && !e.classList.contains('qm-hour') && !e.classList.contains('qm-gan-mid'));
        out.n[wx] = els.length;
        out.render[wx] = els[0] ? getComputedStyle(els[0]).color : null;
      });
      return out;
    });
    /* 串星课：找出覆盖五行的三节课 */
    await page.click('#btnBack'); await page.waitForTimeout(280);
    await page.click('#tabbar button[data-view="chuanxing"]'); await page.waitForTimeout(240);
    await page.click('#segCxSrc button[data-src="nums"]'); await page.waitForTimeout(220);
    const got = {};
    for (const nums of [['1', '1', '1', '1'], ['2', '2', '2', '2'], ['5', '1', '1', '1']]) {
      for (let i = 0; i < 4; i++) await page.fill('#cxN' + i, nums[i]);
      await page.click('#btnCastX'); await page.waitForTimeout(200);
      const cells = await page.evaluate(() => [...document.querySelectorAll('#cxPopGrid .xcell')].slice(0, 3)
        .map(c => ({ n: (c.querySelector('.nm') || {}).textContent, c: getComputedStyle(c.querySelector('.nm')).color })));
      const WXOF = { 大安: '木', 留连: '土', 速喜: '火', 赤口: '金', 小吉: '水' };
      cells.forEach(x => { if (WXOF[x.n]) got[WXOF[x.n]] = x.c; });
      await page.evaluate(() => document.getElementById('cxPopBack').click());
      await page.waitForTimeout(120);
    }
    console.log(`[${cn}] --el-* ${JSON.stringify(pan.tok)}`);
    console.log(`[${cn}] --qm-el-* ${JSON.stringify(pan.panTok)}`);
    console.log(`[${cn}] 盘面渲染 ${JSON.stringify(pan.render)}（干字数 ${JSON.stringify(pan.n)}）· 串星课渲染 ${JSON.stringify(got)}`);
    for (const wx of Object.keys(KEY)) {
      eq(pan.panTok[wx], pan.tok[wx], `[${cn}] ${wx}：--qm-el-${KEY[wx]} 应等于 --el-${KEY[wx]}`);
      ok(pan.render[wx] && near(rgb(pan.render[wx]), rgb(pan.tok[wx])), `[${cn}] ${wx}：盘面渲染色应等于 token（实得 ${pan.render[wx]} vs ${pan.tok[wx]}）`);
      ok(got[wx] && near(rgb(got[wx]), rgb(pan.render[wx])), `[${cn}] ${wx}：串星课渲染色应等于盘面渲染色（${got[wx]} vs ${pan.render[wx]}）`);
    }
  }
  console.log('  脚本报错：', errs.length ? JSON.stringify(errs) : '无');
  const s = stats();
  console.log(`\nP11 汇总：${s.pass} 过 / ${s.fail} 败`);
  await browser.close();
})();
