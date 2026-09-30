  (function () {
    "use strict";

    // Faixa de vantagens: duplica o conteúdo até preencher e cria o loop contínuo (-50%)
    var mq = document.getElementById("marqueeTrack");
    if (mq) {
      var base = mq.innerHTML, guard = 0;
      while (mq.scrollWidth < window.innerWidth * 2 && guard < 24) { mq.innerHTML += base; guard++; }
      mq.innerHTML += mq.innerHTML;
    }

    var rail = document.getElementById("railNovidades");
    if (!window.Loja) return;

    /* ---------- Kits em destaque (3 espaços) ----------
       Vêm da view `kits_site`, ordenados por `destaque_ordem`. O banco
       garante que são no máximo 3 (índice único parcial — 0016_kits.sql),
       mas o slice(0,3) fica como cinto de segurança: se um dia o grid
       mudar, é aqui que se percebe, não na home torta do cliente. */
    // try/catch de propósito: esta seção é acessório da home. Um erro aqui já
    // derrubou as Novidades uma vez (02/08/2026) — o bloco roda antes do
    // `carregarProdutos()` e a exceção subiu, matando o resto do arquivo.
    // Acessório não pode levar o principal junto.
    try { kitsDestaque(); } catch (err) {
      if (window.console) console.error("Kits em destaque:", err);
    }

    function kitsDestaque() {
      var alvo = document.getElementById("kitsDestaque");
      var secao = document.getElementById("kits");
      // `Loja.sb` é FÁBRICA, não cliente: tem que chamar pra obter o client.
      var cli = Loja.sb();
      if (!alvo || !secao || !cli) return;

      var GEMA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12l3 5-9 13L3 8l3-5Z"/><path d="M3 8h18"/></svg>';

      cli.from("kits_site").select("*").eq("destaque_site", true)
        .order("destaque_ordem", { ascending: true })
        .then(function (r) {
          var kits = (r && r.data ? r.data : []).slice(0, 3);
          if (!kits.length) return;   // seção continua escondida

          alvo.innerHTML = kits.map(function (k) {
            var temFoto = k.foto_urls && k.foto_urls.length && k.foto_urls[0];
            var media = temFoto
              ? '<img src="' + Loja.esc(k.foto_urls[0]) + '" alt="' + Loja.esc(k.nome) + '" loading="lazy" width="400" height="250" />'
              : GEMA;
            var tarja = k.selo
              ? '<span class="tag">' + Loja.esc(k.selo) + "</span>"
              : (k.economia_centavos > 0 ? '<span class="tag tag--line">economize ' + Loja.money(k.economia_centavos) + "</span>" : "");
            var preco = "<b>" + Loja.money(k.preco_centavos) + "</b>" +
              (k.economia_centavos > 0 ? " <s>" + Loja.money(k.soma_pecas_centavos) + "</s>" : "");
            return '<article class="kit reveal">' +
              '<div class="kit__media">' + media + "</div>" + tarja +
              '<h3 class="kit__name">' + Loja.esc(k.nome) + "</h3>" +
              '<p class="kit__desc">' + Loja.esc(k.subtitulo || "") + "</p>" +
              '<div class="kit__foot"><span class="kit__price">' + preco + "</span>" +
              '<a class="btn btn--outline btn--sm" href="kits.html">Ver</a></div>' +
              "</article>";
          }).join("");

          // Mesma regra de proporção da página de produto (entre 1:1 e 3:4).
          alvo.querySelectorAll(".kit__media img").forEach(function (img) {
            Loja.ajustarProporcao(img, img.closest(".kit__media"));
          });

          secao.hidden = false;
          Loja.observarReveal(secao);
        })
        .catch(function (err) {
          // Falhar aqui não pode derrubar a home: a seção simplesmente não
          // aparece, e o resto da página (novidades, hero) segue normal.
          if (window.console) console.error("Kits em destaque:", err);
        });
    }

    Loja.carregarProdutos().then(function (r) {
      if (r.error) throw r.error;
      var disponiveis = r.prods.filter(function (p) { return (p.estoque || 0) > 0; }); // esgotadas não aparecem
      Loja._cross = disponiveis.slice(0, 8); // alimenta o cross-sell do carrinho

      var top = disponiveis.slice(0, 10);
      if (!top.length) {
        rail.classList.remove("rail__track", "grid");
        rail.innerHTML =
          '<div class="state" style="grid-column:1/-1;width:100%">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M6 3h12l3 5-9 13L3 8l3-5Z"/><path d="M3 8h18"/></svg>' +
          '<h3>Coleção em breve</h3><p>As primeiras peças entram em breve. Enquanto isso, entre na lista e garanta 10% na estreia.</p></div>';
        document.getElementById("novPrev").style.display = "none";
        document.getElementById("novNext").style.display = "none";
        return;
      }
      rail.innerHTML = top.map(Loja.cardHTML).join("");
      Loja.observarReveal(rail);

      var novPrev = document.getElementById("novPrev");
      var novNext = document.getElementById("novNext");
      var step = function () { var c = rail.querySelector(".card"); return (c ? c.offsetWidth : 260) + 20; };
      novPrev.addEventListener("click", function () { rail.scrollBy({ left: -step() * 1.3, behavior: "smooth" }); });
      novNext.addEventListener("click", function () { rail.scrollBy({ left: step() * 1.3, behavior: "smooth" }); });

      // as setas só aparecem quando há rolagem de verdade; com poucas peças elas
      // sumam (senão ficariam em cima do produto)
      function ajustarSetas() {
        var rola = rail.scrollWidth > rail.clientWidth + 4;
        novPrev.style.display = rola ? "" : "none";
        novNext.style.display = rola ? "" : "none";
      }
      ajustarSetas();
      window.addEventListener("resize", ajustarSetas);

      // Nada de listener de wheel aqui. Existia um que dava preventDefault e
      // refazia a rolagem com window.scrollBy — e era isso que deixava o scroll
      // pesado sobre as fotos: matava a inércia nativa e travava o compositor.
      // Quem resolve é o CSS: overflow-y:hidden no .rail__track faz o trilho
      // deixar de ser rolável na vertical, então o navegador entrega a roda
      // pra página sozinho.
    }).catch(function (err) {
      if (window.console) console.error("Loja:", err);
      rail.classList.remove("rail__track", "grid");
      rail.innerHTML = '<div class="state" style="width:100%"><h3>Não deu pra carregar agora</h3><p>Recarregue a página em instantes.</p></div>';
    });
  })();
