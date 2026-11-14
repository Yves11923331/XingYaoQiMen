/* ============================================================================
 * snapshot.js —— 星曜奇门 · 截图（把当前盘面渲染成一张图）
 * ----------------------------------------------------------------------------
 * 不用 html2canvas、不引任何库：直接按九宫盘的设计用 Canvas 2D 重画一遍。
 * 好处：①不依赖 DOM 渲染结果 ②没有跨域/污染问题 ③可按任意分辨率出图。
 *
 * ★ 这里必须和 App 的盘面页保持同步，改界面时别忘了同步这份：
 *     标题行（局 + 节气·元 + 时刻）
 *     四柱 ＝ 无缝矩阵（柱名在矩阵外，日柱无特殊标记）
 *     值符 / 值使（其余信息一律不画）
 *     九宫盘（含星曜行；卦象已去掉，点中宫才切到卦象面）
 * 所有 y 坐标都是显式排定的一行一槽，结构上不可能重叠。
 * ========================================================================== */
(function (root) {
  'use strict';
  var Q = root.Qimen;

  var W = 1000, PAD = 44, SCALE = 2;
  var SERIF = '"QM Serif","Songti SC","Noto Serif CJK SC",serif';
  var SANS = '-apple-system,"HarmonyOS Sans SC","PingFang SC","Microsoft YaHei",sans-serif';

  var CELL_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6];
  var ELKEY = { 木:'wood', 火:'fire', 土:'earth', 金:'metal', 水:'water' };
  var ZHI_WX = ['水','土','木','木','土','火','火','土','金','金','土','水'];

  /* ★ 盘面几何（与 ui.js 的 fitPan() 必须同一组数）：
     整盘是**长方形** 350×509（高 > 宽；350 是用户在 370/365 之后定下的宽度，
     屏幕上左右各留 21.5px），九宫拆成九张等大卡片，缝 7px。
     单卡 = (350−14)/3 × (509−14)/3 = 112 × 165；导出图按同一比例放大到满宽 912。
     改这里要回头看 web/css/pan.css 与 js/ui.js 同一组注释。 */
  var PAN_W = 350, PAN_H = 509, PAN_GAP = 7;
  var CARD_K = (PAN_H - PAN_GAP * 2) / (PAN_W - PAN_GAP * 2);       /* 单卡 高/宽 = 1.47321 */
  /* 给一个"整盘宽"，算出这张长方形盘的缝 / 单卡 / 整盘三围；k = 阴盘那种整盘再收一档 */
  function panGeom(width, k) {
    k = k || 1;
    var gap = width * PAN_GAP / PAN_W * k;
    var cardW = (width * k - gap * 2) / 3;
    var cardH = cardW * CARD_K;
    return { gap: gap, w: cardW, h: cardH, panW: cardW * 3 + gap * 2, panH: cardH * 3 + gap * 2 };
  }

  function rgb(hex) {
    hex = (hex || '#000').trim();
    if (hex.charAt(0) !== '#') return [0, 0, 0];
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) { var c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  /* 居中绘制带字距的文字（canvas 没有 letter-spacing，手动逐字排） */
  function spaced(ctx, text, cx, y, font, color, ls) {
    ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    var chars = String(text).split(''), ws = [], total = 0, i, w;
    for (i = 0; i < chars.length; i++) { w = ctx.measureText(chars[i]).width; ws.push(w); total += w + (i < chars.length - 1 ? ls : 0); }
    var x = cx - total / 2;
    for (i = 0; i < chars.length; i++) { ctx.fillText(chars[i], x, y); x += ws[i] + ls; }
  }

  function palette() {
    var rs = getComputedStyle(document.documentElement);
    var pan = document.querySelector('.qm-text-pan');
    var ps = pan ? getComputedStyle(pan) : rs;
    function rv(n, fb) { return (rs.getPropertyValue(n) || '').trim() || fb; }
    function pv(n, fb) { return (ps.getPropertyValue(n) || '').trim() || fb; }
    var P = {
      bg: rv('--bg', '#ffffff'), bg2: rv('--bg-2', '#ffffff'), surface: rv('--surface', '#ffffff'),
      line: rv('--line', 'rgba(28,38,58,.11)'), line2: rv('--line-2', 'rgba(28,38,58,.06)'),
      ink: rv('--ink', '#1b2028'),
      ink2: rv('--ink-2', '#4b5565'), ink3: rv('--ink-3', '#8d97a6'),
      /* ⚠ inkSoft / dim 是**盘面层**变量（pan.css 里按主题各配一份 --qm-ink-soft / --qm-dim），
         必须用 pv() 从 .qm-text-pan 取；原来用 rv('--ink-soft')，根元素上没有这个变量，
         于是深色主题下永远退回 #4b5565 —— 寄干/暗干/墓星在玄夜·墨玉·铜仪里几乎看不见。
         2026-11-02 晚一并修掉。 */
      inkSoft: pv('--qm-ink-soft', '#4b5565'),
      dim: pv('--qm-dim', '#9099a8'),
      accent: rv('--accent', '#a8842c'), accentLine: rv('--accent-line', 'rgba(168,132,44,.35)'),
      accentBg: rv('--accent-bg', 'rgba(168,132,44,.08)'),
      frame: pv('--qm-frame', '#1f232b'),
      hair: pv('--qm-hair', 'rgba(28,38,58,.13)'),
      chipBg: pv('--qm-chip-bg', 'rgba(18,24,36,.045)'),
      chipLine: pv('--qm-chip-line', 'rgba(18,24,36,.13)'),
      sealVoidInk: pv('--qm-seal-void-ink', '#b23a2c'), sealVoidBg: pv('--qm-seal-void-bg', 'rgba(190,60,48,.08)'), sealVoidLine: pv('--qm-seal-void-line', 'rgba(190,60,48,.32)'),
      sealHorseInk: pv('--qm-seal-horse-ink', '#2b6f94'), sealHorseBg: pv('--qm-seal-horse-bg', 'rgba(46,120,160,.08)'), sealHorseLine: pv('--qm-seal-horse-line', 'rgba(46,120,160,.3)'),
      /* 五行色：**与 app.css 的 --el-* 同源**（四套主题各一份；盘面的 --qm-el-* 逐个等于它）。
         导出图按 three[i].el 在这里取，取不到才回落引擎给的 three[i].color。 */
      el: {
        '木': rv('--el-wood', '#0f7a4d'), '火': rv('--el-fire', '#c0392b'),
        '土': rv('--el-earth', '#9c7a24'), '金': rv('--el-metal', '#5d6772'),
        '水': rv('--el-water', '#16558f')
      },
      tian: {}, men: {}, shen: {}, star: {}
    };
    ['wood', 'fire', 'earth', 'metal', 'water'].forEach(function (k) { P.el[k] = pv('--qm-el-' + k, '#5d6772'); });
    for (var i = 1; i <= 9; i++) {
      P.tian[i] = pv('--qm-tian-' + i, P.ink);
      P.men[i] = pv('--qm-men-' + i, P.ink);
    }
    /* ★ 八神按**神名**取色（与 pan.css 同一口径）：序号 1..11 都算，
       色值直接从该神的五行变量拿 —— 于是转盘/飞盘/勾陈朱雀派/阴盘/心盘全对。
       ⚠ 2026-10-21 修：这段原来嵌在 i≤9 的循环体里、**复用了 i**，
         内层把 i 跑到 12 → 外层直接退出 → 九星/八门只填了 1 号，
         导出图里其余星门的颜色全落回默认墨色。别再并回外层循环。 */
    P.men[5] = P.el.earth;   /* 中门（土）—— pan.css 没有 --qm-men-5，这里补上，别让它掉墨色 */
    for (var j = 1; j <= 11; j++) {
      P.shen[j] = pv('--qm-shen-' + (Q.DEITY_KEY[j] || j),
        P.el[ELKEY[Q.DEITY_WX[j]]] || P.ink);
    }
    for (i = 0; i <= 10; i++) P.star[i] = pv('--qm-star-' + i, P.ink2);
    return P;
  }

  /* ------------------------------------------------------------- 一个宫 */
  /* ------------------------------------------------------------------ 单元格几何
     和屏幕上一模一样的排法：全套 px 常量（内边距 pt/pb、八神上留白 sm、行距 lm）
     都从 ui.js 的 fitPan 里现取（它已经算好并挂在 window.QmCell 上），
     再按「画布格子 ÷ 屏幕格子」的比例整体缩放。
     这样截图不再是"照着 CSS 估个 0.26 / 0.46 / 0.76"，而是同一套数字 ——
     以后改 pan.css 的间距，截图会跟着走，不会再各画各的。 */
  /* 老 UI 判定：与 ui.js 的 oldUIOn() 同一口径 —— 只剩长生尺，
     导出图也回**基准包**画法（方章 / 加粗 / 字号原大 / 八神小字+发丝线 / 寄干角注 / 贴边）。
     三个都关 = 标准盘新样式（裸干 / ×1.16 / 寄干右挂灰墨 / 八神等大 / 时干加粗 / 内缩 14px）。
     阴盘不参与插件旧 UI 切换，始终沿用标准盘新样式（裸干与右侧寄干）。 */
  function oldUIOn(chart) {
    try {
      if (chart && chart.yinpan) return false;
      /* 2026-11-14：长生尺改适配标准盘 → 不再有任何插件切老 UI（与 ui.js 同步）。 */
      return false;
    } catch (e) { return false; }
  }
  function metrics(S, chart) {
    var M = root.QmCell;
    if (!M || !M.cell) return null;
    var k = S / M.cell;
    /* ★ 2026-11-02 晚：E 改用**屏幕实测的 1em**（QmCell.cellFS）。
       以前拿 16*d.fs 当 1em，可 CSS 的 .qm-cell 并没有消费 --qm-cell-fs，
       屏幕实际是 .88em（390 屏 14.08px）→ 导出图所有字都小 9%。
       量到就拿量到的；老包/没量到时退回 16*d.fs。 */
    var E = (M.cellFS || M.E) * k;
    var OLD = oldUIOn(chart);
    /* 老 UI：行高按天干方章 1.55em × .95E + 边框 2px；新 UI：裸字，按星名行盒 1.18em × 1.45 */
    var rowH = OLD ? (1.4725 * E + 2 * k) : (1.711 * E);
    /* 八神这一行：屏幕上是「margin-top(sm) + 字号 .905/.78E × 1.45 + padding-bottom 4px」。
       ⚠ 老 UI 的 margin-top 是 CSS 写死的 16px，不是 DENSITY.sm —— 原来这里两种 UI
         都吃 M.sm（30px），导出图的老 UI 八神会低 14px，和插件版盘面对不上。 */
    var padTop = (M.padTop != null ? M.padTop : M.pt) * k;
    var shenFont = (OLD ? .78 : .905) * E;
    var shenLine = shenFont * 1.45;
    var shenPadB = 4 * k;                        /* .qm-shen padding-bottom:4px（发丝线在它下缘） */
    var shenH = shenLine + shenPadB;
    var shenTop = padTop + (OLD ? 16 : M.sm) * k;
    return {
      k: k, E: E, old: OLD,
      pad: (OLD ? 4 : 14) * k,                  /* 行内缩：老 4px / 新 14px（与 .qm-line padding 同口径） */
      palTop: 7 * k, palLeft: 9 * k,            /* .qm-pal  top:7 left:9 */
      palFS: (OLD ? .70 : .81) * E,
      shenFS: shenFont,
      shenTop: shenTop,
      sm: M.sm,                                 /* 与标准盘共享的八神行距 */
      shenH: shenH,
      rowH: rowH,
      lm: M.lm * k,                              /* ★ 必须带出来：menTop 要用它（漏了会算出 NaN，整行八门消失） */
      tianTop: shenTop + shenH + M.lm * k,
      tianFS: (OLD ? 1.02 : 1.18) * E,
      menFS: (OLD ? .98 : 1.14) * E,
      starFS: .78 * E,                          /* 2026-11-13 用户定 B：.74 → .78 */
      pb: M.pb * k,
      chipH: OLD ? rowH : 1.10 * E,             /* 新 UI：裸字行盒 = 1.10em */
      chipFS: (OLD ? .95 : 1.10) * E
    };
  }
  function rowBase(top, rowH, font) {           /* 行内居中（flex align-items:center） */
    var inner = font * 1.45;
    return top + (rowH - inner) / 2 + (inner - font * 1.16) / 2 + font * 0.88;
  }

  /* 把星名按宽度贪心折行：cap 是每行可用的宽度，返回 [{idx:[...], w: 本行宽}] */
  function wrapLabels(ctx, labels, gap, cap) {
    var out = [], cur = [], w = 0;
    for (var i = 0; i < labels.length; i++) {
      var lw = ctx.measureText(labels[i]).width;
      if (cur.length && w + gap + lw > cap) { out.push({ idx: cur, w: w }); cur = []; w = 0; }
      w += (cur.length ? gap : 0) + lw; cur.push(i);
    }
    if (cur.length) out.push({ idx: cur, w: w });
    return out;
  }

  /* 马星剪影（2026-11-13）：导出图要把位图画进 canvas 再出 PNG。
     ⚠ 不能用普通的 png 文件当源 —— file:// 的图片会把画布标成 tainted，
       toDataURL 直接抛 SecurityError；marks.js 里那份 data URI 不会。
     染色用离屏画布 + source-in，颜色取 P.sealHorseInk，四套主题自动跟。 */
  var _horseImg = null, _horseReady = false;
  /* ⚠ 脚本顺序：snapshot.js 在 marks.js **之前**加载，所以这里不能直接取 QM_MARKS。
     做成懒加载 + 由 ui.js 启动时调 preloadMarks() 提前解码，两头都不误。 */
  function preloadMarks() {
    if (_horseImg) return;
    try {
      if (typeof window === 'undefined' || !window.QM_MARKS || !QM_MARKS.horse) return;
      _horseImg = new Image();
      _horseImg.onload = function () { _horseReady = true; };
      _horseImg.src = QM_MARKS.horse;
    } catch (e) { _horseImg = null; _horseReady = false; }
  }

  function drawHorseMark(ctx, x, y, w, h, color) {
    preloadMarks();
    if (!_horseReady || w <= 0 || h <= 0) return;
    var oc = document.createElement('canvas');
    oc.width = Math.max(1, Math.round(w));
    oc.height = Math.max(1, Math.round(h));
    var g = oc.getContext('2d');
    g.drawImage(_horseImg, 0, 0, oc.width, oc.height);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, oc.width, oc.height);
    ctx.drawImage(oc, x, y, w, h);
  }

  /* S = 单卡宽 · SH = 单卡高。阴盘主体复用标准盘，只追加轻量标记。
     ★ 2026-11-12：暗干与屏幕一致，坐**星曜（政余）那一行**——宫卡左下角、靠左一行；
       字号 .9em（用户定：比政余那行的 .74em 大一档），行盒按 .9em × 1.45 算；
       不再是宫底居中 12px 落款。 */
  function drawYinAgan(ctx, p, P, x, y, S, SH, M) {
    if (!p.agan || p.pal === 5) return;
    var k = M ? M.k : S / 112;
    var E = M ? M.E : S * 0.11;
    var fs = Math.round(.9 * E);
    /* 行盒 = 字号 × 1.45（与 CSS line-height 同值）、贴底 4px，
       基线 = 盒顶 + 半行距 + .88 字高（与 .qm-stars 的算法同构） */
    var boxH = 1.45 * .9 * E;
    var base = y + SH - 4 * k - boxH + (boxH - fs * 1.16) / 2 + fs * 0.88;
    ctx.save();
    /* 与屏幕 .qm-cell{overflow:hidden} 同口径：夹在卡片内 */
    rrect(ctx, x + 0.5, y + 0.5, S - 1, SH - 1, 6 * (M ? M.k : S / 112));
    ctx.clip();
    /* 2026-11-12 用户定版 B1：字前一枚 2.6px 墨点 + 整块内缩到 left:9（含卡框 1px）。
       屏幕实测：点 10..12.6、字起 17.6；出图按同一组比例摆，别各画各的。 */
    ctx.beginPath();
    ctx.arc(x + 11.3 * k, base - fs * 0.30 - 1 * k, 1.3 * k, 0, Math.PI * 2);
    ctx.globalAlpha = .5;
    ctx.fillStyle = P.inkSoft;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = '400 ' + fs + 'px ' + SERIF;
    ctx.fillStyle = P.inkSoft;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(Q.STEM[p.agan] + (p.agan2 ? '（' + Q.STEM[p.agan2] + '）' : ''),
      x + 17.6 * k, base);
    ctx.restore();
  }

  /* 盘面同显：中宫交给 drawLessonInMid（同心环 / 中5 / 地盘干都不画），由 render() 按
     opts.lessonMid 置位；一处开关，别把"清空中宫"抄三份。 */
  var drawMidBlank = false;

  function drawCell(ctx, p, chart, P, x, y, S, starMap, face, SH) {
    SH = SH || S;
    var M = metrics(S, chart);
    var ci = chart.calendar.index;
    var hourStem = ci.hourGan === 0 ? chart.meta.hourLead : ci.hourGan + 1;
    var YIN = !!(chart && chart.yinpan);

    /* 一张卡：圆角矩形 + 一圈描边（与 .qm-cell 的 border-radius:6px / 1px 实线同比例）。
       ★ 卡片之间不再有共用格线 —— 缝（gap）就是分家，与外框那条描金线一样都退场了。 */
    var CR = 6 * (M ? M.k : S / 112);
    ctx.globalAlpha = (P.cellA == null ? 1 : P.cellA);
    ctx.fillStyle = P.surface;
    rrect(ctx, x, y, S, SH, CR);
    ctx.fill();
    ctx.globalAlpha = 1;
    /* 卡片描边按格宽比例：屏幕 1px / 112 格宽，导出格宽约 2.4 倍，
       写死 lineWidth:1 在 2000px 的图上会细到看不见（用户报“没有九个格”）。 */
    ctx.strokeStyle = P.frame;
    ctx.lineWidth = Math.max(1, M ? M.k : S / 112);
    rrect(ctx, x + 0.5, y + 0.5, S - 1, SH - 1, CR);
    ctx.stroke();

    /* 卦象·地支面：底色照画，内容整块换掉 */
    if (face === 'both') { drawFaceCell(ctx, p, P, x, y, S, M, SH); return; }

    if (p.pal === 5 && !p.star && !p.deity) {
      if (drawMidBlank) return;            /* 同显开着：整块交给课 */
      /* 中宫不放字：两圈同心环（与 pan.css 的 ::before/::after 同比例） */
      var cx = x + S / 2, cy = y + SH * 0.46, R = S * 0.18;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(P.accent, .5); ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.47, 0, Math.PI * 2);
      ctx.strokeStyle = P.hair; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = '700 ' + Math.round(S * 0.062) + 'px ' + SANS;
      ctx.fillStyle = P.ink3; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('中5', x + S * 0.045, y + S * 0.10);
      var bw = S * 0.17, bh = S * 0.17;
      /* ⚠ 2026-10-21：中宫没有地盘干时（阴盘/心盘常见）**不画空章** ——
         屏幕上 ganChip(0) 直接返回空串，出图这边原来照样画了个只有底和框的白章。 */
      if (p.earth) {
        if (M && !M.old) {
          /* 标准盘：中宫地盘干同样是**裸字**（与屏幕 .qm-mid-line 的第三列同位） */
          var fs5 = Math.round(M.chipFS);
          ctx.font = '400 ' + fs5 + 'px ' + SERIF;
          ctx.fillStyle = P.el[ELKEY[Q.STEM_WX[p.earth]]];
          ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(Q.STEM[p.earth], x + S - M.pad, y + SH - fs5 * 0.55);
        } else {
          drawStem(ctx, Q.STEM[p.earth], P.el[ELKEY[Q.STEM_WX[p.earth]]],
            x + S - bw - S * 0.05, y + SH - bh - S * 0.075, bw, bh, S, P, false, false);
        }
      }
      return;
    }

    var pad = M ? M.pad : S * 0.05;
    /* 星门左移 4px（2026-11-03 用户从 A/B/C/D 里选 B）：
       与屏幕 pan.css 的 `.qm-name { transform: translateX(-4px) }` 同一口径。
       只挪星名/门名/飞盘「中五」，干列仍贴 `x + S - pad`；老 UI 的 padding 只有 4px，不跟。
       ⚠ 屏幕改左移量时这里必须一起改，否则导出图和屏幕会错位。 */
    var nameX = x + pad - (M && !M.old ? 4 * M.k : 0);
    /* 阴盘与标准盘使用同一纵向基准，不再给旧印章带让位。 */
    var shenTopC = M ? M.shenTop : 0;
    var shenBaseC = M ? shenTopC + (M.shenFS * 1.45 - M.shenFS) / 2 + M.shenFS * 0.88 : S * 0.26;
    var tianTopC = M ? shenTopC + M.shenH + M.lm : (S * 0.46 - S * 0.105);

    /* 宫名 左上（.qm-pal top:7 left:9，font .7em） */
    ctx.font = '700 ' + Math.round(M ? M.palFS : S * 0.062) + 'px ' + SANS;
    ctx.fillStyle = P.ink3; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(Q.PAL_NAME[p.pal] + p.pal,
      x + (M ? M.palLeft : S * 0.045),
      y + (M ? M.palTop + M.palFS * 0.88 : S * 0.10));

    /* 空亡 / 驿马：2026-11-12 用户「阴盘也用标准盘的」——阴盘不再画紧凑「○ / 马」，
       与标准盘同一形制。 */
    /* 空亡 = 圆、马星 = 奔马剪影（2026-11-13 用户定版，与屏幕同尺寸同位置）。
       ⚠ 图标不再有文字印章的底框，位置仍是「离右缘 7、离顶 5」，两枚间距 3（单位 k）。 */
    if (p.kong || p.ma) {
      var kk = M ? M.k : S / 112;
      var vd = 13 * kk;                       /* 空亡圆直径（屏幕 13px） */
      var hw = 17.5 * kk, hh = 10.53 * kk;    /* 马星（屏幕 17.5×10.53；掩膜 256×154 等比） */
      var gp = 3 * kk;
      var total = (p.kong ? vd : 0) + (p.ma ? hw : 0) + ((p.kong && p.ma) ? gp : 0);
      var sx = x + S - 7 * kk - total;
      var sy = y + 5 * kk;
      if (p.kong) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx + vd / 2, sy + vd / 2, (vd - 1.6 * kk) / 2, 0, Math.PI * 2);
        ctx.strokeStyle = P.sealVoidInk;
        ctx.lineWidth = Math.max(1, 1.6 * kk);
        ctx.stroke();
        ctx.restore();
        sx += vd + (p.ma ? gp : 0);
      }
      if (p.ma) drawHorseMark(ctx, sx, sy + (vd - hh) / 2, hw, hh, P.sealHorseInk);
    }

    /* 八神（顶带下方的第一行，居中）+ 发丝线 */
    var yShen = y + shenBaseC;
    /* ★ 2026-11-13：屏幕的 .qm-shen 已改成 QM Serif（与星/门/干同一套字），
       导出图这里必须跟着换 —— 否则又是"屏幕一种字、出图另一种字"。
       字距仍是 .24em；老 UI 保持 700 加粗。 */
    var shenFS2 = Math.round(M ? M.shenFS : S * 0.072);
    spaced(ctx, Q.DEITY[p.deity] || '', x + S / 2, yShen,
      (M && M.old ? '700 ' : '600 ') + shenFS2 + 'px ' + SERIF,
      P.shen[p.deity] || P.ink2,
      shenFS2 * 0.24);
    ctx.beginPath();
    var hairY = y + (M ? shenTopC + M.shenH : S * 0.26 + S * 0.045);
    ctx.moveTo(x + S * 0.16, hairY);
    ctx.lineTo(x + S * 0.84, hairY);
    ctx.strokeStyle = P.hair; ctx.lineWidth = Math.max(1, M ? M.k : 1); ctx.stroke();

    /* 九星行 */
    var tianTop = tianTopC;
    var yTian = y + (M ? rowBase(tianTop, M.rowH, M.tianFS) : S * 0.46);
    var tianName = Q.starLabel(p.star, !!(chart && chart.fly && chart.fly.star));
    ctx.font = (M && !M.old ? '400 ' : '600 ') + Math.round(M ? M.tianFS : S * 0.105) + 'px ' + SERIF;
    ctx.fillStyle = P.tian[p.star] || P.ink;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(tianName, nameX, yTian);
    drawStemRow(ctx, [
      /* 寄干统一走「主章右上角小字」的角注形制（与屏幕 .qm-gan-mid 的右挂一致）：
         不占干列宽度、不推挤主章。阴盘也走这一套 —— 2026-11-02 晚用户点名
         坤二地盘寄干要挂在右边、和天盘那颗寄干对齐；旧存档的 ganFoot=0 不再认
         （设置里那一格早撤了，屏幕也不认，出图跟着撤）。 */
      p.mid ? { s: p.mid, corner: true, hour: p.mid === hourStem } : null,
      { s: p.heaven, hour: p.heaven === hourStem }
    ], x + S - pad, yTian + (M ? M.chipH * 0.26 : S * 0.035), S, P, M);

    /* 星曜先排好版（要在画八门行之前算）：星多就往上折行，多出来的高度把八门行整体顶上去，
       否则第二行会跟八门行贴在一起 —— 屏幕上那一行是 nowrap+hidden，出图这里必须增行。 */
    var sl = starMap && starMap.byPal[p.pal];
    /* 星曜名与屏幕同口径：三颗以内用全名（太阳 / 岁星 / 太白 …），**星太多**（>3 颗）才退单字简称
       （阳 / 阴 / 岁 / 荧 / 镇 / 白 / 辰，四余照旧 炁 / 罗 / 计 / 孛）。简称对照见 stars.js 的 STARS。
       星多时仍走 wrapLabels 折行 + 等比缩，放不下就折行。 */
    var starLabels = [], starLines = [], starKS = 1, starSF2 = 0, starGap = 0, starLineH = 0, starFull = true;
    if (sl && sl.length) {
      starSF2 = Math.round(M ? M.starFS : S * 0.086);
      starFull = sl.length <= 3;
      starGap = (M ? 5 * M.k : S * 0.035);
      ctx.font = '700 ' + starSF2 + 'px ' + SANS;
      for (var q2 = 0; q2 < sl.length; q2++) starLabels.push(starFull ? sl[q2].name : sl[q2].short);
      var avail = S - (M ? 12 * M.k : S * 0.11);      /* left:5 right:7（星曜靠左下角） */
      /* 行距 = 行盒 .851em（=.74em × 1.15）+ 屏幕上的 row-gap 2px；
         竖排往上叠时两条线之间要留这 2px，不然第二行会贴着第一行。 */
      starLineH = starSF2 * 1.15 + (M ? 2 * M.k : 0);
      starLines = wrapLabels(ctx, starLabels, starGap, avail);
      if (starLines.length > 2) {                     /* 折到两行还不够：整块等比缩（下限 .55）再折 */
        for (starKS = .95; starKS >= .55; starKS -= .05) {
          starLines = wrapLabels(ctx, starLabels, starGap, avail / starKS);
          if (starLines.length <= 2) break;
        }
      }
      /* ★ 2026-11-02 晚：分排规则与屏幕 ui.js 的 fitStars() **完全一致** ——
         **前段在上、后段在下**：下排取尾部 cand 颗、上排取头部 n−cand 颗，
         两排都放得下时取最大的 cand。
         例：9 颗、一行容 6 颗 → 上排前 3 颗、下排后 6 颗；
         8 颗 → 上排太阳/太阴 2 颗、下排其余 6 颗（不再是「最后 2 颗浮上去」）。 */
      if (starLines.length > 1) {
        var cap = avail / (starKS || 1);
        function packIdx(arr) {
          var w2 = 0;
          for (var q4 = 0; q4 < arr.length; q4++) w2 += (q4 ? starGap : 0) + ctx.measureText(starLabels[arr[q4]]).width;
          return { idx: arr, w: w2 };
        }
        function lineW(from, count) {
          var t = 0;
          for (var q7 = 0; q7 < count; q7++) t += (q7 ? starGap : 0) + ctx.measureText(starLabels[from + q7]).width;
          return t;
        }
        var bottomN = 0;
        for (var cand = sl.length - 1; cand >= 1; cand--) {
          if (lineW(sl.length - cand, cand) <= cap && lineW(0, sl.length - cand) <= cap) { bottomN = cand; break; }
        }
        if (bottomN > 0 && bottomN < sl.length) {
          var bi = [], ti = [];
          for (var q5 = sl.length - bottomN; q5 < sl.length; q5++) bi.push(q5);
          for (var q6 = 0; q6 < sl.length - bottomN; q6++) ti.push(q6);
          starLines = [packIdx(bi), packIdx(ti)];      /* [0] 下排 · [1] 上排 */
        }
      }
    }
    /* 八门行：★ 不再贴卡片底（2026-10-07 用户「上面的和下面的间距不要那么大，
       下部分留出留白」）—— 紧跟九星行，中间只隔一个 --qm-line-mt；
       卡片下半截于是整片留白，星曜单独待在左下角。
       （与 .qm-men-row 的 margin-top: var(--qm-men-mt, var(--qm-line-mt)) 同一口径。） */
    var menTop = M ? (tianTop + M.rowH + M.lm) : (S * 0.76 - S * 0.10);
    var yMen = y + (M ? rowBase(menTop, M.rowH, M.menFS) : S * 0.76);
    /* 飞盘的「中五」门位：那一宫没有门，只画一个占位标。
       ★ 中门五行属土 → 与天禽星同色（原来写的是 ink3 半透明，等于没上色） */
    if (p.gateMid) {
      ctx.font = (M && !M.old ? '400 ' : '600 ') + Math.round(M ? M.menFS : S * 0.10) + 'px ' + SERIF;
      ctx.fillStyle = P.el.earth;
      ctx.fillText('中五', nameX, yMen);
    } else {
      ctx.font = (M && !M.old ? '400 ' : '600 ') + Math.round(M ? M.menFS : S * 0.10) + 'px ' + SERIF;
      ctx.fillStyle = P.men[p.gate] || P.ink;
      ctx.fillText(Q.GATE[p.gate] || '', nameX, yMen);
    }
    /* ★ 八门行的寄干（阴盘坤二才有）：与天盘寄干同一形制，挂在主章**右侧**的小字。
       2026-11-02 晚用户点名「坤宫寄干放右边，和另一个寄干对齐」——旧代码把它当
       并排虚线小章、还画在左边；现在统一 corner。 */
    drawStemRow(ctx, [
      p.earth2 ? { s: p.earth2, corner: true } : null,
      { s: p.earth }
    ], x + S - pad, yMen + (M ? M.chipH * 0.26 : S * 0.035), S, P, M);

    /* 插件（2026-10-25 起走 Plugins）：聚合所有启用插件的 snap 钩子画导出图。
       开关 / 阴盘拦截 / 独占让位 都在 plugins.js 的 active() 里判。 */
    Plugins.snapDraw(p.pal, {
      ctx: ctx, x: x, y: y, S: S, SH: SH, P: P,
      /* M = 这一档的度量（含 k 比例与圆角），插件要重描宫卡边框时得用同一套几何
         （2026-11-12 虚实法；原来只给 x/y/S/SH，圆角与线宽算不准）。 */
      M: M,
      chart: chart, chartSub: chart.yinpan ? 'yin' : 'pan',
      p: p, pal: p.pal, Q: Q,
      SERIF: SERIF, SANS: SANS, rgba: rgba
    });

    /* 星曜：底部留白带左侧（只用文字，不用行星符号）。排几行已在上面定好。 */
    if (sl && sl.length) {
      ctx.font = (M && !M.old ? '500 ' : '700 ') + starSF2 + 'px ' + SERIF;
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      /* 星曜是绝对定位：底距 4px（贴左下角），行盒 .851em（.74em × 1.15）。
         基线按「行盒 + 半行距 + .88 字高」算 —— 原来把 0.851*M.E（屏幕 px）
         和 starSF2（画布 px）混在一起，单位差一个 k，字会比屏幕贴底。
         两排时每排都靠左（与屏幕 fitStars 的 flex-start 一致）。 */
      var starBoxH = M ? .851 * M.E : starSF2 * 1.15;
      var ty = y + (M
        ? (SH - 4 * M.k - starBoxH + (starBoxH - starSF2 * 1.16) / 2 + starSF2 * 0.88)
        : SH * 0.893);
      var boxBottom = y + SH - (M ? 4 * M.k : S * 0.05);
      ctx.save();
      /* 屏幕上是靠 .qm-cell{overflow:hidden} 裁的，出图这里得自己夹在卡片内 */
      rrect(ctx, x + 0.5, y + 0.5, S - 1, SH - 1, CR);
      ctx.clip();
      ctx.translate(x + (M ? 5 * M.k : S * 0.055), boxBottom);
      ctx.scale(starKS, starKS);
      var rty = ty - boxBottom;
      /* 2026-11-13 用户定 B：与屏幕一致的 90% 不透明度（屏幕 .qm-stars{opacity:.9}） */
      ctx.globalAlpha = .9;
      for (var li = 0; li < starLines.length; li++) {   /* li = 0 是最下面那一行，往上叠 */
        var tx = 0;                                     /* 两排都靠左，不居中 */
        for (var m2 = 0; m2 < starLines[li].idx.length; m2++) {
          var si = starLines[li].idx[m2], st = sl[si];
          ctx.fillStyle = st.up ? (P.star[st.cls] || P.ink2) : rgba(P.star[st.cls] || '#888888', .42);
          ctx.fillText(starLabels[si], tx, rty - li * starLineH);
          tx += ctx.measureText(starLabels[si]).width + starGap;
        }
      }
      ctx.restore();
    }

    if (YIN) drawYinAgan(ctx, p, P, x, y, S, SH, M);
  }

  /* 卦象·地支面：点中宫切过来那一面。每宫中央一枚大卦符 + 该宫所纳地支。 */
  function drawFaceCell(ctx, p, P, x, y, S, M, SH) {
    SH = SH || S;
    var E = M ? M.E : S * 0.11, k = M ? M.k : 1;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 ' + Math.round(M ? M.palFS : S * 0.062) + 'px ' + SANS;
    ctx.fillStyle = P.ink3;
    ctx.fillText(p.pal === 5 ? '中5' : (Q.PAL_NAME[p.pal] + p.pal),
      x + (M ? M.palLeft : S * 0.045),
      y + (M ? M.palTop + M.palFS * 0.88 : S * 0.10));

    if (p.pal === 5) {
      var lb = 1.0 * E, ht = .62 * E;
      ctx.textAlign = 'center';
      ctx.font = '700 ' + Math.round(lb) + 'px ' + SERIF;
      ctx.fillStyle = P.accent;
      ctx.fillText('卦象 · 地支', x + S / 2, y + SH / 2 - 2 * k);
      ctx.font = Math.round(ht) + 'px ' + SANS;
      ctx.fillStyle = P.ink3;
      ctx.fillText('点中宫回九宫盘', x + S / 2, y + SH / 2 + ht + 8 * k);
      ctx.textAlign = 'left';
      return;
    }

    var z = Q.PAL_ZHI[p.pal] || [];
    var guaF = 2.1 * E, zhiF = 1.05 * E, gap = 2 * k;
    var total = guaF + gap + zhiF * 1.45;
    var top = y + SH / 2 - total / 2;
    ctx.textAlign = 'center';
    /* 卦符（.qm-gua：2.1em、accent、.88 透明） */
    ctx.font = Math.round(guaF) + 'px ' + SERIF;
    ctx.fillStyle = rgba(P.accent, .88);
    ctx.fillText(Q.PAL_TRIGRAM[p.pal], x + S / 2, top + guaF * 0.88);
    /* 所纳地支（.qm-zhi：1.05em 宋体、.16em 字距） */
    spaced(ctx, z.join(''), x + S / 2, top + guaF + gap + zhiF * 1.16,
      '700 ' + Math.round(zhiF) + 'px ' + SERIF, P.ink, zhiF * 0.16);
    ctx.textAlign = 'left';
  }

  function drawStem(ctx, ch, color, x, y, w, h, S, P, dim, hour) {
    rrect(ctx, x, y, w, h, h * 0.22);
    if (!dim) { ctx.fillStyle = hour ? P.accentBg : P.chipBg; ctx.fill(); }
    ctx.strokeStyle = hour ? P.accent : P.chipLine;
    ctx.lineWidth = hour ? 2 : 1;
    if (dim) ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '700 ' + Math.round(w * 0.62) + 'px ' + SERIF;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  /* 寄干角注（与 CSS 的 .qm-gan-mid 同一形制）：不画章，只画小字，
     并在字轮廓外描一圈**宫底色**，把主章的边框在字处"咬开"。
     rightX = 主章右缘、topY = 主章顶边（都按 1:1 屏幕 px 口径给）。
     ⚠ 只给**老 UI** 用（方章版）；新 UI 的寄干在 drawStemRow 里直接画在主章右侧。
       旧存档 ganFoot=0 的「并排小章」形制已随设置撤掉，别再复活。 */
  function drawStemCorner(ctx, ch, color, rightX, topY, bw, P) {
    var fs = Math.max(6, Math.round(bw * 0.44));      /* .68em / 章宽 1.55em ≈ 0.44 */
    ctx.font = '800 ' + fs + 'px ' + SERIF;
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.save();
    ctx.globalAlpha = (P.cellA == null ? 1 : P.cellA);
    ctx.strokeStyle = P.surface;
    ctx.lineWidth = Math.max(2, fs * 0.24);
    ctx.lineJoin = 'round';
    ctx.strokeText(ch, rightX, topY);
    ctx.restore();
    ctx.fillStyle = color;
    ctx.fillText(ch, rightX, topY);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  function drawStemRow(ctx, list, rightX, baselineY, S, P, M) {
    var items = list.filter(Boolean);
    /* ---- 新 UI（标准盘）----
       裸字、无底无框、字重 400（时干 700）；寄干挂主章右侧、灰墨 .66em / 600。
       与屏幕的 .qm-gan / .qm-gan-mid 同一形制（见 pan.css）。 */
    if (M && !M.old) {
      var fs = Math.round(M.chipFS);
      var fsm = Math.max(6, Math.round(.66 * M.E));
      var g = Math.max(1, 2.5 * M.k);
      var mains = items.filter(function (it) { return !it.corner && it.s > 0; });
      var corners = items.filter(function (it) { return it.corner && it.s > 0; });
      /* 主章从右往左排：最后一个（地盘/天盘主干的字）贴 rightX，前面若有多个
         依次往左让。屏幕上是 flex 行内左→右，主章在最右；不能像原来那样
         每个都右对齐在同一个 rightX（阴盘 earth2+earth 会叠成一团）。 */
      var mx = rightX;
      for (var mi = mains.length - 1; mi >= 0; mi--) {
        var mIt = mains[mi];
        ctx.font = (mIt.hour ? '700 ' : '400 ') + fs + 'px ' + SERIF;
        ctx.fillStyle = P.el[ELKEY[Q.STEM_WX[mIt.s]]];
        ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(Q.STEM[mIt.s], mx, baselineY);
        mx -= ctx.measureText(Q.STEM[mIt.s]).width + 2 * M.k;
      }
      /* 寄干：主章右侧的小字，垂直取主章字面的中部；不占位、不推挤主章。 */
      var cy = baselineY - fs * 0.35;
      for (var ci = 0; ci < corners.length; ci++) {
        ctx.font = '600 ' + fsm + 'px ' + SERIF;
        ctx.fillStyle = P.inkSoft || P.ink3;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(Q.STEM[corners[ci].s], rightX + g, cy);
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      return;
    }
    /* ---- 老 UI（基准包）---- */
    var bw = M ? (M.chipH * 1.55 / 1.4725) : S * 0.16;
    var bh = M ? M.chipH : S * 0.16;
    var gap = M ? 2 * M.k : S * 0.02;
    var mains = items.filter(function (it) { return !it.corner && it.s > 0; });
    var corners = items.filter(function (it) { return it.corner && it.s > 0; });
    var total = mains.length * bw + (mains.length - 1) * gap;
    var x = rightX - total, y = baselineY - bh * 0.76;
    for (var j = 0; j < mains.length; j++) {
      drawStem(ctx, Q.STEM[mains[j].s], P.el[ELKEY[Q.STEM_WX[mains[j].s]]], x, y, bw, bh, S, P, mains[j].dim, mains[j].hour);
      x += bw + gap;
    }
    /* 角注不占位：压在**最后一枚主章**的右上角（right:-.16em / top:-.32em 换成章宽比例） */
    for (var c2 = 0; c2 < corners.length; c2++) {
      drawStemCorner(ctx, Q.STEM[corners[c2].s], P.el[ELKEY[Q.STEM_WX[corners[c2].s]]],
        rightX - bw * 0.104, y - bh * 0.206, bw, P);
    }
  }

  /* ------------------------------------------------------------- 四柱矩阵 */
  /* 无缝矩阵：4 柱 × 2 块，块间 2px 缝、块不倒圆角，只最外圈收圆；柱名在矩阵外面。 */
  function drawPillars(ctx, chart, P, x, y, w) {
    var ci = chart.calendar.index;
    var cols = [
      [ci.yearGan, ci.yearZhi], [ci.monthGan, ci.monthZhi],
      [ci.dayGan, ci.dayZhi], [ci.hourGan, ci.hourZhi]
    ];
    var labels = ['年', '月', '日', '时'];
    var gap = 6, pad = 6;
    /* ★ 列宽必须扣掉左右内边距和三条缝，否则第 4 列会越出容器被裁掉 */
    var cw = (w - pad * 2 - gap * 3) / 4, lh = 26;
    ctx.font = '400 19px ' + SANS;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (var i = 0; i < 4; i++) {
      ctx.fillStyle = P.ink3;
      ctx.fillText(labels[i], x + pad + i * (cw + gap) + cw / 2, y + 18);
    }
    ctx.textAlign = 'left';
    var my = y + lh, th = 66, mh = th * 2 + gap + pad * 2;
    rrect(ctx, x, my, w, mh, 10);
    ctx.fillStyle = P.bg2; ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.stroke();
    ctx.save();
    rrect(ctx, x, my, w, mh, 10); ctx.clip();
    for (i = 0; i < 4; i++) {
      var cx = x + pad + i * (cw + gap);
      for (var r = 0; r < 2; r++) {
        var v = r === 0 ? cols[i][0] : cols[i][1];
        var missing = (v < 0);
        var wx = missing ? null : (r === 0 ? ELKEY[Q.STEM_WX[v + 1]] : ELKEY[ZHI_WX[v]]);
        var ty = my + pad + r * (th + gap);
        ctx.fillStyle = missing ? rgba(P.ink3, .08) : rgba(P.el[wx], wx === 'earth' ? 0.24 : 0.22);
        ctx.fillRect(cx, ty, cw, th);
        ctx.font = '700 34px ' + SERIF;
        ctx.fillStyle = missing ? P.ink3 : P.el[wx];
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(missing ? '—' : (r === 0 ? Q.STEM[v + 1] : root.Lunar.ZHI[v]), cx + cw / 2, ty + th / 2 + 1);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
    }
    ctx.restore();
    return lh + mh;
  }

  /* --------------------------------------------------------------- 主入口 */
  /* ---------------------------------------------------------------- 串星课
   * 课页上没有九宫盘，所以不能套 render() 那套盘面几何 —— 这里只画：
   * 标题 → 时刻 / 四柱 / 局·节气与农历 → **四数副行** → 上四格（三宫 + 天干）→ 下三格（六亲）。
   * L 由 ui.js 的 cxMakeLesson() 算好传进来（同一份数据，省得两处口径打架），形状：
   *   { mode:'six'|'star', modeName:'六神'|'九星', nums:[4], stem, ganEl,
   *     from:'time'|'nums', zero, three:[{name, el, qin, color, void}] }
   * ★ 2026-11-13：出图尺寸回到**横 1000×460**（与设置里 .sh.lesson 那枚 36×17 的示意框
   *   同一比例；口径表与任务书都是 460）。课块外面仍是一张卡，卡下仍有一行注解，
   *   四数副行插在卡上 —— 行位是写死的槽，结构上不可能重叠。
   * ★ 空亡在屏幕上是「次级灰、**不加任何线**」，出图同步：颜色换 ink3，一道线都不画。 */
  /* ---------------------------------------------------------------- 串星课
   * 课页上没有九宫盘，所以不能套 render() 那套盘面几何 —— 这里只画：
   * 标题 → 时刻 / 四柱 / 局·节气与农历 → **四数副行** → 上四格（三宫 + 天干）→ 下三格（六亲）。
   * L 由 ui.js 的 cxMakeLesson() 算好传进来（同一份数据，省得两处口径打架），形状：
   *   { mode:'six'|'star', modeName:'六神'|'九星', nums:[4], stem, ganEl,
   *     from:'time'|'nums'|'rand', zero, three:[{name, el, qin, color, void}] }
   * ★ 2026-11-13：出图尺寸**横 1000×460**（与设置里 .sh.lesson 那枚 36×17 的示意框同一比例）。
   * ★ 空亡在屏幕上是「只压灰、不加线」，出图同步：颜色换 ink3，一道线都不画。
   * ★ 卡片下面那行「三宫 = 天宫 · 地宫 · 人宫　第四格 主体 = 天干」**已整行删除**
   *   （用户：「下面那个解释的天地人三宫、还有第四格的小字，也没必要加」）—— 不许换位置再放回去。
   * ⚠ 函数名 renderLesson 被门禁钉着，改版式也别改名。
   * ⚠ 版式候选（保守改良 / 打破居中）**不在这里**：它们是独立试稿，
   *   见 设计-串星课/_lesson-export-sketch.js（只出预览图，等用户挑，挑完再落这里）。
   * ------------------------------------------------------------------------- */
  /* 课块里那一格的五行色：主题 token 优先，其次引擎兜底，最后 ink。
     ⚠ 空亡不走这里 —— 它固定 P.ink3 灰、不画线（用户 2026-11-13 两轮确认）。 */
  function elColorOf(P, t) {
    if (!t) return P.ink;
    return (P.el && P.el[t.el]) || t.color || P.ink;
  }

  function renderLesson(L, chart, opts) {
    opts = opts || {};
    var P = palette();
    var H = 460;          /* 横 1000×460（用户 2026-11-13 定；改这里要同步设置里的 .sh.lesson） */
    var cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = H * SCALE;
    var ctx = cv.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);

    if (opts.rend) {                       /* 渲染背景与「盘面不透明度」跟屏幕同一套 */
      var im = opts.rend;
      var k = Math.max(W / im.naturalWidth, H / im.naturalHeight);
      var dw = im.naturalWidth * k, dh = im.naturalHeight * k;
      ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
      /* ⚠ 这个渐变**不能叫 g**：下面还有别的短变量名，覆盖了会画到 NaN 上（2026-10-07 修的） */
      var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, rgba(P.bg, .55)); bgGrad.addColorStop(.34, rgba(P.bg, .16));
      bgGrad.addColorStop(.74, rgba(P.bg, .16)); bgGrad.addColorStop(1, rgba(P.bg, .62));
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);
    }

    /* 一行一槽，全部显式排定。
       ★ 2026-11-13 用户从两套候选里挑了 A「保守改良」，这里是**定版**（B「打破居中」没采用）。
         参数台账（与 设计-串星课/导出图版式-20261113/README 一致）：
           标题 44→40 · 时刻 26→22（退成注脚）· 四柱 30→34（第一眼该读到"这是什么时刻"）
           局/农历 20→18 · 四数副行 19（金色）
           卡片 68%→74% · 名字 42 · **天干降一档 34** · 六亲 22 并贴近名字（基线差 46）
           书口线回到六亲下方 12px（不再"迷路"）· 上下留白重排（顶 ~88 / 底 ~50）
       ⚠ opts.layout 那个试稿开关已删：定版只有一套，不留分叉。 */
    var yTitle = 88, yTime = yTitle + 36, yPillars = yTime + 44,
      yInfo = yPillars + 30, yNums = yInfo + 34, cardTop = yNums + 30;

    ctx.font = '700 40px ' + SERIF; ctx.fillStyle = P.accent;
    ctx.fillText('串星课', W / 2, yTitle);

    var gz = (chart && chart.calendar && chart.calendar.ganzhi) ? chart.calendar.ganzhi : null;
    ctx.font = '400 22px ' + SANS; ctx.fillStyle = P.ink2;
    if (chart && chart.input) {
      var inp = chart.input;
      ctx.fillText(inp.y + '-' + p2(inp.m) + '-' + p2(inp.d) + ' ' + p2(inp.h) + ':' + p2(inp.mi), W / 2, yTime);
    } else if (gz) {
      /* 手动局 / 随机一局的课没有公历时刻（chart.input === null），写局与时辰 */
      ctx.fillText('手动起局 · ' + (gz.hour || '—') + '时', W / 2, yTime);
    } else {
      ctx.fillText(L && L.from === 'nums' ? '数字起课' : (L && L.from === 'rand' ? '随机起课' : '—'), W / 2, yTime);
    }
    ctx.font = '700 34px ' + SERIF; ctx.fillStyle = P.ink;
    ctx.fillText(gz ? [gz.year, gz.month, gz.day, gz.hour].join(' ') : '—', W / 2, yPillars);

    ctx.font = '400 18px ' + SANS; ctx.fillStyle = P.ink3;
    var infoTxt = '—';
    if (chart && chart.ju) {
      infoTxt = chart.ju.juText + ' · ' + (chart.calendar && chart.calendar.lunarText
        ? '农历' + chart.calendar.lunarText : '')
        + (chart.calendar && chart.calendar.lateZiAdvance ? ' · 晚子时换日' : '');
    }
    ctx.fillText(infoTxt, W / 2, yInfo);

    /* ── 四数副行：把四个数写出来（用户明确要），并标出这是哪套译法 ── */
    if (L) {
      var two = L.nums.some(function (n) { return n >= 10; });
      var pre = L.from === 'nums' ? '数字 ' : (L.from === 'rand' ? '随机 ' : '四数 ');
      var numsLine = pre + L.nums.join(two ? ' ' : '') + ' · 天干 ' + L.stem + ' · ' + (L.modeName || '六神');
      if (L.zero) numsLine += ' · 零课：三宫皆退一位';
      ctx.font = '400 19px ' + SANS; ctx.fillStyle = P.accent;
      ctx.fillText(numsLine, W / 2, yNums);
    }

    /* 课块：**卡片**（surface 75% + 1px 细边 + 圆角 + 无投影、书口线贴着六亲那行），
       四枚符号按「每列贴自己的字宽、余量均分到列间」排（与 .xgrid 的 space-between 同一算法）。
       天干只降字号、**位置仍站原位** —— 它是第四格（主体），不是第四个神。 */
    var NAME = 42, STEM = 34, QIN = 22;
    var cardW = W * 0.74, cardX = (W - cardW) / 2;   /* App 里卡片宽 = 视口 − 26% */
    var padX = cardW * 0.062, padTop = cardW * 0.046;
    var names = L ? [L.three[0].name, L.three[1].name, L.three[2].name, L.stem] : ['—', '—', '—', '—'];
    var voided = L ? [!!L.three[0].void, !!L.three[1].void, !!L.three[2].void, false] : [false, false, false, false];
    var cols = L ? [elColorOf(P, L.three[0]), elColorOf(P, L.three[1]), elColorOf(P, L.three[2]), P.ink]
      : [P.ink, P.ink, P.ink, P.ink];
    /* 列心按**名字字号**量宽（天干小一档但不该把自己的列拉窄，否则四个字看着不等距） */
    ctx.font = '700 ' + NAME + 'px ' + SERIF;
    var nw = [], nsum = 0, i;
    for (i = 0; i < 4; i++) { nw[i] = ctx.measureText(names[i] || '—').width; nsum += nw[i]; }
    var gap = Math.max(0, (cardW - padX * 2 - nsum) / 3), centers = [], cxp = cardX + padX;
    for (i = 0; i < 4; i++) { centers[i] = cxp + nw[i] / 2; cxp += nw[i] + gap; }
    var namesY = cardTop + padTop + NAME * 0.94, qinY = namesY + 46, ruleY = qinY + 12;
    var cardH = (ruleY - cardTop) + cardW * 0.022;
    rrect(ctx, cardX, cardTop, cardW, cardH, cardW * 0.0599);   /* 圆角 16 / 267.3 */
    ctx.fillStyle = rgba(P.surface, .75); ctx.fill();      /* 卡片 75% 不透明（用户定） */
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.stroke();
    for (i = 0; i < 4; i++) {
      ctx.font = '700 ' + (i === 3 ? STEM : NAME) + 'px ' + SERIF;
      /* 空亡：只换灰（--ink-3），**一道线都不画** —— 用户 2026-11-13 两轮确认 */
      ctx.fillStyle = voided[i] ? P.ink3 : (cols[i] || P.ink);
      ctx.fillText(names[i] || '—', centers[i], namesY);
    }
    for (var j = 0; j < 3; j++) {
      ctx.font = '600 ' + QIN + 'px ' + SANS;
      ctx.fillStyle = P.ink3;
      ctx.fillText((L && L.three[j].qin) || '—', centers[j], qinY);
    }
    /* 书口线＝课块的**下框线**（贴卡片下缘），两端对齐卡片内边距 */
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cardX + padX, ruleY); ctx.lineTo(cardX + cardW - padX, ruleY); ctx.stroke();
    return cv;
  }

  /* ------------------------------------------------- ③ 盘面同显（串星课 + 九宫盘）
   * 出图尺寸与奇门盘一致（1000×1370），但一张图里要同时装下课与盘，于是版心重排：
   * 标题 / 四柱 / 值符值使 照旧 → 课块（四格名 + 书口线 + 三个六亲）→ 剩下的高度全给盘。
   * 盘是正方形，格子边长由「剩下多少高」反推 —— 宁可盘小一点，也不把课挤掉；
   * 盘宽不足 912 时左右居中，和上面满宽的课形成"上宽下窄"的稳定构图。 */
  /* ------------------------------------------------- ③ 盘面同显（串星课 + 九宫盘）
   * 出图尺寸与奇门盘一致（1000×1370）。用户定的版式：
   *   标题行照旧 → **四柱缩小放左、右边空出来的位置放一段小串星课** → 底下九宫盘照旧满宽。
   * 好处是盘不用为课让位，仍是 912 那一版（跟单独出图一样大）；
   * 减去的那截四柱高度正好抵消课的高度 —— 左边四柱、右边课，两栏等高，下面接盘。 */
  /* 导出图标题行右侧那行小字：口径跟屏幕 tbTitle 的副行一致 ——
     阴盘 / 心盘不是「手动起局」；三层写层名；只有真正的自选局才写手动。
     （阴盘/心盘引擎里都借 manual:true 渲染，所以必须先判 yinpan/xinpan。） */
  var LAYER_CN = { nian: '年家', yue: '月家', ri: '日家' };
  function subTitle(chart) {
    if (!chart) return '';
    if (chart.yinpan) return '阴盘';
    if (chart.xinpan) return '心盘';
    if (chart.layer) return (LAYER_CN[chart.layer] || '') + ' · ' + (chart.ju.yuanName || '');
    if (chart.manual) return '手动起局';
    return (chart.calendar.seasonText || '') + ' ' + (chart.ju.yuanName || '');
  }
  /* 盘面同显（2026-11-13）：出图 = **标准盘 + 中宫里的课**，与屏幕同一版式、同一画布。
     旧实现（抬头带里一条课 + 四柱缩放 + 另配画布高度）已删 —— 那是"课还没进宫"时的做法。
     renderBoth 这个函数名被门禁钉着，不能改。 */
  function renderBoth(chart, analysis, starMap, face, opts) {
    opts = opts || {};
    return render(chart, analysis, starMap, face, {
      rend: opts.rend, opacity: opts.opacity, lessonMid: opts.lesson
    });
  }

  /* 中宫那门课：屏幕上是 #xkMini（.qm-text-pan 里绝对定位、正好盖住中宫格），
     出图按**实测比例**画（2026-11-13 在 390×844 上量到的 CSS px ÷ 单卡宽 112）：
       角标 9.5 / 400 / 字距 .14em / 位 12,10   · 宫名 17 / 800 / 行距 32.2 / 位 23.2
       六亲 10.5 / 400（位 65.9）               · 时干 11.5 / 800（右 12）
     这些比值就是"与屏幕一致"的唯一真值；屏幕那套改了，这里要一起改。 */
  var XK = {
    mark: { fs: 9.5, ls: 1.33, x: 12, base: 18.5 },
    name: { fs: 13, w: 400, x: 28.3, base: 57.2, step: 29.2 },
    qin: { fs: 9.5, x: 62.9, base: 56.2 },
    stem: { fs: 10.5, w: 400, right: 12, base: 23.5 }
  };
  function drawLessonInMid(ctx, L, P, x, y, w, h) {
    if (!L || !L.three || L.three.length < 3) return;
    var k = w / 112;                       /* 112 = 屏幕单卡宽（PAN_W 350 三等分） */
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    /* 角标「串星课」：字距是 CSS 的 letter-spacing .14em，canvas 没有，逐字加 */
    ctx.font = '400 ' + (XK.mark.fs * k).toFixed(1) + 'px ' + SANS;
    ctx.fillStyle = P.ink3 || P.ink;
    var mx = x + XK.mark.x * k;
    for (var c = 0; c < 3; c++) {
      var ch = '串星课'[c];
      ctx.fillText(ch, mx, y + XK.mark.base * k);
      mx += ctx.measureText(ch).width + XK.mark.ls * k;
    }
    /* 三行两列：宫名（左，颜色按五行取）＋ 六亲（右，次级灰）；
       空亡只换成次级灰，不加任何线。 */
    var cols = [elColorOf(P, L.three[0]), elColorOf(P, L.three[1]), elColorOf(P, L.three[2])];
    for (var i = 0; i < 3; i++) {
      var t = L.three[i];
      var by = y + (XK.name.base + XK.name.step * i) * k;
      ctx.font = XK.name.w + ' ' + (XK.name.fs * k).toFixed(1) + 'px ' + SERIF;
      ctx.fillStyle = t.void ? (P.ink3 || P.ink) : (cols[i] || P.ink);
      ctx.fillText(t.name || '—', x + XK.name.x * k, by);
      ctx.font = '400 ' + (XK.qin.fs * k).toFixed(1) + 'px ' + SERIF;
      ctx.fillStyle = P.ink3 || P.ink;
      ctx.fillText(t.qin || '—', x + XK.qin.x * k, y + (XK.qin.base + XK.name.step * i) * k);
    }
    /* 时干：右上角一枚，与屏幕同字号同字重 */
    ctx.textAlign = 'right';
    ctx.font = XK.stem.w + ' ' + (XK.stem.fs * k).toFixed(1) + 'px ' + SERIF;
    ctx.fillStyle = P.ink2 || P.ink;
    ctx.fillText(L.stem || '', x + w - XK.stem.right * k, y + XK.stem.base * k);
    ctx.textAlign = 'left';
  }

  function render(chart, analysis, starMap, face, opts) {
    opts = opts || {};
    drawMidBlank = !!opts.lessonMid;
    var P = palette();
    var panW = W - PAD * 2;                    /* 满宽 912：盘子按这个宽度铺 */
    var pillarsH = 26 + (66 * 2 + 6 + 12);     /* 默认矩阵：26 + 132 + 缝6 + 边距12 = 176 */
    /* 四柱抬头的高度：默认矩阵 176；「简洁」由 SizhuUI 画，设计 C「标签带」固定框高 220。
       画布 H 必须按实高预留，否则简洁版页脚会贴到画布底。
       ⚠ 2026-11-02 排查项 2：以前 H 一律按 176 算，简洁版下面 44px 被吃掉。 */
    var uiSub = chart.yinpan ? 'yin' : (chart.xinpan ? 'xin' : 'pan');
    var sizhuOn = (+(root.Store && root.Store.settings && root.Store.settings.sizhu) === 1
      && root.SizhuUI && uiSub !== 'yin');
    var headH = pillarsH;
    if (sizhuOn) {
      try { headH = root.SizhuUI.height(panW) || pillarsH; } catch (e) { headH = pillarsH; }
    }
    /* 阴盘与标准盘同宽，不预留盘外暗干环。 */
    var g = panGeom(panW);
    var H = Math.round(PAD + 62 + headH + 58 + g.panH + 74 + PAD);
    var cell = g.w, cellH = g.h, gap = g.gap, panH = g.panH;
    var y = PAD;

    var cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = H * SCALE;
    var ctx = cv.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);

    /* ★ 截图渲染背景：整张图 cover 铺满，再压一层**上下重、中间轻**的渐变罩。
       罩子是为了让标题/四柱/页脚在花哨的照片上也读得清 —— 中间那片留给盘面，
       盘面自己还有"不透明度"那一档在管。 */
    if (opts.rend) {
      var im = opts.rend;
      var k = Math.max(W / im.naturalWidth, H / im.naturalHeight);
      var dw = im.naturalWidth * k, dh = im.naturalHeight * k;
      ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
      var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, rgba(P.bg, .55));
      bgGrad.addColorStop(.34, rgba(P.bg, .16));
      bgGrad.addColorStop(.74, rgba(P.bg, .16));
      bgGrad.addColorStop(1, rgba(P.bg, .62));
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);
    }
    /* 盘面不透明度：与屏幕那一档同一个数 */
    P.cellA = (opts.opacity == null ? 100 : Math.max(0, Math.min(100, opts.opacity))) / 100;

    /* 标题行：局 + 节气·元（左），时刻（右） */
    ctx.font = '700 46px ' + SERIF;
    ctx.fillStyle = P.accent;
    ctx.fillText(chart.ju.juText, PAD, y + 38);
    var jw = ctx.measureText(chart.ju.juText).width;
    ctx.font = '400 22px ' + SANS;
    ctx.fillStyle = P.ink3;
    ctx.fillText(subTitle(chart), PAD + jw + 16, y + 36);
    if (chart.input) {
      var inp = chart.input;
      ctx.textAlign = 'right';
      ctx.fillText(inp.y + '-' + p2(inp.m) + '-' + p2(inp.d) + ' ' + p2(inp.h) + ':' + p2(inp.mi), W - PAD, y + 36);
      ctx.textAlign = 'left';
    }
    y += 62;

    /* 四柱：设置「排法 → 四柱」选「简洁」时走五行色字那套（返回画出来的高度），否则默认矩阵。
       画布 H 已按 headH 预留（默认 176 / 简洁 220），这里画出来的高度应与之一致；
       万一 SizhuUI 抛错回退成默认矩阵，H 只会多出 44px 底部留白，不会裁字。 */
    var plugHeadH = 0;
    if (sizhuOn) {
      try {
        plugHeadH = root.SizhuUI.snap({
          chart: chart, chartSub: uiSub,
          P: P, ctx: ctx, x: PAD, y: y, w: panW,
          fontSerif: SERIF, fontSans: SANS
        }) || 0;
      } catch (e) { plugHeadH = 0; }
    }
    y += plugHeadH > 0 ? plugHeadH : drawPillars(ctx, chart, P, PAD, y, panW);
    y += 26;

    /* 值符 / 值使（其余信息一律不画） */
    ctx.font = '400 22px ' + SANS;
    ctx.fillStyle = P.ink3;
    var lx = PAD;
    ctx.fillText('值符', lx, y + 22); lx += ctx.measureText('值符').width + 10;
    ctx.font = '700 27px ' + SERIF;
    ctx.fillStyle = P.ink;
    ctx.fillText(chart.meta.zhiFuStar, lx, y + 23); lx += ctx.measureText(chart.meta.zhiFuStar).width + 40;
    ctx.font = '400 22px ' + SANS; ctx.fillStyle = P.ink3;
    ctx.fillText('值使', lx, y + 22); lx += ctx.measureText('值使').width + 10;
    ctx.font = '700 27px ' + SERIF; ctx.fillStyle = P.ink;
    ctx.fillText(chart.meta.zhiShiGate, lx, y + 23);
    y += 58;

    /* 九宫盘：九张等大的长方形卡片，阴盘同样满宽。
       ⚠ 这里不再有"整盘一块圆角底 + 一圈外框"—— 描边在每张卡片自己身上（见 drawCell）。 */
    var panX = PAD, panY = y;
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) {
        var pal = CELL_ORDER[r * 3 + c], p = null;
        chart.plate.forEach(function (q) { if (q.pal === pal) p = q; });
        var cxx = panX + c * (cell + gap), cyy = panY + r * (cellH + gap);
        if (p) drawCell(ctx, p, chart, P, cxx, cyy, cell, starMap, face, cellH);
        /* 盘面同显：课画进中宫（与屏幕同一版式） */
        if (p && p.pal === 5 && opts.lessonMid) drawLessonInMid(ctx, opts.lessonMid, P, cxx, cyy, cell, cellH);
      }
    }

    y += panH + 30;

    /* 页脚 */
    ctx.font = '400 18px ' + SANS;
    ctx.fillStyle = P.ink3;
    ctx.fillText('星曜奇门 · 时家奇门转盘 · 自研历法引擎', PAD, y + 20);
    if (starMap) {
      ctx.textAlign = 'right';
      ctx.fillText('观测点 ' + starMap.lat.toFixed(1) + 'N ' + starMap.lon.toFixed(1) + 'E', W - PAD, y + 20);
      ctx.textAlign = 'left';
    }
    return cv;
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  /* 出图：优先系统分享，其次下载 */
  function shot(chart, analysis, starMap, onMsg, face, opts) {
    var msg = onMsg || function () {};
    opts = opts || {};

    /* 顺序很重要：
       ① 先把字体与渲染背景都准备好（渲染背景是异步的，不等就会缺一张图）
       ② 再**一次性**出图
       ③ 最后按"原生桥 → 分享 → 下载"的顺序去落地
       ⚠ 原来原生桥那段是写在函数末尾的独立分支，而"等渲染背景"又在它前面 return ——
         于是只要设了渲染背景，**整个原生桥就被绕过去了**：落到浏览器的 a.download 上，
         WebView 里根本不下载，界面却弹"已生成图片"。这就是"说成功、相册里没有"的原因。 */
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load('700 40px "QM Serif"'), document.fonts.load('600 40px "QM Serif"')
      ]).then(loadBg, loadBg);
    } else {
      loadBg();
    }

    function loadBg() {
      if (!opts.rendImage) { go(null); return; }
      var im = new Image();
      im.onload = function () { go(im); };
      im.onerror = function () { msg('背景图读不出来，这次不带背景'); go(null); };
      im.src = opts.rendImage;
    }

    function go(rendImg) {
      var cv;
      try {
        /* 整张图默认走主程序；若某个插件声明了 poster（且开着），这次截图就交给它 */
        var pOwner = (!opts.both && !opts.lesson && face !== 'both' && root.Plugins && root.Plugins.posterOwner)
          ? root.Plugins.posterOwner() : null;
        cv = pOwner
          ? (root.Plugins.poster(chart, analysis, starMap, opts) || render(chart, analysis, starMap, face, { rend: rendImg, opacity: opts.opacity }))
          : opts.both
          ? renderBoth(chart, analysis, starMap, face, { rend: rendImg, opacity: opts.opacity, lesson: opts.lesson })
          : opts.lesson
          ? renderLesson(opts.lesson, chart, { rend: rendImg, opacity: opts.opacity })
          : render(chart, analysis, starMap, face, { rend: rendImg, opacity: opts.opacity });
      }
      catch (e) { msg('截图失败：' + (e && e.message ? e.message : e)); return; }
      var tail = (face === 'both') ? '_卦象地支面' : '';
      var base = chart.input
        ? chart.input.y + p2(chart.input.m) + p2(chart.input.d) + '_' + p2(chart.input.h) + p2(chart.input.mi)
        : chart.ju.juText + '_' + chart.calendar.ganzhi.hour + '时';
      var posterName = '';
      if (!opts.both && !opts.lesson && face !== 'both' && root.Plugins && root.Plugins.posterOwner) {
        var po = root.Plugins.posterOwner();
        if (po) posterName = po.name + '_';
      }
      var name = (opts.both ? '盘面同显_' : opts.lesson ? '串星课_' : posterName || '星曜奇门_') + base + tail + '.png';

      /* ① 装进 App（Android 壳）时走原生桥写相册 —— WebView 里 a.download 与 navigator.share 都不生效。
         这里必须把 face 与 opts 都带上，否则存下来的图跟屏幕上不是同一张。 */
      if (root.Xyqimen && root.Xyqimen.saveImage) {
        var res = '';
        try {
          res = root.Xyqimen.saveImage(cv.toDataURL('image/png'),
            'xingyao_' + base + (face === 'both' ? '_guazhi' : '') + '.png');
        } catch (e) { res = 'ERR:' + (e && e.message ? e.message : e); }
        if (String(res).indexOf('OK') === 0) msg('已保存到相册 · Pictures/星曜奇门');
        else msg('保存失败：' + res);
        return;
      }

      /* ② 浏览器里：能分享就分享，否则走下载 */
      cv.toBlob(function (blob) {
        if (!blob) { msg('截图失败'); return; }
        var file = null;
        try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: '星曜奇门' }).then(function () { msg('已分享'); },
            function () { dl(blob, name, msg); });
          return;
        }
        dl(blob, name, msg);
      }, 'image/png');
    }
  }

  function dl(blob, name, msg) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
    msg('已生成图片');
  }

  root.Snapshot = { render: render, renderLesson: renderLesson, renderBoth: renderBoth, shot: shot, preloadMarks: preloadMarks };
})(typeof window !== 'undefined' ? window : globalThis);
