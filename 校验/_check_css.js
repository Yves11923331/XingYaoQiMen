/* 兜底自检：① CSS 花括号配平 ② 代码里用到的类名在 CSS 里必须有定义
 * 起因：2026-09-26 用"区间替换"改 .tg 时，把 .fold 整块吃掉了 —— 弹层十一条全部一直展开，
 *       肉眼才发现。这个脚本就是为了让这类事故立刻报错。
 * 跑法：node 校验/_check_css.js
 */
const fs = require('fs'), path = require('path');
const WEB = path.join(__dirname, '..', 'web');
const read = f => fs.readFileSync(path.join(WEB, f), 'utf8');

let bad = 0;
/* ⚠ 起盘页/盘面页有一部分样式是写在 index.html 的行内 <style> 里的（.home / .modewrap / .qhead …），
   漏掉它会把一堆正常类名误报成"没定义"。 */
const cssFiles = ['css/app.css', 'css/pan.css'];
let css = '';
for (const f of cssFiles) {
  const s = read(f);
  css += s + '\n';
  const open = (s.match(/{/g) || []).length, close = (s.match(/}/g) || []).length;
  if (open !== close) { console.log(`✗ ${f} 花括号不配平：{ ${open} } ${close}`); bad++; }
  else console.log(`✓ ${f} 花括号配平（${open}）`);
}

/* 这些是状态类/平台类，不需要在 CSS 里有独立定义 */
const ALLOW = new Set(['on', 'q', 'js', 'hidden']);

const src = ['index.html', 'js/ui.js', 'js/snapshot.js'].map(read).join('\n');
/* 行内 <style> 也算 CSS 语料 */
for (const m of src.matchAll(/<style>([\s\S]*?)<\/style>/g)) css += m[1] + '\n';
const used = new Set();
for (const m of src.matchAll(/class="([^"{}]+)"/g)) {
  /* JS 里常拼字符串（class="qm-fx ' + x + '"），会抓到碎片 —— 只收合法类名 */
  /* 拼字符串的截断：class="tile ' + kind + ' ' + wx + '" —— 冒号后面那些是 JS 变量，
     不是类名。遇到第一个引号或加号就砍掉。 */
  /* 末尾必须是字母数字：`class="qm-shen-' + id` 这种前缀碎片（qm-shen-）不算类名 */
  m[1].split(/'|\+/)[0].split(/\s+/).forEach(c => { if (/^[a-z][a-z0-9_-]*[a-z0-9]$/.test(c)) used.add(c); });
}
/* JS 里拼出来的类名：'fold' + (open ? ' on' : '') 这类，单独扫一遍关键字 */
const esc = s => s.replace(/[-]/g, '\\-');
/* 已知的"多余但无害"类：基础类已经把样式做完了，这些修饰类没定义也不影响显示。
   留在这儿是为了下次自检不再把它们当新问题。 */
const KNOWN_UNSTYLED = { 'qm-fx-mid': '中宫卦象面的修饰类；基础类 .qm-fx 已做完全部居中' };
const missing = [...used].filter(c => !ALLOW.has(c) && !KNOWN_UNSTYLED[c] && !new RegExp('\\.' + esc(c) + '(?![\\w-])').test(css));
if (missing.length) { console.log('✗ 代码里用到、CSS 里没定义：', missing.join(' ')); bad++; }
else console.log(`✓ 代码里用到的 ${used.size} 个类名，CSS 全都有定义`);

/* ★ 2026-10-07：snapshot.js 里曾经有个**变量名撞车**——
   render()/renderBoth() 先用 `var g = panGeom(panW)` 存九宫几何，后面画渲染背景时
   又 `var g = ctx.createLinearGradient(...)` 把它盖掉 → panX 算成 NaN →
   「一加渲染背景，出图就只剩四柱、没有九宫盘」。这类 bug 语法合法、jsdom 也测不到，
   只能在这儿钉一条源码检查：几何变量在，就不许再有同名的渐变变量。 */
{
  const snap = read('js/snapshot.js');
  const geo = (snap.match(/var g = panGeom\(/g) || []).length;
  const clash = (snap.match(/var g = ctx\.createLinearGradient\(/g) || []).length;
  if (geo && clash) { console.log('✗ snapshot.js：九宫几何用 g、背景渐变也用 g（会算出 NaN，九宫盘画不出来）'); bad++; }
  else console.log('✓ snapshot.js 背景渐变与九宫几何没有变量名撞车');
}

/* ★ 2026-10-07：八神颜色必须**按神名**逐个有定义、且复用五行色变量。
   曾经的乱象：颜色挂在"位置号"上 → 勾陈（10 号）拿到的是 5 号位那套色、
   朱雀（11 号）整个没定义（字掉成继承色）。这条钉住"一个神一个类、类里必须是五行色"。 */
{
  const pan = read('css/pan.css');
  const KEYS = ['zhifu','tengshe','taiyin','liuhe','baihu','xuanwu','jiudi','jiutian','taichang','gouchen','zhuque'];
  const miss = KEYS.filter(k => !new RegExp('\\.qm-shen-' + k + '\\s*\\{[^}]*var\\(--qm-el-').test(pan));
  if (miss.length) { console.log('✗ 八神缺颜色定义（或没走五行色变量）：' + miss.join(' ')); bad++; }
  else console.log('✓ 八神 11 个神名颜色类都在，且都走五行色变量');
}

/* ★ 2026-10-07：前端「关于 → 版本 1.1.NN」那一行必须存在且可被打包脚本替换。
   写法一变，build_xingyao.py 的自动同步就会悄悄失效（用户点开看到的是老版本号）。 */
{
  const ui = read('js/ui.js');
  if (!/版本 1\.1\.\d+/.test(ui)) { console.log('✗ ui.js 里找不到「版本 1.1.NN」（打包脚本没法同步版本号）'); bad++; }
  else console.log('✓ 前端「关于」的版本号可被打包脚本同步');
}

/* 关键功能块的白名单：这些类被删过一次，单列出来钉住 */
const REQUIRED = [
  ['.fold', '释义弹层的折叠行'],
  ['.fold.on .bd', '折叠展开态'],
  ['.tg.gu', '古章'], ['.tg.jin', '今章'], ['.tg.qi', '歧章'],
  ['.docp', '释义弹层正文段'],
  ['.sheet', '底部弹层'], ['.sheet.on', '弹层展开态'],
  ['.tb-btn.wide', '顶栏「关于」键'], ['.setchips', '设置页分段'],
];
for (const [sel, what] of REQUIRED) {
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'));
  if (re.test(css)) console.log(`✓ ${sel}（${what}）在`);
  else { console.log(`✗ 缺 ${sel} —— ${what}`); bad++; }
}
console.log(bad ? `\n=== 自检未过：${bad} 项 ===` : '\n=== 自检全过 ===');
process.exit(bad ? 1 : 0);
