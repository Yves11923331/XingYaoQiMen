/* 探针：阴盘升级为定局法 + 日月年家插件化（2026-11-02）
 * ----------------------------------------------------------------------------
 * 验两件事（用户这轮的两个需求）：
 *   ① 起盘页不再有「阴盘」；设置 → 定局 → 定局法 拆补/置闰/阴盘 三档，
 *      选阴盘后「此时刻」起盘出阴盘；自选局不受定局法影响；切回拆补盘面回普通盘。
 *   ② 设置里的「日月年家」开关没了；四层改由插件（web/plugins/layers.js）控制：
 *      默认关 → 四层隐藏；打开 → 四层出现、能起日家/年家盘；关掉 → 收回时家。
 *
 * 用法（工程根）：
 *   NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_probe_layers_ju.js
 * 退出码 0 = 全过。
 */
const { chromium } = require('playwright-core');
const path = require('path');

const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const URL = 'file://' + path.resolve(__dirname, '..', 'web', 'index.html');

let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
function eq(a, b, msg) { ok(a === b, msg + '（实得 ' + JSON.stringify(a) + '）'); }

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });

  await page.goto(URL);
  await page.waitForTimeout(1200);

  const ev = fn => page.evaluate(fn);
  const clk = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('找不到 ' + s); e.click(); }, sel);
  const st = () => ev(() => window.__xyState());
  const wait = ms => page.waitForTimeout(ms);

  console.log('\n【一】结构：阴盘进定局法、四层开关从设置页消失');
  eq(await ev(() => document.querySelectorAll('#segMode3 > button').length), 4, '起盘页起局方式应为 4 档');
  eq(await ev(() => !!document.querySelector('#segMode3 button[data-m="yin"]')), false, '起盘页不应再有阴盘按钮');
  eq(await ev(() => document.querySelectorAll('#segJu > button').length), 3, '定局法应为 3 档');
  eq(await ev(() => !!document.querySelector('#segJu button[data-v="yin"]')), true, '定局法应有「阴盘」档');
  eq(await ev(() => !!document.getElementById('mp-yin')), false, '阴盘参数面板应已删除');
  eq(await ev(() => !!document.getElementById('segLayers')), false, '设置页不应再有「日月年家」开关');
  ok(await ev(() => document.getElementById('pluginList').textContent.indexOf('日月年家') >= 0), '插件列表里应有「日月年家」卡片');
  eq(await ev(() => getComputedStyle(document.getElementById('segLayer')).display), 'none', '插件默认关时四层切换应隐藏');

  console.log('\n【二】插件打开 → 四层出现、能起日家盘');
  await clk('#segPlugin_layers button[data-v="1"]');
  await wait(300);
  eq(await ev(() => document.getElementById('segLayer').style.display), '', '打开插件后四层切换应显示');
  eq(await ev(() => window.Store.settings.plugins.layers), 1, '插件开关键应落进 settings.plugins.layers');
  await clk('#segLayer button[data-l="ri"]');
  await wait(200);
  eq((await st()).layer, 'ri', '应切到日家');
  await clk('#btnCast');
  await wait(700);
  ok(await ev(() => document.getElementById('view-chart').classList.contains('on')), '应进入盘面页');
  const cRi = (await st()).chart;
  eq(cRi && cRi.layer, 'ri', '起出来的应是日家盘');
  ok(await ev(() => (document.getElementById('tbTitle').textContent || '').indexOf('日家') >= 0), '抬头应标「日家」');

  console.log('\n【三】插件关掉 → 四层收回、层回时家');
  await clk('#btnBack');
  await wait(250);
  await clk('#segPlugin_layers button[data-v="0"]');
  await wait(350);
  eq(await ev(() => getComputedStyle(document.getElementById('segLayer')).display), 'none', '关闭插件后四层应隐藏');
  eq((await st()).layer, 'shi', '关闭插件后层应收回时家');

  console.log('\n【四】定局法=阴盘：此时刻起盘出阴盘');
  await clk('#segJu button[data-v="yin"]');
  await wait(250);
  eq((await st()).settings.juMethod, 'yin', '定局法应落成 yin');
  await clk('#segMode3 button[data-m="time"]');
  await ev(() => {
    const el = document.getElementById('dtPick');
    el.value = '2026-01-01T04:00';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await clk('#btnCast');
  await wait(800);
  const cYin = (await st()).chart;
  ok(cYin && cYin.yinpan === true, '此时刻起盘应出阴盘（chart.yinpan）');
  eq(await ev(() => (document.querySelector('.qm-text-pan') || {}).dataset && document.querySelector('.qm-text-pan').dataset.sub), 'yin', '盘面应带 data-sub=yin');
  ok((await ev(() => document.getElementById('tbTitle').textContent)).replace(/\s/g, '').indexOf('阴盘') >= 0, '抬头应写「阴盘」');

  console.log('\n【五】定局法=阴盘 + 自选局：手动盘，定局法管不着');
  await clk('#btnBack');
  await wait(250);
  await clk('#segMode3 button[data-m="manual"]');
  await wait(150);
  await clk('#btnCast');
  await wait(700);
  const cMan = (await st()).chart;
  ok(cMan && cMan.manual === true, '自选局应出手动盘（manual）');
  ok(cMan && !cMan.yinpan, '定局法=阴盘对自选局无效，不该出阴盘');

  console.log('\n【六】切回拆补：盘面跟着重排回普通盘');
  await clk('#segJu button[data-v="chaibu"]');
  await wait(500);
  eq((await st()).settings.juMethod, 'chaibu', '定局法应落回 chaibu');
  const cBack = (await st()).chart;
  ok(cBack && !cBack.yinpan, '切回拆补后盘应不是阴盘');
  eq(await ev(() => document.querySelector('.qm-text-pan').dataset.sub), 'pan', '盘面应回到 data-sub=pan');

  console.log('\n【七】定局法=阴盘时，四层仍按本层起盘');
  await clk('#segPlugin_layers button[data-v="1"]');
  await wait(250);
  await clk('#segJu button[data-v="yin"]');
  await wait(250);
  await clk('#btnBack');
  await wait(200);
  await clk('#segLayer button[data-l="nian"]');
  await wait(200);
  await clk('#btnCast');
  await wait(700);
  const cNian = (await st()).chart;
  eq((await st()).layer, 'nian', '应切到年家');
  ok(cNian && cNian.layer === 'nian' && !cNian.yinpan, '四层不受定局法影响，仍起本层盘');

  console.log('\n【八】页面无报错');
  ok(errs.length === 0, '无页面报错' + (errs.length ? '：' + errs.join(' | ') : ''));

  console.log(`\n结果：${pass} 过 / ${fail} 败`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
