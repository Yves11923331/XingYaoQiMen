/* ============================================================================
 * _check_chuanxing.js —— 串星（加干）集成自测（jsdom，跑真 index.html）
 * 跑法：NODE_PATH=/root/dsh-dom/node_modules node 校验/_check_chuanxing.js
 *
 * 查的是"真 App 里点出来的东西"，不是另写一份逻辑对表：
 *   ① 底栏有「串星」，点了能进串星页
 *   ② 选时刻 → 起课 → 进课页
 *   ③ 课页排布 = 上四格（天宫/地宫/人宫/主体）＋ 下三格（六亲）
 *   ④ 已知盘对表：2026-09-02 10:30（阴遁一局 己巳时）
 *      天宫 天蓬(水) 妻财 · 地宫 天英(火) 父母 · 人宫 天任(土) 兄弟 · 主体 己(土)
 *   ⑤ ‹ › 能翻课（课页顶栏那两个键在串星课里翻的是课，不是盘）
 * ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:8766/index.html',
  resources: undefined,
});
const win = dom.window, doc = win.document;

/* 手工把 index.html 里引的脚本按顺序执行（jsdom 默认不加载外链） */
const scripts = [...doc.querySelectorAll('script[src]')].map(s => s.getAttribute('src'))
  .filter(s => !/^https?:/.test(s));
for (const src of scripts) {
  const code = fs.readFileSync(path.join(ROOT, 'web', src.replace(/\?.*$/, '')), 'utf8');
  win.eval(code);
}
/* 引完脚本要触发一次 DOMContentLoaded，应用的初始化挂在它上面 */
win.document.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true }));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  ✗ ' + m)); };
const eq = (a, b, m) => ok(a === b, m + `  期望「${b}」实得「${a}」`);

const $ = id => doc.getElementById(id);
const Q = win.Qimen;
const cells = () => [...doc.querySelectorAll('#cxPopGrid .xcell')].map(c => ({
  lb: (c.querySelector('.lb') || {}).textContent || '',   /* 标签已去掉，取不到属正常 */
  nm: (c.querySelector('.nm') || {}).textContent || '',
  sub: (c.querySelector('.sub') || {}).textContent || '',
}));

/* ⓪ 起盘页：选时刻已挪到"点大时刻"上，「按时刻」改名「此时刻」 */
ok(!$('segNowPick'), '起盘页不应再有「此刻 / 选时刻」分段');
eq($('segMode3').querySelector('button[data-m="time"]').textContent.trim(), '此时刻', '「按时刻」应改名「此时刻」');
ok($('timecard').contains($('dtPick')), '#dtPick 应压在起盘页的时刻卡里');

/* ⓪2 起盘页：点大时刻（#dtPick）→ 顶部时刻跟着走 */
$('dtPick').value = '2026-09-02T10:30';
$('dtPick').dispatchEvent(new win.Event('change', { bubbles: true }));
ok($('homeTime').textContent.indexOf('2026-09-02') >= 0 || $('homeTime').textContent.indexOf('10:30') >= 0,
   '改 #dtPick 后起盘页时刻应跟着走，实得 ' + $('homeTime').textContent);

/* ⓪3 点时刻卡（不是点那层 input）必须显式调起原生选择器。
   2026-10-21 用户报「点时间栏无响应」：原来是 opacity:0 的 input 铺在上面靠原生点击弹，
   vivo / Android 16 的 WebView 下不弹；改后由 .timecard 的 click 调 showPicker()。
   这里打桩 showPicker，点卡必须恰好调一次。 */
let picked = 0;
$('dtPick').showPicker = function () { picked++; };
$('timecard').click();
ok(picked === 1, '点时刻卡应调起原生选择器（showPicker），实得 ' + picked + ' 次');
/* 老 WebView 没有 showPicker 时，必须退回程序化 click（原生选择器照样弹） */
delete $('dtPick').showPicker;
let inpClicked = 0;
$('dtPick').addEventListener('click', function () { inpClicked++; });
$('timecard').click();
ok(inpClicked === 1, '无 showPicker 时应退回 input.click()，实得 ' + inpClicked + ' 次');
/* 串星页的时刻卡同理 */
let cxPicked = 0;
$('cxPick').showPicker = function () { cxPicked++; };
doc.querySelector('#view-chuanxing .timecard').click();
ok(cxPicked === 1, '串星页点时刻卡应调起原生选择器，实得 ' + cxPicked + ' 次');

/* ① 底栏 */
const tabs = [...doc.querySelectorAll('#tabbar button')].map(b => b.textContent.trim());
ok(tabs.length === 3, '底栏应是三格，实得 ' + tabs.length + '：' + tabs.join(' '));
ok(tabs[1] && tabs[1].indexOf('串星') >= 0, '第二格应是「串星」，实得 ' + tabs[1]);

/* ② 点串星进页 */
doc.querySelector('#tabbar button[data-view="chuanxing"]').click();
ok($('view-chuanxing').classList.contains('on'), '点了串星应显示 #view-chuanxing');
ok($('cxTime').textContent !== '—', '串星页时刻卡应有内容，实得 ' + $('cxTime').textContent);
ok($('cxSub').textContent.indexOf('局') > 0, '串星页副行应含局名，实得 ' + $('cxSub').textContent);

/* ③④ 选时刻 → 起课（就地显示在起课页，不跳全屏课页） */
eq([...$('segCxPick').children].map(b => b.textContent.trim()).join('/'), '此刻/随机', '串星页按钮');
ok($('view-chuanxing').contains($('cxPick')), '#cxPick 应压在串星页的时刻卡里（点大时刻即选时刻）');
$('cxPick').value = '2026-09-02T10:30';
$('cxPick').dispatchEvent(new win.Event('change', { bubbles: true }));
ok(!$('cxPop').classList.contains('on'), '点起课前课页弹层不应打开');
$('btnCastX').click();
ok($('view-chuanxing').classList.contains('on'), '起课后应留在串星页（不跳全屏课页）');
ok(!$('view-chart').classList.contains('on'), '起课后不应跳到盘面页');

const cs = cells();
eq(cs.length, 7, '课卡片格数（4 上 + 3 下）');
/* 标签（天宫/地宫/人宫/主体/六亲）已按用户要求全部去掉：课块就是纯文字 */
eq(doc.querySelectorAll('#cxPopGrid .lb').length, 0, '课块里不该再有 .lb 标签');
eq(cs.slice(0, 4).map(c => c.nm).join(','), '天蓬,天英,天任,己', '四个值');
{
  const c = Q.cast(2026, 9, 2, 10, 30, { lateZi: true, ju: 'chaibu' });
  eq(cs[0].nm, c.meta.zhiFuStar, '天宫应等于引擎的值符星');
  eq(cs[1].nm, (function () {                       /* 地宫＝天盘时干宫之九星 */
    const STEM = Q.STEM; let hs = STEM.indexOf(c.calendar.ganzhi.hour.charAt(0));
    if (hs === 1) hs = c.meta.hourLead;
    for (const pl of c.plate) if (pl.heaven === hs || pl.mid === hs) return (pl.star === 5 || pl.star === 2) ? '禽芮' : Q.STAR[pl.star];
    return '';
  })(), '地宫应等于天盘时干宫星');
  eq(cs[2].nm, (function () {                       /* 人宫＝值使宫之九星 */
    for (const pl of c.plate) if (pl.dutyGate) return (pl.star === 5 || pl.star === 2) ? '禽芮' : Q.STAR[pl.star];
    return '';
  })(), '人宫应等于值使宫星');
}
eq(cs.slice(4).map(c => c.nm).join(','), '妻财,父母,兄弟', '三个六亲');

/* ④.5 随机：点「随机」只切模式（2026-10-21 起不抽、不换时间栏）；点「起课」时才抽一局 */
$('segCxPick').querySelector('button[data-mode="rand"]').click();
ok(!/[阴阳]遁[一二三四五六七八九]局/.test($('cxTime').textContent),
   '点「随机」不该替换时间栏（应仍是时刻），实得 ' + $('cxTime').textContent);
ok($('cxPillars').textContent.indexOf('随机') >= 0, '时刻卡第二行应提示随机，实得 ' + $('cxPillars').textContent);
ok(!$('cxPop').classList.contains('on'), '切随机后课页弹层应关闭');
$('btnCastX').click();
eq(cells().length, 7, '随机之后照样能起出一课（七格）');
ok(/随机局：/.test($('cxSub').textContent), '起课后副行应标出随机局，实得 ' + $('cxSub').textContent);
ok($('cxPop').classList.contains('on'), '起课后课页弹层应打开');
console.log('    随机到：' + $('cxSub').textContent + ' → ' + $('cxPopGrid').textContent.replace(/\s+/g, ' ').trim());
/* 关掉弹层，后面的返回键测试才不会被它吃掉 */
$('cxPopBack').click();

/* ⑥ 回归：值符星合写成「禽芮」时，天宫不能空（用户报的"天宫信息丢失"）
   2026-09-26 04:07 是甲寅时、starDuty=5 —— 引擎给的值符星是「禽芮」，它不在 Q.STAR 里 */
$('cxPick').value = '2026-09-26T04:07';
$('cxPick').dispatchEvent(new win.Event('change', { bubbles: true }));
$('btnCastX').click();
const c2 = cells();
eq(c2.length, 7, '禽芮盘也要出七格');
eq(c2[0].nm, '禽芮', '天宫（值符星合写）应为「禽芮」而不是空的');
ok(c2[4].nm && c2[4].nm !== '—', '天宫的六亲也要有值，实得「' + c2[4].nm + '」');
console.log('    禽芮盘：' + c2.map(c => c.nm).join(' '));

/* ⑦ 截图：串星课弹层里的「截图」必须走"课"那条渲染路（把三宫数据交出去），而不是九宫盘
      —— 这里把 Snapshot.shot 换掉只看参数，不用真的出图（jsdom 没有 canvas） */
let shotOpts = null;
win.Snapshot.shot = function (chart, analysis, starMap, msg, face, opts) { shotOpts = opts; };
$('cxPopShot').click();
ok(shotOpts && !!shotOpts.lesson, '起课页截图应带 lesson 数据（否则画出来还是奇门盘）');
ok(shotOpts && shotOpts.lesson && shotOpts.lesson.three && shotOpts.lesson.three.length === 3, 'lesson.three 应是三宫');
console.log('    截图参数：' + (shotOpts && shotOpts.lesson
  ? shotOpts.lesson.three.map(function (x) { return x.starName + '/' + x.qin; }).join(' ') + ' 主体' + shotOpts.lesson.hourStem
  : '无'));
/* ⑦0 中宫：纯白 + 只一个圆环（用户三次反馈"脏"，根因是底色 250,250,252 与光晕） */
{
  const panCss = fs.readFileSync(path.join(ROOT, 'web', 'css', 'pan.css'), 'utf8');
  ok(/--qm-halo:\s*none/.test(panCss), '素白下盘心光晕应为 none（它正压在中宫上）');
  ok(/\.qm-cell\.qm-mid \{\s*background-image:\s*none/.test(panCss), '中宫不应再有晕染 background-image');
  ok(!/\.qm-cell\.qm-mid::before\s*\{[^}]*border-radius: 50%/.test(panCss), '中宫内圈应已去掉（只留一个圆环）');
  const uiJs = fs.readFileSync(path.join(ROOT, 'web', 'js', 'ui.js'), 'utf8');
  ok(/white: '255,255,255'/.test(uiJs), '中宫底色应是纯白 255,255,255（原来是偏蓝的 250,250,252）');
}

/* ⑦1 三种用途各有自己的示意框（设置行里就要看得出形状不同） */
{
  const sh = doc.querySelectorAll('.shapehint .sh');
  eq(sh.length, 2, '设置里应有两种示意框（九宫盘 / 串星课）—— 盘面同显与九宫盘同形同底图，已合并');
  ok(!!doc.querySelector('.shapehint .sh.pan'), '缺九宫盘（竖 1000×1370）的示意框');
  ok(!!doc.querySelector('.shapehint .sh.lesson'), '缺串星课（横 1000×460）的示意框');
  const css = fs.readFileSync(path.join(ROOT, 'web', 'css', 'app.css'), 'utf8');
  ok(/\.sh\.pan em\s*\{[^}]*width: 18px/.test(css) && /\.sh\.lesson em\s*\{[^}]*width: 36px/.test(css),
     '两枚示意框的宽高要按各自真实比例（盘 0.73 / 课 2.17）');
  ok(!/\.sh\.both/.test(css), '盘面同显已并入九宫盘，不该再有 .sh.both 示意框');
}

/* ⑦1b 阴盘：暗干排在盘外一圈（传统排法）—— 盘收一圈让位，宫内不再画暗干 */
{
  ok(!!doc.getElementById('qmRing') && !!doc.getElementById('qmBox'), '盘盒两层 #qmBox / #qmRing 仍在');
  const uiSrc = fs.readFileSync(path.join(ROOT, 'web', 'js', 'ui.js'), 'utf8');
  ok(/function renderRing\(\)/.test(uiSrc) && /renderRing\(\);/.test(uiSrc), 'ui.js 要有 renderRing 并在渲染后调用');
  /* ★ 2026-10-28 用户定版：暗干回到**盘外**（左 4/3/8 · 右 2/7/6 · 上 9 · 下 1），宫内不再画。 */
  ok(/RING_SIDE/.test(uiSrc) && /function paintRing\(\)/.test(uiSrc), '外圈八颗暗干要有定位表 RING_SIDE + paintRing');
  ok(!/class="qm-agan"/.test(uiSrc), '阴盘的暗干不应再画在宫内（.qm-agan 已撤）');
  const panCss2 = fs.readFileSync(path.join(ROOT, 'web', 'css', 'pan.css'), 'utf8');
  /* 2026-11-02 用户改版：暗干从盘外一圈 → **宫内右上角圆章**（.qm-ag-in）；
     空亡/驿马让到宫底（.qm-void 的阴盘覆盖改成 bottom 定位）。断言跟着改。 */
  ok(/\.qm-cell \.qm-ag-in\s*\{/.test(panCss2), '阴盘暗干圆章要有 .qm-cell .qm-ag-in 样式');
  ok(/\[data-sub="yin"\]\s+\.qm-void\s*\{[^}]*bottom/.test(panCss2),
     '阴盘的空亡/驿马要让到宫底（.qm-void 的阴盘覆盖应含 bottom）');
}

/* ⑦2 裁剪页：必须有明确的示意框与形状说明（原来是条几乎看不见的细线） */
ok(!!$('cropShape'), '裁剪页应有形状说明行 #cropShape');
{
  const css = fs.readFileSync(path.join(ROOT, 'web', 'css', 'app.css'), 'utf8');
  ok(/\.crop-stage\s*\{[^}]*rgba\(216,180,95/.test(css), '裁剪框应是描金示意框（原来只有 1px 细白线）');
  ok(/\.crop-shape\s*\{/.test(css), '裁剪页应有 .crop-shape 样式');
  ok(/\.crop-stage\s*\{[\s\S]*?flex:\s*0\s+0\s+auto/.test(css),
     '⚠ .crop-stage 必须 flex: 0 0 auto —— 写成 1 1 auto 的话高度会被 flex 吃掉，三种示意框会长得一样');
}

/* ⑧ 截图渲染背景：选图要先选"给谁用"，截图时按页取对应的那张 */
win.Store.settings.rendImage = 'data:pan';
win.Store.settings.rendImageLesson = 'data:lesson';
$('btnRendPick').click();
ok(!!$('rendForPan') && !!$('rendForLesson'), '点「选图」应先弹「九宫盘 / 串星课」让选');
ok(doc.querySelectorAll('.rendpick .rp').length === 2, '选图弹层里应有两个选项（九宫盘 / 串星课）');
ok(doc.querySelector('.rendpick .rp.pan em') && doc.querySelector('.rendpick .rp.lesson em'),
   '每个选项都要有对应形状的示意框（.pan.em / .lesson.em）');
let fileClicked = false;
$('rendFile').click = function () { fileClicked = true; };
$('rendForLesson').click();
ok(fileClicked, '选了「串星课」之后应去唤起选图');
ok(!$('sheet').classList.contains('on'), '选完应关掉弹层');

win.Snapshot.shot = function (chart, analysis, starMap, msg, face, opts) { shotOpts = opts; };
shotOpts = null; $('cxPopShot').click();                    /* 串星课弹层里的截图 */
ok(shotOpts && shotOpts.rendImage === 'data:lesson', '起课页截图应取「串星课」那张底图，实得 ' + (shotOpts && shotOpts.rendImage));
doc.querySelector('#tabbar button[data-view="home"]').click();  /* 回起盘页 */
$('btnCast').click();                                       /* 进盘面页 */
shotOpts = null; $('btnShot').click();
ok(shotOpts && shotOpts.rendImage === 'data:pan', '盘面页截图应取「奇门盘」那张底图，实得 ' + (shotOpts && shotOpts.rendImage));
ok(shotOpts && !shotOpts.lesson, '盘面页截图不应带 lesson 数据');
$('btnBack').click();

/* ⑧3 第三种出图：盘面同显 —— 形状跟奇门盘一样，但内容要带三宫数据、底图取"盘面同显"那张 */
win.Store.settings.panLesson = true;
$('btnCast').click();
ok(doc.querySelector('#xkMini') && doc.querySelector('#xkMini').style.display !== 'none',
   '开了盘面同显，盘面页上方应摆出串星课');
shotOpts = null; $('btnShot').click();
ok(shotOpts && shotOpts.rendImage === 'data:pan',
   '盘面同显截图应与九宫盘共用那张底图，实得 ' + (shotOpts && shotOpts.rendImage));
ok(shotOpts && shotOpts.both === true, '盘面同显截图要打上 both 标记（走 renderBoth）');
ok(shotOpts && shotOpts.lesson && shotOpts.lesson.three && shotOpts.lesson.three.length === 3,
   '盘面同显截图要带上三宫数据');
win.Store.settings.panLesson = false;
$('btnBack').click();

/* ⑨ 手机返回键：起课页按返回应直接回起盘页（不再经过全屏课页） */
doc.querySelector('#tabbar button[data-view="chuanxing"]').click();   /* 先切到起课页 */
$('cxPick').value = '2026-09-02T10:30';
$('cxPick').dispatchEvent(new win.Event('change', { bubbles: true }));
$('btnCastX').click();
ok($('cxPop').classList.contains('on'), '起课后应弹出课页弹层');
ok($('view-chuanxing').classList.contains('on'), '先确保在起课页');
ok(win.xyqimenBack() === true, '弹层开着时返回键先关弹层（true = 别退出 App）');
ok(!$('cxPop').classList.contains('on'), '第一次返回应关掉课页弹层');
ok(win.xyqimenBack() === true, '返回键应被吃掉（true = 别退出 App）');
ok($('view-home').classList.contains('on'), '起课页的返回键应直接回起盘页');

/* ⑩ 排法 ·「盘面同显串星课」：开着时盘面页里应多出一段迷你课（七格），关着时它隐藏 */
$('btnCast').click();                                  /* 先起一张盘 */
ok($('panHost').children.length > 0, '盘面页应先建好九宫盘');
ok($('xkMini').style.display === 'none' || $('xkMini').style.display === '',
   '默认关着时 #xkMini 应隐藏，实得 ' + JSON.stringify($('xkMini').style.display));
eq($('segPanLesson').children.length, 2, '排法里应有「只盘 / 加串星课」两个按钮');
$('segPanLesson').querySelector('button[data-v="1"]').click();
ok($('xkMini').style.display !== 'none', '开启后 #xkMini 应显示');
eq($('xkMiniGrid').querySelectorAll('.xcell').length, 7, '迷你课也应是七格');
ok($('panHost').children.length > 0, '同时九宫盘仍要在（往下挤）');
console.log('    盘面同显：' + $('xkMiniGrid').textContent.replace(/\s+/g, ' ').trim()
  + '　盘仍在=' + ($('panHost').children.length > 0));
$('segPanLesson').querySelector('button[data-v="0"]').click();
ok($('xkMini').style.display === 'none', '关掉后 #xkMini 应隐藏');

/* ⑪ 阴盘：走「设置 → 定局 → 定局法 → 阴盘」（2026-11-02 用户把阴盘从起盘页的
      「起局方式」升级成定局法的第三档），盘外八颗暗干 + 详情给出农历/节气与「数字定局」
      （⚠ 阴盘是合成盘，曾借 manual:true 渲染 → 被当"自选局"把农历节气藏了、定局写成"手动指定"） */
$('segMode3').querySelector('button[data-m="time"]').click();
$('segJu').querySelector('button[data-v="yin"]').click();
$('btnCast').click();
ok($('tbTitle').textContent.replace(/\s+/g, '') === '阴盘',
   '阴盘模式抬头应为「阴盘」，实得 ' + $('tbTitle').textContent);
/* ★ 2026-10-28 定版：阴盘**盘面收一圈**（.has-ring），暗干排在盘外八格边上；
   宫内回到普通排法，不再有 .qm-agan；星曜仍不排（用户单独要求）。 */
eq(doc.querySelectorAll('#qm_text_pan .qm-ag-in').length, 8, '阴盘应在宫内右上角画 8 颗暗干圆章（.qm-ag-in）');
ok($('qmBox').className.indexOf('has-ring') < 0, '暗干进宫后盘面不再收小（#qmBox 不应带 has-ring）');
eq(doc.querySelectorAll('#qm_text_pan .qm-agan').length, 0, '宫内不该有旧的 .qm-agan 章');
eq(doc.querySelectorAll('#qm_text_pan .qm-stars').length, 0, '阴盘不排星曜');

/* 这一组行在**顶部「更多信息」折叠面板**里（#qdrop），不是宫位详情 */
const xpTxt = [...doc.querySelectorAll('#qdrop .r')].map(r => r.textContent).join(' | ');
ok(/农历/.test(xpTxt), '阴盘详情应有「农历」行（数字定局吃农历月日，不能藏）');
ok(/节气/.test(xpTxt), '阴盘详情应有「节气」行');
ok(/数字定局/.test(xpTxt), '阴盘定局行应写「数字定局」');
ok(!/手动指定/.test(xpTxt), '阴盘不该被写成「手动指定」');
console.log('    阴盘详情：' + xpTxt.replace(/\s+/g, ' ').slice(0, 84));

console.log(`\n串星集成自测：${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
