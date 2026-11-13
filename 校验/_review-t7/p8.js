'use strict';
const { boot, ok, eq, info, stats } = require('./lib.js');
(async () => {
  const { browser, page, errs, init } = await boot();
  /* 真太阳时 + 喀什经度（东经 76°）：时刻会被推后约 2 小时，四数必须跟着 calendar 走 */
  await init({ theme: 'white', cxMode: 'six', trueSolar: true, lateZi: true, juMethod: 'chaibu',
               lat: 39.47, lon: 75.99 });
  await page.click('#tabbar button[data-view="chuanxing"]'); await page.waitForTimeout(300);
  const t = await page.evaluate(() => {
    const c = App.state.cxTimeChart;
    const nums = [...document.querySelectorAll('#cxTimeNums b')].map(b => b.textContent.trim()).map(Number);
    const ref = window.CX.numsFromChart(c).nums;
    /* 用「标准时」重算一遍（页面副行写着标准时几点） */
    const mStd = /标准时\s*(\d{1,2}):(\d{2})/.exec(document.getElementById('cxSub').textContent);
    const pub = mStd ? window.CX.numsFromChart({ y: c.input.y, m: c.input.m, d: c.input.d, h: +mStd[1], mi: +mStd[2] }) : { ok: false, nums: [] };
    const std = mStd ? (+mStd[1] + ':' + mStd[2]) : '';
    return {
      nums, ref, pub,
      shown: document.getElementById('cxTime').textContent,
      gz: c.calendar.ganzhi.hour, hzIdx: c.calendar.index.hourZhi,
      trueTxt: '标准时 ' + std,
      sub: document.getElementById('cxSub').textContent
    };
  });
  console.log('  真太阳时（东经 76）：', JSON.stringify(t));
  eq(t.nums.join(','), t.ref.join(','), '四数应＝这一盘 calendar 直译');
  ok(t.pub.ok && t.nums.join(',') !== t.pub.nums.join(','), '真太阳时下「按标准时重算」应得出不同四数（' + t.pub.nums.join(',') + '），证明页面读的是这一盘的 calendar');
  info('时间卡：' + t.shown + '（' + t.trueTxt + '）· 时支序 ' + (t.hzIdx + 1) + ' · 四数 ' + t.nums.join(' '));
  console.log('  脚本报错：', errs.length ? JSON.stringify(errs) : '无');
  const s = stats();
  console.log(`\nP8 汇总：${s.pass} 过 / ${s.fail} 败`);
  await browser.close();
})();
