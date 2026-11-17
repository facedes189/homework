/* 个人网页 · 交互脚本
   1) 滚动进入视口时淡入
   2) 技能条进入视口时生长
   3) 相册灯箱
   4) 页脚日期
   5) 留言表单交给邮件客户端
*/
(function () {
  'use strict';

  /* ---------- 1. 滚动淡入 ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- 2. 技能条 ---------- */
  var bars = document.querySelectorAll('.bar');
  function fillBars() {
    bars.forEach(function (bar) {
      var box = bar.getBoundingClientRect();
      if (box.top < window.innerHeight - 40) bar.classList.add('in');
    });
  }
  if (bars.length) {
    window.addEventListener('scroll', fillBars, { passive: true });
    window.addEventListener('load', fillBars);
    fillBars();
  }

  /* ---------- 3. 相册灯箱 ---------- */
  var shots = document.querySelectorAll('.shot');
  if (shots.length) {
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML =
      '<button class="close" type="button" aria-label="关闭">&times;</button>' +
      '<div><img alt=""></div>';
    document.body.appendChild(box);

    var boxImg = box.querySelector('img');

    function openBox(src, alt) {
      boxImg.src = src;
      boxImg.alt = alt || '';
      box.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeBox() {
      box.classList.remove('open');
      document.body.style.overflow = '';
    }

    shots.forEach(function (shot) {
      shot.addEventListener('click', function () {
        var img = shot.querySelector('img');
        openBox(img.getAttribute('src'), img.getAttribute('alt'));
      });
    });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('close')) closeBox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeBox();
    });
  }

  /* ---------- 4. 页脚日期 ---------- */
  var dateEl = document.getElementById('today');
  if (dateEl) {
    var d = new Date();
    var week = ['日', '一', '二', '三', '四', '五', '六'];
    dateEl.textContent = d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() +
      ' 日 · 星期' + week[d.getDay()];
  }
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- 5. 留言表单 ---------- */
  var form = document.getElementById('letter-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim();
      var mail = form.elements.email.value.trim();
      var text = form.elements.message.value.trim();
      var subject = encodeURIComponent('来自「个人网页」的留言 - ' + (name || '一位访客'));
      var body = encodeURIComponent(text + '\n\n—— ' + name + (mail ? '（' + mail + '）' : ''));
      window.location.href = 'mailto:1135759939@qq.com?subject=' + subject + '&body=' + body;
      var tip = document.getElementById('form-tip');
      if (tip) tip.textContent = '已唤起邮件客户端，如果没有任何反应，可以直接复制邮箱发信给我 : )';
    });
  }

  /* ---------- 6. 首页数字递增 ---------- */
  var nums = document.querySelectorAll('[data-count]');
  if (nums.length) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var countUp = function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      if (reduce) { el.textContent = target; return; }
      var startTime = null;
      var duration = 900;
      var tick = function (now) {
        if (!startTime) startTime = now;
        var p = Math.min((now - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if ('IntersectionObserver' in window && !reduce) {
      var ioNum = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            countUp(en.target);
            ioNum.unobserve(en.target);
          }
        });
      }, { threshold: 0.4 });
      nums.forEach(function (el) { ioNum.observe(el); });
    } else {
      nums.forEach(countUp);
    }
  }

  /* ---------- 7. 点赞（全站累计，可以一直点） ---------- */
  var likeBtn = document.getElementById('like-btn');
  var likeNum = document.getElementById('like-num');
  if (likeBtn && likeNum) {
    var LIKE_API = 'https://abacus.jasoncameron.dev';
    var LIKE_PATH = '/facedes-homework/likes3';
    var LIKE_CACHE = 'faded_like_count_v3';   // 上一次显示过的数字（换计数器时同步换名）
    var LIKE_QUEUE = 'faded_like_queue_v3';   // 还没同步出去的点击数

    var shown = null;     // 屏幕上显示的数字（只增不减）
    var server = null;    // 服务器已确认的数字
    var pending = 0;      // 排队等着同步的点击数
    var inflight = 0;     // 正在飞行的请求数
    var nextAt = 0;       // 429 退让时刻（只在服务器说「太快了」时才等待）
    var timer = null;
    var FLY = 3;          // 并发上限：盖住网络延迟，让排队尽快清空
    var STEP = 340;       // 两次请求的起搏间隔 ≈ 服务器容量（30 次/10 秒），不是人为限流

    function load(key) {
      try {
        var v = localStorage.getItem(key);
        return v === null ? null : Number(v);
      } catch (e) { return null; }
    }

    /* 写 localStorage 是同步 IO，连点时不能每一击都写：攒一下再落盘 */
    var writeTimer = null;
    function flushWrites() {
      if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
      try {
        localStorage.setItem(LIKE_QUEUE, String(pending));
        if (shown !== null) localStorage.setItem(LIKE_CACHE, String(shown));
      } catch (e) {}
    }
    function queueWrite() {
      if (writeTimer) return;
      writeTimer = setTimeout(flushWrites, 260);
    }

    /* 改文本会引起排版，合并到一帧里只写一次 */
    var paintQueued = false;
    function render() {
      if (shown === null) return;
      if (paintQueued) return;
      paintQueued = true;
      var go = function () {
        paintQueued = false;
        if (shown !== null && likeNum.textContent !== String(shown)) likeNum.textContent = shown;
      };
      if (window.requestAnimationFrame) requestAnimationFrame(go); else go();
    }

    /* ---- 反馈动画：只用 transform，动画对象只建一次，重播不产生垃圾 ---- */
    var heartIcon = likeBtn.querySelector('.heart');

    function replay(el, frames, opts) {
      if (!el || !el.animate) return;
      try {
        if (el.__a) { el.__a.currentTime = 0; el.__a.play(); }
        else { el.__a = el.animate(frames, opts); }
      } catch (e) { /* 动画失败绝不影响计数 */ }
    }
    function pressPill() {
      replay(likeBtn,
        [{ transform: 'scale(1)' }, { transform: 'scale(.955)', offset: .35 }, { transform: 'scale(1)' }],
        { duration: 200, easing: 'cubic-bezier(.3,.9,.4,1)' });
    }
    function pulseHeart() {
      replay(heartIcon,
        [{ transform: 'scale(1)' }, { transform: 'scale(1.34)' }, { transform: 'scale(1)' }],
        { duration: 180, easing: 'cubic-bezier(.3,.9,.4,1)' });
    }
    /* 排队同步：本地计数永远即时、永不丢；同步到云端则均匀起搏（≈3 次/秒，
       正好是服务器 30 次/10 秒的容量上限），3 路并发盖住网络延迟。
       服务器一旦回 429 就按它响应体里的提示等——这是它自己的规则，客户端只能遵守 */
    function schedule(ms) {
      if (timer) return;
      timer = setTimeout(function () { timer = null; pump(); }, ms);
    }
    function pump() {
      if (!window.fetch) return;
      if (pending <= 0) return;
      var wait = nextAt - Date.now();
      if (wait > 0) { schedule(wait); return; }
      while (inflight < FLY && pending > 0) {
        var now = Date.now();
        if (now < nextAt) break;
        inflight++;
        // 发出去就先从队列扣掉：万一页面被关掉，这一下也已经交给服务器了
        pending = Math.max(0, pending - 1);
        queueWrite();
        nextAt = Math.max(nextAt, now + STEP);   // 均匀起搏，别把额度窗口一次烧光

        fetch(LIKE_API + '/hit' + LIKE_PATH, { cache: 'no-store', keepalive: true })
          .then(function (r) {
            if (r.status === 429) {
              // 服务器把等待秒数写在响应体里：{"error":"Too many requests. Try again in 2s"}
              return r.json().catch(function () { return null; }).then(function (e) {
                var m = e && e.error && /(\d+)\s*s/i.exec(String(e.error));
                nextAt = Date.now() + (m ? Number(m[1]) * 1000 + 200 : 1500);
                pending++;       // 没收下就退回队列
                queueWrite();
              });
            }
            if (!r.ok) throw new Error('http ' + r.status);
            return r.json().then(function (d) {
              var v = Number(d && d.value);
              if (isNaN(v)) return;
              server = v;
              var est = v + pending;
              if (shown === null || est > shown) { shown = est; render(); }
              queueWrite();
            });
          })
          .catch(function () {
            pending++;           // 网络失败也退回队列，稍后再发
            nextAt = Math.max(nextAt, Date.now() + 1500);
            queueWrite();
          })
          .then(function () {
            inflight--;
            pump();              // 腾出并发位，继续把队列发完
          });
      }
      // 并发已满时：任何一个请求回来都会触发 pump 续上
    }

    // 先用上次的缓存垫一下，再取服务器上的真实累计
    var cached = load(LIKE_CACHE);
    var queued = load(LIKE_QUEUE);
    var SEED = 200;                 // 计数器的起始基数：万一服务器暂时取不到，先显示它，别显示「—」
    if (queued > 0) pending = Math.min(queued, 999);
    if (cached !== null) { shown = cached; render(); }

    // 取服务器数值：失败自动重试 3 次（服务偶尔会抽风），仍失败就用缓存/基数兜底
    function pullServer(tryNo) {
      if (!window.fetch) return;
      fetch(LIKE_API + '/get' + LIKE_PATH, { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var v = Number(d && d.value);
          if (isNaN(v)) throw new Error('bad');
          server = v;
          var est = v + pending;
          if (shown === null || est > shown) { shown = est; render(); }
          queueWrite();
          if (pending > 0) schedule(0);
        })
        .catch(function () {
          if (tryNo < 3) {
            setTimeout(function () { pullServer(tryNo + 1); }, 800 * tryNo);
            return;
          }
          if (shown === null) { shown = SEED; render(); queueWrite(); }   // 兜底，别让数字位空着
          if (pending > 0) schedule(0);
        });
    }
    pullServer(1);

    /* ---- 防机器人刷赞：只拦「程序自动点击」，不拦人手（连点器也算人手） ----
       检查三层，全部静默忽略，绝不打扰真人：
       ① isTrusted：脚本里 btn.click() / dispatchEvent 合成的事件必为 false
       ② navigator.webdriver：Puppeteer / Playwright / Selenium 等自动化浏览器必为 true
       ③ userAgent：无头浏览器（HeadlessChrome 等）和常见自动化框架的特征串
       ④ document.hasFocus()：真人点鼠标时窗口必然已获得焦点 */
    var isBot = navigator.webdriver ||
      /headless|puppeteer|playwright|phantomjs|selenium|webdriver/i.test(navigator.userAgent);
    function looksHuman(e) {
      if (isBot) return false;
      if (!e || e.isTrusted !== true) return false;
      try { if (!document.hasFocus()) return false; } catch (err) {}
      return true;
    }

    likeBtn.addEventListener('click', function (e) {
      if (!looksHuman(e)) return;   // AI / 脚本点的，一律不记
      // 先记账（本地 +1、入队、触发同步），动画放在最后：
      // 就算动画那一行出问题，也绝不会漏掉这一下
      shown = (shown === null ? 1 : shown + 1);
      pending++;
      queueWrite();
      schedule(0);
      render();
      pressPill();
      pulseHeart();
    });

    // 离开页面时先落盘，再把队列里的尽量补发出去
    window.addEventListener('pagehide', function () {
      flushWrites();
      if (!window.fetch || pending <= 0) return;
      var n = Math.min(pending, 5);
      pending = Math.max(0, pending - n);
      try { localStorage.setItem(LIKE_QUEUE, String(pending)); } catch (e) {}
      for (var i = 0; i < n; i++) {
        fetch(LIKE_API + '/hit' + LIKE_PATH, { cache: 'no-store', keepalive: true });
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) flushWrites();
    });
  }
})();
