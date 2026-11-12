# 校验脚本

以前这些脚本都丢在 `/root/`（容器重启会清掉，只留 `at/`、`dl/` 两份 jar）——
从第十七轮起，**每轮新写的自检脚本在这里留一份档**，改完算法/界面直接重跑。

## 这一轮（转盘禽芮「天禽寄干」那一格）

```bash
# ① 十干克应那条寄干之格：转盘 1080 盘 + 飞盘 81 盘 + 5 个真日期，逐宫查条数与天干
node 校验/_check_keying_mid.js

# ② 「看天盘干的判断」两干参论的独立复算对表（2788 盘，另抄一份古籍表来比）
node 校验/_check_heaven_stems.js

# ③ 界面层（jsdom，走"点起盘 → 点宫位"的真实手势路径，26 条断言）
npm install jsdom --prefix /root/dsh-dom     # 只需一次
node 校验/_walk_keying_mid.js
```

脚本都按绝对路径读 `web/js/`，在哪个目录跑都行（脚本里写死了项目路径）。

## 老脚本去哪儿了

`_valid_qimen.js`、`_valid_astro.js`、`_valid_lunar2.js`、`_valid_keying.mjs`、`_valid_layers.mjs`、
`_valid_zhirun.mjs`、`_valid_nodes.js`、`_walk_v3/v5.js`、`_walk_loc.js`、`_walk_shot.js`、
`_walk_layers.js`、`_walk_fly.js`、`_walk_bg.js`、`_walk_apk.js`、`_audit_plates.js`、`_fuzz1000.js`
—— **已随容器重置丢失**（2026-09-18 查过，`/root` 里只剩 `at/`、`dl/`）。项目记录里那些"全绿"数字是当时的实测值。
要重建的话从对应轮次的描述 + 本节的两个新脚本当模板写。

## 运行时探针（2026-10-07 新增 · 改界面后必跑）

```bash
python3 校验/_probe_runtime.py        # 测 web/ 源码
python3 校验/_probe_runtime.py apk    # 测 app/out 里最新那个包 —— 交付前用这个
```

无头浏览器真点一遍：加载（查 console/pageerror）→ 点「起盘」进盘面页、#panHost 非空 →
点「› 下一时辰」四柱更新 → 触发串星课 · 读法弹窗并确认展开。全过打印 ✓ 并返回 0。

> ★ 2026-10-28：本机 python 侧没有 playwright（`import playwright` 失败），另写了
> **`校验/_probe_runtime.js`**（node + playwright-core），同一套四步手势，另加一条
> 「阴盘 · 空亡/驿马印章不得压到八神字」的几何断言。`BASE` 也随之改成按脚本位置推
> （工程目录曾整体搬过一次，脚本里写死的绝对路径已改成按脚本位置推导 `BASE`）。
> ```bash
> NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_probe_runtime.js [apk]
> ```


**为什么非要有它**：有一次替换弹窗函数时行号错位，把注释的 `*/` 吃掉了，
未闭合的 `/*` 让后面（含起盘初始化、openXkHelp 本身）全变成注释 ——
`node --check` 通过、jsdom 自检也全绿，上机才发现「起盘啥都点不了」。这类故障只有真点才现形。

配套：`python3 app/patch_xkhelp.py` 是读法弹窗的安全替换脚本（先注释后函数 + 自检），
`--verify` 可以顺带把探针跑掉。

---

## 引擎移植验收（已废弃 · 2026-10-18 晚删除）

> 原生版、它的 Java 引擎移植（`app/android/src/.../engine/`）以及这套对拍工具 `engine-port/`
> 已按「以后以前端 app 为主」的决定**整目录删除**。
> 前端唯一的引擎在 `web/js/`；排盘正确性现在靠 `_check_chuanxing.js`（jsdom 真点）+
> `_probe_runtime.py`（无头浏览器真点）兜底。历史验收数字（4104 条节气 / 1986 行排盘 / 600 行格局 /
> 300 组星曜，全零差异）见 `项目记录.md`。

## 插件 · 墓星（2026-10-21 新增）

```bash
NODE_PATH=/root/dsh-dom/node_modules node 校验/_check_mu.js   # 38 过 / 0 败
```

锁的是墓星判定口径：墓支表、星/门逐项、上限 3 枚、1080 域遍历
（四正宫与中五宫零墓星、每条五行的墓支必须落在该宫纳支里）、
转盘禽芮宫"同宫两枚星"必现、飞盘必为 0。已接进 `build_xingyao.py` 门禁第 0 步。

## 插件 · 紫微（2026-10-21 新增）

```bash
NODE_PATH=/root/dsh-dom/node_modules node 校验/_check_ziwei.js   # 73 过 / 0 败
```

对表来源是开源库 **iztro**（SylarLong/iztro）的官方测试：`getStartIndex()`（2023-08-01 各时辰紫微/天府宫序）、
`getMajorStar()`（2023-03-06 辰时十四主星逐宫 + 亮度）、癸年四化。另跑 6060 盘全域：
每盘十四颗不缺不重、单宫最多 4 颗。已接进 `build_xingyao.py` 门禁第 0 步。

## 阴盘 · 版面与印章（2026-11-12 定版）

```bash
# 预览/量测类脚本要真页面：先在 web/ 下起静服务（受管后台 job，别用 nohup）
cd web && python3 -m http.server 8767 --bind 127.0.0.1

# ① 扫一批阴盘：空亡+驿马同宫的宫数、印章与八神紧字框 / 暗干的重叠面积（应为 0）
NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_probe_yin_seal.js

# ② 导出图单盘（canvas 真出图，存 PNG）
NODE_PATH=... node 校验/_probe_yin_export.js 2026-01-01T04:00 校验/_yin_export_after.png
```

**当前口径（2026-11-12 定版）**：阴盘整体并入**标准盘**——神/星/门/天地盘干、空亡/驿马印章
全部与拆补/置闰同一套，只有两处不同：① 暗干（隐干）排在本宫**星曜（政余）那一行**的槽位
（左下角 `left:5 / bottom:4`、`.9em`、靠左一行）；② 阴盘不排政余、插件一律不入。

历史：2026-10-28 的「暗干排盘外一圈（左 4/3/8 · 右 2/7/6 · 上 9 · 下 1）+ 盘面收 48px」
与 2026-11-11 的「宫底居中无声落字」都已废弃；**外圈那套死代码**（`#qmRing` / `.qm-ring` /
`.qm-rg` / `has-ring` / `renderRing` / `paintRing` / `RING_W` / 阴盘 480px 最小高度）
已于 2026-11-12 清理干净，`_preview_yin_ring.js`、`_preview_yin_shift.js` 也一并删除。
`_check_chuanxing` 的阴盘段随之改成「8 枚 `.qm-yin-agan` 在本宫左下角 / 无 `.qm-rg` /
空亡是「空亡」二字印章」。

## 天地盘干对齐（2026-11-03 新增 · 改盘面行排布后必跑）

```bash
NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_check_stem_align.js
```

锁「同一宫天盘干列右缘 == 地盘干列右缘」。320/340/360/375/390/412/430 七档标准盘
+ 360 阴盘 + 360 老 UI，逐宫量两行 `.qm-gans` 的右缘差，并查星名/门名有没有压到干字。
当前 9 组全过（最大差 0.00px）。背景见 `项目记录.md` 的 2026-11-03 条目：
flex + space-between 在窄屏退化成 flex-start，两行干列差一个星名宽度（2.02px）。
预览图：`_预览-天地盘干对齐-修复前后-20261103.png`。
