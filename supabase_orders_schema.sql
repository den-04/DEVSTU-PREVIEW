-- ============================================================================
-- DEVSTU · VietQR Auto-Payment Orders & Auto-Issue Key Schema
-- Chạy 1 lần trong Supabase Dashboard -> SQL Editor
-- Luồng: User login web -> tạo đơn VietQR -> Webhook SePay nhận tiền ->
--        Tự động sinh 1 Key mới trong public.premium_keys và lưu vào đơn
--        (KHÔNG tự kích hoạt vào profiles.is_premium).
--        User xem lại lịch sử đơn & copy Key bất cứ lúc nào trên /bang-gia/.
-- ============================================================================

create table if not exists public.payment_orders (
  id uuid default gen_random_uuid() primary key,
  order_code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  plan text not null default 'Pro STU Ultra',
  period text not null check (period in ('year', 'lifetime')),
  days integer,
  is_lifetime boolean not null default false,
  amount integer not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'manual_review', 'expired', 'failed')),
  issued_key_id uuid references public.premium_keys(id) on delete set null,
  issued_key_code text,
  payment_gateway text not null default 'sepay',
  tx_id text unique,
  tx_amount integer,
  tx_content text,
  admin_note text,
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_orders_user_created_idx
  on public.payment_orders (user_id, created_at desc);

create index if not exists payment_orders_status_created_idx
  on public.payment_orders (status, created_at desc);

alter table public.payment_orders enable row level security;

-- User chỉ được xem đơn hàng của chính mình; KHÔNG được tự insert/update/delete trực tiếp
drop policy if exists "Users can view own payment orders" on public.payment_orders;
create policy "Users can view own payment orders"
  on public.payment_orders for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on table public.payment_orders from anon, authenticated;
grant select on table public.payment_orders to authenticated;

-- Helper sinh mã đơn hàng chỉ gồm chữ in hoa + số (mọi ngân hàng VN giữ nguyên 100%)
create or replace function public._gen_order_code()
returns text
language plpgsql
as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := 'DEVSTU';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.payment_orders where order_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Helper sinh mã Key Premium duy nhất (DEVSTU-XXXX-XXXX)
create or replace function public._gen_premium_key_code(p_prefix text default 'DEVSTU')
returns text
language plpgsql
as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_pre text := coalesce(nullif(upper(regexp_replace(coalesce(p_prefix, ''), '[^A-Za-z0-9]', '', 'g')), ''), 'DEVSTU');
  v_p1 text;
  v_p2 text;
  v_code text;
  i integer;
begin
  loop
    v_p1 := '';
    v_p2 := '';
    for i in 1..4 loop
      v_p1 := v_p1 || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
      v_p2 := v_p2 || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    v_code := left(v_pre, 10) || '-' || v_p1 || '-' || v_p2;
    exit when not exists (
      select 1 from public.premium_keys
      where upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(v_code, '[^A-Za-z0-9]', '', 'g'))
    );
  end loop;
  return v_code;
end;
$$;

-- 1. User tạo đơn hàng mới (giá được chốt cứng phía server, không tin giá từ trình duyệt)
create or replace function public.user_create_payment_order(
  p_plan text default 'Pro STU Ultra',
  p_period text default 'lifetime'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_plan text := coalesce(nullif(trim(p_plan), ''), 'Pro STU Ultra');
  v_period text := lower(trim(coalesce(p_period, 'lifetime')));
  v_amount integer;
  v_days integer;
  v_life boolean;
  v_existing public.payment_orders%rowtype;
  v_row public.payment_orders%rowtype;
  v_code text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from public.profiles where id = v_uid and coalesce(is_banned, false) = true) then
    raise exception 'account_banned';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null or v_email = '' then
    raise exception 'email_missing';
  end if;

  if v_period not in ('year', 'lifetime') then
    raise exception 'invalid_period';
  end if;

  -- Bảng giá chính thức khớp với /bang-gia/
  if v_plan = 'Pro STU Ultra' then
    if v_period = 'year' then
      v_amount := 19000;
      v_days := 365;
      v_life := false;
    else
      v_amount := 39000;
      v_days := null;
      v_life := true;
    end if;
  elsif v_plan = 'Studio Max' then
    if v_period = 'year' then
      v_amount := 999000;
      v_days := 365;
      v_life := false;
    else
      v_amount := 1799000;
      v_days := null;
      v_life := true;
    end if;
  else
    raise exception 'invalid_plan';
  end if;

  -- Đánh dấu hết hạn các đơn pending cũ quá hạn của user
  update public.payment_orders
  set status = 'expired', updated_at = now()
  where user_id = v_uid
    and status = 'pending'
    and expires_at <= now();

  -- Tái sử dụng đơn pending còn hạn (> 3 phút) cùng gói & kỳ hạn để tránh spam đơn
  select * into v_existing
  from public.payment_orders
  where user_id = v_uid
    and plan = v_plan
    and period = v_period
    and amount = v_amount
    and status = 'pending'
    and expires_at > (now() + interval '3 minutes')
  order by created_at desc
  limit 1;

  if found then
    return to_jsonb(v_existing);
  end if;

  v_code := public._gen_order_code();

  insert into public.payment_orders (
    order_code, user_id, user_email, plan, period, days, is_lifetime, amount,
    status, expires_at
  )
  values (
    v_code, v_uid, lower(v_email), v_plan, v_period, v_days, v_life, v_amount,
    'pending', now() + interval '20 minutes'
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.user_create_payment_order(text, text) from public;
grant execute on function public.user_create_payment_order(text, text) to authenticated;

-- 2. User xem lịch sử đơn hàng & danh sách Key đã mua (kèm trạng thái đã nhập app hay chưa)
create or replace function public.user_list_my_orders(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_items jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Tự cập nhật trạng thái expired cho đơn pending quá hạn
  update public.payment_orders
  set status = 'expired', updated_at = now()
  where user_id = v_uid
    and status = 'pending'
    and expires_at <= now();

  select coalesce(jsonb_agg(row_data order by row_created desc), '[]'::jsonb)
  into v_items
  from (
    select
      o.created_at as row_created,
      jsonb_build_object(
        'id', o.id,
        'order_code', o.order_code,
        'plan', o.plan,
        'period', o.period,
        'days', o.days,
        'is_lifetime', o.is_lifetime,
        'amount', o.amount,
        'status', o.status,
        'issued_key_code', o.issued_key_code,
        'key_used_count', coalesce(k.used_count, 0),
        'key_max_uses', coalesce(k.max_uses, 1),
        'key_is_active', coalesce(k.is_active, true),
        'tx_amount', o.tx_amount,
        'admin_note', o.admin_note,
        'expires_at', o.expires_at,
        'paid_at', o.paid_at,
        'created_at', o.created_at
      ) as row_data
    from public.payment_orders o
    left join public.premium_keys k on k.id = o.issued_key_id
    where o.user_id = v_uid
    order by o.created_at desc
    limit v_lim
  ) sub;

  return v_items;
end;
$$;

revoke all on function public.user_list_my_orders(integer) from public;
grant execute on function public.user_list_my_orders(integer) to authenticated;

-- 3. Webhook phía server (CHỈ service_role được gọi) xử lý tiền về -> Sinh Key mới, KHÔNG tự active
create or replace function public.fulfill_payment_order(
  p_order_code text,
  p_tx_id text,
  p_tx_amount integer,
  p_tx_content text default '',
  p_gateway text default 'sepay'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_order_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_tx text := nullif(trim(coalesce(p_tx_id, '')), '');
  v_order public.payment_orders%rowtype;
  v_existing_tx public.payment_orders%rowtype;
  v_key public.premium_keys%rowtype;
  v_key_code text;
  v_now timestamptz := now();
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty_order_code');
  end if;

  -- Chống xử lý lặp theo mã giao dịch ngân hàng (idempotency)
  if v_tx is not null then
    select * into v_existing_tx
    from public.payment_orders
    where tx_id = v_tx
    limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'order_code', v_existing_tx.order_code,
        'status', v_existing_tx.status,
        'issued_key_code', v_existing_tx.issued_key_code
      );
    end if;
  end if;

  select * into v_order
  from public.payment_orders
  where upper(order_code) = v_code
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found', 'order_code', v_code);
  end if;

  -- Nếu đơn đã thanh toán & đã cấp key rồi -> trả lại key cũ, không sinh thêm
  if v_order.status = 'paid' and v_order.issued_key_code is not null then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'order_code', v_order.order_code,
      'status', 'paid',
      'issued_key_code', v_order.issued_key_code
    );
  end if;

  -- Nếu chuyển thiếu tiền -> đưa vào manual_review để Admin kiểm tra & cấp key thủ công
  if coalesce(p_tx_amount, 0) < v_order.amount then
    update public.payment_orders
    set status = 'manual_review',
        tx_id = coalesce(v_tx, tx_id),
        tx_amount = coalesce(p_tx_amount, 0),
        tx_content = left(coalesce(p_tx_content, ''), 400),
        payment_gateway = coalesce(nullif(trim(p_gateway), ''), 'sepay'),
        admin_note = 'Chuyển thiếu tiền: nhận ' || coalesce(p_tx_amount, 0) || 'đ / cần ' || v_order.amount || 'đ',
        updated_at = v_now
    where id = v_order.id;

    return jsonb_build_object(
      'ok', true,
      'status', 'manual_review',
      'reason', 'underpaid',
      'order_code', v_order.order_code
    );
  end if;

  -- Thanh toán đủ (chấp nhận cả trường hợp khách chuyển trễ sau khi đơn expired) -> Tự sinh Key mới!
  v_key_code := public._gen_premium_key_code('DEVSTU');

  insert into public.premium_keys (code, plan, days, is_lifetime, max_uses, is_active, note)
  values (
    v_key_code,
    v_order.plan,
    v_order.days,
    v_order.is_lifetime,
    1,
    true,
    'Auto QR #' || v_order.order_code || ' · ' || v_order.user_email
  )
  returning * into v_key;

  update public.payment_orders
  set status = 'paid',
      issued_key_id = v_key.id,
      issued_key_code = v_key.code,
      tx_id = coalesce(v_tx, tx_id),
      tx_amount = p_tx_amount,
      tx_content = left(coalesce(p_tx_content, ''), 400),
      payment_gateway = coalesce(nullif(trim(p_gateway), ''), 'sepay'),
      paid_at = v_now,
      updated_at = v_now
  where id = v_order.id;

  -- Gửi thông báo riêng kèm mã Key vào tài khoản của khách (tùy chọn, không lỗi nếu thiếu bảng)
  begin
    insert into public.notifications (title, body, audience, target_user_id, target_email, link_url, link_label, is_active)
    values (
      'Thanh toán thành công · Đơn #' || v_order.order_code,
      'Mã Key kích hoạt gói ' || v_order.plan || ' của bạn là: ' || v_key.code || '. Hãy sao chép và nhập mã này trong ứng dụng DEVSTU Desktop để kích hoạt.',
      'user',
      v_order.user_id,
      v_order.user_email,
      'https://devstu.vercel.app/bang-gia/#lich-su-don',
      'Xem kho Key',
      true
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'status', 'paid',
    'order_code', v_order.order_code,
    'issued_key_code', v_key.code
  );
end;
$$;

revoke all on function public.fulfill_payment_order(text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.fulfill_payment_order(text, text, integer, text, text) to service_role;

-- 4. Admin RPC: Liệt kê đơn hàng & doanh thu cho /admin/
create or replace function public.admin_list_orders(
  p_search text default '',
  p_status text default 'all',
  p_limit integer default 150
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_q text := trim(coalesce(p_search, ''));
  v_st text := coalesce(nullif(trim(p_status), ''), 'all');
  v_lim integer := greatest(1, least(coalesce(p_limit, 150), 300));
  v_items jsonb;
  v_stats jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden_admin_only';
  end if;

  update public.payment_orders
  set status = 'expired', updated_at = now()
  where status = 'pending' and expires_at <= now();

  select jsonb_build_object(
    'total_orders', (select count(*) from public.payment_orders),
    'paid_orders', (select count(*) from public.payment_orders where status = 'paid'),
    'pending_orders', (select count(*) from public.payment_orders where status = 'pending'),
    'review_orders', (select count(*) from public.payment_orders where status = 'manual_review'),
    'total_revenue', coalesce((select sum(coalesce(tx_amount, amount)) from public.payment_orders where status = 'paid'), 0)
  ) into v_stats;

  select coalesce(jsonb_agg(row_data order by row_created desc), '[]'::jsonb)
  into v_items
  from (
    select
      o.created_at as row_created,
      jsonb_build_object(
        'id', o.id,
        'order_code', o.order_code,
        'user_id', o.user_id,
        'user_email', o.user_email,
        'plan', o.plan,
        'period', o.period,
        'days', o.days,
        'is_lifetime', o.is_lifetime,
        'amount', o.amount,
        'status', o.status,
        'issued_key_code', o.issued_key_code,
        'key_used_count', coalesce(k.used_count, 0),
        'key_max_uses', coalesce(k.max_uses, 1),
        'tx_id', o.tx_id,
        'tx_amount', o.tx_amount,
        'tx_content', o.tx_content,
        'admin_note', o.admin_note,
        'expires_at', o.expires_at,
        'paid_at', o.paid_at,
        'created_at', o.created_at
      ) as row_data
    from public.payment_orders o
    left join public.premium_keys k on k.id = o.issued_key_id
    where (v_st = 'all' or o.status = v_st)
      and (
        v_q = ''
        or o.order_code ilike '%' || v_q || '%'
        or o.user_email ilike '%' || v_q || '%'
        or coalesce(o.issued_key_code, '') ilike '%' || v_q || '%'
        or coalesce(o.tx_id, '') ilike '%' || v_q || '%'
      )
    order by o.created_at desc
    limit v_lim
  ) sub;

  return jsonb_build_object('stats', v_stats, 'items', v_items);
end;
$$;

revoke all on function public.admin_list_orders(text, text, integer) from public;
grant execute on function public.admin_list_orders(text, text, integer) to authenticated;

-- 5. Admin RPC: Duyệt tay & Cấp Key khi khách gặp lỗi chuyển khoản (chuyển sai nội dung / thiếu / mạng lỗi)
create or replace function public.admin_issue_order_key(
  p_order_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_order public.payment_orders%rowtype;
  v_key public.premium_keys%rowtype;
  v_key_code text;
  v_now timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'forbidden_admin_only';
  end if;

  select * into v_order from public.payment_orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status = 'paid' and v_order.issued_key_code is not null then
    return jsonb_build_object('ok', true, 'already_issued', true, 'issued_key_code', v_order.issued_key_code);
  end if;

  v_key_code := public._gen_premium_key_code('DEVSTU');

  insert into public.premium_keys (code, plan, days, is_lifetime, max_uses, is_active, note)
  values (
    v_key_code,
    v_order.plan,
    v_order.days,
    v_order.is_lifetime,
    1,
    true,
    'Admin duyệt đơn #' || v_order.order_code || ' · ' || v_order.user_email
  )
  returning * into v_key;

  update public.payment_orders
  set status = 'paid',
      issued_key_id = v_key.id,
      issued_key_code = v_key.code,
      tx_amount = coalesce(tx_amount, v_order.amount),
      admin_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), admin_note, 'Admin duyệt & cấp Key thủ công'),
      paid_at = v_now,
      updated_at = v_now
  where id = v_order.id;

  begin
    insert into public.notifications (title, body, audience, target_user_id, target_email, link_url, link_label, is_active)
    values (
      'Đơn #' || v_order.order_code || ' đã được cấp Key',
      'Mã Key kích hoạt gói ' || v_order.plan || ' của bạn là: ' || v_key.code || '. Hãy copy và nhập trong ứng dụng DEVSTU.',
      'user',
      v_order.user_id,
      v_order.user_email,
      'https://devstu.vercel.app/bang-gia/#lich-su-don',
      'Xem kho Key',
      true
    );
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'order_code', v_order.order_code, 'issued_key_code', v_key.code);
end;
$$;

revoke all on function public.admin_issue_order_key(uuid, text) from public;
grant execute on function public.admin_issue_order_key(uuid, text) to authenticated;

-- 6. Admin RPC: Cập nhật trạng thái / ghi chú đơn hàng
create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.payment_orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden_admin_only';
  end if;
  if p_status not in ('pending', 'manual_review', 'expired', 'failed') then
    raise exception 'invalid_status';
  end if;

  update public.payment_orders
  set status = p_status,
      admin_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), admin_note),
      updated_at = now()
  where id = p_order_id
  returning * into v_row;

  if not found then
    raise exception 'order_not_found';
  end if;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.admin_update_order_status(uuid, text, text) from public;
grant execute on function public.admin_update_order_status(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
