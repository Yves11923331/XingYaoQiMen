/* ============================================================================
 * 插件 · 墓星（com.momen.xingyaoqimen / plugins/mu）
 * ----------------------------------------------------------------------------
 * 从 ui.js / snapshot.js 迁出来的第一个真插件（2026-10-25）。
 * 只声明 manifest + palace（盘面 DOM）+ snap（导出图 Canvas），
 * 开关 / 阴盘拦截 / 独占让位 全交给运行时 Plugins 协调，这里不再自己判。
 * ========================================================================== */
(function () {
  'use strict';

  var SVG = '<svg viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.35" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M3.9 14.9V8.1a4.1 4.1 0 0 1 8.2 0v6.8z"/>' +
    '<path d="M8 5.6v5.8M6 7.9h4"/><path d="M2.4 16.3h11.2"/></svg>';

  window.Plugins.register({
    id: 'mu',
    name: '墓星',
    desc: '星门入墓之说，古今本有争议。墓星法自定一规：星门临墓之地，则生一枚墓星。' +
      '墓星者，入墓之虚象也——只标其象，不使事物真陷囚困、衰败。',
    note: '墓支：水／土墓辰 · 木墓未 · 火墓戌 · 金墓丑；中五宫不判。' +
      '碑落在八门行与星曜之间的留白，一宫最多三枚（每个入墓的星、门各一枚）。',
    flags: { blockInYin: true },

    /* 盘面（DOM）：往宫里塞一枚（或多枚）圆顶碑 */
    palace: function (pal, ctx) {
      var mus = ctx.Q.muAt(pal, ctx.p);
      if (!mus || !mus.length) return '';
      return '<div class="qm-mu">' + mus.map(function (it) {
        var nm = it.kind === 'star' ? (ctx.Q.STAR[it.no] || '') : (ctx.Q.GATE[it.no] || '');
        return '<i class="qm-mu-1" title="' + ctx.esc(nm) + '入墓">' + SVG + '</i>';
      }).join('') + '</div>';
    },

    /* 导出图（Canvas）：与 DOM 同位置同形制（ty = y + SH*0.640） */
    snap: function (pal, ctx) {
      var c = ctx.ctx, Q = ctx.Q, x = ctx.x, y = ctx.y, S = ctx.S, SH = ctx.SH, P = ctx.P;
      var list = Q.muAt(pal, ctx.p);
      if (!list || !list.length) return;
      var w = S * 0.098, h = S * 0.116, gap = S * 0.042;
      var n = list.length, total = n * w + (n - 1) * gap;
      var sx = x + (S - total) / 2, ty = y + SH * 0.640;
      c.save();
      c.strokeStyle = P.inkSoft || P.ink2 || P.ink;
      c.lineWidth = Math.max(1, S * 0.0095);
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (var i = 0; i < n; i++) {
        var bx = sx + i * (w + gap);
        c.beginPath();
        c.moveTo(bx + w * 0.16, ty + h * 0.90);
        c.lineTo(bx + w * 0.16, ty + h * 0.40);
        c.arc(bx + w * 0.5, ty + h * 0.40, w * 0.34, Math.PI, 0);
        c.lineTo(bx + w * 0.84, ty + h * 0.90);
        c.stroke();
        c.beginPath();
        c.moveTo(bx + w * 0.5, ty + h * 0.26);
        c.lineTo(bx + w * 0.5, ty + h * 0.68);
        c.moveTo(bx + w * 0.31, ty + h * 0.44);
        c.lineTo(bx + w * 0.69, ty + h * 0.44);
        c.stroke();
        c.beginPath();
        c.moveTo(bx - w * 0.04, ty + h * 0.99);
        c.lineTo(bx + w * 1.04, ty + h * 0.99);
        c.stroke();
      }
      c.restore();
    }
  });
})();
