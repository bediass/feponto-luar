-- ═══════════════════════════════════════════════════════════════════
-- Fê Ponto — Alianças vira família própria
--
-- STATUS: ESCRITO E APLICADO EM 31/07/2026 (feponto-gestao).
-- Idempotente: pode rodar de novo sem duplicar nada.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE ISTO EXISTE
--
-- ANTES:  Anéis ─┬─ Anéis      (25 peças, o anel que não é aliança)
--                └─ Alianças   (7 peças)
--
-- DEPOIS: Anéis ──── Anéis     (25 peças)
--         Alianças ─┬─ Aliança        (6 peças)
--                   └─ Meia Aliança   (1 peça)
--
-- Aliança é decisão de compra própria — quem procura aliança de casamento não
-- está navegando anel. Enterrada como subcategoria de Anéis, ela só aparecia
-- pra quem abrisse a família errada. Como família, ganha linha própria no
-- mega-menu e chip próprio na coleção.
--
-- ───────────────────────────────────────────────────────────────────
-- NÃO PRECISOU MUDAR CÓDIGO NENHUM
--
-- Site e ERP montam menu, filtros e formulário lendo a árvore de `categorias`.
-- Não existe categoria escrita à mão em lugar nenhum. E as duas funções do ERP
-- que olham nome de categoria continuam certas de graça:
--
--   ehAlianca(sub, familia)  -> casa com 'alianc' em qualquer um dos dois.
--                               "Aliança" ✓  "Meia Aliança" ✓  "Alianças" ✓
--   unidadeTamanho(familia)  -> a família virou "Alianças", que casa com
--                               'alianc' e devolve "Aro (nº)", como antes.
--
-- Ou seja: os campos de largura/espessura, a opção de par e a unidade do
-- tamanho seguem aparecendo. É por isso que essas funções decidem por NOME e
-- não por id fixo — ver `src/lib/joias.ts`.
--
-- ───────────────────────────────────────────────────────────────────
-- O TRUQUE DA MIGRAÇÃO
--
-- O nó velho "Alianças" NÃO é apagado: ele é renomeado pra "Aliança" e
-- rependurado na família nova. Assim as 7 peças continuam apontando pro mesmo
-- `categoria_id` e nenhum produto precisa ser tocado — nem foto, nem preço,
-- nem histórico de venda. Apagar e recriar deixaria os produtos órfãos.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────
-- 1) A família nova
-- ───────────────────────────────────────────────────────────────────
insert into public.categorias (nome, ordem, parent_id)
select 'Alianças', 2, null
where not exists (
  select 1 from public.categorias where nome = 'Alianças' and parent_id is null
);

-- ───────────────────────────────────────────────────────────────────
-- 2) O nó velho vira a subcategoria "Aliança" da família nova.
--    Renomeia + rependura. As 7 peças vêm junto sem serem tocadas.
-- ───────────────────────────────────────────────────────────────────
update public.categorias
   set nome      = 'Aliança',
       ordem     = 1,
       parent_id = (select id from public.categorias
                     where nome = 'Alianças' and parent_id is null)
 where nome = 'Alianças'
   and parent_id = (select id from public.categorias
                     where nome = 'Anéis' and parent_id is null);

-- ───────────────────────────────────────────────────────────────────
-- 3) A subcategoria "Meia Aliança"
-- ───────────────────────────────────────────────────────────────────
insert into public.categorias (nome, ordem, parent_id)
select 'Meia Aliança', 2, f.id
  from public.categorias f
 where f.nome = 'Alianças' and f.parent_id is null
   and not exists (
     select 1 from public.categorias m
      where m.nome = 'Meia Aliança' and m.parent_id = f.id
   );

-- ───────────────────────────────────────────────────────────────────
-- 4) A peça que já É meia aliança vai pro lugar dela.
--
--    Só uma peça do estoque se chama assim hoje ("Meia Aliança Navete").
--    As outras 6 são aliança inteira ou par. Isto é um chute pelo NOME —
--    se a Fernanda tiver outra meia aliança com nome diferente, é só trocar a
--    categoria pelo ERP; nada aqui depende dessa classificação estar perfeita.
-- ───────────────────────────────────────────────────────────────────
update public.produtos p
   set categoria_id = (
         select m.id from public.categorias m
           join public.categorias f on f.id = m.parent_id
          where m.nome = 'Meia Aliança'
            and f.nome = 'Alianças' and f.parent_id is null)
 where p.categoria_id = (
         select a.id from public.categorias a
           join public.categorias f on f.id = a.parent_id
          where a.nome = 'Aliança'
            and f.nome = 'Alianças' and f.parent_id is null)
   and p.nome ilike 'meia alian%';

-- ───────────────────────────────────────────────────────────────────
-- 5) Ordem das famílias no menu. Alianças entra logo depois de Anéis,
--    que é onde a cabeça do cliente procura.
-- ───────────────────────────────────────────────────────────────────
update public.categorias c
   set ordem = v.ordem
  from (values
          ('Anéis',               1),
          ('Alianças',            2),
          ('Brincos',             3),
          ('Colares & Correntes', 4),
          ('Pulseiras',           5),
          ('Piercings',           6),
          ('Separadores',         7)
       ) as v(nome, ordem)
 where c.parent_id is null
   and c.nome = v.nome
   and c.ordem is distinct from v.ordem;

commit;

-- ═══════════════════════════════════════════════════════════════════
-- CONFERÊNCIA (não altera nada)
-- ═══════════════════════════════════════════════════════════════════
-- select coalesce(p.nome,'—') as familia, c.nome as categoria, c.ordem,
--        (select count(*) from public.produtos pr
--          where pr.categoria_id = c.id and pr.ativo) as pecas
--   from public.categorias c
--   left join public.categorias p on p.id = c.parent_id
--  order by coalesce(p.ordem, c.ordem), p.nome nulls first, c.ordem;
--
-- Esperado: Alianças (família, ordem 2) com Aliança (6) e Meia Aliança (1),
-- e Anéis com só o filho Anéis (25).
--
-- ═══════════════════════════════════════════════════════════════════
-- VOLTAR ATRÁS (se precisar)
-- ═══════════════════════════════════════════════════════════════════
-- begin;
--   -- devolve as meias alianças pro nó único
--   update public.produtos set categoria_id = (
--     select a.id from public.categorias a join public.categorias f on f.id=a.parent_id
--      where a.nome='Aliança' and f.nome='Alianças' and f.parent_id is null)
--    where categoria_id = (
--     select m.id from public.categorias m join public.categorias f on f.id=m.parent_id
--      where m.nome='Meia Aliança' and f.nome='Alianças' and f.parent_id is null);
--   delete from public.categorias m using public.categorias f
--    where m.parent_id=f.id and m.nome='Meia Aliança'
--      and f.nome='Alianças' and f.parent_id is null;
--   -- o nó volta a ser "Alianças" filha de "Anéis"
--   update public.categorias set nome='Alianças', ordem=2,
--          parent_id=(select id from public.categorias where nome='Anéis' and parent_id is null)
--    where nome='Aliança'
--      and parent_id=(select id from public.categorias where nome='Alianças' and parent_id is null);
--   delete from public.categorias where nome='Alianças' and parent_id is null;
--   update public.categorias c set ordem=v.ordem from (values
--     ('Anéis',1),('Brincos',2),('Colares & Correntes',3),
--     ('Pulseiras',4),('Piercings',5),('Separadores',6)) as v(nome,ordem)
--    where c.parent_id is null and c.nome=v.nome;
-- commit;
