/* ============================================================================
 * truesolar.js —— 真太阳时（2026-10-21）
 * ----------------------------------------------------------------------------
 * 真太阳时 = 地方平太阳时 + 均时差
 *   地方平太阳时 = 标准时 + 经度时差
 *   经度时差 = (观测点经度 − 时区中央经线) × 4 分钟
 *   均时差 EoT 用 Meeus 简化式（精度约 ±10 秒），足够判时辰/日界。
 *
 * ⚠ 只换算「地方时」这一层；节气/立春是天文瞬间（UT），判断交节仍用标准时转 UT，
 *   不要把真太阳时再当北京时间去减 8 小时。
 * ========================================================================== */
(function (root) {
  'use strict';

  /* 一年中的第几天（1..366） */
  function dayOfYear(y, m, d) {
    return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  }

  /* 均时差（分钟）：真太阳时 − 平太阳时。Meeus, Astronomical Algorithms 第 28 章简化式。 */
  function equationOfTime(n, hour) {
    var g = 2 * Math.PI / 365 * (n - 1 + ((hour == null ? 12 : hour) - 12) / 24);
    return 229.18 * (0.000075
      + 0.001868 * Math.cos(g)
      - 0.032077 * Math.sin(g)
      - 0.014615 * Math.cos(2 * g)
      - 0.040849 * Math.sin(2 * g));
  }

  /* 标准时 → 真太阳时。
     p: {y,m,d,h,mi} 设备本地标准时；lon: 观测点经度（东正）。
     返回 {y,m,d,h,mi, lonMin, eot, shift}（shift = 总偏移分钟）。 */
  function toTrueSolar(p, lon) {
    /* 排盘引擎固定按北京时间（Lunar.cast 内部减 8h），所以这里也固定用东八区中央经线 120°E，
       不跟设备时区走 —— 否则模拟器/出国时会整体偏 8 小时。 */
    var lonMin = (lon - 120) * 4;              // 经度时差（分钟）
    var eot = equationOfTime(dayOfYear(p.y, p.m, p.d), p.h + p.mi / 60);
    var rawTotal = p.h * 60 + p.mi + lonMin + eot;
    var totalMin = Math.round(rawTotal);       // 排盘只到分钟
    var dayShift = Math.floor(totalMin / 1440);
    var mins = ((totalMin % 1440) + 1440) % 1440;
    var d2 = new Date(p.y, p.m - 1, p.d + dayShift);
    return {
      y: d2.getFullYear(), m: d2.getMonth() + 1, d: d2.getDate(),
      h: Math.floor(mins / 60), mi: mins % 60,
      lonMin: lonMin, eot: eot, shift: totalMin - (p.h * 60 + p.mi)
    };
  }

  root.TrueSolar = {
    toTrueSolar: toTrueSolar,
    equationOfTime: equationOfTime,
    dayOfYear: dayOfYear
  };
})(typeof window !== 'undefined' ? window : globalThis);
