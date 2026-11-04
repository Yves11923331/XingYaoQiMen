# 星曜奇门 · 插件开发契约（真插件 · v1）

> 这是「预留 AI 写插件」的那道口子。**AI / 人照这份规范，往 `web/plugins/` 丢一个 JS 文件，
> 主程序就能自动识别它、在「设置 → 插件」里出开关、并在盘面和导出图里渲染，不用碰主代码。**
> 运行时是 `web/js/plugins.js`（`window.Plugins`）。

## 一、插件长什么样

一个插件 = 一个文件 `web/plugins/<id>.js`，内容是一次 `Plugins.register({...})` 调用。

```js
Plugins.register({
  id: 'hello',          // 唯一英文 id，也是开关键（settings.plugins.hello）
  name: '示例',          // 设置页卡片标题
  desc: '卡片正文（说明这个插件干嘛）',
  note: '卡片小注（可选，次要说明）',
  flags: {              // 能力标志（可选，见下）
    blockInYin: true,   // 不入阴盘
    // exclusive: true, // 独占（开着抵掉星曜 + 其他插件让位）
  },
  palace: function (pal, ctx) { return '...html...'; },  // 盘面（DOM）
  snap: function (pal, ctx) { /* 导出图（Canvas） */ }   // 可选
});
```

## 二、manifest 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 唯一英文标识；同时是开关键 |
| `name` | string | ✅ | 设置页标题 |
| `desc` | string | ✅ | 卡片正文 |
| `note` | string | ❌ | 卡片小注 |
| `flags` | object | ❌ | 能力标志 |
| `palace` | fn | ❌ | 盘面钩子，返回塞进宫的 HTML |
| `snap` | fn | ❌ | 导出图钩子（Canvas） |
| `head` | fn | ❌ | **抬头（四柱）钩子**，返回整块抬头 HTML（2026-11-01 新增） |
| `snapHead` | fn | ❌ | 抬头在导出图里的画法，返回画出来的高度 |

`flags`：
- `blockInYin: true` —— 插件**不入阴盘**（硬规矩，凡往盘面加东西的插件都该标）
- `exclusive: true` —— **独占**：开着时主程序自动抵掉星曜，其他插件一律让位（紫微用）
  ⚠ 独占只管 `palace` / `snap` 那条线；**抬头通道（`head` / `snapHead`）不吃独占让位** ——
  紫微开着时，四柱该换皮照样换皮（紫微说的是星曜，不关抬头的事）。
- `layers: true` —— **能力标志**：打开这个插件 = 允许起盘页的「时家 / 日家 / 月家 / 年家」四层切换
  （`web/plugins/layers.js`，2026-11-02 从设置里的「日月年家」搬过来）。
  宿主 `ui.js` 的 `applyLayers()` 读 `Plugins.flagOn('layers')`，不写死插件名；
  这类标志只是"宿主放出一块功能"，插件不需要实现任何钩子。`flagOn(name)` 对任一启用的插件逐个查。

## 三、钩子签名

### 3.1 palace(pal, ctx) → 返回 HTML 字符串

`pal`：宫位号（1–9，洛书：坎1 坤2 震3 巽4 中5 乾6 兑7 艮8 离9）。
`ctx`（只读上下文）：

| 字段 | 说明 |
|---|---|
| `ctx.chart` | 当前排盘结果（`Qimen.cast` 的返回值，含 `plate` / `calendar` / `meta`） |
| `ctx.chartSub` | `'pan'`（转盘/飞盘）或 `'yin'`（阴盘） |
| `ctx.p` | 当前宫那一格的数据（`chart.plate` 里 `pal` 对应项：`star`/`gate`/`deity`/`mid`/`earth`/`earth2`/`agan`…） |
| `ctx.pal` | = pal |
| `ctx.zw` | 紫微数据（`Ziwei.cast(calendar)` 的结果；插件若没启用可能为 null） |
| `ctx.Q` | 排盘引擎 `Qimen`（要查表用它） |
| `ctx.esc` | HTML 转义函数（拼文字前先转义） |

返回的 HTML 会插进该宫的宫位块内（在八门行之后、星曜带之前）。要绝对定位的话自己带类名 + 在
`web/css/pan.css` 加样式（或插件自带 `<style>`，但不推荐，样式尽量进主 css）。

### 3.2 snap(pal, ctx) → 无返回值（直接画）

导出图走 **Canvas 重绘**，所以盘面（DOM）和导出图是两套。`ctx` 额外多：

| 字段 | 说明 |
|---|---|
| `ctx.cv` | 画布 canvas |
| `ctx.ctx` | 2d 上下文 |
| `ctx.x, ctx.y` | 该宫左上角（逻辑坐标） |
| `ctx.S` | 宫边长 |
| `ctx.SH` | 宫高 |
| `ctx.P` | 调色板（`palette()` 的结果：`P.ink` / `P.ink2` / `P.inkSoft` / `P.el.wood` / `P.hair`…） |
| `ctx.draw` | 便捷绘制辅助（可选，见下） |

⚠ DOM 与 Canvas 两套必须**同位置同形制**。改了一边，另一边也要改。

### 3.3 head(ctx) → 返回整块抬头的 HTML（2026-11-01 新增）

> 用户口径：「四柱ui」——把盘面页抬头那排四柱换一种排法。

抬头不在九宫里，所以是**单独一条通道**，不聚合：只认第一个有 `head` 的启用插件。

- 接管的范围是 `#plabel`（柱名行）＋ `#gz`（干支矩阵）整块：插件要自己吐柱名行，
  主程序会隐藏默认的 `#plabel` 并把 `#gz` 上的 `.pillars` 类摘掉（否则整块会被塞进
  4 列网格的第一列）。**别只吐干支**。
- 阴盘照样拦（`blockInYin`）；手动起局没有年月日，插件应返回 `''` 交回默认（画「—」）。
- 三层盘（年/月/日家）：`ctx.chart.layer` 是 `'nian' | 'yue' | 'ri'`，
  只有本层那一柱有值，其余 `ctx` 里的 `calendar.index` 字段是 `-1`。

`snapHead(o)` 对应导出图：

| 字段 | 说明 |
|---|---|
| `o.chart` / `o.chartSub` | 当前盘 |
| `o.P` | 调色板（同 3.2） |
| `o.ctx` | 2d 上下文 |
| `o.x, o.y, o.w` | 抬头矩形（当前 `y` 在标题行之下，`w`＝满宽 912） |
| `o.fontSerif` / `o.fontSans` | 主程序用的那两套字体栈 |

**返回值＝画出来的高度**（像素）。默认四柱是 `176`（标签 26 ＋ 两行 66 ＋ 缝 6 ＋ 边距 12）；
返回 0 / 不实现就交回默认。**建议保持 176**，否则下面「值符/值使」和九宫盘会整体上下移。

## 四、开关

- 开关键 = `settings.plugins[id]`，**默认关**（缺键＝关，2026-10-25 起）。
- 主程序会自动：①在设置页插件列表里出一张卡（标题/说明 + 开关）；②开关变化后即时重排盘面与导出图。
- 插件作者**不用**自己写开关逻辑，只管 `palace` / `snap`。

## 五、一个最小示例（往中宫放一个「福」字）

```js
Plugins.register({
  id: 'fu', name: '福字', desc: '示例：中宫画一个福字。',
  flags: { blockInYin: true },
  palace: function (pal, ctx) {
    if (pal !== 5) return '';                      // 只在中5宫
    return '<div class="plug-fu">福</div>';
  },
  snap: function (pal, ctx) {
    if (pal !== 5) return;
    var c = ctx.ctx, cx = ctx.x + ctx.S / 2, cy = ctx.y + ctx.SH / 2;
    c.fillStyle = ctx.P.ink; c.font = '700 ' + (ctx.S * 0.3) + 'px serif';
    c.textAlign = 'center'; c.fillText('福', cx, cy);
  }
});
```

## 六、给 AI 的落地清单

1. 新建 `web/plugins/<id>.js`，写一次 `Plugins.register({...})`。
2. 在 `web/index.html` 的插件加载点（`plugins.js` 之后）加一行 `<script src="js/../plugins/<id>.js"></script>`。
3. 要新样式 → 在 `web/css/pan.css` 尾部追加（前缀 `plug-<id>-` 防撞名）。
4. 跑 `node 校验/_check_css.js`（jsdom 依赖按环境用 `NODE_PATH` 指向）+ 浏览器真点一遍盘面/导出图。
5. 别碰 `ui.js` / `snapshot.js` 的主逻辑——那正是这套契约要避免的。
