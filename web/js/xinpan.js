/* ============================================================================
 * xinpan.js —— 心盘（道家阴盘 · 自定义局）
 * ----------------------------------------------------------------------------
 * 算法移植自 wrz1911/daojiayinpan 的「心盘」（qimen_app/js/yinpan_app.js 的 autoFillXinpan）。
 * 口径：选一宫作为**锚点**，定下它的五类符号（八神/九星/八门/天盘干/地盘干），据此推全盘 ——
 *   ① 由锚点地盘干反推局数（阴遁/阳遁不同公式），再按飞序布完整地盘（三奇六仪），中五干寄坤二；
 *   ② 八神按阳顺阴逆的宫序排（符蛇阴六白玄地天），锚点之神落锚点宫；
 *   ③ 九星/八门各自按本宫序旋转，锚点之星门落锚点宫；
 *   ④ 天盘：锚点天盘干与地盘干同字 → 伏吟（照抄地盘），否则按八卦圈整体旋转；
 *   ⑤ 值符宫＝八神为「符」之宫，值符星/值使门由它取本宫星门。
 * ⚠ 本盘**不做暗干**（用户明确）。
 * 本文件是纯算法，不碰 DOM、不依赖本项目引擎；短名与源项目一致：
 *   神 符蛇阴六白玄地天 · 星 蓬芮冲辅英禽心柱任 · 门 休死伤杜开惊生景 · 干 甲乙丙丁戊己庚辛壬癸
 * ========================================================================== */
(function (root) {
  'use strict';

  /* 飞序上三奇六仪的分配（甲隐于旬首，不上盘） */
  var GAN = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
  var BAGUA = [1, 8, 3, 4, 9, 2, 7, 6];              /* 八卦顺时针：坎艮震巽离坤兑乾 */
  var GODS = ['符', '蛇', '阴', '六', '白', '玄', '地', '天'];
  var SHUN_GOD = [1, 8, 3, 4, 9, 2, 7, 6];           /* 阳遁顺行 */
  var NI_GOD = [1, 6, 7, 2, 9, 4, 3, 8];             /* 阴遁逆行 */
  var SM_ORDER = [1, 8, 3, 4, 9, 2, 7, 6];           /* 星门本宫序 */
  var G2STAR = { 1: '蓬', 8: '任', 3: '冲', 4: '辅', 9: '英', 2: '芮', 7: '柱', 6: '心' };
  var G2MEN = { 1: '休', 8: '生', 3: '伤', 4: '杜', 9: '景', 2: '死', 7: '惊', 6: '开' };
  var PALS = [1, 2, 3, 4, 6, 7, 8, 9];               /* 八宫（中五不列） */

  /* 飞步序列：从局宫起，阳顺阴逆 */
  function buildFw(juGong, isYin) {
    var fw = [], gp = juGong;
    for (var f = 0; f < 9; f++) {
      fw.push(gp);
      gp = isYin ? (gp === 1 ? 9 : gp - 1) : (gp === 9 ? 1 : gp + 1);
    }
    return fw;
  }

  /* 主入口。o = { anchor, isYin, shen, xing, men, tian, di }，干只取首字（寄干由本函数补） */
  function build(o) {
    o = o || {};
    var anchor = +o.anchor || 0;
    if (PALS.indexOf(anchor) < 0) return { ok: false, why: '锚点必须是八宫之一（中五不列）' };
    var isYin = !!o.isYin;
    var diGan = (o.di || '')[0] || '';
    var tianGan = (o.tian || '')[0] || '';
    if (!diGan || !tianGan) return { ok: false, why: '锚点要定天盘干与地盘干' };
    if (GAN.indexOf(diGan) < 0) return { ok: false, why: '地盘干不能是甲（甲隐于旬首）' };

    /* ① 局数：由锚点地盘干在飞序上的位置反推 */
    var diIdx = GAN.indexOf(diGan);
    var juGong = isYin ? (diIdx + anchor) % 9 : (anchor - diIdx + 9) % 9;
    if (juGong === 0) juGong = 9;
    if (juGong < 1 || juGong > 9) juGong = anchor;
    var juText = (isYin ? '阴遁' : '阳遁') + juGong + '局';
    var fw = buildFw(juGong, isYin);

    /* 地盘：飞序铺三奇六仪，中五之干寄坤二（缀在坤二之后） */
    var diMap = {}, zhongGan = '';
    for (var fi = 0; fi < 9; fi++) {
      var fg = fw[fi];
      if (fg === 5) zhongGan = GAN[fi];
      else diMap[fg] = GAN[fi];
    }
    if (zhongGan && diMap[2]) diMap[2] = diMap[2] + zhongGan;

    /* ② 八神：阳顺阴逆，锚点之神落锚点宫 */
    var godOrder = isYin ? NI_GOD : SHUN_GOD;
    var godIdx = GODS.indexOf(o.shen || '');
    if (godIdx < 0) godIdx = 0;
    var godAnchorIdx = godOrder.indexOf(anchor);
    if (godAnchorIdx < 0) godAnchorIdx = 0;
    var godOffset = godIdx - godAnchorIdx;
    var godMap = {};
    for (var gi = 0; gi < 8; gi++) {
      godMap[godOrder[gi]] = GODS[(gi + godOffset + 8) % 8];
    }
    var fuGong = 0;
    PALS.forEach(function (g) { if (godMap[g] === '符') fuGong = g; });
    if (!fuGong) fuGong = anchor;

    /* ③ 星/门：各自按本宫序旋转，锚点之星门落锚点宫 */
    var STAR_SEQ = SM_ORDER.map(function (g) { return G2STAR[g]; });
    var MEN_SEQ = SM_ORDER.map(function (g) { return G2MEN[g]; });
    var anchorSmIdx = SM_ORDER.indexOf(anchor);
    var starIdx = STAR_SEQ.indexOf(o.xing || '');
    if (starIdx < 0) starIdx = 0;
    var menIdx = MEN_SEQ.indexOf(o.men || '');
    if (menIdx < 0) menIdx = starIdx;
    var starOffset = starIdx - anchorSmIdx;
    var menOffset = menIdx - anchorSmIdx;
    var starMap = {}, menMap = {};
    for (var si = 0; si < 8; si++) {
      var sg = SM_ORDER[si];
      starMap[sg] = STAR_SEQ[(si + starOffset + 8) % 8];
      menMap[sg] = MEN_SEQ[(si + menOffset + 8) % 8];
    }

    /* ④ 天盘：同字伏吟（照抄地盘），否则按八卦圈整体旋转 */
    var tianMap = {};
    var srcGong = 0;
    PALS.forEach(function (g) {
      if (!srcGong && diMap[g] && diMap[g].indexOf(tianGan) >= 0) srcGong = g;
    });
    if (!srcGong || srcGong === 5) srcGong = anchor;
    if (tianGan === diGan) {
      PALS.forEach(function (g) { tianMap[g] = diMap[g] || ''; });
    } else {
      var srcBw = BAGUA.indexOf(srcGong), dstBw = BAGUA.indexOf(anchor);
      if (srcBw < 0) srcBw = 0;
      if (dstBw < 0) dstBw = 0;
      for (var ti = 0; ti < 8; ti++) {
        var tg = BAGUA[ti];
        tianMap[tg] = diMap[BAGUA[(srcBw + ti - dstBw + 8) % 8]] || '';
      }
    }

    /* ⑤ 汇总八宫（锚点保留用户所选的神/星/门；天地盘干按推算结果，含寄干时拆成两个字） */
    var d = {};
    PALS.forEach(function (g) {
      var tRaw = tianMap[g] || '', dRaw = diMap[g] || '';
      d[g] = {
        shen: g === anchor ? (o.shen || '') : (godMap[g] || ''),
        xing: g === anchor ? (o.xing || '') : (starMap[g] || ''),
        men: g === anchor ? (o.men || '') : (menMap[g] || ''),
        tian: g === anchor ? (tRaw[0] || tianGan) : (tRaw[0] || ''),
        tian2: (g === anchor && (o.tian || '')[1]) ? o.tian[1] : (tRaw[1] || ''),
        di: g === anchor ? (dRaw[0] || diGan) : (dRaw[0] || ''),
        di2: (g === anchor && (o.di || '')[1]) ? o.di[1] : (dRaw[1] || '')
      };
    });

    /* 值符宫、值符星、值使门（门取本宫门） */
    var zhiFuStar = '天' + (G2STAR[fuGong] || '') + '星';
    var zhiShiMen = (G2MEN[fuGong] || '') + '门';
    var zhiShiGong = 0;
    PALS.forEach(function (g) { if (!zhiShiGong && menMap[g] === G2MEN[fuGong]) zhiShiGong = g; });

    return {
      ok: true, anchor: anchor, isYin: isYin, juGong: juGong, juText: juText, fw: fw,
      d: d, fuGong: fuGong, zhiFuStar: zhiFuStar, zhiShiMen: zhiShiMen, zhiShiGong: zhiShiGong,
      fuyin: tianGan === diGan
    };
  }

  root.Xinpan = {
    build: build, buildFw: buildFw,
    GAN: GAN, BAGUA: BAGUA, GODS: GODS, SHUN_GOD: SHUN_GOD, NI_GOD: NI_GOD,
    SM_ORDER: SM_ORDER, G2STAR: G2STAR, G2MEN: G2MEN, PALS: PALS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Xinpan;
})(typeof window !== 'undefined' ? window : globalThis);
