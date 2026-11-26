(() => {
  'use strict';

  const SB_URL = 'https://kvdmtofhkzwgoiganirl.supabase.co';
  const SB_KEY = 'sb_publishable_JSEFSdaGLb3Q-NgLZw6GWA_vW0RGE1k';
  const SESSION_KEY = 'devstu_admin_sb_session_v1';
  const PKCE_KEY = 'devstu_admin_sb_pkce_v1';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const state = {
    session: null,
    me: null,
    authMode: 'password',
    tab: 'accounts',
    accFilter: 'all',
    accSearch: '',
    accounts: [],
    accTotal: 0,
    keyMode: 'random',
    keyFilter: 'all',
    keySearch: '',
    keys: [],
    lastBatchKeys: [],
    notifications: [],
    bugFilter: 'all',
    bugSearch: '',
    bugs: [],
    ordFilter: 'all',
    ordSearch: '',
    orders: [],
    ordStats: null,
    promo: null,
    editingUserId: null,
    confirmAction: null
  };

  /* ---- Utilities ---- */
  function esc(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toast(msg, type = 'ok') {
    const wrap = $('#adm-toasts');
    const el = document.createElement('div');
    el.className = `adm-toast adm-toast--${type}`;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async function copyText(txt, okMsg = 'Đã copy vào bộ nhớ tạm') {
    try {
      await navigator.clipboard.writeText(txt);
      toast(okMsg, 'ok');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast(okMsg, 'ok');
    }
  }

  /* ---- Supabase Auth & Session ---- */
  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.access_token ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveSession(data) {
    if (!data?.access_token) return null;
    const now = Math.floor(Date.now() / 1000);
    const stored = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || '',
      expires_at: Number(data.expires_at) || now + (Number(data.expires_in) || 3600),
      user: data.user || null
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
    state.session = stored;
    return stored;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    state.session = null;
    state.me = null;
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
      const err = new Error(json.msg || json.error_description || json.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = json.code || json.error_code || '';
      throw err;
    }
    return json;
  }

  async function refreshSessionIfNeeded(force = false) {
    const s = state.session || loadSession();
    if (!s) return null;
    state.session = s;
    const now = Math.floor(Date.now() / 1000);
    if (!force && s.expires_at && s.expires_at > now + 60) return s;
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

  async function rpc(name, params = {}, retry = true) {
    const s = await refreshSessionIfNeeded(false);
    if (!s?.access_token) throw new Error('Phiên đăng nhập đã hết hạn.');
    const res = await fetch(`${SB_URL}/rest/v1/rpc/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${s.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params),
      cache: 'no-store'
    });
    if (res.status === 401 && retry) {
      const refreshed = await refreshSessionIfNeeded(true);
      if (refreshed) return rpc(name, params, false);
    }
    const txt = await res.text();
    let json = null;
    try { json = txt ? JSON.parse(txt) : null; } catch {}
    if (!res.ok) {
      const err = new Error(json?.message || json?.hint || txt || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = json?.code || '';
      throw err;
    }
    return json;
  }

  async function handleOAuthCallbackIfPresent() {
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
      const verifier = sessionStorage.getItem(PKCE_KEY) || '';
      sessionStorage.removeItem(PKCE_KEY);
      if (!verifier) {
        cleanOAuthUrl(url);
        throw new Error('Thiếu mã PKCE verifier, hãy đăng nhập Google lại.');
      }
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
    const nextHash = state.tab ? `#${state.tab}` : '';
    history.replaceState(history.state, '', url.pathname + url.search + nextHash);
  }

  function showAuthError(msg) {
    const el = $('#adm-auth-err');
    el.textContent = msg;
    el.hidden = !msg;
  }

  /* ---- View Switching ---- */
  function setGateView(view) {
    $('#adm-login-view').hidden = view !== 'login';
    $('#adm-denied-view').hidden = view !== 'denied';
    $('#adm-console-view').hidden = view !== 'console';
    $('#adm-userbar').hidden = view === 'login';
    $('#adm-guestbar').hidden = view !== 'login';
  }

  function resolveInitialTab() {
    const p = location.pathname.replace(/\/+$/, '');
    if (p.endsWith('/admin/notifications')) return 'notifications';
    if (p.endsWith('/admin/keys')) return 'keys';
    if (p.endsWith('/admin/orders')) return 'orders';
    if (p.endsWith('/admin/promo')) return 'promo';
    if (p.endsWith('/admin/bugs')) return 'bugs';
    if (p.endsWith('/admin/accounts')) return 'accounts';
    const h = location.hash.replace(/^#/, '');
    if (['accounts', 'notifications', 'keys', 'orders', 'promo', 'bugs'].includes(h)) return h;
    return 'accounts';
  }

  function switchTab(tab, updateHash = true) {
    if (!['accounts', 'notifications', 'keys', 'orders', 'promo', 'bugs'].includes(tab)) tab = 'accounts';
    state.tab = tab;
    $$('.adm-navtab').forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    $('#panel-accounts').hidden = tab !== 'accounts';
    $('#panel-notifications').hidden = tab !== 'notifications';
    $('#panel-keys').hidden = tab !== 'keys';
    $('#panel-orders').hidden = tab !== 'orders';
    $('#panel-promo').hidden = tab !== 'promo';
    $('#panel-bugs').hidden = tab !== 'bugs';
    if (updateHash && location.hash !== `#${tab}`) {
      history.replaceState(history.state, '', `${location.pathname}#${tab}`);
    }
  }

  function renderTopUser(profile, fallbackUser) {
    const email = profile?.email || fallbackUser?.email || '—';
    const name = profile?.full_name || fallbackUser?.user_metadata?.full_name || email.split('@')[0];
    const avatar = profile?.avatar_url || fallbackUser?.user_metadata?.avatar_url || '';
    $('#adm-me-name').textContent = name;
    $('#adm-me-email').textContent = email;
    const av = $('#adm-me-avatar');
    if (avatar) {
      av.innerHTML = `<img src="${esc(avatar)}" alt="">`;
    } else {
      av.textContent = (name[0] || 'A').toUpperCase();
    }
  }

  async function bootSession() {
    const s = await refreshSessionIfNeeded(false);
    if (!s) {
      setGateView('login');
      return;
    }

    try {
      const who = await rpc('admin_who_am_i');
      if (!who?.authenticated) {
        clearSession();
        setGateView('login');
        return;
      }
      state.me = who.profile || s.user;
      renderTopUser(who.profile, s.user);

      if (!who.is_admin) {
        const email = who.profile?.email || s.user?.email || 'email-cua-ban@gmail.com';
        $('#adm-denied-title').textContent = 'Tài khoản chưa có quyền Admin';
        $('#adm-denied-desc').textContent =
          `Tài khoản ${email} đang có role "${who.profile?.role || 'member'}". Hãy chạy câu SQL dưới đây trong Supabase SQL Editor để cấp quyền quản trị:`;
        $('#adm-denied-sql').textContent =
          `update public.profiles set role = 'admin', is_banned = false where lower(email) = '${email.toLowerCase()}';`;
        setGateView('denied');
        return;
      }

      setGateView('console');
      switchTab(state.tab, false);
      await loadAllData();
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (err?.code === 'PGRST202' || msg.includes('admin_who_am_i')) {
        renderTopUser(null, s.user);
        $('#adm-denied-title').textContent = 'Chưa chạy SQL thiết lập bảng Admin trên Supabase';
        $('#adm-denied-desc').textContent =
          'Vui lòng mở Supabase Dashboard → SQL Editor và chạy phần SQL Admin trong supabase_schema.sql (đã gửi trong hướng dẫn), sau đó bấm Kiểm tra lại quyền.';
        $('#adm-denied-sql').textContent =
          `-- Mở file 6. fotoreto-clone/supabase_schema.sql (từ dòng Admin Console)\n-- Dán vào Supabase SQL Editor và bấm Run, sau đó chạy:\nnotify pgrst, 'reload schema';`;
        setGateView('denied');
        return;
      }
      toast('Không tải được phiên quản trị: ' + msg, 'err');
      clearSession();
      setGateView('login');
    }
  }

  /* ---- Data Loaders ---- */
  async function loadAllData() {
    await Promise.all([loadStats(), loadAccounts(), loadKeys(), loadNotifications(), loadOrders().catch(() => {}), loadPromo().catch(() => {}), loadBugs().catch(() => {})]);
  }

  async function loadStats() {
    const st = await rpc('admin_dashboard_stats');
    $('#stat-total-users').textContent = st.total_users ?? 0;
    $('#stat-users-meta').textContent = `${st.admin_users ?? 0} admin · ${st.banned_users ?? 0} đã khoá`;
    $('#stat-premium-users').textContent = st.premium_users ?? 0;
    $('#stat-premium-meta').textContent = `${st.lifetime_users ?? 0} tài khoản Vĩnh viễn`;
    $('#stat-active-keys').textContent = st.active_keys ?? 0;
    $('#stat-keys-meta').textContent = `${st.total_keys ?? 0} tổng key · ${st.total_redemptions ?? 0} lượt nhập`;
    $('#stat-notifications').textContent = st.total_notifications ?? 0;
    $('#stat-presets-meta').textContent = `${st.total_presets ?? 0} preset đang lưu trên cloud`;
    $('#stat-bugs').textContent = st.open_bugs ?? 0;
    $('#stat-bugs-meta').textContent = `${st.total_bugs ?? 0} tổng báo lỗi`;
    $('#tab-cnt-accounts').textContent = st.total_users ?? 0;
    $('#tab-cnt-notifications').textContent = st.total_notifications ?? 0;
    $('#tab-cnt-keys').textContent = st.total_keys ?? 0;
    $('#tab-cnt-bugs').textContent = st.open_bugs ?? st.total_bugs ?? 0;
  }

  async function loadAccounts() {
    const res = await rpc('admin_list_accounts', {
      p_search: state.accSearch,
      p_filter: state.accFilter,
      p_limit: 150,
      p_offset: 0
    });
    state.accounts = Array.isArray(res?.items) ? res.items : [];
    state.accTotal = Number(res?.total) || state.accounts.length;
    renderAccounts();
    renderUserDatalist();
  }

  function renderUserDatalist() {
    const dl = $('#ntc-user-datalist');
    dl.innerHTML = state.accounts
      .map((u) => `<option value="${esc(u.email)}">${esc(u.full_name || u.email)}</option>`)
      .join('');
  }

  function renderAccounts() {
    const tbody = $('#acc-tbody');
    $('#acc-summary').textContent = `Hiển thị ${state.accounts.length} / ${state.accTotal} tài khoản`;
    if (!state.accounts.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="adm-empty">Không tìm thấy tài khoản phù hợp.</td></tr>';
      return;
    }

    tbody.innerHTML = state.accounts
      .map((u) => {
        const isSelf = state.me?.id === u.id;
        const name = u.full_name || u.email?.split('@')[0] || 'DEVSTU';
        const avatarHtml = u.avatar_url
          ? `<img src="${esc(u.avatar_url)}" alt="">`
          : esc((name[0] || 'U').toUpperCase());
        const provBadge =
          u.provider === 'google'
            ? '<span class="adm-pill adm-pill--blue">Google</span>'
            : '<span class="adm-pill">Gmail / OTP</span>';
        const roleBadge =
          u.role === 'admin'
            ? '<span class="adm-pill adm-pill--amber">Admin</span>'
            : '<span class="adm-pill">Member</span>';
        const bannedBadge = u.is_banned ? ' <span class="adm-pill adm-pill--red">Đã khoá</span>' : '';

        let premHtml = '<span class="adm-pill">Standard (Free)</span>';
        const untilMs = u.premium_until ? new Date(u.premium_until).getTime() : 0;
        const isExpired = untilMs > 0 && untilMs <= Date.now() && !u.premium_lifetime;
        if (u.is_premium && !isExpired) {
          const term = u.premium_lifetime ? 'Vĩnh viễn' : u.premium_until ? `Đến ${fmtDate(u.premium_until)}` : 'Đang bật';
          premHtml = `<span class="adm-pill adm-pill--green">${esc(u.premium_plan || 'Premium')} · ${esc(term)}</span>`;
        } else if (isExpired) {
          premHtml = `<span class="adm-pill adm-pill--red">Hết hạn (${fmtDate(u.premium_until)})</span>`;
        }
        if (u.activated_key) {
          premHtml += `<div><small class="adm-muted">Key: <span class="adm-code">${esc(u.activated_key)}</span></small></div>`;
        }

        return `<tr data-user-id="${esc(u.id)}">
          <td>
            <div class="adm-user-cell">
              <span class="adm-avatar">${avatarHtml}</span>
              <div>
                <strong>${esc(name)}${isSelf ? ' <small class="adm-pill adm-pill--blue">Bạn</small>' : ''}</strong>
                <small>${esc(u.email)}</small>
              </div>
            </div>
          </td>
          <td>${provBadge}</td>
          <td>${roleBadge}${bannedBadge}</td>
          <td>${premHtml}</td>
          <td><span class="adm-pill">${Number(u.preset_count) || 0} preset</span></td>
          <td><span class="adm-muted">${fmtDate(u.created_at)}</span></td>
          <td class="is-right">
            <div class="adm-row-actions" style="justify-content:flex-end">
              <button type="button" class="adm-btn adm-btn--ghost adm-btn--sm" data-acc-act="edit-prem">Gói</button>
              <button type="button" class="adm-btn adm-btn--ghost adm-btn--sm" data-acc-act="notify">Gửi TB</button>
              ${
                isSelf
                  ? ''
                  : `<button type="button" class="adm-btn adm-btn--ghost adm-btn--sm" data-acc-act="toggle-role">${u.role === 'admin' ? 'Hạ Member' : 'Lên Admin'}</button>
                     <button type="button" class="adm-btn adm-btn--ghost adm-btn--sm" data-acc-act="toggle-ban">${u.is_banned ? 'Mở khoá' : 'Khoá'}</button>
                     <button type="button" class="adm-btn adm-btn--danger adm-btn--sm" data-acc-act="delete">Xoá</button>`
              }
            </div>
          </td>
        </tr>`;
      })
      .join('');
  }

  /* ---- Notifications ---- */
  async function loadNotifications() {
    const list = await rpc('admin_list_notifications', { p_limit: 120 });
    state.notifications = Array.isArray(list) ? list : [];
    renderNotifications();
  }

  function renderNotifications() {
    const box = $('#ntc-history-list');
    if (!state.notifications.length) {
      box.innerHTML = '<p class="adm-empty">Chưa có thông báo nào được gửi.</p>';
      return;
    }
    box.innerHTML = state.notifications
      .map((n) => {
        const audBadge =
          n.audience === 'all'
            ? '<span class="adm-pill adm-pill--blue">Tất cả người dùng</span>'
            : `<span class="adm-pill adm-pill--amber">Riêng: ${esc(n.target_email || n.target_user_id)}</span>`;
        const activeBadge = n.is_active
          ? '<span class="adm-pill adm-pill--green">Đang hiện</span>'
          : '<span class="adm-pill adm-pill--red">Đang ẩn</span>';
        const linkHtml = n.link_url
          ? `<a class="adm-preview__btn" href="${esc(n.link_url)}" target="_blank" rel="noopener noreferrer">${esc(n.link_label || n.link_url)}</a>`
          : '';
        return `<article class="adm-ntc-card" data-ntc-id="${esc(n.id)}">
          <div class="adm-ntc-card__head">
            <strong>${esc(n.title)}</strong>
            <time>${fmtDateTime(n.created_at)}</time>
          </div>
          <p>${esc(n.body)}</p>
          ${linkHtml}
          <div class="adm-ntc-card__foot">
            <div class="adm-row-actions">
              ${audBadge}
              ${activeBadge}
              <span class="adm-pill">${Number(n.read_count) || 0} đã đọc</span>
            </div>
            <div class="adm-row-actions">
              <button type="button" class="adm-btn adm-btn--ghost adm-btn--sm" data-ntc-act="toggle">${n.is_active ? 'Ẩn' : 'Hiện lại'}</button>
              <button type="button" class="adm-btn adm-btn--danger adm-btn--sm" data-ntc-act="delete">Xoá</button>
            </div>
          </div>
        </article>`;
      })
      .join('');
  }

  function updateNotificationPreview() {
    const title = $('#ntc-title').value.trim() || 'Tiêu đề thông báo';
    const body = $('#ntc-body').value.trim() || 'Nội dung thông báo sẽ hiển thị tại đây…';
    const link = $('#ntc-link-url').value.trim();
    const label = $('#ntc-link-label').value.trim() || 'Mở link';
    $('#ntc-prev-title').textContent = title;
    $('#ntc-prev-body').textContent = body;
    const prevLink = $('#ntc-prev-link');
    prevLink.hidden = !/^https:\/\/[^\s]+$/i.test(link);
    prevLink.textContent = label;
  }

  /* ---- Keys ---- */
  function generateRandomCode(prefix) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const pick = (len) => {
      const arr = new Uint8Array(len);
      crypto.getRandomValues(arr);
      return [...arr].map((b) => chars[b % chars.length]).join('');
    };
    const cleanPre = (prefix || 'DEVSTU').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'DEVSTU';
    return `${cleanPre}-${pick(4)}-${pick(4)}`;
  }

  async function loadKeys() {
    const list = await rpc('admin_list_keys', {
      p_search: state.keySearch,
      p_status: state.keyFilter,
      p_limit: 250
    });
    state.keys = Array.isArray(list) ? list : [];
    renderKeys();
  }

  function renderKeys() {
    const tbody = $('#key-tbody');
    if (!state.keys.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="adm-empty">Chưa có key nào khớp bộ lọc.</td></tr>';
      return;
    }

    tbody.innerHTML = state.keys
      .map((k) => {
        const expMs = k.expires_at ? new Date(k.expires_at).getTime() : 0;
        const isExpired = expMs > 0 && expMs <= Date.now();
        const isExhausted = Number(k.used_count) >= Number(k.max_uses);
        let statusBadge = '<span class="adm-pill adm-pill--green">Sẵn sàng</span>';
        if (!k.is_active) statusBadge = '<span class="adm-pill adm-pill--red">Đang khoá</span>';
        else if (isExpired) statusBadge = '<span class="adm-pill adm-pill--red">Hết hạn</span>';
        else if (isExhausted) statusBadge = '<span class="adm-pill adm-pill--amber">Đã hết lượt</span>';

        const durText = k.is_lifetime ? 'Vĩnh viễn' : `${k.days || 30} ngày`;
        const redemptions = Array.isArray(k.redemptions) ? k.redemptions : [];
        const whoHtml = redemptions.length
          ? `<div class="adm-redemption-list">${redemptions
              .slice(0, 3)
              .map((r) => `<span>${esc(r.email)} <small class="adm-muted">(${fmtDate(r.redeemed_at)})</small></span>`)
              .join('')}${redemptions.length > 3 ? `<small class="adm-muted">+${redemptions.length - 3} người khác</small>` : ''}</div>`
          : '<span class="adm-muted">Chưa ai nhập</span>';

        return `<tr data-key-id="${esc(k.id)}">
          <td>
            <button type="button" class="adm-key-btn" data-key-act="copy" title="Bấm để copy mã">${esc(k.code)}</button>
            ${k.expires_at ? `<div><small class="adm-muted">Hết hạn: ${fmtDate(k.expires_at)}</small></div>` : ''}
          </td>
          <td><strong>${esc(k.plan)}</strong><div><small class="adm-muted">${esc(durText)}</small></div></td>
          <td><span class="adm-pill">${k.used_count} / ${k.max_uses}</span></td>
          <td>${statusBadge}</td>
          <td>${whoHtml}</td>
          <td><span class="adm-muted">${esc(k.note || '—')}</span></td>
          <td class="is-right">
            <div class="adm-row-actions" style="justify-content:flex-end">
              <button type="button" class="adm-btn adm-btn--ghost adm-btn--sm" data-key-act="toggle">${k.is_active ? 'Khoá mã' : 'Mở mã'}</button>
              <button type="button" class="adm-btn adm-btn--danger adm-btn--sm" data-key-act="delete">Xoá</button>
            </div>
          </td>
        </tr>`;
      })
      .join('');
  }

  /* ---- VietQR Orders ---- */
  async function loadOrders() {
    try {
      const res = await rpc('admin_list_orders', {
        p_search: state.ordSearch,
        p_status: state.ordFilter,
        p_limit: 200
      });
      state.orders = Array.isArray(res?.items) ? res.items : [];
      state.ordStats = res?.stats || null;
      renderOrders();
    } catch (err) {
      const tb = $('#ord-tbody');
      if (tb && (String(err?.message || '').includes('admin_list_orders') || err?.code === 'PGRST202')) {
        tb.innerHTML = '<tr><td colspan="7" class="adm-empty">Chưa chạy file <code>supabase_orders_schema.sql</code> trong Supabase SQL Editor.</td></tr>';
        return;
      }
      throw err;
    }
  }

  function orderStatusBadge(st) {
    if (st === 'paid') return '<span class="adm-pill adm-pill--green">Đã cấp Key</span>';
    if (st === 'manual_review') return '<span class="adm-pill adm-pill--amber">Cần kiểm tra</span>';
    if (st === 'pending') return '<span class="adm-pill adm-pill--blue">Chờ thanh toán</span>';
    if (st === 'cancelled') return '<span class="adm-pill">Đã hủy</span>';
    if (st === 'failed') return '<span class="adm-pill adm-pill--red">Lỗi</span>';
    return '<span class="adm-pill">Hết hạn</span>';
  }

  function renderOrders() {
    const tb = $('#ord-tbody');
    if (!tb) return;
    if (state.ordStats) {
      const s = state.ordStats;
      $('#tab-cnt-orders').textContent = s.total_orders ?? 0;
      const rev = Number(s.total_revenue || 0).toLocaleString('vi-VN');
      $('#ord-summary').innerHTML = `Đã thanh toán: <strong>${s.paid_orders || 0}</strong> · Doanh thu: <strong>${rev} đ</strong> · Cần kiểm tra: <strong>${s.review_orders || 0}</strong> · Chờ TT: <strong>${s.pending_orders || 0}</strong>`;
    }
    if (!state.orders.length) {
      tb.innerHTML = '<tr><td colspan="7" class="adm-empty">Chưa có đơn hàng VietQR nào khớp bộ lọc.</td></tr>';
      return;
    }
    tb.innerHTML = state.orders.map((o) => {
      const periodTxt = o.is_lifetime ? 'Vĩnh viễn' : `${o.days || 365} ngày`;
      const amtTxt = `${Number(o.amount || 0).toLocaleString('vi-VN')} đ`;
      const keyCell = o.issued_key_code
        ? `<button type="button" class="adm-key-btn" data-ord-act="copy-key">${esc(o.issued_key_code)}</button>
           <div><small class="adm-muted">${Number(o.key_used_count) >= Number(o.key_max_uses || 1) ? 'Đã nhập trong app' : 'Chưa nhập app'}</small></div>`
        : '<span class="adm-muted">Chưa cấp</span>';
      const txCell = o.tx_id
        ? `<div><small class="adm-code">${esc(o.tx_id)}</small></div>
           <div><small class="adm-muted">${o.tx_amount ? Number(o.tx_amount).toLocaleString('vi-VN') + ' đ' : ''}</small></div>
           ${o.admin_note ? `<div><small style="color:#fbbf24">${esc(o.admin_note)}</small></div>` : ''}`
        : (o.admin_note ? `<span style="color:#fbbf24">${esc(o.admin_note)}</span>` : '<span class="adm-muted">—</span>');
      const issueBtn = o.status !== 'paid'
        ? `<button type="button" class="adm-btn adm-btn--primary adm-btn--sm" data-ord-act="issue">Duyệt &amp; Cấp Key</button>`
        : '';

      return `<tr data-ord-id="${esc(o.id)}">
        <td><strong>${esc(o.order_code)}</strong><div><small class="adm-muted">${fmtDateTime(o.created_at)}</small></div></td>
        <td><strong>${esc(o.user_email)}</strong></td>
        <td><strong>${esc(o.plan)}</strong><div><small class="adm-muted">${esc(periodTxt)} · ${esc(amtTxt)}</small></div></td>
        <td>${orderStatusBadge(o.status)}</td>
        <td>${keyCell}</td>
        <td>${txCell}</td>
        <td class="is-right">
          <div class="adm-row-actions" style="justify-content:flex-end">
            ${issueBtn}
            <a class="adm-btn adm-btn--ghost adm-btn--sm" href="mailto:${esc(o.user_email)}?subject=${encodeURIComponent(`[DEVSTU] Đơn hàng #${o.order_code}`)}">Email</a>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  /* ---- Dynamic Header Promo Banner (/api/promo) ---- */
  function isoToLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function localInputToIso(val) {
    const s = String(val || '').trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function fillPromoForm(cfg) {
    const c = cfg || {};
    if ($('#prm-enabled')) $('#prm-enabled').checked = Boolean(c.enabled);
    if ($('#prm-theme')) $('#prm-theme').value = c.theme || 'gold';
    if ($('#prm-pages')) $('#prm-pages').value = c.pages || 'all';
    if ($('#prm-badge-vi')) $('#prm-badge-vi').value = c.badge_vi ?? 'ƯU ĐÃI';
    if ($('#prm-code')) $('#prm-code').value = c.coupon_code || '';
    if ($('#prm-msg-vi')) $('#prm-msg-vi').value = c.message_vi || '';
    if ($('#prm-cta-vi')) $('#prm-cta-vi').value = c.cta_label_vi ?? 'Mua ngay →';
    if ($('#prm-cta-url')) $('#prm-cta-url').value = c.cta_url ?? '/bang-gia/';
    if ($('#prm-ends-at')) $('#prm-ends-at').value = isoToLocalInput(c.ends_at);
    if ($('#prm-dismissible')) $('#prm-dismissible').checked = c.dismissible !== false;
    if ($('#prm-badge-en')) $('#prm-badge-en').value = c.badge_en ?? 'PROMO';
    if ($('#prm-cta-en')) $('#prm-cta-en').value = c.cta_label_en ?? 'Buy now →';
    if ($('#prm-msg-en')) $('#prm-msg-en').value = c.message_en || '';
    updatePromoBadgeCount(Boolean(c.enabled && c.message_vi));
    updatePromoPreview();
  }

  function readPromoForm() {
    return {
      enabled: Boolean($('#prm-enabled')?.checked),
      theme: $('#prm-theme')?.value || 'gold',
      pages: $('#prm-pages')?.value || 'all',
      badge_vi: ($('#prm-badge-vi')?.value || '').trim(),
      badge_en: ($('#prm-badge-en')?.value || '').trim(),
      message_vi: ($('#prm-msg-vi')?.value || '').trim(),
      message_en: ($('#prm-msg-en')?.value || '').trim(),
      coupon_code: ($('#prm-code')?.value || '').trim(),
      cta_label_vi: ($('#prm-cta-vi')?.value || '').trim(),
      cta_label_en: ($('#prm-cta-en')?.value || '').trim(),
      cta_url: ($('#prm-cta-url')?.value || '').trim(),
      ends_at: localInputToIso($('#prm-ends-at')?.value || ''),
      dismissible: Boolean($('#prm-dismissible')?.checked)
    };
  }

  function updatePromoBadgeCount(isActive) {
    const cnt = $('#tab-cnt-promo');
    if (cnt) cnt.textContent = isActive ? 'Đang bật' : 'Tắt';
  }

  function updatePromoPreview() {
    const box = $('#prm-live-preview');
    if (!box) return;
    const c = readPromoForm();
    if (!c.enabled) {
      box.innerHTML = '<div class="adm-promo-mock__off">Băng rôn đang <strong>Tắt</strong> — bật ô “Bật hiển thị” ở bên trái rồi bấm Lưu để xuất bản.</div>';
      return;
    }
    const theme = /^(gold|blue|emerald|rose|violet)$/.test(c.theme) ? c.theme : 'gold';
    const msg = c.message_vi || 'Nhập nội dung khuyến mãi để xem trước tại đây…';
    let timerHtml = '';
    if (c.ends_at) {
      const diff = new Date(c.ends_at).getTime() - Date.now();
      if (diff > 0) {
        const s = Math.floor(diff / 1000);
        const d = Math.floor(s / 86400);
        const h = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
        const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        const sc = String(s % 60).padStart(2, '0');
        timerHtml = `<span class="site-promo__timer">${d > 0 ? `Còn ${d}n ${h}:${m}:${sc}` : `Còn ${h}:${m}:${sc}`}</span>`;
      } else {
        timerHtml = '<span class="site-promo__timer">Đã hết hạn</span>';
      }
    }
    box.innerHTML = `
      <div class="site-promo site-promo--${theme}${c.dismissible ? '' : ' site-promo--no-x'}">
        <div class="site-promo__in">
          ${c.badge_vi ? `<span class="site-promo__badge">${esc(c.badge_vi)}</span>` : ''}
          <span class="site-promo__msg">${esc(msg)}</span>
          ${c.coupon_code ? `<span class="site-promo__code">${esc(c.coupon_code)}</span>` : ''}
          ${timerHtml}
          ${c.cta_label_vi && c.cta_url ? `<span class="site-promo__cta">${esc(c.cta_label_vi)}</span>` : ''}
        </div>
        ${c.dismissible ? '<span class="site-promo__x" aria-hidden="true">✕</span>' : ''}
      </div>`;
  }

  async function loadPromo() {
    const s = await refreshSessionIfNeeded(false);
    if (!s?.access_token) return;
    let cfg = null;
    try {
      const res = await fetch('/api/promo?admin=1', {
        headers: { Authorization: `Bearer ${s.access_token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        cfg = data?.config || null;
      } else if (res.status === 404) {
        const stRes = await fetch(`${SB_URL}/storage/v1/object/public/site-config/promo-banner.json?t=${Date.now()}`, { cache: 'no-store' });
        if (stRes.ok) cfg = await stRes.json();
      }
    } catch {}
    state.promo = cfg || { enabled: false, theme: 'gold', pages: 'all', badge_vi: 'ƯU ĐÃI', badge_en: 'PROMO', cta_label_vi: 'Mua ngay →', cta_label_en: 'Buy now →', cta_url: '/bang-gia/', dismissible: true };
    fillPromoForm(state.promo);
  }

  async function savePromo(overrideEnabled = null) {
    const s = await refreshSessionIfNeeded(false);
    if (!s?.access_token) {
      toast('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 'err');
      return;
    }
    const payload = readPromoForm();
    if (overrideEnabled !== null) {
      payload.enabled = Boolean(overrideEnabled);
      if ($('#prm-enabled')) $('#prm-enabled').checked = payload.enabled;
    }
    if (payload.enabled && !payload.message_vi) {
      toast('Vui lòng nhập nội dung khuyến mãi trước khi bật.', 'err');
      $('#prm-msg-vi')?.focus();
      return;
    }

    const saveBtn = $('#prm-save-btn');
    const disBtn = $('#prm-disable-btn');
    if (saveBtn) saveBtn.disabled = true;
    if (disBtn) disBtn.disabled = true;

    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${s.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const txt = await res.text();
      let data = {};
      try { data = txt ? JSON.parse(txt) : {}; } catch {}

      if (res.status === 404) {
        throw new Error('Endpoint /api/promo chỉ chạy khi deploy lên Vercel (không chạy trên dev-server tĩnh).');
      }
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }

      state.promo = data.config;
      fillPromoForm(state.promo);
      try {
        sessionStorage.removeItem('devstu_promo_cache_v1');
        sessionStorage.removeItem('devstu_promo_dismiss_v1');
      } catch {}
      toast(payload.enabled ? 'Đã lưu & xuất bản băng rôn khuyến mãi!' : 'Đã tắt băng rôn khuyến mãi.', 'ok');
    } catch (err) {
      toast('Lỗi lưu băng rôn: ' + err.message, 'err');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
      if (disBtn) disBtn.disabled = false;
    }
  }

  /* ---- Bug Reports ---- */
  async function loadBugs() {
    try {
      const list = await rpc('admin_list_bug_reports', {
        p_search: state.bugSearch,
        p_status: state.bugFilter,
        p_limit: 150
      });
      state.bugs = Array.isArray(list) ? list : [];
      renderBugs();
    } catch (err) {
      const box = $('#bug-list');
      if (String(err?.message || '').includes('admin_list_bug_reports') || err?.code === 'PGRST202') {
        box.innerHTML = '<p class="adm-empty">Chưa tạo bảng <code>bug_reports</code> trên Supabase — hãy chạy lại file <code>supabase_schema.sql</code> trong SQL Editor.</p>';
        return;
      }
      throw err;
    }
  }

  function bugStatusPill(status) {
    if (status === 'in_progress') return '<span class="adm-pill adm-pill--amber">Đang xử lý</span>';
    if (status === 'resolved') return '<span class="adm-pill adm-pill--green">Đã sửa</span>';
    if (status === 'closed') return '<span class="adm-pill">Đã đóng</span>';
    return '<span class="adm-pill adm-pill--red">Mới</span>';
  }

  function renderBugs() {
    const box = $('#bug-list');
    if (!state.bugs.length) {
      box.innerHTML = '<p class="adm-empty">Chưa có báo lỗi nào khớp bộ lọc.</p>';
      return;
    }

    box.innerHTML = state.bugs
      .map((b) => {
        const info = b.device_info && typeof b.device_info === 'object' ? b.device_info : {};
        const entries = Object.entries(info);
        const kvHtml = entries.length
          ? `<div class="adm-bug-kv">${entries
              .map(([k, v]) => `<div><span>${esc(k)}</span><strong>${esc(typeof v === 'boolean' ? (v ? 'Có' : 'Không') : v)}</strong></div>`)
              .join('')}</div>`
          : '<p class="adm-muted">Người dùng không gửi kèm thông số máy.</p>';
        const logHtml = b.error_log
          ? `<pre class="adm-bug-log">${esc(b.error_log)}</pre>`
          : '<p class="adm-muted" style="margin-top:8px">Không có nhật ký lỗi.</p>';

        return `<article class="adm-bug-card" data-bug-id="${esc(b.id)}">
          <div class="adm-bug-head">
            <div class="adm-bug-head__l">
              <span class="adm-pill adm-pill--blue">#${esc(b.id)}</span>
              <strong>${esc(b.email)}</strong>
              ${b.user_name ? `<span class="adm-muted">(${esc(b.user_name)})</span>` : ''}
              ${bugStatusPill(b.status)}
              <span class="adm-pill">${esc((b.lang || 'vi').toUpperCase())}</span>
            </div>
            <div class="adm-bug-head__r">
              <span class="adm-muted">${fmtDateTime(b.created_at)}</span>
            </div>
          </div>

          <p class="adm-bug-msg">${esc(b.message)}</p>

          <details class="adm-bug-details">
            <summary>Thông số máy (${entries.length}) &amp; Nhật ký lỗi</summary>
            ${kvHtml}
            ${logHtml}
          </details>

          <div class="adm-bug-ctrl">
            <select data-bug-status aria-label="Trạng thái">
              <option value="open"${b.status === 'open' ? ' selected' : ''}>Mới</option>
              <option value="in_progress"${b.status === 'in_progress' ? ' selected' : ''}>Đang xử lý</option>
              <option value="resolved"${b.status === 'resolved' ? ' selected' : ''}>Đã sửa</option>
              <option value="closed"${b.status === 'closed' ? ' selected' : ''}>Đóng</option>
            </select>
            <input type="text" data-bug-note value="${esc(b.admin_note || '')}" placeholder="Ghi chú nội bộ của admin…">
            <button type="button" class="adm-btn adm-btn--primary adm-btn--sm" data-bug-act="save">Lưu</button>
            <button type="button" class="adm-btn adm-btn--ghost adm-btn--sm" data-bug-act="reply-ntc">Trả lời bằng TB</button>
            <a class="adm-btn adm-btn--ghost adm-btn--sm" href="mailto:${esc(b.email)}?subject=${encodeURIComponent(`[DEVSTU] Phản hồi báo lỗi #${b.id}`)}">Gửi Email</a>
            <button type="button" class="adm-btn adm-btn--danger adm-btn--sm" data-bug-act="delete">Xoá</button>
          </div>
        </article>`;
      })
      .join('');
  }

  /* ---- Confirm Dialog ---- */
  function askConfirm(title, message, onOk) {
    $('#adm-confirm-title').textContent = title;
    $('#adm-confirm-msg').textContent = message;
    state.confirmAction = onOk;
    $('#adm-confirm-dlg').showModal();
  }

  /* ---- Event Wiring ---- */
  function bindEvents() {
    // Auth mode tabs
    $$('[data-auth-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.authMode = btn.dataset.authMode;
        $$('[data-auth-mode]').forEach((b) => b.classList.toggle('is-active', b === btn));
        $('#adm-pass-wrap').hidden = state.authMode !== 'password';
        $('#adm-otp-wrap').hidden = state.authMode !== 'otp';
        $('#adm-send-otp-btn').hidden = state.authMode !== 'otp';
        $('#adm-submit-login').textContent = state.authMode === 'otp' ? 'Xác nhận OTP' : 'Đăng nhập';
        showAuthError('');
      });
    });

    // Google OAuth
    $('#adm-google-btn').addEventListener('click', async () => {
      try {
        showAuthError('');
        const { verifier, challenge } = await createPkce();
        sessionStorage.setItem(PKCE_KEY, verifier);
        const redirectTo = encodeURIComponent(`${location.origin}/admin`);
        location.href =
          `${SB_URL}/auth/v1/authorize?provider=google` +
          `&redirect_to=${redirectTo}` +
          `&code_challenge=${encodeURIComponent(challenge)}` +
          `&code_challenge_method=s256`;
      } catch (err) {
        showAuthError(err.message);
      }
    });

    // Send Gmail OTP
    $('#adm-send-otp-btn').addEventListener('click', async () => {
      const email = $('#adm-email-in').value.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        showAuthError('Vui lòng nhập đúng địa chỉ Gmail Admin.');
        return;
      }
      try {
        showAuthError('');
        $('#adm-send-otp-btn').disabled = true;
        await authReq(`/auth/v1/otp?redirect_to=${encodeURIComponent(`${location.origin}/admin`)}`, {
          method: 'POST',
          body: { email, create_user: false }
        });
        toast(`Đã gửi mã OTP 6 số tới ${email}`, 'ok');
      } catch (err) {
        showAuthError('Không gửi được OTP: ' + err.message);
      } finally {
        $('#adm-send-otp-btn').disabled = false;
      }
    });

    // Email/Password or OTP Submit
    $('#adm-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#adm-email-in').value.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        showAuthError('Vui lòng nhập Gmail / Email hợp lệ.');
        return;
      }
      showAuthError('');
      const btn = $('#adm-submit-login');
      btn.disabled = true;
      try {
        let res;
        if (state.authMode === 'password') {
          const password = $('#adm-pass-in').value;
          if (!password) throw new Error('Vui lòng nhập mật khẩu.');
          res = await authReq('/auth/v1/token?grant_type=password', {
            method: 'POST',
            body: { email, password }
          });
        } else {
          const code = $('#adm-otp-in').value.replace(/\s+/g, '');
          if (code.length < 6) throw new Error('Vui lòng nhập đủ mã OTP 6 số.');
          res = await authReq('/auth/v1/verify', {
            method: 'POST',
            body: { email, token: code, type: 'email' }
          });
        }
        saveSession(res);
        await bootSession();
      } catch (err) {
        showAuthError(err.message || 'Đăng nhập thất bại.');
      } finally {
        btn.disabled = false;
      }
    });

    // Denied view actions
    $('#adm-copy-denied-sql').addEventListener('click', () => copyText($('#adm-denied-sql').textContent));
    $('#adm-recheck-btn').addEventListener('click', () => bootSession());
    $('#adm-denied-logout').addEventListener('click', () => {
      clearSession();
      setGateView('login');
    });

    // Topbar actions
    $('#adm-logout-btn').addEventListener('click', async () => {
      const s = state.session;
      if (s?.access_token) {
        authReq('/auth/v1/logout', { method: 'POST', token: s.access_token }).catch(() => {});
      }
      clearSession();
      setGateView('login');
      toast('Đã đăng xuất', 'ok');
    });

    $('#adm-refresh-all').addEventListener('click', async () => {
      try {
        await loadAllData();
        toast('Đã cập nhật dữ liệu mới nhất', 'ok');
      } catch (err) {
        toast('Lỗi tải lại: ' + err.message, 'err');
      }
    });

    // Nav Tabs
    $$('.adm-navtab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Account Search & Filters
    let accSearchTimer = null;
    $('#acc-search').addEventListener('input', (e) => {
      state.accSearch = e.target.value.trim();
      clearTimeout(accSearchTimer);
      accSearchTimer = setTimeout(() => loadAccounts().catch((err) => toast(err.message, 'err')), 220);
    });

    $$('[data-acc-filter]').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.accFilter = chip.dataset.accFilter;
        $$('[data-acc-filter]').forEach((c) => c.classList.toggle('is-active', c === chip));
        loadAccounts().catch((err) => toast(err.message, 'err'));
      });
    });

    // Account Row Actions
    $('#acc-tbody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-acc-act]');
      if (!btn) return;
      const tr = btn.closest('tr');
      const uid = tr?.dataset.userId;
      const user = state.accounts.find((u) => u.id === uid);
      if (!user) return;
      const act = btn.dataset.accAct;

      if (act === 'edit-prem') {
        state.editingUserId = user.id;
        $('#acc-edit-user').textContent = `${user.full_name || user.email} (${user.email})`;
        $('#acc-edit-is-prem').checked = !!user.is_premium;
        $('#acc-edit-plan').value = ['Premium', 'Pro STU Ultra', 'Studio Max'].includes(user.premium_plan)
          ? user.premium_plan
          : 'Premium';
        $('#acc-edit-life').checked = !!user.premium_lifetime;
        $('#acc-edit-days').value = '30';
        $('#acc-edit-prem-opts').hidden = !$('#acc-edit-is-prem').checked;
        $('#acc-edit-days-wrap').hidden = $('#acc-edit-life').checked;
        $('#acc-edit-dlg').showModal();
      } else if (act === 'notify') {
        switchTab('notifications');
        $('input[name="ntc-audience"][value="user"]').checked = true;
        $('#ntc-target-wrap').hidden = false;
        $('#ntc-target-email').value = user.email;
        $('#ntc-title').focus();
      } else if (act === 'toggle-role') {
        const nextRole = user.role === 'admin' ? 'member' : 'admin';
        askConfirm(
          'Thay đổi quyền tài khoản',
          `Đổi vai trò của ${user.email} thành "${nextRole}"?`,
          async () => {
            await rpc('admin_update_account', { p_user_id: user.id, p_role: nextRole });
            toast(`Đã đổi vai trò ${user.email} -> ${nextRole}`, 'ok');
            await Promise.all([loadStats(), loadAccounts()]);
          }
        );
      } else if (act === 'toggle-ban') {
        const nextBan = !user.is_banned;
        askConfirm(
          nextBan ? 'Khoá tài khoản' : 'Mở khoá tài khoản',
          `${nextBan ? 'Khoá' : 'Mở khoá'} tài khoản ${user.email}?`,
          async () => {
            await rpc('admin_update_account', { p_user_id: user.id, p_is_banned: nextBan });
            toast(nextBan ? `Đã khoá ${user.email}` : `Đã mở khoá ${user.email}`, 'ok');
            await Promise.all([loadStats(), loadAccounts()]);
          }
        );
      } else if (act === 'delete') {
        askConfirm(
          'Xoá vĩnh viễn tài khoản',
          `Xoá hoàn toàn ${user.email} khỏi Supabase Auth, presets và lịch sử key? Không thể hoàn tác.`,
          async () => {
            await rpc('admin_delete_account', { p_user_id: user.id });
            toast(`Đã xoá tài khoản ${user.email}`, 'ok');
            await Promise.all([loadStats(), loadAccounts()]);
          }
        );
      }
    });

    // Account Premium Modal
    $('#acc-edit-is-prem').addEventListener('change', (e) => {
      $('#acc-edit-prem-opts').hidden = !e.target.checked;
    });
    $('#acc-edit-life').addEventListener('change', (e) => {
      $('#acc-edit-days-wrap').hidden = e.target.checked;
    });
    $('#acc-edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.editingUserId) return;
      const isPrem = $('#acc-edit-is-prem').checked;
      const isLife = $('#acc-edit-life').checked;
      const plan = $('#acc-edit-plan').value;
      const days = Number($('#acc-edit-days').value) || 30;
      $('#acc-edit-save').disabled = true;
      try {
        await rpc('admin_update_account', {
          p_user_id: state.editingUserId,
          p_is_premium: isPrem,
          p_plan: isPrem ? plan : null,
          p_days: isPrem && !isLife ? days : null,
          p_lifetime: isPrem ? isLife : false
        });
        $('#acc-edit-dlg').close();
        toast('Đã cập nhật gói tài khoản', 'ok');
        await Promise.all([loadStats(), loadAccounts()]);
      } catch (err) {
        toast('Lỗi cập nhật: ' + err.message, 'err');
      } finally {
        $('#acc-edit-save').disabled = false;
      }
    });

    // Notifications Compose
    $$('input[name="ntc-audience"]').forEach((r) => {
      r.addEventListener('change', () => {
        $('#ntc-target-wrap').hidden = r.value !== 'user' || !r.checked;
      });
    });
    ['#ntc-title', '#ntc-body', '#ntc-link-url', '#ntc-link-label'].forEach((sel) => {
      $(sel).addEventListener('input', updateNotificationPreview);
    });

    $('#ntc-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const audience = $('input[name="ntc-audience"]:checked')?.value || 'all';
      const targetEmail = $('#ntc-target-email').value.trim();
      const title = $('#ntc-title').value.trim();
      const body = $('#ntc-body').value.trim();
      const linkUrl = $('#ntc-link-url').value.trim();
      const linkLabel = $('#ntc-link-label').value.trim();
      if (audience === 'user' && !targetEmail) {
        toast('Vui lòng nhập email người nhận.', 'err');
        return;
      }
      if (!title || !body) {
        toast('Vui lòng nhập đủ tiêu đề và nội dung.', 'err');
        return;
      }
      if (linkUrl && !/^https:\/\/[^\s]+$/i.test(linkUrl)) {
        toast('Link đính kèm phải bắt đầu bằng https://', 'err');
        return;
      }
      const btn = $('#ntc-send-btn');
      btn.disabled = true;
      try {
        await rpc('admin_send_notification', {
          p_audience: audience,
          p_target_email: audience === 'user' ? targetEmail : null,
          p_title: title,
          p_body: body,
          p_link_url: linkUrl || null,
          p_link_label: linkLabel || null
        });
        $('#ntc-title').value = '';
        $('#ntc-body').value = '';
        $('#ntc-link-url').value = '';
        $('#ntc-link-label').value = '';
        updateNotificationPreview();
        toast(audience === 'all' ? 'Đã gửi thông báo tới tất cả người dùng!' : `Đã gửi thông báo tới ${targetEmail}!`, 'ok');
        await Promise.all([loadStats(), loadNotifications()]);
      } catch (err) {
        const msg = err.message.includes('target_user_not_found')
          ? `Không tìm thấy tài khoản nào có email "${targetEmail}".`
          : err.message;
        toast(msg, 'err');
      } finally {
        btn.disabled = false;
      }
    });

    $('#ntc-reload-btn').addEventListener('click', () => loadNotifications().catch((err) => toast(err.message, 'err')));

    $('#ntc-history-list').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-ntc-act]');
      if (!btn) return;
      const card = btn.closest('[data-ntc-id]');
      const id = Number(card?.dataset.ntcId);
      const item = state.notifications.find((n) => Number(n.id) === id);
      if (!item) return;
      if (btn.dataset.ntcAct === 'toggle') {
        try {
          await rpc('admin_toggle_notification', { p_id: id, p_is_active: !item.is_active });
          toast(item.is_active ? 'Đã ẩn thông báo' : 'Đã hiện lại thông báo', 'ok');
          await loadNotifications();
        } catch (err) {
          toast(err.message, 'err');
        }
      } else if (btn.dataset.ntcAct === 'delete') {
        askConfirm('Xoá thông báo', `Xoá thông báo "${item.title}"?`, async () => {
          await rpc('admin_delete_notification', { p_id: id });
          toast('Đã xoá thông báo', 'ok');
          await Promise.all([loadStats(), loadNotifications()]);
        });
      }
    });

    // Keys Generator & List
    $$('[data-key-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.keyMode = btn.dataset.keyMode;
        $$('[data-key-mode]').forEach((b) => b.classList.toggle('is-active', b === btn));
        $('#key-random-fields').hidden = state.keyMode !== 'random';
        $('#key-custom-fields').hidden = state.keyMode !== 'custom';
      });
    });

    $('#key-lifetime').addEventListener('change', (e) => {
      $('#key-days-row').hidden = e.target.checked;
    });

    $$('[data-days]').forEach((btn) => {
      btn.addEventListener('click', () => {
        $('#key-lifetime').checked = false;
        $('#key-days-row').hidden = false;
        $('#key-days').value = btn.dataset.days;
      });
    });

    $('#key-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      let codes = [];
      if (state.keyMode === 'random') {
        const qty = Math.max(1, Math.min(100, Number($('#key-qty').value) || 1));
        const prefix = $('#key-prefix').value.trim() || 'DEVSTU';
        const seen = new Set();
        while (codes.length < qty) {
          const c = generateRandomCode(prefix);
          if (!seen.has(c)) {
            seen.add(c);
            codes.push(c);
          }
        }
      } else {
        codes = $('#key-custom-codes')
          .value.split(/[\r\n,;]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        if (!codes.length) {
          toast('Vui lòng nhập ít nhất 1 mã key.', 'err');
          return;
        }
      }

      const plan = $('#key-plan').value;
      const isLifetime = $('#key-lifetime').checked;
      const days = isLifetime ? null : Math.max(1, Number($('#key-days').value) || 30);
      const maxUses = Math.max(1, Number($('#key-max-uses').value) || 1);
      const expDate = $('#key-expires').value;
      const expiresAt = expDate ? new Date(`${expDate}T23:59:59+07:00`).toISOString() : null;
      const note = $('#key-note').value.trim();

      const btn = $('#key-create-btn');
      btn.disabled = true;
      try {
        const res = await rpc('admin_create_keys', {
          p_codes: codes,
          p_plan: plan,
          p_days: days,
          p_is_lifetime: isLifetime,
          p_max_uses: maxUses,
          p_expires_at: expiresAt,
          p_note: note || null
        });
        const created = Array.isArray(res?.items) ? res.items.map((x) => x.code) : codes;
        state.lastBatchKeys = created;
        $('#key-created-count').textContent = created.length;
        $('#key-created-list').textContent = created.join('\n');
        $('#key-created-box').hidden = false;
        if (state.keyMode === 'custom') $('#key-custom-codes').value = '';
        toast(`Đã tạo thành công ${created.length} key ${plan}!`, 'ok');
        await Promise.all([loadStats(), loadKeys()]);
      } catch (err) {
        const msg = err.message.includes('key_duplicate')
          ? `Mã key bị trùng (${err.message.split(':')[1] || ''}), vui lòng chọn tên khác.`
          : err.message;
        toast(msg, 'err');
      } finally {
        btn.disabled = false;
      }
    });

    $('#key-copy-batch').addEventListener('click', () => {
      if (state.lastBatchKeys.length) copyText(state.lastBatchKeys.join('\n'), 'Đã copy toàn bộ danh sách key!');
    });

    $('#key-dl-txt').addEventListener('click', () => {
      if (!state.lastBatchKeys.length) return;
      const blob = new Blob([state.lastBatchKeys.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `devstu-keys-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });

    let keySearchTimer = null;
    $('#key-search').addEventListener('input', (e) => {
      state.keySearch = e.target.value.trim();
      clearTimeout(keySearchTimer);
      keySearchTimer = setTimeout(() => loadKeys().catch((err) => toast(err.message, 'err')), 220);
    });

    $$('[data-key-filter]').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.keyFilter = chip.dataset.keyFilter;
        $$('[data-key-filter]').forEach((c) => c.classList.toggle('is-active', c === chip));
        loadKeys().catch((err) => toast(err.message, 'err'));
      });
    });

    $('#key-reload-btn').addEventListener('click', () => loadKeys().catch((err) => toast(err.message, 'err')));

    $('#key-tbody').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-key-act]');
      if (!btn) return;
      const tr = btn.closest('tr');
      const id = tr?.dataset.keyId;
      const item = state.keys.find((k) => k.id === id);
      if (!item) return;

      if (btn.dataset.keyAct === 'copy') {
        copyText(item.code, `Đã copy key ${item.code}`);
      } else if (btn.dataset.keyAct === 'toggle') {
        try {
          await rpc('admin_toggle_key', { p_key_id: id, p_is_active: !item.is_active });
          toast(item.is_active ? `Đã khoá key ${item.code}` : `Đã mở key ${item.code}`, 'ok');
          await Promise.all([loadStats(), loadKeys()]);
        } catch (err) {
          toast(err.message, 'err');
        }
      } else if (btn.dataset.keyAct === 'delete') {
        askConfirm('Xoá Key', `Xoá vĩnh viễn key "${item.code}" khỏi hệ thống?`, async () => {
          await rpc('admin_delete_key', { p_key_id: id });
          toast(`Đã xoá key ${item.code}`, 'ok');
          await Promise.all([loadStats(), loadKeys()]);
        });
      }
    });

    // VietQR Orders Search, Filters & Manual Key Issue
    let ordSearchTimer = null;
    $('#ord-search')?.addEventListener('input', (e) => {
      state.ordSearch = e.target.value.trim();
      clearTimeout(ordSearchTimer);
      ordSearchTimer = setTimeout(() => loadOrders().catch((err) => toast(err.message, 'err')), 220);
    });
    $$('[data-ord-filter]').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.ordFilter = chip.dataset.ordFilter;
        $$('[data-ord-filter]').forEach((c) => c.classList.toggle('is-active', c === chip));
        loadOrders().catch((err) => toast(err.message, 'err'));
      });
    });
    $('#ord-reload-btn')?.addEventListener('click', () => loadOrders().catch((err) => toast(err.message, 'err')));
    $('#ord-tbody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ord-act]');
      if (!btn) return;
      const tr = btn.closest('tr');
      const id = tr?.dataset.ordId;
      const ord = state.orders.find((x) => x.id === id);
      if (!ord) return;
      if (btn.dataset.ordAct === 'copy-key' && ord.issued_key_code) {
        copyText(ord.issued_key_code, `Đã copy key ${ord.issued_key_code}`);
      } else if (btn.dataset.ordAct === 'issue') {
        askConfirm(
          'Duyệt đơn & Cấp Key thủ công',
          `Sinh 1 mã Key mới (${ord.plan} · ${ord.is_lifetime ? 'Vĩnh viễn' : `${ord.days || 365} ngày`}) và gắn vào đơn #${ord.order_code} của ${ord.user_email}? (KHÔNG tự kích hoạt vào tài khoản.)`,
          async () => {
            const res = await rpc('admin_issue_order_key', { p_order_id: ord.id, p_note: 'Admin duyệt & cấp Key thủ công' });
            toast(`Đã cấp key ${res?.issued_key_code || ''} cho đơn #${ord.order_code}`, 'ok');
            await Promise.all([loadStats(), loadKeys(), loadOrders()]);
          }
        );
      }
    });

    // Promo Banner Editor & Quick Templates
    ['#prm-enabled', '#prm-theme', '#prm-pages', '#prm-badge-vi', '#prm-code', '#prm-msg-vi', '#prm-cta-vi', '#prm-cta-url', '#prm-ends-at', '#prm-dismissible'].forEach((sel) => {
      $(sel)?.addEventListener('input', updatePromoPreview);
      $(sel)?.addEventListener('change', updatePromoPreview);
    });
    $('#prm-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      savePromo();
    });
    $('#prm-disable-btn')?.addEventListener('click', () => savePromo(false));
    $('#prm-reload-btn')?.addEventListener('click', () => loadPromo().then(() => toast('Đã tải lại cấu hình băng rôn', 'ok')).catch((err) => toast(err.message, 'err')));

    const PROMO_TPLS = {
      lifetime39: {
        enabled: true,
        theme: 'gold',
        pages: 'all',
        badge_vi: 'ƯU ĐÃI',
        badge_en: 'PROMO',
        coupon_code: '',
        message_vi: 'Mở khoá trọn bộ Pro · STU Ultra Vĩnh viễn chỉ 39.000đ — Trả một lần, tự động cấp Key sau 5s!',
        message_en: 'Unlock Pro · STU Ultra Lifetime for just 39,000 VND — One-time payment, instant Key!',
        cta_label_vi: 'Mua ngay →',
        cta_label_en: 'Buy now →',
        cta_url: '/bang-gia/',
        ends_at: null,
        dismissible: true
      },
      year19: {
        enabled: true,
        theme: 'blue',
        pages: 'all',
        badge_vi: 'TIẾT KIỆM',
        badge_en: 'DEAL',
        coupon_code: '',
        message_vi: 'Trải nghiệm trọn bộ 6 mô hình AI Làm đẹp da & STU Ultra gói 1 năm chỉ 19.000đ (không tự gia hạn).',
        message_en: 'Full 6 U-Net Skin AI models & STU Ultra for 1 year at just 19,000 VND (non-recurring).',
        cta_label_vi: 'Xem bảng giá →',
        cta_label_en: 'See pricing →',
        cta_url: '/bang-gia/',
        ends_at: null,
        dismissible: true
      },
      flash: {
        enabled: true,
        theme: 'rose',
        pages: 'all',
        badge_vi: 'FLASH SALE',
        badge_en: 'FLASH SALE',
        coupon_code: 'DEVSTU39K',
        message_vi: 'Giảm sâu gói Pro STU Ultra — Thanh toán VietQR nhận Key riêng ngay lập tức!',
        message_en: 'Limited Flash Sale on Pro STU Ultra — Pay via VietQR for instant Key delivery!',
        cta_label_vi: 'Săn ưu đãi →',
        cta_label_en: 'Claim deal →',
        cta_url: '/bang-gia/',
        ends_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        dismissible: true
      }
    };
    $$('[data-prm-tpl]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tpl = PROMO_TPLS[btn.dataset.prmTpl];
        if (tpl) fillPromoForm(tpl);
      });
    });

    // Bug Reports Filter, Search & Actions
    let bugSearchTimer = null;
    $('#bug-search').addEventListener('input', (e) => {
      state.bugSearch = e.target.value.trim();
      clearTimeout(bugSearchTimer);
      bugSearchTimer = setTimeout(() => loadBugs().catch((err) => toast(err.message, 'err')), 220);
    });

    $$('[data-bug-filter]').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.bugFilter = chip.dataset.bugFilter;
        $$('[data-bug-filter]').forEach((c) => c.classList.toggle('is-active', c === chip));
        loadBugs().catch((err) => toast(err.message, 'err'));
      });
    });

    $('#bug-reload-btn').addEventListener('click', () => loadBugs().catch((err) => toast(err.message, 'err')));

    $('#bug-list').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-bug-act]');
      if (!btn) return;
      const card = btn.closest('[data-bug-id]');
      const id = Number(card?.dataset.bugId);
      const item = state.bugs.find((b) => Number(b.id) === id);
      if (!item) return;

      const act = btn.dataset.bugAct;
      if (act === 'save') {
        const statusSel = card.querySelector('[data-bug-status]');
        const noteIn = card.querySelector('[data-bug-note]');
        try {
          await rpc('admin_update_bug_report', {
            p_id: id,
            p_status: statusSel.value,
            p_admin_note: noteIn.value
          });
          toast(`Đã cập nhật báo lỗi #${id}`, 'ok');
          await Promise.all([loadStats(), loadBugs()]);
        } catch (err) {
          toast(err.message, 'err');
        }
      } else if (act === 'reply-ntc') {
        switchTab('notifications');
        $('input[name="ntc-audience"][value="user"]').checked = true;
        $('#ntc-target-wrap').hidden = false;
        $('#ntc-target-email').value = item.email;
        $('#ntc-title').value = `Phản hồi báo lỗi #${item.id}`;
        $('#ntc-body').focus();
        updateNotificationPreview();
      } else if (act === 'delete') {
        askConfirm('Xoá báo lỗi', `Xoá báo lỗi #${id} từ ${item.email}?`, async () => {
          await rpc('admin_delete_bug_report', { p_id: id });
          toast(`Đã xoá báo lỗi #${id}`, 'ok');
          await Promise.all([loadStats(), loadBugs()]);
        });
      }
    });

    // Dialog Close & Confirm Wiring
    $$('[data-close-dlg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dlg = document.getElementById(btn.dataset.closeDlg);
        if (dlg?.open) dlg.close();
      });
    });
    $('#adm-confirm-cancel').addEventListener('click', () => $('#adm-confirm-dlg').close());
    $('#adm-confirm-ok').addEventListener('click', async () => {
      const fn = state.confirmAction;
      state.confirmAction = null;
      $('#adm-confirm-dlg').close();
      if (!fn) return;
      try {
        await fn();
      } catch (err) {
        toast('Thao tác thất bại: ' + err.message, 'err');
      }
    });
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', async () => {
    state.tab = resolveInitialTab();
    bindEvents();
    updateNotificationPreview();
    updatePromoPreview();
    try {
      await handleOAuthCallbackIfPresent();
    } catch (err) {
      setGateView('login');
      showAuthError(err.message);
      return;
    }
    await bootSession();
  });
})();
