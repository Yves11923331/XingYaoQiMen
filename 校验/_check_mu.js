#!/usr/bin/env node
/* ============================================================================
 * _check_mu.js —— 插件「墓星」判定自测（jsdom，走的是真引擎）
 * 跑法：NODE_PATH=/root/dsh-dom/node_modules node 校验/_check_mu.js
 *
 * 锁的是 2026-10-21 与用户定下的口径：
 *   ① 墓支：水／土→辰 · 木→未 · 火→戌 · 金→丑（与十二长生同源）
 *   ② 宫纳支沿用 PAL_ZHI：巽4 辰巳 / 坤2 未申 / 乾6 戌亥 / 艮8 寅丑
 *      → 四正宫（坎1·震3·离9·兑7）无墓支，**永不入墓**；中5 不纳支，不判
 *   ③ 转盘禽芮宫 p.star=2 且 p.mid 有值时，**天芮＋天禽各算一枚**
 *   ④ 一宫最多 3 枚（用户口径）
 *   ⑤ 飞盘没有寄宫，天禽自己落宫（p.star=5）照算，且不重复
 *   ⑥ 星门都算：星走 STAR_WX、门走 GATE_WX；中门（gateMid）按土算
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
const Q = win.Qimen;

/* ---------- ⓪ 表本身 ---------- */
ok(!!Q.muAt, 'Qimen.muAt 应导出');
ok(Q.MU_ZHI['水'] === '辰' && Q.MU_ZHI['土'] === '辰', '水/土墓应在辰');
ok(Q.MU_ZHI['木'] === '未' && Q.MU_ZHI['火'] === '戌' && Q.MU_ZHI['金'] === '丑', '木未/火戌/金丑');

/* ---------- ① 构造一个必然入墓的宫，逐项核 ---------- */
function plate(pal, o) {
  return Object.assign({ pal: pal, star: 0, gate: 0, mid: 0, gateMid: false, heaven: 0, earth: 0 }, o);
}
/* 巽4 纳辰巳：水(天蓬1) 与 土(天芮2/天禽5/天任8) 入墓；木(天冲3) 不入 */
ok(Q.muAt(4, plate(4, { star: 1 })).length === 1, '巽4 · 天蓬(水) 应入墓');
ok(Q.muAt(4, plate(4, { star: 2 })).length === 1, '巽4 · 天芮(土) 应入墓');
ok(Q.muAt(4, plate(4, { star: 3 })).length === 0, '巽4 · 天冲(木) 不应入墓');
ok(Q.muAt(4, plate(4, { star: 9 })).length === 0, '巽4 · 天英(火) 不应入墓');
/* 禽芮宫：天芮 + 天禽（mid 有值）各一枚 */
ok(Q.muAt(4, plate(4, { star: 2, mid: 7 })).length === 2, '巽4 禽芮宫应有 2 枚（天芮＋天禽）');
/* 坤2 纳未申：木入墓 */
ok(Q.muAt(2, plate(2, { star: 3 })).length === 1, '坤2 · 天冲(木) 应入墓');
ok(Q.muAt(2, plate(2, { star: 2 })).length === 0, '坤2 · 天芮(土) 不应入墓（土墓在辰）');
/* 乾6 纳戌亥：火入墓 */
ok(Q.muAt(6, plate(6, { star: 9 })).length === 1, '乾6 · 天英(火) 应入墓');
/* 艮8 纳寅丑：金入墓 */
ok(Q.muAt(8, plate(8, { star: 6 })).length === 1, '艮8 · 天心(金) 应入墓');
ok(Q.muAt(8, plate(8, { star: 7 })).length === 1, '艮8 · 天柱(金) 应入墓');
/* 四正宫 + 中5：永不入墓 */
[1, 3, 9, 7, 5].forEach(pal => {
  ok(Q.muAt(pal, plate(pal, { star: 1, gate: 1 })).length === 0, `第 ${pal} 宫不应有任何墓星`);
});
/* 门：休/生/死(水/土)→巽4；伤/杜(木)→坤2；景(火)→乾6；开/惊(金)→艮8；中门(土)→巽4 */
ok(Q.muAt(4, plate(4, { gate: 1 })).length === 1, '巽4 · 休门(水) 应入墓');
ok(Q.muAt(4, plate(4, { gate: 8 })).length === 1, '巽4 · 生门(土) 应入墓');
ok(Q.muAt(2, plate(2, { gate: 3 })).length === 1, '坤2 · 伤门(木) 应入墓');
ok(Q.muAt(6, plate(6, { gate: 9 })).length === 1, '乾6 · 景门(火) 应入墓');
ok(Q.muAt(8, plate(8, { gate: 6 })).length === 1, '艮8 · 开门(金) 应入墓');
ok(Q.muAt(8, plate(8, { gate: 1 })).length === 0, '艮8 · 休门(水) 不应入墓');
ok(Q.muAt(4, plate(4, { gateMid: true })).length === 1, '巽4 · 中门(土) 应入墓');

/* ---------- ② 上限 3 枚 ---------- */
const three = Q.muAt(4, plate(4, { star: 2, mid: 5, gate: 8, gateMid: true }));
ok(three.length === 3, '一宫最多 3 枚（4 个入墓单位要截到 3）');

/* ---------- ③ 全盘遍历：1080 转盘 + 81 飞盘 ---------- */
const ZHENG = [1, 3, 9, 7, 5];
function scan(opt, tag) {
  let plates = 0, withMu = 0, maxN = 0, badZheng = 0, badKind = 0, badWx = 0, badMax = 0;
  for (let pol = 1; pol >= -1; pol -= 2) {
    for (let cycle = 1; cycle <= 9; cycle++) {
      for (let hs = 1; hs <= 10; hs++) {
        for (let eb of [1, 3, 5, 7, 9, 11]) {
          /* 时干与时支必须同奇偶：阳干配阳支、阴干配阴支 */
          if ((hs % 2) !== (eb % 2)) continue;
          const ch = Q.castManual(pol, cycle, hs, eb, opt);
          if (!ch || !ch.plate) continue;
          plates++;
          ch.plate.forEach(p => {
            const list = Q.muAt(p.pal, p);
            if (list.length) { withMu++; maxN = Math.max(maxN, list.length); }
            if (ZHENG.indexOf(p.pal) >= 0 && list.length) badZheng++;
            if (list.length > 3) badMax++;
            list.forEach(it => {
              const wx = it.kind === 'star' ? Q.STAR_WX[it.no] : Q.GATE_WX[it.no];
              if (!wx) badKind++;
              else if ((Q.PAL_ZHI[p.pal] || []).indexOf(Q.MU_ZHI[wx]) < 0) badWx++;
            });
          });
        }
      }
    }
  }
  console.log(`  ${tag}：${plates} 盘 · 有墓星的宫 ${withMu} 次 · 单宫最多 ${maxN} 枚`);
  ok(badZheng === 0, `${tag}：四正宫/中五宫不该出现墓星（${badZheng} 次）`);
  ok(badMax === 0, `${tag}：单宫不该超过 3 枚（${badMax} 次）`);
  ok(badKind === 0, `${tag}：每个单位都该有五行（${badKind} 次）`);
  ok(badWx === 0, `${tag}：五行与宫纳支必须对得上（${badWx} 次）`);
  ok(withMu > 0, `${tag}：应该真的出现过墓星（0 次说明判定写死了）`);
}
console.log('转盘全域：');
scan({}, '转盘');
console.log('飞盘全域：');
scan({ fly: { star: true, gate: true, god: true } }, '飞盘');

/* ---------- ④ 转盘 vs 飞盘：一宫「两枚星」只在转盘的禽芮宫出现 ---------- */
let zhuanTwoStar = 0, feiTwoStar = 0, starCnt = 0, gateCnt = 0;
for (let cycle = 1; cycle <= 9; cycle++) {
  for (let hs = 1; hs <= 10; hs++) {
    for (let eb of [1, 3, 5, 7, 9, 11]) {
      if ((hs % 2) !== (eb % 2)) continue;
      const z = Q.castManual(1, cycle, hs, eb, {});
      const f = Q.castManual(1, cycle, hs, eb, { fly: { star: true, gate: true, god: true } });
      z.plate.forEach(p => {
        const l = Q.muAt(p.pal, p);
        const ns = l.filter(x => x.kind === 'star').length;
        if (ns >= 2) zhuanTwoStar++;
      });
      f.plate.forEach(p => {
        const l = Q.muAt(p.pal, p);
        const ns = l.filter(x => x.kind === 'star').length;
        if (ns >= 2) feiTwoStar++;
      });
    }
  }
}
ok(zhuanTwoStar > 0, '转盘应该出现过「同宫两枚星」的禽芮情形（天芮＋天禽）');
ok(feiTwoStar === 0, '飞盘没有寄宫，不该出现同宫两枚星（天芮＋天禽）');
console.log(`  转盘"两枚星"同宫 ${zhuanTwoStar} 次 · 飞盘 ${feiTwoStar} 次（应为 0）`);

console.log(`\n墓星判定自测：${pass} 过 / ${fail} 败`);
process.exit(fail ? 1 : 0);
