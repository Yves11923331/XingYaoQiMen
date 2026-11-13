/* 运行时探针（node 版）—— 与 校验/_probe_runtime.py 同一套手势，另加「阴盘印章不压八神」。
 *
 * 起因：本机 python 侧没有 playwright（2026-10-28 只剩 node 的 playwright-core），
 * 而 `_probe_runtime.py` 的依赖装不上。这里用 node 把同样的四步真点一遍，
 * 并补上阴盘几何断言。python 版仍是老口径，二者不冲突。
 *
 * ★ 2026-11-13 起，这个探针还管 jsdom 管不了的那类断言（jsdom 没有排版引擎，
 *   高度/计算样式恒为 0/空）：串星页三条「与起盘页对齐 ≤2px」、口径勾选框的
 *   视觉尺寸 ≤22px / 触控区 ≥40px、以及两页时间卡的投影必须是 none。
 *
 * 用法（工程根）：
 *   NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules node 校验/_probe_runtime.js
 *   NODE_PATH=... node 校验/_probe_runtime.js apk      # 解 app/out 最新包的 assets 再测
 * 退出码 0 = 全过。
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');           /* 只用 unzip -l/-p 解包，不做写操作 */

const EXE = process.env.CHROME_SHELL ||
  '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const ROOT = path.resolve(__dirname, '..');

function target() {
  if (process.argv[2] === 'apk') {
    const dir = path.join(ROOT, 'app', 'out');
    const apks = fs.readdirSync(dir).filter(f => f.endsWith('.apk'))
      .map(f => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (!apks.length) { console.log('app/out 里没有包'); process.exit(2); }
    const apk = apks[0];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-'));
    const list = execSync(`python3 -c "import zipfile,sys;print('\\n'.join(f for f in zipfile.ZipFile(sys.argv[1]).namelist() if f.startswith('assets/') and not f.endswith('/')))" "${apk}"`, { encoding: 'utf8' });
    for (const n of list.split('\n').filter(Boolean)) {
      const out = path.join(tmp, n.slice('assets/'.length));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      execSync(`python3 -c "import zipfile,sys;open(sys.argv[2],'wb').write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[3]))" "${apk}" "${out}" "${n}"`);
    }
    console.log('测包：' + apk);
    return path.join(tmp, 'index.html');
  }
  console.log('测源码：' + path.join(ROOT, 'web', 'index.html'));
  return path.join(ROOT, 'web', 'index.html');
}

(async () => {
  const bad = [];
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 140)));

  await page.goto('file://' + target());
  await page.waitForTimeout(1500);
  if (errs.length) bad.push('加载期报错 → ' + errs.join(' | '));

  const step = async (fn, label) => { try { await fn(); } catch (e) { bad.push(label + '：' + String(e.message || e).slice(0, 140)); } };

  await step(async () => {
    await page.click('#btnCast', { timeout: 3000 });
    await page.waitForTimeout(900);
    const on = await page.evaluate(() => document.getElementById('view-chart').className.includes('on'));
    const kids = await page.evaluate(() => document.querySelector('#panHost').children.length);
    if (!on) bad.push('点「起盘」没进盘面页');
    if (!kids) bad.push('盘面是空的（#panHost 无内容）');
  }, '起盘');

  await step(async () => {
    await page.click('#btnNext', { timeout: 2000 });
    await page.waitForTimeout(600);
    const txt = await page.evaluate(() => document.getElementById('view-chart').innerText.slice(0, 30).replace(/\n/g, ' '));
    if (!txt.includes('年')) bad.push('点「› 下一时辰」后没看到四柱：' + txt);
  }, '下一时辰');

  await step(async () => {
    /* 2026-11-02 排查项 8：全屏串星课页删除，读法入口从 #btnXkHint 移到课页弹窗 #cxPopHelp */
    await page.click('#btnBack');
    await page.waitForTimeout(300);
    await page.click('#tabbar button[data-view="chuanxing"]');
    await page.waitForTimeout(300);
    await page.click('#btnCastX');
    await page.waitForTimeout(800);
    await page.click('#cxPopHelp');
    await page.waitForTimeout(500);
    const on = await page.evaluate(() => document.getElementById('sheet').classList.contains('on'));
    if (!on) bad.push('串星课 · 读法弹窗打不开（cxPopHelp / openXkHelp 可能又没定义）');
    else console.log('  弹窗开头：' + await page.evaluate(() => document.getElementById('sheet').innerText.slice(0, 24).replace(/\n/g, ' / ')));
    if (on) {
      await page.click('#btnXkHelpOk');
      await page.waitForTimeout(300);
      await page.click('#cxPopBack');
      await page.waitForTimeout(300);
    }
  }, '串星课弹窗');

  /* ★ 2026-11-13 用户追加的五条结构：三档（时间 / 数字 / 随机）＋ 口径勾选。
     jsdom 那边已经逐条断言过，这里只做「真 Chromium 里点得动」的复核：
     换档 → 填数 → 起课 → 勾九星 → 课页当场换表 → 随机档抽数 → 重排再抽。 */
  await step(async () => {
    await page.evaluate(() => document.getElementById('sheet').classList.remove('on'));
    await page.click('#tabbar button[data-view="chuanxing"]');
    await page.waitForTimeout(320);
    const seg = await page.evaluate(() => {
      const on = document.querySelector('#segCxSrc button.on');
      return {
        txt: [...document.querySelectorAll('#segCxSrc button')].map(b => b.textContent.trim()),
        on: (on && on.dataset) ? on.dataset.src : '',
        timePanel: document.getElementById('cxPanelTime').classList.contains('on')
      };
    });
    if (seg.txt.join('/') !== '时间/数字/随机') bad.push('分段应是三档 时间/数字/随机，实得 ' + seg.txt.join('/'));
    if (seg.on !== 'time' || !seg.timePanel) bad.push('首屏默认档应是「时间」，实得 ' + seg.on);
    /* 时间档：只有数，没有说明小字（农历…/只读） */
    const t = await page.evaluate(() => ({
      txt: document.getElementById('cxPanelTime').textContent,
      nums: [...document.querySelectorAll('#cxTimeNums b')].map(b => b.textContent).join('/'),
      help: !!document.getElementById('cxTimeHelp'),
      edit: document.querySelectorAll('#cxPanelTime input, #cxPanelTime select, #cxPanelTime textarea').length
    }));
    if (/农历|只读/.test(t.txt)) bad.push('时间档里不该再有「农历…/只读」说明小字');
    if (!t.help) bad.push('时间档的 ⓘ 不见了');
    if (t.edit) bad.push('时间档不该有可编辑控件（四数只读）');
    if (t.nums.split('/').some(x => !/^\d+$/.test(x))) bad.push('时间档四数没填上：' + t.nums);
    /* 数字档：填 1527 → 起课 → 课页（六神） */
    await page.evaluate(() => document.querySelector('#segCxSrc button[data-src="nums"]').click());
    await page.waitForTimeout(300);
    const paneBad = await page.evaluate(() => document.querySelectorAll('#cxstage .nm, #cxstage .cxqin').length);
    if (paneBad) bad.push('三档面板里不该出现译名 / 六亲预览（' + paneBad + ' 处）');
    await page.evaluate(() => {
      ['1', '5', '2', '7'].forEach((v, i) => {
        const el = document.getElementById('cxN' + i);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    await page.click('#btnCastX');
    await page.waitForTimeout(420);
    const six = await page.evaluate(() => ({
      on: document.getElementById('cxPop').classList.contains('on'),
      sub: document.getElementById('cxPopSub').textContent,
      nm: [...document.querySelectorAll('#cxPopGrid .nm')].map(n => n.textContent).join('/')
    }));
    if (!six.on) bad.push('数字档 1527 点「起课」没弹课页');
    if (six.nm !== '大安/小吉/空亡/庚/妻财/子孙/父母') bad.push('数字档 1527 的课页不对：' + six.nm);
    /* 换译法的正确走法（用户定的）：返回起课页 → 点勾选 → 再起课。
       课页弹层开着时那枚 label 被遮罩盖着，真机上也点不到 —— 所以这里先返回。 */
    await page.click('#cxPopBack');
    await page.waitForTimeout(280);
    await page.click('#cxMode');
    await page.waitForTimeout(300);
    const cbOn = await page.evaluate(() => document.getElementById('cxStar').checked);
    if (!cbOn) bad.push('点 label 应把口径勾到九星');
    await page.click('#btnCastX');
    await page.waitForTimeout(420);
    const star = await page.evaluate(() => ({
      checked: document.getElementById('cxStar').checked,
      nm: [...document.querySelectorAll('#cxPopGrid .nm')].map(n => n.textContent).join('/'),
      sub: document.getElementById('cxPopSub').textContent
    }));
    if (star.nm !== '天蓬/天禽/天心/庚/子孙/父母/兄弟') bad.push('切九星后课页不对：' + star.nm);
    if (star.sub.indexOf('九星') < 0) bad.push('切九星后副行没标九星：' + star.sub);
    if (/禽芮/.test(star.nm)) bad.push('九星表里不该出现「禽芮」合写');
    /* 返回 → 随机档：起课抽四数、重排再抽；此时是九星，三宫域 1–9 */
    await page.click('#cxPopBack');
    await page.waitForTimeout(250);
    await page.evaluate(() => document.querySelector('#segCxSrc button[data-src="rand"]').click());
    await page.waitForTimeout(300);
    await page.click('#btnCastX');
    await page.waitForTimeout(420);
    const rand = await page.evaluate(() => ({
      echo: [...document.querySelectorAll('#cxRandNums b')].map(b => +b.textContent),
      sub: document.getElementById('cxPopSub').textContent,
      pop: document.getElementById('cxPop').classList.contains('on'),
      btns: document.querySelectorAll('#cxPanelRand button').length
    }));
    if (!rand.pop) bad.push('随机档点「起课」没出课');
    if (rand.btns !== 0) bad.push('随机档不该有任何按钮（重复的 ⓘ 已并入横栏右下角那一枚），实得 ' + rand.btns + ' 颗');
    if (rand.echo.some(n => !(n >= 1 && n <= 10))) bad.push('随机档四数越界：' + rand.echo.join('/'));
    if (rand.echo.slice(0, 3).some(n => n > 9)) bad.push('九星随机三宫应 ≤9：' + rand.echo.join('/'));
    if (rand.sub.indexOf('随机') < 0) bad.push('随机档副行没标「随机」：' + rand.sub);
    let changed = false, prev = rand.echo.join(',');
    for (let i = 0; i < 8 && !changed; i++) {
      await page.click('#cxPopAgain');
      await page.waitForTimeout(220);
      const now = await page.evaluate(() => [...document.querySelectorAll('#cxRandNums b')].map(b => +b.textContent).join(','));
      if (now !== prev) changed = true;
    }
    if (!changed) bad.push('随机档「重排」没有重抽（连点 8 次四数都没变）');
    await page.click('#cxPopBack');
    await page.waitForTimeout(200);
    console.log('  串星页三档：' + seg.txt.join('/') + ' · 时间档四数 ' + t.nums
      + ' · 1527 六神=' + six.nm.split('/').slice(0, 4).join('/')
      + ' · 九星=' + star.nm.split('/').slice(0, 4).join('/')
      + ' · 随机=' + rand.echo.join('/'));
  }, '串星三档与口径勾选');

  /* ★ 2026-11-13 第 4 / 2 条：几何与尺寸（jsdom 量不出来，只能在这里量）
       · 时间卡 / 分段按钮 / 起课按钮 与起盘页差 ≤2px；
       · 口径勾选框视觉 ≤22px，整枚 label（触控区）≥40px；
       · 起盘页与串星页的时间卡不许有投影（用户 2026-11-13 去阴影）；
       · 切换控件全页恰好 1 枚，且只在起课页。 */
  await step(async () => {
    /* 上一步万一中途抛错，弹层遮罩会留着把后面的点击全吃掉 —— 先收干净再量 */
    await page.evaluate(() => {
      ['cxPop', 'cxPopMask', 'sheet'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('on');
      });
    });
    await page.click('#tabbar button[data-view="home"]');
    await page.waitForTimeout(320);
    const home = await page.evaluate(() => {
      const r = (el) => el.getBoundingClientRect();
      const maxBtn = (sel) => Math.max(...[...document.querySelectorAll(sel)].map(b => r(b).height));
      const tc = document.getElementById('timecard');
      return {
        tc: r(tc).height,
        seg: maxBtn('#segMode3 button'),
        cast: r(document.getElementById('btnCast')).height,
        shadow: getComputedStyle(tc).boxShadow
      };
    });
    await page.click('#tabbar button[data-view="chuanxing"]');
    await page.waitForTimeout(320);
    const cx = await page.evaluate(() => {
      const r = (el) => el.getBoundingClientRect();
      const maxBtn = (sel) => Math.max(...[...document.querySelectorAll(sel)].map(b => r(b).height));
      const tc = document.getElementById('cxTimecard');
      const cb = document.getElementById('cxStar').getBoundingClientRect();
      const lab = document.getElementById('cxMode').getBoundingClientRect();
      return {
        tc: r(tc).height,
        seg: maxBtn('#segCxSrc button'),
        cast: r(document.getElementById('btnCastX')).height,
        shadow: getComputedStyle(tc).boxShadow,
        cb: { w: cb.width, h: cb.height },
        lab: { w: lab.width, h: lab.height },
        seal: document.querySelectorAll('.cxseal, #cxSeal, #cxPopSeal').length,
        cbAll: document.querySelectorAll('#view-home input[type=checkbox], #view-chart input[type=checkbox]').length,
        cbInView: document.querySelectorAll('#view-chuanxing input[type=checkbox]').length,
        cbInPop: document.querySelectorAll('#cxPop input, #cxPop [role=checkbox], #cxPop .cxseal').length,
        cbInSet: document.querySelectorAll('#view-set input[type=checkbox]').length,
      };
    });
    const near = (a, b) => Math.abs(a - b) <= 2;
    if (!near(home.tc, cx.tc)) bad.push('时间卡高度没对齐：起盘 ' + home.tc.toFixed(1) + ' vs 串星 ' + cx.tc.toFixed(1));
    if (!near(home.seg, cx.seg)) bad.push('分段按钮高度没对齐：起盘 ' + home.seg.toFixed(1) + ' vs 串星 ' + cx.seg.toFixed(1));
    if (!near(home.cast, cx.cast)) bad.push('起课按钮高度没对齐：起盘 ' + home.cast.toFixed(1) + ' vs 串星 ' + cx.cast.toFixed(1));
    if (home.shadow !== 'none' || cx.shadow !== 'none') {
      bad.push('起盘页 / 串星页的时间卡还有投影：' + home.shadow + ' | ' + cx.shadow);
    }
    if (cx.cb.w > 22 || cx.cb.h > 22) bad.push('勾选框视觉应 ≤22px，实得 ' + cx.cb.w + '×' + cx.cb.h);
    /* 2026-11-13 末轮：九星勾选已进横栏当第四格，高度由横栏决定（32.8）——
       横向仍要求 ≥40（现在 60），纵向放宽到 ≥30，并**必须与横栏同高**（±1），
       否则说明有人偷偷把它撑高、把横栏撑歪了。 */
    if (cx.lab.w < 40 || cx.lab.h < 30) bad.push('勾选触控区应 ≥40×30，实得 ' + cx.lab.w.toFixed(1) + '×' + cx.lab.h.toFixed(1));
    if (Math.abs(cx.lab.h - cx.seg) > 1) bad.push('勾选高度应与横栏内三档按钮等高（±1），实得 ' + cx.lab.h.toFixed(1) + ' vs ' + cx.seg.toFixed(1));
    if (cx.seal) bad.push('方章那套（.cxseal / #cxSeal / #cxPopSeal）应已删干净，还剩 ' + cx.seal + ' 处');
    if (cx.cbInView !== 1) bad.push('切换控件在起课页应恰好 1 枚，实得 ' + cx.cbInView);
    if (cx.cbAll) bad.push('起盘页 / 盘面页不该有切换控件，实得 ' + cx.cbAll);
    if (cx.cbInPop) bad.push('课页弹层里不该有切换控件：' + cx.cbInPop);
    if (cx.cbInSet) bad.push('设置页里不该有切换控件：' + cx.cbInSet);
    console.log('  几何：时间卡 ' + home.tc.toFixed(1) + '/' + cx.tc.toFixed(1)
      + ' · 分段 ' + home.seg.toFixed(1) + '/' + cx.seg.toFixed(1)
      + ' · 起课 ' + home.cast.toFixed(1) + '/' + cx.cast.toFixed(1)
      + ' · 勾选 ' + cx.cb.w + '×' + cx.cb.h + '（触控 ' + cx.lab.w.toFixed(0) + '×' + cx.lab.h.toFixed(0) + '）'
      + ' · 投影 ' + cx.shadow);
  }, '对齐/尺寸/阴影');

  /* 阴盘：起一张「空亡与驿马同宫」的盘，断言印章不压八神字、不压暗干 */
  await step(async () => {
    await page.evaluate(() => {
      ['sheet', 'cxPop', 'cxPopMask'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('on');
      });
    });
    /* 2026-11-02：阴盘从起盘页的「起局方式」升级成 设置 → 定局 → 定局法 的第三档 */
    await page.evaluate(() => {
      const el = document.getElementById('dtPick');
      el.value = '2026-01-01T04:00';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.evaluate(() => { document.querySelector('#segJu button[data-v="yin"]').click(); });
    await page.evaluate(() => document.getElementById('btnCast').click());
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => {
      const pan = document.querySelector('.qm-text-pan');
      if (!pan || pan.dataset.sub !== 'yin') return { err: '不是阴盘：' + (pan && pan.dataset.sub) };
      const inter = (a, b) => {
        const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        return (w > 0 && h > 0) ? w * h : 0;
      };
      let hit = [], twin = 0;
      pan.querySelectorAll('.qm-cell').forEach(c => {
        const seals = [...c.querySelectorAll('.qm-seal')];
        if (!seals.length) return;
        if (seals.length === 2) twin++;
        const sh = c.querySelector('.qm-shen');
        const rg = document.createRange(); rg.selectNodeContents(sh);
        const st = rg.getBoundingClientRect();
        seals.forEach(s => {
          const b = s.getBoundingClientRect();
          if (inter(b, st) > 0) hit.push((c.querySelector('.qm-pal') || {}).textContent + ':' + s.textContent);
        });
      });
      /* 2026-11-12：暗干不再另造落款，直接坐**星曜（政余）那一行**——
         断言：8 枚 .qm-yin-agan、都在本宫卡内、贴左下角（与 .qm-stars 槽位一致）、
         旧节点（.qm-ag-in / .qm-agan / #qmRing .qm-rg）一个不剩。 */
      const pr = pan.getBoundingClientRect();
      const ags = [...pan.querySelectorAll('.qm-yin-agan')];
      let outCount = 0, slotBad = [];
      ags.forEach(el => {
        const b = el.getBoundingClientRect();
        const cb = el.parentElement.getBoundingClientRect();
        if (b.left < pr.left || b.right > pr.right || b.top < pr.top || b.bottom > pr.bottom) outCount++;
        /* 左下角：B1 定为「卡框内 10px 起排、离底 4px」——这里卡 8~13px 的窗口 */
        const dl = b.left - cb.left, db = cb.bottom - b.bottom;
        if (dl < 8 || dl > 13 || Math.abs(db) > 8) slotBad.push((el.parentElement.querySelector('.qm-pal') || {}).textContent + ':' + dl.toFixed(1) + '/' + db.toFixed(1));
      });
      const legacy = pan.querySelectorAll('.qm-ag-in, .qm-agan, #qmRing .qm-rg').length;
      return { twin, hit, ags: ags.length, outCount, slotBad, legacy };
    });
    if (m.err) bad.push(m.err);
    else {
      if (!m.twin) bad.push('阴盘样本里没有「空亡+驿马同宫」的宫，断言没生效');
      if (m.hit.length) bad.push('空亡/驿马压到八神：' + m.hit.join(','));
      if (m.ags !== 8) bad.push('宫内暗干应为 8 枚，实得 ' + m.ags);
      if (m.outCount) bad.push('有暗干跑出盘面：' + m.outCount + '/8');
      if (m.slotBad.length) bad.push('暗干不在星曜槽（左下角）：' + m.slotBad.join(' '));
      if (m.legacy) bad.push('旧暗干节点没清干净（.qm-ag-in / .qm-agan / #qmRing）：' + m.legacy);
    }
  }, '阴盘印章几何');

  if (errs.length) bad.push('运行期报错 → ' + errs.join(' | '));
  await browser.close();
  if (bad.length) { console.log('✗ 探针未过：'); bad.forEach(x => console.log('   - ' + x)); process.exit(1); }
  console.log('✓ 运行时探针全过（加载 / 起盘 / 下一时辰 / 串星课弹窗 / 串星三档与口径勾选 / 对齐尺寸阴影 / 阴盘印章）');
})();
