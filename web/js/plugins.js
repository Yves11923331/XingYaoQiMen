/* ============================================================================
 * plugins.js —— 星曜奇门 · 插件运行时（侦查舰版 · 2026-10-25）
 * ----------------------------------------------------------------------------
 * 目标：把「插件」从写死在 ui.js / snapshot.js 里的分支，升级成**可注册**的真插件。
 * 这是**第一版侦查舰**：只解决「注册 / 开关 / 钩子聚合」三件事，够墓星、紫微用，
 * 并把接口留稳（= 预留 AI 写插件的口子）—— AI 以后照 `web/plugins/README.md` 的
 * manifest + 钩子规范，往 `web/plugins/` 丢一个包，主程序自动识别 + 出开关 + 渲染，
 * 不用再碰 ui.js / snapshot.js。
 *
 * 插件能挂的钩子（manifest 里声明）：
 *   palace(pal, ctx) → 返回 HTML 字符串，塞进某个宫（DOM 侧，盘面）。
 *   snap(pal, ctx)   → 导出图（Canvas 侧），可选；ctx 里有 ctx.cv / ctx.ctx 等绘制环境。
 *   （以后可加 onSettings / onLoad 等，先不加，侦查舰只留这两个。）
 *
 * flags（能力标志，主程序据此协调）：
 *   blockInYin : true   插件不入阴盘（用户 2026-10-21 立的硬规矩）
 *   exclusive  : true   独占 —— 开着时抵掉星曜、且其他插件一律让位（紫微用）
 * ========================================================================== */
(function () {
  'use strict';

  var _list = [];          // 按注册顺序
  var _byId = {};

  function register(m) {
    if (!m || !m.id || _byId[m.id]) return false;   // 无 id 或重复注册都忽略
    _byId[m.id] = m;
    _list.push(m);
    return true;
  }

  function list() { return _list.slice(); }
  function byId(id) { return _byId[id] || null; }

  /* 开关：settings.plugins[id] 显式存成 1 才算开（缺键＝默认关，2026-10-25 用户定的规矩） */
  function enabled(id) {
    var S = window.App && window.App.S;
    var pl = S && S.settings && S.settings.plugins;
    return !!(pl && pl[id]);
  }

  function flagsOf(id) {
    var m = _byId[id];
    return (m && m.flags) || {};
  }

  /* 有没有某个「独占」插件当前开着（返回它，没有则 null） */
  function anyExclusive() {
    for (var i = 0; i < _list.length; i++) {
      var m = _list[i];
      if (enabled(m.id) && m.flags && m.flags.exclusive) return m;
    }
    return null;
  }

  /* 某插件是否被「阴盘」拦掉（规矩：插件不入阴盘，三层兜底的第一层） */
  function blockedInYin(id, chartSub) {
    var m = _byId[id];
    return chartSub === 'yin' && !!(m && m.flags && m.flags.blockInYin);
  }

  /* 是否该插件此刻可以渲染（开关 + 阴盘 + 独占让位 三关一起判） */
  function active(id, ctx) {
    if (!enabled(id)) return false;
    if (blockedInYin(id, ctx.chartSub)) return false;
    var excl = anyExclusive();
    if (excl && excl.id !== id) return false;   // 别的独占插件开着 → 让位
    return true;
  }

  /* ── 能力标志 · 2026-11-02 ──
     跟 blockInYin / exclusive 那种「限制」不同，这是一类「宿主据此放出一块功能」的标志：
       任一**启用**的插件带 flags[name] = true → 宿主把那块功能放出来。
     现有用法：
       flags.layers —— 「日月年家」插件（web/plugins/layers.js）。宿主 ui.js 的 applyLayers()
                       读它决定起盘页要不要露出「时家 / 日家 / 月家 / 年家」四层切换。
     这样宿主不必写死插件名，插件也不用手写开关逻辑（开关键仍走 settings.plugins[id]）。 */
  function flagOn(name) {
    for (var i = 0; i < _list.length; i++) {
      var m = _list[i];
      if (enabled(m.id) && m.flags && m.flags[name]) return true;
    }
    return false;
  }

  /* ── 盘面（DOM）：聚合所有可用插件的 palace 钩子，拼成 HTML ── */
  function palaceHTML(pal, ctx) {
    var html = '';
    for (var i = 0; i < _list.length; i++) {
      var m = _list[i];
      if (!active(m.id, ctx)) continue;
      if (typeof m.palace === 'function') {
        var h = m.palace(pal, ctx);
        if (h) html += h;
      }
    }
    return html;
  }

  /* ── 宫格外壳类名钩子 · 2026-11-12 新增 ──
     有的插件改的不是"往宫里塞字"，而是宫卡本身（虚实法改边框色）。
     palace() 只能吐宫内容、管不到外壳，所以单独留这一条：返回类名字符串，
     宿主 renderPan 每轮把它挂到 .qm-cell 上（关插件即消失，不会留残类）。
     仍然过 active() 三关（开关 / 不入阴盘 / 独占让位）。 */
  function cellClass(pal, ctx) {
    var out = '';
    for (var i = 0; i < _list.length; i++) {
      var m = _list[i];
      if (!active(m.id, ctx)) continue;
      if (typeof m.cellClass === 'function') {
        var c = m.cellClass(pal, ctx);
        if (c) out += (out ? ' ' : '') + c;
      }
    }
    return out;
  }

  /* ── 抬头（四柱）钩子 · 2026-11-01 新增 ──
     抬头不在九宫里，是「盘面之外的一行字」，所以单独一条通道，口径和 palace/snap 略有不同：
       · 不吃「独占让位」：紫微只管星曜，它开着不该把四柱换皮也带走；
       · 仍然守「插件不入阴盘」（blockInYin），阴盘一律交回默认四柱。
     只认第一个有 head 的启用插件（抬头只有一份，不做聚合）。 */
  function headOwner(ctx) {
    for (var i = 0; i < _list.length; i++) {
      var m = _list[i];
      if (!enabled(m.id)) continue;
      if (blockedInYin(m.id, ctx && ctx.chartSub)) continue;
      if (typeof m.head === 'function') return m;
    }
    return null;
  }
  function headHTML(ctx) {
    var m = headOwner(ctx);
    if (!m) return '';
    var h = m.head(ctx);
    return h || '';
  }
  /* 导出图那一侧：返回画出来的高度（0 / false＝没画，交回主程序的 drawPillars） */
  function headSnap(ctx) {
    var m = headOwner(ctx);
    if (!m || typeof m.snapHead !== 'function') return 0;
    var h = m.snapHead(ctx);
    return (typeof h === 'number' && h > 0) ? h : 0;
  }

  /* ── 整张图（poster）通道 · 2026-11-01 ──
     有插件声明 poster 且开着，截图就整张交给它（浑仪这类「整版海报」用）。
     第一条：只认开关，不吃独占让位，也不吃「不入阴盘」——它换的是**导出的整张图**，不是盘面贴片。 */
  function posterOwner() {
    for (var i = 0; i < _list.length; i++) {
      var m = _list[i];
      if (!enabled(m.id)) continue;
      if (typeof m.poster === 'function') return m;
    }
    return null;
  }
  function poster(chart, analysis, starMap, opts) {
    var m = posterOwner();
    if (!m) return null;
    try { return m.poster(chart, analysis, starMap, opts) || null; }
    catch (e) { return null; }
  }

  /* ── 导出图（Canvas）：聚合所有可用插件的 snap 钩子 ── */
  function snapDraw(pal, ctx) {
    for (var i = 0; i < _list.length; i++) {
      var m = _list[i];
      if (!active(m.id, ctx)) continue;
      if (typeof m.snap === 'function') m.snap(pal, ctx);
    }
  }

  window.Plugins = {
    register: register,
    list: list,
    byId: byId,
    enabled: enabled,
    flagsOf: flagsOf,
    anyExclusive: anyExclusive,
    blockedInYin: blockedInYin,
    flagOn: flagOn,
    active: active,
    headOwner: headOwner,
    posterOwner: posterOwner,
    poster: poster,
    headHTML: headHTML,
    headSnap: headSnap,
    palaceHTML: palaceHTML,
    cellClass: cellClass,
    snapDraw: snapDraw,
    _list: _list,
    _byId: _byId
  };
})();
