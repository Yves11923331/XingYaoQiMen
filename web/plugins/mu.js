/* ============================================================================
 * 插件 · 墓星（com.momen.xingyaoqimen / plugins/mu）
 * ----------------------------------------------------------------------------
 * 2026-11-13：碑改成**位图掩膜**（与马星同一套做法），并从「八门行与星曜之间的留白」
 *   挪进**右上角标组**，与空亡 / 马星同一行：一宫最多一枚（只标其象，不按星/门各出一枚）。
 *   角标组是 ui.js 生成的（.qm-void，右上角 flex 行），本插件不碰 ui.js / pan.css：
 *   自己绝对定位，按空亡 / 马星的有无算 right；样式与掩膜变量也在本文件里注入。
 *   ⚠ 2026-11-13 用户：**只在标准盘上显示，不再为了它把整盘切回老 UI**
 *     （ui.js / snapshot.js 的 oldUIOn 已把 mu 摘出去；zw / sxm 仍按老规矩切）。
 *   ⚠ 阴盘**一律不渲染**（flags.blockInYin）：阴盘只显示它自己那套（星门干 + 暗干），
 *     这是硬规矩、不是开关 —— 别为了「角标与排法无关」给它开口子。
 * ========================================================================== */
(function () {
  'use strict';

  /* 掩膜：墓碑 + 宽碑座，RGBA 100×154（alpha 定形，RGB 全 0），与马星同构。
     来源 设计-布盘/墓星/墓星-掩膜-256x154.png —— 屏幕 CSS mask、导出图 canvas 共用这一份。 */
  var MASK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAACaCAYAAABfeu09AAABZUlEQVR42u3Ziw2DQAxEQbz990xqQOFggXkFRJxH5qPM1t2+6Hen9cDZVNV8aCseMYP5METlLAZE10wGRNdsBkTXjAKj65oDo+vaB0bXzAKj6zyB0XWuwOg6X2B0FRhdZw2MrjMHRtfZ/R/y0meIh/hJM7AhL9wQ23HiLGzIyzbEdpw8ExvygS913QTidrVgNjbELUtAgOhqEA/0RTOyIW5ZAgJEQIAICBABASIgAgJEQIAICBABASIgAgJEQIAICBABASIgAgJEQIAICBABASIgAgJEQIAICBABASIgAgJEQIAICBABASIgAgJEQIAICBABASIgAgJEQIAICBABASIgAgJEQIAICBABASIgAgJEQIAICBABAaLHgIzRrZmRDXHL0j9rtRvRtXMPjFvaj4LAuAklMLpQAqMLxVtW8Wuv7SjYkgHhw1BAgAgIEAEBIiBABERAgAgIEAEBIiBABERAgOhwP9GeLwjSsAb+AAAAAElFTkSuQmCC';

  var CSS = [
    '.qm-mark-mu{position:absolute;top:4px;width:8.5px;height:13px;pointer-events:none;',
    'background-color:var(--ink);',
    '-webkit-mask:var(--qm-mu-mask) center/contain no-repeat;',
    'mask:var(--qm-mu-mask) center/contain no-repeat}'
  ].join('');

  function inject() {
    try {
      var st = document.getElementById('mu-style');
      if (!st) {
        st = document.createElement('style');
        st.id = 'mu-style';
        st.textContent = CSS;
        (document.head || document.documentElement).appendChild(st);
      }
      document.documentElement.style.setProperty('--qm-mu-mask', 'url("' + MASK + '")');
    } catch (e) {}
  }
  inject();

  /* 导出图用的位图（离屏 source-in 染色，与马星同一个套路） */
  var _img = null, _ready = false;
  try {
    _img = new Image();
    _img.onload = function () { _ready = true; };
    _img.src = MASK;
  } catch (e) { _img = null; }

  function drawMask(c, x, y, w, h, color) {
    if (!_ready || !(w > 0) || !(h > 0)) return;
    var oc = document.createElement('canvas');
    oc.width = Math.max(1, Math.round(w));
    oc.height = Math.max(1, Math.round(h));
    var g = oc.getContext('2d');
    g.drawImage(_img, 0, 0, oc.width, oc.height);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, oc.width, oc.height);
    c.drawImage(oc, x, y, w, h);
  }

  /* 角标组里的右偏移：组是 .qm-void（right 7 / 8、gap 3），空亡 13、马星 17.5；
     墓星 8.5×13 排在它们左边，**与组内同一档 3px 间距**（2026-11-13 实测校准：
     空亡左缘离宫右 21、马星左缘 25.5 → 碑右缘各再让 3px）。 */
  function rightOf(p) {
    /* 与角标组同一档间距 3px。空亡是描边圆（笔触内缩 .8）、马星是位图剪影（左缘自带 ~1.5
       透明边），所以"墨迹间距"会是 ~3.8 / ~4.5 —— 两组都在 3–4.5 之间，看上去是同一档。 */
    return 7 + (p && p.kong ? 13 + 3 : 0) + (p && p.ma ? 17.5 + 3 : 0);
  }

  window.Plugins.register({
    id: 'mu',
    name: '墓星',
    desc: '星门入墓之说，古今本有争议。墓星法自定一规：星门临墓之地，则生一枚墓星。' +
      '墓星者，入墓之虚象也——只标其象，不使事物真陷囚困、衰败。',
    note: '墓支：水／土墓辰 · 木墓未 · 火墓戌 · 金墓丑；中五宫不判。' +
      '碑作**右上角标**（与空亡 / 马星同一行、同一档间距），一宫最多一枚；只标其象。',
    /* 插件不入阴盘（硬规矩）：阴盘里星门干 + 暗干之外不挂任何插件渲染。 */
    flags: { blockInYin: true },

    /* 盘面（DOM）：角标组里补一枚碑（不碰宿主 DOM，绝对定位） */
    palace: function (pal, ctx) {
      var mus = ctx.Q.muAt(pal, ctx.p);
      if (!mus || !mus.length) return '';
      var it = mus[0];
      var nm = it.kind === 'star' ? (ctx.Q.STAR[it.no] || '') : (ctx.Q.GATE[it.no] || '');
      return '<i class="qm-mark-mu" title="' + ctx.esc(nm) + '入墓"'
        + ' style="right:' + rightOf(ctx.p) + 'px"></i>';
    },

    /* 导出图（Canvas）：同一枚碑、同一组几何（单位 k = 单卡宽 / 112） */
    snap: function (pal, ctx) {
      var list = ctx.Q.muAt(pal, ctx.p);
      if (!list || !list.length) return;
      var S = ctx.S, k = S / 112, P = ctx.P;
      var mw = 8.5 * k, mh = 13 * k;
      var x = ctx.x + S - rightOf(ctx.p) * k - mw;
      var y = ctx.y + 4 * k;
      drawMask(ctx.ctx, x, y, mw, mh, P.ink);
    }
  });
})();
