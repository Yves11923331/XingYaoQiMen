/* ============================================================================
 * cxhelp.js —— 串星课 · 读法（弹层正文的原文再加工稿）　2026-11-13
 * ----------------------------------------------------------------------------
 * 唯一底本：工作区顶层《小六壬·加干（2026.8.31）.txt》（含 9 个 NUL 字节与 1 个 BOM，
 *           已清洗）。**现为七节**：顺序 / 起课 / 天干论 / 六亲 / 实例 / 六神类象 / 六亲类象，
 *           正文一字未改、未加；只按用户 2026-11-13 的决定，把「掌诀」那一节整段去掉。
 *
 * 用法（接线由 ui.js 的 openXkHelp() 负责，本文件不碰 ui.js）：
 *   openSheet(CxHelp.sheet());          // 条＋标题＋正文＋「知道了」（按钮 id 沿用 btnXkHelpOk）
 *   openSheet(头部 + CxHelp.html + 尾部);  // 想自己排外壳时，只用正文
 *   ⚠ 本文件是**一个全局对象**，不是模块：<script src="js/cxhelp.js"> 要有它才算接上。
 *
 * ——— 再加工台账（只有下面这些动作，逐条可核） ———
 *  0. **2026-11-13 用户拍板：去掉「掌诀」一节**（原文第 1 行整句 47 字，含标点），
 *     其余七节一个字都没动。申报在 校验/_check_cxhelp.js 的 OMIT_OK 里，只此一句。
 *  1. 清洗 9 个 NUL 与开头 BOM；删多余空行、行尾空格。
 *  2. 「小六壬」→「串星课」（原文 2 处：顺序节、命造节）；其余用词一个没动。
 *  3. 引号统一：原文『‘六’』→『“六”』（全文其余引号本来就是中文双引号）。
 *  4. 原文行首的「标签：」提为标题（顺序 / 起课 / 天干论 / 三宫象 / 辩疑论 /
 *     六亲相生 / 六亲相克 / 特别提示 / 天干数序以及五行 / 课 / 各实例 / 六神类象 /
 *     六亲类象 / 六神条目名 / 六亲条目名，共 23 处）—— 只把那个全角冒号交给标题排版吸收。
 *     句号只丢 3 个：两个实例标题行末按标题惯例不收（报数：1158 / 射覆，十选一），
 *     天干数序那处表格化枚举的末句号随表格不落。正文里的句读一处没动。
 *  5. 原文的「——」分隔线取消，改为分节卡片（11 道分隔线＝卡片边界）。
 *  6. 三行「课」（三宫名＋天干 / 三个六亲）→ 四列课表，表头取原文「三宫象」节的
 *     「天宫 · 地宫 · 人宫」与「天干」；字仍是原文的字，只是对齐成格。
 *     神名后那一个五行字（大安木 / 小吉水 / 空亡土 / 庚金）降为小字并上五行色。
 *     实例里原文没写五行的课（如「大安 大安 小吉 辛」），只按五行上色，不添字。
 *  7. 「甲木一，乙木二…」→ 5×2 格；「甲 丙 庚 丁 / 申 子 申 亥」→ 2×4 格（干一行、
 *     支一行，列对即柱：年柱甲申、月柱丙子、日柱庚申、时柱丁亥）—— 字序照原文，
 *     **不重排**；「父母克子孙 绝嗣之象。」里当间隔用的空格 → 两列（关系 / 象）。
 *  8. 「人宫…」五条与命造四条断语用列表。
 *  9. 卡片标题**不写序号**（连「一、二、三」都不加，序号也是"加字"），节与节的分界
 *     靠标题前那根金色短竖（CSS 画的，不占字）。
 *  10. 唯一"加"的字：课表表头「天宫 / 地宫 / 人宫 / 天干」×7，与「六亲」「实例」两张
 *     卡的卡名（原文这两节没有单独节名行）。合计 **60 字**，与掌诀无关（掌诀是删不是加），
 *     全部申报在 校验/_check_cxhelp.js 的 ADD_OK 里，多一个字都会判失败。
 *
 * 样式全在本文件的 <style> 里，一律 cxd- 前缀，app.css / pan.css 一行没动；
 * 类名无一例外都在本文件内定义（校验/_check_cxhelp.js 会核）。
 * ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- 样式 */
  /* 只吃 app.css 已有的主题变量（--surface / --line / --ink-* / --accent* / --el-*），
     所以素白、玄夜、墨玉、铜仪四套主题都会自己跟着走，不用再写第二份。 */
  var CSS = [
    '.cxd-root{font-size:12.5px}',
    /* 分节卡片：只用一根线，不加阴影（与「起盘页/串星页去阴影」同一口径） */
    '.cxd-card{margin:0 0 11px;padding:12px 13px 13px;background:var(--surface);',
    'border:1px solid var(--line);border-radius:13px}',
    '.cxd-card:last-child{margin-bottom:4px}',
    /* 卡片标题：**不写序号** —— 序号也是"加字"，用户要求一个字都不加，
       所以节与节的分界靠这根金色短竖（纯 CSS 画，不占字）。 */
    '.cxd-h{position:relative;display:block;margin:0 0 9px;padding-left:11px;font-size:13px;',
    'font-weight:700;letter-spacing:.16em;color:var(--ink);',
    'font-family:"QM Serif","Songti SC",serif}',
    '.cxd-h::before{content:"";position:absolute;left:0;top:.16em;width:3px;height:.92em;',
    'border-radius:2px;background:var(--accent)}',
    /* 小节标题（原文的「xx：」） */
    '.cxd-sh{position:relative;margin:13px 0 5px;padding-left:9px;font-size:12px;',
    'font-weight:700;letter-spacing:.12em;color:var(--accent)}',
    '.cxd-sh::before{content:"";position:absolute;left:0;top:.2em;width:2px;height:.9em;',
    'border-radius:1px;background:var(--accent-line)}',
    /* 正文 */
    '.cxd-p{margin:0 0 7px;font-size:12.5px;line-height:1.9;color:var(--ink-2)}',
    '.cxd-p:last-child{margin-bottom:0}',
    '.cxd-p b{color:var(--ink);font-weight:700}',
    '.cxd-ar{font-style:normal;color:var(--accent);margin:0 .1em;font-size:.92em}',
    '.cxd-note{margin:5px 0 0;font-size:11.5px;line-height:1.8;color:var(--ink-3)}',
    '.cxd-ver{margin:5px 0 0;font-size:11.5px;letter-spacing:.08em;color:var(--accent)}',
    /* 裸四数（射覆案的 1724）：只有数，没有标签 —— 别替原文加「报数」二字 */
    '.cxd-num{margin:2px 0 7px;font-family:"QM Serif","Songti SC",serif;font-size:15px;',
    'font-weight:700;letter-spacing:.22em;color:var(--ink)}',
    /* 起课四步：号牌 + 正文 */
    '.cxd-steps{margin:1px 0 10px}',
    '.cxd-step{display:flex;gap:9px;align-items:baseline;padding:6px 0;',
    'border-bottom:1px solid var(--line-2)}',
    '.cxd-step:last-child{border-bottom:0;padding-bottom:0}',
    '.cxd-step>b{flex:0 0 27px;padding:1px 0;text-align:center;border-radius:6px;',
    'background:var(--accent-bg);border:1px solid var(--accent-line);color:var(--accent);',
    'font-size:11px;font-weight:700;letter-spacing:0;',
    'font-family:-apple-system,"PingFang SC",system-ui,sans-serif}',
    '.cxd-step>span{flex:1 1 auto;min-width:0;font-size:12.5px;line-height:1.85;color:var(--ink-2)}',
    '.cxd-step>span b{color:var(--ink);font-weight:700}',
    /* 课表：天宫 · 地宫 · 人宫 · 天干 四列 */
    '.cxd-tb{width:100%;border-collapse:collapse;table-layout:fixed;margin:2px 0 9px}',
    '.cxd-tb th{padding:4px 2px 5px;border-bottom:1px solid var(--line);text-align:center;',
    'font-size:9.5px;font-weight:600;letter-spacing:.16em;color:var(--ink-3)}',
    '.cxd-tb td{padding:8px 2px;border-bottom:1px solid var(--line-2);text-align:center;',
    'font-family:"QM Serif","Songti SC",serif;font-size:15px;font-weight:700;',
    'color:var(--ink);letter-spacing:.02em}',
    '.cxd-tb tr:last-child td{border-bottom:0}',
    '.cxd-tb td.cxd-qin{padding:2px 2px 8px;font-family:inherit;font-size:12.5px;',
    'font-weight:600;color:var(--ink-2)}',
    '.cxd-tb td.cxd-stem{color:var(--accent)}',
    '.cxd-el{font-style:normal;font-size:10px;font-weight:600;margin-left:1px;',
    'vertical-align:.12em;opacity:.92;font-family:inherit}',
    /* 五行色（只在神名旁那个小字上落色，正文不上色） */
    '.cxd-wood{color:var(--el-wood)}.cxd-fire{color:var(--el-fire)}',
    '.cxd-earth{color:var(--el-earth)}.cxd-metal{color:var(--el-metal)}',
    '.cxd-water{color:var(--el-water)}',
    /* 十天干数序：5×2 格 */
    '.cxd-g10{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:3px 0 9px}',
    '.cxd-g10>span{padding:5px 0 4px;text-align:center;border:1px solid var(--line-2);',
    'border-radius:7px;background:var(--surface-2)',
    ';font-family:"QM Serif","Songti SC",serif;font-size:13.5px;font-weight:700;',
    'color:var(--ink)}',
    '.cxd-g10>span>i{font-style:normal;font-size:10px;font-weight:400;margin-left:1px;',
    'font-family:-apple-system,"PingFang SC",system-ui,sans-serif}',
    '.cxd-g10>span>em{font-style:normal;font-size:9.5px;font-weight:600;margin-left:2px;',
    'color:var(--accent);vertical-align:.1em;',
    'font-family:-apple-system,"PingFang SC",system-ui,sans-serif}',
    /* 四柱：原文两行（干 / 支）照原序排 2×4 格，列对即柱 —— 只对齐，不重排字序 */
    '.cxd-bz{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin:3px 0 10px;',
    'border:1px solid var(--line-2);border-radius:9px;overflow:hidden;background:var(--line-2)}',
    '.cxd-bz span{padding:7px 0;text-align:center;background:var(--surface);',
    'font-family:"QM Serif","Songti SC",serif;font-size:16px;font-weight:700;color:var(--ink)}',
    '.cxd-bz span.cxd-zhi{font-size:14.5px;font-weight:600;color:var(--ink-2)}',
    /* 五克象：关系 / 象 两列（原文这一块只有一个空行隔开，这里给一道细线，不加字） */
    '.cxd-k5{display:grid;grid-template-columns:auto 1fr;gap:5px 14px;align-items:baseline;',
    'margin:11px 0 2px;padding-top:9px;border-top:1px solid var(--line-2)}',
    '.cxd-k5 b{font-size:12.5px;font-weight:700;color:var(--ink);letter-spacing:.02em}',
    '.cxd-k5 span{font-size:12px;color:var(--ink-2)}',
    /* 列表（人宫五条 / 命造四条断语） */
    '.cxd-ul{margin:1px 0 0;padding:0;list-style:none}',
    '.cxd-ul>li{position:relative;padding-left:13px;margin:0 0 6px;font-size:12.5px;',
    'line-height:1.85;color:var(--ink-2)}',
    '.cxd-ul>li:last-child{margin-bottom:0}',
    '.cxd-ul>li::before{content:"";position:absolute;left:3px;top:.74em;width:3px;height:3px;',
    'border-radius:50%;background:var(--accent-line)}',
    '.cxd-ul>li b{color:var(--ink);font-weight:700}',
    /* 实例：一案一块，块间一根细线 */
    '.cxd-case+.cxd-case{margin-top:11px;padding-top:11px;border-top:1px solid var(--line-2)}',
    '.cxd-cot{position:relative;margin:0 0 7px;padding-left:11px;font-size:12.5px;',
    'font-weight:700;letter-spacing:.04em;color:var(--ink)}',
    /* 案题用**圆点**做记号，与节标题那根金短竖分开（一眼能分出"节"和"案"） */
    '.cxd-cot::before{content:"";position:absolute;left:1px;top:.52em;width:4px;height:4px;',
    'border-radius:50%;background:var(--accent)}',
    /* 类象：名 / 释 */
    '.cxd-dl{margin:0}',
    '.cxd-dl>div{padding:7px 0;border-bottom:1px solid var(--line-2)}',
    '.cxd-dl>div:last-child{padding-bottom:0;border-bottom:0}',
    '.cxd-dt{font-family:"QM Serif","Songti SC",serif;font-size:13px;font-weight:700;',
    'color:var(--ink);letter-spacing:.06em;margin-bottom:2px}',
    '.cxd-dt i{font-style:normal;font-size:10.5px;font-weight:400;letter-spacing:0;',
    'color:var(--ink-3);margin-left:2px;',
    'font-family:-apple-system,"PingFang SC",system-ui,sans-serif}',
    '.cxd-dd{font-size:12.5px;line-height:1.85;color:var(--ink-2)}'
  ].join('');

  /* ------------------------------------------------------------ 课表工具 */
  /* 一节课：3 个六神（可带五行小字）+ 天干；下一行是三个六亲。
     神列的五行色是纯视觉（五行取自定六亲那句），不改一个字。 */
  var WX = {
    大安: 'wood', 留连: 'earth', 速喜: 'fire', 赤口: 'metal', 小吉: 'water', 空亡: 'earth',
    甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth',
    己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water',
    木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water'
  };
  function wxCls(ch) { var w = WX[ch]; return w ? ' cxd-' + w : ''; }
  /* 原文在课表里写过五行的（大安木 / 庚金），把那个字降成小字；没写的就不补 */
  function shen(name, wx) {
    return '<td>' + name + (wx ? '<i class="cxd-el' + wxCls(wx) + '">' + wx + '</i>' : '') + '</td>';
  }
  /* 课表：rows = [[神,神,神,干], [亲,亲,亲]]，第四格的神/干可带五行 */
  function keTable(r1, r2, stemWx) {
    var cells1 = '';
    for (var i = 0; i < 4; i++) {
      var c = r1[i] || { n: '—' };
      cells1 += (i === 3)
        ? '<td class="cxd-stem">' + c.n + (c.wx ? '<i class="cxd-el' + wxCls(c.wx) + '">' + c.wx + '</i>' : '') + '</td>'
        : shen(c.n, c.wx);
    }
    var cells2 = '';
    for (var j = 0; j < 3; j++) cells2 += '<td class="cxd-qin">' + (r2[j] || '') + '</td>';
    cells2 += '<td class="cxd-qin"></td>';
    return '<table class="cxd-tb"><tr><th>天宫</th><th>地宫</th><th>人宫</th><th>天干</th></tr>'
      + '<tr>' + cells1 + '</tr><tr>' + cells2 + '</tr></table>';
  }
  /* 原文字面量「大安木 小吉水 空亡土 庚金」+「妻财   子孙   父母」→ 课表 */
  function keFromText(names, qins, wxs) {
    var r1 = names.split(/\s+/).map(function (n, i) { return { n: n, wx: wxs ? wxs[i] : '' }; });
    var r2 = qins.split(/\s+/);
    return keTable(r1, r2);
  }
  function card(title, body) {
    return '<div class="cxd-card"><div class="cxd-h">' + title + '</div>' + body + '</div>';
  }
  function p(t) { return '<p class="cxd-p">' + t + '</p>'; }
  function sh(t) { return '<div class="cxd-sh">' + t + '</div>'; }
  /* 顺序里那一串箭头：箭头单独上色，字不动 */
  function arrows(t) { return t.replace(/→/g, '<i class="cxd-ar">→</i>'); }

  /* ------------------------------------------------------------ 一 · 顺序 */
  var C2 = p(arrows('大安→留连→速喜→赤口→小吉→空亡→大安→……循环往复。串星课的数是“六”，达到六就完成了一次循环，七是新循环的开端。'))
    + '<p class="cxd-note">这六个卦象的含义，读者全凭联想即可。文章末尾有供参考信息。</p>';

  /* ------------------------------------------------ 二 · 起课（四数示例） */
  var C3 = p('随机随意取四个数 如：1527')
    + '<div class="cxd-steps">'
    + '<div class="cxd-step"><b>【1】</b><span>大安（1），第一卦位天宫，大安落此宫。这种数法叫做“连根数起”，初始的地方，自数一次。</span></div>'
    + '<div class="cxd-step"><b>【5】</b><span>大安（1）→留连（2）→速喜（3）→赤口（4）→小吉（5），第二个卦位地宫，小吉落此宫。</span></div>'
    + '<div class="cxd-step"><b>【2】</b><span>小吉（1）→空亡（2），第三个卦位人宫，空亡落此宫。</span></div>'
    + '<div class="cxd-step"><b>【7】</b><span><b>天干</b>：庚。第四数取天干</span></div>'
    + '</div>'
    + sh('天干数序以及五行')
    + '<div class="cxd-g10">'
    + '<span>甲<i class="cxd-wood">木</i><em>一</em></span>'
    + '<span>乙<i class="cxd-wood">木</i><em>二</em></span>'
    + '<span>丙<i class="cxd-fire">火</i><em>三</em></span>'
    + '<span>丁<i class="cxd-fire">火</i><em>四</em></span>'
    + '<span>戊<i class="cxd-earth">土</i><em>五</em></span>'
    + '<span>己<i class="cxd-earth">土</i><em>六</em></span>'
    + '<span>庚<i class="cxd-metal">金</i><em>七</em></span>'
    + '<span>辛<i class="cxd-metal">金</i><em>八</em></span>'
    + '<span>壬<i class="cxd-water">水</i><em>九</em></span>'
    + '<span>癸<i class="cxd-water">水</i><em>十</em></span>'
    + '</div>'
    + p('<b>定六亲</b>：以天干与三宫卦象的生克定出六亲。大安属木，留连属土，速喜属火，赤口属金，小吉属水，空亡原本不讨论五行属性，但为了模型的简单，故授之以土；')
    + p('<b>六亲</b>：<b>生天干者</b>父母，<b>天干生者</b>子孙。<b>克天干者</b>官鬼，<b>天干克者</b>妻财，<b>同天干者</b>兄弟。')
    + sh('课')
    + keFromText('大安 小吉 空亡 庚', '妻财 子孙 父母', ['木', '水', '土', '金'])
    + '<p class="cxd-note">注：前三个数为0时，按照6来论。最后一个数为0时，按照10来论。</p>';

  /* ---------------------------------------------------------- 三 · 天干论 */
  var C4 = p('天干即为预测主体。所谓的预测主体：占自己的事，自己是预测主体。占自己孩子的事，孩子是预测主体。射覆物品，物品是预测主体。')
    + sh('三宫象')
    + p('天宫为起因，地宫为经过，人宫为结果。天宫为年宫，为上级为长辈为祖业为远方；地宫为月宫，为同辈同事为事业为近处；人宫为日宫，为预测主体。')
    + sh('辩疑论')
    + p('天干本体论是第一本体论，直接代表预测主体。人宫本体论是第二本体论，是基于三宫类象的衍生义。前者的主要作用是规定六亲，后者的主要作用是根据人宫六亲进行利弊的判断。');

  /* ------------------------------------------------------------ 四 · 六亲 */
  var C5 = p('六亲的含义，可以自行联想。例如：父母为父母为贵人为老师，官鬼为官为上级为鬼为小人；文章末尾有参考信息。')
    + sh('六亲相生')
    + p(arrows('兄弟→子孙→妻财→官鬼→父母→兄弟'))
    + sh('六亲相克')
    + p(arrows('兄弟→妻财→父母→子孙→官鬼→兄弟'))
    + '<ul class="cxd-ul">'
    + '<li><b>人宫父母</b>，利学业，化厄。</li>'
    + '<li><b>人宫官鬼</b>，利求官求名，女性的桃花。</li>'
    + '<li><b>人宫兄弟</b>，身体健康，朋友众多。</li>'
    + '<li><b>人宫妻财</b>，利财运，男主桃花。</li>'
    + '<li><b>人宫子孙</b>，利财运，制厄。主桃花性欲。</li>'
    + '</ul>'
    + '<div class="cxd-k5">'
    + '<b>父母克子孙</b><span>绝嗣之象。</span>'
    + '<b>官鬼克兄弟</b><span>管人之象。</span>'
    + '<b>兄弟克妻财</b><span>劫财之象。</span>'
    + '<b>妻财克父母</b><span>辍学之象。</span>'
    + '<b>子孙克官鬼</b><span>失位之象。</span>'
    + '</div>'
    + sh('特别提示')
    + p('空亡。官鬼临空亡，可能反而为吉。空亡把小人忧愁病难空掉了。卦象与六亲同参。占断总思路：六亲为主，卦象为辅。');

  /* ------------------------------------------------------------ 五 · 实例 */
  /* 每个案：案题 →（四柱 / 射覆清单 / 报数）→ 课表 → 断语 → 验语 */
  var K1 = '<div class="cxd-case"><div class="cxd-cot">报数：1158 问成绩</div>'
    + keFromText('大安 大安 小吉 辛', '妻财 妻财 子孙')
    + p('问成绩，问的是学习成绩。父母为老师为学习，两个妻财上卦，妻财克父母，学习当然不好。妻财+大安在天地宫 可能说明你爷爷那一代 到你爸爸那一代 家里都有钱。')
    + '<p class="cxd-ver">果验。</p></div>';

  var K2 = '<div class="cxd-case"><div class="cxd-cot">命造</div>'
    + '<div class="cxd-bz">'
    + '<span>甲</span><span>丙</span><span>庚</span><span>丁</span>'
    + '<span class="cxd-zhi">申</span><span class="cxd-zhi">子</span>'
    + '<span class="cxd-zhi">申</span><span class="cxd-zhi">亥</span>'
    + '</div>'
    + p('有人在群里，请求别人看八字。我当然会看八字，但闲逸之心一动，就起了一课，用串星课给他看。')
    + sh('课')
    + keFromText('大安 速喜 速喜 己', '官鬼 父母 父母')
    + '<ul class="cxd-ul">'
    + '<li>学习蛮好（人宫父母），</li>'
    + '<li>父母也是知识分子（地宫父母），</li>'
    + '<li>爷爷那一辈可能出过官员（天宫官鬼），</li>'
    + '<li>会从事文化网络相关的工作（人宫速喜父母 父母也代表职位 速喜为火 代表文化传播之类）。</li>'
    + '</ul>'
    + '<p class="cxd-ver">除了最后一条是未来信息，皆验。</p></div>';

  var K3 = '<div class="cxd-case"><div class="cxd-cot">射覆，十选一</div>'
    + p('瓶盖、纸牌、纽扣、巧克力、辣条、药膏、耳机、塑料袋、布袋、枸杞。')
    + '<div class="cxd-num">1724</div>'
    + keFromText('大安 大安 留连 丁', '父母 父母 子孙')
    + p('人宫子孙爻那么大概率是食物或者药品。巧克力药膏，枸杞之类。结合全课来分析：两个木上卦，含有木质，那么就排除巧克力与药膏。疑似是枸杞。')
    + '<p class="cxd-ver">果验。</p>'
    + '<p class="cxd-note">（后注：丁火为小物为红物，本身就有枸杞之象。）</p></div>';

  var K4 = '<div class="cxd-case"><div class="cxd-cot">时间：09：53 问张■■财运</div>'
    + keFromText('空亡 留连 空亡 丙', '子孙 子孙 子孙')
    + p('子孙生妻财 但是两个子孙空亡，废矣。留连子孙尚且能生些小财。父母辈给的。')
    + p('空亡又主破财，双空亡主大破，但是她本身就没什么钱，也无所谓大破了。')
    + p('大安速喜小吉为吉，留连赤口空亡为凶，此课一个吉星都没有，生活境遇困难困顿，没有什么福气可以享受。')
    + '</div>';

  var K5 = '<div class="cxd-case"><div class="cxd-cot">报数：9444 法师斗法</div>'
    + keFromText('速喜 空亡 速喜 丁', '兄弟 子孙 兄弟')
    + p('法师王某带领一众法师，对盛某进行法力攻击，以官鬼为损人之事，官鬼不上卦，缺乏实质或直接的进攻性。')
    + p('常以子孙为玄学，空亡也为玄学，但在本处并非同义重复，空亡也有无力之意，王某等一众法师修行浅薄。')
    + '</div>';

  var K6 = '<div class="cxd-case"><div class="cxd-cot">易路歧义</div>'
    + keFromText('赤口 赤口 大安 己', '子孙 子孙 官鬼')
    + p('这是一个占病能否痊愈的课题。按照一般的理路，子孙克官鬼，当然能痊愈。但问题在于如果将人宫当作预测主体，子孙毕竟克人宫，怎么能够痊愈呢？')
    + p('这一节的内容，并非是要说明如何解决这样的歧义，而是任何占卜工具，本质上都是一套符号系统，多义符号天然具有歧义的因子。符号学将歧义视作符号系统内在的生命力。')
    + '</div>';

  var C6 = K1 + K2 + K3 + K4 + K5 + K6;

  /* -------------------------------------------------------- 六 · 六神类象 */
  function dl(name, tag, body) {
    return '<div><div class="cxd-dt">' + name + (tag ? '<i>' + tag + '</i>' : '') + '</div>'
      + '<div class="cxd-dd">' + body + '</div></div>';
  }
  var C7 = '<div class="cxd-dl">'
    + dl('大安', '（阳木）', '代表静。在身体上主肝胆，为尊贵，为婚姻合美，为关系融洽。在性格上，喜时表现为俊秀洒脱，正直大方，仁慈善良，利官近贵；凶时则表现为缺乏主动，懒惰固执，不善变通。')
    + dl('留连', '（阴土）', '代表慢，反复，拖延。在身体上，主脾，为胃，为肠，为消化系统。在性格上，表现为慢条斯理，反复无常，犹豫不决。')
    + dl('速喜', '（阳火）', '代表动，快速。在身体上，主心脏，为血液，为眼睛，在性格上，表现为快速反应，热情开朗，机智灵活，善于变通。')
    + dl('赤口', '（阴金）', '代表吵，意见不和。在身体上，主肺，为呼吸系统，为口舌。在性格上，表现为刚烈，直率，冲动，好争论。')
    + dl('小吉', '（阳水）', '代表尚可，不多，酒色。在身体上，主肾，为膀胱，为泌尿系统，为耳朵。在性格上，表现为温和，变通，智慧。')
    + dl('空亡', '（阴土）', '代表空亡，虚假。在身体上，主脾，为消化系统，为营养代谢。在性格上，表现为无主见，易受外界影响。')
    + '</div>';

  /* -------------------------------------------------------- 七 · 六亲类象 */
  var C8 = '<div class="cxd-dl">'
    + dl('父母', '', '代表父母、长辈、贵人、名誉、学历、文书、合同等。父母用神可以反映一个人的家庭背景、教育程度、社会地位以及与长辈的关系。')
    + dl('官鬼', '', '代表官运、事业、地位、权力、领导能力等。官鬼用神关联着一个人的职业发展、社会影响力以及与官方或正式机构的关系。又为女性之丈夫男友情郎。')
    + dl('妻财', '', '代表财富、财商、财欲、财运、下属下级等。妻财用神关联着一个人已有的资财与赚钱的能力、赚钱的动力，又或者与下属之间的关系。又为男性之妻子女友情人。')
    + dl('兄弟', '', '代表兄弟姐妹、朋友、同事、竞争者等。兄弟用神关联着一个人的社交圈、人际关系以及与同辈之间的互动。')
    + dl('子孙', '', '代表子女、晚辈、创造力、娱乐、健康等。子孙用神可以反映一个人的生育状况、子女运、个人兴趣以及健康状况。')
    + '</div>';

  /* ---------------------------------------------------------------- 出口 */
  var BODY = '<style>' + CSS + '</style><div class="cxd-root">'
    + card('顺序', C2)
    + card('起课', C3)
    + card('天干论', C4)
    + card('六亲', C5)
    + card('实例', C6)
    + card('六神类象', C7)
    + card('六亲类象', C8)
    + '</div>';

  window.CxHelp = {
    /* 正文（卡片本体）：条 / 标题 / 「知道了」由调用方自己拼时用这个 */
    html: BODY,
    /* 整层弹层内容：与 ui.js 原来的 openXkHelp() 一个形状，接线一行就完事 */
    sheet: function () {
      return '<div class="bar"></div><h2>串星<b>课 · 读法</b></h2>'
        + '<div class="sub">顺序 · 起课 · 天干论 · 六亲 · 实例 · 类象</div>'
        + BODY
        + '<button class="btn" style="width:100%;margin-top:12px" id="btnXkHelpOk">知道了</button>';
    },
    /* 校验用：底本八节的节名（顺序即卡片顺序） */
    sections: ['顺序', '起课', '天干论', '六亲', '实例', '六神类象', '六亲类象']
  };
})();
