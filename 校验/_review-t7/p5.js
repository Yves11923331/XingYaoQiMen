'use strict';
const { boot, ok, eq, info, stats } = require('./lib.js');
const fs = require('fs'); const OUT = '/tmp/t7/out'; fs.mkdirSync(OUT, { recursive: true });
const TH = [['white', '素白'], ['blue', '玄夜'], ['slate', '墨玉'], ['brown', '铜仪']];
function lum(rgb) { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); }
const contrast = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); };
const parse = s => (s.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);

(async () => {
  const { browser, page, errs, init } = await boot();
  await init({ theme: 'white', cxMode: 'six' });
  await page.click('#tabbar button[data-view="chuanxing"]'); await page.waitForTimeout(200);
  await page.click('#segCxSrc button[data-src="nums"]'); await page.waitForTimeout(200);
  for (const [i, v] of [[0, '1'], [1, '5'], [2, '2'], [3, '7']]) await page.fill('#cxN' + i, v);
  await page.click('#btnCastX'); await page.waitForTimeout(300);

  /* ---- A. 五行色现状（水 = 小吉 在 1527 的第 2 格）---- */
  console.log('\n== A. 五行色现状（t14 修复前基线） ==');
  for (const [key, name] of TH) {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), key);
    await page.waitForTimeout(120);
    const s = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('#cxPopGrid .xcell')];
      const nm = (i) => cells[i] && cells[i].querySelector('.nm');
      const cs = getComputedStyle;
      const card = document.querySelector('#cxPop .cxpop-card');
      return {
        xiaoji: cs(nm(1)).color, danan: cs(nm(0)).color,
        cardBg: cs(card).backgroundColor, bodyBg: cs(document.body).backgroundColor,
        elWater: cs(document.documentElement).getPropertyValue('--el-water').trim(),
        elWood: cs(document.documentElement).getPropertyValue('--el-wood').trim(),
        surface: cs(document.documentElement).getPropertyValue('--surface').trim(),
        tokens: Object.fromEntries(['--el-wood', '--el-fire', '--el-earth', '--el-metal', '--el-water', '--surface', '--bg', '--ink'].map(k => [k, cs(document.documentElement).getPropertyValue(k).trim()]))
      };
    });
    const c = contrast(parse(s.xiaoji), parse(s.surface));
    console.log(`[${name}] 小吉(水) 计算色 ${s.xiaoji} · --el-water ${s.elWater} · --surface ${s.surface} · 对比卡片 ${c.toFixed(2)}:1`);
    info(`[${name}] 其余 token：` + JSON.stringify(s.tokens));
    if (key === 'white') {
      ok(s.xiaoji === 'rgb(43, 52, 64)', '素白：水色当前＝#2b3440（t14 前基线，修完应等值 --el-water #16558f）');
    } else {
      ok(s.xiaoji === 'rgb(43, 52, 64)', `[${name}] 仍是写死 #2b3440（已知 bug，待 t14）`);
    }
  }
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'white'));
  await page.waitForTimeout(120);
  /* 先把课页打开着测（上面测的是 #cxPopGrid，课页要先起课） */
  const popOpen = await page.evaluate(() => !!document.querySelector('#cxPopGrid .xcell'));
  ok(popOpen, '（前置）课页七格已在 DOM（起课后方可量色）');

  /* ---- B. 设置页 / 起盘页 / 盘面页零切换入口 + 零文案 ---- */
  console.log('\n== B. 设置页零控件零文案 ==');
  await page.evaluate(() => document.getElementById('cxPopBack').click());
  await page.waitForTimeout(150);
  await page.click('#tabbar button[data-view="set"]');
  await page.waitForTimeout(200);
  const setScan = await page.evaluate(() => {
    const v = document.getElementById('view-set');
    return {
      inputs: v.querySelectorAll('input, [role=checkbox], .cxmode').length,
      texts: [...v.querySelectorAll('*')].filter(e => /六神|九星口径|串星课口径/.test(e.textContent || '') && e.children.length === 0).map(e => e.textContent.trim()).slice(0, 8),
      cxModeKeys: !!(window.App && App.state && App.state.settings && App.state.settings.cxMode)
    };
  });
  console.log('  设置页扫描：', JSON.stringify(setScan));
  eq(setScan.inputs, 0, '设置页不该有任何 input / 勾选控件');
  eq(setScan.texts.length, 0, '设置页不该出现「六神」这类口径文案，实得 ' + JSON.stringify(setScan.texts));
  await page.click('#tabbar button[data-view="home"]'); await page.waitForTimeout(150);
  const homeScan = await page.evaluate(() => document.getElementById('view-home').querySelectorAll('input[type=checkbox], .cxmode, [role=checkbox]').length);
  eq(homeScan, 0, '起盘页不该有切换控件');

  /* ---- C. 盘面同显：阴盘 / 层盘 不显 ---- */
  console.log('\n== C. 盘面同显只在时家盘 ==');
  const showMiniFor = async (setup, label) => {
    await page.evaluate(setup);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('booting'));
    await page.waitForTimeout(250);
    await page.click('#btnCast');
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const box = document.getElementById('xkMini');
      const pan = document.querySelector('.qm-text-pan');
      return {
        display: getComputedStyle(box).display, h: box.getBoundingClientRect().height,
        sub: pan ? pan.dataset.sub : null,
        cells: document.querySelectorAll('#xkMiniGrid .xcell').length,
        title: (document.getElementById('tbTitle') || {}).textContent
      };
    });
    console.log(`  ${label}：pan=${r.sub} 抬头「${(r.title || '').replace(/\s/g, '')}」 mini display=${r.display} 高 ${r.h} 格数 ${r.cells}`);
    return r;
  };
  const timeR = await showMiniFor(() => {
    const s = JSON.parse(localStorage.getItem('xymq.set.v1') || '{}');
    s.theme = 'white'; s.juMethod = 'chaibu'; s.panLesson = true; s.plugins = {};
    localStorage.setItem('xymq.set.v1', JSON.stringify(s));
  }, '时家盘');
  ok(timeR.display !== 'none' && timeR.cells === 7, '时家盘应显示 7 格盘面同显');
  const yinR = await showMiniFor(() => {
    const s = JSON.parse(localStorage.getItem('xymq.set.v1') || '{}');
    s.juMethod = 'yin'; s.panLesson = true;
    localStorage.setItem('xymq.set.v1', JSON.stringify(s));
  }, '阴盘');
  ok(yinR.display === 'none', '阴盘不该显盘面同显（当前口径：未解禁）');
  const layerR = await showMiniFor(() => {
    const s = JSON.parse(localStorage.getItem('xymq.set.v1') || '{}');
    s.juMethod = 'chaibu'; s.panLesson = true; s.plugins = { layers: true };
    localStorage.setItem('xymq.set.v1', JSON.stringify(s));
  }, '四层（年/月/日家可切）');
  ok(layerR.display !== 'none', '四层开着时时家盘仍应显示（层切换本身不关它）');

  /* ---- D. 导出：时间课 + 九星，副行与尺寸 ---- */
  console.log('\n== D. 另一种导出（时间档 + 九星） ==');
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('xymq.set.v1') || '{}');
    s.plugins = {}; s.juMethod = 'chaibu'; s.cxMode = 'star'; s.theme = 'white';
    localStorage.setItem('xymq.set.v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('booting'));
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.__t7 = { texts: [], dashes: [] };
    const raw = CanvasRenderingContext2D.prototype;
    if (!raw.__t7patched) {
      const ft = raw.fillText, sld = raw.setLineDash;
      raw.fillText = function (t, x, y) { try { window.__t7.texts.push(String(t)); } catch (e) {} return ft.apply(this, arguments); };
      raw.setLineDash = function (a) { try { window.__t7.dashes.push(String(a)); } catch (e) {} return sld.apply(this, arguments); };
      raw.__t7patched = true;
    }
  });
  await page.click('#tabbar button[data-view="chuanxing"]'); await page.waitForTimeout(250);
  const dls = []; page.on('download', async d => dls.push(d));
  await page.click('#btnCastX'); await page.waitForTimeout(250);
  const popSub = await page.evaluate(() => document.getElementById('cxPopSub').textContent.trim());
  console.log('  课页副行：', popSub);
  ok(/^九星 · 时间 /.test(popSub) && /四数 /.test(popSub), '时间档九星课副行应为「九星 · 时间 … · 四数 …」');
  await page.evaluate(() => document.getElementById('cxPopShot').click());
  await page.waitForTimeout(1600);
  if (dls.length) {
    const f = `${OUT}/export-time-star.png`; await dls[dls.length - 1].saveAs(f);
    const sharp = require('sharp');
    const meta = await sharp(f).metadata();
    console.log(`  时间/九星 PNG：${meta.width}×${meta.height}   ${fs.statSync(f).size} 字节`);
    eq(`${meta.width}x${meta.height}`, '2000x920', '时间课 PNG 仍是 2000×920（1000×460 @2x）');
  } else ok(false, '时间/九星没拿到导出 PNG');
  const tx = await page.evaluate(() => window.__t7.texts.join(' / '));
  console.log('  图上文字：', tx);
  ok(/四数 10 5 6 10|四数 \d/.test(tx), '时间课副行应把四个数写出来');
  ok(tx.indexOf('三宫') < 0 && tx.indexOf('第四格') < 0, '底部解释行仍不许出现');
  ok(/九星/.test(tx), '图上应标明当前译法（九星）');

  console.log('  脚本报错：', errs.length ? JSON.stringify(errs) : '无');
  const s = stats();
  console.log(`\nP5 汇总：${s.pass} 过 / ${s.fail} 败`);
  await browser.close();
})();
