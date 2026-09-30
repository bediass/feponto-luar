-- ═══════════════════════════════════════════════════════════════════
-- Fê Ponto — o `anon` deixa de ver a linha inteira: grants POR COLUNA
--
-- STATUS: APLICADO EM 11/08/2026 (projeto feponto-gestao, bbeowsellckpnddirbep).
-- Idempotente: pode rodar de novo sem estragar nada.
--
-- ───────────────────────────────────────────────────────────────────
-- O VAZAMENTO
--
-- A chave `anon` é PÚBLICA: ela vai dentro do JavaScript da loja
-- (`site/assets/loja.js`), então qualquer visitante a tem na mão. O que
-- protege o banco não é a chave, é o RLS mais os grants.
--
-- O RLS estava certo (`visivel_no_site = true and ativo = true`), mas o
-- grant era de TABELA INTEIRA: `anon` tinha SELECT em todas as 37 colunas
-- de `produtos`. A loja pedir só 23 colunas não protege nada — quem pede é
-- o cliente, e o cliente pode pedir outra coisa. Medido em 11/08/2026,
-- antes deste bloco, com a chave publicável do site:
--
--   GET /rest/v1/produtos?select=nome,custo,cotacao_compra,cotacao_venda,markup,fornecedor,indice
--   → [{"nome":"Colar Corações","custo":5377.03,"cotacao_compra":672.97,
--       "cotacao_venda":671.06,"indice":7.99,"fornecedor":"Itamaraty"}, ...]
--
-- Ou seja, para as 200 peças publicadas dava para reconstruir: o custo de
-- compra, a margem inteira, a cotação de ouro usada e QUEM FORNECE cada
-- peça. `select=*` também respondia, com tudo.
--
-- Havia ainda grant de INSERT/UPDATE/REFERENCES para `anon` em TODAS as
-- tabelas do negócio (clientes, vendas, contas, pagamentos, movimentações,
-- produção, consignações, ordens de serviço). Escrever não funcionava, mas
-- só porque o RLS barrava: o privilégio existia e o RLS era a ÚNICA linha
-- de defesa. Política mal escrita em qualquer bloco futuro, ou um
-- `alter table ... disable row level security` de um minuto, e viravam
-- leitura e escrita públicas. Defesa em profundidade quer as duas travas.
--
-- ───────────────────────────────────────────────────────────────────
-- A CORREÇÃO (a mesma que a Luar já tinha em 0002_rls_grants.sql)
--
-- 1) `anon` perde tudo em `public`.
-- 2) Devolve SELECT, coluna por coluna, só no que a loja lê de fato.
-- 3) Conserta o DEFAULT PRIVILEGES: tabela nova nasce FECHADA pro `anon`.
--
-- O item 3 é o que impede o vazamento de voltar. Era o padrão do Supabase
-- (`alter default privileges ... grant all on tables to anon`) que fazia
-- tabela nova nascer aberta — e o grant de tabela inteira faz COLUNA nova
-- nascer aberta. Foi assim que o `mk_custo` do bloco-8 entrou na vitrine
-- pública no mesmo dia em que foi criado, sem ninguém decidir isso.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE ESTAS COLUNAS E NÃO OUTRAS
--
-- A lista é a interseção do que `loja.js` pede (23 colunas no `select`)
-- com o que ele usa em filtro e ordenação (`visivel_no_site`, `ativo`,
-- `created_at` — o Postgres exige SELECT na coluna usada no WHERE/ORDER BY,
-- mesmo que ela não volte na resposta).
--
-- FICAM DE FORA, de propósito:
--   custo, cotacao_compra, cotacao_venda, markup, mk_custo, indice,
--   par_indice, fornecedor, preco_automatico, tipo_metal, updated_at
--
-- `indice` e `par_indice` saem mesmo não sendo dinheiro: com o preço de
-- venda ao lado, `preco / indice` entrega `cotacao_venda × markup`, e a
-- margem se reconstrói por dedução. `preco_venda` continua público porque
-- é o preço da vitrine — é para ser visto.
--
-- Coluna nova daqui pra frente NÃO aparece na loja até ser adicionada
-- aqui. Isso é a intenção: o padrão passa a ser fechado, e publicar dado
-- vira uma decisão escrita.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1) Zera o `anon` no schema public
-- ───────────────────────────────────────────────────────────────────
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- `set_updated_at` tinha grant para PUBLIC (`=X/postgres`), e PUBLIC inclui
-- o `anon` — revogar só do `anon` não tira. É função de trigger: chamada
-- por RPC ela nem roda (erra "can only be called as trigger"), mas
-- privilégio inútil aparece em relatório de pentest e é confusão à toa.
-- `authenticated` tem grant próprio e explícito, então os triggers de
-- updated_at do ERP seguem funcionando.
revoke all on function public.set_updated_at() from anon, public;

-- ───────────────────────────────────────────────────────────────────
-- 2) Devolve só a vitrine — SELECT, coluna por coluna
-- ───────────────────────────────────────────────────────────────────

-- Peças. As 23 que `loja.js` lê + as 3 de filtro/ordenação.
grant select (
  id, codigo, nome, descricao, categoria_id, teor, pedras, cor_ouro,
  preco_venda, mostrar_preco, quantidade, destaque_site, foto_urls,
  publico, tamanho, peso_gramas, largura_mm, espessura_mm,
  eh_par, par_tamanho, par_largura_mm, par_espessura_mm, par_peso_gramas,
  visivel_no_site, ativo, created_at
) on public.produtos to anon;

-- Árvore de categorias: monta o mega-menu e os chips da coleção.
-- (Aqui a tabela tem 5 colunas e a loja lê 4; `created_at` fica de fora.)
grant select (id, nome, parent_id, ordem) on public.categorias to anon;

-- ───────────────────────────────────────────────────────────────────
-- 3) Tabela nova nasce fechada pro `anon`
-- ───────────────────────────────────────────────────────────────────
-- Sem isto, o próximo `create table` em public volta a dar tudo pro anon,
-- e o bloco-9 teria que ser rodado de novo depois de cada bloco novo.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

-- ⚠️ Sobra um default privileges idêntico no dono `supabase_admin`, que o
-- `postgres` não consegue alterar (não é membro dele). Na prática não pega:
-- tabela criada pelo SQL Editor, por migração ou por este MCP nasce com
-- dono `postgres`. Mas se algum dia aparecer tabela de dono
-- `supabase_admin` em public, ela nasce aberta pro anon — conferir com a
-- consulta 4.1 abaixo depois de criar tabela por caminho fora do comum.

-- ───────────────────────────────────────────────────────────────────
-- 4) Conferência (não altera nada)
-- ───────────────────────────────────────────────────────────────────

-- 4.1 O que o `anon` alcança em public. Esperado: SELECT em 26 colunas de
--     `produtos` e 4 de `categorias`, e MAIS NADA — nenhuma outra tabela,
--     nenhum INSERT, nenhum UPDATE.
-- select table_name, privilege_type, count(*) as colunas
-- from information_schema.role_column_grants
-- where table_schema = 'public' and grantee = 'anon'
-- group by 1, 2 order by 1, 2;

-- 4.2 Nenhuma coluna de dinheiro escapou?  Esperado: 0 linhas.
-- select column_name
-- from information_schema.role_column_grants
-- where table_schema = 'public' and table_name = 'produtos' and grantee = 'anon'
--   and column_name in ('custo','cotacao_compra','cotacao_venda','markup',
--                       'mk_custo','indice','par_indice','fornecedor');

-- 4.3 Teste de verdade, do lado de fora, com a chave publicável do site.
--     Esperado nos dois: HTTP 403 / "permission denied for table produtos".
-- curl "$URL/rest/v1/produtos?select=nome,custo" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
-- curl "$URL/rest/v1/produtos?select=*"          -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--     E a consulta da loja tem que continuar respondendo as 200 peças:
-- curl "$URL/rest/v1/produtos?select=id,nome,preco_venda&visivel_no_site=eq.true&ativo=eq.true"
