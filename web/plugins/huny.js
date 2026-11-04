/* ============================================================================
 * 插件 · 浑仪（com.momen.xingyaoqimen / plugins/huny）
 * ----------------------------------------------------------------------------
 * 2026-11-01 接自「隔壁」的交付包（星曜奇门-浑仪-交付-20261101）。
 * 它不是「排法里的一个设置」，而是**接管整张截图**的插件：
 * 运行时多了一个 poster 钩子 —— 有插件声明 poster 且开着，截图就出它的整张图；
 * 关掉即回九宫图。屏幕端仍是九宫（隔壁 README 的判断：圆盘在 390 屏会糊、宫位还会丢点击热区）。
 * ----------------------------------------------------------------------------
 * 来源：交付-浑仪-20261101/源码/越稿.html 的 drawDial()。移植时只改了数据来源：
 *   原文读 QM3（离线数据），这里读 Qimen.cast() 的 chart / analysis / starMap。
 * 画法全部保留：八宫占八向、五层成五环、二十四山压宫、星曜按真实方位落点。
 *
 * 用法：Huny.render(chart, analysis, starMap) → canvas（逻辑 1000 × 1240，dpr 2）
 * ⚠ 浑仪是**暗底**海报（原设计如此），不跟四套主题走；屏幕端仍是九宫，不入此处。
 * ========================================================================== */
(function (root) {
  'use strict';

  var S = 1000, CX = 500, CY = 500, R = 446;
  var SHAN = ['子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙',
    '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬'];
  var P8 = [[1, -90], [8, -45], [3, 0], [4, 45], [9, 90], [2, 135], [7, 180], [6, 225]];
  var GUA = { 1: '☵', 2: '☷', 3: '☳', 4: '☴', 5: '○', 6: '☰', 7: '☱', 8: '☶', 9: '☲' };
  var ZHI = { 1: '子', 2: '未申', 3: '卯', 4: '辰巳', 5: '', 6: '戌亥', 7: '酉', 8: '丑寅', 9: '午' };
  var STAR_SHORT = { 太阳: '日', 太阴: '月', 岁星: '木', 荧惑: '火', 镇星: '土', 太白: '金', 辰星: '水', 紫炁: '炁', 罗睺: '罗', 计都: '计', 月孛: '孛' };

  function rad(d) { return d * Math.PI / 180; }

  /* 从现有的 chart / analysis / starMap 拼一份和原交付同形的数据 */
  function build(chart, analysis, starMap) {
    var Q = root.Qimen;
    var cells = {};
    chart.plate.forEach(function (p) {
      var vig = {};
      (analysis && analysis.byPal[p.pal] || []).forEach(function (e) {
        if (e.vigor && e.tag) vig[e.tag] = e.name;
      });
      cells[p.pal] = {
        num: p.pal, name: Q.PAL_NAME[p.pal], wx: p.wuxing,
        deity: Q.DEITY[p.deity] || '',
        star: p.star ? Q.starLabel(p.star, !!(chart.fly && chart.fly.star)) : '',
        gate: Q.GATE[p.gate] || '',
        h: Q.STEM[p.heaven] || '', e: Q.STEM[p.earth] || '',
        kong: !!p.kong, ma: !!p.ma, dutyStar: !!p.dutyStar, dutyGate: !!p.dutyGate,
        vig: vig,
        ge: [],
        astro: (starMap && starMap.byPal[p.pal] || []).map(function (a) {
          return { n: a.name, lon: a.lon, up: a.up, az: a.az };
        })
      };
    });
    (analysis && analysis.list || []).forEach(function (it) {
      if (it.vigor) return;
      if (cells[it.pal]) cells[it.pal].ge.push(it.name);
    });
    var cal = chart.calendar, meta = chart.meta, ju = chart.ju;
    var inp = chart.input;
    return {
      cells: cells,
      ju: ju.juText,
      yinYang: ju.yinYang,
      season: cal.seasonText || '',
      yuan: ju.yuanName || '',
      fuTou: ju.fuTou || '',
      xunShou: meta.xunShou || '', xunKong: meta.xunKong || '',
      zhiFu: meta.zhiFuStar || '', zhiShi: meta.zhiShiGate || '',
      time: inp ? (inp.y + '-' + pad(inp.m) + '-' + pad(inp.d) + ' ' + pad(inp.h) + ':' + pad(inp.mi)) : '',
      ganzhi: [cal.ganzhi.year, cal.ganzhi.month, cal.ganzhi.day, cal.ganzhi.hour],
      stars: (starMap && starMap.all || []).map(function (a) {
        return { n: a.name || a.n, lon: a.lon, az: a.az, pal: a.pal, up: a.up };
      }),
      lat: starMap ? starMap.lat : null, lon: starMap ? starMap.lon : null,
      geAll: (analysis && analysis.list || []).filter(function (it) { return !it.vigor; })
        .map(function (it) { return { n: it.name, pal: it.pal }; }),
      ji: analysis ? analysis.summary.ji : 0,
      xiong: analysis ? analysis.summary.xiong : 0
    };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function render(chart, analysis, starMap) {
    var Q = build(chart, analysis, starMap);
    var FOOT = 250, W = 1000, H = 1000 + FOOT;
    var cv = document.createElement('canvas');
    var dpr = 2;
    cv.width = W * dpr; cv.height = H * dpr;
    var g = cv.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#070a11'; g.fillRect(0, 0, W, H);

    /* 盘心到边缘的一层冷光 */
    var bg = g.createRadialGradient(CX, CY - 90, 40, CX, CY, 640);
    bg.addColorStop(0, 'rgba(30,52,84,.42)');
    bg.addColorStop(.55, 'rgba(12,20,34,.25)');
    bg.addColorStop(1, 'rgba(4,6,11,0)');
    g.fillStyle = bg; g.fillRect(0, 0, W, 1000);

    function pt(deg, r) { return [CX + Math.cos(rad(deg)) * r, CY + Math.sin(rad(deg)) * r]; }
    function angOf(pal) { for (var i = 0; i < P8.length; i++) if (P8[i][0] === pal) return P8[i][1]; return -90; }
    function label(str, angDeg, r, font, color) {
      var P = pt(angDeg, r);
      var deg = ((angDeg % 360) + 360) % 360;
      var flip = (deg > 0 && deg < 180);
      g.save();
      g.translate(P[0], P[1]);
      g.rotate(flip ? rad(angDeg + 270) : rad(angDeg + 90));
      g.font = font; g.fillStyle = color;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(str, 0, 0);
      g.restore();
    }
    function spaced(str, cx, cy, ls) {
      var chars = String(str).split(''), w = [], total = 0, i;
      for (i = 0; i < chars.length; i++) { w.push(g.measureText(chars[i]).width); total += w[i] + (i < chars.length - 1 ? ls : 0); }
      var x = cx - total / 2;
      g.textAlign = 'left';
      for (i = 0; i < chars.length; i++) { g.fillText(chars[i], x, cy); x += w[i] + ls; }
      g.textAlign = 'center';
    }
    var C = Q.cells;

    /* 八宫扇底 */
    P8.forEach(function (p, i) {
      if (i % 2) return;
      g.beginPath(); g.moveTo(CX, CY);
      g.arc(CX, CY, R, rad(p[1] - 22.5), rad(p[1] + 22.5)); g.closePath();
      g.fillStyle = 'rgba(120,160,220,.028)'; g.fill();
    });

    /* 环线 */
    [160, 194, 226, 262, 300, 336, 404, 446].forEach(function (r, i) {
      g.beginPath(); g.arc(CX, CY, r, 0, Math.PI * 2);
      g.strokeStyle = (i === 7) ? 'rgba(190,215,245,.55)' : (i === 0 ? 'rgba(190,215,245,.32)' : 'rgba(150,185,225,.17)');
      g.lineWidth = (i === 7 || i === 0) ? 1.4 : .8;
      g.stroke();
    });

    /* 宫界辐线 */
    P8.forEach(function (p) {
      var A = pt(p[1] - 22.5, 160), B = pt(p[1] - 22.5, R);
      g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
      g.strokeStyle = 'rgba(150,185,225,.22)'; g.lineWidth = .8; g.stroke();
    });

    /* 二十四山 */
    var hourZhi = Q.ganzhi[3] ? Q.ganzhi[3].charAt(1) : '';
    for (var i = 0; i < 24; i++) {
      var a = -90 + i * 15;
      var t1 = pt(a - 7.5, R - 4), t2 = pt(a - 7.5, R);
      g.beginPath(); g.moveTo(t1[0], t1[1]); g.lineTo(t2[0], t2[1]);
      g.strokeStyle = 'rgba(150,185,225,.4)'; g.lineWidth = .9; g.stroke();
      var onDuty = (i === SHAN.indexOf(hourZhi));
      label(SHAN[i], a, 424, (onDuty ? '700 15px ' : '400 14px ') + '"QM Serif", serif',
        onDuty ? '#e9c9a8' : 'rgba(205,222,245,.72)');
      if (onDuty) {
        var d = pt(a, R - 12);
        g.beginPath(); g.arc(d[0], d[1], 2.6, 0, Math.PI * 2);
        g.fillStyle = '#cf4a3a'; g.fill();
      }
    }

    /* 星曜：真实方位落点，单字正立 */
    (Q.stars || []).forEach(function (st) {
      var a = st.az - 90;
      var P = pt(a, 461);
      g.save();
      g.font = '400 9px "QM Serif", serif';
      g.fillStyle = st.up ? 'rgba(233,205,170,.95)' : 'rgba(118,158,198,.6)';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(STAR_SHORT[st.n] || String(st.n).charAt(0), P[0], P[1]);
      g.restore();
      var A1 = pt(a, 447), A2 = pt(a, 452);
      g.beginPath(); g.moveTo(A1[0], A1[1]); g.lineTo(A2[0], A2[1]);
      g.strokeStyle = st.up ? 'rgba(233,205,170,.65)' : 'rgba(118,158,198,.35)';
      g.lineWidth = .9; g.stroke();
    });

    /* 满宫朱弧 */
    (function () {
      var bp = 0, bn = 0;
      Object.keys(C).forEach(function (k) { var n = (C[k].astro || []).length; if (n > bn) { bn = n; bp = +k; } });
      if (bn < 8) return;
      var ang = angOf(bp);
      g.beginPath(); g.arc(CX, CY, 450, rad(ang - 22.5), rad(ang + 22.5));
      g.strokeStyle = 'rgba(207,74,58,.6)'; g.lineWidth = 2.6; g.stroke();
    })();

    /* 八宫五层 */
    P8.forEach(function (p) {
      var pal = p[0], a = p[1], c = C[pal];
      if (!c) return;
      label(c.name, a, 388, '400 30px "QM Serif", serif',
        c.dutyStar ? '#e8a09a' : (c.dutyGate ? '#e8b48a' : '#e8f0fb'));
      label(GUA[pal] + ' ' + (ZHI[pal] || '') + ' · ' + c.wx, a, 354, '400 11px "QM Serif", serif', 'rgba(160,190,225,.8)');
      label(c.deity || '—', a, 318, '400 16px "QM Serif", serif', 'rgba(215,230,248,.92)');
      label(c.star || '—', a, 281, '400 20px "QM Serif", serif', '#9fd8ff');
      label(c.gate || '—', a, 244, '400 20px "QM Serif", serif', '#6fe0b4');
      label(c.h || '—', a, 210, '400 23px "QM Serif", serif', '#f0f6ff');
      label(c.e || '—', a, 177, '400 23px "QM Serif", serif', 'rgba(170,200,235,.75)');
      var vS = [c.vig['星·内'], c.vig['星·外']].filter(Boolean).join('·');
      var vG = [c.vig['门·内'], c.vig['门·外']].filter(Boolean).join('·');
      if (vS) label(vS, a, 297, '400 8.5px "QM Serif", serif', 'rgba(230,180,120,.8)');
      if (vG) label(vG, a, 255, '400 8.5px "QM Serif", serif', 'rgba(230,180,120,.8)');
      if (c.dutyStar) label('值符', a - 9, 401, '400 9px "QM Serif", serif', '#cf4a3a');
      if (c.dutyGate) label('值使', a + 9, 401, '400 9px "QM Serif", serif', '#d98a5a');
      if (c.kong) label('空亡', a - 9, 401, '400 9px "QM Serif", serif', '#e08a7a');
      if (c.ma) label('驿马', a + 9, 401, '400 9px "QM Serif", serif', '#7fc8e8');
    });

    /* 盘心 */
    g.beginPath(); g.arc(CX, CY, 160, 0, Math.PI * 2);
    g.fillStyle = 'rgba(8,12,20,.92)'; g.fill();
    g.strokeStyle = 'rgba(190,215,245,.4)'; g.lineWidth = 1.1; g.stroke();
    g.beginPath(); g.arc(CX, CY, 150, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(190,215,245,.16)'; g.lineWidth = .8; g.stroke();

    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#eaf2ff'; g.font = '400 30px "QM Serif", serif';
    spaced(Q.ju, CX, CY - 34, 6);
    g.font = '400 11px "QM Serif", serif'; g.fillStyle = 'rgba(160,190,225,.85)';
    g.fillText(Q.season + ' · ' + Q.yuan, CX, CY - 4);
    g.font = '400 12px "QM Serif", serif'; g.fillStyle = '#dfeafa';
    g.fillText('值符 ' + Q.zhiFu + '　值使 ' + Q.zhiShi, CX, CY + 22);
    g.font = '400 9.5px "QM Serif", serif'; g.fillStyle = 'rgba(140,175,215,.8)';
    g.fillText('符頭 ' + Q.fuTou + ' · 旬首 ' + Q.xunShou + ' · 旬空 ' + Q.xunKong, CX, CY + 46);
    g.font = '400 9.5px "QM Serif", serif'; g.fillStyle = 'rgba(110,140,175,.8)';
    g.fillText(Q.yinYang + ' · ' + Q.xunShou + '旬 · 中宫 ' + ((C[5] && C[5].e) || '—'), CX, CY + 66);
    var maxP = 0, maxN = 0;
    Object.keys(C).forEach(function (k) { var n = (C[k].astro || []).length; if (n > maxN) { maxN = n; maxP = +k; } });
    if (maxN >= 8) {
      g.font = '400 11px "QM Serif", serif'; g.fillStyle = '#cf4a3a';
      g.fillText((maxN >= 9 ? '九曜同宮' : maxN + '曜同宮') + ' · ' + C[maxP].name + '宮', CX, CY + 86);
    }

    /* 顶部题款 */
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '400 13px "QM Serif", serif'; g.fillStyle = 'rgba(200,220,245,.75)';
    spaced('星曜奇門 · 渾儀 · ' + Q.ju, CX, 34, 2.5);

    /* 四角四柱（与交付版同位置） */
    var ZHU = ['年柱', '月柱', '日柱', '時柱'];
    [0, 1, 2, 3].forEach(function (k) {
      var left = (k % 2 === 0), top = (k < 2);
      var bx = left ? 44 : 956, by = top ? 62 : 936;
      g.textAlign = left ? 'left' : 'right';
      g.textBaseline = 'alphabetic';
      g.font = '400 10px "QM Serif", serif'; g.fillStyle = 'rgba(150,180,215,.75)';
      g.fillText(ZHU[k], bx, by);
      g.font = '400 26px "QM Serif", serif'; g.fillStyle = '#e8f0fb';
      g.fillText(Q.ganzhi[k] || '—', bx, by + 32);
      g.font = '400 9px "QM Serif", serif'; g.fillStyle = 'rgba(130,160,195,.7)';
      g.fillText((Q.ganzhi[k] || '') + (['年', '月', '日', '時'][k]), bx, by + 48);
    });
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';

    /* 页脚：三栏 */
    var fy = 1020;
    g.strokeStyle = 'rgba(150,185,225,.18)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(40, fy - 14); g.lineTo(960, fy - 14); g.stroke();
    var cols = [40, 372, 700];
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = '400 13px "QM Serif", serif'; g.fillStyle = 'rgba(200,220,245,.85)';
    g.fillText('七政四餘 · 黃經 / 方位', cols[0], fy + 8);
    g.fillText('格局 ' + Q.geAll.length + ' 條 · 吉 ' + Q.ji + ' 凶 ' + Q.xiong, cols[1], fy + 8);
    g.fillText('盤 說', cols[2], fy + 8);
    g.font = '400 9.5px "QM Serif", serif'; g.fillStyle = 'rgba(150,180,215,.78)';
    Q.stars.slice(0, 11).forEach(function (s, i) {
      g.fillText((s.n || '—') + '  ' + s.lon.toFixed(1) + '°  ' + (s.az != null ? s.az.toFixed(0) + '°' : '') +
        ' · ' + (s.pal || '-') + '宫', cols[0], fy + 30 + i * 15);
    });
    var geLines = Q.geAll.slice(0, 22).map(function (x) { return (x.pal ? x.pal + '宫·' : '') + x.n; });
    geLines.forEach(function (s, i) {
      var col = i % 2, row = (i - col) / 2;
      g.fillText(s, cols[1] + col * 150, fy + 30 + row * 16);
    });
    var rows = [['法', '拆補 · 超神接氣'], ['宮', '八宮 45° / 三山 15°'], ['層', '神 · 星 · 門 · 天干 · 地支'],
      ['時', Q.time || '—'], ['觀', (Q.lat != null ? Q.lat.toFixed(2) + 'N ' + Q.lon.toFixed(2) + 'E' : '—')]];
    rows.forEach(function (r, i) {
      g.fillStyle = 'rgba(130,160,195,.7)';
      g.fillText(r[0], cols[2], fy + 30 + i * 16);
      g.fillStyle = 'rgba(190,210,235,.8)';
      g.fillText(r[1], cols[2] + 18, fy + 30 + i * 16);
    });
    g.fillStyle = 'rgba(110,140,175,.6)';
    g.font = '400 9px "QM Serif", serif';
    g.fillText('星曜奇門 · 渾儀 · ' + Q.ju, 40, H - 14);
    if (Q.lat != null) {
      g.textAlign = 'right';
      g.fillText('觀測點 ' + Q.lat.toFixed(1) + 'N ' + Q.lon.toFixed(1) + 'E', 960, H - 14);
      g.textAlign = 'left';
    }
    return cv;
  }

  root.Huny = { render: render };

  root.Plugins.register({
    id: 'huny',
    name: '浑仪',
    desc: '把截图整张换成<b>浑仪</b>：八宫占八向、五层成五环的暗底圆盘，星曜按真实方位落在山环外。' +
      '不跟四套主题走（原设计就是暗底海报）。',
    note: '只接管<b>截图</b>；屏幕仍是九宫盘。关掉即回九宫图。阴盘的盘外暗干环暂未画（同隔壁交付的边界）。',
    poster: function (chart, analysis, starMap) {
      return render(chart, analysis, starMap);
    }
  });
}) (typeof window !== 'undefined' ? window : globalThis);
