// DEVSTU Website — Shared UI (Mobile drawer, dropdowns)
(function () {
  'use strict';

  var btn = document.querySelector('.menu-btn');
  var menu = document.getElementById('mobile-menu');
  if (btn && menu) {
    btn.addEventListener('click', function () {
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) {
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    });
  }

  var langDd = document.querySelector('.lang-dd');
  if (langDd) {
    document.addEventListener('click', function (ev) {
      if (langDd.open && !langDd.contains(ev.target)) langDd.open = false;
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && langDd.open) {
        langDd.open = false;
        var sum = langDd.querySelector('summary');
        if (sum) sum.focus();
      }
    });
  }

  // Interactive Cookie Settings dialog (shared across all pages)
  var COOKIE_KEY = 'devstu_cookie_prefs';
  var ckDlg = null;

  function isEn() {
    return window.DEVSTU_I18N && window.DEVSTU_I18N.getLang() === 'en';
  }
  function t(vi, en) {
    return isEn() ? en : vi;
  }
  function loadCookiePrefs() {
    try {
      var raw = localStorage.getItem(COOKIE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { essential: true, analytics: false };
  }
  function saveCookiePrefs(analytics) {
    try {
      localStorage.setItem(COOKIE_KEY, JSON.stringify({ essential: true, analytics: !!analytics, updatedAt: new Date().toISOString() }));
    } catch (_) {}
  }

  function renderCookieDlg() {
    if (!ckDlg) return;
    var prefs = loadCookiePrefs();
    ckDlg.querySelector('[data-ck-title]').textContent = t('Cài đặt cookie', 'Cookie Settings');
    ckDlg.querySelector('[data-ck-close]').setAttribute('aria-label', t('Đóng', 'Close'));
    ckDlg.querySelector('[data-ck-desc]').textContent = t(
      'Website giới thiệu DEVSTU không đặt cookie quảng cáo hay theo dõi bên thứ ba. Bạn có thể quản lý tuỳ chọn lưu trữ cục bộ dưới đây.',
      'The DEVSTU website uses zero advertising or third-party tracking cookies. Manage your local storage preferences below.'
    );
    ckDlg.querySelector('[data-ck-ess-t]').textContent = t('Lưu trữ thiết yếu', 'Essential Storage');
    ckDlg.querySelector('[data-ck-ess-d]').textContent = t(
      'Ghi nhớ ngôn ngữ hiển thị (VI / EN) và lựa chọn bảo mật của bạn trên trình duyệt.',
      'Remembers your display language (VI / EN) and privacy choice in your browser.'
    );
    ckDlg.querySelector('[data-ck-ess-tag]').textContent = t('Luôn bật', 'Always on');
    ckDlg.querySelector('[data-ck-ana-t]').textContent = t('Hiệu năng & Cải thiện trải nghiệm', 'Performance & Experience');
    ckDlg.querySelector('[data-ck-ana-d]').textContent = t(
      'Cho phép lưu tuỳ chọn hiển thị để tối ưu tốc độ tải trang (mặc định tắt, không gửi ảnh hay dữ liệu cá nhân).',
      'Optional anonymous display preferences to improve page performance (off by default, never sends photos or personal data).'
    );
    ckDlg.querySelector('[data-ck-ana-in]').checked = !!prefs.analytics;
    ckDlg.querySelector('[data-ck-ess-btn]').textContent = t('Chỉ giữ thiết yếu', 'Essential only');
    ckDlg.querySelector('[data-ck-save-btn]').textContent = t('Lưu tuỳ chọn', 'Save preferences');
    ckDlg.querySelector('[data-ck-all-btn]').textContent = t('Chấp nhận tất cả', 'Accept all');
  }

  function ensureCookieDlg() {
    if (ckDlg) return ckDlg;
    ckDlg = document.createElement('dialog');
    ckDlg.className = 'ck-dlg';
    ckDlg.setAttribute('aria-labelledby', 'ck-dlg-h');
    ckDlg.innerHTML =
      '<div class="ck-dlg__in">' +
        '<div class="ck-dlg__head">' +
          '<h2 id="ck-dlg-h" data-ck-title></h2>' +
          '<button type="button" class="ck-dlg__x" data-ck-close><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>' +
        '</div>' +
        '<p class="ck-dlg__desc" data-ck-desc></p>' +
        '<div class="ck-dlg__list">' +
          '<div class="ck-row">' +
            '<div><h3 data-ck-ess-t></h3><p data-ck-ess-d></p></div>' +
            '<span class="ck-tag" data-ck-ess-tag></span>' +
          '</div>' +
          '<div class="ck-row">' +
            '<div><h3 data-ck-ana-t></h3><p data-ck-ana-d></p></div>' +
            '<label class="ck-sw"><input type="checkbox" data-ck-ana-in><span></span></label>' +
          '</div>' +
        '</div>' +
        '<div class="ck-dlg__foot">' +
          '<button type="button" class="ck-btn" data-ck-ess-btn></button>' +
          '<button type="button" class="ck-btn" data-ck-save-btn></button>' +
          '<button type="button" class="ck-btn ck-btn--pri" data-ck-all-btn></button>' +
        '</div>' +
        '<p class="ck-dlg__status" data-ck-st aria-live="polite"></p>' +
      '</div>';
    document.body.appendChild(ckDlg);

    var closeDlg = function () { ckDlg.close(); };
    ckDlg.querySelector('[data-ck-close]').addEventListener('click', closeDlg);
    ckDlg.addEventListener('click', function (ev) { if (ev.target === ckDlg) closeDlg(); });

    var finish = function (val) {
      saveCookiePrefs(val);
      ckDlg.querySelector('[data-ck-ana-in]').checked = val;
      var st = ckDlg.querySelector('[data-ck-st]');
      st.textContent = t('Đã lưu cài đặt cookie của bạn.', 'Your cookie preferences have been saved.');
      setTimeout(function () {
        st.textContent = '';
        if (ckDlg.open) ckDlg.close();
      }, 650);
    };
    ckDlg.querySelector('[data-ck-ess-btn]').addEventListener('click', function () { finish(false); });
    ckDlg.querySelector('[data-ck-save-btn]').addEventListener('click', function () {
      finish(ckDlg.querySelector('[data-ck-ana-in]').checked);
    });
    ckDlg.querySelector('[data-ck-all-btn]').addEventListener('click', function () { finish(true); });

    if (window.DEVSTU_I18N) {
      window.DEVSTU_I18N.onChange(renderCookieDlg);
    }
    return ckDlg;
  }

  document.addEventListener('click', function (ev) {
    var trigger = ev.target.closest('[data-cookie-open]');
    if (!trigger) return;
    ev.preventDefault();
    var dlg = ensureCookieDlg();
    renderCookieDlg();
    dlg.querySelector('[data-ck-st]').textContent = '';
    if (typeof dlg.showModal === 'function') dlg.showModal();
  });
})();
