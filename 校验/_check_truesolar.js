/* ============================================================================
 * _check_truesolar.js —— 统一时间选择器 + 真太阳时回归（jsdom，跑真 index.html）
 * 跑法：NODE_PATH=/root/dsh-dom/node_modules node 校验/_check_truesolar.js
 *
 * 查的是「统一控件之后会不会排出错误的盘」：
 *   ① 四层时间统一：日家取日期、月家算节气月、年家按立春换年；
 *   ② 真太阳时：北京时间偏移应为分钟级（不是 8 小时），且能跨时辰；
 *   ③ 经度 0 是合法值，不能被 || 116.4 兜底；
 *   ④ 改观测点经度后，首页预览要跟着刷新；
 *   ⑤ 节气/立春仍按标准时判定（真太阳时开关不改变交节结果）。
 * ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true,
  url: 'http://127.0.0.1:8766/index.html', resources: undefined
});
const win = dom.window, doc = win.document;
const scripts = [...doc.querySelectorAll('script[src]')].map(s => s.getAttribute('src'))
  .filter(s => !/^https?:/.test(s));
for (const src of scripts) {
  win.eval(fs.readFileSync(path.join(ROOT, 'web', src.replace(/\?.*$/, '')), 'utf8'));
}
win.document.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true }));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  ✗ ' + m)); };
const $ = id => doc.getElementById(id);
const S = win.Store;

S.settings.layersOn = true;
S.saveSettings();

function setTime(str) {
  const e = $('dtPick');
  e.value = str;
  e.dispatchEvent(new win.Event('change', { bubbles: true }));
}
function setLayer(l) {
  doc.querySelector(`#segLayer button[data-l="${l}"]`).click();
}
function read() {
  return { t: $('homeTime').textContent, p: $('homePillars').textContent, s: $('homeSub').textContent };
}

/* ① 四层统一时间 */
setTime('2026-10-21T12:00'); setLayer('ri');
ok(/日家/.test(read().p), '日家应显示日家日柱，实得 ' + read().p);
setLayer('yue');
ok(/节气月：九月（寒露后）/.test(read().p), '10-21 月家应为九月（寒露后），实得 ' + read().p);
setLayer('nian');
ok(/立春年：2026/.test(read().p), '10-21 年家立春年应为 2026，实得 ' + read().p);

/* 交节边界 */
setTime('2026-10-08T12:00'); setLayer('yue');
ok(/八月/.test(read().p), '寒露当天 12:00 应仍在八月，实得 ' + read().p);
setTime('2026-10-09T12:00');
ok(/九月/.test(read().p), '寒露次日应为九月，实得 ' + read().p);
/* 立春边界 */
setTime('2026-02-03T12:00'); setLayer('nian');
ok(/立春年：2025/.test(read().p), '立春前应是 2025，实得 ' + read().p);
setTime('2026-02-04T12:00');
ok(/立春年：2026/.test(read().p), '立春后应是 2026，实得 ' + read().p);

/* ② 真太阳时：北京时间偏移分钟级，且能跨时辰 */
S.settings.trueSolar = false; S.settings.lon = 116.4224; S.saveSettings();
setTime('2026-10-21T00:59'); setLayer('shi');
const before = read();
S.settings.trueSolar = true; S.saveSettings();
setTime('2026-10-21T00:59');
const after = read();
ok(/壬子时/.test(before.p), '标准时 00:59 应是壬子时，实得 ' + before.p);
ok(/癸丑时/.test(after.p), '真太阳时 00:59→01:00 应跨到癸丑时，实得 ' + after.p);
const mm = t => { const m = t.match(/(\d{2}):(\d{2})/); return +m[1] * 60 + +m[2]; };
const diff = mm(after.t) - mm(before.t);
ok(Math.abs(diff) < 60, '北京真太阳时偏移应是分钟级，实得 ' + diff + ' 分钟');

/* ③ 经度 0 不能被兜底成 116.4 */
S.settings.trueSolar = true; S.settings.lon = 0; S.saveSettings();
setTime('2026-10-21T12:00');
const lon0 = read();
ok(mm(lon0.t) < 6 * 60, '经度 0 的真太阳时应比北京时间早约 8 小时，实得 ' + lon0.t);

/* ④ 改观测点经度后首页刷新 */
S.settings.lon = 116.4224; S.saveSettings(); setTime('2026-10-21T12:00');
const a = read();
$('inpLon').value = '135';
$('inpLon').dispatchEvent(new win.Event('change', { bubbles: true }));
const c = read();
ok(a.t !== c.t, '改经度后首页时间应刷新：' + a.t + ' → ' + c.t);

/* ⑤ 真太阳时不改交节判定 */
S.settings.lon = 116.4224; S.saveSettings();
setTime('2026-10-08T12:00'); setLayer('yue');
S.settings.trueSolar = false; S.saveSettings(); setTime('2026-10-08T12:00');
const m0 = read().p;
S.settings.trueSolar = true; S.saveSettings(); setTime('2026-10-08T12:00');
const m1 = read().p;
ok(m0.replace(/^.*?　/, '') === m1.replace(/^.*?　/, ''),
   '真太阳时不该改变节气月：' + m0 + ' / ' + m1);

/* ⑥ 月家翻月：交节在晚上时也要进入目标月（写回目标月起点次日） */
setLayer('yue'); setTime('2026-02-04T12:00');
const y0 = read();
S.settings.trueSolar = false; S.saveSettings();
$('btnCast').click();
$('btnNext').click();
$('btnBack').click();
const y1 = read();
ok(/二月（惊蛰后）/.test(y1.p), '正月按「下一月」应进入二月（惊蛰后），实得 ' + y1.p);

console.log('\n真太阳时 + 统一时间回归：' + pass + ' 过 / ' + fail + ' 败');
process.exit(fail ? 1 : 0);
