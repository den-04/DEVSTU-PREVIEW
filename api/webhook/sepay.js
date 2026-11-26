// POST /api/webhook/sepay — SePay VietQR Webhook -> Automatically issue a DEVSTU Key (NO auto-activation)
import crypto from 'crypto';

const SB_URL = process.env.SUPABASE_URL || 'https://kvdmtofhkzwgoiganirl.supabase.co';

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifyWebhookAuth(req, secret) {
  const raw = String(req.headers.authorization || req.headers['x-sepay-secret'] || '').trim();
  if (!raw) return false;
  const token = raw.replace(/^(Apikey|Bearer)\s+/i, '').trim();
  return safeEqual(token, secret);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const webhookSecret = (process.env.SEPAY_WEBHOOK_SECRET || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!webhookSecret || !serviceRoleKey) {
    console.error('[webhook/sepay] Missing SEPAY_WEBHOOK_SECRET or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ success: false, message: 'Server webhook not configured' });
  }

  if (!verifyWebhookAuth(req, webhookSecret)) {
    return res.status(401).json({ success: false, message: 'Unauthorized webhook' });
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  payload = payload || {};

  // SePay sends transferType = 'in' for incoming transfers
  if (payload.transferType && String(payload.transferType).toLowerCase() !== 'in') {
    return res.status(200).json({ success: true, ignored: 'outgoing_transfer' });
  }

  const content = String(payload.content || payload.description || '');
  const explicitCode = String(payload.code || '');
  const match = (explicitCode + ' ' + content).toUpperCase().match(/DEVSTU[A-Z0-9]{5,10}/);
  if (!match) {
    return res.status(200).json({ success: true, ignored: 'no_devstu_order_code' });
  }

  const orderCode = match[0];
  const txAmount = Math.round(Number(payload.transferAmount || payload.amount || 0));
  const txId = String(payload.referenceCode || payload.id || `sepay_${Date.now()}`);

  try {
    const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/fulfill_payment_order`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_order_code: orderCode,
        p_tx_id: txId,
        p_tx_amount: txAmount,
        p_tx_content: content.slice(0, 400),
        p_gateway: 'sepay'
      })
    });

    const text = await rpcRes.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch {}

    if (!rpcRes.ok) {
      console.error('[webhook/sepay] RPC failed:', rpcRes.status, text);
      return res.status(500).json({ success: false, message: result?.message || 'Fulfillment failed' });
    }

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[webhook/sepay] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
}
