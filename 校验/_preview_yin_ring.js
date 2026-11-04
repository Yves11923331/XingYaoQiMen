/* 阴盘 · 「盘面缩小 + 暗干移到盘外一圈」方案预览（传统排法）
 * 只动预览页面，不改源码。
 * 跑法：NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_preview_yin_ring.js
 */
const { chromium } = require('playwright-core');
const fs = require('fs');

const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const URL = process.env.URL || 'http://127.0.0.1:8767/';
const WHEN = process.argv[2] || '2026-01-01T04:00';
const TMP = '/tmp/yin-ring';

const DENSITY = [
  { min: 122, fs: .88, pt: 8, pb: 26, sm: 18, lm: 4 },
  { min: 114, fs: .84, pt: 8, pb: 25, sm: 17, lm: 3 },
  { min: 108, fs: .80, pt: 7, pb: 24, sm: 16, lm: 3 },
  { min: 100, fs: .74, pt: 6, pb: 23, sm: 15, lm: 2 },
  { min: 0, fs: .70, pt: 6, pb: 22, sm: 13, lm: 2 }
];

const VARIANTS = [
  { key: 'A', name: 'A · 环 24 · 圆章', band: 24, chip: 17, font: 9.5 },
  { key: 'B', name: 'B · 环 24 · 无框字', band: 24, plain: true, font: 11.5 },
  { key: 'C', name: 'C · 环 30 · 圆章', band: 30, chip: 20, font: 11 },
  { key: 'D', name: 'D · 环 20 · 圆章', band: 20, chip: 15, font: 8.5 }
];

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  /* 2026-11-02：阴盘入口移到 设置 → 定局 → 定局法（#segJu），用 DOM 点击免得受视图可见性限制 */
  await page.evaluate(() => document.querySelector('#segJu button[data-v="yin"]').click());
  await page.evaluate(v => {
    const el = document.getElementById('dtPick');
    el.value = v; el.dispatchEvent(new Event('change', { bubbles: true }));
  }, WHEN);
  await page.evaluate(() => document.getElementById('btnCast').click());
  await page.waitForTimeout(600);

  /* 阴盘暗干搬出宫外后，宫内的「右上圆圈 + 让位」全部回退成普通格子 */
  await page.addStyleTag({ content: `
    .qm-text-pan[data-sub="yin"] .qm-agan { display: none !important; }
    .qm-text-pan[data-sub="yin"] .qm-shen { margin-top: var(--qm-shen-mt, 18px) !important; }
    .qm-text-pan[data-sub="yin"] .qm-void { top: 5px !important; }
    .qm-ring .rg { position: absolute; transform: translate(-50%, -50%); display: flex;
      align-items: center; justify-content: center; font-family: "QM Serif","Songti SC",serif;
      font-style: normal; line-height: 1; }
    /* 环在 .qm-text-pan 之外，盘内那套 --qm-* 变量作用不到 —— 用全局主题变量 */
    .qm-ring .rg.chip { border-radius: 50%; border: 1px solid var(--line);
      background: var(--surface-2); color: var(--ink-2); }
    .qm-ring .rg.plain { color: var(--ink-2); opacity: .85; }
  `});

  const report = {};
  for (const v of VARIANTS) {
    const m = await page.evaluate(({ band, chip, font, plain, DENSITY }) => {
      const $ = id => document.getElementById(id);
      const box = $('qmBox'), ring = $('qmRing'), pan = $('qm_text_pan');
      const BAND = band;
      /* 盒子宽度固定 = wrapW - 24（左右各 12 留白）；盘 = 盒宽 - 2*环 */
      const wrapW = document.querySelector('#view-chart .panwrap').clientWidth;
      const boxW = wrapW - 24;
      const W = boxW - BAND * 2;
      const H = Math.round(W * 509 / 350);
      box.style.padding = BAND + 'px';
      box.style.width = boxW + 'px';
      box.style.height = (H + BAND * 2) + 'px';
      box.style.transform = 'none';
      ring.style.inset = BAND + 'px';
      pan.style.width = W + 'px';
      pan.style.height = H + 'px';
      pan.style.maxWidth = 'none';

      const cell = (W - 14) / 3;
      let d = DENSITY[DENSITY.length - 1];
      for (const x of DENSITY) if (cell >= x.min) { d = x; break; }
      pan.style.setProperty('--qm-cell-fs', d.fs + 'em');
      pan.style.setProperty('--qm-cell-pt', d.pt + 'px');
      pan.style.setProperty('--qm-cell-pb', d.pb + 'px');
      pan.style.setProperty('--qm-shen-mt', d.sm + 'px');
      pan.style.setProperty('--qm-line-mt', d.lm + 'px');

      const chart = window.App.state.chart;
      const Q = window.App.Q;
      const agOf = pal => { const q = chart.plate.find(x => x.pal === pal); return q && q.agan ? Q.STEM[q.agan] : ''; };

      /* 先量各宫（相对盘左上角） */
      const pr = pan.getBoundingClientRect();
      const cells = {};
      pan.querySelectorAll('.qm-cell').forEach(c => {
        const b = c.getBoundingClientRect();
        cells[+c.dataset.pal] = { x: b.left - pr.left, y: b.top - pr.top, w: b.width, h: b.height };
      });

      ring.innerHTML = '';
      const put = (pal, x, y) => {
        const ch = agOf(pal);
        if (!ch) return;
        const el = document.createElement('i');
        el.className = 'rg ' + (plain ? 'plain' : 'chip');
        el.textContent = ch;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.fontSize = font + 'px';
        if (!plain) { el.style.width = chip + 'px'; el.style.height = chip + 'px'; }
        ring.appendChild(el);
      };
      const LEFT = [4, 3, 8], RIGHT = [2, 7, 6];
      LEFT.forEach(p => { const c = cells[p]; put(p, -BAND / 2, c.y + c.h / 2); });
      RIGHT.forEach(p => { const c = cells[p]; put(p, W + BAND / 2, c.y + c.h / 2); });
      put(9, cells[9].x + cells[9].w / 2, -BAND / 2);
      put(1, cells[1].x + cells[1].w / 2, H + BAND / 2);

      return { band: BAND, boxW, panW: W, panH: H, cell: +cell.toFixed(1), density: d,
        items: [...ring.querySelectorAll('.rg')].map(e => e.textContent) };
    }, { ...v, DENSITY });
    report[v.key] = m;
    console.log(v.key, JSON.stringify(m));
    const el = await page.$('#qmBox');
    fs.writeFileSync(`${TMP}/${v.key}_box.png`, await el.screenshot());
  }
  fs.writeFileSync(`${TMP}/report.json`, JSON.stringify({ variants: VARIANTS, report }, null, 1));
  if (errs.length) console.log('ERRORS', errs);
  await browser.close();
})();
