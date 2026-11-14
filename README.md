# 星曜奇门 XingYaoQiMen

> 纯前端实现的奇门遁甲排盘应用 —— 自研天文历法引擎，零依赖、离线可跑，Android 由极简 WebView 壳承载。

<img src="docs/screenshots/poster.png" alt="星曜奇门海报" width="100%">

[![Build APK](https://github.com/Yves11923331/XingYaoQiMen/actions/workflows/build.yml/badge.svg)](https://github.com/Yves11923331/XingYaoQiMen/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-3.2.8-orange)
![Android](https://img.shields.io/badge/Android-10%2B%20(minSdk%2029)-blue)

## 下载

最新版 **3.2.8（226）**，已签名、可直接覆盖安装：

| 文件 | 大小 | SHA-256 |
|---|---|---|
| [`dist/星曜奇门-3.2.8.apk`](dist/星曜奇门-3.2.8.apk) | 629 KB | `217f0454…`（见 `dist/README.md`） |

> 包名 `com.momen.xingyaoqimen`，minSdk 29（Android 10+）。
> 自行构建见文末「构建」；签名密钥不入库，按说明自备即可。

## 项目简介

星曜奇门是一套**从零自研**的奇门遁甲排盘工具。核心排盘引擎完全用浏览器原生 API 实现：

- 天文层手写 VSOP87 太阳视黄经、月亮黄经、节气交节时刻（不是正午采样）、朔望与 ΔT 修正；
- 历法层自实现干支纪日、四柱、农历（冬至在十一月 + 无中气置闰）；
- 排盘层支持拆补法定局、九宫布盘、八门八神、空亡驿马、伏吟反吟；
- 判读层覆盖门迫门制、六仪击刑、三奇得使、干格、三遁等格局；
- 界面支持四套主题、串星课、长生象义、真太阳时等进阶功能；
- 截图分享用 Canvas 2D 把盘面重画成 PNG，不依赖任何第三方库。

**零依赖**：无 jQuery / 无框架 / 无 CDN，断网也能完整运行。

<p align="center">
  <img src="docs/screenshots/home.png" width="31%" alt="起盘页">
  <img src="docs/screenshots/chart.png" width="31%" alt="九宫盘">
  <img src="docs/screenshots/lesson.png" width="31%" alt="串星课">
</p>

## 这也是它独有的

### 串星课：一套自创的课式

不是传统教材里的课式，是本软件自定的一套读法：

| 格 | 取象 |
|---|---|
| 天宫 | 值符星 |
| 地宫 | 时干所落之宫的星 |
| 人宫 | 值使门所在宫之星 |
| 主体 | 时干（甲时**照书「甲」**；只有找地宫星时才用旬首之仪去盘上定位） |

下面三格给出三宫对主体的**六亲**关系。三档起课：**时间**（默认，四数从这一刻的
农历与时干支直译）、**数字**（四个 1–2 位数字，0 也认）、**随机**（Web Crypto 无偏抽样，
六神 1–6 / 九星 1–9 两套域）。第四节「九星」勾选后，同组四数改读九星、**六亲跟着重算**，
课页与设置页都不再出现第二个入口。

「读法」七节（顺序 · 起课 · 天干论 · 六亲 · 实例 · 六神类象 · 六亲类象）内联在课页里，
正文与底本逐字相同。

**盘面同显**：课直接画进**中宫**（角标「串星课」+ 三宫 + 时干），与九宫同框而**不动盘的
尺寸与位置**；屏幕与「截图」出的 PNG 走同一套比例，课只作注脚、不抢宫位字。只时家盘
与阴盘显示（心盘与年/月/日家给不出四数，不显）。

### 插件：一个文件就是一个功能

往 `web/plugins/` 放一个 JS、调用一次 `Plugins.register({...})`，主程序就会自动在
「设置 → 插件」里生成开关，并把内容渲染进盘面与导出图，**不用改主代码**。
插件可以挂在宫位，也可以接管抬头四柱；`exclusive` 的插件会自动让其他插件让位。
**阴盘默认也适配**：插件默认在所有盘（含阴盘）渲染；只有排不进去的特殊插件才排除，
目前只有长生尺（标了 `blockInYin`）—— 这是硬规矩，不是开关。
契约见 [`web/plugins/README.md`](web/plugins/README.md)。

仓库自带六个：

| 插件 | 做什么 |
|---|---|
| 长生尺 | 每宫补一条十二长生尺：天盘干、地盘干各一轨，十二阶成刻度，点亮所临之阶；按标准盘几何排，阴盘不适配 |
| 浑仪 | 截图整张换成浑仪盘：八宫占八向、五层成五环，星曜按真实方位落在外环 |
| 日月年家 | 打开后起盘页出现「时家 / 日家 / 月家 / 年家」四层切换 |
| 墓星 | 星门临墓之地生一枚墓星：黑色墓碑角标，与空亡 / 马星同一行，一宫最多一枚；只标其象，不改事物本义 |
| 四柱 | 抬头四柱换一种排法：五行色、发丝框、柱间竖线 |
| 虚实法 | 四柱地支与宫位纳支对照：有支的宫（实）宫卡边框加深，没有的（虚）变浅；中五恒虚 |

<p align="center"><img src="docs/screenshots/plugins.png" width="46%" alt="插件设置"></p>

### 象义：盘面符号的万物类象

七类共 **68 条**：九星 / 八门 / 八神 / 八卦 / 十干 / 十二支 / 宫位。
每条给断语、人物、身体、性情、事象，并互相关联——点「天蓬」能跳到「玄武」「坎 1 宫」。
五行与方位直接对齐引擎表（`STAR_WX` / `GATE_WX` / `PAL_WX` / `PAL_DIR`），
盘面与象义不会互相打架。按通行口径编写，不逐字摘录某部典籍，也不替它编典据。

<p align="center"><img src="docs/screenshots/xiangyi.png" width="46%" alt="象义查询"></p>

### 透明背景与可选的导出底图

- 可设一张整屏底图：遮罩 0–90% 压住画面保证字清楚，盘面不透明度 5–100% 让底图透出来；
  顶栏、底栏、卡片在四套主题下都会换成半透，底图不会被「挖」出一块灰底。
- 导出图还能另选两张底图：**奇门盘一张（竖 1000×1370）、串星课一张（横 1000×460）**，
  导出时按各自比例铺满裁切，不透明度与屏幕同一档——看到什么就导出什么。
- 选图后进裁剪框，可拖动定位、滑块或双指缩放。

<p align="center"><img src="docs/screenshots/look.png" width="46%" alt="背景与导出底图设置"></p>

## 界面与交互

移动端优先的手感是这一版的重点，全部用原生 CSS/JS 实现，没有引入动画库：

- **四套主题**：素白 / 玄夜 / 墨玉 / 铜仪。辅助文字与金色强调色按小字号对比度校准，
  装饰线单独走令牌，不会为了“好看”牺牲可读性。
- **底栏滑块**：位置与尺寸取当前按钮的**实测盒子**（`offsetLeft/Top/Width/Height`），
  不再用“内容宽 ÷ 3 × 序号”估算，切换落点与文字/图标中心严格重合。
- **页面切换**：轻量交叉淡化 + 6px 上浮（260ms）。旧页用固定层托住淡出，
  没有空白帧；全程不用 `filter`、不做整屏位移，合成负担最低。
- **换柱提示**：切换时辰/日/月/年时，变化的那一柱做**分体翻牌**——
  上半先掀、下半后落（约 260ms），其余三柱与盘面纹丝不动。
  翻的是重建前克隆的旧牌面，不参与布局，盘面测量不受影响。
- **时间状态**：选过具体时刻后，那排分段的「此时刻」会自动变成「返回时」，
  点它即回到当前时刻；不在时间模式下自动复原。串星页的「时间」档同一套逻辑
  （选过大时刻后变成「返回时」，点它回到此刻）。
- **返回栈**：裁剪层 → 弹层 → 串星课 → 当前页，一次返回只退一层；
  通用弹层带对话框语义、焦点进入与恢复，关闭后移出读屏与键盘范围。
- **设置页**：四个分类分别记忆滚动位置，切分类、从底栏离开再回来都停在原处。
- **输入校验**：经纬度整串校验（`123abc`、超范围都会就地提示），
  保留用户输入、不静默截值、不误重排盘面。

另外还有：**阴盘**（数字定局 + 暗干；暗干坐在星曜那一行的槽位，与标准盘同一套行）、**心盘**（先点宫定符号再反推全盘）、
**真太阳时**（经度时差 + 均时差，标准时与换算结果同屏）。

## 快速开始（网页版）

任意静态服务器即可：

```bash
cd web
python3 -m http.server 8766 --bind 0.0.0.0
# 浏览器打开 http://127.0.0.1:8766/index.html
```

也可以直接把 `web/` 目录丢进任意静态托管（GitHub Pages、Netlify 等）。

## 构建 Android APK

### 本地构建

```bash
cd app
python3 build_xingyao.py
# 产物：app/out/星曜奇门-<版本>.apk
```

构建脚本内置七道质量门禁（CSS / 串星页面层 375 条 / 串星引擎 253 条 / 读法 / 开源声明 56 条 /
真太阳时 14 条 / 墓星 38 条），
任一失败即中止，不会产出坏包。

**签名密钥需要自备**：本仓库按安全原则不包含签名密钥。构建前请自建：

```
密钥/
├── xingyaoqimen.jks    # 你的签名密钥（别名 xingyao）
└── 密码.txt            # 密钥口令（明文一行）
```

> 覆盖安装已发布的正式版需要与官方包同一把钥匙；自用 / 测试场景可随意生成新密钥。

### 本地构建工具链

| 组件 | 位置 | 获取方式 |
|---|---|---|
| JDK 17 | 系统 PATH | `apt install openjdk-17-jre-headless` |
| aapt / zipalign | 系统 PATH | `apt install aapt zipalign` |
| apksigner | `/usr/share/java/apksigner.jar` | `apt install apksigner` |
| ecj.jar | `/root/dl/ecj.jar` | Maven Central `org.eclipse.jdt:ecj` |
| D8/R8 | `/root/at/r8.jar` | Google Maven `com.android.tools:r8` |
| android.jar (API 34) | `/root/at/android.jar` | Android SDK Platform 34 |

### 云端构建（GitHub Actions）

本仓库带 `.github/workflows/build.yml`：在 GitHub 网页「Actions → Build APK」手动触发，
自动装配上述工具链、生成临时调试签名、执行同一套门禁并产出 APK artifact。

## 质量校验

```bash
# 排盘回归（Node 环境）
node 校验/_check_chuanxing.js   # 串星集成：88 过
node 校验/_check_css.js         # 样式门禁
node 校验/_check_truesolar.js   # 真太阳时：14 过
node 校验/_check_mu.js          # 墓星判定：38 过

# 无头浏览器真点一遍（加载 → 起盘 → 下一时辰 → 串星课弹窗）
python3 校验/_probe_runtime.py          # 测 web/ 源码
python3 校验/_probe_runtime.py apk      # 测 app/out 最新包
```

## 目录结构

```
.
├── web/            # 前端真源（唯一引擎）
│   ├── index.html
│   ├── css/        # 四套主题令牌 + 外壳/组件 + 九宫盘
│   ├── js/         # astro / lunar / qimen / patterns / store / snapshot / ui
│   ├── fonts/      # 字体子集
│   └── plugins/    # 插件
├── app/            # Android WebView 壳（最小化）与构建脚本
│   ├── android/    # MainActivity + 清单 + 资源
│   └── build_xingyao.py
├── 校验/           # 285 条回归自测 + 无头浏览器探针
└── docs/           # 文档与配图（screenshots/ 为 README 截图）
```

## 技术架构

| 模块 | 职责 |
|---|---|
| `web/js/astro.js` | 儒略日、太阳视黄经（VSOP87）、月亮黄经、节气交节时刻、朔、ΔT |
| `web/js/lunar.js` | 干支纪日、四柱、农历（无中气置闰） |
| `web/js/qimen.js` | 定局（拆补法）、地盘、天盘、八门、八神、空亡、驿马、伏吟反吟 |
| `web/js/patterns.js` | 格局判读 |
| `web/js/store.js` | 本地存储（设置 + 盘面记录），带内存兜底 |
| `web/js/snapshot.js` | Canvas 2D 盘面截图（PNG） |
| `web/js/ui.js` | 界面与交互 |

## 许可证

[MIT](LICENSE) © 2026 魔门 (Momen)

## 免责声明

本项目为传统文化研究工具，排盘结果仅供学习与参考，不构成任何决策建议。
