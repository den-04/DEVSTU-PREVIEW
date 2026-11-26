// POST /api/orders/cancel — Cancel a user's own pending VietQR payment order
const SB_URL = process.env.SUPABASE_URL || 'https://kvdmtofhkzwgoiganirl.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_JSEFSdaGLb3Q-NgLZw6GWA_vW0RGE1k';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Vui lòng đăng nhập.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const code = String(body?.code || '').trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ ok: false, error: 'Thiếu mã đơn hàng.' });
  }

  try {
    const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/user_cancel_payment_order`, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_order_code: code })
    });

    const text = await rpcRes.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}

    if (!rpcRes.ok) {
      const msg = data?.message || data?.hint || text || `HTTP ${rpcRes.status}`;
      return res.status(rpcRes.status === 401 ? 401 : 400).json({ ok: false, error: msg, code: data?.code || '' });
    }

    return res.status(200).json({ ok: true, order: data });
  } catch (err) {
    console.error('[orders/cancel]', err);
    return res.status(500).json({ ok: false, error: 'Không thể hủy đơn hàng, vui lòng thử lại.' });
  }
}
