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

  // Shared Navbar Login / Account Button next to "Tải app"
  var SB_URL = 'https://kvdmtofhkzwgoiganirl.supabase.co';
  var SB_KEY = 'sb_publishable_JSEFSdaGLb3Q-NgLZw6GWA_vW0RGE1k';
  var SESSION_KEY = 'devstu_web_sb_session_v1';

  function escHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function readWebSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.access_token ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function isOnLoginRoute() {
    var p = (location.pathname || '/').replace(/\/+$/, '');
    return p === '/dang-nhap' || p === '/en/login';
  }

  function buildLoginHref() {
    var base = isEn() ? '/en/login/' : '/dang-nhap/';
    if (isOnLoginRoute()) return base;
    var next = location.pathname + location.search + location.hash;
    return base + '?next=' + encodeURIComponent(next);
  }

  function performLogout() {
    var s = readWebSession();
    if (s && s.access_token) {
      fetch(SB_URL + '/auth/v1/logout', {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token }
      }).catch(function () {});
    }
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
    renderNavAuth();
    try { window.dispatchEvent(new CustomEvent('devstu:auth-change', { detail: { loggedIn: false } })); } catch (_) {}
  }

  function renderNavAuth() {
    var navRight = document.querySelector('.site-nav .right');
    if (!navRight) return;
    var slot = navRight.querySelector('.nav-auth-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'nav-auth-slot';
      var dlBtn = navRight.querySelector('a.g-btn--primary');
      if (dlBtn) navRight.insertBefore(slot, dlBtn);
      else navRight.appendChild(slot);
    }

    var s = readWebSession();
    var u = s && s.user ? s.user : null;
    var pricingHref = isEn() ? '/en/pricing/' : '/bang-gia/';
    var ordersHref = isEn() ? '/en/orders/' : '/don-hang/';

    if (!u) {
      var loginHref = buildLoginHref();
      slot.innerHTML =
        '<a class="g-btn g-btn--ghost g-btn--sm nav-auth-btn" href="' + escHtml(loginHref) + '"' +
        (isOnLoginRoute() ? ' aria-current="page"' : '') + '>' +
        escHtml(t('Đăng nhập', 'Sign in')) + '</a>';
    } else {
      var email = u.email || '';
      var name = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (email ? email.split('@')[0] : 'DEVSTU');
      var av = (u.user_metadata && (u.user_metadata.avatar_url || u.user_metadata.picture)) || '';
      var initial = (name[0] || 'U').toUpperCase();
      slot.innerHTML =
        '<details class="nav-acct-dd">' +
          '<summary aria-label="' + escHtml(t('Tài khoản DEVSTU', 'DEVSTU Account')) + '">' +
            '<span class="nav-acct-dd__av">' + (av ? '<img src="' + escHtml(av) + '" alt="">' : escHtml(initial)) + '</span>' +
            '<span class="nav-acct-dd__name">' + escHtml(name) + '</span>' +
            '<svg class="lang-dd__chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>' +
          '</summary>' +
          '<div class="nav-acct-dd__menu" role="menu">' +
            '<div class="nav-acct-dd__head"><strong>' + escHtml(name) + '</strong><small>' + escHtml(email) + '</small></div>' +
            '<a class="nav-acct-dd__item" role="menuitem" href="' + escHtml(ordersHref) + '">' + escHtml(t('Lịch sử đơn & Key', 'Orders & Keys')) + '</a>' +
            '<a class="nav-acct-dd__item" role="menuitem" href="' + escHtml(pricingHref) + '">' + escHtml(t('Bảng giá & Mua gói', 'Pricing & Plans')) + '</a>' +
            '<button type="button" class="nav-acct-dd__item nav-acct-dd__item--danger" role="menuitem" data-nav-logout>' + escHtml(t('Đăng xuất', 'Sign out')) + '</button>' +
          '</div>' +
        '</details>';
    }

    // Also mirror in mobile drawer
    if (menu) {
      var mmAuth = menu.querySelector('.mm-auth');
      if (!mmAuth) {
        mmAuth = document.createElement('div');
        mmAuth.className = 'mm-auth';
        var mmLang = menu.querySelector('.mm-lang');
        if (mmLang) menu.insertBefore(mmAuth, mmLang);
        else menu.appendChild(mmAuth);
      }
      if (!u) {
        mmAuth.innerHTML =
          '<a class="mm-auth__btn" href="' + escHtml(buildLoginHref()) + '">' + escHtml(t('Đăng nhập tài khoản', 'Sign in')) + '</a>';
      } else {
        mmAuth.innerHTML =
          '<div class="mm-auth__meta">' + escHtml(u.email || '') + '</div>' +
          '<a class="mm-auth__btn" href="' + escHtml(ordersHref) + '">' + escHtml(t('Lịch sử đơn & Key', 'Orders & Keys')) + '</a>' +
          '<button type="button" class="mm-auth__btn" data-nav-logout>' + escHtml(t('Đăng xuất', 'Sign out')) + '</button>';
      }
    }
  }

  document.addEventListener('click', function (ev) {
    var dd = document.querySelector('.nav-acct-dd');
    if (dd && dd.open && !dd.contains(ev.target)) dd.open = false;
    var logoutBtn = ev.target.closest('[data-nav-logout]');
    if (logoutBtn) {
      ev.preventDefault();
      performLogout();
    }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      var dd = document.querySelector('.nav-acct-dd');
      if (dd && dd.open) dd.open = false;
    }
  });

  window.addEventListener('storage', function (ev) {
    if (ev.key === SESSION_KEY) renderNavAuth();
  });
  window.addEventListener('devstu:auth-change', renderNavAuth);
  window.DEVSTU_AUTH_UI = { refresh: renderNavAuth };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderNavAuth);
  } else {
    renderNavAuth();
  }
  if (window.DEVSTU_I18N) {
    window.DEVSTU_I18N.onChange(renderNavAuth);
  }

  // Dynamic Promo Banner Directly Under Header (configured via Admin Console)
  var PROMO_CACHE_KEY = 'devstu_promo_cache_v1';
  var PROMO_DISMISS_KEY = 'devstu_promo_dismiss_v1';
  var promoData = null;
  var promoTimerId = null;

  function localizePromoHref(url) {
    var u = String(url || '').trim();
    if (!u || !isEn() || u.charAt(0) !== '/') return u;
    var map = {
      '/': '/en/',
      '/bang-gia/': '/en/pricing/',
      '/bang-gia': '/en/pricing/',
      '/tai-xuong/': '/en/download/',
      '/tai-xuong': '/en/download/',
      '/don-hang/': '/en/orders/',
      '/don-hang': '/en/orders/',
      '/gioi-thieu/': '/en/about/',
      '/gioi-thieu': '/en/about/',
      '/blog/': '/en/blog/',
      '/blog': '/en/blog/',
      '/dang-nhap/': '/en/login/',
      '/dang-nhap': '/en/login/'
    };
    var hashIdx = u.indexOf('#');
    var hash = hashIdx >= 0 ? u.slice(hashIdx) : '';
    var base = hashIdx >= 0 ? u.slice(0, hashIdx) : u;
    var qIdx = base.indexOf('?');
    var query = qIdx >= 0 ? base.slice(qIdx) : '';
    var pathOnly = qIdx >= 0 ? base.slice(0, qIdx) : base;
    return (map[pathOnly] || pathOnly) + query + hash;
  }

  function isAllowedOnCurrentPage(promo) {
    if (!promo || promo.pages !== 'home_pricing') return true;
    var p = (location.pathname || '/').replace(/\/+$/, '') || '/';
    return p === '/' || p === '/en' || p === '/bang-gia' || p === '/en/pricing';
  }

  function promoSignature(p) {
    if (!p) return '';
    return String(p.updated_at || '') + '|' + String(p.message_vi || '') + '|' + String(p.coupon_code || '') + '|' + String(p.effect || 'shimmer');
  }

  function stopPromoCountdown() {
    if (promoTimerId) {
      clearInterval(promoTimerId);
      promoTimerId = null;
    }
  }

  function removePromoBanner() {
    stopPromoCountdown();
    var old = document.querySelector('.site-promo');
    if (old) old.remove();
  }

  function formatPromoLeft(ms) {
    var totalSec = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(totalSec / 86400);
    var hours = Math.floor((totalSec % 86400) / 3600);
    var mins = Math.floor((totalSec % 3600) / 60);
    var secs = totalSec % 60;
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var hms = pad(hours) + ':' + pad(mins) + ':' + pad(secs);
    if (days > 0) return t('Còn ' + days + 'n ' + hms, days + 'd ' + hms + ' left');
    return t('Còn ' + hms, hms + ' left');
  }

  function renderPromoBanner(promo) {
    promoData = promo || null;
    var nav = document.querySelector('.site-nav');
    if (!nav) return;

    if (!promo || !promo.enabled || !promo.message_vi || !isAllowedOnCurrentPage(promo)) {
      removePromoBanner();
      return;
    }

    if (promo.ends_at) {
      var endMs = new Date(promo.ends_at).getTime();
      if (!Number.isNaN(endMs) && endMs <= Date.now()) {
        removePromoBanner();
        return;
      }
    }

    if (promo.dismissible !== false) {
      try {
        if (sessionStorage.getItem(PROMO_DISMISS_KEY) === promoSignature(promo)) {
          removePromoBanner();
          return;
        }
      } catch (_) {}
    }

    var badge = isEn() && promo.badge_en ? promo.badge_en : promo.badge_vi;
    var msg = isEn() && promo.message_en ? promo.message_en : promo.message_vi;
    var ctaLabel = isEn() && promo.cta_label_en ? promo.cta_label_en : promo.cta_label_vi;
    var ctaUrl = localizePromoHref(promo.cta_url || '');
    var theme = /^(gold|blue|emerald|rose|violet)$/.test(promo.theme || '') ? promo.theme : 'gold';
    var fx = /^(shimmer|aurora|marquee|pulse|none)$/.test(promo.effect || '') ? promo.effect : 'shimmer';
    var hasClose = promo.dismissible !== false;

    var bar = document.querySelector('.site-promo');
    if (!bar) {
      bar = document.createElement('div');
      var anchor = (menu && menu.parentNode === nav.parentNode) ? menu : nav;
      anchor.insertAdjacentElement('afterend', bar);
    }

    bar.className = 'site-promo site-promo--' + theme + ' site-promo--fx-' + fx + (hasClose ? '' : ' site-promo--no-x');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', t('Thông báo khuyến mãi', 'Promotional announcement'));

    var buildUnitHtml = function (noTab) {
      var tabAttr = noTab ? ' tabindex="-1"' : '';
      var out = '';
      if (badge) out += '<span class="site-promo__badge">' + escHtml(badge) + '</span>';
      out += '<span class="site-promo__msg">' + escHtml(msg) + '</span>';
      if (promo.coupon_code) {
        out += '<button type="button" class="site-promo__code" data-promo-copy="' + escHtml(promo.coupon_code) + '"' + tabAttr + ' title="' + escHtml(t('Bấm để copy mã', 'Click to copy code')) + '">' + escHtml(promo.coupon_code) + '</button>';
      }
      if (promo.ends_at) {
        out += '<span class="site-promo__timer" data-promo-timer></span>';
      }
      if (ctaLabel && ctaUrl) {
        var ext = /^https?:\/\//i.test(ctaUrl) ? ' target="_blank" rel="noopener noreferrer"' : '';
        out += '<a class="site-promo__cta" href="' + escHtml(ctaUrl) + '"' + ext + tabAttr + '>' + escHtml(ctaLabel) + '</a>';
      }
      return out;
    };

    var html = '';
    if (fx === 'marquee') {
      var unitMain = '<span class="site-promo__unit">' + buildUnitHtml(false) + '</span><span class="site-promo__sep" aria-hidden="true">✦</span>';
      var unitClone = '<span class="site-promo__unit">' + buildUnitHtml(true) + '</span><span class="site-promo__sep" aria-hidden="true">✦</span>';
      html = '<div class="site-promo__viewport"><div class="site-promo__marquee">' +
        '<div class="site-promo__track">' + unitMain + unitClone + '</div>' +
        '<div class="site-promo__track" aria-hidden="true">' + unitClone + unitClone + '</div>' +
        '</div></div>';
    } else {
      html = '<div class="site-promo__in">' + buildUnitHtml(false) + '</div>';
    }
    if (hasClose) {
      html += '<button type="button" class="site-promo__x" data-promo-close aria-label="' + escHtml(t('Đóng băng rôn', 'Dismiss banner')) + '">✕</button>';
    }
    bar.innerHTML = html;

    stopPromoCountdown();
    if (promo.ends_at) {
      var targetMs = new Date(promo.ends_at).getTime();
      var tick = function () {
        var timerEls = bar.querySelectorAll('[data-promo-timer]');
        if (!timerEls.length) return;
        var diff = targetMs - Date.now();
        if (diff <= 0) {
          removePromoBanner();
          return;
        }
        var txt = formatPromoLeft(diff);
        timerEls.forEach(function (el) { el.textContent = txt; });
      };
      tick();
      promoTimerId = setInterval(tick, 1000);
    }
  }

  async function fetchPromoBanner() {
    if (!document.querySelector('.site-nav')) return;

    try {
      var rawCache = sessionStorage.getItem(PROMO_CACHE_KEY);
      if (rawCache) {
        var cached = JSON.parse(rawCache);
        if (cached && cached.ts && Date.now() - cached.ts < 8000) {
          renderPromoBanner(cached.promo || null);
          return;
        }
      }
    } catch (_) {}

    var loadedPromo = null;
    try {
      var res = await fetch('/api/promo', { cache: 'no-store' });
      if (res.ok) {
        var data = await res.json();
        loadedPromo = data && data.active ? data.promo : null;
      } else if (res.status === 404) {
        // Fallback when running static dev-server locally without /api/promo
        var stRes = await fetch(SB_URL + '/storage/v1/object/public/site-config/promo-banner.json?t=' + Date.now(), { cache: 'no-store' });
        if (stRes.ok) loadedPromo = await stRes.json();
      }
    } catch (_) {}

    try {
      sessionStorage.setItem(PROMO_CACHE_KEY, JSON.stringify({ ts: Date.now(), promo: loadedPromo }));
    } catch (_) {}

    renderPromoBanner(loadedPromo);
  }

  document.addEventListener('click', function (ev) {
    var copyBtn = ev.target.closest('[data-promo-copy]');
    if (copyBtn) {
      var code = copyBtn.getAttribute('data-promo-copy') || '';
      if (!code) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).catch(function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      copyBtn.textContent = t('Đã copy!', 'Copied!');
      setTimeout(function () { copyBtn.textContent = code; }, 1600);
      return;
    }

    if (ev.target.closest('[data-promo-close]')) {
      if (promoData) {
        try { sessionStorage.setItem(PROMO_DISMISS_KEY, promoSignature(promoData)); } catch (_) {}
      }
      removePromoBanner();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchPromoBanner);
  } else {
    fetchPromoBanner();
  }
  if (window.DEVSTU_I18N) {
    window.DEVSTU_I18N.onChange(function () {
      if (promoData) renderPromoBanner(promoData);
    });
  }
})();
