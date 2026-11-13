'use strict';
const { boot, ok, eq, info, stats } = require('./lib.js');
(async () => {
  const { browser, page, errs, init } = await boot();
  /* 真太阳时开着：时间档四数必须读「这一盘」的 calendar（不是拿公历重算） */
  await init({ theme: 'white', cxMode: 'six', trueSolar: true, lateZi: true, juMethod: 'chaibu' });
  await page.click('#tabbar button[data-view="chuanxing"]'); await page.waitForTimeout(250);
  const t = await page.evaluate(() => {
    const c = App.state.cxTimeChart;
    const nums = [...document.querySelectorAll('#cxTimeNums b')].map(b => b.textContent.trim()).map(Number);
    const ref = window.CX.numsFromChart(c);
    const pub = window.CX.numsFromChart({ y: c.input.y, m: c.input.m, d: c.input.d, h: c.input.h, mi: c.input.mi });
    return {
      nums, ref: ref.nums, pub: pub.nums,
      cal: { m: c.calendar.lunar.month, d: c.calendar.lunar.day, hz: c.calendar.index.hourZhi, hg: c.calendar.index.hourGan },
      hourTxt: document.getElementById('cxTime').textContent,
      comp: c.calendar.compensated, late: c.calendar.lateZiAdvance,
      panelText: document.getElementById('cxPanelTime').innerText.replace(/\s+/g, ' ')
    };
  });
  console.log('  时间档：', JSON.stringify(t));
  eq(t.nums.join(','), t.ref.join(','), '时间档四数应等于 numsFromChart(这一盘的 calendar)');
  eq(t.nums.join(','), [t.cal.m, t.cal.d, t.cal.hz + 1, t.cal.hg + 1].join(','), '四数＝农历月 / 农历日 / 时辰序 / 时干序');
  ok(t.panelText.indexOf('农历') < 0, '时间档说明小字已删（不该出现「农历」）');
  ok(t.panelText.indexOf('只读') < 0, '时间档不该出现「只读」二字');
  ok(!(await page.evaluate(() => !!document.getElementById('cxTimeFrom'))), '#cxTimeFrom 节点不该存在');
  ok(await page.evaluate(() => !!document.getElementById('cxTimeHelp')), 'ⓘ #cxTimeHelp 仍在');
  if (t.comp !== undefined) info('真太阳时补偿后时刻：' + t.comp + '（标准时 ' + t.hourTxt + '）');

  /* 晚子时：23:30 那天，四数里的「时辰序」应仍按时支（子=1），日期按换日规则 */
  await page.evaluate(() => {
    const e = document.getElementById('cxPick');
    e.value = '2026-11-13T23:30'; e.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  const late = await page.evaluate(() => {
    const c = App.state.cxTimeChart;
    return { nums: [...document.querySelectorAll('#cxTimeNums b')].map(b => b.textContent.trim()), ref: window.CX.numsFromChart(c).nums, late: c.calendar.lateZiAdvance, hour: document.getElementById('cxTime').textContent };
  });
  console.log('  晚子时：', JSON.stringify(late));
  eq(late.nums.join(','), late.ref.join(','), '晚子时下四数仍随这一盘的 calendar');

  /* 阴盘 / 心盘 / 手动局：时间档要能给出「取不到」而不是崩 */
  console.log('  脚本报错：', errs.length ? JSON.stringify(errs) : '无');
  ok(errs.length === 0, '本轮无脚本报错：' + errs.join(' | '));
  const s = stats();
  console.log(`\nP7 汇总：${s.pass} 过 / ${s.fail} 败`);
  await browser.close();
})();
