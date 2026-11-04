/* ============================================================================
 * core.js —— 星曜奇门 · 界面层的共享底座（2026-10-21 从 ui.js 抽出）
 * ----------------------------------------------------------------------------
 * 这里只放「所有页面都要用」的东西：
 *   · 模块引用（Qimen / Patterns / Store / Lunar / Snapshot / Stars）
 *   · 九宫常量、$ / esc / pad / elClass / fmtLL / locTitle
 *   · state（当前盘、当前页面等）与 toast
 *   · window.__xyState（给自动化测试的只读出口）
 *
 * 拆分目标：ui.js 按页面继续拆成 view-*.js 时，各文件一律从 window.App 取共享件，
 * 不再依赖同一个 IIFE 闭包。
 * ========================================================================== */
(function () {
  'use strict';
  var Q = window.Qimen, P = window.Patterns, S = window.Store,
    Lunar = window.Lunar, Snap = window.Snapshot, Stars = window.Stars;

  var CELL = { 1: 'qm_bottom', 2: 'qm_tr', 3: 'qm_left', 4: 'qm_tl', 5: 'qm_mid', 6: 'qm_br', 7: 'qm_right', 8: 'qm_bl', 9: 'qm_top' };
  /* 九宫落格顺序（洛书）：
         巽4  离9  坤2
         震3  中5  兑7
         艮8  坎1  乾6        ← 左下角艮、右下角乾，别写反 */
  var CELL_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6];
  var EL = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };
  var ZHI_WX = ['水','土','木','木','土','火','火','土','金','金','土','水'];
  var JU_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var GAN10 = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    chart: null, analysis: null, starMap: null,
    view: 'home', panBuilt: false,
    mode: 'time',                                  // time | manual | random
    randKind: 'time',                              // 随机模式下：time=随机时刻 | ju=随机一局
    face: 'pan',                                   // pan=九宫盘 | both=卦象·地支面（点中宫切）
    layer: 'shi',                                  // shi=时家 | ri=日家 | yue=月家 | nian=年家
    manual: { polarity: 1, cycle: 1, hourIdx: 0 }, // 自选局
    cxBuilt: false                                 // 起课页的课是否已点「起课」生成
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function elClass(wx) { return 'qm-el-' + (EL[wx] || 'metal'); }
  function fmtLL(lat, lon) {
    return Math.abs(lat).toFixed(3) + '°' + (lat >= 0 ? 'N' : 'S') + ' ' +
      Math.abs(lon).toFixed(3) + '°' + (lon >= 0 ? 'E' : 'W');
  }
  /* 观测点显示名：选城来的有「省|市|区」，手填经纬度的就只剩那对数字 */
  function locTitle() {
    var Loc = window.Loc, s = S.settings.locPath;
    if (s && Loc && Loc.ready) {
      var p = s.split('|');
      if (p.length >= 2) { var t = Loc.label(p[0], p[1], p[2]); if (t) return t; }
    }
    return fmtLL(S.settings.lat, S.settings.lon);
  }

  /* 给自动化测试（以及日后排查）留一个只读出口：把内部状态照出来，
     好让走查能拿"模型"和"画面"对账，而不是只看 DOM 猜。 */
  window.__xyState = function () {
    return {
      view: state.view, layer: state.layer, mode: state.mode, face: state.face,
      manual: { polarity: state.manual.polarity, cycle: state.manual.cycle, hourIdx: state.manual.hourIdx },
      hasChart: !!state.chart, manualChart: !!(state.chart && state.chart.manual),
      chart: state.chart, settings: S.settings, panBuilt: state.panBuilt
    };
  };

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2000);
  }

  window.App = {
    Q: Q, P: P, S: S, Lunar: Lunar, Snap: Snap, Stars: Stars,
    CELL: CELL, CELL_ORDER: CELL_ORDER, EL: EL, ZHI_WX: ZHI_WX, JU_CN: JU_CN, GAN10: GAN10,
    $: $, state: state,
    esc: esc, pad: pad, elClass: elClass, fmtLL: fmtLL, locTitle: locTitle, toast: toast
  };
})();
