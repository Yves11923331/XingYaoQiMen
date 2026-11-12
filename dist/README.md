# 安装包

| 版本 | versionCode | 文件 | 大小 | SHA-256 |
|---|---|---|---|---|
| 3.0.0 | 207 | `星曜奇门-3.0.0.apk` | 602114 bytes | `b933b9a423ff15617bb1746e3af6c166a52becd3f04d7505da3c7b79d4a573d1` |

- 包名 `com.momen.xingyaoqimen`，minSdk 29（Android 10 及以上），已用 v1/v2/v3 签名。
- 由 `app/build_xingyao.py` 构建，构建前跑过内置质量门禁（CSS / 串星 / 真太阳时 / 墓星 / 紫微）。
- 覆盖安装：与正式版同包名，直接安装即可升级。
- 校验：`apksigner verify --min-sdk-version 29 星曜奇门-3.0.0.apk`。

## 3.0.0 主要变化

- 阴盘整体并入标准盘：神/星/门/天地盘干、空亡/驿马印章与拆补、置闰同一套。
- 阴盘暗干改坐「星曜（政余）」那一行：宫卡左下角、墨点起笔、0.9em。
- 新插件 **虚实法**：四柱地支与宫位纳支对照，实宫边框加深、虚宫变浅（中五恒虚）。
- 清理阴盘外圈那一套死代码（#qmRing / has-ring / renderRing / RING_W 等）。
