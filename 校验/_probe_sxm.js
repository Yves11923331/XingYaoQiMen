/* 神星门干（十二长生尺）· 上机自检
 * 用法：NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_probe_sxm.js
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'web', 'index.html');
const OUT = path.join(ROOT, '校验');

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 200)));
  let pass = 0, fail = 0;
  const ok = (c, m) => { c ? pass++ : (fail++, console.log('  ✗ ' + m)); };

  await page.goto(URL);
  await page.waitForTimeout(1200);

  /* 纯函数口径先测（不依赖 DOM） */
  const api = await page.evaluate(() => {
    const S = window.ShenXing, L = S.LONG;
    const at = (g, z) => L[S.stageIdx(g, z)];
    // 两阶合并：阳 冠带+临官→临官 / 衰+病→衰 / 墓+绝→绝 / 养+长生→长生
    const merge = (g, a, b) => L[S.pickIdx(g, [S.stageIdx(g, a), S.stageIdx(g, b)])];
    /* 穷举：5 阳干 × 4 隅宫 = 20，5 阴干 × 4 隅宫 = 20；按「合并后是哪一阶」统计 */
    const hist = { 阳: {}, 阴: {} };
    for (const g of '甲乙丙丁戊己庚辛壬癸') {
      const isY = '甲丙戊庚壬'.includes(g);
      for (const zs of [['辰', '巳'], ['未', '申'], ['戌', '亥'], ['丑', '寅']]) {
        const r = merge(g, zs[0], zs[1]);
        hist[isY ? '阳' : '阴'][r] = (hist[isY ? '阳' : '阴'][r] || 0) + 1;
      }
    }
    const pairs = hist;
    return { d_si: at('丁', '巳'), g_chou: at('庚', '丑'), g_yin: at('庚', '寅'), j_chen: at('甲', '辰'), pairs };
  });
  console.log('口径：', JSON.stringify(api));
  ok(api.d_si === '帝旺' && api.g_chou === '墓' && api.g_yin === '绝' && api.j_chen === '衰', '十二长生应阳顺阴逆');
  const P = api.pairs;
  const eq = (o, m) => Object.keys(o).length === Object.keys(m).length && Object.keys(m).every(k => o[k] === m[k]);
  ok(eq(P['阳'], { 临官: 5, 衰: 5, 墓: 5, 长生: 5 }), '阳干取舍应恰为 临官/衰/墓/长生 各 5（墓绝论墓）');
  ok(eq(P['阴'], { 帝旺: 5, 沐浴: 5, 胎: 5, 墓: 5 }), '阴干取舍应恰为 帝旺/沐浴/胎/墓 各 5');

  /* 十干长生墓：每颗干「墓」落在哪一支 */
  const muTbl = await page.evaluate(() => {
    const S = window.ShenXing, out = {};
    for (const g of '甲乙丙丁戊己庚辛壬癸') {
      for (const z of '子丑寅卯辰巳午未申酉戌亥') {
        if (S.LONG[S.stageIdx(g, z)] === '墓') out[g] = z;
      }
    }
    return out;
  });
  console.log('十干墓：', JSON.stringify(muTbl));
  ok(muTbl['癸'] === '未' && muTbl['辛'] === '辰' && muTbl['己'] === '丑' && muTbl['庚'] === '丑' && muTbl['壬'] === '辰',
    '十干长生墓应为 癸未/辛辰/己丑/庚丑/壬辰');

  /* 开插件、定时起盘 */
  await page.click('#tabbar button[data-view="set"]');
  await page.click('#setChips button[data-g="plugin"]');
  await page.click('#segPlugin_sxm button[data-v="1"]');
  await page.click('#tabbar button[data-view="home"]');
  await page.evaluate(() => {
    const el = document.getElementById('dtPick');
    el.value = '2026-11-01T17:00'; el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.click('#btnCast');
  await page.waitForTimeout(800);

  const dom = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.qm-cell')];
    const rows = cells.map(c => {
      const band = c.querySelector('.sxr');
      const pal = (c.querySelector('.qm-pal') || {}).textContent || '';
      if (!band) return { pal, none: true };
      const tr = [...band.querySelectorAll('.sxr-t')].map(t => {
        const ons = [...t.querySelectorAll('.sxr-on')];
        const first = ons[0];
        return {
          k: (t.querySelector('.sxr-k') || {}).textContent,
          ons: ons.map(o => o.querySelector('b').textContent),
          on: ons.map(o => o.querySelector('b').textContent).join(''),
          cls: first ? first.className.replace('sxr-on', '').trim() : ''
        };
      });
      const rb = band.getBoundingClientRect(), cb = c.getBoundingClientRect();
      return { pal, tr, top: +(rb.top - cb.top).toFixed(1), h: +rb.height.toFixed(1), cellH: +cb.height.toFixed(1) };
    });
    return rows;
  });
  console.log('盘面：', JSON.stringify(dom));
  const withBand = dom.filter(d => !d.none);
  ok(withBand.length === 8, '应八宫有尺（中五无支不画），实际 ' + withBand.length);
  ok(dom.filter(d => d.pal.includes('中5')).every(d => d.none), '中五宫不应有尺');
  ok(withBand.every(d => d.tr.length === 2), '每宫应两轨（天/地）');
  ok(withBand.every(d => d.tr[0].k === '天' && d.tr[1].k === '地'), '两轨应写天/地');
  ok(withBand.every(d => d.tr.every(t => t.ons.length === 1 || (t.ons.length === 2 && t.on.length === 2))), '每轨应有一枚阶字（衰病/胎养＝两格各一字）');
  const kun2 = withBand.find(d => d.pal === '坤2');
  ok(kun2 && kun2.tr[0].ons.join('') === '衰病' && kun2.tr[0].ons.length === 2, '坤二天盘戊（衰+病）应两格分书「衰」「病」');
  const sx4 = withBand.find(d => d.pal.includes('巽'));
  ok(sx4 && sx4.tr[0].ons.join('') === '胎养' && sx4.tr[0].ons.length === 2 && sx4.tr[0].cls.indexOf('sxr-xing') >= 0,
    '巽四天盘癸应「胎」「养」两格分书 + 击刑（十干墓：癸墓未，巽纳辰巳不涉）');
  ok(sx4 && sx4.tr[1].cls === '', '巽四地盘己既不入墓也不刑，应为平常色（己墓丑）');
  const gen8 = withBand.find(d => d.pal.includes('艮'));
  ok(gen8 && gen8.tr[0].cls === 'sxr-both', '艮八天盘庚应是「又墓又刑」（庚墓丑、丑在艮，庚刑艮）');
  ok(gen8 && gen8.tr[0].on === '墓', '庚在艮两支为墓/绝，应只论「墓」');
  ok(gen8 && gen8.tr[1].cls === 'sxr-mu', '艮八地盘丁应「入墓」（丁墓丑，丑在艮）');
  const li9 = withBand.find(d => d.pal.includes('离'));
  ok(li9 && li9.tr[0].cls === 'sxr-xing', '离九天盘辛应只「击刑」（辛墓辰，离纳午，不涉墓）');

  /* 颜色/线：入墓＝加粗＋墨（无横线）；击刑＝朱红；又墓又刑＝朱红＋横线 */
  const style = await page.evaluate(() => {
    const pick = (pal, idx) => {
      const c = [...document.querySelectorAll('.qm-cell')].find(x => {
        const n = x.querySelector('.qm-pal'); return n && n.textContent.trim().endsWith(String(pal));
      });
      if (!c) return null;
      const b = c.querySelectorAll('.sxr-on b')[idx];
      if (!b) return null;
      const s = getComputedStyle(b);
      return { ch: b.textContent, color: s.color, weight: s.fontWeight, deco: s.textDecorationLine };
    };
    return { mu: pick(6, 1), xing: pick(9, 0), both: pick(8, 0) };
  });
  console.log('样式：', JSON.stringify(style));
  ok(style.mu && style.mu.deco === 'none' && +style.mu.weight >= 800 && style.mu.color === 'rgb(27, 32, 40)',
    '入墓应为「加粗＋墨色、无横线」');
  ok(style.xing && style.xing.deco === 'none' && style.xing.color === 'rgb(178, 58, 44)', '击刑应为朱红、无横线');
  ok(style.both && style.both.deco === 'underline' && style.both.color === 'rgb(178, 58, 44)', '又墓又刑应为朱红＋横线');

  await page.locator('#panHost').screenshot({ path: path.join(OUT, '_sxm_board.png') });

  /* 导出图 */
  const cv = await page.evaluate(() => {
    const A = window.App;
    const c = A.Snap.render(A.state.chart, A.state.analysis, A.state.starMap, A.state.face, {});
    return { url: c.toDataURL('image/png'), w: c.width, h: c.height };
  });
  fs.writeFileSync(path.join(OUT, '_sxm_export.png'), Buffer.from(cv.url.split(',')[1], 'base64'));
  console.log('导出：', cv.w + 'x' + cv.h);

  /* 阴盘回默认（★ 2026-11-02 起阴盘是定局法第三档，入口在设置页） */
  await page.click('#btnBack');
  await page.evaluate(() => document.querySelector('#segJu button[data-v="yin"]').click());
  await page.click('#btnCast');
  await page.waitForTimeout(600);
  const yin = await page.evaluate(() => document.querySelectorAll('.sxr').length);
  ok(yin === 0, '阴盘不应出现长生尺（插件不入阴盘）');

  console.log('\n结果：' + pass + ' 过 / ' + fail + ' 败');
  if (errs.length) console.log('页面报错：\n' + errs.join('\n'));
  await browser.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
