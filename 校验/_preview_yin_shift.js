/* 阴盘 · 「神星门干整体下移 + 空亡/驿马定位」方案预览
 * 神/星/门/干的相对行距一律不动（星门仍是 3/3），只整体下移。
 * 跑法：NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_preview_yin_shift.js
 */
const { chromium } = require('playwright-core');
const fs = require('fs');

const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const URL = process.env.URL || 'http://127.0.0.1:8767/';
const WHEN = process.argv[2] || '2026-01-01T04:00';
const TMP = '/tmp/yin-shift';

/* g1 暗干→印 · g2 印→神（px，350 盘标定）；左列方案用 left+shift */
const VARIANTS = [
  { key: 'Z', name: '现状', g1: 6.3, g2: 5.2 },
  { key: 'B', name: 'B · 右列 10 / 8', g1: 10, g2: 8 },
  { key: 'C', name: 'C · 右列 13 / 10', g1: 13, g2: 10 },
  { key: 'D', name: 'D · 右列 15 / 12', g1: 15, g2: 12 },
  { key: 'E', name: 'E · 印归宫名下', left: true, shift: 10 }
];

const cssFor = v => {
  if (v.left) return `
.qm-text-pan[data-sub="yin"] .qm-void{ left:9px; right:auto; top:29px; justify-content:flex-start; max-width:none; }
.qm-text-pan[data-sub="yin"] .qm-shen{ margin-top: calc(var(--qm-shen-mt, 18px) + 26px + ${v.shift}px); }`;
  const sealTop = 25.7 + v.g1;
  const shenTop = sealTop + 13.8 + v.g2;
  return `
.qm-text-pan[data-sub="yin"] .qm-void{ top:${(sealTop - 1).toFixed(1)}px; }
.qm-text-pan[data-sub="yin"] .qm-shen{ margin-top:${(shenTop - 9).toFixed(1)}px; }`;
};

const MEASURE = () => {
  const c = document.querySelector('.qm-cell:nth-child(3)');
  const cb = c.getBoundingClientRect();
  const rel = e => { const b = e.getBoundingClientRect(); return [+(b.top - cb.top).toFixed(1), +(b.bottom - cb.top).toFixed(1), +(b.left - cb.left).toFixed(1), +(b.right - cb.left).toFixed(1)]; };
  const tight = el => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return [b.top - cb.top, b.bottom - cb.top, b.left - cb.left, b.right - cb.left]; };
  const inter = (a, b) => {
    const w = Math.min(a[3], b[3]) - Math.max(a[2], b[2]);
    const h = Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
    return (w > 0 && h > 0) ? +(w * h).toFixed(2) : 0;
  };
  const seals = [...c.querySelectorAll('.qm-seal')].map(s => rel(s));
  const ag = rel(c.querySelector('.qm-agan'));
  const vo = rel(c.querySelector('.qm-void'));
  const shBox = rel(c.querySelector('.qm-shen'));
  const shT = tight(c.querySelector('.qm-shen'));
  const ls = [...c.querySelectorAll('.qm-line')].map(rel);
  let sealVsShen = 0, sealVsAgan = 0;
  seals.forEach(s => { sealVsShen += inter(s, shT); sealVsAgan += inter(s, ag); });
  return {
    h: +cb.height.toFixed(1),
    ag, vo, shenBox: shBox, shenTight: shT, seals,
    lines: ls,
    sealVsShen: +sealVsShen.toFixed(2), sealVsAgan: +sealVsAgan.toFixed(2),
    bottom: +(cb.height - ls[ls.length - 1][1]).toFixed(1),
    gaps: [+(vo[0] - ag[1]).toFixed(1), +(shBox[0] - vo[1]).toFixed(1)]
  };
};

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const errs = [];

  const report = {};
  for (const v of VARIANTS) {
    report[v.key] = {};
    for (const w of [390, 360, 320]) {
      const page = await browser.newPage({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2 });
      page.on('pageerror', e => errs.push(w + ':' + e));
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      /* 2026-11-02：阴盘入口移到 设置 → 定局 → 定局法（#segJu） */
      await page.evaluate(() => document.querySelector('#segJu button[data-v="yin"]').click());
      await page.evaluate(t => { const el = document.getElementById('dtPick'); el.value = t; el.dispatchEvent(new Event('change', { bubbles: true })); }, WHEN);
      await page.evaluate(() => document.getElementById('btnCast').click());
      await page.waitForTimeout(400);
      await page.evaluate(css => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }, cssFor(v));
      await page.waitForTimeout(150);
      const m = await page.evaluate(MEASURE);
      report[v.key][w] = m;
      if (w === 390) {
        fs.writeFileSync(`${TMP}/${v.key}_kun.png`, await (await page.$('.qm-cell:nth-child(3)')).screenshot());
        fs.writeFileSync(`${TMP}/${v.key}_pan.png`, await (await page.$('.qm-text-pan')).screenshot());
      }
      console.log(v.key, w, JSON.stringify({ gaps: m.gaps, shen: m.shenBox[0], lines: m.lines.map(x => x[0]), bottom: m.bottom, vsShen: m.sealVsShen, vsAgan: m.sealVsAgan }));
      await page.close();
    }
  }
  fs.writeFileSync(`${TMP}/report.json`, JSON.stringify({ variants: VARIANTS, report }, null, 1));
  if (errs.length) console.log('ERRORS', errs);
  await browser.close();
})();
