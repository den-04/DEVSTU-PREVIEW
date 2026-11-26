// DEVSTU Web Auth (/dang-nhap/) + VietQR Checkout & Order/Key History (/bang-gia/)
// Payment issues a standalone Key in public.premium_keys and NEVER auto-activates profiles.is_premium.
(() => {
  'use strict';

  const SB_URL = 'https://kvdmtofhkzwgoiganirl.supabase.co';
  const SB_KEY = 'sb_publishable_JSEFSdaGLb3Q-NgLZw6GWA_vW0RGE1k';
  const SESSION_KEY = 'devstu_web_sb_session_v1';
  const PKCE_KEY = 'devstu_web_sb_pkce_v1';
  const PENDING_BUY_KEY = 'devstu_pending_buy_v1';
  const PENDING_CTX_KEY = 'devstu_pending_auth_ctx_v1';

  const loginPage = document.querySelector('[data-login-page]');
  const qrDlg = document.getElementById('dv-qr-dlg');
  const ordersSec = document.getElementById('lich-su-don');
  const ordersList = document.querySelector('[data-orders-list]');
  const isPricingPage = Boolean(document.querySelector('[data-buy-plan]') || qrDlg || ordersSec);

  if (!loginPage && !isPricingPage) return;

  const isEn = () => Boolean(window.DEVSTU_I18N && window.DEVSTU_I18N.getLang() === 'en');
  const t = (vi, en) => (isEn() ? en : vi);
  const pricingPath = () => (isEn() ? '/en/pricing/' : '/bang-gia/');
  const loginPath = () => (isEn() ? '/en/login/' : '/dang-nhap/');
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtVnd = (n) => `${Number(n || 0).toLocaleString('vi-VN')} đ`;
  const fmtTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const PLAN_PRICE_LABEL = {
    'Pro STU Ultra': { year: '19.000 đ / 1 năm', lifetime: '39.000 đ / Vĩnh viễn', yearEn: '19,000 VND / 1 year', lifetimeEn: '39,000 VND / Lifetime' },
    'Studio Max': { year: '999.000 đ / 1 năm', lifetime: '1.799.000 đ / Vĩnh viễn', yearEn: '999,000 VND / 1 year', lifetimeEn: '1,799,000 VND / Lifetime' }
  };

  const state = {
    session: null,
    authMode: 'otp',
    orders: [],
    activeOrder: null,
    activeBank: null,
    pollTimer: null,
    countdownTimer: null
  };

  function notifyAuthChange(loggedIn) {
    if (window.DEVSTU_AUTH_UI && typeof window.DEVSTU_AUTH_UI.refresh === 'function') {
      window.DEVSTU_AUTH_UI.refresh();
    }
    try {
      window.dispatchEvent(new CustomEvent('devstu:auth-change', { detail: { loggedIn: Boolean(loggedIn) } }));
    } catch {}
  }

  function safeNextPath(raw) {
    const s = String(raw || '').trim();
    if (!s || !s.startsWith('/') || s.startsWith('//')) return '';
    const clean = s.split('?')[0].split('#')[0].replace(/\/+$/, '');
    if (clean === '/dang-nhap' || clean === '/en/login') return '';
    return s;
  }

  async function copyText(str, btn) {
    try {
      await navigator.clipboard.writeText(str);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = str;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = t('Đã copy!', 'Copied!');
      setTimeout(() => { btn.textContent = prev; }, 1600);
    }
  }

  /* ---- Supabase Auth Helpers ---- */
  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p?.access_token ? p : null;
    } catch { return null; }
  }

  function saveSession(data) {
    if (!data?.access_token) return null;
    const now = Math.floor(Date.now() / 1000);
    const s = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || '',
      expires_at: Number(data.expires_at) || now + (Number(data.expires_in) || 3600),
      user: data.user || null
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    state.session = s;
    notifyAuthChange(true);
    return s;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    state.session = null;
    state.orders = [];
    notifyAuthChange(false);
  }

  function b64url(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function createPkce() {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const verifier = b64url(raw);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return { verifier, challenge: b64url(new Uint8Array(digest)) };
  }

  async function authReq(path, { method = 'GET', body, token } = {}) {
    const headers = { apikey: SB_KEY };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${SB_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    const txt = await res.text();
    let json = {};
    try { json = txt ? JSON.parse(txt) : {}; } catch {}
    if (!res.ok) {
      throw new Error(json.msg || json.error_description || json.message || `HTTP ${res.status}`);
    }
    return json;
  }

  async function refreshSessionIfNeeded(force = false) {
    const s = state.session || loadSession();
    if (!s) return null;
    state.session = s;
    const now = Math.floor(Date.now() / 1000);
    if (!force && s.expires_at && s.expires_at > now + 60) {
      if (!s.user) {
        try { s.user = await authReq('/auth/v1/user', { token: s.access_token }); saveSession(s); } catch {}
      }
      return s;
    }
    if (!s.refresh_token) return s;
    try {
      const next = await authReq('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: s.refresh_token }
      });
      return saveSession(next);
    } catch {
      clearSession();
      return null;
    }
  }

  async function handleOAuthCallback() {
    const url = new URL(location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const code = url.searchParams.get('code');
    const accessToken = hashParams.get('access_token');
    const oauthErr = url.searchParams.get('error_description') || hashParams.get('error_description');
    if (oauthErr) {
      cleanOAuthUrl(url);
      throw new Error(oauthErr);
    }
    if (code) {
      const verifier = sessionStorage.getItem(PKCE_KEY) || localStorage.getItem(PKCE_KEY) || '';
      sessionStorage.removeItem(PKCE_KEY);
      localStorage.removeItem(PKCE_KEY);
      if (!verifier) { cleanOAuthUrl(url); return false; }
      const res = await authReq('/auth/v1/token?grant_type=pkce', {
        method: 'POST',
        body: { auth_code: code, code_verifier: verifier }
      });
      saveSession(res);
      cleanOAuthUrl(url);
      return true;
    }
    if (accessToken) {
      const user = await authReq('/auth/v1/user', { token: accessToken });
      saveSession({
        access_token: accessToken,
        refresh_token: hashParams.get('refresh_token') || '',
        expires_in: Number(hashParams.get('expires_in')) || 3600,
        user
      });
      cleanOAuthUrl(url);
      return true;
    }
    return false;
  }

  function cleanOAuthUrl(url) {
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    history.replaceState(history.state, '', url.pathname + url.search);
  }

  /* ---- Login Context & Redirect Helpers ---- */
  function readAuthContext() {
    const params = new URLSearchParams(location.search);
    let plan = (params.get('plan') || '').trim();
    let period = (params.get('period') || '').trim().toLowerCase();
    let next = safeNextPath(params.get('next'));

    if (!plan) {
      try {
        const stored = JSON.parse(localStorage.getItem(PENDING_CTX_KEY) || 'null');
        if (stored && stored.exp && stored.exp > Date.now()) {
          plan = stored.plan || '';
          period = stored.period || '';
          if (!next) next = safeNextPath(stored.next);
        }
      } catch {}
    }
    if (!plan) {
      try {
        const pb = JSON.parse(sessionStorage.getItem(PENDING_BUY_KEY) || 'null');
        if (pb?.plan) {
          plan = pb.plan;
          period = pb.period || 'lifetime';
        }
      } catch {}
    }
    if (period && period !== 'year' && period !== 'lifetime') period = 'lifetime';
    return { plan, period: period || 'lifetime', next };
  }

  function saveAuthContext(ctx) {
    try {
      localStorage.setItem(PENDING_CTX_KEY, JSON.stringify({
        plan: ctx.plan || '',
        period: ctx.period || 'lifetime',
        next: ctx.next || '',
        exp: Date.now() + 15 * 60 * 1000
      }));
    } catch {}
  }

  function clearAuthContext() {
    try { localStorage.removeItem(PENDING_CTX_KEY); } catch {}
  }

  function redirectAfterLogin() {
    const ctx = readAuthContext();
    clearAuthContext();
    if (ctx.plan) {
      sessionStorage.setItem(PENDING_BUY_KEY, JSON.stringify({ plan: ctx.plan, period: ctx.period }));
      location.href = `${pricingPath()}?checkout=1&plan=${encodeURIComponent(ctx.plan)}&period=${encodeURIComponent(ctx.period)}`;
      return;
    }
    if (ctx.next) {
      location.href = ctx.next;
      return;
    }
    location.href = `${pricingPath()}#lich-su-don`;
  }

  function setAuthFeedback(err, ok) {
    const eEl = loginPage?.querySelector('[data-auth-err]');
    const oEl = loginPage?.querySelector('[data-auth-ok]');
    if (eEl) { eEl.textContent = err || ''; eEl.hidden = !err; }
    if (oEl) { oEl.textContent = ok || ''; oEl.hidden = !ok; }
  }

  function renderLoginPage() {
    if (!loginPage) return;
    const ctx = readAuthContext();
    const intentEl = loginPage.querySelector('[data-login-intent]');
    const alreadyEl = loginPage.querySelector('[data-login-already]');
    const boxEl = loginPage.querySelector('[data-login-box]');
    const backEl = loginPage.querySelector('[data-login-back]');

    if (backEl) {
      backEl.setAttribute('href', ctx.next || pricingPath());
    }

    if (intentEl) {
      if (ctx.plan) {
        const meta = PLAN_PRICE_LABEL[ctx.plan];
        const priceTxt = meta
          ? (isEn() ? (ctx.period === 'year' ? meta.yearEn : meta.lifetimeEn) : (ctx.period === 'year' ? meta.year : meta.lifetime))
          : (ctx.period === 'year' ? t('1 năm', '1 year') : t('Vĩnh viễn', 'Lifetime'));
        intentEl.hidden = false;
        intentEl.innerHTML = `
          <span>${esc(t('Đăng nhập để tiếp tục thanh toán VietQR:', 'Sign in to continue VietQR checkout:'))}</span>
          <strong>${esc(ctx.plan)} · ${esc(priceTxt)}</strong>`;
      } else {
        intentEl.hidden = true;
        intentEl.innerHTML = '';
      }
    }

    const u = state.session?.user;
    if (u) {
      if (ctx.plan) {
        redirectAfterLogin();
        return;
      }
      if (boxEl) boxEl.hidden = true;
      if (alreadyEl) {
        alreadyEl.hidden = false;
        alreadyEl.innerHTML = `
          <div>${esc(t('Bạn đang đăng nhập với tài khoản:', 'Signed in as:'))} <strong>${esc(u.email || '')}</strong></div>
          <div class="dv-auth-signed__acts">
            <a class="dv-sm-btn dv-sm-btn--pri" href="${esc(pricingPath())}#lich-su-don">${esc(t('Xem Bảng giá & Kho Key', 'Pricing & Key History'))}</a>
            <button type="button" class="dv-sm-btn" data-web-logout>${esc(t('Đăng xuất', 'Sign out'))}</button>
          </div>`;
      }
    } else {
      if (boxEl) boxEl.hidden = false;
      if (alreadyEl) { alreadyEl.hidden = true; alreadyEl.innerHTML = ''; }
    }
  }

  /* ---- API Helpers (Vercel /api/orders/* with Supabase fallback) ---- */
  async function apiReq(url, { method = 'GET', body } = {}) {
    const s = await refreshSessionIfNeeded(false);
    if (!s?.access_token) throw new Error(t('Vui lòng đăng nhập trước.', 'Please sign in first.'));
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${s.access_token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    const txt = await res.text();
    let json = {};
    try { json = txt ? JSON.parse(txt) : {}; } catch {}
    if (!res.ok) {
      const err = new Error(json.error || json.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = json.code || '';
      throw err;
    }
    return json;
  }

  /* ---- Render Orders & Keys History (on /bang-gia/) ---- */
  function statusMeta(st) {
    if (st === 'paid') return { cls: 'paid', label: t('Đã thanh toán · Đã cấp Key', 'Paid · Key Issued') };
    if (st === 'pending') return { cls: 'pending', label: t('Đang chờ thanh toán', 'Awaiting Payment') };
    if (st === 'manual_review') return { cls: 'review', label: t('Cần kiểm tra (chuyển thiếu / lỗi)', 'Needs Review') };
    if (st === 'failed') return { cls: 'failed', label: t('Lỗi thanh toán', 'Failed') };
    return { cls: 'expired', label: t('Hết hạn QR', 'Expired') };
  }

  function renderOrders() {
    if (!ordersSec || !ordersList) return;
    if (!state.session?.user) {
      ordersSec.hidden = true;
      return;
    }
    ordersSec.hidden = false;

    if (!state.orders.length) {
      ordersList.innerHTML = `<div class="dv-orders-empty">${esc(t(
        'Bạn chưa có đơn hàng nào. Bấm “Mua ngay qua VietQR” ở gói Pro phía trên để nhận mã Key kích hoạt.',
        'No orders yet. Click “Buy via VietQR” on the Pro plan above to get your activation Key.'
      ))}</div>`;
      return;
    }

    const email = state.session.user.email || '';
    ordersList.innerHTML = state.orders.map((o) => {
      const sm = statusMeta(o.status);
      const periodLabel = o.is_lifetime ? t('Vĩnh viễn', 'Lifetime') : t(`${o.days || 365} ngày`, `${o.days || 365} days`);
      const used = Number(o.key_used_count || 0) >= Number(o.key_max_uses || 1);
      const keyState = used
        ? t('Đã kích hoạt trong app DEVSTU', 'Redeemed in DEVSTU app')
        : t('Chưa kích hoạt · Copy dán vào app DEVSTU để dùng', 'Not redeemed yet · Copy & paste in DEVSTU app');

      const keyBlock = o.issued_key_code
        ? `<div class="dv-key-reveal">
            <div>
              <div class="dv-key-reveal__code">${esc(o.issued_key_code)}</div>
              <span class="dv-key-reveal__sub">${esc(keyState)}</span>
            </div>
            <button type="button" class="dv-sm-btn dv-sm-btn--pri" data-copy-key="${esc(o.issued_key_code)}">${esc(t('Copy mã Key', 'Copy Key'))}</button>
          </div>`
        : '';

      const supportHref = `mailto:ducdoan04.work@gmail.com?subject=${encodeURIComponent(`[DEVSTU] Hỗ trợ đơn #${o.order_code}`)}&body=${encodeURIComponent(`Email tài khoản: ${email}\nMã đơn hàng: ${o.order_code}\nGói: ${o.plan} (${periodLabel})\nSố tiền: ${fmtVnd(o.amount)}\nMô tả vấn đề: `)}`;

      const reopenBtn = o.status === 'pending'
        ? `<button type="button" class="dv-sm-btn dv-sm-btn--pri" data-reopen-order="${esc(o.order_code)}">${esc(t('Mở lại mã QR', 'Open QR'))}</button>`
        : '';

      const noteHtml = o.admin_note
        ? `<div class="dv-order-card__meta" style="color:#fbbf24">${esc(o.admin_note)}</div>`
        : '';

      return `<article class="dv-order-card">
        <div class="dv-order-card__top">
          <div class="dv-order-card__id">
            <code>${esc(o.order_code)}</code>
            <strong>${esc(o.plan)} · ${esc(periodLabel)}</strong>
            <span class="dv-order-pill dv-order-pill--${sm.cls}">${esc(sm.label)}</span>
          </div>
          <strong>${esc(fmtVnd(o.amount))}</strong>
        </div>
        <div class="dv-order-card__meta">
          <span>${esc(t('Tạo lúc:', 'Created:'))} ${esc(fmtTime(o.created_at))}</span>
          ${o.paid_at ? `<span>${esc(t('Thanh toán lúc:', 'Paid:'))} ${esc(fmtTime(o.paid_at))}</span>` : ''}
        </div>
        ${noteHtml}
        ${keyBlock}
        <div class="dv-order-card__foot">
          <small style="color:#8e8e98">${esc(t('Lưu mã đơn này nếu bạn cần hỗ trợ đối soát.', 'Keep this order code if you ever need support.'))}</small>
          <div class="dv-acct-bar__acts">
            ${reopenBtn}
            <a class="dv-sm-btn" href="${supportHref}">${esc(t('Báo lỗi đơn này', 'Report issue'))}</a>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  async function loadMyOrders() {
    if (!ordersSec) return;
    if (!state.session?.access_token) {
      state.orders = [];
      renderOrders();
      return;
    }
    try {
      const res = await apiReq('/api/orders/status');
      state.orders = Array.isArray(res.orders) ? res.orders : [];
    } catch {
      try {
        const s = await refreshSessionIfNeeded(false);
        const r = await fetch(`${SB_URL}/rest/v1/rpc/user_list_my_orders`, {
          method: 'POST',
          headers: { apikey: SB_KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_limit: 50 })
        });
        if (r.ok) {
          const list = await r.json();
          state.orders = Array.isArray(list) ? list : [];
        }
      } catch {}
    }
    renderOrders();
  }

  /* ---- VietQR Checkout Modal ---- */
  function stopPolling() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
    if (state.countdownTimer) { clearInterval(state.countdownTimer); state.countdownTimer = null; }
  }

  function renderQrModal() {
    if (!qrDlg || !state.activeOrder) return;
    const o = state.activeOrder;
    const bank = state.activeBank || {};
    const body = qrDlg.querySelector('[data-qr-body]');
    const periodLabel = o.is_lifetime ? t('Vĩnh viễn', 'Lifetime') : t(`${o.days || 365} ngày`, `${o.days || 365} days`);

    if (o.status === 'paid' && o.issued_key_code) {
      stopPolling();
      body.innerHTML = `
        <div class="dv-qr-success">
          <h3>${esc(t('Thanh toán thành công · Đã cấp mã Key!', 'Payment Received · Key Issued!'))}</h3>
          <p class="dv-dlg__sub" style="margin:0">${esc(t(
            `Đơn #${o.order_code} (${o.plan} · ${periodLabel}). Hệ thống KHÔNG tự kích hoạt vào tài khoản — hãy copy mã Key dưới đây và dán vào mục Nhập Key trong ứng dụng DEVSTU Desktop.`,
            `Order #${o.order_code} (${o.plan} · ${periodLabel}). The key is NOT auto-activated — copy it below and paste it into DEVSTU Desktop.`
          ))}</p>
          <div class="dv-qr-success__code">${esc(o.issued_key_code)}</div>
          <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px">
            <button type="button" class="hm-btn" data-copy-key="${esc(o.issued_key_code)}">${esc(t('Copy mã Key ngay', 'Copy Key'))}</button>
            <a class="hm-btn hm-btn--ghost" href="/tai-xuong/">${esc(t('Tải DEVSTU Desktop', 'Download DEVSTU'))}</a>
          </div>
        </div>`;
      return;
    }

    const qrVisual = bank.configured && bank.qrUrl
      ? `<img src="${esc(bank.qrUrl)}" alt="VietQR ${esc(o.order_code)}">`
      : `<div class="dv-qr-placeholder"><strong>${esc(t('Chưa cấu hình tài khoản ngân hàng SePay trên Vercel', 'SePay bank env vars not configured on Vercel yet'))}</strong><br><br><code>SEPAY_BANK_CODE</code><br><code>SEPAY_BANK_ACCOUNT</code><br><code>SEPAY_ACCOUNT_NAME</code></div>`;

    const reviewBanner = o.status === 'manual_review'
      ? `<p class="dv-err">${esc(o.admin_note || t('Đơn hàng đang cần Admin kiểm tra (chuyển thiếu hoặc sai nội dung). Hãy liên hệ ducdoan04.work@gmail.com kèm mã đơn.', 'Order requires manual review. Please contact ducdoan04.work@gmail.com with your order code.'))}</p>`
      : '';

    body.innerHTML = `
      ${reviewBanner}
      <div class="dv-qr-grid">
        <div class="dv-qr-box">${qrVisual}</div>
        <dl class="dv-bank-dl">
          <div class="dv-bank-row">
            <div><dt>${esc(t('Gói dịch vụ', 'Plan'))}</dt><dd>${esc(o.plan)} · ${esc(periodLabel)}</dd></div>
          </div>
          <div class="dv-bank-row">
            <div><dt>${esc(t('Ngân hàng / Tài khoản', 'Bank / Account'))}</dt><dd>${esc(bank.bankCode || '—')} · ${esc(bank.accountNumber || '—')}<br><small style="color:#a8a8b2;font-weight:400">${esc(bank.accountName || 'DEVSTU')}</small></dd></div>
            ${bank.accountNumber ? `<button type="button" class="dv-sm-btn" data-copy-val="${esc(bank.accountNumber)}">${esc(t('Copy STK', 'Copy'))}</button>` : ''}
          </div>
          <div class="dv-bank-row">
            <div><dt>${esc(t('Số tiền chính xác', 'Exact Amount'))}</dt><dd>${esc(fmtVnd(o.amount))}</dd></div>
            <button type="button" class="dv-sm-btn" data-copy-val="${esc(String(o.amount))}">${esc(t('Copy', 'Copy'))}</button>
          </div>
          <div class="dv-bank-row dv-bank-row--code">
            <div><dt>${esc(t('Nội dung chuyển khoản (bắt buộc)', 'Transfer Memo (required)'))}</dt><dd>${esc(o.order_code)}</dd></div>
            <button type="button" class="dv-sm-btn dv-sm-btn--pri" data-copy-val="${esc(o.order_code)}">${esc(t('Copy mã', 'Copy'))}</button>
          </div>
        </dl>
      </div>
      <div class="dv-qr-status">
        <span data-qr-poll-msg>${esc(t('Đang chờ thanh toán… tự động kiểm tra mỗi 3 giây', 'Waiting for transfer… auto-checking every 3s'))}</span>
        <strong data-qr-timer>20:00</strong>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center">
        <button type="button" class="dv-sm-btn dv-sm-btn--pri" data-qr-check-now>${esc(t('Tôi đã chuyển khoản, kiểm tra ngay', 'I transferred — check now'))}</button>
        <a class="dv-sm-btn" href="mailto:ducdoan04.work@gmail.com?subject=${encodeURIComponent(`[DEVSTU] Hỗ trợ đơn #${o.order_code}`)}">${esc(t('Cần hỗ trợ / Chuyển sai nội dung', 'Need help'))}</a>
      </div>
      <p class="dv-qr-notice">${esc(t(
        'Thanh toán xong hệ thống sẽ tự động cấp 1 mã Key riêng và lưu vào mục Lịch sử đơn hàng của bạn (không tự kích hoạt vào tài khoản). Nếu có lỗi mạng hoặc lỡ đóng cửa sổ, bạn chỉ cần mở lại trang Bảng giá để lấy Key.',
        'Once paid, a standalone Key will be issued and saved in your Order History (never auto-activated). Even if you close this tab, sign back in here to retrieve your Key.'
      ))}</p>`;

    startTimers();
  }

  function startTimers() {
    stopPolling();
    const o = state.activeOrder;
    if (!o || o.status === 'paid') return;

    const updateClock = () => {
      const el = qrDlg?.querySelector('[data-qr-timer]');
      if (!el || !o.expires_at) return;
      const leftSec = Math.max(0, Math.floor((new Date(o.expires_at).getTime() - Date.now()) / 1000));
      const mm = String(Math.floor(leftSec / 60)).padStart(2, '0');
      const ss = String(leftSec % 60).padStart(2, '0');
      el.textContent = leftSec > 0 ? `${mm}:${ss}` : t('Hết hạn', 'Expired');
    };
    updateClock();
    state.countdownTimer = setInterval(updateClock, 1000);
    state.pollTimer = setInterval(() => checkActiveOrder(false), 3200);
  }

  async function checkActiveOrder(manual = false) {
    if (!state.activeOrder || !qrDlg?.open) return;
    const msgEl = qrDlg.querySelector('[data-qr-poll-msg]');
    if (manual && msgEl) msgEl.textContent = t('Đang kiểm tra giao dịch ngân hàng…', 'Checking bank transfer…');
    try {
      const res = await apiReq(`/api/orders/status?code=${encodeURIComponent(state.activeOrder.order_code)}`);
      if (res.order) {
        const changed = res.order.status !== state.activeOrder.status || res.order.issued_key_code !== state.activeOrder.issued_key_code;
        state.activeOrder = res.order;
        if (res.bank) state.activeBank = res.bank;
        if (changed) {
          renderQrModal();
          await loadMyOrders();
        } else if (manual && msgEl) {
          msgEl.textContent = t('Chưa thấy giao dịch vào — vui lòng đợi thêm vài giây rồi thử lại.', 'Transfer not received yet — wait a few seconds and retry.');
        }
      }
    } catch (err) {
      if (manual && msgEl) msgEl.textContent = err.message;
    }
  }

  async function startCheckout(plan, period) {
    const s = await refreshSessionIfNeeded(false);
    if (!s?.access_token) {
      sessionStorage.setItem(PENDING_BUY_KEY, JSON.stringify({ plan, period }));
      saveAuthContext({ plan, period, next: pricingPath() });
      location.href = `${loginPath()}?next=${encodeURIComponent(pricingPath())}&plan=${encodeURIComponent(plan)}&period=${encodeURIComponent(period)}`;
      return;
    }
    sessionStorage.removeItem(PENDING_BUY_KEY);
    if (!qrDlg) return;

    const body = qrDlg.querySelector('[data-qr-body]');
    body.innerHTML = `<p class="dv-dlg__sub" style="margin:12px 0;text-align:center">${esc(t('Đang khởi tạo mã VietQR…', 'Creating VietQR order…'))}</p>`;
    qrDlg.showModal();

    try {
      const res = await apiReq('/api/orders/create', { method: 'POST', body: { plan, period } });
      state.activeOrder = res.order;
      state.activeBank = res.bank;
      renderQrModal();
      await loadMyOrders();
    } catch (err) {
      const msg = String(err.message || '');
      const hint = msg.includes('user_create_payment_order') || err.code === 'PGRST202'
        ? t('Chưa chạy file supabase_orders_schema.sql trên Supabase SQL Editor.', 'Please run supabase_orders_schema.sql in Supabase SQL Editor first.')
        : msg;
      body.innerHTML = `<p class="dv-err">${esc(hint)}</p>`;
    }
  }

  async function reopenPendingOrder(code) {
    if (!qrDlg) return;
    const body = qrDlg.querySelector('[data-qr-body]');
    body.innerHTML = `<p class="dv-dlg__sub" style="margin:12px 0;text-align:center">${esc(t('Đang tải thông tin đơn hàng…', 'Loading order…'))}</p>`;
    qrDlg.showModal();
    try {
      const res = await apiReq(`/api/orders/status?code=${encodeURIComponent(code)}`);
      state.activeOrder = res.order;
      state.activeBank = res.bank;
      renderQrModal();
    } catch (err) {
      body.innerHTML = `<p class="dv-err">${esc(err.message)}</p>`;
    }
  }

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const buyBtn = e.target.closest('[data-buy-plan]');
      if (buyBtn) {
        e.preventDefault();
        const plan = buyBtn.dataset.buyPlan || 'Pro STU Ultra';
        const isYear = document.getElementById('hm-per-y')?.checked;
        startCheckout(plan, isYear ? 'year' : 'lifetime');
        return;
      }
      if (e.target.closest('[data-web-logout]')) {
        const tok = state.session?.access_token;
        if (tok) authReq('/auth/v1/logout', { method: 'POST', token: tok }).catch(() => {});
        clearSession();
        renderOrders();
        renderLoginPage();
        return;
      }
      const copyKeyBtn = e.target.closest('[data-copy-key]');
      if (copyKeyBtn) {
        copyText(copyKeyBtn.dataset.copyKey, copyKeyBtn);
        return;
      }
      const copyValBtn = e.target.closest('[data-copy-val]');
      if (copyValBtn) {
        copyText(copyValBtn.dataset.copyVal, copyValBtn);
        return;
      }
      const reopenBtn = e.target.closest('[data-reopen-order]');
      if (reopenBtn) {
        reopenPendingOrder(reopenBtn.dataset.reopenOrder);
        return;
      }
      if (e.target.closest('[data-qr-check-now]')) {
        checkActiveOrder(true);
        return;
      }
      if (e.target.closest('[data-refresh-orders]')) {
        loadMyOrders();
      }
    });

    if (qrDlg) {
      qrDlg.querySelector('[data-dlg-close]')?.addEventListener('click', () => qrDlg.close());
      qrDlg.addEventListener('click', (ev) => { if (ev.target === qrDlg) qrDlg.close(); });
      qrDlg.addEventListener('close', stopPolling);
    }

    // Sync when user logs out from navbar dropdown
    window.addEventListener('devstu:auth-change', () => {
      const next = loadSession();
      if (!next && state.session) {
        state.session = null;
        state.orders = [];
        if (qrDlg?.open) qrDlg.close();
        renderOrders();
        renderLoginPage();
      }
    });

    // Dedicated Login Page form wiring
    if (loginPage) {
      loginPage.querySelectorAll('[data-web-auth-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.authMode = btn.dataset.webAuthTab;
          loginPage.querySelectorAll('[data-web-auth-tab]').forEach((b) => b.classList.toggle('is-on', b === btn));
          loginPage.querySelector('[data-otp-box]').hidden = state.authMode !== 'otp';
          loginPage.querySelector('[data-pass-box]').hidden = state.authMode !== 'password';
          loginPage.querySelector('[data-send-otp]').hidden = state.authMode !== 'otp';
          loginPage.querySelector('[data-auth-submit]').textContent = state.authMode === 'otp'
            ? t('Xác nhận OTP', 'Verify OTP')
            : t('Đăng nhập', 'Sign in');
          setAuthFeedback('', '');
        });
      });

      loginPage.querySelector('[data-web-google]')?.addEventListener('click', async () => {
        try {
          setAuthFeedback('', '');
          saveAuthContext(readAuthContext());
          const { verifier, challenge } = await createPkce();
          sessionStorage.setItem(PKCE_KEY, verifier);
          localStorage.setItem(PKCE_KEY, verifier);
          const redirectTo = encodeURIComponent(`${location.origin}${location.pathname}`);
          location.href = `${SB_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=s256`;
        } catch (err) {
          setAuthFeedback(err.message, '');
        }
      });

      loginPage.querySelector('[data-send-otp]')?.addEventListener('click', async (ev) => {
        const email = loginPage.querySelector('[data-auth-email]').value.trim().toLowerCase();
        if (!email || !email.includes('@')) {
          setAuthFeedback(t('Vui lòng nhập đúng địa chỉ Email.', 'Please enter a valid email address.'), '');
          return;
        }
        const btn = ev.currentTarget;
        btn.disabled = true;
        setAuthFeedback('', '');
        try {
          saveAuthContext(readAuthContext());
          await authReq(`/auth/v1/otp?redirect_to=${encodeURIComponent(`${location.origin}${location.pathname}`)}`, {
            method: 'POST',
            body: { email, create_user: true }
          });
          setAuthFeedback('', t(`Đã gửi mã OTP 6 số tới ${email}. Kiểm tra hộp thư (hoặc Spam).`, `Sent a 6-digit OTP to ${email}.`));
        } catch (err) {
          setAuthFeedback(err.message, '');
        } finally {
          btn.disabled = false;
        }
      });

      loginPage.querySelector('[data-web-auth-form]')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const email = loginPage.querySelector('[data-auth-email]').value.trim().toLowerCase();
        if (!email || !email.includes('@')) {
          setAuthFeedback(t('Vui lòng nhập Email hợp lệ.', 'Please enter a valid email.'), '');
          return;
        }
        const btn = loginPage.querySelector('[data-auth-submit]');
        btn.disabled = true;
        setAuthFeedback('', '');
        try {
          let res;
          if (state.authMode === 'otp') {
            const code = loginPage.querySelector('[data-auth-otp]').value.replace(/\s+/g, '');
            if (code.length < 6) throw new Error(t('Vui lòng nhập đủ mã OTP 6 số.', 'Enter the 6-digit OTP code.'));
            res = await authReq('/auth/v1/verify', { method: 'POST', body: { email, token: code, type: 'email' } });
          } else {
            const password = loginPage.querySelector('[data-auth-pass]').value;
            if (!password) throw new Error(t('Vui lòng nhập mật khẩu.', 'Please enter your password.'));
            res = await authReq('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
          }
          saveSession(res);
          redirectAfterLogin();
        } catch (err) {
          setAuthFeedback(err.message || t('Đăng nhập thất bại.', 'Sign in failed.'), '');
        } finally {
          btn.disabled = false;
        }
      });
    }
  }

  function resumePendingBuyOnPricing() {
    if (!isPricingPage) return;
    const url = new URL(location.href);
    let plan = (url.searchParams.get('plan') || '').trim();
    let period = (url.searchParams.get('period') || '').trim().toLowerCase();
    const shouldCheckout = url.searchParams.get('checkout') === '1';

    if (shouldCheckout || plan) {
      url.searchParams.delete('checkout');
      url.searchParams.delete('plan');
      url.searchParams.delete('period');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }

    if (!plan) {
      try {
        const raw = sessionStorage.getItem(PENDING_BUY_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          plan = parsed?.plan || '';
          period = parsed?.period || '';
        }
      } catch {}
    }

    if (plan) {
      sessionStorage.removeItem(PENDING_BUY_KEY);
      const normPeriod = period === 'year' ? 'year' : 'lifetime';
      const radioY = document.getElementById('hm-per-y');
      const radioL = document.getElementById('hm-per-l');
      if (radioY && radioL) {
        radioY.checked = normPeriod === 'year';
        radioL.checked = normPeriod !== 'year';
      }
      startCheckout(plan, normPeriod);
    }
  }

  async function init() {
    bindEvents();
    let oauthJustLoggedIn = false;
    try {
      oauthJustLoggedIn = await handleOAuthCallback();
    } catch (err) {
      if (loginPage) setAuthFeedback(err.message || t('Đăng nhập Google thất bại.', 'Google sign in failed.'), '');
    }

    await refreshSessionIfNeeded(false);

    if (loginPage) {
      if (oauthJustLoggedIn && state.session?.access_token) {
        redirectAfterLogin();
        return;
      }
      renderLoginPage();
    }

    if (isPricingPage) {
      await loadMyOrders();
      if (state.session?.access_token) resumePendingBuyOnPricing();
    }

    if (window.DEVSTU_I18N) {
      window.DEVSTU_I18N.onChange(() => {
        renderLoginPage();
        renderOrders();
        if (qrDlg?.open && state.activeOrder) renderQrModal();
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
