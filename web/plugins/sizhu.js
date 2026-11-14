/* ============================================================================
 * 插件 · 四柱ui（com.momen.xingyaoqimen / plugins/sizhu）
 * ----------------------------------------------------------------------------
 * 用户 2026-11-01 从 20 套样张里选的 **05「五行色字」**：
 *   · 不铺底、不画框 —— 干支直接取五行色，柱间只一道发丝竖线；
 *   · 字号与高度与原四柱一致（屏上 ≈69px，比原先还矮 19px，抬头不涨、盘子不动）；
 *   · 柱名（年/月/日/时）留在发丝列的正上方，与原版同一位置。
 * 2026-11-14：插件默认适配所有盘，阴盘也用简洁四柱（不再标 blockInYin）。
 *
 * 接口走运行时新加的抬头通道（web/js/plugins.js 的 head / snapHead）：
 *   屏幕侧 head(ctx) → 返回抬头 HTML；导出图侧 snapHead(o) → 直接画并返回高度。
 *   抬头通道**不吃独占让位**：紫微开着时四柱照样换皮（紫微只管星曜）。
 * 样张：设计-四柱ui/预览.html（20 套）· 定版图 设计-四柱ui/样张/white.png
 * ========================================================================== */
(function () {
  'use strict';

  var EL = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };
  /* 时家四柱全给；三层只给本层那一柱，其余画「—」 —— 与 ui.js syncLayerHead 同一口径 */
  var LAYER_KEEP = { shi: [0, 1, 2, 3], nian: [0], yue: [1], ri: [2] };

  /* 这张盘该按哪一层取四柱：手动起局只认识时柱；
     ⚠ 阴盘/心盘也是合成盘（引擎里借 manual:true 渲染），它们有完整年月日时，不能塌成只剩「时」。 */
  function layerOf(chart, chartSub) {
    if (chart && chart.manual && chartSub !== 'yin' && chartSub !== 'xin') return 'manual';
    if (chart && chart.layer) return chart.layer;
    return 'shi';
  }

  function pillarsOf(chart) {
    if (!chart || !chart.calendar || !chart.calendar.index) return [];
    if (!window.Bazi) return [];
    return window.Bazi.pillars(chart.calendar);
  }

  /* 2026-11-02 用户：四柱不再是插件，收进设置（排法 → 四柱：默认 / 简洁）。
     本文件改成定义 window.SizhuUI，由 ui.js / snapshot.js 直接调用（阴盘一律回默认）。 */
  var MANIFEST = {
    id: 'sizhu',
    name: '四柱',
    desc: '抬头四柱换一种排法：干支直接取<b>五行色</b>，不铺底，只一道发丝框，柱间一道竖线。' +
      '字号加大，抬头不撑高、盘不变小。',
    note: '阴盘、手动起局（没有年月日）回默认四柱。导出图同形制。',
    /* 2026-11-14：四柱插件在阴盘同样可用（阴盘也有四柱），不再拦。 */
    flags: {},

    /* ------------------------------------------------------------ 屏幕（DOM） */
    head: function (ctx) {
      var c = ctx.chart;
      if (!c) return '';
      var lay = layerOf(c, ctx.chartSub);
      if (lay === 'manual') return '';                 /* 没有年月日 → 交回默认（画「—」） */
      var ps = pillarsOf(c);
      if (!ps.length) return '';
      var keep = LAYER_KEEP[lay] || LAYER_KEEP.shi;

      var labels = ps.map(function (p, i) {
        return '<i>' + (keep.indexOf(i) >= 0 ? ctx.esc(p.label) : '') + '</i>';
      }).join('');

      var cells = ps.map(function (p, i) {
        if (keep.indexOf(i) < 0) {
          return '<div class="sz-p"><span class="sz-g sz-none">—</span><span class="sz-z sz-none">—</span></div>';
        }
        if (!p.gan) {
          return '<div class="sz-p"><span class="sz-g sz-none">—</span><span class="sz-z sz-none">—</span></div>';
        }
        var cg = 'sz-' + (EL[p.ganWX] || 'metal');
        var cz = 'sz-' + (EL[p.zhiWX] || 'metal');
        return '<div class="sz-p">' +
          '<span class="sz-g ' + cg + '">' + ctx.esc(p.gan) + '</span>' +
          '<span class="sz-z ' + cz + '">' + ctx.esc(p.zhi) + '</span></div>';
      }).join('');

      return '<div class="pk-sz"><div class="sz-lb">' + labels + '</div>' +
        '<div class="sz-g4">' + cells + '</div></div>';
    },

    /* --------------------------------------------------------- 导出图（Canvas）
       几何照抄 snapshot.js 的 drawPillars（标签 26 + 两行 66×2 + 缝 6 + 边距 12 = 176），
       只换画法：不画圆角底/描边，干支取五行色，列间画一道发丝。
       返回 176 —— 下面「值符/值使」与九宫盘的位置一分不差。 */
    snapHead: function (o) {
      var c = o.ctx, P = o.P, chart = o.chart;
      if (!c || !P || !chart) return 0;
      if (o.chartSub === 'yin') return 0;
      var lay = layerOf(chart, o.chartSub);
      if (lay === 'manual') return 0;
      var ps = pillarsOf(chart);
      if (!ps.length) return 0;

      var x = o.x, y = o.y, w = o.w;
      /* 设计 C ·「标签带」（2026-11-03 用户选定）：
         细框 + 柱名独占一条带（带底一道发丝）+ 只在干支区画竖线；
         柱名 22px、干支 34px/600，标签离框顶约 34px。
         几何与预览图 校验/_设计-简洁四柱-C-标签带.png 同一组数（912 宽 / 220 高）。 */
      var cw = w / 4;                    /* 四等分，不做左右内缩 */
      var H = 220;                       /* 框高：标签带 68 + 干支区 152 */
      var keep = LAYER_KEEP[lay] || LAYER_KEEP.shi;
      var SERIF = o.fontSerif || '"QM Serif", "Songti SC", serif';
      var SANS = o.fontSans || '-apple-system, "PingFang SC", sans-serif';

      c.save();
      /* 外框：1px 发丝 + 8px 圆角 */
      var rr = 8;
      c.strokeStyle = P.line; c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + 0.5 + rr, y + 0.5);
      c.arcTo(x + w - 0.5, y + 0.5, x + w - 0.5, y + H - 0.5, rr);
      c.arcTo(x + w - 0.5, y + H - 0.5, x + 0.5, y + H - 0.5, rr);
      c.arcTo(x + 0.5, y + H - 0.5, x + 0.5, y + 0.5, rr);
      c.arcTo(x + 0.5, y + 0.5, x + w - 0.5, y + 0.5, rr);
      c.closePath(); c.stroke();

      /* 标签带底发丝 + 干支区竖线（不穿过标签带） */
      c.strokeStyle = P.line2 || P.line;
      c.beginPath(); c.moveTo(x + 16, y + 68.5); c.lineTo(x + w - 16, y + 68.5); c.stroke();
      for (var i = 1; i < 4; i++) {
        var bx = Math.round(x + cw * i) + 0.5;
        c.beginPath(); c.moveTo(bx, y + 80); c.lineTo(bx, y + 208); c.stroke();
      }

      /* 柱名：22px，标签带里，离框顶约 34px */
      c.font = '400 22px ' + SANS;
      c.fillStyle = P.ink3;
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      for (i = 0; i < 4; i++) {
        if (keep.indexOf(i) < 0) continue;
        c.fillText(ps[i].label, x + cw * i + cw / 2, y + 50);
      }

      /* 干支：34px / 600 */
      c.font = '600 34px ' + SERIF;
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      var rows = [y + 134, y + 190];
      for (i = 0; i < 4; i++) {
        var p = ps[i], cx = x + cw * i + cw / 2;
        var on = keep.indexOf(i) >= 0 && !!p.gan;
        if (!on) {
          c.fillStyle = P.ink3;
          c.fillText('—', cx, rows[0]);
          c.fillText('—', cx, rows[1]);
          continue;
        }
        c.fillStyle = P.el[EL[p.ganWX]] || P.ink;
        c.fillText(p.gan, cx, rows[0]);
        c.fillStyle = P.el[EL[p.zhiWX]] || P.ink;
        c.fillText(p.zhi, cx, rows[1]);
      }
      c.restore();
      return H;
    }
  };
  /* 抬头在导出图里的**实际高度**（供 snapshot.js 先定画布高度）：
     设计 C「标签带」固定框高 220（标签带 68 + 干支区 152），与宽度无关。
     默认矩阵是 176；简洁版 220。render() 必须按这个值留高，
     否则页脚会被顶到画布底（2026-11-02 排查项 2）。 */
  function headHeight() {
    return 220;
  }

  window.SizhuUI = { html: MANIFEST.head, snap: MANIFEST.snapHead, height: headHeight };
})();
