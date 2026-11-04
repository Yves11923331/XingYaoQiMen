/* ============================================================================
 * bazi.js —— 四柱（八字）取象层：十神 / 藏干 / 纳音 …（2026-11-01 新增）
 * ----------------------------------------------------------------------------
 * 只做**取象**，不碰排盘：四柱本身由 lunar.js 的 Lunar.cast() 算好（index.*），
 * 这里把四柱读成「年柱/月柱/日柱/时柱」四组，并给出十神等派生物。
 *
 * 十神口径（子平法，以**日干**为我）：
 *   同我：同阴阳＝比肩 · 异阴阳＝劫财
 *   我生：同＝食神 · 异＝伤官
 *   生我：同＝偏印 · 异＝正印
 *   我克：同＝偏财 · 异＝正财
 *   克我：同＝七杀 · 异＝正官
 *   日干那一柱不做十神，标「日主」。
 *
 * ⚠ 四柱里 `cal.index.*Gan` 是 **0 基**（0=甲），盘面单元格的 ganChip 是 1 基，别混。
 * ========================================================================== */
(function (root) {
  'use strict';

  var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  /* 天干五行 / 阴阳（阳＝0,2,4…；阴＝1,3,5…） */
  var GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  var ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
  var SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  var KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

  function ganWX(ch) { return GAN_WX[ch] || ''; }
  function zhiWX(ch) { return ZHI_WX[ch] || ''; }
  function isYangGan(ch) { return GAN.indexOf(ch) % 2 === 0; }

  /* 十神：dayGan＝日干，gan＝被看的那个天干（年/月/时干）。
     ⚠ 不能拿「字符相同」当「本柱」：年干、月干、时干完全可能与日干同字（甲年甲日很常见），
       那一柱仍是**比肩**。谁算「日主」由调用方（pillars 的 key === 'day'）决定。 */
  function shiShen(dayGan, gan) {
    if (!dayGan || !gan || GAN.indexOf(dayGan) < 0 || GAN.indexOf(gan) < 0) return '';
    var me = GAN_WX[dayGan], it = GAN_WX[gan];
    var same = isYangGan(dayGan) === isYangGan(gan);
    if (me === it) return same ? '比肩' : '劫财';
    if (SHENG[me] === it) return same ? '食神' : '伤官';
    if (SHENG[it] === me) return same ? '偏印' : '正印';
    if (KE[me] === it) return same ? '偏财' : '正财';
    if (KE[it] === me) return same ? '七杀' : '正官';
    return '';
  }

  /* 地支藏干（本气 / 中气 / 余气，按传统表）。
     本轮「四柱ui」只用到十神，藏干先立表备用（插件里不显示） */
  var CANG = {
    子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
    辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
    申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲']
  };

  /* 四柱取象：cal＝Lunar.cast() 的返回值（用 cal.index，0 基） */
  function pillars(cal) {
    if (!cal || !cal.index) return [];
    var ci = cal.index;
    var cols = [
      { key: 'year', label: '年', g: ci.yearGan, z: ci.yearZhi },
      { key: 'month', label: '月', g: ci.monthGan, z: ci.monthZhi },
      { key: 'day', label: '日', g: ci.dayGan, z: ci.dayZhi },
      { key: 'hour', label: '时', g: ci.hourGan, z: ci.hourZhi }
    ];
    var dayGan = GAN[ci.dayGan] || '';
    return cols.map(function (c) {
      var gan = c.g < 0 ? '' : GAN[c.g];
      var zhi = c.z < 0 ? '' : ZHI[c.z];
      return {
        key: c.key, label: c.label,
        gan: gan, zhi: zhi,
        ganWX: ganWX(gan), zhiWX: zhiWX(zhi),
        ss: c.key === 'day' ? '日主' : shiShen(dayGan, gan),
        dayMaster: c.key === 'day',
        missing: c.g < 0                                   /* 手动起局：没有年月日 */
      };
    });
  }

  var API = {
    GAN: GAN, ZHI: ZHI, GAN_WX: GAN_WX, ZHI_WX: ZHI_WX, CANG: CANG,
    ganWX: ganWX, zhiWX: zhiWX, isYangGan: isYangGan,
    shiShen: shiShen, pillars: pillars
  };

  root.Bazi = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
