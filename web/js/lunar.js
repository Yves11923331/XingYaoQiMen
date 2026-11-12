/* ============================================================================
 * lunar.js —— 星曜奇门 · 历法层（农历 / 干支 / 四柱 / 节气）
 * ----------------------------------------------------------------------------
 * 全部现算，不依赖预置数据表：
 *   · 日干支：以 1823-12-01 = 甲子日 为锚（已用「1949-10-01 甲子日」「2000-01-01 戊午日」双点验证）
 *   · 年柱以立春换年，月柱以「节」换月，时柱五鼠遁
 *   · 农历用「冬至必在十一月」+「无中气置闰」两条规则定月
 * 精度已对 mQimen 内置 ecliptic 表 5784 条（含 lmonth/lday/leap）逐条校准。
 * ========================================================================== */
(function (root) {
  'use strict';
  var Astro = root.Astro || (typeof require !== 'undefined' ? require('./astro.js') : null);

  var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var SHENGXIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  var MONTH_NAME = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
  var DAY_NAME = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

  /* 1823-12-01（公历）= 甲子日。JDN 用 floor(julianDay(y,m,d,12)+0.5)。 */
  var DAY_EPOCH_JDN = 2387231;
  var BEIJING = 8 / 24;

  /* JDN of a Beijing-local calendar date */
  function jdnOf(y, m, d) { return Math.floor(Astro.julianDay(y, m, d, 12) + 0.5); }

  /* 日干支：0=甲子。advance = true 表示晚子时（23:00 后）算次日 */
  function dayGanZhiIndex(jdn, advance) {
    var n = jdn + (advance ? 1 : 0) - DAY_EPOCH_JDN;
    return ((n % 60) + 60) % 60;
  }

  /* 年干支：以立春换年。返回 0=甲子的序号 */
  function yearGanZhiIndex(y) {
    // 1984 = 甲子
    return (((y - 1984) % 60) + 60) % 60;
  }


  /* 由 hour(0..23) 得时支序号 0=子。
     子时 23:00–00:59，丑时 01:00–02:59 … */
  function hourZhiIndex(h) { return Math.floor(((h + 1) % 24) / 2); }

  /* 时干序号（0=甲）：五鼠遁 —— 甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途 */
  function hourGanIndex(dayGanIdx, hourZhiIdx) {
    return ((dayGanIdx % 5) * 2 + hourZhiIdx) % 10;
  }

  /* 月支序号（0=子）：由节气 seasonID(1=立春…24=大寒) 推。
     节：1立春→寅, 3惊蛰→卯, … 23小寒→丑；气归入同一月。 */
  function monthZhiIndex(seasonID) { return (Math.floor((seasonID - 1) / 2) + 2) % 12; }
  /* 月支序号 → 月序（寅=0） */
  function monthOrder(zhiIdx) { return ((zhiIdx - 2) % 12 + 12) % 12; }
  /* 月干：五虎遁 —— 甲己之年丙作首 */
  function monthGanIndex(yearGanIdx, monthOrderIdx) {
    return ((yearGanIdx % 5) * 2 + 2 + monthOrderIdx) % 10;
  }

  /* ------------------------------------------------------------------ 农历 */
  /* 北京日期 JDN：把「某瞬间」换算成它所属的北京日历日 */
  function dayJDN(jdUT) { return Math.floor(jdUT + BEIJING + 0.5); }

  /* (日A, 日B) 之间有没有中气。中气 = 偶数 seasonID（雨水2 春分4 … 大寒24）。
     同样按「日」比较 —— 农历是以日为单位的。 */
  function hasMajorDay(dA, dB) {
    var g = Astro.fromJulian(dA - 0.5);
    for (var yy = g.y - 1; yy <= g.y + 1; yy++) {
      for (var s = 2; s <= 24; s += 2) {
        var d = dayJDN(Astro.solarTermJD(yy, s));
        if (d >= dA && d < dB) return true;
      }
    }
    return false;
  }

  /* 儒略日(UT) → 农历 {year, month, day, leap, monthName, dayName}
     规则：① 冬至必在十一月 ② 一个岁里若有 13 个朔望月，则第一个不含中气的月为闰月。
     ★ 月界取「含朔那天的北京零点」，不是朔的瞬间 —— 按瞬间切月会让月界整天错位。 */
  function lunarFromJD(jdUT, nextDay) {
    /* nextDay：晚子时（23:00 后）按次日算农历 —— 阴盘定局用得到；
       默认 false，界面上的农历仍按实际时刻。 */
    var bj = jdUT + BEIJING + (nextDay ? 1 : 0);
    var g = Astro.fromJulian(bj);
    var y = g.y;
    /* 十一月初一 = 冬至所在朔月的朔日。
       ⚠ 定「岁」不能用冬至**瞬间**比较：冬至前一二十天就已经进了十一月
         （例：1964-12-08 在朔后、冬至前，却属于十一月初五）。
       正确做法是：看当前日是否已到某年冬至所在月的**朔日**。 */
    function m11Of(year) {
      var ws = Astro.solarTermJD(year, 22);
      var end = dayJDN(ws) + 0.5 - BEIJING - 1e-6;
      return Astro.newMoonBefore(end);
    }
    var curDay = Math.floor(bj + 0.5);
    var wsYear = y, m11 = m11Of(wsYear);
    if (curDay < dayJDN(m11)) { wsYear = y - 1; m11 = m11Of(wsYear); }
    var ws = Astro.solarTermJD(wsYear, 22);
    var m11Day = dayJDN(m11);
    var ws2 = Astro.solarTermJD(wsYear + 1, 22);
    var ws2Day = dayJDN(ws2);
    // 收齐 [十一月, 下一个十一月] 的朔日
    var days = [m11Day], t = m11, guard = 0;
    while (guard++ < 16) {
      t = Astro.solveNewMoon(t + 29.530588853);
      var dj = dayJDN(t);
      if (dj > ws2Day) break;
      days.push(dj);
    }
    var monthsCount = days.length - 1;              // 12 或 13
    var isLeapYear = (monthsCount === 13);
    // 闰月 = 十一月之后第一个不含中气的月
    var leapIdx = -1;
    if (isLeapYear) {
      for (var i = 1; i < monthsCount; i++) {
        if (!hasMajorDay(days[i], days[i + 1])) { leapIdx = i; break; }
      }
      if (leapIdx < 0) leapIdx = monthsCount - 1;   // 兜底，理论上不会发生
    }
    // 编号：十一月(11) 十二月(12) 正月(1) …
    var nums = [], leaps = [], num = 11, prev = 11;
    for (var k = 0; k < monthsCount; k++) {
      if (k === leapIdx) { nums.push(prev); leaps.push(true); }
      else { nums.push(num); leaps.push(false); prev = num; num = num % 12 + 1; }
    }
    // 落在哪个月
    /* ⚠ bj 已经是「北京时间儒略日」（lunarFromJD 开头加过 BEIJING），
       dayJDN() 内部还会再加一次 +8h —— 那样 16:00 之后整天都会多算一天。
       这里直接取整即可。 */
    var cur = Math.floor(bj + 0.5), mi = 0;
    for (var j = 0; j < monthsCount; j++) {
      if (cur >= days[j] && cur < days[j + 1]) { mi = j; break; }
      mi = j;
    }
    var day = cur - days[mi] + 1;
    if (day < 1) day = 1;
    var mNum = nums[mi];
    /* ★ 2026-10-25：`year` 是**岁次年**（含冬至的那个岁，十一月起算），**不是农历年号** ——
       2024-02-10（甲辰年正月初一）这里 year 仍是 2023。
       要农历年号（**春节换年**）请用 `yearName`：正月~十月属下一个农历年，十一月/十二月属本岁。
       紫微插件按春节换年（iztro 的 yearDivide:'normal' 口径），用的就是它。 */
    return {
      year: wsYear,
      yearName: wsYear + (mNum >= 11 ? 0 : 1),
      month: mNum, leap: leaps[mi], day: day,
      monthName: (leaps[mi] ? '闰' : '') + MONTH_NAME[mNum - 1] + '月',
      dayName: DAY_NAME[day - 1] || ('初' + day),
      jd: jdUT
    };
  }

  /* ------------------------------------------------------------ 四柱 / 节气 */
  /* 输入：北京时间的公历分量。返回完整历法信息。 */
  function cast(y, m, d, h, mi, opt) {
    opt = opt || {};
    var lateZi = opt.lateZi !== false;      // 默认：23:00 后算次日（沿用 mQimen 口径）
    var jdUT = Astro.julianDay(y, m, d, h + (mi || 0) / 60) - BEIJING;
    // 节气
    var sa = Astro.seasonAt(jdUT);
    // 日柱（含晚子时换日）
    var jdn = jdnOf(y, m, d);
    var adv = lateZi && h >= 23;
    var dayIdx = dayGanZhiIndex(jdn, adv);
    var dayGan = dayIdx % 10;
    // 年柱（立春换年）
    var lichun = Astro.solarTermJD(y, 1);   // 当年立春
    var gzYear = (jdUT < lichun) ? y - 1 : y;
    var yearIdx = yearGanZhiIndex(gzYear);
    var yearGan = yearIdx % 10;
    // 月柱
    var mZhi = monthZhiIndex(sa.seasonID);
    var mOrder = monthOrder(mZhi);
    var mGan = monthGanIndex(yearGan, mOrder);
    // 时柱
    var hZhi = hourZhiIndex(h);
    var hGan = hourGanIndex(dayGan, hZhi);
    // 农历（用实际时刻，不做晚子时换日）
    var lun = lunarFromJD(jdUT, !!opt.lunarNextDay);
    return {
      jdUT: jdUT,
      input: { y: y, m: m, d: d, h: h, mi: mi || 0 },
      season: sa,
      ganzhi: {
        year: GAN[yearGan] + ZHI[yearIdx % 12],
        month: GAN[mGan] + ZHI[mZhi],
        day: GAN[dayGan] + ZHI[dayIdx % 12],
        hour: GAN[hGan] + ZHI[hZhi]
      },
      index: {
        yearGan: yearGan, yearZhi: yearIdx % 12, yearIdx: yearIdx,
        monthGan: mGan, monthZhi: mZhi, monthOrder: mOrder,
        dayGan: dayGan, dayZhi: dayIdx % 12, dayIdx: dayIdx,
        hourGan: hGan, hourZhi: hZhi,
        seasonID: sa.seasonID
      },
      ganzhiYear: gzYear,
      shengxiao: SHENGXIAO[yearIdx % 12],
      lateZiAdvance: adv,
      lunar: lun,
      lunarText: lun.monthName + lun.dayName,
      seasonText: sa.name
    };
  }

  var API = {
    GAN: GAN, ZHI: ZHI, SHENGXIAO: SHENGXIAO,
    MONTH_NAME: MONTH_NAME, DAY_NAME: DAY_NAME,
    DAY_EPOCH_JDN: DAY_EPOCH_JDN,
    jdnOf: jdnOf,
    dayGanZhiIndex: dayGanZhiIndex, yearGanZhiIndex: yearGanZhiIndex,
    hourZhiIndex: hourZhiIndex, hourGanIndex: hourGanIndex,
    monthZhiIndex: monthZhiIndex, monthGanIndex: monthGanIndex, monthOrder: monthOrder,
    lunarFromJD: lunarFromJD, cast: cast, dayJDN: dayJDN,
  };
  root.Lunar = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
