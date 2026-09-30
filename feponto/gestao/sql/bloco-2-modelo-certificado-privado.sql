-- ═══════════════════════════════════════════════════════════════════
-- Fê Ponto — modelo do certificado sai de público para bucket privado
--
-- STATUS: ESCRITO EM 29/07/2026.
-- Rodar no Supabase → feponto-gestao → SQL Editor.
--
-- ───────────────────────────────────────────────────────────────────
-- POR QUE ISTO EXISTE
--
-- ANTES: o modelo do certificado foi publicado em `public/` do ERP, o que no
--        Cloudflare Pages significa arquivo estático servido SEM login —
--        `feponto-gestao.pages.dev/certificado-modelo.pdf` devolvia 200 para
--        qualquer pessoa. Na prática, o certificado de garantia em branco da
--        marca ficava disponível para download e falsificação.
--
-- DEPOIS: o modelo mora em bucket privado e é baixado pelo ERP com a sessão do
--         usuário. Sem login, o Storage devolve erro — a proteção passa a ser
--         RLS, igual ao resto do ERP (itens 5 e 6 do SEGURANCA-PENTEST.md).
--
-- O bucket `produtos` (fotos das peças, público de propósito, usado pelo site)
-- NÃO é tocado.
-- ═══════════════════════════════════════════════════════════════════

-- 1) bucket privado
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do update set public = false;

-- 2) leitura só para conta logada.
--    Quando o bloco-1 (gate de staff) for aplicado, trocar por
--    `using (bucket_id = 'documentos' and public.eh_staff())` para ficar no
--    mesmo nível das 12 tabelas do ERP.
drop policy if exists "documentos leitura interna" on storage.objects;
create policy "documentos leitura interna"
  on storage.objects for select to authenticated
  using (bucket_id = 'documentos');

-- 3) NENHUMA política de insert/update/delete: o conteúdo é semeado uma vez
--    (pelo painel ou por service_role) e depois é só leitura. Anon não tem
--    política nenhuma, então não lê nem escreve.

-- ═══════════════════════════════════════════════════════════════════
-- SUBIR O ARQUIVO (uma vez)
--
--   Supabase → Storage → documentos → Upload file
--   Arrastar `PROJETO FEPONTO/modelo/certificado-modelo.pdf` na raiz do bucket.
--   Sem criar pasta e sem renomear: o código busca exatamente
--   `certificado-modelo.pdf`.
-- ═══════════════════════════════════════════════════════════════════

-- VERIFICAÇÃO — rodar depois de aplicar:
--
--   -- bucket deve estar public = false
--   select id, public from storage.buckets where id = 'documentos';
--
--   -- deve existir só a política de select para authenticated
--   select policyname, cmd, roles::text from pg_policies
--    where schemaname = 'storage' and tablename = 'objects'
--      and policyname like 'documentos%';
--
--   -- com a anon key, isto deve falhar (403/400) e com sessão deve baixar:
--   --   supabase.storage.from('documentos').download('certificado/modelo.pdf')
