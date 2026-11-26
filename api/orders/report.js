// POST /api/orders/report — Report an issue on a user's own VietQR payment order
// Flags unpaid orders as 'manual_review' (never downgrades 'paid' orders, never auto-activates profiles.is_premium)
// and creates a structured support ticket in public.bug_reports for Admin Console (/admin/#orders & /admin/#bugs).

const SB_URL = process.env.SUPABASE_URL || 'https://kvdmtofhkzwgoiganirl.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_JSEFSdaGLb3Q-NgLZw6GWA_vW0RGE1k';

const CATEGORY_LABELS = {
  paid_no_key: 'Đã chuyển khoản nhưng chưa nhận Key',
  wrong_memo: 'Chuyển nhầm / thiếu nội dung CK',
  wrong_amount: 'Chuyển nhầm số tiền',
  key_issue: 'Lỗi kích hoạt mã Key',
  other: 'Vấn đề khác'
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Vui lòng đăng nhập trước khi gửi báo lỗi.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const code = String(body?.code || '').trim().toUpperCase();
  if (!/^DEVSTU[A-Z0-9]{4,12}$/.test(code)) {
    return res.status(400).json({ ok: false, error: 'Mã đơn hàng không hợp lệ.' });
  }

  const rawCat = String(body?.category || 'other').trim();
  const category = Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, rawCat) ? rawCat : 'other';
  const categoryLabel = CATEGORY_LABELS[category];

  const txRef = String(body?.txRef || '').trim().slice(0, 80);
  const rawAmt = Math.round(Number(body?.transferredAmount || 0));
  const transferredAmount = Number.isFinite(rawAmt) && rawAmt > 0 ? rawAmt : null;
  const message = String(body?.message || '').trim().slice(0, 1500);
  const lang = body?.lang === 'en' ? 'en' : 'vi';

  if (message.length < 5) {
    return res.status(400).json({ ok: false, error: 'Vui lòng nhập mô tả chi tiết (ít nhất 5 ký tự).' });
  }

  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  try {
    // 1. Verify authenticated user via Supabase Auth
    const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: SB_ANON,
        Authorization: authHeader
      }
    });
    if (!userRes.ok) {
      return res.status(401).json({ ok: false, error: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.' });
    }
    const user = await userRes.json();
    if (!user?.id) {
      return res.status(401).json({ ok: false, error: 'Không xác thực được tài khoản.' });
    }

    // 2. Verify order belongs strictly to this user
    let order = null;
    if (serviceRoleKey) {
      const ordRes = await fetch(
        `${SB_URL}/rest/v1/payment_orders?order_code=eq.${encodeURIComponent(code)}&user_id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`
          }
        }
      );
      if (ordRes.ok) {
        const rows = await ordRes.json();
        order = Array.isArray(rows) ? rows[0] || null : null;
      }
    } else {
      const listRes = await fetch(`${SB_URL}/rest/v1/rpc/user_list_my_orders`, {
        method: 'POST',
        headers: {
          apikey: SB_ANON,
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_limit: 50 })
      });
      if (listRes.ok) {
        const rows = await listRes.json();
        if (Array.isArray(rows)) {
          order = rows.find((r) => String(r.order_code || '').toUpperCase() === code) || null;
        }
      }
    }

    if (!order) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy đơn hàng này trong tài khoản của bạn.' });
    }

    // 3. Build structured customer report note
    const parts = [`[KH báo lỗi · ${categoryLabel}] ${message}`];
    if (txRef) parts.push(`Mã GD: ${txRef}`);
    if (transferredAmount) parts.push(`Đã CK: ${transferredAmount.toLocaleString('vi-VN')} đ`);
    const noteStr = parts.join(' | ').slice(0, 500);

    const nextStatus = order.status === 'paid' ? 'paid' : 'manual_review';

    // 4. Update payment_orders via service_role (never downgrades 'paid', never touches profiles.is_premium)
    if (serviceRoleKey && order.id) {
      const patchPayload = {
        admin_note: noteStr,
        updated_at: new Date().toISOString()
      };
      if (order.status !== 'paid') {
        patchPayload.status = 'manual_review';
      }
      const patchRes = await fetch(`${SB_URL}/rest/v1/payment_orders?id=eq.${encodeURIComponent(order.id)}`, {
        method: 'PATCH',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(patchPayload)
      });
      if (!patchRes.ok) {
        const errTxt = await patchRes.text();
        console.error('[orders/report] PATCH payment_orders failed:', patchRes.status, errTxt);
      }
    }

    // 5. Also create a ticket in public.bug_reports so Admin sees it in /admin/#bugs too
    try {
      const periodTxt = order.is_lifetime ? 'Vĩnh viễn' : `${order.days || 365} ngày`;
      await fetch(`${SB_URL}/rest/v1/rpc/submit_bug_report`, {
        method: 'POST',
        headers: {
          apikey: SB_ANON,
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_email: user.email || order.user_email || 'unknown@devstu.app',
          p_message: `[Đơn #${order.order_code}] ${categoryLabel}: ${message}`,
          p_lang: lang,
          p_device_info: {
            'Loại': 'Báo lỗi đơn VietQR',
            'Mã đơn': order.order_code,
            'Gói': `${order.plan} (${periodTxt})`,
            'Số tiền đơn': `${Number(order.amount || 0).toLocaleString('vi-VN')} đ`,
            'Khách báo đã CK': transferredAmount ? `${transferredAmount.toLocaleString('vi-VN')} đ` : '—',
            'Mã GD NH': txRef || '—',
            'Trạng thái đơn': nextStatus,
            'Key đã cấp': order.issued_key_code || 'Chưa cấp'
          },
          p_error_log: ''
        })
      });
    } catch (bugErr) {
      console.warn('[orders/report] submit_bug_report non-fatal warning:', bugErr);
    }

    return res.status(200).json({
      ok: true,
      status: nextStatus,
      admin_note: noteStr
    });
  } catch (err) {
    console.error('[orders/report]', err);
    return res.status(500).json({ ok: false, error: 'Không thể gửi báo lỗi lúc này, vui lòng thử lại.' });
  }
}
