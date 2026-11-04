# 星曜奇门 XingYaoQiMen

> 纯前端实现的奇门遁甲排盘应用 —— 自研天文历法引擎，零依赖、离线可跑，Android 由极简 WebView 壳承载。

<img src="docs/screenshots/poster.png" alt="星曜奇门海报" width="100%">

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-2.6.0-orange)
![Android](https://img.shields.io/badge/Android-10%2B%20(minSdk%2029)-blue)

## 项目简介

星曜奇门是一套**从零自研**的奇门遁甲排盘工具。核心排盘引擎完全用浏览器原生 API 实现：

- 天文层手写 VSOP87 太阳视黄经、月亮黄经、节气交节时刻（不是正午采样）、朔望与 ΔT 修正；
- 历法层自实现干支纪日、四柱、农历（冬至在十一月 + 无中气置闰）；
- 排盘层支持拆补法定局、九宫布盘、八门八神、空亡驿马、伏吟反吟；
- 判读层覆盖门迫门制、六仪击刑、三奇得使、干格、三遁等格局；
- 界面支持四套主题、串星课、长生象义、真太阳时等进阶功能；
- 截图分享用 Canvas 2D 把盘面重画成 PNG，不依赖任何第三方库。

**零依赖**：无 jQuery / 无框架 / 无 CDN，断网也能完整运行。

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

构建脚本内置质量门禁（串星集成 88 条、真太阳时 14 条、墓星 38 条、紫微 145 条），
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
node 校验/_check_ziwei.js       # 紫微安星：145 过

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
└── docs/           # 项目文档（开发记录 / 交接）
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
