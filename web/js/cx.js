/* ============================================================================
 * cx.js —— 串星课引擎（小六壬·加干 / 加星）　2026-11-13
 * ----------------------------------------------------------------------------
 * 口径唯一依据：校验/串星课-规则口径-20261113.md（t1 产出）。动算法前先读它。
 * 本文件**只管算、不管画**：不碰 DOM、不碰 ui.js、不读设置、没有副作用、无全局状态。
 *
 * 两套译法（同一套四数，只换三宫那三个符号；mode 由调用方传，缺省 six）：
 *   mode='six'（默认）六神：1 大安·木 / 2 留连·土 / 3 速喜·火 / 4 赤口·金 / 5 小吉·水 / 6 空亡·土
 *   mode='star'        九星：1 天蓬·水 / 2 天芮·土 / 3 天冲·木 / 4 天辅·木 / 5 天禽·土 /
 *                             6 天心·金 / 7 天柱·金 / 8 天任·土 / 9 天英·火，到 9 回 1
 *   九星表**直接用 qimen.js 的 Q.STAR / Q.STAR_WX**（STAR[1..9] 就是天蓬…天英），
 *   不另抄一份；天禽**独立算第 5 格**，绝不出现「禽芮」合写（那是九宫盘转盘的事）。
 *
 * 三条最容易写错的地方（口径表里都钉死了，这里再抄一遍）：
 *   ① 连根数起：数到哪一宫，**下一数从那宫重新起 1**（起始位算 1）。
 *      不是"每数都从大安起"。判据是 1527（人宫）与 9444（地宫/人宫）。
 *      两套译法都吃连根：p=(p+k(n)−1) mod 域，p 从 0 起，域 = 6（六神）/ 9（九星）。
 *      用户原话：「连根数起就是小六壬的传统方法，只不过我们把六亲（那一格）换成了九星」。
 *   ② 0 与越界：前三位 0 → **六神域按 6 论、九星域按 9 论**（天英）；末位 0 → 10 论。
 *      「0 按 6 论」= **逐宫退一位**：0000 ＝ 空亡·小吉·赤口·癸，不是三宫全空亡；
 *      六神域 (0,0,0,0) ≡ (6,6,6,10)；九星域 (0,0,0,0) ≡ (9,9,9,10)。
 *   ③ 六亲以**天干**为主体：生干者父母 / 干生者子孙 / 克干者官鬼 / 干克者妻财 / 同者兄弟
 *      —— 与 ui.js:1940 的 liuQin() 完全同构（连分支顺序都一样，便于对拍）。
 *      六神模式传六神五行、九星模式传星五行。
 *      ⚠ 小六壬没有奇门那套"甲不上盘"：甲就是 1，**别把 hs===1 → 旬首 那段搬过来**。
 *
 * ⚠ 九星模式**不按阳遁顺飞 / 阴遁逆飞，也不从盘面取值**：纯数字 → 星序
 *   （用户：「不用阳顺阴逆，就正常 1234567891」）。所以同一组四数在任何局、任何时刻、
 *   任何层都得到同一个结果 —— 这条在 校验/_check_cx_engine.js 里有硬断言。
 *
 * 对外接口（挂 window.CX；node 下同时 module.exports）：
 *   CX.SPEC                           口径版本标签（排障时打印它）
 *   CX.MODES / CX.DEFAULT_MODE        ['six','star'] / 'six'
 *   CX.SIX                            六神表 [{key,idx,name,el,yy,color}], 索引 0-5 即顺序
 *   CX.STAR                           九星表 [{key,idx,name,el,yy,color}], 索引 0-8 即星序
 *   CX.SIX_BY_KEY / CX.STAR_BY_KEY    反查
 *   CX.indexOf(name) / CX.indexOfStar(name)
 *   CX.GAN10 / CX.GAN_WX / CX.WX_COLOR
 *   CX.liuQin(宫五行, 干五行)          → '父母'|'子孙'|'官鬼'|'妻财'|'兄弟'
 *   CX.castByNumbers([n1,n2,n3,n4], mode) → 课（四格可传字符串，UI 直接喂 input.value）
 *   CX.numsFromParts(月, 日, 时辰序, 时干序) → {ok,nums,err}
 *   CX.numsFromCalendar(calendar)      → {ok,nums,err}   // 直接吃 chart.calendar，最稳
 *   CX.numsFromChart(公历{y,m,d,h,mi} | chart) → {ok,nums,err}
 *   CX.castFromChart(chart, mode)      → 课（内部即 castByNumbers(numsFromChart(..), mode)）
 *   CX.randomNums(mode)                → 六神 [1–6×3, 1–10]；九星 [1–9×3, 1–10]
 *   CX.RNG                              → 就是共享模块 web/js/rng.js 的对象本身（见下）
 *                                          （source/last/u32in/dbl/pick/shuffle 全在那儿）
 *
 * 课的形态（castByNumbers / castFromChart 同形）：
 *   { ok:true, mode:'six', domain:6, nums:[1,5,2,7], stem:'庚', stemIdx:7, ganEl:'金',
 *     three:[{idx,name,el,yy,color,qin,key} ×3], err:'', errCode:'' }
 *   { ok:false, mode:'six', domain:6, nums:[…], stem:'', stemIdx:0, ganEl:'',
 *     three:[], err:'给人看的中文', errCode:'arity'|'field'|'mode'|'parts'|'calendar'|… }
 *   three[i].idx 是**该译法自己表里的号**（六神 1–6 / 九星 1–9），三格统一。
 *
 * 接线最小例子（t4 用，无需再判断别的）：
 *   var mode = S.settings.cxMode === 'star' ? 'star' : 'six';
 *   var r = CX.castByNumbers([v1, v2, v3, v4], mode);
 *   if (!r.ok) { toast(r.err); return; }
 *   r.three[0].name / .qin / .color / .idx;   r.stem;
 * ========================================================================== */
(function (root) {
  'use strict';

  var Lunar = root.Lunar;
  if (!Lunar && typeof require !== 'undefined') {
    Lunar = require('./lunar.js');
    root.Lunar = Lunar;
  }

  var SPEC = '小六壬·加干+加星 / 2026-11-13 / 见 校验/串星课-规则口径-20261113.md';
  var DEFAULT_MODE = 'six';
  var MODES = ['six', 'star'];

  /* ------------------------------------------------------------ 基本表 */
  /* 五行色：与 ui.js:1938 的 WX_COLOR **同值**（木#1a8f4a 火#d2362a 土#b8860b
     金#7f8792 水#2b3440）。校验脚本会从 ui.js 源里抽 WX_COLOR 对拍，
     改一处必须同步另一处。留连/空亡、天芮/天禽/天任 同为土 ⇒ 同色，不是漏改。 */
  var WX_COLOR = { '木': '#1a8f4a', '火': '#d2362a', '土': '#b8860b', '金': '#7f8792', '水': '#2b3440' };

  /* 六神顺序＝底本 L3；五行＝底本 L19（空亡是"授之以土"，工程授值）；
     阴阳与象见底本 L129–139。索引 0–5 即 1–6。 */
  var SIX = [
    { key: 'daan',     idx: 1, name: '大安', el: '木', yy: '阳', color: WX_COLOR['木'] },
    { key: 'liulian',  idx: 2, name: '留连', el: '土', yy: '阴', color: WX_COLOR['土'] },
    { key: 'suxi',     idx: 3, name: '速喜', el: '火', yy: '阳', color: WX_COLOR['火'] },
    { key: 'chikou',   idx: 4, name: '赤口', el: '金', yy: '阴', color: WX_COLOR['金'] },
    { key: 'xiaoji',   idx: 5, name: '小吉', el: '水', yy: '阳', color: WX_COLOR['水'] },
    { key: 'kongwang', idx: 6, name: '空亡', el: '土', yy: '阴', color: WX_COLOR['土'] }
  ];

  /* 九星：**直接用 qimen.js 的 Q.STAR / Q.STAR_WX**（1 基），不另抄一份。
     qimen.js 还没加载时才退回下面这份兜底表 —— 校验脚本会断言它俩逐字相同。 */
  var STAR_KEY = ['peng', 'rui', 'chong', 'fu', 'qin', 'xin', 'zhu', 'ren', 'ying'];
  var STAR_FALLBACK = ['', '天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'];
  var STAR_WX_FALLBACK = ['', '水', '土', '木', '木', '土', '金', '金', '土', '火'];

  function qimenTables() {
    var q = root.Qimen;
    if (q && q.STAR && q.STAR_WX) return q;
    if (typeof require !== 'undefined') {
      try { return require('./qimen.js'); } catch (e) { /* 下面用兜底 */ }
    }
    return null;
  }
  var QT = qimenTables();
  var STAR_NAMES = (QT && QT.STAR) || STAR_FALLBACK;
  var STAR_WXS = (QT && QT.STAR_WX) || STAR_WX_FALLBACK;

  var STAR = [];
  for (var si = 1; si <= 9; si++) {
    var sel = STAR_WXS[si];
    STAR.push({ key: STAR_KEY[si - 1], idx: si, name: STAR_NAMES[si], el: sel,
                /* 九星在本口径里不分阴阳（阳顺阴逆已被明确排除），不发明 */
                yy: '', color: WX_COLOR[sel] });
  }

  function byKey(list) {
    var m = {};
    for (var i = 0; i < list.length; i++) m[list[i].key] = list[i];
    return m;
  }
  var SIX_BY_KEY = byKey(SIX), STAR_BY_KEY = byKey(STAR);

  var GAN10 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var GAN_WX = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
                 '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
  var WX_SHENG = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  var WX_KE = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };

  var LABELS = ['天宫', '地宫', '人宫', '天干'];

  /* 两套译法的域：表 + 前三位归一的模数 */
  var DOMAIN = {
    six:  { table: SIX,  k: 6 },
    star: { table: STAR, k: 9 }
  };

  /* ------------------------------------------------------------ 小工具 */
  function mod(n, m) { return ((n % m) + m) % m; }

  /* 归一：把任意非负整数落到 1..k。
     kd(0,6)=6 kd(6,6)=6 kd(7,6)=1     —— 六神域：0 按 6 论，6 是一个完整循环
     kd(0,9)=9 kd(9,9)=9 kd(10,9)=1    —— 九星域：0 按 9 论（天英），9 是一个完整循环
     末位（天干）恒用 10 域：kd(0,10)=10=癸，kd(10,10)=10=癸，kd(11,10)=1=甲 */
  function kd(n, k) { return mod(n - 1, k) + 1; }

  /* 六亲：与 ui.js:1940 的 liuQin(**完全同构**：同样五条、同样分支顺序）。
     第一个参数旧名 starEl（星五行），这里叫 el（宫五行：六神五行 / 星五行）——
     只是改名，逻辑一个字没动；校验脚本对 6×10 + 9×10 = 150 组全枚举逐格对拍。 */
  function liuQin(el, ganEl) {
    if (el === ganEl) return '兄弟';
    if (WX_SHENG[el] === ganEl) return '父母';
    if (WX_SHENG[ganEl] === el) return '子孙';
    if (WX_KE[el] === ganEl) return '官鬼';
    if (WX_KE[ganEl] === el) return '妻财';
    return '';
  }

  function normMode(mode) {
    if (mode === undefined || mode === null || mode === '') return DEFAULT_MODE;
    return (mode === 'six' || mode === 'star') ? mode : '';
  }

  function fail(err, code, mode) {
    var dm = DOMAIN[mode] || DOMAIN[DEFAULT_MODE];
    return { ok: false, mode: mode || DEFAULT_MODE, domain: dm.k,
             nums: [], stem: '', stemIdx: 0, ganEl: '',
             three: [], err: err, errCode: code || 'bad' };
  }

  /* ------------------------------------------------------------ 入参校验 */
  /* 四格口径（口径表 §8）：各格 trim 后必须匹配 ^\d{1,2}$。
     · 空 / 非数字 / 负数 / ≥3 位 → 拦（'10' 合法，末位上限就是 10）
     · 0 与 2 位越界值（66 / 99 / 11 / 20 / 18）→ 放行，按 kd 自然循环
     两套译法的**取值域不同但校验口径相同**（都是 1–2 位数字，域内归一交给 kd）。 */
  function parseField(v, label) {
    if (v === null || v === undefined) return { ok: false, err: label + '没填' };
    var s = String(v).trim();
    if (!s) return { ok: false, err: label + '没填' };
    if (!/^\d{1,2}$/.test(s)) {
      return { ok: false, err: label + '要填 1–2 位数字（填的是「' + s + '」）' };
    }
    return { ok: true, n: parseInt(s, 10) };
  }

  /* ------------------------------------------------------------ 起课 */
  /* 四数 → 课。连根数起（口径表 §2.2，两套译法同一条式子）：
       p0 = 0（表首：大安 / 天蓬）
       p1 = (p0 + kd(n1,k) − 1) mod k   → 天宫
       p2 = (p1 + kd(n2,k) − 1) mod k   → 地宫
       p3 = (p2 + kd(n3,k) − 1) mod k   → 人宫
     末位：天干 = GAN10[kd(n4,10) − 1]（两模式共用 10 域） */
  function castByNumbers(nums, mode) {
    var m = normMode(mode);
    if (!m) return fail('mode 只能是 six（六神）或 star（九星）', 'mode', DEFAULT_MODE);
    var dm = DOMAIN[m];

    /* 收数组，也收「类数组」（长度 4 的对象，方便 UI 把四个 input 收成一包）；
       ⚠ 但**字符串一律拒绝**：'1527'.length 也是 4，按类数组放过去就会被当成四个数
       静默算出一张课 —— 用户以为填了整串，其实一个数都没校验。 */
    if (!nums || typeof nums === 'string' || typeof nums.length !== 'number' || nums.length !== 4) {
      return fail('四数要给四个（天宫 / 地宫 / 人宫 / 天干）', 'arity', m);
    }
    var n = [], j, r;
    for (j = 0; j < 4; j++) {
      r = parseField(nums[j], LABELS[j]);
      if (!r.ok) return fail(r.err, 'field', m);
      n.push(r.n);
    }

    var p = 0, idx = [], k = dm.k;
    for (j = 0; j < 3; j++) {
      p = mod(p + kd(n[j], k) - 1, k);
      idx.push(p);
    }
    var stemIdx = kd(n[3], 10);
    var stem = GAN10[stemIdx - 1];
    var ganEl = GAN_WX[stem] || '';
    var three = idx.map(function (i) {
      var s = dm.table[i];
      return { key: s.key, idx: s.idx, name: s.name, el: s.el, yy: s.yy,
               color: s.color, qin: liuQin(s.el, ganEl) };
    });
    return { ok: true, mode: m, domain: k, nums: n,
             stem: stem, stemIdx: stemIdx, ganEl: ganEl,
             three: three, err: '', errCode: '' };
  }

  /* ------------------------------------------------------------ 四数换算 */
  /* 「此刻 / 盘面那一刻」→ 四数。这是**直译**，不是新数法（口径表 §5.1）：
       1 天宫数 = 农历月号       2 地宫数 = 农历日号
       3 人宫数 = 时辰序（子=1）  4 天干数 = 时干序（甲=1 … 癸=10）
     闰月：lunar.month 本身就是"所闰之月号"，不需要分支（§5.4）。
     四数是**译法无关**的中间量：同一组四数喂给 six / star 只是换表读。 */
  function numsFromParts(lunarMonth, lunarDay, hourZhiSeq, hourGanSeq) {
    var a = [lunarMonth, lunarDay, hourZhiSeq, hourGanSeq];
    var lim = [[1, 12, '农历月'], [1, 30, '农历日'], [1, 12, '时辰序'], [1, 10, '时干序']];
    var out = [];
    for (var j = 0; j < 4; j++) {
      var v = a[j];
      if (v === null || v === undefined || v === '' || !isFinite(v)) {
        return { ok: false, nums: [], err: lim[j][2] + '取不到（这一盘可能没有农历月日或时干支）',
                 errCode: 'parts' };
      }
      v = Math.round(+v);
      if (v < lim[j][0] || v > lim[j][1]) {
        return { ok: false, nums: [], errCode: 'parts',
                 err: lim[j][2] + '超出 ' + lim[j][0] + '–' + lim[j][1] + '（取到 ' + v + '）' };
      }
      out.push(v);
    }
    return { ok: true, nums: out, err: '', errCode: '' };
  }

  /* 直接吃 chart.calendar（= Lunar.cast 的返回值）。
     盘面同显 MUST 走这条：盘面若走了真太阳时 / 晚子时 / 阴盘，
     再拿公历重算一遍必跟盘面对不上（口径表 §5.2）。 */
  function numsFromCalendar(calendar) {
    if (!calendar || !calendar.lunar || !calendar.index) {
      return { ok: false, nums: [], errCode: 'calendar',
               err: '这一盘没有农历月日与时干支，起不出时间课' };
    }
    var l = calendar.lunar, ix = calendar.index;
    /* 年/月/日家与手动局：index 里的时干支是 −1（口径表 §5.6），别当 0 用 */
    if (ix.hourZhi < 0 || ix.hourGan < 0) {
      return { ok: false, nums: [], errCode: 'calendar',
               err: '这一盘没有时干支（年家/月家/日家/手动局），起不出时间课' };
    }
    return numsFromParts(l.month, l.day, ix.hourZhi + 1, ix.hourGan + 1);
  }

  /* 两种入参都收，免得调用方踩坑：
       CX.numsFromChart({y:2026,m:11,d:13,h:8,mi:12})   // 公历分量 → 现算农历
       CX.numsFromChart(chart)                          // 盘对象 → 读它自己的 calendar
     opt 透传给 Lunar.cast（lateZi / lunarNextDay 等，与 Q.cast 同口径）。 */
  function numsFromChart(p, opt) {
    if (!p) return { ok: false, nums: [], err: '没给时刻', errCode: 'input' };
    if (p.calendar) return numsFromCalendar(p.calendar);
    var y = p.y, m = p.m, d = p.d;
    if (!(isFinite(y) && isFinite(m) && isFinite(d))) {
      return { ok: false, nums: [], errCode: 'input',
               err: '时刻要 年/月/日/时/分 五个分量' };
    }
    if (!Lunar) return { ok: false, nums: [], err: '历法层没加载（lunar.js 要先于 cx.js）', errCode: 'nolunar' };
    try {
      var cal = Lunar.cast(+y, +m, +d, +(p.h || 0), +(p.mi || 0), opt || {});
      return numsFromCalendar(cal);
    } catch (e) {
      return { ok: false, nums: [], err: '农历换算失败：' + e.message, errCode: 'lunar' };
    }
  }

  /* 盘面同显最省事的一步：盘 → 课（失败时把 err 交给界面决定隐不隐藏） */
  function castFromChart(chart, mode, opt) {
    var r = numsFromChart(chart, opt);
    if (!r.ok) return fail(r.err, r.errCode, normMode(mode) || DEFAULT_MODE);
    return castByNumbers(r.nums, mode);
  }

  /* ------------------------------------------------------------ 随机（委托 rng.js） */
  /* 随机核心（crypto 无偏拒绝采样 / 53 位 double / pick / shuffle）已经搬到
     **共享模块 web/js/rng.js** —— 起盘页与串星课用同一份熵源，不在两处各写一套。
     这里只做委托：
       · 正常顺序（<script src="js/rng.js"> 在 js/cx.js 之前）→ CX.RNG 就是 window.RNG，
         同一个对象，方法一个不少；
       · node 下 → require('./rng.js')；
       · 都没有 → 调 randomNums 时抛**可读的**报错，绝不把 undefined 静默传给调用方。 */
  function rngMod() {
    var R = root.RNG;
    if (R && typeof R.u32in === 'function') return R;
    if (typeof require !== 'undefined') {
      try {
        R = require('./rng.js');
        if (R && typeof R.u32in === 'function') { root.RNG = R; return R; }
      } catch (e) { /* 落到下面统一报错 */ }
    }
    return null;
  }
  function needRng() {
    var R = rngMod();
    if (!R) {
      throw new Error('串星课要随机数，但 web/js/rng.js 没加载：'
        + '请确认 index.html 里 <script src="js/rng.js"> 排在 js/cx.js 之前。');
    }
    return R;
  }
  /* 加载顺序正常时它就是 window.RNG 本体（可直接 === 比）；万一顺序反了，
     给一层惰性壳 —— 一调方法就报清楚缺什么，而不是 undefined is not a function。 */
  var RNG_API = rngMod() || {
    u32in: function (n) { return needRng().u32in(n); },
    dbl: function () { return needRng().dbl(); },
    pick: function (a) { return needRng().pick(a); },
    shuffle: function (a) { return needRng().shuffle(a); },
    source: function () { var R = rngMod(); return R ? R.source() : 'missing'; },
    last: function () { var R = rngMod(); return R ? R.last() : 'missing'; }
  };

  /* 前三个：六神域 1–6、九星域 1–9（域内取，才可能抽到天心/天柱/天任/天英）；
     末位两模式共用 1–10（含 10）。三宫**不抽 0**：0 等同域末（6 / 9），
     抽它只会让那一格的机率翻倍。四个数**各自独立抽**，允许重复（1111 / 6666 合法）。
     随机**不抽时刻**（时刻归「此刻」/时刻卡管）。 */
  function randomNums(mode) {
    var m = normMode(mode) || DEFAULT_MODE;
    var k = DOMAIN[m].k;
    var R = needRng();
    return [
      1 + R.u32in(k),
      1 + R.u32in(k),
      1 + R.u32in(k),
      1 + R.u32in(10)
    ];
  }

  /* ------------------------------------------------------------ 导出 */
  function indexIn(list, name) {
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return i;
    return -1;
  }

  var API = {
    SPEC: SPEC,
    MODES: MODES, DEFAULT_MODE: DEFAULT_MODE,
    SIX: SIX, STAR: STAR, SIX_BY_KEY: SIX_BY_KEY, STAR_BY_KEY: STAR_BY_KEY,
    indexOf: function (name) { return indexIn(SIX, name); },
    indexOfStar: function (name) { return indexIn(STAR, name); },
    GAN10: GAN10, GAN_WX: GAN_WX, WX_COLOR: WX_COLOR,
    liuQin: liuQin,
    castByNumbers: castByNumbers,
    numsFromParts: numsFromParts,
    numsFromCalendar: numsFromCalendar,
    numsFromChart: numsFromChart,
    castFromChart: castFromChart,
    randomNums: randomNums,
    /* 随机全部委托共享模块 rng.js（正常加载顺序下它就是 window.RNG 本体） */
    RNG: RNG_API,
    /* 给校验脚本用的内部件（界面别用）：归一函数 */
    _kd: kd
  };

  root.CX = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
