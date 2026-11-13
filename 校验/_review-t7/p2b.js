'use strict';
const { boot, ok, eq, info, stats } = require('./lib.js');
const fs = require('fs');
const SRC = (process.env.XYQ_ROOT || process.cwd());

(async () => {
  const { browser, page, errs, init } = await boot();
  await init({ theme: 'white', cxMode: 'six' });
  await page.click('#tabbar button[data-view="chuanxing"]'); await page.waitForTimeout(200);
  await page.click('#segCxSrc button[data-src="nums"]'); await page.waitForTimeout(200);
  for (const [i, v] of [[0, '1'], [1, '5'], [2, '2'], [3, '7']]) await page.fill('#cxN' + i, v);
  await page.click('#btnCastX'); await page.waitForTimeout(220);
  await page.evaluate(() => document.getElementById('cxPopHelp').click());
  await page.waitForTimeout(280);

  const help = await page.evaluate(() => ({
    text: document.querySelector('.cxd-root').innerText,
    rootInSheet: !!document.querySelector('#sheet .cxd-root'),
    n: document.querySelectorAll('#sheet .cxd-card').length,
    sheetHasSwitch: document.querySelectorAll('#sheet input[type=checkbox], #sheet .cxmode, #sheet [role=checkbox]').length,
    sub: document.querySelector('#sheet .sub').textContent,
    h2: document.querySelector('#sheet h2').textContent,
    okBtn: !!document.getElementById('btnXkHelpOk')
  }));
  console.log('  读法外壳：', JSON.stringify({ rootInSheet: help.rootInSheet, cards: help.n, sub: help.sub, h2: help.h2, okBtn: help.okBtn, sheetHasSwitch: help.sheetHasSwitch }));
  ok(help.rootInSheet, '读法正文应落在 #sheet 里');
  eq(help.n, 7, '七张分节卡');
  eq(help.sheetHasSwitch, 0, '读法弹层里不该有切换控件');
  ok(help.okBtn, '「知道了」按钮在');
  eq(help.sub, '起课 · 天干论 · 六亲 · 实例 · 类象', '副标题');

  /* 逐句「连排连续」核对：正常直排的句子必须逐字出现（表格化的行单列白名单） */
  const raw = fs.readFileSync(SRC + '/小六壬·加干（2026.8.31）.txt', 'utf8')
    .replace(/\u0000/g, '').replace(/^\ufeff/, '');
  const norm = (s) => s.replace(/\s+/g, '')
    .replace(/‘|’/g, '“').replace(/「|」/g, '”')
    .replace(/[，。、；：！？（）()“”"『』《》…—\-·\u3000]/g, '');
  const body = norm(help.text);
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  /* 这些行被表格化/标题化，标点与分隔会被吸收；逐字核对放到「句段」层 */
  const TABLEISH = [/^甲木一/, /^甲 丙 庚 丁/, /^申 子 申 亥/, /^大安木 小吉水/, /^妻财\s+子孙/, /^大安 大安 小吉/, /^大安 速喜 速喜/, /^大安 大安 留连/, /^空亡 留连 空亡/, /^速喜 空亡 速喜/, /^赤口 赤口 大安/, /^父母克子孙/, /^官鬼克兄弟/, /^兄弟克妻财/, /^妻财克父母/, /^子孙克官鬼/];
  let bad = [];
  let checked = 0, skipped = 0;
  for (const l of lines) {
    if (l.startsWith('掌诀')) continue;
    if (TABLEISH.some(re => re.test(l))) { skipped++; continue; }
    /* 拆句：以 。 与 ； 为界（标题行末尾的 。 被标题吸收，去掉尾标点再比） */
    const sents = l.split(/[。；]/).map(x => x.trim()).filter(Boolean);
    for (const s0 of sents) {
      const s = norm(s0.replace(/小六壬/g, '串星课'));
      if (s.length < 4) continue;
      checked++;
      if (body.indexOf(s) < 0) bad.push(s.slice(0, 30));
    }
  }
  eq(bad.length, 0, '直排句必须逐字连续出现在读法里；缺：' + bad.slice(0, 6).join(' ｜ '));
  info(`逐字连续核对：${checked} 句全中，跳过表格化行 ${skipped} 条`);

  /* 关键句抽验（含被表格化那几行的字序） */
  const keySents = [
    '这种数法叫做“连根数起”，初始的地方，自数一次',
    '空亡原本不讨论五行属性，但为了模型的简单，故授之以土',
    '生天干者父母，天干生者子孙',
    '前三个数为0时，按照6来论。最后一个数为0时，按照10来论',
    '天干本体论是第一本体论，直接代表预测主体',
    '占断总思路：六亲为主，卦象为辅',
    '子孙生妻财 但是两个子孙空亡，废矣',
    '符号学将歧义视作符号系统内在的生命力'
  ];
  for (const k of keySents) {
    ok(norm(help.text).indexOf(norm(k)) >= 0, '关键句应逐字在：' + k.slice(0, 24) + '…');
  }
  /* 表格化的那几行：字序仍在 */
  const seqCheck = (seq) => { let i = 0; for (const ch of seq.replace(/\s/g, '')) { const j = body.indexOf(ch, i); if (j < 0) return false; i = j + 1; } return true; };
  ok(seqCheck('甲木一乙木二丙火三丁火四戊土五己土六庚金七辛金八壬水九癸水十'), '十天干数序字序完整');
  ok(seqCheck('甲丙庚丁申子申亥'), '四柱字序（干一行支一行）完整');
  ok(seqCheck('大安木小吉水空亡土庚金妻财子孙父母'), '起课示例课表字序完整');
  ok(seqCheck('父母克子孙绝嗣之象官鬼克兄弟管人之象兄弟克妻财劫财之象妻财克父母辍学之象子孙克官鬼失位之象'), '五克象字序完整');
  /* 七节里的每张卡都有正文 */
  const cardInfo = await page.evaluate(() => [...document.querySelectorAll('#sheet .cxd-card')].map(c => ({
    t: c.querySelector('.cxd-h').textContent.trim(),
    len: c.innerText.replace(/\s/g, '').length,
    tables: c.querySelectorAll('table').length,
    cards: 0
  })));
  console.log('  七卡：', JSON.stringify(cardInfo));
  ok(cardInfo.every(c => c.len > 30), '七张卡都应有正文');
  eq(cardInfo.filter(c => c.t === '实例').length, 1, '「实例」卡在');
  info('实例卡内课表数：' + (cardInfo.find(c => c.t === '实例') || {}).tables);

  /* 九星态：正文一字不改，只多一行口径提示 */
  const bodySix = norm(help.text);
  await page.evaluate(() => document.getElementById('btnXkHelpOk').click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('cxPopBack').click());
  await page.waitForTimeout(150);
  await page.click('#cxMode'); await page.waitForTimeout(320);
  await page.click('#btnCastX'); await page.waitForTimeout(220);
  await page.evaluate(() => document.getElementById('cxPopHelp').click());
  await page.waitForTimeout(280);
  const starHelp = await page.evaluate(() => ({
    text: document.querySelector('.cxd-root').innerText,
    note: (document.querySelector('#sheet .cxhnote') || {}).innerText || '',
    cards: document.querySelectorAll('#sheet .cxd-card').length
  }));
  ok(!!starHelp.note, '九星态应有 .cxhnote 口径提示');
  ok(/天禽/.test(starHelp.note) && /不按阳顺阴逆/.test(starHelp.note), '提示应写明星序与「不按阳顺阴逆」');
  eq(norm(starHelp.text), bodySix, '九星态读法正文必须与六神态一字不差');
  eq(starHelp.cards, 7, '九星态仍是七节');

  /* ⓘ 两枚说明 */
  await page.evaluate(() => document.getElementById('btnXkHelpOk').click());
  await page.waitForTimeout(150);
  await page.evaluate(() => document.getElementById('cxPopBack').click());
  await page.waitForTimeout(150);
  await page.click('#segCxSrc button[data-src="time"]'); await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('cxTimeHelp').click());
  await page.waitForTimeout(220);
  const h1 = await page.evaluate(() => document.querySelector('#sheet').innerText.replace(/\s+/g, ' ').slice(0, 200));
  ok(/四数\s*从哪来/.test(h1) || /四数从哪来/.test(h1), '时间档 ⓘ 应弹「四数从哪来」：' + h1.slice(0, 40));
  ok(/农历月号/.test(h1) && /甲＝1/.test(h1.replace(/\s/g, '')), '说明应写明直译口径');
  await page.evaluate(() => document.getElementById('btnCxNumsHelpOk').click());
  await page.waitForTimeout(150);
  await page.click('#segCxSrc button[data-src="rand"]'); await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('cxRandHelp').click());
  await page.waitForTimeout(220);
  const h2 = await page.evaluate(() => document.querySelector('#sheet').innerText.replace(/\s+/g, ' '));
  ok(/随机/.test(h2) && /1–9/.test(h2), '随机档 ⓘ 应说明域随口径：' + h2.slice(0, 60));

  const s = stats();
  console.log(`\nP2b 汇总：${s.pass} 过 / ${s.fail} 败`);
  console.log('  脚本报错：', errs.length ? JSON.stringify(errs) : '无');
  await browser.close();
})();
