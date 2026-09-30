-- ═══════════════════════════════════════════════════════════════════
-- Fê Ponto — venda enviada pelos Correios
--
-- STATUS: ESCRITO E APLICADO EM 31/07/2026 (feponto-gestao).
-- Idempotente: pode rodar de novo sem estragar nada.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE ISTO EXISTE
--
-- Nem toda venda sai da loja na mão do cliente: parte vai pelos Correios, e
-- até agora o sistema não tinha onde guardar o código de rastreio nem como
-- saber o que ainda falta postar. A informação vivia no WhatsApp.
--
-- Marcando a venda como "será enviado", ela entra na tela **Envios** com o
-- endereço, o campo de rastreio e a baixa de entrega. Mesmo desenho que a
-- Luar já usa (`Luar Acessórios/supabase/migrations/0012_venda_envio.sql`).
--
-- O `registrar_venda` NÃO foi tocado de propósito: é a função que mexe em
-- estoque, caixa e contas a receber, e trocar a assinatura dela por causa de
-- endereço seria risco desproporcional. O ERP grava os campos de envio num
-- update logo depois de registrar a venda — se esse update falhar, a venda
-- está salva do mesmo jeito e é só reabrir e marcar de novo.
--
-- Endereço em jsonb, como o `endereco` do cliente.
-- ═══════════════════════════════════════════════════════════════════

alter table public.vendas
  add column if not exists precisa_envio   boolean not null default false,
  add column if not exists envio_status    text
    check (envio_status is null or envio_status in ('a_enviar','enviado','entregue')),
  add column if not exists codigo_rastreio text,
  add column if not exists rastreio_url    text,
  add column if not exists enviado_em      timestamptz,
  add column if not exists entregue_em     timestamptz,
  add column if not exists endereco_envio  jsonb;

-- A tela Envios lista só o que precisa sair; o índice parcial cobre a fila
-- inteira sem carregar o resto da tabela.
create index if not exists idx_vendas_envio on public.vendas(precisa_envio) where precisa_envio;

comment on column public.vendas.precisa_envio is
  'Venda que sai pelos Correios. Liga a venda na tela Envios do ERP.';
comment on column public.vendas.envio_status is
  'a_enviar | enviado | entregue. Nulo quando a venda não é enviada.';

-- ───────────────────────────────────────────────────────────────────
-- Conferência (não altera nada)
-- ───────────────────────────────────────────────────────────────────
-- select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='vendas'
--    and column_name in ('precisa_envio','envio_status','codigo_rastreio',
--                        'rastreio_url','enviado_em','entregue_em','endereco_envio');
