'use strict';
const { boot, ok, eq, info, stats } = require('./lib.js');
const OUT = '/tmp/t7/out';
(async () => {
  const { browser, page, errs, init } = await boot();
  await init({ theme: 'white', cxMode: 'six' });
  await page.click('#tabbar button[data-view="set"]'); await page.waitForTimeout(250);
  const setScan = await page.evaluate(() => {
    const v = document.getElementById('view-set');
    const all = [...v.querySelectorAll('input, [role=checkbox]')].map(e => ({ tag: e.tagName, type: e.type, id: e.id, hidden: getComputedStyle(e).display === 'none' }));
    return {
      checks: v.querySelectorAll('input[type=checkbox]').length,
      roles: v.querySelectorAll('[role=checkbox]').length,
      cxmode: v.querySelectorAll('.cxmode').length,
      inputs: all,
      text: (v.innerText.match(/六神|九星口径/g) || []),
      cxWords: [...v.querySelectorAll('*')].filter(e => e.children.length === 0 && /串星课.*口径|六神／九星|六神\/九星/.test(e.textContent || '')).map(e => e.textContent.trim())
    };
  });
  console.log('  设置页：', JSON.stringify(setScan).slice(0, 400));
  eq(setScan.checks, 0, '设置页 checkbox 数应为 0');
  eq(setScan.roles, 0, '设置页 role=checkbox 数应为 0');
  eq(setScan.cxmode, 0, '设置页 .cxmode 数应为 0');
  eq(setScan.text.length, 0, '设置页正文不该出现「六神」字样');
  eq(setScan.cxWords.length, 0, '设置页不该有口径备注行');

  /* 玄夜 · 课页实拍（水色现状证据） */
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('xymq.set.v1') || '{}'); s.theme = 'blue'; s.cxMode = 'six'; localStorage.setItem('xymq.set.v1', JSON.stringify(s)); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('booting'));
  await page.waitForTimeout(250);
  await page.click('#tabbar button[data-view="chuanxing"]'); await page.waitForTimeout(220);
  await page.click('#segCxSrc button[data-src="nums"]'); await page.waitForTimeout(200);
  for (const [i, v] of [[0, '1'], [1, '5'], [2, '2'], [3, '7']]) await page.fill('#cxN' + i, v);
  await page.click('#btnCastX'); await page.waitForTimeout(350);
  await page.screenshot({ path: OUT + '/pop-blue-1527.png' });
  const colors = await page.evaluate(() => [...document.querySelectorAll('#cxPopGrid .nm')].map(e => ({ t: e.textContent, c: getComputedStyle(e).color })));
  console.log('  玄夜课页七格色：', JSON.stringify(colors));
  /* 素白同图 */
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('xymq.set.v1') || '{}'); s.theme = 'white'; localStorage.setItem('xymq.set.v1', JSON.stringify(s)); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('booting'));
  await page.waitForTimeout(250);
  await page.click('#tabbar button[data-view="chuanxing"]'); await page.waitForTimeout(220);
  await page.click('#segCxSrc button[data-src="nums"]'); await page.waitForTimeout(200);
  for (const [i, v] of [[0, '1'], [1, '5'], [2, '2'], [3, '7']]) await page.fill('#cxN' + i, v);
  await page.click('#btnCastX'); await page.waitForTimeout(350);
  await page.screenshot({ path: OUT + '/pop-white-1527.png' });
  /* 零课实拍（0000） */
  await page.evaluate(() => document.getElementById('cxPopBack').click()); await page.waitForTimeout(150);
  for (const [i, v] of [[0, '0'], [1, '0'], [2, '0'], [3, '0']]) await page.fill('#cxN' + i, v);
  await page.click('#btnCastX'); await page.waitForTimeout(350);
  await page.screenshot({ path: OUT + '/pop-white-0000.png' });
  const zero = await page.evaluate(() => ({ sub: document.getElementById('cxPopSub').textContent, nm: [...document.querySelectorAll('#cxPopGrid .nm')].map(e => e.textContent), cls: [...document.querySelectorAll('#cxPopGrid .xcell')].map(e => e.className) }));
  console.log('  零课：', JSON.stringify(zero));
  console.log('  脚本报错：', errs.length ? JSON.stringify(errs) : '无');
  const s = stats();
  console.log(`\nP6 汇总：${s.pass} 过 / ${s.fail} 败`);
  await browser.close();
})();
