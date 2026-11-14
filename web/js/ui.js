/* ============================================================================
 * ui.js —— 星曜奇门 · 界面层（页面逻辑）
 * 流程：主页选起局方式 → 起盘 → 盘面页（四柱 + 值符值使 + 九宫盘 + 截图）
 *   起局三种：按时刻（此刻/选时刻）· 自选局（遁+局数+时干支）· 随机（时刻/局）
 * 整屏不滚动；盘面页把底栏收掉，把空间全给盘子。
 * ★ 2026-10-21 拆分第 1 步：共享状态与工具已抽到 core.js（window.App），
 *   本文件只留页面逻辑；后续按页面继续拆到 view-*.js。
 * ========================================================================== */
(function () {
  'use strict';
  var App = window.App;
  var Q = App.Q, P = App.P, S = App.S, Lunar = App.Lunar, Snap = App.Snap, Stars = App.Stars;
  /* 共享随机源（web/js/rng.js）：起盘页的「随机一局 / 随机时刻」与串星课的随机四数
     共用同一份熵（crypto.getRandomValues 无偏采样）。
     ⚠ **本文件里不许再出现内置伪随机**（连注释里的字面量也别写，门禁会按源码 grep 数它）。
     加载顺序由 index.html 保证：… → rng.js → cx.js → cxhelp.js → ui.js。 */
  var RNG = window.RNG;
  /* 五行色**主题化**（2026-11-13 用户定：五色 × 四主题一律取 --el-*，不做"素白回退旧值"的特例）。
     盘面早就在用同一组值（pan.css 的 --qm-el-* 逐个等于 app.css 的 --el-*），
     串星课原来那套写死的浅色调色板（水 #2b3440）是全 App 唯一异类 ——
     在玄夜/墨玉上对比只有 1.41:1，等于看不见。
     所以：真实上屏一律取当前主题的 token，引擎给的 color 只当兜底（取不到 token 时才用）。 */
  var WX_VAR = { '木': '--el-wood', '火': '--el-fire', '土': '--el-earth', '金': '--el-metal', '水': '--el-water' };
  function wxColor(el, fb) {
    var v = '';
    try {
      var n = WX_VAR[el];
      if (n) v = (getComputedStyle(document.documentElement).getPropertyValue(n) || '').trim();
    } catch (e) { /* 没有 DOM（node 自测）就走兜底 */ }
    return v || fb || '';
  }
  var CELL = App.CELL, CELL_ORDER = App.CELL_ORDER, EL = App.EL,
    ZHI_WX = App.ZHI_WX, JU_CN = App.JU_CN, GAN10 = App.GAN10;
  var $ = App.$;
  var state = App.state;
  /* 2026-11-13：马星剪影只有一份数据（marks.js 的 data URI）——
     挂成 CSS 变量给屏幕的 mask 用，导出图那边读同一个常量。
     放在 IIFE 顶部，保证首帧渲染前就位。 */
  try {
    if (window.QM_MARKS && QM_MARKS.horse) {
      document.documentElement.style.setProperty('--qm-horse-mask', 'url("' + QM_MARKS.horse + '")');
      /* 让导出图那份 Image 也在启动时就解码好（snapshot.js 比 marks.js 先加载，取不到） */
      if (window.Snapshot && Snapshot.preloadMarks) Snapshot.preloadMarks();
    }
  } catch (e) {}

  /* 共享工具转一手：其余代码不用改（仍按原来的名字调用） */
  function esc(s) { return App.esc(s); }
  function pad(n) { return App.pad(n); }
  function elClass(wx) { return App.elClass(wx); }
  function fmtLL(lat, lon) { return App.fmtLL(lat, lon); }
  function locTitle() { return App.locTitle(); }
  function toast(msg) { return App.toast(msg); }



  /* ------------------------------------------------------------------ 时间 */
  function nowParts() {
    var d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes() };
  }
  function pickParts() {
    var v = $('dtPick').value;
    var m = v && v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    return { y: +m[1], m: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
  }
  /* 统一时间输入（2026-10-21）：
     · standardParts() —— 用户在统一「日期 + 时刻」样件里选的标准时；
     · currentParts()  —— 若开了真太阳时，按观测点经度 + 均时差换算后的地方时；
       四层 / 串星 / 阴盘都用它做地方时判断（时柱、日柱、日界）。 */
  function standardParts() {
    var p = pickParts() || nowParts();
    /* 与引擎/界面口径一致：1900–2100。手动往选择器里敲超范围也夹回来。 */
    p.y = Math.max(1900, Math.min(2100, p.y));
    return p;
  }
  function solarParts(p) {
    if (!S.settings.trueSolar) return p;
    var lon = +S.settings.lon;
    if (!isFinite(lon)) lon = 116.4;          /* 0° 是合法经度，不能用 || 兜底 */
    try { return window.TrueSolar.toTrueSolar(p, lon); }
    catch (e) { return p; }
  }
  function currentParts() { return solarParts(standardParts()); }
  /* 副行标记：真太阳时开启时，把「选择器里那个标准时」一并写出来，
     否则卡片大字是真太阳时、点开选择器却是标准时，两地时间容易让人以为选错了。 */
  function tsTag(p) {
    if (!S.settings.trueSolar) return '';
    /* 换行写「标准时」：一行里塞不下会折出「12:00）」这种半截括号 */
    return ' · 真太阳时\n标准时 ' + pad(p.h) + ':' + pad(p.mi);
  }
  /* 节气/立春是天文瞬间：用标准时转 UT 判断，不能拿真太阳时再减 8 小时 */
  function jdUTOf(p) {
    return window.Astro.julianDay(p.y, p.m, p.d, p.h + (p.mi || 0) / 60) - 8 / 24;
  }
  /* 公历 → 节气月（正月=1 … 腊月=12）与立春年 */
  var MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  function solarMonthOf(p) {
    var s = window.Astro.seasonAt(jdUTOf(p));
    var mm = Math.floor((s.seasonID - 1) / 2) + 1;
    /* seasonAt 的返回值里没有 year：从节气起点反推北京日期（小寒/大寒在次年 1 月 = 上一年腊月） */
    var bj = window.Astro.fromJulian(s.startJD + 8 / 24);
    var y = bj.y;
    if (s.seasonID >= 23) y -= 1;
    return { y: y, m: mm, name: s.name, cn: MONTH_CN[mm - 1] };
  }
  function nianOf(p) {
    var jd = jdUTOf(p);
    var lichun = window.Astro.solarTermJD(p.y, 1);
    return jd < lichun ? p.y - 1 : p.y;
  }
  /* 某个节气月的起点（月家 ‹ › 翻月用）：返回该月起点节气的北京日期 */
  function solarMonthStart(y, m) {
    var id = 2 * m - 1;                    /* 立春=1, 惊蛰=3 … 小寒=23 */
    var termYear = (m === 12) ? y + 1 : y; /* 腊月起点小寒在次年 1 月 */
    var jd = window.Astro.solarTermJD(termYear, id);
    var bj = window.Astro.fromJulian(jd + 8 / 24);
    return { y: bj.y, m: bj.m, d: bj.d };
  }
  function fmtParts(p) { return p.y + '-' + pad(p.m) + '-' + pad(p.d) + ' ' + pad(p.h) + ':' + pad(p.mi); }
  /* 把一份时刻写进隐藏的选择器（点时刻卡弹出的那个输入框） */
  function setPickInput(p) {
    var el = $('dtPick');
    if (el) el.value = p.y + '-' + pad(p.m) + '-' + pad(p.d) + 'T' + pad(p.h) + ':' + pad(p.mi);
  }
  /* 打开原生时刻选择器。
     ★ 2026-10-21：原来靠一层 opacity:0 的 input 铺在「大时刻」上接点击，让浏览器自己弹。
       但 vivo / Android 16 的 WebView 点透明日期控件不弹（用户报「点时间栏无响应」），
       所以改成显式调用 —— showPicker() 优先（Chromium 99+，仍在用户手势里），
       不支持或抛 NotAllowedError 时退回 focus()+click()（程序化 click 照样触发原生选择器）。
       InvalidStateError = 选择器已经开着（原生点击先弹过），直接当成功，别重复开。 */
  function openTimePicker(el) {
    if (!el) return false;
    try {
      if (typeof el.showPicker === 'function') { el.showPicker(); return true; }
    } catch (e) {
      if (e && e.name === 'InvalidStateError') return true;
    }
    try { el.focus(); } catch (e) {}
    try { el.click(); } catch (e) {}
    return true;
  }

  /* --------------------------------------------------------- 起局（三种） */
  var LAYER_CN = { shi: '时家', ri: '日家', yue: '月家', nian: '年家' };
  /* 阴盘定局法（2026-11-02 用户升级）：阴盘从「起局方式」挪到设置 → 定局 → 定局法，
     成为拆补 / 置闰之外的第三档。选了它，时家的「此时刻 / 随机时刻」就按道家阴盘起局
     （数字定局 + 暗干，盘式开关对它无效）。
     ⚠ 自选局 / 随机一局是**手动指定局数**，定局法对它们无效 —— 跟拆补、置闰对自选局
       无效是同一条口径；四层（日/月/年家）也各走各的定局，不受这里影响。 */
  function yinJuOn() {
    return S.settings.juMethod === 'yin' && state.layer === 'shi' && state.mode !== 'manual';
  }
  /* 盘式选项（星/门/神 各转/飞 + 星门顺逆 + 八神顺逆 + 阳遁神名） */
  /* 是不是飞盘（星/门/神 任一开了飞） */
  function flyMode() { return !!(S.settings.flyStar || S.settings.flyGate || S.settings.flyGod); }

  /* 八神名：'auto' 时按盘式走 —— 转盘用白虎·玄武、飞盘用勾陈·朱雀（两派各自主流） */
  function useGouChen() {
    var v = S.settings.gouChen;
    if (v === true || v === 'on') return true;
    if (v === false || v === 'off') return false;
    return flyMode();
  }

  function flyOpts() {
    return {
      fly: { star: !!S.settings.flyStar, gate: !!S.settings.flyGate, god: !!S.settings.flyGod },
      /* 星门和八神各走各的方向：星门默认一律顺飞，八神默认阳顺阴逆 */
      sgDir: S.settings.sgDir === 'yinyang' ? 'yinyang' : 'shun',
      godDir: S.settings.godDir === 'yang' ? 'yang' : 'yinyang',
      gouChen: useGouChen()
    };
  }
  /* ---------------------------------------------------------------- 顺逆提示
      「阳顺阴逆」和「永远顺」在**阳遁**下出来的是同一个盘 —— 这不是设置坏了。
      用户正是照着这一点说"设置无效"（当时手上还是手动起的阳遁局），所以这里把
      「本盘是什么遁、这一档现在实际按哪个方向布」直接写出来，省得靠猜。 */
  function panDirHints() {
    var pol = (state.chart && state.chart.ju) ? state.chart.ju.polarity : 0;
    var yang = pol > 0, yin = pol < 0;
    var noFly = !flyMode();                    /* 纯转盘：顺逆这两项本来就不参与排盘 */
    var sg = $('sgDirHint'), gd = $('godDirHint');
    if (sg) sg.textContent = noFly
      ? '星门飞法：盘式是转盘，这一格暂不影响盘面'
      : (yang ? '星门：本盘阳遁，两档结果相同（都是顺飞）'
              : (yin ? '星门：本盘阴遁，现在按' + (S.settings.sgDir === 'yinyang' ? '逆飞' : '顺飞') + '布'
                     : '星门飞法：阳遁两档相同，阴遁才分顺逆'));
    if (gd) gd.textContent = noFly
      ? '八神飞法：盘式是转盘，这一格暂不影响盘面'
      : (yang ? '八神：本盘阳遁，两档结果相同（都是顺飞）'
              : (yin ? '八神：本盘阴遁，现在按' + (S.settings.godDir === 'yang' ? '顺飞' : '逆飞') + '布'
                     : '八神飞法：阳遁两档相同，阴遁才分顺逆'));
  }


  /* 四层统一的时间输入（2026-10-21）：
       首页那张「日期 + 时刻」样件（#dtPick）就是唯一入口 ——
       时家取完整时刻、日家取日期（真太阳时后）、月家从日期算节气月、年家按立春换年。
       真太阳时只改「地方时」；节气/立春仍按标准时转 UT 判断（那是天文瞬间）。 */
  function buildChart() {
    var raw = standardParts();
    var p = solarParts(raw);
    /* 定局法选了「阴盘」：走道家阴盘（数字定局 + 暗干），盘式那些开关对它无效 */
    if (yinJuOn()) {
      var yc = castYinpan(p);
      if (yc) return yc;
    }
    if (state.layer !== 'shi') {
      var flo = flyOpts();
      if (state.layer === 'nian') return Q.castNian(nianOf(raw), flo);
      if (state.layer === 'yue') { var sm = solarMonthOf(raw); return Q.castYue(sm.y, sm.m, flo); }
      return Q.castRi(p.y, p.m, p.d, flo);
    }
    if (state.mode === 'manual') {
      var m = state.manual;
      return Q.castManual(m.polarity, m.cycle, (m.hourIdx % 10) + 1, (m.hourIdx % 12) + 1, flyOpts());
    }
    var fo = flyOpts(); fo.lateZi = S.settings.lateZi; fo.ju = S.settings.juMethod;
    return Q.cast(p.y, p.m, p.d, p.h, p.mi, fo);
  }
  /* 格局分析：合成盘（阴盘/心盘）也能分析（已补 ju.polarity 与 meta.fuYin/fanYin）。
     万一配方不全抛错，就退回空结构 —— 盘面渲染要读 analysis.byPal，置 null 会直接把整盘打崩。 */
  function safeAnalyze(c) {
    try { return P.analyze(c); } catch (e) { return { ge: [], byPal: {}, list: [] }; }
  }

  function placeStars() {
    /* 三层（日/月/年家）没有"某一刻"，按地平方位入宫的星曜无从谈起，一律不排。
       ★ 2026-10-07 用户：**阴盘也不加星曜**（原来其实是在排的，他以为没排）——
         顺手把导出图也带一致：截图吃的就是 state.starMap，这里置空两边就都不会画。 */
    /* ★ 2026-10-21 用户：紫微插件开着时**默认把星曜抵掉**（两者抢同一块底部位置）。
       只影响渲染，不改「显示星曜」这个设置 —— 插件一关，星曜自己回来。
       2026-11-02 用户：**长生尺（sxm）也禁用星曜** —— 它走 flags.noStars（只抵星曜、不独占其他插件）。 */
    if (state.layer !== 'shi' || !state.chart || state.chart.manual || !S.settings.starsOn
        || state.chartSub === 'yin' || Plugins.anyExclusive()
        || Plugins.flagOn('noStars')) { state.starMap = null; return; }
    var la = +S.settings.lat, lo = +S.settings.lon;
    if (!isFinite(la)) la = 39.9;              /* 0° 纬/经是合法值，不能用 || 兜底 */
    if (!isFinite(lo)) lo = 116.4;
    try { state.starMap = Stars.place(state.chart, la, lo); }
    catch (e) { state.starMap = null; }
  }

  /* ------------------------------------------------------------ 主页预览 */
  /* 时间状态（2026-11-10 用户定版）：不再在时间卡里单占一行。
     选过时刻时，下面那排分段的「此时刻」直接变成「返回时」——
     状态和回到现在的入口合成一处；点它本来就会把时间重置为当前时刻。 */
  function syncTimeSeg() {
    var seg = $('segMode3');
    if (!seg) return;
    var b = seg.querySelector('button[data-m="time"]');
    if (!b) return;
    var back = S.settings.mode === 'pick' && state.mode === 'time';
    var label = back ? '返回时' : '此时刻';
    if (b.textContent !== label) b.textContent = label;
    b.setAttribute('aria-label', back ? '返回当前时刻' : '按此时间起盘');
  }
  function renderHome() {
    syncModeGate();
    var c;
    try { c = buildChart(); } catch (e) { return; }
    syncTimeSeg();
    if (state.layer !== 'shi') {
      /* 四层统一时间（2026-10-21）：时间卡显示同一张「日期 + 时刻」样件，
         副行写清楚这一层从它换算出什么（节气月 / 立春年 / 日柱）。 */
      var raw = standardParts();
      var pl = solarParts(raw);
      $('homeTime').textContent = fmtParts(pl);
      if (state.layer === 'yue') {
        var sm = solarMonthOf(raw);
        $('homePillars').textContent = LAYER_CN[state.layer] + '　节气月：' + sm.cn + '月（' + sm.name + '后）';
      } else if (state.layer === 'nian') {
        $('homePillars').textContent = LAYER_CN[state.layer] + '　立春年：' + nianOf(raw);
      } else {
        $('homePillars').textContent = LAYER_CN[state.layer] + '　' + c.ju.fuTou;
      }
      $('homeSub').textContent = c.ju.juText + ' · ' + c.meta.zhiFuStar + '值符 · ' + c.meta.zhiShiGate + '值使'
        + tsTag(raw);
      return;
    }
    var g = c.calendar.ganzhi;
    if (state.mode === 'manual') {
      $('homeTime').textContent = '自选局';
      $('homePillars').textContent = g.hour + '时';
      /* 自选局不取时刻，别标「真太阳时」 */
      $('homeSub').textContent = c.ju.juText + ' · 值符' + c.meta.zhiFuStar + ' 值使' + c.meta.zhiShiGate;
    } else if (state.mode === 'random') {
      /* 2026-10-21：点「随机」不再立刻抽、也不把时间栏换掉 ——
         这里照常显示当前时刻，真正随机发生在点「起盘」那一刻。 */
      var pr = currentParts();
      $('homeTime').textContent = fmtParts(pr);
      $('homePillars').textContent = g.year + '年 ' + g.month + '月 ' + g.day + '日 ' + g.hour + '时';
      $('homeSub').textContent = '随机 · ' + (state.randKind === 'ju' ? '随机一局' : '随机时刻') + ' · 点「起盘」生效'
        + tsTag(standardParts());
    } else {
      var p = currentParts();
      $('homeTime').textContent = fmtParts(p);
      $('homePillars').textContent = g.year + '年 ' + g.month + '月 ' + g.day + '日 ' + g.hour + '时';
      /* 阴盘（定局法选它时）：副行先标一笔，免得用户以为还是普通时家盘 */
      $('homeSub').textContent = (c.yinpan ? '阴盘 · ' : '')
        + '农历' + c.calendar.lunarText + ' · ' + c.calendar.seasonText + ' · ' + c.ju.juText
        + tsTag(standardParts());
    }
  }

  /* ---------------------------------------------------------------- 起盘 */
  /* 盘数据重算（不含切页、不含量尺寸） */
  function rebuildChartData() {
    state.chart = buildChart();
    state.analysis = safeAnalyze(state.chart);
    placeStars();
    /* 阴盘 / 心盘是合成盘：chartSub 跟着盘本身的标记走。
       设置页把定局法从「阴盘」改回拆补 / 置闰时走的是 recastQuiet（不经 castChart），
       不在这里补一手，盘面样式就会跟实际盘对不上（拿的是普通盘、却按阴盘渲染）。 */
    if (state.chart) {
      if (state.chart.xinpan) state.chartSub = 'xin';
      else if (state.chart.yinpan) state.chartSub = 'yin';
      else if (state.chartSub === 'yin' || state.chartSub === 'xin') state.chartSub = 'pan';
    }
  }

  /* ★ 悄悄重排：**不切页、不碰滚动位置**。
     设置页里改盘式 / 顺逆 / 定局法 / 晚子时时用它。
     原先这些地方走的是 castChart()（内含 setView），而 setView 末尾有一句
     `$('scroll').scrollTop = 0` —— 于是设置页每点一下都会"刷新一下、弹回顶部"，
     用户反馈体验差。设置页原地不动、盘在后台重排，才是对的。
     ⚠ 这里量不出真实尺寸（盘面藏着），所以不指望它把盘定下来；
       任何"进盘面"的路径都走 castChart()，那时 setView 之后 renderChart 会按屏幕重量。 */
  function recastQuiet() {
    rebuildChartData();
    syncLayerHead();
    renderChart();
    panDirHints();                 /* 换了盘，顺逆提示跟着换 */
  }

  function castChart() {
    /* ★ 心盘只属于时家：四层（日/月/年家）即使之前停在心盘，也要按普通盘起 */
    if (state.layer === 'shi' && state.mode === 'xin') { xpEnter(); return; }
    state.chartSub = yinJuOn() ? 'yin' : 'pan';
    rebuildChartData();
    setView('chart');              /* ★ 先切页再量尺寸：renderChart 里那次 fitPan 才量得准 */
    syncLayerHead();
    renderChart();
    panDirHints();
    requestAnimationFrame(fitPan);
  }
  /* 随机：2026-10-21 起**点「起盘」才抽**（用户：随机的一瞬间要在起盘那一下）。
     面板里两个按钮只负责选类型：不立即起盘、不替换时间卡。 */
  function setRandKind(k) {
    state.randKind = (k === 'ju') ? 'ju' : 'time';
    $('btnRandTime').classList.toggle('on', state.randKind === 'time');
    $('btnRandJu').classList.toggle('on', state.randKind === 'ju');
    renderHome();
    toast(state.randKind === 'ju' ? '随机一局：点「起盘」生效' : '随机时刻：点「起盘」生效');
  }
  function onCast() {
    /* 随机只属于时家：四层（日/月/年家）即使之前停在随机模式，也要按层起盘 */
    if (state.layer === 'shi' && state.mode === 'random') { castRandom(); return; }
    castChart();
  }
  function castRandom() {
    if (state.randKind === 'ju') {
      state.mode = 'manual'; syncMode();
      /* 三处全走共享 RNG（原来用的是内置伪随机 —— V8 的 xorshift，不是物理熵，取模还带偏） */
      state.manual.polarity = RNG.u32in(2) ? 1 : -1;   /* 阳遁 / 阴遁 各 50% */
      state.manual.cycle = 1 + RNG.u32in(9);           /* 一 ~ 九局，各 1/9 */
      state.manual.hourIdx = RNG.u32in(60);            /* 六十甲子，各 1/60 */
      syncManual();
      castChart();
      toast('随机一局：' + state.chart.ju.juText + ' ' + state.chart.calendar.ganzhi.hour + '时');
      return;
    }
    var span = Date.UTC(2100, 0, 1) - Date.UTC(1950, 0, 1);
    /* 跨度 ≈ 4.7e12 ms，远超 2^32 —— u32in 不够，必须用 53 位无偏 double */
    var d = new Date(Date.UTC(1950, 0, 1) + RNG.dbl() * span);
    var p = { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
    S.settings.mode = 'pick'; S.saveSettings();
    syncNowPick(); setPickInput(p);
    state.mode = 'time'; syncMode();
    castChart();
    toast('随机时刻：' + fmtParts(p));
  }

  /* ---------------------------------------------------------------- 盘面 */
  /* ---------------------------------------------------------------- 盘面 */
  /* 插件渲染统一走 Plugins（2026-10-25 起改成真插件）：插件本体在 web/plugins/*.js，
     ui.js 只在这里调 Plugins.palaceHTML 聚合所有启用插件的 DOM。
     开关 / 阴盘拦截 / 独占让位 都在 plugins.js 的 active() 里判，这里不再各自写分支。
     契约见 web/plugins/README.md。 */
  function plugCtx(p, c) {
    return {
      chart: c, chartSub: state.chartSub, p: p, pal: p.pal,
      Q: Q, esc: esc
    };
  }

  function ganChip(stemNo, opts) {
    if (!stemNo) return '';
    opts = opts || {};
    var cls = 'qm-gan ' + elClass(Q.STEM_WX[stemNo]);
    if (opts.mid) cls += ' qm-gan-mid';
    if (opts.hour) cls += ' qm-hour';
    return '<span class="' + cls + '">' + Q.STEM[stemNo] + '</span>';
  }

  function cellHTML(p, c) {
    /* 阴盘：整套独立排法（三行），不走时家那套角标 */
    /* 飞盘的中宫是有内容的（星/神/中门都在），不能再走"只画两圈环"那条路 */
    var midHasContent = p.pal === 5 && (p.star || p.deity || p.gate || p.gateMid);
    if (p.pal === 5 && !midHasContent) {
      /* 中宫不放任何字：中心由 pan.css 里那两圈同心环表示 */
      return '<div class="qm-pal">中5</div>' +
        '<div class="qm-line qm-mid-line"><span></span><span class="qm-gans">' + ganChip(p.earth) + '</span></div>';
    }
    var h = '';
    h += '<div class="qm-pal">' + Q.PAL_NAME[p.pal] + p.pal + '</div>';
    /* 空亡 / 马星：2026-11-13 用户定版 —— **空亡画一个圆、马星画奔马剪影**，不再用文字印章。
       空亡是纯 CSS 圆（A1 单环）；马星是 1.7KB 的位图掩膜（web/js/marks.js 的 data URI），
       屏幕用 mask 染色、导出图用 canvas 合成，两处同一份数据。 */
    if (p.kong || p.ma) {
      h += '<div class="qm-void">' +
        (p.kong ? '<i class="qm-seal qm-seal-void" title="空亡"><span class="qm-mark qm-mark-void"></span></i>' : '') +
        (p.ma ? '<i class="qm-seal qm-seal-horse" title="马星"><span class="qm-mark qm-mark-horse"></span></i>' : '') + '</div>';
    }
    /* ★ 每一项都是"有才画"。中宫在转盘下没有八神、也没有门；三层的中宫没有神；
       飞盘的中门也可能飞到这里。原来不管有没有都照样吐一个 span/div 出来 ——
       空 div 照样占 margin 与 padding，会把中宫的排版顶歪，也让人以为有东西。 */
    /* ★ 八神：类名按**神名**挂（qm-shen-gouchen 这类），位置号那个类名一并留着做兼容。
       颜色定义见 pan.css —— 按神名才不会出现"同一个号不同神"的串色。 */
    if (p.deity) h += '<div class="qm-shen qm-shen-' + (Q.DEITY_KEY[p.deity] || p.deity)
      + ' qm-shen-' + p.deity + '">' + Q.DEITY[p.deity] + '</div>';
    var ci = c.calendar.index;
    var hourStem = ci.hourGan === 0 ? c.meta.hourLead : ci.hourGan + 1;
    /* 2026-11-02 用户定：神 / 星 / 门 / 干**回到基准包的排法**（星名左 + 天盘干右、
       门名左 + 地盘干右、寄干仍是天盘干右上角小注），只做三件事：
         ① 全盘去掉加粗（字重 400）；② 字号整体放大到 ×1.16；③ 天地盘干去掉方章（裸字）。 */
    var gans = '';
    gans += ganChip(p.mid, { mid: true, hour: p.mid === hourStem });
    gans += ganChip(p.heaven, { hour: p.heaven === hourStem });
    var starLabel = p.star ? Q.starLabel(p.star, !!(c.fly && c.fly.star)) : '';
    if (p.star || gans) {
      h += '<div class="qm-line">' +
        (p.star ? '<span class="qm-name qm-tian-' + p.star + '">'
          + starLabel + '</span>' : '<span></span>') +
        '<span class="qm-gans">' + gans + '</span></div>';
    }
    if (p.gate || p.gateMid || p.earth) {
      h += '<div class="qm-line qm-men-row">' +
        (p.gateMid
          ? '<span class="qm-name qm-men-mid">' + Q.GATE[10] + '</span>'
          : (p.gate ? '<span class="qm-name qm-men-' + p.gate + '">' + Q.GATE[p.gate] + '</span>' : '<span></span>')) +
        /* 八门行的寄干（`earth2`，只有阴盘坤二有）仍并排在主章左边（2026-10-07 口径） */
        '<span class="qm-gans">' + ganChip(p.earth2, { mid: true }) + ganChip(p.earth) + '</span></div>';
    }
    /* 插件（2026-10-25 起走 Plugins）：墓星、紫微等都在 web/plugins/*.js，
       这里只聚合"启用 + 不入阴盘 + 非独占让位"的插件 DOM，塞进这个宫。 */
    h += Plugins.palaceHTML(p.pal, plugCtx(p, c));

    if (c.yinpan && p.agan && p.pal !== 5) {
      /* ★ 2026-11-12 用户定：暗干直接坐**星曜（政余）那一行**——宫卡左下角、.74em，
         与 .qm-stars 同槽位同字号；阴盘本来就不排政余，这一行空着。
         不再另造宫底居中落款（那版被否）。 */
      h += '<div class="qm-yin-agan" title="暗干">' + Q.STEM[p.agan] +
        (p.agan2 ? '（' + Q.STEM[p.agan2] + '）' : '') + '</div>';
    }
    var sl = !c.yinpan && state.starMap && state.starMap.byPal[p.pal];
    if (sl && sl.length) {
      /* 星多就折行：放满一行后，第二行接在**上面**（贴着一行一行往上长），
         不是搬到宫位正中。上限 9 颗：罗睺/计都、紫炁/月孛 两对反极点，一宫各只能来一颗。
         ★ 2026-11-02 用户：三颗以内用全名（太阳 / 岁星 / 太白 …）；**星太多**（>3 颗）才退到
           单字简称（阳 / 阴 / 岁 / 荧 / 镇 / 白 / 辰，四余照旧 炁 / 罗 / 计 / 孛）。
           简称是用户定的固定对照（见 stars.js 的 STARS），不是「古名首字」的规律。 */
      var full = sl.length <= 3;
      h += '<div class="qm-stars">' + sl.map(function (x) {
        return '<span class="qm-star-' + x.cls + (x.up ? '' : ' down') + '">' + (full ? x.name : x.short) + '</span>';
      }).join('') + '</div>';
    }
    return h;
  }

  /* 卦象·地支面：点中宫切过来。每宫中央一枚大卦符 + 该宫所纳的地支。
     纳支按后天八卦方位分属（坎子 / 艮丑寅 / 震卯 / 巽辰巳 / 离午 / 坤未申 / 兑酉 / 乾戌亥）。 */
  function faceHTML(p) {
    if (p.pal === 5) {
      return '<div class="qm-pal">中5</div>' +
        '<div class="qm-fx qm-fx-mid">' +
        '<div class="qm-fglb">卦象 · 地支</div>' +
        '<div class="qm-fhint">点中宫回九宫盘</div>' +
        '</div>';
    }
    var z = Q.PAL_ZHI[p.pal] || [];
    return '<div class="qm-pal">' + Q.PAL_NAME[p.pal] + p.pal + '</div>' +
      '<div class="qm-fx">' +
      '<div class="qm-gua">' + Q.PAL_TRIGRAM[p.pal] + '</div>' +
      '<div class="qm-zhi">' + z.join('') + '</div>' +
      '</div>';
  }
  function cycleFace() {
    state.face = (state.face === 'pan') ? 'both' : 'pan';
    renderPan();
    renderChart();
    toast(state.face === 'pan' ? '九宫盘' : '卦象 · 地支面（再点中宫回来）');
  }

  /* 阴盘外圈那套（#qmRing / .qm-rg / has-ring / renderRing / paintRing / RING_W）
     2026-11-12 全部删除：暗干现在就在宫内「星曜（政余）」那一行，盘面不再为外圈收小。 */
  function buildPan() {
    if (state.panBuilt) return;
    $('panHost').innerHTML = '<div class="qm-text-pan" id="qm_text_pan">' +
      CELL_ORDER.map(function (pal) {
        return '<div class="qm-cell' + (pal === 5 ? ' qm-mid' : '') + '" id="' + CELL[pal] + '" data-pal="' + pal + '"></div>';
      }).join('') + '</div>';
    $('qm_text_pan').addEventListener('click', function (e) {
      var cell = e.target.closest('.qm-cell');
      if (!cell) return;
      var pal = +cell.dataset.pal;
      /* 转盘里中宫是空的，点它当「九宫盘 ⇄ 卦象·地支面」的开关最顺手；
         但**飞盘的中宫有星有神有门位**，是正经一宫 —— 那时就把切换让开，跟别的宫一样开详情。 */
      if (state.chartSub === 'xin') {                 /* 心盘：点宫位＝改这一宫的符号 */
        if (pal === 5) { toast('心盘不列中五（中五之干寄坤二）'); return; }
        xpEdit(pal); return;
      }
      /* 2026-11-13 用户：**盘面同显开着时，点中宫不切换界面** —— 同显下中宫已清空
         （地盘干 / 金环 / 中心晕染都不画），再点它去切「卦象·地支面」只是误触，直接无操作。 */
      if (pal === 5 && !flyMode()) {
        if (S.settings.panLesson) return;
        cycleFace(); return;
      }
      openPalace(pal);
    });
    state.panBuilt = true;
  }

  function applyOpacity() {
    var pan = $('qm_text_pan');
    if (!pan) return;
    var a = Math.max(0, Math.min(100, S.settings.opacity)) / 100;
    /* 盘面整体那层（星野/光晕/暗角）跟着一起淡 —— 底图才透得匀 */
    pan.style.setProperty('--qm-cell-a', a);
    var rgb = { blue: '10,15,28', slate: '11,19,16', brown: '21,15,10', white: '255,255,255' }[S.settings.theme] || '255,255,255';
    /* ★ 寄干角注的描边色：必须与每宫底色**完全同色同透明度**，
       这样小字压在天盘干章的右上角时，章边框在字轮廓处被"咬开"一圈却不留色差。
       （pan.css 的 .qm-gan-mid 用 --qm-cell-mask 做 8 向 text-shadow） */
    pan.style.setProperty('--qm-cell-mask', 'rgba(' + rgb + ',' + a + ')');
    /* 素白下中宫原来是 250,250,252 的偏蓝假白 —— 比旁边格子显脏，改成纯白 255,255,255 */
    var midRgb = { blue: '7,11,22', slate: '9,15,13', brown: '17,12,9', white: '255,255,255' }[S.settings.theme] || rgb;
    var cells = pan.getElementsByClassName('qm-cell');
    for (var i = 0; i < cells.length; i++) cells[i].style.backgroundColor = 'rgba(' + rgb + ',' + a + ')';
    var mid = $('qm_mid');
    if (mid) mid.style.backgroundColor = 'rgba(' + midRgb + ',' + a + ')';
  }

  /* ★ 2026-11-02 用户定：长生尺开启 → 整盘回**基准包老 UI**（它按基准几何设计；
     2026-11-14 紫微插件删除、墓星改角标后都不再切）。
     标准 UI（三个都关）＝现在这套。CSS 见 pan.css 尾部的 [data-ui="old"] 段。
     ⚠ 阴盘一律不切老 UI：插件本来就不入阴盘，旧逻辑却会把阴盘的新布局（裸干 / 方章暗干 /
        预留印章带 / 寄干右挂）一并打回基准包 —— 2026-11-02 排查项 6。 */
  function oldUIOn() {
    /* 2026-11-14 用户：长生尺重做、适配**标准盘** → 已没有任何插件需要把整盘切回老 UI。
       函数与 CSS 的 [data-ui="old"] 段暂留（导出/兼容），恒 false。 */
    return false;
  }

  function renderPan() {
    buildPan();
    var c = state.chart;
    if (!c) return;
    var byPal = state.analysis.byPal;
    var face = state.face === 'both';
    var pan = $('qm_text_pan');
    if (pan) {
      pan.dataset.face = state.face;
      /* 按**中宫实际有没有内容**来定，而不是按设置 —— 这样四层、部分飞盘、
         以及"开了飞盘但这一盘中宫恰好空着"都能判对。 */
      var mid = null;
      if (state.chart) state.chart.plate.forEach(function (x) { if (x.pal === 5) mid = x; });
      pan.dataset.fly = (mid && (mid.star || mid.deity || mid.gate || mid.gateMid)) ? '1' : '0';
      /* 阴盘要单独一套宫内排布（内容下移 + 暗干进角），给 CSS 一个钩子 */
      pan.dataset.sub = state.chartSub || '';
      /* 寄干形制设置已在 2026-11-02 撤掉（改为固定的「右挂灰墨小字」），不再写 data-foot */
      /* 老 UI 钩子：只有长生尺还在用（见 CSS 尾部 [data-ui="old"]） */
      pan.dataset.ui = oldUIOn() ? 'old' : '';
    }
    c.plate.forEach(function (p) {
      var cell = $(CELL[p.pal]);
      if (!cell) return;
      cell.innerHTML = face ? faceHTML(p) : cellHTML(p, c);
      /* 宫卡外壳类名交给插件（2026-11-12：虚实法改边框色）。
         每轮整串重写，插件一关残类自己就没了；qm-cell / qm-mid 是宿主的底类。 */
      var pcls = face ? '' : Plugins.cellClass(p.pal, plugCtx(p, c));
      cell.className = 'qm-cell' + (p.pal === 5 ? ' qm-mid' : '') + (pcls ? ' ' + pcls : '');
      /* 面模式下不点亮格局标（那一层信息跟卦象/地支无关） */
      cell.classList.toggle('has-pat', !face && !!(byPal[p.pal] && byPal[p.pal].length));

    });
    applyOpacity();
    fitStars();
  }

  /* 星曜那一行是 nowrap + overflow:hidden：单宫星多时会被切在半截上，很难看。
     这里"尽力放"：能放几颗放几颗，末尾补一个简短的省略号，表示还有没列完的
     （点这一宫看详情，那里面是全部星曜 + 方位角 + 地平线上/下）。
     原始那一份星名缓存在 dataset.full 上 —— 换屏、切页会重来一遍，不会越摘越少。 */
  /* 星曜那一行放不下时要分两排：**前段在上、后段在下**（用户 2026-11-02 晚点名）。
     例：一宫 8 颗、一行只容 6 颗 → 太阳/太阴在上排，其余 6 颗在下排；
     不是「浏览器折行 + 最后 2 颗被顶上去」那种相反的顺序。
     做法：先按每颗的实际字宽（含列间距）算出「下排最多能放几颗」，
     再把尾段 append 给下排、头段 append 给上排；容器是 column-reverse，先 append 的在下面。
     ⚠ 改这里要同步 snapshot.js 的 starLines 分排，两套必须同一顺序。 */
  function fitStars() {
    var rows = document.querySelectorAll('#qm_text_pan .qm-stars');
    for (var i = 0; i < rows.length; i++) {
      var el = rows[i], w = el.clientWidth;
      if (!el.dataset.full) el.dataset.full = el.innerHTML;
      else el.innerHTML = el.dataset.full;                 /* 每轮从原始那份重来 */
      if (!w) continue;
      var spans = Array.prototype.slice.call(el.children).filter(function (s) {
        return s.tagName === 'SPAN' && !s.classList.contains('qm-star-more');
      });
      if (!spans.length) continue;
      var GAP = 5;                                         /* 与 .qm-star-row 的 column-gap 同值 */
      var widths = spans.map(function (s) { return s.getBoundingClientRect().width; });
      function rowW(from, count) {
        var t = 0;
        for (var k = 0; k < count; k++) t += (k ? GAP : 0) + widths[from + k];
        return t;
      }
      var n = spans.length, bottom = n;
      if (rowW(0, n) > w) {
        /* 找「下排最大颗数」：下排取尾部 cand 颗、上排取头部 n−cand 颗，两排都要放得下 */
        bottom = 0;
        for (var cand = n - 1; cand >= 1; cand--) {
          if (rowW(n - cand, cand) <= w && rowW(0, n - cand) <= w) { bottom = cand; break; }
        }
      }
      function makeRow(list) {
        var r = document.createElement('div');
        r.className = 'qm-star-row';
        list.forEach(function (s) { r.appendChild(s); });
        return r;
      }
      el.innerHTML = '';
      if (bottom > 0 && bottom < n) {
        el.appendChild(makeRow(spans.slice(n - bottom)));   /* 下排（先 append） */
        el.appendChild(makeRow(spans.slice(0, n - bottom)));/* 上排 */
      } else if (bottom === n) {
        el.appendChild(makeRow(spans));                     /* 一行放得下：原样 */
      } else {
        /* 两排都放不下（极窄屏兜底）：下排尽量多放，末尾补省略号，余下的点宫位看详情 */
        var keep = 0, sum = 0;
        for (var k2 = 0; k2 < n; k2++) {
          var add = widths[k2] + (k2 ? GAP : 0);
          if (sum + add > w) break;
          sum += add; keep++;
        }
        var dots = document.createElement('span');
        dots.className = 'qm-star-more';
        dots.textContent = '…';
        var list = spans.slice(0, Math.max(0, keep - 1));
        list.push(dots);
        el.appendChild(makeRow(list));
      }
    }
    /* 同显（课放进中宫）：renderPan 会重建各宫内容，而课块是挂在盘容器 .qm-text-pan 上的 ——
       这里再走一遍，防止"renderMiniLesson 先跑、buildPan 后建"时课块留在抬头带里。 */
    if (S.settings.panLesson) renderMiniLesson(state.chart);
  }

  /* ---------------------------------------------------- 长方形盘自适应 */
  /* 密度分档。卦象已经去掉，底边只需要留住星曜那一行：
     pb ＝ 星曜底距 .74em + 星曜行高 .851em + 4px 余量 ≈ 1.591em + 4px。 */
  var DENSITY = [
    /* ★ 2026-11-02：sm（八神上边距）是**真正生效**的那份 —— fitPan() 会把它写进
       --qm-shen-mt，CSS 里的 37/30px 只是兜底（之前只改 CSS 没生效，就是被这里盖掉的）。
       用户定：390 屏这一档（min 108）＝ 30px，其余档按原相对差同步 +14。 */
    { min: 122, fs: .88, pt: 8, pb: 26, sm: 32, lm: 4 },
    { min: 114, fs: .84, pt: 8, pb: 25, sm: 31, lm: 3 },
    { min: 108, fs: .80, pt: 7, pb: 24, sm: 30, lm: 3 },
    { min: 100, fs: .74, pt: 6, pb: 23, sm: 29, lm: 2 },
    { min: 0,   fs: .70, pt: 6, pb: 22, sm: 27, lm: 2 }
  ];
  var PAN_MIN = 288;   /* 单卡宽 ≥ 95px，正好装下最密一档 */
  /* ★ 长方形盘的三个死数（2026-10-07 用户定版）：
     整盘 **350×509**（高 > 宽）、九张卡片之间缝 7px。
     宽度走过三档：370（正方形盘时代）→ 365（跟上方信息区那行对齐，x=14→379，
     看着跟没动一样、而且离屏幕边只剩 14px）→ **350**：左右各留 21.5px，
     是常规手机边距，不再追求跟信息区对齐（用户明确说 365「太近」）。
     高度一直是 509 —— 它跟「上移 62% ＝ 盘顶 218 / 盘底 727」绑定，不动。
     单卡于是 = (350−14)/3 × (509−14)/3 = **112 × 165**（都是整数，严格等大）。
     屏幕（这里）与导出图（snapshot.js）共用这一组比例，改一处要改两处。 */
  var PAN_W = 350, PAN_H = 509, GAP = 7;
  /* 上移读数：量得到就把 px 写出来，量不到（没起过盘／盘面页没显示）就只写百分比 ——
     不能因为"还没量到"就显示成"居中"，那会让人以为设置没生效。 */
  /* 「加串星课」时课块占掉一截，抬头角度要另算 —— 所以盘面上移分两套值 */
  function lessonOn() {
    var m = $('xkMini');
    return !!(m && S.settings.panLesson && m.style.display !== 'none');
  }
  /* 「加串星课」不再占抬头带的高度（课已放进中宫）→ 盘的"上移"只有一套值，
     开/关同显完全一致；lessonOn() 仍保留给别处判断用。 */
  function liftPctNow() {
    var v = S.settings.liftPct;
    return Math.max(0, Math.min(100, +v || 0));
  }
  function updateLiftLabel() {
    var hint = $('liftVal');
    if (!hint) return;
    var pct = liftPctNow();
    var rng = $('rngLift');
    if (rng && +rng.value !== pct) rng.value = pct;
    var tag = '';   /* 课已放进中宫，不再占抬头带高度 → 不再区分「加串星课」的上移档 */
    if (pct === 0) { hint.textContent = '居中' + tag; return; }
    hint.textContent = lastLift.max
      ? ('上移 ' + pct + '% · ' + lastLift.lift + 'px / 最多 ' + lastLift.max + 'px' + tag)
      : ('上移 ' + pct + '%' + tag);
  }
  var lastLift = { size: 0, max: 0, lift: 0 };
  function fitPan() {
    var view = $('view-chart'), wrap = document.querySelector('#view-chart .panwrap');
    var pan = $('qm_text_pan'), box = $('qmBox');
    if (!view || !wrap || !pan || !box || !view.classList.contains('on')) return;
    /* 盘盒不再带内边距（阴盘暗干已进宫，外圈那套删了）：可用宽高直接吃 wrap 的。 */
    var minW = PAN_MIN;
    /* ★ 2026-10-07 用户第 4 条：**盘面同显时把盘缩一档** ——
       课块加上来之后，盘底正好顶到屏幕轮廓/底栏，看着很挤。
       这里按 0.9 缩"目标尺寸"（宽高一起缩，单卡仍严格等大），下面的夹取逻辑
       就会自动把盘算小一档，底部留出一条空白。只影响同显那一档，纯盘一点不动。 */
    /* 用户第 4 条挑的是「**减少高度**」那一版：宽度照旧 350（九张卡仍然严格等大），
       只把高度压到 85% —— 卡片于是从 112×165 变成 112×140 左右，盘底就不再贴着屏幕轮廓。
       （不要改成等比缩小：那样宽度也跟着窄，卡的观感会变。） */
    /* ★ 2026-11-13 用户定稿「课放进中宫」：同显**不再占抬头带的高度**，
       所以盘的尺寸系数恒为 1 —— 开/关同显，盘的宽高与位置完全一样。 */
    var kLessonH = 1;
    var TW = PAN_W, TH = Math.round(PAN_H * kLessonH);
    var availW = wrap.clientWidth - 8 - 6;
    var availH = wrap.clientHeight - 12 - 6;
    /* 窄屏（360 一类）上 350 塞不下时，别让盘贴着屏边 —— 左右至少留 12px。
       用户这一条是冲"离屏幕边缘太近"说的，别的机型也别再犯。 */
    var w = Math.floor(Math.max(minW, Math.min(availW, availH * TW / TH, TW,
      wrap.clientWidth - 24)));
    var h = Math.round(w * TH / TW);
    /* ★ 2026-11-12 删掉「阴盘最小 480」那条特殊照顾：它当年是给自绘三行/宫底落款撑高度的，
       现在阴盘与标准盘同一套行与字号，320 屏上不该再被拉高一截（时家 430 / 阴盘也 430）。 */
    box.style.width = w + 'px';
    box.style.height = h + 'px';
    /* 盘比"正方形时代"高一截，富余变少；那截富余默认上下平分，
       「上移」就是把这平分挪走：最多能挪富余的一半。
       用 transform 而不是 padding：不给布局添一寸，也不会把盘子顶出可视区。 */
    var maxLift = Math.max(0, (wrap.clientHeight - 12 - h) / 2);
    var lift = maxLift * liftPctNow() / 100;
    box.style.transform = lift > 0.5 ? 'translateY(' + (-Math.round(lift)) + 'px)' : '';
    lastLift = { size: h, max: Math.round(maxLift), lift: Math.round(lift) };
    updateLiftLabel();
    /* 密度按**单卡宽**分档（缝要先刨掉），跟屏幕上那把尺子一致 */
    var cell = (w - GAP * 2) / 3;
    var d = DENSITY[DENSITY.length - 1];
    for (var i = 0; i < DENSITY.length; i++) { if (cell >= DENSITY[i].min) { d = DENSITY[i]; break; } }
    pan.style.setProperty('--qm-cell-fs', d.fs + 'em');
    pan.style.setProperty('--qm-cell-pt', d.pt + 'px');
    pan.style.setProperty('--qm-cell-pb', d.pb + 'px');
    pan.style.setProperty('--qm-shen-mt', d.sm + 'px');
    pan.style.setProperty('--qm-line-mt', d.lm + 'px');
    /* ★ 把这一档的几何挂出来：snapshot.js 直接读它，
       截图于是和屏幕共用同一套数字，不会再各画各的。
       ⚠ 2026-11-02 晚：`--qm-cell-fs / -pt / -pb` 这三个变量 CSS 里**没有规则消费**
         （pan.css 的 .qm-cell 仍是写死的 .88em / 8px 7px 22px），屏幕真实字号并不等于
         16*d.fs。截图若拿 16*d.fs 当 1em，整张图的字会比屏幕小约 9%（390 屏实测
         12.8 vs 14.08）。这里把**量到的真实值**一并挂出去，snapshot 的 metrics() 以它为准。 */
    var cellEl = pan.querySelector('.qm-cell');
    var cellFS = cellEl ? parseFloat(getComputedStyle(cellEl).fontSize) : 16 * d.fs;
    var padTop = cellEl ? parseFloat(getComputedStyle(cellEl).paddingTop) : d.pt;
    window.QmCell = { cell: cell, cellH: (h - GAP * 2) / 3, gap: GAP, panW: w, panH: h,
      E: 16 * d.fs, fs: d.fs, pt: d.pt, pb: d.pb, sm: d.sm, lm: d.lm,
      cellFS: cellFS, padTop: padTop };
    fitStars();
  }

  /* ================================================================ 道家阴盘 · 心盘
     两个纯算法模块：js/yinpan.js（起局）· js/xinpan.js（自定义局），都移植自 wrz1911/daojiayinpan，
     已与源项目逐字段对拍（阴盘 2 万例 · 心盘 3 万例，0 差异）。这里只做三件事：
       ① 把它们的短名结果翻成盘面编码（Q.STAR / Q.GATE / Q.DEITY / 干下标）
       ② 拼一张"假 chart"交给现有渲染 —— 详情、截图、自适应于是全部复用
       ③ 心盘的宫位编辑器（五类符号 + 以此宫推算全盘）
     ⚠ 暗干只有阴盘有；心盘与时家都没有（用户明确）。 */
  var XP_GODS = [['符', '值符'], ['蛇', '腾蛇'], ['阴', '太阴'], ['六', '六合'],
                 ['白', '白虎'], ['玄', '玄武'], ['地', '九地'], ['天', '九天']];
  var XP_XING = ['蓬', '芮', '冲', '辅', '英', '心', '柱', '任'];
  var XP_MEN = ['休', '死', '伤', '杜', '开', '惊', '生', '景'];
  var xp = { anchor: 0, isYin: true, d: {}, bg: null, calc: null };

  function xpGodFull(s) {
    for (var i = 0; i < XP_GODS.length; i++) if (XP_GODS[i][0] === s) return XP_GODS[i][1];
    return '';
  }
  /* 干 → 盘面用的**1 基**下标（Q.STEM[1]='甲' … [10]='癸'）；0 = 无。
     ⚠ 四柱那几块用的是 0 基（cal.index.*），盘面单元格用的是 1 基（ganChip），别混。 */
  function gn1(ch) { var i = GAN10.indexOf((ch || '')[0] || ''); return i < 0 ? 0 : i + 1; }
  function stIdx(s) { return s ? Math.max(0, Q.STAR.indexOf('天' + s)) : 0; }
  function gtIdx(s) { return s ? Math.max(0, Q.GATE.indexOf(s + '门')) : 0; }
  function dtIdx(s) { return Math.max(0, Q.DEITY.indexOf(xpGodFull(s))); }

  /* 短名八宫 → 盘面能画的 chart。withAn=true 才带暗干（阴盘），心盘传 false */
  function ypChart(d, meta, calendar, juText, withAn, isYin) {
    var plate = [];
    for (var g = 1; g <= 9; g++) {
      var q = d[g] || {};
      plate.push({
        pal: g, name: Q.PAL_NAME[g], wuxing: Q.PAL_WX[g],
        star: stIdx(q.xing), gate: gtIdx(q.men), deity: dtIdx(q.shen),
        heaven: gn1(q.tian), earth: gn1(q.di),
        mid: gn1(q.tian2),                                /* 天盘的第二个字（寄干） */
        earth2: gn1(q.di2),                               /* 地盘的第二个字（寄干，落在坤二） */
        agan: withAn ? gn1(q.anGan) : 0,                  /* 暗干：只阴盘有，0 = 无 */
        /* 坤二可能带**两颗**暗干（本宫的 + 中宫寄来的，引擎 anGan 是「辛戊」两字）；
           以前只取首字，第二颗丢了（2026-11-02 排查项 7）。 */
        agan2: withAn ? gn1((q.anGan || '').slice(1)) : 0,
        kong: !!q.kong, ma: !!q.ma, dutyStar: !!q.dutyStar, dutyGate: false
      });
    }
    /* 格局分析（patterns.analyze）要这两样：遁向与伏吟/反吟标记。
       阴盘/心盘是自定义盘，伏吟反吟暂不判定（标记恒 false，宁缺勿错），其余格局照常分析。 */
    var m2 = {};
    for (var k in meta) if (Object.prototype.hasOwnProperty.call(meta, k)) m2[k] = meta[k];
    m2.fuYin = { any: false, star: false, gate: false };
    m2.fanYin = { any: false, star: false, gate: false };
    return {
      manual: true, yinpan: withAn, xinpan: !withAn, input: calendar.input,
      calendar: calendar,
      ju: { juText: juText, yuanName: '', polarity: isYin ? -1 : 1 },
      meta: m2, plate: plate
    };
  }

  /* 阴盘起局（时家这一层；盘式里的「阴盘」开关开了才走这条） */
  function castYinpan(p) {
    try {
      var r = Yinpan.cast(p.y, p.m, p.d, p.h, p.mi, { lateZi: S.settings.lateZi });
      if (!r || !r.ok) return null;
      var d = {};
      Yinpan.PALS.forEach(function (g) {
        var q = r.d[g] || {};
        d[g] = { shen: q.shen, xing: q.xing, men: q.men, tian: q.tian, tian2: q.tian2,
          di: q.di, di2: q.di2, anGan: q.anGan, kong: !!q.kong, ma: !!q.ma,
          dutyStar: g === r.zhiFuGong };
      });
      state.chartSub = 'yin';
      /* ⚠ 阴盘引擎返回的是「天蓬星」（与源项目逐字段对拍，不改它）；
         盘面各处的星名口径是「天蓬」（与 Q.STAR / 时家一致）。
         这里只剥掉末尾一个「星」字再交给渲染 —— 2026-11-02 用户点名：
         抬头/截图里的值符多了一个「星」字。 */
      return ypChart(d, {
        zhiFuStar: String(r.zhiFuStar || '').replace(/星$/, ''), zhiShiGate: r.zhiShiGate,
        xunShou: r.xunShou, xunKong: r.kongWang, hourLead: 0, starDuty: 0
      }, r.calendar, r.juText, true, r.isYin);
    } catch (e) {
      toast('阴盘起局出错：' + (e && e.message ? e.message : e));
      return null;
    }
  }

  /* ---- 心盘：背景取自主页那一刻的时家盘；八宫留空等用户编 ---- */
  function xpBg() {
    var p = currentParts(), fo = flyOpts();
    fo.lateZi = S.settings.lateZi; fo.ju = S.settings.juMethod;
    var c = Q.cast(p.y, p.m, p.d, p.h, p.mi, fo);
    var kong = {}, ma = 0;
    c.plate.forEach(function (q) { if (q.kong) kong[q.pal] = true; if (q.ma) ma = q.pal; });
    return { calendar: c.calendar, xunShou: c.meta.xunShou, kongWang: c.meta.xunKong,
      kong: kong, ma: ma, isYin: String(c.ju.juText).indexOf('阴遁') === 0 };
  }
  function xpEmpty() {
    xp.d = {};
    Xinpan.PALS.forEach(function (g) { xp.d[g] = { shen: '', xing: '', men: '', tian: '', di: '' }; });
  }
  function xpEnter() {
    xp.anchor = 0; xp.calc = null;
    xp.bg = xpBg(); xp.isYin = xp.bg.isYin;
    xpEmpty();
    xpRender();
    toast('心盘：点任意宫位定它的符号，再按「以此宫推算全盘」');
  }
  function xpChartObj() {
    var bg = xp.bg, k = xp.calc, d = {};
    Xinpan.PALS.forEach(function (g) {
      var q = (k && k.d[g]) || xp.d[g] || {};
      d[g] = { shen: q.shen, xing: q.xing, men: q.men, tian: q.tian, tian2: q.tian2,
        di: q.di, di2: q.di2, kong: !!bg.kong[g], ma: bg.ma === g,
        dutyStar: !!(k && k.fuGong === g) };
    });
    return ypChart(d, {
      /* 心盘引擎的 zhiFuStar 同样带「星」尾（天蓬星）；显示口径与阴盘/时家统一成「天蓬」 */
      zhiFuStar: k ? String(k.zhiFuStar || '').replace(/星$/, '') : '—', zhiShiGate: k ? k.zhiShiMen : '—',
      xunShou: bg.xunShou, xunKong: bg.kongWang, hourLead: 0, starDuty: 0
    }, bg.calendar, k ? ('心盘 · ' + k.juText) : '心盘 · 点宫位定符号', false, xp.isYin);
  }
  function xpRender() {
    state.chart = xpChartObj();
    state.analysis = safeAnalyze(state.chart); state.starMap = null;
    state.chartSub = 'xin'; state.layer = 'shi';
    setView('chart');
    renderChart();
    requestAnimationFrame(fitPan);
  }
  function xpChips(kind, list, cur, label) {
    return '<div class="xpl"><span class="k">' + label + '</span><div class="xpchips" data-k="' + kind + '">'
      + list.map(function (o) {
        return '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="on"' : '') + '>'
          + (o[1] || o[0]) + '</button>';
      }).join('') + '</div></div>';
  }
  function xpEditorHTML(g, d) {
    return '<div class="bar"></div><h2>心盘 · <b>' + Q.PAL_NAME[g] + g + '宫</b></h2>'
      + '<div class="sub">' + (xp.isYin ? '阴遁' : '阳遁') + ' · 点符号改这一宫，再按下面的按钮推全盘</div>'
      + '<div class="card" style="margin:0 0 12px">'
      + '<div class="xpl"><span class="k">遁</span><div class="xpchips" data-k="dun">'
      + '<button type="button" data-v="1"' + (!xp.isYin ? ' class="on"' : '') + '>阳遁</button>'
      + '<button type="button" data-v="-1"' + (xp.isYin ? ' class="on"' : '') + '>阴遁</button></div></div>'
      + xpChips('shen', XP_GODS, d.shen, '八神')
      + xpChips('xing', XP_XING.map(function (s) { return [s, '天' + s]; }), d.xing, '九星')
      + xpChips('men', XP_MEN.map(function (s) { return [s, s + '门']; }), d.men, '八门')
      + xpChips('tian', GAN10.map(function (s) { return [s, s]; }), d.tian, '天盘干')
      + xpChips('di', ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'], d.di, '地盘干')
      + '</div>'
      + '<div class="btnrow"><button class="btn primary" id="xpFill">以此宫推算全盘</button>'
      + '<button class="btn" id="xpClear">重来</button></div>';
  }
  function xpEdit(g) {
    if (xp.calc && xp.calc.d[g]) {                       /* 已经推过盘：接着推算结果继续改 */
      Xinpan.PALS.forEach(function (h) {
        var q = xp.calc.d[h]; if (!q) return;
        xp.d[h] = { shen: q.shen, xing: q.xing, men: q.men, tian: q.tian, di: q.di };
      });
    }
    xp.anchor = g;
    var d = xp.d[g] || (xp.d[g] = { shen: '', xing: '', men: '', tian: '', di: '' });
    openSheet(xpEditorHTML(g, d));
    Array.prototype.forEach.call($('sheet').querySelectorAll('.xpchips'), function (box) {
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (box.dataset.k === 'dun') xp.isYin = (b.dataset.v === '-1');
        else d[box.dataset.k] = b.dataset.v;
        xpEdit(g);                                       /* 直接重画弹层，省得手动同步选中态 */
      });
    });
    $('xpFill').addEventListener('click', function () { xpFill(g); });
    $('xpClear').addEventListener('click', function () {
      xp.calc = null; xpEmpty(); closeSheet(); xpRender();
      toast('心盘：已清空，重新点宫位定符号');
    });
  }
  function xpFill(g) {
    var d = xp.d[g] || {};
    if (!d.tian || !d.di) { toast('天盘干、地盘干各先点一颗'); return; }
    var r = Xinpan.build({ anchor: g, isYin: xp.isYin, shen: d.shen, xing: d.xing,
      men: d.men, tian: d.tian, di: d.di });
    if (!r.ok) { toast(r.why || '推不出来'); return; }
    xp.calc = r;
    closeSheet();
    xpRender();
    toast('心盘 · ' + r.juText + (r.fuyin ? '（伏吟）' : ''));
  }

  /* 心盘是**时家专用**（要自己定局），所以选它时把日月年家收回时家、并把那三格压灰。
     阴盘 2026-11-02 起变成定局法，不再参与这里的锁定（四层照常可切，各层有自己的定局口径）。 */
  function syncModeGate() {
    var lock = (state.mode === 'xin');
    var seg = $('segLayer');
    if (seg) Array.prototype.forEach.call(seg.children, function (b) {
      var off = lock && b.dataset.l !== 'shi';
      /* 只做视觉标记，不 disabled：心盘下点四层时，initHome 会先切回「此时刻」 */
      b.classList.toggle('lock', off);
    });
    if (lock && state.layer !== 'shi') { state.layer = 'shi'; syncLayer(); }
  }

  function renderChart() {
    var c = state.chart, cal = c.calendar, ju = c.ju, m = c.meta, ci = cal.index;
    var cols = [
      { g: ci.yearGan, z: ci.yearZhi }, { g: ci.monthGan, z: ci.monthZhi },
      { g: ci.dayGan, z: ci.dayZhi }, { g: ci.hourGan, z: ci.hourZhi }
    ];
    /* 手动起局没有日期，年月日柱画「—」 */
    function tile(v, isStem) {
      var kind = isStem ? 't-g' : 't-z';
      if (v < 0) return '<span class="tile ' + kind + ' t-none">—</span>';
      var wx = isStem ? EL[Q.STEM_WX[v + 1]] : EL[ZHI_WX[v]];
      return '<span class="tile ' + kind + ' ' + wx + '">' + (isStem ? Q.STEM[v + 1] : Lunar.ZHI[v]) + '</span>';
    }
    /* 抬头（四柱）也交给插件：2026-11-01 起运行时多一条 head 通道（插件「四柱ui」）。
       谁先注册谁先得；插件不接（或阴盘/手动盘不接）就回到默认的无缝矩阵。
       ⚠ 插件自己吐柱名那一行，所以这时要把默认的 #plabel 藏掉，不然会叠两行。 */
    syncLayerHead();
    /* 2026-11-02 用户：四柱收进设置（排法 → 四柱：默认 / 简洁），不再走插件通道。
       2026-11-14 规则改为「插件默认适配所有盘」→ 阴盘也用简洁四柱。 */
    var plugHead = '';
    if (+S.settings.sizhu === 1 && window.SizhuUI) {
      try { plugHead = SizhuUI.html({ chart: c, chartSub: state.chartSub, esc: esc, Q: Q }) || ''; }
      catch (e) { plugHead = ''; }
    }
    var lb = $('plabel');
    var gzBox = $('gz');
    if (lb) lb.style.display = plugHead ? 'none' : '';
    /* #gz 自己挂着 .pillars（默认无缝矩阵的网格 + 底 + 框），插件接管时得摘掉，
       否则插件那一整块会被塞进 4 列网格里的第一列（62px），字全挤在一起。 */
    if (gzBox) gzBox.classList.toggle('pillars', !plugHead);
    $('gz').innerHTML = plugHead || cols.map(function (x) {
      return '<div class="p"><span class="tiles">' + tile(x.g, true) + tile(x.z, false) + '</span></div>';
    }).join('');

    $('vZhiFu').textContent = m.zhiFuStar;
    $('vZhiShi').textContent = m.zhiShiGate;
    $('vXunShou').textContent = m.xunShou;
    $('vXunKong').textContent = m.xunKong;

    /* 折叠层内容（平时收起，点旬空下方那条短线展开；悬浮在盘上、不挤压盘） */
    var rows = [];
    if (c.layer) {
      /* 三层的"时刻/农历/节气"没有意义，换成这层自己的定局依据 */
      var basis = {
        nian: '180 年一元（三元九运），1864 甲子年为上元起点，统一阴遁',
        yue: '60 甲子每 5 年一块，局＝(7＋块×3) mod 9，统一阴遁',
        ri: '二至定阴阳（' + (ju.polarity > 0 ? '冬至后阳遁' : '夏至后阴遁') + '），按 60 天周期取局'
      }[c.layer];
      rows.push(['层', LAYER_CN[c.layer] + '　' + ju.juText + ' · ' + ju.yuanName]);   /* yuanName 已含「元」字 */
      rows.push(['干支', ju.fuTou + '　（' + LAYER_CN[c.layer] + '用这一柱）']);
      /* 日家把"输入的那一天"写清楚：公历 + 农历 —— 日柱对不对，一眼就能核对。
         （用户报过日家取错日期：那时这里只说"日家"，看不出算的是哪一天） */
      if (c.layer === 'ri') {
        rows.push(['公历', c.input.y + ' 年 ' + c.input.m + ' 月 ' + c.input.d + ' 日']);
        if (cal.lunarText) rows.push(['农历', cal.lunarText + ' · 属' + cal.shengxiao]);
      }
      /* 日家的"依据"直接写清是哪一种起局法（日家流派不止一种，用户要对得上别人的盘） */
      rows.push(['依据', (c.layer === 'ri' && ju.note) ? ju.note : basis]);
    } else {
      if (c.input) rows.push(['时刻', fmtParts(c.input)]);
      /* 阴盘是按农历月日＋节气做"数字定局"的，这两行是它的真实依据，照显；
         只有心盘（自定义局）没有农历节气可言，才跟自选局一样藏。 */
      if (!c.manual || c.yinpan) {
        rows.push(['农历', cal.lunarText + ' · 属' + cal.shengxiao]);
        rows.push(['节气', cal.seasonText + (ju.yuanName ? ' · ' + ju.yuanName : '')]);
      }
    }
    /* 定局法 + 超神/接气/正授（置闰法另标出闰在哪一气）—— 同行都把这几个字摆在盘上，
       因为它直接决定局数对不对，不能藏。 */
    if (ju.layer) {
      /* 三层各有自己的定局法，不写"拆补/置闰" */
    } else if (c.yinpan) {
      /* 阴盘：数字定局（年支＋农历月＋农历日＋时支，%9），不是"手动指定" */
      rows.push(['定局', '数字定局　' + ju.juText]);
    } else if (c.xinpan) {
      rows.push(['定局', '心盘自定义　' + ju.juText]);
    } else if (c.manual) {
      /* 手动起局是直接指定局数，**没有符头、也没有超神接气** —— 原来这里会打出「符头undefined」 */
      rows.push(['定局', '手动指定　' + ju.juText]);
    } else if (ju.system === 'zhirun') {
      rows.push(['定局', '置闰法 · ' + (ju.chaoJie || '') + (ju.leap ? ' · <span class="lk">' + ju.seasonName + '闰</span>' : '')
        + '　符头' + ju.fuTou + '（' + (ju.gap > 0 ? '符先节后 ' + ju.gap + '日' : ju.gap < 0 ? '节先符后 ' + (-ju.gap) + '日' : '符节同日') + '）']);
    } else {
      rows.push(['定局', '拆补法 · ' + (ju.chaoJie || '') + '　符头' + ju.fuTou + '（' + (ju.gap > 0 ? '符先节后 ' + ju.gap + '日' : ju.gap < 0 ? '节先符后 ' + (-ju.gap) + '日' : '符节同日') + '）']);
    }
    /* 观测点：有城市名就写城市名（选城来的），没有就写裸经纬度（手填的） */
    if (state.starMap && !c.layer) rows.push(['观测', locTitle() + '　' + Math.abs(S.settings.lat).toFixed(2) + '°' +
      (S.settings.lat >= 0 ? 'N' : 'S') + ' ' + Math.abs(S.settings.lon).toFixed(2) + '°' +
      (S.settings.lon >= 0 ? 'E' : 'W')]);
    /* 中宫是「九宫盘 ⇄ 卦象·地支面」的开关，这里把当前在哪一面写出来（中宫本身保持干净） */
    rows.push(['盘面', flyMode()
      ? (state.face === 'both' ? '卦象 · 地支面' : '九宫盘') + '　' +
        ['星', '门', '神'].filter(function (x, i) { return [S.settings.flyStar, S.settings.flyGate, S.settings.flyGod][i]; })
          .join('·') + '飞盘'
      : (state.face === 'both'
        ? '卦象 · 地支面　点中宫回九宫盘'
        : '九宫盘　点中宫看卦象与地支')]);
    rows.push(['格局', '<span class="lk" id="lkGe">共 ' + state.analysis.ge.length + ' 条，点这里看全部 ›</span>']);
    /* 长生：条数 = 可判长生的干数（天盘干 + 寄干；中五宫不纳支不计） */
    var csTotal = 0;
    c.plate.forEach(function (p) { csTotal += Q.changShengAt(p.pal, p).length; });
    rows.push(['长生', '<span class="lk" id="lkCs">共 ' + csTotal + ' 条，点这里看全部 ›</span>']);
    /* 象义：查询表性质，条数固定 = 全表条数（七类合计），与具体盘面无关 */
    var xyTotal = 0;
    if (window.Xiangyi) Xiangyi.ORDER.forEach(function (o) { xyTotal += Xiangyi.X[o.k].length; });
    rows.push(['象义', '<span class="lk" id="lkXy">共 ' + xyTotal + ' 象，点这里看全部 ›</span>']);
    var drop = $('qdrop');
    drop.innerHTML = rows.map(function (r) {
      return '<div class="r"><i>' + r[0] + '</i><b>' + r[1] + '</b></div>';
    }).join('');
    /* ⚠ 只有这两条文字链可点（用户要求：点行的其它位置不响应，防误触）。
       所以**不能**再给 drop 整块绑 onclick —— 改成两个 span 各自绑、各自 stopPropagation。 */
    drop.onclick = null;
    var lkGe = $('lkGe'), lkCs = $('lkCs');
    if (lkGe) lkGe.onclick = function (e) { e.stopPropagation(); openPatternSheet(); };
    if (lkCs) lkCs.onclick = function (e) { e.stopPropagation(); openChangshengSheet(); };
    var lkXy = $('lkXy');
    if (lkXy) lkXy.onclick = function (e) { e.stopPropagation(); openXiangyiSheet('xing'); };

    var tb = $('tbTitle');
    var sub = c.layer ? (LAYER_CN[c.layer] + ' · ' + ju.yuanName)
      : (c.manual ? '手动起局' : (cal.seasonText + ' ' + ju.yuanName));
    tb.innerHTML = '<span style="color:var(--accent)">' + esc(ju.juText) + '</span><small>' + esc(sub) + '</small>';
    tb.classList.add('tappable');
    tb.onclick = openPatternSheet;

    if (state.chartSub === 'xin') {
      $('tbTitle').innerHTML = '心<b>盘</b>';
      $('tbTitle').classList.remove('tappable');
      $('tbTitle').onclick = null;
    } else if (state.chartSub === 'yin') {
      $('tbTitle').innerHTML = '阴<b>盘</b>';
    }
    renderMiniLesson(state.chart);      /* 排法开着 → 盘上方先摆一段课，盘自然被挤下去 */
    renderPan();
    /* 同步先量一次：一是免得闪一帧错误尺寸，二是截图渲染要立刻拿到 QmCell 几何 */
    fitPan();
    requestAnimationFrame(fitPan);
  }

  /* ---------------------------------------------------------- 切盘 */
  /* 换时辰提示（2026-11-10 v5 · 用户定版：分体翻牌）：
     切盘前把**要变的那一柱**克隆下来，新盘渲染完盖回去翻：
     上半（干）先掀、下半（支）后落，总时长约 260ms。
     翻牌层是绝对定位的覆盖物，不参与布局与盘面测量；连续切时先摘掉上一轮，
     不会排队。没有 .p 网格（插件四柱）或开了「减少动态效果」时，退回细线框。 */
  function shiftCellIndex() {
    if (state.layer === 'nian') return 0;
    if (state.layer === 'yue') return 1;
    if (state.layer === 'ri') return 2;
    return 3;                                  /* 时家：时柱 */
  }
  function captureShiftCell() {
    var gz = $('gz');
    if (!gz || !gz.classList.contains('pillars')) return null;
    var cells = gz.querySelectorAll('.p');
    var i = shiftCellIndex();
    return cells[i] ? { node: cells[i].cloneNode(true), idx: i } : null;
  }
  function playFlap(gz, snap) {
    var cells = gz.querySelectorAll('.p');
    var cell = cells[snap.idx];
    if (!cell || !cell.offsetWidth) return false;
    Array.prototype.forEach.call(gz.querySelectorAll('.flap-layer'), function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
    var box = document.createElement('div');
    box.className = 'flap-layer';
    box.style.left = cell.offsetLeft + 'px';
    box.style.top = cell.offsetTop + 'px';
    box.style.width = cell.offsetWidth + 'px';
    box.style.height = cell.offsetHeight + 'px';
    ['flap-top', 'flap-bottom'].forEach(function (cls, k) {
      var half = snap.node.cloneNode(true);
      half.classList.add('flap-half', cls);
      half.style.position = 'absolute';
      half.style.left = '0'; half.style.top = '0';
      half.style.width = '100%'; half.style.height = '100%';
      half.style.margin = '0'; half.style.borderRadius = '10px';
      half.style.overflow = 'hidden';
      /* 上半取 0–50%，下半取 50–100%；折轴就在分割线上 */
      half.style.clipPath = k === 0 ? 'inset(0 0 50% 0)' : 'inset(50% 0 0 0)';
      box.appendChild(half);
    });
    gz.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 340);
    return true;
  }
  function flashShift(snap) {
    var gz = $('gz');
    if (!gz) return;
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (snap && !reduce && playFlap(gz, snap)) return;
    /* 兜底：细线框（插件四柱 / 减少动态效果） */
    gz.classList.remove('shift-flash');
    void gz.offsetWidth;
    gz.classList.add('shift-flash');
    clearTimeout(gz._shiftTimer);
    gz._shiftTimer = setTimeout(function () { gz.classList.remove('shift-flash'); }, 900);
  }
  /* 时辰两小时一格 → ±2 小时必落相邻时辰；手动局直接挪时干支（60 甲子）。 */
  function shiftChart(dir) {
    /* 先留一张旧牌：renderChart 会把 #gz 整块重建，重建后就拿不到旧干支了 */
    var shiftSnap = captureShiftCell();
    /* ★ 三层的"上/下一格"要按**层**走：年家 ±1 年、月家 ±1 节气月、日家 ±1 日。
       原来这里不看层级，站在年家盘上按 ‹ › 会悄悄起一张时家盘 —— 标签写着年家、盘却是时家。 */
    if (state.layer !== 'shi') {
      var p0 = standardParts();
      var np = { y: p0.y, m: p0.m, d: p0.d, h: p0.h, mi: p0.mi };
      if (state.layer === 'nian') {
        var yd = new Date(p0.y + dir, p0.m - 1, p0.d, p0.h, p0.mi);
        np = { y: yd.getFullYear(), m: yd.getMonth() + 1, d: yd.getDate(), h: yd.getHours(), mi: yd.getMinutes() };
      } else if (state.layer === 'yue') {
        var sm = solarMonthOf(p0);
        var nm = sm.m + dir, ny = sm.y;
        if (nm > 12) { nm = 1; ny += 1; }
        if (nm < 1) { nm = 12; ny -= 1; }
        var st = solarMonthStart(ny, nm);
        /* ★ 写回「目标月起点**次日** 12:00」：交节常在晚上，写回交节当天 12:00 会仍停在上一个月 */
        var sd = new Date(st.y, st.m - 1, st.d + 1, 12, 0);
        np = { y: sd.getFullYear(), m: sd.getMonth() + 1, d: sd.getDate(), h: 12, mi: 0 };
      } else {
        /* 日家只看日期：真太阳时下按换算后的日期翻，写回该日中午（12:00 不会因真太阳时再跨日） */
        var pd = solarParts(p0);
        var dt0 = new Date(pd.y, pd.m - 1, pd.d + dir, 12, 0);
        np = { y: dt0.getFullYear(), m: dt0.getMonth() + 1, d: dt0.getDate(), h: 12, mi: 0 };
      }
      np.y = Math.max(1900, Math.min(2100, np.y));
      setPickInput(np);                     /* 统一写回那张「日期 + 时刻」样件 */
      state.chart = buildChart();
      state.analysis = P.analyze(state.chart);
      placeStars(); renderChart();
      flashShift(shiftSnap);
      var unit = { nian: '年', yue: '月', ri: '日' }[state.layer];
      toast((dir > 0 ? '下一' : '上一') + unit + ' · ' + (state.chart.ju.fuTou || '') + ' ' + state.chart.ju.juText);
      return;
    }
    /* ⚠ 阴盘：合成盘带 manual=true，落到下面会被当"自选局"（只挪 hourIdx、时刻没变）→ 按了没反应。
       这里先拦：把时刻挪一时辰写回选时刻框，再按阴盘重排。判定看**盘本身**的 yinpan 标记
       （阴盘现在是定局法，state.mode 仍是 time/random，不能再拿 mode 认）。 */
    if (state.chart && state.chart.yinpan) {
      /* 翻层基准必须是标准时：写回 #dtPick 的也必须是标准时，否则真太阳时会被当成标准时再换算一次 */
      var b0 = standardParts();
      var d0 = new Date(b0.y, b0.m - 1, b0.d, b0.h + dir * 2, b0.mi, 0, 0);
      var np0 = { y: d0.getFullYear(), m: d0.getMonth() + 1, d: d0.getDate(), h: d0.getHours(), mi: d0.getMinutes() };
      S.settings.mode = 'pick'; S.saveSettings();
      syncNowPick(); setPickInput(np0);
      state.chart = buildChart();                    /* 走阴盘引擎（currentParts → 刚写回的那一刻） */
      state.analysis = safeAnalyze(state.chart);
      placeStars(); renderChart();
      flashShift(shiftSnap);
      toast((dir > 0 ? '下一时辰 · ' : '上一时辰 · ') + state.chart.calendar.ganzhi.hour + '时 · '
        + state.chart.ju.juText);
      return;
    }
    if (state.chart && state.chart.manual) {
      state.manual.hourIdx = (state.manual.hourIdx + dir + 60) % 60;
      syncManual();
      state.chart = buildChart();
      state.analysis = P.analyze(state.chart);
    } else {
      var base = standardParts();
      var dt = new Date(base.y, base.m - 1, base.d, base.h + dir * 2, base.mi, 0, 0);
      var np = { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate(), h: dt.getHours(), mi: dt.getMinutes() };
      S.settings.mode = 'pick'; S.saveSettings();
      syncNowPick(); setPickInput(np);
      /* ★ 用 buildChart()：它会从 #dtPick 读标准时并做真太阳时换算，
         直接 Q.cast(标准时) 会漏掉真太阳时（开了真太阳时后翻时辰与正常起盘不一致）。 */
      state.chart = buildChart();
      state.analysis = P.analyze(state.chart);
    }
    placeStars();
    renderChart();
    flashShift(shiftSnap);
    toast((dir > 0 ? '下一时辰 · ' : '上一时辰 · ') + state.chart.calendar.ganzhi.hour + '时');
  }

  /* ---------------------------------------------------------------- 弹层 */
  function patternListHTML(list) {
    return list.map(function (it) {
      var where = it.pal ? '<span class="tag">' + Q.PAL_NAME[it.pal] + it.pal + '宫</span> ' : '';
      /* 禽芮同宫一宫两干：另一条是天禽寄干所成之格，标出来才分得清是哪一干 */
      var via = it.via === 'mid' ? '<span class="tag2">天禽寄干</span> ' : '';
      /* 十干克应要把「哪两个天干」写在格名前：壬加戊 小蛇化龙 */
      var nm = (it.stems ? '<i class="stems">' + esc(it.stems) + '</i>' : '') + esc(it.name);
      return '<li><span class="dot ' + it.level + '"></span><span class="nm ' + it.level + '">' + nm + '</span>' +
        '<span class="ds">' + via + where + esc(it.desc) + '</span></li>';
    }).join('');
  }
  /* ---------------------------------------------------------------- 模态管理
     2026-11-10 审查项：弹层原来只切 class，关闭后内容仍在 DOM 里可被 Tab / 读屏访问，
     打开时焦点也不进弹层。这里统一做三件事：
       ① 打开前记住焦点，关闭后还回去；
       ② 打开后把焦点送进弹层（首个可聚焦控件，没有就落在弹层本身）；
       ③ Tab 在弹层内循环、Esc 关闭最上层。
     视觉上的进出仍由 CSS 负责，这里只管语义与焦点，不碰动画。 */
  var modalStack = [];
  function activeModal() {
    return modalStack.length ? modalStack[modalStack.length - 1].el : null;
  }
  function focusablesIn(root) {
    var sel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.filter.call(root.querySelectorAll(sel), function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0;
    });
  }
  function pushModal(el) {
    if (!el || activeModal() === el) return;
    var prev = document.activeElement;
    modalStack.push({ el: el, prev: prev });
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.setAttribute('aria-hidden', 'false');
    var f = focusablesIn(el);
    try { (f[0] || el).focus({ preventScroll: true }); } catch (e) { try { (f[0] || el).focus(); } catch (e2) {} }
  }
  function popModal(el) {
    var i = -1;
    for (var k = modalStack.length - 1; k >= 0; k--) { if (modalStack[k].el === el) { i = k; break; } }
    if (i < 0) return;
    var rec = modalStack[i];
    modalStack.splice(i, 1);
    el.setAttribute('aria-hidden', 'true');
    /* 还焦点：原来点它的那个控件如果还在页面上，就还回去 */
    if (rec.prev && rec.prev.focus && document.contains(rec.prev)) {
      try { rec.prev.focus({ preventScroll: true }); } catch (e) { try { rec.prev.focus(); } catch (e2) {} }
    }
  }
  /* Esc / Tab：只在有弹层时接管，平时不干扰页面 */
  document.addEventListener('keydown', function (e) {
    var top = activeModal();
    if (!top) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (top.id === 'sheet') closeSheet();
      else if (top.id === 'cxPop') closeCxPop();
      else if (top.id === 'cropper') closeCrop();
      return;
    }
    if (e.key !== 'Tab') return;
    var f = focusablesIn(top);
    if (!f.length) { e.preventDefault(); top.focus(); return; }
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !top.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !top.contains(a))) { e.preventDefault(); first.focus(); }
  });

  function openSheet(html) {
    $('sheet').innerHTML = html;
    /* 标题取弹层里的第一个 h2，供读屏念出（内容由各弹层自己拼） */
    var h = $('sheet').querySelector('h2');
    $('sheet').setAttribute('aria-label', h ? h.textContent.trim() : '详情');
    $('sheet').classList.add('on');
    $('mask').classList.add('on');
    pushModal($('sheet'));
  }
  function closeSheet() {
    $('sheet').classList.remove('on');
    $('mask').classList.remove('on');
    popModal($('sheet'));
    /* 顺手收起「更多信息」展开层：从它点进格局/长生/象义，看完关弹层时一起收掉，
       别让用户再手动点一次折叠把手。 */
    var dp = $('qdrop'), bm = $('btnMore');
    if (dp) dp.classList.remove('on');
    if (bm) bm.classList.remove('open');
  }
  function openPatternSheet() {
    var list = state.analysis.ge, byPal = state.analysis.byPal;
    var globals = list.filter(function (it) { return !it.pal; });
    var html = '<div class="bar"></div><h2>格局<b>总览</b></h2>' +
      '<div class="sub">共 ' + list.length + ' 条 · 各流派表述不一，仅供参考</div>';
    if (globals.length) html += '<div class="card" style="margin:0 0 12px"><h3>全盘</h3><ul class="plist">' + patternListHTML(globals) + '</ul></div>';
    /* 按宫：旺相休囚是"气的状态"，不进格局总览（宫详情里单独一节） */
    var pals = Object.keys(byPal).map(Number).sort(function (a, b) { return a - b; })
      .filter(function (pal) { return byPal[pal].some(function (x) { return !x.vigor; }); });
    if (pals.length) {
      html += '<div class="card" style="margin:0"><h3>按宫</h3><ul class="plist">' +
        pals.map(function (pal) {
          return patternListHTML(byPal[pal].filter(function (x) { return !x.vigor; }));
        }).join('') + '</ul></div>';
    }
    if (!list.length) html += '<div class="empty">本盘未检出常见格局</div>';
    openSheet(html);
  }
  /* 长生表里一个干字的单元。寄干缀 cls=cs-ji（虚框），天盘干按五行上色（同盘面）。 */
  function ganCell(g) {
    /* 三个干**都用五行色**（用户口径），天/地靠行序区分、寄干靠虚框 —— 不再用字重分。 */
    var cls = 'cs-gn cs-' + g.via + ' el-' + (EL[Q.STEM_WX[g.stem]] || 'earth');
    if (g.via === 'mid') cls += ' cs-ji';
    return '<b class="' + cls + '">' + Q.STEM[g.stem] + '</b>';
  }
  /* ============================================================ 象义（卖点）
     卡片词典：搜索 + 事象反查 + 分类浏览 + 关联符号跳转。
     ⚠ 数据在 js/xiangyi.js（X/SYMBOL_INDEX/SHI_INDEX），五行方位与引擎同源；
       断语是「占断要诀」，类象是数组，关联符号可点跳转。改数据那边要回来核。 */
  function openXiangyiSheet(initK) {
    if (!window.Xiangyi) { toast('象义模块未加载'); return; }
    var Y = window.Xiangyi;
    var total = Y.ORDER.reduce(function (n, o) { return n + Y.X[o.k].length; }, 0);
    var html = '<div class="bar"></div><h2>象<b>义</b></h2>' +
      '<div class="sub">七类共 ' + total + ' 象 · 断语一句话占断 · 类象可按事象反查</div>' +
      '<div class="xysearch"><input type="text" id="xySearch" placeholder="搜符号名或事象，如「天蓬」「求财」" autocomplete="off"></div>' +
      '<div class="xyshitags" id="xyShiTags">' +
      Object.keys(Y.SHI_INDEX).map(function (shi) {
        return '<button type="button" data-shi="' + shi + '">' + shi + '</button>';
      }).join('') + '</div>' +
      '<div class="xytabs" id="xyTabs">' +
      Y.ORDER.map(function (o) {
        return '<button type="button" data-k="' + o.k + '">' + o.t + '</button>';
      }).join('') + '</div>' +
      '<div class="xycards" id="xyCards"></div>';
    openSheet(html);

    var curK = initK || 'xing', curShi = null, q = '';
    function relKey(name) { return name.replace(/[ ☰☱☲☳☴☵☶☷]/g, ''); }
    function matches(it, query) {
      if (!query) return true;
      return [it.n, it.duan, it.wx, it.dir].concat(it.ren, it.shen, it.qing, it.shi)
        .join(' ').indexOf(query) >= 0;
    }
    function fieldHTML(label, arr) {
      return '<div class="xyf"><i>' + label + '</i><span>' +
        arr.map(function (x) { return '<b class="xyc-tag">' + esc(x) + '</b>'; }).join('') +
        '</span></div>';
    }
    function catName(k) {
      for (var i = 0; i < Y.ORDER.length; i++) if (Y.ORDER[i].k === k) return Y.ORDER[i].t;
      return '';
    }
    function cardHTML(it, showCat) {
      var cat = showCat
        ? '<span class="xyc-cat">' + catName(Y.SYMBOL_INDEX[relKey(it.n)]) + '</span>' : '';
      return '<div class="xycard" data-n="' + relKey(it.n) + '">' +
        '<div class="xyc-head"><b class="xyc-name">' + esc(it.n) + '</b>' + cat +
        '<span class="xyc-wx">' + esc(it.wx) + ' · ' + esc(it.dir) + '</span></div>' +
        '<div class="xyc-duan">' + esc(it.duan) + '</div>' +
        '<div class="xyc-fields">' +
        fieldHTML('人物', it.ren) + fieldHTML('身体', it.shen) +
        fieldHTML('性情', it.qing) + fieldHTML('事象', it.shi) +
        '</div>' +
        '<div class="xyc-rel"><i>关联</i>' +
        it.rel.map(function (r) {
          return '<button type="button" class="xyrel" data-to="' + relKey(r) + '">' + esc(r) + '</button>';
        }).join('') + '</div></div>';
    }
    function render() {
      var items = [];
      if (q) {
        /* 搜索：跨全表 68 条；关键词命中某个事象名时，把该事象的相关符号一并带出 */
        var shiHit = Y.SHI_INDEX[q] || null;
        var seen = {};
        Y.ORDER.forEach(function (o) {
          Y.X[o.k].forEach(function (it) {
            var key = relKey(it.n);
            if (seen[key]) return;
            if (matches(it, q) || (shiHit && shiHit.indexOf(key) >= 0)) {
              seen[key] = 1; items.push(it);
            }
          });
        });
      } else if (curShi) {
        (Y.SHI_INDEX[curShi] || []).forEach(function (name) {
          var k = Y.SYMBOL_INDEX[name];
          if (!k) return;
          var hit = null;
          Y.X[k].forEach(function (x) { if (relKey(x.n) === name) hit = x; });
          if (hit) items.push(hit);
        });
      } else {
        Y.X[curK].forEach(function (it) { items.push(it); });
      }
      var box = $('xyCards');
      var showCat = !!(q || curShi);
      box.innerHTML = items.length
        ? items.map(function (it) { return cardHTML(it, showCat); }).join('')
        : '<div class="empty">' + (q || curShi ? '没搜到相关象义' : '无内容') + '</div>';

      $('xyTabs').querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', !q && !curShi && b.getAttribute('data-k') === curK);
      });
      var shiTagOn = curShi || (q && Y.SHI_INDEX[q] ? q : null);
      $('xyShiTags').querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-shi') === shiTagOn);
      });
      box.querySelectorAll('.xyrel').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var to = btn.getAttribute('data-to');
          var k = Y.SYMBOL_INDEX[to];
          if (!k) return;
          curK = k; curShi = null; q = '';
          $('xySearch').value = '';
          render();
          var card = $('xyCards').querySelector('.xycard[data-n="' + to + '"]');
          if (card) {
            card.scrollIntoView({ block: 'start' });
            card.classList.add('flash');
            setTimeout(function () { card.classList.remove('flash'); }, 1300);
          }
        });
      });
    }
    $('xyTabs').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-k]');
      if (!btn) return;
      curK = btn.getAttribute('data-k'); curShi = null;
      render(); $('sheet').scrollTop = 0;
    });
    $('xyShiTags').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-shi]');
      if (!btn) return;
      var shi = btn.getAttribute('data-shi');
      curShi = (curShi === shi) ? null : shi;
      render();
    });
    $('xySearch').addEventListener('input', function () { q = this.value.trim(); render(); });
    render();
  }
  /* 十二长生一览（用户点名要的表）：上=本盘各宫，下=十天干 × 十二地支对照。
     ⚠ 与宫位详情里那个按「宫五行」判的「旺衰」不是一套体系，别互相解释。 */
  function openChangshengSheet() {
    var c = state.chart;
    var html = '<div class="bar"></div><h2>十二<b>长生</b></h2>' +
      '<div class="sub">阳干顺行 · 阴干逆行，各干自「长生」起走满十二位</div>';
    /* ① 本盘：**摆成九宫**（洛书次序 巽4 离9 坤2 / 震3 中5 兑7 / 艮8 坎1 乾6，与盘面同一套
       CELL_ORDER），格内走「支做表头 + 每干一行」的两栏式：
           ┌───────────────┐
           │ 坤2    未   申 │  ← 支表头（只写支名；中宫不写）
           │ [己]  冠带 沐浴 │  ← 天盘干（第一行，五行色，同盘面）
           │ [己]  冠带 沐浴 │  ← 地盘干（第二行）
           │┄壬┄   养  长生 │  ← 寄干（**永远放最下面**，虚框 —— 见下）
           └───────────────┘
       ⚠ 用户点名：「寄干的排布位置要让人看得出来」。所以不靠颜色区分三种干，靠**位置＋形制**：
         ① 行序固定「天盘干 → 地盘干 → 寄干」，三行制从不变化，**寄干永远在末行**；
         ② 只有寄干那行的干字带**虚线框**（这套表格自己的形制；盘面 2026-10-21 已改成
             「天盘干章右上角角注」，两者不再同形 —— 别照抄盘面，也别为统一把表格也改角注）；
         ③ 天盘干/地盘干一律不加框 —— 于是「末行带框的那个＝寄干」不需要记。
       ⚠ 用户改过一次口径：最早寄干夹在中间，他说「放中间挺膈应的」，改到**最下面**。
         别再改回中间。
       ⚠ 天盘干与地盘干常是同一个字（如坤2 天己/地己，遍历 2160 盘统计过）——
         用户要求**照写不合并**，别自作主张省行。
       ⚠ 极端格：三干 × 双支 = 表头 1 行 + 干行 3 行 = 4 行，是全表最满的形态。 */
    var body = '';
    CELL_ORDER.forEach(function (pal) {
      var p = null;
      c.plate.forEach(function (x) { if (x.pal === pal) p = x; });
      if (!p) return;
      var zhis = Q.PAL_ZHI[pal] || [];
      /* 干行按固定次序攒：天盘干 → 地盘干 → 寄干（三个都可能缺） */
      var gans = [];
      if (p.heaven) gans.push({ via: 'heaven', stem: p.heaven });
      if (p.earth) gans.push({ via: 'earth', stem: p.earth });
      if (p.mid) gans.push({ via: 'mid', stem: p.mid });      /* 寄干压末行（用户口径） */
      body += '<div class="cs-c' + (pal === 5 ? ' cs-mid' : '') + '">' +
        '<div class="cs-h"><i>' + Q.PAL_NAME[pal] + pal + '</i>' +
        '<span class="cs-z">' + zhis.join('') + '</span></div>';
      if (!zhis.length) {
        /* 中五宫不纳支：干照列，只把阶段那两列留空 */
        gans.forEach(function (g) {
          body += '<div class="cs-g">' + ganCell(g) + '<span class="cs-s none">不纳支</span></div>';
        });
      } else {
        gans.forEach(function (g) {
          body += '<div class="cs-g">' + ganCell(g) + zhis.map(function (z) {
              var zi = Q.CS_ZHI.indexOf(z);
              return '<span class="cs-s">' + Q.changSheng(g.stem, zi) + '</span>';
            }).join('') + '</div>';
        });
      }
      body += '</div>';
    });
    html += '<div class="card" style="margin:0 0 12px"><h3>本盘</h3><div class="cs-pal">' + body + '</div></div>';
    /* ② 十天干 × 十二地支完整对照表：每干一行，12 格（支 + 阶段）走 6 列网格 × 2 排 */
    var tbl = '';
    for (var st = 1; st <= 10; st++) {
      var cells = '';
      for (var z = 1; z <= 12; z++) {
        cells += '<b><i>' + Q.CS_ZHI[z] + '</i>' + Q.changSheng(st, z) + '</b>';
      }
      tbl += '<div class="row csrow"><span class="k">' + Q.STEM[st] + '</span>' +
        '<span class="v"><span class="cs-t">' + cells + '</span></span></div>';
    }
    html += '<div class="card" style="margin:0"><h3>十天干对照</h3>' + tbl + '</div>';
    /* ③ 十二阶含义（环盘）：点环上的圆点或弧段都能选中（2026-11-01 用户口径） */
    html += '<div class="card" style="margin:12px 0 0"><h3>十二阶含义</h3>' +
      '<p class="cs-note">长生位置速查：甲亥 · 乙午 · 丙寅 · 丁酉 · 戊寅 · 己酉 · 庚巳 · 辛子 · 壬申 · 癸卯（阳顺阴逆）</p>' +
      '<div id="csRingBox"></div></div>';
    openSheet(html);
    if (window.ChangSheng) ChangSheng.mount(document.getElementById('csRingBox'));
  }
  function openPalace(pal) {
    var c = state.chart, p = null;
    c.plate.forEach(function (x) { if (x.pal === pal) p = x; });
    if (!p) return;
    var all = state.analysis.byPal[pal] || [];
    var vigor = all.filter(function (x) { return x.vigor; });
    /* 十干克应从"此宫格局"里摘出来单独一节 —— 且要把两个天干摊开写。
       ⚠ **一格不一定只有一条**：转盘里天禽寄天芮，禽芮同落一宫，天盘就有两个干 ——
         天芮之干（p.heaven）一条、天禽寄干（p.mid）一条，两条都与地盘干成格（用户点名要的）。
         飞盘天禽自占一宫（p.mid 恒为 0），照旧一格一条。 */
    var kys = all.filter(function (x) { return x.kind === 'keying'; });
    var pats = all.filter(function (x) { return !x.vigor && x.kind !== 'keying'; });
    var rows = [];
    /* 行渲染（用户要"整齐"）：
       ① 值里的「（五行）」与「 · 」弱化成附注（.aux / .sep）；
       ② 值符九星 / 值使八门**不写「· 值符」后缀**，改给整值加黑（.v.duty），附注仍轻；
       ③ 干行（天盘干 / 地盘干 / 寄宫干）拆成「干（五行）」+「长生」两栏，各自定宽才对齐；
       ④ 长生按「支·阶段」包成定宽小块 —— 阶段名一字/两字不一（衰 vs 帝旺），
          不补齐就永远参差（用户点名的毛病）。
       ⚠ 先 esc 再插标签：数据都是自己生成的，但保持"先转义后拼 HTML"的习惯。 */
    function rowHTML(r) {
      var raw = r[1];
      var isGan = /^(天盘干|地盘干|寄宫干)$/.test(r[0]) && raw.indexOf(' · ') > 0;
      var v;
      if (isGan) {
        var i = raw.indexOf(' · ');
        v = '<span class="main">' + esc(raw.slice(0, i)).replace(/（[^）]*）/g, '<i class="aux">$&</i>') + '</span>' +
            '<span class="csg">' + esc(raw.slice(i + 3)).replace(/([子丑寅卯辰巳午未申酉戌亥])·([^\s\u3000<]{1,2})/g,
              '<span class="cs"><i class="zhi">$1</i><i class="dot">·</i><i class="stg">$2</i></span>') + '</span>';
      } else {
        v = esc(raw).replace(/（[^）]*）/g, '<i class="aux">$&</i>').replace(/ · /g, '<i class="sep"> · </i>');
      }
      return '<div class="row"><span class="k">' + esc(r[0]) +
        (r[3] ? '<i class="ksub">' + esc(r[3]) + '</i>' : '') + '</span><span class="v' +
        (r[2] ? ' ' + r[2] : '') + (isGan ? ' ganrow' : '') + '">' + v + '</span></div>';
    }
    /* ★ 中宫与其它宫**用同一套行**（用户报过：飞盘点中宫，弹窗信息比别的宫少一大截）。
       唯一例外：转盘（星门都不飞）时中宫本来就是空的，只写宫位与地盘干。 */
    var flyS = !!(c.fly && c.fly.star);
    var empty = !(p.star || p.deity || p.gate || p.gateMid);
    rows.push(['宫位', pal === 5
      ? '中五宫 · 中央 · 土行' + (p.star ? '' : '（转盘不落星门）')
      : Q.PAL_NAME[pal] + pal + '宫 · ' + Q.PAL_DIR[pal] + ' · ' + Q.PAL_WX[pal]]);
    /* 十二长生不再单占一行（用户要求），直接缀在各干后面。
       ★ 一宫**可能有两个天盘干**：转盘里天禽寄天芮时 p.mid = 天禽带来的中宫之干
         （qimen.js: p.mid = (homeStar === 2) ? plate[4].earth : 0），
         它与 p.heaven（禽芮之干）同为天盘性质，各判各的长生 —— 故下面一律按 via 取，
         不要按"第几条"猜；飞盘 p.mid 恒为 0，就不会有寄宫干那一行。
       ⚠ 与「旺衰」小节不是一套体系：那个按宫五行判，这个按天干 × 地支判，别合并。
       ⚠ 中五宫不纳支（csZhis 为空），三行都不缀长生 —— 那不是漏了。 */
    var csList = Q.changShengAt(pal, p);
    var csZhis = (csList[0] && csList[0].items) || [];
    function csSuffix(stemNo, via) {
      if (!stemNo || !csZhis.length) return '';
      var hit = null;
      csList.forEach(function (x) { if (x.via === via) hit = x; });
      var items = hit ? hit.items : csZhis.map(function (z) {   /* 地盘干走这条：现算 */
        return { zhiName: z.zhiName, stage: Q.changSheng(stemNo, z.zhi) };
      });
      return ' · ' + items.map(function (x) { return x.zhiName + '·' + x.stage; }).join('　');
    }
    if (!empty) {
      if (p.deity) rows.push(['八神', Q.DEITY[p.deity]]);
      /* 值符不写「· 值符」后缀 —— 那是加黑（duty）来标的，见 rowHTML 与 app.css */
      if (p.star) rows.push(['九星', Q.starLabel(p.star, flyS) + '（' + Q.STAR_WX[p.star] + '）'
        + (p.star === 5 && !flyS ? '　天禽寄此' : ''), p.dutyStar ? 'duty' : '']);
      rows.push(['八门', (Q.GATE[p.gate] || '—') + '（' + (Q.GATE_WX[p.gate] || '—') + '）'
        + (p.gateMid ? ' · 飞盘独有' : ''), p.dutyGate ? 'duty' : '']);
      rows.push(['天盘干', Q.STEM[p.heaven] + '（' + Q.STEM_WX[p.heaven] + '）' + csSuffix(p.heaven, 'heaven')]);
      /* 寄宫干＝天禽携来的第二个天盘干（如转盘天禽寄天芮那一格）。
         早先那句「（天禽所带中宫之干 · 亦天盘）」长括注会把整行挤到折行，
         标签下方的「天禽飞携」小标注也去掉了（用户要求）—— 地宫干与天盘干同列可比，够清楚。 */
      if (p.mid) rows.push(['寄宫干', Q.STEM[p.mid] + '（' + Q.STEM_WX[p.mid] + '）' + csSuffix(p.mid, 'mid')]);
    }
    rows.push(['地盘干', Q.STEM[p.earth] + '（' + Q.STEM_WX[p.earth] + '）' + csSuffix(p.earth, 'earth')]);
    var marks = [];
    if (p.kong) marks.push('空亡');
    if (p.ma) marks.push('驿马');
    rows.push(['神煞', marks.length ? marks.join(' · ') : '—']);
    /* 星曜：一颗一格（名字一行、方位角一行），一行排两三个 —— 星多也齐整，
       不像原来那样"名字＋度数＋（地平线下）"糊成一大团。地平线下的整格压暗并缀「下」。 */
    var sl = state.starMap && state.starMap.byPal[pal];
    var starBlock = '';
    if (sl && sl.length) {
      starBlock = '<div class="row slrow"><span class="k">星曜</span><span class="v"><span class="slist">'
        + sl.map(function (x) {
          return '<b class="sl-i qm-star-' + x.cls + (x.up ? '' : ' down') + '">'
            + '<i>' + esc(x.name) + '</i><em>' + x.az.toFixed(0) + '°' + (x.up ? '' : ' 下') + '</em></b>';
        }).join('') + '</span></span></div>';
    }
    var html = '<div class="bar"></div>' +
      '<h2>' + Q.PAL_NAME[pal] + '<b>' + pal + '</b>' + (pal === 5 ? '' : '宫') + '</h2>' +
      '<div class="sub">' + (pal === 5
        ? (flyMode() ? '飞盘九宫全占，中宫是实宫' : '天禽本宫，寄于坤二')
        : Q.PAL_DIR[pal] + '方 · ' + Q.PAL_WX[pal] + '行') + '</div>' +
      '<div class="card" style="margin:0 0 12px">' +
      rows.map(rowHTML).join('') + starBlock + '</div>';
    if (kys.length) html += '<div class="card" style="margin:0 0 12px"><h3>十干克应</h3>' +
      kys.map(function (k) {
        return '<div class="ky-block">' +
          '<div class="ky"><span class="tag2">' + (k.via === 'mid' ? '天禽寄干' : '天盘干') + '</span>' +
          '<i class="stems">' + esc(k.stems || '') + '</i><b class="' + k.level + '">' + esc(k.name) + '</b></div>' +
          '<div class="ky-j">' + esc(k.desc) + '</div></div>';
      }).join('') +
      (kys.length > 1 ? '<div class="ky-note">禽芮同落一宫，天盘两干（天芮之干 · 天禽寄干）各与地盘干成一格。</div>' : '') +
      '</div>';
    if (vigor.length) {
      /* 按固定次序摆：星·内 · 星·外 · 门·内 · 门·外 · 宫·外（宫对月令）。
         状态单独一列（旺/相/休/囚/死/废），说明里写清"哪两个五行、什么关系"。 */
      var order = P.VIGOR_TAGS || [];
      vigor = vigor.slice().sort(function (a, b) {
        return order.indexOf(a.tag) - order.indexOf(b.tag);
      });
      html += '<div class="card" style="margin:0 0 12px"><h3>旺衰</h3><ul class="plist vlist">' +
        vigor.map(function (x) {
          return '<li><span class="tag2">' + esc(x.tag || '') + '</span>' +
            '<span class="vst v-' + esc(x.name) + '">' + esc(x.name) + '</span>' +
            '<span class="ds">' + esc(x.desc) + '</span></li>';
        }).join('') + '</ul>' +
        '<div class="vgnote">' + esc(P.VIGOR_NOTE || '') + '</div></div>';
    }
    if (pats.length) html += '<div class="card" style="margin:0"><h3>此宫格局</h3><ul class="plist">' + patternListHTML(pats) + '</ul></div>';
    openSheet(html);
  }

  /* ---------------------------------------------------------------- 背景图 */
  /* App 背景（"透明背景"）：铺在 body 上；各层实底在 CSS 里换成半透，
     盘面自己留给"不透明度"那一档控制。 */
  function applyBackground() {
    var root = document.documentElement;         /* ★ 类挂在 html 上：head 里的抢跑脚本也能加 */
    if (S.settings.bgImage) {
      root.style.setProperty('--app-bg-img', "url('" + S.settings.bgImage + "')");
      root.classList.add('bg-custom');
    } else {
      root.style.setProperty('--app-bg-img', 'none');
      root.classList.remove('bg-custom');
    }
    var sc = Math.max(0, Math.min(90, S.settings.bgScrim == null ? 70 : S.settings.bgScrim));
    root.style.setProperty('--app-scrim', (sc / 100).toFixed(2));
    var sv = $('scrimVal'); if (sv) sv.textContent = sc + '%';
    var rs = $('rngScrim'); if (rs) rs.value = sc;
    syncBgFold();
    var st = $('bgStrip');
    if (st) {
      st.style.backgroundImage = S.settings.bgImage ? "url('" + S.settings.bgImage + "')" : '';
      st.classList.toggle('has', !!S.settings.bgImage);
    }
    var rt = $('rendStrip');
    if (rt) {
      rt.style.backgroundImage = S.settings.rendImage ? "url('" + S.settings.rendImage + "')" : '';
      rt.classList.toggle('has', !!S.settings.rendImage);
    }
    var r2 = $('rendStrip2');          /* 串星课那张 */
    if (r2) {
      r2.style.backgroundImage = S.settings.rendImageLesson ? "url('" + S.settings.rendImageLesson + "')" : '';
      r2.classList.toggle('has', !!S.settings.rendImageLesson);
    }
  }

  /* 「盘面外观」卡：默认收起，标题右侧给一句当前状态，点标题展开/收起 */
  function syncBgFold() {
    var card = $('cardBg'); if (!card) return;
    card.classList.toggle('closed', !S.settings.uiBgOpen);
    var n = (S.settings.bgImage ? 1 : 0) + (S.settings.rendImage ? 1 : 0)
      + (S.settings.rendImageLesson ? 1 : 0);
    var sum = $('bgSum');
    if (sum) {
      sum.textContent = (n ? '背景 ' + n + ' 张' : '未设背景') +
        ' · 遮罩 ' + (S.settings.bgScrim == null ? 70 : S.settings.bgScrim) + '%' +
        ' · 透明度 ' + S.settings.opacity + '%' +
        ' · 上移 ' + (S.settings.liftPct || 0) + '%';
    }
  }

  /* 当前屏幕的宽高比（App 背景要铺满竖屏，按它裁）。WebView 里 innerWidth/Height 就是屏；
     取不到就退回一个常见的手机比例。 */
  /* App 背景壁纸的比例：优先原生物理屏（含状态栏/导航栏的完整屏 = 全面屏真实比例），
     拿不到再回退视口。全面屏手机的视口不含系统栏，innerHeight 偏矮 → 比例会矮成"非全面屏"。 */
  function screenAspect() {
    try {
      if (window.Xyqimen && window.Xyqimen.screenSize) {
        var s = window.Xyqimen.screenSize();
        var m = s && /^(\d+)x(\d+)$/.exec(s);
        if (m && +m[2] > 0) return +m[1] / +m[2];
      }
    } catch (e) {}
    var w = window.innerWidth || 0, h = window.innerHeight || 0;
    if (!w || !h || h <= w) return 393 / 852;
    return w / h;
  }
  /* 壁纸比例预设（竖屏宽/高）：横屏说法 16:9 等 → 竖屏 9/16 … */
  var BG_ASPECT = { '16:9': 9 / 16, '18:9': 9 / 18, '19.5:9': 9 / 19.5, '20:9': 9 / 20, '21:9': 9 / 21 };
  function bgAspectValue() {
    var a = S.settings.bgAspect || 'auto';
    if (a === 'auto') return screenAspect();
    if (BG_ASPECT[a]) return BG_ASPECT[a];
    var v = parseFloat(a);
    return v > 0 ? v : screenAspect();
  }

  /* ---------------------------------------------------------------- 裁剪浮层
     没有外部依赖：舞台是定比例的框，图在里面 cover + translate/scale，
     完成后把可见区域那块的源矩形画进 canvas 导出。 */
  var crop = { img: null, aspect: 1, onDone: null, tx: 0, ty: 0, zoom: 1, sw: 0, sh: 0, base: 1, outW: 1000, who: '' };

  /* 裁剪界面里的壁纸比例条 —— 只在「App 背景」裁剪时显示（设置页不再放这项）。
     选中的比例存进 S.settings.bgAspect，下次进来默认沿用。 */
  var cropAspectEls = null;
  function setupCropAspects() {
    if (cropAspectEls) return;
    var seg = $('cropAspects');
    if (!seg) return;
    var input = $('cropAspectCustom'), row = $('cropAspectCustomRow');
    cropAspectEls = { btns: seg.querySelectorAll('button'), input: input, row: row };
    var apply = function (val) {
      crop.aspect = val; cropLayout();
      var outH = Math.round(crop.outW / val);
      var shp = $('cropShape');
      if (shp) shp.textContent = (crop.who ? crop.who + '　' : '') + (val >= 1 ? '横 ' : '竖 ')
        + crop.outW + ' × ' + outH + '　· 框内就是要出的那一块';
    };
    cropAspectEls.btns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.v === 'custom') {
          var cv = parseFloat(input.value) || 0.45;
          S.settings.bgAspect = String(cv);
        } else {
          S.settings.bgAspect = b.dataset.v;
        }
        S.saveSettings();
        syncCropAspects();
        apply(bgAspectValue());
      });
    });
    input.addEventListener('input', function () {
      var v = parseFloat(this.value);
      if (v > 0) { S.settings.bgAspect = String(v); S.saveSettings(); apply(v); }
    });
  }
  function syncCropAspects() {
    if (!cropAspectEls) return;
    var a = S.settings.bgAspect || 'auto';
    var isCustom = !(a === 'auto' || BG_ASPECT[a]);
    cropAspectEls.btns.forEach(function (b) { b.classList.toggle('on', isCustom ? b.dataset.v === 'custom' : b.dataset.v === a); });
    cropAspectEls.row.style.display = isCustom ? '' : 'none';
    if (isCustom) cropAspectEls.input.value = a;
  }

  function cropLayout() {
    if (!crop.img) return;
    var availW = Math.min(window.innerWidth - 24, 460);
    /* 动态扣掉顶部栏、比例条、自定义输入、底部栏 —— 加了比例条后再用写死的 200
       会把裁剪框算得比实际可用空间大，20:9 这种瘦比例直接把底部/顶部顶出屏幕。 */
    var top = document.querySelector('.crop-top');
    var ca = $('cropAspects');
    var cc = $('cropAspectCustomRow');
    var bot = document.querySelector('.crop-bottom');
    var used = (top ? top.offsetHeight : 0) + (ca ? ca.offsetHeight : 0)
      + (cc && cc.style.display !== 'none' ? cc.offsetHeight : 0)
      + (bot ? bot.offsetHeight : 0);
    var availH = window.innerHeight - used - 12;
    var sw = availW, sh = sw / crop.aspect;
    if (sh > availH) { sh = availH; sw = sh * crop.aspect; }
    crop.sw = sw; crop.sh = sh;
    var st = $('cropStage');
    st.style.width = Math.round(sw) + 'px';
    st.style.height = Math.round(sh) + 'px';
    crop.base = Math.max(sw / crop.img.naturalWidth, sh / crop.img.naturalHeight);
    cropApply();
  }
  function cropApply() {
    if (!crop.img) return;
    var im = $('cropImg'), s = crop.base * crop.zoom;
    var dw = crop.img.naturalWidth * s, dh = crop.img.naturalHeight * s;
    var mx = Math.max(0, (dw - crop.sw) / 2), my = Math.max(0, (dh - crop.sh) / 2);
    crop.tx = Math.max(-mx, Math.min(mx, crop.tx));
    crop.ty = Math.max(-my, Math.min(my, crop.ty));
    im.style.width = dw + 'px';
    im.style.height = dh + 'px';
    im.style.left = 'calc(50% + ' + crop.tx + 'px)';
    im.style.top = 'calc(50% + ' + crop.ty + 'px)';
  }
  function cropCollect() {
    if (!crop.img) return '';
    var s = crop.base * crop.zoom;
    var srcW = crop.sw / s, srcH = crop.sh / s;
    var sx = crop.img.naturalWidth / 2 - crop.tx / s - srcW / 2;
    var sy = crop.img.naturalHeight / 2 - crop.ty / s - srcH / 2;
    /* 出图。localStorage 配额有限（两张背景图要一起塞进去），
       所以编码后按体积自动降档重来 —— 宁可小一点，也不能存不下。 */
    var outW = crop.outW, outH = Math.round(outW / crop.aspect);
    var LIMIT = 900000;                         /* dataURL 字符数；保守取值，留一半给第二张 */
    var url = '';
    for (var k = 0; k < 4; k++) {
      var cv = document.createElement('canvas');
      cv.width = Math.max(2, Math.round(outW));
      cv.height = Math.max(2, Math.round(outH));
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(crop.img, sx, sy, srcW, srcH, 0, 0, cv.width, cv.height);
      try { url = cv.toDataURL('image/jpeg', 0.86 - k * 0.12); }
      catch (e) { try { url = cv.toDataURL(); } catch (e2) { return ''; } }
      if (url.length <= LIMIT) break;
      outW *= 0.72; outH *= 0.72;
    }
    return url;
  }
  function openCrop(file, aspect, title, outW, onDone, who) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        crop.img = img; crop.aspect = aspect; crop.onDone = onDone; crop.who = who;
        crop.tx = 0; crop.ty = 0; crop.zoom = 1; crop.outW = outW;
        $('cropTitle').textContent = title;
        $('cropZoom').value = 100;
        $('cropImg').src = img.src;
        var outH = Math.round(outW / aspect);
        var shp = $('cropShape');
        if (shp) {
          /* 明确写出"这是哪一种、什么形状"：三种用途三种框，别再看着都一样 */
          shp.textContent = (who ? who + '　' : '') + (aspect >= 1 ? '横 ' : '竖 ')
            + outW + ' × ' + outH + '　· 框内就是要出的那一块';
        }
        /* 壁纸比例条：只在「App 背景」裁剪时给（设置页已移除） */
        setupCropAspects();
        var ca = $('cropAspects');
        if (ca) {
          ca.style.display = (who === 'App 背景') ? '' : 'none';
          if (who === 'App 背景') syncCropAspects();
        }
        $('cropper').classList.add('on');
        cropLayout();
        pushModal($('cropper'));      /* 焦点进裁剪层；返回键 / Esc 由 closeCrop 收口 */
      };
      img.onerror = function () { toast('这张图读不出来'); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  /* 关裁剪层：清临时状态 + 摘焦点，统一走这里（取消键、完成键、返回键、Esc 都用它）。
     2026-11-10 审查项：返回键原来没接裁剪层，会出现"底页切走了、裁剪还盖着"。 */
  function closeCrop() {
    crop.img = null;
    var c = $('cropper');
    if (!c) return false;
    var was = c.classList.contains('on');
    c.classList.remove('on');
    popModal(c);
    return was;
  }

  /* ---------------------------------------------------------------- 主题 */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', S.settings.theme);
    var colors = { blue: '#080c16', slate: '#080f0d', brown: '#120c08', white: '#ffffff' };
    var col = colors[S.settings.theme] || '#ffffff';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', col);
    /* 顺手把当前底色告诉原生壳：WebView 自己的底色原来是写死的素白，
       深色主题启动时会从浅闪到深。存下来，下次启动就按这个铺底。 */
    try { if (window.Xyqimen && window.Xyqimen.setShellBg) window.Xyqimen.setShellBg(col); } catch (e) {}
  }
  function renderSwatches() {
    $('swatches').innerHTML = S.THEMES.map(function (t) {
      return '<button class="swatch sw-' + t.key + (S.settings.theme === t.key ? ' on' : '') + '" data-t="' + t.key + '">' +
        '<i></i>' + t.name + '</button>';
    }).join('');
    Array.prototype.forEach.call($('swatches').querySelectorAll('.swatch'), function (b) {
      b.addEventListener('click', function () {
        S.settings.theme = b.dataset.t;
        S.saveSettings();
        applyTheme(); renderSwatches();
        if (state.chart) renderPan();
      });
    });
  }
  function cycleTheme() {
    var keys = S.THEMES.map(function (t) { return t.key; });
    var i = keys.indexOf(S.settings.theme);
    var n = keys[(i + 1) % keys.length];
    S.settings.theme = n;
    S.saveSettings();
    applyTheme(); renderSwatches();
    if (state.chart) renderPan();
    toast('主题：' + S.THEMES[(i + 1) % keys.length].name);
  }

  /* ================================================================ 串星（小六壬·加干 / 加星）
   * 2026-11-13 整体换口径（原「奇门·加干」那套九星取星逻辑已整段删除，含「甲不上盘」）：
   *   天宫 / 地宫 / 人宫 ＝ 报数前三数**连根**数到的六神（大安·留连·速喜·赤口·小吉·空亡）
   *   第四数 ＝ 天干（1 甲 … 10 癸；0 与 10 → 癸、11 → 甲）；六亲 ＝ 六神五行 对 天干五行
   *   另有一套**九星**译法：同一组四数、同一段连根，1 天蓬 … 9 天英（不用阳顺阴逆）。
   * 口径唯一依据 校验/串星课-规则口径-20261113.md；算法全在 web/js/cx.js（window.CX），
   * 这一段只管「读数 / 落成课 / 画出来 / 记偏好」，一个数都不在这里算。
   *
   * ⚠ 四件最容易写错的事：
   *   ① **甲就是 1** —— 旧代码 `if (hs === 1) hs = c.meta.hourLead`（甲不上盘）已删除；
   *   ② 切译法**不重算四数**：同一组四数在新表里重读一遍，三宫名与六亲一起原位交叉淡变
   *      （见 setCxMode）。⚠ 六亲**会跟着变**，而且必须变 —— 六亲＝liuQin(该宫符号五行, 天干五行)，
   *      六神与九星同一宫位的五行本就不同（大安木 / 天蓬水），锁死六亲等于用错的五行去修饰对的符号。
   *      真正不变的是四数与天干；新六亲恒等于「用新表重算」的结果（口径表 §4）。
   *   ③ 时间档的四数走 CX.numsFromChart(chart)，读**这一盘的 calendar**，不拿公历重算
   *      —— 真太阳时 / 晚子时 / 闰月都在 calendar 里，重算必跟盘面对不上；
   *   ④ 空亡虽授土（与留连同色），课页上**单独一档**：只压灰、不加线（用户 2026-11-13 两轮拍板）。
   * ============================================================== */
  var CX_LB = ['天宫', '地宫', '人宫', '天干'];
  var CX_IN = ['cxN0', 'cxN1', 'cxN2', 'cxN3'];
  var CX_FIELD_RE = /^\d{1,2}$/;         /* 口径表 §8：只拦空 / 非数字 / 负数 / ≥3 位 */

  /* ---------------- 口径（六神 / 九星） ---------------- */
  /* 偏好只存在 settings.cxMode（'six' | 'star'，缺省 six）。
     **设置页里一个控件都不加**（用户 2026-11-13 硬约束）：它纯粹是存储，
     唯一入口是**起课页分段行右首那枚小勾选**：`#cxMode`（label）＋ `#cxStar`（真 checkbox）。
     课页弹层 / 盘面同显 / 导出图 / 设置页**都不许**出现切换入口（用户 2026-11-13 定）。 */
  /* 口径偏好回读：store.js 的 DEFAULTS 里没有 cxMode（那是串星页自己的键），
     而读档只搬 DEFAULTS 里有的键 —— 所以这里从存档里自己捞一次，缺省六神。
     两路都试：localStorage，以及壳子给的 lsGet（file:// 下 localStorage 可能被锁）。 */
  function cxModeRestore() {
    if (S.settings.cxMode === 'star' || S.settings.cxMode === 'six') return;
    var raw = null;
    try { if (window.localStorage) raw = localStorage.getItem('xymq.set.v1'); } catch (e) {}
    if (!raw) { try { if (window.Xyqimen && Xyqimen.lsGet) raw = Xyqimen.lsGet('xymq.set.v1'); } catch (e) {} }
    try {
      var s = raw ? JSON.parse(raw) : null;
      if (s && (s.cxMode === 'star' || s.cxMode === 'six')) S.settings.cxMode = s.cxMode;
    } catch (e) {}
  }
  cxModeRestore();

  function cxModeOf(m) { return m === 'star' ? 'star' : 'six'; }
  function cxMode() { return cxModeOf(S.settings.cxMode); }
  function cxModeName(m) { return cxModeOf(m) === 'star' ? '九星' : '六神'; }
  /* 档位：时间（默认）/ 数字 / 随机 三档（用户 2026-11-13 定稿）。
     切档**不静默带数过去** —— 数字格一直是用户自己填的那四个值；随机档每次起课现抽。 */
  var CX_TABS = ['time', 'nums', 'rand'];
  function cxTab() { return CX_TABS.indexOf(state.cxTab) >= 0 ? state.cxTab : 'time'; }
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function cxInputEl(i) { return $(CX_IN[i]); }
  function cxInputVals() {
    return CX_IN.map(function (id) { var el = $(id); return el ? String(el.value) : ''; });
  }

  /* 起课页的时刻来源：此刻 / 点大时刻选的（#cxPick）—— 与起盘页各选各的 */
  function cxParts() {
    if (state.cxTimeSrc === 'pick') {
      var v = ($('cxPick') || {}).value || '';
      var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
      if (m) return { y: Math.max(1900, Math.min(2100, +m[1])), m: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
    }
    return nowParts();
  }
  function castAt(p) {
    var fo = flyOpts();
    fo.lateZi = S.settings.lateZi;
    fo.ju = S.settings.juMethod;
    return Q.cast(p.y, p.m, p.d, p.h, p.mi, fo);
  }
  /* 「这一刻」的那张盘：起课页的四数、课页抬头的四柱、导出图都从它来 */
  function cxChart() { return castAt(solarParts(cxParts())); }

  /* 课的统一形状（课页弹层 / 盘面同显 / 导出图三处共用一份，省得口径打架）：
       { mode, modeName, nums[4], stem, ganEl, from:'time'|'nums',
         three:[{name, el, yy, qin, color, void}], zero } */
  function cxMakeLesson(r, from) {
    return {
      ok: true,
      mode: r.mode, modeName: cxModeName(r.mode),
      nums: r.nums.slice(), stem: r.stem, ganEl: r.ganEl,
      three: r.three.map(function (x) {
        return { name: x.name, el: x.el, yy: x.yy, qin: x.qin,
                 color: x.color, void: x.name === '空亡' };
      }),
      from: (from === 'time' || from === 'rand') ? from : 'nums',
      zero: r.nums.every(function (n) { return n === 0; })   /* 零课：三宫皆退一位 */
    };
  }
  /* 盘面同显 / 盘面页截图：按**盘面那一刻**算（读 chart.calendar，不另算时间）。
     只有时家盘能直译四数 —— 年/月/日家没有时干支、手动局没有农历月日、心盘根本没有
     calendar；阴盘暂时维持关闭（用户 2026-11-13 未解禁）。算不出来就返回 null，界面自会隐藏。 */
  /* 盘面同显（中宫）里的课 —— **随机取数，不跟盘面时刻走**（用户 2026-11-13 定案）。
     阴盘 2026-11-13 23:1x 用户追加：也显（角标/课与排法无关）。
     熵源就是已有的 CX.RNG（web/js/rng.js：crypto.getRandomValues + 无偏拒绝采样），
     不另造随机。每起一盘抽一次并存进 state，同一盘内反复重排（切主题、改字号、
     renderPan 重画）都拿同一组，不会闪；换一盘（下一时辰 / 重新起局）才重抽。
     两套域各抽一组（六神 1–6 / 九星 1–9），切译法不必重抽 —— 六神的数也在九星域内。
     阴盘 / 心盘 / 四层照旧不显（它们连四数都给不出，别硬凑）。 */
  function boardLesson(c) {
    /* 2026-11-13 用户：阴盘也显（角标/课与排法无关）；心盘与四层仍不显（给不出四数）。 */
    if (!c || c.xinpan || c.layer) return null;
    if (state.cxBoardRef !== c || !state.cxBoardNums) {
      state.cxBoardRef = c;
      state.cxBoardNums = {
        six: CX.randomNums('six'),
        star: CX.randomNums('star')
      };
    }
    var nums = state.cxBoardNums[cxMode()] || state.cxBoardNums.six;
    var r = CX.castByNumbers(nums, cxMode());
    return r.ok ? cxMakeLesson(r, 'rand') : null;
  }

  /* 数字档：**不预览结果**（用户 2026-11-13：「数字下面 不要写结果」）。
     这里只做一件事 —— 逐格验 1–2 位数字，非法的框染红，底部一行把话说全。
     不在格子下面写占位字，也不偷偷改用户填的字。 */
  function paintCxNums() {
    var bad = [], empty = 0;
    for (var i = 0; i < 4; i++) {
      var el = cxInputEl(i);
      if (!el) continue;
      var v = String(el.value).trim();
      var good = CX_FIELD_RE.test(v);
      if (!v) empty++;
      if (!good && v) bad.push(CX_LB[i]);
      var box = el.parentNode;
      if (box) box.classList.toggle('bad', !good && !!v);
    }
    var err = $('cxNumErr');
    if (err) {
      err.textContent = bad.length
        ? (bad.join(' / ') + ' 要填 1–2 位数字（0 也认，两位数 10–99 按循环算）')
        : '';
    }
    return { bad: bad.length > 0, empty: empty === 4 };
  }
  /* 时间档：四数只读（**只有数**） */
  function paintCxTime() {
    var box = $('cxTimeNums'); if (!box) return;
    var cells = box.children, r = state.cxTimeNums;
    for (var i = 0; i < 4; i++) {
      var b = cells[i].querySelector('b');
      if (b) b.textContent = (r && r.ok) ? String(r.nums[i]) : '—';
    }
  }
  /* 随机档：只回显**上一次起课抽到的四数**（还没抽就是「—」） */
  function paintCxRand() {
    var box = $('cxRandNums'); if (!box) return;
    var nums = state.cxRandNums;
    for (var i = 0; i < 4; i++) {
      var b = box.children[i].querySelector('b');
      if (b) b.textContent = (nums && nums[i] != null) ? String(nums[i]) : '—';
    }
    if (box.classList) box.classList.toggle('is-rand', !nums);
  }

  /* ---------------- 口径勾选（六神 / 九星） ----------------
     ★ 2026-11-13 用户定稿：**不要那枚 46×48 的大方章**，换成小的"可勾选"控件：
       视觉 18px 方框 + 两个字（六神 ☐ 九星），整枚 label 40px 高当触控区。
       走真 `input[type=checkbox]`（读屏最稳），aria 由原生语义 + aria-label 承担。
     切换**只放在起课页这一处**：课页 / 盘面同显 / 导出图 / 设置页四处都不许有入口。
     换译法不重新起课：四数照旧，只按同样的四数在新表里再读一遍（六亲随表重算）。 */
  function syncCxMode() {
    var star = cxMode() === 'star';
    var cb = $('cxStar'), lab = $('cxMode');
    if (cb) { cb.checked = star; cb.setAttribute('aria-checked', star ? 'true' : 'false'); }
    if (lab) lab.classList.toggle('star', star);
    /* 九星态那三个数的域变了（六神 1–6 / 九星 1–9，末位恒 1–10），占位提示跟着走 */
    for (var i = 0; i < 3; i++) {
      var el = cxInputEl(i);
      if (el) el.placeholder = star ? '1–9' : '1–6';
    }
    var g4 = cxInputEl(3);
    if (g4) g4.placeholder = '1–10';
  }
  function syncCxSrc() {
    var bar = $('segCxSrc'); if (!bar) return;
    var tab = cxTab();
    Array.prototype.forEach.call(bar.children, function (b) {
      b.classList.toggle('on', b.dataset.src === tab);
    });
    /* 与起盘页同一套口径：选过时刻后，「时间」那格变成「返回时」——
       状态与回到此刻的入口合成一处（点了就把时间重置为当前时刻）。
       只在时间档上改字：在数字 / 随机档时它仍是「时间」，点它是切档，不是重置。 */
    var tb = bar.querySelector('button[data-src="time"]');
    if (tb) {
      var back = state.cxTimeSrc === 'pick' && tab === 'time';
      var label = back ? '返回时' : '时间';
      if (tb.textContent !== label) tb.textContent = label;
      tb.setAttribute('aria-label', back ? '返回当前时刻' : '按所选时刻起课');
    }
    ['time', 'nums', 'rand'].forEach(function (k) {
      var pn = $('cxPanel' + k.charAt(0).toUpperCase() + k.slice(1));
      if (pn) pn.classList.toggle('on', tab === k);
    });
  }
  function setCxSrc(src) {
    var tab = CX_TABS.indexOf(src) >= 0 ? src : 'time';
    if (tab === cxTab()) return;
    state.cxTab = tab;
    state.cxBuilt = false;          /* 换档 = 换口径来源，课页里的课作废，点「起课」再算 */
    closeCxPop();
    syncCxSrc();
    renderCx();
  }
  function setCxMode(m) {
    m = cxModeOf(m);
    if (m === cxMode()) return;
    S.settings.cxMode = m;
    S.saveSettings();
    var card = document.querySelector('.cxpop-card');
    function applyAll() {
      /* 课页里若已有一课：**用同一组四数**在新表里重读一遍 ——
         四数与天干一个不动；三宫名换表；六亲按新表五行重算（必然跟着变，这才是对的） */
      var L = state.cxLesson;
      if (state.cxBuilt && L) {
        var r = CX.castByNumbers(L.nums, cxMode());
        if (r.ok) { state.cxLesson = cxMakeLesson(r, L.from); renderCxPop(); }
      }
      syncCxMode();
      paintCxNums();
      /* 盘面页开着「盘面同显」时，那段迷你课也跟着换名字（不重排，只重绘） */
      if (state.chart && S.settings.panLesson) renderMiniLesson(state.chart);
    }
    if (reduceMotion()) { applyAll(); return; }
    /* 课页开着就做一次原位交叉淡变（页面三档不显示结果，没什么可淡的） */
    if (card) card.classList.add('xfade');
    setTimeout(function () {
      applyAll();
      if (card) card.classList.remove('xfade');
    }, 150);
  }

  /* ---------------- 起课页 ---------------- */
  function renderCx() {
    if (state.cxTimeSrc !== 'pick') state.cxTimeSrc = 'now';
    var p = cxParts(), c;
    try { c = cxChart(); } catch (e) { return; }
    state.cxTimeChart = c;
    var g = c.calendar.ganzhi;
    $('cxTime').textContent = fmtParts(solarParts(p));
    $('cxPillars').textContent = g.year + ' ' + g.month + ' ' + g.day + ' ' + g.hour;
    $('cxSub').textContent = c.ju.juText + ' · 农历' + c.calendar.lunarText
      + ' · ' + g.hour + '时' + tsTag(p);
    /* 透明感应层：#cxPick 的值始终跟着当前时刻，点开选择器就停在它上面 */
    $('cxPick').value = p.y + '-' + pad(p.m) + '-' + pad(p.d) + 'T' + pad(p.h) + ':' + pad(p.mi);
    state.cxTimeNums = CX.numsFromChart(c);
    syncCxSrc();
    syncCxMode();
    paintCxTime();
    paintCxNums();
    paintCxRand();
  }

  /* 三宫 + 天干那七格的 HTML（课页弹层与「盘面同显」共用一份，省得两处口径打架）
     只有三宫名跟五行上色；天干（主体）与六亲不着色 —— 用户定的规矩。
     空亡另挂 .void（次级灰、**不加任何线**），与其余五神分开。 */
  function xcellHTML(lb, nm, sub, color, extra) {
    return '<div class="xcell ' + (extra || '') + (color ? '' : ' plain') + '"'
      + (color ? ' style="--tint:' + color + '"' : '') + '>'
      + (lb ? '<span class="lb">' + lb + '</span>' : '') + '<span class="nm">' + nm + '</span>'
      + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>';
  }
  function cxCellsHTML(L) {
    var cls = 'xkbody xgrid';
    if (!L) return { html: '', cls: cls };
    var r1 = L.three.map(function (s) {
      /* 主题色优先（--el-*）；空亡不给颜色 —— 它固定走 .void 的 --ink-3 灰、无线 */
      var tint = s.void ? '' : wxColor(s.el, s.color);
      return xcellHTML('', s.name || '—', '', tint, s.void ? 'void' : '');
    }).join('') + xcellHTML('', L.stem || '—', '', '');
    var r2 = L.three.map(function (s) {
      return xcellHTML('', s.qin || '—', '', '', 'qin');
    }).join('');
    return { html: r1 + r2, cls: cls };
  }

  /* 排法 ·「盘面同显串星课」：开着就在盘上方摆一段迷你课，九宫盘被挤下去（fitPan 会自己缩）
     ⚠ 心盘与年/月/日家不显（见 boardLesson）。 */
  function renderMiniLesson(c) {
    var box = $('xkMini'); if (!box) return;
    /* 中宫那门课＝**随机取数**（boardLesson；不跟盘面时刻走），每盘抽一次、盘内稳定。 */
    var L = (c && S.settings.panLesson) ? boardLesson(c) : null;
    var on = !!L;
    box.style.display = on ? '' : 'none';
    /* ★ 2026-11-13 用户定稿：**课放进中宫，其余一切照旧**。
       抬头带（四柱 / 元信息）、盘的尺寸与位置都不因同显而变 —— 所以这里
       不再给 .info 挂 has-lesson、不钉 --band-h、也不吃 lessonTop 偏移。 */
    var vw = document.getElementById('view-chart');
    if (vw) vw.classList.toggle('lesson-on', on);
    if (!on) { box.style.height = ''; box.style.marginTop = ''; return; }
    /* 课块搬进 .qm-text-pan：那是 position:relative 的盘容器，绝对定位后不占宫位
       （见 app.css「课放进中宫」段）。盘重排只换各宫 innerHTML，所以搬一次就一直有效。 */
    var pan = $('qm_text_pan');
    if (pan && box.parentNode !== pan) pan.appendChild(box);
    box.style.height = '';
    box.style.marginTop = '';
    var o = cxCellsHTML(L);
    var g = $('xkMiniGrid');
    g.className = o.cls;
    g.innerHTML = o.html;
  }

  /* 串星课 · 读法（弹层）：正文改用 web/js/cxhelp.js 的原文再加工稿（window.CxHelp），
     本函数只管接线 + 在九星态顶部插一行口径提示 —— **正文一个字都不改**。
     （用户 2026-11-13 追加：读法定为「方案 A 素纸分节卡」并去掉「掌诀」一节，
       那两处都在 cxhelp.js 里改，这里不用动。） */
  function openXkHelp() {
    var H = window.CxHelp;
    var body = (H && H.html) ? H.html : '';
    if (!body) { toast('读法没加载（js/cxhelp.js）'); return; }
    /* 外壳由这里自己拼（不用 CxHelp.sheet()）：九星态要在正文**之前**插一行口径提示，
       而往 cxhelp 的成品字符串里塞锚点是易碎做法 —— 它改内部结构就断。
       提示行用 app.css 里自己的类 .cxhnote（类名在自己的语料里，不依赖 cxhelp 的样式表）。 */
    var note = (cxMode() === 'star')
      ? '<p class="cxhnote"><b>九星口径</b>：同一组四数、同一段连根，三宫改读九星 —— '
        + '1 天蓬 · 2 天芮 · 3 天冲 · 4 天辅 · 5 天禽 · 6 天心 · 7 天柱 · 8 天任 · 9 天英，'
        + '不按阳顺阴逆。下面正文仍是原文的六神口径，把神名换成星名读即可。</p>'
      : '';
    openSheet('<div class="bar"></div><h2>串星<b>课 · 读法</b></h2>'
      + '<div class="sub">起课 · 天干论 · 六亲 · 实例 · 类象</div>'
      + note + body
      + '<button class="btn" style="width:100%;margin-top:12px" id="btnXkHelpOk">知道了</button>');
    /* 空值保护：万一弹层内容没落地（CxHelp 未就绪等），别让这里抛 null.addEventListener */
    var ok = $('btnXkHelpOk');
    if (ok) ok.addEventListener('click', closeSheet);
  }

  /* 时间档那粒 ⓘ：四个数是**直译**来的，不另立数法（口径表 §5）。 */
  function openCxNumsHelp() {
    openSheet('<div class="bar"></div><h2>四数<b>从哪来</b></h2>'
      + '<div class="sub">农历月 · 农历日 · 时辰序 · 时干序</div>'
      + '<p class="docp"><b>天宫数</b>＝农历月号　<b>地宫数</b>＝农历日号　'
      + '<b>人宫数</b>＝时辰序（子＝1）　<b>天干数</b>＝时干序（甲＝1 … 癸＝10）。</p>'
      + '<p class="docp">这四个数是从<b>这一刻的农历与时干支直译</b>来的，不另立一套时间数法：'
      + '换时刻，四数跟着换；闰月照月号读（闰六月就是 6）。</p>'
      + '<p class="docp">想自己改数，切到<b>数字</b>档 —— 数字档的四格与这里互不干扰，'
      + '不会把这里的数偷偷带过去；懒得填就切<b>随机</b>档，点「起课」那一刻现抽四个数、'
      + '弹层「重排」再抽一组（抽的是<b>四数</b>、不抽时刻）。</p>'
      + '<p class="docp">抽数的域跟着口径走 —— <b>六神</b>：前三数 1–6；'
      + '<b>九星</b>：前三数 1–9（不然天心 / 天柱 / 天任 / 天英永远抽不到）；末位天干两套都是 1–10。</p>'
      + '<p class="docp" style="color:var(--ink-3)">四数只决定三宫与天干：'
      + '三宫按<b>连根数起</b>（数到哪一宫，下一数从那宫重新起 1），第四数定天干，六亲再按五行生克落。</p>'
      + '<button class="btn" style="width:100%;margin-top:12px" id="btnCxNumsHelpOk">知道了</button>');
    $('btnCxNumsHelpOk').addEventListener('click', closeSheet);
  }

  /* 「起课」：按当前档位取四数 → CX 出一课 → 记进 state → 开课页弹层。
     · 时间档：读这一刻的 calendar（CX.castFromChart）
     · 数字档：读四格（CX.castByNumbers，逐格数组）
     · 随机档：这一刻现抽四数（CX.randomNums，域随口径），记进 state.cxRandNums 回显 */
  function castLesson(openPop) {
    var mode = cxMode(), r = null, from = cxTab(), c = null;
    if (from === 'nums') {
      r = CX.castByNumbers(cxInputVals(), mode);
      if (!r.ok) { toast(r.err); focusBadCxField(); return; }
    } else {
      try { c = cxChart(); } catch (e) {
        if (from === 'rand') { toast('起课失败：' + e.message); return; }
      }
      if (c) state.cxTimeChart = c;
      if (from === 'rand') {
        state.cxRandNums = CX.randomNums(mode);
        r = CX.castByNumbers(state.cxRandNums, mode);
      } else {
        if (!c) { toast('这一刻起不出课'); return; }
        r = CX.castFromChart(c, mode);
      }
      if (!r.ok) { toast(r.err); return; }
    }
    state.cxLesson = cxMakeLesson(r, from);
    state.cxBuilt = true;
    syncCxMode();
    paintCxNums();
    paintCxTime();
    paintCxRand();
    if (openPop !== false) openCxPop();
  }
  /* 起课失败时把光标落到第一个不合法的格子上（只指路，不改用户填的字） */
  function focusBadCxField() {
    for (var i = 0; i < 4; i++) {
      var el = cxInputEl(i);
      if (el && !CX_FIELD_RE.test(String(el.value).trim())) {
        try { el.focus(); } catch (e) {}
        return CX_LB[i];
      }
    }
    return '';
  }
  /* 「重排」（课页弹层里那颗，保持打开）：
     随机档 → 再抽一组；数字档 → 同一组数重起（要换数请改格）；时间档 → 按当前时刻重算 */
  function recastLesson() {
    var tab = cxTab();
    castLesson(false);
    renderCxPop();
    toast(tab === 'rand' ? '已再抽一组四数' : (tab === 'nums' ? '已按这四数重起' : '已按当前时刻重起'));
  }

  /* ---------------- 串星课弹层 ----------------
     用户：起课后**留在这一页**，用弹层展示课页，并给「返回 / 截图 / 重排」。 */
  function cxNumText(L) {
    /* 全是 1 位数就挨着写（数字档 1527）；有两位数就空开（10 5 4 8），免得看串 */
    var two = L.nums.some(function (n) { return n >= 10; });
    return L.nums.join(two ? ' ' : '');
  }
  function cxSubText(L) {
    if (!L) return '—';
    var head = L.modeName + ' · ';
    if (L.from === 'nums') {
      return head + '数字 ' + cxNumText(L) + ' · 天干 ' + L.stem
        + (L.zero ? ' · 零课：三宫皆退一位' : '');
    }
    if (L.from === 'rand') {
      return head + '随机 ' + L.nums.join(' ') + ' · 天干 ' + L.stem
        + (L.zero ? ' · 零课：三宫皆退一位' : '');
    }
    return head + '时间 ' + fmtParts(solarParts(cxParts())) + ' · 四数 ' + L.nums.join(' ')
      + ' · 天干 ' + L.stem + (L.zero ? ' · 零课：三宫皆退一位' : '');
  }
  function renderCxPop() {
    var L = state.cxLesson; if (!L) return;
    var o = cxCellsHTML(L);
    var g = $('cxPopGrid');
    g.className = o.cls;
    g.innerHTML = o.html || '<div class="cxempty">这一刻起不出课</div>';
    $('cxPopSub').textContent = cxSubText(L);
    syncCxMode();
  }
  function cxPopOpen() {
    var p = $('cxPop');
    return !!(p && p.classList.contains('on'));
  }
  function openCxPop() {
    if (!state.cxLesson) return;
    renderCxPop();
    $('cxPop').classList.add('on');
    $('cxPopMask').classList.add('on');
    pushModal($('cxPop'));
  }
  function closeCxPop() {
    var p = $('cxPop'), m = $('cxPopMask');
    if (p) p.classList.remove('on');
    if (m) m.classList.remove('on');
    if (p) popModal(p);
  }
  /* 串星课弹层里的「截图」：同一份课数据交给 Snapshot，走 renderLesson（横 1000×460） */
  function shotCxLesson() {
    var L = state.cxLesson, c = state.cxTimeChart;
    if (!state.cxBuilt || !L) { toast('先点「起课」生成串星课'); return; }
    if (!c) { try { c = state.cxTimeChart = cxChart(); } catch (e) { c = null; } }
    toast('正在生成…');
    Snap.shot(c, state.analysis, state.starMap, toast, state.face,
      { rendImage: S.settings.rendImageLesson, opacity: S.settings.opacity, lesson: L });
  }


  /* ---------------------------------------------------------------- 视图 */
  /* 底栏三项的先后顺序，页面切换的滑动方向照它算（盘面页不占底栏，单独算） */
  var VIEW_ORDER = { home: 0, chuanxing: 1, set: 2 };

  /* 滚动位置记忆（2026-11-10）：页面之间来回切、设置分类之间来回切，
     都停在原来的位置，不再一律弹回顶部。盘面页仍是每次归零（要重新量盘）。 */
  var viewScroll = { home: 0, chuanxing: 0, set: 0, chart: 0 };
  var setTabScroll = { look: 0, rule: 0, star: 0, plugin: 0 };
  function currentSetTab() {
    var t = S.settings.setTab;
    return setTabScroll.hasOwnProperty(t) ? t : 'look';
  }

  /* 底栏滑块：位置与尺寸**全取当前按钮的实测盒子**，写进 CSS 变量。
     2026-11-10 用户截图指第三格偏右：旧算法用「(内容宽-16)/3 × 序号」，
     像素取整、padding、字体加载后的细微宽度变化都会累积，越靠右越明显。
     offsetLeft / offsetTop 相对 #tabbar（它是 position:relative），正是滑块要的坐标。 */
  var tabSyncRaf = 0;
  function syncTabBar(animate) {
    var bar = $('tabbar');
    if (!bar) return;
    /* 盘面页把底栏整条藏了（display:none）：这时量不到盒子，直接退出。
       等退出盘面页时 setView 会再同步一次，不必在这里逐帧重试。 */
    if (!bar.offsetWidth) return;
    var btn = bar.querySelector('button.on');
    if (!btn) return;
    /* 按钮尚未排版：等一帧再试，别把 0 写进去 */
    if (!btn.offsetWidth) {
      cancelAnimationFrame(tabSyncRaf);
      tabSyncRaf = requestAnimationFrame(function () { syncTabBar(false); });
      return;
    }
    bar.style.setProperty('--tab-x', btn.offsetLeft + 'px');
    bar.style.setProperty('--tab-y', btn.offsetTop + 'px');
    bar.style.setProperty('--tab-w', btn.offsetWidth + 'px');
    bar.style.setProperty('--tab-h', btn.offsetHeight + 'px');
    if (animate === false) {
      /* 首帧落位 / 转屏 / 从盘面页回来：瞬时对齐，别横着飞一段 */
      bar.classList.add('tab-noanim');
      cancelAnimationFrame(tabSyncRaf);
      tabSyncRaf = requestAnimationFrame(function () {
        tabSyncRaf = requestAnimationFrame(function () { bar.classList.remove('tab-noanim'); });
      });
    }
  }

  function setView(v) {
    var prev = state.view;
    state.view = v;
    /* 方向：进盘面页算「往前」，从盘面页退回算「往后」，其余按底栏顺序比大小。
       同一页重复调用（初始化、渲染后重入）不带方向，避免无谓地闪一下。 */
    var dir = 0;
    if (v === 'chart') dir = 1;
    else if (prev === 'chart') dir = -1;
    else if (prev && prev !== v && VIEW_ORDER[prev] != null && VIEW_ORDER[v] != null) {
      dir = VIEW_ORDER[v] > VIEW_ORDER[prev] ? 1 : -1;
    }
    /* 「减少动态效果」开着时不做托板、不播动画：否则旧页会盖在新页上停 220ms */
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var prevEl = (prev && prev !== v) ? $('view-' + prev) : null;
    /* 托板要按"用户离开时看到的那个视口"对齐：先量 #scroll 的视口位置、高度和滚动量，
       再让 setView 末尾把 scrollTop 归零（否则新页会带着旧滚动位置进场）。 */
    var scrollEl = $('scroll');
    var scrollTop = scrollEl ? (scrollEl.scrollTop || 0) : 0;
    var scrollRect = scrollEl ? scrollEl.getBoundingClientRect() : null;
    /* 离开当前页之前先记下它的位置（设置页按"当前分类"分开记） */
    if (prev && prev !== v && prev !== 'chart') {
      if (prev === 'set') setTabScroll[currentSetTab()] = scrollTop;
      else viewScroll[prev] = scrollTop;
    }
    ['home', 'chart', 'set', 'chuanxing'].forEach(function (x) {
      var el = $('view-' + x);
      if (!el) return;
      clearTimeout(el._vAnimTimer);
      clearTimeout(el._vLeaveTimer);
      el.classList.remove('v-in-f', 'v-in-b', 'leaving');
      el.style.top = '';
      el.style.height = '';
      el.classList.toggle('on', x === v);
      if (x !== v || !dir || reduceMotion) return;
      /* 连续快速切换时同一个元素会重复命中：先强制一次样式重算，动画才会重新播 */
      void el.offsetWidth;
      el.classList.add(dir > 0 ? 'v-in-f' : 'v-in-b');
      el._vAnimTimer = setTimeout(function () {
        el.classList.remove('v-in-f', 'v-in-b');   /* 收干净，别让 filter/transform 留在页面上 */
      }, 480);
    });
    /* 旧页托住淡出：fixed 的临时层，不进文档流 —— 新页的版面与 fitPan 的量算都不受影响。
       top / height 照 #scroll 的视口写：主页与盘面页都靠 height:100% 做垂直布局，
       少了高度就会在淡出的 180ms 里整体上跳。 */
    if (prevEl && dir && !reduceMotion && scrollRect) {
      prevEl.classList.add('leaving');
      prevEl.style.top = Math.round(scrollRect.top - scrollTop) + 'px';
      prevEl.style.height = Math.round(scrollEl.clientHeight) + 'px';
      prevEl._vLeaveTimer = setTimeout(function () {
        prevEl.classList.remove('leaving');
        prevEl.style.top = '';
        prevEl.style.height = '';
      }, 230);   /* 比 180ms 的淡出略长一点，收尾不抢拍 */
    }
    var tabbar = $('tabbar');
    var activeTab = (v === 'chart') ? 'home' : v;
    Array.prototype.forEach.call(tabbar.children, function (b) {
      b.classList.toggle('on', b.dataset.view === activeTab);
    });
    var full = (v === 'chart');
    /* 顶栏按页给键：切盘（‹ ›）只在盘面页有 —— 主页/设置页上它们没有意义，
       还会把 ◐ 从右边挤开。h1 是 flex:1，隐掉之后剩下的键自然贴右侧边。 */
    $('btnBack').style.display = full ? '' : 'none';
    $('btnShot').style.display = full ? '' : 'none';
    $('btnPrev').style.display = full ? '' : 'none';
    $('btnNext').style.display = full ? '' : 'none';
    /* 设置页最右上让给「关于」：点一下弹说明。主题在「外观」里本来就有四格色板，
       不必再占顶栏一格 —— 所以 ◐ 只在非设置页出现。 */
    $('btnAbout').style.display = (v === 'set') ? '' : 'none';
    $('btnTheme').style.display = (v === 'set') ? 'none' : '';
    /* 盘面页把底栏整条收掉：那 56px 全给盘面。回去用左上角 ←。 */
    $('tabbar').style.display = full ? 'none' : '';
    /* 滑块定位要在底栏重新显示之后做：display:none 时量不到盒子。
       从盘面页回来（上一页是 chart）不做滑动动画，直接落位。 */
    syncTabBar(prev !== 'chart');
    if (!full) {
      var tb = $('tbTitle');
      tb.innerHTML = '星曜<b>奇门</b>';
      tb.classList.remove('tappable');
      tb.onclick = null;
    }
    if (v === 'home') renderHome();
    if (v === 'chuanxing') renderCx();
    else closeCxPop();                    /* 离开串星页就把课页弹层一起收掉，别带状态回来 */
    /* 进盘面页量一次：在设置里改了「盘面同显串星课」这类会影响盘高的开关时，
       recastQuiet() 那次 renderChart 是在**隐藏状态**下跑的（fitPan 会早退、量不到），
       所以这里等一帧再自适应一次 —— 盘的位置/大小永远跟当前版面一致。 */
    if (v === 'chart') requestAnimationFrame(fitPan);
    if (!full) {
      var dp = $('qdrop'), bm = $('btnMore');
      if (dp) dp.classList.remove('on');
      if (bm) bm.classList.remove('open');
    }
    /* 回到这一页上次的位置（盘面页例外：每次归零后重排） */
    if (scrollEl) {
      if (v === 'chart') scrollEl.scrollTop = 0;
      else if (v === 'set') scrollEl.scrollTop = setTabScroll[currentSetTab()] || 0;
      else scrollEl.scrollTop = viewScroll[v] || 0;
    }
  }

  /* --------------------------------------------------------- 开源声明（2026-11-13） */
  /* 用户：「有没有一些内容，其实不需要声明，因为就算让你重新写，写出来的也是那么一个东西。」
     于是按「要不要声明」分成两档（判定说明见 web/licenses/THIRD-PARTY.md）：
       ① **必须声明**：字体 QM Serif（Noto Serif CJK SC 子集）· SIL OFL 1.1
          —— 我们分发的是字体文件本身，OFL 要求随附许可证，给全文、可点开看；
       ② **数据与规则参照**：iztro · MIT ／ qimen-dunjia · MIT ／ bigfishmarquis-qimen · MIT
          —— 事实性数据（十干四化、客应歌诀）与规则口径对齐，没复制代码，
          只列名字与许可名，**不给全文**；
       另：cities.js / lunar.js 参照的是同作者的 mQimen，不算第三方。
     其余模块全自研。字体全文由 web/licenses/licenses.js 内联成 window.LICENSES.ofl
     （file:// 下 fetch 读 .txt 会被部分 WebView 拒）。 */
  function licText(key) {
    var L = window.LICENSES;
    return (L && L[key]) || '';
  }
  /** 二级弹层：把 window.LICENSES[key] 的全文铺出来（纯文本、可滚动） */
  function openLicense(key) {
    var txt = licText(key);
    var named = (window.LICENSES && window.LICENSES.title && window.LICENSES.title[key]) || key;
    if (!txt) { toast('许可全文没加载（web/licenses/licenses.js）'); return; }
    openSheet('<div class="bar"></div><h2>许可<b>全文</b></h2>'
      + '<div class="sub">' + esc(named) + '</div>'
      + '<div class="card" style="margin:0;padding:12px 13px">'
      + '<div style="white-space:pre-wrap;word-break:break-word;max-height:58vh;overflow:auto;'
      + 'font-size:11px;line-height:1.65;color:var(--ink-2);'
      + 'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">'
      + esc(txt) + '</div></div>'
      + '<button class="btn" style="width:100%;margin-top:12px" id="btnLicOk">知道了</button>');
    var ok = $('btnLicOk');
    if (ok) ok.addEventListener('click', closeSheet);
  }
  /* 关于卡里的「许可全文」小键：inline 样式，不新增 CSS 类（本轮只动 ui.js） */
  var LIC_BTN = 'style="border:0;background:none;padding:0 0 0 6px;font-size:11.5px;'
    + 'color:var(--accent);text-decoration:underline;text-underline-offset:2px;'
    + '-webkit-tap-highlight-color:transparent"';
  function licBtn(key, label) {
    return '<button type="button" data-lic="' + key + '" ' + LIC_BTN + '>'
      + (label || '许可全文') + '</button>';
  }

  /* -------------------------------------------------- 主页模式与控件同步 */
  /* 四柱标签：时家四柱全给；三层只给本层那一柱，其余留白 */
  function syncLayerHead() {
    var lb = $('plabel');
    if (!lb) return;
    /* ★ 跟着**盘**走，不是跟着当前选择走 —— 切了层级但还没重新起盘时，
       画面上摆着的是上一张盘，标签就必须跟那张盘一致，否则标签与盘对不上。 */
    var lay;
    /* 手动起局只认识时柱。⚠ 但**阴盘/心盘也是合成盘**（引擎里借 manual:true 渲染）——
       它们照样有完整的年月日时四柱，不能跟着塌成只剩「时」
       （2026-10-07：共存版默认阴盘，探针一眼就看到抬头只剩个「时」）。 */
    if (state.chart && state.chart.manual && state.chartSub !== 'yin' && state.chartSub !== 'xin') lay = 'manual';
    else if (state.chart && state.chart.layer) lay = state.chart.layer;
    else if (state.chart) lay = 'shi';
    else lay = state.layer;
    var names = ['年', '月', '日', '时'];
    var keep = { shi: [0,1,2,3], manual: [3], nian: [0], yue: [1], ri: [2] }[lay] || [0,1,2,3];
    lb.innerHTML = names.map(function (n, i) { return '<span>' + (keep.indexOf(i) >= 0 ? n : '') + '</span>'; }).join('');
  }
  /* ------------------------------------------- 日月年家起盘（2026-11-02 改成插件）
     用户判断这三层「理致有待考究」，原先藏在设置里、默认关。
     现在整件事交给插件：web/plugins/layers.js 带 `flags.layers` 能力标志，
     设置 → 插件 里打开「日月年家」= 允许四层；关掉 = 起盘页连那排切换都不出现，只留时家。
     宿主只认**能力标志**（Plugins.flagOn），不写死插件名 —— 以后别的插件也能借这个标志。 */
  function applyLayers() {
    var on = !!Plugins.flagOn('layers');
    var seg = $('segLayer'); if (seg) seg.style.display = on ? '' : 'none';
    if (!on && state.layer !== 'shi') state.layer = 'shi';   /* 关了就把层收回时家 */
    syncLayer();
    renderHome();
    /* 盘上正摆着一张三层盘的话，悄悄重排回时家（不切页、不动滚动） */
    if (!on && state.chart && state.chart.layer) recastQuiet();
  }

  function syncLayer() {
    Array.prototype.forEach.call($('segLayer').children, function (b) {
      b.classList.toggle('on', b.dataset.l === state.layer);
    });
    var isShi = state.layer === 'shi';
    /* ⚠ 面板只切 .on（opacity + visibility），**不碰 display**。
       这些面板在 .mpstage 里叠成同一格，display:none 会让它退出 grid、
       行高跟着塌，换层/换起局方式时页面就会上下蹭 —— 那正是用户看到的「撑开」。
       #segMode3 可以继续用 display 切换：它那一行的高度在 CSS 里钉死 54px。 */
    $('mp-layer').classList.toggle('on', !isShi);
    $('segMode3').style.display = isShi ? '' : 'none';
    if (isShi) {
      syncMode();
    } else {
      /* 四层：四种模式面板全部收掉（原来只藏了三种，心盘会残留在页面上） */
      ['mp-time', 'mp-manual', 'mp-random', 'mp-xin'].forEach(function (id) {
        var el = $(id); if (el) el.classList.remove('on');
      });
    }
    var note = {
      nian: '年家奇门：180 年一元（三元九运），1864 甲子年为上元起点，<b>统一阴遁</b>。局数 上元1 / 中元4 / 下元7。<br>年份按<b>立春</b>换年，时间从上面的「日期 + 时刻」换算。',
      yue: '月家奇门：60 甲子每 5 年一块，局＝(7＋块×3) mod 9，<b>统一阴遁</b>。月份用<b>节气月</b>（正月＝寅月），由上面的日期换算。',
      ri: '日家奇门：二至定阴阳（冬至后阳遁、夏至后阴遁），按 60 天周期取局。<br>日期由上面的「日期 + 时刻」换算；开了真太阳时按地方日界。'
    }[state.layer];
    if (note) $('layerNote').innerHTML = note;
    syncLayerHead();
  }

  function syncMode() {
    Array.prototype.forEach.call($('segMode3').children, function (b) {
      b.classList.toggle('on', b.dataset.m === state.mode);
    });
    /* 切到别的模式时，第一格要恢复成「此时刻」 */
    syncTimeSeg();
    var isShi = state.layer === 'shi';
    /* 同上：只切 .on，不切 display，容器高度才不跟着涨落 */
    ['time', 'manual', 'random', 'xin'].forEach(function (k) {
      var el = $('mp-' + k);
      if (el) el.classList.toggle('on', isShi && state.mode === k);
    });
    syncModeGate();
  }

  /* 参数面板右上角的小「?」：所有说明（含日/月/年家的换算）都收到这里。
     说明本体留在 DOM 里、用 .srconly 隐藏，点开时取 innerHTML 走底部弹层 ——
     弹层是 fixed，不占布局，所以说明再长也不会把任何样件撑开。 */
  var MODE_HELP = {
    time: '<b>此时刻</b>：以上方「日期 + 时刻」为准，按当前节气与四柱起盘。点大时刻可改时间。'
      + '<br>定局法（设置 → 定局）选「阴盘」时，这一档按道家阴盘的数字定局起（另出暗干）。',
    manual: '<b>自选局</b>：先选遁（阳遁 / 阴遁）、局数（一 ~ 九）与时干支，再按「起盘」；不取上方时刻。'
      + '<br>自选局是直接指定局数，定局法（拆补 / 置闰 / 阴盘）对它无效。'
  };
  function openModeHelp() {
    var layerName = { ri: '日家', yue: '月家', nian: '年家' }[state.layer];
    var title, body;
    if (layerName) {
      title = layerName + '<b>换算</b>';
      body = $('layerNote').innerHTML;
    } else {
      var key = state.mode || 'time';
      title = ({ time: '此时刻', manual: '自选局', random: '随机', xin: '心盘' }[key] || '起局') + '<b>说明</b>';
      var el = $('mp-' + key);
      var note = el && el.querySelector('.rnote');
      body = (note && note.innerHTML) || MODE_HELP[key] || '';
    }
    if (!body) body = '这一档没有额外参数，选好上方时刻后直接按「起盘」。';
    openSheet('<div class="bar"></div><h2>' + title + '</h2>'
      + '<p class="rnote" style="margin-top:10px;font-size:13px">' + body + '</p>');
  }
  /* 时刻相关控件没了「此刻 / 选时刻」分段，这里只需在起盘/切盘后把输入框的值对齐 */
  function syncNowPick() { setPickInput(standardParts()); }
  function syncManual() {
    Array.prototype.forEach.call($('segYinYang').children, function (b) {
      b.classList.toggle('on', +b.dataset.v === state.manual.polarity);
    });
    Array.prototype.forEach.call($('juGrid').children, function (b) {
      b.classList.toggle('on', +b.dataset.ju === state.manual.cycle);
    });
    $('selHour').value = state.manual.hourIdx;
  }

  /* -------------------------------------------------------------- 初始化 */
  /* ------------------------------------------------------------ 初始化
     2026-10-21 拆分第 2 步：原先 init() 一个函数 743 行，四个页面的绑定全挤在一起。
     现在按页面拆成 initCommon / initHome / initCx / initPan / initSet / initFinish，
     init() 只按顺序调用 —— 改哪一页就只看对应的那个 initXxx()。 */

  /** 全局：主题 / 背景 / 时刻输入 / 顶栏公共键 / 底栏 */
  function initCommon() {
    applyTheme();
    applyBackground();
    renderSwatches();
    setPickInput(nowParts());

    /* 顶栏 */
    $('btnBack').addEventListener('click', function () { goBack(); });
    $('btnTheme').addEventListener('click', cycleTheme);
    $('btnAbout').addEventListener('click', function () {
      openSheet('<div class="bar"></div><h2>关于<b>星曜奇门</b></h2>'
        /* ★ 版本号：这一行**由打包脚本自动同步**（build_xingyao.py 会按 VER 替换
           `版本 1.1.NN`），所以不用每次手动改 —— 但写法别动，
           改了写法门禁会报"找不到可替换的版本串"（2026-10-07 用户报过：包到 1.1.23 了、
           关于里还写着 1.1.10）。 */
        + '<div class="sub">版本 1.1.25</div>'
        + '<div class="card" style="margin:0"><div class="fhint">'
        + '<b>精度与边界</b><br>'
        + '· 节气：VSOP87 + ΔT，2024 年 24 节气平均差 21 秒、最大 48 秒（立冬）；<br>'
        + '· 农历/朔望：朔望月现场推算，2023–2026 春节、中秋、端午与公认历表一致；<br>'
        + '· 四柱：按北京时间，时刻精确到分钟；晚子时换日可开关；<br>'
        + '· 失效边界：ΔT 适用 1600–2150，界面年份 1900–2100；交节、子夜、立春前后 1 分钟内的盘请人工复核。'
        + '</div></div>'
        /* ★ 2026-11-13 用户定：开源声明**只保留必要的一条** —— 字体。
             其余（iztro / qimen-dunjia / bigfishmarquis-qimen / mQimen / 自研清单）全删：
             它们或属事实性数据、或只是规则口径对齐，不构成随副本分发许可的义务。
             四条的**判定说明**仍留在 web/licenses/THIRD-PARTY.md（书面凭据，不进 UI）。 */
        + '<div class="card" style="margin:12px 0 0"><div class="fhint">'
        + '<b>开源声明</b><br>'
        + '字体 <b>QM Serif</b>（Noto Serif CJK SC 子集）· <b>SIL OFL 1.1</b>'
        + licBtn('ofl')
        + '</div></div>'
        + '<div class="sub" style="margin-top:12px">本应用 © 2026 魔门 · MIT</div>');
    });

    /* 关于 →「许可全文」：委托在 #sheet 上（弹层内容每次 openSheet 会换，外层元素不变） */
    $('sheet').addEventListener('click', function (e) {
      var b = e.target.closest('[data-lic]');
      if (!b) return;
      openLicense(b.getAttribute('data-lic'));
    });

    /* 底栏 / 弹层 */
    $('tabbar').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (b) setView(b.dataset.view);
    });
    /* 滑块是按实测盒子定位的：窗口尺寸一变、字体晚到一档，盒子就会变，必须重算。
       这两种情况都不该播横移动画，直接瞬时对齐。 */
    window.addEventListener('resize', function () { syncTabBar(false); });
    window.addEventListener('orientationchange', function () { setTimeout(function () { syncTabBar(false); }, 120); });
    try {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { syncTabBar(false); }, function () {});
      }
    } catch (e) { /* 老 WebView 没有 FontFaceSet，忽略 */ }
    $('mask').addEventListener('click', closeSheet);

  }

  /** 起盘页：四层、起局方式、时间卡、自选局、随机、起盘 */
  function initHome() {

    /* 四层：时间统一走上面那张「日期 + 时刻」样件，这里只挂层级切换。
       ⚠ 2026-11-02 起四层是插件（设置 → 插件 → 日月年家，flags.layers）；
          没开插件时整条 #segLayer 是 display:none，点不到这里。 */
    $('segLayer').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      /* 心盘只属于时家：从它切四层时先回「此时刻」，否则 syncModeGate 会把层拉回时家 */
      if (b.dataset.l !== 'shi' && state.mode === 'xin') {
        state.mode = 'time'; syncMode();
        toast('心盘只排时家，已切回「此时刻」');
      }
      state.layer = b.dataset.l;
      syncLayer();
      renderHome();
    });
    syncLayer();
    applyLayers();

    syncModeGate();


    /* 起局方式：按时刻 / 自选局 / 随机 / 心盘（阴盘已升级为定局法，见设置 → 定局） */
    $('segMode3').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      state.mode = b.dataset.m;
      if (state.mode === 'time') { S.settings.mode = 'now'; S.saveSettings(); setPickInput(nowParts()); }
      if (state.mode === 'xin') state.layer = 'shi';   /* 心盘只在时家 */
      syncMode(); renderHome();
    });

    /* 参数面板右上角的小「?」：说明统一从这里看（含日/月/年家换算）。
       委托到 .modewrap，点完不冒泡，避免和上面的分段/面板事件串味。 */
    $('modewrap').addEventListener('click', function (e) {
      var b = e.target.closest('.mhelp'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      openModeHelp();
    });

    /* 点「大时刻」改时间（选择器由 openTimePicker 显式打开，不再靠透明 input 接点击） */
    $('timecard').addEventListener('click', function () { openTimePicker($('dtPick')); });
    /* 「返回时」复用第一格分段：点它本来就会把时间重置为当前时刻（见 segMode3 的 click），
       所以这里不再单独挂按钮。 */
    $('dtPick').addEventListener('change', function () {
      S.settings.mode = 'pick'; S.saveSettings();
      renderHome();
    });



    /* 自选局：遁 / 局数 / 时干支 */
    $('juGrid').innerHTML = [1,2,3,4,5,6,7,8,9].map(function (n) {
      return '<button data-ju="' + n + '">' + JU_CN[n] + '</button>';
    }).join('');
    (function () {
      var o = '';
      for (var n = 0; n < 60; n++) o += '<option value="' + n + '">' + GAN10[n % 10] + Lunar.ZHI[n % 12] + '时</option>';
      $('selHour').innerHTML = o;
    })();
    $('segYinYang').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.manual.polarity = +b.dataset.v; syncManual(); renderHome();
    });
    $('juGrid').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.manual.cycle = +b.dataset.ju; syncManual(); renderHome();
    });
    $('selHour').addEventListener('change', function () {
      state.manual.hourIdx = +this.value; renderHome();
    });
    syncManual();

    /* 随机：两个按钮只选类型，点「起盘」时才抽（2026-10-21 用户定的时机） */
    $('btnRandTime').addEventListener('click', function () { setRandKind('time'); });
    $('btnRandJu').addEventListener('click', function () { setRandKind('ju'); });
    $('btnRandTime').classList.toggle('on', state.randKind === 'time');
    $('btnRandJu').classList.toggle('on', state.randKind === 'ju');

    $('btnCast').addEventListener('click', onCast);
  }

  /** 串星页：起课、侧边截图、读法、此刻/随机、选时刻 */
  function initCx() {

    /* 串星：起课页的控件与「起课」按钮（函数体在模块层，见上面的串星段） */
    state.cxTab = cxTab();                 /* 'time'（默认）| 'nums' */
    if (state.cxTimeSrc !== 'pick') state.cxTimeSrc = 'now';
    $('btnCastX').addEventListener('click', function () { castLesson(); });
    /* 课页弹层：返回 / 截图 / 重排 / 点遮罩关
       ★ 2026-10-21：起课页的课卡去掉后，截图入口从右侧边签挪进弹层。 */
    $('cxPopBack').addEventListener('click', closeCxPop);
    $('cxPopMask').addEventListener('click', closeCxPop);
    $('cxPopShot').addEventListener('click', shotCxLesson);
    $('cxPopAgain').addEventListener('click', recastLesson);
    /* 「读法」：入口在课页弹窗标题右侧（2026-11-02 排查项 8） */
    $('cxPopHelp').addEventListener('click', openXkHelp);
    /* 口径勾选（六神 ☐ 九星）：**只有起课页这一处**。
       换的是三宫的名字与随之重算的六亲；四数与天干一个不动。
       ⚠ 它不在设置页出现、也不进分段；课页 / 同显 / 导出图里都不许有 —— 用户 2026-11-13 的硬约束。 */
    $('cxStar').addEventListener('change', function () {
      setCxMode(this.checked ? 'star' : 'six');
    });
    /* 档位：时间 / 数字 / 随机（时间在前且默认） */
    $('segCxSrc').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      /* 「返回时」：时间档上点这一格＝回到此刻，不是切档 */
      if (b.dataset.src === 'time' && state.cxTimeSrc === 'pick' && cxTab() === 'time') {
        state.cxTimeSrc = 'now';
        state.cxBuilt = false;
        closeCxPop();
        syncCxSrc();
        renderCx();
        toast('已回到此刻');
        return;
      }
      setCxSrc(b.dataset.src);
    });
    /* 数字档四格：只验不预览（标红 + 底部一行提示，不改用户填的字） */
    CX_IN.forEach(function (id) {
      var el = $(id); if (!el) return;
      el.addEventListener('input', function () { paintCxNums(); });
      el.addEventListener('change', function () { paintCxNums(); });
    });
    $('cxTimeHelp').addEventListener('click', openCxNumsHelp);
    /* 串星页「点大时刻」同理：点击 → 显式打开原生选择器 */
    var cxTimecard = $('cxTimecard') || document.querySelector('#view-chuanxing .timecard');
    if (cxTimecard) cxTimecard.addEventListener('click', function () { openTimePicker($('cxPick')); });
    $('cxPick').addEventListener('change', function () {
      state.cxTimeSrc = 'pick';   /* 点了时间就不再是"此刻" */
      state.cxBuilt = false;      /* 换时刻 → 课作废，点「起课」再算 */
      closeCxPop();
      renderCx();
    });
  }

  /** 盘面页：截图、折叠把手、上下翻、尺寸变化 */
  function initPan() {
    $('btnShot').addEventListener('click', function () {
      if (!state.chart) return;
      toast('正在生成…');
      /* ★ 截图要跟屏幕同源：渲染背景 + 盘面不透明度 一并带下去 */
      /* 盘面同显 —— 屏幕上课与盘同框，出图也得同框（形状仍按奇门盘 1000×1370）。
         盘面同显只在时家盘上有意义（阴盘/心盘不走串星课那套）。 */
      /* 2026-11-13：阴盘也出同显图（心盘仍不显） */
      var isBoth = !!S.settings.panLesson && state.chartSub !== 'xin';
      var so = { rendImage: S.settings.rendImage, opacity: S.settings.opacity };
      if (isBoth) {
        /* 课与屏幕同源：走 boardLesson（**随机取数**，不用盘面时刻），
           与中宫里显示的是同一组数据；算不出来就不带 lesson，出图仍是一张盘。 */
        var Lm = boardLesson(state.chart);
        if (Lm) { so.both = true; so.lesson = Lm; }
      }
      Snap.shot(state.chart, state.analysis, state.starMap, toast, state.face, so);
    });
    /* 折叠把手：旬空正下方那条短线 */
    $('btnMore').addEventListener('click', function () {
      var on = $('qdrop').classList.toggle('on');
      this.classList.toggle('open', on);
    });
    $('btnPrev').addEventListener('click', function () {
      if (state.view === 'chart' && state.chartSub === 'xin') return;
      shiftChart(-1);
    });
    $('btnNext').addEventListener('click', function () {
      if (state.view === 'chart' && state.chartSub === 'xin') return;
      shiftChart(1);
    });
    window.addEventListener('resize', function () { requestAnimationFrame(fitPan); });
    window.addEventListener('orientationchange', function () { setTimeout(fitPan, 250); });
  }

  /** 设置页：外观 / 排法 / 星曜 / 城市定位（最大的一块） */
  function initSet() {

    /* 设置：晚子时 / 透明度 / 星曜 */
    Array.prototype.forEach.call($('segLate').children, function (b) {
      b.classList.toggle('on', (b.dataset.v === '1') === !!S.settings.lateZi);
    });
    $('segLate').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.settings.lateZi = b.dataset.v === '1'; S.saveSettings();
      Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); });
      renderHome();
      /* 悄悄重排，别切页 —— 切页会把设置页的滚动位置清零（见 recastQuiet 注释） */
      if (state.chart && !state.chart.manual) recastQuiet();
    });
    $('rngOp').value = S.settings.opacity;
    $('opVal').textContent = S.settings.opacity + '%';
    /* ---- 两张背景图 + 裁剪 ---- */
    applyBackground();
    $('btnBgPick').addEventListener('click', function () { $('bgFile').click(); });
    /* 壁纸比例挪到裁剪界面（#cropAspects）去了，这里不再挂设置项 */
    /* 截图渲染背景：先问"给哪一种截图配底图"，再进裁剪 —— 两种出图比例不同，
       裁剪框必须跟着变形，否则盘（竖 1000×1370）与课（横 1000×460）用同一张底图必然裁错。 */
    var REND_ASP = { pan: 1000 / 1370, lesson: 1000 / 460 };
    state.rendTarget = 'pan';
    $('btnRendPick').addEventListener('click', function () {
      /* 两个选项各配一个**按出图比例画的示意框**（竖的是盘、横的是课） */
      openSheet('<div class="bar"></div><h2>截图<b>渲染背景</b></h2>'
        + '<div class="sub">给哪一种截图配底图？裁剪框会按它自己的比例</div>'
        + '<div class="rendpick">'
        + '<div class="rp pan" id="rendForPan"><em></em><b>奇门盘</b><i>竖 1000 × 1370</i></div>'
        + '<div class="rp lesson" id="rendForLesson"><em></em><b>串星课</b><i>横 1000 × 460</i></div>'
        + '</div>');
      $('rendForPan').addEventListener('click', function () {
        state.rendTarget = 'pan'; closeSheet(); $('rendFile').click();
      });
      $('rendForLesson').addEventListener('click', function () {
        state.rendTarget = 'lesson'; closeSheet(); $('rendFile').click();
      });
    });
    $('bgFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; this.value = '';
      if (!f) return;
      /* App 背景按壁纸比例裁（默认＝物理屏全面屏，可手动选 16:9…或自定义） */
      var asp = bgAspectValue();
      openCrop(f, asp, '裁剪 App 背景', 1080, function (url) {
        if (!url) { toast('这张图处理不了，换一张试试'); return; }
        S.settings.bgImage = url;
        var ok = S.saveSettings();
        applyBackground();
        toast(ok ? 'App 背景已设' : '图太大没存住 —— 换张小一点的图');
        if (!ok) { S.settings.bgImage = ''; S.saveSettings(); applyBackground(); }
      }, 'App 背景');
    });
    $('rendFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; this.value = '';
      if (!f) return;
      var tgt = state.rendTarget === 'lesson' ? 'lesson' : 'pan';
      var key = tgt === 'lesson' ? 'rendImageLesson' : 'rendImage';
      var who = tgt === 'lesson' ? '串星课' : '奇门盘';
      openCrop(f, REND_ASP[tgt], '裁剪' + who + '底图', 1000, function (url) {
        if (!url) { toast('这张图处理不了，换一张试试'); return; }
        S.settings[key] = url;
        var ok2 = S.saveSettings();
        applyBackground();
        toast(ok2 ? who + '底图已设' : '图太大没存住 —— 换张小一点的图');
        if (!ok2) { S.settings[key] = ''; S.saveSettings(); applyBackground(); }
      }, who + '底图');
    });
    $('rngScrim').addEventListener('input', function () {
      S.settings.bgScrim = +this.value; S.saveSettings(); applyBackground();
    });
    /* 「背景」那一组现在是常显的（折叠交给顶部分段去做了），这里只留摘要同步。
       ⚠ 原来是 `card.querySelector('h3').addEventListener` —— 新排版里 `#cardBg` 已经没有 h3 了，
         不加判断会直接抛错、把后面所有设置项的事件都带崩。 */
    (function () {
      var card = $('cardBg'); if (!card) return;
      var h = card.querySelector('h3');
      if (h) h.addEventListener('click', function () {
        S.settings.uiBgOpen = !S.settings.uiBgOpen;
        S.saveSettings();
        syncBgFold();
      });
      syncBgFold();
    })();

    /* ---- 设置页顶部分段（方案 B）：一屏只看一类 ---- */
    var SET_TABS = ['look', 'rule', 'star', 'plugin'];
    function applySetTab() {
      var t = SET_TABS.indexOf(S.settings.setTab) >= 0 ? S.settings.setTab : 'look';
      Array.prototype.forEach.call($('setChips').children, function (b) {
        b.classList.toggle('on', b.dataset.g === t);
      });
      Array.prototype.forEach.call($('view-set').querySelectorAll('.setgroup'), function (g) {
        g.classList.toggle('on', g.dataset.g === t);
      });
    }
    $('setChips').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (S.settings.setTab === b.dataset.g) return;
      /* 切换分类：先记住当前分类看到哪，再恢复目标分类上次的位置 */
      var sc = $('scroll');
      if (sc) setTabScroll[currentSetTab()] = sc.scrollTop;
      S.settings.setTab = b.dataset.g; S.saveSettings();
      applySetTab();
      if (sc) sc.scrollTop = setTabScroll[currentSetTab()] || 0;
    });
    applySetTab();
    $('btnBgClear').addEventListener('click', function () {
      S.settings.bgImage = ''; S.saveSettings(); applyBackground(); toast('App 背景已清除');
    });
    $('btnRendClear').addEventListener('click', function () {
      S.settings.rendImage = ''; S.settings.rendImageLesson = '';
      S.saveSettings(); applyBackground(); toast('截图背景已清除（奇门盘 / 串星课 两张）');
    });
    /* 裁剪浮层：拖动 + 滑块 + 双指 */
    (function () {
      var st = $('cropStage'), drag = null;
      function pos(e) { var t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; }
      function down(e) { if (e.touches && e.touches.length > 1) return; drag = pos(e); }
      function move(e) {
        if (!drag) return;
        if (e.touches && e.touches.length === 2) {
          var a = e.touches[0], b2 = e.touches[1];
          var d = Math.hypot(a.clientX - b2.clientX, a.clientY - b2.clientY);
          if (crop.pinch) { crop.zoom = Math.max(1, Math.min(3.2, crop.zoom * d / crop.pinch)); $('cropZoom').value = Math.round(crop.zoom * 100); }
          crop.pinch = d; cropApply(); e.preventDefault(); return;
        }
        var p = pos(e);
        crop.tx += p.x - drag.x; crop.ty += p.y - drag.y;
        drag = p; cropApply();
        if (e.cancelable) e.preventDefault();
      }
      function up() { drag = null; crop.pinch = 0; }
      st.addEventListener('touchstart', down, { passive: true });
      st.addEventListener('touchmove', move, { passive: false });
      st.addEventListener('touchend', up); st.addEventListener('touchcancel', up);
      st.addEventListener('mousedown', down);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      $('cropZoom').addEventListener('input', function () { crop.zoom = +this.value / 100; cropApply(); });
      $('cropCancel').addEventListener('click', function () { closeCrop(); });
      $('cropOk').addEventListener('click', function () {
        if (!crop.img) { closeCrop(); return; }   /* 没图就别硬出图 */
        var url = cropCollect();
        /* 导出空结果（画布被污染 / 尺寸为 0）原来会静默关层，用户以为"没反应"。
           现在留在裁剪层、保留当前取景，说明原因并允许重试；只有真拿到图才关。 */
        if (!url) { toast('这张图没能导出，换一张或重试'); return; }
        var done = crop.onDone;
        closeCrop();
        if (done) done(url);
      });
      window.addEventListener('resize', function () { if ($('cropper').classList.contains('on')) cropLayout(); });
    })();

    /* ================= 盘式 =================
       一个主开关（转盘 / 飞盘），下面是**随主开关变化**的子设置：
         转盘 → 九星·八门·八神分项微调（其实转盘侧没什么可调，给个说明）
         飞盘 → 星门飞法 · 八神飞法（星门顺飞 / 八神阳顺阴逆 = 主流），八神名
       三个分量仍可各自设（星转门飞这种混盘）—— 藏在折叠的「分项微调」里。 */
    var PAN_KEYS = ['flyStar', 'flyGate', 'flyGod'];
    function panMode() {                          /* 'zhuan' | 'fei' | 'mix' */
      var n = PAN_KEYS.filter(function (k) { return !!S.settings[k]; }).length;
      return n === 0 ? 'zhuan' : (n === PAN_KEYS.length ? 'fei' : 'mix');
    }
    function setSeg(box, val) {
      if (!box) return;
      Array.prototype.forEach.call(box.children, function (b) { b.classList.toggle('on', b.dataset.v === val); });
    }
    function syncPanOpts() {
      var mode = panMode();
      setSeg($('segPanMode'), mode);
      var mix = $('panMixHint');
      if (mix) mix.textContent = (mode === 'mix')
        ? '混合：' + [['flyStar', '星'], ['flyGate', '门'], ['flyGod', '神']]
            .filter(function (p) { return !!S.settings[p[0]]; }).map(function (p) { return p[1]; }).join('·') + '走飞盘'
        : '';
      /* 子设置显隐：转盘侧 / 飞盘侧各一组；混盘时两组都亮，够用 */
      var z = $('subZhuan'), f = $('subFei');
      if (z) z.classList.toggle('hide', mode === 'fei');
      if (f) f.classList.toggle('hide', mode === 'zhuan');
      var sum = $('panSum');
      if (sum) {
        sum.textContent = (mode === 'fei' ? '飞盘' : mode === 'zhuan' ? '转盘' : '混盘') +
          (mode === 'zhuan' ? '' : ' · ' + (S.settings.sgDir === 'yinyang' ? '星门阳顺阴逆' : '星门顺飞') +
            ' · ' + (S.settings.godDir === 'yang' ? '八神顺飞' : '八神阳顺阴逆'));
      }
      PAN_KEYS.forEach(function (k) {
        var box = $({ flyStar: 'segFlyStar', flyGate: 'segFlyGate', flyGod: 'segFlyGod' }[k]);
        setSeg(box, S.settings[k] ? '1' : '0');
      });
      setSeg($('segSgDir'), S.settings.sgDir === 'yinyang' ? 'yinyang' : 'shun');
      /* ★ 2026-11-13 用户：盘面同显**仅限转盘** ——
         盘式切「飞盘」，或 九星/八门/八神 任一走飞盘（flyMode 三者取或），都与同显互斥：
         自动关掉同显（存档同步），并把「盘面同显」那一格置灰（class lock：仍可点，点了给提示）。 */
      if (flyMode() && S.settings.panLesson) {
        S.settings.panLesson = false;
        S.saveSettings();
        if (state.chart) renderMiniLesson(state.chart);
      }
      var lp = $('segPanLesson');
      if (lp) Array.prototype.forEach.call(lp.children, function (b) { b.classList.toggle('lock', flyMode()); });
      setSeg($('segPanLesson'), S.settings.panLesson ? '1' : '0');
      setSeg($('segSizhu'), (+S.settings.sizhu === 1) ? '1' : '0');
      setSeg($('segGodDir'), S.settings.godDir === 'yang' ? 'yang' : 'yinyang');
      setSeg($('segGouChen'), (S.settings.gouChen === 'on' || S.settings.gouChen === true) ? 'on'
        : ((S.settings.gouChen === 'off' || S.settings.gouChen === false) ? 'off' : 'auto'));
      panDirHints();
    }
    syncPanOpts();
    $('segPanMode').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var fei = b.dataset.v === 'fei';
      var hadLesson = !!S.settings.panLesson;
      PAN_KEYS.forEach(function (k) { S.settings[k] = fei; });
      S.saveSettings();
      syncPanOpts();
      afterPanOpt(fei
        ? (hadLesson && !S.settings.panLesson ? '已切到飞盘 · 盘面同显已关（仅限转盘）' : '已切到飞盘')
        : '已切到转盘');
    });
    /* 分项微调：星 / 门 / 神 各自转↔飞 */
    [['segFlyStar', 'flyStar'], ['segFlyGate', 'flyGate'], ['segFlyGod', 'flyGod']].forEach(function (pair) {
      $(pair[0]).addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var hadLesson = !!S.settings.panLesson;
        S.settings[pair[1]] = b.dataset.v === '1'; S.saveSettings();
        syncPanOpts();
        afterPanOpt(hadLesson && !S.settings.panLesson ? '盘式已改 · 盘面同显已关（仅限转盘）' : '盘式已改');
      });
    });
    /* 排法 · 盘面同显串星课（仅限转盘：飞盘下这一格置灰，点了给提示、不改设置） */
    $('segPanLesson').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.v === '1' && flyMode()) { toast('盘面同显仅限转盘：先把盘式切回转盘'); return; }
      S.settings.panLesson = b.dataset.v === '1'; S.saveSettings();
      syncPanOpts();
      afterPanOpt(S.settings.panLesson ? '盘面同显串星课：已开启（课放进中宫）' : '盘面同显串星课：已关闭');
    });
    /* 排法 · 四柱形制（2026-11-02：从插件收进设置；默认＝方块四柱，简洁＝五行色字） */
    $('segSizhu').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.settings.sizhu = b.dataset.v === '1' ? 1 : 0; S.saveSettings();
      syncPanOpts();
      if (state.chart) renderChart();
      toast('四柱：' + (S.settings.sizhu ? '简洁（五行色字）' : '默认'));
    });
    /* 插件列表：遍历 Plugins.list() 动态生成卡片 + 开关（2026-10-25 起真插件）。
       一个插件一张卡（标题 + 开关 + 说明 + 小注）；开关即时生效并重排盘面/导出图。
       插件本体在 web/plugins/*.js，契约见 web/plugins/README.md —— 这里不写死任何插件名。
       desc/note 是 HTML（插件作者可写 <b> 等），name 走 esc 防注入。 */
    function renderPluginList() {
      var host = $('pluginList');
      if (!host) return;
      var list = Plugins.list();
      host.innerHTML = list.map(function (m) {
        return '<div class="pk-card">' +
          '<div class="pk-head"><b>' + esc(m.name) + '</b>' +
          '<div class="seg" id="segPlugin_' + m.id + '"><button data-v="1">开启</button><button data-v="0">关闭</button></div></div>' +
          (m.desc ? '<p class="pk-body">' + m.desc + '</p>' : '') +
          (m.note ? '<p class="pk-note">' + m.note + '</p>' : '') +
          '</div>';
      }).join('');
      list.forEach(function (m) {
        var seg = $('segPlugin_' + m.id);
        if (!seg) return;
        setSeg(seg, Plugins.enabled(m.id) ? '1' : '0');
        seg.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          S.settings.plugins = S.settings.plugins || {};
          S.settings.plugins[m.id] = b.dataset.v === '0' ? 0 : 1;
          S.saveSettings();
          setSeg(seg, b.dataset.v);
          /* 开关变化：重排盘面（紫微独占会抵星曜 / 让其他插件让位，placeStars 已判 anyExclusive）。
             再走一遍 applyLayers —— 「日月年家」这类带能力标志的插件靠它把四层切换放出来 / 收回去。 */
          if (state.chart) { placeStars(); renderPan(); renderChart(); }
          applyLayers();
          toast(m.name + '：' + (Plugins.enabled(m.id) ? '已开启' : '已关闭'));
        });
      });
    }
    renderPluginList();
    /* 真太阳时（2026-10-21）：默认关；开了四层与串星都按观测点经度 + 均时差换算 */
    Array.prototype.forEach.call($('segTrueSolar').children, function (b) {
      b.classList.toggle('on', (b.dataset.v === '1') === !!S.settings.trueSolar);
    });
    $('segTrueSolar').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.settings.trueSolar = b.dataset.v === '1'; S.saveSettings();
      Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); });
      renderHome();
      if (state.chart) recastQuiet();
      toast(S.settings.trueSolar ? '真太阳时：开启（按观测点经度 + 均时差）' : '真太阳时：关闭（标准时）');
    });
    /* 星门飞法 / 八神飞法 */
    [['segSgDir', 'sgDir'], ['segGodDir', 'godDir']].forEach(function (pair) {
      $(pair[0]).addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.settings[pair[1]] = b.dataset.v; S.saveSettings();
        syncPanOpts();
        afterPanOpt('盘式已改');
      });
    });
    $('segGouChen').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.settings.gouChen = b.dataset.v; S.saveSettings();
      syncPanOpts();
      afterPanOpt('八神名：' + (b.dataset.v === 'on' ? '勾陈·朱雀' : b.dataset.v === 'off' ? '白虎·玄武' : '自动（转盘白虎·飞盘勾陈）'));
    });
    /* 分项微调那一折：点标题开合（不落盘，一次会话里记住就行） */
    (function () {
      var box = $('advPan'); if (!box) return;
      var head = box.querySelector('.subhead'); if (!head) return;
      head.addEventListener('click', function () { box.classList.toggle('closed'); });
    })();
    function afterPanOpt(msg) {
      /* 飞盘的中宫没有切换入口了，所以开飞盘时把"卦象·地支面"收回本盘，免得回不来 */
      if (flyMode() && state.face !== 'pan') state.face = 'pan';
      toast(msg || '盘式已改');
      renderHome();
      /* ⚠ 两件事都别再犯：
         ① 已起盘就要重排 —— **手动起局（自选局 · 随机）也得重排**。
            原来写的是 `if (state.chart && !state.chart.manual)`，于是手动盘上改盘式/顺逆
            只弹一句"盘式已改"、盘面纹丝不动（用户就是这么发现"八神顺逆设置无效"的）。
         ② 重排要用 recastQuiet()，**不能走 castChart()** —— castChart 会 setView，
            而 setView 末尾会把整页 scrollTop 清零，设置页就被弹回顶部（用户反馈体验差）。
         recastQuiet() 内部走 buildChart()，三种起盘方式（时家 · 手动 · 四层）它都认。 */
      if (state.chart) recastQuiet();
    }

    /* 定局法：拆补 / 置闰 / 阴盘（2026-11-02 用户把阴盘从起盘页升级到这里） */
    var JU_NAME = { chaibu: '拆补法', zhirun: '置闰法', yin: '阴盘（数字定局）' };
    Array.prototype.forEach.call($('segJu').children, function (b) {
      b.classList.toggle('on', b.dataset.v === S.settings.juMethod);
    });
    $('segJu').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.settings.juMethod = b.dataset.v; S.saveSettings();
      Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); });
      toast('定局法：' + (JU_NAME[b.dataset.v] || b.dataset.v));
      renderHome();
      /* 悄悄重排，别切页 —— 切页会把设置页的滚动位置清零（见 recastQuiet 注释）。
         ⚠ 不能只重排「非手动盘」：阴盘本身就是合成盘（manual:true），
           从阴盘切回拆补 / 置闰时它也得重排回普通盘。手动盘重排一次无副作用
           （自选局是直接指定局数，不吃定局法）。 */
      if (state.chart) recastQuiet();
    });

    /* 定局法释义（2026-11-02 用户：左侧小字收简洁，三种口径的点开细看 ——
       样式与交互照「星曜 → 显示星曜」旁边那个 ⓘ：都是 infobtn + openSheet 弹层） */
    function openJuDoc() {
      var html = '<div class="bar"></div><h2>定局<b>法</b></h2>'
        + '<div class="sub">拆补 · 置闰 · 阴盘</div>'
        + '<div class="fhint" style="margin:0 0 11px">定局法只决定<b>「局数」从哪来</b>；盘怎么排'
        + '（转盘 / 飞盘、顺逆、八神名）在「排法」里另设。它只管时家的「此时刻 / 随机时刻」——'
        + '自选局与随机一局是<b>手动指定局数</b>，不吃定局法。</div>'
        + '<div class="card" style="margin:0 0 12px"><h3>拆补</h3>'
        + '<p class="docp">把一个节气按符头分作上中下三元，<b>三元都留在同一节气里</b>，不跨节气借元。'
        + '符头是最近的甲 / 己日（五日一候）：甲子 · 甲午 · 己卯 · 己酉为上元符头，'
        + '甲寅 · 甲申 · 己巳 · 己亥为中元，甲辰 · 甲戌 · 己丑 · 己未为下元；'
        + '定了元，再查节气局表得局数。</p>'
        + '<p class="docp">符头早到交节叫「<b>超神</b>」、晚到叫「<b>接气</b>」。拆补<b>不置闰</b>：'
        + '差几日就照几日算，盘上会标「符先节后 / 节先符后 N 日」，但不再补偿。'
        + '阴阳遁：冬至后至芒种用阳遁，夏至后至大雪用阴遁。</p></div>'
        + '<div class="card" style="margin:0 0 12px"><h3>置闰</h3>'
        + '<p class="docp">按<b>符头链</b>走：以甲 / 己日为符头，十五日一元连续往下排，不因换节气而中断。'
        + '符头与节气越错越远，累到约九日（含头计数，历日差八天）时，就在<b>芒种、大雪</b>'
        + '这两个阴阳遁交替处置一闰 —— 把这一元多按一轮，让符头链重新与节气对齐。</p>'
        + '<p class="docp">所以同一时刻，拆补与置闰可能出不同的局，差就差在这一闰上；'
        + '盘面「依据」那一行会写明闰在哪一气、符头与节气差几天。</p></div>'
        + '<div class="card" style="margin:0 0 12px"><h3>阴盘</h3>'
        + '<p class="docp">道家阴盘，<b>不看符头</b>，与拆补 / 置闰不是一套体系。定局用<b>数字定局</b>：'
        + '年支序 ＋ 农历月 ＋ 农历日 ＋ 时支序（支序子起 1），四项相加再对 9 取余，余 0 记九局；'
        + '冬至后阳遁、夏至后阴遁。</p>'
        + '<p class="docp">地盘从局宫起飞布三奇六仪（阳遁顺飞、阴遁逆飞，中五干寄坤二）；'
        + '值符星、值使门由旬首落宫取；天盘随九星旋转、八门另旋、八神阳顺阴逆；另出<b>暗干</b>（排在宫内「星曜」那一行的位置，与标准盘同一套行）。'
        + '转 / 飞、顺逆这些盘式开关对阴盘一律无效。</p></div>'
        + '<button class="btn" style="width:100%;margin-top:12px" id="btnJuDocOk">知道了</button>';
      openSheet(html);
      $('btnJuDocOk').addEventListener('click', closeSheet);
    }
    $('btnJuNote').addEventListener('click', openJuDoc);

    var rngLift = $('rngLift'), liftVal = $('liftVal');
    if (rngLift) {
      rngLift.value = liftPctNow();
      rngLift.addEventListener('input', function () {
        if (lessonOn()) S.settings.liftPctLesson = +this.value; else S.settings.liftPct = +this.value;
        S.saveSettings();
        updateLiftLabel();
        syncBgFold();
        fitPan();
      });
      updateLiftLabel();
    }
    $('rngOp').addEventListener('input', function () {
      S.settings.opacity = +this.value;
      $('opVal').textContent = this.value + '%';
      S.saveSettings();
      applyOpacity();
      syncBgFold();
    });

    function afterStarChange() {
      S.saveSettings();
      placeStars();
      if (state.chart) renderPan();
    }
    Array.prototype.forEach.call($('segStars').children, function (b) {
      b.classList.toggle('on', (b.dataset.v === '1') === !!S.settings.starsOn);
    });
    /* ------------------------------------------------------ 观测位置（选城） */
    /* 经纬度只影响星曜落哪一宫。定位在手机上经常拿不到结果（WebView 要额外授权、
       系统地理编码又常常不可用），所以主路径改成**内置城市库三级联动**：
       cities.js 是从 mQimen 整份抄过来的 3727 个可选点，纯静态、不联网。
       定位只当"帮我找到最近那个"的入口 —— 拿到了就落到最近的区县上。 */
    var Loc = window.Loc;
    var locCountEl = $('locCount');
    if (locCountEl) locCountEl.textContent = (Loc && Loc.ready) ? Loc.count() : 0;

    function syncLoc() {
      $('inpLat').value = S.settings.lat;
      $('inpLon').value = S.settings.lon;
      $('locName').textContent = locTitle();
    }
    function setLoc(lat, lon, path) {
      /* 夹一下：手填时输错一位就会把星曜甩到盘外 */
      S.settings.lat = +Math.max(-89.9, Math.min(89.9, +lat)).toFixed(4);
      S.settings.lon = +Math.max(-180, Math.min(180, +lon)).toFixed(4);
      S.settings.locPath = path || '';
      if (typeof locError === 'function') locError('');   /* 选城市/定位成功 → 清掉手填错误 */
      afterStarChange();
      renderHome();                       /* 真太阳时按观测点经度换算，换点后首页预览要跟着变 */
      if (state.chart) recastQuiet();
      syncLoc();
    }

    syncLoc();
    /* 「显示星曜」那一栏的 ⓘ：星曜释义 —— 七政四余十一曜的古义／今义，
       外加「罗计之误」与「本软件四余取的是什么点」。
       ⚠ 正文都在下面的数据表里，改字前先看 校验/资料-*.md（三路调研交叉验证的产物，
         孤证与互相矛盾的说法都记在那几份里，别凭印象改）。
       ⚠ FOUR_AT 里那四行是**旧文案的原口径**（余奴星 / 黄白道南北交点 / 月球近远地点），
         用户逐字给的，一个字都别自作主张改。 */
    var FOUR_AT = {
      '罗睺': '火星之余奴 · 黄白道北交点（升交点）',
      '计都': '土星之余奴 · 黄白道南交点（降交点）',
      '紫炁': '木星之余奴 · 月球近地点',
      '月孛': '水星之余奴 · 月球远地点'
    };
    var STAR_DOC = [
      /* 名, 别称, 古义, 今义, 古已有异说(可选) —— 前七条七政，后四条四余。
         ⚠ 文案是用户从四案里选定的「关键词」版（方案 B）：只给词，不写成句。
         事实与出处见 校验/资料-七政古义今义.md 与 校验/资料-现代改写与西学影响.md。 */
      ['太阳', '日', '人君 · 恩泽 · 光明', '自我 · 意志 · 生命力', ''],
      ['太阴', '月', '后妃 · 刑杀 · 风雨', '情绪 · 安全感 · 潜意识', ''],
      ['岁星', '木', '东方 · 仁 · 丰歉', '扩张 · 幸运 · 机会', ''],
      ['荧惑', '火', '南方 · 礼 · 兵丧疾饥', '行动 · 欲望 · 竞争', '「察刚气」一作「察罚气」。'],
      ['镇星', '土', '中央 · 信 · 福厚', '限制 · 责任 · 时间', '古义两路：作吉（《天官书》）／作忌曜、瘟星（《张果星宗》）。'],
      ['太白', '金', '西方 · 义 · 兵刑 · 妻星', '爱与美 · 吸引力 · 关系', '古义两层（肃杀将军＋美色妻星），今只留后者并换上西方 love。'],
      ['辰星', '水', '北方 · 知 · 刑名', '思维 · 沟通 · 信息', '宰相之象／偏将之象两说。'],
      ['紫炁', '炁', '木余 · 贵 · 九流艺', '贵人 · 机遇 · 祥瑞', '周期 35 年／28 年两说，且无天文对应，清代已删。'],
      ['罗睺', '罗', '火余 · 燥 · 蚀神', '北交点 · 欲望 · 业力', '逆行／顺行两说，同书自相矛盾。'],
      ['计都', '计', '土余 · 沉 · 天尾', '南交点 · 宿命 · 解脱', '曾被误当月球远地点。'],
      ['月孛', '孛', '水余 · 晦 · 妨克', '暗月 · 阴影', '余气说／月行最北度说并存。']
    ];
    var LUOJI_MIX = [
      '印度一侧：Rahu 是升交点、Ketu 是降交点（韩国学中央研究院《韩国民族文化大百科事典》「四餘纏度通軌」条：罗睺为升交点、计都为降交点，合称「罗计」、约 18.6 年逆行一周）。',
      '中土传抄里两者被对调过，连方向也说法不一：《张果星宗》卷十一说罗计「在天逆行，号为天首」，卷十三却说「诸星逆行，惟罗计顺行」—— 同一部书前后矛盾。',
      '清《三才发秘・原四餘》干脆指出当时流行的罗计算法是「虚躔之度，无影无形，吉凶岂有验乎」，并另给求法：「入黄北曰罗，出黄南曰计」—— 可见清代人自己就在为这件事打架。',
      '本软件不取流派口径，直接按几何点算（罗睺＝升交点、计都＝降交点），因此不受这层混淆影响；代价是它与某些古籍的「罗睺／计都」会正好相反，对读古书时须留意。'
    ];
    var IMPL_NOTE = [
      '罗睺 ＝ 黄白升交点（λ = 125.044° − 0.052954°·日）；计都 ＝ 升交点 + 180°。',
      '月孛 ＝ 月球远地点（近地点 + 180°），周期约 8.86 年，与西方占星的月球远地点是同一个点。',
      '紫炁 ＝ 月球近地点（λ = 83.353° + 0.1114°·日）。',
      '四余一律当「点」算，不取传统那套虚星周期 —— 所以本软件的紫炁与古籍里那个约二十八年（或三十五年）一周天、且无天文对应的紫炁，并不是同一个东西。'
    ];
    /* 出处。古义一律取原文可查的那几种；今义多是当代通俗说法，出处见 校验/资料-*.md */
    var STAR_SRC = [
      '七政古义：《史记·天官书》（含三家注）、《汉书·天文志》、《武经总要·五星占》、《御定月令辑要》引文。',
      '四余古义：《张果星宗》卷十一〈性情论〉、卷十三〈气星〉〈罗计〉；清·陈雯《三才发秘・原四餘》。',
      '天文对应：韩国学中央研究院《韩国民族文化大百科事典》「四餘纏度通軌」条（罗睺＝升交点、计都＝降交点、月孛周期 8.86 年、紫炁 28 年且无对应天体）。',
      '今义：当代通俗占星与术数读物的通行说法，多与西洋占星关键词重合，属流行口径而非古代承袭；17 世纪《天步真原》是西式占星较早的中译。'
    ];

    /* 折叠行：默认只露「名字 + 古义前半句」，点开才展开古今（用户选的是预览里的样本 3）。
       s = [名, 别称, 古义, 今义, 古已有异说(可选)]。 */
    function starFoldHTML(s, four, open) {
      return '<div class="fold' + (open ? ' on' : '') + '">'
        + '<b>' + s[0] + '<em>' + s[1] + '</em><i>' + s[2].slice(0, 13) + '…</i><u>⌄</u></b>'
        + '<div class="bd">'
        + '<div><i class="tg gu">古</i>' + s[2] + '</div>'
        + '<div><i class="tg jin">今</i>' + s[3] + '</div>'
        + (s[4] ? '<div><i class="tg qi">歧</i>' + s[4] + '</div>' : '')
        + (four ? '<div class="soft">本软件取：' + FOUR_AT[s[0]] + '</div>' : '')
        + '</div></div>';
    }
    function openStarDoc() {
      var html = '<div class="bar"></div><h2>星曜<b>释义</b></h2>'
        + '<div class="sub">七政四余 · 十一曜 · 点开看古／今</div>'
        + '<div class="fhint" style="margin:0 0 11px">「古」＝中国古代星占与七政四余的口径；'
        + '「今」＝当代通行说法（多受西洋占星影响）；「歧」＝<b>古人自己就有异说</b>，与今义无关。</div>'
        + '<div class="card" style="margin:0 0 12px"><h3>七政 · 日月五星</h3>'
        + STAR_DOC.slice(0, 7).map(function (s, k) { return starFoldHTML(s, false, k === 0); }).join('') + '</div>'
        + '<div class="card" style="margin:0 0 12px"><h3>四余 · 炁 罗 计 孛</h3>'
        + STAR_DOC.slice(7).map(function (s) { return starFoldHTML(s, true, false); }).join('') + '</div>'
        + '<div class="card" style="margin:0 0 12px"><h3>罗睺 · 计都：传抄里被弄混的地方</h3>'
        + LUOJI_MIX.map(function (p) { return '<p class="docp">' + p + '</p>'; }).join('') + '</div>'
        + '<div class="card" style="margin:0 0 12px"><h3>本软件的四余取的是什么点</h3>'
        + IMPL_NOTE.map(function (p) { return '<p class="docp">' + p + '</p>'; }).join('')
        + '<p class="docp" style="color:var(--ink-3)">ps：四颗余奴星排法存在较大争议。</p></div>';
      if (STAR_SRC.length) {
        html += '<div class="card" style="margin:0"><h3>出处</h3>'
          + STAR_SRC.map(function (s) { return '<p class="docp" style="color:var(--ink-3)">' + s + '</p>'; }).join('')
          + '</div>';
      }
      html += '<button class="btn" style="width:100%;margin-top:12px" id="btnStarDocOk">知道了</button>';
      openSheet(html);
      Array.prototype.forEach.call($('sheet').querySelectorAll('.fold > b'), function (b) {
        b.addEventListener('click', function () { b.parentNode.classList.toggle('on'); });
      });
      $('btnStarDocOk').addEventListener('click', closeSheet);
    }
    $('btnStarNote').addEventListener('click', openStarDoc);

    $('segStars').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.settings.starsOn = b.dataset.v === '1';
      Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); });
      afterStarChange();
    });
    /* 经纬度手填（2026-11-10 审查项）：
       原来 parseFloat 会把「123abc」当 123、把 90 静默夹成 89.9，用户看到的数
       与实际采用的坐标对不上。现在整串校验、错误就地说明且不重排盘面。 */
    function locError(msg) {
      var el = $('locErr');
      if (el) {
        el.textContent = msg || '';
        if (msg) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
      }
      ['inpLat', 'inpLon'].forEach(function (id) {
        var inp = $(id);
        if (inp) inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
      });
    }
    function parseCoord(raw, isLat) {
      var name = isLat ? '纬度' : '经度';
      /* 允许首尾空格与中文逗号；除此外必须是完整数字，不能带尾随字符 */
      var s = String(raw == null ? '' : raw).trim().replace(/[，,]/g, '.');
      if (!s) return { err: name + '不能为空' };
      if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return { err: name + '只填数字，例如 ' + (isLat ? '39.9042' : '116.4074') };
      var v = parseFloat(s);
      var min = isLat ? -89.9 : -180, max = isLat ? 89.9 : 180;
      if (!isFinite(v) || v < min || v > max) return { err: name + '需在 ' + min + ' 到 ' + max + ' 之间' };
      return { v: v };
    }
    ['inpLat', 'inpLon'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        var isLat = id === 'inpLat';
        var r = parseCoord(this.value, isLat);
        if (r.err) { locError(r.err); return; }   /* 保留用户输入，不清空、不重排 */
        locError('');
        /* 手填经纬度 = 放弃城市名，只留一对裸坐标 */
        var other = isLat ? S.settings.lon : S.settings.lat;
        setLoc(isLat ? r.v : other, isLat ? other : r.v, '');
      });
    });

    /* 三级联动：省/国家 → 市 → 区县 */
    var cpTab = 'cn';
    function cpFillArea() {
      var p = $('cpProv').value, c = $('cpCity').value, list = Loc.areas(p, c), o = '';
      for (var i = 0; i < list.length; i++) o += '<option value="' + esc(list[i].name) + '">' + esc(list[i].name) + '</option>';
      $('cpArea').innerHTML = o;
      $('cpAreaRow').style.display = Loc.areaHidden(p, c) ? 'none' : '';
      cpPreview();
    }
    function cpFillCity() {
      var p = $('cpProv').value, cs = Loc.cities(p), o = '';
      for (var i = 0; i < cs.length; i++) o += '<option value="' + esc(cs[i]) + '">' + esc(cs[i]) + '</option>';
      $('cpCity').innerHTML = o;
      cpFillArea();
    }
    function cpFillProv() {
      var ps = Loc.provs(cpTab), o = '';
      for (var i = 0; i < ps.length; i++) o += '<option value="' + esc(ps[i]) + '">' + esc(ps[i]) + '</option>';
      $('cpProv').innerHTML = o;
      cpFillCity();
    }
    function cpTabSync() {
      $('cpTabCn').classList.toggle('on', cpTab === 'cn');
      $('cpTabOt').classList.toggle('on', cpTab === 'ot');
      cpFillProv();
    }
    function cpPick() {
      var p = $('cpProv').value, c = $('cpCity').value;
      var an = Loc.areaHidden(p, c) ? '' : $('cpArea').value;
      var at = Loc.at(p, c, an) || Loc.at(p, c, '');
      return at ? { p: p, c: c, a: an, lat: at.lat, lon: at.lon } : null;
    }
    function cpPreview() {
      var k = cpPick();
      $('cpPrevName').textContent = k ? Loc.label(k.p, k.c, k.a) : '—';
      $('cpPrevCoord').textContent = k ? fmtLL(k.lat, k.lon) : '—';
    }
    function cpOpen() {
      if (!Loc || !Loc.ready) { toast('城市库没装上'); return; }
      openSheet(
        '<div class="bar"></div><h2>观测<b>位置</b></h2>' +
        '<div class="sub">内置城市库 · ' + Loc.count() + ' 个可选点，不联网也能用</div>' +
        '<div class="cptabs"><button id="cpTabCn" data-t="cn" class="on">中国大陆 · 港澳台</button>' +
        '<button id="cpTabOt" data-t="ot">海外</button></div>' +
        '<div class="cp3">' +
        '<label><i>省 / 国家</i><select id="cpProv"></select></label>' +
        '<label><i>市 / 地区</i><select id="cpCity"></select></label>' +
        '<label id="cpAreaRow"><i>区 县</i><select id="cpArea"></select></label>' +
        '</div>' +
        '<div class="cpprev"><span id="cpPrevName">—</span><b id="cpPrevCoord">—</b></div>' +
        '<div class="btnrow"><button class="btn" id="cpCancel">取消</button>' +
        '<button class="btn primary" id="cpOk">就用这里</button></div>'
      );
      /* 预选上次的位置 */
      var p0 = (S.settings.locPath || '').split('|');
      cpTab = (p0.length >= 2 && Loc.tabOf(p0[0]) === 'ot') ? 'ot' : 'cn';
      $('cpTabCn').addEventListener('click', function () { cpTab = 'cn'; cpTabSync(); });
      $('cpTabOt').addEventListener('click', function () { cpTab = 'ot'; cpTabSync(); });
      $('cpProv').addEventListener('change', cpFillCity);
      $('cpCity').addEventListener('change', cpFillArea);
      $('cpArea').addEventListener('change', cpPreview);
      $('cpCancel').addEventListener('click', closeSheet);
      $('cpOk').addEventListener('click', function () {
        var k = cpPick(); if (!k) return;
        setLoc(k.lat, k.lon, k.p + '|' + k.c + '|' + (k.a || ''));
        closeSheet();
        toast('观测点：' + Loc.label(k.p, k.c, k.a));
      });
      cpTabSync();
      if (p0.length >= 2) {
        if (Loc.provs(cpTab).indexOf(p0[0]) >= 0) { $('cpProv').value = p0[0]; cpFillCity(); }
        if (Loc.cities($('cpProv').value).indexOf(p0[1]) >= 0) { $('cpCity').value = p0[1]; cpFillArea(); }
        if (p0[2] && !Loc.areaHidden($('cpProv').value, $('cpCity').value)) {
          $('cpArea').value = p0[2]; cpPreview();
        }
      }
    }
    $('btnCity').addEventListener('click', cpOpen);

    /* 定位：拿到了就落到最近的区县；拿不到退到原生兜底，再不行才说失败 */
    function geoApply(lat, lon, how) {
      var n = (Loc && Loc.ready) ? Loc.nearest(lat, lon) : null;
      if (n && n.km < 300) {
        setLoc(n.lat, n.lon, n.p + '|' + n.c + '|' + (n.a || ''));
        toast((how || '') + '最近的城市：' + Loc.label(n.p, n.c, n.a) + '（约 ' + Math.round(n.km) + ' km）');
      } else {
        setLoc(lat, lon, '');
        toast(n ? (how || '') + '最近的参照点也有 ' + Math.round(n.km) + ' km，直接用原始坐标'
                : (how || '') + '已用当前位置');
      }
    }
    /* 原生兜底：MainActivity.Bridge.locate() 读「最后已知位置」，返回 "OK:纬度,经度" */
    function geoNative() {
      var B = window.Xyqimen;
      if (!B || !B.locate) return false;
      var r = '';
      try { r = B.locate(); } catch (e) { r = ''; }
      if (typeof r !== 'string' || r.indexOf('OK:') !== 0) return false;
      var p = r.slice(3).split(',');
      var la = parseFloat(p[0]), lo = parseFloat(p[1]);
      if (!isFinite(la) || !isFinite(lo)) return false;
      geoApply(la, lo, '系统位置：');
      return true;
    }
    $('btnGeo').addEventListener('click', function () {
      if (!navigator.geolocation) {
        if (geoNative()) return;
        toast('这个环境没有定位接口，直接从城市库里选吧');
        return;
      }
      toast('正在定位…');
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) toast('定位没回应 —— 可能是没开定位权限，先手动选个城市');
      }, 9000);
      navigator.geolocation.getCurrentPosition(function (pos) {
        settled = true; clearTimeout(timer);
        geoApply(pos.coords.latitude, pos.coords.longitude, '');
      }, function (e) {
        settled = true; clearTimeout(timer);
        if (geoNative()) return;
        var m = { 1: '定位权限被拒绝 —— 去系统设置给本应用开「位置」', 2: '拿不到位置信号', 3: '定位超时' }[e && e.code];
        toast(m || '定位失败');
      }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
    });
  }

  /** 收尾：首帧守卫放行前必须最后跑（切页、定时刷新、启动动画） */
  function initFinish() {
    syncMode();
    setView('home');
    if (!S.available) {
      setTimeout(function () { toast('提示：用 file:// 打开时浏览器禁止本地存储，设置本次会话有效'); }, 900);
    }
    setInterval(function () {
      /* 四层（日/月/年家）是用户在时间样件里选的日期，不能被「跟随当前时刻」覆盖 */
      if (state.layer !== 'shi' || state.mode !== 'time' || S.settings.mode !== 'now' || state.view !== 'home') return;
      setPickInput(nowParts());
      renderHome();
    }, 20000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && state.view === 'home') renderHome();
    });
    bootReveal();
  }

  function init() {
    initCommon();
    initHome();
    initCx();
    initPan();
    initSet();
    initFinish();
  }

  /* ★ 首帧守卫的「放行」：init 跑完 + 字体就绪 → 隔两帧再整体亮出来。
     为什么需要它：浏览器会在 body 末尾那批脚本（cities.js 123KB、ui.js 152KB…）
     还在执行时就抢画第一帧 —— 那一帧只有静态栏目，init() 填充的时刻/四柱、
     以及下半屏的「起盘」大按钮与底栏都还没就位；紧接着字体到达又触发一次整页重排。
     两次绘制叠在一起，肉眼就是"先上半、后半截晚一点冒出来"。

     为什么隔两帧：守卫用的是 opacity:0，页面在隐藏态就已经绘制并光栅化过一遍
     （见 index.html 的注释），这里多等一帧只是让合成器把 rasters 收全；
     放行本身只改一个合成属性、不触发重绘 —— 所以亮出来的是一整帧，不会再分块。
     ⚠ 兜底两条：字体 700ms 内没就绪就直接放行；index.html 里另有一个 2s 的硬兜底。 */
  function bootReveal() {
    var html = document.documentElement;
    var shown = false;
    function done() {
      if (shown) return;
      shown = true;
      html.classList.remove('booting');
    }
    function reveal() {
      /* 双 rAF：第一帧把布局/合成提交完，第二帧才真正亮出来 */
      requestAnimationFrame(function () { requestAnimationFrame(done); });
    }
    var t = setTimeout(reveal, 700);
    try {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          clearTimeout(t); reveal();
        }, function () {
          clearTimeout(t); reveal();
        });
      } else {
        clearTimeout(t); reveal();
      }
    } catch (e) {
      clearTimeout(t); reveal();
    }
  }

  /* 给 Android 壳用：返回键先问这里。关掉弹层 / 退回主页都算"我处理了"。 */
  var lastBackHome = 0;          /* 主页「再按一次退出」防误触的时间戳 */
  function goBack() {
    /* 顺序 = 屏幕上的层级：裁剪 / 弹层 / 课页 → 当前页 → 首页退出。
       2026-11-10 审查项：裁剪层原来不在返回栈里，会让底页先被切走。 */
    var cropEl = $('cropper');
    if (cropEl && cropEl.classList.contains('on')) { closeCrop(); return 'crop'; }
    if ($('sheet') && $('sheet').classList.contains('on')) { closeSheet(); return 'sheet'; }
    if (cxPopOpen()) { closeCxPop(); return 'cxpop'; }      /* 串星课弹层先关 */
    if (state.view !== 'home') { setView('home'); return 'home'; }
    /* 主页：第一次返回只提示，2 秒内再按才真正退出（防误触） */
    var now = Date.now();
    if (now - lastBackHome < 2000) return '';
    lastBackHome = now;
    toast('再按一次退出');
    return 'home';
  }
  window.xyqimenBack = function () {
    return !!goBack();          /* 返回 true = 原生壳别退出 App */
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
