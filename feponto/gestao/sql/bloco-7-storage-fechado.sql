-- ═══════════════════════════════════════════════════════════════════
-- Fê Ponto — fechar o bucket `produtos` (listagem pública + gate de staff)
--
-- STATUS: ESCRITO E APLICADO EM 02/08/2026 (feponto-gestao).
-- Idempotente: pode rodar de novo sem erro.
--
-- ───────────────────────────────────────────────────────────────────
-- O QUE ESTAVA ERRADO
--
-- Duas coisas, achadas em 02/08/2026 pelo `get_advisors` e confirmadas na
-- unha com a chave pública do site.
--
-- 1) LISTAGEM ABERTA. Existia uma política `produtos_select_public` dando
--    SELECT em `storage.objects` para a role `public`. Bucket público NÃO
--    precisa disso pra servir imagem — a URL `/object/public/...` não passa
--    por RLS. O único efeito prático da política era liberar o `list`:
--
--      POST /storage/v1/object/list/produtos   (só com a anon key)
--      -> devolvia os 242 arquivos do bucket
--
--    Dos 242, 213 estavam no site e **29 não**: peça não publicada, peça já
--    removida, foto descartada. Ou seja, dava pra ver o que a loja ainda não
--    tinha lançado. A anon key está no JavaScript do site, à vista — ela é
--    pública POR DESIGN, quem protege é o RLS. Era o RLS que estava largo.
--
--    A loja da Luar já estava certa: nenhuma política de SELECT no bucket, e
--    as fotos aparecem normalmente. Foi o modelo usado aqui.
--
-- 2) ESCRITA SEM GATE DE STAFF. As políticas de INSERT/UPDATE/DELETE exigiam
--    só `authenticated`, sem passar por `eh_staff()`. O `bloco-1` fechou as 12
--    tabelas atrás de `eh_staff()` (conta nasce inativa e não enxerga nada até
--    alguém marcar `profiles.ativo = true`) — mas o Storage ficou de fora.
--    Resultado: uma conta inativa, bloqueada em todas as tabelas, ainda podia
--    subir e APAGAR foto de peça. Aqui isso é alinhado com o resto.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE REMOVER O SELECT NÃO QUEBRA O SITE
--
-- Bucket marcado como público tem dois caminhos de leitura, e só um passa
-- por RLS:
--
--   /object/public/produtos/<arquivo>   -> NÃO passa por RLS  (é o que o site usa)
--   /object/list/produtos               -> passa por RLS      (é o que vazava)
--
-- O site e o ERP montam a URL com `getPublicUrl()`, que gera sempre a
-- primeira forma. Nenhum código dos 4 projetos chama `.list()` — conferido
-- por varredura antes de aplicar. Por isso dá pra derrubar o SELECT sem
-- tocar em uma linha de front.
--
-- ⚠️ Se algum dia alguém precisar listar o bucket pelo app, NÃO recriar a
-- política para `public`. Criar para `authenticated` + `eh_staff()`, igual às
-- de escrita abaixo.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Derruba a listagem pública ────────────────────────────────────
drop policy if exists "produtos_select_public" on storage.objects;

-- ── 2. Escrita só para staff ativo (alinha com o bloco-1) ────────────
drop policy if exists "produtos_insert_auth" on storage.objects;
drop policy if exists "produtos_update_auth" on storage.objects;
drop policy if exists "produtos_delete_auth" on storage.objects;

create policy "produtos: staff insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produtos' and public.eh_staff());

create policy "produtos: staff update" on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos' and public.eh_staff());

create policy "produtos: staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos' and public.eh_staff());

-- ═══════════════════════════════════════════════════════════════════
-- COMO CONFERIR QUE FUNCIONOU
--
--   curl -sS -X POST \
--     "https://bbeowsellckpnddirbep.supabase.co/storage/v1/object/list/produtos" \
--     -H "apikey: <anon>" -H "Authorization: Bearer <anon>" \
--     -H "Content-Type: application/json" -d '{"prefix":"","limit":200}'
--
--   Antes:  devolvia 242 arquivos
--   Depois: devolve []
--
-- E abrir o site: as fotos do catálogo têm que continuar aparecendo. Se
-- sumirem, o bucket deixou de ser público — confira em Storage → produtos →
-- Settings → Public bucket.
-- ═══════════════════════════════════════════════════════════════════
