/* ============================================================================
 * changsheng.js —— 十二长生 · 含义环盘（2026-11-01 定稿）
 * ----------------------------------------------------------------------------
 * 挂在**盘面页 → 旬空下那条横线 → 折叠页 → 长生** 的子页面里（不是插件、不是设置开关）。
 * 与那页原有的「本盘九宫表 / 十天干对照」并排：本文件只负责「十二阶含义」这一块。
 *
 * 交互（用户 2026-11-01 点名）：
 *   · 点**环上的圆点**就能选中 —— 不是只点外面那圈字；
 *   · 弧段也做了透明加宽的命中区，点弧同样选得中；字仍是命中区（三处都能点）。
 * 版式：全用 SVG viewBox 0 0 360 360 等比缩放，320/360/390 只缩不放，不会溢出。
 * ========================================================================== */
(function () {
  'use strict';

  var DATA = [
    { n: '长生', c: 1, y: '如婴儿初生，气机始动', m: '万物萌发之始', d: '主生机、开端、得庇荫、受扶持；落宫者多带新生之象，事有起头。' },
    { n: '沐浴', c: 1, y: '如婴孩沐浴，裸身无遮', m: '又名「败」', d: '主桃花情欲、不稳易变、面软心浮；亦主洗旧更新、不设防。' },
    { n: '冠带', c: 1, y: '如少年加冠，衣冠初成', m: '渐能自立、有名有位之始', d: '主成长、包装、礼仪、声名初显，喜修饰。' },
    { n: '临官', c: 1, y: '如出仕临官，独当一面', m: '又名「建禄」，气已壮', d: '主自立担当、俸禄、事业根基，皆已成立。' },
    { n: '帝旺', c: 1, y: '如帝王临朝，盛极一时', m: '气之极盛', d: '主权柄、鼎盛、锋芒最露；然物极必反，旺极则衰机已伏。' },
    { n: '衰', c: 2, y: '如中年过后，锋芒渐收', m: '盛极而退，气始下行', d: '主减退保守、力不从心；然衰中有稳，守成可也。' },
    { n: '病', c: 2, y: '如身染微恙，行止渐缓', m: '气弱多滞', d: '主疾患疲惫、优柔纠葛、力弱难振；亦主思虑细密、善察隐秘。' },
    { n: '死', c: 2, y: '如气息已尽，形骸犹存', m: '气尽而形留', d: '主终结、僵滞、不动、失机；亦主收藏沉淀、了断旧事。' },
    { n: '墓', c: 2, y: '如入土为安，藏而不露', m: '又名「库」，气入而藏', d: '主收藏积蓄、封闭保守、财库旧物；冲开则发。' },
    { n: '绝', c: 2, y: '如形神俱灭，了无痕迹', m: '气绝无余', d: '主断绝孤立、归零落空；亦是彻底转向之处，绝处可逢生。' },
    { n: '胎', c: 3, y: '如一点灵光，暗结胎元', m: '受气成胎，一阳来复', d: '主孕育计划、萌芽初动、新的可能，未成形而有望。' },
    { n: '养', c: 3, y: '如十月怀胎，静待产期', m: '受养成形，气渐充盈', d: '主滋养蓄势、抚育庇护、将发未发，宜养不宜催。' }
  ];
  var BADGE = { 1: '生旺', 2: '衰退', 3: '轮回' };
  var CLS = { 1: 'c1', 2: 'c2', 3: 'c3' };
  var CX = 180, CY = 180, R_RING = 124, R_LABEL = 150;
  var NS = 'http://www.w3.org/2000/svg';

  function rad(d) { return d * Math.PI / 180; }
  function pt(deg, r) { return [CX + Math.cos(rad(deg - 90)) * r, CY + Math.sin(rad(deg - 90)) * r]; }
  function segColor(c) { return c === 1 ? 'var(--accent)' : c === 2 ? 'var(--ink-3)' : 'var(--ji)'; }
  function wrap2(s) { var i = s.indexOf('，'); return i < 0 ? [s, ''] : [s.slice(0, i + 1), s.slice(i + 1)]; }

  var ctx = null;   /* { svg, name, badge, yu, yu2, detail, host } */

  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  function build(host) {
    host.innerHTML = '';
    var box = document.createElement('div'); box.className = 'cs-ring';
    var svg = el('svg', { viewBox: '0 0 360 360', class: 'cs-svg', role: 'group', 'aria-label': '十二长生环盘' });
    box.appendChild(svg);
    var detail = document.createElement('div'); detail.className = 'cs-detail';
    host.appendChild(box); host.appendChild(detail);

    svg.appendChild(el('circle', { cx: CX, cy: CY, r: R_RING, fill: 'none', stroke: 'var(--line)', 'stroke-width': 1 }));
    svg.appendChild(el('circle', { cx: CX, cy: CY, r: 86, fill: 'none', stroke: 'var(--line-2)', 'stroke-width': 1 }));

    DATA.forEach(function (d, i) {
      var a0 = i * 30 + 3 - 90, a1 = (i + 1) * 30 - 3 - 90;
      var p0 = [CX + Math.cos(rad(a0)) * R_RING, CY + Math.sin(rad(a0)) * R_RING];
      var p1 = [CX + Math.cos(rad(a1)) * R_RING, CY + Math.sin(rad(a1)) * R_RING];
      var dd = 'M ' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
        ' A ' + R_RING + ' ' + R_RING + ' 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
      d.arc = el('path', { d: dd, fill: 'none', stroke: segColor(d.c), 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0.35 });
      svg.appendChild(d.arc);

      var t = i * 30 - 90;
      var q0 = pt(i * 30, R_RING - 4), q1 = pt(i * 30, R_RING + 4);
      svg.appendChild(el('line', { x1: q0[0].toFixed(2), y1: q0[1].toFixed(2), x2: q1[0].toFixed(2), y2: q1[1].toFixed(2), stroke: 'var(--line-2)', 'stroke-width': 0.8 }));

      var p = pt(i * 30, R_RING), q = pt(i * 30, R_LABEL);
      d.dot = el('circle', { cx: p[0].toFixed(2), cy: p[1].toFixed(2), r: 3.4, fill: segColor(d.c), class: 'cs-dot' });
      svg.appendChild(d.dot);
      d.label = el('text', { x: q[0].toFixed(2), y: (q[1] + 4).toFixed(2), 'text-anchor': 'middle', class: 'cs-lab', 'font-size': 11 }, d.n);
      svg.appendChild(d.label);

      /* 三处命中区：圆点（主）、弧段（透明加宽）、文字 */
      svg.appendChild(el('circle', { cx: p[0].toFixed(2), cy: p[1].toFixed(2), r: 14, fill: 'transparent', class: 'cs-hit', 'data-i': i }));
      svg.appendChild(el('path', { d: dd, fill: 'none', stroke: 'transparent', 'stroke-width': 16, class: 'cs-hit', 'data-i': i }));
      svg.appendChild(el('circle', { cx: q[0].toFixed(2), cy: q[1].toFixed(2), r: 15, fill: 'transparent', class: 'cs-hit', 'data-i': i }));
    });

    var name = el('text', { x: CX, y: CY - 26, 'text-anchor': 'middle', class: 'cs-now', 'font-size': 27 });
    var badge = el('text', { x: CX, y: CY + 2, 'text-anchor': 'middle', class: 'cs-now-badge', 'font-size': 10 });
    var yu = el('text', { x: CX, y: CY + 26, 'text-anchor': 'middle', class: 'cs-now-yu', 'font-size': 10.5 });
    var yu2 = el('text', { x: CX, y: CY + 42, 'text-anchor': 'middle', class: 'cs-now-yu', 'font-size': 10.5 });
    [name, badge, yu, yu2].forEach(function (e) { svg.appendChild(e); });

    svg.addEventListener('click', function (e) {
      var t = e.target.closest('[data-i]');
      if (t) select(+t.getAttribute('data-i'));
    });

    ctx = { svg: svg, name: name, badge: badge, yu: yu, yu2: yu2, detail: detail };
    select(0);
  }

  function select(i) {
    if (!ctx) return;
    var d = DATA[i];
    ctx.name.textContent = d.n;
    ctx.badge.textContent = BADGE[d.c];
    ctx.badge.setAttribute('fill', segColor(d.c));
    var two = wrap2(d.y);
    ctx.yu.textContent = two[0];
    ctx.yu2.textContent = two[1];
    DATA.forEach(function (x, j) {
      var on = (j === i);
      x.dot.setAttribute('r', on ? 5.2 : 3.4);
      x.dot.setAttribute('opacity', on ? 1 : 0.55);
      x.label.setAttribute('class', 'cs-lab' + (on ? ' on' : ''));
      x.arc.setAttribute('stroke-width', on ? 3.2 : 2.2);
      x.arc.setAttribute('opacity', on ? 1 : 0.35);
    });
    ctx.detail.innerHTML = '<div class="cs-d-top"><b>' + d.n + '</b><em class="' + CLS[d.c] + '">' +
      BADGE[d.c] + '</em><span>' + d.m + '</span></div>' +
      '<p class="cs-d-yu">' + d.y + '</p><p class="cs-d-txt">' + d.d + '</p>';
  }

  function mount(host) { if (host) build(host); }

  window.ChangSheng = { DATA: DATA, mount: mount, select: select };
})();
