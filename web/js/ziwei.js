/* ============================================================================
 * ziwei.js —— 星曜奇门 · 插件「紫微」（紫微斗数十四主星）
 * ----------------------------------------------------------------------------
 * 2026-10-21 用户：「扒一下紫微十四主星是怎么排的，做一个插件；开始时默认把星曜抵掉」。
 * 口径与出处：按开源库 iztro（SylarLong/iztro）的安星法实现，并用它的官方用例对过表：
 *   2023-03-06 辰时 → 紫微/天府同宫在申，七杀寅、天同卯、武曲辰、太阳巳、破军午、天机未、
 *   太阴酉、贪狼戌、巨门亥、廉贞+天相子、天梁丑。本模块逐宫一致。
 *
 * 算法（全部以「寅宫 = 0」为下标，与紫微斗数一致）：
 *   ① 命宫 = fix(农历月索引 − 时支索引)；身宫 = fix(农历月索引 + 时支索引)
 *   ② 五虎遁定寅宫天干：甲己丙、乙庚戊、丙辛庚、丁壬壬、戊癸甲
 *   ③ 命宫天干 = fix(寅干 + 命宫)；命宫地支 = 命宫 + 寅
 *   ④ 五行局：纳音取数（干 1–5、支 1–3，相加过五减五）→ 1木三 2金四 3水二 4火六 5土五
 *   ⑤ 紫微：日数补到能被局数整除（补数 offset），商数从寅顺数、再按 offset 奇偶逆/顺补
 *   ⑥ 天府与紫微以寅申轴对称：天府 = fix(12 − 紫微)
 *   ⑦ 紫微系逆布（紫微·天机·空一·太阳·武曲·天同·空二·廉贞）
 *      天府系顺布（天府·太阴·贪狼·巨门·天相·天梁·七杀·空三·破军）
 *
 * ⚠ 这一步只算「落在哪个地支宫」，**不判吉凶、不算四化**（四化要年干，后续再说）。
 * ⚠ 晚子时（23 点后）：紫微斗数按次日算。本模块看 calendar.lateZiAdvance（项目「晚子时换日」）：
 *   为 true 时农历日 +1；否则按当日算 —— 与项目四柱同一口径。
 * ========================================================================== */
(function (root, factory) {
  var api = factory();
  root.Ziwei = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var BRANCH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  /* 地支 → 奇门九宫（与 qimen.js 的 PAL_ZHI 同一套：坎子 / 艮丑寅 / 震卯 / 巽辰巳 /
     离午 / 坤未申 / 兑酉 / 乾戌亥）。四隅宫各容两支，所以一宫最多能收到两组主星。 */
  var BRANCH_PAL = [1, 8, 8, 3, 4, 4, 9, 2, 2, 7, 6, 6];

  function fix(n, max) {
    max = max || 12;
    return ((n % max) + max) % max;
  }

  /* 紫微系：从紫微起**逆**数，i 是偏移量（0 = 紫微自己） */
  var ZIWEI_GROUP = [
    [0, '紫微'], [1, '天机'], [3, '太阳'], [4, '武曲'], [5, '天同'], [8, '廉贞']
  ];
  /* 天府系：从天府起**顺**数 */
  var TIANFU_GROUP = [
    [0, '天府'], [1, '太阴'], [2, '贪狼'], [3, '巨门'], [4, '天相'], [5, '天梁'],
    [6, '七杀'], [10, '破军']
  ];

  /* 四化表（年干 → 禄 权 科 忌），取自 iztro 的 data/heavenlyStems.ts。
     ⚠ 其中 文昌/文曲/左辅/右弼 不是十四主星 —— 落在它们身上的四化本插件**不标**，
        会出现在返回值的 huaOutside 里（将来若加辅星再补）。 */
  var SIHUA = [
    ['廉贞', '破军', '武曲', '太阳'],   /* 甲 */
    ['天机', '天梁', '紫微', '太阴'],   /* 乙 */
    ['天同', '天机', '文昌', '廉贞'],   /* 丙 */
    ['太阴', '天同', '天机', '巨门'],   /* 丁 */
    ['贪狼', '太阴', '右弼', '天机'],   /* 戊 */
    ['武曲', '贪狼', '天梁', '文曲'],   /* 己 */
    ['太阳', '武曲', '太阴', '天同'],   /* 庚 */
    ['巨门', '太阳', '文曲', '文昌'],   /* 辛 */
    ['天梁', '紫微', '左辅', '武曲'],   /* 壬 */
    ['破军', '巨门', '太阴', '贪狼']    /* 癸 */
  ];
  var HUA = ['禄', '权', '科', '忌'];
  /* 十四主星名单（判断四化是否落在主星上） */
  var MAJOR = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞',
    '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
  /* 只补会吃到四化的四颗辅星（昌曲辅弼）；其余辅星不在本插件范围内 */
  var MINOR = ['文昌', '文曲', '左辅', '右弼'];

  /* 十四主星亮度表（庙旺得利平不陷），索引 = 宫序（0=寅），取自 iztro 的 data/stars.ts。
     ⚠ 这张表是**按宫序**读的，不是按地支序 —— 用的时候直接拿 star.idx 索引，别再换算一次。 */
  var BRIGHT = {
    '紫微': ['旺','旺','得','旺','庙','庙','旺','旺','得','旺','平','庙'],
    '天机': ['得','旺','利','平','庙','陷','得','旺','利','平','庙','陷'],
    '太阳': ['旺','庙','旺','旺','旺','得','得','平','不','陷','陷','不'],
    '武曲': ['得','利','庙','平','旺','庙','得','利','庙','平','旺','庙'],
    '天同': ['利','平','平','庙','陷','不','旺','平','平','庙','旺','不'],
    '廉贞': ['庙','平','利','陷','平','利','庙','平','利','陷','平','利'],
    '天府': ['庙','得','庙','得','旺','庙','得','旺','庙','得','庙','庙'],
    '太阴': ['旺','陷','陷','陷','不','不','利','旺','旺','庙','庙','庙'],
    '贪狼': ['平','利','庙','陷','旺','庙','平','利','庙','陷','旺','庙'],
    '巨门': ['庙','庙','陷','旺','旺','不','庙','庙','陷','旺','旺','不'],
    '天相': ['庙','陷','得','得','庙','得','庙','陷','得','得','庙','庙'],
    '天梁': ['庙','庙','庙','陷','庙','旺','陷','得','庙','陷','庙','旺'],
    '七杀': ['庙','旺','庙','平','旺','庙','庙','旺','庙','平','旺','庙'],
    '破军': ['得','陷','旺','平','庙','旺','得','陷','旺','平','庙','旺']
  };

  /* 纳音五行局：1 木三局 · 2 金四局 · 3 水二局 · 4 火六局 · 5 土五局 */
  var WUXING_JU = [
    null,
    { wx: '木', name: '木三局', num: 3, cls: 'wood' },
    { wx: '金', name: '金四局', num: 4, cls: 'metal' },
    { wx: '水', name: '水二局', num: 2, cls: 'water' },
    { wx: '火', name: '火六局', num: 6, cls: 'fire' },
    { wx: '土', name: '土五局', num: 5, cls: 'earth' }
  ];

  /* 一宫（地支索引 0=子）起五行局：纳音取数口诀
       甲乙丙丁戊己庚辛壬癸 → 1..5（每两干一数）
       子午丑未 1 · 寅申卯酉 2 · 辰戌巳亥 3 */
  function juOf(stemIdx, branchIdx) {
    var sn = Math.floor(stemIdx / 2) + 1;
    var bn = Math.floor(fix(branchIdx, 6) / 2) + 1;
    var n = sn + bn;
    while (n > 5) n -= 5;
    return WUXING_JU[n];
  }

  /* 主入口：传项目的 calendar（lunar.js 的 Lunar.cast(...) 结果） */
  function cast(calendar) {
    if (!calendar || !calendar.lunar) return null;
    var lun = calendar.lunar;
    var month = lun.month || 1;          /* 农历月 1..12 */
    var leap = !!lun.leap;
    var day = lun.day || 1;
    var hourZhi = calendar.index.hourZhi; /* 0=子 … 11=亥 */
    /* ★ 2026-10-25：紫微斗数按**农历年（春节换年）**取年干，**不是四柱的立春换年**。
       立春到春节之间（每年 5~15 天）若拿四柱年干，年干差一整年 → 四化全错，
       五虎遁的寅宫干也错 → 五行局跟着错 → 紫微/天府位置一起偏。
       iztro 默认 yearDivide:'normal'（春节换年），这里照它。
       `lunar.yearName` 是 lunar.js 的农历年号；老调用没有这个字段时回退四柱年干。 */
    var lunarYear = lun.yearName;
    var yearGan = (lunarYear === undefined || lunarYear === null)
      ? calendar.index.yearGan /* 0=甲 … 9=癸 */
      : (((lunarYear - 1984) % 10) + 10) % 10;   /* 1984 = 甲子 */

    /* 晚子时进日（项目设置 lateZiAdvance）—— 只加日，月份与命宫不动 */
    if (calendar.lateZiAdvance) {
      day += 1;
      /* 跨月：农历月大小不一，这里按 30 天兜底回卷（与 iztro 同一处理） */
      if (day > 30) day -= 30;
    }
    /* 闰月：后半月按下一月算（iztro 的 fixLeap 口径，也是主流排法之一）。
       ⚠ 照抄 iztro fixLunarMonthIndex：`isLeap && fixLeap && lunarDay > 15 && timeIndex !== 12`
         —— 日数用**原始农历日**（lun.day，不是晚子时 +1 之后的），且晚子时那一格不加偏移。 */
    var leapShift = (leap && lun.day > 15 && !calendar.lateZiAdvance) ? 1 : 0;
    var monthIdx = month - 1 + leapShift;
    monthIdx = fix(monthIdx);

    /* ① 命宫 / 身宫（0 = 寅） */
    var soulIdx = fix(monthIdx - hourZhi);
    var bodyIdx = fix(monthIdx + hourZhi);

    /* ② 五虎遁 → 寅宫天干 */
    var tiger = ((yearGan % 5) * 2 + 2) % 10;
    /* ③ 命宫干支 */
    var soulStem = fix(tiger + soulIdx, 10);
    var soulBranch = fix(soulIdx + 2);
    /* ④ 五行局 */
    var ju = juOf(soulStem, soulBranch);

    /* ⑤ 紫微：把日数补到能被局数整除，商数顺数、补数按奇偶逆/顺 */
    var offset = 0;
    while ((day + offset) % ju.num !== 0) offset++;
    var q = Math.floor((day + offset) / ju.num) % 12;
    var ziwei = q - 1;
    ziwei += (offset % 2 === 0) ? offset : -offset;
    ziwei = fix(ziwei);

    /* ⑥ 天府：与紫微以寅申轴对称 */
    var tianfu = fix(12 - ziwei);

    /* ⑦ 四化（按年干）：只认十四主星，落空的那几颗记在 huaOutside */
    var huaOf = {}, huaOutside = [];
    (SIHUA[yearGan] || []).forEach(function (nm, i) {
      if (!nm) return;
      if (MAJOR.indexOf(nm) >= 0 || MINOR.indexOf(nm) >= 0) huaOf[nm] = HUA[i];
      else huaOutside.push({ name: nm, hua: HUA[i] });
    });

    /* ⑧ 十四主星落宫（0 = 寅），再折成地支与奇门宫 */
    var list = [];
    ZIWEI_GROUP.forEach(function (g) {
      var idx = fix(ziwei - g[0]);
      list.push(makeStar(g[1], idx, 'ziwei'));
    });
    TIANFU_GROUP.forEach(function (g) {
      var idx = fix(tianfu + g[0]);
      list.push(makeStar(g[1], idx, 'tianfu'));
    });
    /* 排序：先按宫（寅起），同宫按紫微系在前、天府系在后（紫微、天府同宫时顺序稳定） */
    list.sort(function (a, b) { return a.idx - b.idx || a.seq - b.seq; });

    function makeStar(name, idx, group) {
      var branch = fix(idx + 2);                 /* 0=寅 → 地支 */
      return {
        name: name, group: group, idx: idx,
        branch: branch, branchName: BRANCH[branch],
        pal: BRANCH_PAL[branch],
        bright: (BRIGHT[name] || [])[idx] || '',
        hua: huaOf[name] || '',
        seq: (group === 'ziwei' ? 0 : 20)
      };
    }

    var byPal = {};
    list.forEach(function (s) { (byPal[s.pal] = byPal[s.pal] || []).push(s); });

    /* ⑨ 四化会落在**辅星**上（文昌·文曲·左辅·右弼）—— 只补这四颗，够把四化认全：
         文昌 = 戌 − 时支（逆数）· 文曲 = 辰 + 时支（顺数）
         左辅 = 辰 + (月−1) · 右弼 = 戌 − (月−1)
       宫序 0 = 寅；式子照抄 iztro 的 location.ts（getChangQuIndex / getZuoYouIndex）。 */
    var minorList = [
      { name: '左辅', idx: fix(2 + monthIdx) },
      { name: '右弼', idx: fix(8 - monthIdx) },
      { name: '文昌', idx: fix(8 - hourZhi) },
      { name: '文曲', idx: fix(2 + hourZhi) }
    ].map(function (m) {
      var branch = fix(m.idx + 2);
      return {
        name: m.name, idx: m.idx, group: 'minor',
        branch: branch, branchName: BRANCH[branch], pal: BRANCH_PAL[branch],
        hua: huaOf[m.name] || ''
      };
    });
    var byPalMinor = {};
    minorList.forEach(function (s) { (byPalMinor[s.pal] = byPalMinor[s.pal] || []).push(s); });

    return {
      ok: true,
      lunar: { month: month, day: day, leap: leap },
      /* 紫微自己的年干（春节换年）与农历年号 —— 与四柱年干不一定相同，弹层/自检要用 */
      lunarYear: lunarYear,
      yearGan: yearGan,
      soul: { idx: soulIdx, branch: soulBranch, branchName: BRANCH[soulBranch], pal: BRANCH_PAL[soulBranch],
        stem: soulStem },
      body: { idx: bodyIdx, branch: fix(bodyIdx + 2), branchName: BRANCH[fix(bodyIdx + 2)],
        pal: BRANCH_PAL[fix(bodyIdx + 2)] },
      ju: ju,
      ziwei: { idx: ziwei, branch: fix(ziwei + 2), pal: BRANCH_PAL[fix(ziwei + 2)] },
      tianfu: { idx: tianfu, branch: fix(tianfu + 2), pal: BRANCH_PAL[fix(tianfu + 2)] },
      list: list,
      byPal: byPal,
      minorList: minorList,
      byPalMinor: byPalMinor,
      huaOutside: huaOutside
    };
  }

  return {
    cast: cast,
    BRANCH: BRANCH,
    BRANCH_PAL: BRANCH_PAL,
    juOf: juOf,
    WUXING_JU: WUXING_JU,
    SIHUA: SIHUA, HUA: HUA, MAJOR: MAJOR, MINOR: MINOR, BRIGHT: BRIGHT
  };
});
