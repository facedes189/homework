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
    var LIKE_PATH = '/facedes-homework/likes2';
    var LIKE_CACHE = 'faded_like_count_v2';   // 上一次显示过的数字（换计数器时同步换名）
    var LIKE_QUEUE = 'faded_like_queue_v2';   // 还没同步出去的点击数

    var shown = null;     // 屏幕上显示的数字（只增不减）
    var server = null;    // 服务器已确认的数字
    var pending = 0;      // 排队等着同步的点击数
    var busy = false;     // 是否有请求正在飞
    var nextAt = 0;       // 下一次允许发请求的时间
    var timer = null;
    var GAP = 420;        // 每次请求间隔
    var sent = [];        // 本标签页最近发出的请求时间
    var WINDOW = 10000;   // 服务端限流窗口
    var QUOTA = 20;       // 一个窗口内最多自己发几次（留足余量，基本不撞 429）

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
    /* 排队同步：一次只飞一个请求，按节奏发，429 就退让重试，绝不丢点击 */
    function schedule(ms) {
      if (timer) return;
      timer = setTimeout(function () { timer = null; flush(); }, ms);
    }
    function quotaWait() {
      var now = Date.now();
      while (sent.length && now - sent[0] > WINDOW) sent.shift();
      if (sent.length < QUOTA) return 0;
      return sent[0] + WINDOW - now + 30;
    }
    function flush() {
      if (busy || !window.fetch) return;
      if (pending <= 0) return;
      var wait = Math.max(nextAt - Date.now(), quotaWait());
      if (wait > 0) { schedule(wait); return; }

      busy = true;
      nextAt = Date.now() + GAP;
      sent.push(Date.now());
      if (sent.length > QUOTA * 2) sent.splice(0, sent.length - QUOTA);
      // 发出去就先从队列扣掉：万一页面被关掉，这一下也已经交给服务器了
      pending = Math.max(0, pending - 1);
      queueWrite();

      fetch(LIKE_API + '/hit' + LIKE_PATH, { cache: 'no-store', keepalive: true })
        .then(function (r) {
          if (r.status === 429) {
            var ra = Number(r.headers.get('Retry-After'));
            nextAt = Date.now() + (ra > 0 ? Math.min(ra + 300, 6000) : 1200);
            throw new Error('rate');
          }
          if (!r.ok) throw new Error('http ' + r.status);
          return r.json();
        })
        .then(function (d) {
          var v = Number(d && d.value);
          if (isNaN(v)) throw new Error('bad');
          server = v;
          var est = v + pending;
          if (shown === null || est > shown) { shown = est; render(); }
          queueWrite();
        })
        .catch(function () {
          pending++;      // 没成功就退回队列，稍后再发
          nextAt = Math.max(nextAt, Date.now() + 2000);
          queueWrite();
        })
        .then(function () {
          busy = false;
          if (pending > 0) schedule(Math.max(0, nextAt - Date.now()));
        });
    }

    // 先用上次的缓存垫一下，再取服务器上的真实累计
    var cached = load(LIKE_CACHE);
    var queued = load(LIKE_QUEUE);
    if (queued > 0) pending = Math.min(queued, 999);
    if (cached !== null) { shown = cached; render(); }

    if (window.fetch) {
      fetch(LIKE_API + '/get' + LIKE_PATH, { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var v = Number(d && d.value);
          if (isNaN(v)) return;
          server = v;
          var est = v + pending;
          if (shown === null || est > shown) { shown = est; render(); }
          queueWrite();
          if (pending > 0) schedule(0);
        })
        .catch(function () { if (pending > 0) schedule(0); });
    }

    likeBtn.addEventListener('click', function () {
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
