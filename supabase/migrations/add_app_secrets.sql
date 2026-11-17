-- Grote geheimen (bv. de Enable Banking private key) in de versleutelde Supabase Vault i.p.v. in Netlify:
-- Netlify/AWS Lambda staat maximaal 4 KB aan omgevingsvariabelen toe voor alle functies samen.
-- Alleen de service role (Netlify-functies) mag ze lezen.
--
-- Sleutel toevoegen: Supabase → Project Settings → Vault → "Add new secret"
--   name: enablebanking_private_key   secret: de volledige PEM-tekst
-- of in de SQL editor:  select vault.create_secret($$-----BEGIN PRIVATE KEY----- … -----END PRIVATE KEY-----$$, 'enablebanking_private_key');

create or replace function public.get_app_secret(secret_name text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1
$$;

revoke all on function public.get_app_secret(text) from public, anon, authenticated;
grant execute on function public.get_app_secret(text) to service_role;
