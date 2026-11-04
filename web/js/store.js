/* ============================================================================
 * store.js —— 星曜奇门 · 本地存储（设置 + 盘面记录）
 * 全部落在 localStorage，不联网、不上传。
 * ========================================================================== */
(function (root) {
  'use strict';
  var KEY_SET = 'xymq.set.v1';

  var DEFAULTS = {
    rev: 3,                   // 设置版本号；升版本时做一次性迁移
    theme: 'white',           // ★ 默认素白
    mode: 'now',              // now | pick
    lateZi: true,             // 晚子时换日
    trueSolar: false,         // 真太阳时（2026-10-21）：默认关；开了按观测点经度 + 均时差换算
    /* 盘式：主开关「转盘 / 飞盘」一键切，三个分量（星/门/神）仍可各自设，
       用来配「星转门飞」这类混盘。飞盘的符号比转盘多几个：星九宫、门九宫（多中门）、神九宫（多太常）。 */
    flyStar: false, flyGate: false, flyGod: false,
    /* 飞盘顺逆 —— 星门和八神不是一条规矩（见 qimen.js buildPlate 顶部注释）：
       sgDir  'shun'     = 九星八门一律顺飞（★ 飞盘主流，默认）
              'yinyang' = 星门也阳顺阴逆（少数派）
       godDir 'yinyang'  = 八神阳顺阴逆（★ 飞盘主流，默认）
              'yang'    = 八神永远顺飞 */
    sgDir: 'shun', godDir: 'yinyang',
    /* 阳遁八神名。**两派各自主流**，所以默认交给"自动"：
       · 转盘 → 白虎·玄武（与 mQimen 口径一致，_valid_qimen 1080 盘已逐宫对过）
       · 飞盘 → 勾陈·朱雀（与 qimen-mingfa 飞盘一致，_valid_feipan 1080 盘已逐宫对过）
       'auto' | 'on'（勾陈朱雀）| 'off'（白虎玄武）；旧存档的 true/false 会在读档时搬过来。 */
    gouChen: 'auto',
    juMethod: 'chaibu',       // 定局法：chaibu=拆补法（默认，同 mQimen） | zhirun=置闰法（符头链·超神接气）| yin=道家阴盘（数字定局＋暗干；2026-11-02 从起盘页的「起局方式」升级到这一档）
    /* 日月年家（年家/月家/日家三层）：2026-11-02 起交给插件（web/plugins/layers.js 的 flags.layers），
       不再占设置键。旧存档里的 layersOn 不再读取 —— 开关在 设置 → 插件 → 日月年家。 */
    opacity: 100,
    /* 两个背景各自独立：
       bgImage   —— App 背景（"透明背景"功能用它；设了之后调低不透明度才看得出效果）
       rendImage —— **截图渲染背景**（导出 PNG 时垫在下面的那张图）
       都是裁剪后的 dataURL。 */
    bgImage: '', rendImage: '', rendImageLesson: '',
    panLesson: false,        /* 排法 · 盘面同显串星课（把九宫盘往下挤，上方留出课） */
    ganFoot: 1,              /* 已废弃（2026-11-02 寄干设置撤掉）；保留键只为老存档不至于报错 */
    sizhu: 0,                /* 排法 · 四柱：0=默认方块四柱；1=简洁（五行色字，原「四柱ui」插件） */
    /* 插件（2026-10-25 起改成真插件）：一个键一个插件，键名＝插件的 id。
       **缺键＝默认关**（用户定的规矩，之后新增插件一律默认关），要开的人到 设置 → 插件 手动打开。
       这里留空对象 —— 插件注册（Plugins.register）时并不写默认键，开关由用户点开才落键。
       具体有哪些插件看 web/plugins/*.js 与 web/js/plugins.js。 */
    plugins: {},
    bgScrim: 70,              // 背景遮罩：压住底图保证字看得清（0–90，%）
    bgAspect: 'auto',         // App 背景壁纸裁剪比例：'auto'=按物理屏（全面屏）；'16:9'/'18:9'/'19.5:9'/'20:9'/'21:9'/自定义比例值
    uiBgOpen: false,          // 旧版「盘面外观」卡是否展开（现在折叠交给顶部分段，留着兼容老设置）
    setTab: 'look',           // 设置页顶部分段停在哪一组：look 外观 / rule 排法 / star 星曜 / about 关于
    lessonTop: 22,           // 盘面同显 · 串星课上下偏移（px，用户手调）
    liftPctLesson: 40,       // 盘面同显 · 加串星课时盘面上移（与只盘分开，用户手调）
    /* 盘面上移：0=垂直居中，100=顶上抬头（占可用富余的百分比）。
       ★ 2026-10-07 用户用 web/设计-盘面位置.html 那根滑条定版为 **62%** ——
         长方形卡片盘（365×509）在 393×852 上富余 144px，62% 就是上移 45px，
         盘顶落在 y=218、盘底 727（用户给的那两个数，一位不差）。
         原来是正方形盘时代的 90%（盘顶 198/707），盘变高之后富余少了一半，
         90% 会把盘顶到抬头底下。 */
    liftPct: 62,
    starsOn: true,            // 显示星曜
    lat: 39.9348,             // 观测点（默认北京市东城区）
    lon: 116.4224,
    locPath: '北京市|北京市|东城区'   // 观测点的「省|市|区」；用户手填经纬度时清空
  };

  /* ⚠ 直接用 file:// 打开时浏览器会把源当成不透明源，localStorage 会抛 SecurityError。
     这里探测一次：不可用就退化成内存存储（当次会话有效），并让 UI 提示用户改用服务地址。 */
  var mem = {};
  var lsOK = (function () {
    try {
      localStorage.setItem('xymq.probe', '1');
      localStorage.removeItem('xymq.probe');
      return true;
    } catch (e) { return false; }
  })();
  /* 装进 App 时原生侧还给了 SharedPreferences 通道（MainActivity 的 lsGet/lsSet）。
     只在 localStorage 不可用时才用它 —— 各厂商 WebView 对 file:// 源的 localStorage
     处理不完全一致，这层是纯保险。 */
  var nat = (typeof window !== 'undefined' && window.Xyqimen && window.Xyqimen.lsGet) ? window.Xyqimen : null;
  var available = lsOK || !!nat;

  function read(k, d) {
    try {
      var raw = null;
      if (lsOK) raw = localStorage.getItem(k);
      else if (nat) raw = nat.lsGet(k);
      else raw = (mem[k] === undefined ? null : mem[k]);
      var v = JSON.parse(raw);
      return (v === null || v === undefined) ? d : v;
    } catch (e) { return d; }
  }
  function write(k, v) {
    var s = JSON.stringify(v);
    if (lsOK) { try { localStorage.setItem(k, s); return true; } catch (e) {} }
    if (nat) { try { nat.lsSet(k, s); return true; } catch (e) {} }
    mem[k] = s; return false;
  }

  /* 一次性迁移，只在 rev 跳版本时跑一次；每件事分开判，别顺手改人家别的设置：
       rev<2：老设置可能被 ◐ 循环到过别的主题 → 统一拉回素白。
       rev<3（2026-10-07）：盘面从正方形改成 365×509 的长方形卡片盘，
         用户把「盘面上移」定成 62%（＝盘顶 218 / 盘底 727）；老存档里那个 90%
         是正方形时代的数，盘变高之后会把盘顶到抬头底下，所以要搬过来。
     ⚠ 别把这两条并成一个 `if`：那样每次升 rev 都会把用户挑好的主题也重置回素白。 */
  (function () {
    try {
      var old = read(KEY_SET, null);
      if (!old) return;
      var rev = old.rev || 0;
      if (rev < 2) old.theme = 'white';
      if (rev < 3) old.liftPct = 62;
      if (rev !== DEFAULTS.rev) { old.rev = DEFAULTS.rev; write(KEY_SET, old); }
    } catch (e) {}
  })();

  var settings = (function () {
    var s = read(KEY_SET, {}) || {};
    /* 老设置里的 flyDir 管的是"星门神一起"的顺逆；现在拆成 sgDir（星门）+ godDir（八神）。
       老值 'yang'（永远顺）搬到 godDir —— 不搬的话，本来勾了"永远顺"的盘会悄悄变盘。 */
    if (s.godDir === undefined && s.flyDir === 'yang') s.godDir = 'yang';
    /* 八神名改成三档（auto/on/off）。旧存档里是布尔：true＝要勾陈朱雀 → 'on'，
       false＝当年那个默认值（白虎玄武）→ 交给 'auto' 更好（飞盘本来就该自动换派）。 */
    if (s.gouChen === true) s.gouChen = 'on';
    else if (s.gouChen === false) s.gouChen = 'auto';
    var out = {};
    for (var k in DEFAULTS) out[k] = (s[k] === undefined ? DEFAULTS[k] : s[k]);
    return out;
  })();

  /* 返回是否真的落盘了 —— 背景图是几百 KB 的 dataURL，localStorage 有配额，
     写不进去时原来会**静默**退化成内存存储（当次会话有效、重开就没了），调用方无从得知。 */
  function saveSettings() { return write(KEY_SET, settings); }


  var API = {
    available: available,
    settings: settings, saveSettings: saveSettings,
    THEMES: [
      { key: 'white', name: '素白' },
      { key: 'blue', name: '玄夜' },
      { key: 'slate', name: '墨玉' },
      { key: 'brown', name: '铜仪' }
    ]
  };
  root.Store = API;
})(typeof window !== 'undefined' ? window : globalThis);
