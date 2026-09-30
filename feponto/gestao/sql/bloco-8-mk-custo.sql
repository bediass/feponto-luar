-- ═══════════════════════════════════════════════════════════════════
-- Fê Ponto — MK de custo: o índice deixa de ser digitado
--
-- STATUS: APLICADO EM 11/08/2026 (projeto feponto-gestao, bbeowsellckpnddirbep).
--   Conferido no banco: `produtos.mk_custo numeric` existe, com o comentário
--   deste bloco, e 0 peças preenchidas (esperado — coluna nova, sem trigger).
--   Não aparece em `list_migrations` porque foi rodado pelo SQL Editor, que
--   não grava na tabela de migrações; o mesmo vale para os blocos 5, 6 e 7.
-- Idempotente: pode rodar de novo sem estragar nada.
--
-- ⚠️ A coluna nasceu PÚBLICA e ninguém pediu isso: o grant do `anon` era de
-- tabela inteira, então no mesmo dia o `mk_custo` já respondia pela chave do
-- site, junto com custo, margem e fornecedor. Fechado pelo bloco-9. Coluna
-- nova daqui pra frente nasce fechada.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE ISTO EXISTE
--
-- Até aqui o `indice` era digitado à mão em cada peça, e o custo saía de
-- `indice × cotacao_compra`. Só que o índice não é um dado independente:
-- ele é o peso da peça multiplicado por um fator (perda de material e mão
-- de obra do ourives). Quem cadastrava fazia essa conta na calculadora e
-- digitava o resultado — errar uma casa ali erra o custo E o preço.
--
-- Com o MK de custo a conta passa a morar no sistema:
--
--     indice = peso_gramas   × mk_custo
--     custo  = indice        × cotacao_compra      (cotação de custo)
--     preco  = indice        × cotacao_venda × markup
--
-- Ou seja: custo = peso × mk_custo × cotação de custo, que é o que a tela
-- mostra na seção "Custo".
--
-- Em par de aliança a conta vale para as duas peças, com o MESMO mk_custo:
--     par_indice = par_peso_gramas × mk_custo
-- e o índice do par continua sendo a soma dos dois, como no bloco-3.
--
-- ───────────────────────────────────────────────────────────────────
-- O QUE **NÃO** MUDA (de propósito)
--
-- 1) `indice` continua sendo VALOR GRAVADO, não coluna calculada. O
--    `recalcular_precos_ouro()` (bloco-3 / bloco-6) lê `indice` e `markup`
--    do banco e segue funcionando sem alteração nenhuma.
--
-- 2) NÃO existe trigger derivando `indice` de `peso_gramas × mk_custo`.
--    Mesma razão do markup da Luar: trigger reescreveria o índice a cada
--    UPDATE da linha (trocar foto, marcar visível no site) e remarcaria a
--    peça sozinha. A conta vive na tela, onde a Fernanda vê o custo e o
--    preço mudarem antes de salvar.
--
-- 3) As ~peças já cadastradas ficam com `mk_custo` nulo e o índice que
--    têm hoje. O ERP detecta isso e mantém o índice em modo manual ao
--    abrir a peça para editar — recalcular às cegas zeraria o preço de
--    quem não tem peso preenchido.
-- ═══════════════════════════════════════════════════════════════════

alter table public.produtos
  add column if not exists mk_custo numeric;

comment on column public.produtos.mk_custo is
  'Multiplicador de custo sobre o peso: indice = peso_gramas × mk_custo (e par_indice = par_peso_gramas × mk_custo). Cobre perda de material e mão de obra. Sem trigger: a conta é feita no ERP e o indice é gravado. Ver sql/bloco-8-mk-custo.sql.';

-- ───────────────────────────────────────────────────────────────────
-- Conferência (não altera nada)
-- ───────────────────────────────────────────────────────────────────
-- Coluna criada?
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'produtos' and column_name = 'mk_custo';

-- Quais peças já batem com a conta (indice = peso × mk_custo)?
-- select id, nome, peso_gramas, mk_custo, indice,
--        round(peso_gramas * mk_custo, 4) as indice_calculado
--   from public.produtos
--  where ativo = true and mk_custo is not null and peso_gramas is not null
--    and abs(coalesce(indice, 0) - round(peso_gramas * mk_custo, 4)) > 0.0001;
-- Espera-se ZERO linhas: qualquer linha aqui é peça salva com índice
-- sobrescrito à mão (o lápis da tela), o que é permitido mas raro.

-- Peças antigas, sem MK de custo — vão continuar com o índice digitado:
-- select count(*) from public.produtos where ativo = true and mk_custo is null;
