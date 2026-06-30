-- 049_secure_vault_encrypted.sql
--
-- Server-side encrypted store for per-customer access codes (key codes,
-- alarm codes, gate codes, access notes). Replaces the device-only
-- localStorage SecureVault, which leaked codes to anyone with the same
-- browser session and produced no audit trail.
--
-- Architecture:
--   • One master key lives in Supabase Vault (vault.secrets), generated
--     once at migration time. It never leaves the database.
--   • customer_vault holds bytea ciphertext columns per field, encrypted
--     with pgp_sym_encrypt (pgcrypto, already installed).
--   • Only two SECURITY DEFINER RPCs are exposed: vault_read + vault_write.
--     Both verify the caller owns the customer before touching the row,
--     and both write an audit_log entry — so we know who looked at what,
--     when.
--   • The table has RLS enabled with NO policies — direct access from
--     authenticated clients is impossible. Service role can still touch
--     it for ops, and that access is logged at the Supabase platform layer.
--
-- Key rotation: replace the secret value with a new key and re-encrypt
-- the table in batches. Not implemented yet — when we need it, write a
-- one-off migration that decrypts with the old key (still in vault under
-- a different name) and re-encrypts.

create extension if not exists pgcrypto with schema extensions;

-- ── Master key (one-time generation) ────────────────────────────────────────
-- vault.create_secret returns the secret's UUID. We don't reference it by
-- ID — the RPCs look up by name to keep the rotation story simple. The
-- key is 64 hex chars = 32 random bytes.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'customer_vault_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'customer_vault_key',
      'AES-256 master key for customer_vault. Rotate by adding a new secret and re-encrypting the table.'
    );
  end if;
end$$;

-- ── Storage table ───────────────────────────────────────────────────────────
create table if not exists public.customer_vault (
  customer_id   uuid primary key references public.customers(id) on delete cascade,
  owner_id      uuid not null,
  key_code      bytea,
  alarm_code    bytea,
  gate_code     bytea,
  access_notes  bytea,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);

alter table public.customer_vault enable row level security;
-- Intentionally NO policies. All access flows through vault_read / vault_write.
-- Service role still has full access (bypasses RLS), which is fine — that's
-- a controlled key.

-- Revoke direct access for the API roles. The RPCs run as SECURITY DEFINER
-- and therefore don't need the caller to have any privileges on the table.
revoke all on public.customer_vault from anon, authenticated;

-- ── Read RPC ────────────────────────────────────────────────────────────────
-- Returns null fields when the row doesn't exist (first call for a customer)
-- so the client can render an empty form without a separate existence check.
create or replace function public.vault_read(p_customer_id uuid)
returns table(
  key_code      text,
  alarm_code    text,
  gate_code     text,
  access_notes  text
)
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_key   text;
begin
  if v_owner is null then
    raise exception 'vault_read: not authenticated' using errcode = '42501';
  end if;

  -- Authorisation: the caller must own this customer. RLS on customers
  -- would also enforce this, but checking here lets us return a clean
  -- error message and avoids surprising NULL returns.
  if not exists (
    select 1 from public.customers where id = p_customer_id and owner_id = v_owner
  ) then
    raise exception 'vault_read: customer not owned by caller' using errcode = '42501';
  end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'customer_vault_key';

  -- Audit every read. Codes themselves are NOT logged — only the fact of
  -- access. detail is intentionally minimal to keep the log compact.
  insert into public.audit_log(owner_id, actor_id, action, category, detail)
  values (v_owner, v_owner, 'customer_vault.read', 'gdpr',
          jsonb_build_object('customer_id', p_customer_id));

  return query
  select
    case when cv.key_code     is null then null else pgp_sym_decrypt(cv.key_code,     v_key)::text end,
    case when cv.alarm_code   is null then null else pgp_sym_decrypt(cv.alarm_code,   v_key)::text end,
    case when cv.gate_code    is null then null else pgp_sym_decrypt(cv.gate_code,    v_key)::text end,
    case when cv.access_notes is null then null else pgp_sym_decrypt(cv.access_notes, v_key)::text end
  from public.customer_vault cv
  where cv.customer_id = p_customer_id;
end;
$$;

-- ── Write RPC ───────────────────────────────────────────────────────────────
-- Pass null for a field to leave it untouched on update; pass '' to clear it.
-- Returns nothing — the client should issue a vault_read afterwards if it
-- wants to verify the write.
create or replace function public.vault_write(
  p_customer_id  uuid,
  p_key_code     text,
  p_alarm_code   text,
  p_gate_code    text,
  p_access_notes text
)
returns void
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_key   text;
begin
  if v_owner is null then
    raise exception 'vault_write: not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.customers where id = p_customer_id and owner_id = v_owner
  ) then
    raise exception 'vault_write: customer not owned by caller' using errcode = '42501';
  end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'customer_vault_key';

  insert into public.customer_vault(
    customer_id, owner_id,
    key_code, alarm_code, gate_code, access_notes,
    updated_by, updated_at
  ) values (
    p_customer_id, v_owner,
    case when p_key_code     is null then null else pgp_sym_encrypt(p_key_code,     v_key) end,
    case when p_alarm_code   is null then null else pgp_sym_encrypt(p_alarm_code,   v_key) end,
    case when p_gate_code    is null then null else pgp_sym_encrypt(p_gate_code,    v_key) end,
    case when p_access_notes is null then null else pgp_sym_encrypt(p_access_notes, v_key) end,
    v_owner, now()
  )
  on conflict (customer_id) do update set
    key_code     = coalesce(case when p_key_code     is null then customer_vault.key_code     else pgp_sym_encrypt(p_key_code,     v_key) end, null),
    alarm_code   = coalesce(case when p_alarm_code   is null then customer_vault.alarm_code   else pgp_sym_encrypt(p_alarm_code,   v_key) end, null),
    gate_code    = coalesce(case when p_gate_code    is null then customer_vault.gate_code    else pgp_sym_encrypt(p_gate_code,    v_key) end, null),
    access_notes = coalesce(case when p_access_notes is null then customer_vault.access_notes else pgp_sym_encrypt(p_access_notes, v_key) end, null),
    updated_by   = v_owner,
    updated_at   = now();

  insert into public.audit_log(owner_id, actor_id, action, category, detail)
  values (v_owner, v_owner, 'customer_vault.write', 'gdpr',
          jsonb_build_object('customer_id', p_customer_id));
end;
$$;

grant execute on function public.vault_read(uuid)                        to authenticated;
grant execute on function public.vault_write(uuid, text, text, text, text) to authenticated;
-- Explicitly revoke from anon — these RPCs only make sense for a signed-in
-- owner, and the inner auth.uid() check would fail anyway.
revoke execute on function public.vault_read(uuid)                        from anon;
revoke execute on function public.vault_write(uuid, text, text, text, text) from anon;
