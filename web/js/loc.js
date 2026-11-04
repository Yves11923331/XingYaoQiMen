/* ============================================================================
 * loc.js —— 观测位置：内置城市库 + 最近城市反查
 * ----------------------------------------------------------------------------
 * 城市数据 cities.js **整份抄自 mQimen**（js/cities.js，123KB）：
 *   window.$mqmCity = { 省/国: { 市: [ [市中心纬度,经度], [ [区县,纬度,经度], … ] ] } }
 *   window.$mqmChinaEnd = "台湾省"  —— 前 34 个顶层键为中国大陆及港澳台，之后是海外
 * 抄它是因为它够全（102 个顶层键 / 537 个市 / 3190 个区县），而且是纯静态数据，
 * 不联网、不依赖系统地理编码 —— 手机上"定位"经常拿不到逆地理，选城反而永远可靠。
 *
 * 本文件只做三件事：
 *   1) 把三级结构摊平成一张可选点表（省/市/区 各一个坐标）
 *   2) 最近点反查（定位成功后落成"最近的城市/区县"，而不是一串裸经纬度）
 *   3) 给设置页提供 省 / 市 / 区 三级列表
 * 坐标一律 [纬度, 经度]，东经北纬为正 —— 与 Store.settings.lat/lon 一致。
 * ========================================================================== */
(function () {
  'use strict';
  var C = (typeof window.$mqmCity !== 'undefined') ? window.$mqmCity : null;
  var PROVS = C ? Object.keys(C) : [];

  /* 中国区 / 海外区的分界（$mqmChinaEnd 指向中国区最后一个顶层键） */
  var BD = (function () {
    var e = window.$mqmChinaEnd;
    if (!e) return PROVS.length;
    var i = PROVS.indexOf(e);
    return i < 0 ? PROVS.length : i + 1;
  })();

  /* 摊平的点表（惰性构建：3727 项，一次性） */
  var FLAT = null;
  function flat() {
    if (FLAT) return FLAT;
    FLAT = [];
    if (!C) return FLAT;
    PROVS.forEach(function (p) {
      var cs = C[p];
      for (var c in cs) {
        if (!Object.prototype.hasOwnProperty.call(cs, c)) continue;
        var node = cs[c], areas = node[1] || [];
        for (var i = 0; i < areas.length; i++) {
          FLAT.push({ p: p, c: c, a: areas[i][0], lat: areas[i][1], lon: areas[i][2], center: false });
        }
        /* 市级中心单独留一条（区县都没选时的兜底 / 无区县地级市的主坐标） */
        FLAT.push({ p: p, c: c, a: '', lat: node[0][0], lon: node[0][1], center: true });
      }
    });
    return FLAT;
  }

  function provs(tab) {
    return (tab === 'ot') ? PROVS.slice(BD) : PROVS.slice(0, BD);
  }
  function tabOf(p) { return PROVS.indexOf(p) >= BD ? 'ot' : 'cn'; }
  function cities(p) {
    if (!C || !C[p]) return [];
    var out = [], cs = C[p];
    for (var c in cs) if (Object.prototype.hasOwnProperty.call(cs, c)) out.push(c);
    return out;
  }
  function areas(p, c) {
    if (!C || !C[p] || !C[p][c]) return [];
    return (C[p][c][1] || []).map(function (a) { return { name: a[0], lat: a[1], lon: a[2] }; });
  }
  /* 只有一个与市同名的伪区县（海外 / 无区县地级市）时，第三级没有意义 —— 由界面隐藏 */
  function areaHidden(p, c) {
    var a = areas(p, c);
    return a.length <= 1 && (!a.length || a[0].name === c);
  }
  /* 取坐标：给了区县用区县，否则用市中心 */
  function at(p, c, an) {
    if (!C || !C[p] || !C[p][c]) return null;
    var node = C[p][c];
    if (an) {
      var list = node[1] || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i][0] === an) return { lat: list[i][1], lon: list[i][2] };
      }
    }
    return { lat: node[0][0], lon: node[0][1] };
  }
  /* 显示名：省市同名的直辖市只写一遍 */
  function label(p, c, an) {
    var parts = [];
    if (p && p !== c) parts.push(p);
    if (c) parts.push(c);
    if (an && an !== c) parts.push(an);
    return parts.join(' · ');
  }

  /* 最近点反查：等距圆柱近似（按纬度压经度），城市尺度上足够；
     返回 {p,c,a,lat,lon,km} —— km 是粗距离，用来在界面上说一句"约 xx km"。
     同一距离上优先取有区县的那条（避免总是落到市中心）。 */
  function nearest(lat, lon) {
    var f = flat();
    if (!f.length) return null;
    var cl = Math.cos(Math.max(-85, Math.min(85, lat)) * Math.PI / 180);
    var best = null, bd = Infinity, bcenter = true;
    for (var i = 0; i < f.length; i++) {
      var dy = f[i].lat - lat, dx = (f[i].lon - lon) * cl;
      var d = dy * dy + dx * dx;
      var tie = Math.abs(d - bd) < 1e-12;
      if (d < bd - 1e-12 || (tie && bcenter && !f[i].center)) {
        bd = d; best = f[i]; bcenter = f[i].center;
      }
    }
    if (!best) return null;
    return { p: best.p, c: best.c, a: best.a, lat: best.lat, lon: best.lon, km: Math.sqrt(bd) * 111.32 };
  }

  window.Loc = {
    ready: !!C,
    count: function () { return flat().length; },
    provs: provs,
    tabOf: tabOf,
    cities: cities,
    areas: areas,
    areaHidden: areaHidden,
    at: at,
    label: label,
    nearest: nearest
  };
})();
