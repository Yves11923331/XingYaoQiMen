/* ============================================================================
 * patterns.js —— 星曜奇门 · 格局判读
 * ----------------------------------------------------------------------------
 * 说明：奇门格局各流派表述不完全一致，本文件采用最常见的一路口径，
 * 每条都标明吉凶倾向（ji 吉 / xiong 凶 / ping 平）与所在宫，便于自行取舍。
 * ========================================================================== */
(function (root) {
  'use strict';
  var Qimen = root.Qimen || (typeof require !== 'undefined' ? require('./qimen.js') : null);
  var Keying = root.Keying || (typeof require !== 'undefined' ? require('./keying.js') : null);

  var WX_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };   // 我生
  var WX_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };       // 我克
  function relation(a, b) {   // a 对 b 的关系
    if (a === b) return 'same';
    if (WX_SHENG[a] === b) return 'sheng';   // a 生 b
    if (WX_KE[a] === b) return 'ke';         // a 克 b
    return 'none';
  }
  var STEM_WX = ['', '木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
  /* 天干序号：1甲 2乙 3丙 4丁 5戊 6己 7庚 8辛 9壬 10癸 */
  var S = { 甲: 1, 乙: 2, 丙: 3, 丁: 4, 戊: 5, 己: 6, 庚: 7, 辛: 8, 壬: 9, 癸: 10 };

  /* 六仪击刑：地盘六仪落于刑宫 */
  var JI_XING = { 5: 3, 6: 2, 7: 8, 8: 9, 9: 4, 10: 4 };
  /* 三奇升殿 */
  var SHENG_DIAN = { 2: 3, 3: 9, 4: 7 };
  /* 三奇入墓：乙入坤(未) · 丙入乾(戌) · 丁入艮(丑)
     取《奇门遁甲统宗》〈奇门四十格〉与《奇门旨归》〈入墓〉一路（主流）。
     另有一说见《奇门宝鉴御定》〈奇墓〉：「丁属火，与丙同墓于戌」，即丁亦墓乾六。
     本应用取前者；要按宝鉴的读法，把下面 4 改成 6 即可。 */
  var RU_MU = { 2: 2, 3: 6, 4: 8 };

  /* ---------------------------------------------------------------- 旺相休囚
     《奇门宝鉴御定》〈释气应〉：
       「九星蓬水、英火、冲辅木、任芮禽土、柱心金，皆以**我生之月为旺，我同之月为相，
         我克之月为休，克我之月为囚，生我之月为废**。」
     这里的"我"是星/门的五行，"月"是月令（节气月）的五行。
     同一句话也管八门（门之五行同看），故九星八门各给一个旺衰。 */
  var ZHI_WX_MONTH = { 1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '火',
                       7: '火', 8: '土', 9: '金', 10: '金', 11: '土', 12: '水' };
  /* 寅卯木 · 巳午火 · 申酉金 · 亥子水 · 辰戌丑未土（月支序号 1=子 … 12=亥） */
  /* ============================================================================
   * 旺衰 —— **门与星是两套不同的逻辑**，这是这一块最容易搞混的地方。
   * ----------------------------------------------------------------------------
   *   门 & 宫用「旺相休囚死」：同旺 · 他生我相 · 我生他休 · 我克他囚 · 他克我死
   *   星    用「旺相休囚废」：我生他旺 · 同相 · 我克他休 · 他克我囚 · 他生我废
   * 星那套出《奇门宝鉴御定》〈释气应〉原文：
   *   「九星…皆以我生之月为旺，我同之月为相，我克之月为休，克我之月为囚，生我之月为废。」
   * 这里「我」是门/星/宫本身，「他」是**宫**（内旺衰）或**月令**（外旺衰）。
   * 所以同一组五行、同样"他生我"，门得"相"、星得"废" —— 两套表不能混用。
   * ========================================================================== */
  function vigorDoor(mine, other) {          /* 门、以及宫位旺衰，都用这一套 */
    if (!mine || !other) return '';
    if (mine === other) return '旺';
    if (WX_SHENG[other] === mine) return '相';     /* 他生我 */
    if (WX_SHENG[mine] === other) return '休';     /* 我生他 */
    if (WX_KE[mine] === other) return '囚';        /* 我克他 */
    if (WX_KE[other] === mine) return '死';        /* 他克我 */
    return '';
  }
  function vigorStar(mine, other) {          /* 九星专表（= 原来的 vigorOf） */
    if (!mine || !other) return '';
    if (WX_SHENG[mine] === other) return '旺';     /* 我生他 */
    if (mine === other) return '相';               /* 同 */
    if (WX_KE[mine] === other) return '休';        /* 我克他 */
    if (WX_KE[other] === mine) return '囚';        /* 他克我 */
    if (WX_SHENG[other] === mine) return '废';     /* 他生我 */
    return '';
  }
  /* 关系短语，用来说清"为什么是这个状态"：水生木 / 木生火 / 火克金 … */
  function relText(mine, other) {
    if (!mine || !other) return '';
    if (mine === other) return other + '同' + mine;
    if (WX_SHENG[other] === mine) return other + '生' + mine;
    if (WX_SHENG[mine] === other) return mine + '生' + other;
    if (WX_KE[mine] === other) return mine + '克' + other;
    if (WX_KE[other] === mine) return other + '克' + mine;
    return '';
  }
  /* 内外合看的那句话，界面上要给用户看 */
  var VIGOR_NOTE = '外旺内衰，根基不稳，难以长久；内旺外衰，时运不济，犹有变时；' +
    '短期小事，不究其外，长期大事，犹重月令。';
  var VIGOR_TAGS = ['星·内', '星·外', '门·内', '门·外', '宫·外'];

  /* ---------------------------------------------------------------- 截路空亡
     《奇门遁甲元灵经》：「甲己申酉空，乙庚午未中，丙辛辰巳上，丁壬寅卯同，
       惟有戊癸日，子丑永无踪。」所列诸时的时干皆为壬癸（水阻其路，故名截路）。
     表中所列时辰一律忌出行。 */
  var JIE_LU = { 1: [9, 10], 6: [9, 10], 2: [7, 8], 7: [7, 8], 3: [5, 6], 8: [5, 6],
                 4: [3, 4], 9: [3, 4], 5: [1, 2], 10: [1, 2] };
  /* 键＝日干序号，值＝两个时支序号（1=子） */

  /* 天盘干 + 地盘干 的固定格（经典「干格」） */
  /* 十干克应 81 格：完整表在 js/keying.js（格名与断语出《奇门旨归》卷五，繁体已转简）。
     甲遁于六仪不上盘，故是九干相乘 = 81 格，不是 100 格。 */
  var GAN_GE = (Keying && Keying.table) || {};

  /* 三遁：取"三书之详者"（《景祐符应经》《奇门法窍》《烟波钓叟歌》一致的那一版）——
     天遁、地遁都要求**天盘之奇压在该地盘的特定干上**，不是只看门与奇同宫；
     人遁还要带**太阴**。早先按《统宗》〈奇门四十格〉的简记（只看门+奇）实现，条件过宽。 */
  var DUN = [
    { gate: 8, stem: 3, earth: 4,  deity: 0, name: '天遁', level: 'ji', desc: '生门与天盘丙奇同临，下加地盘丁：得月精所蔽，利求财、上书' },
    { gate: 6, stem: 2, earth: 6,  deity: 0, name: '地遁', level: 'ji', desc: '开门与天盘乙奇同临，下加地盘己：得日精所蔽，利求财、出行' },
    { gate: 1, stem: 4, earth: 0,  deity: 3, name: '人遁', level: 'ji', desc: '休门、天盘丁奇与太阴同宫：得星精所蔽，利求贤、交易' }
  ];

  /* 主入口：返回 { list:[…], byPal:{pal:[…]}, summary:{ji,xiong,ping} } */
  function monthName0(z) { return (root.Lunar || require('./lunar.js')).ZHI[z - 1]; }

  function analyze(chart) {
    var list = [];
    var P = chart.plate, cal = chart.calendar, meta = chart.meta;
    var dayGan = cal.index.dayGan + 1;
    var hourGan = cal.index.hourGan + 1;
    var value = chart.ju.polarity;   // 1 阳 -1 阴
    /* 月令五行：用月支（节气月） */
    var monthZhi = cal.index.monthZhi + 1;
    var monthWx = ZHI_WX_MONTH[monthZhi];
    var monthName = (root.Lunar || require('./lunar.js')).ZHI[monthZhi - 1];

    /* kind：ge=格局（默认） · keying=十干克应 · vigor=旺相休囚（气的状态，不算格局） */
    function add(pal, name, level, desc, kind) {
      kind = kind || 'ge';
      list.push({ pal: pal, name: name, level: level, desc: desc || '', kind: kind, vigor: kind === 'vigor' });
    }

    /* 十干克应：天盘干加地盘干。
       ⚠ **转盘（九星转盘）里一宫可以有两个天盘干** —— 天禽寄天芮，禽芮同落一宫：
         天芮带的是坤二本宫之干（p.heaven），天禽带的是中五宫之干（p.mid，弹窗里那行「寄宫干」）。
         两个干都与本宫地盘干成格，所以**一个宫最多两条克应**（用户点名要的：
         盘面上两个干 chip 都画着，十干克应却只算一个，对不上）。
       飞盘九宫全占、天禽自己落宫，buildPlate 里 p.mid 恒为 0，故不会多算（见 qimen.js 那两处注释）。
       via='mid' 标记"这是天禽寄干所成之格"，界面据此加标签区分。 */
    function keyingAt(pal, hStem, eStem, via) {
      var k = GAN_GE[Qimen.STEM[hStem] + Qimen.STEM[eStem]];
      if (!k) return;
      add(pal, k[0], k[1], k[2], 'keying');
      var e = list[list.length - 1];
      e.stems = Qimen.STEM[hStem] + '加' + Qimen.STEM[eStem];   /* 「壬加戊」 */
      if (via) e.via = via;
    }
    function addVia(pal, name, level, desc, via) {
      add(pal, name, level, desc);
      if (via) list[list.length - 1].via = via;
    }
    /* 一宫的**天盘诸干**。
       ⚠ 转盘（九星转盘）里天禽寄天芮，禽芮同落一宫 ⇒ 那一宫的天盘有**两个干**：
         天芮之干（p.heaven）与天禽寄干（p.mid，弹窗里那行「寄宫干」）。
         凡是"看天盘干"的判断（十干克应 / 三奇升殿入墓 / 伏干飞干 / 三奇得使 / 三遁），
         两个干都要参论 —— 这是用户点名的口径，与盘面上两个干 chip 保持一致。
       飞盘九宫全占、天禽自己落宫，p.mid 恒为 0，故列表里只有一个干（qimen.js 里那两处注释）。
       不会重复报同一条：三奇升殿/入墓的目标宫、伏干/飞干/三遁要求的干各只有一个取值，
       而两个干必不相同（地盘九干互异）。 */
    function heavenStems(p) { return p.mid ? [[p.heaven, ''], [p.mid, 'mid']] : [[p.heaven, '']]; }

    /* ---------------- 全局 ---------------- */
    // 五不遇时：时干克日干，且阴阳相同
    var dWx = STEM_WX[dayGan], hWx = STEM_WX[hourGan];
    var samePolarity = (dayGan % 2) === (hourGan % 2);
    if (WX_KE[hWx] === dWx && samePolarity) {
      add(0, '五不遇时', 'xiong', '时干克日干：百事不宜，纵得吉门亦不吉');
    }
    /* 截路空亡：日干定两组时支，逢之忌出行 */
    if (JIE_LU[dayGan] && JIE_LU[dayGan].indexOf(cal.index.hourZhi + 1) >= 0) {
      add(0, '截路空亡', 'xiong',
        Qimen.STEM[dayGan] + '日逢' + monthName0(cal.index.hourZhi + 1) + '时：水阻其路，忌出行');
    }
    if (meta.fuYin.any) {
      add(0, meta.fuYin.star && meta.fuYin.gate ? '星门伏吟' : (meta.fuYin.star ? '星伏吟' : '门伏吟'),
        'ping', '伏吟主静、主迟、主重复，谋事就地不动，宜守不宜进');
    }
    if (meta.fanYin.any) {
      add(0, meta.fanYin.star && meta.fanYin.gate ? '星门反吟' : (meta.fanYin.star ? '星反吟' : '门反吟'),
        'ping', '反吟主动、主变、主反复，事多翻转，去而复返');
    }
    // 三遁
    /* ⚠ "中宫跳过"只对**转盘**成立（转盘中宫不落星门，本来就无格可论）。
       飞盘中宫是实宫，一样要论 —— 用户报过：飞盘点中宫，弹窗里十干克应/旺衰/格局全空。 */
    var midIsReal = function (p) { return p.pal !== 5 || !!(p.star || p.gate || p.deity); };
    DUN.forEach(function (d) {
      P.forEach(function (p) {
        if (!midIsReal(p)) return;
        if (p.gate !== d.gate) return;
        if (d.earth && p.earth !== d.earth) return;
        if (d.deity && p.deity !== d.deity) return;
        /* 天盘之奇压在该地盘干上 —— 禽芮宫的第二个天盘干（寄干）同样算「压」 */
        heavenStems(p).forEach(function (sg) {
          if (sg[0] !== d.stem) return;
          addVia(p.pal, d.name, d.level, d.desc, sg[1]);
        });
      });
    });

    /* ---------------- 逐宫 ---------------- */
    P.forEach(function (p) {
      /* 同上：转盘中宫无星门 → 跳过；飞盘中宫是实宫 → 照算 */
      if (!(p.pal === 5 ? (p.star || p.gate || p.deity) : true)) return;
      var pal = p.pal;
      /* 门与宫的五行关系 */
      if (p.gate) {
        var gw = Qimen.GATE_WX[p.gate], pw = Qimen.PAL_WX[pal];
        var rel = relation(gw, pw);
        if (rel === 'ke') add(pal, '门迫', 'xiong', Qimen.GATE[p.gate] + '（' + gw + '）克' + p.name + '宫（' + pw + '）：事多阻逆，用神受制');
        else if (rel === 'none' && WX_KE[pw] === gw) add(pal, '门制', 'xiong', p.name + '宫（' + pw + '）克' + Qimen.GATE[p.gate] + '（' + gw + '）：门被压制，吉门减吉');
        else if (rel === 'same') add(pal, '门宫比和', 'ji', Qimen.GATE[p.gate] + '与' + p.name + '宫同气：和顺');
        else if (rel === 'sheng') add(pal, '门生宫', 'xiong', Qimen.GATE[p.gate] + '泄气于' + p.name + '宫：门力耗散');
        else if (WX_SHENG[pw] === gw) add(pal, '宫生门', 'ji', p.name + '宫生' + Qimen.GATE[p.gate] + '：门得地利，吉门更吉');
      }
      /* 六仪击刑（地盘） */
      if (JI_XING[p.earth] === pal) add(pal, '六仪击刑', 'xiong', Qimen.STEM[p.earth] + '仪落' + p.name + '宫：主刑伤、官非');
      /* ---------------- 看天盘干的判断：一宫可能有两个天盘干（见 heavenStems 注释） ---------------- */
      heavenStems(p).forEach(function (sg) {
        var g = sg[0], via = sg[1];
        /* 三奇升殿 / 入墓（看天盘三奇所落之宫） */
        if (SHENG_DIAN[g] === pal) addVia(pal, '三奇升殿', 'ji', Qimen.STEM[g] + '奇临' + p.name + '宫本气：奇得其位', via);
        if (RU_MU[g] === pal) addVia(pal, '三奇入墓', 'xiong', Qimen.STEM[g] + '奇入' + p.name + '宫：奇才受困，暗昧不明', via);
        /* 伏干格 / 飞干格（与日干比） */
        if (g === 7 && p.earth === dayGan) addVia(pal, '伏干格', 'xiong', '天盘庚加日干：主自身受制，宜静守', via);
        if (g === dayGan && p.earth === 7) addVia(pal, '飞干格', 'xiong', '日干加地盘庚：主出行有阻', via);
        /* 三奇得使 / 玉女守门 */
        if (p.dutyGate && (g === 2 || g === 3 || g === 4))
          addVia(pal, '三奇得使', 'ji', Qimen.STEM[g] + '奇临值使门：奇门相合，谋事得力', via);
        if (p.dutyGate && g === 4) addVia(pal, '玉女守门', 'ji', '丁奇临值使门：利阴私和合之事', via);
      });
      /* 十干克应：天盘干加地盘干 · 转盘另有天禽寄干一格（禽芮同宫两干，见 keyingAt 上方注释） */
      keyingAt(pal, p.heaven, p.earth, '');
      if (p.mid) keyingAt(pal, p.mid, p.earth, 'mid');
      /* ---------------- 旺衰：一宫五个 ----------------
         星内(星×宫) · 星外(星×月令) · 门内(门×宫) · 门外(门×月令) · 宫位(宫×月令)。
         门与宫走「旺相休囚死」，星走「旺相休囚废」—— 两套表。
         都是"气的状态"，不是格局：打 vigor 标记，不混进格局计数。 */
      (function () {
        var pw = Qimen.PAL_WX[pal];
        var sw = p.star ? Qimen.STAR_WX[p.star] : null;
        var gw = p.gate ? Qimen.GATE_WX[p.gate] : null;
        /* 中宫在转盘里没有星也没有门（时家），就不必算 —— 用户明确"转盘不用管它"；
           飞盘中宫是有内容的，照算（宫按土论）。 */
        var midEmpty = (pal === 5) && !(p.star || p.gate || p.deity);
        function vig(tag, mine, other, table, label, otherName) {
          if (!mine || !other) return;
          var st = table(mine, other);
          if (!st) return;
          add(pal, st, 'ping', label + '（' + mine + '）在' + otherName + '（' + other + '）· ' +
            relText(mine, other), 'vigor');
          var e = list[list.length - 1];
          e.tag = tag;
        }
        if (midEmpty) return;
        if (sw) {
          vig('星·内', sw, pw, vigorStar, Qimen.STAR[p.star], p.name + '宫');
          if (monthWx) vig('星·外', sw, monthWx, vigorStar, Qimen.STAR[p.star], monthName + '月');
        }
        if (gw) {
          vig('门·内', gw, pw, vigorDoor, Qimen.GATE[p.gate], p.name + '宫');
          if (monthWx) vig('门·外', gw, monthWx, vigorDoor, Qimen.GATE[p.gate], monthName + '月');
        }
        if (monthWx) vig('宫·外', pw, monthWx, vigorDoor, p.name + '宫', monthName + '月');
      })();
      /* 伏干格 / 飞干格（与日干比） */
      /* 空亡 */
      if (p.kong) add(pal, '空亡', 'ping', p.name + '宫落旬空：事多落空，宜待时');
    });

    var byPal = {};
    list.forEach(function (it) {
      if (!it.pal) return;
      (byPal[it.pal] = byPal[it.pal] || []).push(it);
    });
    var summary = { ji: 0, xiong: 0, ping: 0 };
    list.forEach(function (it) { if (!it.vigor) summary[it.level]++; });
    var ge = list.filter(function (it) { return !it.vigor; });
    return { list: list, ge: ge, byPal: byPal, summary: summary };
  }

  var API = {
    analyze: analyze, relation: relation, GAN_GE: GAN_GE, JI_XING: JI_XING,
    vigorStar: vigorStar, vigorDoor: vigorDoor, relText: relText,
    VIGOR_NOTE: VIGOR_NOTE, VIGOR_TAGS: VIGOR_TAGS,
    ZHI_WX_MONTH: ZHI_WX_MONTH, JIE_LU: JIE_LU
  };
  root.Patterns = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
