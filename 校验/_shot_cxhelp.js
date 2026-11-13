/* 串星课 · 读法（cxhelp.js）排版样张 —— 2026-11-13
 * 渲染的是**真弹层**：加载真 index.html（真 app.css / pan.css / 真 DOM），只把
 * CxHelp.sheet() 塞进 #sheet 并点亮 mask —— 与 ui.js 的 openSheet() 同一套动作。
 * 三种排版（同一份正文，只换样式层）：
 *   A 素纸分节卡（＝cxhelp.js 现装，不改一行）
 *   B 线装密排（无卡、无底色，细金线分节，字号收紧）
 *   C 描金章牌（浅金卡底 + 左侧金脊 + 表头金线）
 * 视口 390×844、dsr=2；素白必出，玄夜加一张。
 * 用法：
 *   python3 -m http.server 8791 --bind 127.0.0.1 --directory web &
 *   NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_shot_cxhelp.js
 * 产物：设计-串星课/读法样张-20261113/
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const URL_ = process.env.URL || 'http://127.0.0.1:8791/';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '设计-串星课', '读法样张-20261113');
const TAG = '20261113';
fs.mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------- 三种排版 */
/* 每条都是"覆盖层"，只动 cxd- 自己的类，不碰 app.css 任何一条既有规则。 */
const VARIANTS = [
  {
    key: 'A', name: '素纸分节卡', theme: 'white', css: ''
  },
  {
    key: 'B', name: '线装密排', theme: 'white',
    css: [
      /* 不画卡片：节与节之间只用一根细金线断开，像印在纸上的册页 */
      '.cxd-card{background:none;border:0;border-radius:0;margin:0;padding:0 0 12px}',
      '.cxd-card+.cxd-card{border-top:1px solid var(--line);padding-top:13px}',
      '.cxd-card:last-child{padding-bottom:2px}',
      '.cxd-h{font-size:12.5px;letter-spacing:.34em;color:var(--ink);padding-left:0;margin-bottom:7px}',
      '.cxd-h::before{display:none}',
      /* 节名后面拖一条细线，收住这一段 */
      '.cxd-h::after{content:"";flex:1 1 auto;height:1px;background:var(--line);margin-left:2px}',
      '.cxd-h{display:flex;align-items:center;gap:9px}',
      '.cxd-p{font-size:12px;line-height:1.78}',
      '.cxd-sh{font-size:11.5px;letter-spacing:.1em;margin:11px 0 3px;padding-left:0;color:var(--ink)}',
      '.cxd-sh::before{display:none}',
      '.cxd-sh::after{content:"：";color:var(--ink-3)}',
      '.cxd-tb th{color:var(--accent);border-bottom:1px solid var(--accent-line);letter-spacing:.1em}',
      '.cxd-tb td{padding:6px 2px;font-size:14px}',
      '.cxd-tb tr:first-child+tr td{border-bottom:1px solid var(--line)}',
      '.cxd-tb{width:auto;min-width:74%;margin-left:auto;margin-right:auto}',
      '.cxd-step>b{background:none;border:0;color:var(--accent);flex-basis:22px}',
      '.cxd-step{border-bottom:1px dotted var(--line)}',
      '.cxd-g10>span{background:none}',
      '.cxd-bz{background:none;border-color:var(--line)}',
      '.cxd-bz span{background:none}',
      '.cxd-cot{padding-left:0}',
      '.cxd-cot::before{display:none}',
      '.cxd-cot{letter-spacing:.16em;font-size:12px;color:var(--accent)}',
      '.cxd-case+.cxd-case{border-top:1px dotted var(--line);padding-top:10px;margin-top:10px}',
      '.cxd-dl>div{padding:6px 0}'
    ].join('')
  },
  {
    key: 'C', name: '描金章牌', theme: 'white',
    css: [
      /* 浅金卡底 + 左脊，节标题下压一条金线 */
      '.cxd-card{background:color-mix(in srgb, var(--accent) 5%, var(--surface));',
      'border:1px solid var(--accent-line);border-left:3px solid var(--accent);border-radius:9px;',
      'padding:12px 13px 13px}',
      '.cxd-h{font-size:13.5px;letter-spacing:.2em;padding:0 0 7px;margin-bottom:9px;',
      'border-bottom:1px solid var(--accent-line)}',
      '.cxd-h::before{display:none}',
      '.cxd-tb{border:1px solid var(--accent-line);border-radius:9px;overflow:hidden;',
      'border-collapse:separate;border-spacing:0}',
      '.cxd-tb th{background:color-mix(in srgb, var(--accent) 8%, transparent);',
      'border-bottom:1px solid var(--accent-line);color:var(--accent)}',
      '.cxd-tb td{border-bottom:1px solid var(--line-2)}',
      '.cxd-tb td.cxd-stem{background:color-mix(in srgb, var(--accent) 7%, transparent)}',
      '.cxd-step>b{background:none;border:1px solid var(--accent-line);color:var(--accent)}',
      '.cxd-g10>span{background:none;border-color:var(--accent-line)}',
      '.cxd-bz span{background:color-mix(in srgb, var(--accent) 4%, var(--surface))}',
      '.cxd-cot::before{height:.9em;width:3px;border-radius:2px}',
      '.cxd-sh{color:var(--ink);letter-spacing:.14em}',
      '.cxd-sh::before{background:var(--accent)}'
    ].join('')
  }
];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const made = [];

  /* 一次上下文，页面只加载一次；换排版靠换覆盖层 <style> 与滚动位置 */
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true,
    hasTouch: true, locale: 'zh-CN'
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  · 页面脚本报错（不影响样张）：' + e.message.split('\n')[0]));
  await page.goto(URL_, { waitUntil: 'load', timeout: 60000 });

  /* 真弹层：与 ui.js openSheet() 同样的三步（塞 HTML、点亮 mask、点亮 sheet） */
  await page.addScriptTag({ path: path.join(ROOT, 'web', 'js', 'cxhelp.js') });
  await page.evaluate(() => {
    document.documentElement.classList.remove('booting');
    const st = document.createElement('style');
    st.id = 'cxdShot';
    st.textContent = '*{transition:none!important;animation:none!important}';
    document.head.appendChild(st);
    const app = document.querySelector('.app');
    if (app) app.style.visibility = 'hidden';   /* 底下的起盘页不用入画 */
    const sh = document.getElementById('sheet');
    sh.innerHTML = window.CxHelp.sheet();
    const h = sh.querySelector('h2');
    if (h) sh.setAttribute('aria-label', h.textContent.trim());
    document.getElementById('mask').classList.add('on');
    sh.classList.add('on');
  });
  await page.evaluate(() => document.fonts.ready);

  const theme = t => page.evaluate(t => document.documentElement.setAttribute('data-theme', t), t);
  const variant = css => page.evaluate(css => {
    let el = document.getElementById('cxdVar');
    /* ⚠ 必须挂在 body 末尾：cxhelp.js 自带的 <style> 在 #sheet **里面**（body 内），
       挂到 <head> 去的话同权重的声明会被它压住 —— 卡片的 border/background 就不生效，
       只有它没写过的属性（display、::after…）才显得出来，看着像"只改了一半"。 */
    if (!el) { el = document.createElement('style'); el.id = 'cxdVar'; document.body.appendChild(el); }
    el.textContent = css;
    const sh = document.getElementById('sheet');
    sh.scrollTop = 0;
    return true;
  }, css);
  const scrollTo = which => page.evaluate(which => {
    const sh = document.getElementById('sheet');
    const cards = [...sh.querySelectorAll('.cxd-card')];
    /* which: 'top' | 'ke'（起课那张课表）| 'case'（实例那一堆）
       ⚠ 卡片下标按**现装七节**算：顺序 0 / 起课 1 / 天干论 2 / 六亲 3 / 实例 4 /
       六神类象 5 / 六亲类象 6。（2026-11-13 去掉「掌诀」后整体前移一位，别再改回 2/5） */
    if (which === 'top') { sh.scrollTop = 0; return 0; }
    const i = which === 'ke' ? 1 : 4;
    const c = cards[i] || cards[cards.length - 1];
    sh.scrollTop = Math.max(0, c.offsetTop - 26);
    return sh.scrollTop;
  }, which);
  const shot = async name => {
    const f = path.join(OUT, name + '-' + TAG + '.png');
    await page.screenshot({ path: f, animations: 'disabled' });
    made.push(f);
    console.log('  ✓ ' + path.basename(f));
    return f;
  };

  for (const v of VARIANTS) {
    await theme(v.theme);
    await variant(v.css);
    await scrollTo('top');
    await page.waitForTimeout(120);
    await shot(`读法-方案${v.key}-${v.name}-首屏`);
    await scrollTo('ke');
    await page.waitForTimeout(120);
    await shot(`读法-方案${v.key}-${v.name}-课表`);
  }

  /* 玄夜只出一张：方案 A（现装）首屏 + 课表 */
  await theme('blue');
  await variant('');
  await scrollTo('top');
  await page.waitForTimeout(120);
  await shot('读法-方案A-素纸分节卡-玄夜首屏');
  await scrollTo('case');
  await page.waitForTimeout(120);
  await shot('读法-方案A-素纸分节卡-玄夜实例');

  await ctx.close();

  /* ------------------------------------------------------------ 三案总览 */
  const files = VARIANTS.map(v => path.join(OUT, `读法-方案${v.key}-${v.name}-首屏-${TAG}.png`));
  const uri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const col = (v, f) => `<figure><figcaption><b>方案 ${v.key}</b>${v.name}</figcaption>`
    + `<img src="${uri(f)}" width="390" height="844"></figure>`;
  const html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;background:#e9eaee;font-family:"PingFang SC","HarmonyOS Sans SC",system-ui,sans-serif}
    h1{margin:18px 22px 2px;font-size:17px;letter-spacing:.1em;color:#1b2028}
    p.s{margin:0 22px 14px;font-size:12px;color:#6a7383;letter-spacing:.04em}
    .row{display:flex;gap:16px;padding:0 22px 22px;align-items:flex-start}
    figure{margin:0;background:#fff;border-radius:10px;padding:8px;box-shadow:0 2px 10px rgba(0,0,0,.10)}
    figcaption{font-size:11.5px;color:#4b5565;padding:2px 2px 8px;letter-spacing:.06em}
    figcaption b{color:#8a6a20;margin-right:6px;letter-spacing:.1em}
    img{display:block;width:390px;height:auto;border-radius:4px}
  </style>
  <h1>串星课 · 读法　三种排版样张</h1>
  <p class="s">同一份正文（原文七节，「掌诀」已按用户 2026-11-13 要求去掉；方案 A 为选定稿）· 真弹层 390×844 @2x · 素白主题</p>
  <div class="row">${VARIANTS.map((v, i) => col(v, files[i])).join('')}</div>`;
  const p2 = await ctx2(browser);
  await p2.setContent(html, { waitUntil: 'load' });
  await p2.waitForTimeout(200);
  const overview = path.join(OUT, `_总览-三案首屏对比-${TAG}.png`);
  const box = await p2.evaluate(() => {
    const r = document.querySelector('.row').getBoundingClientRect();
    return { w: Math.ceil(r.right + 22), h: Math.ceil(r.bottom + 18) };
  });
  await p2.setViewportSize({ width: box.w, height: box.h });
  await p2.waitForTimeout(150);
  await p2.screenshot({ path: overview, fullPage: true });
  made.push(overview);
  console.log('  ✓ ' + path.basename(overview));

  await browser.close();
  console.log(`\n共 ${made.length} 张 → 设计-串星课/读法样张-20261113/`);
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });

async function ctx2(browser) {
  return browser.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2 });
}
