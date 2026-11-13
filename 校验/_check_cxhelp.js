/* 串星课 · 读法（web/js/cxhelp.js）自检 —— 2026-11-13
 * ① 原文逐字对照：底本《小六壬·加干（2026.8.31）.txt》清洗后与渲染出来的正文
 *    **去掉全部标点与空白**后逐字比对 —— 少一句、错一个字、挪了字序都会挂。
 *    只放行两笔已申报的结构性补充（课表列名 ×7、第五/六节的节名），见 ADD_OK。
 * ② 「小六壬」一个都不许剩，「串星课」必须出现 2 次（顺序节、命造节）。
 * ③ 类名：正文里用到的每个 class 都必须有定义 —— 本文件自带 <style>、app.css、
 *    pan.css、index.html 行内 <style> 任一处即可（cxhelp.js 不在 _check_css.js 的
 *    扫描范围里，所以在这里补上同一条门禁）。
 * ④ 结构：八张卡、七张课表、类象 11 条（6 神 + 5 亲）、CxHelp.sheet() 整装。
 * ⑤ 另打一份"标点层动过什么"的清单（只报告，不判失败）：好让人一眼看再加工碰了哪些标点。
 * 跑法：node 校验/_check_cxhelp.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const SRC = path.join(ROOT, '小六壬·加干（2026.8.31）.txt');
const CJ = path.join(WEB, 'js', 'cxhelp.js');

let bad = 0;

/* ------------------------------------------------ 底本（唯一底本，先清洗） */
let raw = fs.readFileSync(SRC, 'utf8');
const nul = (raw.match(/\u0000/g) || []).length;
raw = raw.replace(/\u0000/g, '');
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
console.log(`${nul === 9 ? '✓' : '·'} 底本清洗：清掉 ${nul} 个 NUL 字节 + 1 个 BOM`);
if (nul !== 9) { console.log('  （底本字节变了？原样本是 9 个 NUL）'); bad++; }
const ORIG = raw.replace(/小六壬/g, '串星课').replace(/‘六’/g, '“六”');

/* 只留「字」：去掉空白与全部标点（全角、半角、箭头、省略号、方头括号都算） */
const PUNCT = /[\s，。、；：！？“”‘’（）【】《》〈〉…—－·,.!?;:'"()\[\]<>|/\\+~`^*_=\-]/g;
function chars(t) { return t.replace(PUNCT, ''); }
const charsNoPunct = chars;

/* ---------------------------------------------- 申报式删除（OMIT_OK） */
/* 2026-11-13 用户拍板：读法去掉「掌诀」这一节。**只此一句，别的一句都不许少。**
   台账：底本第 1 行（清洗后不含 BOM 的第一行），含标点 47 字、去标点 40 字。
   判定：BASE = 底本逐字挖掉 OMIT_OK 登记的原文片段，之后仍然走"去标点后逐字相等"，
   所以少一个别的字照样红；OMIT_OK 里的片段在底本里找不到（或出现不止一次）也红 —— 台账过期。 */
const OMIT_OK = [
  {
    line: 1,
    chars: 47, charsNoPunct: 40,
    why: '2026-11-13 用户要求去掉「掌诀」一节',
    text: '掌诀：大安食指下部，留连食指上部，速喜中指上部，赤口无名指上部，小吉无名指下部，空亡中指下部。'
  }
];
let BASE = ORIG;
{
  for (const o of OMIT_OK) {
    const n = ORIG.split(o.text).length - 1;
    const rawLine = (raw.split('\n')[o.line - 1] || '').replace(/\u0000/g, '');
    const charOk = o.text.length === o.chars && charsNoPunct(o.text).length === o.charsNoPunct;
    if (n !== 1) { console.log(`✗ OMIT_OK 台账过期：第 ${o.line} 行那句在底本里出现 ${n} 次（应为 1 次）`); bad++; continue; }
    if (rawLine.trim() !== o.text) { console.log(`✗ OMIT_OK 台账与底本第 ${o.line} 行不一致：\n    台账：${o.text}\n    底本：${rawLine.trim()}`); bad++; continue; }
    if (!charOk) { console.log(`✗ OMIT_OK 登记的字数不对（台账 ${o.chars}/${o.charsNoPunct}，实测 ${o.text.length}/${charsNoPunct(o.text).length}）`); bad++; continue; }
    BASE = BASE.replace(o.text, '');
    console.log(`✓ 申报删除（OMIT_OK）：第 ${o.line} 行「${o.text.slice(0, 6)}…」共 ${o.chars} 字（去标点 ${o.charsNoPunct} 字）—— ${o.why}`);
  }
}
/* ------------------------------------------------ 取出 CxHelp.html */
const src = fs.readFileSync(CJ, 'utf8');
const box = { window: {} };
vm.createContext(box);
try {
  vm.runInContext(src, box, { filename: 'web/js/cxhelp.js' });
} catch (e) {
  console.log('✗ cxhelp.js 执行报错：' + e.message);
  process.exit(1);
}
const CX = box.window.CxHelp;
if (!CX || typeof CX.html !== 'string' || !CX.html) {
  console.log('✗ window.CxHelp.html 没有导出来（或不是字符串）');
  process.exit(1);
}
console.log(`✓ window.CxHelp.html 导出正常（${CX.html.length} 字符）`);
if (typeof CX.sheet !== 'function') { console.log('✗ 缺 window.CxHelp.sheet()（ui.js 一行接线要用它）'); bad++; }

/* ------------------------------------------------ 剥标签，得纯文本 */
function plain(html) {
  return html
    .replace(/<style>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
const OUT = plain(CX.html);

/* 箭头 → 是排版元素，两边都去；数字、字母、汉字、■ 都留下。
   ⚠ 底本用 BASE（已挖掉 OMIT_OK 申报的那一句），不是 ORIG。 */
const A = chars(BASE), B = chars(OUT);

/* LCS 差异（DP，底本两千多字，一次算完够快）：返回 {del:[{at,s}], ins:[{at,s}]}
   at 是**底本**里的位置，便于打上下文。 */
function diff(a, b) {
  const n = a.length, m = b.length, W = m + 1;
  const dp = new Int32Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) {
    const row = i * W, nxt = row + W;
    for (let j = m - 1; j >= 0; j--) {
      dp[row + j] = a[i] === b[j] ? dp[nxt + j + 1] + 1
        : Math.max(dp[nxt + j], dp[row + j + 1]);
    }
  }
  const del = [], ins = [];
  let i = 0, j = 0, dCur = null, iCur = null;
  const flush = () => { if (dCur) del.push(dCur); if (iCur) ins.push(iCur); dCur = iCur = null; };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { flush(); i++; j++; continue; }
    if (j >= m || (i < n && dp[(i + 1) * W + j] >= dp[i * W + j + 1])) {
      if (iCur) { ins.push(iCur); iCur = null; }
      if (!dCur) dCur = { at: i, s: '' };
      dCur.s += a[i]; i++;
    } else {
      if (dCur) { del.push(dCur); dCur = null; }
      if (!iCur) iCur = { at: i, s: '' };
      iCur.s += b[j]; j++;
    }
  }
  flush();
  return { del, ins };
}

/* ------------------------------------------------ ① 逐字对照 */
/* 允许的「加」只有两笔，都是排版结构、不是正文句子（多一个字都算违规）：
   ① 课表表头「天宫 / 地宫 / 人宫 / 天干」—— 列名字面取自原文「三宫象」节，每张课表一份；
   ② 「六亲」「实例」两张卡的卡名 —— 原文这两节没有单独的节名行（六亲那节直接是
      「六亲的含义…」，实例是一堆案），拆成卡片后标题只能这么写，否则认不出是哪一节。 */
const ADD_OK = [
  { s: '天宫地宫人宫天干', n: 7, why: '课表列名（表头）' },
  { s: '六亲', n: 1, why: '「六亲」卡的卡名' },
  { s: '实例', n: 1, why: '「实例」卡的卡名' }
];
{
  const r = diff(A, B);
  const left = ADD_OK.map(o => ({ s: o.s, n: o.n, why: o.why }));
  const badIns = [];
  for (const it of r.ins) {
    let hit = null;
    for (const o of left) if (o.n > 0 && it.s === o.s) { hit = o; break; }
    if (hit) hit.n--; else badIns.push(it);
  }
  const over = left.filter(o => o.n > 0);
  if (!r.del.length && !badIns.length && !over.length) {
    console.log(`✓ 原文逐字对照：底本 ${A.length} 字（已扣掉 OMIT_OK 申报删除部分）与成稿去标点后逐字相同、字序未挪`);
    console.log('    放行的结构性补充：' + ADD_OK.map(o => `「${o.s}」×${o.n}（${o.why}）`).join('；'));
  } else {
    bad++;
    console.log('✗ 原文逐字对照不过');
    const ctx = (s, at) => '…' + s.slice(Math.max(0, at - 14), at) + '【此处】' + s.slice(at, at + 14) + '…';
    for (const it of r.del) console.log(`  · 少了：${JSON.stringify(it.s)}  ${ctx(A, it.at)}`);
    for (const it of badIns) console.log(`  · 多出（未申报）：${JSON.stringify(it.s)}  ${ctx(B, it.at)}`);
    if (over.length) console.log('  · 申报的结构性补充没出现够：' + over.map(o => `「${o.s}」缺 ${o.n} 处`).join(' , '));
  }
}

/* ------------------------------------------------ ⑤ 标点层账（只报告） */
{
  const a = BASE.replace(/\s/g, ''), b = OUT.replace(/\s/g, '');
  const r = diff(a, b);
  const tally = list => {
    const m = new Map();
    for (const it of list) for (const ch of it.s) m.set(ch, (m.get(ch) || 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  };
  const show = ch => (ch === ' ' ? '空格' : ch);
  const d = tally(r.del), i = tally(r.ins);
  console.log(`· 标点层（只报告，不作判据）：底本 ${a.length} 字符 / 成稿 ${b.length} 字符`);
  console.log('    去掉：' + (d.length ? d.map(([c, n]) => `${show(c)}×${n}`).join(' ') : '无'));
  console.log('    新增：' + (i.length ? i.map(([c, n]) => `${show(c)}×${n}`).join(' ') : '无'));
  /* 台账对照：删的只能有这四笔；增的只能是 ADD_OK 那几串里的字 */
  const want = { '：': 23, '—': 22, '，': 9, '。': 3 };
  const expAdd = new Map();
  for (const o of ADD_OK) for (const ch of o.s) expAdd.set(ch, (expAdd.get(ch) || 0) + o.n);
  const dObj = Object.fromEntries(d), iObj = Object.fromEntries(i);
  const same = (x, y) => Object.keys(x).length === Object.keys(y).length
    && Object.keys(x).every(k => x[k] === y[k]);
  if (same(want, dObj) && same(Object.fromEntries(expAdd), iObj)) {
    console.log('    台账对得上：「：」×23＝23 处「标签：」的冒号交给标题（掌诀那处已随节删除）；');
    console.log('              「—」×22＝11 道「——」分隔线；「，」×9＝天干数序枚举的顿号随格子；');
    console.log('              「。」×3＝天干数序那处表格化枚举末句号 + 两个实例标题');
  } else {
    console.log('    ⚠ 标点跟台账对不上了（台账：：23 —22 ，9 。3）—— 改稿后请更新 cxhelp.js 顶部台账');
  }
}

/* ------------------------------------------------ ② 改称检查 */
{
  const left = (CX.html.match(/小六壬/g) || []).length;
  const right = (OUT.match(/串星课/g) || []).length;
  if (left) { console.log(`✗ 还有 ${left} 处「小六壬」没改称串星课`); bad++; }
  else if (right !== 2) { console.log(`✗ 「串星课」应出现 2 次（顺序节、命造节），实际 ${right} 次`); bad++; }
  else console.log('✓ 改称：「小六壬」0 处，「串星课」2 处（顺序节、命造节）');
}

/* ------------------------------------------------ ③ 类名门禁 */
{
  const own = (CX.html.match(/<style>([\s\S]*?)<\/style>/i) || [, ''])[1];
  const css = own + '\n' + fs.readFileSync(path.join(WEB, 'css', 'app.css'), 'utf8')
    + '\n' + fs.readFileSync(path.join(WEB, 'css', 'pan.css'), 'utf8')
    + '\n' + (fs.readFileSync(path.join(WEB, 'index.html'), 'utf8').match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
  const defined = new Set(Array.from(css.matchAll(/\.([A-Za-z][\w-]*)/g), m => m[1]));
  const used = new Set();
  for (const m of CX.html.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c => c && used.add(c));
  const ALLOW = new Set(['on', 'q', 'js', 'hidden']);
  const miss = [...used].filter(c => !ALLOW.has(c) && !defined.has(c));
  if (miss.length) { console.log('✗ 用到了没定义的类名：' + miss.join(' ')); bad++; }
  else console.log(`✓ 类名：用到的 ${used.size} 个全都有定义`);
  const unprefixed = [...used].filter(c => !/^cxd-/.test(c) && !ALLOW.has(c));
  if (unprefixed.length) console.log('  ⚠ 非 cxd- 前缀（会跟 app.css 既有类共用）：' + unprefixed.join(' '));
}

/* ------------------------------------------------ ④ 结构（现为七节，掌诀已去掉） */
{
  const cards = (CX.html.match(/class="cxd-card"/g) || []).length;
  const tables = (CX.html.match(/class="cxd-tb"/g) || []).length;
  const dt = (CX.html.match(/class="cxd-dt"/g) || []).length;
  const sec = CX.sections || [];
  /* 节名与卡片标题一一对应：每个节名都必须是**卡标题本身**，不是正文里出现过就算 */
  const titles = Array.from(CX.html.matchAll(/class="cxd-h">([^<]*)</g), m => m[1]);
  const secHit = sec.length === 7 && sec.every((s, i) => titles[i] === s);
  const noPalm = !/掌诀/.test(CX.html);
  const subOk = (CX.sheet ? CX.sheet() : '').includes('顺序 · 起课 · 天干论 · 六亲 · 实例 · 类象')
    && !(CX.sheet ? /掌诀/.test(CX.sheet()) : true);
  const ok = cards === 7 && tables === 7 && dt === 11 && secHit && noPalm && subOk;
  if (!ok) {
    console.log(`✗ 结构不对：卡片 ${cards}/7、课表 ${tables}/7、类象条 ${dt}/11、`
      + `节名 ${sec.length}/7、节名与卡标题一一对上 ${secHit}、全文无「掌诀」${noPalm}、副标题六项 ${subOk}`);
    console.log('    实得卡标题：' + titles.join(' / '));
    bad++;
  } else console.log('✓ 结构：七张分节卡片（顺序/起课/天干论/六亲/实例/六神类象/六亲类象）、七张课表（起课 1 + 实例 6）、类象 11 条（六神 6 + 六亲 5）');
  console.log(`   节名与卡标题逐一对上；副标题「顺序 · 起课 · 天干论 · 六亲 · 实例 · 类象」；全文已无「掌诀」`);
  const sh = (CX.html.match(/class="cxd-sh"/g) || []).length;
  console.log(`   小节标题 ${sh} 个（原文的「标签：」都落到这里）`);
}

/* ------------------------------------------------ ④′ 弹层整装 */
{
  const s = CX.sheet ? CX.sheet() : '';
  const ok = s.includes('btnXkHelpOk') && /<h2>[\s\S]*<\/h2>/.test(s) && s.includes('class="bar"');
  if (!ok) { console.log('✗ CxHelp.sheet() 不是完整弹层内容（缺 bar / h2 / btnXkHelpOk）'); bad++; }
  else console.log('✓ CxHelp.sheet()：条 + 标题 + 正文 +「知道了」齐全，id 仍是 btnXkHelpOk');
}

console.log(bad ? `\n=== 自检未过：${bad} 项 ===` : '\n=== 自检全过 ===');
process.exit(bad ? 1 : 0);
