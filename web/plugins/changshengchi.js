/* ============================================================================
 * 插件 · 长生尺（com.momen.xingyaoqimen / plugins/changshengchi，id 仍为 sxm）
 * ----------------------------------------------------------------------------
 * 2026-11-01 用户定版：**只做天地盘干的十二长生**（不做寄干、不重排神星门）。
 * 形制＝样张里的「三轨长生尺」去掉寄干那条：
 *
 *   天 ─┼┼┼·临┼┼┼┼┼┼┼┼┤
 *   地 ─┼┼┼┼┼┼┼┼·墓┼┼┼┤
 *
 *   · 一条十二长生刻度（长生在左、养在右），点亮的格子里写该阶的字；
 *   · 天盘干一轨、地盘干一轨；
 *   · **墓不另列**（已在十二长生里）：两支里只要有一支走到「墓」，这一格就论墓 ——
 *     尺上直接写「墓」，字加黑并压一道横线（不是写「绝」再补线）。
 *   · **击刑** → 字用<b>朱红</b>；又墓又刑 → 朱红「墓」字 + 黑横线。
 *   · 其余两组一律「取舍＝尺上显示」：选了哪一阶，尺上就写哪一阶。
 *
 * 【两长生取一】（用户「抓主要矛盾」口径，2026-11-01）
 *   四隅宫纳两支 → 一颗干同时落在相邻两阶上，只取一阶：
 *     阳干顺行：冠带+临官→临官 · 衰+病→衰 · 墓+绝→<b>墓</b> · 养+长生→长生
 *     阴干逆行：帝旺+衰→帝旺 · 冠带+沐浴→沐浴 · 胎+养→胎 · 死+墓→墓
 *   已穷举核验：阳干只可能出现这 4 组、阴干只可能出现这 4 组，无遗漏。
 *   「衰+病 / 胎+养」用户定为不强行区分，这里各取前者（衰 / 胎）。
 *
 * 【口径】
 *   ① 十二长生：阳干顺行、阴干逆行；甲亥 乙午 丙寅 丁酉 戊寅 己酉 庚巳 辛子 壬申 癸卯 起长生。
 *   ② 入墓：**十干长生墓**（阴干逆行自带的那一阶），即该宫某支上此干正好走到「墓」：
 *      甲未 乙戌 丙戌 丁丑 戊戌 己丑 庚丑 辛辰 壬辰 癸未。
 *      ⚠ 不是「五行墓」—— 癸墓未、辛墓辰、己墓丑，与壬癸同墓辰那套不同（用户 2026-11-01 定）。
 *   ③ 击刑：只论六仪（戊震三 / 己坤二 / 庚艮八 / 辛离九 / 壬巽四 / 癸巽四），三奇不刑；
 *      天盘、地盘各自判（客断看天盘、主断看地盘）。坎乾兑永不成刑。
 *   ④ 阴盘不渲染（插件不入阴盘）。
 * ========================================================================== */
(function () {
  'use strict';

  var LONG = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  var SHORT = { 长生: '生', 沐浴: '浴', 冠带: '冠', 临官: '临', 帝旺: '旺', 衰: '衰', 病: '病', 死: '死', 墓: '墓', 绝: '绝', 胎: '胎', 养: '养' };
  var START = { 甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';
  var YANG_GAN = '甲丙戊庚壬';
  var WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  var EL = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };

  /* 两长生取一：键＝两阶下标（升序），值＝取的那一阶下标。阳/阴各一张表 */
  var MERGE = {
    yang: { '2,3': 3, '5,6': 5, '8,9': 9, '0,11': 0 },
    yin: { '4,5': 4, '1,2': 1, '7,8': 8, '10,11': 10 }
  };

  function isYang(gan) { return YANG_GAN.indexOf(gan) >= 0; }

  /* 十二长生：gan 在 zhi 上是第几阶（返回下标） */
  function stageIdx(gan, zhi) {
    var s = ZHI.indexOf(START[gan]);
    var zi = ZHI.indexOf(zhi);
    if (s < 0 || zi < 0) return -1;
    return isYang(gan) ? (zi - s + 12) % 12 : (s - zi + 12) % 12;
  }

  /* 两阶合并成一阶（单支宫直接返回那一个） */
  function mergeIdx(gan, idxs) {
    var list = idxs.filter(function (i) { return i >= 0; });
    if (!list.length) return -1;
    if (list.length === 1) return list[0];
    var key = list.slice().sort(function (a, b) { return a - b; }).join(',');
    var tbl = isYang(gan) ? MERGE.yang : MERGE.yin;
    return tbl[key] !== undefined ? tbl[key] : list[0];
  }

  /* 最终取舍：有墓则论墓，否则按合并表 —— 与尺上显示的阶完全一致 */
  function pickIdx(gan, idxs) {
    if (idxs.indexOf(8) >= 0) return 8;               /* 8＝墓：两支里有一支到墓就论墓 */
    return mergeIdx(gan, idxs);
  }

  /* 一颗干的全部取象（天/地各调一次） */
  function infoOf(chart, p, which) {
    var Q = window.Qimen, P = window.Patterns;
    var no = which === 'earth' ? p.earth : p.heaven;
    if (!no) return null;
    var gan = Q.STEM[no];
    if (!gan) return null;
    var zs = Q.PAL_ZHI[p.pal] || [];
    if (!zs.length) return null;                           /* 中五宫：无支，不画尺 */
    var idxs = zs.map(function (z) { return stageIdx(gan, z); });
    var idx = pickIdx(gan, idxs);
    if (idx < 0) return null;
    var mu = idx === 8;                               /* 论墓＝入墓 */
    /* ★ 衰+病、胎+养 用户定为「不强行取」→ 两格分书：一格一个字，各占一个刻度。
       其余组合仍只取一阶。 */
    var pair = null;
    if (!mu) {
      var srt = idxs.slice().sort(function (p1, p2) { return p1 - p2; });
      var key = srt.join(',');
      if (srt.length === 2 && (key === '5,6' || key === '10,11')) { pair = srt; idx = srt[0]; }
    }
    var xing = !!(P && P.JI_XING && P.JI_XING[no] === p.pal);
    return {
      gan: gan, zhis: zs, idxs: idxs, idx: idx,
      stage: LONG[idx], short: SHORT[LONG[idx]],
      el: EL[WX[gan]] || 'metal',
      pair: pair,                                     /* 两格分书时＝[a,b] */
      mu: mu, xing: xing,
      state: (mu && xing) ? 'both' : (mu ? 'mu' : (xing ? 'xing' : ''))
    };
  }

  /* 一条轨的 HTML（12 格刻度，点亮的那格写阶字；颜色带出墓/刑） */
  function trackHtml(k, it, esc) {
    if (!it) return '';
    var cells = '';
    for (var n = 0; n < 12; n++) {
      var hit = (n === it.idx) || (it.pair && it.pair.indexOf(n) >= 0);
      cells += hit
        ? '<span class="sxr-on' + (it.pair ? ' sxr-pair' : '') + (it.state ? ' sxr-' + it.state : '') + '">' +
          '<b>' + esc(SHORT[LONG[n]]) + '</b><s></s></span>'
        : '<i></i>';
    }
    return '<div class="sxr-t"><span class="sxr-k">' + k + '</span>' +
      '<span class="sxr-rail">' + cells + '</span></div>';
  }

  window.Plugins.register({
    id: 'sxm',
    name: '长生尺',
    desc: '按<b>传统旺衰法</b>，每宫补一条十二长生尺：天盘干、地盘干各一轨，十二阶成刻度，' +
      '点亮那格写所临之阶。入墓加粗转墨，击刑朱红，又墓又刑＝朱红字＋横线。',
    note: '四隅宫两支取一：阳干 冠带临官→临官、衰病两格分书、墓绝→墓、养长生→长生；' +
      '阴干 帝旺衰→帝旺、冠带沐浴→沐浴、胎养两格分书、死墓→墓。只标天地盘干。' +
      '<b>开启期间禁用星曜</b>（与紫微同一规矩：长生尺与星曜抢盘底位置；只抵星曜、不占用插件运行，' +
      '关掉即恢复）。',
    /* 2026-11-02 用户：长生尺也**禁用星曜**（与紫微同一效果，但不独占其他插件） */
    flags: { blockInYin: true, noStars: true },

    /* ------------------------------------------------------------ 屏幕（DOM） */
    palace: function (pal, ctx) {
      var c = ctx.chart, p = ctx.p;
      if (!c || !p) return '';
      var a = infoOf(c, p, 'heaven'), b = infoOf(c, p, 'earth');
      if (!a && !b) return '';
      return '<div class="sxr">' + trackHtml('天', a, ctx.esc) + trackHtml('地', b, ctx.esc) + '</div>';
    },

    /* ------------------------------------------------------- 导出图（Canvas） */
    snap: function (pal, ctx) {
      var c = ctx.chart, p = ctx.p;
      if (!c || !p) return;
      var a = infoOf(c, p, 'heaven'), b = infoOf(c, p, 'earth');
      if (!a && !b) return;
      var g = ctx.ctx, P = ctx.P, x = ctx.x, y = ctx.y, S = ctx.S, SH = ctx.SH;
      var SANS = ctx.SANS || '-apple-system, "PingFang SC", sans-serif';
      var padL = S * 0.045, padR = S * 0.06;
      var w = S - padL - padR;
      var ink = P.ink || '#1b2028', ink3 = P.ink3, red = P.sealVoidInk || '#b23a2c';
      var fsK = Math.round(S * 0.05);
      var rowH = Math.round(fsK * 1.9);          /* 一行留足：字高 1×，再加横线与行距 */
      var bandH = rowH * 2;
      /* ★ 尺子贴底（2026-11-01 修「截图错位」）：屏幕上是 absolute bottom:18px 贴着宫底，
         出图这边原来按 SH 的比例算（0.685×SH），卡片一高尺子就悬在半空。
         改成同样的「离底固定」：底距 = 0.25×S（给星曜留位，星曜画在 SH×0.893 那条线上），
         上沿 = SH − 0.25S − 尺高 —— 屏幕/出图的相对位置就对齐了。 */
      var top = y + SH - S * 0.25 - bandH;
      var rows = [[a, '天'], [b, '地']];

      g.save();
      g.strokeStyle = P.hair || P.line; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + padL, top - 2); g.lineTo(x + padL + w, top - 2); g.stroke();

      rows.forEach(function (r, ri) {
        var it = r[0]; if (!it) return;
        var ry = top + ri * rowH;                 /* 本行顶 */
        var base = ry + Math.round(rowH * 0.72);  /* 本行文字基线 */
        var labelW = fsK * 1.9;
        var railX = x + padL + labelW, railW = w - labelW;
        var step = railW / 12;

        g.font = '400 ' + fsK + 'px ' + SANS;
        g.fillStyle = ink3; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.fillText(r[1], x + padL, base);

        var color = it.state === 'xing' || it.state === 'both' ? red
          : (it.state === 'mu' ? ink : ink3);   /* 墓＝墨（暗色主题的 ink 是白） */

        for (var n = 0; n < 12; n++) {
          var cx = railX + step * (n + 0.5);
          var lit = (n === it.idx) || (it.pair && it.pair.indexOf(n) >= 0);
          if (lit) {
            g.font = '700 ' + (it.pair ? Math.round(fsK * 0.9) : fsK) + 'px ' + SANS;
            g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
            g.fillText(SHORT[LONG[n]], cx, base);
            if (it.state === 'both') {           /* 又墓又刑：红字 + 一道横线 */
              g.strokeStyle = ink; g.lineWidth = Math.max(1, S * 0.006);
              g.beginPath();
              g.moveTo(cx - fsK * 0.62, base + fsK * 0.3);
              g.lineTo(cx + fsK * 0.62, base + fsK * 0.3);
              g.stroke();
            }
            g.textAlign = 'left'; g.textBaseline = 'alphabetic';
            g.font = '400 ' + fsK + 'px ' + SANS;
          } else {
            g.strokeStyle = P.hair || P.line; g.lineWidth = 1;
            g.beginPath();
            g.moveTo(cx, base + fsK * 0.16);
            g.lineTo(cx, base - fsK * 0.34);
            g.stroke();
          }
        }
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      });
      g.restore();
    }
  });

  /* 给自检脚本用（纯函数） */
  window.ShenXing = {
    LONG: LONG, SHORT: SHORT, MERGE: MERGE,
    stageIdx: stageIdx, mergeIdx: mergeIdx, pickIdx: pickIdx, infoOf: infoOf
  };
})();
