/* ============================================================================
 * qimen.js —— 星曜奇门 · 排盘引擎（时家奇门 · 转盘 · 拆补法）
 * ----------------------------------------------------------------------------
 * 算法沿用 mQimen(6.3.6) 里那套在用的转盘口径（逐个函数对照移植），
 * 只把「数据来源」换成自研历法层（astro.js + lunar.js），不再依赖预置库。
 *
 * 盘面 9 宫，每宫字段：
 *   pal 宫号(1坎…9离) / name 宫名 / wuxing 宫五行
 *   earth 地盘干 / heaven 天盘干 / mid 中宫干(天禽带来) / hidden 暗干
 *   star 九星 / gate 八门 / deity 八神
 *   kong 空亡 / ma 驿马
 *   dutyStar 是否值符星所在 / dutyGate 是否值使门所在
 * ========================================================================== */
(function (root) {
  'use strict';
  var Astro = root.Astro, Lunar = root.Lunar;
  if (!Astro && typeof require !== 'undefined') {
    Astro = require('./astro.js');
    root.Astro = Astro;
    Lunar = require('./lunar.js');
    root.Lunar = Lunar;
  }

  /* 洛书：1坎 2坤 3震 4巽 5中 6乾 7兑 8艮 9离 */
  var PAL_NAME = ['', '坎', '坤', '震', '巽', '中', '乾', '兑', '艮', '离'];
  var PAL_WX = ['', '水', '土', '木', '木', '土', '金', '金', '土', '火'];
  var PAL_DIR = ['', '北', '西南', '东', '东南', '中', '西北', '西', '东北', '南'];
  var PAL_TRIGRAM = ['', '☵', '☷', '☳', '☴', '☯', '☰', '☱', '☶', '☲'];
  /* 八卦纳支（按后天八卦方位分属十二支）：
     坎一宫纳子 · 艮八宫纳丑寅 · 震三宫纳卯 · 巽四宫纳辰巳 ·
     离九宫纳午 · 坤二宫纳未申 · 兑七宫纳酉 · 乾六宫纳戌亥。
     一宫一支、四隅宫各两支，合起来正好十二支；中五宫不纳支。
     这是「地支面」用的表 —— 与纳甲六爻的纳支（乾内子寅辰…）不是一回事。 */
  /* ⚠ 艮八宫按用户口径写作「寅丑」（口诀「坎纳子、艮纳寅丑」就是这个读序）——
     别按十二支表顺序改成"丑寅"，用户已明确说过那是错的。 */
  var PAL_ZHI = [null, ['子'], ['未', '申'], ['卯'], ['辰', '巳'], [],
                 ['戌', '亥'], ['酉'], ['寅', '丑'], ['午']];
  /* 星/门/神 均按「本宫号」编号，便于比对伏吟反吟 */
  var STAR = ['', '天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'];
  var STAR_WX = ['', '水', '土', '木', '木', '土', '金', '金', '土', '火'];
  /* 八门。1–9 是转盘的八门（第 5 位留空：转盘里中宫不设门）；
     10 = **中门**，只出现在飞盘 —— 飞盘九宫全占，中宫是实宫，它的本门就是中门，五行属土。 */
  var GATE = ['', '休门', '死门', '伤门', '杜门', '', '开门', '惊门', '生门', '景门', '中门'];
  var GATE_WX = ['', '水', '土', '木', '木', '', '金', '金', '土', '火', '土'];
  /* 八神。前八个转盘用；9=太常 是**飞盘**多出来的那一位（飞盘九神），10=勾陈 11=朱雀。
     ⚠ 阳遁该用「勾陈·朱雀」，阴遁才用「白虎·玄武」—— mQimen 的八神表里本就有勾陈朱雀，
     早先移植时丢了、两种遁都用白虎玄武，本轮一并改正。 */
  var DEITY = ['', '值符', '腾蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天', '太常', '勾陈', '朱雀'];
/* ★ 2026-10-07：八神的**五行**（通行口径）与**英文键**。
   ⚠ 八神各家五行归属说法不一，这里统一用最常见的一套：
     值符木 · 腾蛇火 · 太阴金 · 六合木 · 白虎金 · 玄武水 · 九地土 · 九天金 · 太常土 · 勾陈土 · 朱雀火
   为什么要有这张表：颜色要挂**在神身上**，不能挂"位置号"——
   同一个号在 转盘主流 / 转盘勾陈朱雀派 / 飞盘 下是不同的神
   （5 号：白虎 / 勾陈 / 白虎；6 号：玄武 / 朱雀 / 太常），挂位置号必然串色。
   DEITY_KEY 给 CSS 类名用（.qm-shen-gouchen 之类，见 web/css/pan.css）。 */
var DEITY_KEY = ['', 'zhifu', 'tengshe', 'taiyin', 'liuhe', 'baihu', 'xuanwu', 'jiudi', 'jiutian', 'taichang', 'gouchen', 'zhuque'];
var DEITY_WX = ['', '木', '火', '金', '木', '金', '水', '土', '金', '土', '土', '火'];
  /* 八神落宫的四种序列。⚠ 主流是**阳遁也用白虎·玄武**（不是勾陈·朱雀），
     勾陈·朱雀只是另一派读法 —— 做成开关，默认关。 */
  var GOD_RING_YANG = [1, 2, 3, 4, 5, 6, 7, 8];        /* 转盘·阳（主流） */
  var GOD_RING_YANG_GC = [1, 2, 3, 4, 10, 11, 7, 8];   /* 转盘·阳（勾陈朱雀派） */
  var GOD_RING_YIN = [1, 2, 3, 4, 5, 6, 7, 8];         /* 转盘·阴 */
  var GOD_FLY_YANG = [1, 2, 3, 4, 5, 9, 6, 7, 8];      /* 飞盘·阳（主流，多一位太常） */
  var GOD_FLY_YANG_GC = [1, 2, 3, 4, 10, 9, 11, 7, 8];
  var GOD_FLY_YIN = [1, 2, 3, 4, 5, 9, 6, 7, 8];       /* 飞盘·阴 */
  /* 飞盘九星序：按本宫号 1..9（蓬芮冲辅禽心柱任英）。
     转盘沿的是八宫环，飞盘走的是宫号序 —— 这就是「飞」与「转」的分野。 */
  var STAR_FLY = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  /* 飞盘八门：八门 + 中门，同样按本宫号排（休死伤杜 · 中门 · 开惊生景） */
  var GATE_FLY = [1, 2, 3, 4, 10, 6, 7, 8, 9];
  var STEM = ['', '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var STEM_WX = ['', '木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
  /* 三奇六仪 排布顺序：戊己庚辛壬癸丁丙乙 */
  var LEAD_SEQ = [5, 6, 7, 8, 9, 10, 4, 3, 2];
  /* 阳遁九宫顺行顺序（数组下标 = 宫号-1） */
  var YANG_SEQ = [0, 7, 2, 3, 8, 1, 6, 5];
  /* 该顺序下各宫本来的星 / 门 */
  var STAR_SEQ = [1, 8, 3, 4, 9, 2, 7, 6];
  var GATE_SEQ = [1, 8, 3, 4, 9, 2, 7, 6];
  /* 对宫（反吟判断用）：1↔9 2↔8 3↔7 4↔6 5↔5 */
  var OPPOSITE = [0, 9, 8, 7, 6, 5, 4, 3, 2, 1];

  /* 二十四节气 → [上元, 中元, 下元] 局数（阳遁/阴遁由节气决定） */
  var JU_TABLE = {
    1: [8, 5, 2], 2: [9, 6, 3], 3: [1, 7, 4], 4: [3, 9, 6], 5: [4, 1, 7], 6: [5, 2, 8],
    7: [4, 1, 7], 8: [5, 2, 8], 9: [6, 3, 9], 10: [9, 3, 6], 11: [8, 2, 5], 12: [7, 1, 4],
    13: [2, 5, 8], 14: [1, 4, 7], 15: [9, 3, 6], 16: [7, 1, 4], 17: [6, 9, 3], 18: [5, 8, 2],
    19: [6, 9, 3], 20: [5, 8, 2], 21: [4, 7, 1], 22: [1, 7, 4], 23: [2, 8, 5], 24: [3, 9, 6]
  };
  var YUAN_NAME = ['上元', '中元', '下元'];

  function mod(n, m) { return ((n % m) + m) % m; }

  /* ---------------------------------------------------------------- 定局 */
  /* 拆补法：① 取当前节气 ② 取最近的甲/己日为符头 ③ 符头地支定上中下元
     ④ 查表得局数 ⑤ 冬至→芒种阳遁，夏至→大雪阴遁 */
  /* ============================================================================
   * 置闰法（符头链 + 超神接气置闰）
   * ----------------------------------------------------------------------------
   * 与拆补法的唯一差别，是「用哪个节气的局数表」：
   *   拆补法 —— 用当天实际所在的节气
   *   置闰法 —— 用**符头链指派**给这个符头循环的节气（可能因置闰而重用本气）
   * 三元（上/中/下）两法一样，都由上元符头（甲子·己卯·甲午·己酉）起算。
   *
   * 规则出自《遁甲演义》《奇门宝鉴御定》《奇门遁甲统宗》，同行 qimen-dunjia 的实现
   * 把九部典籍的算例逐日钉住了，这里按同一套规则移植（节气用我们自己的引擎算）：
   *   · 上元符头日支值子午卯酉，每 15 日一见，五日一元
   *   · 下个节气已远在符头之后 8 日以上（典籍作「九日」，含头计数），
   *     且当前节气是**芒种或大雪**时，不取下个节气而重用本气三元 —— 这就是置闰
   *   · 小满、小雪虽超九日十日也不置闰，故日差可续增，待下一个芒种/大雪方闰
   * ========================================================================== */
  var LEAP_SEASON = { 9: 1, 21: 1 };   /* 9=芒种 21=大雪（本引擎 seasonID 1=立春…24=大寒） */
  var LEAP_GAP = 8;                    /* 触发日差；典籍作九日，是含头计数，历日差即 8 */

  function dateOfJdn(jdn) { return Astro.fromJulian(jdn - 0.5); }

  /* 一段年份里的全部节气，按日排序 */
  function seasonSeqOf(y0, y1) {
    var out = [], seen = {};
    for (var y = y0; y <= y1; y++) {
      for (var sid = 1; sid <= 24; sid++) {
        var jdUT = Astro.solarTermJD(y, sid);
        /* ⚠ 取节气的「日」别绕 fromJulian：它只到「分」，23:59:47 的冬至会被舍进次日
           （1900–2100 里正好 1951 冬至这一条），置闰链的日差会跟着差一天。 */
        var jdn = Lunar.dayJDN(jdUT);
        var k = jdn + ':' + sid;
        if (seen[k]) continue;
        seen[k] = 1;
        out.push({ jdn: jdn, seasonID: sid });
      }
    }
    out.sort(function (a, b) { return a.jdn - b.jdn; });
    return out;
  }

  /* --------------------------------------------------------------------------
   * 链的锚点：《奇门遁甲统宗》明载的**正授** ——
   *   「直至康熙五十八年六月二十三日立秋，而甲子符头恰当日，是为正授，本日即是阴遁二局。」
   *   西历 1719-08-08：甲子上元符头恰逢立秋交节。
   * 这一条把符号链钉死在唯一相位上。之前按"目标年前推 N 年"起步不行 ——
   * 置闰只在芒种/大雪两处落子（24 个节气里只有 2 个），相位一旦偏了就回不来，
   * 实测助跑 10 年对、20 年错、30 年又对，纯属撞运气。
   * 锚定之后：1950–2050 抽样 2424 点，与同行 qimen-dunjia（那边有九部典籍算例钉住）
   * 的符头法定局**零分歧**。
   * ------------------------------------------------------------------------ */
  var ZR_ANCHOR = [1719, 8, 8];   /* 正授日 */
  var ZR_ANCHOR_SID = 13;         /* 立秋（本引擎 seasonID 1=立春…24=大寒） */

  var _zr = null;
  function zhirunChain(targetJDN) {
    var ty = dateOfJdn(targetJDN).y;
    if (_zr && ty <= _zr.untilYear) return _zr;
    var aJdn = Lunar.jdnOf(ZR_ANCHOR[0], ZR_ANCHOR[1], ZR_ANCHOR[2]);
    if (targetJDN < aJdn) return null;                 /* 锚点之前不提供置闰 */
    var y1 = ty + 2;
    var seq = seasonSeqOf(ZR_ANCHOR[0] - 1, y1);
    var ai = -1;
    for (var i = 0; i < seq.length; i++) {
      if (seq[i].jdn >= aJdn && seq[i].seasonID === ZR_ANCHOR_SID) { ai = i; break; }
    }
    if (ai < 0) return null;
    var map = {}, days = [], day = aJdn, idx = ai, prev = null;
    var until = Lunar.jdnOf(y1, 12, 31);
    while (day <= until) {
      var leap = false;
      if (prev !== null) {
        var cand = prev + 1;
        var cg = (cand < seq.length) ? (seq[cand].jdn - day) : Infinity;
        if (cg >= LEAP_GAP && LEAP_SEASON[seq[prev].seasonID]) { idx = prev; leap = true; }
        else idx = cand;
      }
      if (idx >= seq.length) break;
      map[day] = { sid: seq[idx].seasonID, gap: seq[idx].jdn - day, leap: leap };
      days.push(day);
      prev = idx;
      day += 15;
    }
    _zr = { map: map, days: days, untilYear: y1 };
    return _zr;
  }

  /* 二分找最后一个不迟于 target 的符头日 */
  function zhirunAt(targetJDN) {
    var z = zhirunChain(targetJDN);
    if (!z) return null;
    var lo = 0, hi = z.days.length - 1, found = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (z.days[mid] <= targetJDN) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (found < 0) return null;
    var e = z.map[z.days[found]];
    e = { day: z.days[found], sid: e.sid, gap: e.gap, leap: e.leap };
    return e;
  }

  /* 超神 / 接气 / 正授：符头先到为超神，节气先到为接气 */
  function chaoJieOf(gap) { return gap === 0 ? '正授' : (gap > 0 ? '超神' : '接气'); }

  function resolveJuZhirun(y, m, d) {
    var target = Lunar.jdnOf(y, m, d);
    var found = zhirunAt(target);
    if (!found) return null;
    var yuan = Math.floor((target - found.day) / 5);
    if (yuan < 0 || yuan > 2) return null;
    var sid = found.sid;
    var polarity = (sid >= 22 || sid <= 9) ? 1 : -1;
    var cycle = JU_TABLE[sid][yuan];
    var gi = Lunar.dayGanZhiIndex(found.day, false);
    return {
      system: 'zhirun',
      seasonID: sid, seasonName: Astro.SEASON_NAME[sid],
      polarity: polarity, yinYang: polarity > 0 ? '阳遁' : '阴遁',
      cycle: cycle, yuan: yuan, yuanName: YUAN_NAME[yuan],
      fuTou: STEM[(gi % 10) + 1] + Lunar.ZHI[gi % 12], fuZhi: (gi % 12) + 1,
      gap: found.gap, chaoJie: chaoJieOf(found.gap), leap: !!found.leap,
      juText: (polarity > 0 ? '阳遁' : '阴遁') + ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'][cycle] + '局'
    };
  }

  /* ★ 定局取节气用「起局那一刻」，不是取当天正午。
     旧写法写死 JulianDay(y,m,d,12)（正午采样）：交节在下午/夜里的日子，整日都会用上一个
     节气的局；而界面上的节气名来自时刻级 seasonAt —— 于是同屏出现「立春·中元」配「大寒九局」。
     2025 年有 23 个交节日、152 个整点落在这类自相矛盾里。改按时刻后两者同源。 */
  function resolveJu(y, m, d, h, mi, lateZi, method) {
    if (method === 'zhirun') {
      var z = resolveJuZhirun(y, m, d);
      if (z) return z;
    }
    var jdUT = Astro.julianDay(y, m, d, h + (mi || 0) / 60) - 8 / 24;
    var sa = Astro.seasonAt(jdUT);
    var seasonID = sa.seasonID;
    var jdn = Lunar.jdnOf(y, m, d);
    var di = Lunar.dayGanZhiIndex(jdn, false);
    var dg = (di % 10) + 1;         // 日干 1..10
    var dz = (di % 12) + 1;         // 日支 1..12
    // 最近的甲(1)或己(6)日
    var isJi = dg > 5;
    var fuZhi = mod(dz + (isJi ? 6 - dg : 1 - dg) - 1, 12) + 1;
    var fuGan = isJi ? 6 : 1;
    var yuan = (fuZhi % 3 === 1) ? 0 : (fuZhi % 3 === 0 ? 1 : 2);
    var polarity = (seasonID >= 22 || seasonID <= 9) ? 1 : -1;   // 1=阳遁 -1=阴遁
    var cycle = JU_TABLE[seasonID][yuan];
    /* 符头日 与 节气交节日 的差：>0 符头先到（超神），<0 节气先到（接气） */
    var fuJdn = jdn - ((dg - 1) + (isJi ? 0 : 0));
    fuJdn = jdn - mod(dg - 1, 10) * 1;   /* 甲/己 日 = 日干回退到最近的甲或己 */
    fuJdn = jdn - ((dg >= 6) ? (dg - 6) : (dg - 1));
    var termJdn = Lunar.dayJDN(sa.startJD);   /* 日界直接 floor；别绕 fromJulian（它只到「分」） */
    var gapChaoJie = fuJdn - termJdn;    /* 符头早于节气 = 超神(gap>0) */
    return {
      system: 'chaibu', seasonID: seasonID, seasonName: sa.name,
      seasonStart: sa.startJD, seasonEnd: sa.endJD,
      polarity: polarity, yinYang: polarity > 0 ? '阳遁' : '阴遁',
      cycle: cycle, yuan: yuan, yuanName: YUAN_NAME[yuan],
      fuTou: STEM[fuGan] + Lunar.ZHI[fuZhi - 1], fuZhi: fuZhi,
      gap: gapChaoJie, chaoJie: chaoJieOf(gapChaoJie), leap: false,
      juText: (polarity > 0 ? '阳遁' : '阴遁') + ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'][cycle] + '局'
    };
  }

  /* --------------------------------------------------------------- 排盘 */
  /* 由「局数 + 阴阳遁 + 时干支」排出盘面。独立于日期，便于手动起局与测试。 */
  /* 八门本宫（门不落中五；中门本宫就是中五） */
  var DOOR_HOME = { 1: 1, 2: 2, 3: 3, 4: 4, 6: 6, 7: 7, 8: 8, 9: 9, 10: 5 };

  /* 值符星名字。
     ⚠ 转盘里天禽寄天芮（中宫不设星，故 5 → 2）；**飞盘九宫全占，天禽就是天禽** ——
       再折成天芮，就是把转盘的规矩套到飞盘上。 */
  /* 转盘里天禽寄天芮：那一格两个星其实是一处，所以**星名合写成「禽芮」**（用户要求）。
     飞盘九宫全占、天禽就是天禽，照旧分开写。 */
  var STAR_HEQIN = '禽芮';
  function starLabel(idx, flyStar) {
    if (!idx) return '';
    if (flyStar) return STAR[idx];
    if (idx === 5 || idx === 2) return STAR_HEQIN;      /* 转盘：天禽/天芮都读作禽芮 */
    return STAR[idx];
  }
  function dutyStarName(idx, flyStar) { return starLabel(idx, flyStar); }
  /* 值使门同理：旬首仪落中宫时，转盘借坤二的死门；飞盘就用中宫本门 —— 中门。 */
  function dutyGateIdx(idx, flyGate) { return (idx === 5) ? (flyGate ? 10 : 2) : idx; }

  function buildPlate(cycle, polarity, hourHs, hourEb, opt) {
    opt = opt || {};
    var fly = opt.fly || {};
    var k, n, p, q;
    /* 顺逆分家 —— 星门和八神不是一条规矩：
       · 九星、八门：**一律顺飞**（飞盘主流：顺着宫号序飞，阴遁也不倒着走）；
         少数派留在 opt.sgDir === 'yinyang'（星门也阳顺阴逆）。
       · 八神：**阳顺阴逆**（opt.godDir 默认 'yinyang'），'yang' = 永远顺飞。
       ⚠ 早先把这三者绑在同一个 flyDir 上，阴遁时星门也跟着倒飞 —— 那不是主流。
       旧字段 flyDir 仍认，只当八神的方向用，老调用者不至于一夜变盘。 */
    var sgDir = (opt.sgDir === 'yinyang') ? (polarity > 0 ? 1 : -1) : 1;
    var godDir = (opt.godDir == null && opt.flyDir != null)
      ? ((opt.flyDir === 'yang') ? 1 : (polarity > 0 ? 1 : -1))
      : ((opt.godDir === 'yang') ? 1 : (polarity > 0 ? 1 : -1));
    function flyPlace(startIdx, items, dir) {      /* 从 startIdx 起，按宫号序依次落九宫 */
      var out = {}, d = dir || 1;
      for (var q = 0; q < items.length; q++) out[mod(startIdx + d * q, 9)] = items[q];
      return out;
    }
    function cycleFrom(list, first) {             /* 从 first 起取整轮（循环序） */
      var at = list.indexOf(first);
      return at < 0 ? list.slice() : list.slice(at).concat(list.slice(0, at));
    }
    // plate[i] 对应宫号 i+1
    var plate = [];
    for (var i = 0; i < 9; i++) {
      plate.push({
        pal: i + 1, name: PAL_NAME[i + 1], wuxing: PAL_WX[i + 1],
        earth: 0, heaven: 0, mid: 0, hidden: 0,
        star: 0, gate: 0, gateMid: false, deity: 0, kong: false, ma: false
      });
    }
    /* --- 旬首：时干甲(1) 时，以旬首之仪代时干 --- */
    var diffToHour = hourHs - 1;
    var hourLeadEb = mod(hourEb - diffToHour - 1, 12) + 1;
    var hourLead = 5 + mod((13 - hourLeadEb) / 2, 6);      // 5=戊 … 10=癸
    /* --- 地盘三奇六仪 --- */
    var j = cycle, starDuty = 0, gateDuty = 0;
    for (i = 0; i < 9; i++) {
      plate[j - 1].earth = LEAD_SEQ[i];
      if (LEAD_SEQ[i] === hourLead) {
        starDuty = gateDuty = j;
        gateDuty = dutyGateIdx(j, !!fly.gate);             // 转盘借坤二 · 飞盘用中门
      }
      j += (polarity > 0) ? 1 : -1;
      if (j === 10) j = 1; else if (j === 0) j = 9;
    }
    /* --- 天盘：值符随时干 --- */
    var hs = (hourHs === 1) ? hourLead : hourHs;
    var starStart = 0;
    for (i = 0; i < 9; i++) if (plate[i].earth === hs) { starStart = i; break; }
    var hsPalRaw = starStart;                               // 时干落宫的原始下标（飞盘要用中宫本身）
    if (starStart === 4) starStart = 1;                    // 落中宫 → 寄坤二（只有转盘这么办）
    if (fly.star) {
      /* 飞盘：值符星落该宫，其余八星按**宫号序**依次飞入 —— 九宫全占，中宫也有星。
         星序取本宫号序，不是转盘那条八宫环；中宫也不寄坤二，它自己就是一个落点。 */
      var starAt = flyPlace(hsPalRaw, cycleFrom(STAR_FLY, starDuty), sgDir);   // 天禽也算值符星
      for (k = 0; k < 9; k++) {
        var sk1 = starAt[k];
        if (!sk1) continue;
        var p1 = plate[k];
        p1.star = sk1;
        p1.heaven = plate[sk1 - 1].earth;                  // 天盘干 = 该星本宫的地盘干
        /* 飞盘没有「寄宫」：中宫是实宫，天禽自己就落在某处，不必再往天芮身上挂中宫干 */
        p1.mid = 0;
      }
    } else {
      var starTemp = (starDuty === 5) ? 2 : starDuty;      // 天禽随天芮
      var key = 0, starKey = 0;
      for (k = 0; k < 8; k++) if (starStart === YANG_SEQ[k]) { key = k; break; }
      for (k = 0; k < 8; k++) if (starTemp === STAR_SEQ[k]) { starKey = k; break; }
      for (var n = 0; n < 8; n++) {
        var p = plate[YANG_SEQ[key]];
        var homeStar = STAR_SEQ[starKey];
        p.star = homeStar;
        p.heaven = plate[homeStar - 1].earth;
        p.mid = (homeStar === 2) ? plate[4].earth : 0;
        key = (key + 1) % 8; starKey = (starKey + 1) % 8;
      }
    }
    /* --- 八门：值使随时支 ---
       起点分两派：时家／年家从「旬首之仪的地盘宫」起；
       月家／日家从「值使门的本宫」起。走法都是（干−1）步、阳顺阴逆、含中五。 */
    var gateStart = 0;
    if (opt.gateHome) {
      gateStart = (DOOR_HOME[gateDuty] || gateDuty) - 1;
    } else {
      for (i = 0; i < 9; i++) if (plate[i].earth === hourLead) { gateStart = i; break; }
    }
    gateStart = mod(gateStart + (polarity > 0 ? diffToHour : -diffToHour), 9);
    /* 数到中五：**转盘**里中宫不设门，借坤二（八宫环上根本没有中五这一格）；
       飞盘九宫全占，中宫是实宫，值使门就落在中宫 —— 再借坤二就错一宫了。
       （与 qimen-mingfa 逐宫对表：借了就 120/1080 盘对不上，不借 1080/1080 全同。） */
    if (gateStart === 4 && !fly.gate) gateStart = 1;
    var gk = 0, gateKey = 0, q;
    if (fly.gate) {
      /* 飞盘八门：值使门落该宫，其余按**门序（休死伤杜·中门·开惊生景）**沿宫号序飞入。
         八门只有八个、九宫却要占满 —— 所以多出一个「中门」（土），它自己就是一门。 */
      var gateAt = flyPlace(gateStart, cycleFrom(GATE_FLY, gateDuty), sgDir);
      for (k = 0; k < 9; k++) {
        if (gateAt[k] === undefined) continue;
        q = plate[k];
        q.gate = gateAt[k];
        q.gateMid = (gateAt[k] === 10);   /* 中门：飞盘独有的那一门 */
        /* 暗干 = 该门本宫的地盘干。中门(10)的本宫是**中五**，不能拿 10 当地宫号去索引 */
        var ghome = gateAt[k] ? (DOOR_HOME[gateAt[k]] || gateAt[k]) : 0;
        q.hidden = ghome ? plate[ghome - 1].earth : 0;
      }
    } else {
      for (k = 0; k < 8; k++) if (gateStart === YANG_SEQ[k]) { gk = k; break; }
      for (k = 0; k < 8; k++) if (gateDuty === GATE_SEQ[k]) { gateKey = k; break; }
      for (n = 0; n < 8; n++) {
        q = plate[YANG_SEQ[gk]];
        q.gate = GATE_SEQ[gateKey];
        q.hidden = plate[GATE_SEQ[gateKey] - 1].earth;
        gk = (gk + 1) % 8; gateKey = (gateKey + 1) % 8;
      }
    }
    /* --- 八神：值符神落值符星宫，飞盘阳顺阴逆 --- */
    if (fly.god) {
      /* 飞盘九神：值符落**值符星所在的那一宫**，其余按九神序沿宫号序飞入（阳顺阴逆）—— 九宫全占。
         九神比转盘多一位「太常」，排在第五位。
         ⚠ 起宫必须跟着"值符星实际落在哪儿"走，而不是一律 hsPalRaw：
           · 星也飞 → 星在中宫（飞盘不寄宫），神就跟着在中宫 = hsPalRaw；
           · 星是转盘 → 时干落中宫时星寄坤二，神也得在坤二（否则神和星错开一宫）。
           （体检脚本 _audit_plates.js 把"神飞 + 星转"这一支抓出来过。） */
      var gf = (polarity > 0) ? (opt.gouChen ? GOD_FLY_YANG_GC : GOD_FLY_YANG) : GOD_FLY_YIN;
      var godAt = flyPlace(fly.star ? hsPalRaw : starStart, gf, godDir);
      for (k = 0; k < 9; k++) if (godAt[k]) plate[k].deity = godAt[k];
    } else {
      /* 转盘八神：起宫用 starStart（转盘口径下的值符星宫）。
         ⚠ 混盘里"星飞 + 神转"且时干落中宫时，值符星在中宫（飞盘不寄宫），
           而八宫环上根本没有中宫这一格 —— 于是神按老规矩寄到坤二。
           这是混盘才有的歧义，不是错：转盘八神本来就只能在八宫环上走。 */
      var seq = (polarity > 0) ? [0, 7, 2, 3, 8, 1, 6, 5] : [0, 5, 6, 1, 8, 3, 2, 7];
      var godRing = (polarity > 0) ? (opt.gouChen ? GOD_RING_YANG_GC : GOD_RING_YANG) : GOD_RING_YIN;
      var sk = 0;
      for (k = 0; k < 8; k++) if (starStart === seq[k]) { sk = k; break; }
      for (i = 0; i < 8; i++) { plate[seq[sk]].deity = godRing[i]; sk = (sk + 1) % 8; }
    }
    /* --- 空亡（旬空）--- */
    var v1 = mod(hourLeadEb - 2, 12) + 1, v2 = mod(hourLeadEb - 3, 12) + 1;
    var VOID_SEQ = [0, 0, 7, 7, 2, 3, 3, 8, 1, 1, 6, 5, 5];   // 地支 → 宫号-1
    plate[VOID_SEQ[v1]].kong = true;
    plate[VOID_SEQ[v2]].kong = true;
    /* --- 驿马（时支三合）--- */
    var HORSE_SEQ = [0, 7, 5, 1, 3, 7, 5, 1, 3, 7, 5, 1, 3];
    plate[HORSE_SEQ[hourEb]].ma = true;

    /* --- 值班标记 --- */
    for (i = 0; i < 9; i++) {
      /* ⚠ 「天禽寄天芮」只在**转盘**成立（转盘中宫不设星，天禽搭天芮那一格走）。
         飞盘九宫全占、天禽就是天禽 —— 再顺手把天芮也标成值符，盘上会同时出现两处值符标记。
         （体检脚本 _audit_plates.js 的「值符标记恰一处」把这条抓出来了。） */
      plate[i].dutyStar = (plate[i].star === starDuty) || (!fly.star && starDuty === 5 && plate[i].star === 2);
      plate[i].dutyGate = (plate[i].gate === gateDuty);
    }
    /* --- 伏吟 / 反吟 --- */
    var fuYinStar = true, fuYinGate = true, fanYinStar = true, fanYinGate = true;
    if (fly.star || fly.gate) { fuYinStar = fuYinGate = fanYinStar = fanYinGate = false; }
    for (i = 0; !fly.star && !fly.gate && i < 9; i++) {
      if (i === 4) continue;
      var pl = plate[i];
      if (pl.star !== STAR_SEQ[YANG_SEQ.indexOf(i)]) fuYinStar = false;
      if (pl.gate !== GATE_SEQ[YANG_SEQ.indexOf(i)]) fuYinGate = false;
    }
    for (i = 0; !fly.star && !fly.gate && i < 9; i++) {
      if (i === 4) continue;
      var opp = OPPOSITE[plate[i].pal] - 1;
      var oppIdx = YANG_SEQ.indexOf(opp);
      if (plate[i].star !== STAR_SEQ[oppIdx]) fanYinStar = false;
      if (plate[i].gate !== GATE_SEQ[oppIdx]) fanYinGate = false;
    }
    return {
      plate: plate, starDuty: starDuty, gateDuty: gateDuty,
      hourLead: hourLead, hourLeadEb: hourLeadEb, diffToHour: diffToHour,
      hourHsEffective: hs,
      fuYin: { star: fuYinStar, gate: fuYinGate, any: fuYinStar || fuYinGate },
      fanYin: { star: fanYinStar, gate: fanYinGate, any: fanYinStar || fanYinGate }
    };
  }

  /* 旬首名：甲子 / 甲戌 / … */
  function xunShouName(leadEb) {
    var map = { 5: 1, 6: 11, 7: 9, 8: 7, 9: 5, 10: 3 };
    var z = map[leadEb] !== undefined ? map[leadEb] : 1;
    return '甲' + Lunar.ZHI[z - 1];
  }

  /* ------------------------------------------------------------- 完整起局 */
  /* y/m/d/h/mi 为北京时间。opt: {lateZi:bool} */
  function cast(y, m, d, h, mi, opt) {
    opt = opt || {};
    var cal = Lunar.cast(y, m, d, h, mi, opt);
    var ju = resolveJu(y, m, d, h, mi, cal.lateZiAdvance, opt.ju);
    var hourGan = cal.index.hourGan + 1;      // 1..10
    var hourZhi = cal.index.hourZhi + 1;      // 1..12
    var built = buildPlate(ju.cycle, ju.polarity, hourGan, hourZhi, opt);
    var lead = built.hourLead;
    var xun = xunShouName(lead);
    // 旬空的两个地支
    var v1 = mod(built.hourLeadEb - 2, 12) + 1, v2 = mod(built.hourLeadEb - 3, 12) + 1;
    return {
      input: { y: y, m: m, d: d, h: h, mi: mi || 0 },
      fly: { star: !!(opt.fly && opt.fly.star), gate: !!(opt.fly && opt.fly.gate), god: !!(opt.fly && opt.fly.god) },
      calendar: cal,
      ju: ju,
      plate: built.plate,
      meta: {
        starDuty: built.starDuty, gateDuty: built.gateDuty,
        zhiFuStar: dutyStarName(built.starDuty, !!(opt && opt.fly && opt.fly.star)),
        zhiShiGate: GATE[built.gateDuty],
        hourLead: lead, hourLeadStem: STEM[lead],
        xunShou: xun,
        xunKong: Lunar.ZHI[v2 - 1] + Lunar.ZHI[v1 - 1],   // 旬空两支，按地支顺序
        fuYin: built.fuYin, fanYin: built.fanYin,
        hourLeadEb: built.hourLeadEb
      },
      tables: {
        PAL_NAME: PAL_NAME, PAL_WX: PAL_WX, PAL_DIR: PAL_DIR, PAL_TRIGRAM: PAL_TRIGRAM, PAL_ZHI: PAL_ZHI,
        STAR: STAR, STAR_WX: STAR_WX, GATE: GATE, GATE_WX: GATE_WX,
        DEITY: DEITY, STEM: STEM, STEM_WX: STEM_WX, YUAN_NAME: YUAN_NAME
      }
    };
  }

  /* ----------------------------------------------------------- 手动起局 */
  /* 只给「阴阳遁 / 局数 / 时干支」，没有日期。返回与 cast() **同形**的对象，
     日期相关字段置空（年月日柱给 -1，界面画成「—」），这样界面与截图都能走同一套渲染。 */
  /* ============================================================================
   * 四层：年家 · 月家 · 日家（时家之外的另外三层）
   * ----------------------------------------------------------------------------
   * 三层与**同一个**干支驱动的转盘构造器 buildPlate 复用 ——
   *   值符星 ＝ 该干支旬首之仪的本宫星，飞临该干的地盘宫
   *   值使门 ＝ 本宫门，按（干−1）步沿九宫（含中五）走，落中五借坤二
   *   八神／九星／八门／暗干／空亡／伏吟反吟 同理
   * 各层之间其实只差两件事：**用哪一组干支** 和 **怎么定局**。
   *
   * 规则对齐开源项目 bigfishmarquis-qimen（MIT License, © perfhelf）。古法依据：
   *   年家 —— 180 年一元（三元九运），1864 甲子年为上元起点，**统一阴遁**
   *   月家 —— 60 甲子每 5 年一块，局 ＝ (7 ＋ 块×3) mod 9，**统一阴遁**
   *   日家 —— 二至定阴阳 ＋ 甲子跃迁：冬至后阳遁起 1/7/4，夏至后阴遁起 9/3/6
   * ========================================================================== */
  var LAYER_NAME = { nian: '年家', yue: '月家', ri: '日家' };

  /* 年家定局：1864 甲子上元 → 局一；中元 → 局四；下元 → 局七 */
  function nianJiaJu(year) {
    var off = mod(year - 1864, 180);
    return off < 60 ? 1 : (off < 120 ? 4 : 7);
  }
  /* 月家定局：(7 + 块×3) mod 9，块 = 年干支序 ÷ 5 */
  function yueJiaJu(year) {
    var gz = mod(year - 4, 60);
    var ju = mod(7 + Math.floor(gz / 5) * 3, 9);
    return ju === 0 ? 9 : ju;
  }
  /* ============================================================================
   * 日家定局：**二至 · 甲子跃迁**（唯一口径，不再做开关）
   * ----------------------------------------------------------------------------
   *   · 冬至→夏至前阳遁、夏至→冬至前阴遁；
   *   · 从**二至当日**起算六十日一元，阳遁按 一·七·四、阴遁按 九·三·六 轮三元；
   *   · 逢甲子日进一位（甲子日标志新周期）。
   * ⚠ 为什么不做成多档：这一门确实不止一派 ——《奇门遁甲预测学试行教材》第三章说有三法
   *   （阴阳遁起局 / 太乙起局 / 飞盘日家），其中"阴阳遁起局"还有个锚点分歧：
   *   教材写"以最接近二至的甲子日为始"，而**同行软件的引擎是从二至当日起算**。
   *   两者约 21% 的日子差一个元。取舍依据：
   *     ① 唯一能逐宫交叉验证的同行实现（bigfishmarquis-qimen 的 riJiaGenerate，
   *        同属"论藏甲·奇门"那一路）用的就是本口径 —— `_valid_layers.mjs` 1200 天逐宫全同；
   *     ② 教材自身的算例前后矛盾（说"中元"却写"四局"、说"下元"却写"阴九局"，与 一七四/九三六 对不上）。
   *   所以留一套验得住的，而不是摆一排让用户自己猜。
   * ========================================================================== */
  function riJiaJu(y, m, d) {
    var jdn = Lunar.jdnOf(y, m, d);
    var cands = [];
    for (var yy = y - 1; yy <= y + 1; yy++) {
      [10, 22].forEach(function (sid) {                   /* 10=夏至 22=冬至 */
        cands.push({ jdn: Lunar.dayJDN(Astro.solarTermJD(yy, sid)), dong: sid === 22 });
      });
    }
    var best = null;
    cands.forEach(function (c) { if (c.jdn <= jdn && (!best || c.jdn > best.jdn)) best = c; });
    if (!best) return { cycle: 1, polarity: 1, yuan: 0, system: 'ri-jiaz', cycleNo: 0, zi: '冬至' };
    var total = jdn - best.jdn;
    var n = Math.floor(total / 60);
    /* 甲子日开启新周期：恰逢甲子而不在整 60 天倍数上时进一位 */
    if (total > 0 && Lunar.dayGanZhiIndex(jdn, false) === 0 && total % 60 !== 0) n += 1;
    var seq = best.dong ? [1, 7, 4] : [9, 3, 6];
    return { cycle: seq[mod(n, 3)], polarity: best.dong ? 1 : -1, yuan: mod(n, 3),
             zi: best.dong ? '冬至' : '夏至', system: 'ri-jiaz', cycleNo: n };
  }

  /* 月干支：月支固定 正月=寅；月干用五虎遁（甲己之年丙作首…） */
  function monthPillar(yearStem, monthNo) {
    var zhi = mod(monthNo + 1, 12) + 1;                  /* monthNo=1 → 寅(3) */
    var start = [2, 4, 6, 8, 0][mod(yearStem - 1, 5)];
    var gan = mod(start + (monthNo - 1), 10) + 1;
    return { gan: gan, zhi: zhi };
  }

  /* 三层共用的起盘入口：定局 → 喂给 buildPlate */
  function castLayer(layer, y, m, d, opt) {
    opt = opt || {};
    var cycle, polarity, yuan = 0, gz, ref;
    /* 日家要显示农历（好核对日柱），单独算一次；其它层不算，省得白跑 */
    var riLunar = (layer === 'ri') ? Lunar.cast(y, m, d, 12, 0) : null;
    var riJia = null;
    if (layer === 'nian') {
      cycle = nianJiaJu(y); polarity = -1;
      ref = Lunar.cast(y, 7, 1, 12, 0);                  /* 取年中，稳过立春 */
      gz = { gan: ref.index.yearGan + 1, zhi: ref.index.yearZhi + 1 };
    } else if (layer === 'yue') {
      cycle = yueJiaJu(y); polarity = -1;
      var ref0 = Lunar.cast(y, 7, 1, 12, 0);
      var yg = ref0.index.yearGan + 1;
      var mp = monthPillar(yg, m);                       /* m = 节气月序 1..12 */
      gz = mp;
    } else {
      var r = riJiaJu(y, m, d);
      riJia = r;
      cycle = r.cycle; polarity = r.polarity; yuan = r.yuan; ref = r;
      var di = Lunar.dayGanZhiIndex(Lunar.jdnOf(y, m, d), false);
      gz = { gan: (di % 10) + 1, zhi: (di % 12) + 1 };
    }
    /* 四层同样吃盘式选项；八门起点那一条仍按层（时家/年家从旬首仪宫、月家/日家从门本宫） */
    var built = buildPlate(cycle, polarity, gz.gan, gz.zhi,
      { gateHome: layer !== 'nian', fly: opt.fly, sgDir: opt.sgDir, godDir: opt.godDir,
        flyDir: opt.flyDir, gouChen: opt.gouChen });
    /* ⚠ 中宫不再"留守天禽"。原来三层（年/月/日家）转盘会在盘心补一颗天禽，
       用户指出那是**不随时辰变的冗余**，与时家转盘口径也不一致（时家中宫是空的），
       所以撤掉：转盘的中宫一律留空（只有地盘干），飞盘中宫照旧是飞来的那颗。
       （对同行的校验脚本里，中宫九星这一项因此单独放宽，见 _valid_layers.mjs）
       —— 星名显示另按 starLabel() 把转盘的天芮/天禽合写成「禽芮」。 */
    /* 把四柱槽位按层填：本层那柱给真值，其余留 -1（界面上画「—」） */
    var slots = { yearGan: -1, yearZhi: -1, monthGan: -1, monthZhi: -1,
                  dayGan: -1, dayZhi: -1, hourGan: -1, hourZhi: -1 };
    if (layer === 'nian') { slots.yearGan = gz.gan - 1; slots.yearZhi = gz.zhi - 1; }
    if (layer === 'yue') { slots.monthGan = gz.gan - 1; slots.monthZhi = gz.zhi - 1; }
    if (layer === 'ri') { slots.dayGan = gz.gan - 1; slots.dayZhi = gz.zhi - 1; }
    var ju = {
      system: layer, layer: layer, layerName: LAYER_NAME[layer],
      seasonID: 0, seasonName: '',
      polarity: polarity, yinYang: polarity > 0 ? '阳遁' : '阴遁',
      cycle: cycle, yuan: yuan, yuanName: YUAN_NAME[yuan],
      fuTou: STEM[gz.gan] + Lunar.ZHI[gz.zhi - 1],
      gap: 0, chaoJie: null, leap: false,
      juText: (polarity > 0 ? '阳遁' : '阴遁') + ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'][cycle] + '局'
    };
    /* 日家把定局口径写进 ju，界面「依据」那一行直接读它 */
    if (layer === 'ri' && riJia) {
      ju.note = '二至 · 甲子跃迁：' + riJia.zi + '后第 ' + (riJia.cycleNo + 1) + ' 个甲子 · '
        + ['上', '中', '下'][riJia.yuan] + '元';
    }
    return {
      input: { y: y, m: m, d: d, h: 0, mi: 0, layer: layer },
      fly: { star: !!(opt.fly && opt.fly.star), gate: !!(opt.fly && opt.fly.gate), god: !!(opt.fly && opt.fly.god) },
      layer: layer,
      calendar: {
        index: slots,
        ganzhi: { year: layer === 'nian' ? ju.fuTou : '', month: layer === 'yue' ? ju.fuTou : '', day: layer === 'ri' ? ju.fuTou : '', hour: '' },
        /* 日家把农历填上：日柱对不对，用户要能自己一眼核对（公历 → 日柱 ↔ 农历） */
        lunarText: riLunar ? riLunar.lunarText : '',
        seasonText: riLunar ? riLunar.seasonText : '',
        shengxiao: riLunar ? riLunar.shengxiao : ''
      },
      ju: ju,
      plate: built.plate,
      meta: {
        starDuty: built.starDuty, gateDuty: built.gateDuty,
        zhiFuStar: dutyStarName(built.starDuty, !!(opt && opt.fly && opt.fly.star)),
        zhiShiGate: GATE[built.gateDuty],
        hourLead: built.hourLead, hourLeadStem: STEM[built.hourLead],
        xunShou: xunShouName(built.hourLead),
        xunKong: Lunar.ZHI[mod(built.hourLeadEb - 3, 12)] + Lunar.ZHI[mod(built.hourLeadEb - 2, 12)],
        fuYin: built.fuYin, fanYin: built.fanYin,
        hourLeadEb: built.hourLeadEb
      },
      tables: { PAL_NAME: PAL_NAME, PAL_WX: PAL_WX, PAL_DIR: PAL_DIR, PAL_TRIGRAM: PAL_TRIGRAM, PAL_ZHI: PAL_ZHI }
    };
  }

  function castNian(year, opt) { return castLayer('nian', year, 7, 1, opt); }
  function castYue(year, monthNo, opt) { return castLayer('yue', year, monthNo, 1, opt); }
  function castRi(y, m, d, opt) { return castLayer('ri', y, m, d, opt); }

  function castManual(polarity, cycle, hourHs, hourEb, opt) {
    var built = buildPlate(cycle, polarity, hourHs, hourEb, opt);
    var lead = built.hourLead;
    var v1 = mod(built.hourLeadEb - 2, 12) + 1, v2 = mod(built.hourLeadEb - 3, 12) + 1;
    return {
      input: null,
      manual: true,
      fly: { star: !!(opt && opt.fly && opt.fly.star), gate: !!(opt && opt.fly && opt.fly.gate), god: !!(opt && opt.fly && opt.fly.god) },
      calendar: {
        ganzhi: { year: '', month: '', day: '', hour: STEM[hourHs] + Lunar.ZHI[hourEb - 1] },
        index: {
          yearGan: -1, yearZhi: -1, monthGan: -1, monthZhi: -1, dayGan: -1, dayZhi: -1,
          hourGan: hourHs - 1, hourZhi: hourEb - 1, seasonID: 0
        },
        lunarText: '', seasonText: '', shengxiao: '', jdUT: null
      },
      ju: {
        system: 'manual', polarity: polarity,
        yinYang: polarity > 0 ? '阳遁' : '阴遁',
        cycle: cycle, yuan: -1, yuanName: '手动',
        juText: (polarity > 0 ? '阳遁' : '阴遁') + ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'][cycle] + '局'
      },
      plate: built.plate,
      meta: {
        starDuty: built.starDuty, gateDuty: built.gateDuty,
        zhiFuStar: dutyStarName(built.starDuty, !!(opt && opt.fly && opt.fly.star)),
        zhiShiGate: GATE[built.gateDuty],
        hourLead: lead, hourLeadStem: STEM[lead],
        xunShou: xunShouName(lead),
        xunKong: Lunar.ZHI[v2 - 1] + Lunar.ZHI[v1 - 1],
        fuYin: built.fuYin, fanYin: built.fanYin,
        hourLeadEb: built.hourLeadEb
      },
      tables: {}
    };
  }

  /* ══════════════════════════════════════════════════════════════════════
     十二长生 —— 天干在十二地支上的旺衰循环（用户点名要的功能）
     ----------------------------------------------------------------------
     阳干顺行、阴干逆行，各干自「长生」起走满一圈：
       长生 → 沐浴 → 冠带 → 临官 → 帝旺 → 衰 → 病 → 死 → 墓 → 绝 → 胎 → 养
     甲长生在亥 · 乙在午 · 丙戊在寅 · 丁己在酉 · 庚在巳 · 辛在子 · 壬在申 · 癸在卯。

     ⚠ 这是**独立的另一套体系**，与宫位详情里按「宫五行」判的那个「旺衰」小节
       不是一回事，别合并、别互相解释。
     ⚠ 纳支沿用 PAL_ZHI（四隅宫各两支、中五宫不纳支）——
       艮八宫按用户口径读「寅丑」，别按十二支表顺序改成「丑寅」。
     ══════════════════════════════════════════════════════════════════════ */
  var CS_STAGE = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  /* 各干「长生」所在的地支序号（1..12＝子..亥），按干序号 1..10 索引（1甲…10癸）：
       甲亥12 · 乙午7 · 丙寅3 · 丁酉10 · 戊寅3 · 己酉10 · 庚巳6 · 辛子1 · 壬申9 · 癸卯4 */
  var CS_START = [0, 12, 7, 3, 10, 3, 10, 6, 1, 9, 4];
  /* 阳干（甲丙戊庚壬）顺行，阴干（乙丁己辛癸）逆行 */
  var CS_YANG = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
  /* 十二支 1..12（子..亥）——长生对照表的横轴。与 PAL_ZHI 无关（那是宫→支） */
  var CS_ZHI = ['', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  /* 单干 × 单支 → 阶段名。干/支越界返回空串。 */
  function changSheng(stem, zhi) {
    if (!(stem >= 1 && stem <= 10) || !(zhi >= 1 && zhi <= 12)) return '';
    var d = zhi - CS_START[stem];
    if (!CS_YANG[stem]) d = -d;
    return CS_STAGE[mod(d, 12)];
  }

  /* 一宫的长生表。按「天盘干 → 寄干」的顺序，每条摊开该干在本宫各个纳支上的阶段：
       [{ via:'heaven'|'mid', stem:5, items:[{zhi:8,zhiName:'未',stage:'衰'}, …] }]
     ⚠ 单支宫 items 只有一条；四隅宫两条（用户要两个阶段都显示）。
     ⚠ 中五宫不纳支，直接返回空数组 —— 由调用方决定怎么写文案。 */
  function changShengAt(pal, p) {
    var zhis = PAL_ZHI[pal] || [];
    if (!zhis.length) return [];
    var list = [];
    if (p && p.heaven) list.push({ via: 'heaven', stem: p.heaven });
    if (p && p.mid) list.push({ via: 'mid', stem: p.mid });
    return list.map(function (it) {
      return {
        via: it.via,
        stem: it.stem,
        items: zhis.map(function (z) {
          var zi = Lunar.ZHI.indexOf(z) + 1;
          return { zhi: zi, zhiName: z, stage: changSheng(it.stem, zi) };
        })
      };
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     墓星（插件「墓星」· 2026-10-21）
     ----------------------------------------------------------------------
     用户口径：九星八门**并不真的入墓**；临墓之地所显者，是「象」而不是「势」。
     所以这里只回答"这颗星/这道门是否落在自己的墓支上"，**不参与吉凶断语**。

     五行墓支（与十二长生同源）：水墓辰 · 土墓辰 · 木墓未 · 火墓戌 · 金墓丑。
     宫纳支沿用 PAL_ZHI（四隅宫各两支、中五宫不纳支）：
       巽4 辰巳 → 水/土 墓 ｜ 坤2 未申 → 木 墓 ｜ 乾6 戌亥 → 火 墓 ｜ 艮8 寅丑 → 金 墓
       四正宫（坎子·震卯·离午·兑酉）无墓支 → 永不入墓。
     ⚠ 转盘禽芮宫：`p.star=2`（天芮·土）且 `p.mid` 有值（天禽·土）—— **两星各算一枚**。
     ⚠ 飞盘没有寄宫，天禽自己落宫（`p.star=5`），照算，不会重复。
     ⚠ 用户口径：一宫最多 3 枚（星/门单位各一枚，超出的截掉）。
     ══════════════════════════════════════════════════════════════════════ */
  var MU_ZHI = { '水': '辰', '土': '辰', '木': '未', '火': '戌', '金': '丑' };

  /* 一宫入墓的单位：[{ kind:'star'|'gate', no: 序号 }]，最多 3 条。
     kind 只用于界面上的 tooltip（"天芮入墓"/"生门入墓"），不参与任何吉凶判断。 */
  function muAt(pal, p) {
    var zhis = PAL_ZHI[pal] || [];
    if (!zhis.length || !p) return [];
    var out = [];
    function hit(wx) { var z = MU_ZHI[wx]; return !!z && zhis.indexOf(z) >= 0; }
    if (p.star && hit(STAR_WX[p.star])) out.push({ kind: 'star', no: p.star });
    /* 转盘禽芮宫：天禽随天芮寄来（p.mid 有值），土星两枚各算一枚 */
    if (p.mid && p.star === 2 && hit(STAR_WX[5])) out.push({ kind: 'star', no: 5 });
    if (p.gate && hit(GATE_WX[p.gate])) out.push({ kind: 'gate', no: p.gate });
    if (p.gateMid && hit(GATE_WX[10])) out.push({ kind: 'gate', no: 10 });
    return out.slice(0, 3);
  }

  var API = {
    PAL_NAME: PAL_NAME, PAL_WX: PAL_WX, PAL_DIR: PAL_DIR, PAL_TRIGRAM: PAL_TRIGRAM, PAL_ZHI: PAL_ZHI,
    STAR: STAR, STAR_WX: STAR_WX, GATE: GATE, GATE_WX: GATE_WX, DEITY: DEITY,
    STEM: STEM, STEM_WX: STEM_WX, JU_TABLE: JU_TABLE, YUAN_NAME: YUAN_NAME,
    DEITY_KEY: DEITY_KEY, DEITY_WX: DEITY_WX,
    OPPOSITE: OPPOSITE, resolveJu: resolveJu,
    castNian: castNian, castYue: castYue, castRi: castRi, castLayer: castLayer,
    starLabel: starLabel, STAR_HEQIN: STAR_HEQIN,
    nianJiaJu: nianJiaJu, yueJiaJu: yueJiaJu, riJiaJu: riJiaJu, monthPillar: monthPillar, buildPlate: buildPlate, cast: cast, castManual: castManual,
    xunShouName: xunShouName,
    changSheng: changSheng, changShengAt: changShengAt, CS_STAGE: CS_STAGE, CS_ZHI: CS_ZHI,
    MU_ZHI: MU_ZHI, muAt: muAt
  };
  root.Qimen = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
