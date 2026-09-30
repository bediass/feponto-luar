-- ═══════════════════════════════════════════════════════════════════
-- Fê Ponto — aliança vendida como PAR (duas peças em um só produto)
--
-- STATUS: ESCRITO E APLICADO EM 30/07/2026 (feponto-gestao).
-- Idempotente: pode rodar de novo sem estragar nada.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE ISTO EXISTE
--
-- Aliança quase sempre sai em par, e as duas peças não são iguais: cada
-- uma tem seu aro, sua largura, sua espessura, seu peso e — o que importa
-- para o preço — seu ÍNDICE de ouro. Antes disso, cadastrar um par exigia
-- duas linhas em `produtos`, o que quebrava o estoque (2 unidades para algo
-- que sai junto) e o site (dois cards para a mesma aliança).
--
-- MODELO ESCOLHIDO: um produto = o par. A segunda peça mora em colunas
-- `par_*` da mesma linha. Estoque continua contando pares, o site continua
-- mostrando um card, e o preço do par é a soma dos dois índices:
--
--     preco_venda = (indice + par_indice) × cotação de venda × markup
--
-- Peça avulsa (`eh_par = false`) segue exatamente como antes: `par_indice`
-- fica nulo e a conta é a de sempre.
--
-- `largura_mm` e `espessura_mm` valem para qualquer peça, mas o ERP só
-- mostra os campos quando a subcategoria é Alianças — é onde a medida
-- importa. As colunas ficam disponíveis se um dia isso mudar.
--
-- O site lê estas colunas pela policy `site le produtos visiveis` (SELECT
-- de linha inteira para anon), então não é preciso grant novo.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Medidas da peça (mm) — hoje usadas só por aliança
alter table public.produtos
  add column if not exists largura_mm numeric,
  add column if not exists espessura_mm numeric;

-- 2) A segunda peça do par
alter table public.produtos
  add column if not exists eh_par boolean not null default false,
  add column if not exists par_tamanho text,
  add column if not exists par_largura_mm numeric,
  add column if not exists par_espessura_mm numeric,
  add column if not exists par_indice numeric,
  add column if not exists par_peso_gramas numeric;

comment on column public.produtos.eh_par is
  'Aliança vendida como par: as medidas da 2ª peça estão nas colunas par_*. Preço = (indice + par_indice) × cotacao_venda × markup.';
comment on column public.produtos.par_indice is
  'Índice de ouro da 2ª peça do par. Soma com indice na precificação (ver recalcular_precos_ouro).';

-- 3) Recálculo em massa da cotação passa a somar o índice do par.
--    Mesma função de antes; só a conta do preço mudou.
create or replace function public.recalcular_precos_ouro()
 returns integer
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_cot numeric;
  v_n integer;
begin
  select valor into v_cot from public.configuracoes where chave = 'cotacao_ouro';
  if v_cot is null or v_cot <= 0 then
    return 0;
  end if;

  update public.produtos
    set cotacao_venda = v_cot,
        preco_venda = round(
          (indice + case when eh_par then coalesce(par_indice, 0) else 0 end) * v_cot * markup,
          2
        )
    where ativo = true
      and preco_automatico = true
      and indice is not null and indice > 0
      and markup is not null and markup > 0;

  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

-- ───────────────────────────────────────────────────────────────────
-- Conferência (não altera nada)
-- ───────────────────────────────────────────────────────────────────
-- select column_name, data_type, column_default
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'produtos'
--    and (column_name like 'par\_%' or column_name in ('eh_par','largura_mm','espessura_mm'))
--  order by column_name;
