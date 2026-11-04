/* 导出图（九宫）美化 · 方向预览（**不改仓库源码**，只在渲染后做后处理/换主题重绘）
 * 用法：
 *   NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules \
 *   node 校验/_preview_snap_beautify.js [when] [outDir]
 * 产物：outDir/<方向>_<主题>.png + outDir/_总览_<时间>.png
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const URL = process.env.URL || 'http://127.0.0.1:8767/';
const WHEN = process.argv[2] || '2026-11-04T10:00';
const OUTDIR = process.argv[3] || '/root/snap-preview';

/* ---------------- 页面里执行的样式层 ---------------- */
/* fn 里不能用箭头函数外的变量；所有参数都通过 S 传入 */
const IN_PAGE = `
window.__snapStyle = function (S) {
  var A = window.App, Q = window.Qimen;
  var chart = A.state.chart, analysis = A.state.analysis, starMap = A.state.starMap;
  var src = A.Snap.render(chart, analysis, starMap, A.state.face, {});
  var W = 1000, H = Math.round(src.height / 2);
  var cvs = document.createElement('canvas');
  cvs.width = src.width; cvs.height = src.height;
  var ctx = cvs.getContext('2d');
  ctx.scale(2, 2);

  /* 读主题色 */
  var rs = getComputedStyle(document.documentElement);
  var pan = document.querySelector('.qm-text-pan');
  var ps = pan ? getComputedStyle(pan) : rs;
  function rv(n, fb) { return (rs.getPropertyValue(n) || '').trim() || fb; }
  function pv(n, fb) { return (ps.getPropertyValue(n) || '').trim() || fb; }
  var P = {
    ink: rv('--ink', '#1b2028'), ink2: rv('--ink-2', '#4b5565'), ink3: rv('--ink-3', '#8d97a6'),
    accent: rv('--accent', '#a8842c'), line: rv('--line', 'rgba(28,38,58,.11)'),
    surface: rv('--surface', '#fff'), bg: rv('--bg', '#fff'),
    moon: rv('--slide-ch2', '')
  };

  function hex2rgb(h) { h = h.replace('#',''); if (h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
  function mix(a, b, t) { var A_ = hex2rgb(a), B_ = hex2rgb(b);
    return 'rgb(' + Math.round(A_[0]+(B_[0]-A_[0])*t) + ',' + Math.round(A_[1]+(B_[1]-A_[1])*t) + ',' + Math.round(A_[2]+(B_[2]-A_[2])*t) + ')'; }
  function alpha(c, a) { var A_ = hex2rgb(c); return 'rgba(' + A_[0]+','+A_[1]+','+A_[2]+','+a+')'; }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  var mode = S.mode;
  /* ---------------- 背景：与主题呼应的纸/绢底 ---------------- */
  var paper = '#ffffff', tint = '#fffdf8';
  if (mode === 'paper' || mode === 'gold') {
    /* 暖宣纸：四角略深，中心提亮 */
    paper = '#fbf7ee';
    var g0 = ctx.createRadialGradient(W/2, H*0.42, 60, W/2, H*0.42, H*0.72);
    g0.addColorStop(0, '#fffdf7'); g0.addColorStop(1, '#f3ecdd');
    ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
    /* 细纤维纹（低对比，打印时不脏） */
    ctx.globalAlpha = 0.035;
    for (var i = 0; i < 2600; i++) {
      var rx = Math.random()*W, ry = Math.random()*H, rl = 2 + Math.random()*7;
      ctx.strokeStyle = Math.random() > .5 ? '#8a6f3a' : '#c9b98e';
      ctx.lineWidth = Math.random() > .7 ? 1 : .5;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + rl, ry + (Math.random()-.5)*1.2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  }

  /* ---------------- 底图：先按 pattern 铺现状图 ---------------- */
  ctx.drawImage(src, 0, 0, W, H);

  /* 把现状图里"白底"改成纸色：用 destination-over 做不到，改用滤色法 ——
     直接把每个像素的亮部映射到纸色（只动 luminance > 0.965 的像素，字与线不受影响）。 */
  if (mode === 'paper' || mode === 'gold') {
    var id = ctx.getImageData(0, 0, cvs.width, cvs.height);
    var d = id.data, pr = (function(){ var c = '_'; var h = paper.replace('#',''); var n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; })();
    var tpr = (function(){ var h = tint.replace('#',''); var n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; })();
    for (var k = 0; k < d.length; k += 4) {
      if (d[k] > 247 && d[k+1] > 247 && d[k+2] > 247) {
        /* 纯白 → 纸色；带一点极轻的纵向渐变 */
        var yy = Math.floor(k / 4 / cvs.width) / cvs.height;
        var t = 0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, Math.max(0, yy)));
        d[k]   = Math.round(pr[0] + (tpr[0]-pr[0]) * t);
        d[k+1] = Math.round(pr[1] + (tpr[1]-pr[1]) * t);
        d[k+2] = Math.round(pr[2] + (tpr[2]-pr[2]) * t);
      }
    }
    ctx.putImageData(id, 0, 0);
  }

  /* ---------------- 盘面重绘：细线框 → 宫格铜线 ---------------- */
  var PAD = 44, panW = W - PAD*2;
  var CARD_K = 1.47321, gap = panW * 7 / 350;
  var cell = (panW - gap*2) / 3, cellH = cell * CARD_K;
  var headH = 176;   // 默认矩阵
  try { if (window.SizhuUI && (+(window.Store.settings.sizhu)===1) && !chart.yinpan) headH = window.SizhuUI.height(panW) || 176; } catch(e) {}
  var panH = cellH*3 + gap*2;
  var Hcalc = Math.round(PAD + 62 + headH + 58 + panH + 74 + PAD);
  var panY = Hcalc - PAD - 74 - panH;
  var panX = PAD;

  if (mode === 'grid') {
    /* 统一宫格：把九张独立圆角卡合成一张带内框的方格纸 */
    /* 先把卡里的白底擦成纸色，再去掉卡描边（重画） */
    ctx.save();
    var id2 = ctx.getImageData(0, 0, cvs.width, cvs.height); var d2 = id2.data;
    // 不改动像素，只做描边覆盖
    ctx.restore();
    /* 外框：双线 */
    ctx.strokeStyle = alpha(P.ink3, .55); ctx.lineWidth = 1.2;
    rrect(panX - 14, panY - 14, panW + 28, panH + 28, 2); ctx.stroke();
    ctx.strokeStyle = alpha(P.ink3, .22); ctx.lineWidth = .8;
    rrect(panX - 21, panY - 21, panW + 42, panH + 42, 2); ctx.stroke();
    /* 宫线：只画内线 */
    ctx.strokeStyle = alpha(P.ink3, .42); ctx.lineWidth = 1.1;
    for (var i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(panX + i*(cell+gap) - gap/2, panY - 8); ctx.lineTo(panX + i*(cell+gap) - gap/2, panY + panH + 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(panX - 8, panY + i*(cellH+gap) - gap/2); ctx.lineTo(panX + panW + 8, panY + i*(cellH+gap) - gap/2); ctx.stroke();
    }
    /* 四角双线断口（朱印位） */
    ctx.strokeStyle = alpha(P.accent, .5); ctx.lineWidth = 1.6;
    var cz = 26;
    [[panX-21, panY-21, 1, 1], [panX+panW+21, panY-21, -1, 1], [panX-21, panY+panH+21, 1, -1], [panX+panW+21, panY+panH+21, -1, -1]].forEach(function (c) {
      ctx.beginPath(); ctx.moveTo(c[0], c[1] + c[3]*cz); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0] + c[2]*cz, c[1]); ctx.stroke();
    });
  }

  if (mode === 'gold') {
    /* 描金：沿九宫外框描一圈渐隐金线 + 中心印 */
    ctx.save();
    var gg = ctx.createLinearGradient(panX, panY, panX + panW, panY + panH);
    gg.addColorStop(0, alpha(P.accent, .18)); gg.addColorStop(.5, alpha(P.accent, .62)); gg.addColorStop(1, alpha(P.accent, .18));
    ctx.strokeStyle = gg; ctx.lineWidth = 1.4;
    rrect(panX - 12, panY - 12, panW + 24, panH + 24, 3); ctx.stroke();
    ctx.restore();
  }

  return { url: cvs.toDataURL('image/png'), w: cvs.width, h: cvs.height, H: Hcalc, panY: panY };
};

window.__snapRender = function (theme) {
  /* 切主题后重绘（theme='' 表示维持） */
  if (theme) document.documentElement.setAttribute('data-theme', theme);
  var A = window.App;
  return A.Snap.render(A.state.chart, A.state.analysis, A.state.starMap, A.state.face, {}).toDataURL('image/png');
};
`;

(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.evaluate(v => {
    const el = document.getElementById('dtPick');
    el.value = v; el.dispatchEvent(new Event('change', { bubbles: true }));
  }, WHEN);
  await page.evaluate(() => document.getElementById('btnCast').click());
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: IN_PAGE });

  const jobs = [
    ['0-现状-素白', { mode: 'raw' }, 'white'],
    ['1-宣纸金线', { mode: 'paper' }, 'white'],
    ['2-九宫格', { mode: 'grid' }, 'white'],
    ['3-玄夜', { mode: 'raw' }, 'blue'],
    ['4-玄夜描金', { mode: 'gold' }, 'blue'],
    ['5-墨玉', { mode: 'raw' }, 'slate'],
    ['6-铜仪', { mode: 'raw' }, 'brown'],
  ];
  const saved = [];
  for (const [name, opts, theme] of jobs) {
    const res = await page.evaluate(([o, t]) => {
      const st = window.__snapStyle(o);
      return { url: st.url };
    }, [opts, theme]);
    const f = path.join(OUTDIR, name + '.png');
    fs.writeFileSync(f, Buffer.from(res.url.split(',')[1], 'base64'));
    saved.push(f);
    console.log('saved', f);
  }
  if (errs.length) console.log('ERRORS:', errs);
  await browser.close();
})();
