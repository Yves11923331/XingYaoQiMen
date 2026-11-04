/* 插件「神星门干」· 方案预览（真盘注入，不改源码）
 * 用法：NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_preview_sxzhu.js
 * 产出：设计-神星门干/样张/方案-*.png（整盘）、方案-*-特写.png
 * 示例盘：2026-11-01 17:00 · 阴遁五局（癸酉时）—— 巽4/艮8/离9 同时有击刑与入墓，最考排布
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'web', 'index.html');
const OUT = path.join(ROOT, '设计-神星门干', '样张');
fs.mkdirSync(OUT, { recursive: true });

const WHEN = '2026-11-01T17:00';

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL);
  await page.waitForTimeout(1200);

  /* 定时起盘 */
  await page.evaluate(v => {
    const el = document.getElementById('dtPick');
    el.value = v; el.dispatchEvent(new Event('change', { bubbles: true }));
  }, WHEN);
  await page.click('#btnCast');
  await page.waitForTimeout(800);

  /* 数据 + 注入骨架（四套共用一份数据） */
  await page.evaluate(() => {
    const Q = window.Qimen, P = window.Patterns;
    const LONG = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
    const SHORT = { 长生: '生', 沐浴: '浴', 冠带: '冠', 临官: '临', 帝旺: '旺', 衰: '衰', 病: '病', 死: '死', 墓: '墓', 绝: '绝', 胎: '胎', 养: '养' };
    const START = { 甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };
    const ZHI = '子丑寅卯辰巳午未申酉戌亥';
    const WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
    const MU = { 木: '未', 火: '戌', 土: '辰', 金: '丑', 水: '辰' };
    function stage(g, z) {
      const s = ZHI.indexOf(START[g]), zi = ZHI.indexOf(z);
      const yang = '甲丙戊庚壬'.includes(g);
      return LONG[yang ? (zi - s + 12) % 12 : (s - zi + 12) % 12];
    }
    const chart = window.App.state.chart;
    const ELKEY = { 木: '--qm-el-wood', 火: '--qm-el-fire', 土: '--qm-el-earth', 金: '--qm-el-metal', 水: '--qm-el-water' };
    const rs = getComputedStyle(document.documentElement);
    window.__SX_SHORT = SHORT;
    window.__sx = {};
    chart.plate.forEach(q => {
      const zs = Q.PAL_ZHI[q.pal] || [];
      const earth = Q.STEM[q.earth] || '';
      const pol = '甲丙戊庚壬'.includes(earth) ? '阳' : '阴';
      const z = zs.find(zz => '子寅辰午申戌'.includes(zz) === (pol === '阳')) || zs[0] || '';
      const one = (gi) => {
        if (!gi) return null;
        const g = Q.STEM[gi];
        const st = z ? stage(g, z) : '';
        return { gan: g, zhi: z, stage: st, short: SHORT[st] || '',
          color: (getComputedStyle(document.querySelector('.qm-text-pan') || document.documentElement)
            .getPropertyValue(ELKEY[WX[g]]) || '').trim() || '#333',
          mu: zs.includes(MU[WX[g]]), xing: P.JI_XING[gi] === q.pal };
      };
      window.__sx[q.pal] = { heaven: one(q.heaven), earth: one(q.earth), mid: one(q.mid), earth2: one(q.earth2),
        pol, zhi: z, zhis: zs, name: q.name };
    });
  });

  const CSS = {
    common: `
      .qm-cell .qm-gan { position: relative; }
      .sx-dot { position:absolute; right:-2px; top:-3px; width:4.5px; height:4.5px; border-radius:50%;
        background: var(--qm-seal-void-ink); }
      .sx-mu { box-shadow: inset 0 -2px 0 var(--qm-el-earth); }
    `,
    /* 方案1 · 章内角注：章加高一点，长生字压在章内左上 */
    s1: `
      .qm-line .qm-gan { height: 1.95em; align-items: flex-end; padding-bottom: .18em; }
      .sx-l { position:absolute; left:.28em; top:.12em; font-size:.44em; font-style:normal;
        font-weight:600; line-height:1; color:var(--qm-ink-soft); opacity:.85; }
      .qm-line .qm-gan-mid { overflow: visible; }
      .qm-line .qm-gan-mid .sx-l { left:auto; right:100%; top:.32em; font-size:.5em; margin-right:1px; }
    `,
    /* 方案2 · 章旁注：每行干章右侧一枚长生字（与干同一行） */
    s2: `
      .sx-r { display:inline-flex; align-items:center; justify-content:center;
        width:.62em; font-size:.46em; font-style:normal; font-weight:600;
        color:var(--qm-ink-soft); opacity:.85; margin-left:1px; align-self:center; }
      .sx-r.pre { margin-left:0; margin-right:1px; }
      .sx-r.mu { color:var(--qm-el-earth); }
      .sx-r.xing { color:var(--qm-seal-void-ink); }
    `,
    /* 方案3 · 长生行：门行之下单起一行，天/地/寄 三组 */
    s3: `
      .sx-row { position:absolute; left:6px; right:6px; bottom:24px; padding-top:2px;
        display:flex; justify-content:space-between; gap:2px;
        border-top:1px dashed var(--qm-hair);
        font-size:.5em; line-height:1.25; color:var(--qm-ink-soft); }
      .sx-row span { white-space:nowrap; }
      .sx-row i { font-style:normal; }
      .sx-row .mu i { color:var(--qm-el-earth); }
      .sx-row .xing i { color:var(--qm-seal-void-ink); }
    `,
    /* 方案6 · 长生盘：十二长生做成同心三环，天/地/寄 各一环，点在阶上 */
    s6: `
      .sx-dial { position:absolute; left:5px; bottom:15px; width:46px; height:46px;
        color:var(--qm-dim); }
      .sx-dial svg { display:block; width:100%; height:100%; overflow:visible; }
      .sx-leg { position:absolute; right:6px; bottom:14px; text-align:right;
        font-size:.46em; line-height:1.65; color:var(--qm-ink-soft); letter-spacing:-.02em; }
      .sx-leg div { white-space:nowrap; }
      .sx-leg i { font-style:normal; }
      .sx-leg .gn { font-weight:700; margin-left:1px; }
      .sx-leg em { font-style:normal; font-size:.86em; margin-left:2px; padding:0 2px;
        border-radius:2px; border:1px solid currentColor; line-height:1.3; }
      .sx-leg .mu em { color:var(--qm-el-earth); }
      .sx-leg .xing em { color:var(--qm-seal-void-ink); }
    `,
    /* 方案5 · 三轨长生尺：十二长生做刻度，天/地/寄 各一轨 */
    s5: `
      .sx-band { position:absolute; left:6px; right:6px; bottom:20px;
        border-top:1px solid var(--qm-hair); padding-top:3px; }
      .sx-tr { display:flex; align-items:flex-end; height:9px; }
      .sx-tr + .sx-tr { margin-top:1px; }
      .sx-k { flex:0 0 10px; font-size:.4em; line-height:1; color:var(--qm-dim);
        text-align:left; letter-spacing:0; transform:scale(.95); transform-origin:left bottom; }
      .sx-rail { flex:1 1 auto; display:flex; align-items:flex-end; justify-content:space-between; }
      .sx-rail i { display:block; width:1px; height:3px; background:var(--qm-hair); border-radius:1px; }
      .sx-mark { position:relative; display:flex; flex-direction:column; align-items:center;
        width:7px; height:9px; justify-content:flex-end; }
      .sx-mark b { font-size:.46em; font-weight:700; line-height:.95; letter-spacing:0;
        transform:scale(.92); transform-origin:center bottom; }
      .sx-mark s { display:block; width:3px; height:3px; border-radius:50%; margin-top:1px; }
      .sx-tag { flex:0 0 auto; font-style:normal; font-size:.4em; line-height:1;
        margin-left:2px; padding-bottom:1px; }
      .sx-tag.mu { color:var(--qm-el-earth); }
      .sx-tag.xing { color:var(--qm-seal-void-ink); }
    `,
    /* 方案4 · 右下批注：小字右对齐贴在宫右下角 */
    s4: `
      .sx-note { position:absolute; right:7px; bottom:25px; text-align:right;
        font-size:.5em; line-height:1.4; color:var(--qm-ink-soft); }
      .sx-note div { white-space:nowrap; }
      .sx-note i { font-style:normal; }
      .sx-note .mu i { color:var(--qm-el-earth); }
      .sx-note .xing i { color:var(--qm-seal-void-ink); }
    `
  };

  async function apply(scheme) {
    await page.evaluate(({ scheme, CSS }) => {
      document.getElementById('sxcss') && document.getElementById('sxcss').remove();
      document.querySelectorAll('.sx-l,.sx-r,.sx-row,.sx-note,.sx-dot').forEach(e => e.remove());
      document.querySelectorAll('.sx-mu').forEach(e => e.classList.remove('sx-mu'));
      const st = document.createElement('style');
      st.id = 'sxcss';
      st.textContent = CSS.common + (CSS[scheme] || '');
      document.head.appendChild(st);

      const cellOf = pal => [...document.querySelectorAll('.qm-cell')].find(c => {
        const n = c.querySelector('.qm-pal');
        return n && n.textContent.trim().endsWith(String(pal));
      });
      const mark = (chip, info) => {
        if (!chip || !info) return;
        if (info.mu) chip.classList.add('sx-mu');
        if (info.xing) {
          const d = document.createElement('i'); d.className = 'sx-dot'; chip.appendChild(d);
        }
        if (scheme === 's1' && info.short) {
          const i = document.createElement('i'); i.className = 'sx-l'; i.textContent = info.short;
          chip.appendChild(i);
        }
      };
      for (let pal = 1; pal <= 9; pal++) {
        const d = window.__sx[pal]; if (!d) continue;
        const cell = cellOf(pal); if (!cell) continue;
        const rows = { star: cell.querySelector('.qm-line:not(.qm-men-row)'), men: cell.querySelector('.qm-men-row') };

        if (rows.star) {
          const g = rows.star.querySelector('.qm-gans');
          [...(g ? g.children : [])].forEach(k => {
            if (k.classList.contains('qm-gan')) mark(k, d.heaven);
            else if (k.classList.contains('qm-gan-mid')) mark(k, d.mid);
          });
          if (scheme === 's2' && g && d.mid) {
            const i = document.createElement('i');
            i.className = 'sx-r pre' + (d.mid.mu ? ' mu' : (d.mid.xing ? ' xing' : ''));
            i.textContent = d.mid.short || '—';
            g.insertBefore(i, g.firstChild);
          }
          if (scheme === 's2' && g && d.heaven) {
            const i = document.createElement('i');
            i.className = 'sx-r' + (d.heaven.mu ? ' mu' : (d.heaven.xing ? ' xing' : ''));
            i.textContent = d.heaven.short || '—';
            g.appendChild(i);
          }
        }
        if (rows.men) {
          const g = rows.men.querySelector('.qm-gans');
          [...(g ? g.children : [])].forEach(k => {
            if (k.classList.contains('qm-gan-mid')) mark(k, d.earth2);
            else if (k.classList.contains('qm-gan')) mark(k, d.earth);
          });
          if (scheme === 's2' && g && d.earth2) {
            const i = document.createElement('i');
            i.className = 'sx-r pre' + (d.earth2.mu ? ' mu' : (d.earth2.xing ? ' xing' : ''));
            i.textContent = d.earth2.short || '—';
            g.insertBefore(i, g.firstChild);
          }
          if (scheme === 's2' && g && d.earth) {
            const i = document.createElement('i');
            i.className = 'sx-r' + (d.earth.mu ? ' mu' : (d.earth.xing ? ' xing' : ''));
            i.textContent = d.earth.short || '—';
            g.appendChild(i);
          }
        }

        if (scheme === 's6') {
          if (!rows.men) continue;
          const items = [['天', d.heaven, 17], ['地', d.earth, 12.5], ['寄', d.earth2 || d.mid, 8]];
          const list = items.filter(x => x[1]);
          if (!list.length) continue;
          const ST = ['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
          const SH = window.__SX_SHORT;
          let svg = '<svg viewBox="0 0 46 46">';
          /* 外圈 12 刻度 */
          for (let n = 0; n < 12; n++) {
            const a = (n / 12) * Math.PI * 2 - Math.PI / 2;
            const anchor = (n === 0 || n === 4 || n === 8);
            const r1 = 20.5, r2 = anchor ? 17.8 : 19.3;
            svg += '<line x1="' + (23 + Math.cos(a) * r1).toFixed(1) + '" y1="' + (23 + Math.sin(a) * r1).toFixed(1) +
              '" x2="' + (23 + Math.cos(a) * r2).toFixed(1) + '" y2="' + (23 + Math.sin(a) * r2).toFixed(1) +
              '" stroke="currentColor" stroke-width=".6" opacity=".5"/>';
          }
          list.forEach(([k, i, r]) => {
            svg += '<circle cx="23" cy="23" r="' + r + '" fill="none" stroke="' + i.color + '" stroke-width=".7" opacity=".35"/>';
            const idx = ST.indexOf(i.stage), a = (idx / 12) * Math.PI * 2 - Math.PI / 2;
            const x = 23 + Math.cos(a) * r, y = 23 + Math.sin(a) * r;
            svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.7" fill="' + i.color +
              '" stroke="var(--qm-cell-mask)" stroke-width="1"/>';
            if (i.mu) svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.4" fill="none" stroke="var(--qm-el-earth)" stroke-width=".7"/>';
            if (i.xing) svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.4" fill="none" stroke="var(--qm-seal-void-ink)" stroke-width=".7"/>';
          });
          svg += '<circle cx="23" cy="23" r="1.1" fill="currentColor" opacity=".35"/></svg>';
          const leg = list.map(([k, i]) => {
            const tags = (i.mu ? '<em>墓</em>' : '') + (i.xing ? '<em>刑</em>' : '');
            return '<div class="' + (i.xing ? 'xing' : (i.mu ? 'mu' : '')) + '">' +
              '<s style="display:inline-block;width:3px;height:3px;border-radius:50%;margin-right:2px;' +
              'vertical-align:middle;background:' + i.color + '"></s><i>' + k + '</i> ' +
              (i.stage || '—') + tags + '</div>';
          }).join('');
          const wrap = document.createElement('div');
          wrap.innerHTML = '<div class="sx-dial">' + svg + '</div><div class="sx-leg">' + leg + '</div>';
          cell.appendChild(wrap.firstChild);
          cell.appendChild(wrap.firstChild);
        }

        if (scheme === 's5') {
          const items = [['天', d.heaven], ['地', d.earth], [d.earth2 ? '寄' : '寄', d.earth2 || d.mid]]
            .filter(x => x[1]);
          if (!items.length || !rows.men) continue;
          if (!window.__SX_STAGES) window.__SX_STAGES = ['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
          const SH = window.__SX_SHORT;
          const band = document.createElement('div'); band.className = 'sx-band';
          band.innerHTML = items.map(([k, i]) => {
            const idx = window.__SX_STAGES.indexOf(i.stage);
            const cells = [];
            for (let n = 0; n < 12; n++) {
              if (n === idx) {
                cells.push('<span class="sx-mark"><b style="color:' + i.color + '">' + (SH[i.stage] || '·') + '</b>' +
                  '<s style="background:' + i.color + '"></s></span>');
              } else cells.push('<i></i>');
            }
            const tags = (i.mu ? '<em class="sx-tag mu">墓</em>' : '') + (i.xing ? '<em class="sx-tag xing">刑</em>' : '');
            return '<div class="sx-tr"><span class="sx-k">' + k + '</span>' +
              '<span class="sx-rail">' + cells.join('') + '</span>' + tags + '</div>';
          }).join('');
          cell.appendChild(band);
        }

        if (scheme === 's3' || scheme === 's4') {
          const items = [['天', d.heaven, ''], ['地', d.earth, ''],
            [d.earth2 ? '寄地' : '寄天', d.earth2 || d.mid, '']].filter(x => x[1]);
          if (!items.length) continue;
          const mk = (k, i) => '<span class="' + (i.xing ? 'xing' : (i.mu ? 'mu' : '')) + '">' +
            k + i.gan + '<i>' + (i.short || '—') + '</i>' + (i.mu ? '·墓' : '') + (i.xing ? '·刑' : '') + '</span>';
          if (scheme === 's3') {
            const r = document.createElement('div'); r.className = 'sx-row';
            r.innerHTML = items.map(([k, i]) => mk(k, i)).join('');
            if (!rows.men) continue;
            cell.appendChild(r);
          } else {
            if (!rows.men) continue;
            const n = document.createElement('div'); n.className = 'sx-note';
            n.innerHTML = items.map(([k, i]) => '<div>' + mk(k, i) + '</div>').join('');
            cell.appendChild(n);
          }
        }
      }
    }, { scheme, CSS });
    await page.waitForTimeout(250);
  }

  const PANS = [
    ['s6', '方案6 · 长生盘'],
    ['s5', '方案5 · 三轨长生尺']
  ];
  for (const [id, label] of PANS) {
    await apply(id);
    await page.locator('#panHost').screenshot({ path: path.join(OUT, '方案-' + id + '.png') });
    /* 巽4 特写（击刑+入墓都在这一宫） */
    const cell = page.locator('.qm-cell').filter({ has: page.locator('.qm-pal', { hasText: '巽' }) }).first();
    await cell.screenshot({ path: path.join(OUT, '特写-' + id + '.png') });
    console.log('拍完', label);
  }
  if (errs.length) console.log('报错：', errs.join(' | '));
  await browser.close();
})();
