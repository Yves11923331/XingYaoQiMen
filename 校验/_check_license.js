/* ============================================================================
 * _check_license.js —— 「开源声明」与许可随包分发的门禁
 * ----------------------------------------------------------------------------
 * 跑法：NODE_PATH=/root/dsh-dom/node_modules node 校验/_check_license.js
 *      （要 jsdom：得真开 index.html、真点「关于」，读渲染出来的弹层内容）
 *
 * 口径（**2026-11-13 用户新指示：「开源声明，仅保留必要的即可」**）：
 *   · UI（「关于」弹层）**只声明字体一条**：QM Serif（Noto Serif CJK SC 子集）· SIL OFL 1.1，
 *     并给「许可全文」入口。qimen-dunjia / bigfishmarquis-qimen 两行、
 *     「数据与规则参照」整段、mQimen、「其余全部自研」那些行都已删除，且**不许再搬回来**（L1 反向守护）。
 *     为什么只留这一条：字体文件是我们**随包分发**的，OFL 要求随附许可证；其余三份是
 *     事实性数据 / 规则口径对齐，没复制代码 —— 判定说明见 web/licenses/THIRD-PARTY.md。
 *   · 书面凭据 **保留**：web/licenses/ 四个文件（LICENSE / OFL-1.1.txt / THIRD-PARTY.md / licenses.js）
 *     仍随包分发。THIRD-PARTY.md 不进 UI，但它是"为什么只声明字体"的依据，必须留。
 *
 * 判据：
 *   L1 「关于」里：必须有 开源声明 / SIL OFL 1.1 / Noto Serif CJK SC（+ QM Serif）；
 *      **不得**再出现 iztro / qimen-dunjia / bigfishmarquis-qimen / 数据与规则参照 / mQimen /
 *      「全部自研」这类旧段落字样
 *   L2 「许可全文」入口只有一枚（字体那条），点开能读到 OFL 正文
 *   L3 window.LICENSES.ofl 非空且含 'SIL OPEN FONT LICENSE'；不再有别的全文键
 *   L4 web/licenses/ 上面四个文件都在且各 > 200 字节；
 *      OFL-1.1.txt 与 licenses.js 内联那份**逐字相同**
 *   L5 THIRD-PARTY.md 里四条判定与法律依据关键词仍在（书面凭据，不进 UI）
 *   L6 app/build_xingyao.py 有 check_licenses() 且在复制 web/ 之前调用；
 *      且**本门禁自己挂在第 0 步的清单里**（防止哪天被悄悄摘下来）
 *   L7 版本号那一行的写法没被破坏（打包脚本的替换锚点）
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  ✗ ' + m)); };
const eq = (a, b, m) => ok(String(a) === String(b), m + `  期望「${b}」实得「${a}」`);
const has = (hay, needle, m) => ok(String(hay).indexOf(needle) >= 0, m + `（找不到「${needle}」）`);
const hasNot = (hay, needle, m) => ok(String(hay).indexOf(needle) < 0, m + `（不该出现「${needle}」）`);

/* ---------------------------------------------------------------- 起 jsdom */
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:8799/index.html'
});
const win = dom.window, doc = win.document;
const scripts = [...doc.querySelectorAll('script[src]')].map(s => s.getAttribute('src'))
  .filter(s => !/^https?:/.test(s));
for (const src of scripts) {
  win.eval(fs.readFileSync(path.join(WEB, src.replace(/\?.*$/, '')), 'utf8'));
}
const $ = id => doc.getElementById(id);

setTimeout(() => {
  /* ============================================================ L1 */
  console.log('\n== L1 「关于」只声明字体一条 ==');
  ok(!!$('btnAbout'), '顶栏应有「关于」键');
  $('btnAbout').click();                       /* 真点 */
  ok($('sheet').classList.contains('on'), '点了「关于」应弹出底部弹层');
  const aboutText = $('sheet').textContent;
  /* 正向：必需的三个字样（外加字体族名，免得只写 OFL 却没说字体是谁） */
  ['开源声明', 'SIL OFL 1.1', 'Noto Serif CJK SC'].forEach(k => {
    has(aboutText, k, '「关于」弹层应含「' + k + '」');
  });
  has(aboutText, 'QM Serif', '「关于」弹层应写明随包分发的字体族 QM Serif');
  has(aboutText, '许可全文', '字体那条应带「许可全文」入口');
  has(aboutText, '本应用 © 2026 魔门 · MIT', '末尾应有「本应用 © 2026 魔门 · MIT」');
  /* 反向守护（2026-11-13 用户：仅保留必要的）：三份参照与旧段落不许再搬回来。
     与 L2/L4 同一性质 —— 删掉的东西要有判据钉住，不然下次很容易又被贴回来。 */
  ['iztro', 'qimen-dunjia', 'bigfishmarquis-qimen'].forEach(k => {
    hasNot(aboutText, k, '「关于」里不许再出现「' + k + '」（用户已裁定只声明字体）');
  });
  ['数据与规则参照', 'mQimen', '全部自研', '非第三方'].forEach(k => {
    hasNot(aboutText, k, '「关于」里不许再出现旧段落的「' + k + '」');
  });

  /* ============================================================ L2 */
  console.log('\n== L2 只有字体给「许可全文」入口 ==');
  const licBtns = [...doc.querySelectorAll('#sheet [data-lic]')];
  eq(licBtns.length, 1, '「关于」里应只有 1 枚「许可全文」入口（字体那条）');
  if (licBtns.length) {
    eq(licBtns[0].getAttribute('data-lic'), 'ofl', '那枚入口应指向 ofl');
    eq((licBtns[0].textContent || '').trim(), '许可全文', '入口文字应是「许可全文」');
  }
  ['iztro', 'qimenDunjia', 'bigfish'].forEach(k => {
    eq([...doc.querySelectorAll('#sheet [data-lic="' + k + '"]')].length, 0,
      '「' + k + '」不该有许可全文入口（连名字都不该出现）');
  });

  /* ============================================================ L3 */
  console.log('\n== L3 window.LICENSES：只有 OFL 全文 ==');
  const L = win.LICENSES;
  ok(!!L, 'index.html 应加载 web/licenses/licenses.js（window.LICENSES 存在）');
  ok(!!L && typeof L.ofl === 'string' && L.ofl.length > 1000, 'window.LICENSES.ofl 应是较长的全文（>1000 字节）');
  has(L ? L.ofl : '', 'SIL OPEN FONT LICENSE', 'OFL 全文里应有「SIL OPEN FONT LICENSE」');
  has(L ? L.ofl : '', 'Reserved Font Name', 'OFL 全文里应有保留名字样');
  ['iztro', 'qimenDunjia', 'bigfish', 'project'].forEach(k => {
    eq(L && L[k], undefined, 'window.LICENSES 不该再内联「' + k + '」全文（用户已裁定不需要）');
  });
  has(L ? (L.title || {}).ofl : '', 'SIL OFL 1.1', 'LICENSES.title.ofl 应写着「SIL OFL 1.1」');

  /* 点开「许可全文」→ 二级弹层能读到正文 */
  if (licBtns.length) {
    licBtns[0].click();
    const licSheet = $('sheet').textContent;
    has(licSheet, 'SIL OPEN FONT LICENSE', '点「许可全文」后应能读到 OFL 正文');
    ok(!!$('sheet').querySelector('div[style*="pre-wrap"]'), '全文应是 pre-wrap 的纯文本块');
    has(licSheet, '许可全文', '二级弹层标题应含「许可全文」');
    if ($('btnLicOk')) { $('btnLicOk').click(); } else { ok(false, '二级弹层应有「知道了」'); }
  }

  /* ============================================================ L4 */
  console.log('\n== L4 随包四个文件与内联内容逐字一致 ==');
  const DIR = path.join(WEB, 'licenses');
  /* 书面凭据四件套：本应用 LICENSE、OFL 正文、判定说明、内联全文（index.html 引的就是它） */
  const FOUR = ['LICENSE', 'OFL-1.1.txt', 'THIRD-PARTY.md', 'licenses.js'];
  FOUR.forEach(f => {
    const p = path.join(DIR, f);
    const n = fs.existsSync(p) ? fs.readFileSync(p).length : -1;
    ok(n > 200, `web/licenses/${f} 应存在且 > 200 字节（实得 ${n < 0 ? '不存在' : n + ' 字节'}）`);
  });
  const oflDisk = fs.existsSync(path.join(DIR, 'OFL-1.1.txt'))
    ? fs.readFileSync(path.join(DIR, 'OFL-1.1.txt'), 'utf8') : '';
  eq(oflDisk, L ? L.ofl : '', 'licenses.js 内联的 OFL 应与 OFL-1.1.txt 逐字相同（改正文请重跑 校验/_gen-license-js.js）');
  /* 三份 MIT 全文文件是用户裁定删掉的 —— 不许以"文件又回来了"的方式复活。
     ⚠ 阴盘的 MIT 全文是另一回事：yinpan.js 是**代码移植**，MIT 要求随副本附带，
     所以 MIT-daojiayinpan.txt 必须在包内（2026-11-14 补）。 */
  ['iztro-MIT.txt', 'qimen-dunjia-MIT.txt', 'bigfishmarquis-qimen-MIT.txt'].forEach(f => {
    ok(!fs.existsSync(path.join(DIR, f)), f + ' 应已删除（用户裁定只声明字体，MIT 不再随包）');
  });
  ok(fs.existsSync(path.join(DIR, 'MIT-daojiayinpan.txt')) &&
     fs.readFileSync(path.join(DIR, 'MIT-daojiayinpan.txt')).length > 500,
     'MIT-daojiayinpan.txt 应随包（阴盘引擎是代码移植，MIT 要求附带版权与许可声明）');

  /* ============================================================ L5 */
  console.log('\n== L5 THIRD-PARTY.md 仍是判定说明（书面凭据，不进 UI） ==');
  const mdPath = path.join(DIR, 'THIRD-PARTY.md');
  const md = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
  ok(md.length > 500, 'THIRD-PARTY.md 应存在且够长（实得 ' + md.length + ' 字节）');
  ['必须声明', 'daojiayinpan', 'qimen-dunjia', 'bigfishmarquis-qimen', 'SIL OFL 1.1'].forEach(k => {
    has(md, k, 'THIRD-PARTY.md 应含「' + k + '」（四条判定仍在）');
  });
  ['思想', '公有领域', 'MIT'].forEach(k => {
    has(md, k, 'THIRD-PARTY.md 应写明法律依据关键词「' + k + '」');
  });

  /* ============================================================ L6 */
  console.log('\n== L6 打包脚本会拦住「licenses 缺失」，且本门禁挂着 ==');
  const build = fs.readFileSync(path.join(ROOT, 'app', 'build_xingyao.py'), 'utf8');
  has(build, 'check_licenses', 'build_xingyao.py 应有 check_licenses()');
  ok(/check_licenses\(\)\s*\n/.test(build) || /def check_licenses/.test(build), 'check_licenses 应被定义并调用');
  has(build, 'web/licenses', 'build_xingyao.py 里应点名 web/licenses');
  /* 调用位置必须在 stage_www（复制 web/）之前 */
  const callIdx = build.indexOf('check_licenses()', build.indexOf('def check_licenses'));
  const stageIdx = build.indexOf('stage_www(');
  ok(callIdx > 0 && stageIdx > callIdx, 'check_licenses() 的调用应早于 stage_www()（复制 web/ 之前）');
  /* 本门禁自己也要挂进第 0 步：不然这道门禁等于没门（t18 修的就是这个） */
  has(build, "'_check_license.js'", 'L6c _check_license.js 应挂在 build_xingyao.py 第 0 步的门禁清单里');

  /* ============================================================ L7 */
  console.log('\n== L7 版本号锚点没被破坏 ==');
  const ui = fs.readFileSync(path.join(WEB, 'js', 'ui.js'), 'utf8');
  ok(/<div class="sub">版本 [0-9.]+<\/div>/.test(ui),
     '「版本 x.y.z」那一行必须保持 <div class="sub">版本 …</div>（打包脚本的替换锚点）');

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
}, 120);
