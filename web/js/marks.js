/* ============================================================================
 * marks.js —— 盘面小图标的位图源（2026-11-13）
 * ----------------------------------------------------------------------------
 * 只有一个：马星的奔马剪影。为什么用 data URI 而不是 png 文件：
 *   导出图要把图标画进 <canvas>，再 toDataURL 出 PNG。file:// 下的图片会
 *   把画布标成 tainted，toDataURL 直接抛 SecurityError —— 用 data URI 就没这问题，
 *   而且屏幕的 CSS mask 与画布用的是同一份数据，不会两处各存一张。
 * 体积：原 PNG 1.7 KB，base64 后约 2.3 KB。
 * 来源：Seedream 生成剪影 → 阈值/闭运算/裁切 → 256×154 紧贴内容的灰度掩膜（不留方形边，导出才不会拉长）（见 设计-布盘/马星/）。
 * ========================================================================== */
(function () {
  'use strict';
  window.QM_MARKS = {
    horse: 'data:image/png;base64,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'
  };
})();
