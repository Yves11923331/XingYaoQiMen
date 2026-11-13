/* ============================================================================
 * _check_cx_engine.js —— 串星课引擎（web/js/cx.js）自测
 * ----------------------------------------------------------------------------
 * 跑法：node 校验/_check_cx_engine.js
 *      （不需要 jsdom；NODE_PATH 也就无所谓，脚本按自己位置推工程根）
 *
 * 查什么：
 *   A 六神表：顺序 / 五行 / 颜色（与 ui.js 的 WX_COLOR 同值）
 *   B 九星表：**必须逐字等于 qimen.js 的 Q.STAR / Q.STAR_WX**，天禽独立第 5 格，不许有「禽芮」
 *   C 五个原文例子逐格对表（1527 / 1158 / 1724 / 9444 / 命造）
 *   D 连根数起的判据（1527 人宫、9444 地宫人宫 —— 写成"绝对起宫"这里立刻红）
 *   E 0 与越界（六神域 0→6、九星域 0→9、末位 0→10；越界自然循环）
 *   F 非法输入口径（空 / 非数字 / 负数 / ≥3 位 / 非数组 / 非法 mode）
 *   G 六亲：150 组（6×10 + 9×10）全枚举 + 400 组随机四数，与**独立参考表**零差异；
 *     ui.js 的 liuQin 交叉对表**已退役**（t4 把那套代码删了）——
 *     现在先断言 ui.js 里确实已无 liuQin / GAN_WX / starName，再记「预期跳过」，
 *     六亲基准由口径表 §4.3 的 5×10 全表承担（就是 G1 的 REL）
 *   H 两套译法互不影响；九星**纯数字→星序**，不随局、不随时刻、不随盘面变
 *   I 四数换算（此刻 / 盘面那一刻 / 闰月 / 非时家盘）
 *   J 随机四数范围
 *   K 源码级不变量（无 DOM 依赖、无「禽芮」）
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const JS = path.join(ROOT, 'web', 'js');

/* 引擎要的历法/排盘层先垫上（qimen.js / yinpan.js 会自己挂到 globalThis） */
global.Lunar = require(path.join(JS, 'lunar.js'));
global.Astro = require(path.join(JS, 'astro.js'));
const Q = require(path.join(JS, 'qimen.js'));
const Yin = require(path.join(JS, 'yinpan.js'));
const RNG = require(path.join(JS, 'rng.js'));
const CX = require(path.join(JS, 'cx.js'));

let pass = 0, fail = 0;
const fails = [];
const skips = [];              // 预期跳过（前提已写死成断言的那种）—— 单独计数，不算通过也不算失败
const stats = {};              // 每组各多少过/败 —— 汇总时逐组列出，红在哪一组一眼看见
let curSec = '';
function ok(c, m) {
  if (c) { pass++; if (stats[curSec]) stats[curSec].pass++; }
  else { fail++; fails.push(m); if (stats[curSec]) stats[curSec].fail++; console.log('  ✗ ' + m); }
}
/* 显式「预期跳过」：只在**前提本身已被断言钉住**时才用（见 G2）。
   不用 console 偷偷放过 —— 汇总里会列出条数与理由。 */
function skip(m) { skips.push(m); console.log('  · 预期跳过：' + m); }
function eq(a, b, m) {
  const A = typeof a === 'string' ? a : JSON.stringify(a);
  const B = typeof b === 'string' ? b : JSON.stringify(b);
  ok(A === B, m + `\n      期望 ${B}\n      实得 ${A}`);
}
function section(t) {
  if (curSec && stats[curSec]) {
    console.log(`  └ ${stats[curSec].pass} 过 / ${stats[curSec].fail} 败`);
  }
  curSec = t.slice(0, 1);
  stats[curSec] = { pass: 0, fail: 0 };
  console.log('\n' + t);
}

/* ---------------------------------------------------------------- 独立参考 */
/* 六亲的**独立实现**：把「宫五行 × 干五行」两两关系写成显式矩阵（5×5 常量表），
   不走 cx.js 里那套 WX_SHENG/WX_KE 推导 —— 这样两处同时写错的概率才真降下来。
   读法：生干者父母 / 干生者子孙 / 克干者官鬼 / 干克者妻财 / 同者兄弟。 */
const REL = {
  '木': { '木': '兄弟', '火': '父母', '土': '官鬼', '金': '妻财', '水': '子孙' },
  '火': { '木': '子孙', '火': '兄弟', '土': '父母', '金': '官鬼', '水': '妻财' },
  '土': { '木': '妻财', '火': '子孙', '土': '兄弟', '金': '父母', '水': '官鬼' },
  '金': { '木': '官鬼', '火': '妻财', '土': '子孙', '金': '兄弟', '水': '父母' },
  '水': { '木': '父母', '火': '官鬼', '土': '妻财', '金': '子孙', '水': '兄弟' }
};
const GAN_WX = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
                 '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };

/* ---------------------------------------------------------------- ui.js 侧 */
/* 从 ui.js 源里抽 liuQin 与三张表来对拍（不启动整个 App）。
   ⚠ 2026-11-13（t4 之后）：ui.js 已经**没有** liuQin / GAN_WX / starName 了，这个抽取器
   现在只用来给 G2 判「前提成立」。哪天又能抽出东西，G2a–c 会先红 —— 那时再改回真交叉。 */
function uiLiuQin() {
  let src;
  try { src = fs.readFileSync(path.join(JS, 'ui.js'), 'utf8'); }
  catch (e) { return { why: 'ui.js 读不到：' + e.message }; }
  const a = src.indexOf('var GAN_WX ='), b = src.indexOf('function starName(');
  if (a < 0 || b < 0 || b < a) return { why: 'ui.js 里找不到 GAN_WX…starName 这段' };
  const block = src.slice(a, b);
  if (block.indexOf('function liuQin(') < 0) return { why: 'ui.js 里的 liuQin 已经不在了（应由 cx.js 接管）' };
  try {
    const f = new Function(block + '; return { liuQin: liuQin, WX_COLOR: WX_COLOR };')();
    return { liuQin: f.liuQin, WX_COLOR: f.WX_COLOR };
  } catch (e) { return { why: 'ui.js 那段 eval 失败：' + e.message }; }
}
const UI = uiLiuQin();

/* ------------------------------------------------- 五行色（主题 token） */
/* 2026-11-13 用户拍板：五色 × 四主题一律取 app.css 的 `--el-*`，不做"素白回退旧值"的特例。
   这里把四套主题的 token 从 app.css 里读出来，再把 ui.js 里**真实的 wxColor()** 抽出来执行 ——
   于是"渲染色 == 该主题 --el-*"这条判据是真跑出来的，不是靠源码正则猜的。 */
const OLD_HEX = { '木': '#1a8f4a', '火': '#d2362a', '土': '#b8860b', '金': '#7f8792', '水': '#2b3440' };
const EL_KEYS = { '木': 'wood', '火': 'fire', '土': 'earth', '金': 'metal', '水': 'water' };
function themeTokens() {
  const css = fs.readFileSync(path.join(ROOT, 'web', 'css', 'app.css'), 'utf8');
  const out = {};
  const blocks = css.matchAll(/html\[data-theme="(white|blue|slate|brown)"\]\s*\{([\s\S]*?)\n\}/g);
  for (const b of blocks) {
    const th = b[1], body = b[2];
    const el = {};
    for (const wx of Object.keys(EL_KEYS)) {
      const m = new RegExp('--el-' + EL_KEYS[wx] + '\\s*:\\s*([^;]+);').exec(body);
      if (m) el[wx] = m[1].trim();
    }
    const surf = /--surface\s*:\s*([^;]+);/.exec(body);
    const ink3 = /--ink-3\s*:\s*([^;]+);/.exec(body);
    out[th] = { el: el, surface: surf ? surf[1].trim() : '', ink3: ink3 ? ink3[1].trim() : '' };
  }
  return out;
}
const THEMES = themeTokens();
const THEME_CN = { white: '素白', blue: '玄夜', slate: '墨玉', brown: '铜仪' };
const DARK_THEMES = ['blue', 'slate', 'brown'];

/* 把 ui.js 里的 wxColor 原样抽出来跑：给它一份"假 getComputedStyle"，
   返回的颜色就是那个主题下真正会上屏的颜色（函数体一个字没改）。 */
function uiWxColor() {
  let src;
  try { src = fs.readFileSync(path.join(JS, 'ui.js'), 'utf8'); } catch (e) { return { why: 'ui.js 读不到：' + e.message }; }
  const a = src.indexOf('var WX_VAR = {');
  if (a < 0) return { why: 'ui.js 里没有 WX_VAR（主题色映射表）' };
  const b = src.indexOf('function wxColor(');
  if (b < 0) return { why: 'ui.js 里没有 wxColor()' };
  const e = src.indexOf('\n  }', b);
  if (e < 0) return { why: 'wxColor() 的函数体找不到收尾' };
  const block = src.slice(a, e + 4);
  try {
    const f = new Function('getComputedStyle', 'document', block + '; return { wxColor: wxColor, WX_VAR: WX_VAR };');
    return { make: (tokens) => f(
      (elm) => ({ getPropertyValue: (n) => (tokens[n] || '') }),
      { documentElement: {} }
    ) };
  } catch (err) { return { why: 'ui.js 那段 eval 失败：' + err.message }; }
}
const WXC = uiWxColor();
/* wxColor() 里查的是 CSS 变量名（'--el-water'），而 THEMES[th].el 用五行做键 —— 转一层 */
const asVars = (el) => {
  const o = {};
  Object.keys(el || {}).forEach(wx => { o['--el-' + EL_KEYS[wx]] = el[wx]; });
  return o;
};

/* --------------------------------------------------- 卡方检验（p 值，自带实现） */
/* 只为"分布无偏"这一条服务：χ² = Σ(O−E)²/E，自由度 df=n−1，
   p = P(χ²_df > x) = 正则化上不完全伽马 Q(df/2, x/2)。
   gser/gcf 是 Numerical Recipes 的标准级数/连分式，收敛到 1e-14。 */
function lnGamma(z) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function gser(a, x) {                       /* 下不完全伽马 P(a,x) */
  let ap = a, sum = 1 / a, del = sum;
  for (let n = 1; n < 1000; n++) {
    ap += 1; del *= x / ap; sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
}
function gcf(a, x) {                        /* 上不完全伽马 Q(a,x)，连分式 */
  const FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}
function chiSqP(x, df) {
  const a = df / 2, xx = x / 2;
  if (xx < 0) return 1;
  return xx < a + 1 ? 1 - gser(a, xx) : gcf(a, xx);
}

/* ================================================================ A 六神表 */
section('A 六神表');
eq(CX.SIX.map(s => s.name).join(''), '大安留连速喜赤口小吉空亡', 'A1 六神顺序（底本 L3）');
eq(CX.SIX.map(s => s.el).join(''), '木土火金水土', 'A2 六神五行（底本 L19，空亡授土）');
eq(CX.SIX.map(s => s.idx).join(''), '123456', 'A3 六神 idx = 1..6');
/* A4（2026-11-13 改判）：WX_COLOR 现在只是**兜底常量**（真正上屏取 --el-*）。
   所以这里不再断言"渲染色＝它"，只断：五色键齐、值合法、且引擎表的 color 由它派生。 */
eq(Object.keys(CX.WX_COLOR).sort().join(''), '土木水火金'.split('').sort().join(''), 'A4a CX.WX_COLOR 五个键齐（木火土金水）');
ok(Object.keys(CX.WX_COLOR).every(k => /^#[0-9a-f]{6}$/i.test(CX.WX_COLOR[k])),
   'A4b CX.WX_COLOR 每个值都是合法 #rrggbb（可当兜底色用）');
eq(CX.SIX.map(s => s.color).join(''),
   [CX.WX_COLOR['木'], CX.WX_COLOR['土'], CX.WX_COLOR['火'], CX.WX_COLOR['金'],
    CX.WX_COLOR['水'], CX.WX_COLOR['土']].join(''), 'A4c 六神表 color 仍由 WX_COLOR 派生（引擎自洽，作兜底）');
ok(CX.SIX[1].el === CX.SIX[5].el, 'A5 留连与空亡同为土（⇒ 两行六亲恒等，不是 bug）');
/* A6（2026-11-13 改判）：颜色不再"表对表"，改成验**显示路径**：
   优先取 --el-*，取不到才回落到引擎给的 color（WX_COLOR 系）。
   ui.js 里的 wxColor() 原样抽出来喂四种 token 跑，见下面的 L 段。 */
if (WXC.make) {
  const white = WXC.make({});
  ok(Object.keys(WXC.make({}).WX_VAR).join('') === '木火土金水', 'A6a ui.js 的 WX_VAR 映射齐五色');
  eq(WXC.make({}).WX_VAR['水'], '--el-water', 'A6b WX_VAR 的「水」指向 --el-water');
  eq(WXC.make({}).WX_VAR['木'], '--el-wood', 'A6c WX_VAR 的「木」指向 --el-wood');
  eq(white.wxColor('水', CX.WX_COLOR['水']), CX.WX_COLOR['水'],
     'A6d token 取不到时 wxColor 回落到引擎给的颜色（兜底路径真实存在）');
  eq(white.wxColor('水', ''), '', 'A6e token 与兜底都没有时给空串（不编颜色）');
} else {
  ok(false, 'A6 抽不到 ui.js 的 wxColor()：' + WXC.why);
}

/* ================================================================ B 九星表 */
section('B 九星表');
eq(CX.STAR.map(s => s.name).join(' '), Q.STAR.slice(1).join(' '), 'B1 九星名＝Q.STAR[1..9]（天蓬…天英）');
eq(CX.STAR.map(s => s.el).join(''), Q.STAR_WX.slice(1).join(''), 'B2 九星五行＝Q.STAR_WX[1..9]');
eq(CX.STAR.map(s => s.idx).join(''), '123456789', 'B3 九星 idx = 1..9');
eq(CX.STAR[4].name, '天禽', 'B4 天禽是**独立第 5 格**（转盘禽芮合写不许渗进来）');
ok(CX.STAR.every(s => s.name.indexOf('禽芮') < 0), 'B5 九星表里没有「禽芮」');
/* B6（2026-11-13 改判）：九星表 color 仍由 WX_COLOR 派生（兜底），
   真正上屏的颜色在下面 L 段按主题 token 验。 */
eq(CX.STAR.map(s => s.color).join(''), CX.STAR.map(s => CX.WX_COLOR[s.el]).join(''),
   'B6 九星表 color 仍由 WX_COLOR 派生（兜底常量，不再等于渲染色）');
eq(CX.STAR.map(s => s.name).join(''), '天蓬天芮天冲天辅天禽天心天柱天任天英', 'B7 九星全名串');

/* ================================================================ C 五例 */
section('C 五个原文例子（逐格）');
function cells(r) { return r.three.map(t => t.name + t.el).join(' '); }
function qins(r) { return r.three.map(t => t.qin).join(' '); }

{
  const r = CX.castByNumbers([1, 5, 2, 7]);
  eq(cells(r), '大安木 小吉水 空亡土', 'C1 1527 三宫（底本 L24）');
  eq(r.stem + r.ganEl, '庚金', 'C1 1527 天干');
  eq(qins(r), '妻财 子孙 父母', 'C1 1527 三亲（底本 L25）');
}
{
  const r = CX.castByNumbers([1, 1, 5, 8]);
  eq(cells(r), '大安木 大安木 小吉水', 'C2 1158 三宫（底本 L58）');
  eq(r.stem + r.ganEl, '辛金', 'C2 1158 天干');
  eq(qins(r), '妻财 妻财 子孙', 'C2 1158 三亲（底本 L59）');
}
{
  const r = CX.castByNumbers([1, 7, 2, 4]);
  eq(cells(r), '大安木 大安木 留连土', 'C3 1724 三宫（底本 L87）');
  eq(r.stem + r.ganEl, '丁火', 'C3 1724 天干');
  eq(qins(r), '父母 父母 子孙', 'C3 1724 三亲（底本 L88）');
}
{
  const r = CX.castByNumbers([9, 4, 4, 4]);
  eq(cells(r), '速喜火 空亡土 速喜火', 'C4 9444 三宫（底本 L110）');
  eq(r.stem + r.ganEl, '丁火', 'C4 9444 天干');
  eq(qins(r), '兄弟 子孙 兄弟', 'C4 9444 三亲（底本 L111）');
}
{
  /* 命造：原文只给宫位不给数；1316 是能复现它的最小四数（口径表 §6.2） */
  const r = CX.castByNumbers([1, 3, 1, 6]);
  eq(cells(r), '大安木 速喜火 速喜火', 'C5 命造 三宫（底本 L73）');
  eq(r.stem + r.ganEl, '己土', 'C5 命造 天干');
  eq(qins(r), '官鬼 父母 父母', 'C5 命造 三亲（底本 L74）');
}

/* ================================================================ D 判据 */
section('D 连根数起的判据（防"绝对起宫"回归）');
{
  /* 若写成"每数都从大安起"，1527 的人宫会是留连、9444 的地宫/人宫会是赤口/赤口 */
  eq(CX.castByNumbers([1, 5, 2, 7]).three[2].name, '空亡', 'D1 1527 人宫＝空亡（绝对起宫会错成留连）');
  eq(CX.castByNumbers([9, 4, 4, 4]).three[1].name, '空亡', 'D2 9444 地宫＝空亡（绝对起宫会错成赤口）');
  eq(CX.castByNumbers([9, 4, 4, 4]).three[2].name, '速喜', 'D3 9444 人宫＝速喜（绝对起宫会错成赤口）');
  /* 九星域同一判据：1527 地宫/人宫在"绝对起宫"下会是 天禽来? 直接钉住结果 */
  eq(CX.castByNumbers([1, 5, 2, 7], 'star').three.map(t => t.name).join(' '), '天蓬 天禽 天心',
     'D4 九星域 1527 也吃连根（天蓬→天禽→天心）');
}

/* ================================================================ E 0 与越界 */
section('E 0 与越界');
eq(cells(CX.castByNumbers([0, 0, 0, 0])), '空亡土 小吉水 赤口金', 'E1 六神 0000 → 空亡·小吉·赤口（逐宫退一位）');
eq(CX.castByNumbers([0, 0, 0, 0]).stem, '癸', 'E1 六神 0000 天干＝癸');
/* 只比「课」——返回里的 nums 是入参回显，本来就该一个 0 一个 6 */
function lesson(r) { return JSON.stringify({ mode: r.mode, stem: r.stem, three: r.three }); }
eq(lesson(CX.castByNumbers([0, 0, 0, 0])), lesson(CX.castByNumbers([6, 6, 6, 10])),
   'E2 六神 (0,0,0,0) ≡ (6,6,6,10)（三宫与天干全同，仅回显的 nums 不同）');
eq(cells(CX.castByNumbers([0, 0, 0, 0], 'star')), '天英火 天任土 天柱金', 'E3 九星 0000 → 天英·天任·天柱（0 按 9 论）');
eq(lesson(CX.castByNumbers([0, 0, 0, 0], 'star')), lesson(CX.castByNumbers([9, 9, 9, 10], 'star')),
   'E4 九星 (0,0,0,0) ≡ (9,9,9,10)');
eq(CX.castByNumbers([66, 99, 7, 8]).three.map(t => t.name).join(' '), '空亡 留连 留连',
   'E5 两位越界值自然循环：66→6 空亡；99→3 自空亡起数 3 步＝留连；7→1 自留连起 1＝留连');
eq(CX.castByNumbers([6, 1, 1, 1]).three[0].name, '空亡', 'E5b 前三位 6 ＝ 空亡');
eq(CX.castByNumbers([12, 1, 1, 1]).three[0].name, '空亡', 'E5c 12 与 6 同解');
eq(CX.castByNumbers([1, 1, 1, 11]).stem, '甲', 'E5d 末位 11 → 甲');
eq(CX.castByNumbers([1, 1, 1, 20]).stem, '癸', 'E5e 末位 20 → 癸');
eq(CX.castByNumbers([18, 1, 1, 1], 'star').three[0].name, '天英', 'E6 九星 18 → 9 天英');
eq(CX.castByNumbers([10, 1, 1, 1], 'star').three[0].name, '天蓬', 'E6b 九星 10 → 1 天蓬');
eq(CX.castByNumbers([19, 1, 1, 1], 'star').three[0].name, '天蓬', 'E6c 九星 19 → 1');

/* ================================================================ F 非法输入 */
section('F 非法输入口径');
const BAD = [
  [[], '缺四个'],
  [[1, 2, 3], '只给三个'],
  [['', '2', '3', '4'], '有一格空'],
  [['  ', '2', '3', '4'], '空格串'],
  [['a', '2', '3', '4'], '非数字'],
  [['-1', '2', '3', '4'], '负数'],
  [['123', '2', '3', '4'], '三位数'],
  [['1.5', '2', '3', '4'], '小数'],
  [[null, '2', '3', '4'], 'null'],
  ['1527', '传成整串而不是四格'],
  [undefined, 'undefined']
];
for (const mode of ['six', 'star']) {
  for (const [nums, why] of BAD) {
    const r = CX.castByNumbers(nums, mode);
    ok(r.ok === false && !!r.err && r.three.length === 0 && r.stem === '',
       `F[${mode}] ${why}：应拦下并给 err（实得 ok=${r.ok} err=${r.err}）`);
  }
  ok(CX.castByNumbers(['10', '10', '10', '10'], mode).ok === true,
     `F[${mode}] 「10」是合法值（末位上限就是 10）`);
  ok(CX.castByNumbers([0, 0, 0, 0], mode).ok === true, `F[${mode}] 全 0 放行（原文有定义）`);
}
ok(CX.castByNumbers({ 0: '1', 1: '5', 2: '2', 3: '7', length: 4 }).ok === true,
   'F 类数组（长度 4、非字符串）照收，方便 UI 直接打包四个 input');
ok(CX.castByNumbers([1, 2, 3, 4], 'tian').ok === false, 'F 非法 mode 要拦');
eq(CX.castByNumbers([1, 2, 3, 4], '').mode, 'six', 'F 空 mode 视为缺省 six');
eq(CX.castByNumbers([1, 2, 3, 4], null).mode, 'six', 'F null mode 视为缺省 six');
eq(CX.castByNumbers([1, 2, 3, 4]).mode, 'six', 'F 不传 mode 时缺省 six');

/* ================================================================ G 六亲对表 */
section('G 六亲：独立参考表（150 组全枚举 + 400 组随机）· ui.js 交叉已退役');
let gDiff = 0;
for (const t of CX.SIX) for (const g of CX.GAN10) {
  if (CX.liuQin(t.el, GAN_WX[g]) !== REL[t.el][GAN_WX[g]]) gDiff++;
}
for (const t of CX.STAR) for (const g of CX.GAN10) {
  if (CX.liuQin(t.el, GAN_WX[g]) !== REL[t.el][GAN_WX[g]]) gDiff++;
}
eq(gDiff, 0, 'G1 150 组（6×10 六神 + 9×10 九星）与独立参考表零差异');

if (UI.liuQin) {
  let uDiff = 0, n = 0;
  for (const t of CX.SIX) for (const g of CX.GAN10) {
    n++; if (CX.liuQin(t.el, GAN_WX[g]) !== UI.liuQin(t.el, GAN_WX[g])) uDiff++;
  }
  for (const t of CX.STAR) for (const g of CX.GAN10) {
    n++; if (CX.liuQin(t.el, GAN_WX[g]) !== UI.liuQin(t.el, GAN_WX[g])) uDiff++;
  }
  eq(uDiff, 0, `G2 与 ui.js 的 liuQin 交叉对表（${n} 组）零差异`);
} else {
  /* G2 —— **预期跳过**（2026-11-13 起，不是静默放过）：
     ui.js 在 t4 把「奇门·加干」那套按星五行论六亲的代码整段删了（GAN_WX / liuQin / starName
     一并走的），交叉对表现在没有对手可比。以前这里只 console 一句，谁也看不见；现在分两步：
       ① 把**前提**写死成断言：ui.js 里确实已无这三样 —— 哪天又长回来，这里立刻红，
          提醒改回真交叉（而不是继续当它不存在）；
       ② 六亲基准由口径表 §4.3 的 5×10 全表承担 —— 就是上面 G1 用的 REL（150 组全枚举）。
     前提成立时记一笔「预期跳过」（单独计数，既不算通过也不算失败），并当行打印理由。 */
  const uiSrcG = fs.readFileSync(path.join(JS, 'ui.js'), 'utf8');
  const g2a = uiSrcG.indexOf('function liuQin(') < 0;
  const g2b = !/var\s+GAN_WX\s*=/.test(uiSrcG);
  const g2c = !/function\s+starName\s*\(/.test(uiSrcG);
  ok(g2a, 'G2a 前提：ui.js 里确实已无 liuQin（六亲已由 cx.js 接管）');
  ok(g2b, 'G2b 前提：ui.js 里确实已无 GAN_WX 表');
  ok(g2c, 'G2c 前提：ui.js 里确实已无 starName()');
  if (g2a && g2b && g2c) {
    skip('G2 与 ui.js liuQin 的交叉对表已退役：前提成立（ui.js 已无 liuQin / GAN_WX / starName），'
       + '六亲基准改由口径表 §4.3 的 5×10 全表承担（见 G1）');
  } else {
    ok(false, 'G2 既不能交叉、也不是「ui.js 已删干净」：' + UI.why);
  }
}

/* 400 组随机四数，两模式各 200：逐格 qin 与参考表比 */
let rDiff = 0, rCells = 0;
for (let i = 0; i < 400; i++) {
  const mode = i % 2 ? 'star' : 'six';
  const k = mode === 'six' ? 6 : 9;
  const nums = [1 + Math.floor(Math.random() * k), 1 + Math.floor(Math.random() * k),
                1 + Math.floor(Math.random() * k), 1 + Math.floor(Math.random() * 10)];
  const r = CX.castByNumbers(nums, mode);
  if (!r.ok) { rDiff++; continue; }
  for (const t of r.three) {
    rCells++;
    const want = REL[t.el][GAN_WX[r.stem]];
    if (t.qin !== want) rDiff++;
  }
}
eq(rDiff, 0, `G3 400 组随机四数（每模式 200）逐格零差异，共比 ${rCells} 格`);

/* 全域枚举：六亲永远不许为空 */
let emptyQin = 0, tri6 = new Set(), tri9 = new Set();
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) for (let d = 1; d <= 10; d++) {
  const r = CX.castByNumbers([a, b, c, d]);
  tri6.add(r.three.map(t => t.name).join());
  for (const t of r.three) if (!t.qin) emptyQin++;
}
for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let c = 1; c <= 9; c++) for (let d = 1; d <= 10; d++) {
  const r = CX.castByNumbers([a, b, c, d], 'star');
  tri9.add(r.three.map(t => t.name).join());
  for (const t of r.three) if (!t.qin) emptyQin++;
}
eq(emptyQin, 0, 'G4 2160（六神）+ 7290（九星）组四数全枚举，六亲无空值');
eq(tri6.size, 216, 'G5 六神三宫组合 216/216 全覆盖');
eq(tri9.size, 729, 'G6 九星三宫组合 729/729 全覆盖');

/* ================================================================ H 两模式独立 */
section('H 两套译法互不影响 / 九星不随盘面变');
{
  const base6 = JSON.stringify(CX.castByNumbers([1, 5, 2, 7]));
  const base8 = JSON.stringify(CX.castByNumbers([1, 5, 2, 7], 'star'));
  CX.castByNumbers([9, 9, 9, 9], 'star');
  CX.castByNumbers([3, 3, 3, 3]);
  CX.randomNums('star');
  eq(JSON.stringify(CX.castByNumbers([1, 5, 2, 7])), base6, 'H1 交替调用后六神结果不变');
  eq(JSON.stringify(CX.castByNumbers([1, 5, 2, 7], 'star')), base8, 'H1 交替调用后九星结果不变');
}
{
  /* 纯数字→星序：n1=1..9 时天宫必须依次是 天蓬…天英（不许有阳顺阴逆那种换序） */
  const seq = [];
  for (let n = 1; n <= 9; n++) seq.push(CX.castByNumbers([n, 1, 1, 1], 'star').three[0].name);
  eq(seq.join(' '), CX.STAR.map(s => s.name).join(' '), 'H2 n1=1..9 → 天宫依次 天蓬…天英（纯星序）');
  const seq2 = [];
  for (let n = 1; n <= 6; n++) seq2.push(CX.castByNumbers([n, 1, 1, 1], 'six').three[0].name);
  eq(seq2.join(' '), CX.SIX.map(s => s.name).join(' '), 'H2b n1=1..6 → 天宫依次 大安…空亡');
}
{
  /* 同一四数在任意局 / 任意时刻 / 任意层都得同一个结果 */
  const charts = [
    Q.cast(2026, 11, 13, 8, 12, {}),
    Q.cast(2026, 9, 2, 10, 30, { ju: 'chaibu' }),
    Q.cast(1984, 2, 2, 23, 30, { lateZi: true }),
    Q.castNian(2026, {}),
    Q.castYue(2026, 10, {}),
    Q.castRi(2026, 11, 13, {}),
    Q.castManual(1, 3, 5, 6, {}),
    Yin.cast(2026, 11, 13, 8, 12, {})
  ];
  const base = JSON.stringify(CX.castByNumbers([1, 5, 2, 7], 'star'));
  let same = true;
  for (const c of charts) same = same && JSON.stringify(CX.castByNumbers([1, 5, 2, 7], 'star')) === base;
  ok(same, 'H3 九星结果与盘面无关（8 张不同盘轮着 cast 后仍逐字相同）');
  /* 有农历月日的盘（时家×3、阴盘）→ castFromChart 必须出同一张课；
     没有的（年/月/日家、手动局）→ 必须明确拒绝，绝不硬凑一张半课。 */
  const usable = charts.slice(0, 3).concat([charts[7]]);
  const unusable = charts.slice(3, 7);
  let uOk = 0, xOk = 0;
  for (const c of usable) if (CX.castFromChart(c, 'star').ok) uOk++;
  for (const c of unusable) {
    const r = CX.castFromChart(c, 'star');
    if (!r.ok && r.err && r.three.length === 0) xOk++;
  }
  eq(uOk, usable.length, 'H3b 时家/阴盘：castFromChart 出课');
  eq(xOk, unusable.length, 'H3c 年/月/日家与手动局：castFromChart 明确拒绝（不硬凑半课）');
  const r = CX.castByNumbers([1, 5, 2, 7], 'star');
  ok(!('ju' in r) && !('layer' in r) && !('calendar' in r), 'H3b 九星课的返回里不含任何局/层/历法字段');
}

/* ================================================================ I 四数换算 */
section('I 四数换算（此刻 / 盘面那一刻）');
eq(CX.numsFromParts(10, 5, 5, 9).nums, [10, 5, 5, 9], 'I1 numsFromParts 直译');
eq(CX.numsFromChart({ y: 2026, m: 11, d: 13, h: 8, mi: 12 }).nums, [10, 5, 5, 9],
   'I2 2026-11-13 08:12 → [10,5,5,9]（十月初五 · 壬辰时）');
eq(CX.numsFromChart({ y: 2025, m: 7, d: 25, h: 10, mi: 0 }).nums[0], 6,
   'I3 2025-07-25 闰六月初一 → 天宫数取 6（所闰之月号）');
{
  const c = Q.cast(2026, 11, 13, 8, 12, {});
  eq(CX.numsFromCalendar(c.calendar).nums, CX.numsFromChart({ y: 2026, m: 11, d: 13, h: 8, mi: 12 }).nums,
     'I4 时家：读 chart.calendar 与按公历现算，两条路同解');
  eq(CX.numsFromChart(c).nums, [10, 5, 5, 9], 'I4b numsFromChart 直接吃 chart 也行');
  const r = CX.castFromChart(c, 'star');
  eq(r.three.map(t => t.name).join(' '), CX.castByNumbers([10, 5, 5, 9], 'star').three.map(t => t.name).join(' '),
     'I4c castFromChart 端到端');
}
ok(CX.numsFromChart(Q.castNian(2026, {})).ok === false, 'I5 年家：没有农历月日与时干支 → 拦');
ok(CX.numsFromChart(Q.castYue(2026, 10, {})).ok === false, 'I5b 月家 → 拦');
ok(CX.numsFromChart(Q.castRi(2026, 11, 13, {})).ok === false, 'I5c 日家 → 拦');
ok(CX.numsFromChart(Q.castManual(1, 3, 5, 6, {})).ok === false, 'I5d 手动局（无农历月日）→ 拦');
ok(CX.numsFromChart(Yin.cast(2026, 11, 13, 8, 12, {})).ok === true, 'I5e 阴盘 calendar 完整 → 能直译');
{
  const bad = [
    [13, 5, 5, 9, '农历月 13'], [10, 31, 5, 9, '农历日 31'],
    [10, 5, 13, 9, '时辰序 13'], [10, 5, 5, 11, '时干序 11'],
    [10, 0, 5, 9, '农历月 0'], [10, 5, 5, 0, '时干序 0'],
    [null, 5, 5, 9, '月 null']
  ];
  let badOk = 0;
  for (const [m, d, hz, hg, why] of bad) {
    const r = CX.numsFromParts(m, d, hz, hg);
    if (!r.ok && r.err) badOk++;
    else console.log('      漏拦：' + why);
  }
  eq(badOk, bad.length, `I6 numsFromParts 越界/缺失全拦（${bad.length} 例）`);
}
eq(CX.numsFromParts(10, 5, 5, 9).nums, CX.numsFromChart({ y: 2026, m: 11, d: 13, h: 8, mi: 12 }).nums,
   'I7 「此刻」与「盘面那一刻」走同一个函数族，结果一致');

/* ================================================================ J 随机 */
section('J 随机四数：Web Crypto 无偏采样 / 范围 / 分布（卡方）');

/* J-a 熵源：现在是 crypto，摘掉 crypto 要降级且不抛错 */
eq(CX.RNG.source(), 'crypto', 'J1 当前环境熵源＝crypto（crypto.getRandomValues）');
{
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const restore = () => { if (desc) Object.defineProperty(globalThis, 'crypto', desc); };
  try { delete globalThis.crypto; }
  catch (e) { Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true }); }
  try {
    eq(CX.RNG.source(), 'pseudo', 'J2 摘掉 crypto → source() 降级为 pseudo（不静默）');
    let bad = 0, threw = '';
    try {
      for (let i = 0; i < 500; i++) {
        const r = CX.randomNums();
        const rs = CX.randomNums('star');
        if (!r || r.length !== 4) bad++;
        else for (let k = 0; k < 3; k++) if (r[k] < 1 || r[k] > 6) bad++;
        if (!rs || rs.length !== 4) bad++;
        else for (let k = 0; k < 3; k++) if (rs[k] < 1 || rs[k] > 9) bad++;
      }
    } catch (e) { threw = e.message; }
    eq(threw, '', 'J2b 降级路径不抛错');
    eq(bad, 0, 'J2c 降级后照常出合法四数（六神 1–6 / 九星 1–9 / 末位 1–10）');
    eq(CX.RNG.last(), 'pseudo', 'J2d last() 如实记下这次用的是 pseudo');
  } finally { restore(); }
  eq(CX.RNG.source(), 'crypto', 'J3 测完还原，恢复 crypto');
  CX.randomNums();                                   /* last() 记的是"上一次"，得先抽一次 */
  ok(CX.RNG.last() === 'crypto', 'J3b 还原后重新抽，last() 回到 crypto');
}

/* J-b 范围（沿用原来的口径断言，换成 crypto 路径跑） */
{
  let bad = 0; const hit6 = new Set(); const hit10 = new Set();
  for (let i = 0; i < 20000; i++) {
    const r = CX.randomNums();
    if (r.length !== 4) { bad++; continue; }
    for (let j = 0; j < 3; j++) { if (r[j] < 1 || r[j] > 6) bad++; hit6.add(r[j]); }
    if (r[3] < 1 || r[3] > 10) bad++; hit10.add(r[3]);
  }
  eq(bad, 0, 'J4 六神随机：前三位恒 1–6、末位恒 1–10（20000 次）');
  eq([...hit6].sort((a, b) => a - b).join(''), '123456', 'J5 六个值都抽得到');
  eq([...hit10].sort((a, b) => a - b).join(''), '12345678910', 'J6 末位 1 与 10 都抽得到（含 10）');
}
{
  let bad = 0; const hit9 = new Set();
  for (let i = 0; i < 20000; i++) {
    const r = CX.randomNums('star');
    for (let j = 0; j < 3; j++) { if (r[j] < 1 || r[j] > 9) bad++; hit9.add(r[j]); }
    if (r[3] < 1 || r[3] > 10) bad++;
  }
  eq(bad, 0, 'J7 九星随机：前三位恒 1–9、末位恒 1–10（20000 次）');
  eq([...hit9].sort((a, b) => a - b).join(''), '123456789', 'J8 九星 9 个值全抽得到（天心/天柱/天任/天英可达）');
}
eq(CX.randomNums('').length, 4, 'J9 randomNums("") 视为缺省模式');
{
  let max = 0;
  for (let i = 0; i < 5000; i++) max = Math.max(max, CX.randomNums()[0]);
  ok(max <= 6, 'J10 无参 randomNums() 仍是六神口径（1–6）');
}

/* J-c 分布无偏：每个域 60000 次卡方，df=n−1，p>0.001 通过；另看最大/最小频次比 */
const CHI = {};
function distCheck(n, draws) {
  const cnt = new Array(n).fill(0);
  let bad = 0;
  for (let i = 0; i < draws; i++) {
    const v = 1 + CX.RNG.u32in(n);
    if (v < 1 || v > n) bad++;
    cnt[v - 1]++;
  }
  const E = draws / n;
  const chi = cnt.reduce((acc, c) => acc + (c - E) * (c - E) / E, 0);
  const p = chiSqP(chi, n - 1);
  const mn = Math.min(...cnt), mx = Math.max(...cnt);
  const r = { n, draws, chi, p, ratio: mx / mn, seen: cnt.every(c => c > 0), bad, cnt };
  CHI[n] = r;
  return r;
}
for (const n of [6, 9, 10]) {
  const r = distCheck(n, 60000);
  ok(r.p > 0.001, `J11 域 1–${n}：χ²=${r.chi.toFixed(2)}，df=${n - 1}，p=${r.p.toFixed(4)} > 0.001`);
  ok(r.seen, `J11b 域 1–${n}：${n} 个值全部出现过`);
  /* 比值只做粗筛：60000 次、n=10 时单格 sd≈1.2%，5% 的落差属于正常波动，
     阈值卡 1.05 会偶发红。真正判"有偏"的是上面那条卡方，以及下面的 4σ。 */
  ok(r.ratio < 1.10, `J11c 域 1–${n}：最大/最小频次比 ${r.ratio.toFixed(4)} < 1.10`);
  {
    const E = r.draws / n, sd = Math.sqrt(E * (1 - 1 / n));
    const zmax = Math.max(...r.cnt.map(c => Math.abs(c - E) / sd));
    r.zmax = zmax;
    ok(zmax < 4, `J11e 域 1–${n}：所有格子都在 ±4σ 内（实测最大 ${zmax.toFixed(2)}σ，σ=${sd.toFixed(1)}）`);
  }
  ok(r.bad === 0, `J11d 域 1–${n}：没有越界样本`);
  console.log(`      ${n} 域：χ²=${r.chi.toFixed(2)} p=${r.p.toFixed(4)} 比=${r.ratio.toFixed(4)}` +
              ` 频次=${r.cnt.join(',')}`);
}
/* 用 randomNums 本体再验一次（不是只验 u32in）：九星 300 次必须出现 ≥7 的星号 */
{
  let maxV = 0;
  for (let i = 0; i < 300; i++) {
    const r = CX.randomNums('star');
    maxV = Math.max(maxV, r[0], r[1], r[2]);
  }
  ok(maxV >= 7, `J12 九星 300 次里出现过 ≥7 的星号（实测最大 ${maxV}）`);
}

/* J-d 不依赖 Math.random：把它打桩成抛错，crypto 路径必须照跑 */
{
  const orig = Math.random;
  let calls = 0;
  Math.random = () => { calls++; throw new Error('不该用 Math.random'); };
  let threw = '', okRun = true;
  try {
    for (let i = 0; i < 300; i++) {
      const r = CX.randomNums();
      const rs = CX.randomNums('star');
      if (r.length !== 4 || rs.length !== 4) okRun = false;
    }
  } catch (e) { threw = e.message; okRun = false; }
  Math.random = orig;
  eq(threw, '', 'J13 Math.random 打桩成抛错后，crypto 路径照常跑通');
  eq(calls, 0, 'J14 整个过程一次都没调用 Math.random（计数 0）');
  ok(okRun, 'J14b 300 次双模式结果结构正常');
}

/* J-e 纯函数：castByNumbers 不该沾随机 */
{
  const orig = Math.random;
  Math.random = () => { throw new Error('不该用 Math.random'); };
  let r = null, threw = '';
  try { r = CX.castByNumbers([1, 5, 2, 7]); } catch (e) { threw = e.message; }
  Math.random = orig;
  eq(threw, '', 'J15 castByNumbers 不受 Math.random 影响（纯函数）');
  eq(r && r.three.map(t => t.name).join(' '), '大安 小吉 空亡', 'J15b 结果照旧正确');
  const strip = f => fs.readFileSync(path.join(JS, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const cxCode = strip('cx.js'), rngCode = strip('rng.js');
  /* t12：随机实现搬到 rng.js 之后，cx.js 里**一处** Math.random 都不该剩 */
  eq((cxCode.match(/Math\.random/g) || []).length, 0,
     'J16 cx.js 里已无任何随机实现（Math.random 0 处，全部委托 rng.js）');
  eq((rngCode.match(/Math\.random/g) || []).length, 1,
     'J16b rng.js 里 Math.random 只出现 1 次（唯一降级出口 pseudoRaw）');
  ok(/getRandomValues/.test(rngCode), 'J17 rng.js 里用了 crypto.getRandomValues');
  ok(/U32_LIM\s*-\s*\(U32_LIM\s*%\s*n\)/.test(rngCode), 'J18 拒绝采样：上限 = 2^32 − (2^32 mod n)');
  ok(/while\s*\(v\s*>=\s*lim/.test(rngCode), 'J18b 落在余数区间就丢掉重抽（while v >= lim）');
  ok(/CX\.RNG|RNG_API/.test(cxCode) && !/getRandomValues/.test(cxCode), 'J18c cx.js 只持委托，不持熵源');
}

/* ================================================================ K 源码不变量 */
section('K 源码级不变量');
{
  const src = fs.readFileSync(path.join(JS, 'cx.js'), 'utf8');
  /* 注释里会写到「禽芮」（解释为什么不用它），所以剔掉块注释再查 */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(code.indexOf('禽芮') < 0, 'K1 cx.js 的**代码**里没有「禽芮」合写（注释里可以有）');
  ok(!/\bdocument\b/.test(src), 'K2 cx.js 不碰 DOM（无 document）');
  ok(!/getElementById|querySelector/.test(src), 'K2b cx.js 不查节点');
  ok(/root\.CX\s*=\s*API/.test(src), 'K3 挂在 window.CX 上');
  ok(/module\.exports\s*=\s*API/.test(src), 'K4 node 下也导出（校验脚本能直接 require）');
  ok(src.indexOf('Qimen') >= 0 || src.indexOf('qimen.js') >= 0, 'K5 九星表取自 qimen.js，不是另抄');
  ok(/kd\(n, k\)/.test(src), 'K6 归一函数 kd(n,k) 在位（两域共用一条式子）');
  ok(!/阳顺|阴逆|顺飞|逆飞/.test(code), 'K7 代码里没有「阳顺阴逆 / 顺飞逆飞」那套');
}
{
  /* 加载顺序：rng.js 必须在 cx.js 之前（t13 往 index.html 加标签）。
     t13 还没落地时**不判红**，只打一条显眼的提醒 —— 因为此刻按下「随机四数 /
     随机档起课」会抛"M rng.js 没加载"的可读错误。 */
  const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
  const iR = html.indexOf('js/rng.js'), iC = html.indexOf('js/cx.js');
  if (iR < 0) {
    console.log('  ⚠ web/index.html 还没引 <script src="js/rng.js">（按分工属 t13）：'
      + '\n     在那一行落地之前，「随机四数 / 随机档起课」会抛可读错误（不会静默）。');
  } else {
    ok(iR < iC, 'K8 index.html 里 js/rng.js 排在 js/cx.js 之前');
  }
}

/* ================================================================ L 浏览器路径 */
section('L 浏览器路径（jsdom 真加载 <script>，模拟 t4 的接线）');
/* 为什么要有这一条：cx.js 在 node 下是 module.exports 走通的，浏览器下走
   window.CX + window.Lunar/window.Qimen。两条路是两套加载语义，只测 node 不算数。 */
try {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { runScripts: 'dangerously', url: 'http://127.0.0.1/index.html' });
  for (const f of ['astro.js', 'lunar.js', 'qimen.js', 'rng.js', 'cx.js']) {
    dom.window.eval(fs.readFileSync(path.join(JS, f), 'utf8'));
  }
  const w = dom.window;
  ok(!!w.CX, 'L1 window.CX 挂上了');
  eq(w.CX.STAR.map(x => x.name).join(''), '天蓬天芮天冲天辅天禽天心天柱天任天英', 'L2 浏览器里的九星表');
  eq(w.CX.castByNumbers(['1', '5', '2', '7']).three.map(t => t.name).join(' '), '大安 小吉 空亡',
     'L3 浏览器里起课（直接喂 input.value 的字符串）');
  eq(w.CX.castByNumbers(['9', '4', '4', '4'], 'star').three.map(t => t.name).join(' '), '天英 天冲 天心',
     'L4 浏览器里的九星起课');
  eq(w.CX.numsFromChart({ y: 2026, m: 11, d: 13, h: 8, mi: 12 }).nums, [10, 5, 5, 9],
     'L5 浏览器里四数换算（用 window.Lunar，不靠 node require）');
  ok(w.RNG && w.CX.RNG === w.RNG, 'L6 浏览器里 CX.RNG 就是 window.RNG 本体（同一对象）');
  eq(w.RNG.source(), 'crypto', 'L7 浏览器里熵源是 crypto');
  {
    const r = w.CX.randomNums('star');
    ok(r.length === 4 && r.slice(0, 3).every(v => v >= 1 && v <= 9) && r[3] >= 1 && r[3] <= 10,
       'L8 浏览器里 randomNums 走 rng.js 正常出数');
  }
} catch (e) {
  console.log('  · L 跳过（jsdom 不可用：' + e.message + '）');
}

/* ================================================================ M rng.js 本体 */
section('M 共享随机源 rng.js（u32in / dbl / pick / shuffle / 降级 / 缺模块报错）');

ok(CX.RNG === RNG, 'M1 CX.RNG 与 RNG 是同一个对象（真委托，不是各留一套实现）');
eq(RNG.LIM, 4294967296, 'M2 RNG.LIM = 2^32');

/* M-a 直接对 rng.js 做分布检验（不经 cx.js），每域 60000 次 */
const CHI2 = {};
function distR(n, draws) {
  const cnt = new Array(n).fill(0);
  let bad = 0;
  for (let i = 0; i < draws; i++) {
    const v = RNG.u32in(n);
    if (!(v >= 0 && v < n) || v !== Math.floor(v)) bad++;
    cnt[v]++;
  }
  const E = draws / n;
  const chi = cnt.reduce((acc, c) => acc + (c - E) * (c - E) / E, 0);
  const p = chiSqP(chi, n - 1);
  const mn = Math.min(...cnt), mx = Math.max(...cnt);
  const sd = Math.sqrt(E * (1 - 1 / n));
  const r = { n, draws, chi, p, ratio: mx / mn, seen: cnt.every(c => c > 0), bad, cnt,
              zmax: Math.max(...cnt.map(c => Math.abs(c - E) / sd)) };
  CHI2[n] = r;
  return r;
}
for (const n of [6, 9, 10]) {
  const r = distR(n, 60000);
  ok(r.p > 0.001, `M3 域 1–${n}：χ²=${r.chi.toFixed(2)}，df=${n - 1}，p=${r.p.toFixed(4)} > 0.001`);
  ok(r.seen && r.bad === 0, `M3b 域 1–${n}：${n} 个值全覆盖、零越界样本`);
  ok(r.ratio < 1.10, `M3c 域 1–${n}：最大/最小频次比 ${r.ratio.toFixed(4)} < 1.10`);
  ok(r.zmax < 4, `M3d 域 1–${n}：所有格子都在 ±4σ 内（最大 ${r.zmax.toFixed(2)}σ）`);
  console.log(`      u32in(${n})：χ²=${r.chi.toFixed(2)} p=${r.p.toFixed(4)} 比=${r.ratio.toFixed(4)} 最大偏差=${r.zmax.toFixed(2)}σ`);
}

/* M-b dbl()：[0,1) 的 53 位均匀 —— 10 等分桶卡方 */
let DBL = null;
{
  const B = 10, N = 60000, cnt = new Array(B).fill(0);
  let bad = 0, mn = 1, mx = 0;
  for (let i = 0; i < N; i++) {
    const v = RNG.dbl();
    if (!(v >= 0 && v < 1)) bad++;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    cnt[Math.min(B - 1, Math.floor(v * B))]++;
  }
  const E = N / B;
  const chi = cnt.reduce((acc, c) => acc + (c - E) * (c - E) / E, 0);
  const p = chiSqP(chi, B - 1);
  const ratio = Math.max(...cnt) / Math.min(...cnt);
  const sd = Math.sqrt(E * (1 - 1 / B));
  const zmax = Math.max(...cnt.map(c => Math.abs(c - E) / sd));
  DBL = { chi, p, ratio, zmax, mn, mx, cnt };
  eq(bad, 0, 'M4 dbl() 恒在 [0,1)（60000 次）');
  ok(p > 0.001, `M4b dbl() 落 10 等分桶均匀：χ²=${chi.toFixed(2)}，df=9，p=${p.toFixed(4)} > 0.001`);
  ok(ratio < 1.10, `M4c dbl() 桶频次 最大/最小 ${ratio.toFixed(4)} < 1.10`);
  ok(zmax < 4, `M4d dbl() 桶频次都在 ±4σ 内（最大 ${zmax.toFixed(2)}σ）`);
  ok(mn < 0.001 && mx > 0.999, `M4e dbl() 两端都取到过（min=${mn.toFixed(6)} max=${mx.toFixed(6)}）`);
  console.log(`      dbl()：χ²=${chi.toFixed(2)} p=${p.toFixed(4)} 比=${ratio.toFixed(4)} 最大偏差=${zmax.toFixed(2)}σ`);
}

/* M-c shuffle 均匀性：6 元素洗 60000 次，逐位置 × 逐元素 卡方（比数 720 种排列稳） */
let SHUF = null;
{
  const n = 6, N = 60000, base = [0, 1, 2, 3, 4, 5];
  const cells = Array.from({ length: n }, () => new Array(n).fill(0));
  const perms = new Set();
  for (let t = 0; t < N; t++) {
    const a = RNG.shuffle(base.slice());
    for (let i = 0; i < n; i++) cells[i][a[i]]++;
    perms.add(a.join(''));
  }
  const E = N / n, sd = Math.sqrt(E * (1 - 1 / n));
  let worstP = 1, worstChi = 0, worstZ = 0, fails = 0;
  for (let i = 0; i < n; i++) {
    const chi = cells[i].reduce((acc, c) => acc + (c - E) * (c - E) / E, 0);
    const p = chiSqP(chi, n - 1);
    const z = Math.max(...cells[i].map(c => Math.abs(c - E) / sd));
    if (p < worstP) { worstP = p; worstChi = chi; }
    if (z > worstZ) worstZ = z;
    if (p <= 0.001) fails++;
  }
  SHUF = { worstP, worstChi, worstZ, fails, perms: perms.size };
  eq(fails, 0, `M5 每个位置的每个元素都均匀（6×6 格卡方，最差 p=${worstP.toFixed(4)} > 0.001）`);
  ok(worstZ < 4, `M5b 6×6 格里最大偏差 ${worstZ.toFixed(2)}σ < 4σ`);
  eq(perms.size, 720, 'M5c 720 种排列全部出现过（6! 种，一次不缺）');
  console.log(`      shuffle：最差 χ²=${worstChi.toFixed(2)} p=${worstP.toFixed(4)} 最大偏差=${worstZ.toFixed(2)}σ 排列=${perms.size}/720`);
}

/* M-d 降级：摘掉 crypto → pseudo，且不抛错；还原后回 crypto */
{
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try { delete globalThis.crypto; }
  catch (e) { Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true }); }
  try {
    eq(RNG.source(), 'pseudo', 'M6 摘掉 crypto → RNG.source() 降级为 pseudo');
    let bad = 0, threw = '';
    try {
      for (let i = 0; i < 300; i++) {
        const v = RNG.u32in(6); if (!(v >= 0 && v < 6)) bad++;
        const d = RNG.dbl(); if (!(d >= 0 && d < 1)) bad++;
        RNG.shuffle([1, 2, 3, 4]);
      }
    } catch (e) { threw = e.message; }
    eq(threw, '', 'M6b 降级路径不抛错');
    eq(bad, 0, 'M6c 降级下 u32in/dbl 值域仍合法');
    eq(RNG.last(), 'pseudo', 'M6d last() 如实记下 pseudo');
  } finally { if (desc) Object.defineProperty(globalThis, 'crypto', desc); }
  eq(RNG.source(), 'crypto', 'M6e 还原后 source() 回到 crypto');
}

/* M-e Math.random 打桩成抛错：四个方法全都要照跑 */
{
  const orig = Math.random;
  let calls = 0;
  Math.random = () => { calls++; throw new Error('不该用 Math.random'); };
  let threw = '';
  try {
    for (let i = 0; i < 200; i++) {
      RNG.u32in(7); RNG.dbl(); RNG.pick(['x', 'y', 'z']); RNG.shuffle([1, 2, 3]);
    }
  } catch (e) { threw = e.message; }
  Math.random = orig;
  eq(threw, '', 'M7 Math.random 打桩抛错 → u32in/dbl/pick/shuffle 全部照跑');
  eq(calls, 0, 'M7b 调用计数 0（crypto 路径一次都没碰伪随机）');
}

/* M-f 边界与可读报错 */
{
  const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
  ok(throws(() => RNG.u32in(0), /RNG/), 'M8 u32in(0) 给可读报错');
  ok(throws(() => RNG.u32in(2.5), /RNG/), 'M8b u32in(2.5) 给可读报错');
  ok(throws(() => RNG.pick([]), /RNG/), 'M8c pick([]) 给可读报错');
  const a = [1, 2, 3, 4, 5, 6], r = RNG.shuffle(a);
  ok(r === a, 'M8d shuffle 原地打乱并返回同一个数组');
  eq(a.slice().sort((x, y) => x - y).join(''), '123456', 'M8e 洗牌不丢不重');
  eq(RNG.shuffle([1]).join(''), '1', 'M8f 单元素原样返回');
}
{
  /* 真跑一遍「rng.js 根本没加载」：子进程里把 require('./rng.js') 打断，
     cx.js 必须抛**可读的**报错（而不是 undefined is not a function）。 */
  const cp = require('child_process');
  const child = [
    "const Module = require('module'); const orig = Module._load;",
    "Module._load = function (req) { if (req === './rng.js') throw new Error('sim-missing'); return orig.apply(this, arguments); };",
    'const CX = require(' + JSON.stringify(path.join(JS, 'cx.js')) + ');',
    "let msg = ''; try { CX.randomNums(); } catch (e) { msg = e.message; }",
    'process.stdout.write(msg);'
  ].join('\n');
  let out = '';
  try { out = cp.execFileSync(process.execPath, ['-e', child], { encoding: 'utf8' }); }
  catch (e) { out = '子进程失败：' + e.message; }
  ok(/rng\.js/.test(out) && out.length > 20,
     'M9 缺 rng.js 时 randomNums 抛可读报错（实测：' + out.slice(0, 46) + '…）');
}

/* ================================================================ N 五行色主题化 */
/* 2026-11-13 用户拍板：五色 × 四主题**一律**取 app.css 的 --el-*，不做"素白回退旧值"的特例。
   这一段是这条决定的硬判据：
     N1  app.css 四套主题各有完整五色 token，值都是 #rrggbb
     N2  把 ui.js 里**真实的 wxColor()** 抽出来、喂每种主题的 token 跑 —— 渲染色 == 该主题 --el-*
     N3  token 取不到时回落引擎给的 color（兜底路径仍在）
     N4  防倒退：渲染色**不得**等于旧的写死值（尤其素白水不许再是 #2b3440）
     N5  snapshot.js 的导出图走同一条 token 路径（palette 读 --el-*、elColorOf 优先 token）
     N6  深色三套：五色对 --surface 对比 ≥ 4.5:1（素白的土只有 4.02:1，按 WCAG 大文本 3:1 放行） */
section('N 五行色主题化（四主题 × 五色）');
{
  const thKeys = Object.keys(THEMES);
  eq(thKeys.sort().join(','), 'blue,brown,slate,white', 'N1a app.css 里找到四套主题块');
  let tokenOK = true, badTok = '';
  for (const th of thKeys) for (const wx of Object.keys(EL_KEYS)) {
    const v = (THEMES[th].el || {})[wx] || '';
    if (!/^#[0-9a-f]{6}$/i.test(v)) { tokenOK = false; badTok += ` ${th}/${wx}=「${v}」`; }
  }
  ok(tokenOK, 'N1b 四主题 × 五色 token 齐全且都是 #rrggbb' + (tokenOK ? '' : '（差：' + badTok + '）'));

  /* L2：真跑 ui.js 的 wxColor() */
  ok(!!WXC.make, 'N2a 能抽出 ui.js 的 wxColor()' + (WXC.make ? '' : '：' + WXC.why));
  if (WXC.make) {
    for (const th of thKeys) {
      const api = WXC.make(asVars(THEMES[th].el));
      for (const wx of Object.keys(EL_KEYS)) {
        const want = THEMES[th].el[wx];
        const got = api.wxColor(wx, OLD_HEX[wx]);
        eq(got, want, `N2b [${THEME_CN[th]}] ${wx} 渲染色应等于 --el-${EL_KEYS[wx]}（${want}）`);
      }
      /* L4：防倒退 —— 渲染色不得等于旧写死值（素白水必须换掉）。
         ⚠ 兜底参数必须用**生产形状**：ui.js 真调 wxColor 时传的第二参就是引擎给的
         `CX.WX_COLOR[wx]`，而那五个值恰好就是 OLD_HEX —— 所以这里也传 OLD_HEX[wx]。
         以前这里传 '' 是弱判据：真退回写死常量时 wxColor 返回 ''，恒 ≠ OLD_HEX，
         这条永远不会红（review 在 t16 点出的就是它）。换成生产形状后"回落到旧值"立刻被抓住。 */
      const back = Object.keys(EL_KEYS).filter(wx => api.wxColor(wx, OLD_HEX[wx]) === OLD_HEX[wx]);
      eq(back.join(','), '', `L4 [${THEME_CN[th]}] 五色都不许再用旧的写死值（实得：${back.join(',') || '无'}）`);
      ok(api.wxColor('水', OLD_HEX['水']) !== OLD_HEX['水'],
         `L4b [${THEME_CN[th]}] 水色不得再是 ${OLD_HEX['水']}（拿生产兜底 ${OLD_HEX['水']} 试）`);
    }
    /* L3：token 清空 → 回落到引擎 color */
    const bare = WXC.make({});
    for (const wx of Object.keys(EL_KEYS)) {
      eq(bare.wxColor(wx, CX.WX_COLOR[wx]), CX.WX_COLOR[wx], `N3 [兜底] token 取不到时 ${wx} 回落引擎色`);
    }
  }

  /* L6：深色三套对比 ≥ 4.5:1（素白只记录，土 4.02:1 按大文本 3:1 放行） */
  function lum(hex) {
    const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
  for (const th of thKeys) {
    const t = THEMES[th];
    if (!/^#[0-9a-f]{6}$/i.test(t.surface || '') || !/^#[0-9a-f]{6}$/i.test((t.el || {})['水'] || '')) continue;
    const rows = Object.keys(EL_KEYS).map(wx => ({ wx, r: ratio(t.el[wx], t.surface) }));
    const min = Math.min(...rows.map(r => r.r));
    const txt = rows.map(r => `${r.wx} ${r.r.toFixed(2)}:1`).join(' · ');
    console.log(`  [${THEME_CN[th]}] 对 --surface(${t.surface}) 对比：${txt}`);
    if (DARK_THEMES.indexOf(th) >= 0) {
      ok(min >= 4.5, `L6 [${THEME_CN[th]}] 深色主题五色对背景都应 ≥4.5:1（最小 ${min.toFixed(2)}:1）`);
    } else {
      ok(min >= 3.0, `L6 [${THEME_CN[th]}] 素白五色对白底应 ≥3:1（大字口径；最小 ${min.toFixed(2)}:1）`);
      ok(ratio(t.el['土'], t.surface) < 4.5, 'N6b 素白土仍是 4.0x:1（与盘面一致，不做特例）—— 若哪天被改亮，这条会红');
    }
  }

  /* L5：导出图走同一条 token 路径 */
  const snapSrc = fs.readFileSync(path.join(JS, 'snapshot.js'), 'utf8');
  ok(/el:\s*\{\s*'木':\s*rv\('--el-wood'/.test(snapSrc), 'N5a snapshot.js 的 palette() 读 --el-wood…--el-water');
  ok(/function elColorOf\(P,\s*t\)/.test(snapSrc), 'N5b snapshot.js 有 elColorOf() 取主题色');
  ok(/return \(P\.el && P\.el\[t\.el\]\) \|\| t\.color \|\| P\.ink;/.test(snapSrc),
     'N5c elColorOf 的优先级是 token → 引擎 color → ink');
  const uses = (snapSrc.match(/elColorOf\(P,\s*L\.three\[/g) || []).length;
  ok(uses >= 3, 'N5d renderLesson 用 elColorOf 取三宫色（实得 ' + uses + ' 处，应 ≥3；renderBoth 已随盘面同显删除）');
  ok(!/L\.three\[\d\]\.color/.test(snapSrc), 'N5e 导出图里不再直接吃 three[].color（必须经 elColorOf）');

  /* 屏幕侧同理：ui.js 的 cxCellsHTML 必须经 wxColor，不许直接吃 s.color */
  const uiSrc = fs.readFileSync(path.join(JS, 'ui.js'), 'utf8');
  ok(/var tint = s\.void \? '' : wxColor\(s\.el, s\.color\);/.test(uiSrc), 'N5f ui.js 课页/同显的 tint 走 wxColor');
  ok(!/xcellHTML\('', s\.name \|\| '—', '', s\.color,/.test(uiSrc), 'N5g 课页里不再直接用 s.color 上色');
}

/* ---------------------------------------------------------------- 汇总 */
if (curSec && stats[curSec]) console.log(`  └ ${stats[curSec].pass} 过 / ${stats[curSec].fail} 败`);
console.log('\n分组：' + Object.keys(stats).map(k => `${k} ${stats[k].pass}/${stats[k].pass + stats[k].fail}`).join('  '));
if (CHI2[6] && CHI2[9] && CHI2[10] && DBL && SHUF) {
  console.log('\nrng.js 实测（每项 60000 次）：');
  for (const n of [6, 9, 10]) {
    const r = CHI2[n];
    console.log(`  u32in(${String(n).padStart(2)})  χ²=${r.chi.toFixed(2).padStart(7)}  df=${n - 1}` +
                `  p=${r.p.toFixed(4)}  最大/最小=${r.ratio.toFixed(4)}`);
  }
  console.log(`  dbl()      χ²=${DBL.chi.toFixed(2).padStart(7)}  df=9` +
              `  p=${DBL.p.toFixed(4)}  最大/最小=${DBL.ratio.toFixed(4)}`);
  console.log(`  shuffle    最差 p=${SHUF.worstP.toFixed(4)}（36 格）  排列=${SHUF.perms}/720`);
}
if (CHI[6] && CHI[9] && CHI[10]) {
  console.log('\n随机无偏（crypto + 拒绝采样，各 60000 次）：');
  for (const n of [6, 9, 10]) {
    const r = CHI[n];
    console.log(`  ${String(n).padStart(2)} 域  χ²=${r.chi.toFixed(2).padStart(7)}  df=${n - 1}` +
                `  p=${r.p.toFixed(4)}  最大/最小=${r.ratio.toFixed(4)}  最大偏差=${r.zmax.toFixed(2)}σ`);
  }
}
console.log(`\n串星课引擎自测：${pass} 过 / ${fail} 败`
  + (skips.length ? `（另有 ${skips.length} 条预期跳过：前提已写死成断言）` : ''));
/* 预期跳过只在上面 G 段当行打全文；这里给一行索引，免得同一句长文案出现两遍 */
if (skips.length) {
  console.log('预期跳过：' + skips.map(s => s.split('：')[0]).join('、') + '（理由见上文那行）');
}
if (fail) {
  console.log('失败项：');
  fails.forEach(f => console.log('  · ' + f.split('\n')[0]));
}
process.exit(fail ? 1 : 0);
