# 校验 · 门禁与复核脚本

> 改完 `web/` 必跑。所有脚本都按**相对路径**读 `web/`（`process.env.XYQ_ROOT || process.cwd()`），
> 在工程根跑就行。最后更新：2026-11-13 · 3.2.6。

## 0. 一次性准备

```bash
export NODE_PATH=/root/dsh-dom/node_modules          # jsdom / 门禁依赖
# 需要真浏览器的脚本：playwright 在 DSH 自带包里
export PW=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules
```

## 1. 八道构建门禁（`python3 app/build_xingyao.py` 第 0 步自动跑）

| 脚本 | 管什么 | 当前基线 |
|---|---|---|
| `_check_css.js` | 代码里用到的类名 CSS 全有定义；「关于」版本锚点 `版本 1.1.N` 还在 | 全过 |
| `_check_chuanxing.js` | 串星页面层：三档 / 九星 / 读法入口 / 中宫同显 / 导出（真 index.html 里点） | 375 过 / 0 败 |
| `_check_cx_engine.js` | 串星引擎：四数→课、六亲、两套译法、不随盘面变、随机分布 | 253 过 / 0 败（1 条预期跳过） |
| `_check_cxhelp.js` | 读法七节正文与底本逐字 | 全过 |
| `_check_license.js` | 「关于 → 开源声明」只留字体一条 + 许可全文随包 | 56 过 / 0 败 |
| `_check_truesolar.js` | 真太阳时 / 统一时间 | 14 过 / 0 败 |
| `_check_mu.js` | 墓星判定（`Q.muAt`） | 38 过 / 0 败 |
| `_check_ziwei.js` | 紫微安星 | 145 过 / 0 败 |

> `_check_cx_engine` 的 M5 是统计断言（6×6 卡方，p>0.001），偶有抖动；
> 红了先重跑一次，**连续两次红才是真问题**。

## 2. 复核组（`_review-t7/`，非门禁但应收绿）

```bash
cd web && (python3 -m http.server 8799 --bind 127.0.0.1 >/dev/null 2>&1 &) ; cd ..
NODE_PATH=$PW node 校验/_review-t7/p9-colors.js     # 43/0  五行色 == --el-*
NODE_PATH=$PW node 校验/_review-t7/p10-export.js    # 26/0  导出图版式（含 renderBoth 中宫课）
NODE_PATH=$PW node 校验/_review-t7/p11-cross.js     # 60/0  串星课 == 盘面 跨组件同色
pkill -f "http.server 8799"
```

## 3. 运行时探针

```bash
# 源码（加载 → 起盘 → 下一时辰 → 串星课弹层）
NODE_PATH=$PW node 校验/_probe_runtime.js
# 打出来的包（同上，但只 27 条：包内资产路径/版本）
NODE_PATH=$PW node 校验/_probe_runtime.js apk
```

## 4. 一次性工具（留档用，不再随轮维护）

- `_check_stem_align.js` 天地盘干对齐；`_probe_runtime.py` 旧版探针（已被 .js 取代）
- `_gen-license-js.js` 生成 `web/licenses/licenses.js`（改许可全文后跑）
- `_preview_*` / `_probe_*`（sizhu、sxm、yin、layers、changshengchi）/ `_render_sxm.js` /
  `_shot_*`：对应设计轮次的截图与探针，参数见文件头注释
- `_review-t7/p1–p8`：复核组的其它判据（颜色、版式、交互），多数依赖 8799 端口

## 5. 报告与资料（读，不跑）

| 文件 | 内容 |
|---|---|
| `复核报告-t7-20261113.md` | 独立复核（四点判据 + 改前基线） |
| `代码审查-死代码-20261113.md` | 全库死代码/孤儿扫描的方法与账（3.2.6 又删了一批，见 §6） |
| `串星课-规则口径-20261113.md` | 串星课口径（四数、连根、六亲、六神/九星、边界） |
| `多引擎校对报告-2026-11-11.md` | 与五个开源/在线引擎的逐盘对表 |
| `星曜九星同宫-时刻表.md`、`星曜容量-实测.md` | 星曜插件实测 |
| `资料-七政古义今义.md`、`资料-现代改写与西学影响.md` | 七政/星曜的文献与改写资料 |
| `_strays.json` | 死代码扫描的机器账（symbol / 引用数 / 处置） |

## 6. 3.2.6 这一轮删掉的死代码

`cx.js domainOf`、`qimen.js XUN_ZHI`、`ui.js CX_NM / LIC_KEYS / cxLessonFromChart`、
`snapshot.js baseOf` + `metrics()` 六个未消费字段、CSS `.qm-mu*` / `.cxnote` / `.card.foldable*`。
判据见 `代码审查-死代码-20261113.md` §1–§2（引用数 =1 才动）。
