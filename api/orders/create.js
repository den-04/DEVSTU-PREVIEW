// POST /api/orders/create — Create (or reuse active) VietQR payment order for logged-in Supabase user
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
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Vui lòng đăng nhập trước khi tạo đơn hàng.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const plan = String(body?.plan || 'Pro STU Ultra').trim();
  const period = String(body?.period || 'lifetime').trim().toLowerCase();

  try {
    const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/user_create_payment_order`, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_plan: plan, p_period: period })
    });

    const text = await rpcRes.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}

    if (!rpcRes.ok) {
      const msg = data?.message || data?.hint || text || `HTTP ${rpcRes.status}`;
      return res.status(rpcRes.status === 401 ? 401 : 400).json({ ok: false, error: msg, code: data?.code || '' });
    }

    const bank = buildBankInfo(data.order_code, data.amount);
    return res.status(200).json({ ok: true, order: data, bank });
  } catch (err) {
    console.error('[orders/create]', err);
    return res.status(500).json({ ok: false, error: 'Không thể khởi tạo đơn hàng, vui lòng thử lại.' });
  }
}
