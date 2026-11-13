'use strict';
const { boot, ok, eq, info, stats } = require('./lib.js');

(async () => {
  const { browser, page, errs, init } = await boot();
  await init({});

  /* ---------- A. 阴影清单：四套主题 × 起盘页 / 串星页 ---------- */
  const listShadow = async (viewSel) => page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return { err: 'no ' + sel };
    const out = [];
    const walk = (el) => {
      for (const c of el.children) {
        const cs = getComputedStyle(c);
        if (cs.boxShadow && cs.boxShadow !== 'none') {
          out.push({
            tag: c.tagName.toLowerCase(), id: c.id || '', cls: (c.className || '').toString().slice(0, 60),
            shadow: cs.boxShadow.slice(0, 60),
            visible: !!(c.offsetWidth || c.offsetHeight) && cs.visibility !== 'hidden' && cs.display !== 'none',
            opacity: cs.opacity
          });
        }
        walk(c);
      }
    };
    walk(root);
    return { out };
  }, viewSel);

  for (const th of ['white', 'blue', 'slate', 'brown']) {
    await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, th);
    await page.click('#tabbar button[data-view="home"]');
    await page.waitForTimeout(120);
    const h = await listShadow('#view-home');
    await page.click('#tabbar button[data-view="chuanxing"]');
    await page.waitForTimeout(120);
    const c = await listShadow('#view-chuanxing');
    const isOverlay = (x) => /cxpop|sheet|toast|qdrop|crop-/.test(x.cls + ' ' + x.id);
    const hs = (h.out || []).filter(x => !isOverlay(x));
    const cs2 = (c.out || []).filter(x => !isOverlay(x));
    const overlays = (h.out || []).concat(c.out || []).filter(isOverlay);
    console.log(`[${th}] 页面内容区含阴影节点：起盘 ${hs.length} / 串星 ${cs2.length}；浮层（允许）${overlays.length} 个：`
      + overlays.map(x => '#' + x.id + '(' + x.shadow + ')').join(' '));
    hs.concat(cs2).forEach(x => console.log('    ' + JSON.stringify(x)));
    ok(hs.length === 0, `[${th}] 起盘页内容区应零 box-shadow，实有 ${hs.length}`);
    ok(cs2.length === 0, `[${th}] 串星页内容区应零 box-shadow，实有 ${cs2.length}`);
    const tc = await page.evaluate(() => getComputedStyle(document.querySelector('#view-chuanxing .timecard')).boxShadow);
    eq(tc, 'none', `[${th}] 串星页 .timecard 计算 box-shadow`);
  }
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'white'));
  await page.waitForTimeout(100);

  /* ---------- B. 三档：默认时间、只读、切档 ---------- */
  await page.click('#tabbar button[data-view="chuanxing"]');
  await page.waitForTimeout(200);
  const tabs = await page.evaluate(() => {
    const bar = document.getElementById('segCxSrc');
    return {
      labels: [...bar.children].map(b => b.textContent.trim()),
      on: [...bar.children].filter(b => b.classList.contains('on')).map(b => b.dataset.src),
      panelsOn: [...document.querySelectorAll('.cxpanel')].filter(p => p.classList.contains('on')).map(p => p.id),
      panelInputs: {
        time: document.querySelectorAll('#cxPanelTime input').length,
        nums: document.querySelectorAll('#cxPanelNums input').length,
        rand: document.querySelectorAll('#cxPanelRand input').length
      },
      nums: [...document.querySelectorAll('#cxTimeNums b')].map(b => b.textContent.trim()),
      lbs: [...document.querySelectorAll('#cxTimeNums .lb')].map(b => b.textContent.trim())
    };
  });
  console.log('  三档：', JSON.stringify(tabs));
  eq(tabs.labels.join('/'), '时间/数字/随机', '三档文案与顺序');
  eq(tabs.on.join(','), 'time', '首屏默认只亮「时间」');
  eq(tabs.panelsOn.join(','), 'cxPanelTime', '首屏只亮时间面板');
  eq(tabs.panelInputs.time, 0, '时间档四数不可编辑（无 input）');
  eq(tabs.panelInputs.nums, 4, '数字档四格');
  eq(tabs.lbs.join('/'), '天宫/地宫/人宫/天干', '时间档四格标签');
  const numsShape = tabs.nums.every(v => /^\d+$/.test(v));
  ok(numsShape, '时间档四数应是纯数字：' + tabs.nums.join(','));
  // 与引擎直算对表（读页面自己的 calendar）
  const expect = await page.evaluate(() => {
    const c = window.CX.numsFromChart(window.__cxChartForTest ? window.__cxChartForTest : null);
    return c;
  }).catch(() => null);

  /* ---------- C. 非法输入 ---------- */
  await page.click('#segCxSrc button[data-src="nums"]');
  await page.waitForTimeout(220);
  const setN = async (i, v) => {
    await page.fill('#cxN' + i, v);
    await page.waitForTimeout(60);
  };
  const cases = [
    { v: 'abc', label: '非数字' },
    { v: '1.5', label: '小数' },
    { v: '-3', label: '负数' },
    { v: '１２', label: '全角' },
    { v: '123', label: '三位' },
    { v: '', label: '空' }
  ];
  for (const cs of cases) {
    await setN(0, cs.v);
    if (cs.label === '空') {
      const s0 = await page.evaluate(() => ({
        bad: document.querySelectorAll('#cxPanelNums .cxi.bad').length,
        err: document.getElementById('cxNumErr').textContent.trim(),
        val: document.getElementById('cxN0').value
      }));
      info('空一格现在的态：bad=' + s0.bad + ' 提示「' + s0.err + '」值「' + s0.val + '」');
      await page.click('#btnCastX'); await page.waitForTimeout(150);
      const s1 = await page.evaluate(() => ({
        pop: document.getElementById('cxPop').classList.contains('on'),
        toast: document.getElementById('toast').textContent.trim(),
        focus: document.activeElement && document.activeElement.id
      }));
      ok(!s1.pop, '空一格点起课不该落课');
      ok(/没填/.test(s1.toast), '空一格应给出「没填」提示，实得「' + s1.toast + '」');
      eq(s1.focus, 'cxN0', '空一格失败后光标落到空格');
      continue;
    }
    const s = await page.evaluate(() => ({
      bad: document.querySelectorAll('#cxPanelNums .cxi.bad').length,
      err: document.getElementById('cxNumErr').textContent.trim(),
      val: document.getElementById('cxN0').value,
      stageN: document.querySelectorAll('#cxstage .nm, #cxstage .cxqin').length,
      btns: document.querySelectorAll('#cxstage button:not(.mhelp)').length
    }));
    ok(s.bad >= 1, `非法「${cs.label}」应标红一格`);
    ok(s.err.length > 0, `非法「${cs.label}」底部应给提示`);
    eq(s.val, cs.v, `非法「${cs.label}」不该改用户填的字`);
    eq(s.stageN, 0, `非法「${cs.label}」四格下不该长译名/六亲`);
    eq(s.btns, 0, `非法「${cs.label}」四格下不该长按钮`);
  }
  // 起课拦下 + 光标落到坏格
  await setN(0, 'abc'); await setN(1, '5'); await setN(2, '2'); await setN(3, '7');
  await page.click('#btnCastX');
  await page.waitForTimeout(200);
  let pop = await page.evaluate(() => document.getElementById('cxPop').classList.contains('on'));
  ok(!pop, '非法输入点「起课」不该开课页');
  const focusId = await page.evaluate(() => document.activeElement && document.activeElement.id);
  eq(focusId, 'cxN0', '起课失败光标应落到坏格');
  // 键盘属性
  const kb = await page.evaluate(() => [...document.querySelectorAll('#cxPanelNums input')].map(i =>
    [i.getAttribute('inputmode'), i.getAttribute('enterkeyhint'), i.getAttribute('type'), i.getAttribute('autocomplete')].join('|')));
  console.log('  四格键盘属性：', JSON.stringify(kb));
  ok(kb.every(x => x.startsWith('numeric|done|text|off')), '四格应是 numeric 键盘 + done 回车键');
  // 合法后能正常出课
  await setN(0, '1'); await setN(1, '5'); await setN(2, '2'); await setN(3, '7');
  const after = await page.evaluate(() => ({
    bad: document.querySelectorAll('.cxi.bad').length,
    err: document.getElementById('cxNumErr').textContent.trim()
  }));
  eq(after.bad, 0, '改回合法值后不该留红');
  eq(after.err, '', '改回合法值后提示应清空');
  await page.click('#btnCastX');
  await page.waitForTimeout(250);
  pop = await page.evaluate(() => document.getElementById('cxPop').classList.contains('on'));
  ok(pop, '合法四数点「起课」应开课页');

  /* ---------- D. 随机档：域、每次必变 ---------- */
  const ranges = { six: [1, 6], star: [1, 9] };
  for (const mode of ['six', 'star']) {
    await init({ theme: 'white', cxMode: mode });
    await page.click('#tabbar button[data-view="chuanxing"]');
    await page.waitForTimeout(220);
    const cur = await page.evaluate(() => document.getElementById('cxStar').checked);
    if ((mode === 'star') !== cur) { await page.click('#cxMode'); await page.waitForTimeout(320); }
    const closePop = async () => { await page.evaluate(() => document.getElementById('cxPopBack').click()); await page.waitForTimeout(120); };
    await closePop();
    await page.click('#segCxSrc button[data-src="rand"]');
    await page.waitForTimeout(220);
    const emptyRand = await page.evaluate(() => [...document.querySelectorAll('#cxRandNums b')].map(b => b.textContent.trim()));
    eq(emptyRand.join(''), '————', `[${mode}] 随机档未起课前应是四个 —`);
    const draws = [];
    for (let k = 0; k < 10; k++) {
      await page.click('#btnCastX');
      await page.waitForTimeout(140);
      const st = await page.evaluate(() => ({
        on: document.getElementById('cxPop').classList.contains('on'),
        sub: document.getElementById('cxPopSub').textContent,
        scene: [...document.querySelectorAll('#cxRandNums b')].map(b => b.textContent.trim()).join(','),
        names: [...document.querySelectorAll('#cxPopGrid .nm')].map(e => e.textContent.trim()).join('/')
      }));
      ok(st.on, `[${mode}] 随机档点起课应开课页（第 ${k + 1} 次）`);
      ok(/^(六神|九星) · 随机 /.test(st.sub), `[${mode}] 随机课副行应为「<口径> · 随机 …」实得「${st.sub}」`);
      ok(st.names.split('/').length === 7, `[${mode}] 随机课应出七格，实得「${st.names}」`);
      draws.push(st.scene);
      /* 重排再抽 */
      await page.evaluate(() => document.getElementById('cxPopAgain').click());
      await page.waitForTimeout(140);
      const st2 = await page.evaluate(() => [...document.querySelectorAll('#cxRandNums b')].map(b => b.textContent.trim()).join(','));
      draws.push(st2);
      await closePop();
    }
    const uniq = new Set(draws);
    ok(uniq.size >= 4, `[${mode}] 连抽 20 组应至少出现 4 组不同四数（实有 ${uniq.size}）`);
    const [lo, hi] = ranges[mode];
    let bad = [];
    draws.forEach(s2 => {
      const a = s2.split(',').map(Number);
      for (let i = 0; i < 3; i++) if (!(a[i] >= lo && a[i] <= hi)) bad.push(s2);
      if (!(a[3] >= 1 && a[3] <= 10)) bad.push(s2);
    });
    eq(bad.length, 0, `[${mode}] 随机域应为 前三数 ${lo}–${hi} / 末位 1–10，越界样本：` + bad.slice(0, 4).join(' '));
    console.log(`  [${mode}] 随机样本（20 组）：`, draws.join(' | '));
  }

  /* ---------- E. 三处高度与起盘页对齐 ---------- */
  await page.click('#tabbar button[data-view="home"]');
  await page.waitForTimeout(200);
  const H = await page.evaluate(() => {
    const r = s => { const el = document.querySelector(s); return el ? +el.getBoundingClientRect().height.toFixed(1) : null; };
    return { card: r('#view-home .timecard'), seg: r('#segMode3'), cast: r('#btnCast'), logo: r('#view-home .logo h2') };
  });
  await page.click('#tabbar button[data-view="chuanxing"]');
  await page.waitForTimeout(220);
  const C = await page.evaluate(() => {
    const r = s => { const el = document.querySelector(s); return el ? +el.getBoundingClientRect().height.toFixed(1) : null; };
    return { card: r('#view-chuanxing .timecard'), seg: r('#segCxSrc'), cast: r('#btnCastX'), logo: r('#view-chuanxing .logo h2') };
  });
  console.log('  高度 起盘：', JSON.stringify(H), ' 串星：', JSON.stringify(C));
  ok(Math.abs(H.card - C.card) <= 2, `时间卡高度差应 ≤2（${H.card} / ${C.card}）`);
  ok(Math.abs(H.seg - C.seg) <= 2, `分段行高度差应 ≤2（${H.seg} / ${C.seg}）`);
  ok(Math.abs(H.cast - C.cast) <= 2, `起课钮高度差应 ≤2（${H.cast} / ${C.cast}）`);

  console.log('  页面脚本报错：', errs.length ? JSON.stringify(errs) : '无');
  ok(errs.length === 0, '整轮不应有脚本报错：' + errs.join(' | '));
  const s = stats();
  console.log(`\nP1 汇总：${s.pass} 过 / ${s.fail} 败`);
  await browser.close();
})();
