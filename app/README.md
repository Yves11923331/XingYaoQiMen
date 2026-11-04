# 星曜奇门 App · 正式构建说明（2026-10-21）

> **正式版定调**：本目录 `app/` 是唯一正式工程（原「方案A 半原生壳」已转正）。
> 包名 `com.momen.xingyaoqimen`，签名 `../密钥/xingyaoqimen.jks`（别名 `xingyao`）。
> **每次出包 versionCode 必须严格递增**，否则覆盖安装会失败。

## 一键构建

```bash
cd app   # 仓库根进入
python3 build_xingyao.py
```

产物：`out/星曜奇门-<版本>.apk`（当前 **2.6.0 / 182**，约 576 KB）。

## 版本号

- `versionName`（显示）：`2.6.0` —— 字符串，`-a` 这类后缀合法；
- `versionCode`（内部）：`182` —— **必须是递增整数**，覆盖安装只看它；
- 文件名：`星曜奇门-2.6.0.apk`（不带空格，避免命令行/分享链接踩坑）。

## 真源在哪

| 内容 | 真源 | 说明 |
|---|---|---|
| 前端 | `../web/` | **改前端一律改这里**，构建时复制并清洗到 `build/www/` |
| 共享底座 | `../web/js/core.js` | 状态 / `$` / `toast` / 常量 / 工具（window.App） |
| 页面逻辑 | `../web/js/ui.js` | 已按页面拆成 initCommon / initHome / initCx / initPan / initSet / initFinish |
| 原生壳 | `android/src/.../MainActivity.java` | WebView + 启动画面 + 错误页 + 返回键 + 截图/定位/选图 |
| 清单 | `android/AndroidManifest.xml` | 包名 `com.momen.xingyaoqimen`，minSdk 29 / targetSdk 34 |
| 启动图 | `android/res/drawable-*/splash_logo.webp` | 从图标裁切放大后的 5 档，透明底 |
| 密钥 | `../密钥/xingyaoqimen.jks` | 别名 `xingyao`，口令在 `../密钥/密码.txt` |

## 构建时做的清洗（`stage_www()`）

1. 排除 `设计-*.html`（设计稿不进包）
2. **剥掉所有 `?v=` 查询串** —— `file://` 下没必要
3. 把「关于」里的 `<div class="sub">版本 …</div>` 改成包版本
4. 清掉 `*.bak*` / `*~` 备份文件（曾把 153 KB 的 ui.js 备份打进包）

## 启动画面

- 冷启动第一帧：`themes.xml` 的 `windowBackground`（`splash_bg.xml` = 品牌底 + 120dp `splash_logo`）
- `MainActivity` 再叠一层同样的 splash；`onPageFinished` 后**至少展示 900ms**，再 280ms 淡出
  （用户反馈「出现和消失都太快」后加的；常量 `SPLASH_MIN_MS` / `SPLASH_FADE_MS`）

## 覆盖安装三件套

同包名 + 同证书 + 更高 versionCode。

```bash
# 核对签名是否一致
LANG=C.UTF-8 java -jar /usr/share/java/apksigner.jar verify --print-certs out/星曜奇门-2.6.0.apk
```

## 工具链（构建环境需装配）

```
aapt       /usr/bin/aapt
zipalign   /usr/bin/zipalign
ecj        /root/dl/ecj.jar
r8(D8)     /root/at/r8.jar
apksigner  /usr/share/java/apksigner.jar
android.jar /root/at/android.jar
```

各组件获取方式见仓库根 README「本地构建工具链」；云端构建由
`.github/workflows/build.yml` 自动装配。中文路径下 java 工具一律先拷到
`/root/at/`，并 `LANG=C.UTF-8`。
