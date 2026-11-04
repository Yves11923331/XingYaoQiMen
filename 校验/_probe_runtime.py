#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""运行时探针：改完界面（尤其串星课 · 读法弹窗）后，用无头浏览器把关键手势真点一遍。

起因（2026-10-07）：改 openXkHelp 时「先算函数行号、后插注释」，行号整体后移导致替换错位 ——
注释的 `*/` 被吃掉、函数尾部留下旧代码，未闭合的 `/*` 把起盘的初始化一起吞成注释。
`node --check` 通过（"一大段代码变注释"语法合法）、jsdom 那套自检也没覆盖到运行时手势，
结果上机才暴露「起盘啥都点不了」。此后凡动界面，交付前一律跑这个。

用法（在项目根跑）：
  python3 校验/_probe_runtime.py          # 测 web/ 源码
  python3 校验/_probe_runtime.py apk      # 测 app/out 里最新那个包（真正要交付的东西）

退出码 0 = 全过；非 0 = 有问题，别交付。
依赖：python3 -c "import playwright"（浏览器已缓存在 /root/.cache/ms-playwright）。
"""
import glob
import os
import sys
import tempfile
import zipfile

# 工程搬家后写死的 BASE 会找不到文件；这里按脚本位置推（校验/ 的上一级 = 工程根）。
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def target():
    """返回要测的 index.html 路径；带 apk 参数时从最新包里解出 assets。"""
    if len(sys.argv) > 1 and sys.argv[1] == 'apk':
        apks = sorted(glob.glob(os.path.join(BASE, 'app/out/*.apk')), key=os.path.getmtime)
        if not apks:
            print('app/out 里没有包'); sys.exit(2)
        apk = apks[-1]
        d = tempfile.mkdtemp(prefix='probe-')
        z = zipfile.ZipFile(apk)
        for n in z.namelist():
            if n.startswith('assets/') and not n.endswith('/'):
                o = os.path.join(d, n[len('assets/'):])
                os.makedirs(os.path.dirname(o), exist_ok=True)
                open(o, 'wb').write(z.read(n))
        print('测包：%s' % apk)
        return os.path.join(d, 'index.html')
    print('测源码：%s/web/index.html' % BASE)
    return os.path.join(BASE, 'web', 'index.html')


def main():
    from playwright.sync_api import sync_playwright
    path = target()
    bad = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--allow-file-access-from-files'])
        pg = b.new_page(viewport={'width': 390, 'height': 900})
        errs = []
        pg.on('console', lambda m: errs.append('console: ' + str(m.text)[:140]) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:140]))

        pg.goto('file://' + path)
        pg.wait_for_timeout(1500)
        if errs:
            bad.append('加载期报错 → %s' % errs)

        try:
            pg.click('#btnCast', timeout=3000)
            pg.wait_for_timeout(900)
            if 'on' not in pg.evaluate("()=>document.getElementById('view-chart').className"):
                bad.append('点「起盘」没进盘面页')
            if pg.evaluate("()=>document.querySelector('#panHost').children.length") == 0:
                bad.append('盘面是空的（#panHost 无内容）')
        except Exception as e:
            bad.append('点「起盘」失败：%s' % str(e)[:120])

        try:
            pg.click('#btnNext', timeout=2000)
            pg.wait_for_timeout(600)
            txt = pg.evaluate("()=>document.getElementById('view-chart').innerText.slice(0,30).replace(/\\n/g,' ')")
            if '年' not in txt:
                bad.append('点「› 下一时辰」后没看到四柱：%r' % txt)
        except Exception as e:
            bad.append('点「›」失败：%s' % str(e)[:120])

        try:
            pg.evaluate("()=>document.getElementById('btnXkHint').click()")
            pg.wait_for_timeout(600)
            if not pg.evaluate("()=>document.getElementById('sheet').classList.contains('on')"):
                bad.append('串星课 · 读法弹窗打不开（openXkHelp 可能又没定义）')
            else:
                head = pg.evaluate("()=>document.getElementById('sheet').innerText.slice(0,24).replace(/\\n/g,' / ')")
                print('  弹窗开头：%s' % head)
        except Exception as e:
            bad.append('弹窗触发失败：%s' % str(e)[:120])

        if errs:
            bad.append('运行期报错 → %s' % errs)
        b.close()

    if bad:
        print('✗ 探针未过：')
        for x in bad:
            print('   - ' + x)
        return 1
    print('✓ 探针全过：起盘可点 · 盘面出得来 · 下一时辰可翻 · 读法弹窗可开 · 全程无报错')
    return 0


if __name__ == '__main__':
    sys.exit(main())
