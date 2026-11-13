/* ============================================================================
 * rng.js —— 星曜奇门 · 共享随机源（Web Crypto 无偏采样）　2026-11-13
 * ----------------------------------------------------------------------------
 * 全项目**唯一**的随机实现：串星课（cx.js）与起盘页（随机时刻 / 随机一局）都走这里，
 * 别再在别处写第二套 Math.random —— 两处各写一套，早晚一个换了一个没换。
 *
 * 为什么不直接用 Math.random()：
 *   · 它是 V8 的 xorshift128+，不是物理熵，也不能跨端保证；
 *   · "Math.floor(r * k)" 那种写法本身带取模偏差（k 不整除 2^53 时各格概率不等）。
 * 这里给两把尺子：
 *   RNG.u32in(n)  [0,n) 的整数 —— 拒绝采样，lim = 2^32 − (2^32 % n)，>= lim 丢掉重抽，
 *                 lim 是 n 的整数倍 ⇒ v % n 在 0..n−1 上**严格**等概率。
 *   RNG.dbl()     [0,1) 的 double —— 取两个 u32，取高 27 + 26 = 53 位拼成
 *                 ((a>>>5) * 2^26 + (b>>>6)) / 2^53。2^53 在 double 里可精确表示，
 *                 这一步也没有任何取模，所以是**无偏**的 53 位均匀。
 *                 （起盘页「随机时刻」要跨 1950–2100，约 4.7e12 ms，远超 2^32 ——
 *                   只有 u32in 不够，必须用它。）
 *
 * ⚠ 降级**不静默**：拿不到 crypto（老 WebView / 被沙箱阉割）就退回 Math.random，
 *   并把这件事暴露出来 —— RNG.source() 是能力探测（每次现探，不缓存），
 *   RNG.last() 是**上一次真正用到的源**（'crypto' | 'pseudo'）。
 *   界面想提示"现在是伪随机"就读它们，别自己猜。
 *   整份文件里 Math.random 只许出现 1 次（唯一出口 pseudoRaw，自测会数源码）。
 *
 * 接口（挂 window.RNG；node 下同时 module.exports）：
 *   RNG.u32in(n)      [0, n) 的无偏整数
 *   RNG.dbl()         [0, 1) 的 53 位无偏 double
 *   RNG.pick(arr)     无偏取一个元素（空数组给可读报错）
 *   RNG.shuffle(arr)  Fisher-Yates **原地**打乱，返回同一个数组
 *   RNG.source()      'crypto' | 'pseudo'（能力探测）
 *   RNG.last()        'crypto' | 'pseudo'（上一次实际用的）
 *   RNG.LIM           2^32（给自测/排障看）
 *   RNG.SPEC          版本标签
 * ========================================================================== */
(function (root) {
  'use strict';

  var SPEC = '共享随机源 / Web Crypto 无偏 / 2026-11-13';
  var U32_LIM = 4294967296;              /* 2^32 */
  var buf1 = null;                       /* 复用 Uint32Array(1)：u32in 用 */
  var buf2 = null;                       /* 复用 Uint32Array(2)：dbl 用 */
  var lastSrc = '';                      /* 上一次真正用到的源；空串＝还没抽过 */

  function cryptoObj() {
    try {
      var c = root.crypto;
      return (c && typeof c.getRandomValues === 'function') ? c : null;
    } catch (e) { return null; }
  }
  /* 能力探测：每次现探、不缓存 —— 自测会把 crypto 临时摘掉再装回来 */
  function source() { return cryptoObj() ? 'crypto' : 'pseudo'; }
  /* 上一次实际用到的源：抽过就给真值，还没抽过就跟能力探测走 */
  function last() { return lastSrc || source(); }

  /* ------------------------------------------------ 降级出口（全文件唯一一处） */
  /* 唯一的 Math.random 调用点。pseudoInt / pseudoDbl 都从它派生，
     这样"降级"永远是一条路，不会出现第三处、第四处悄悄漏网的伪随机。 */
  function pseudoRaw() { lastSrc = 'pseudo'; return Math.random(); }
  function pseudoInt(n) { return Math.floor(pseudoRaw() * n); }
  function pseudoDbl() { return pseudoRaw(); }

  /* ---------------------------------------------------------------- 整数 */
  /* 无偏取 [0, n)：拒绝采样。
     lim = 2^32 − (2^32 % n) 是 n 的整数倍 ⇒ 只收 [0, lim) 的样本时，
     v % n 在 0..n−1 上严格等概率。
     （绝不要写 Math.floor(r*n) 或直接 v % n —— 那就有偏了。） */
  function u32in(n) {
    if (!(n > 0) || n !== Math.floor(n)) {
      throw new Error('RNG.u32in：n 要是正整数（收到 ' + n + '）');
    }
    var c = cryptoObj();
    if (!c) return pseudoInt(n);
    if (!buf1) buf1 = new Uint32Array(1);
    var lim = U32_LIM - (U32_LIM % n), v = 0, guard = 0;
    try {
      do {
        c.getRandomValues(buf1);
        v = buf1[0];
      } while (v >= lim && ++guard < 1024);
    } catch (e) {
      /* crypto 在但抽不动（极少数被裁剪的 WebView）：退伪随机，仍然不静默 */
      return pseudoInt(n);
    }
    if (v >= lim) return pseudoInt(n);   /* 兜底：guard 用完仍被拒（理论上到不了） */
    lastSrc = 'crypto';
    return v % n;
  }

  /* ---------------------------------------------------------------- double */
  /* [0, 1) 的 53 位均匀：高 27 位 + 26 位 = 53 位整数 / 2^53。
     2^53 恰好可精确表示，且全程没有取模 ⇒ 无偏。 */
  function dbl() {
    var c = cryptoObj();
    if (!c) return pseudoDbl();
    if (!buf2) buf2 = new Uint32Array(2);
    try { c.getRandomValues(buf2); } catch (e) { return pseudoDbl(); }
    lastSrc = 'crypto';
    return ((buf2[0] >>> 5) * 67108864 + (buf2[1] >>> 6)) / 9007199254740992;
  }

  /* ---------------------------------------------------------------- 集合 */
  function pick(arr) {
    if (!arr || typeof arr.length !== 'number' || !arr.length) {
      throw new Error('RNG.pick：要给一个非空数组');
    }
    return arr[u32in(arr.length)];
  }

  /* Fisher-Yates：从尾往前置换，每次在 [0, i] 里等概率挑一个。
     **原地**打乱并返回同一个数组（要保留原数组自己 slice() 一份）。 */
  function shuffle(arr) {
    if (!arr || typeof arr.length !== 'number' || arr.length < 2) return arr;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = u32in(i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  var API = {
    SPEC: SPEC,
    LIM: U32_LIM,
    u32in: u32in, dbl: dbl, pick: pick, shuffle: shuffle,
    source: source, last: last
  };

  root.RNG = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
