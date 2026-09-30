-- ============================================================================
-- BLOCO 0 — Fundação da integração Sistema ↔ Site (Fê Ponto Joias)
-- Rodar UMA vez no Supabase → SQL Editor → New query → colar tudo → Run.
-- É idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Campo "mostrar preço no site" (decisão peça a peça)
--    default false => por padrão o site mostra "Sob consulta".
-- ----------------------------------------------------------------------------
alter table public.produtos
  add column if not exists mostrar_preco boolean not null default false;


-- ----------------------------------------------------------------------------
-- 2) Bucket público de fotos das peças
--    (alternativa pela UI: Storage → New bucket → nome "produtos" → Public ✓)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do update set public = true;


-- ----------------------------------------------------------------------------
-- 3) Políticas do Storage para o bucket "produtos"
--    - Leitura pública já é automática em bucket público (URL pública).
--    - Upload / editar / apagar: só usuários logados no sistema.
-- ----------------------------------------------------------------------------
drop policy if exists "produtos_select_public" on storage.objects;
create policy "produtos_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'produtos');

drop policy if exists "produtos_insert_auth" on storage.objects;
create policy "produtos_insert_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'produtos');

drop policy if exists "produtos_update_auth" on storage.objects;
create policy "produtos_update_auth"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'produtos');

drop policy if exists "produtos_delete_auth" on storage.objects;
create policy "produtos_delete_auth"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'produtos');


-- ============================================================================
-- 4) CONFERÊNCIA DE SEGURANÇA (RLS) — não altera nada, só mostra o estado.
--    Rode e confira os resultados conforme os comentários abaixo.
-- ============================================================================

-- 4a) RLS precisa estar LIGADO nas tabelas sensíveis (rowsecurity = true em todas).
select tablename, rowsecurity as rls_ligado
from pg_tables
where schemaname = 'public'
  and tablename in ('produtos','categorias','clientes','vendas','venda_itens',
                    'pagamentos','contas','movimentacoes_caixa','producao',
                    'ordens_servico','consignacoes','profiles','configuracoes')
order by tablename;

-- 4b) Políticas existentes. O esperado é:
--     - produtos  : SELECT liberado p/ anon SÓ com (visivel_no_site AND ativo)
--     - categorias: SELECT liberado p/ anon (o site precisa dos filtros)
--     - clientes/vendas/financeiro: SEM política p/ anon (invisíveis ao público)
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
