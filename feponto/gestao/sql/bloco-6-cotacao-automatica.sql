-- ═══════════════════════════════════════════════════════════════════
-- Fê Ponto — cotação do ouro atualiza sozinha (pg_cron + pg_net)
--
-- STATUS: ESCRITO E APLICADO EM 31/07/2026 (feponto-gestao).
-- Idempotente: pode rodar de novo sem duplicar job nem tabela.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE ISTO EXISTE
--
-- O preço que o cliente vê no site é a coluna `produtos.preco_venda` — um
-- valor GRAVADO, não uma conta feita na hora. Quem reescrevia essa coluna era
-- só o ERP, e só quando alguém abria a tela Estoque com a cotação no
-- automático. Ou seja: a loja passava uma semana sem ninguém abrir o estoque e
-- o site seguia anunciando pela cotação da semana passada. Numa peça de
-- R$ 8.000, 3% de ouro = R$ 240 saindo do bolso da Fernanda, com o preço já
-- publicado pro cliente.
--
-- Agora o banco faz isso sozinho, todo dia às 8h de Brasília, sem depender de
-- ninguém abrir tela nenhuma. O botão do ERP continua valendo pra forçar na hora.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE SÃO DOIS JOBS E NÃO UM
--
-- O `pg_net` é assíncrono POR CONSTRUÇÃO: `net.http_get()` só enfileira o
-- pedido e devolve um id. Quem dispara é um worker de fundo, e ele só enxerga
-- a fila DEPOIS do commit da transação. Então uma função que pede e espera a
-- resposta na mesma transação trava pra sempre — a resposta nunca vai chegar,
-- porque o pedido nem saiu.
--
-- Daí a divisão:
--   08:00  cotacao_buscar()  -> enfileira os GETs e guarda os request_id
--   08:05  cotacao_aplicar() -> lê as respostas, confere, grava e recalcula
--
-- Cinco minutos é folga enorme pra APIs que respondem em milissegundos.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE NÃO A MESMA FONTE DO ERP
--
-- O ERP usa a AwesomeAPI (`src/lib/cotacao.ts`) e funciona — porque roda no
-- NAVEGADOR, do IP de casa. De dentro do Supabase ela devolve
-- **HTTP 429 QuotaExceeded**: a cota é por IP e o IP de saída do Supabase é
-- compartilhado com meio mundo. Testado em 31/07/2026, não é intermitente.
--
-- Trocamos por duas fontes que respondem de lá, medidas no mesmo minuto contra
-- a AwesomeAPI (R$ 662,76/g):
--
--   gold-api.com    XAU em USD/onça, tempo real   ─┐
--   open.er-api.com USD -> BRL                    ─┴─> R$ 662,90/g  (+0,02%)
--
-- 0,02% é ruído. O robô assumir não muda preço de vitrine, que era o risco:
-- preço pulando sozinho parece defeito. (A opção de uma chamada só,
-- currency-api, deu R$ 665,33 — 0,39% acima. Preferimos a exatidão às custas
-- de uma requisição a mais.)
--
-- Consequência: o botão do ERP e o robô usam fontes diferentes. Concordam
-- dentro do ruído. Se um dia divergirem de verdade, alinhar o `cotacao.ts`
-- pra estas mesmas duas.
--
-- ───────────────────────────────────────────────────────────────────
-- AS TRAVAS (o que impede preço absurdo no site)
--
-- 1. `cotacao_auto` desligada no ERP -> não faz nada. Se a Fernanda pôs a
--    cotação na mão, o robô não atropela.
-- 2. HTTP != 200, timeout ou JSON estranho -> não grava, registra o erro.
-- 3. Entrada implausível (onça fora de US$ 500–20.000, câmbio fora de
--    R$ 1–20) -> não grava. Pega mudança de unidade na API.
-- 4. Fora da faixa R$ 100–5.000 por grama -> não grava.
-- 5. Variação acima de `cotacao_variacao_max` (10% por padrão) contra a
--    cotação atual -> NÃO grava. Ouro não anda 10% num dia em condição normal;
--    se andou, alguém olha antes. É a trava que mais importa.
--
-- Quando qualquer trava barra, o preço do site **continua o de ontem** — nunca
-- vira lixo. O motivo fica escrito em `cotacao_auto_log`. Pra forçar mesmo
-- assim: abrir o Estoque e usar o botão de sempre.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1) Limite de variação, editável sem mexer em código
-- ───────────────────────────────────────────────────────────────────
insert into public.configuracoes (chave, valor)
select 'cotacao_variacao_max', 0.10
where not exists (
  select 1 from public.configuracoes where chave = 'cotacao_variacao_max'
);

comment on table public.configuracoes is
  'Chaves usadas: cotacao_ouro (R$/g de 24k), cotacao_auto (1/0), '
  'cotacao_fator (multiplicador sobre o mercado), '
  'cotacao_variacao_max (variação diária tolerada, ex. 0.10 = 10%).';

-- ───────────────────────────────────────────────────────────────────
-- 2) Diário de bordo. Sem isto, robô que falha em silêncio é pior que
--    robô nenhum — ninguém descobre que o preço parou.
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.cotacao_auto_log (
  id            bigint generated always as identity primary key,
  pedido_em     timestamptz not null default now(),
  aplicado_em   timestamptz,
  req_ouro      bigint,       -- request_id do GET de XAU/USD
  req_cambio    bigint,       -- request_id do GET de USD/BRL
  status        text not null default 'pendente',
    -- pendente | ok | ignorado | erro
  detalhe       text,
  usd_onca      numeric,      -- o que veio de cada fonte, pra auditar depois
  usd_brl       numeric,
  cotacao_ant   numeric,
  cotacao_nova  numeric,
  pecas         integer
);

comment on table public.cotacao_auto_log is
  'Uma linha por tentativa do robô da cotação. status: pendente (pedidos no ar), '
  'ok (gravou e recalculou), ignorado (trava barrou, preço mantido), erro (falhou).';

create index if not exists idx_cotacao_log_pedido on public.cotacao_auto_log(pedido_em desc);

-- Tabela em `public` é tabela que o PostgREST publica. Sem RLS, a chave
-- anônima do site leria e escreveria isto. Mesmo gate do bloco-1.
alter table public.cotacao_auto_log enable row level security;

drop policy if exists "staff total" on public.cotacao_auto_log;
create policy "staff total" on public.cotacao_auto_log
  for all to authenticated
  using (public.eh_staff()) with check (public.eh_staff());

revoke all on public.cotacao_auto_log from anon;

-- ───────────────────────────────────────────────────────────────────
-- 3) Passo 1 — enfileira os dois pedidos HTTP
-- ───────────────────────────────────────────────────────────────────
create or replace function public.cotacao_buscar()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_auto   numeric;
  v_ouro   bigint;
  v_cambio bigint;
begin
  select valor into v_auto from public.configuracoes where chave = 'cotacao_auto';

  if coalesce(v_auto, 0) <> 1 then
    insert into public.cotacao_auto_log (status, detalhe)
    values ('ignorado', 'Cotação está em modo manual no ERP — robô não mexe.');
    return;
  end if;

  select net.http_get('https://api.gold-api.com/price/XAU',
                      timeout_milliseconds := 8000) into v_ouro;
  select net.http_get('https://open.er-api.com/v6/latest/USD',
                      timeout_milliseconds := 8000) into v_cambio;

  insert into public.cotacao_auto_log (req_ouro, req_cambio, status)
  values (v_ouro, v_cambio, 'pendente');
end;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 4) Passo 2 — lê as respostas, confere as travas, grava e recalcula
-- ───────────────────────────────────────────────────────────────────
create or replace function public.cotacao_aplicar()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_log     public.cotacao_auto_log%rowtype;
  r_ouro    net._http_response%rowtype;
  r_cambio  net._http_response%rowtype;
  v_auto    numeric;
  v_fator   numeric;
  v_limite  numeric;
  v_atual   numeric;
  v_onca    numeric;
  v_brl     numeric;
  v_nova    numeric;
  v_pecas   integer;
  v_motivo  text;
begin
  -- pendências velhas (resposta que nunca chegou) não ficam penduradas
  update public.cotacao_auto_log
     set status = 'erro', aplicado_em = now(),
         detalhe = 'Resposta não chegou; pedido expirado.'
   where status = 'pendente' and pedido_em < now() - interval '1 hour';

  select * into v_log from public.cotacao_auto_log
   where status = 'pendente' and req_ouro is not null
   order by pedido_em desc limit 1;

  if not found then
    return;   -- nada a aplicar. Silêncio aqui é normal (ex.: modo manual).
  end if;

  select * into r_ouro   from net._http_response where id = v_log.req_ouro;
  select * into r_cambio from net._http_response where id = v_log.req_cambio;

  -- ── falhas de transporte ────────────────────────────────────────
  v_motivo := case
    when r_ouro.id is null or r_cambio.id is null then
      'Resposta ainda não estava pronta 5 min depois do pedido.'
    when r_ouro.timed_out or r_cambio.timed_out then
      'Timeout na consulta.'
    when r_ouro.status_code is distinct from 200 then
      'Ouro respondeu HTTP ' || coalesce(r_ouro.status_code::text, '?') ||
      coalesce(' — ' || r_ouro.error_msg, '')
    when r_cambio.status_code is distinct from 200 then
      'Câmbio respondeu HTTP ' || coalesce(r_cambio.status_code::text, '?') ||
      coalesce(' — ' || r_cambio.error_msg, '')
    else null
  end;

  if v_motivo is not null then
    update public.cotacao_auto_log
       set status='erro', aplicado_em=now(), detalhe=v_motivo where id = v_log.id;
    return;
  end if;

  -- ── leitura do JSON (malformado não pode derrubar o job) ────────
  begin
    v_onca := (r_ouro.content::jsonb ->> 'price')::numeric;
  exception when others then v_onca := null; end;

  begin
    v_brl := (r_cambio.content::jsonb -> 'rates' ->> 'BRL')::numeric;
  exception when others then v_brl := null; end;

  select valor into v_auto   from public.configuracoes where chave='cotacao_auto';
  select valor into v_fator  from public.configuracoes where chave='cotacao_fator';
  select valor into v_limite from public.configuracoes where chave='cotacao_variacao_max';
  select valor into v_atual  from public.configuracoes where chave='cotacao_ouro';

  -- 31.1035 g por onça troy — mesma constante do ERP
  if v_onca is not null and v_brl is not null then
    v_nova := round(v_onca * v_brl / 31.1035 * coalesce(nullif(v_fator, 0), 1), 2);
  end if;

  -- ── travas de valor ─────────────────────────────────────────────
  v_motivo := case
    when coalesce(v_auto, 0) <> 1 then
      'Cotação virou manual no ERP entre o pedido e a aplicação.'
    when v_onca is null then 'Não achei o preço da onça na resposta do ouro.'
    when v_brl  is null then 'Não achei o BRL na resposta do câmbio.'
    when v_onca < 500 or v_onca > 20000 then
      'Onça a US$ ' || v_onca || ' é implausível — a API deve ter mudado de unidade.'
    when v_brl < 1 or v_brl > 20 then
      'Câmbio a R$ ' || v_brl || ' por dólar é implausível.'
    when v_nova is null or v_nova <= 0 or v_nova < 100 or v_nova > 5000 then
      'R$ ' || coalesce(v_nova::text, '?') || '/g está fora da faixa plausível (100–5.000).'
    when coalesce(v_atual, 0) > 0
     and abs(v_nova - v_atual) / v_atual > coalesce(v_limite, 0.10) then
      'Variação de ' || round(abs(v_nova - v_atual) / v_atual * 100, 1) ||
      '% contra R$ ' || v_atual || '/g passa do limite de ' ||
      round(coalesce(v_limite, 0.10) * 100) || '%. Preço mantido — confira na mão.'
    else null
  end;

  if v_motivo is not null then
    update public.cotacao_auto_log
       set status='ignorado', aplicado_em=now(), detalhe=v_motivo,
           usd_onca=v_onca, usd_brl=v_brl,
           cotacao_ant=v_atual, cotacao_nova=v_nova
     where id = v_log.id;
    return;
  end if;

  -- ── passou: grava e recalcula ───────────────────────────────────
  update public.configuracoes set valor = v_nova where chave = 'cotacao_ouro';
  select public.recalcular_precos_ouro() into v_pecas;

  update public.cotacao_auto_log
     set status='ok', aplicado_em=now(), usd_onca=v_onca, usd_brl=v_brl,
         cotacao_ant=v_atual, cotacao_nova=v_nova, pecas=v_pecas,
         detalhe='R$ ' || coalesce(v_atual, 0) || '/g → R$ ' || v_nova ||
                 '/g · ' || v_pecas || ' peça(s) recalculada(s).'
   where id = v_log.id;
end;
$$;

-- Estas duas moram em `public`, então o PostgREST publicaria as duas como
-- /rpc/cotacao_buscar e /rpc/cotacao_aplicar. Quem roda é o cron, como
-- postgres — mais ninguém precisa (nem deve) chamar. Postgres dá EXECUTE a
-- PUBLIC por padrão em função nova; sem este revoke, qualquer visitante do
-- site mandaria o robô rodar na hora que quisesse.
revoke all on function public.cotacao_buscar()  from public, anon, authenticated;
revoke all on function public.cotacao_aplicar() from public, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────
-- 5) Agenda. O servidor roda em UTC: 11:00 UTC = 08:00 em Brasília.
--    Reagendar é só rodar de novo com outro horário — o pg_cron troca o job
--    de mesmo nome em vez de criar um segundo.
-- ───────────────────────────────────────────────────────────────────
select cron.schedule('cotacao-ouro-buscar',  '0 11 * * *', 'select public.cotacao_buscar()');
select cron.schedule('cotacao-ouro-aplicar', '5 11 * * *', 'select public.cotacao_aplicar()');

-- ═══════════════════════════════════════════════════════════════════
-- O QUE FOI TESTADO EM 31/07/2026 (antes de deixar rodando)
-- ═══════════════════════════════════════════════════════════════════
-- 1. Ciclo completo: R$ 662,80/g -> R$ 662,35/g, 52 peças recalculadas, e o
--    site passou a servir os preços novos. Confirmado pela chave pública.
-- 2. Trava de variação: com a cotação forçada pra R$ 400/g, o robô calculou
--    R$ 662,35 (+65,6%), RECUSOU e não gravou. As 52 peças continuaram na
--    cotação anterior.
-- 3. Modo manual: com `cotacao_auto = 0`, nem chegou a fazer requisição.
-- 4. O agendador de verdade: um job de teste a cada minuto rodou
--    `cotacao_buscar()` e o `cron.job_run_details` marcou `succeeded`. Rodar
--    na mão como postgres não provava que o cron consegue.
-- 5. Segurança: `anon` e `authenticated` NÃO têm execute nas duas funções, e
--    `cotacao_auto_log` está com RLS e política de staff.
--
-- ═══════════════════════════════════════════════════════════════════
-- CONFERÊNCIA (não altera nada)
-- ═══════════════════════════════════════════════════════════════════
-- -- os dois jobs, ativos?
-- select jobname, schedule, active, command from cron.job order by jobname;
--
-- -- o robô está trabalhando? (é aqui que se olha quando o preço "parou")
-- select pedido_em at time zone 'America/Sao_Paulo' as quando,
--        status, detalhe, cotacao_ant, cotacao_nova, pecas
--   from public.cotacao_auto_log order by pedido_em desc limit 20;
--
-- -- o cron chegou a rodar? (erro de execução aparece aqui, não no log acima)
-- select jobid, start_time, status, return_message
--   from cron.job_run_details order by start_time desc limit 20;
--
-- ═══════════════════════════════════════════════════════════════════
-- DESLIGAR (sem apagar nada)
-- ═══════════════════════════════════════════════════════════════════
-- select cron.unschedule('cotacao-ouro-buscar');
-- select cron.unschedule('cotacao-ouro-aplicar');
--
-- Ou, sem mexer em SQL: desligar a cotação automática no ERP. O robô respeita.
