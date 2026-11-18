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
   11) 作品页旋钮（含「随机一下」）
   12) 便签墙（拖动 / 本地保存）
   13) 探索成就
  14) 足迹码（进度搬去别的设备）
  15) 阅读进度环
  16) 心得页目录联动 / 上次读到哪
  17) 今日一句（按天轮换）
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

  /* ---------- 7. 点赞（本机累计，可以一直点） ---------- */
  var likeBtn = document.getElementById('like-btn');
  var likeNum = document.getElementById('like-num');
  if (likeBtn && likeNum) {
    /* 这里刻意不接第三方计数器。原来接的是 abacus.jasoncameron.dev，
       那个服务一挂，页面每次打开都会在控制台留下几条红色失败请求；
       个人作业站也用不上“全站共享”的计数——改成纯本机累计后，
       点击照样即时响应、刷新不丢，而且不再依赖任何外部接口。 */
    var LIKE_CACHE = 'faded_like_count_v4';
    var LIKE_OLD   = 'faded_like_count_v3';
    var LIKE_QUEUE = 'faded_like_queue_v3';

    var shown = null;     // 屏幕上显示的数字（只增不减）

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
      try { if (shown !== null) localStorage.setItem(LIKE_CACHE, String(shown)); } catch (e) {}
    }
    function queueWrite() {
      if (writeTimer) return;
      writeTimer = setTimeout(flushWrites, 260);
    }

    /* 改文本会引起排版，合并到一帧里只写一次 */
    var paintQueued = false;
    function render() {
      if (shown === null) return;
      /* 标签页在后台时 rAF 会被浏览器暂停，数字会一直空着显示「—」；
         这种情况先同步写一次，等切回前台再走合并写入 */
      if (!window.requestAnimationFrame || document.visibilityState === 'hidden') {
        if (likeNum.textContent !== String(shown)) likeNum.textContent = shown;
        return;
      }
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

    /* 首次打开：接上以前点过的数字；旧版本留在本机的“待同步队列”已无用，清掉 */
    var cached = load(LIKE_CACHE);
    if (cached === null) cached = load(LIKE_OLD);
    var SEED = 200;                 // 起始基数，别让数字位空着
    shown = (cached !== null && !isNaN(cached)) ? cached : SEED;
    render();
    try { localStorage.removeItem(LIKE_QUEUE); } catch (e) {}

    /* ---- 防机器人刷赞：只拦「程序自动点击」，不拦人手（连点器也算人手） ----
       ① isTrusted：脚本里 btn.click() / dispatchEvent 合成的事件必为 false
       ② navigator.webdriver：Puppeteer / Playwright / Selenium 等自动化浏览器必为 true
       ③ userAgent：无头浏览器和常见自动化框架的特征串
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
      /* 先记账，动画放在最后：就算动画那一行出问题，也绝不会漏掉这一下 */
      shown = (shown === null ? 1 : shown + 1);
      queueWrite();
      render();
      pressPill();
      pulseHeart();
    });

    /* 离开页面时把没落盘的数字写完 */
    window.addEventListener('pagehide', flushWrites);
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

    /* 「随机一下」：把四件作品的旋钮一起摇一组新参数 */
    var DICE_TEXT = [
      '> hello, little house',
      '> 今天也在慢慢练',
      '> npm run build',
      '> 你好，世界',
      '> git push origin main',
      '> 慢一点也没关系'
    ];
    var KNOB_DEF = { spin: '1', bob: '1', angle: '22', sweep: '1', type: '1', text: '> hello, little house' };

    function setKnob(kind, v) {
      var input = document.querySelector('.work [data-knob="' + kind + '"]');
      if (!input) return;
      input.value = v;
      input.dispatchEvent(new Event(kind === 'text' ? 'change' : 'input', { bubbles: true }));
    }

    var dice = document.getElementById('work-dice');
    if (dice) {
      dice.addEventListener('click', function () {
        var rnd = function (a, b) { return (a + Math.random() * (b - a)).toFixed(1); };
        setKnob('spin', rnd(0.4, 2.6));
        setKnob('bob', rnd(0.5, 2.4));
        setKnob('angle', String(Math.round(Math.random() * 58)));
        setKnob('sweep', rnd(0.5, 2.4));
        setKnob('type', rnd(0.6, 2.4));
        setKnob('text', DICE_TEXT[Math.floor(Math.random() * DICE_TEXT.length)]);
        siteToast('换了一组，再点一次又不一样');
      });
    }

    var resetBtn = document.getElementById('work-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        for (var k in KNOB_DEF) {
          if (KNOB_DEF.hasOwnProperty(k)) setKnob(k, KNOB_DEF[k]);
        }
        siteToast('回到默认的样子');
      });
    }
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

  /* ---------- 13. 探索成就（含 14 的足迹码） ---------- */
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
    box.appendChild(buildShare());
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

  /* ---------- 14. 足迹码 ----------
     成就和便签都只存在本机浏览器里，换台设备就是一张白纸。
     这里把进度折成一行字：f1.<成就 id>-<成就 id>.<打开过的页面>
     带在链接的 # 后面，在别的设备打开就合过来。
  */
  function achvIds() {
    var out = [];
    for (var i = 0; i < ACHV_DEF.length; i++) {
      if (achvDone[ACHV_DEF[i].id]) out.push(ACHV_DEF[i].id);
    }
    return out;
  }
  function seenPages() {
    var a = lsGet('faded_pages_v1', []);
    return Object.prototype.toString.call(a) === '[object Array]' ? a : [];
  }
  function footCode() {
    return 'f1,' + achvIds().join('-') + ',' + seenPages().join('-');
  }
  function footLink() {
    // 用 href 而不是 origin + pathname：本地双击打开（file://）时 origin 是 "null"
    return location.href.split('#')[0].split('?')[0] + '#foot=' + footCode();
  }
  /* 收下一张足迹码，只添不减：别把人家本机已经拿到的成就弄丢 */
  function applyFoot(raw) {
    if (!raw) return null;
    var s = String(raw);
    var p = s.indexOf('foot=');
    if (p >= 0) s = s.slice(p + 5); else if (s.charAt(0) === '#') s = s.slice(1);
    s = s.replace(/\s+/g, '');
    try { s = decodeURIComponent(s); } catch (e) {}
    // 逗号分两组：成就 id、打开过的页面（页面名里带 . ，所以不用点分组）
    var m = /^f1,([A-Za-z0-9_-]*),([A-Za-z0-9_.-]*)$/.exec(s);
    if (!m) return null;

    var got = 0;
    (m[1] ? m[1].split('-') : []).forEach(function (id) {
      for (var i = 0; i < ACHV_DEF.length; i++) {
        if (ACHV_DEF[i].id === id && !achvDone[id]) { achvDone[id] = 1; got++; }
      }
    });
    if (got) { lsSet(ACHV_KEY, achvIds()); paintAchv(); }

    var pages = seenPages();
    var added = 0;
    (m[2] ? m[2].split('-') : []).forEach(function (name) {
      if (name && pages.indexOf(name) < 0) { pages.push(name); added++; }
    });
    if (added) {
      lsSet('faded_pages_v1', pages);
      if (pages.length >= 5 && !achvDone.pages) { achvDone.pages = 1; lsSet(ACHV_KEY, achvIds()); paintAchv(); got++; }
    }
    return got;
  }

  function buildShare() {
    var wrap = document.createElement('span');
    wrap.className = 'achv-share';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'achv-code';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', '足迹码：把进度带到别的设备');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round"><path d="M9.6 14.4l4.8-4.8"/>' +
      '<path d="M13.2 5.7l1.7-1.7a3.3 3.3 0 0 1 4.7 4.7l-1.7 1.7"/>' +
      '<path d="M10.8 18.3l-1.7 1.7a3.3 3.3 0 0 1-4.7-4.7l1.7-1.7"/></svg>' +
      '<span>足迹码</span>';

    var pop = document.createElement('div');
    pop.className = 'foot-pop';
    pop.hidden = true;

    var lead = document.createElement('p');
    lead.className = 'fp-lead';
    lead.textContent = '成就只记在这台设备的浏览器里。把这行字带走，在另一台设备上打开，就合过去了。';

    var row1 = document.createElement('div');
    row1.className = 'fp-row';
    var link = document.createElement('input');
    link.className = 'fp-field';
    link.readOnly = true;
    link.setAttribute('aria-label', '带足迹的链接');
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'fp-btn';
    copy.textContent = '复制';
    row1.appendChild(link);
    row1.appendChild(copy);

    var row2 = document.createElement('div');
    row2.className = 'fp-row';
    var paste = document.createElement('input');
    paste.className = 'fp-field';
    paste.type = 'text';
    paste.placeholder = '或把别处的足迹码贴到这儿';
    paste.setAttribute('aria-label', '粘贴足迹码');
    var imp = document.createElement('button');
    imp.type = 'button';
    imp.className = 'fp-btn';
    imp.textContent = '带入';
    row2.appendChild(paste);
    row2.appendChild(imp);

    pop.appendChild(lead);
    pop.appendChild(row1);
    pop.appendChild(row2);

    var open = false;
    var hideTimer = null;

    function show() {
      link.value = footLink();
      clearTimeout(hideTimer);
      pop.style.setProperty('--pop-x', '0px');
      pop.hidden = false;
      // 量一次：靠近屏幕右边缘就往回挪，别把页面撑出横向滚动条
      var r = pop.getBoundingClientRect();
      var over = r.right - (window.innerWidth - 16);
      if (over > 0) pop.style.setProperty('--pop-x', -Math.min(over, r.left - 16) + 'px');
      requestAnimationFrame(function () { pop.classList.add('open'); });
      btn.setAttribute('aria-expanded', 'true');
      open = true;
    }
    function hide() {
      if (!open) return;
      open = false;
      pop.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      hideTimer = setTimeout(function () { pop.hidden = true; }, 220);
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (open) hide(); else show();
    });

    copy.addEventListener('click', function () {
      var text = footLink();
      link.value = text;
      link.focus();
      link.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      if (ok) { siteToast('足迹链接已复制'); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          siteToast('足迹链接已复制');
        }, function () {
          siteToast('已选中，按 Ctrl+C 复制');
        });
      } else {
        siteToast('已选中，按 Ctrl+C 复制');
      }
    });

    function doImport() {
      var got = applyFoot(paste.value);
      if (got === null) { siteToast('这段字不太像足迹码'); return; }
      paste.value = '';
      siteToast(got ? '带入 ' + got + ' 枚成就' : '这张足迹码里的都已经有了');
    }
    imp.addEventListener('click', doImport);
    paste.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doImport(); }
    });

    document.addEventListener('click', function (e) {
      if (open && !wrap.contains(e.target)) hide();
    });
    document.addEventListener('keydown', function (e) {
      if (open && e.key === 'Escape') { hide(); btn.focus(); }
    });

    wrap.appendChild(btn);
    wrap.appendChild(pop);
    return wrap;
  }

  /* 打开带 #foot= 的链接：合进来，然后把地址栏擦干净，刷新不会再提示一次。
     也听 hashchange：已经在这个页面上时，把链接贴进地址栏只会改 hash，不会重新加载 */
  function readFootHash() {
    if (!/[#&]foot=/.test(location.hash)) return;
    var got = applyFoot(location.hash);
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch (e) {
      location.hash = '';
    }
    if (got === null) siteToast('这段字不太像足迹码');
    else if (got) setTimeout(function () { siteToast('已带入 ' + got + ' 枚成就'); }, 300);
  }
  readFootHash();
  window.addEventListener('hashchange', readFootHash);

  /* ---------- 15. 阅读进度环 ---------- */
  (function readRing() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var R = 14;
    var C = 2 * Math.PI * R;
    var MIN = 260;   // 可滚距离少于这么多就不算「长页」，404 这种不给它出场
    var el = null;
    var bar = null;
    var max = 0;
    var queued = false;
    var done = false;
    var awayTimer = null;

    function build() {
      el = document.createElement('button');
      el.type = 'button';
      el.className = 'read-ring';
      el.setAttribute('aria-label', '回到顶部');
      el.setAttribute('title', '回到顶部');
      el.innerHTML =
        '<svg viewBox="0 0 34 34" aria-hidden="true">' +
        '<circle class="rr-track" cx="17" cy="17" r="' + R + '"/>' +
        '<circle class="rr-bar" cx="17" cy="17" r="' + R + '"/>' +
        '<path class="rr-tick" d="M11.4 17.5l3.7 3.7 7.5-7.8"/>' +
        '</svg>';
      document.body.appendChild(el);
      bar = el.querySelector('.rr-bar');
      bar.style.strokeDasharray = C.toFixed(2);
      bar.style.strokeDashoffset = C.toFixed(2);
      el.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      });
    }

    function measure() {
      max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > MIN && !el) build();
      if (el) el.style.display = max > MIN ? '' : 'none';
    }

    function paint() {
      queued = false;
      if (!el || max <= MIN) return;
      var p = window.scrollY / max;
      if (p < 0) p = 0; else if (p > 1) p = 1;
      bar.style.strokeDashoffset = (C * (1 - p)).toFixed(2);
      el.classList.toggle('is-vis', window.scrollY > 110);

      if (p > 0.995) {
        if (!done) {
          done = true;
          el.classList.add('done');
          el.classList.remove('is-away');
          // 读完了停两秒退场；往上滚回来它会重新出现
          clearTimeout(awayTimer);
          awayTimer = setTimeout(function () { el.classList.add('is-away'); }, 2000);
        }
      } else if (done) {
        done = false;
        clearTimeout(awayTimer);
        el.classList.remove('done', 'is-away');
      }
    }

    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }

    measure();
    if (el) paint();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      measure();
      onScroll();
    });
    window.addEventListener('load', function () {
      measure();
      onScroll();
    });
    // 图片是懒加载的，晚一点再量一次高度
    setTimeout(function () { measure(); onScroll(); }, 1500);
  })();

  /* ---------- 16. 心得页：目录联动 + 上次读到哪 ---------- */
  (function readingTrail() {
    var posts = [].slice.call(document.querySelectorAll('.post[id]'));
    if (!posts.length) return;

    var KEY = 'faded_read_v1';
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* 同一篇在页内目录与左栏目录里各有一个入口，两处一起亮 */
    var links = {};
    [].forEach.call(document.querySelectorAll('.post-toc a[href^="#"], .side-list a[href^="#"]'), function (a) {
      var id = a.getAttribute('href').slice(1);
      (links[id] = links[id] || []).push(a);
    });

    /* 视线大致落在上半屏：过了这条线的最后一篇，就算正在读它。
       页面短、三篇同屏时，这条线也得比「顶边 148px」更宽容，否则永远亮第一篇 */
    function idAt(offset) {
      var id = '';
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].getBoundingClientRect().top <= offset) id = posts[i].id;
      }
      if (!id && posts[0].getBoundingClientRect().top < window.innerHeight * 0.9) id = posts[0].id;
      return id;
    }
    function lineY() { return window.innerHeight * 0.5; }

    var curId = '';
    var queued = false;
    var lockId = '';

    function applyCur(id) {
      if (id === curId) return;
      if (curId && links[curId]) {
        links[curId].forEach(function (a) {
          a.classList.remove('cur');
          a.removeAttribute('aria-current');
        });
      }
      curId = id;
      if (id && links[id]) {
        links[id].forEach(function (a) {
          a.classList.add('cur');
          a.setAttribute('aria-current', 'location');
        });
      }
    }

    function paintToc() {
      queued = false;
      applyCur(lockId || idAt(lineY()));
    }

    /* 点目录、或从带 #p2 的链接进来时，先按用户点的这篇点亮；
       只有他自己滚轮/手势/按键往下走，才交还给滚动位置判断 */
    function lockTo(id) {
      if (!id || !links[id]) return;
      lockId = id;
      applyCur(id);
    }
    function unlock() { lockId = ''; }
    [].forEach.call(document.querySelectorAll('.post-toc a[href^="#"], .side-list a[href^="#"]'), function (a) {
      a.addEventListener('click', function () { lockTo(a.getAttribute('href').slice(1)); });
    });
    window.addEventListener('wheel', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', function (e) {
      if (/^(Arrow|Page|Home|End| |Spacebar)/.test(e.key)) unlock();
    });

    /* ---- 上次读到哪 ---- */
    var tracking = false;   // 提示处理完才开始记，免得一进页面就 0 覆盖旧记录
    var moved = false;      // 真的滚过一次才动旧记录：只是路过看一眼不算
    var saveTimer = null;
    var bar = null;
    var shownY = 0;

    function persist() {
      if (!tracking) return;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 320) return;
      var y = window.scrollY;
      // 顶部等于还没开始，底部等于读完了，两种情况都不留记录
      if (y < 240 || max - y < 160) {
        if (moved) { try { localStorage.removeItem(KEY); } catch (e) {} }
        return;
      }
      var id = lockId || idAt(lineY()) || posts[0].id;
      lsSet(KEY, { id: id, y: Math.round(y), t: Date.now() });
    }

    function drop(keep) {
      if (!bar) return;
      var el = bar;
      bar = null;
      el.classList.remove('on');
      if (!keep) { try { localStorage.removeItem(KEY); } catch (e) {} }
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 320);
      tracking = true;
    }

    function remember() {
      if (!tracking) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persist, 700);
      // 提示还挂着，人却自己往下读了，就别挡着
      if (bar && Math.abs(window.scrollY - shownY) > 300) drop(true);
    }

    function onScroll() {
      if (window.scrollY > 60) moved = true;
      if (queued) return;
      queued = true;
      requestAnimationFrame(paintToc);
      remember();
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    function offer() {
      var v = lsGet(KEY, null);
      var has = v && typeof v.y === 'number' && typeof v.id === 'string'
                && v.y >= 240 && Date.now() - (v.t || 0) < 60 * 864e5
                && document.getElementById(v.id);

      // 地址里已经指明要看哪一篇（从别处点进来），点亮它，也不再拦一句
      var h = (location.hash || '').replace('#', '');
      if (h && document.getElementById(h)) { lockTo(h); tracking = true; return; }

      if (!has) {
        if (v) { try { localStorage.removeItem(KEY); } catch (e) {} }
        tracking = true;
        return;
      }

      var target = document.getElementById(v.id);
      var n = posts.indexOf(target) + 1;
      var h3 = target.querySelector('h3');

      bar = document.createElement('div');
      bar.className = 'read-resume';
      bar.setAttribute('role', 'status');
      bar.innerHTML =
        '<span class="rs-say">上次读到' +
          '<strong class="rs-t">' + (h3 ? h3.textContent : v.id) + '</strong>' +
          '<span class="rs-n">第 ' + n + ' 篇</span>' +
        '</span>' +
        '<button class="rs-go" type="button">接着读</button>' +
        '<button class="rs-x" type="button" aria-label="不用了">×</button>';
      document.body.appendChild(bar);
      shownY = v.y;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { if (bar) bar.classList.add('on'); });
      });
      // 十几秒没理它就自己淡下去；记录留着，下次进来还会问
      setTimeout(function () { if (bar) bar.classList.remove('on'); }, 12000);

      bar.querySelector('.rs-go').addEventListener('click', function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var y = Math.min(shownY, max);
        drop(true);
        window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
      });
      bar.querySelector('.rs-x').addEventListener('click', function () {
        drop(false);
        siteToast('好，从头看');
      });
    }

    function boot() { setTimeout(offer, 500); }
    if (document.readyState === 'complete') boot();
    else window.addEventListener('load', boot);

    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') persist();
    });

    onScroll();
  })();

  /* ---------- 17. 今日一句：一天一句，换台设备也是同一句 ---------- */
  (function dailyQuote() {
    var el = document.querySelector('[data-quote]');
    if (!el) return;

    var lines = [
      '把每一件小事做好，日子就会慢慢亮起来。',
      '慢一点没关系，别停太久。',
      '今天看不懂的，明天再看一遍。',
      '写下来的东西，才算真的想过。',
      '先把能做的做完，剩下的再说。',
      '出错的地方，往往离答案最近。',
      '少刷一会儿，多做一件。',
      '不会就查，查完就关掉。',
      '认真吃饭、认真睡觉，也是正事。',
      '别人的进度是别人的。',
      '一天做好一件事，一学期就有很多件。',
      '天黑之前，把今天的事收个尾。'
    ];

    // 按「今天」取，不按「此刻」：同一天刷新多少次都是同一句，
    // 用 round 而不是 floor，跨夏令时那天也不会串到前一天
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var first = new Date(now.getFullYear(), 0, 1);
    var day = Math.round((today - first) / 864e5);
    el.textContent = '“' + lines[day % lines.length] + '”';
  })();
})();
