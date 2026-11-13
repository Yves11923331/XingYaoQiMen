/* t14/t15 落地后的补跑判据（captain 2026-11-13 拍板：一律主题化，五色 × 四主题都取 --el-*）
 *
 * 跑法：
 *   cd (process.env.XYQ_ROOT || process.cwd())
 *   python3 -m http.server 8801 --bind 127.0.0.1 --directory web &
 *   T7URL=http://127.0.0.1:8801/ NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules \
 *     node 校验/_review-t7/p9-colors.js
 *
 * 四条判据（captain 定）：
 *   ① 四主题下每个五行色的**实际渲染色 == 该主题的 --el-* 值**（逐色断言，五色全查）
 *   ② 深色三套：五色对课卡背景对比 ≥ 4.5:1（不足则 ≥3:1 并记录实测）
 *   ③ 素白：串星课的「水」色 == 盘面某宫干的水色（跨组件一致性，取 .qm-el-water 的实际渲染色）
 *   ④ 空亡仍是 --ink-3 灰、无边框/无伪元素、出图 setLineDash 调用 0 次
 *
 * 未落地（t14 之前）跑一遍应当是**失败**的 —— 那是判据有效性的自证，不是回归。
 * 只读不写：不改任何源码、不落图（除 canvas 内部渲染）。
 */
'use strict';
const { boot, ok, eq, info, stats } = require('./lib.js');
const TH = [['white', '素白'], ['blue', '玄夜'], ['slate', '墨玉'], ['brown', '铜仪']];
const DARK = { blue: 1, slate: 1, brown: 1 };
const EL = ['木', '火', '土', '金', '水'];

function lum(rgb) { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); }
const contrast = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); };
const parse = s => { const m = /^#([0-9a-f]{6})$/i.exec(String(s).trim()); if (m) return [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16)); return (String(s).match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number); };
const hex = (rgb) => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
const near = (a, b, tol) => Math.max(...[0, 1, 2].map(i => Math.abs(a[i] - b[i]))) <= (tol || 1);

/* 覆盖五行的三组四数（六神）：(1,1,1,1)=大安×3 木；(2,2,2,2)=留连土/速喜火/赤口金；(5,1,1,1)=小吉水 */
const CASTS = [
  { nums: [1, 1, 1, 1], want: { 大安: '木' } },
  { nums: [2, 2, 2, 2], want: { 留连: '土', 速喜: '火', 赤口: '金' } },
  { nums: [5, 1, 1, 1], want: { 小吉: '水' } }
];

(async () => {
  const { browser, page, errs, init } = await boot();
  await init({ theme: 'white', cxMode: 'six' });
  const enter = async () => { await page.click('#tabbar button[data-view="chuanxing"]'); await page.waitForTimeout(220); };
  const tabNums = async () => { await page.click('#segCxSrc button[data-src="nums"]'); await page.waitForTimeout(200); };
  const closePop = async () => { await page.evaluate(() => document.getElementById('cxPopBack').click()); await page.waitForTimeout(120); };

  /* 收集每个主题下「六神名 → 渲染出的色」 */
  const rendered = {};      /* theme -> { 大安:'rgb()', ... } */
  for (const [key, name] of TH) {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), key);
    await page.waitForTimeout(120);
    await enter(); await tabNums();
    rendered[key] = {};
    for (const c of CASTS) {
      for (let i = 0; i < 4; i++) await page.fill('#cxN' + i, String(c.nums[i]));
      await page.waitForTimeout(60);
      await page.click('#btnCastX'); await page.waitForTimeout(220);
      const got = await page.evaluate(() => [...document.querySelectorAll('#cxPopGrid .xcell')].slice(0, 3)
        .map(c => ({ n: (c.querySelector('.nm') || {}).textContent, c: getComputedStyle(c.querySelector('.nm')).color })));
      got.forEach(g => { if (g.n) rendered[key][g.n] = g.c; });
      await closePop();
    }
  }

  /* ① 逐色断言：渲染色 == 该主题 --el-* */
  console.log('\n== ① 渲染色 == 该主题 --el-*（五色 × 四主题） ==');
  for (const [key, name] of TH) {
    const toks = await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
      const cs = getComputedStyle(document.documentElement);
      const o = {};
      ['木', '火', '土', '金', '水'].forEach(w => { o[w] = cs.getPropertyValue('--el-' + ({ 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' }[w])).trim(); });
      o['--surface'] = cs.getPropertyValue('--surface').trim();
      return o;
    }, key);
    await page.waitForTimeout(60);
    const seen = {};
    for (const c of CASTS) for (const nm in c.want) {
      const wx = c.want[nm];
      if (!rendered[key][nm]) { ok(false, `[${name}] ${nm} 没渲染出来，无法核色`); continue; }
      seen[wx] = rendered[key][nm];
    }
    for (const wx of EL) {
      const got = seen[wx], want = toks[wx];
      if (!got) { ok(false, `[${name}] ${wx} 没取到渲染样本`); continue; }
      ok(near(parse(got), parse(want), 1), `[${name}] ${wx} 渲染色 ${got} 应等于 --el-${wx} ${want}（实差 ${hex(parse(got))} vs ${hex(parse(want))}）`);
    }
    /* ② 深色：五色对课卡背景对比 */
    const bg = parse(toks['--surface']);
    const rows = EL.map(wx => ({ wx, c: seen[wx], r: seen[wx] ? +contrast(parse(seen[wx]), bg).toFixed(2) : 0 }));
    console.log(`  [${name}] 五色对比（背景 --surface ${toks['--surface']}）：` + rows.map(x => `${x.wx} ${x.r}:1`).join(' · '));
    if (DARK[key]) {
      rows.forEach(x => {
        ok(x.r >= 4.5, `[${name}] ${x.wx} 对比应 ≥4.5:1（实得 ${x.r}:1）`);
        if (x.r < 3) ok(false, `[${name}] ${x.wx} 连 3:1 都不到（${x.r}:1），必须记录并修`);
      });
    }
  }

  /* ③ 素白：串星课水色 == 盘面某宫干水色（跨组件） */
  console.log('\n== ③ 素白：与盘面水色跨组件一致 ==');
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('xymq.set.v1') || '{}');
    s.theme = 'white'; s.cxMode = 'six'; s.juMethod = 'chaibu'; s.plugins = {};
    localStorage.setItem('xymq.set.v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('booting'));
  await page.waitForTimeout(300);
  await page.click('#btnCast');                       /* 起一张时家盘 */
  await page.waitForTimeout(900);
  const panWater = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.qm-el-water')];
    const inPan = els.filter(e => e.closest('.qm-text-pan'));
    const e = inPan[0];
    return e ? { color: getComputedStyle(e).color, text: e.textContent, n: inPan.length } : { color: null, n: 0 };
  });
  await page.click('#btnBack'); await page.waitForTimeout(300);
  await enter(); await tabNums();
  for (const [i, v] of [[0, '5'], [1, '1'], [2, '1'], [3, '1']]) await page.fill('#cxN' + i, v);
  await page.click('#btnCastX'); await page.waitForTimeout(250);
  const cxWater = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#cxPopGrid .xcell')];
    const c = cells.find(x => (x.querySelector('.nm') || {}).textContent === '小吉');
    return c ? getComputedStyle(c.querySelector('.nm')).color : null;
  });
  console.log(`  盘面水色（.qm-el-water ×${panWater.n}）${panWater.color}（字「${panWater.text}」） · 串星课小吉 ${cxWater}`);
  ok(!!panWater.color, '盘面里应能找到 .qm-el-water 的宫/干');
  ok(!!cxWater && near(parse(cxWater), parse(panWater.color), 1), `串星课水色 ${cxWater} 应与盘面水色 ${panWater.color} 一致`);

  /* ④ 空亡：仍是 --ink-3、无线；出图 setLineDash 0 次 */
  console.log('\n== ④ 空亡仍只灰无线 ==');
  await page.evaluate(() => document.getElementById('cxPopBack').click());
  await page.waitForTimeout(150);
  for (const [i, v] of [[0, '1'], [1, '5'], [2, '2'], [3, '7']]) await page.fill('#cxN' + i, v);
  await page.click('#btnCastX'); await page.waitForTimeout(250);
  const voidSty = await page.evaluate(() => {
    const v = [...document.querySelectorAll('#cxPopGrid .xcell')].find(x => x.classList.contains('void'));
    if (!v) return { err: 'no void cell' };
    const nm = v.querySelector('.nm'), cs = getComputedStyle(nm), vcs = getComputedStyle(v);
    return {
      color: cs.color, deco: cs.textDecorationLine,
      after: getComputedStyle(nm, '::after').content, before: getComputedStyle(nm, '::before').content,
      border: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].join('/'),
      vBorder: [vcs.borderTopWidth, vcs.borderBottomWidth].join('/'),
      bg: vcs.backgroundImage, ink3: getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim()
    };
  });
  console.log('  空亡：', JSON.stringify(voidSty));
  ok(voidSty.color && near(parse(voidSty.color), parse(voidSty.ink3), 1), `空亡色应仍是 --ink-3（${voidSty.ink3}），实得 ${voidSty.color}`);
  eq(voidSty.deco, 'none', '空亡无下划线');
  eq(voidSty.after + voidSty.before, 'nonenone', '空亡无 ::before/::after 线');
  eq(voidSty.vBorder, '0px/0px', '空亡格无边框');
  eq(voidSty.bg, 'none', '空亡格无背景线');
  const dash = await page.evaluate(() => {
    let n = 0, croaked = 0;
    const raw = CanvasRenderingContext2D.prototype;
    const old = raw.setLineDash;
    raw.setLineDash = function (a) { n++; return old.apply(this, arguments); };
    try { Snapshot.renderLesson(App.state.cxLesson, App.state.cxTimeChart, {}); } catch (e) { croaked++; }
    raw.setLineDash = old;
    return { n, croaked };
  });
  eq(dash.n, 0, '出图不许有 setLineDash 调用');

  console.log('  脚本报错：', errs.length ? JSON.stringify(errs) : '无');
  const s = stats();
  console.log(`\nP9 汇总：${s.pass} 过 / ${s.fail} 败`);
  if (s.fail) console.log('（t14 落地前跑出失败是正常的 —— 判据有效性自证；落地后应转全过）');
  await browser.close();
})();
