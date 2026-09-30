-- ═══════════════════════════════════════════════════════════════════
-- Fê Ponto — Pingentes e Escapulários viram famílias próprias
--
-- STATUS: APLICADO EM 11/08/2026 (feponto-gestao, bbeowsellckpnddirbep).
-- Idempotente: pode rodar de novo sem duplicar nada.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE ISTO EXISTE
--
-- ANTES:  Colares & Correntes ─┬─ Colares            (34 peças)
--                              ├─ Correntes          (1)
--                              ├─ Colar gravatinha   (5)
--                              └─ Pingentes          (31)  ← enterrado aqui
--
-- DEPOIS: Colares & Correntes ─┬─ Colares            (33)
--                              ├─ Correntes          (1)
--                              └─ Colar gravatinha   (5)
--         Pingentes ─────────────── Pingentes        (31)
--         Escapulários ──────────── Escapulários     (1)
--
-- Pingente é a segunda maior categoria do estoque, 31 peças, mais que Colares
-- em quantidade de gente procurando. Como subcategoria ela só aparecia pra
-- quem abrisse a família "Colares & Correntes" e olhasse a quarta linha.
-- Escapulário não existia como categoria: a única peça do tipo estava dentro de
-- Colares, com o nome "Colar Escapulário". Mesmo raciocínio do bloco-5 com as
-- alianças, e o resultado é o mesmo: linha própria no mega-menu e chip próprio
-- na coleção.
--
-- ───────────────────────────────────────────────────────────────────
-- O TRUQUE (o mesmo do bloco-5)
--
-- O nó velho "Pingentes" NÃO é apagado: ele é rependurado na família nova,
-- mantendo o nome. As 31 peças continuam apontando pro mesmo `categoria_id` e
-- nenhum produto é tocado, nem foto, nem preço, nem histórico de venda.
-- Apagar e recriar deixaria as 31 peças órfãs, fora do site e fora dos filtros.
--
-- A família nova precisa de uma subcategoria homônima porque no ERP a
-- "Subcategoria" é OBRIGATÓRIA no cadastro (`src/pages/Estoque.tsx`): família
-- sem filho nenhum não deixa salvar peça. É o mesmo padrão de balde genérico de
-- Anéis > Anéis e Brincos > Brincos. No site a linha repetida não aparece
-- duas vezes: `mesmoNome()` em `site/assets/loja.js` já colapsa a homônima,
-- comparando sem acento, sem caixa e sem plural.
--
-- ───────────────────────────────────────────────────────────────────
-- CÓDIGO QUE PRECISOU MUDAR (uma linha)
--
-- `unidadeTamanho()` em `src/lib/joias.ts` decide a unidade do tamanho pelo
-- NOME da família:
--   Pingentes    → já casava com 'pingente' e devolve "Medida (mm)". De graça.
--   Escapulários → 'escapul' NÃO estava em lista nenhuma, e a família cairia no
--                  rótulo genérico "Tamanho". Entrou na lista do cm, junto com
--                  colar e corrente, que é como escapulário se mede.
-- Coberto por `testes/format.teste.ts` (`npm run teste`).
--
-- O resto (menu do site, chips da coleção, seletor do formulário) é montado
-- lendo a árvore de `categorias`, então não tem nada escrito à mão pra ajustar.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────
-- 1) As duas famílias novas
-- ───────────────────────────────────────────────────────────────────
insert into public.categorias (nome, ordem, parent_id)
select 'Pingentes', 5, null
where not exists (
  select 1 from public.categorias where nome = 'Pingentes' and parent_id is null
);

insert into public.categorias (nome, ordem, parent_id)
select 'Escapulários', 6, null
where not exists (
  select 1 from public.categorias where nome = 'Escapulários' and parent_id is null
);

-- ───────────────────────────────────────────────────────────────────
-- 2) O nó velho "Pingentes" sai de Colares & Correntes e vira o balde
--    genérico da família nova. As 31 peças vêm junto, sem serem tocadas.
-- ───────────────────────────────────────────────────────────────────
update public.categorias
   set ordem     = 1,
       parent_id = (select id from public.categorias
                     where nome = 'Pingentes' and parent_id is null)
 where nome = 'Pingentes'
   and parent_id = (select id from public.categorias
                     where nome = 'Colares & Correntes' and parent_id is null);

-- ───────────────────────────────────────────────────────────────────
-- 3) A subcategoria homônima de Escapulários (a família nasce vazia)
-- ───────────────────────────────────────────────────────────────────
insert into public.categorias (nome, ordem, parent_id)
select 'Escapulários', 1, f.id
  from public.categorias f
 where f.nome = 'Escapulários' and f.parent_id is null
   and not exists (
     select 1 from public.categorias s
      where s.nome = 'Escapulários' and s.parent_id = f.id
   );

-- ───────────────────────────────────────────────────────────────────
-- 4) A peça que já É escapulário vai pro lugar dela.
--
--    Só uma peça do estoque hoje: "Colar Escapulário", que estava em
--    Colares. Isto é um chute pelo NOME, igual ao do bloco-5 com a meia
--    aliança — se a Fernanda tiver outro escapulário com nome diferente, é
--    só trocar a categoria pelo ERP; nada aqui depende disso estar perfeito.
--
--    ⚠️ NÃO movi as peças "Pingente Meninos E Meninas" (em Colar gravatinha)
--    nem as 5 "Colar Com Separador E Pingente Menino E Menina" (em
--    Separadores). Todas têm "pingente" no nome, mas são colar ou separador
--    COM pingente, não o pingente avulso — quem decide isso é a Fernanda,
--    olhando a peça, não um LIKE no nome.
-- ───────────────────────────────────────────────────────────────────
update public.produtos p
   set categoria_id = (
         select s.id from public.categorias s
           join public.categorias f on f.id = s.parent_id
          where s.nome = 'Escapulários'
            and f.nome = 'Escapulários' and f.parent_id is null)
 where p.nome ilike '%escapul%'
   and p.categoria_id in (
         select c.id from public.categorias c
           join public.categorias f on f.id = c.parent_id
          where f.nome = 'Colares & Correntes' and f.parent_id is null);

-- ───────────────────────────────────────────────────────────────────
-- 5) Ordem das famílias no menu.
--
--    Pingentes e Escapulários entram logo depois de Colares & Correntes:
--    as três são peças de pescoço, e é ali que a cabeça do cliente procura.
--    Pulseiras, Piercings e Separadores descem duas posições.
-- ───────────────────────────────────────────────────────────────────
update public.categorias c
   set ordem = v.ordem
  from (values
          ('Anéis',               1),
          ('Alianças',            2),
          ('Brincos',             3),
          ('Colares & Correntes', 4),
          ('Pingentes',           5),
          ('Escapulários',        6),
          ('Pulseiras',           7),
          ('Piercings',           8),
          ('Separadores',         9)
       ) as v(nome, ordem)
 where c.parent_id is null
   and c.nome = v.nome
   and c.ordem is distinct from v.ordem;

commit;

-- ═══════════════════════════════════════════════════════════════════
-- CONFERÊNCIA (não altera nada)
-- ═══════════════════════════════════════════════════════════════════
-- select coalesce(p.nome,'(FAMILIA)') as familia, c.nome as categoria, c.ordem,
--        (select count(*) from public.produtos pr
--          where pr.categoria_id = c.id and pr.ativo) as pecas
--   from public.categorias c
--   left join public.categorias p on p.id = c.parent_id
--  order by coalesce(p.ordem, c.ordem), p.nome nulls first, c.ordem;
--
-- Esperado: 9 famílias, Pingentes (5) com 31 peças no filho homônimo,
-- Escapulários (6) com 1, e Colares & Correntes com 3 filhos (não 4).
--
-- ═══════════════════════════════════════════════════════════════════
-- VOLTAR ATRÁS (se precisar)
-- ═══════════════════════════════════════════════════════════════════
-- begin;
--   -- o escapulário volta pra Colares
--   update public.produtos set categoria_id = (
--     select c.id from public.categorias c join public.categorias f on f.id=c.parent_id
--      where c.nome='Colares' and f.nome='Colares & Correntes' and f.parent_id is null)
--    where categoria_id = (
--     select s.id from public.categorias s join public.categorias f on f.id=s.parent_id
--      where s.nome='Escapulários' and f.nome='Escapulários' and f.parent_id is null);
--   delete from public.categorias s using public.categorias f
--    where s.parent_id=f.id and s.nome='Escapulários'
--      and f.nome='Escapulários' and f.parent_id is null;
--   delete from public.categorias where nome='Escapulários' and parent_id is null;
--   -- Pingentes volta a ser filha de Colares & Correntes
--   update public.categorias set ordem=4,
--          parent_id=(select id from public.categorias
--                      where nome='Colares & Correntes' and parent_id is null)
--    where nome='Pingentes'
--      and parent_id=(select id from public.categorias
--                      where nome='Pingentes' and parent_id is null);
--   delete from public.categorias where nome='Pingentes' and parent_id is null;
--   update public.categorias c set ordem=v.ordem from (values
--     ('Anéis',1),('Alianças',2),('Brincos',3),('Colares & Correntes',4),
--     ('Pulseiras',5),('Piercings',6),('Separadores',7)) as v(nome,ordem)
--    where c.parent_id is null and c.nome=v.nome;
-- commit;
