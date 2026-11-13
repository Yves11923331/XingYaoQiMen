'use strict';
const { boot, ok, eq, info, stats } = require('./lib.js');
const fs = require('fs');
const OUT = '/tmp/t7/out'; fs.mkdirSync(OUT, { recursive: true });

const TH = [['white', '素白'], ['blue', '玄夜'], ['slate', '墨玉'], ['brown', '铜仪']];
function lum(rgb) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contrast(a, b) {
  const L1 = lum(a), L2 = lum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
const parse = (s) => (s.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);

(async () => {
  const { browser, page, errs, init } = await boot();
  await init({ theme: 'white', cxMode: 'six' });

  for (const [key, name] of TH) {
    await page.evaluate((t) => {
      const s = JSON.parse(localStorage.getItem('xymq.set.v1') || '{}');
      s.theme = t; localStorage.setItem('xymq.set.v1', JSON.stringify(s));
      document.documentElement.setAttribute('data-theme', t);
    }, key);
    await page.click('#tabbar button[data-view="home"]');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/home-${key}.png`, fullPage: false });
    await page.click('#tabbar button[data-view="chuanxing"]');
    await page.waitForTimeout(260);
    await page.screenshot({ path: `${OUT}/cx-${key}.png`, fullPage: false });
    const m = await page.evaluate(() => {
      const lab = document.getElementById('cxMode');
      const cb = document.getElementById('cxStar');
      const t6 = document.querySelector('.cxmode .t6'), t9 = document.querySelector('.cxmode .t9');
      const r = (e) => { const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), bottom: +b.bottom.toFixed(1) }; };
      const sc = document.getElementById('scroll');
      const cs = (e) => getComputedStyle(e);
      const bg = (e) => { let n = e; while (n && n !== document.documentElement) { const c = cs(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; n = n.parentElement; } return cs(document.body).backgroundColor; };
      return {
        lab: r(lab), cb: r(cb), cast: r(document.getElementById('btnCastX')),
        scrollH: sc.clientHeight, scrollTop: sc.scrollTop,
        t6: { c: cs(t6).color, fs: cs(t6).fontSize, w: +t6.getBoundingClientRect().width.toFixed(1) },
        t9: { c: cs(t9).color, fs: cs(t9).fontSize },
        cbBorder: cs(cb).borderColor, cbBg: cs(cb).backgroundColor,
        panelBg: bg(lab),
        view: r(document.getElementById('view-chuanxing')),
        vh: window.innerHeight,
        // 是否有别的东西盖住它
        topAtCenter: (() => { const b = lab.getBoundingClientRect(); const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return el ? (el.id || el.className || el.tagName) : null; })(),
        // 「起课」按钮与勾选的水平/垂直关系
        castTop: r(document.getElementById('btnCastX')).y
      };
    });
    const cAct = contrast(parse(m.t6.c), parse(m.panelBg));
    const cInact = contrast(parse(m.t9.c), parse(m.panelBg));
    console.log(`[${name}] label ${m.lab.w}×${m.lab.h} @y=${m.lab.y}  可视高 ${m.scrollH}/${m.vh}  起课钮 y=${m.cast.y}`);
    console.log(`         六神 ${m.t6.c}(${m.t6.fs}) 对比 ${cAct.toFixed(2)}:1 · 九星 ${m.t9.c} 对比 ${cInact.toFixed(2)}:1 · 方框边 ${m.cbBorder}`);
    ok(m.lab.w >= 40 && m.lab.h >= 40, `[${name}] 触控区 ≥40×40`);
    ok(m.lab.bottom <= m.scrollH + 1, `[${name}] 首屏不用滚就看得见（bottom ${m.lab.bottom} / 视口 ${m.scrollH}）`);
    ok(cAct >= 3, `[${name}] 当前态那个字对比应 ≥3:1（实得 ${cAct.toFixed(2)}）`);
    ok(cInact >= 1.8, `[${name}] 非当前态那个字也得看得见（≥1.8:1，实得 ${cInact.toFixed(2)}）`);
    ok(m.topAtCenter && /cxStar|t6|cxmode/.test(String(m.topAtCenter)), `[${name}] 控件中心没被别的东西盖住（命中 ${m.topAtCenter}）`);
    ok(m.cast.y - m.lab.bottom > 10, `[${name}] 与「起课」按钮不重叠且留白 >10px（${(m.cast.y - m.lab.bottom).toFixed(1)}）`);
  }

  /* 切档不带数：数字档填过之后回时间档，时间档四数仍是时刻直译 */
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'white'));
  await page.waitForTimeout(150);
  const t0 = await page.evaluate(() => [...document.querySelectorAll('#cxTimeNums b')].map(b => b.textContent.trim()).join(','));
  await page.click('#segCxSrc button[data-src="nums"]'); await page.waitForTimeout(200);
  for (const [i, v] of [[0, '9'], [1, '9'], [2, '9'], [3, '9']]) await page.fill('#cxN' + i, v);
  await page.waitForTimeout(80);
  await page.click('#segCxSrc button[data-src="time"]'); await page.waitForTimeout(220);
  const t1 = await page.evaluate(() => [...document.querySelectorAll('#cxTimeNums b')].map(b => b.textContent.trim()).join(','));
  eq(t1, t0, '时间档四数不该被数字档带跑（切档不静默带数）');
  await page.click('#segCxSrc button[data-src="nums"]'); await page.waitForTimeout(200);
  const kept = await page.evaluate(() => ['cxN0', 'cxN1', 'cxN2', 'cxN3'].map(id => document.getElementById(id).value).join(','));
  eq(kept, '9,9,9,9', '数字档自己填的字要留着');

  /* 数字档没有「此刻 / 随机四数」这类按钮，也没有结果预览 */
  const noExtra = await page.evaluate(() => ({
    ids: ['btnCxNow', 'btnCxRand', 'segCxPick'].filter(id => document.getElementById(id)),
    btns: [...document.querySelectorAll('#cxPanelNums button')].map(b => b.id || b.textContent.trim()),
    nms: document.querySelectorAll('#cxstage .nm, #cxstage .cxqin').length
  }));
  eq(noExtra.ids.length, 0, '旧 id（btnCxNow/btnCxRand/segCxPick）都不该在');
  eq(noExtra.btns.length, 0, '数字档里不该有多余按钮，实得 ' + JSON.stringify(noExtra.btns));
  eq(noExtra.nms, 0, '三档里都不该出现译名/六亲（结果到课页看）');

  console.log('  脚本报错：', errs.length ? JSON.stringify(errs) : '无');
  const s = stats();
  console.log(`\nP4 汇总：${s.pass} 过 / ${s.fail} 败`);
  await browser.close();
})();
