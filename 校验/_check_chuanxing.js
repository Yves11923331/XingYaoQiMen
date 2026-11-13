/* ============================================================================
 * _check_chuanxing.js —— 串星（小六壬·加干 / 加星）页面集成自测（jsdom，跑真 index.html）
 * 跑法：NODE_PATH=/root/dsh-dom/node_modules node 校验/_check_chuanxing.js
 *
 * 分工（三道门各管一层，别互相越界）：
 *   · 校验/_check_cx_engine.js  —— 引擎层：四数→课、六亲矩阵、两套译法、不随盘面变；
 *   · 校验/_check_cxhelp.js     —— 读法稿与底本逐字对照；
 *   · 本文件                    —— **页面层**：在真 index.html 上点出来的东西。
 *
 * 2026-11-13 用户追加的五条结构（本文件按它断言）：
 *   ① 分段三档 时间 / 数字 / 随机，默认「时间」；数字档里**没有**「此刻 / 随机四数」；
 *      随机档＝点「起课」当下抽四数、弹层「重排」再抽，域随译法（六神 1–6 / 九星 1–9，末位 1–10）。
 *   ② 六神/九星 是**可勾选控件**（真 input[type=checkbox]），原来那枚 46×48 大方章已整套删除；
 *      仍只在起课页出现一处，课页 / 盘面同显 / 导出图 / 设置页四处都没有。
 *   ③ 三档里都不写结果：数字档四格下没有译名、没有六亲预览行（六神名一律到课页看）。
 *   ④ 时间卡 / 分段按钮 / 起课按钮 与起盘页对齐（≤2px）。
 *      ⚠ jsdom **没有排版引擎**（offsetHeight / getBoundingClientRect 恒 0），像素差量不出来 ——
 *      所以「≤2px」在 校验/_probe_runtime.js（真 Chromium）里量；这里只钉 CSS 契约：
 *      三处元素与起盘页**用同一组 class**、且 app.css 里没有针对 #view-chuanxing 单独改高/改字号的规则。
 *   ⑤ 时间档不再摆「农历…· 只读」那行说明小字，右侧 ⓘ 还在。
 *
 * 其余断言：五例对表（1527 / 1158 / 1724 / 9444 / 命造 1316）、连根判别性（只用 1527 与 9444）、
 * 双译法不变量（四数与天干一字不变 / 三宫换表 / 六亲必重算）、0 归一、越界值放行、
 * 非法输入不落半成品课、空亡只灰无线、盘面同显（课在中宫·随机取数）、导出图三路参数、
 * 读法七节 + 九星口径提示，以及原有的底栏 / 时刻卡 showPicker / 设置项 / 阴盘那几组。
 *
 * 对表用的「参考实现」写在文件里，**不引用 web/js 的任何东西**（含 cx.js）：
 * 六亲走口径表 §4.3 的 5×10 全表（不是从生克推），连根走 p=(p+kd(n,k)−1) mod k。
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const readFile = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* 源码级断言必须先剥注释 —— 否则「注释里提到的旧 id / 旧类名」会被当成残留报错 */
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const stripHtmlComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

/* ---------------------------------------------------------------- 参考实现 */
const SIXN = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'];
const SIXWX = ['木', '土', '火', '金', '水', '土'];
const STARN = ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'];
const STARWX = ['水', '土', '木', '木', '土', '金', '金', '土', '火'];
const GAN10 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const GANWX = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
                '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
/* 六亲全表（口径表 §4.3）：行＝宫五行，列＝甲乙丙丁戊己庚辛壬癸。这里是**表**，不是算法 —— 
   故意不从生克推，才能当独立参照。空亡与留连同属土，两行本来就相同（授土，不是漏改）。 */
const QIN_MATRIX = {
  '木': '兄弟 兄弟 父母 父母 官鬼 官鬼 妻财 妻财 子孙 子孙',
  '土': '妻财 妻财 子孙 子孙 兄弟 兄弟 父母 父母 官鬼 官鬼',
  '火': '子孙 子孙 兄弟 兄弟 父母 父母 官鬼 官鬼 妻财 妻财',
  '金': '官鬼 官鬼 妻财 妻财 子孙 子孙 兄弟 兄弟 父母 父母',
  '水': '父母 父母 官鬼 官鬼 妻财 妻财 子孙 子孙 兄弟 兄弟'
};
function qinRef(el, stem) { return QIN_MATRIX[el].split(' ')[GAN10.indexOf(stem)]; }
/* 归一：0 与 k 都落回 k（0 按 6/9/10 论），11 → 1 */
function kd(n, k) { return ((n - 1) % k + k) % k + 1; }
/* 连根数起：数到哪一宫，下一数从那宫重新起 1 */
function chainIdx(nums, k) {
  let p = 0; const out = [];
  for (let i = 0; i < 3; i++) { p = ((p + kd(+nums[i], k) - 1) % k + k) % k; out.push(p); }
  return out;
}
/* 反例：每一数都从表首起数（不连根）—— 用来证明 1527 / 9444 有判别力 */
function naiveNames(nums, mode) {
  const T = mode === 'star' ? STARN : SIXN, k = mode === 'star' ? 9 : 6;
  return [0, 1, 2].map((i) => T[(kd(+nums[i], k) - 1) % k]);
}
function refLesson(nums, mode) {
  const star = mode === 'star';
  const T = star ? STARN : SIXN, W = star ? STARWX : SIXWX, k = star ? 9 : 6;
  const idx = chainIdx(nums, k);
  const stem = GAN10[kd(+nums[3], 10) - 1];
  return { names: idx.map((i) => T[i]), qins: idx.map((i) => qinRef(W[i], stem)), stem, idx };
}

/* ---------------------------------------------------------------- 计数 */
let pass = 0, fail = 0;
let CUR = '';
const groups = {};
function G(name) { CUR = name; if (!groups[name]) groups[name] = { pass: 0, fail: 0 }; }
function ok(c, m) {
  const g = groups[CUR];
  if (c) { pass++; g.pass++; } else { fail++; g.fail++; console.log('  ✗ [' + CUR + '] ' + m); }
}
function eq(a, b, m) { ok(a === b, m + '  期望「' + b + '」实得「' + a + '」'); }
function has(hay, needle, m) {
  ok(String(hay).indexOf(needle) >= 0, m + '  期望含「' + needle + '」，实得「' + String(hay).slice(0, 120) + '」');
}
function hasNot(hay, needle, m) {
  ok(String(hay).indexOf(needle) < 0, m + '  不该含「' + needle + '」，实得「' + String(hay).slice(0, 120) + '」');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function group(name, fn) {
  G(name);
  try { await fn(); }
  catch (e) { fail++; groups[name].fail++; console.log('  ✗ [' + name + '] 整组抛错：' + (e && e.message)); }
}

/* ---------------------------------------------------------------- 起一个真页面 */
/* ⚠ 必须「只 init 一次」：ui.js 的入口是
     if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init); else init();
   jsdom 解析完会**自己**派发 DOMContentLoaded；如果这里再手动派一次，init 就跑两遍，
   同一个按钮上挂两个监听（实测：点一次时刻卡 showPicker 被调 2 次）——
   那是测试脚手架的病，不是产品的病。所以：还在 loading 就等 jsdom 自己派，否则按「已 init」算。 */
async function boot(seed) {
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errs.push('jsdomError: ' + String((e && e.message) || e).slice(0, 200)));
  vc.on('error', function () {
    errs.push('console.error: ' + Array.prototype.slice.call(arguments).join(' ').slice(0, 200));
  });
  const dom = new JSDOM(readFile('web/index.html'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'http://127.0.0.1:8766/index.html', virtualConsole: vc
  });
  const win = dom.window, doc = win.document;

  /* 存档注入（测「刷新后仍记得上次译法」）—— 必须早于脚本执行 */
  if (seed) win.localStorage.setItem('xymq.set.v1', JSON.stringify(seed));

  /* 「减少动态效果」可开关：默认 true ⇒ 切译法同步生效（断言不用等计时器）；
     测动画那条时临时置 false，看它 170ms 后自己收尾。 */
  let reduce = true;
  win.matchMedia = (q) => ({
    matches: reduce, media: q,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}
  });

  const scripts = [...doc.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'))
    .filter((s) => !/^https?:/.test(s));
  const loading = doc.readyState === 'loading';
  const dcl = loading
    ? new Promise((res) => doc.addEventListener('DOMContentLoaded', res, { once: true }))
    : null;
  for (const src of scripts) {
    try { win.eval(fs.readFileSync(path.join(WEB, src.replace(/\?.*$/, '')), 'utf8')); }
    catch (e) { errs.push('eval ' + src + '：' + e.message); }
  }
  /* 只有「脚本跑完时页面还在解析」这一种情况才等 jsdom 自己派 DOMContentLoaded；
     否则 ui.js 已经在末尾直接 init() 过了，再派一次就是二次初始化（监听会成对挂上）。 */
  if (dcl) { try { await dcl; } catch (e) { errs.push('init：' + e.message); } }

  const $ = (id) => doc.getElementById(id);
  return { win, doc, $, errs, setReduce: (v) => { reduce = !!v; } };
}

/* ==========================================================================
 * 主流程
 * ======================================================================== */
(async function main() {
  const A = await boot(null);
  const win = A.win, doc = A.doc, $ = A.$;
  const S = win.Store.settings;

  /* ---------------------------------------------------- 页面小工具 */
  const SEGSRC = ['time', 'nums', 'rand'];
  const IN = ['cxN0', 'cxN1', 'cxN2', 'cxN3'];
  const ALLNAMES = /大安|留连|速喜|赤口|小吉|空亡|天蓬|天芮|天冲|天辅|天禽|天心|天柱|天任|天英/;

  function segBar() { return $('segCxSrc'); }
  function segBtn(src) {
    const bar = segBar(); if (!bar) return null;
    return bar.querySelector('button[data-src="' + src + '"]') || bar.querySelector('button[data-mode="' + src + '"]');
  }
  function segActive() {
    const bar = segBar(); if (!bar) return null;
    return bar.querySelector('button.on') || bar.querySelector('[aria-selected="true"]');
  }
  function segActiveKey() {
    const b = segActive(); if (!b) return '';
    return b.dataset.src || b.dataset.mode || b.textContent.trim();
  }
  function setTab(src) { const b = segBtn(src); if (b) b.click(); else throw new Error('找不到分段按钮 ' + src); }
  function panelOn(id) { const el = $(id); return !!(el && el.classList.contains('on')); }
  function cells() { return [...doc.querySelectorAll('#cxPopGrid .xcell')]; }
  function cellNm() { return [...doc.querySelectorAll('#cxPopGrid .xcell .nm')].map((n) => n.textContent); }
  function popOn() { return $('cxPop').classList.contains('on'); }
  function closePop() { if (popOn()) $('cxPopBack').click(); }
  function fill(vals) {
    vals.forEach((v, i) => {
      const el = $(IN[i]);
      if (!el) throw new Error('找不到第 ' + (i + 1) + ' 格 ' + IN[i]);
      el.value = String(v);
      el.dispatchEvent(new win.Event('input', { bubbles: true }));
    });
  }
  function mode() { return $('cxStar').checked ? 'star' : 'six'; }
  function setMode(m) {
    const want = (m === 'star');
    if ($('cxStar').checked === want) return;
    $('cxStar').click();               /* 真点一下（change 由浏览器/JS 触发） */
    if ($('cxStar').checked !== want) {        /* 有的环境不派发 change，退一步手派 */
      $('cxStar').checked = want;
      $('cxStar').dispatchEvent(new win.Event('change', { bubbles: true }));
    }
  }
  function expectLesson(label, nums, m) {
    const r = refLesson(nums, m);
    const nm = cellNm();
    eq(nm.length, 7, label + ' · 课页七格（上四下三）');
    eq(nm.slice(0, 3).join('/'), r.names.join('/'), label + ' · 三宫名');
    eq(nm[3], r.stem, label + ' · 天干');
    eq(nm.slice(4).join('/'), r.qins.join('/'), label + ' · 三宫六亲');
    return r;
  }
  /* 数字档起一课（填格 → 起课），返回课页文字 */
  function castNums(nums, label) {
    setTab('nums');
    fill(nums);
    $('btnCastX').click();
    ok(popOn(), (label || nums.join('')) + ' · 点「起课」应弹出课页');
    return cellNm();
  }
  const J = (a) => JSON.stringify(a);

  /* ==================================================== ⓪ 起盘页（原有断言） */
  await group('⓪ 起盘页骨架', async () => {
    ok(!$('segNowPick'), '起盘页不应再有「此刻 / 选时刻」分段');
    eq($('segMode3').querySelector('button[data-m="time"]').textContent.trim(), '此时刻', '「按时刻」应改名「此时刻」');
    ok($('timecard').contains($('dtPick')), '#dtPick 应压在起盘页的时刻卡里');
    $('dtPick').value = '2026-09-02T10:30';
    $('dtPick').dispatchEvent(new win.Event('change', { bubbles: true }));
    ok(($('homeTime').textContent || '').indexOf('2026-09-02') >= 0
      || ($('homeTime').textContent || '').indexOf('10:30') >= 0,
      '改 #dtPick 后起盘页时刻应跟着走，实得 ' + $('homeTime').textContent);
  });

  /* 时刻卡：点卡必须显式调起原生选择器（2026-10-21 用户报「点时间栏无响应」） */
  await group('⓪2 时刻卡 showPicker', async () => {
    let picked = 0;
    $('dtPick').showPicker = function () { picked++; };
    $('timecard').click();
    eq(picked, 1, '点起盘页时刻卡应调起原生选择器（showPicker）');
    /* 老 WebView 没有 showPicker：必须退回程序化 click（原生选择器照样弹） */
    delete $('dtPick').showPicker;
    let inpClicked = 0;
    $('dtPick').addEventListener('click', function () { inpClicked++; });
    $('timecard').click();
    eq(inpClicked, 1, '无 showPicker 时应退回 input.click()');
    delete $('dtPick').showPicker;
  });

  /* ==================================================== ① 底栏 */
  await group('① 底栏三格', async () => {
    const tabs = [...doc.querySelectorAll('#tabbar button')].map((b) => b.textContent.trim());
    eq(tabs.length, 3, '底栏应是三格');
    ok(tabs[1] && tabs[1].indexOf('串星') >= 0, '第二格应是「串星」，实得 ' + tabs[1]);
    ok(tabs[0] && tabs[0].indexOf('起盘') >= 0 && tabs[2] && tabs[2].indexOf('设置') >= 0,
      '第一 / 第三格应是起盘 / 设置，实得 ' + tabs.join(' '));
  });

  /* ==================================================== ② 进串星页 */
  await group('② 串星页抬头与时刻卡', async () => {
    doc.querySelector('#tabbar button[data-view="chuanxing"]').click();
    ok($('view-chuanxing').classList.contains('on'), '点了串星应显示 #view-chuanxing');
    ok($('cxTime').textContent !== '—', '串星页时刻卡应有内容，实得 ' + $('cxTime').textContent);
    has($('cxSub').textContent, '局', '串星页副行应含局名');
    has($('cxSub').textContent, '农历', '串星页副行应含农历');
    /* 点大时刻即选时刻（同起盘页，1px 隐形锚点 + JS openTimePicker） */
    ok($('view-chuanxing').contains($('cxPick')), '#cxPick 应压在串星页的时刻卡里');
    let cxPicked = 0;
    $('cxPick').showPicker = function () { cxPicked++; };
    doc.querySelector('#view-chuanxing .timecard').click();
    eq(cxPicked, 1, '串星页点时刻卡应调起原生选择器');
    delete $('cxPick').showPicker;
  });

  /* ==================================================== ③ 五条结构之①：三档分段 */
  await group('③ 分段三档（时间 / 数字 / 随机）', async () => {
    const bar = segBar();
    ok(!!bar, '应有分段行 #segCxSrc');
    const btns = [...bar.children].filter((b) => b.tagName === 'BUTTON');
    eq(btns.length, 3, '分段按钮应恰好 3 个');
    eq(btns.map((b) => b.textContent.trim()).join('/'), '时间/数字/随机', '分段文案与顺序');
    eq(btns.map((b) => b.dataset.src || b.dataset.mode).join('/'), 'time/nums/rand',
      '三档的 data-src（或 data-mode）应是 time / nums / rand');
    eq(segActiveKey(), 'time', '首屏默认应停在「时间」档');
    ok(panelOn('cxPanelTime'), '首屏 #cxPanelTime 应是显示的那一档');
    ok(!panelOn('cxPanelNums') && !panelOn('cxPanelRand'), '首屏数字 / 随机两档都不该显示');
    /* 「此刻 / 随机四数」已取消（功能分别由时间档 / 随机档承担） */
    const btnTxts = [...doc.querySelectorAll('#view-chuanxing button')].map((b) => b.textContent.trim());
    eq(btnTxts.filter((t) => t === '此刻').length, 0, '起课页不该再有「此刻」按钮');
    eq(btnTxts.filter((t) => t.indexOf('随机四数') >= 0).length, 0, '起课页不该再有「随机四数」按钮');
    ok(!$('btnCxNow') && !$('btnCxRand') && !$('segCxPick'), '旧的 #btnCxNow / #btnCxRand / #segCxPick 应已删除');
  });

  /* ==================================================== ④ 时间档：只给数，不给结果 */
  await group('④ 时间档（四数只读 · 直译自盘面 · 无说明小字）', async () => {
    $('cxPick').value = '2026-11-13T08:23';
    $('cxPick').dispatchEvent(new win.Event('change', { bubbles: true }));
    const c = win.App.state.cxTimeChart;
    ok(!!c && !!c.calendar, '串星页应记下这一刻的盘（state.cxTimeChart）');
    const cal = c.calendar;
    const want = [cal.lunar.month, cal.lunar.day, cal.index.hourZhi + 1, cal.index.hourGan + 1];
    const got = [...$('cxTimeNums').children].map((x) => (x.querySelector('b') || {}).textContent);
    eq(got.join('/'), want.join('/'), '时间档四数应＝农历月 / 农历日 / 时辰序 / 时干序');
    eq([...$('cxTimeNums').children].map((x) => (x.querySelector('.lb') || {}).textContent).join('/'),
      '天宫/地宫/人宫/天干', '时间档四格标签');
    /* 只读：档里一个可编辑元素都没有 */
    eq($('cxPanelTime').querySelectorAll('input,select,textarea').length, 0, '时间档不该有可编辑控件（只读）');
    /* ⑤ 说明小字已删：#cxTimeFrom 整颗节点不该存在，ⓘ 还在 */
    ok(!$('cxTimeFrom'), '时间档不该再有 #cxTimeFrom 那行说明');
    hasNot($('cxPanelTime').textContent, '农历', '时间档里不该再出现「农历…」说明文字');
    hasNot($('cxPanelTime').textContent, '只读', '时间档里不该再出现「只读」说明文字');
    /* 2026-11-13 末轮：ⓘ 从档内挪到「勾选行」，且**全页只剩一枚**（原先时间档/随机档各一枚属重复） */
    ok(!!$('cxTimeHelp'), '勾选行左侧的 ⓘ（#cxTimeHelp）应还在');
    ok($('cxPanelTime').contains($('cxTimeHelp')) === false, 'ⓘ 应从时间档内挪出去');
    eq(doc.querySelectorAll('#view-chuanxing .mhelp').length, 1, '串星页只该有 1 枚 ⓘ（重复的不再加）');
    ok(!$('cxRandHelp'), '随机档那枚重复的 ⓘ 应已删除');
    /* ⓘ 仍能用：弹出「四数从哪来」 */
    $('cxTimeHelp').click();
    ok($('sheet').classList.contains('on'), '点 ⓘ 应弹出说明弹层');
    has($('sheet').textContent, '天宫数', 'ⓘ 弹层应说明天宫数从哪来');
    has($('sheet').textContent, '农历月号', 'ⓘ 弹层应写「农历月号」');
    const okBtn = $('btnCxNumsHelpOk');
    if (okBtn) okBtn.click(); else $('sheet').classList.remove('on');
  });

  /* ==================================================== ⑤ 时间档 · 甲时（甲就是 1） */
  await group('⑤ 甲不上盘已删：甲时天干数就是 1', async () => {
    /* 找一个时干为甲的整点：2026-11-13 00:00 起逐小时找 */
    const Lunar = win.Lunar;
    let hit = null;
    for (let h = 0; h < 24 * 15 && !hit; h++) {
      const d = new Date(Date.UTC(2026, 10, 13, 0, 0) + h * 3600e3);
      const y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1, dd = d.getUTCDate(), hh = d.getUTCHours();
      const cal = Lunar.cast(y, mo, dd, hh, 0, { lateZi: !!S.lateZi });
      if (cal.index.hourGan === 0) hit = { y, mo, dd, hh, cal };
    }
    ok(!!hit, '应能找到一个时干为「甲」的时刻（找不到就没法验）');
    if (!hit) return;
    const p2 = (n) => (n < 10 ? '0' + n : '' + n);
    $('cxPick').value = hit.y + '-' + p2(hit.mo) + '-' + p2(hit.dd) + 'T' + p2(hit.hh) + ':00';
    $('cxPick').dispatchEvent(new win.Event('change', { bubbles: true }));
    const b4 = $('cxTimeNums').children[3].querySelector('b').textContent;
    eq(b4, '1', '甲时的时干序应为 1（甲就是 1，不许换成旬首）');
    eq(hit.cal.index.hourGan + 1, 1, '（参照）历法层的时干序');
    /* 源码级：那行「甲不上盘」的旬首替换不许回来。
       ⚠ 只看串星段（var CX_LB … var VIEW_ORDER）—— ui.js:414 的 hourLead 是**盘面详情**里
       「甲时借旬首之仪」的旧奇门口径，跟串星课不是一处，不能一棒子打了。 */
    const uiRaw = readFile('web/js/ui.js');
    const cxRaw = uiRaw.slice(uiRaw.indexOf('var CX_LB'), uiRaw.indexOf('var VIEW_ORDER'));
    ok(cxRaw.length > 2000, '应能截出串星段（var CX_LB … var VIEW_ORDER），实得 ' + cxRaw.length + ' 字符');
    const cxSrc = stripComments(cxRaw);
    ok(!/hourLead/.test(cxSrc), '串星段里不许再出现 hourLead（甲不上盘的旬首替换）');
    ok(!/hs\s*===\s*1/.test(cxSrc), '串星段里不许再有 hs === 1 的替换分支');
  });

  /* ==================================================== ⑥ 数字档：只填数，不写结果 */
  await group('⑥ 数字档（无译名 · 无六亲预览 · 标签保留）', async () => {
    setTab('nums');
    ok(panelOn('cxPanelNums') && !panelOn('cxPanelTime') && !panelOn('cxPanelRand'),
      '切到数字档：只 #cxPanelNums 显示');
    eq(segActiveKey(), 'nums', '分段行应把「数字」标成当前档');
    eq([...$('cxPanelNums').querySelectorAll('.cxi .lb')].map((e) => e.textContent).join('/'),
      '天宫/地宫/人宫/天干', '四格上方的标签应保留');
    fill(['', '', '', '']);
    eq(IN.map((id) => $(id).value).join('|'), '|||', '切到数字档不该静默带数过来（四格应是空的）');
    /* ③ 结果一律到课页看：三档容器里没有译名节点、没有六亲行 */
    eq(doc.querySelectorAll('#cxstage .nm').length, 0, '三档里不该有译名节点 .nm');
    eq(doc.querySelectorAll('#cxstage .cxqin').length, 0, '三档里不该有六亲预览行 .cxqin');
    eq(doc.querySelectorAll('#view-chuanxing .home .nm, #view-chuanxing .cxbar .nm').length, 0,
      '起课页主体（不含课页弹层）不该出现译名');
    fill(['1', '5', '2', '7']);
    hasNot($('cxPanelNums').textContent, '大安', '填完四数，数字档里也不该出现神名（不预览）');
    eq($('cxPanelNums').querySelectorAll('.nm').length, 0, '数字档填完仍不该长出 .nm');
    eq($('cxPanelNums').querySelectorAll('button').length, 0, '数字档里不该有任何按钮');
  });

  /* ==================================================== ⑦ 五例对表（六神） */
  await group('⑦ 五例对表（六神 · 底本标注）', async () => {
    setMode('six');
    closePop();
    const CASES = [
      { nums: ['1', '5', '2', '7'], src: '底本 L8–25 起课例（1527）' },
      { nums: ['1', '1', '5', '8'], src: '底本 L57–59 问成绩（1158）' },
      { nums: ['1', '7', '2', '4'], src: '底本 L86–88 射覆（1724）' },
      { nums: ['9', '4', '4', '4'], src: '底本 L108–111 法师斗法（9444）' },
      { nums: ['1', '3', '1', '6'], src: '底本 L73–74 命造（由最小四数 1316 复现）' }
    ];
    const seen = [];
    for (const cs of CASES) {
      const nm = castNums(cs.nums, cs.src);
      const r = expectLesson(cs.src, cs.nums, 'six');
      has($('cxPopSub').textContent, '六神', cs.src + ' · 副行应标六神口径');
      has($('cxPopSub').textContent, '天干 ' + r.stem, cs.src + ' · 副行应写天干');
      seen.push(nm.slice(0, 3).join('/'));
      closePop();
    }
    eq(seen.join(' | '),
      '大安/小吉/空亡 | 大安/大安/小吉 | 大安/大安/留连 | 速喜/空亡/速喜 | 大安/速喜/速喜',
      '五例三宫名与底本逐例一致');
  });

  /* ==================================================== ⑧ 连根判别性（1527 / 9444） */
  await group('⑧ 连根数起（1527 与 9444 有判别力）', async () => {
    setMode('six');
    for (const nums of [['1', '5', '2', '7'], ['9', '4', '4', '4']]) {
      closePop();
      castNums(nums, '连根 ' + nums.join(''));
      const page = cellNm().slice(0, 3);
      const chain = refLesson(nums, 'six').names;
      const naive = naiveNames(nums, 'six');
      eq(page.join('/'), chain.join('/'), nums.join('') + ' · 页面应等于连根读法');
      ok(chain.join('/') !== naive.join('/'),
        nums.join('') + ' · 连根与「每数都从大安起」应同解分歧（否则这例没有判别力）');
      const diffAt = [0, 1, 2].filter((i) => chain[i] !== naive[i]);
      ok(diffAt.length >= 1, nums.join('') + ' · 至少一宫的两种读法不同');
      diffAt.forEach((i) => ok(page[i] !== naive[i],
        nums.join('') + ' · 第 ' + (i + 1) + ' 宫不该是逐数自大安起读出来的「' + naive[i] + '」，实得「' + page[i] + '」'));
      closePop();
    }
    eq(naiveNames(['1', '5', '2', '7'], 'six')[2], '留连', '（参照）1527 不连根时人宫会是留连');
    eq(naiveNames(['9', '4', '4', '4'], 'six').slice(1).join('/'), '赤口/赤口', '（参照）9444 不连根时地宫/人宫会是赤口');
  });

  /* ==================================================== ⑨ 双译法不变量 */
  await group('⑨ 双译法（四数与天干不变 · 三宫换表 · 六亲必重算）', async () => {
    setMode('six');
    closePop();
    /* —— 1527 —— */
    castNums(['1', '5', '2', '7'], '1527 六神');
    eq(cellNm().join('/'), '大安/小吉/空亡/庚/妻财/子孙/父母', '1527 六神对表（底本 L13）');
    eq(win.App.state.cxLesson.nums.join(''), '1527', '课里记的四数');
    setMode('star');
    expectLesson('1527 九星', ['1', '5', '2', '7'], 'star');
    eq(cellNm().join('/'), '天蓬/天禽/天心/庚/子孙/父母/兄弟', '1527 九星对表');
    eq(win.App.state.cxLesson.nums.join(''), '1527', '切译法后四数一字不变');
    eq(win.App.state.cxLesson.stem, '庚', '切译法后天干一字不变');
    has($('cxPopSub').textContent, '九星', '切完课页副行应标九星');
    hasNot($('cxPopGrid').textContent, '禽芮', '九星表里不该出现「禽芮」合写');
    closePop();
    /* —— 10/5/5/9 ＋ 壬 —— */
    castNums(['10', '5', '5', '9'], '10/5/5/9 九星');
    eq(cellNm().join('/'), '天蓬/天禽/天英/壬/兄弟/官鬼/妻财', '10/5/5/9 九星对表');
    setMode('six');
    eq(cellNm().join('/'), '赤口/留连/空亡/壬/父母/官鬼/官鬼', '10/5/5/9 六神对表');
    eq(win.App.state.cxLesson.nums.join(','), '10,5,5,9', '来回切译法，四数仍不变');
    eq(win.App.state.cxLesson.stem, '壬', '来回切译法，天干仍不变');
    /* 六亲必须跟着变（拿旧六亲锁死是错的） */
    ok(cellNm().slice(4).join('/') !== '兄弟/官鬼/妻财', '六亲必须随译法重算，不能沿用九星那份');
    closePop();
    /* —— 六神 / 九星的域与占位提示 —— */
    setMode('six');
    eq([IN[0], IN[1], IN[2]].map((id) => $(id).placeholder).join('/'), '1–6/1–6/1–6', '六神态三宫占位应为 1–6');
    eq($(IN[3]).placeholder, '1–10', '末位占位恒为 1–10');
    setMode('star');
    eq([IN[0], IN[1], IN[2]].map((id) => $(id).placeholder).join('/'), '1–9/1–9/1–9', '九星态三宫占位应为 1–9');
  });

  /* ==================================================== ⑩ 九星星序 1–9 */
  await group('⑩ 九星星序（1 天蓬 … 9 天英，天禽独立第 5）', async () => {
    setMode('star');
    closePop();
    const got = [];
    for (let i = 1; i <= 9; i++) {
      closePop();
      castNums([String(i), '1', '1', '1'], '星序 ' + i);
      got.push(cellNm()[0]);
    }
    eq(got.join('/'), STARN.join('/'), '天宫应严格按星序 1–9');
    eq(got[4], '天禽', '第 5 格应是独立的天禽（不是「禽芮」）');
    hasNot(got.join('/'), '禽芮', '九星表里不该出现「禽芮」');
    hasNot(doc.querySelector('#cxPopGrid').innerHTML, '禽芮', '课页 HTML 里不该有「禽芮」');
    closePop();
  });

  /* ==================================================== ⑪ 0 归一与越界值 */
  await group('⑪ 0 归一（0000 ≡ 域末）与 2 位越界值放行', async () => {
    setMode('six');
    closePop();
    /* 六神域：0000 ＝ 空亡·小吉·赤口·癸；与 (6,6,6,10) 完全等价 */
    castNums(['0', '0', '0', '0'], '六神 0000');
    eq(cellNm().join('/'), '空亡/小吉/赤口/癸/官鬼/兄弟/父母', '六神域 0000 应是「三宫各退一位」');
    has($('cxPopSub').textContent, '零课', '全 0 时副行应有「零课」提示');
    closePop();
    castNums(['6', '6', '6', '10'], '六神 6660');
    eq(cellNm().join('/'), '空亡/小吉/赤口/癸/官鬼/兄弟/父母', '六神域 (6,6,6,10) 应与 0000 完全等价');
    hasNot($('cxPopSub').textContent, '零课', '不是全 0 就不该标「零课」');
    closePop();
    /* 九星域：0000 ＝ 天英·天任·天柱·癸；与 (9,9,9,10) 等价 */
    setMode('star');
    castNums(['0', '0', '0', '0'], '九星 0000');
    eq(cellNm().join('/'), '天英/天任/天柱/癸/妻财/官鬼/父母', '九星域 0000（0 按 9 论 ＝ 天英）');
    has($('cxPopSub').textContent, '零课', '九星域全 0 也应标「零课」');
    closePop();
    castNums(['9', '9', '9', '10'], '九星 9990');
    eq(cellNm().join('/'), '天英/天任/天柱/癸/妻财/官鬼/父母', '九星域 (9,9,9,10) 应与 0000 等价');
    closePop();
    setMode('six');
    /* 单个 0 与 2 位越界值：放行，按自然循环 */
    castNums(['0', '5', '0', '0'], '六神 0500');
    expectLesson('六神 0500（放行）', ['0', '5', '0', '0'], 'six');
    closePop();
    for (const pair of [['66', '空亡/赤口/小吉'], ['99', '速喜/大安/留连']]) {
      castNums([pair[0], '5', '2', '7'], '首位 ' + pair[0]);
      eq(cellNm().slice(0, 3).join('/'), pair[1], '首位 ' + pair[0] + ' 应按 k6 自然循环');
      closePop();
    }
    for (const pair of [['11', '甲'], ['20', '癸'], ['0', '癸'], ['10', '癸']]) {
      castNums(['1', '1', '1', pair[0]], '末位 ' + pair[0]);
      eq(cellNm()[3], pair[1], '末位 ' + pair[0] + ' 应归一成 ' + pair[1]);
      closePop();
    }
  });

  /* ==================================================== ⑫ 非法输入 */
  await group('⑫ 非法输入（不落半成品课 · 整串当一格被拒）', async () => {
    setMode('six');
    closePop();
    const errText = () => ($('cxNumErr') ? $('cxNumErr').textContent : '') + ' ' + $('toast').textContent;
    const BAD = [
      { vals: ['', '5', '2', '7'], why: '空一格', re: /没填/ },
      { vals: ['a', '5', '2', '7'], why: '非数字', re: /1–2 位数字/ },
      { vals: ['1.5', '5', '2', '7'], why: '小数', re: /1–2 位数字/ },
      { vals: ['-1', '5', '2', '7'], why: '负数', re: /1–2 位数字/ },
      { vals: ['１', '5', '2', '7'], why: '全角数字（不静默转半角）', re: /1–2 位数字/ },
      { vals: ['123', '5', '2', '7'], why: '三位数', re: /1–2 位数字/ },
      { vals: ['1527', '5', '2', '7'], why: '整串当一格（四位）', re: /1–2 位数字/ }
    ];
    for (const b of BAD) {
      closePop();
      fill(b.vals);
      $('btnCastX').click();
      ok(!popOn(), b.why + '：不该落课（课页弹层不该打开）');
      ok(b.re.test(errText()), b.why + '：应给出可读提示，实得「' + errText().trim() + '」');
      eq($(IN[0]).value, b.vals[0], b.why + '：不该改写用户填的字');
    }
    /* 非空格子要就地标红（.cxi.bad），提示行也要说清是哪一格 */
    closePop();
    fill(['1527', '5', '2', '7']);
    ok($(IN[0]).parentNode.classList.contains('bad'), '非法格应挂 .cxi.bad（就地标红）');
    has($('cxNumErr').textContent, '天宫', '底部提示行应点名是哪一格');
    /* 引擎层：整串当一格传必须被拒（'1527'.length 也是 4，曾会被当四个数静默出课） */
    const er = win.CX.castByNumbers('1527', 'six');
    ok(!er.ok && er.errCode === 'arity',
      '引擎：整串当一格传必须被拒（errCode=' + er.errCode + '，ok=' + er.ok + '）');
    const er2 = win.CX.castByNumbers(['1', '5', '2', '7'], 'six');
    ok(er2.ok, '引擎：四个字符串逐格传应放行');
    /* 失败之后不许留下「半成品课」：重新填好仍能正常出课 */
    closePop();
    fill(['1', '5', '2', '7']);
    $('btnCastX').click();
    ok(popOn(), '改回合法四数后应能正常起课');
    eq(cellNm().length, 7, '合法课的七格仍在');
    ok(cellNm().every((x) => !!x && x !== '—'), '七格都不该是空位或「—」');
    closePop();
  });

  /* ==================================================== ⑬ 随机档 */
  await group('⑬ 随机档（起课抽四数 · 重排再抽 · 域随译法）', async () => {
    setMode('six');
    closePop();
    setTab('rand');
    ok(panelOn('cxPanelRand'), '切到随机档：#cxPanelRand 应显示');
    /* 2026-11-13 末轮：随机档内**一个按钮都没有**（「此刻 / 随机四数」早删，重复的 ⓘ 也收进全页唯一那枚） */
    eq($('cxPanelRand').querySelectorAll('button').length, 0, '随机档里不该有任何按钮（ⓘ 已收进勾选行）');
    ok(!$('cxRandHelp'), '随机档不该再有 ⓘ（说明并入全页唯一那枚）');
    const timeBefore = $('cxTime').textContent;

    /* 六神域：前三数 1–6，末位 1–10 —— 直接点「起课」抽，抽 300 次 */
    const sixDraws = [];
    for (let i = 0; i < 300; i++) {
      closePop();
      $('btnCastX').click();
      if (!popOn()) throw new Error('随机档第 ' + (i + 1) + ' 次「起课」没出课');
      sixDraws.push(win.App.state.cxRandNums.slice());
    }
    const flat3 = (ds) => ds.map((d) => [d[0], d[1], d[2]]).reduce((a, b) => a.concat(b), []);
    const flat4 = (ds) => ds.map((d) => d[3]);
    eq(flat3(sixDraws).filter((n) => n < 1 || n > 6).length, 0, '六神随机：三宫必须都在 1–6');
    ok(Math.max(...flat3(sixDraws)) === 6, '六神随机：300 次应抽到过 6');
    ok(Math.min(...flat3(sixDraws)) === 1, '六神随机：300 次应抽到过 1');
    eq(flat4(sixDraws).filter((n) => n < 1 || n > 10).length, 0, '随机末位必须都在 1–10');
    ok(Math.max(...flat4(sixDraws)) === 10, '随机末位 300 次应抽到过 10（不能写成 floor*9+1）');
    eq(flat3(sixDraws).filter((n) => n === 0).length, 0, '随机三宫不该抽到 0（0 等同域末）');
    /* 页面回显 = 课里记的四数 */
    eq([...$('cxRandNums').children].map((x) => x.querySelector('b').textContent).join(''),
      win.App.state.cxRandNums.join(''), '随机档应把抽到的四数回显在页上');
    has($('cxPopSub').textContent, '随机', '随机档课页副行应标「随机」');
    eq($('cxTime').textContent, timeBefore, '随机抽四数不该改时刻卡（不抽时刻）');

    /* 重排：再抽一组（同一档连抽两次，四数应至少变一次） */
    const before = win.App.state.cxRandNums.join(',');
    let changed = false;
    for (let i = 0; i < 12 && !changed; i++) {
      $('cxPopAgain').click();
      ok(popOn(), '随机档「重排」应保持课页打开');
      if (win.App.state.cxRandNums.join(',') !== before) changed = true;
    }
    ok(changed, '随机档「重排」应再抽一组四数（12 次都没变说明没重抽）');
    closePop();

    /* 九星域：前三数 1–9（否则天心 / 天柱 / 天任 / 天英永远抽不到） */
    setMode('star');
    const starDraws = [];
    for (let i = 0; i < 300; i++) {
      closePop();
      $('btnCastX').click();
      if (!popOn()) throw new Error('九星随机第 ' + (i + 1) + ' 次「起课」没出课');
      starDraws.push(win.App.state.cxRandNums.slice());
    }
    eq(flat3(starDraws).filter((n) => n < 1 || n > 9).length, 0, '九星随机：三宫必须都在 1–9');
    ok(Math.max(...flat3(starDraws)) >= 7, '九星随机：300 次必须出现过 ≥7');
    ok(Math.max(...flat3(starDraws)) === 9, '九星随机：300 次应抽到过 9');
    eq(flat4(starDraws).filter((n) => n < 1 || n > 10).length, 0, '九星随机末位必须都在 1–10');
    /* 抽出来的每一课都自洽（页面课页 = 参考实现） */
    const lastNums = win.App.state.cxRandNums.slice();
    expectLesson('九星随机末课', lastNums.map(String), 'star');
    closePop();
    setMode('six');
    console.log('    随机域：六神 300 次 max=' + Math.max(...flat3(sixDraws))
      + '，九星 300 次 max=' + Math.max(...flat3(starDraws)) + '（末位均 1–10 且抽到过 10）');
  });

  /* ==================================================== ⑭ 五条结构之②：口径勾选控件 */
  await group('⑭ 口径勾选（checkbox · 只在起课页一处）', async () => {
    setTab('nums');
    const cb = $('cxStar');
    ok(!!cb, '应有勾选控件 #cxStar');
    eq(cb.tagName, 'INPUT', '勾选控件的标签名应是 INPUT');
    eq(cb.getAttribute('type'), 'checkbox', '应是真 checkbox');
    /* 契约是「起课页 1 枚、四处 0」；这里再看一眼其余两页也不许有（= 全页只有这一枚） */
    eq([['#view-home'], ['#view-chart']].map((x) => doc.querySelectorAll(x[0] + ' input[type=checkbox]').length).join('/'),
      '0/0', '起盘页 / 盘面页也不该有 checkbox');
    ok($('view-chuanxing').contains(cb), '勾选控件应在起课页内');
    ok($('cxMode') && $('cxMode').contains(cb), '勾选控件应包在 label#cxMode 里（label 才是触控区）');
    eq($('cxMode').getAttribute('for') || '', 'cxStar', 'label 的 for 应指向 cxStar');
    /* 勾选状态与 aria 同步 */
    setMode('star');
    eq(cb.checked, true, '九星态：checked=true');
    eq(cb.getAttribute('aria-checked'), 'true', '九星态：aria-checked=true');
    ok($('cxMode').classList.contains('star'), '九星态：label 应挂 .star（六神/九星哪边亮色靠它）');
    setMode('six');
    eq(cb.checked, false, '六神态：checked=false');
    eq(cb.getAttribute('aria-checked'), 'false', '六神态：aria-checked=false');
    ok(!$('cxMode').classList.contains('star'), '六神态：label 不该挂 .star');
    /* 点 label 上那两个字也要能切（整枚 label 是触控区） */
    const before = cb.checked;
    $('cxMode').querySelector('.t9').click();
    eq(cb.checked, !before, '点 label 里的「九星」两字应能切换');
    $('cxMode').querySelector('.t9').click();   /* 只剩「九星」两字（六神两字已去），点它也要能切 */
    /* 唯一性：四处都不许有第二枚 */
    const cnt = (root) => (root ? root.querySelectorAll('input[type=checkbox], .cxseal, [role="checkbox"], #cxSeal, [data-mode="six"], [data-mode="star"]').length : 0);
    eq(cnt($('view-chuanxing')), 1, '起课页内应恰好 1 个切换控件');
    eq(cnt($('cxPop')), 0, '课页弹层内切换控件必须为 0（hidden / display:none 也算失败）');
    eq(cnt($('xkMini')), 0, '盘面同显里切换控件必须为 0');
    eq(cnt($('view-set')), 0, '设置页里切换控件必须为 0');
    /* 方章那套类名/id 必须已删干净（不是藏起来） */
    eq(doc.querySelectorAll('.cxseal').length, 0, 'DOM 里不该再有 .cxseal');
    ok(!$('cxSeal') && !$('cxSealFace') && !$('cxSealCap') && !$('cxPopSeal'),
      '旧的 #cxSeal / #cxSealFace / #cxSealCap / #cxPopSeal 节点都不该存在');
    const htmlNoC = stripHtmlComments(readFile('web/index.html'));
    hasNot(htmlNoC.toLowerCase(), 'cxseal', 'index.html（去注释）里不该再有 cxseal');
    const cssNoC = stripComments(readFile('web/css/app.css'));
    hasNot(cssNoC.toLowerCase(), '.cxseal', 'app.css（去注释）里不该再有 .cxseal 选择器');
    const uiNoC = stripComments(readFile('web/js/ui.js'));
    hasNot(uiNoC, 'cxSeal', 'ui.js（去注释）里不该再有 cxSeal');
    hasNot(uiNoC, 'CX_SEALS', 'ui.js（去注释）里不该再有 CX_SEALS 那套方章列表');
    const snapNoC = stripComments(readFile('web/js/snapshot.js'));
    hasNot(snapNoC, 'cxSeal', '导出图（snapshot.js）里不该画切换控件');
    hasNot(snapNoC, 'cxseal', '导出图（snapshot.js）里不该画切换控件');
    /* 课页弹层的按钮只该是 读法 i / 返回 / 截图 / 重排 */
    eq([...$('cxPop').querySelectorAll('button')].map((b) => b.id).join('/'),
      'cxPopHelp/cxPopBack/cxPopShot/cxPopAgain', '课页弹层里只该有这四颗按钮');
    /* 离开再进页：仍记得上次 */
    setMode('star');
    doc.querySelector('#tabbar button[data-view="home"]').click();
    doc.querySelector('#tabbar button[data-view="chuanxing"]').click();
    eq($('cxStar').checked, true, '离开串星页再回来应记得上次是九星');
    eq([IN[0], IN[1], IN[2]].map((id) => $(id).placeholder).join('/'), '1–9/1–9/1–9', '回页后占位也应是九星的 1–9');
    /* 动画那条路：不许把界面卡在旧态（170ms 后自己收尾） */
    A.setReduce(false);
    $('cxStar').click();
    eq(win.Store.settings.cxMode, 'six', '关掉「减少动态效果」时：点下去先落偏好');
    await sleep(300);
    eq($('cxStar').checked, false, '动画跑完 300ms 后：勾选状态应已落到六神');
    eq(win.Store.settings.cxMode, 'six', '动画跑完：偏好也已落到六神（刷新后记得住）');
    if (popOn() && $('cxPopSub').textContent !== '—') has($('cxPopSub').textContent, '六神', '课页开着时副行应换成六神');
    A.setReduce(true);
  });

  /* ==================================================== ⑮ 空亡：只灰，不加线 */
  await group('⑮ 空亡样式（次级灰 · 无下划线/虚线）', async () => {
    setMode('six');
    closePop();
    setTab('nums');
    castNums(['1', '5', '2', '7'], '空亡样式 1527');
    const cs = cells();
    eq(cs.length, 7, '课页七格');
    eq(cs.map((c) => (c.classList.contains('void') ? 'V' : '-')).join(''), '--V----',
      '1527 只有人宫（第 3 格）该挂 .void');
    const vcell = cs[2];
    eq(((vcell.querySelector('.nm') || {}).textContent), '空亡', '第 3 格应是空亡');
    eq(vcell.querySelector('.nm').style.color, '', '空亡不该被写成行内五行色（颜色交给 CSS 的 .void）');
    hasNot(vcell.getAttribute('style') || '', 'color', '空亡格的行内样式里不该有 color');
    hasNot(vcell.getAttribute('style') || '', 'border', '空亡格不该有行内下划线/边框');
    closePop();
    /* CSS：.void 的规则必须是「颜色 = 次级灰 --ink-3」，且不许出现任何线 */
    const css = stripComments(readFile('web/css/app.css'));
    const voidRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map((m) => ({ sel: m[1].trim(), body: m[2] }))
      .filter((r) => /\.void\b/.test(r.sel));
    ok(voidRules.length >= 1, 'CSS 里应有 .void 规则');
    const colored = voidRules.filter((r) => /color:\s*var\(--ink-3\)/.test(r.body));
    ok(colored.length >= 1, '空亡的颜色必须是次级灰 var(--ink-3)');
    const lined = voidRules.filter((r) => /border-bottom|border-block-end|text-decoration|text-underline|dashed|dotted|underline/.test(r.body));
    eq(lined.length, 0, '空亡的 .void 规则里不许有任何线（下划线/虚线）：'
      + lined.map((r) => r.sel).join(' | '));
    /* 2026-11-13 改判：起课页三档**都不写结果**（用户「数字下面 不要写结果」），
       .cxnums / .cxgrid4 里已经没有 .nm 了 —— 原来那条 `.cxnums .nm.void` 成了无生产者的死代码，已删。
       所以这里不再找那条规则，改成验"死代码确实没了 + 页面里确实没有 .nm"，
       以及"空亡的灰只剩课页那一条"（上面 colored / lined 已经钉死）。 */
    hasNot(css, '.cxnums .nm.void', '起课页那条已无生产者的 .cxnums .nm.void 死规则应已删除');
    hasNot(css, '.cxgrid4 .nm.void', '数字档同理：.cxgrid4 .nm.void 死规则应已删除');
    setTab('time');
    eq(doc.querySelectorAll('#cxTimeNums .nm').length, 0, '时间档里不该有 .nm（只给数，不给结果）');
    setTab('nums');
    eq(doc.querySelectorAll('#cxPanelNums .nm').length, 0, '数字档里不该有 .nm（格下不写结果）');
    eq(doc.querySelectorAll('#cxPanelRand .nm').length, 0, '随机档里不该有 .nm');
    /* 导出图（snapshot）同样不画线：renderLesson 里不许有 setLineDash */
    const snap = stripComments(readFile('web/js/snapshot.js'));
    const ri = snap.indexOf('function renderLesson');
    const rb = snap.indexOf('function renderBoth');
    ok(ri > 0 && rb > ri, 'snapshot.js 里应能找到 renderLesson 与 renderBoth');
    const lessonSrc = snap.slice(ri, rb > ri ? rb : undefined);
    hasNot(lessonSrc, 'setLineDash', '导出图的课块（renderLesson）里不许给空亡画虚线');
    hasNot(lessonSrc, 'underline', '导出图的课块里不许有下划线');
    /* 导出图也不许再画「三宫 = 天宫 · 地宫 · 人宫」那行解释小字 */
    hasNot(lessonSrc, '天宫', '导出图课块里不该再有「天宫…」解释行');
    hasNot(lessonSrc, '地宫', '导出图课块里不该再有「地宫…」解释行');
  });

  /* ==================================================== ⑰ 导出图三路参数 */
  await group('⑰ 截图三路（课页 / 盘面 / 盘面同显）', async () => {
    S.rendImage = 'data:pan';
    S.rendImageLesson = 'data:lesson';
    let shot = null;
    win.Snapshot.shot = function (chart, analysis, starMap, msg, face, opts) { shot = opts; };
    setMode('six');
    setTab('nums');
    closePop();
    fill(['1', '5', '2', '7']);
    $('btnCastX').click();
    shot = null;
    $('cxPopShot').click();
    ok(shot && !!shot.lesson, '课页截图应带 lesson 数据（否则画出来还是奇门盘）');
    ok(shot && shot.lesson.three && shot.lesson.three.length === 3, 'lesson.three 应是三宫');
    eq(shot && shot.rendImage, 'data:lesson', '课页截图应取「串星课」那张底图');
    eq(shot && shot.lesson.nums.join(''), '1527', '课页截图带的四数应是 1527');
    eq(shot && shot.lesson.three.map((x) => x.name).join('/'), '大安/小吉/空亡', '课页截图带的三宫名');
    eq(shot && shot.lesson.three.map((x) => x.qin).join('/'), '妻财/子孙/父母', '课页截图带的六亲');
    ok(shot && shot.lesson.three[2].void === true, '课页截图应把空亡标出来（void=true）');
    closePop();
    /* 盘面页：没开同显时是一张纯盘 */
    doc.querySelector('#tabbar button[data-view="home"]').click();
    $('btnCast').click();
    shot = null;
    $('btnShot').click();
    eq(shot && shot.rendImage, 'data:pan', '盘面页截图应取「奇门盘」那张底图');
    ok(shot && !shot.lesson, '盘面页截图不该带 lesson 数据');
    /* 阴盘：不出课，仍是一张纯盘 */
    $('segJu').querySelector('button[data-v="yin"]').click();
    $('btnCast').click();
    shot = null;
    $('btnShot').click();
    ok(shot && !shot.lesson && shot.both !== true, '阴盘截图不该带 lesson（同显只认时家）');
    $('segJu').querySelector('button[data-v="chaibu"]').click();
    $('btnCast').click();
    $('btnBack').click();
  });

  /* ==================================================== ⑱ 弹层开合 / 重排 / 返回键 */
  await group('⑱ 课页弹层开合 · 重排 · 返回键', async () => {
    doc.querySelector('#tabbar button[data-view="chuanxing"]').click();
    setMode('six');
    setTab('nums');
    closePop();
    fill(['1', '5', '2', '7']);
    ok(!popOn(), '点起课前课页弹层不应打开');
    $('btnCastX').click();
    ok(popOn(), '起课后应弹出课页');
    ok($('view-chuanxing').classList.contains('on'), '起课后应留在串星页（不跳全屏课页）');
    ok(!$('view-chart').classList.contains('on'), '起课后不应跳到盘面页');
    eq(doc.querySelectorAll('#cxPopGrid .lb').length, 0, '课块里不该再有 .lb 标签');
    /* 数字档「重排」＝同一组数重起（要换数请改格） */
    const beforeNums = win.App.state.cxLesson.nums.join(',');
    $('cxPopAgain').click();
    ok(popOn(), '「重排」应保持课页打开');
    eq(win.App.state.cxLesson.nums.join(','), beforeNums, '数字档「重排」应仍用这四数');
    eq(cellNm().join('/'), '大安/小吉/空亡/庚/妻财/子孙/父母', '数字档「重排」的课应与原来一致');
    /* 点遮罩关 */
    $('cxPopMask').click();
    ok(!popOn(), '点遮罩应关掉课页');
    /* 手机返回键：先关弹层，再回起盘页 */
    $('btnCastX').click();
    ok(popOn(), '再起一课后弹层应打开');
    eq(win.xyqimenBack(), true, '弹层开着时返回键先关弹层（true = 别退出 App）');
    ok(!popOn(), '第一次返回应关掉课页弹层');
    eq(win.xyqimenBack(), true, '返回键应被吃掉（true = 别退出 App）');
    ok($('view-home').classList.contains('on'), '起课页的返回键应直接回起盘页');
    /* 时间档起课也通（默认档） */
    doc.querySelector('#tabbar button[data-view="chuanxing"]').click();
    setTab('time');
    closePop();
    $('btnCastX').click();
    ok(popOn(), '时间档点「起课」应出课');
    const c = win.App.state.cxTimeChart;
    const nums = [c.calendar.lunar.month, c.calendar.lunar.day, c.calendar.index.hourZhi + 1, c.calendar.index.hourGan + 1];
    expectLesson('时间档课', nums.map(String), 'six');
    has($('cxPopSub').textContent, '时间', '时间档课页副行应标「时间」');
    closePop();
  });

  /* ==================================================== ⑲ 读法（原文七节 + 九星提示） */
  await group('⑲ 读法弹层（七节 · 无「小六壬」· 九星态加一行口径提示）', async () => {
    setMode('six');
    setTab('nums');
    closePop();
    fill(['1', '5', '2', '7']);
    $('btnCastX').click();
    ok(popOn(), '先起一课，读法入口在课页抬头');
    $('cxPopHelp').click();
    ok($('sheet').classList.contains('on'), '点课页的 i 应弹出读法弹层');
    const t6 = $('sheet').textContent;
    has(t6, '串星课', '读法正文应是「串星课」口径');
    hasNot(t6, '小六壬', '读法正文里不该再有「小六壬」');
    hasNot(t6, '掌诀', '读法已去掉「掌诀」一节');
    eq(doc.querySelectorAll('#sheet .cxhnote').length, 0, '六神态不该插「九星口径」提示行');
    ok(win.CxHelp && win.CxHelp.sections && win.CxHelp.sections.length === 7,
      'window.CxHelp.sections 应是七节，实得 ' + (win.CxHelp && win.CxHelp.sections && win.CxHelp.sections.length));
    $('btnXkHelpOk').click();
    ok(!$('sheet').classList.contains('on'), '点「知道了」应关掉读法');
    /* 九星态：正文前多一行口径提示，正文一字不改 */
    setMode('star');
    $('cxPopHelp').click();
    ok($('sheet').classList.contains('on'), '九星态读法也能打开');
    eq(doc.querySelectorAll('#sheet .cxhnote').length, 1, '九星态应插恰好一行 .cxhnote');
    has($('sheet').querySelector('.cxhnote').textContent, '九星口径', '提示行应说明这是九星口径');
    has($('sheet').querySelector('.cxhnote').textContent, '天禽', '提示行应写出星序（含天禽）');
    has($('sheet').textContent, '串星课', '九星态正文仍是「串星课」');
    hasNot($('sheet').textContent, '小六壬', '九星态也不许出现「小六壬」');
    $('btnXkHelpOk').click();
    setMode('six');
    closePop();
  });

  /* ==================================================== ⑳ 设置项（原有） */
  await group('⑳ 设置项（示意框 / 选图 / 裁剪 / 真太阳时标注）', async () => {
    const sh = doc.querySelectorAll('.shapehint .sh');
    eq(sh.length, 2, '设置里应有两种示意框（九宫盘 / 串星课）');
    ok(!!doc.querySelector('.shapehint .sh.pan'), '缺九宫盘（竖 1000×1370）的示意框');
    ok(!!doc.querySelector('.shapehint .sh.lesson'), '缺串星课（横 1000×460）的示意框');
    const css = readFile('web/css/app.css');
    ok(/\.sh\.pan em\s*\{[^}]*width: 18px/.test(css) && /\.sh\.lesson em\s*\{[^}]*width: 36px/.test(css),
      '两枚示意框的宽高要按各自真实比例（盘 0.73 / 课 2.17）');
    ok(!/\.sh\.both/.test(css), '盘面同显已并入九宫盘，不该再有 .sh.both 示意框');
    /* 选图：先选「给谁用」 */
    S.rendImage = 'data:pan';
    S.rendImageLesson = 'data:lesson';
    $('btnRendPick').click();
    ok(!!$('rendForPan') && !!$('rendForLesson'), '点「选图」应先弹「九宫盘 / 串星课」让选');
    eq(doc.querySelectorAll('.rendpick .rp').length, 2, '选图弹层里应有两个选项');
    ok(doc.querySelector('.rendpick .rp.pan em') && doc.querySelector('.rendpick .rp.lesson em'),
      '每个选项都要有对应形状的示意框');
    let fileClicked = false;
    $('rendFile').click = function () { fileClicked = true; };
    $('rendForLesson').click();
    ok(fileClicked, '选了「串星课」之后应去唤起选图');
    ok(!$('sheet').classList.contains('on'), '选完应关掉弹层');
    /* 裁剪页 */
    ok(!!$('cropShape'), '裁剪页应有形状说明行 #cropShape');
    ok(/\.crop-stage\s*\{[^}]*rgba\(216,180,95/.test(css), '裁剪框应是描金示意框');
    ok(/\.crop-stage\s*\{[\s\S]*?flex:\s*0\s+0\s+auto/.test(css), '⚠ .crop-stage 必须 flex: 0 0 auto');
    /* 真太阳时：开了要在串星页时刻卡副行标出「真太阳时 + 标准时」 */
    setTab('time');
    S.trueSolar = true; win.Store.saveSettings();
    $('cxPick').dispatchEvent(new win.Event('change', { bubbles: true }));
    has($('cxSub').textContent, '真太阳时', '开了真太阳时，串星页副行应标出');
    has($('cxSub').textContent, '标准时', '真太阳时时应同时写出选择器里的标准时');
    S.trueSolar = false; win.Store.saveSettings();
    $('cxPick').dispatchEvent(new win.Event('change', { bubbles: true }));
    hasNot($('cxSub').textContent, '真太阳时', '关掉真太阳时后不该再标');
    /* 起盘页 / 串星页：卡片不许再有投影（来源级） */
    const inlineCss = (readFile('web/index.html').match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
    const tcRule = (inlineCss.match(/\.home \.timecard\s*\{[^}]*\}/) || [''])[0];
    hasNot(tcRule, 'box-shadow', '起盘页 / 串星页的 .home .timecard 不许再有投影');
    const tcRules = stripComments(css).match(/[^{}]*\.timecard[^{}]*\{[^}]*\}/g) || [];
    eq(tcRules.filter((r) => /box-shadow/.test(r)).length, 0, 'app.css 里也不许给 .timecard 挂投影');
  });

  /* ==================================================== ㉑ ⑤ 高度对齐的 CSS 契约 */
  await group('㉑ 与起盘页对齐（同 class · 无单独改高）', async () => {
    /* ⚠ 像素差 ≤2px 在 校验/_probe_runtime.js 里量（jsdom 没有排版引擎）。
       这里钉的是「凭什么对齐」：两页这三处用的是同一条 CSS 契约。 */
    eq($('cxTimecard').className, $('timecard').className, '串星页时间卡与起盘页应是同一组 class');
    eq($('btnCastX').className, $('btnCast').className, '串星页起课钮与起盘页起盘钮应是同一组 class');
    ok(/\bseg\b/.test($('segCxSrc').className) && /\bmodes\b/.test($('segCxSrc').className)
      && /\bmodes\b/.test($('segMode3').className), '两页的分段行都应是 .seg.modes');
    eq($('cxTimecard').tagName, $('timecard').tagName, '时间卡标签名也应一致');
    /* app.css 里针对 #view-chuanxing 的规则只许改外边距，不许改高度/字号/内边距 */
    const css = stripComments(readFile('web/css/app.css'));
    const scoped = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map((m) => ({ sel: m[1].trim(), body: m[2] }))
      .filter((r) => /#view-chuanxing/.test(r.sel));
    /* 2026-11-13 末轮：九星勾选成了横栏里的**第四格**（用户要求"比前三格小一点"），
       所以 `.seg .cxmode*` 允许有自己的字号/内边距 —— 它不是分段行本身。其余照旧禁止。 */
    const TALLOW = /\.cxmode\b/;
    const bad = scoped.filter((r) => /(^|;)\s*(height|min-height|max-height|font-size|line-height|padding)\s*:/.test(r.body)
      && /timecard|\.seg\b|\.btn\.cast|\.cast\b/.test(r.sel)
      && !TALLOW.test(r.sel));
    /* 反向收紧：禁止借"允许 .cxmode"之名去改分段行本身或三档按钮 */
    const bad2 = scoped.filter((r) => /(^|;)\s*(height|min-height|max-height|font-size|line-height|padding)\s*:/.test(r.body)
      && /#view-chuanxing\s+\.seg(\s|$|\.modes|\s+button)/.test(r.sel) && !TALLOW.test(r.sel));
    eq(bad2.length, 0, '分段行本身与三档按钮仍不许单独改高/字号：' + bad2.map((r) => r.sel).join(' | '));
    eq(bad.length, 0, '不许针对 #view-chuanxing 单独改时间卡/分段行/起课钮的高或字号：'
      + bad.map((r) => r.sel).join(' | '));
    console.log('    （≤2px 的实测量在 校验/_probe_runtime.js：真 Chromium 下量这三处）');
  });

  /* ==================================================== ㉒ 样式回归（原有的阴盘/中宫/配色） */
  await group('㉒ 中宫 · 阴盘 · 虚实法（原有回归）', async () => {
    const panCss = readFile('web/css/pan.css');
    ok(/--qm-halo:\s*none/.test(panCss), '素白下盘心光晕应为 none');
    ok(/\.qm-cell\.qm-mid \{\s*background-image:\s*none/.test(panCss), '中宫不应再有晕染 background-image');
    ok(!/\.qm-cell\.qm-mid::before\s*\{[^}]*border-radius: 50%/.test(panCss), '中宫内圈应已去掉（只留一个圆环）');
    const uiSrc = readFile('web/js/ui.js');
    ok(/white: '255,255,255'/.test(uiSrc), '中宫底色应是纯白 255,255,255');
    ok(!!doc.getElementById('qmBox'), '保留盘盒 #qmBox');
    ok(!doc.getElementById('qmRing'), '盘外那圈 #qmRing 已删除');
    ok(!/function (renderRing|paintRing)\s*\(|var RING_W\s*=|classList\.(contains|add|remove)\('has-ring'\)/.test(uiSrc),
      '外圈那套死代码已清干净');
    /* 阴盘：八宫暗干、无星曜行、空亡画圆、无盘外暗干 */
    doc.querySelector('#tabbar button[data-view="home"]').click();
    $('dtPick').value = '2026-01-01T04:00';
    $('dtPick').dispatchEvent(new win.Event('change', { bubbles: true }));
    $('segJu').querySelector('button[data-v="yin"]').click();
    $('btnCast').click();
    eq($('tbTitle').textContent.replace(/\s+/g, ''), '阴盘', '阴盘模式抬头应为「阴盘」');
    eq(doc.querySelectorAll('.qm-rg, .qm-ring').length, 0, '阴盘不画盘外暗干');
    eq(doc.querySelectorAll('#qm_text_pan .qm-yin-agan').length, 8, '八宫均保留暗干');
    eq(doc.querySelectorAll('#qm_text_pan .qm-stars').length, 0, '阴盘不排星曜');
    eq(doc.querySelectorAll('#qm_text_pan .qm-mark-horse').length, 1, '马星画成奔马剪影');
    ok(!!win.QM_MARKS && /^data:image\/png;base64,/.test(win.QM_MARKS.horse), '马星掩膜用 data URI');
    const xpTxt = [...doc.querySelectorAll('#qdrop .r')].map((r) => r.textContent).join(' | ');
    has(xpTxt, '农历', '阴盘详情应有「农历」行');
    has(xpTxt, '节气', '阴盘详情应有「节气」行');
    has(xpTxt, '数字定局', '阴盘定局行应写「数字定局」');
    hasNot(xpTxt, '手动指定', '阴盘不该被写成「手动指定」');
    /* 配色 P2 —— 2026-11-13 末轮用户：「阴盘的神星门干的颜色 作为标准的配色」，
       这组已从「只挂阴盘」提升为**全站标准**（选择器去掉 [data-sub="yin"]）。
       断言随之改为：① 配色块作用在**所有盘**上（不再有 data-sub 限定）；
                   ② 五色与星门九色仍是 P2 那组值；③ 暗干不参与上色。 */
    const pal = (panCss.match(/html\[data-theme\] \.qm-text-pan\s*\{[\s\S]*?\}/) || [''])[0];
    ok(!!pal, '标准配色块存在（作用于所有盘）');
    ok(!/html\[data-theme\] \.qm-text-pan\[data-sub="yin"\]/.test(panCss),
      '配色不该再只挂阴盘（用户要求提升为标准配色）');
    ok(/--qm-el-wood:\s*#0a9a63/.test(pal) && /--qm-el-fire:\s*#dc2a18/.test(pal)
       && /--qm-el-earth:\s*#b9821a/.test(pal) && /--qm-el-metal:\s*#4f6a86/.test(pal)
       && /--qm-el-water:\s*#0f5cbf/.test(pal),
      'P2 五行色：木 #0a9a63 / 火 #dc2a18 / 土 #b9821a / 金 #4f6a86 / 水 #0f5cbf');
    ok(/--qm-tian-1:\s*#0f5cbf/.test(pal) && /--qm-tian-9:\s*#dc2a18/.test(pal)
       && /--qm-men-1:\s*#0f5cbf/.test(pal) && /--qm-men-9:\s*#dc2a18/.test(pal),
      '星门九色也随标准配色统一（天蓬/休门 水、天英/景门 火）');
    ok(!/--qm-ink-soft/.test(pal), '暗干不参与上色');
    /* 虚实法插件 */
    ok(!!(win.Plugins && win.Plugins.byId('xushi')), '虚实法插件已注册');
    ok(/\.qm-cell\.qm-xs-shi\s*\{[^}]*66%/.test(panCss) && /\.qm-cell\.qm-xs-xu\s*\{[^}]*15%/.test(panCss),
      '虚实法两档边框色（实 66% / 虚 15%）');
    S.plugins = S.plugins || {};
    S.plugins.xushi = 0; win.Store.saveSettings();
    $('segJu').querySelector('button[data-v="chaibu"]').click();
    $('btnCast').click();
    eq(doc.querySelectorAll('#qm_text_pan .qm-xs-shi, #qm_text_pan .qm-xs-xu').length, 0, '插件关着时宫卡不挂虚实类');
    S.plugins.xushi = 1; win.Store.saveSettings();
    $('btnCast').click();
    const cc = win.App.state.chart, gz = cc.calendar.ganzhi;
    const PZ = { 1: ['子'], 8: ['丑', '寅'], 3: ['卯'], 4: ['辰', '巳'], 9: ['午'], 2: ['未', '申'], 7: ['酉'], 6: ['戌', '亥'] };
    const bs = [gz.year[1], gz.month[1], gz.day[1], gz.hour[1]];
    const wantPal = Object.keys(PZ).filter((k) => PZ[k].some((z) => bs.indexOf(z) >= 0)).map(Number).sort();
    const gotPal = [...doc.querySelectorAll('#qm_text_pan .qm-xs-shi')].map((e) => +e.dataset.pal).sort();
    eq(JSON.stringify(gotPal), JSON.stringify(wantPal), '实宫 = 四柱地支命中的宫');
    S.plugins.xushi = 0; win.Store.saveSettings();
    $('btnBack').click();
  });

  /* ==================================================== ㉓ 运行期无报错 */
  await group('㉓ 运行期无脚本报错', async () => {
    eq(A.errs.length, 0, '整轮操作期间不许有脚本报错：\n      ' + A.errs.join('\n      '));
  });

  /* ==================================================== ㉔ 新实例：默认态 / 存档读回 */
  await group('㉔ 新实例（首屏默认时间档 · 空四格 · 失败不落课 · 记得上次译法）', async () => {
    const F = await boot(null);
    const f$ = F.$;
    F.doc.querySelector('#tabbar button[data-view="chuanxing"]').click();
    eq(F.doc.querySelector('#segCxSrc button.on').dataset.src, 'time', '新开 App：默认停在时间档');
    eq(f$('cxPanelNums').classList.contains('on'), false, '新开 App：数字档不该显示');
    eq(['cxN0', 'cxN1', 'cxN2', 'cxN3'].map((id) => f$(id).value).join('|'), '|||', '新开 App：数字档四格应是空的');
    eq(f$('cxStar').checked, false, '新开 App：默认六神（不勾）');
    eq(f$('cxPopGrid').children.length, 0, '还没起课：课页网格应是空的');
    f$('segCxSrc').querySelector('button[data-src="nums"]').click();
    f$('btnCastX').click();
    eq(f$('cxPop').classList.contains('on'), false, '空四格点「起课」不该落课');
    eq(f$('cxPopGrid').children.length, 0, '空四格点「起课」不该留下半成品课');
    has(f$('toast').textContent, '没填', '应提示四数没填');
    /* 存档里记着九星：新页面一进来就该是九星 */
    const G2 = await boot({ rev: 3, cxMode: 'star' });
    G2.doc.querySelector('#tabbar button[data-view="chuanxing"]').click();
    eq(G2.$('cxStar').checked, true, '存档里是九星：新页面应读回来');
    eq(G2.$('cxN0').placeholder, '1–9', '存档里是九星：占位也应是 1–9');
    eq(G2.doc.querySelector('#segCxSrc button.on').dataset.src, 'time', '读回译法不影响默认档（仍是时间）');
    eq(F.errs.concat(G2.errs).length, 0, '两个新实例都不许有脚本报错：\n      '
      + F.errs.concat(G2.errs).join('\n      '));
  });

  /* ==================================================== 收尾 */
  const lines = Object.keys(groups).map((k) => '    ' + k + '：' + groups[k].pass + ' 过'
    + (groups[k].fail ? ' / ' + groups[k].fail + ' 败' : ''));
  console.log('\n分组：\n' + lines.join('\n'));
  console.log(`\n串星集成自测（页面层）：${pass} 过 / ${fail} 败`);
  if (fail) console.log('（算法层见 校验/_check_cx_engine.js；读法层见 校验/_check_cxhelp.js）');
  process.exit(fail ? 1 : 0);
})();
