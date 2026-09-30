-- ═══════════════════════════════════════════════════════════════════
-- Fê Ponto — Taxonomia nova de categorias (9 famílias, 33 subcategorias)
--
-- STATUS: APLICADO EM 13/08/2026 (feponto-gestao, bbeowsellckpnddirbep).
-- Idempotente: pode rodar de novo sem duplicar nada.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE ISTO EXISTE
--
-- A árvore de categorias tinha crescido por remendo — cada bloco anterior
-- promoveu uma família nova conforme a peça aparecia no estoque. A Fernanda
-- fechou a lista de vez, e é ela que passa a valer:
--
--   ALIANÇAS DE CASAMENTO
--   ANÉIS         — alianças inteiras / meias alianças / navetes / solitários
--   BRINCOS       — argolas / infantis / fios e correntes / ear cuffs / solitários
--   COLARES       — gravatinhas / solitários / rivieras / escapulários / extensores
--   PIERCINGS     — nariz / umbigo / orelha
--   PINGENTES     — separadores / relicários
--   ALFINETES
--   PULSEIRAS     — rivieras / infantis
--   TORNOZELEIRAS
--
-- ANTES (9 famílias)                    DEPOIS (9 famílias)
--   Anéis ──── Anéis (95)                 Alianças de casamento ─┬ Alianças inteiras (10)
--   Alianças ─┬ Aliança (10)                                     └ Meias alianças (9)
--             └ Meia Aliança (9)          Anéis ─────┬ Anéis (95)
--   Brincos ──┬ Brincos                              ├ Alianças inteiras
--             ├ Argolas                              ├ Meias alianças
--             └ Corrente de orelha                   ├ Navetes
--   Colares & Correntes ─┬ Colares (33)              └ Solitários
--                        ├ Correntes (1)  Brincos ───┬ Brincos
--                        └ Colar gravatinha (4)      ├ Argolas
--   Pingentes ─ Pingentes (73)                       ├ Infantis
--   Escapulários ─ Escapulários (1)                  ├ Fios e correntes
--   Pulseiras ─┬ Pulseiras (19)                      ├ Ear cuffs
--              ├ Tornozeleiras                       └ Solitários
--              └ Braceletes (2)           Colares ───┬ Colares (33)
--   Piercings ─ Piercings                            ├ Gravatinhas (4)
--   Separadores ─ Separadores (5)                    ├ Solitários
--                                                    ├ Rivieras
--                                                    ├ Escapulários (1)
--                                                    ├ Extensores
--                                                    └ Correntes (1)
--                                         Piercings ─┬ Piercings
--                                                    ├ Nariz / Umbigo / Orelha
--                                         Pingentes ─┬ Pingentes (73)
--                                                    ├ Separadores (5)
--                                                    └ Relicários
--                                         Alfinetes ─ Alfinetes
--                                         Pulseiras ─┬ Pulseiras (19)
--                                                    ├ Rivieras / Infantis
--                                                    └ Braceletes (2)
--                                         Tornozeleiras ─ Tornozeleiras
--
-- ───────────────────────────────────────────────────────────────────
-- AS TRÊS DECISÕES QUE O BERNARDO TOMOU (13/08/2026)
--
-- 1) As 19 peças de aliança vão TODAS para "Alianças de casamento", inclusive
--    as 16 que são peça única (Aliança Inteira Navete, Meia Aliança Navete).
--    "Anéis > alianças inteiras / meias alianças" nasce vazia, para o anel de
--    estilo aliança que não é aliança de casamento.
--    ⚠️ Isso significa que existem DOIS pares de subcategorias com o mesmo
--    nome, em famílias diferentes. É de propósito. Não quebra nada porque
--    tudo — menu do site, chips, formulário do ERP — casa por `id`, nunca por
--    nome. O único lugar onde o nome sozinho aparece é o Badge da lista do
--    estoque (`Estoque.tsx`), onde "Solitários" não diz de qual família é.
--
-- 2) Correntes (1 peça) e Braceletes (2) não estavam na lista nova, mas ficam,
--    penduradas em Colares e Pulseiras. Apagar não moveria pé de peça nenhum,
--    só perderia a distinção no cadastro.
--
-- 3) A caixa alta da lista era notação, não conteúdo: grava com capitalização
--    normal. Quem escreve a família em caixa alta no mega-menu é o CSS
--    (`.mega__fam`), como já fazia com os chips da coleção.
--
-- ───────────────────────────────────────────────────────────────────
-- O TRUQUE (o mesmo dos blocos 5 e 10, agora nos dois sentidos)
--
-- Nenhum nó com peça é apagado — todos são RENOMEADOS ou REPENDURADOS, então
-- nenhum `produtos.categoria_id` é tocado e nenhuma peça sai do site:
--   "Alianças"            → renomeada  para "Alianças de casamento"
--   "Aliança"             → renomeada  para "Alianças inteiras"    (10 peças)
--   "Meia Aliança"        → renomeada  para "Meias alianças"       (9)
--   "Colares & Correntes" → renomeada  para "Colares"
--   "Colar gravatinha"    → renomeada  para "Gravatinhas"          (4)
--   "Corrente de orelha"  → renomeada  para "Fios e correntes"
--   "Escapulários" (sub)  → rependurada de Escapulários em Colares (1)
--   "Separadores"  (sub)  → rependurada de Separadores  em Pingentes (5)
--   "Tornozeleiras"(sub)  → PROMOVIDA a família (o inverso do bloco-10)
--
-- Só então as famílias "Escapulários" e "Separadores", agora sem filho e sem
-- peça apontando para elas, são apagadas — e o `delete` confere as duas
-- condições em vez de confiar na ordem dos comandos.
--
-- ⚠️ Efeito colateral aceito: os `id` das duas famílias apagadas somem, então
-- link antigo do tipo `colecao.html?fam=<id>` para de filtrar. Mesma coisa que
-- o bloco-10 fez com a subcategoria "Pingentes".
--
-- ───────────────────────────────────────────────────────────────────
-- CÓDIGO QUE PRECISOU MUDAR
--
-- `unidadeTamanho()` em `src/lib/joias.ts` decide a unidade do "tamanho" pelo
-- NOME da família, então família nova é onde ele quebra:
--   Alianças de casamento → casa com 'alianc'      → "Aro (nº)".   De graça.
--   Tornozeleiras         → 'tornozeleira' já estava na lista do cm. De graça.
--   Alfinetes             → NÃO casava com nada e cairia no genérico
--                           "Tamanho". Entrou na lista do mm, junto com
--                           pingente, brinco e piercing.
-- `.mega__fam` no `site/assets/estilo.css` ganhou caixa alta.
-- Coberto por `testes/format.teste.ts` (`npm run teste`).
--
-- O resto (menu do site, chips da coleção, seletor do formulário) é montado
-- lendo a árvore de `categorias`, então não tem nada escrito à mão para ajustar.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────
-- 1) Renomear as duas famílias que mudaram de nome.
--    Nenhuma peça é tocada: o id continua o mesmo.
-- ───────────────────────────────────────────────────────────────────
update public.categorias set nome = 'Alianças de casamento'
 where nome = 'Alianças' and parent_id is null;

update public.categorias set nome = 'Colares'
 where nome = 'Colares & Correntes' and parent_id is null;

-- ───────────────────────────────────────────────────────────────────
-- 2) Renomear as subcategorias que mudaram de nome.
--    Sempre com o pai no `where`, porque a partir daqui existe nome de
--    subcategoria repetido em famílias diferentes.
-- ───────────────────────────────────────────────────────────────────
update public.categorias s set nome = 'Alianças inteiras'
  from public.categorias f
 where s.parent_id = f.id and s.nome = 'Aliança'
   and f.nome = 'Alianças de casamento' and f.parent_id is null;

update public.categorias s set nome = 'Meias alianças'
  from public.categorias f
 where s.parent_id = f.id and s.nome = 'Meia Aliança'
   and f.nome = 'Alianças de casamento' and f.parent_id is null;

update public.categorias s set nome = 'Gravatinhas'
  from public.categorias f
 where s.parent_id = f.id and s.nome = 'Colar gravatinha'
   and f.nome = 'Colares' and f.parent_id is null;

update public.categorias s set nome = 'Fios e correntes'
  from public.categorias f
 where s.parent_id = f.id and s.nome = 'Corrente de orelha'
   and f.nome = 'Brincos' and f.parent_id is null;

-- ───────────────────────────────────────────────────────────────────
-- 3) Escapulários deixa de ser família e volta a ser subcategoria de
--    Colares — com a peça junto, porque o nó é o mesmo.
-- ───────────────────────────────────────────────────────────────────
update public.categorias s
   set parent_id = (select id from public.categorias
                     where nome = 'Colares' and parent_id is null)
  from public.categorias f
 where s.parent_id = f.id and s.nome = 'Escapulários'
   and f.nome = 'Escapulários' and f.parent_id is null;

-- ───────────────────────────────────────────────────────────────────
-- 4) Separadores deixa de ser família e vira subcategoria de Pingentes.
--    As 5 peças ("Colar Com Separador E Pingente...") vêm junto.
-- ───────────────────────────────────────────────────────────────────
update public.categorias s
   set parent_id = (select id from public.categorias
                     where nome = 'Pingentes' and parent_id is null)
  from public.categorias f
 where s.parent_id = f.id and s.nome = 'Separadores'
   and f.nome = 'Separadores' and f.parent_id is null;

-- ───────────────────────────────────────────────────────────────────
-- 5) Apagar as duas famílias que ficaram vazias.
--    O `not exists` duplo é a trava: se por qualquer motivo o nó ainda
--    tiver filho ou peça, o delete não pega em vez de deixar órfão.
-- ───────────────────────────────────────────────────────────────────
delete from public.categorias c
 where c.parent_id is null
   and c.nome in ('Escapulários', 'Separadores')
   and not exists (select 1 from public.categorias f where f.parent_id = c.id)
   and not exists (select 1 from public.produtos p where p.categoria_id = c.id);

-- ───────────────────────────────────────────────────────────────────
-- 6) Tornozeleiras sobe de subcategoria de Pulseiras para família própria
--    (o inverso do que o bloco-10 fez com Pingentes). Está vazia hoje,
--    mas rependurar em vez de recriar mantém o hábito — e o dia em que
--    tiver peça, a mesma linha continua correta.
-- ───────────────────────────────────────────────────────────────────
update public.categorias s
   set parent_id = null, ordem = 9
  from public.categorias f
 where s.parent_id = f.id and s.nome = 'Tornozeleiras'
   and f.nome = 'Pulseiras' and f.parent_id is null;

-- ───────────────────────────────────────────────────────────────────
-- 7) A família nova que não existia em canto nenhum.
-- ───────────────────────────────────────────────────────────────────
insert into public.categorias (nome, ordem, parent_id)
select 'Alfinetes', 7, null
where not exists (
  select 1 from public.categorias where nome = 'Alfinetes' and parent_id is null
);

-- ───────────────────────────────────────────────────────────────────
-- 8) Todas as subcategorias novas de uma vez.
--
--    Alfinetes e Tornozeleiras recebem a subcategoria homônima porque no
--    ERP a "Subcategoria" é OBRIGATÓRIA no cadastro (`src/pages/Estoque.tsx`):
--    família sem filho nenhum não deixa salvar peça. É o mesmo balde
--    genérico de Anéis > Anéis. No site a linha repetida não aparece duas
--    vezes — `mesmoNome()` em `site/assets/loja.js` colapsa a homônima.
-- ───────────────────────────────────────────────────────────────────
insert into public.categorias (nome, ordem, parent_id)
select v.sub, v.ordem, f.id
  from (values
          ('Anéis'::text,         'Alianças inteiras'::text, 2),
          ('Anéis',               'Meias alianças',          3),
          ('Anéis',               'Navetes',                 4),
          ('Anéis',               'Solitários',              5),
          ('Brincos',             'Infantis',                3),
          ('Brincos',             'Ear cuffs',               5),
          ('Brincos',             'Solitários',              6),
          ('Colares',             'Solitários',              3),
          ('Colares',             'Rivieras',                4),
          ('Colares',             'Extensores',              6),
          ('Piercings',           'Nariz',                   2),
          ('Piercings',           'Umbigo',                  3),
          ('Piercings',           'Orelha',                  4),
          ('Pingentes',           'Relicários',              3),
          ('Alfinetes',           'Alfinetes',               1),
          ('Pulseiras',           'Rivieras',                2),
          ('Pulseiras',           'Infantis',                3),
          ('Tornozeleiras',       'Tornozeleiras',           1)
       ) as v(familia, sub, ordem)
  join public.categorias f on f.nome = v.familia and f.parent_id is null
 where not exists (
   select 1 from public.categorias s where s.parent_id = f.id and s.nome = v.sub
 );

-- ───────────────────────────────────────────────────────────────────
-- 9) Ordem das famílias no menu — a ordem em que a Fernanda escreveu a
--    lista, que é a ordem em que ela pensa a vitrine.
-- ───────────────────────────────────────────────────────────────────
update public.categorias c
   set ordem = v.ordem
  from (values
          ('Alianças de casamento'::text, 1),
          ('Anéis',                       2),
          ('Brincos',                     3),
          ('Colares',                     4),
          ('Piercings',                   5),
          ('Pingentes',                   6),
          ('Alfinetes',                   7),
          ('Pulseiras',                   8),
          ('Tornozeleiras',               9)
       ) as v(nome, ordem)
 where c.parent_id is null
   and c.nome = v.nome
   and c.ordem is distinct from v.ordem;

-- ───────────────────────────────────────────────────────────────────
-- 10) Ordem das subcategorias dentro de cada família.
--     Repete as novas de propósito: assim esta tabela é a foto completa
--     da árvore, e rodar o bloco de novo conserta ordem mexida à mão.
--
--     ⚠️ A família entra no `from` como segunda tabela, não como `join`.
--     Num `update ... from`, a tabela alvo (`s`) não pode aparecer do lado
--     direito de um `join` — o Postgres recusa com "invalid reference to
--     FROM-clause entry". Quem amarra `f` a `s` é o `where`.
-- ───────────────────────────────────────────────────────────────────
update public.categorias s
   set ordem = v.ordem
  from public.categorias f,
       (values
          ('Alianças de casamento'::text, 'Alianças inteiras'::text, 1),
          ('Alianças de casamento', 'Meias alianças',    2),
          ('Anéis',                 'Anéis',             1),
          ('Anéis',                 'Alianças inteiras', 2),
          ('Anéis',                 'Meias alianças',    3),
          ('Anéis',                 'Navetes',           4),
          ('Anéis',                 'Solitários',        5),
          ('Brincos',               'Brincos',           1),
          ('Brincos',               'Argolas',           2),
          ('Brincos',               'Infantis',          3),
          ('Brincos',               'Fios e correntes',  4),
          ('Brincos',               'Ear cuffs',         5),
          ('Brincos',               'Solitários',        6),
          ('Colares',               'Colares',           1),
          ('Colares',               'Gravatinhas',       2),
          ('Colares',               'Solitários',        3),
          ('Colares',               'Rivieras',          4),
          ('Colares',               'Escapulários',      5),
          ('Colares',               'Extensores',        6),
          ('Colares',               'Correntes',         7),
          ('Piercings',             'Piercings',         1),
          ('Piercings',             'Nariz',             2),
          ('Piercings',             'Umbigo',            3),
          ('Piercings',             'Orelha',            4),
          ('Pingentes',             'Pingentes',         1),
          ('Pingentes',             'Separadores',       2),
          ('Pingentes',             'Relicários',        3),
          ('Alfinetes',             'Alfinetes',         1),
          ('Pulseiras',             'Pulseiras',         1),
          ('Pulseiras',             'Rivieras',          2),
          ('Pulseiras',             'Infantis',          3),
          ('Pulseiras',             'Braceletes',        4),
          ('Tornozeleiras',         'Tornozeleiras',     1)
       ) as v(familia, sub, ordem)
 where f.id = s.parent_id
   and f.parent_id is null
   and f.nome = v.familia
   and s.nome = v.sub
   and s.ordem is distinct from v.ordem;

commit;

-- ═══════════════════════════════════════════════════════════════════
-- CONFERÊNCIA (não altera nada)
-- ═══════════════════════════════════════════════════════════════════
-- select coalesce(f.nome,'(FAMILIA)') as familia, c.nome as categoria, c.ordem,
--        (select count(*) from public.produtos pr
--          where pr.categoria_id = c.id and pr.ativo) as pecas
--   from public.categorias c
--   left join public.categorias f on f.id = c.parent_id
--  order by coalesce(f.ordem, c.ordem), f.nome nulls first, c.ordem;
--
-- Esperado: 9 famílias, 33 subcategorias, 42 linhas.
-- As peças continuam onde estavam (contagem de 13/08/2026, contando também
-- as inativas, que é como elas foram conferidas antes e depois):
--   Alianças de casamento > Alianças inteiras 10, Meias alianças 9
--   Anéis > Anéis 95 · Colares > Colares 33, Gravatinhas 4, Escapulários 1,
--   Correntes 1 · Pingentes > Pingentes 74, Separadores 5 ·
--   Pulseiras > Pulseiras 19, Braceletes 2
--
-- ⚠️ Pingentes tinha 73 no retrato tirado meia hora antes: a Fernanda estava
-- cadastrando peça no ERP enquanto o bloco rodava (15 peças criadas em 2h).
-- Isso é seguro aqui porque este bloco não escreve em `produtos` nenhuma vez,
-- e nenhum nó com peça é apagado — mas quem estiver com o ERP aberto continua
-- vendo o seletor de categoria antigo até recarregar a página.
--
-- Nenhuma peça pode ficar sem categoria — isto tem que devolver 0:
--   select count(*) from public.produtos where ativo and categoria_id is null;
--
-- Nem apontar para nó que sumiu — isto também tem que devolver 0:
--   select count(*) from public.produtos p where p.ativo and p.categoria_id
--     is not null and not exists (select 1 from public.categorias c
--                                  where c.id = p.categoria_id);
--
-- ═══════════════════════════════════════════════════════════════════
-- VOLTAR ATRÁS (se precisar)
-- ═══════════════════════════════════════════════════════════════════
-- begin;
--   -- as subcategorias novas ainda vazias somem (o `not exists` protege
--   -- qualquer uma em que a Fernanda já tenha cadastrado peça)
--   delete from public.categorias c using public.categorias f
--    where c.parent_id = f.id and f.parent_id is null
--      and (f.nome, c.nome) in (
--        ('Anéis','Alianças inteiras'),('Anéis','Meias alianças'),
--        ('Anéis','Navetes'),('Anéis','Solitários'),
--        ('Brincos','Infantis'),('Brincos','Ear cuffs'),('Brincos','Solitários'),
--        ('Colares','Solitários'),('Colares','Rivieras'),('Colares','Extensores'),
--        ('Piercings','Nariz'),('Piercings','Umbigo'),('Piercings','Orelha'),
--        ('Pingentes','Relicários'),('Pulseiras','Rivieras'),('Pulseiras','Infantis'))
--      and not exists (select 1 from public.produtos p where p.categoria_id = c.id);
--   delete from public.categorias c using public.categorias f
--    where c.parent_id = f.id and f.nome = 'Alfinetes' and f.parent_id is null;
--   delete from public.categorias where nome = 'Alfinetes' and parent_id is null;
--   delete from public.categorias c using public.categorias f
--    where c.parent_id = f.id and f.nome = 'Tornozeleiras' and f.parent_id is null;
--   -- Tornozeleiras volta a ser filha de Pulseiras
--   update public.categorias set parent_id = (select id from public.categorias
--            where nome = 'Pulseiras' and parent_id is null), ordem = 2
--    where nome = 'Tornozeleiras' and parent_id is null;
--   -- Escapulários e Separadores voltam a ser famílias
--   insert into public.categorias (nome, ordem, parent_id) values
--     ('Escapulários', 6, null), ('Separadores', 9, null);
--   update public.categorias s set parent_id = (select id from public.categorias
--            where nome = 'Escapulários' and parent_id is null), ordem = 1
--     from public.categorias f
--    where s.parent_id = f.id and s.nome = 'Escapulários' and f.nome = 'Colares';
--   update public.categorias s set parent_id = (select id from public.categorias
--            where nome = 'Separadores' and parent_id is null), ordem = 1
--     from public.categorias f
--    where s.parent_id = f.id and s.nome = 'Separadores' and f.nome = 'Pingentes';
--   -- os nomes de volta
--   update public.categorias set nome = 'Colares & Correntes'
--    where nome = 'Colares' and parent_id is null;
--   update public.categorias set nome = 'Alianças'
--    where nome = 'Alianças de casamento' and parent_id is null;
--   update public.categorias s set nome = 'Aliança' from public.categorias f
--    where s.parent_id = f.id and s.nome = 'Alianças inteiras' and f.nome = 'Alianças';
--   update public.categorias s set nome = 'Meia Aliança' from public.categorias f
--    where s.parent_id = f.id and s.nome = 'Meias alianças' and f.nome = 'Alianças';
--   update public.categorias s set nome = 'Colar gravatinha' from public.categorias f
--    where s.parent_id = f.id and s.nome = 'Gravatinhas' and f.nome = 'Colares & Correntes';
--   update public.categorias s set nome = 'Corrente de orelha' from public.categorias f
--    where s.parent_id = f.id and s.nome = 'Fios e correntes' and f.nome = 'Brincos';
--   update public.categorias c set ordem = v.ordem from (values
--     ('Anéis',1),('Alianças',2),('Brincos',3),('Colares & Correntes',4),
--     ('Pingentes',5),('Escapulários',6),('Pulseiras',7),('Piercings',8),
--     ('Separadores',9)) as v(nome,ordem)
--    where c.parent_id is null and c.nome = v.nome;
-- commit;
