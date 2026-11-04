/* ============================================================================
 * yinpan.js —— 道家阴盘 · 起局
 * ----------------------------------------------------------------------------
 * 算法移植自 wrz1911/daojiayinpan 的引擎（qimen_app/js/qimen_engine_min.js 的 qimenChart）。
 * 与「时家拆补/置闰」无关，阴盘自己一套：
 *   ① 定局用**数字定局**：ju = (年支序+1) + 农历月 + 农历日 + (时支序+1)，再 %9（0 记 9）；
 *   ② 阴/阳遁按节气：冬至到芒种（即自冬至起前 12 个节气）阳遁，夏至起阴遁；
 *   ③ 地盘：从局宫起，阳遁顺飞、阴遁逆飞，按 戊己庚辛壬癸丁丙乙 铺九宫；中五之干寄坤二；
 *   ④ 值符星/值使门由**旬首落宫**取（FZHUAN 表），值使门落宫 = 旬首宫 ± 时干（阳加阴减）；
 *   ⑤ 天盘干随九星一起按 ZHUAN/FZHUAN 旋转；八门单独旋转；八神按阳顺阴逆（SHEN_Y/SHEN_A）；
 *   ⑥ 暗干：按「值使门落宫 vs 值时干落宫」旋转地盘干，另有 1 宫三合伏吟的重排特例。
 * ⚠ 暗干只有阴盘有；心盘不做（用户明确）。
 * 本文件只依赖本项目的历法（js/lunar.js），不引入 tyme4j。
 * ========================================================================== */
(function (root) {
  'use strict';
  var Lunar = root.Lunar || (typeof require !== 'undefined' ? require('./lunar.js') : null);

  var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var GAN6 = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
  var MEN = ['', '休', '生', '伤', '杜', '景', '死', '惊', '开'];
  var XING = ['', '蓬', '任', '冲', '辅', '英', '芮', '柱', '心'];
  var SHEN_Y = ['', '符', '天', '地', '玄', '白', '六', '阴', '蛇'];   /* 阳遁顺行 */
  var SHEN_A = ['', '符', '蛇', '阴', '六', '白', '玄', '地', '天'];   /* 阴遁逆行 */
  var ZHUAN = [0, 1, 8, 3, 4, 9, 2, 7, 6];        /* 转盘宫序 */
  var FZHUAN = [0, 1, 6, 3, 4, 6, 8, 7, 2, 5];     /* 宫 → 转盘序（中五取六，与源项目一致） */
  var YIMA = [2, 11, 8, 5];                        /* 马星：申子辰→寅 … */
  var ZHI2G = [1, 8, 8, 3, 4, 4, 9, 2, 2, 7, 6, 6];
  var LIUYI = [0, 4, 5, 6, 7, 8, 9, 3, 2, 1];      /* 暗干伏吟重排用的六仪序（源表原样） */
  var CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var PALS = [1, 2, 3, 4, 6, 7, 8, 9];

  function w9(g) { while (g > 9) g -= 9; while (g < 1) g += 9; return g; }
  function w8(j) { while (j > 8) j -= 8; while (j < 1) j += 8; return j; }
  function sz(g, z) { return GAN[g] + ZHI[z]; }

  /* 起局。yangs 可指定 '阴' / '阳' 覆盖（对应源项目的自选局）；opt.ju 可指定局数 */
  function cast(y, m, d, h, mi, opt) {
    opt = opt || {};
    /* 23 点这一档**按我们自己的口径**（用户明确）：不走源项目那种"日期推进一天、时归 0"，
       而是本项目历法的晚子时/晚日 —— lateZi 只影响日柱，农历仍按实际时刻算。 */
    var cal = Lunar.cast(y, m, d, h, mi, { lateZi: opt.lateZi !== false });
    var ci = cal.index, lun = cal.lunar;

    /* 节气序号换成源项目口径：0=冬至（我们 22=冬至） */
    var ti = ((ci.seasonID - 22 + 24) % 24);
    var isY = opt.yang === '阴' ? true : (opt.yang === '阳' ? false : ti >= 12);

    /* 年柱/时柱的六十甲子序（时柱：甲己日甲子起） */
    var yI = ci.yearIdx;
    var hI = (ci.dayGan % 5) * 12 + ci.hourZhi;

    /* ① 数字定局 */
    var ju = (yI % 12 + 1) + lun.month + lun.day + (hI % 12 + 1);
    ju = ju % 9; if (ju === 0) ju = 9;
    if (opt.ju) ju = +opt.ju;

    /* 旬首 / 空亡 / 马星 */
    var xs = Math.floor(hI / 10) * 10;
    var xunShou = sz(xs % 10, xs % 12);
    var kongWang = ZHI[(xs + 10) % 12] + ZHI[(xs + 11) % 12];
    var maZhi = ZHI[YIMA[hI % 4]], maGong = ZHI2G[YIMA[hI % 4]];

    /* ③ 地盘：局宫起，阳顺阴逆飞布三奇六仪；中五之干寄坤二 */
    var di = {}, dgg = 0, sgg = 0, i, g;
    var hiddenIdx = (xs / 10 % 6) + 4;                 /* 旬首之仪在 GAN6 里的位置 */
    for (i = 0; i < 9; i++) {
      g = w9(isY ? ju - i : ju + i);
      var gan = GAN6[i];
      if (g !== 5) di[g] = gan;
      if (gan === GAN[hiddenIdx]) dgg = g;             /* 旬首落宫 */
      if (gan === GAN[hI % 10]) sgg = g;               /* 时干落宫 */
    }
    if (sgg === 0) sgg = dgg;
    var zhong = '';
    for (i = 0; i < 9; i++) { g = w9(isY ? ju - i : ju + i); if (g === 5) { zhong = GAN6[i]; break; } }
    if (di[2] && zhong) di[2] = di[2][0] + zhong;

    /* ④ 值符星 / 值使门 / 值使门落宫 */
    var zfIdx = FZHUAN[dgg];
    var zhiFuStar = '天' + (dgg === 5 ? '禽' : XING[zfIdx]) + '星';
    var zhiShiGate = MEN[FZHUAN[dgg]] + '门';
    var effGan = hI % 10;
    var mg = w9(isY ? dgg - effGan : effGan + dgg);

    /* ⑤ 天盘干随九星旋转；八门单独旋转；八神阳顺阴逆 */
    var xingM = {}, tianM = {}, menM = {}, shenM = {}, j, gp;
    var vS = FZHUAN[sgg] - FZHUAN[dgg];
    for (i = 1; i < 9; i++) {
      j = w8(i - vS); gp = ZHUAN[i];
      xingM[gp] = XING[j];
      tianM[gp] = (di[ZHUAN[j]] || '').slice(0, 2);
    }
    var vM = FZHUAN[mg] - FZHUAN[dgg];
    for (i = 1; i < 9; i++) menM[ZHUAN[i]] = MEN[w8(i - vM)];
    var vSh = FZHUAN[sgg] - 1, so = isY ? SHEN_Y : SHEN_A;
    for (i = 1; i < 9; i++) shenM[ZHUAN[i]] = so[w8(i - vSh)];

    /* ⑥ 暗干：先按 值使门落宫↔值时干落宫 旋转地盘干 */
    var agM = {}, vA = FZHUAN[sgg] - FZHUAN[mg];
    for (i = 1; i < 9; i++) agM[ZHUAN[i]] = di[ZHUAN[w8(i + vA)]] || '';
    agM[5] = '';
    /* 1 宫「暗干＝天盘干＝地盘干」三合 → 伏吟重排（源项目的特例，原样保留） */
    var ag1 = agM[1] || '', t1 = (tianM[1] || '')[0] || '', d1 = (di[1] || '')[0] || '';
    if (ag1 && ag1 === t1 && ag1 === d1) {
      var v6 = hI % 10;
      if (v6 === 0) v6 = LIUYI[Math.floor(hI / 10) + 1];
      var j6 = 1;
      for (; j6 < 10; j6++) if (v6 === LIUYI[j6]) break;
      v6 = isY ? j6 + 4 : j6 - 4;
      for (i = 1; i < 10; i++) agM[i] = GAN[LIUYI[w9(isY ? v6 - i + 1 : v6 + i - 1)]];
      if (agM[1] === t1) {
        var gan2 = agM[2] ? agM[2][0] : '';
        for (j6 = 1; j6 < 10; j6++) if (gan2 === GAN[LIUYI[j6]]) break;
        v6 = isY ? j6 + 4 : j6 - 4;
        for (i = 1; i < 10; i++) agM[i] = GAN[LIUYI[w9(isY ? v6 - i + 1 : v6 + i - 1)]];
      }
      if (agM[2] && agM[5]) agM[2] = agM[2] + agM[5];
      agM[5] = '';
    }

    /* 汇总八宫（短名 + 单字干；tian2/di2 是坤二的寄干） */
    var d8 = {};
    PALS.forEach(function (gg) {
      var tRaw = tianM[gg] || '', dRaw = di[gg] || '';
      d8[gg] = {
        shen: shenM[gg] || '', xing: xingM[gg] || '', men: menM[gg] || '',
        tian: tRaw[0] || '', tian2: tRaw[1] || '',
        di: dRaw[0] || '', di2: dRaw[1] || '',
        anGan: agM[gg] || '',
        kong: (gg === ZHI2G[(xs + 10) % 12] || gg === ZHI2G[(xs + 11) % 12]),
        ma: (gg === maGong)
      };
    });

    return {
      ok: true, ju: ju, isYin: isY, juText: (isY ? '阴遁' : '阳遁') + CN[ju] + '局',
      ganzhi: cal.ganzhi, calendar: cal, lunarText: cal.lunarText,
      xunShou: xunShou, kongWang: kongWang, maXing: maZhi, maGong: maGong,
      zhiFuGong: dgg, zhiFuStar: zhiFuStar, zhiShiGate: zhiShiGate, zhiShiGong: mg,
      d: d8
    };
  }

  root.Yinpan = {
    cast: cast,
    GAN: GAN, ZHI: ZHI, GAN6: GAN6, MEN: MEN, XING: XING,
    SHEN_Y: SHEN_Y, SHEN_A: SHEN_A, ZHUAN: ZHUAN, FZHUAN: FZHUAN,
    YIMA: YIMA, ZHI2G: ZHI2G, PALS: PALS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Yinpan;
})(typeof window !== 'undefined' ? window : globalThis);
