/* 运行时探针（node 版）—— 与 校验/_probe_runtime.py 同一套手势，另加一条「阴盘印章不压八神」。
 *
 * 起因：本机 python 侧没有 playwright（2026-10-28 只剩 node 的 playwright-core），
 * 而 `_probe_runtime.py` 的依赖装不上。这里用 node 把同样的四步真点一遍，
 * 并补上本轮修的阴盘几何断言。python 版仍是老口径，二者不冲突。
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

  /* 阴盘：起一张「空亡与驿马同宫」的盘，断言印章不压八神字、不压暗干 */
  await step(async () => {
    await page.evaluate(() => document.getElementById('sheet').classList.remove('on'));
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
  console.log('✓ 运行时探针全过（加载 / 起盘 / 下一时辰 / 串星课弹窗 / 阴盘印章）');
})();
