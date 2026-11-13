#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""星曜奇门 · 方案 A 半原生壳 独立构建脚本

在 app/ 下工作（方案A 壳已转正，取代旧壳）：
  · 壳源码：./android/
  · 前端真源：../web/（只读取、复制，绝不修改）
  · 密钥：../密钥/xingyaoqimen.jks（自备签名密钥，见仓库根 README）
  · 产物：./out/星曜奇门-<ver>.apk

工具链沿用正版链：aapt + ecj + r8(D8) + zipalign + apksigner。
"""
import os, re, shutil, subprocess, sys, glob, zipfile

BASE = os.path.dirname(os.path.abspath(__file__))
ANDROID = os.path.join(BASE, 'android')
WWW_SRC = os.path.abspath(os.path.join(BASE, '..', 'web'))          # 星曜奇门/web
BUILD = os.path.join(BASE, 'build')
OUT = os.path.join(BASE, 'out')
KS_SRC = os.path.abspath(os.path.join(BASE, '..', '密钥', 'xingyaoqimen.jks'))
KS_PASS_FILE = os.path.abspath(os.path.join(BASE, '..', '密钥', '密码.txt'))
ANDROID_JAR_SRC = '/root/at/android.jar'
ECJ = '/root/dl/ecj.jar'
D8 = '/root/at/r8.jar'          # r8 9.5.26，含 D8（比旧 d8 兼容性更好）
AAPT = '/usr/bin/aapt'
ZIPALIGN = '/usr/bin/zipalign'
APKSIGNER_JAR = '/usr/share/java/apksigner.jar'
AT = '/root/at'

NAME, VER, CODE = '星曜奇门', '3.2.6', 224
PKG, ALIAS = 'com.momen.xingyaoqimen', 'xingyao'
MIN_SDK, TARGET_SDK = 29, 34

EXCLUDE_PREFIX = '设计-'   # 设计稿不进包

ENV = dict(os.environ, LANG='C.UTF-8', LC_ALL='C.UTF-8')


def run(cmd, cwd=None, quiet=False):
    p = subprocess.run(cmd, cwd=cwd, env=ENV, capture_output=True, text=True)
    if p.returncode != 0:
        print('!! 命令失败:', ' '.join(cmd))
        print(p.stdout[-3000:]); print(p.stderr[-3000:])
        sys.exit(1)
    if not quiet and (p.stdout.strip() or p.stderr.strip()):
        for line in (p.stdout + p.stderr).strip().splitlines()[-4:]:
            print('   ', line)
    return p


def check_licenses():
    """开源许可必须随包分发 —— 复制 web/ 之前先验一遍。

    为什么钉死这一条：字体 QM Serif 是 Noto Serif CJK SC 的**子集衍生**，我们分发的是
    字体文件本身，SIL OFL 1.1 要求「随附许可证 + 保留版权行」。少带一份 txt 就违约，
    而且这种缺失在 App 里**看不出来**（图照出、字照显示），只能靠门禁和这里拦住。
    详见 web/licenses/THIRD-PARTY.md。"""
    lic = os.path.join(WWW_SRC, 'licenses')
    if not os.path.isdir(lic):
        print('!! 找不到 web/licenses/ —— 许可全文没随包，打包中止（见 web/licenses/THIRD-PARTY.md）')
        sys.exit(1)
    need = ['OFL-1.1.txt', 'licenses.js', 'THIRD-PARTY.md', 'LICENSE']
    missing = [f for f in need if not os.path.isfile(os.path.join(lic, f))]
    if missing:
        print('!! web/licenses/ 缺文件：' + ', '.join(missing) + ' —— 打包中止')
        sys.exit(1)
    big = [f for f in need if os.path.getsize(os.path.join(lic, f)) < 200]
    if big:
        print('!! web/licenses/ 里这些文件过小（像被清空了）：' + ', '.join(big) + ' —— 打包中止')
        sys.exit(1)
    print('    许可随包：web/licenses/ 四项齐全（OFL / licenses.js / THIRD-PARTY.md / LICENSE）')


def stage_www(dst):
    """把前端真源复制一份做清洗：排除设计稿、剥掉 ?v= 查询串、
    把「关于」里的版本号换成包版本。"""
    if os.path.isdir(dst):
        shutil.rmtree(dst)
    shutil.copytree(WWW_SRC, dst)
    for name in sorted(os.listdir(dst)):
        if name.startswith(EXCLUDE_PREFIX) or name.startswith('_'):
            os.remove(os.path.join(dst, name))
    # ★ 备份文件（*.bak / *.bak-*）一律不进包：2026-10-21 拆分 init 时把
    #   ui.js.bak-init 留在 web/js/ 下，结果 153 KB 的备份被打进 APK，包从 507 KB 涨到 576 KB。
    for root, dirs, files in os.walk(dst):
        for fn in files:
            if '.bak' in fn or fn.endswith('~'):
                os.remove(os.path.join(root, fn))
    idx = os.path.join(dst, 'index.html')
    s = open(idx, encoding='utf-8').read()
    n = len(re.findall(r'\?v=[0-9A-Za-z._-]+', s))
    s = re.sub(r'\?v=[0-9A-Za-z._-]+', '', s)
    open(idx, 'w', encoding='utf-8').write(s)

    # ★「关于 → 版本」必须跟着包走（只动这一行，别碰注释里的示例）。
    uf = os.path.join(dst, 'js', 'ui.js')
    us = open(uf, encoding='utf-8').read()
    m = re.search(r'(<div class="sub">版本 )([^<]+)(</div>)', us)
    if not m:
        print('!! 前端「关于」里的版本号找不到（写法变了？打包中止）')
        sys.exit(1)
    if m.group(2) != VER:
        us = us.replace(m.group(0), m.group(1) + VER + m.group(3), 1)
        open(uf, 'w', encoding='utf-8').write(us)
        print('    前端版本号：%s → 版本 %s' % (m.group(2), VER))
    else:
        print('    前端版本号：已经就是 版本 %s' % VER)
    return n


def main():
    ks_pass = open(KS_PASS_FILE, encoding='utf-8').read().strip()
    for d in [BUILD, OUT, AT]:
        os.makedirs(d, exist_ok=True)

    # ---- 0) 前端门禁：CSS + 串星 + 串星引擎 + 读法 + 开源声明 + 真太阳时 + 墓星 + 紫微（失败直接中止） ----
    print('[0/6] 前端自检')
    proj = os.path.dirname(WWW_SRC)
    # jsdom 安装位置：可用 XYQ_NODE_PATH 覆盖，默认沿用开发容器布局
    genv = dict(ENV, NODE_PATH=os.environ.get('XYQ_NODE_PATH', '/root/dsh-dom/node_modules'))
    # ★ 2026-11-13：串星课换「小六壬·加干」后，口径拆成两层门禁 ——
    #   _check_cx_engine.js 管引擎（四数→课 / 六亲 / 两套译法 / 不随盘面变），纯 node + jsdom；
    #   _check_cxhelp.js 管读法稿与底本逐字对照（读法换了就得拦住）；
    #   _check_chuanxing.js 只管页面层（真 index.html 里点出来的东西）。
    #   _check_license.js 管「开源声明」与许可随包分发（三份 MIT 只列名字、字体给 OFL 全文、
    #   web/licenses/ 与 licenses.js 逐字一致）—— 文案/声明类，紧跟读法那道。
    # 八道都必须进第 0 步：漏一道，前端带着坏引擎/坏稿/坏声明也能出包。
    for script, what in [('_check_css.js', 'CSS'), ('_check_chuanxing.js', '串星集成'),
                         ('_check_cx_engine.js', '串星引擎'), ('_check_cxhelp.js', '串星读法'),
                         ('_check_license.js', '开源声明'),
                         ('_check_truesolar.js', '真太阳时'), ('_check_mu.js', '墓星判定'),
                         ('_check_ziwei.js', '紫微安星')]:
        q = subprocess.run(['node', os.path.join(proj, '校验', script)], cwd=proj, env=genv,
                           capture_output=True, text=True)
        tail = (q.stdout + q.stderr).strip().splitlines()
        print('    %s → %s' % (script, tail[-1] if tail else '（无输出）'))
        if q.returncode != 0:
            print('!! %s 未过（%s），中止打包' % (script, what))
            print(q.stdout[-2000:]); print(q.stderr[-2000:]); sys.exit(1)

    for d in ['classes', 'dex', 'www']:
        p = os.path.join(BUILD, d)
        shutil.rmtree(p, ignore_errors=True)
        os.makedirs(p, exist_ok=True)

    # ---- 0) 中文路径规避：jar 已在 /root/at，keystore 先复制过去 ----
    aj = ANDROID_JAR_SRC
    ks = os.path.join(AT, 'xingyaoqimen.c.jks')
    shutil.copyfile(KS_SRC, ks)

    # ---- 1) 前端资源 ----
    # ★ 先验许可随包（web/licenses/ 四项齐全），再复制 web/ —— 缺了就地中止，别打出违约的包
    check_licenses()
    print('[1/6] 清洗前端资源')
    www = os.path.join(BUILD, 'www')
    n = stage_www(www)
    files = sum(len(f) for _, _, f in os.walk(www))
    print('    剥掉 ?v= %d 处；%d 个文件' % (n, files))

    # ---- 2) aapt 打资源与 assets ----
    print('[2/6] aapt 打资源')
    base = os.path.join(BUILD, 'base.apk')
    man = os.path.join(ANDROID, 'AndroidManifest.xml')
    res = os.path.join(ANDROID, 'res')
    run([AAPT, 'package', '-f',
         '-M', man,
         '-S', res,
         '-A', www,
         '-I', aj,
         '--min-sdk-version', str(MIN_SDK), '--target-sdk-version', str(TARGET_SDK),
         '-F', base])
    print('    base.apk %.1f KB' % (os.path.getsize(base) / 1024))

    # ---- 3) Java → class ----
    print('[3/6] ecj 编译 Java')
    srcs = glob.glob(os.path.join(ANDROID, 'src', '**', '*.java'), recursive=True)
    classes = os.path.join(BUILD, 'classes')
    run(['java', '-jar', ECJ, '-source', '8', '-target', '8', '-nowarn', '-proc:none',
         '-bootclasspath', aj, '-cp', aj, '-d', classes] + srcs)
    print('    .class 数:', len(glob.glob(os.path.join(classes, '**', '*.class'), recursive=True)))

    # ---- 4) D8 → classes.dex ----
    print('[4/6] D8 生成 classes.dex')
    dexout = os.path.join(BUILD, 'dex')
    cls = glob.glob(os.path.join(classes, '**', '*.class'), recursive=True)
    run(['java', '-cp', D8, 'com.android.tools.r8.D8', '--min-api', str(MIN_SDK),
         '--lib', aj, '--output', dexout] + cls)
    run([AAPT, 'add', base, 'classes.dex'], cwd=dexout)
    with zipfile.ZipFile(base) as z:
        print('    包内 dex:', [n for n in z.namelist() if n.endswith('.dex')])

    # ---- 5) 对齐 + 签名 ----
    print('[5/6] zipalign + apksigner')
    aligned = os.path.join(BUILD, 'aligned.apk')
    run([ZIPALIGN, '-f', '4', base, aligned], quiet=True)
    run([ZIPALIGN, '-c', '-v', '4', aligned], quiet=True)
    print('    对齐检查通过')
    final = os.path.join(OUT, '%s-%s.apk' % (NAME, VER))
    run(['java', '-jar', APKSIGNER_JAR, 'sign',
         '--ks', ks, '--ks-key-alias', ALIAS,
         '--ks-pass', 'pass:' + ks_pass, '--key-pass', 'pass:' + ks_pass,
         '--v1-signing-enabled', 'true', '--v2-signing-enabled', 'true',
         '--v3-signing-enabled', 'true', '--v4-signing-enabled', 'false',
         '--out', final, aligned])
    for f in glob.glob(os.path.join(OUT, '*.idsig')):
        os.remove(f)
    print('    成品:', final, '%.2f KB' % (os.path.getsize(final) / 1024))
    print('\n下一步：')
    print('  aapt dump badging "%s" | head -4' % final)
    print('  java -jar %s verify --min-sdk-version %d "%s"' % (APKSIGNER_JAR, MIN_SDK, final))


if __name__ == '__main__':
    main()
