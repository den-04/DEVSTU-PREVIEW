// GET /api/orders/status?code=DEVSTU... — Check order status & return issued Key when paid
const SB_URL = process.env.SUPABASE_URL || 'https://kvdmtofhkzwgoiganirl.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_JSEFSdaGLb3Q-NgLZw6GWA_vW0RGE1k';

function buildBankInfo(orderCode, amount) {
  const bankCode = (process.env.SEPAY_BANK_CODE || '').trim();
  const accountNumber = (process.env.SEPAY_BANK_ACCOUNT || '').trim();
  const accountName = (process.env.SEPAY_ACCOUNT_NAME || 'DEVSTU').trim();
  const configured = Boolean(bankCode && accountNumber);
  const qrUrl = configured
    ? `https://qr.sepay.vn/img?acc=${encodeURIComponent(accountNumber)}&bank=${encodeURIComponent(bankCode)}&amount=${encodeURIComponent(String(amount))}&des=${encodeURIComponent(orderCode)}&template=compact`
    : '';
  return { bankCode, accountNumber, accountName, qrUrl, configured };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const code = String(req.query?.code || '').trim().toUpperCase();

  try {
    const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/user_list_my_orders`, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_limit: 50 })
    });

    const text = await rpcRes.text();
    let list = [];
    try { list = text ? JSON.parse(text) : []; } catch {}

    if (!rpcRes.ok) {
      return res.status(rpcRes.status === 401 ? 401 : 400).json({
        ok: false,
        error: list?.message || list?.hint || text || `HTTP ${rpcRes.status}`,
        code: list?.code || ''
      });
    }

    const orders = Array.isArray(list) ? list : [];
    if (code) {
      const found = orders.find((o) => String(o.order_code || '').toUpperCase() === code) || null;
      if (!found) return res.status(404).json({ ok: false, error: 'Order not found' });
      return res.status(200).json({ ok: true, order: found, bank: buildBankInfo(found.order_code, found.amount) });
    }

    return res.status(200).json({ ok: true, orders });
  } catch (err) {
    console.error('[orders/status]', err);
    return res.status(500).json({ ok: false, error: 'Lỗi kiểm tra trạng thái đơn hàng.' });
  }
}
