-- ═══════════════════════════════════════════════════════════════════
-- Fê Ponto — gate de staff no RLS (espelha o desenho da Luar)
--
-- STATUS: ESCRITO E APLICADO EM 29/07/2026 (feponto-gestao).
-- Este cabeçalho dizia "ainda não aplicado" até 31/07/2026 — estava errado.
-- Conferido no banco: `eh_staff()` existe, as 12 tabelas estão com a política
-- `staff total` (nenhuma `interno total` sobrou), e as políticas anon de
-- `produtos` e `categorias` continuam de pé, que é o que o site usa.
--
-- Foi seguida a OPÇÃO B do passo 6: três contas reais criadas e ativadas
-- (fepontojoias@, luanaalisk@, bernardommoura09@) e a conta de teste
-- teste@feponto.com.br apagada. Item do pentest fechado.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE ISTO EXISTE
--
-- ANTES: 12 tabelas tinham a política `interno total` com USING(true) e
--        WITH CHECK(true) para o papel `authenticated`. Qualquer conta
--        logada lia e escrevia cliente, venda e financeiro. Somado ao
--        trigger on_auth_user_created (que cria o perfil sozinho) e ao
--        default papel='admin', bastava conseguir criar uma conta.
--
-- DEPOIS: acesso só para perfil marcado `ativo`. Conta nova nasce inativa,
--         então cadastro aberto deixa de dar acesso a dado — a proteção
--         não depende mais do toggle de sign-ups estar desligado.
--
-- O site público NÃO é afetado: as políticas anon de `produtos` e
-- `categorias` continuam intactas, e é por elas que o catálogo carrega.
-- ═══════════════════════════════════════════════════════════════════

-- 1) marcador de staff
alter table public.profiles
  add column if not exists ativo boolean not null default false;

-- 2) conta nova não nasce admin
alter table public.profiles alter column papel set default 'pendente';

-- 3) trava a escalada de privilégio.
--    A política "perfil proprio - update" deixa o usuário editar a própria
--    linha. Sem isto, qualquer conta faria `update profiles set ativo = true`
--    e viraria staff sozinha. Privilégio de coluna não adianta enquanto
--    existir UPDATE no nível da tabela — por isso revoga e regrant só `nome`.
revoke update on public.profiles from authenticated, anon;
grant update (nome) on public.profiles to authenticated;

-- 4) eh_staff() — SECURITY INVOKER: lê só o próprio perfil, e o RLS de
--    profiles já isola isso. Como INVOKER, não vira endpoint RPC exposto
--    (foi essa a lição da migração 0005 da Luar).
create or replace function public.eh_staff()
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = (select auth.uid()) and ativo
  );
$$;

revoke all on function public.eh_staff() from public, anon;
grant execute on function public.eh_staff() to authenticated;

-- 5) troca as 12 políticas irrestritas por gate de staff
do $$
declare t text;
begin
  foreach t in array array[
    'categorias','clientes','configuracoes','consignacoes','contas',
    'movimentacoes_caixa','ordens_servico','pagamentos','producao',
    'produtos','venda_itens','vendas'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'interno total', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.eh_staff()) with check (public.eh_staff())',
      'staff total', t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- 6) LIBERAR O ACESSO — escolher UMA das opções abaixo
--
-- Depois do passo 5, NINGUÉM tem acesso até um perfil ser marcado `ativo`.
-- Isso é proposital: é o que impede o cadastro aberto de virar porta.
-- ═══════════════════════════════════════════════════════════════════

-- OPÇÃO A — destravar a conta que já existe, para o ERP voltar a funcionar
-- hoje. ATENÇÃO: é a conta de TESTE (teste@feponto.com.br). O checklist de
-- pentest manda removê-la antes do go-live.
--
--   update public.profiles set ativo = true
--    where id = '38d12ccf-57ae-453f-a71e-c0988142bc08';

-- OPÇÃO B (recomendada) — criar a conta real primeiro, ativar ela, e só
-- então apagar a de teste:
--
--   1. Supabase → Authentication → Users → Add user (e-mail real, senha forte)
--   2. update public.profiles set ativo = true where id = '<id-da-conta-nova>';
--   3. conferir que entra no ERP com a conta nova
--   4. Authentication → Users → apagar teste@feponto.com.br
--
-- ═══════════════════════════════════════════════════════════════════

-- VERIFICAÇÃO — rodar depois de aplicar:
--
--   -- deve listar 12 linhas "staff total" e nenhuma "interno total"
--   select tablename, policyname from pg_policies
--    where schemaname = 'public' order by tablename;
--
--   -- deve continuar existindo (o site depende delas)
--   select tablename, policyname, roles::text from pg_policies
--    where schemaname = 'public' and 'anon' = any(roles);
--
--   -- quem tem acesso hoje
--   select id, nome, papel, ativo from public.profiles;
