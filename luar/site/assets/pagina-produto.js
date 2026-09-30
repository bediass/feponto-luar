(function () {
  "use strict";
  if (!window.Loja) return;
  var L = window.Loja, TAX = L.TAXONOMIA, esc = L.esc, money = L.money, IC = L.IC;
  var el = function (id) { return document.getElementById(id); };
  var wrap = el("produtoWrap"), crumb = el("crumb");

  var params = new URLSearchParams(location.search);
  var ehDemo = params.get("demo") === "1";
  var slug = params.get("slug") || (ehDemo ? L.DEMO[0].slug : "");
  var sufDemo = ehDemo ? "&demo=1" : "";

  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/[áàâãä]/g, "a").replace(/[éèêë]/g, "e").replace(/[íìîï]/g, "i")
      .replace(/[óòôõö]/g, "o").replace(/[úùûü]/g, "u").replace(/ç/g, "c").replace(/ñ/g, "n");
  }
  function principalDe(cat) {
    var n = norm(cat);
    for (var i = 0; i < TAX.length; i++) {
      var t = TAX[i];
      if (norm(t.nome) === n) return t.nome;
      for (var j = 0; j < t.subs.length; j++) if (norm(t.subs[j]) === n) return t.nome;
    }
    return null;
  }

  var svgCard = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/></svg>';
  var svgShield = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4-3 6.5-7 9-4-2.5-7-5-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>';
  // O próprio botão já é a bolinha, então o ícone é só o "i": ponto + haste.
  var svgInfo = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 10.5v6.4"/><path d="M12 7h.01"/></svg>';

  var AVISO_IMAGEM = "As imagens das peças são produzidas para representar o produto com a maior fidelidade possível. No entanto, pequenas variações de cor podem ocorrer devido às configurações de brilho e resolução de cada tela. Por se tratar de uma peça com características naturais e/ou produzida artesanalmente, detalhes, tonalidades e medidas podem apresentar pequenas variações.";

  var avisoHTML =
    '<div class="pdp__info" id="avisoImagem">' +
      '<button class="pdp__info-btn" type="button" id="avisoBtn" aria-expanded="false" aria-controls="avisoTexto">' +
        svgInfo + '<span class="sr-only">Sobre as imagens das peças</span>' +
      '</button>' +
      '<div class="pdp__info-panel" id="avisoTexto">' +
        '<button class="pdp__info-x" type="button" id="avisoFechar" aria-label="Fechar aviso">' + IC.x + '</button>' +
        '<p>' + esc(AVISO_IMAGEM) + '</p>' +
      '</div>' +
    '</div>';

  /* Abre no hover (desktop) e no toque (celular).
     `fixo` separa os dois: aberto por hover fecha sozinho ao tirar o mouse,
     aberto por clique/teclado só fecha no X, no Esc ou clicando fora. Sem essa
     distinção, quem clicasse no desktop perderia o texto ao mover o ponteiro.
     Esc e clique fora existem por WCAG 1.4.13 (conteúdo em hover/foco precisa
     ser dispensável sem tirar o ponteiro do lugar). */
  function ligarAviso() {
    var box = el("avisoImagem");
    if (!box) return;
    var btn = el("avisoBtn");
    var podeHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var fixo = false;
    var devolvendoFoco = false;

    function aberto() { return box.classList.contains("is-open"); }
    function abrir(pin) {
      if (pin) fixo = true;
      box.classList.add("is-open");
      box.classList.toggle("is-pinned", fixo);
      btn.setAttribute("aria-expanded", "true");
    }
    function fechar() {
      fixo = false;
      box.classList.remove("is-open", "is-pinned");
      btn.setAttribute("aria-expanded", "false");
    }

    // Fechar e devolver o foco ao botão reabriria tudo na hora, porque focar o
    // botão é justamente um dos gatilhos de abertura. A trava cobre esse trecho.
    function fecharEFocar() {
      fechar();
      devolvendoFoco = true;
      btn.focus();
      devolvendoFoco = false;
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();          // senão o handler de clique-fora fecha na sequência
      if (aberto() && fixo) fechar(); else abrir(true);
    });
    el("avisoFechar").addEventListener("click", function (e) {
      e.stopPropagation();
      fecharEFocar();
    });

    if (podeHover) {
      box.addEventListener("mouseenter", function () { abrir(false); });
      box.addEventListener("mouseleave", function () { if (!fixo) fechar(); });
      btn.addEventListener("focus", function () { if (!devolvendoFoco) abrir(false); });
    }
    box.addEventListener("focusout", function (e) {
      if (!fixo && !box.contains(e.relatedTarget)) fechar();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && aberto()) fecharEFocar();
    });
    document.addEventListener("click", function (e) {
      if (aberto() && !box.contains(e.target)) fechar();
    });
  }

  // Só Prata 925. Existia aqui um segundo ramo, com texto automático para um
  // metal que a Luar NÃO vende, sobra de quando o catálogo previa outros
  // materiais: bastava uma peça cadastrada com ele pra página contradizer a
  // própria marca. Removido em 11/08/2026 — a história completa está em
  // docs/PLANO-SITE.md e no CLAUDE.md. Conferido no banco no mesmo dia: 249
  // peças no site, 100% prata 925 (136 com banho de ródio, 77 de ouro, 36 de
  // ouro 18k).
  // Se um dia entrar outro metal, o texto dele volta AQUI, e a "Sobre nós"
  // (que diz "exclusivamente Prata 925") tem que ser reescrita no mesmo dia.
  function cuidados(material) {
    var base = "Evite contato com perfume, cremes e produtos de limpeza. Guarde separada em local seco e limpe com flanela macia. ";
    if (norm(material).indexOf("prata") >= 0) return "Peça em prata 925. Com o tempo a prata pode escurecer levemente, é natural e volta ao brilho com polimento. " + base;
    return base;
  }

  function renderProduto(p) {
    document.title = p.nome + " | Luar Acessórios";

    // Canônico da peça. As outras páginas trazem o <link rel="canonical"> escrito
    // no HTML, mas aqui o endereço só se conhece em tempo de execução, porque a
    // peça vem do ?slug=. Sem isso o Google vê a mesma produto.html servida em
    // luaracessoriosbh.com.br, no www e no luar-site.pages.dev, e trata as três
    // como páginas concorrentes.
    if (p.slug) {
      var lk = document.querySelector('link[rel="canonical"]');
      if (!lk) {
        lk = document.createElement("link");
        lk.setAttribute("rel", "canonical");
        document.head.appendChild(lk);
      }
      lk.setAttribute("href", "https://luaracessoriosbh.com.br/produto?slug=" + encodeURIComponent(p.slug));
    }

    var sem = (p.estoque || 0) <= 0;
    var parc = L.parcelaTexto(p.preco_centavos);
    var principal = principalDe(p.categoria) || p.categoria;

    crumb.innerHTML = '<a href="index.html">Início</a><i>/</i><a href="loja.html">Produtos</a>' +
      (principal ? '<i>/</i><a href="loja.html?cat=' + encodeURIComponent(principal) + '">' + esc(principal) + '</a>' : "") +
      '<i>/</i><span>' + esc(p.nome) + '</span>';

    /* A peça pode ter várias fotos cadastradas no ERP (foto_urls). Até
       25/08/2026 aqui só entrava a capa (imagem_url) e as outras não apareciam
       em lugar nenhum do site. Agora a capa vai na moldura grande e as demais
       viram miniaturas clicáveis embaixo. Uma foto só = nenhuma miniatura. */
    var fotos = L.fotosDe(p);
    var media = fotos.length
      ? '<img src="' + esc(fotos[0]) + '" alt="' + esc(p.nome) + '" />'
      : '<div class="pdp__media-fallback">' + IC.gem + '</div>';

    var thumbs = fotos.length > 1
      ? '<div class="pdp__thumbs" id="pdpThumbs" role="group" aria-label="Fotos da peça">' +
          fotos.map(function (u, i) {
            return '<button type="button" class="pdp__thumb' + (i === 0 ? " is-active" : "") + '"' +
              ' data-src="' + esc(u) + '" aria-pressed="' + (i === 0 ? "true" : "false") + '">' +
              '<img src="' + esc(u) + '" alt="Foto ' + (i + 1) + ' de ' + esc(p.nome) + '" loading="lazy" />' +
            '</button>';
          }).join("") +
        '</div>'
      : "";

    var buy = sem
      ? '<div class="pdp__buy"><button class="btn btn--outline btn--lg" disabled>Esgotado</button></div>' +
        '<p class="pdp__parc">Essa peça está temporariamente indisponível.</p>'
      : '<div class="pdp__buy">' +
          '<div class="qty qty--lg" role="group" aria-label="Quantidade">' +
            '<button type="button" id="qtdMenos" aria-label="Diminuir">' + IC.minus + '</button>' +
            '<span class="qty__val" id="qtdProduto">1</span>' +
            '<button type="button" id="qtdMais" aria-label="Aumentar">' + IC.plus + '</button>' +
          '</div>' +
          '<button class="btn btn--gold btn--lg" ' + L.addBtnAttrs(p) + ' data-add-qty>' + IC.cart + ' Adicionar ao carrinho</button>' +
        '</div>';

    wrap.innerHTML =
      '<div class="pdp__grid">' +
        '<div class="pdp__gallery">' +
          /* O .pdp__stage existe pra o aviso "i" continuar ancorado no canto da
             FOTO. Ele é absolute com bottom:14px e antes se media pelo
             .pdp__gallery, que agora termina depois das miniaturas: sem esse
             invólucro a bolinha cairia em cima da fileira de miniaturas. */
          '<div class="pdp__stage">' +
            '<div class="pdp__media">' + media + (sem ? '<span class="pdp__soldout">Esgotado</span>' : "") + '</div>' +
            avisoHTML +
          '</div>' +
          thumbs +
        '</div>' +
        '<div class="pdp__main">' +
          (p.categoria ? '<span class="pdp__cat">' + esc(p.categoria) + '</span>' : "") +
          '<h1 class="pdp__title">' + esc(p.nome) + '</h1>' +
          '<div class="pdp__price-row"><span class="pdp__price">' + money(p.preco_centavos) + '</span></div>' +
          (parc ? '<p class="pdp__parc">' + parc + '</p>' : "") +
          (p.material ? '<div class="pdp__material"><span class="tag">' + esc(p.material) + '</span></div>' : "") +
          (p.descricao ? '<p class="pdp__desc">' + esc(p.descricao) + '</p>' : "") +
          buy +
          '<ul class="pdp__trust">' +
            '<li>' + IC.truck + ' Frete grátis acima de R$599 · entrega para todo o Brasil</li>' +
            '<li>' + svgCard + ' Pix e cartão em até 8x sem juros</li>' +
            '<li>' + svgShield + ' Devolução em 7 dias · pedido fechado pelo WhatsApp</li>' +
          '</ul>' +
          '<div class="pdp__acc">' +
            '<details open><summary>Material e cuidados</summary><p>' + esc(cuidados(p.material)) + '</p></details>' +
            '<details><summary>Entrega e devolução</summary><p>Enviamos para todo o Brasil via Correios/transportadora. Frete grátis acima de R$599. O pedido é fechado pelo WhatsApp. É por lá que combinamos pagamento, prazo e envio, e que você recebe o código de rastreio. Devoluções em até 7 dias.</p></details>' +
          '</div>' +
        '</div>' +
      '</div>';

    ligarAviso();
    ajustarProporcaoFoto();
    ligarThumbs(p);

    if (!sem) {
      var val = el("qtdProduto");
      el("qtdMais").addEventListener("click", function () { val.textContent = Math.min(99, (parseInt(val.textContent, 10) || 1) + 1); });
      el("qtdMenos").addEventListener("click", function () { val.textContent = Math.max(1, (parseInt(val.textContent, 10) || 1) - 1); });
    }
  }

  /* A regra da proporção (moldura presa entre 1:1 e 3:4) mora no loja.js,
     porque a página de kits usa exatamente a mesma. Aqui só se aponta qual é a
     foto. Ver o comentário da função lá, e o de .pdp__media no estilo.css. */
  function ajustarProporcaoFoto() {
    L.ajustarProporcao(wrap.querySelector(".pdp__media img"));
  }

  /* Troca a foto grande ao clicar na miniatura. A proporção é recalculada a
     cada troca porque o acervo mistura 3:4 de celular com 9:16 de print: sem
     isso a segunda foto herdaria a moldura da primeira e sairia cortada.
     `aria-pressed` acompanha o estado visual pro leitor de tela saber qual das
     fotos está aberta. */
  function ligarThumbs(p) {
    var tira = el("pdpThumbs");
    if (!tira) return;
    var img = wrap.querySelector(".pdp__media img");
    if (!img) return;
    tira.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".pdp__thumb") : null;
      if (!btn || !tira.contains(btn)) return;
      var src = btn.getAttribute("data-src");
      if (!src || img.getAttribute("src") === src) return;
      img.setAttribute("src", src);
      img.setAttribute("alt", p.nome);
      L.ajustarProporcao(img);
      tira.querySelectorAll(".pdp__thumb").forEach(function (b) {
        var ativo = b === btn;
        b.classList.toggle("is-active", ativo);
        b.setAttribute("aria-pressed", ativo ? "true" : "false");
      });
    });
  }

  function naoEncontrado() {
    wrap.innerHTML = '<div class="state">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M6 3h12l3 5-9 13L3 8l3-5Z"/><path d="M3 8h18"/></svg>' +
      '<h3>Peça não encontrada</h3><p>Essa peça pode ter saído do ar. Veja o restante da coleção.</p>' +
      '<a class="btn btn--gold btn--sm" href="loja.html">Ir para a loja</a></div>';
  }

  function renderCross(lista) {
    if (!lista.length) return;
    var rail = el("railCross");
    rail.innerHTML = lista.map(L.cardHTML).join("");
    rail.querySelectorAll(".reveal").forEach(function (c) { c.classList.add("in"); });
    if (ehDemo) rail.querySelectorAll('a[href^="produto.html"]').forEach(function (a) { a.href += "&demo=1"; });
    el("crossSection").hidden = false;
    var step = function () { var c = rail.querySelector(".card"); return (c ? c.offsetWidth : 260) + 20; };
    var csPrev = el("csPrev"), csNext = el("csNext");
    csPrev.addEventListener("click", function () { rail.scrollBy({ left: -step() * 1.3, behavior: "smooth" }); });
    csNext.addEventListener("click", function () { rail.scrollBy({ left: step() * 1.3, behavior: "smooth" }); });
    // setas só quando há rolagem (senão ficam em cima da peça)
    function ajustarSetas() {
      var rola = rail.scrollWidth > rail.clientWidth + 4;
      csPrev.style.display = rola ? "" : "none";
      csNext.style.display = rola ? "" : "none";
    }
    ajustarSetas();
    window.addEventListener("resize", ajustarSetas);

    // Sem listener de wheel: quem faz a roda vertical rolar a página é o
    // overflow-y:hidden do .rail__track no CSS. Ver comentário em pagina-index.js.
  }

  if (!slug) { naoEncontrado(); return; }

  var fonte = ehDemo ? Promise.resolve({ prods: L.DEMO, error: null }) : L.carregarProdutos();
  fonte.then(function (r) {
    if (r.error) throw r.error;
    var todos = r.prods || [];
    var p = todos.filter(function (x) { return x.slug === slug; })[0];
    if (!p) { naoEncontrado(); return; }

    renderProduto(p);
    window.scrollTo(0, 0);

    var principal = principalDe(p.categoria);
    var pool = todos.filter(function (x) { return x.slug !== p.slug && (x.estoque || 0) > 0; });
    pool.sort(function (a, b) {
      var am = principalDe(a.categoria) === principal ? 0 : 1;
      var bm = principalDe(b.categoria) === principal ? 0 : 1;
      return am - bm;
    });
    var cross = pool.slice(0, 8);
    L._cross = cross;                 // alimenta o cross-sell do carrinho
    renderCross(cross);
  }).catch(function (err) {
    if (window.console) console.error("Loja:", err);
    wrap.innerHTML = '<div class="state"><h3>Não deu pra carregar agora</h3><p>Recarregue a página em instantes.</p></div>';
  });
})();
