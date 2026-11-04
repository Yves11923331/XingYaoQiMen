/* ============================================================================
 * 插件 · 紫微（com.momen.xingyaoqimen / plugins/zw）
 * ----------------------------------------------------------------------------
 * 从 ui.js（zwCellHTML）/ snapshot.js（drawZw）迁出来的第二个真插件（2026-10-25）。
 * 安星引擎仍在 web/js/ziwei.js（window.Ziwei，iztro 口径），这里只做渲染。
 *
 * flags.exclusive = true：开着时主程序自动抵掉星曜、其他插件（如墓星）让位。
 * flags.blockInYin = true：不入阴盘（硬规矩）。
 * ========================================================================== */
(function () {
  'use strict';

  var HUA_CLS = { '禄': 'lu', '权': 'quan', '科': 'ke', '忌': 'ji' };
  var HUA = ['禄', '权', '科', '忌'];

  /* 拿紫微数据：屏幕侧主程序已算好放 ctx.zw；导出侧（可能 undefined）这里懒算并缓存到 chart.__zw */
  function getZw(ctx) {
    var z = ctx.zw;
    if (z === undefined && ctx.chart && ctx.chart.calendar && window.Ziwei) {
      try { z = ctx.chart.__zw = window.Ziwei.cast(ctx.chart.calendar); }
      catch (e) { z = ctx.chart.__zw = null; }
    }
    return z || null;
  }

  window.Plugins.register({
    id: 'zw',
    name: '紫微',
    desc: '紫微斗数十四主星：寅起正月顺数生月定命宫，纳音取五行局，日数定紫微，' +
      '紫微系逆布、天府系顺布。此处按地支折进九宫——四隅宫并两支（宫中之宫）、四正宫一支；' +
      '四化（禄／权／科／忌）按年干。',
    note: '只标落在十四主星上的四化；文昌·文曲·左辅·右弼身上的四化不显示。' +
      '紫微开着时星曜自动让位——关掉插件即恢复，不改「显示星曜」那条设置。',
    flags: { blockInYin: true, exclusive: true },

    /* 盘面（DOM）：宫中之宫 = 支做列头 + 每行一颗星（星名·亮度·四化贴行右缘） */
    palace: function (pal, ctx) {
      var z = getZw(ctx);
      if (!z) return '';
      var stars = z.byPal[pal] || [];
      var brs = ctx.Q.PAL_ZHI[pal] || [];
      if (!brs.length) return '';               /* 中五宫不纳支，不画 */
      var byBr = {};
      stars.forEach(function (s) { (byBr[s.branchName] = byBr[s.branchName] || []).push(s); });
      var minors = z.byPalMinor[pal] || [];
      var one = brs.length === 1;
      var html = '<div class="qm-zw2">' + brs.map(function (br) {
        var list = byBr[br] || [];
        var mins = minors.filter(function (s) { return s.hua && s.branchName === br; });
        var rows = list.map(function (s) {
          return '<div class="zw-row"><span class="nm">' + ctx.esc(s.name) + '</span>' +
            (s.bright ? '<i class="b">' + ctx.esc(s.bright) + '</i>' : '') +
            (s.hua ? '<i class="h ' + HUA_CLS[s.hua] + '">' + s.hua + '</i>' : '') + '</div>';
        }).join('') + mins.map(function (s) {
          return '<div class="zw-row mm"><span class="nm">' + ctx.esc(s.name) + '</span>' +
            '<i class="h ' + HUA_CLS[s.hua] + '">' + s.hua + '</i></div>';
        }).join('');
        var dense = (list.length + mins.length) >= 4 ? ' dense' : '';
        return '<div class="zw-col' + (one ? ' one' : '') + '">' +
          '<div class="zw-head">' + ctx.esc(br) + '</div>' +
          '<div class="zw-rows' + dense + '">' + rows + '</div>' +
          '</div>';
      }).join('') + '</div>';
      return html;
    },

    /* 导出图（Canvas）：与 DOM 同位置同形制（blockTop = y + SH*0.595） */
    snap: function (pal, ctx) {
      var z = getZw(ctx);
      if (!z) return;
      var stars = z.byPal[pal] || [];
      var brs = (ctx.Q.PAL_ZHI && ctx.Q.PAL_ZHI[pal]) || [];
      if (!brs.length) return;
      var byBr = {};
      stars.forEach(function (s) { (byBr[s.branchName] = byBr[s.branchName] || []).push(s); });
      var minors = z.byPalMinor[pal] || [];

      var c = ctx.ctx, P = ctx.P, x = ctx.x, y = ctx.y, S = ctx.S, SH = ctx.SH;
      var SERIF = ctx.SERIF, SANS = ctx.SANS, rgba = ctx.rgba;
      var huaColor = function (h) {
        if (h === '禄') return P.el.wood;
        if (h === '权') return P.el.fire;
        if (h === '科') return P.el.water;
        return P.ink;
      };

      var boxL = x + S * 0.071, boxR = x + S * 0.929;
      var colW = (boxR - boxL) / 2;
      var startL = boxL;

      var fsStar = Math.max(8, Math.round(S * 0.078));
      var fsBright = Math.max(6, Math.round(S * 0.060));
      var fsZhi = Math.max(5, Math.round(S * 0.056));
      var headH = fsZhi * 1.6;

      /* ★ 2026-11-02 用户：宫中宫（紫微导出图）原来钉在 SH*0.595 太靠上 ——
         改成**按块高从宫底往上排**：最长的一列贴底部留白（SH*0.055 ≈ 5.5%），
         支头统一对齐，行数少的那列底部自然多留白（与屏幕 .qm-zw2 的 bottom 留白同口径）。 */
      var maxBlockH = 0;
      for (var i0 = 0; i0 < brs.length; i0++) {
        var rc0 = (byBr[brs[i0]] || []).length
          + minors.filter(function (s2) { return s2.hua && s2.branchName === brs[i0]; }).length;
        var lh0 = fsStar * (rc0 >= 4 ? 1.5 : 1.85);
        var h0 = headH + fsStar * 0.9 + Math.max(0, rc0 - 1) * lh0 + fsStar * 0.45;
        if (h0 > maxBlockH) maxBlockH = h0;
      }
      var blockTop = y + SH - SH * 0.055 - maxBlockH;

      for (var i = 0; i < brs.length; i++) {
        var br = brs[i], list = byBr[br] || [];
        var mins = minors.filter(function (s2) { return s2.hua && s2.branchName === br; });
        var colX = startL + colW * i;
        var rowCount = list.length + mins.length;
        var lineH = fsStar * (rowCount >= 4 ? 1.5 : 1.85);
        var yy = blockTop + headH + fsStar * 0.9;

        if (i > 0) {
          c.beginPath();
          c.moveTo(colX, blockTop);
          c.lineTo(colX, yy + Math.max(0, rowCount - 1) * lineH + fsStar * 0.45);
          c.strokeStyle = P.hair; c.lineWidth = 1; c.stroke();
        }
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        c.font = '400 ' + fsZhi + 'px ' + SANS;
        c.fillStyle = rgba(P.ink3, .68);
        c.fillText(br, colX + S * 0.004, blockTop + fsZhi);

        for (var k = 0; k < list.length; k++) {
          var st2 = list[k];
          c.font = '700 ' + fsStar + 'px ' + SERIF;
          var wName = c.measureText(st2.name).width;
          c.fillStyle = P.ink2;
          c.fillText(st2.name, colX + S * 0.004, yy);
          if (st2.bright) {
            c.font = '600 ' + fsBright + 'px ' + SANS;
            c.fillStyle = rgba(P.ink2, .5);
            c.fillText(st2.bright, colX + S * 0.004 + wName + S * 0.004, yy);
          }
          if (st2.hua) {
            c.font = '800 ' + fsZhi + 'px ' + SERIF;
            c.fillStyle = huaColor(st2.hua);
            c.textAlign = 'right';
            c.fillText(st2.hua, colX + colW - S * 0.008, yy);
            c.textAlign = 'left';
          }
          yy += lineH;
        }
        for (var mi = 0; mi < mins.length; mi++) {
          var mm = mins[mi];
          c.font = '600 ' + Math.round(fsStar * 0.9) + 'px ' + SERIF;
          c.fillStyle = rgba(P.ink2, .72);
          c.fillText(mm.name, colX + S * 0.004, yy);
          c.font = '800 ' + fsZhi + 'px ' + SERIF;
          c.fillStyle = huaColor(mm.hua);
          c.textAlign = 'right';
          c.fillText(mm.hua, colX + colW - S * 0.008, yy);
          c.textAlign = 'left';
          yy += lineH;
        }
      }
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    }
  });
})();
