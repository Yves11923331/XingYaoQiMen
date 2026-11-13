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

/* ⑦1b 阴盘：用户选定标准主体 + 暗干坐星曜（政余）那一行。 */
{
  ok(!!doc.getElementById('qmBox'), '保留盘盒 #qmBox');
  ok(!doc.getElementById('qmRing'), '盘外那圈 #qmRing 已删除（孤儿节点）');
  const uiSrc = fs.readFileSync(path.join(ROOT, 'web', 'js', 'ui.js'), 'utf8');
  const panCss2 = fs.readFileSync(path.join(ROOT, 'web', 'css', 'pan.css'), 'utf8');
  ok(!/function (renderRing|paintRing)\s*\(|var RING_W\s*=|classList\.(contains|add|remove)\('has-ring'\)/.test(uiSrc),
     '外圈那套死代码已清干净（renderRing/paintRing/RING_W/has-ring）');
  ok(!/\.qm-box\.has-ring\s*\{|\.qm-ring\s*\{|\.qm-rg\s*\{/.test(panCss2), 'CSS 里外圈残留已清（has-ring/.qm-ring/.qm-rg）');
  ok(!/c\.yinpan \? '○'/.test(uiSrc), '阴盘空亡/驿马改用标准盘印章，不再走紧凑分支');
  ok(!/function yinCellHTML/.test(uiSrc), '阴盘复用标准 cellHTML，不另画三行');
  ok(/qm-yin-agan/.test(uiSrc), '暗干完整串排在宫内');
  ok(/\.qm-yin-agan\s*\{/.test(panCss2), '暗干有专用样式');
  /* 2026-11-12 用户定：暗干占星曜（政余）那行的槽位——左下角 left:5 / bottom:4，不再居中。 */
  const aganCss = (panCss2.match(/\.qm-text-pan\[data-sub="yin"\] \.qm-yin-agan\s*\{[^}]*\}/) || [''])[0];
  ok(/left:\s*9px/.test(aganCss) && /bottom:\s*4px/.test(aganCss), '暗干贴宫卡左下角（B1：内缩 4px，与 .qm-stars 同槽位）');
  ok(!/justify-content:\s*center|text-align:\s*center/.test(aganCss), '暗干不居中（旧落款版式已废）');
  ok(/font-size:\s*\.9em/.test(aganCss), '暗干字号 .9em（比政余 .74em 大一档）');
  /* 2026-11-12 用户定 B：字前一枚墨点（句读起笔），点压 .5 透明、2.6px。 */
  const dotCss = (panCss2.match(/\.qm-text-pan\[data-sub="yin"\] \.qm-yin-agan::before\s*\{[^}]*\}/) || [''])[0];
  ok(/width:\s*2\.6px/.test(dotCss) && /border-radius:\s*50%/.test(dotCss), '暗干前缀墨点（2.6px 圆点）');
  ok(/opacity:\s*\.5/.test(dotCss) && /margin-right:\s*5px/.test(dotCss), '墨点压 50% + 与字距 5px');
  ok(!/\.qm-yin3/.test(panCss2), '撤去独立三行样式');
  ok(/white-space: nowrap/.test(panCss2), '暗干完整串不折行');
  ok(!/\.qm-cell \.qm-ag-in\s*\{/.test(panCss2), '不用旧暗干方章');
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
/* 真实DOM验证：标准主体、八颗完整暗干、紧凑空马。 */
eq(doc.querySelectorAll('.qm-rg, .qm-ring').length, 0, '阴盘不画盘外暗干');
ok(!$('qmBox').classList.contains('has-ring'), '盘盒不再挂 has-ring（外圈让位已撤）');
eq(doc.querySelectorAll('#qm_text_pan .qm-yin-agan').length, 8, '八宫均保留暗干');
eq(doc.querySelectorAll('#qm_text_pan .qm-stars').length, 0, '阴盘不排星曜');
ok(doc.querySelectorAll('#qm_text_pan .qm-line').length >= 16, '阴盘使用标准星门行');
ok([...doc.querySelectorAll('#qm_text_pan .qm-seal-void')].every(x => x.textContent === '空亡'), '空亡用标准盘印章（空亡二字）');
eq(doc.querySelectorAll('#qm_text_pan .qm-seal-horse').length, 1, '马星完整保留（标准盘驿马印章）');
const yinRaw = win.App.state.chart.plate;
for (const p of yinRaw.filter(x => x.agan)) {
  const el = doc.querySelector('#qm_text_pan [data-pal="' + p.pal + '"] .qm-yin-agan');
  eq(el.textContent, win.Qimen.STEM[p.agan] + (p.agan2 ? '（' + win.Qimen.STEM[p.agan2] + '）' : ''), '暗干及随行字完整：' + p.pal);
}

/* 这一组行在**顶部「更多信息」折叠面板**里（#qdrop），不是宫位详情 */
const xpTxt = [...doc.querySelectorAll('#qdrop .r')].map(r => r.textContent).join(' | ');
ok(/农历/.test(xpTxt), '阴盘详情应有「农历」行（数字定局吃农历月日，不能藏）');
ok(/节气/.test(xpTxt), '阴盘详情应有「节气」行');
ok(/数字定局/.test(xpTxt), '阴盘定局行应写「数字定局」');
ok(!/手动指定/.test(xpTxt), '阴盘不该被写成「手动指定」');
console.log('    阴盘详情：' + xpTxt.replace(/\s+/g, ' ').slice(0, 84));

/* ⑦1d 阴盘专属配色（2026-11-13 用户选 P2「鲜而不淡」） */
{
  const panCss4 = fs.readFileSync(path.join(ROOT, 'web', 'css', 'pan.css'), 'utf8');
  const pal = (panCss4.match(/html\[data-theme\] \.qm-text-pan\[data-sub="yin"\]\s*\{[\s\S]*?\}/) || [''])[0];
  ok(!!pal, '阴盘配色块存在（html[data-theme] .qm-text-pan[data-sub="yin"]）');
  ok(/--qm-el-wood:\s*#0a9a63/.test(pal) && /--qm-el-fire:\s*#dc2a18/.test(pal) && /--qm-el-water:\s*#0f5cbf/.test(pal),
     'P2 五行色：木 #0a9a63 / 火 #dc2a18 / 水 #0f5cbf');
  ok(/--qm-tian-9:\s*#dc2a18/.test(pal) && /--qm-men-1:\s*#0f5cbf/.test(pal), 'P2 星门九色跟上五行');
  ok(!/--qm-ink-soft/.test(pal), '暗干（--qm-ink-soft）不参与阴盘上色');
  ok(/data-sub="yin"/.test(pal) && !/html\[data-theme\] \.qm-text-pan\s*\{/.test(pal), '配色只挂阴盘，不泄漏到标准盘');
}

/* ⑦1c 插件 · 虚实法（2026-11-12）：四柱地支 ∩ 宫位纳支 */
{
  const PZ = { 1: ['子'], 8: ['丑', '寅'], 3: ['卯'], 4: ['辰', '巳'], 9: ['午'], 2: ['未', '申'], 7: ['酉'], 6: ['戌', '亥'] };
  ok(!!(win.Plugins && win.Plugins.byId('xushi')), '虚实法插件已注册');
  const panCss3 = fs.readFileSync(path.join(ROOT, 'web', 'css', 'pan.css'), 'utf8');
  ok(/\.qm-cell\.qm-xs-shi\s*\{[^}]*66%/.test(panCss3) && /\.qm-cell\.qm-xs-xu\s*\{[^}]*15%/.test(panCss3),
     '虚实法两档边框色（实 66% / 虚 15%）');
  win.Store.settings.plugins = win.Store.settings.plugins || {};
  win.Store.settings.plugins.xushi = 0; win.Store.saveSettings();
  $('segJu').querySelector('button[data-v="chaibu"]').click();
  $('btnCast').click();
  eq(doc.querySelectorAll('#qm_text_pan .qm-xs-shi, #qm_text_pan .qm-xs-xu').length, 0, '插件关着时宫卡不挂虚实类');
  win.Store.settings.plugins.xushi = 1; win.Store.saveSettings();
  $('btnCast').click();
  const cc = win.App.state.chart, gz = cc.calendar.ganzhi;
  const bs = [gz.year[1], gz.month[1], gz.day[1], gz.hour[1]];
  const want = Object.keys(PZ).filter(k => PZ[k].some(z => bs.indexOf(z) >= 0)).map(Number).sort();
  const got = [...doc.querySelectorAll('#qm_text_pan .qm-xs-shi')].map(e => +e.dataset.pal).sort();
  eq(JSON.stringify(got), JSON.stringify(want), '实宫 = 四柱地支命中的宫：' + bs.join(''));
  ok(doc.querySelector('.qm-cell[data-pal="5"]').classList.contains('qm-xs-xu'), '中五不纳支，恒为虚');
  eq(doc.querySelectorAll('#qm_text_pan .qm-xs-xu').length, 8 - want.length + 1, '虚宫 = 其余八宫 + 中五');
  $('segJu').querySelector('button[data-v="yin"]').click();
  $('btnCast').click();
  eq(doc.querySelectorAll('#qm_text_pan .qm-xs-shi, #qm_text_pan .qm-xs-xu').length, 0, '阴盘不挂虚实类（blockInYin）');
  win.Store.settings.plugins.xushi = 0; win.Store.saveSettings();
  $('segJu').querySelector('button[data-v="chaibu"]').click();
  $('btnCast').click();
}

console.log(`\n串星集成自测：${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
