/* t15 收尾复核：导出图 A 版式（真 Chromium 点「截图」+ 我自己的像素行带量测）
 * 跑法：T7URL=http://127.0.0.1:8801/ NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules \
 *        node 校验/_review-t7/p10-export.js
 * 只读：不写源码，只把 PNG 落到 /tmp。
 */
'use strict';
const { boot, ok, eq, info, stats } = require('./lib.js');
const fs = require('fs'); const path = require('path');
const OUT = '/tmp/t7/out2'; fs.mkdirSync(OUT, { recursive: true });
let sharp; try { sharp = require('sharp'); } catch (e) { console.log('no sharp'); }

/* 我自己从 PNG 量行带：逐行数「非底色」像素，>=8 视为有字迹；带间空行 >=3 切成一段 */
async function rowBands(file, sc) {
  const { data, info: ii } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const bg = [data[0], data[1], data[2]];
  const rows = [];
  for (let y = 0; y < ii.height; y++) {
    let n = 0;
    for (let x = 0; x < ii.width; x++) {
      const i = (y * ii.width + x) * ii.channels;
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 24) n++;
    }
    rows.push(n);
  }
  const bands = []; let st = -1, gap = 0;
  for (let y = 0; y < rows.length; y++) {
    if (rows[y] >= 8) { if (st < 0) st = y; gap = 0; }
    else if (st >= 0) { gap++; if (gap >= 3) { bands.push([st, y - gap]); st = -1; gap = 0; } }
  }
  if (st >= 0) bands.push([st, rows.length - 1]);
  return { bands: bands.map(([a, b]) => [+(a / sc).toFixed(1), +((b + 1) / sc).toFixed(1)]), w: ii.width, h: ii.height };
}

(async () => {
  const { browser, page, errs, init } = await boot();
  await init({ theme: 'white', cxMode: 'six', juMethod: 'chaibu', plugins: {} });
  const enter = async () => { await page.click('#tabbar button[data-view="chuanxing"]'); await page.waitForTimeout(240); };

  /* hook：记录 renderLesson 里每次 fillText 的「字号 + 颜色 + 文本 + 基线 y」 */
  const arm = async () => page.evaluate(() => {
    window.__e = { calls: [], dashes: 0 };
    const raw = CanvasRenderingContext2D.prototype;
    if (!raw.__ePatched) {
      const ft = raw.fillText, sld = raw.setLineDash;
      raw.fillText = function (t, x, y) {
        try { window.__e.calls.push({ t: String(t), y: y, font: this.font, fill: String(this.fillStyle) }); } catch (e) {}
        return ft.apply(this, arguments);
      };
      raw.setLineDash = function (a) { try { window.__e.dashes++; } catch (e) {} return sld.apply(this, arguments); };
      raw.__ePatched = true;
    }
    window.__e.calls = []; window.__e.dashes = 0;
  });

  await enter();
  await page.click('#segCxSrc button[data-src="nums"]'); await page.waitForTimeout(220);
  for (const [i, v] of [[0, '1'], [1, '5'], [2, '2'], [3, '7']]) await page.fill('#cxN' + i, v);
  await page.click('#btnCastX'); await page.waitForTimeout(250);
  await arm();

  /* Chromium 对 blob: 下载的 suggestedFilename() 恒为 "download"（无 Content-Disposition），
     所以文件名要查页面真的挂在 <a download> 上的那个值 */
  await page.evaluate(() => {
    window.__dl = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      try { window.__dl.push(this.download); } catch (e) {}
      return orig.apply(this, arguments);
    };
  });
  const dls = []; page.on('download', d => dls.push(d));
  await page.evaluate(() => document.getElementById('cxPopShot').click());
  await page.waitForTimeout(2000);
  const calls = await page.evaluate(() => ({ c: window.__e.calls, d: window.__e.dashes, names: window.__dl }));
  ok(dls.length === 1, '点「截图」应恰好产生一次下载（实得 ' + dls.length + '）');
  let f = null, fname = (calls.names && calls.names[0]) || '';
  if (dls.length) { f = path.join(OUT, 'shot.png'); await dls[0].saveAs(f); }
  console.log('  落盘文件名：' + fname);
  ok(/^串星课_\d{8}_\d{4}\.png$/.test(fname), '文件名应是 串星课_YYYYMMDD_HHMM.png（实得 ' + fname + '）');
  eq(calls.d, 0, 'setLineDash 调用次数');

  /* 字号台账（从 fillText 实录读） */
  const by = (re) => calls.c.filter(x => re.test(x.t));
  const title = by(/^串星课$/)[0], nums = by(/^数字 1527/)[0], pillars = by(/^丙午|^[甲乙丙丁戊己庚辛壬癸].*时$/)[0];
  const timeLine = by(/^\d{4}-\d\d-\d\d \d\d:\d\d$/)[0], infoLine = by(/局|农历/)[0];
  const names = calls.c.filter(x => /^(大安|小吉|空亡|庚)$/.test(x.t));
  const qins = calls.c.filter(x => /^(妻财|子孙|父母)$/.test(x.t));
  const fontPx = (s) => { const m = /(\d+(?:\.\d+)?)px/.exec(s || ''); return m ? +m[1] : 0; };
  const led = {
    title: fontPx(title && title.font), time: fontPx(timeLine && timeLine.font),
    pillars: fontPx(pillars && pillars.font), info: fontPx(infoLine && infoLine.font),
    nums: fontPx(nums && nums.font),
    names: names.map(x => fontPx(x.font)), qins: qins.map(x => fontPx(x.font)),
    nameY: names.map(x => +x.y.toFixed(1)), qinY: qins.map(x => +x.y.toFixed(1)),
    nameColors: names.map(x => x.fill)
  };
  console.log('  字号台账（实录）：', JSON.stringify(led));
  eq(led.title, 40, '标题 40px');
  eq(led.time, 22, '时刻 22px');
  eq(led.pillars, 34, '四柱 34px');
  eq(led.info, 18, '局·农历 18px');
  eq(led.nums, 19, '四数副行 19px');
  eq(led.names.slice(0, 3).join(','), '42,42,42', '三宫名 42px');
  eq(led.names[3], 34, '天干降一档 34px');
  eq(led.qins.join(','), '22,22,22', '六亲 22px');
  eq(+(led.qinY[0] - led.nameY[0]).toFixed(1), 46, '六亲在名字下 46px');
  info('书口线 y = 六亲 + 12 = ' + (led.qinY[0] + 12) + '（代码 ruleY=qinY+12）');

  /* PNG 真像素：尺寸 + 我自己量的行带 + 卡片宽 */
  if (f && sharp) {
    const meta = await sharp(f).metadata(); const sz = fs.statSync(f).size;
    console.log(`  PNG：${meta.width}×${meta.height}  ${sz} 字节`);
    eq(meta.width + 'x' + meta.height, '2000x920', 'PNG 应是 2000×920（1000×460@2x）');
    const rb = await rowBands(f, 2);
    console.log('  我从像素量的行带（CSS px，[起,止)）：', JSON.stringify(rb.bands));
    const LEDGER = [[53.5, 92], [108.5, 124], [138, 171], [182.5, 200], [215.5, 234.5], [261.5, 410]];
    /* 前 5 条是文字行；第 6 条（卡片）我按「卡片上框 → 最后一条带的下缘」合并
       —— 卡片内部只有左右两根 1px 竖边，逐行不足 8 像素会被我的切带规则切碎 */
    const pick = rb.bands.slice(0, 5).concat([[rb.bands[5][0], rb.bands[rb.bands.length - 1][1]]]);
    const diffs = pick.map((b, i) => LEDGER[i] ? Math.max(Math.abs(b[0] - LEDGER[i][0]), Math.abs(b[1] - LEDGER[i][1])) : 999);
    console.log('  与 ui 台账逐带最大偏差：', diffs.map(d => d.toFixed(1)).join(' / '));
    ok(diffs.every(d => d <= 2), '六条行带与 ui 台账偏差应 ≤2px（实得 ' + diffs.map(d => d.toFixed(1)).join('/') + '）');
    /* 卡片宽：在卡片中线那一行找最左/最右非底色像素（边框） */
    const midY = Math.round((LEDGER[5][0] + LEDGER[5][1]) / 2 * 2);
    const { data, info: ii } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
    const bg = [data[0], data[1], data[2]];
    let L = -1, R = -1;
    for (let x = 0; x < ii.width; x++) {
      const i = (midY * ii.width + x) * ii.channels;
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 10) { if (L < 0) L = x; R = x; }
    }
    console.log(`  卡片左右边缘（物理 px）：${L} … ${R}  → 宽 ${((R - L + 1) / 2).toFixed(1)} CSS px`);
    ok(Math.abs((R - L + 1) / 2 - 740) <= 4, '卡片宽应 740±4（74%）');
    ok(Math.abs(L / 2 - 130) <= 4, '卡片左边应在 130±4（居中）');
  } else ok(false, '没拿到 PNG 或 sharp 不可用');

  /* 玄夜：水色必须是 --el-water #6fb4f5，且出图里用的也是它 */
  console.log('\n== 玄夜：水色 ==');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('xymq.set.v1') || '{}'); s.theme = 'blue'; localStorage.setItem('xymq.set.v1', JSON.stringify(s)); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('booting'));
  await page.waitForTimeout(300);
  await enter();
  await page.click('#segCxSrc button[data-src="nums"]'); await page.waitForTimeout(220);
  for (const [i, v] of [[0, '1'], [1, '5'], [2, '2'], [3, '7']]) await page.fill('#cxN' + i, v);
  await page.click('#btnCastX'); await page.waitForTimeout(250);
  const dark = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#cxPopGrid .xcell')];
    const xj = cells.find(c => (c.querySelector('.nm') || {}).textContent === '小吉');
    return {
      screen: xj ? getComputedStyle(xj.querySelector('.nm')).color : null,
      token: getComputedStyle(document.documentElement).getPropertyValue('--el-water').trim(),
      tint: xj ? xj.getAttribute('style') : null
    };
  });
  await arm();
  const calls2 = await page.evaluate(() => {
    Snapshot.renderLesson(App.state.cxLesson, App.state.cxTimeChart, {});
    return window.__e.calls.filter(x => /^(大安|小吉|空亡|庚)$/.test(x.t)).map(x => ({ t: x.t, fill: x.fill, font: x.font }));
  });
  console.log('  屏幕小吉：' + dark.screen + ' · token ' + dark.token + ' · 行内 ' + dark.tint);
  console.log('  出图四格色：', JSON.stringify(calls2));
  eq(dark.token.toLowerCase(), '#6fb4f5', '玄夜 --el-water 应是 #6fb4f5');
  eq(dark.screen, 'rgb(111, 180, 245)', '玄夜屏幕小吉应是 #6fb4f5');
  const water = calls2.find(x => x.t === '小吉');
  ok(water && /#6fb4f5/i.test(water.fill), '玄夜出图小吉应填 #6fb4f5（实得 ' + (water && water.fill) + '）');
  ok(!/#2b3440/i.test(JSON.stringify(calls2)), '出图里不许再出现旧 #2b3440');

  /* renderBoth：2026-11-13 起同显＝**标准盘 + 中宫里的课**（与屏幕同一版式）。
     旧版"抬头带里塞课块 + 四柱缩放 + 1784 高画布"整体退役，这条判据跟着换。 */
  console.log('\n== renderBoth 中宫课 ==');
  const both = await page.evaluate(() => {
    const chart = App.state.cxTimeChart;
    window.__e.calls = [];
    let cv = null, cvPan = null;
    try {
      cv = Snapshot.renderBoth(chart, App.state.analysis, App.state.starMap, App.state.face || 'front', { lesson: App.state.cxLesson });
      cvPan = Snapshot.render(chart, App.state.analysis, App.state.starMap, App.state.face || 'front', {});
    } catch (e) { return { err: e.message }; }
    const calls = window.__e.calls.map(x => ({ t: x.t, font: x.font, y: +x.y.toFixed(1) }));
    return { w: cv.width, h: cv.height, pw: cvPan.width, ph: cvPan.height, calls };
  });
  if (both.err) ok(false, 'renderBoth 抛错：' + both.err);
  else {
    const pick = (re) => both.calls.filter(x => re.test(x.t));
    const px = (s) => +((/(\d+(?:\.\d+)?)px/.exec(s || '') || [0, 0])[1]);
    const nm = pick(/^(大安|留连|速喜|赤口|小吉|空亡)$/);
    ok(nm.length >= 3, 'renderBoth 三宫名都画了（实得 ' + nm.length + '）');
    ok(nm.length > 0 && px(nm[0].font) > 30 && px(nm[0].font) < 40, 'renderBoth 宫名按中宫格比例（13×w/112，实得 ' + (nm[0] && nm[0].font) + '）');
    ok(pick(/^[串星课]$/).length === 3, 'renderBoth 画了中宫角标「串星课」三字');
    ok(pick(/^中$/).length === 0, 'renderBoth 中宫不再画「中5」标签（整格交给课）');
    ok(!pick(/^(妻财|子孙|父母)$/).some(x => px(x.font) === 19), 'renderBoth 不再画抬头带旧课块（六亲 19px 那套已退役）');
    ok(both.w === both.pw && both.h === both.ph, 'renderBoth 与普通盘面图同尺寸（' + both.w + '×' + both.h + '）');
  }

  console.log('  脚本报错：', errs.length ? JSON.stringify(errs) : '无');
  const s = stats();
  console.log(`\nP10 汇总：${s.pass} 过 / ${s.fail} 败`);
  await browser.close();
})();
