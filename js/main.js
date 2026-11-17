/* 个人网页 · 交互脚本
   1) 滚动进入视口时淡入
   2) 技能条进入视口时生长
   3) 相册灯箱（翻页 / 缩略图 / 双击放大 / 滑动切换）
   4) 页脚日期
   5) 留言表单 → 便签墙
   6) 首页数字递增
   7) 点赞
   8) 彩蛋
   9) 日夜主题
   10) 首页按时段问候
   11) 作品页旋钮
   12) 便签墙（拖动 / 本地保存）
   13) 探索成就
*/
(function () {
  'use strict';

  /* ---------- 0. 共用小工具 ---------- */
  function lsGet(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* 底部小提示条：彩蛋和成就共用 */
  function siteToast(msg) {
    var tip = document.querySelector('.egg-toast');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'egg-toast';
      document.body.appendChild(tip);
    }
    tip.textContent = msg;
    // 两次 rAF 保证已经布局过，过渡才会生效
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { tip.classList.add('on'); });
    });
    clearTimeout(tip.__t);
    tip.__t = setTimeout(function () { tip.classList.remove('on'); }, 2800);
  }

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

  /* ---------- 3. 相册灯箱：翻页、缩略图、双击放大、滑动切换 ---------- */
  var shots = [].slice.call(document.querySelectorAll('.shot'));
  if (shots.length) {
    var items = shots.map(function (shot) {
      var im = shot.querySelector('img');
      return {
        src: im.getAttribute('src'),
        alt: im.getAttribute('alt') || '',
        title: shot.getAttribute('data-title') || im.getAttribute('alt') || ''
      };
    });

    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', '照片查看');
    box.innerHTML =
      '<button class="close" type="button" aria-label="关闭">&times;</button>' +
      '<div class="lb-stage">' +
        '<button class="lb-nav lb-prev" type="button" aria-label="上一张">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
          'stroke-linecap="round" stroke-linejoin="round"><path d="M14.6 5.4 8 12l6.6 6.6"/></svg>' +
        '</button>' +
        '<figure class="lb-figure">' +
          '<img class="lb-img" alt="">' +
          '<figcaption class="lb-cap"><span class="lb-title"></span><span class="lb-count"></span></figcaption>' +
        '</figure>' +
        '<button class="lb-nav lb-next" type="button" aria-label="下一张">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
          'stroke-linecap="round" stroke-linejoin="round"><path d="M9.4 5.4 16 12l-6.6 6.6"/></svg>' +
        '</button>' +
        '<div class="lb-thumbs"></div>' +
      '</div>';
    document.body.appendChild(box);

    var lbImg = box.querySelector('.lb-img');
    var lbTitle = box.querySelector('.lb-title');
    var lbCount = box.querySelector('.lb-count');
    var thumbWrap = box.querySelector('.lb-thumbs');
    var cur = 0;
    var zoom = 1;
    var tx = 0;
    var ty = 0;
    var lastFocus = null;
    var seen = {};

    items.forEach(function (it, i) {
      var btn = document.createElement('button');
      btn.className = 'lb-thumb';
      btn.type = 'button';
      btn.setAttribute('aria-label', '第 ' + (i + 1) + ' 张：' + it.title);
      btn.innerHTML = '<img src="' + it.src + '" alt="">';
      btn.addEventListener('click', function () { show(i); });
      thumbWrap.appendChild(btn);
    });
    var thumbEls = [].slice.call(thumbWrap.children);

    // 缩放与平移：transform 以中心为原点，位移按缩放比例反算，点哪儿放大哪儿
    function paintZoom() {
      lbImg.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) scale(' + zoom + ')';
      lbImg.classList.toggle('zoomed', zoom > 1);
    }
    function clampPan() {
      var w = lbImg.offsetWidth;
      var h = lbImg.offsetHeight;
      var mx = w * (zoom - 1) / 2;
      var my = h * (zoom - 1) / 2;
      tx = Math.max(-mx, Math.min(mx, tx));
      ty = Math.max(-my, Math.min(my, ty));
    }
    function resetZoom() {
      zoom = 1;
      tx = 0;
      ty = 0;
      paintZoom();
    }

    function show(i) {
      cur = (i + items.length) % items.length;
      var it = items[cur];
      lbImg.src = it.src;
      lbImg.alt = it.alt;
      lbTitle.textContent = it.title;
      lbCount.textContent = (cur + 1) + ' / ' + items.length;
      thumbEls.forEach(function (el, k) { el.classList.toggle('on', k === cur); });
      resetZoom();
      // 六张都翻过一遍，记一个成就
      seen[cur] = 1;
      var seenCount = 0;
      for (var k in seen) if (seen.hasOwnProperty(k)) seenCount++;
      if (seenCount >= items.length) unlock('photos');
      // 顺手把左右两张也拉下来，翻页时不用等
      [-1, 1].forEach(function (d) {
        var pre = new Image();
        pre.src = items[(cur + d + items.length) % items.length].src;
      });
    }
    function step(d) { show(cur + d); }

    function openBox(i, from) {
      lastFocus = from || null;
      show(i);
      box.classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(function () { box.querySelector('.close').focus(); }, 40);
    }
    function closeBox() {
      if (!box.classList.contains('open')) return;
      box.classList.remove('open');
      document.body.style.overflow = '';
      resetZoom();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    shots.forEach(function (shot, i) {
      shot.setAttribute('role', 'button');
      shot.setAttribute('tabindex', '0');
      shot.setAttribute('aria-label', '放大查看：' + items[i].title);
      shot.addEventListener('click', function () { openBox(i, shot); });
      shot.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openBox(i, shot);
        }
      });
    });

    box.querySelector('.lb-prev').addEventListener('click', function () { step(-1); });
    box.querySelector('.lb-next').addEventListener('click', function () { step(1); });

    // 点背景或关闭键退出，点图片本身不退出
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('lb-stage')) closeBox();
      else if (e.target.classList.contains('close')) closeBox();
    });

    // 双击在「整图」和「2 倍」之间切换
    lbImg.addEventListener('dblclick', function (e) {
      if (zoom > 1) { resetZoom(); return; }
      var r = lbImg.getBoundingClientRect();
      var ox = (e.clientX - r.left) / r.width - .5;
      var oy = (e.clientY - r.top) / r.height - .5;
      zoom = 2.2;
      tx = ox * r.width * (1 - zoom);
      ty = oy * r.height * (1 - zoom);
      clampPan();
      paintZoom();
    });

    // 放大后按住拖动看细节
    var drag = null;
    lbImg.addEventListener('pointerdown', function (e) {
      if (zoom === 1) return;
      drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
      lbImg.classList.add('dragging');
      if (lbImg.setPointerCapture) lbImg.setPointerCapture(e.pointerId);
    });
    lbImg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      tx = drag.tx + (e.clientX - drag.x);
      ty = drag.ty + (e.clientY - drag.y);
      clampPan();
      paintZoom();
    });
    function endDrag() {
      drag = null;
      lbImg.classList.remove('dragging');
    }
    lbImg.addEventListener('pointerup', endDrag);
    lbImg.addEventListener('pointercancel', endDrag);

    // 手机上左右滑
    var touchStart = null;
    box.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1 || zoom > 1) return;
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (!touchStart) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - touchStart.x;
      var dy = t.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') closeBox();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
    window.addEventListener('resize', function () { if (zoom > 1) resetZoom(); });
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

  /* ---------- 5. 留言表单：先贴便签，想寄邮件再寄 ---------- */
  var form = document.getElementById('letter-form');
  if (form) {
    var formTip = document.getElementById('form-tip');
    var mailBtn = null;
    var lastLetter = null;

    function mailtoMe(name, mail, text) {
      var subject = encodeURIComponent('来自「个人网页」的留言 - ' + (name || '一位访客'));
      var body = encodeURIComponent(text + '\n\n—— ' + name + (mail ? '（' + mail + '）' : ''));
      window.location.href = 'mailto:1135759939@qq.com?subject=' + subject + '&body=' + body;
    }

    function sayTip(text, withMail) {
      if (!formTip) return;
      formTip.textContent = text;
      if (mailBtn && mailBtn.parentNode) mailBtn.parentNode.removeChild(mailBtn);
      mailBtn = null;
      if (!withMail) return;
      mailBtn = document.createElement('button');
      mailBtn.type = 'button';
      mailBtn.className = 'again';
      mailBtn.textContent = '用邮件寄一份';
      mailBtn.addEventListener('click', function () {
        if (lastLetter) mailtoMe(lastLetter.name, lastLetter.mail, lastLetter.text);
      });
      formTip.appendChild(mailBtn);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim() || '一位访客';
      var mail = form.elements.email.value.trim();
      var text = form.elements.message.value.trim();
      if (!text) {
        sayTip('还没写内容呢，写一句再贴。', false);
        form.elements.message.focus();
        return;
      }
      if (!addNote(name, text)) {
        mailtoMe(name, mail, text);
        sayTip('便签墙没准备好，已经改用邮件了。', false);
        return;
      }
      lastLetter = { name: name, mail: mail, text: text };
      form.elements.message.value = '';
      unlock('note');
      sayTip('便签贴好了，可以拖着换位置。它只存在这台电脑的浏览器里，想让我真的收到，', true);
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
      unlock('like');
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

  /* ---------- 8. 彩蛋：连点左栏头像十下，掉一场星星 ---------- */
  var avatar = document.querySelector('.side .avatar');
  if (avatar) {
    avatar.setAttribute('title', '连点十下试试');
    avatar.setAttribute('role', 'button');
    avatar.setAttribute('tabindex', '0');

    // 头像下方的提示语：彩蛋不再靠瞎碰，也兼作进度显示
    var sideTip = document.querySelector('.side-tip');
    var tipTxt = sideTip && sideTip.querySelector('.tip-txt');
    var TIP_IDLE = '多点我几次试试';
    try {
      if (localStorage.getItem('faded_egg_done') === '1' && sideTip) {
        sideTip.remove();
        sideTip = null;
        tipTxt = null;
      }
    } catch (e) {}

    // 提示退场：找到彩蛋后不再出现（记在本地，下次打开也不再扰）
    function tipDone(save) {
      if (!sideTip) return;
      // 只淡出、不摘节点：保留这点高度，卡片里的名字不会突然往上跳
      sideTip.classList.add('is-gone');
      sideTip = null;
      tipTxt = null;
      if (save) {
        try { localStorage.setItem('faded_egg_done', '1'); } catch (e) {}
      }
    }
    function tipSay(text) {
      if (tipTxt) tipTxt.textContent = text;
    }

    var taps = 0;
    var tapTimer = null;
    var reduceEgg = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function starRain() {
      if (reduceEgg) return;
      if (document.querySelector('.egg-rain')) return;
      var layer = document.createElement('div');
      layer.className = 'egg-rain';
      // 七色一轮，小星靠透明度做远近
      var palette = [[240, 180, 41], [225, 85, 60], [11, 95, 165], [127, 182, 227], [255, 215, 102], [255, 159, 122], [255, 246, 219]];
      // 手机屏幕小，数量减半，避免掉帧
      var total = window.innerWidth < 640 ? 140 : 240;
      for (var i = 0; i < total; i++) {
        var s = document.createElement('i');
        s.className = 'egg-star';
        var c = palette[i % palette.length];
        var near = i % 5 === 0;                    // 每五颗里挑一颗又大又实的，落下时有前后感
        var size = near ? 22 + Math.random() * 16 : 8 + Math.random() * 15;
        var alpha = near ? 1 : .45 + Math.random() * .4;
        var dur = Math.round(2400 + Math.random() * 2000);
        s.style.left = (Math.random() * 100) + 'vw';
        s.style.width = size + 'px';
        s.style.height = size + 'px';
        s.style.color = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha.toFixed(2) + ')';
        s.style.setProperty('--dur', dur + 'ms');
        // 负延迟：动画一开始就已经播到一半，星星一出现就铺满整屏；
        // 再配合 infinite，整场雨期间天上始终是满的，不会越落越稀。
        s.style.setProperty('--delay', -Math.round(Math.random() * dur) + 'ms');
        s.style.setProperty('--drift', Math.round((Math.random() - .5) * 240) + 'px');
        s.style.setProperty('--spin', Math.round(Math.random() * 620 - 310) + 'deg');
        layer.appendChild(s);
      }
      document.body.appendChild(layer);
      // 落满 4.6 秒后整层淡出，再拆节点
      setTimeout(function () {
        layer.classList.add('off');
        setTimeout(function () { layer.remove(); }, 560);
      }, 4600);
    }

    function eggBoom() {
      taps = 0;
      tipDone(true);
      avatar.classList.remove('is-wiggle');
      // 读一次布局，让动画能重新播
      void avatar.offsetWidth;
      avatar.classList.add('is-wiggle');
      starRain();
      unlock('egg');
      siteToast('你发现了彩蛋 · 十连击，掉一场星星雨');
    }

    function onTap() {
      taps++;
      if (taps >= 10) { eggBoom(); return; }
      // 点了几下降就报还差几下，比干等十次更有数
      tipSay('还差 ' + (10 - taps) + ' 下');
      // 每点一下重置计时：只要间隔不超过 2.2 秒，就接着往上数
      clearTimeout(tapTimer);
      tapTimer = setTimeout(function () {
        taps = 0;
        tipSay(TIP_IDLE);
      }, 2200);
    }

    avatar.addEventListener('click', onTap);
    // 点提示语本身也算一下，省得手指落在字上没反应
    if (sideTip) sideTip.addEventListener('click', onTap);
    avatar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); }
    });
    avatar.addEventListener('animationend', function () {
      avatar.classList.remove('is-wiggle');
    });
  }

  /* ---------- 9. 日 / 夜间主题切换 ---------- */
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    var rootEl = document.documentElement;
    var themeTxt = themeBtn.querySelector('.tt-txt');
    var syncTheme = function () {
      var dark = rootEl.getAttribute('data-theme') === 'dark';
      themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      themeBtn.setAttribute('title', dark ? '切换到日间模式' : '切换到夜间模式');
      if (themeTxt) themeTxt.textContent = dark ? '日间' : '夜间';
    };
    syncTheme();
    themeBtn.addEventListener('click', function () {
      var dark = rootEl.getAttribute('data-theme') === 'dark';
      if (dark) rootEl.removeAttribute('data-theme');
      else rootEl.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('faded_theme', dark ? 'light' : 'dark'); } catch (e) {}
      syncTheme();
      unlock('theme');
    });
  }

  /* ---------- 10. 首页按时段问候 ---------- */
  var clockEl = document.getElementById('greet-clock');
  if (clockEl) {
    var partOf = function (h) {
      if (h < 5) return 'night';
      if (h < 9) return 'dawn';
      if (h < 12) return 'morning';
      if (h < 17) return 'afternoon';
      if (h < 20) return 'dusk';
      return 'night';
    };
    var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var paintClock = function () {
      var now = new Date();
      clockEl.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
      var part = partOf(now.getHours());
      if (document.documentElement.getAttribute('data-daypart') !== part) {
        document.documentElement.setAttribute('data-daypart', part);
      }
    };
    paintClock();
    // 20 秒对一次表：页面一直开着跨过整点、或者跨过时段边界，问候会自己换过来
    setInterval(paintClock, 20000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) paintClock();
    });
  }

  /* ---------- 11. 作品页旋钮 ---------- */
  var knobEls = [].slice.call(document.querySelectorAll('.work [data-knob]'));
  if (knobEls.length) {
    var fmtX = function (v) { return v.toFixed(1) + '×'; };

    // 量一遍文字实际有多宽，宽度动画才知道该停在哪
    function measureText(el, txt) {
      var cs = window.getComputedStyle(el);
      var m = document.createElement('span');
      m.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;';
      m.style.font = cs.font;
      m.style.letterSpacing = cs.letterSpacing;
      m.textContent = txt;
      document.body.appendChild(m);
      var w = m.offsetWidth;
      document.body.removeChild(m);
      return w;
    }

    function applyTypeText(box, input) {
      if (!box) return;
      var txt = input.value;
      box.textContent = txt;
      var w = measureText(box, txt);
      box.style.setProperty('--type-w', (w + 2) + 'px');
      box.style.setProperty('--type-steps', String(Math.max(1, txt.length)));
      // 换了字就从头再打一遍，否则宽度会从中间跳过去
      box.style.animation = 'none';
      void box.offsetWidth;
      box.style.animation = '';
    }

    knobEls.forEach(function (input) {
      var kind = input.getAttribute('data-knob');
      var work = input.closest ? input.closest('.work') : null;
      var stage = work ? work.querySelector('.stage') : null;
      var valEl = input.parentNode.querySelector('.knob-val');
      if (!stage) return;

      if (kind === 'text') {
        var typing = work.querySelector('.typing');
        applyTypeText(typing, input);
        var wait = null;
        input.addEventListener('input', function () {
          clearTimeout(wait);
          wait = setTimeout(function () { applyTypeText(typing, input); }, 360);
        });
        input.addEventListener('change', function () {
          clearTimeout(wait);
          applyTypeText(typing, input);
        });
        return;
      }

      var paint = function () {
        var v = parseFloat(input.value) || 1;
        if (kind === 'spin') {
          stage.style.setProperty('--spin-dur', (9 / v).toFixed(2) + 's');
          stage.style.setProperty('--orbit-dur', (12 / v).toFixed(2) + 's');
          if (valEl) valEl.textContent = fmtX(v);
        } else if (kind === 'bob') {
          stage.style.setProperty('--bob-dur', (3.4 / v).toFixed(2) + 's');
          if (valEl) valEl.textContent = fmtX(v);
        } else if (kind === 'angle') {
          stage.style.setProperty('--sweep-angle', Math.round(v) + 'deg');
          if (valEl) valEl.textContent = Math.round(v) + '°';
        } else if (kind === 'sweep') {
          stage.style.setProperty('--sweep-dur', (4.4 / v).toFixed(2) + 's');
          if (valEl) valEl.textContent = fmtX(v);
        } else if (kind === 'type') {
          stage.style.setProperty('--type-dur', (5.5 / v).toFixed(2) + 's');
          if (valEl) valEl.textContent = fmtX(v);
        }
      };
      input.addEventListener('input', paint);
      paint();
    });
  }

  /* ---------- 12. 便签墙 ---------- */
  var wall = document.getElementById('note-wall');
  var NOTE_KEY = 'faded_notes_v1';
  // 手机屏幕窄，墙上放不下那么多张，少留几张反而看得清
  function noteMax() { return window.innerWidth < 640 ? 6 : 9; }
  var NOTE_COLORS = ['#fdf3c8', '#ffe3d0', '#dbeee2', '#dfe9fb', '#f3e2f1'];
  var notes = [];
  var noteZ = 10;
  var addNote = function () { return false; };

  if (wall) {
    var noteEmpty = document.getElementById('note-empty');
    var noteNum = document.getElementById('note-num');
    var savedNotes = lsGet(NOTE_KEY, []);
    if (Object.prototype.toString.call(savedNotes) === '[object Array]') {
      notes = savedNotes.filter(function (n) {
        return n && typeof n.text === 'string' && n.text && typeof n.id === 'string';
      }).slice(-noteMax());
    }

    function saveNotes() { lsSet(NOTE_KEY, notes); }

    function noteById(id) {
      for (var i = 0; i < notes.length; i++) if (notes[i].id === id) return notes[i];
      return null;
    }

    function bumpZ(el) {
      noteZ++;
      el.style.zIndex = String(noteZ);
    }

    function place(el, n) {
      var maxX = Math.max(0, wall.clientWidth - el.offsetWidth);
      var maxY = Math.max(0, wall.clientHeight - el.offsetHeight);
      el.style.left = Math.round(Math.max(0, Math.min(1, n.x || 0)) * maxX) + 'px';
      el.style.top = Math.round(Math.max(0, Math.min(1, n.y || 0)) * maxY) + 'px';
    }

    function syncWall() {
      if (noteEmpty) noteEmpty.hidden = notes.length > 0;
      if (noteNum) noteNum.textContent = String(notes.length);
    }

    function removeNote(id) {
      notes = notes.filter(function (n) { return n.id !== id; });
      var el = wall.querySelector('.note-card[data-id="' + id + '"]');
      if (el && el.parentNode) el.parentNode.removeChild(el);
      saveNotes();
      syncWall();
    }

    function bindDrag(el, n) {
      var st = null;
      el.addEventListener('pointerdown', function (e) {
        if (e.target && e.target.classList && e.target.classList.contains('note-del')) return;
        st = {
          px: e.clientX, py: e.clientY,
          l: el.offsetLeft, t: el.offsetTop,
          w: wall.clientWidth, h: wall.clientHeight,
          nw: el.offsetWidth, nh: el.offsetHeight
        };
        el.classList.add('dragging');
        bumpZ(el);
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
      });
      el.addEventListener('pointermove', function (e) {
        if (!st) return;
        var maxX = Math.max(0, st.w - st.nw);
        var maxY = Math.max(0, st.h - st.nh);
        var l = Math.max(0, Math.min(maxX, st.l + e.clientX - st.px));
        var t = Math.max(0, Math.min(maxY, st.t + e.clientY - st.py));
        el.style.left = l + 'px';
        el.style.top = t + 'px';
        n.x = maxX ? l / maxX : 0;
        n.y = maxY ? t / maxY : 0;
      });
      var end = function () {
        if (!st) return;
        st = null;
        el.classList.remove('dragging');
        saveNotes();
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }

    function buildNote(n) {
      var el = document.createElement('div');
      el.className = 'note-card';
      el.setAttribute('data-id', n.id);
      el.style.setProperty('--nc', n.c || NOTE_COLORS[0]);
      el.style.setProperty('--nr', (typeof n.r === 'number' ? n.r : 0) + 'deg');

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'note-del';
      del.textContent = '×';
      del.setAttribute('aria-label', '删掉这张便签');
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        removeNote(n.id);
      });

      var txt = document.createElement('div');
      txt.className = 'nc-text';
      txt.textContent = n.text;

      var meta = document.createElement('div');
      meta.className = 'nc-meta';
      var who = document.createElement('b');
      who.textContent = n.name || '匿名';
      var when = document.createElement('span');
      when.textContent = n.d || '';
      meta.appendChild(who);
      meta.appendChild(when);

      el.appendChild(del);
      el.appendChild(txt);
      el.appendChild(meta);
      // 入场动画播完就钉住，之后拖动松手不会再弹一次
      el.addEventListener('animationend', function (e) {
        if (e.animationName === 'noteIn') el.classList.add('settled');
      });
      bindDrag(el, n);
      return el;
    }

    function addNoteToWall(name, text) {
      if (!wall) return false;
      var d = new Date();
      // 位置：按便签的实际大小算一个“别压住别人”的间距，随机撒 40 次挑一个空的
      var anyCard = wall.querySelector('.note-card');
      var cardW = anyCard ? anyCard.offsetWidth : 152;
      var cardH = anyCard ? anyCard.offsetHeight : 132;
      var gapX = (cardW + 14) / Math.max(1, wall.clientWidth - cardW);
      var gapY = (cardH + 12) / Math.max(1, wall.clientHeight - cardH);
      var x = .5;
      var y = .45;
      var best = -1;
      for (var i = 0; i < 40; i++) {
        var cx = .04 + Math.random() * .9;
        var cy = .03 + Math.random() * .86;
        var free = true;
        var near = 2;
        for (var j = 0; j < notes.length; j++) {
          var dx = Math.abs((notes[j].x || 0) - cx);
          var dy = Math.abs((notes[j].y || 0) - cy);
          if (dx < gapX && dy < gapY) free = false;
          var dd = Math.max(dx / gapX, dy / gapY);
          if (dd < near) near = dd;
        }
        if (free) { x = cx; y = cy; best = 9; break; }
        if (near > best) { best = near; x = cx; y = cy; }
      }

      var n = {
        id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        name: name,
        text: text,
        t: Date.now(),
        d: (d.getMonth() + 1) + '.' + d.getDate(),
        c: NOTE_COLORS[notes.length % NOTE_COLORS.length],
        r: Math.round((Math.random() * 4 - 2) * 10) / 10,
        x: Math.max(.04, Math.min(.9, x)),
        y: Math.max(.02, Math.min(.86, y))
      };

      notes.push(n);
      while (notes.length > noteMax()) {
        var gone = notes.shift();
        var ge = wall.querySelector('.note-card[data-id="' + gone.id + '"]');
        if (ge && ge.parentNode) ge.parentNode.removeChild(ge);
      }
      saveNotes();

      var el = buildNote(n);
      wall.appendChild(el);
      place(el, n);
      bumpZ(el);
      syncWall();
      return true;
    }

    // 首次铺墙
    notes.forEach(function (n) {
      var el = buildNote(n);
      wall.appendChild(el);
      place(el, n);
      bumpZ(el);
    });
    syncWall();

    var rzTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(rzTimer);
      rzTimer = setTimeout(function () {
        if (!wall) return;
        [].slice.call(wall.querySelectorAll('.note-card')).forEach(function (el) {
          var n = noteById(el.getAttribute('data-id'));
          if (n) place(el, n);
        });
      }, 140);
    });

    addNote = addNoteToWall;
  }

  /* ---------- 13. 探索成就 ---------- */
  var ACHV_KEY = 'faded_achv_v1';
  var ACHV_DEF = [
    { id: 'like', name: '拍手', tip: '点一下「点个赞」' },
    { id: 'egg', name: '星星雨', tip: '连点头像十下' },
    { id: 'photos', name: '六张照片', tip: '相册里翻完六张' },
    { id: 'theme', name: '换过天色', tip: '切换一次日夜' },
    { id: 'note', name: '留下的字', tip: '贴一张便签' },
    { id: 'pages', name: '走遍全站', tip: '五个页面都打开' }
  ];
  var achvDone = {};
  (function () {
    var arr = lsGet(ACHV_KEY, []);
    if (Object.prototype.toString.call(arr) === '[object Array]') {
      arr.forEach(function (id) { if (typeof id === 'string') achvDone[id] = 1; });
    }
  })();

  var achvList = null;
  var achvCount = null;

  function paintAchv() {
    if (!achvList) return;
    var got = 0;
    [].slice.call(achvList.children).forEach(function (li) {
      var on = !!achvDone[li.getAttribute('data-id')];
      if (on) got++;
      li.classList.toggle('on', on);
    });
    if (achvCount) achvCount.textContent = got + ' / ' + ACHV_DEF.length;
  }

  function unlock(id) {
    if (achvDone[id]) return;
    var def = null;
    for (var i = 0; i < ACHV_DEF.length; i++) if (ACHV_DEF[i].id === id) def = ACHV_DEF[i];
    if (!def) return;
    achvDone[id] = 1;
    var arr = [];
    for (var k in achvDone) if (achvDone.hasOwnProperty(k)) arr.push(k);
    lsSet(ACHV_KEY, arr);
    paintAchv();
    siteToast('解锁成就 · ' + def.name);
  }

  (function buildAchv() {
    var foot = document.querySelector('.site-footer .footer-inner');
    if (!foot) return;
    var box = document.createElement('div');
    box.className = 'achv';

    var label = document.createElement('span');
    label.className = 'achv-label';
    label.appendChild(document.createTextNode('探索成就'));
    achvCount = document.createElement('b');
    achvCount.textContent = '0 / ' + ACHV_DEF.length;
    label.appendChild(achvCount);

    achvList = document.createElement('ul');
    achvList.className = 'achv-list';

    ACHV_DEF.forEach(function (d) {
      var li = document.createElement('li');
      li.className = 'achv-item';
      li.setAttribute('data-id', d.id);
      li.setAttribute('data-tip', d.tip);
      li.setAttribute('tabindex', '0');

      var off = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      off.setAttribute('class', 'ico-off');
      off.setAttribute('viewBox', '0 0 24 24');
      off.setAttribute('fill', 'none');
      off.setAttribute('stroke', 'currentColor');
      off.setAttribute('stroke-width', '1.8');
      off.setAttribute('stroke-linecap', 'round');
      off.innerHTML = '<rect x="4.4" y="10.4" width="15.2" height="9.4" rx="2"/><path d="M7.9 10.4V7.7a4.1 4.1 0 0 1 8.2 0v2.7"/>';

      var on = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      on.setAttribute('class', 'ico-on');
      on.setAttribute('viewBox', '0 0 24 24');
      on.setAttribute('fill', 'none');
      on.setAttribute('stroke', 'currentColor');
      on.setAttribute('stroke-width', '2.1');
      on.setAttribute('stroke-linecap', 'round');
      on.setAttribute('stroke-linejoin', 'round');
      on.innerHTML = '<path d="M4.6 12.6l4.9 4.9L19.5 6.7"/>';

      var name = document.createElement('span');
      name.textContent = d.name;

      li.appendChild(off);
      li.appendChild(on);
      li.appendChild(name);
      achvList.appendChild(li);
    });

    box.appendChild(label);
    box.appendChild(achvList);
    foot.appendChild(box);
    paintAchv();
  })();

  // 「走遍全站」：五个页面各打开一次就点亮
  (function trackPages() {
    var PAGES = ['index.html', 'about.html', 'works.html', 'gallery.html', 'thoughts.html'];
    var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (PAGES.indexOf(here) < 0) return;
    var seenPages = lsGet('faded_pages_v1', []);
    if (Object.prototype.toString.call(seenPages) !== '[object Array]') seenPages = [];
    if (seenPages.indexOf(here) < 0) {
      seenPages.push(here);
      lsSet('faded_pages_v1', seenPages);
    }
    if (seenPages.length >= PAGES.length) unlock('pages');
  })();
})();
