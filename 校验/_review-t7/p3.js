'use strict';
const { boot, ok, eq, info, stats } = require('./lib.js');
const fs = require('fs');
const path = require('path');
const OUT = '/tmp/t7/out';
fs.mkdirSync(OUT, { recursive: true });
let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.log('no sharp: ' + e.message); }

(async () => {
  const { browser, page, errs, init } = await boot();
  await init({ theme: 'white', cxMode: 'six' });
  await page.click('#tabbar button[data-view="chuanxing"]'); await page.waitForTimeout(200);
  await page.click('#segCxSrc button[data-src="nums"]'); await page.waitForTimeout(200);
  for (const [i, v] of [[0, '1'], [1, '5'], [2, '2'], [3, '7']]) await page.fill('#cxN' + i, v);

  /* 记录 renderLesson 期间的 fillText / setLineDash / 传给 Snapshot 的课 */
  await page.evaluate(() => {
    window.__t7 = { texts: [], dashes: [], shotArgs: null };
    const raw = CanvasRenderingContext2D.prototype;
    if (!raw.__t7patched) {
      const ft = raw.fillText, sld = raw.setLineDash;
      raw.fillText = function (t, x, y) { try { window.__t7.texts.push({ t: String(t), x, y }); } catch (e) {} return ft.apply(this, arguments); };
      raw.setLineDash = function (a) { try { window.__t7.dashes.push(String(a)); } catch (e) {} return sld.apply(this, arguments); };
      raw.__t7patched = true;
    }
    const S = window.Snapshot, shot = S.shot;
    S.shot = function (chart, an, sm, toast, face, opts) {
      window.__t7.shotArgs = { lesson: opts && opts.lesson ? JSON.parse(JSON.stringify(opts.lesson)) : null, opacity: opts && opts.opacity };
      window.__t7.stateLesson = JSON.parse(JSON.stringify(App.state.cxLesson));
      window.__t7.texts = []; window.__t7.dashes = [];
      return shot.apply(this, arguments);
    };
  });

  /* 触发真实「截图」 */
  await page.click('#btnCastX'); await page.waitForTimeout(220);
  const dls = [];
  page.on('download', async d => { dls.push(d); });
  await page.evaluate(() => document.getElementById('cxPopShot').click());
  await page.waitForTimeout(1800);
  info('下载事件数：' + dls.length);
  let saved = null;
  if (dls.length) {
    saved = path.join(OUT, 'export-six.png');
    await dls[0].saveAs(saved);
  }
  const shot = await page.evaluate(() => ({
    args: window.__t7.shotArgs, state: window.__t7.stateLesson,
    texts: window.__t7.texts, dashes: window.__t7.dashes
  }));
  eq(shot.args.lesson.nums.join(','), shot.state.nums.join(','), '导出与课页同源：四数一致');
  eq(shot.args.lesson.three.map(x => x.name).join('/'), shot.state.three.map(x => x.name).join('/'), '导出与课页同源：三宫名一致');
  eq(shot.args.lesson.three.map(x => x.qin).join('/'), shot.state.three.map(x => x.qin).join('/'), '导出与课页同源：六亲一致');
  const txt = shot.texts.map(x => x.t).join('\n');
  console.log('  出图文字（renderLesson）：\n    ' + shot.texts.map(x => x.t).join(' / '));
  ok(/四数 1527 · 天干 庚 · 六神/.test(txt), '四数副行应在图上（含译法与天干）');
  ok(txt.indexOf('三宫') < 0, '已删的「三宫 = 天宫 · 地宫 · 人宫」那行不许再出现');
  ok(txt.indexOf('第四格') < 0, '「第四格 主体 = 天干」不许再出现');
  eq(shot.dashes.length, 0, '出图不许用 setLineDash（空亡不画虚线），实得 ' + JSON.stringify(shot.dashes));

  /* PNG 真像素 */
  if (saved && sharp) {
    const meta = await sharp(saved).metadata();
    const st = fs.statSync(saved);
    console.log(`  导出 PNG：${meta.width}×${meta.height}   ${st.size} 字节   ${saved}`);
    eq(meta.width + 'x' + meta.height, '2000x920', 'PNG 实际像素应为 2000×920（=1000×460 @2x）');
    ok(Math.abs(meta.width / meta.height - 1000 / 460) < 0.005, '宽高比应是 1000:460（无拉长），实得 ' + (meta.width / meta.height).toFixed(4));
    ok(st.size > 20000, 'PNG 内容不该是空白（' + st.size + ' 字节）');
    /* 四数副行 y ≈ 44+48+38+38+30+26 = 224（逻辑坐标）→ 像素 448 */
    const { data, info: ii } = await sharp(saved).raw().toBuffer({ resolveWithObject: true });
    const px = (x, y) => { const i = (y * ii.width + x) * ii.channels; return [data[i], data[i + 1], data[i + 2]]; };
    const rowInk = (y) => {
      let n = 0;
      for (let x = 0; x < ii.width; x++) { const [r, g, b] = px(x, y); if (Math.abs(r - 255) + Math.abs(g - 255) + Math.abs(b - 255) > 30) n++; }
      return n;
    };
    const bands = [];
    for (let y = 400; y < 500; y++) bands.push([y, rowInk(y)]);
    const numsBand = bands.filter(b => b[1] > 40);
    console.log('  四数副行像素带（y=400..500 有字迹的行）：', numsBand.length ? numsBand.map(b => b[0] + ':' + b[1]).join(' ') : '无');
    ok(numsBand.length > 0, '四数副行所在带（逻辑 y≈224→像素 448 附近）应有字迹');
    /* 底部不该再有被删的那行：逻辑 y≈ cardTop+cardH+... 在最下方 20px 内应无字 */
    const bottomInk = [];
    for (let y = ii.height - 24; y < ii.height - 2; y++) bottomInk.push(rowInk(y));
    console.log('  底部 22 行字迹数：', bottomInk.join(','));
    ok(bottomInk.every(v => v < 8), '图片最底部不该还有一行注解');
  } else {
    ok(false, '没拿到导出 PNG 或 sharp 不可用');
  }

  /* 空亡「只灰无线」出图像素复核：void 与非 void 两次出图做差，差异必须只落在那个字上 */
  const diff = await page.evaluate(() => {
    const L = JSON.parse(JSON.stringify(App.state.cxLesson));
    const chart = App.state.cxTimeChart;
    const cvA = Snapshot.renderLesson(L, chart, {});
    const L2 = JSON.parse(JSON.stringify(L));
    L2.three = L2.three.map(x => Object.assign({}, x, { void: false }));
    const cvB = Snapshot.renderLesson(L2, chart, {});
    const S = 2; /* SCALE */
    const a = cvA.getContext('2d').getImageData(0, 0, cvA.width, cvA.height).data;
    const b = cvB.getContext('2d').getImageData(0, 0, cvB.width, cvB.height).data;
    let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, n = 0;
    for (let y = 0; y < cvA.height; y++) {
      for (let x = 0; x < cvA.width; x++) {
        const i = (y * cvA.width + x) * 4;
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6) {
          n++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    return { w: cvA.width, h: cvA.height, n, minX, maxX, minY, maxY };
  });
  console.log('  void/非void 出图差异：', JSON.stringify(diff));
  ok(diff.n > 100, '空亡换灰应在出图上真的落色（差异像素 >100）');
  ok((diff.maxY - diff.minY) <= 90, '差异高度应只在字身内（≤90 物理像素 = 45 逻辑 px），实得 ' + (diff.maxY - diff.minY));
  ok((diff.maxX - diff.minX) <= 160, '差异宽度应只在「空亡」两字内，实得 ' + (diff.maxX - diff.minX));

  /* ---------- 盘面同显（时间课 · 按盘面那一刻） ---------- */
  console.log('\n== 盘面同显 ==');
  await page.evaluate(() => document.getElementById('cxPopBack').click());
  await page.waitForTimeout(150);
  /* 打开「盘面同显 = 加串星课」 */
  await page.click('#tabbar button[data-view="set"]');
  await page.waitForTimeout(200);
  await page.click('#setChips button[data-g="rule"]');
  await page.waitForTimeout(150);
  await page.evaluate(() => { const b = document.querySelector('#segPanLesson button[data-v="1"]'); if (b) b.click(); });
  await page.waitForTimeout(200);
  /* 起一张时家盘 */
  await page.click('#tabbar button[data-view="home"]');
  await page.waitForTimeout(200);
  await page.click('#btnCast');
  await page.waitForTimeout(700);
  const mini = await page.evaluate(() => {
    const box = document.getElementById('xkMini');
    const chart = App.state.chart;
    let ref = null, err = null;
    try { ref = window.CX.castFromChart(chart, (App.state.cxLesson && App.state.cxLesson.mode) || 'six'); } catch (e) { err = e.message; }
    const cells = [...document.querySelectorAll('#xkMiniGrid .xcell')];
    return {
      display: getComputedStyle(box).display, h: box.getBoundingClientRect().height,
      names: cells.map(c => (c.querySelector('.nm') || {}).textContent || ''),
      ref: ref && ref.ok ? { nums: ref.nums, stem: ref.stem, names: ref.three.map(x => x.name), qins: ref.three.map(x => x.qin) } : null,
      err,
      cal: chart && chart.calendar ? { m: chart.calendar.lunar.month, d: chart.calendar.lunar.day, hz: chart.calendar.index.hourZhi, hg: chart.calendar.index.hourGan } : null,
      switchInMini: box.querySelectorAll('input, .cxmode, [role=checkbox]').length,
      layer: chart && (chart.layer || chart.yinpan || chart.xinpan) || null
    };
  });
  console.log('  盘面同显：', JSON.stringify(mini).slice(0, 500));
  ok(mini.display !== 'none', '时家盘应显示盘面同显串星课');
  eq(mini.switchInMini, 0, '盘面同显里不该有切换控件（含隐藏的）');
  if (mini.ref) {
    eq(mini.names.slice(0, 4).join('/'), mini.ref.names.join('/') + '/' + mini.ref.stem, '盘面同显三宫+天干应与「按盘面 calendar 直译」一致');
    eq(mini.names.slice(4, 7).join('/'), mini.ref.qins.join('/'), '盘面同显六亲应一致');
    const [m, d, hz, hg] = [mini.cal.m, mini.cal.d, mini.cal.hz + 1, mini.cal.hg + 1];
    eq(mini.ref.nums.join(','), [m, d, hz, hg].join(','), '四数应＝农历月/日/时辰序/时干序（盘面那一刻）');
    info('盘面日历：农历 ' + mini.cal.m + '月' + mini.cal.d + '日 · 时辰序 ' + (mini.cal.hz + 1) + ' · 时干序 ' + (mini.cal.hg + 1));
  } else {
    ok(false, '盘面同显取不到课：' + mini.err);
  }
  /* 切一次译法：同显那段也要跟着换名（不重排） */
  await page.click('#btnBack');            /* 盘面页顶栏 ← 回起盘页（盘面页没有底栏） */
  await page.waitForTimeout(300);
  await page.click('#tabbar button[data-view="chuanxing"]');
  await page.waitForTimeout(200);
  await page.click('#cxMode'); await page.waitForTimeout(350);
  await page.click('#tabbar button[data-view="home"]');
  await page.waitForTimeout(200);
  await page.click('#btnCast');
  await page.waitForTimeout(700);
  /* 回盘面页 */
  const mini2 = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#xkMiniGrid .xcell')];
    return { names: cells.map(c => (c.querySelector('.nm') || {}).textContent || '') };
  });
  console.log('  切九星后同显：', mini2.names.join('/'));
  ok(/天蓬|天芮|天冲|天辅|天禽|天心|天柱|天任|天英/.test(mini2.names.join('')), '切到九星后同显应改读九星');
  /* 阴盘：应不显 */
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('xymq.set.v1') || '{}');
    s.theme = 'white'; localStorage.setItem('xymq.set.v1', JSON.stringify(s));
  });

  const s = stats();
  console.log(`\nP3 汇总：${s.pass} 过 / ${s.fail} 败`);
  console.log('  脚本报错：', errs.length ? JSON.stringify(errs) : '无');
  await browser.close();
})();
