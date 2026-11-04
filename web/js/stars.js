/* ============================================================================
 * stars.js —— 星曜奇门 · 星曜（日月五星四余）
 * ----------------------------------------------------------------------------
 * 11 星曜：太阳 太阴 岁星(木) 荧惑(火) 镇星(土) 太白(金) 辰星(水) 紫炁 罗睺 计都 月孛
 * 算法：
 *   · 太阳/太阴 用 astro.js 的视黄经（VSOP87 + ELP2000 截断，比老软件那套简式准）
 *   · 五星 用 Meeus《天文算法》ch.25 的 J2000 轨道根数 + 开普勒方程求日心坐标，再转地心黄经
 *   · 四余：罗睺=黄白升交点、计都=降交点、月孛=月球远地点、紫炁=近地点
 *   · 黄经 → 地平坐标（astronomy.geoPos）→ 方位角定九宫（北坎1 东北艮8 东震3 东南巽4
 *     南离9 西南坤2 西兑7 西北乾6）
 * 方位角只取 45° 一宫；高度角 < 0 表示在地平线下（照旧入宫，但显示会压暗）。
 * ========================================================================== */
(function (root) {
  'use strict';
  var Astro = root.Astro || (typeof require !== 'undefined' ? require('./astro.js') : null);

  /* 顺序即显示顺序；cls 对应 pan.css 里的 .qm-star-N 配色。
     short = 盘面**星太多**（>3 颗、一行放不下）时才用的单字简称（2026-11-02 用户定）：
       太阳→阳 · 太阴→阴 · 岁星→岁 · 荧惑→荧 · 镇星→镇 · 太白→白 · 辰星→辰，
       四余照旧：紫炁→炁 · 罗睺→罗 · 计都→计 · 月孛→孛（原来那套「金木水火土」不用了）。
     ⚠ 这不是「取古名首字」的规律（阳 / 阴 / 白 都不是首字），是用户给的固定对照，别自己推。 */
  var STARS = [
    { key: 'yang', name: '太阳', short: '阳', cls: 0 },
    { key: 'yin',  name: '太阴', short: '阴', cls: 1 },
    { key: 'sui',  name: '岁星', short: '岁', cls: 2 },
    { key: 'huo',  name: '荧惑', short: '荧', cls: 3 },
    { key: 'zhen', name: '镇星', short: '镇', cls: 4 },
    { key: 'jin',  name: '太白', short: '白', cls: 5 },
    { key: 'shui', name: '辰星', short: '辰', cls: 6 },
    { key: 'qi',   name: '紫炁', short: '炁', cls: 7 },
    { key: 'luo',  name: '罗睺', short: '罗', cls: 8 },
    { key: 'ji',   name: '计都', short: '计', cls: 9 },
    { key: 'bei',  name: '月孛', short: '孛', cls: 10 }
  ];

  /* J2000 轨道根数（Meeus ch.25）：
     [a(AU), e, I(°), L0(°), ϖ0(°), Ω0(°), L'(°/世纪), ϖ'(°/世纪), Ω'(°/世纪)] */
  var ORB = {
    mer: [0.38709843, 0.20563661, 7.00559432, 252.25032350, 77.45771895, 48.33076593, 149472.67411175, 0.16047689, -0.12534081],
    ven: [0.72332982, 0.00677188, 3.39466213, 181.97909950, 131.56370300, 76.67992019, 58517.81538729, 0.00487447, -0.27769418],
    mar: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 19140.29934243, 0.44441088, -0.29257343],
    jup: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, 3034.74612775, 0.21252668, 0.20469106],
    sat: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, 1222.49362201, -0.41897216, -0.28867794],
    ear: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 35999.37244981, 0.32327364, 0.0]
  };
  var D2R = Math.PI / 180;
  var norm360 = function (x) { x = x % 360; return x < 0 ? x + 360 : x; };

  /* 日心黄道直角坐标（AU），时刻为世纪数 T */
  function helio(name, T) {
    var p = ORB[name];
    var a = p[0], e = p[1], I = p[2];
    var L = norm360(p[3] + p[6] * T);
    var w = norm360(p[4] + p[7] * T);
    var O = norm360(p[5] + p[8] * T);
    var M = norm360(L - w) * D2R;
    var E = M, k;
    for (k = 0; k < 12; k++) E = M + e * Math.sin(E);      // 开普勒方程（小偏心率，直接迭代）
    var v = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    var r = a * (1 - e * Math.cos(E));
    var u = v + (w - O) * D2R;
    var cO = Math.cos(O * D2R), sO = Math.sin(O * D2R), cI = Math.cos(I * D2R);
    return [
      r * (cO * Math.cos(u) - sO * Math.sin(u) * cI),
      r * (sO * Math.cos(u) + cO * Math.sin(u) * cI),
      r * Math.sin(u) * Math.sin(I * D2R)
    ];
  }
  /* 地心视黄经（度） */
  function planetLon(name, T) {
    var h = helio(name, T), e = helio('ear', T);
    return norm360(Math.atan2(h[1] - e[1], h[0] - e[0]) / D2R);
  }

  /* 11 星曜的黄经（度）。jd 用世界时（与历法层一致） */
  function longitudes(jd) {
    var n = jd - 2451545.0;
    var T = n / 36525.0;
    var sun = Astro.sunLongitude(jd);
    var moon = Astro.moonLongitude(jd);
    var node = norm360(125.044 - 0.052954 * n);        // 黄白升交点
    var peri = norm360(83.353 + 0.1114 * n);           // 月球近地点
    return {
      yang: sun,
      yin: moon,
      sui: planetLon('jup', T),
      huo: planetLon('mar', T),
      zhen: planetLon('sat', T),
      jin: planetLon('ven', T),
      shui: planetLon('mer', T),
      luo: node,                                       // 罗睺 = 升交点
      ji: norm360(node + 180),                         // 计都 = 降交点
      bei: norm360(peri + 180),                        // 月孛 = 远地点
      qi: peri                                         // 紫炁 = 近地点
    };
  }

  /* 方位角 → 九宫（北坎1 东北艮8 东震3 东南巽4 南离9 西南坤2 西兑7 西北乾6） */
  function azToPal(az) {
    if (az >= 337.5 || az < 22.5) return 1;
    if (az < 67.5) return 8;
    if (az < 112.5) return 3;
    if (az < 157.5) return 4;
    if (az < 202.5) return 9;
    if (az < 247.5) return 2;
    if (az < 292.5) return 7;
    return 6;
  }

  /* 主入口：算出每个宫有哪些星曜。
     chart —— Qimen.cast() 的结果；lat/lon 观测点。 */
  function place(chart, lat, lon) {
    var jd = chart.calendar.jdUT;
    var L = longitudes(jd);
    var byPal = {}, all = [];
    for (var i = 0; i < STARS.length; i++) {
      var st = STARS[i];
      var g = Astro.geoPos(L[st.key], lat, lon, jd);
      var pal = azToPal(g.az);
      var item = {
        idx: i, key: st.key, name: st.name, short: st.short, cls: st.cls,
        lon: L[st.key], az: g.az, alt: g.alt, pal: pal, up: g.alt > 0
      };
      all.push(item);
      (byPal[pal] = byPal[pal] || []).push(item);
    }
    return { byPal: byPal, all: all, jd: jd, lat: lat, lon: lon };
  }

  var API = { STARS: STARS, longitudes: longitudes, azToPal: azToPal, place: place };
  root.Stars = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
