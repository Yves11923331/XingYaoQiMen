#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
星曜奇门 · 重建界面衬线子集字体（web/fonts/qm-serif.woff2）
------------------------------------------------------------
内嵌的是设备自带 Noto Serif CJK SC 的一份子集。

【第 2 次改 · 2026-10-03】原来那份子集是**在更旧的子集上打补丁**生成的 ——
只补「会跟已收录字同处一段文字」的字。可那个旧子集本身就不全：
地支 12 个字里只有「辰」，六亲「子孙父母妻财」一个都没有。
CDP 实测结果：92 个声明内嵌宋体的元素里 **49% 的字形回退**到系统 Noto Serif SC，
**同一行内两种字体交替** —— 四柱「丙午年 丁酉月 庚戌日 癸未时」是
■□□ ■□■ ■□□ ■□■（■内嵌 / □回退），「起盘」按钮也是 起(回退)+盘(内嵌)。

修法：不再打补丁，改成**显式业务字表**（BUSS 常量）。字表来源：
  · 盘面术语：天干地支 / 九星 / 八门 / 八神 / 六亲 / 神煞 / 局数 / 旬空
  · 历法：24 节气 / 农历 / 生肖 / 星期 / 中文数字
  · UI：按钮与提示文案常用字
  · 标点 + ASCII
再加「旧子集已有字」兜底，保证永不倒退。

⚠ 改完必须实测验证，别只看脚本输出：
    node /tmp/pvchk/fontaudit.mjs      # CDP 拿每个元素实际渲染字体 + 字形数
    cd app && python3 build_xingyao.py # 门禁 + 出包

用法： python3 make_font.py
"""
import os
from fontTools.ttLib import TTFont, TTCollection
from fontTools import subset

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, '..', 'web')
OUT = os.path.join(WEB, 'fonts', 'qm-serif.woff2')
SRC_TTC = '/system/fonts/NotoSerifCJK-Regular.ttc'
WANT_FAMILY = 'Noto Serif CJK SC'

# ── 业务字表（显式，别再靠"继承旧子集"）────────────────────────────────
BUSS = (
    # 天干地支
    '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥'
    # 中文数字 / 时间
    '一二三四五六七八九十廿卅零百千万年月日时星期周今明昨'
    # 24 节气
    '立春雨水惊蛰春分清明谷雨立夏小满芒种夏至小暑大暑'
    '立秋处暑白露秋分寒露霜降立冬小雪大雪冬至小寒大寒'
    # 生肖 / 农历 / 五行
    '鼠牛虎兔龙蛇马羊猴鸡狗猪农历正腊闰初金木水火土'
    # 术数术语
    '阴阳遁局元超接拆补法符头节候气支卦象旬首空值使'
    # 六亲
    '子孙父母妻财兄弟官鬼'
    # 九星 / 八门 / 八神
    '蓬芮冲辅禽心柱任英休生伤杜景死惊开'
    '符蛇六合虎武九地天腾太值'
    # 神煞 / 八卦
    '驿马计都月孛罗睺紫炁白朱勾陈玄雀震巽艮兑坎坤离乾'
    # UI 文案
    '起盘课串星曜奇门设置背景裁剪分享保存导出关于返回上下一个时辰'
    '看共条点这里全部宫九天地人神八'
    # 方位 / 地名常用
    '东南西北中左右前后北京市城区省县街道号楼层室路'
    # 其余常用
    '与先属'
    # 标点符号
    '·，。、（）【】《》—…-/:：；！？‘’“”　°›‹'
    # ASCII
    '0123456789'
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    '!"#$%&\'()*+,./:;<=>?@[\\]^_`{|}~ '
)


def pick_face(path, family):
    """TTC 里挑出简体那一面"""
    coll = TTCollection(path)
    for i, f in enumerate(coll.fonts):
        names = [f['name'].getDebugName(n) for n in (1, 4, 6, 16)]
        if any(family in (n or '') for n in names):
            return i, f
    return 0, coll.fonts[0]


def main():
    old = TTFont(OUT)
    keep = set(chr(c) for c in old.getBestCmap())
    chars = (keep | set(BUSS)) - {'\n', '\r', '\t'}
    text = ''.join(sorted(chars))
    print('字表：旧子集 %d ∪ 业务表 %d → 去重后 %d 字' % (len(keep), len(set(BUSS)), len(chars)))

    idx, face = pick_face(SRC_TTC, WANT_FAMILY)
    print('源字体 %s 第 %d 面：%s' % (SRC_TTC, idx, face['name'].getDebugName(4)))

    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.with_zopfli = False
    opts.layout_features = []          # 只当展示字体用，不要 OpenType 特性
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.drop_tables += ['DSIG']
    # ⚠ fontTools 的 load_font 不认 font_number（不同版本签名不一），直接自己开 TTC 更稳
    font = TTFont(SRC_TTC, fontNumber=idx, recalcBBoxes=False, recalcTimestamp=False)
    subsetter = subset.Subsetter(options=opts)
    subsetter.populate(text=text)
    subsetter.subset(font)
    font.flavor = 'woff2'
    font.save(OUT)
    font.close()

    chk = TTFont(OUT)
    cmap = chk.getBestCmap()
    miss = sorted(c for c in chars if ord(c) not in cmap)
    print('新子集 %d 字，%d 字节（%.1f KB）；仍缺：%s'
          % (len(cmap), os.path.getsize(OUT), os.path.getsize(OUT) / 1024, ''.join(miss) or '（无）'))


if __name__ == '__main__':
    main()
