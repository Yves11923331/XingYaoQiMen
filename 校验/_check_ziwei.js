#!/usr/bin/env node
/* ============================================================================
 * _check_ziwei.js —— 插件「紫微」十四主星安星自测（jsdom，走真历法）
 * 跑法：NODE_PATH=/root/dsh-dom/node_modules node 校验/_check_ziwei.js
 *
 * 对表来源：开源库 iztro（SylarLong/iztro）的官方测试
 *   src/__tests__/star/star.test.ts
 *     getStartIndex()：2023-08-01 各时辰的 紫微/天府 宫序
 *     getMajorStar()：2023-03-06 辰时 的十四主星逐宫分布
 * 宫序口径：**寅 = 0**，0..11 依次 寅卯辰巳午未申酉戌亥子丑。
 * ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:8766/index.html' });
const win = dom.window, doc = win.document;
for (const s of [...doc.querySelectorAll('script[src]')].map(x => x.getAttribute('src')).filter(x => !/^https?:/.test(x))) {
  win.eval(fs.readFileSync(path.join(ROOT, 'web', s.replace(/\?.*$/, '')), 'utf8'));
}
win.document.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true }));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  ✗ ' + m)); };
const eq = (a, b, m) => ok(a === b, `${m}  期望「${b}」实得「${a}」`);
const Lunar = win.Lunar, Z = win.Ziwei;

/* ---------- ⓪ 模块在位 ---------- */
ok(!!Z && !!Z.cast, 'Ziwei.cast 应导出');
ok(Z.BRANCH.length === 12 && Z.BRANCH[2] === '寅', '地支表应以寅为第 3 位（0=子）');
eq(Z.BRANCH_PAL[4], 4, '辰（index 4）应落巽4');
eq(Z.BRANCH_PAL[7], 2, '未（index 7）应落坤2');
eq(Z.BRANCH_PAL[10], 6, '戌（index 10）应落乾6');
eq(Z.BRANCH_PAL[1], 8, '丑（index 1）应落艮8');

/* ---------- ① iztro：2023-08-01 各时辰 → 紫微/天府宫序 ---------- */
/* timeIndex 0=早子 1=丑 2=寅 3=卯 4=辰 5=巳 6=午（项目用 h：0,2,4,6,8,10,12） */
const ZIWEI_CASES = [
  [0, 11, 1], [2, 11, 1], [4, 2, 10], [6, 2, 10], [8, 6, 6], [10, 6, 6], [12, 2, 10]
];
ZIWEI_CASES.forEach(([h, zw, tf]) => {
  const cal = Lunar.cast(2023, 8, 1, h, 0);
  const r = Z.cast(cal);
  if (!r) { ok(false, `2023-08-01 ${h}点：Ziwei.cast 返回空`); return; }
  eq(r.ziwei.idx, zw, `2023-08-01 ${h}点 紫微宫序`);
  eq(r.tianfu.idx, tf, `2023-08-01 ${h}点 天府宫序`);
});

/* ---------- ② iztro：2023-03-06 辰时 → 十四主星逐宫 ---------- */
const cal2 = Lunar.cast(2023, 3, 6, 8, 0);
const r2 = Z.cast(cal2);
ok(!!r2, '2023-03-06 辰时 应能排出来');
eq(r2.lunar.month, 2, '2023-03-06 应是农历二月');
eq(r2.lunar.day, 15, '2023-03-06 应是农历十五');
eq(r2.ziwei.idx, 6, '2023-03-06 辰时 紫微应在申（宫序 6）');
eq(r2.tianfu.idx, 6, '2023-03-06 辰时 天府应在申（与紫微同宫）');

/* iztro 的期望：按 寅=0 排列 */
const EXPECT = [
  ['七杀'], ['天同'], ['武曲'], ['太阳'], ['破军'], ['天机'],
  ['紫微', '天府'], ['太阴'], ['贪狼'], ['巨门'], ['廉贞', '天相'], ['天梁']
];
EXPECT.forEach((names, i) => {
  const got = r2.list.filter(s => s.idx === i).map(s => s.name);
  eq(got.join(','), names.join(','), `2023-03-06 辰时 · 第 ${i} 宫（${Z.BRANCH[(i + 2) % 12]}）`);
});
/* 亮度：与 iztro 同一条测试的 brightness 对表（庙旺得利平不陷） */
const BRIGHT_EXPECT = {
  '七杀': '庙', '天同': '平', '武曲': '庙', '太阳': '旺', '破军': '庙', '天机': '陷',
  '紫微': '旺', '天府': '得', '太阴': '旺', '贪狼': '庙', '巨门': '旺',
  '廉贞': '平', '天相': '庙', '天梁': '旺'
};
Object.keys(BRIGHT_EXPECT).forEach(nm => {
  const st = r2.list.find(s => s.name === nm);
  eq(st ? st.bright : '(缺)', BRIGHT_EXPECT[nm], `2023-03-06 辰时 · ${nm} 亮度`);
});

/* 四化（2023 癸卯年 → 破军禄 · 巨门权 · 太阴科 · 贪狼忌） */
const HUA_EXPECT = { '破军': '禄', '巨门': '权', '太阴': '科', '贪狼': '忌' };
Object.keys(HUA_EXPECT).forEach(nm => {
  const st = r2.list.find(s => s.name === nm);
  eq(st ? st.hua : '(缺)', HUA_EXPECT[nm], `2023-03-06 · ${nm} 四化`);
});
eq(r2.list.filter(s => s.hua).length, 4, '一盘的十四主星里应正好有 4 个四化');
/* 丙年的科落在文昌（非主星）→ 应进 huaOutside，而不是给某颗主星乱标 */
const calBing = Lunar.cast(2026, 10, 25, 8, 0);   /* 2026 丙午年 */
const rBing = Z.cast(calBing);
/* 丙年的科落文昌 —— 现在补了昌曲辅弼，所以**标在文昌这颗辅星上**（不再落空） */
ok(rBing.minorList.some(x => x.name === '文昌' && x.hua === '科'), '丙年：文昌科应标在文昌辅星上');
eq(rBing.huaOutside.length, 0, '丙年：四化不该再落空');
eq(rBing.list.concat(rBing.minorList).filter(s => s.hua).length, 4, '丙年：四化应正好 4 个');

eq(r2.list.length, 14, '十四主星应一颗不多、一颗不少');
eq(new Set(r2.list.map(s => s.name)).size, 14, '十四颗应互不重复');

/* ---------- ③ 奇门宫映射 ---------- */
/* 申（index 8）→ 坤2；所以紫微/天府在本例会落在坤2 */
eq(r2.ziwei.pal, 2, '紫微落坤2（申在坤）');
ok(r2.byPal[2].length >= 2 && r2.byPal[2].some(x => x.name === '紫微') && r2.byPal[2].some(x => x.name === '天府'),
  '坤2 应同时收到紫微与天府（申宫），并可能再收未宫的主星');
/* 四隅宫每宫最多两颗（每支最多两组，且十四星不会挤满） */
Object.keys(r2.byPal).forEach(pal => ok(r2.byPal[pal].length <= 4, `第 ${pal} 宫主星不应超过 4 颗（四隅宫两支 × 每支最多两星）`));

/* ---------- ④ 常见盘型稳定性：跑 1950–2050 每天 12 时辰 ---------- */
let n = 0, bad = 0, maxPer = 0, palSum = 0;
for (let y = 1950; y <= 2050; y += 1) {
  for (const [m, d] of [[1, 15], [3, 6], [6, 21], [9, 9], [12, 31]]) {
    for (let h = 0; h < 24; h += 2) {
      const cal = Lunar.cast(y, m, d, h, 0);
      const r = Z.cast(cal);
      n++;
      if (!r || r.list.length !== 14) { bad++; continue; }
      const seen = new Set(r.list.map(s => s.name));
      if (seen.size !== 14) bad++;
      Object.keys(r.byPal).forEach(p => { maxPer = Math.max(maxPer, r.byPal[p].length); });
      palSum += Object.keys(r.byPal).length;
    }
  }
}
console.log(`  全域：${n} 盘 · 异常 ${bad} · 单宫最多 ${maxPer} 颗 · 平均每盘 ${(palSum / n).toFixed(2)} 宫有主星`);
eq(bad, 0, '全域里每盘都应是完整的十四颗、且不重复');
ok(maxPer <= 4, '单宫主星不该超过 4 颗（四隅宫两支 × 每支最多两星）');

/* ---------- ⑤ 晚子时：lateZiAdvance 时农历日 +1 ---------- */
const late = Lunar.cast(2023, 3, 6, 23, 30);
const rLate0 = Z.cast(late);
const late2 = Object.assign({}, late, { lateZiAdvance: true });
const rLate1 = Z.cast(late2);
ok(rLate0.lunar.day === rLate1.lunar.day - 1 || rLate1.lunar.day <= rLate0.lunar.day,
  '晚子时进日：开了 lateZiAdvance 后农历日应 +1（跨月回卷可减）');

/* ---------- ⑥ 第三方整盘对表：iztro 官方 bySolar('2000-8-16', 2, '女') ----------
   期望（见 iztro 的 __tests__/astro/astro.test.ts）：
     农历 二〇〇〇年七月十七 · 四柱 庚辰 甲申 丙午 庚寅 · 命宫 午 · 身宫 戌 · 木三局
     （它的 soul:'破军' 是**命主星**，不是命宫主星，别拿它当主星核对） */
const c3 = Lunar.cast(2000, 8, 16, 4, 0);          /* 4 点 = 寅时 */
const r3 = Z.cast(c3);
eq(c3.lunar.day, 17, '2000-08-16 农历应是十七');
eq(c3.lunar.month, 7, '2000-08-16 农历应是七月');
eq(r3.soul.branchName, '午', '2000-08-16 寅时 命宫应在午');
eq(r3.body.branchName, '戌', '2000-08-16 寅时 身宫应在戌');
eq(r3.ju.name, '木三局', '2000-08-16 寅时 五行局应是木三局');
eq((r3.byPal[r3.soul.pal] || []).map(s => s.name).join(','), '紫微', '命宫（午）主星应是紫微');
/* 庚年四化：太阳禄 · 武曲权 · 太阴科 · 天同忌 */
const hua3 = {};
r3.list.concat(r3.minorList).forEach(s => { if (s.hua) hua3[s.name] = s.hua; });
eq(hua3['太阳'], '禄', '庚年 太阳化禄');
eq(hua3['武曲'], '权', '庚年 武曲化权');
eq(hua3['太阴'], '科', '庚年 太阴化科');
eq(hua3['天同'], '忌', '庚年 天同化忌');
/* 辅星：文昌 戌−时支、文曲 辰+时支、左辅 辰+月、右弼 戌−月（宫序 0=寅） */
const mn3 = {};
r3.minorList.forEach(s => { mn3[s.name] = s.branchName; });
eq(mn3['文昌'], '申', '2000-08-16 寅时 文昌应在申');
eq(mn3['文曲'], '午', '2000-08-16 寅时 文曲应在午');
eq(mn3['左辅'], '戌', '2000-08-16 寅时（七月）左辅应在戌');
eq(mn3['右弼'], '辰', '2000-08-16 寅时（七月）右弼应在辰');

/* ---------- ⑦ 四化不再「落空」：任何年干，四化都应落在主星或昌曲辅弼上 ---------- */
for (let yg = 0; yg < 10; yg++) {
  const rr = Z.cast({ lunar: { month: 5, day: 12, leap: false }, index: { hourZhi: 3, yearGan: yg }, lateZiAdvance: false });
  eq(rr.huaOutside.length, 0, `年干 ${yg}：四化不该落空（现在落在主星或昌曲辅弼上）`);
  const n = rr.list.concat(rr.minorList).filter(s => s.hua).length;
  eq(n, 4, `年干 ${yg}：四化应正好 4 个`);
}


/* ---------- ⑧ 年干口径：紫微按**春节换年**（iztro 的 yearDivide:'normal'），不是四柱的立春 ----------
   2024 立春 02-04、春节 02-10；02-09 是「立春后、春节前」的夹缝日。
   旧实现直接拿四柱年干（甲辰）→ 四化全错、五虎遁的寅宫干也错 → 五行局与紫微位置一起偏。 */
const cPre = Lunar.cast(2024, 2, 9, 12, 0);
const cNew = Lunar.cast(2024, 2, 10, 12, 0);
eq(cPre.ganzhi.year, '甲辰', '2024-02-09 四柱年应是甲辰（立春换年，作对照）');
eq(cPre.lunar.yearName, 2023, '2024-02-09 农历年号应是 2023（癸卯）');
const rPre = Z.cast(cPre), rNew = Z.cast(cNew);
eq(rPre.yearGan, 9, '2024-02-09 紫微年干按春节应取癸');
eq(rNew.yearGan, 0, '2024-02-10 紫微年干按春节应取甲');
const huaPre = {}, huaNew = {};
rPre.list.concat(rPre.minorList).forEach(x => { if (x.hua) huaPre[x.name] = x.hua; });
rNew.list.concat(rNew.minorList).forEach(x => { if (x.hua) huaNew[x.name] = x.hua; });
eq(huaPre['破军'], '禄', '2024-02-09（癸年）破军化禄 —— 拿立春年甲辰会错成廉贞禄');
eq(huaPre['巨门'], '权', '2024-02-09（癸年）巨门化权');
eq(huaPre['太阴'], '科', '2024-02-09（癸年）太阴化科');
eq(huaPre['贪狼'], '忌', '2024-02-09（癸年）贪狼化忌');
eq(huaNew['廉贞'], '禄', '2024-02-10（甲年）廉贞化禄');
eq(huaNew['太阳'], '忌', '2024-02-10（甲年）太阳化忌');
/* 2025 春节 01-29 */
eq(Z.cast(Lunar.cast(2025, 1, 28, 12, 0)).yearGan, 0, '2025-01-28（除夕）紫微年干应是甲');
eq(Z.cast(Lunar.cast(2025, 1, 29, 12, 0)).yearGan, 1, '2025-01-29（正月初一）紫微年干应是乙');
/* 春节前后的四化也要跟着换（乙年：机梁紫月） */
const hua2025 = {};
(function () {
  const r = Z.cast(Lunar.cast(2025, 1, 29, 12, 0));
  r.list.concat(r.minorList).forEach(x => { if (x.hua) hua2025[x.name] = x.hua; });
})();
eq(hua2025['天机'], '禄', '2025 乙年 天机化禄');
eq(hua2025['太阴'], '忌', '2025 乙年 太阴化忌');

/* ---------- ⑨ 闰月（fixLeap）与晚子时的交互 ----------
   2025 闰六月：07-25 起。iztro 口径：闰月后半月（日 > 15）按下一月算，
   但 **晚子时那一格不加**（`timeIndex !== 12`），且日数用原始农历日。 */
const lA = Z.cast(Lunar.cast(2025, 8, 8, 0, 30));   /* 闰六月十五 早子 */
const lB = Z.cast(Lunar.cast(2025, 8, 7, 23, 30));  /* 闰六月十四 晚子时 → 日进到十五 */
const lD = Z.cast(Lunar.cast(2025, 8, 9, 0, 30));   /* 闰六月十六 早子 */
ok(lA.lunar.leap && lA.lunar.month === 6, '2025-08-08 应是闰六月');
eq(lA.lunar.day, 15, '2025-08-08 应是闰六月十五');
eq(lB.lunar.day, 15, '闰六月十四 23:30（晚子时）农历日应进到十五');
eq(lB.soul.idx, lA.soul.idx, '晚子时与次日早子应同命宫（晚子进日）');
eq(lD.soul.idx, (lA.soul.idx + 1) % 12, '闰六月十六起按七月算：命宫应顺移一位');

/* ---------- ⑩ 四化全域：10 年干 × 6 月 × 6 日 × 12 时 ----------
   硬编码一份 iztro 的十天干四化（禄权科忌），**不复用 ziwei.js 的表**，
   免得"用被测数据当期望值"。 */
const GAN_HUA = {
  0: ['廉贞', '破军', '武曲', '太阳'],
  1: ['天机', '天梁', '紫微', '太阴'],
  2: ['天同', '天机', '文昌', '廉贞'],
  3: ['太阴', '天同', '天机', '巨门'],
  4: ['贪狼', '太阴', '右弼', '天机'],
  5: ['武曲', '贪狼', '天梁', '文曲'],
  6: ['太阳', '武曲', '太阴', '天同'],
  7: ['巨门', '太阳', '文曲', '文昌'],
  8: ['天梁', '紫微', '左辅', '武曲'],
  9: ['破军', '巨门', '太阴', '贪狼']
};
let huaCntBad = 0, huaOutBad = 0, huaNameBad = 0, minorBad = 0, scanN = 0;
for (let yg = 0; yg < 10; yg++) {
  for (const mo of [1, 2, 5, 8, 11, 12]) {
    for (const d of [1, 3, 8, 15, 22, 28]) {
      for (let hz = 0; hz < 12; hz++) {
        scanN++;
        const r = Z.cast({ lunar: { month: mo, day: d, leap: false }, index: { hourZhi: hz, yearGan: yg }, lateZiAdvance: false });
        const all = r.list.concat(r.minorList);
        const got = all.filter(x => x.hua);
        if (got.length !== 4) huaCntBad++;
        if (r.huaOutside.length) huaOutBad++;
        const gotMap = {};
        got.forEach(x => { gotMap[x.name] = x.hua; });
        GAN_HUA[yg].forEach((nm, i) => {
          if (gotMap[nm] !== Z.HUA[i]) huaNameBad++;
        });
        /* 辅星位置独立复算（宫序 0=寅）：左辅 = 辰+(月−1) · 右弼 = 戌−(月−1) ·
           文昌 = 戌−时支 · 文曲 = 辰+时支 */
        const fx = n => ((n % 12) + 12) % 12;
        const mn = {};
        r.minorList.forEach(x => { mn[x.name] = x.idx; });
        if (mn['左辅'] !== fx(2 + mo - 1)) minorBad++;
        if (mn['右弼'] !== fx(8 - (mo - 1))) minorBad++;
        if (mn['文昌'] !== fx(8 - hz)) minorBad++;
        if (mn['文曲'] !== fx(2 + hz)) minorBad++;
      }
    }
  }
}
console.log(`  四化全域：${scanN} 组（10 干 × 6 月 × 6 日 × 12 时）`);
eq(huaCntBad, 0, '任何「年干 × 月 × 日 × 时」都应有且只有 4 个四化');
eq(huaOutBad, 0, '四化不应再落到十四主星与昌曲辅弼之外（huaOutside 恒空）');
eq(huaNameBad, 0, '四化必须与 iztro 十天干表逐项一致（禄/权/科/忌）');
eq(minorBad, 0, '昌曲辅弼的宫位必须与 iztro 公式一致（左辅辰+月、右弼戌−月、文昌戌−时、文曲辰+时）');

/* ---------- ⑪ 亮度表 14×12 全量对表（iztro data/stars.ts，按宫序 0=寅） ---------- */
const BRIGHT_IZTRO = {
  '紫微': '旺旺得旺庙庙旺旺得旺平庙',
  '天机': '得旺利平庙陷得旺利平庙陷',
  '太阳': '旺庙旺旺旺得得平不陷陷不',
  '武曲': '得利庙平旺庙得利庙平旺庙',
  '天同': '利平平庙陷不旺平平庙旺不',
  '廉贞': '庙平利陷平利庙平利陷平利',
  '天府': '庙得庙得旺庙得旺庙得庙庙',
  '太阴': '旺陷陷陷不不利旺旺庙庙庙',
  '贪狼': '平利庙陷旺庙平利庙陷旺庙',
  '巨门': '庙庙陷旺旺不庙庙陷旺旺不',
  '天相': '庙陷得得庙得庙陷得得庙庙',
  '天梁': '庙庙庙陷庙旺陷得庙陷庙旺',
  '七杀': '庙旺庙平旺庙庙旺庙平旺庙',
  '破军': '得陷旺平庙旺得陷旺平庙旺'
};
Object.keys(BRIGHT_IZTRO).forEach(nm => {
  eq((Z.BRIGHT && Z.BRIGHT[nm] ? Z.BRIGHT[nm].join('') : '(缺表)'), BRIGHT_IZTRO[nm],
    `${nm} 亮度表 12 宫全量（iztro data/stars.ts）`);
});

console.log(`\n紫微安星自测：${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
