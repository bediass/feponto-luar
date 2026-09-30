-- ═══════════════════════════════════════════════════════════════════
-- Fê Ponto — subcategoria "Profissões" + chave de preços do site
--
-- STATUS: APLICADO EM 15/08/2026 (feponto-gestao, bbeowsellckpnddirbep).
-- Idempotente: pode rodar de novo sem duplicar nada.
--
-- Duas coisas independentes, no mesmo bloco porque foram pedidas juntas:
--
--   1) "Profissões" entra como subcategoria de Anéis, Colares e Pingentes.
--   2) A Fernanda passa a ligar e desligar o preço do site inteiro, com um
--      terceiro estado ("manual") que devolve a decisão para cada peça.
--
-- ───────────────────────────────────────────────────────────────────
-- 1) PROFISSÕES
--
-- Mesmo nome em três famílias — igual a "Solitários" (Anéis, Brincos,
-- Colares) e "Rivieras" (Colares, Pulseiras) desde o bloco-11. Não quebra
-- nada porque menu do site, chips da coleção e o formulário do ERP casam
-- tudo por `id`. O único lugar onde o nome aparece sozinho é o Badge da
-- lista do Estoque, que não diz de qual família a peça é.
--
-- Ordem: sempre no fim da família (Anéis 6, Colares 8, Pingentes 4).
--
-- ───────────────────────────────────────────────────────────────────
-- 2) PREÇOS NO SITE — a chave `preco_site_modo`
--
-- Três estados, guardados como número porque `configuracoes.valor` é
-- `numeric` (a tabela é chave/valor numérico desde o começo):
--
--   0 = MANUAL          — vale o `mostrar_preco` de cada peça (comportamento
--                         de sempre; é o padrão que este bloco grava)
--   1 = MOSTRAR TODOS   — todo preço aparece, mesmo em peça com o
--                         `mostrar_preco` desmarcado
--   2 = OCULTAR TODOS   — nenhum preço aparece; tudo vira "Sob consulta"
--
-- O `mostrar_preco` da peça NÃO é tocado em nenhum dos três casos. Ligar
-- "ocultar todos" e voltar para "manual" devolve exatamente a seleção que
-- a Fernanda tinha feito peça a peça — que é justamente o motivo do
-- terceiro estado existir. Por isso o modo é uma chave à parte, e não um
-- `update produtos set mostrar_preco = false`, que apagaria a seleção.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE UMA FUNÇÃO, E NÃO "o site esconde na hora de desenhar"
--
-- Até aqui o site baixava `preco_venda` de TODAS as peças publicadas e só
-- deixava de escrever na tela quando `mostrar_preco` era falso. Ou seja,
-- "ocultar" era enfeite: o valor viajava no JSON, aparecia na aba Network
-- e — pior — a chave publicável é pública por definição (vai dentro do
-- `site/assets/loja.js`), então qualquer um pedia
-- `/rest/v1/produtos?select=nome,preco_venda` e lia o preço de qualquer
-- peça publicada, marcada ou não.
--
-- Grant por coluna (bloco-9) não resolve isto: grant é estático e a
-- decisão é por LINHA e por CONFIGURAÇÃO. RLS também não — RLS filtra
-- linha, não coluna, e sumir com a linha tiraria a peça do site.
--
-- A saída é servir o catálogo por uma função `security definer`, que
-- aplica o modo DENTRO do banco e devolve `preco_venda` nulo quando é para
-- ocultar. Junto com ela, o `anon` PERDE o select em `produtos.preco_venda`
-- (última linha da seção 2.3): sem isso a função seria só mais um caminho,
-- e o caminho velho continuaria aberto.
--
-- ⚠️ Consequência prática: a partir daqui o site NÃO lê `produtos`
-- direto — lê `catalogo_site()`. Coluna nova na vitrine agora se adiciona
-- NA FUNÇÃO (no `returns table` e no `select`), não mais só no grant do
-- bloco-9. Os grants de coluna que sobraram em `produtos` ficam de pé como
-- segunda trava, mas não são mais o que alimenta a loja.
--
-- ⚠️ `security definer` roda como dono (postgres) e portanto passa por
-- cima do RLS de `produtos`. Quem filtra a vitrine passa a ser o `where`
-- da própria função (`visivel_no_site and ativo`) — mexer nele expõe peça
-- que não deveria estar publicada. O `set search_path = public` é o que
-- impede o truque clássico de sequestrar a função por schema temporário.
--
-- ⚠️ O `get_advisors` passa a acusar "Public Can Execute SECURITY DEFINER
-- Function" (WARN). É esperado e intencional — a vitrine é pública, e essa
-- é exatamente a forma dela. Está explicado no item 6 do
-- `Luar Acessórios/docs/SEGURANCA-PENTEST.md` para não virar susto em
-- relatório de pentest.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────
-- 1) Subcategoria "Profissões" nas três famílias
-- ───────────────────────────────────────────────────────────────────
insert into public.categorias (nome, ordem, parent_id)
select v.sub, v.ordem, f.id
  from (values
          ('Anéis'::text,     'Profissões'::text, 6),
          ('Colares',         'Profissões',       8),
          ('Pingentes',       'Profissões',       4)
       ) as v(familia, sub, ordem)
  join public.categorias f on f.nome = v.familia and f.parent_id is null
 where not exists (
   select 1 from public.categorias s where s.parent_id = f.id and s.nome = v.sub
 );

-- Rodar de novo conserta a ordem, se alguém tiver mexido à mão.
-- (A família entra no `from` como segunda tabela, nunca num `join`: num
--  `update ... from` a tabela alvo não pode aparecer do lado direito de um
--  join — foi o que derrubou a primeira tentativa do bloco-11.)
update public.categorias s
   set ordem = v.ordem
  from public.categorias f,
       (values
          ('Anéis'::text, 'Profissões'::text, 6),
          ('Colares',     'Profissões',       8),
          ('Pingentes',   'Profissões',       4)
       ) as v(familia, sub, ordem)
 where f.id = s.parent_id
   and f.parent_id is null
   and f.nome = v.familia
   and s.nome = v.sub
   and s.ordem is distinct from v.ordem;

-- ───────────────────────────────────────────────────────────────────
-- 2.1) A chave do modo. Nasce em 0 (manual) = o comportamento de hoje.
-- ───────────────────────────────────────────────────────────────────
insert into public.configuracoes (chave, valor)
select 'preco_site_modo', 0
where not exists (select 1 from public.configuracoes where chave = 'preco_site_modo');

-- ───────────────────────────────────────────────────────────────────
-- 2.2) O catálogo público, com o modo já aplicado
--
-- Devolve as mesmas 23 colunas que o `loja.js` lia antes, na mesma ordem
-- (mais nova primeiro), com duas resolvidas aqui dentro:
--   preco_venda   → nulo quando o preço é para ficar escondido
--   mostrar_preco → o que vale DEPOIS do modo, não o que está na peça
-- Assim o site continua com a mesma regra de sempre ("mostrar_preco e
-- preço > 0, senão Sob consulta") sem precisar saber que o modo existe.
-- ───────────────────────────────────────────────────────────────────
create or replace function public.catalogo_site()
returns table (
  id uuid,
  codigo text,
  nome text,
  descricao text,
  categoria_id uuid,
  teor text,
  pedras text,
  cor_ouro text,
  preco_venda numeric,
  mostrar_preco boolean,
  quantidade numeric,
  destaque_site boolean,
  foto_urls text[],
  publico text,
  tamanho text,
  peso_gramas numeric,
  largura_mm numeric,
  espessura_mm numeric,
  eh_par boolean,
  par_tamanho text,
  par_largura_mm numeric,
  par_espessura_mm numeric,
  par_peso_gramas numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with modo as (
    select coalesce(
      (select c.valor from public.configuracoes c where c.chave = 'preco_site_modo'),
      0
    ) as v
  )
  select
    p.id, p.codigo, p.nome, p.descricao, p.categoria_id,
    p.teor, p.pedras, p.cor_ouro,
    -- 1 mostra tudo · 2 esconde tudo · 0 (ou qualquer outro) devolve a
    -- decisão para a peça. O preço só sai do banco quando vai ser exibido.
    case
      when m.v = 1 then p.preco_venda
      when m.v = 2 then null
      when p.mostrar_preco then p.preco_venda
    end,
    case when m.v = 1 then true when m.v = 2 then false else coalesce(p.mostrar_preco, false) end,
    p.quantidade, p.destaque_site, p.foto_urls, p.publico, p.tamanho,
    p.peso_gramas, p.largura_mm, p.espessura_mm, p.eh_par,
    p.par_tamanho, p.par_largura_mm, p.par_espessura_mm, p.par_peso_gramas
  from public.produtos p
  cross join modo m
  where p.visivel_no_site and p.ativo
  order by p.created_at desc;
$$;

comment on function public.catalogo_site() is
  'Catálogo público do site. Aplica configuracoes.preco_site_modo (0 manual, 1 mostrar todos, 2 ocultar todos) e devolve preco_venda nulo quando o preço fica escondido. É por aqui que a loja lê as peças desde 15/08/2026 — o anon não tem mais select em produtos.preco_venda.';

-- ───────────────────────────────────────────────────────────────────
-- 2.3) Quem pode chamar — e o fechamento do caminho velho
--
-- Função nasce com EXECUTE para PUBLIC, e `anon` é membro de PUBLIC: o
-- `revoke` abaixo não é decoração, é o que faz o grant seguinte ser a
-- única porta. (O `alter default privileges` do bloco-9 tirou o default do
-- `anon`, mas não o de PUBLIC.)
-- ───────────────────────────────────────────────────────────────────
revoke all on function public.catalogo_site() from public;
grant execute on function public.catalogo_site() to anon;
-- O ERP não chama esta função (ele lê `produtos` como staff), então o
-- `authenticated` fica de fora: é uma linha a menos no relatório do linter
-- para explicar. Quem um dia fizer "prévia do site" dentro do ERP precisa
-- devolver o grant aqui.
revoke execute on function public.catalogo_site() from authenticated;

-- O caminho direto para o preço fecha aqui. Sem esta linha, "ocultar
-- todos" continuaria sendo enfeite: bastaria pedir a coluna na mão.
-- O ERP não é afetado — ele entra como `authenticated`, que tem grant
-- próprio e RLS de staff (bloco-1).
revoke select (preco_venda) on public.produtos from anon;

commit;

-- ═══════════════════════════════════════════════════════════════════
-- CONFERÊNCIA (não altera nada)
-- ═══════════════════════════════════════════════════════════════════
-- Árvore: esperado 9 famílias e 36 subcategorias (33 + as 3 novas).
-- select coalesce(f.nome,'(FAMILIA)') as familia, c.nome, c.ordem
--   from public.categorias c
--   left join public.categorias f on f.id = c.parent_id
--  where f.nome in ('Anéis','Colares','Pingentes') or c.parent_id is null
--  order by coalesce(f.ordem, c.ordem), f.nome nulls first, c.ordem;
--
-- O modo pega? Trocar o valor e chamar a função:
-- update public.configuracoes set valor = 2 where chave = 'preco_site_modo';
-- select count(*) as pecas, count(preco_venda) as com_preco from public.catalogo_site();
--   → com_preco = 0
-- update public.configuracoes set valor = 1 where chave = 'preco_site_modo';
--   → com_preco = pecas (menos as que têm preco_venda nulo no cadastro)
-- update public.configuracoes set valor = 0 where chave = 'preco_site_modo';
--   → com_preco = quantas têm mostrar_preco = true
--
-- Teste de verdade, do lado de fora, com a chave publicável do site:
--   Esperado 403 / "permission denied for table produtos":
-- curl "$URL/rest/v1/produtos?select=nome,preco_venda" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   Esperado as peças publicadas, com preço conforme o modo:
-- curl -X POST "$URL/rest/v1/rpc/catalogo_site" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{}'
--
-- ═══════════════════════════════════════════════════════════════════
-- VOLTAR ATRÁS (se precisar)
-- ═══════════════════════════════════════════════════════════════════
-- begin;
--   -- devolve o caminho antigo ao site (e o `loja.js` volta a
--   -- `sb.from('produtos').select(...)`)
--   grant select (preco_venda) on public.produtos to anon;
--   drop function if exists public.catalogo_site();
--   delete from public.configuracoes where chave = 'preco_site_modo';
--   -- as três subcategorias só somem se ninguém tiver cadastrado peça nelas
--   delete from public.categorias c using public.categorias f
--    where c.parent_id = f.id and f.parent_id is null
--      and c.nome = 'Profissões'
--      and f.nome in ('Anéis','Colares','Pingentes')
--      and not exists (select 1 from public.produtos p where p.categoria_id = c.id);
-- commit;
