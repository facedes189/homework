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
      '<div><img alt=""><div class="cap"></div></div>';
    document.body.appendChild(box);

    var boxImg = box.querySelector('img');
    var boxCap = box.querySelector('.cap');

    function openBox(src, alt, cap) {
      boxImg.src = src;
      boxImg.alt = alt || '';
      boxCap.textContent = cap || alt || '';
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
        var cap = shot.querySelector('figcaption');
        openBox(img.getAttribute('src'), img.getAttribute('alt'), cap ? cap.textContent : '');
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
})();
