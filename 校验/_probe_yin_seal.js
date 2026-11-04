/* 阴盘 · 空亡/驿马 与 八神/暗干 的几何冲突 —— 浏览器实测探针
 *
 * 用法：
 *   NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules \
 *     node 校验/_probe_yin_seal.js                 # 扫一批日期，只报冲突
 *   ... node 校验/_probe_yin_seal.js 2026-01-01T04:00  # 单盘，打印全宫几何 + 存截图
 *   URL=http://127.0.0.1:8767/ （默认）
 *
 * 判定：用 Range 量「八神」的紧字框（不是元素盒），与空亡/驿马印的盒子求交。
 */
const path = require('path');
const { chromium } = require('playwright-core');

const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const URL = process.env.URL || 'http://127.0.0.1:8767/';
const SHOT = process.env.SHOT || path.join(__dirname, '_yin_overlap.png');

const MEASURE = () => {
  const pan = document.querySelector('.qm-text-pan');
  if (!pan) return { err: 'no pan' };
  const rect = el => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const tight = el => { const rg = document.createRange(); rg.selectNodeContents(el); const b = rg.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const inter = (a, b) => {
    if (!a || !b) return 0;
    const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
    const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    return (w > 0 && h > 0) ? +(w * h).toFixed(2) : 0;
  };
  const cells = [...pan.querySelectorAll('.qm-cell')];
  return {
    sub: pan.dataset.sub,
    qmCell: window.QmCell,
    rows: cells.map(c => {
      const pal = c.querySelector('.qm-pal');
      const seals = [...c.querySelectorAll('.qm-seal')].map(s => ({ txt: s.textContent, box: rect(s) }));
      const shen = c.querySelector('.qm-shen');
      const shenBox = shen ? rect(shen) : null;
      const shenTight = shen ? tight(shen) : null;
      const agan = c.querySelector('.qm-agan');
      const aganBox = agan ? rect(agan) : null;
      const out = {
        pal: pal && pal.textContent, seals, shen: shen ? shen.textContent : '', shenBox, shenTight, aganBox,
        sealVsShen: 0, sealVsAgan: 0
      };
      seals.forEach(s => {
        out.sealVsShen += inter(s.box, shenTight);
        out.sealVsAgan += inter(s.box, aganBox);
      });
      out.sealVsShen = +out.sealVsShen.toFixed(2);
      out.sealVsAgan = +out.sealVsAgan.toFixed(2);
      return out;
    })
  };
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  /* 2026-11-02：阴盘入口移到 设置 → 定局 → 定局法（#segJu） */
  await page.evaluate(() => document.querySelector('#segJu button[data-v="yin"]').click());

  const setTime = async v => {
    await page.evaluate(v => {
      const el = document.getElementById('dtPick');
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, v);
    await page.evaluate(() => document.getElementById('btnCast').click());
    await page.waitForTimeout(140);
  };

  const single = process.argv[2];
  if (single) {
    await setTime(single);
    const m = await page.evaluate(MEASURE);
    console.log(JSON.stringify(m, null, 1));
    await page.screenshot({ path: SHOT });
    if (errs.length) console.log('ERRORS:', errs);
    await browser.close();
    return;
  }

  /* 扫描：2026 年 1 月每 3 天一档 × 4 个时点 —— 收集「空亡与驿马同宫」的阴盘 */
  const times = [];
  for (let d = 1; d <= 28 && times.length < 60; d++) {
    for (const h of [2, 8, 14, 20]) {
      times.push(`2026-01-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00`);
    }
  }
  let charts = 0, twin = 0, bad = [], maxA = 0;
  for (const t of times) {
    await setTime(t);
    const m = await page.evaluate(MEASURE);
    if (!m || m.err || m.sub !== 'yin') { bad.push([t, 'not yin']); continue; }
    charts++;
    const two = m.rows.filter(r => r.seals.length === 2);
    if (two.length) twin++;
    two.forEach(r => {
      if (r.sealVsShen > 0) {
        maxA = Math.max(maxA, r.sealVsShen);
        bad.push([t, r.pal, r.shen, r.sealVsShen, r.seals.map(s => s.txt).join('+')]);
      }
    });
  }
  console.log(JSON.stringify({ charts, chartsWithTwinSeal: twin, conflicts: bad.length, maxOverlapPX2: maxA, sample: bad.slice(0, 40) }, null, 1));
  if (errs.length) console.log('ERRORS:', errs);
  await browser.close();
})();
