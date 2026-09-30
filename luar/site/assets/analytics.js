/* ============================================================================
   Luar Acessórios — Google Analytics 4

   COMO LIGAR (1 linha): cole o ID de medição da propriedade entre as aspas do
   `ID` abaixo. Ele tem a forma G-XXXXXXXXXX e sai em
   Analytics > Administrador > Fluxos de dados > (o fluxo da web).
   Enquanto o `ID` estiver vazio este arquivo não faz NADA: não carrega script
   de terceiro, não cria cookie, não erra no console.
   Depois de colar, publicar com `.\deploy-cloudflare.ps1 -Projeto luar-site`.

   ── Por que existe este arquivo, em vez do trecho que o Google manda colar ──

   1) O snippet oficial tem um <script> INLINE, e o CSP deste site não permite
      script inline de propósito (`script-src` sem 'unsafe-inline', item 12 do
      SEGURANCA-PENTEST.md). Colado direto no HTML ele é bloqueado pelo
      navegador e não mede nada — sem erro visível na página, só no console.
      Aqui o mesmo código vive num .js servido pelo próprio site, o que o CSP
      aceita, e a política continua fechada.

   2) O ID mora em UM lugar. O snippet oficial repete o ID dentro da URL do
      script, em toda página: com 9 páginas, trocar de propriedade viraria 9
      edições e um esquecimento garantido. Aqui as páginas só apontam para este
      arquivo, e é ele que monta a URL com o ID.

   ⚠️ O CSP precisou de 3 origens novas (`site/_headers`): googletagmanager em
   `script-src` (o gtag.js), e google-analytics / analytics.google.com em
   `connect-src` e `img-src` (é para lá que o evento é enviado, por sendBeacon
   ou por pixel). Sem elas o script carrega e os dados não saem.

   ── Escolhas de configuração ──

   `allow_google_signals: false` e `allow_ad_personalization_signals: false`
   desligam a parte de publicidade do GA4: sem público para remarketing, sem
   dado cruzado com a conta Google de quem visita. Fica medição de audiência,
   que é o que a Luana quer ("quantas pessoas estão no site"), e é o uso mais
   fácil de sustentar sob a LGPD. Se um dia entrar Google Ads com remarketing,
   é aqui que se reabre — e aí a política de privacidade tem que dizer isso.

   NÃO respeitamos o Do Not Track do navegador: o GA também não, por padrão, e
   ligar isso aqui faria a contagem ficar menor que a real sem explicação
   aparente. Se quiser mudar, é uma linha, mas saiba o efeito.
   ============================================================================ */
(function () {
  'use strict';

  var ID = '';

  if (!ID) return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
})();
