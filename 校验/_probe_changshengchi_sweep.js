/* 长生尺 · 全面自检
 * 1) 纯函数：1080 盘 × 九宫 取象不变量
 * 2) 屏显：多盘式/多主题/多宽度，尺数、字符数、几何不撞
 * 3) 出图：不抛错、尺寸不变、阴盘无尺
 * 用法：NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_probe_changshengchi_sweep.js
 */
const { chromium } = require('playwright-core');
const path = require('path');
const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'web', 'index.html');

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--no-sandbox'] });
  let pass = 0, fail = 0;
  const ok = (c, m) => { c ? pass++ : (fail++, console.log('  ✗ ' + m)); };

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text().slice(0, 140)); });
  await page.goto(URL);
  await page.waitForTimeout(1200);

  /* ---------- 1) 1080 盘纯函数扫 ---------- */
  const sweep = await page.evaluate(() => {
    const Q = window.Qimen, S = window.ShenXing, L = S.LONG;
    const bad = [];
    let charts = 0, cells = 0, wide = 0, mu = 0, xing = 0, both = 0;
    const PALS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const pol of [1, -1]) for (let cyc = 1; cyc <= 9; cyc++) for (let h = 0; h < 60; h++) {
      const c = Q.castManual(pol, cyc, (h % 10) + 1, (h % 12) + 1, {});
      charts++;
      for (const p of c.plate) {
        for (const which of ['heaven', 'earth']) {
          const it = S.infoOf(c, p, which);
          const hasBranch = (Q.PAL_ZHI[p.pal] || []).length > 0;
          const no = which === 'earth' ? p.earth : p.heaven;
          if (!hasBranch) { if (it) bad.push('中5不该有尺'); continue; }
          if (!no) continue;
          cells++;
          if (!it) { bad.push('有干无取象 pal' + p.pal); continue; }
          if (it.idx < 0 || it.idx > 11) bad.push('idx越界');
          if (it.pair) { wide++; if (it.pair.length !== 2 || it.pair[1] !== it.pair[0] + 1) bad.push('pair不连续'); }
          if (it.mu && it.idx !== 8) bad.push('入墓但阶不是墓');
          if (it.mu && it.pair) bad.push('墓与pair同时出现');
          if (it.stage !== L[it.idx]) bad.push('阶名不一致');
          if (it.mu) mu++;
          if (it.xing) xing++;
          if (it.state === 'both') both++;
          if (it.state !== (it.mu && it.xing ? 'both' : it.mu ? 'mu' : it.xing ? 'xing' : '')) bad.push('state不一致');
        }
      }
    }
    return { charts, cells, wide, mu, xing, both, bad: bad.slice(0, 8), badN: bad.length };
  });
  console.log('1080 盘：', JSON.stringify(sweep));
  ok(sweep.charts === 1080, '应扫满 1080 盘');
  ok(sweep.badN === 0, '取象不变量应全过（' + sweep.badN + ' 处异常）');
  ok(sweep.wide > 0 && sweep.mu > 0 && sweep.xing > 0 && sweep.both > 0, '四种状态都应出现过');

  /* ---------- 2) 屏显多盘式 ---------- */
  await page.click('#tabbar button[data-view="set"]');
  await page.click('#setChips button[data-g="plugin"]');
  await page.click('#segPlugin_sxm button[data-v="1"]');
  await page.click('#tabbar button[data-view="home"]');

  const back = async () => { const b = await page.$('#btnBack'); if (b && await b.isVisible()) { await page.click('#btnBack'); await page.waitForTimeout(200); } };
  const castAt = async (iso) => {
    await back();
    await page.evaluate(v => { const el = document.getElementById('dtPick'); if (!el) return; el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, iso);
    await page.click('#btnCast');
    await page.waitForTimeout(450);
  };
  const geom = () => page.evaluate(() => {
    const cells = [...document.querySelectorAll('.qm-cell')];
    const out = { bands: 0, bad: [] };
    cells.forEach(c => {
      const band = c.querySelector('.sxr');
      if (!band) return;
      out.bands++;
      const cb = c.getBoundingClientRect(), bb = band.getBoundingClientRect();
      if (bb.top < cb.top || bb.bottom > cb.bottom + 0.5) out.bad.push('尺越出宫格');
      const men = c.querySelector('.qm-men-row');
      if (men) {
        const mb = men.getBoundingClientRect();
        if (mb.bottom > bb.top + 0.5) out.bad.push('尺压八门行');
      }
      const stars = c.querySelector('.qm-stars');
      if (stars) {
        const sb = stars.getBoundingClientRect();
        if (sb.top < bb.bottom - 0.5) out.bad.push('尺压星曜');
      }
      const mu = c.querySelector('.qm-mu');
      if (mu) {
        const mb = mu.getBoundingClientRect();
        if (mb.bottom > bb.top + 0.5) out.bad.push('尺压墓星');
      }
      band.querySelectorAll('.sxr-t').forEach(t => {
        const n = t.querySelectorAll('.sxr-on').length;
        const txt = [...t.querySelectorAll('.sxr-on b')].map(e => e.textContent).join('');
        if (n < 1 || n > 2 || txt.length !== n) out.bad.push('阶字数异常 ' + txt);
      });
    });
    return out;
  });

  for (const iso of ['2024-02-16T20:06', '2026-11-01T18:44', '2025-06-01T00:10', '2023-10-05T23:40']) {
    await castAt(iso);
    const g = await geom();
    ok(g.bands === 8, iso + '：应八宫有尺（' + g.bands + '）');
    ok(g.bad.length === 0, iso + '：几何不应相撞（' + g.bad.slice(0, 2).join('；') + '）');
  }

  /* 三层（日家）：2026-11-02 起四层由插件控制（设置 → 插件 → 日月年家），
     设置里那个 #segLayers 开关已删除 */
  await castAt('2026-11-01T12:00');
  await back();
  await page.click('#tabbar button[data-view="set"]');
  await page.click('#setChips button[data-g="plugin"]');
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const b = document.querySelector('#segPlugin_layers button[data-v="1"]');
    if (b) b.click();
  });
  await page.click('#tabbar button[data-view="home"]');
  await page.waitForTimeout(250);
  const riBtn = await page.$('#segLayer button[data-l="ri"]');
  if (riBtn) { await riBtn.click(); await page.waitForTimeout(200); }
  await page.click('#btnCast'); await page.waitForTimeout(500);
  const gRi = await geom();
  ok(gRi.bands === 8, '日家：应八宫有尺（' + gRi.bands + '）');
  ok(gRi.bad.length === 0, '日家：几何不应相撞');

  /* 主题四套 + 宽度三档 */
  for (const t of ['white', 'blue', 'slate', 'brown']) {
    await page.evaluate(th => document.documentElement.setAttribute('data-theme', th), t);
    await page.waitForTimeout(120);
    const g = await geom();
    ok(g.bad.length === 0, t + ' 主题下几何不应相撞');
  }
  for (const w of [360, 320]) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.waitForTimeout(300);
    const g = await geom();
    ok(g.bands === 8 && g.bad.length === 0, w + ' 宽：尺数与几何（' + g.bad.slice(0, 1).join('') + '）');
  }
  await page.setViewportSize({ width: 390, height: 844 });

  /* ---------- 3) 出图 ---------- */
  const exp = await page.evaluate(() => {
    const A = window.App;
    try {
      const c = A.Snap.render(A.state.chart, A.state.analysis, A.state.starMap, A.state.face, {});
      return { w: c.width, h: c.height, ok: true };
    } catch (e) { return { ok: false, err: String(e) }; }
  });
  console.log('出图：', JSON.stringify(exp));
  ok(exp.ok && exp.w === 2000 && exp.h === 3568, '出图应为 2000×3568 且不抛错');

  /* 阴盘：无尺（2026-11-02 起阴盘是定局法的第三档，入口在设置页；先收回时家再切） */
  await back();
  await page.evaluate(() => {
    const b = document.querySelector('#segLayer button[data-l="shi"]');
    if (b) b.click();
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('#segJu button[data-v="yin"]').click());
  await page.click('#btnCast'); await page.waitForTimeout(500);
  const yin = await page.evaluate(() => document.querySelectorAll('.sxr').length);
  ok(yin === 0, '阴盘不应有尺');

  /* 卦象·地支面（点中宫切面） */
  await back();
  await page.evaluate(() => {
    document.querySelector('#segMode3 button[data-m="time"]').click();
    document.querySelector('#segJu button[data-v="chaibu"]').click();   /* 定局法收回拆补 */
  });
  await page.waitForTimeout(200);
  await page.click('#btnCast'); await page.waitForTimeout(500);
  const qm = await page.$('.qm-mid');
  if (qm) { await qm.click(); await page.waitForTimeout(400); }
  const faceBands = await page.evaluate(() => document.querySelectorAll('.sxr').length);
  console.log('卦象面尺数：', faceBands, '（该面不建九宫格，允许 0）');

  console.log('\n结果：' + pass + ' 过 / ' + fail + ' 败');
  if (errs.length) console.log('页面报错：\n' + errs.join('\n'));
  await browser.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
