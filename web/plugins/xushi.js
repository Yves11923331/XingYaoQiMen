/* ============================================================================
 * plugins/xushi.js —— 插件 · 虚实法（2026-11-12 用户提）
 * ----------------------------------------------------------------------------
 * 口径（用户原话）：八宫各纳十二支，四柱地支里只要有一支落在本宫所纳的支里，
 * 这一宫就是「实」。

 *   坎1 子 · 艮8 丑寅 · 震3 卯 · 巽4 辰巳 · 离9 午 · 坤2 未申 · 兑7 酉 · 乾6 戌亥
 *   中5 不纳支 → 恒为「虚」（2026-11-12 用户点名：中五默认也是浅色）
 *
 * 表现：实宫宫卡边框加深、虚宫变浅，只改边框，**不往宫里塞任何字**。
 * 因此走两条非 palace 的通道：
 *   · cellClass(pal, ctx) → 给 .qm-cell 挂 qm-xs-shi / qm-xs-xu（宿主 2026-11-12 新加的钩子）
 *   · snap(pal, ctx)      → 导出图里把宫卡边框重描一遍（同色同宽，屏幕与出图一致）
 *
 * 2026-11-14 起**阴盘也渲染**（插件默认适配所有盘；阴盘同样有四柱与纳支）。
 * ========================================================================== */
(function () {
  'use strict';

  /* 宫 → 纳支（与 qimen.js 的 PAL_ZHI 同表，这里自带一份，插件不依赖内部导出） */
  var PAL_ZHI = {
    1: ['子'],
    8: ['丑', '寅'],
    3: ['卯'],
    4: ['辰', '巳'],
    9: ['午'],
    2: ['未', '申'],
    7: ['酉'],
    6: ['戌', '亥']
  };

  /* 四柱地支（年/月/日/时，各取第二字） */
  function branches(chart) {
    var gz = chart && chart.calendar && chart.calendar.ganzhi;
    if (!gz) return [];
    var out = [];
    ['year', 'month', 'day', 'hour'].forEach(function (k) {
      var s = gz[k];
      if (s && s.length > 1) out.push(s.charAt(1));
    });
    return out;
  }

  /* 这一宫是不是「实」：本宫所纳之支 ∩ 四柱之支 ≠ ∅ */
  function isShi(pal, chart) {
    var zs = PAL_ZHI[pal];
    if (!zs) return false;                       /* 中五：不纳支，恒虚 */
    var bs = branches(chart);
    for (var i = 0; i < zs.length; i++) {
      if (bs.indexOf(zs[i]) >= 0) return true;
    }
    return false;
  }

  /* ── 导出图用的小工具：把"墨色 × 若干透明"折算成实色 ──
     屏幕是 color-mix(ink 66%, transparent) 叠在页面底色上；画布没有 color-mix，
     直接算成「ink 与 page.bg 按比例混出来的实色」，颜色才和屏幕一模一样。 */
  function parseColor(s) {
    s = String(s || '').trim();
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    if (m) {
      var h = m[1];
      if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = /^rgba?\(([^)]+)\)$/i.exec(s);
    if (m) {
      var p = m[1].split(',');
      return [parseFloat(p[0]) || 0, parseFloat(p[1]) || 0, parseFloat(p[2]) || 0];
    }
    return [27, 32, 40];
  }
  function blend(fg, bg, a) {
    var r = Math.round(fg[0] * a + bg[0] * (1 - a));
    var g = Math.round(fg[1] * a + bg[1] * (1 - a));
    var b = Math.round(fg[2] * a + bg[2] * (1 - a));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  Plugins.register({
    id: 'xushi',
    name: '虚实法',
    desc: '按宫位纳支看四柱：<b>有支的宫（实）宫卡边框加深，没有的（虚）变浅</b>；' +
      '坎子 · 艮丑寅 · 震卯 · 巽辰巳 · 离午 · 坤未申 · 兑酉 · 乾戌亥，中五不纳支、恒为虚。',
    note: '只改宫卡边框，不动盘里任何字；不入阴盘。',
    /* 2026-11-14：阴盘也有四柱与纳支，虚实法不再拦。 */
    flags: {},

    /* 盘面：类名交给宿主挂到 .qm-cell 上（见 plugins.js 的 cellClass） */
    cellClass: function (pal, ctx) {
      return isShi(pal, ctx && ctx.chart) ? 'qm-xs-shi' : 'qm-xs-xu';
    },

    /* 导出图：卡片边框已经用 P.frame 画过一道，这里按虚实**重描**成目标色。
       用「ink × 透明度 与页面底色混出的实色」直接盖，不先擦 —— 盖住即可，
       宽度多给 0.8k 是为了把原来那道 1px 完全压掉（否则边上会透出一条旧线）。 */
    snap: function (pal, c) {
      var ctx = c && c.ctx;
      if (!ctx || !c.P) return;
      var x = c.x, y = c.y, S = c.S, SH = c.SH, P = c.P, M = c.M;
      var k = M ? M.k : S / 112;
      var w = Math.max(1, k);
      var R = 6 * k;
      var shi = isShi(pal, c.chart);
      var ink = parseColor(P.ink), bg = parseColor(P.bg || P.surface);
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x + w / 2, y + w / 2, S - w, SH - w, R);
      } else {
        var r = Math.min(R, S / 2, SH / 2);
        ctx.moveTo(x + w / 2 + r, y + w / 2);
        ctx.arcTo(x + S - w / 2, y + w / 2, x + S - w / 2, y + SH - w / 2, r);
        ctx.arcTo(x + S - w / 2, y + SH - w / 2, x + w / 2, y + SH - w / 2, r);
        ctx.arcTo(x + w / 2, y + SH - w / 2, x + w / 2, y + w / 2, r);
        ctx.arcTo(x + w / 2, y + w / 2, x + S - w / 2, y + w / 2, r);
        ctx.closePath();
      }
      ctx.lineWidth = w + 0.8;
      ctx.strokeStyle = blend(ink, bg, shi ? .66 : .15);
      ctx.stroke();
      ctx.restore();
    }
  });
})();
