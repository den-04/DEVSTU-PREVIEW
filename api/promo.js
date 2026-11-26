// GET & POST /api/promo — Dynamic Promo Banner under Header, managed via /admin/promo
const SB_URL = process.env.SUPABASE_URL || 'https://kvdmtofhkzwgoiganirl.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_JSEFSdaGLb3Q-NgLZw6GWA_vW0RGE1k';
const BUCKET = 'site-config';
const OBJECT_PATH = 'promo-banner.json';

const VALID_THEMES = new Set(['gold', 'blue', 'emerald', 'rose', 'violet']);
const VALID_PAGES = new Set(['all', 'home_pricing']);
const VALID_EFFECTS = new Set(['shimmer', 'aurora', 'marquee', 'pulse', 'none']);

const DEFAULT_PROMO = {
  enabled: false,
  theme: 'gold',
  effect: 'shimmer',
  pages: 'all',
  badge_vi: 'ƯU ĐÃI',
  badge_en: 'PROMO',
  message_vi: '',
  message_en: '',
  coupon_code: '',
  cta_label_vi: 'Mua ngay →',
  cta_label_en: 'Buy now →',
  cta_url: '/bang-gia/',
  ends_at: null,
  dismissible: true,
  updated_at: null
};

function sanitizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return s.slice(0, 240);
  if (/^https?:\/\//i.test(s)) return s.slice(0, 300);
  return '/bang-gia/';
}

function sanitizeIso(raw) {
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function sanitizePromo(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const theme = VALID_THEMES.has(r.theme) ? r.theme : 'gold';
  const pages = VALID_PAGES.has(r.pages) ? r.pages : 'all';
  const effect = VALID_EFFECTS.has(r.effect) ? r.effect : 'shimmer';
  return {
    enabled: Boolean(r.enabled),
    theme,
    effect,
    pages,
    badge_vi: String(r.badge_vi ?? '').trim().slice(0, 32),
    badge_en: String(r.badge_en ?? '').trim().slice(0, 32),
    message_vi: String(r.message_vi ?? '').trim().slice(0, 320),
    message_en: String(r.message_en ?? '').trim().slice(0, 320),
    coupon_code: String(r.coupon_code ?? '').trim().slice(0, 40),
    cta_label_vi: String(r.cta_label_vi ?? '').trim().slice(0, 40),
    cta_label_en: String(r.cta_label_en ?? '').trim().slice(0, 40),
    cta_url: sanitizeUrl(r.cta_url),
    ends_at: sanitizeIso(r.ends_at),
    dismissible: r.dismissible !== false,
    updated_at: sanitizeIso(r.updated_at)
  };
}

async function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/admin_who_am_i`, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: authHeader,
        'Content-Type': 'application/json'
      },
      body: '{}',
      cache: 'no-store'
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.authenticated && data?.is_admin);
  } catch {
    return false;
  }
}

async function readPromoConfig(serviceKey) {
  // 1. Optional table public.promo_banners
  try {
    const dbRes = await fetch(`${SB_URL}/rest/v1/promo_banners?id=eq.1&select=*`, {
      headers: {
        apikey: serviceKey || SB_ANON,
        ...(serviceKey ? { Authorization: `Bearer ${serviceKey}` } : {})
      },
      cache: 'no-store'
    });
    if (dbRes.ok) {
      const rows = await dbRes.json();
      if (Array.isArray(rows) && rows.length > 0) {
        return sanitizePromo(rows[0]);
      }
    }
  } catch {}

  // 2. Supabase Storage JSON object (zero-SQL persistence)
  try {
    const stUrl = serviceKey
      ? `${SB_URL}/storage/v1/object/${BUCKET}/${OBJECT_PATH}`
      : `${SB_URL}/storage/v1/object/public/${BUCKET}/${OBJECT_PATH}?t=${Date.now()}`;
    const stRes = await fetch(stUrl, {
      headers: serviceKey ? { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } : {},
      cache: 'no-store'
    });
    if (stRes.ok) {
      const parsed = await stRes.json();
      return sanitizePromo(parsed);
    }
  } catch {}

  return { ...DEFAULT_PROMO };
}

async function writePromoConfig(config, serviceKey) {
  if (!serviceKey) {
    throw new Error('Thiếu biến SUPABASE_SERVICE_ROLE_KEY trên Vercel.');
  }

  let dbSaved = false;
  let lastErr = '';

  // 1. Upsert into public.promo_banners if table exists
  try {
    const dbRes = await fetch(`${SB_URL}/rest/v1/promo_banners?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify({ id: 1, ...config })
    });
    if (dbRes.ok) dbSaved = true;
    else lastErr = await dbRes.text();
  } catch (e) {
    lastErr = String(e?.message || e);
  }

  // 2. Ensure public bucket + upsert site-config/promo-banner.json (zero-SQL guaranteed persistence)
  let storageSaved = false;
  try {
    await fetch(`${SB_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true })
    }).catch(() => {});

    const upRes = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${OBJECT_PATH}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
        'Cache-Control': 'max-age=0'
      },
      body: JSON.stringify(config)
    });
    if (upRes.ok) storageSaved = true;
    else lastErr = await upRes.text();
  } catch (e) {
    lastErr = String(e?.message || e);
  }

  if (!dbSaved && !storageSaved) {
    throw new Error(lastErr || 'Không thể lưu cấu hình băng rôn.');
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (req.method === 'GET') {
    const isAdminReq = req.query?.admin === '1';
    if (isAdminReq) {
      res.setHeader('Cache-Control', 'no-store');
      const ok = await verifyAdmin(req.headers.authorization || '');
      if (!ok) return res.status(403).json({ ok: false, error: 'Chỉ Admin mới có quyền xem cấu hình.' });
      const config = await readPromoConfig(serviceKey);
      return res.status(200).json({ ok: true, config });
    }

    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=5, stale-while-revalidate=20');
    const config = await readPromoConfig(serviceKey);
    const expired = Boolean(config.ends_at && new Date(config.ends_at).getTime() <= Date.now());
    const active = Boolean(config.enabled && config.message_vi && !expired);
    return res.status(200).json({ ok: true, active, promo: active ? config : null });
  }

  if (req.method === 'POST') {
    res.setHeader('Cache-Control', 'no-store');
    const ok = await verifyAdmin(req.headers.authorization || '');
    if (!ok) return res.status(403).json({ ok: false, error: 'Chỉ Admin mới có quyền chỉnh băng rôn khuyến mãi.' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const config = sanitizePromo({
      ...(body && typeof body === 'object' ? body : {}),
      updated_at: new Date().toISOString()
    });

    if (config.enabled && !config.message_vi) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập nội dung khuyến mãi trước khi bật.' });
    }

    try {
      await writePromoConfig(config, serviceKey);
      return res.status(200).json({ ok: true, config });
    } catch (err) {
      console.error('[api/promo] save error:', err);
      return res.status(500).json({ ok: false, error: err?.message || 'Lỗi lưu băng rôn khuyến mãi.' });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
