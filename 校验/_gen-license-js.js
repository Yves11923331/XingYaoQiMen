/* 把 web/licenses/*.txt 内联成 web/licenses/licenses.js（window.LICENSES）。
 * 用法：node 校验/_gen-license-js.js   （校验/_check_license.js 会校验两者是否同步） */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'web', 'licenses');
/* 2026-11-13 用户意见后收窄：**只内联 OFL 全文** —— 因为我们只再分发字体文件本身，
   OFL 要求随附许可证；另外三项（iztro / qimen-dunjia / bigfishmarquis-qimen）是
   事实性数据与规则口径对齐，只在「关于」里列名字与许可名，不再随包分发 MIT 全文。
   我们自己的 LICENSE 仍以文件形式放在本目录（随包），不内联。 */
const FILES = [
  ['ofl', 'OFL-1.1.txt', 'QM Serif（Noto Serif CJK SC 子集）· SIL OFL 1.1']
];
let out = '';
for (const [k, f] of FILES) {
  const s = fs.readFileSync(path.join(DIR, f), 'utf8');
  out += '  ' + k + ': ' + JSON.stringify(s) + ',\n';
}
const js = `/* ============================================================================
 * licenses.js —— 许可全文（**内联**，随包分发）　2026-11-13
 * ----------------------------------------------------------------------------
 * ⚠ 这个文件是**生成的**：由 校验/_gen-license-js.js 把同目录下的
 *   OFL-1.1.txt 原样内联进来（只这一份 —— 见下面 FILES 的注释）。改正文请改那个 .txt，
 *   然后重跑一次生成脚本；校验/_check_license.js 会查两边是否逐字同步。
 *
 * 为什么不 fetch 读 txt：file:// 下部分 WebView 会拒（CORS / 不透明源），
 * 内联进 JS 最稳 —— 装成 App 也不会有"点了没反应"。
 *
 * 用法（ui.js 的「关于 → 开源声明」）：
 *   window.LICENSES.ofl   （「关于 → 开源声明 → 字体」那一枚「许可全文」用它）
 * ========================================================================== */
(function (root) {
  'use strict';
  var LICENSES = {
${out}    title: {
      ofl: 'QM Serif（Noto Serif CJK SC 子集）· SIL OFL 1.1'
    }
  };
  root.LICENSES = LICENSES;
  if (typeof module !== 'undefined' && module.exports) module.exports = LICENSES;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(path.join(DIR, 'licenses.js'), js);
console.log('✓ web/licenses/licenses.js  ' + Buffer.byteLength(js) + ' 字节');
