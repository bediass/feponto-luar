/* ============================================================
   Luar Acessórios · loja.js
   Cliente Supabase (leitura pública do catálogo) + carrinho
   (localStorage) + drawer que finaliza no WhatsApp.
   A anon/publishable key é pública por design; a RLS é que protege.

   Não há checkout: em 31/07/2026 a Luana tirou a compra online e o site
   passou a ser vitrine + pedido pelo WhatsApp, como o da Fê Ponto. O
   carrinho continua existindo (junta várias peças numa mensagem só), mas
   quem fecha o pedido, cobra e combina entrega é ela na conversa.
   ============================================================ */
(function () {
  "use strict";

  var CFG = {
    SUPABASE_URL: "https://fzdmjdyfeofypqhkltol.supabase.co",
    SUPABASE_KEY: "sb_publishable_o8LIxw_rxM4pjiVUqDKa_Q_fJOzvNql",
    FRETE_GRATIS_CENTAVOS: 59900,          // R$599 (definido pela Luana, 29/07/2026)
    PARCELAS_MAX: 8,                        // até 8x sem juros
    PARCELA_MIN_CENTAVOS: 15000,           // R$150 por parcela (definido pela Luana, 29/07/2026)
    WA_NUMBER: "5531994490804",            // WhatsApp da Luar: +55 (31) 99449-0804
    GRUPO_WA: "https://chat.whatsapp.com/HfOGpJDj67z1G74pyli9zp",   // grupo de WhatsApp da Luar
    CART_KEY: "luar_carrinho_v1"
  };

  /* `foto_urls` é a galeria (array) e `imagem_url` é a capa (texto). O ERP grava
     as duas ao salvar a peça (imagem_url = fotos[0]), sem trigger sincronizando.
     Até 25/08/2026 o site pedia só a capa, então a peça com 2 ou 3 fotos
     cadastradas aparecia com uma na página de produto. Coluna nova em `produtos`
     só chega aqui com `grant select` explícito pro anon (o de foto_urls está na
     migração 0008) — pedir coluna sem grant derruba a consulta inteira com
     permission denied, e o catálogo vem vazio em vez de o campo vir vazio. */
  var COLS = "id,slug,nome,descricao,categoria,material,preco_centavos,estoque,imagem_url,foto_urls";

  /* Taxonomia de categorias: espelha o site da Fê Ponto. Cada categoria principal
     agrupa subcategorias; o produto guarda em `categoria` o nome (principal OU sub). */
  var TAXONOMIA = [
    { nome: "Anéis",              subs: ["Anéis", "Alianças"] },
    { nome: "Brincos",            subs: ["Brincos", "Argolas", "Corrente de orelha"] },
    { nome: "Colares e Correntes", subs: ["Colares", "Correntes", "Colar gravatinha", "Pingentes", "Escapulários"] },
    { nome: "Pulseiras",          subs: ["Pulseiras", "Tornozeleiras", "Braceletes"] },
    { nome: "Piercings",          subs: ["Piercings"] },
    { nome: "Separadores",        subs: ["Separadores"] }
  ];

  /* Peças fictícias só pra pré-visualizar o layout (?demo=1). REMOVER: a loja
     lançou e isto virou peso morto — são preços e peças que não existem,
     alcançáveis em /loja?demo=1 e /produto?demo=1 no domínio de verdade.
     Não dá pra apagar só o array: `ehDemo` é lido em pagina-loja.js e
     pagina-produto.js (6 pontos), e some o array sem tirar os ramos deixa as
     duas páginas principais quebradas. Fica pra uma limpeza própria.
     Em 11/08/2026 as 3 peças de "Aço" daqui viraram prata, porque a Luar só
     vende Prata 925 e nada no site pode dizer o contrário. */
  var DEMO = [
    { id: "d1", slug: "colar-luar", nome: "Colar Luar", descricao: "Corrente veneziana fina com pingente de lua crescente. Delicado pra usar todo dia, sozinho ou em camadas.", categoria: "Colares", material: "Prata 925", preco_centavos: 18900, estoque: 5, imagem_url: "" },
    { id: "d2", slug: "brinco-argola-media", nome: "Argola Média", descricao: "Argola lisa polida de 2 cm. Clássica e leve, não incomoda no dia a dia.", categoria: "Argolas", material: "Prata 925", preco_centavos: 12900, estoque: 8, imagem_url: "" },
    { id: "d3", slug: "anel-solitario", nome: "Anel Solitário", descricao: "Zircônia central com brilho de diamante. Aro fino e elegante.", categoria: "Anéis", material: "Prata 925", preco_centavos: 15900, estoque: 3, imagem_url: "" },
    { id: "d4", slug: "alianca-classica", nome: "Aliança Clássica", descricao: "Par de alianças lisas de 4 mm, com acabamento polido.", categoria: "Alianças", material: "Prata 925", preco_centavos: 24900, estoque: 6, imagem_url: "" },
    { id: "d5", slug: "pulseira-elos", nome: "Pulseira Elos", descricao: "Elos delicados com fecho seguro. Combina com relógio e outras pulseiras.", categoria: "Pulseiras", material: "Prata 925", preco_centavos: 13900, estoque: 4, imagem_url: "" },
    { id: "d6", slug: "pingente-coracao", nome: "Pingente Coração", descricao: "Coração minimalista para montar seu colar do jeito que quiser.", categoria: "Pingentes", material: "Prata 925", preco_centavos: 9900, estoque: 10, imagem_url: "" },
    { id: "d7", slug: "piercing-fake", nome: "Piercing Fake", descricao: "Sem furo, encaixe seguro. O visual do piercing sem compromisso.", categoria: "Piercings", material: "Prata 925", preco_centavos: 6900, estoque: 6, imagem_url: "" },
    { id: "d8", slug: "brinco-ponto-luz", nome: "Brinco Ponto de Luz", descricao: "Zircônia de 3 mm. O par curinga que vai com tudo.", categoria: "Brincos", material: "Prata 925", preco_centavos: 8900, estoque: 12, imagem_url: "" },
    { id: "d9", slug: "corrente-cadeado", nome: "Corrente Cadeado", descricao: "Elo cadeado moderno. Presença sem pesar.", categoria: "Correntes", material: "Prata 925", preco_centavos: 21900, estoque: 5, imagem_url: "" },
    { id: "d10", slug: "tornozeleira-fina", nome: "Tornozeleira Fina", descricao: "Corrente veneziana para o verão inteiro.", categoria: "Tornozeleiras", material: "Prata 925", preco_centavos: 11900, estoque: 7, imagem_url: "" }
  ];

  /* ---------- Ícones (SVG inline, stroke 1.6) ---------- */
  var IC = {
    gem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M6 3h12l3 5-9 13L3 8l3-5Z"/><path d="M3 8h18M9 3l-1.5 5L12 21l4.5-13L15 3M7.5 8 12 21l4.5-13"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5.5 8h13l-1 12.2a1 1 0 0 1-1 .8H7.5a1 1 0 0 1-1-.8L5.5 8Z"/><path d="M9 8V6.2a3 3 0 0 1 6 0V8"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/></svg>',
    whats: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3.2-.9-2.7-1.2-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.7 1.1 1.4 1.8 1 .8 1.7 1.1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.1.1.8-.1 1.3Z"/></svg>'
  };

  /* ---------- Formatação ---------- */
  function money(centavos) {
    var v = (Number(centavos) || 0) / 100;
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  /* A vitrine anuncia "até 8x": mostra o maior número de parcelas que ainda
     respeita o piso de R$150 por parcela. Na prática o parcelamento só começa
     a aparecer a partir de R$300 (2x de R$150); abaixo disso, à vista. */
  function parcelaTexto(centavos) {
    if (!centavos) return "";
    var min = CFG.PARCELA_MIN_CENTAVOS || 1;
    var n = Math.min(CFG.PARCELAS_MAX, Math.floor(centavos / min));
    if (n < 2) return "";
    return n + "x de " + money(Math.round(centavos / n)) + " sem juros";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  /* ---------- Cliente Supabase ---------- */
  var _sb = null;
  function sb() {
    if (_sb) return _sb;
    if (!window.supabase) return null;
    _sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    return _sb;
  }

  /* ---------- Catálogo ---------- */
  function carregarProdutos(opts) {
    opts = opts || {};
    var client = sb();
    if (!client) return Promise.resolve({ prods: [], byId: {}, error: new Error("supabase indisponível") });
    var q = client.from("produtos").select(COLS).eq("ativo", true);
    if (opts.slug) q = q.eq("slug", opts.slug);
    q = q.order("created_at", { ascending: false });
    return q.then(function (res) {
      var prods = res.data || [];
      var byId = {};
      prods.forEach(function (p) { byId[p.id] = p; });
      return { prods: prods, byId: byId, error: res.error || null };
    });
  }

  /* ---------- Card de produto (HTML) ---------- */
  /* Fotos da peça em ordem de exibição, capa primeiro. A capa entra na frente
     mesmo que não seja o primeiro item de foto_urls, e a lista sai sem repetida
     pra a galeria não mostrar a mesma foto duas vezes. Serve também de rede pra
     peça antiga que só tem imagem_url preenchida. */
  function fotosDe(p) {
    var fora = {}, lista = [];
    function pon(u) {
      u = typeof u === "string" ? u.trim() : "";
      if (!u || fora[u]) return;
      fora[u] = true;
      lista.push(u);
    }
    pon(p && p.imagem_url);
    if (p && p.foto_urls && p.foto_urls.length) {
      for (var i = 0; i < p.foto_urls.length; i++) pon(p.foto_urls[i]);
    }
    return lista;
  }

  function mediaHTML(p, cls) {
    var capa = fotosDe(p)[0];
    if (capa) {
      return '<img src="' + esc(capa) + '" alt="' + esc(p.nome) + '" loading="lazy" />';
    }
    return '<div class="' + (cls || "card__media-fallback") + '">' + IC.gem + '</div>';
  }
  function addBtnAttrs(p) {
    return 'data-add="' + esc(p.id) + '" data-slug="' + esc(p.slug) + '" data-nome="' + esc(p.nome) +
      '" data-cat="' + esc(p.categoria || "") + '" data-preco="' + Number(p.preco_centavos || 0) +
      '" data-img="' + esc(fotosDe(p)[0] || "") + '"';
  }
  function cardHTML(p) {
    var sem = (p.estoque || 0) <= 0;
    var url = "produto.html?slug=" + encodeURIComponent(p.slug);
    var parc = parcelaTexto(p.preco_centavos);
    return '' +
      '<article class="card reveal">' +
        '<div class="card__media">' + mediaHTML(p) +
          (sem ? '<div class="card__soldout"><span>Esgotado</span></div>' : "") +
        '</div>' +
        '<div class="card__body">' +
          /* card__info agrupa o texto pra o botão poder cair no rodapé do card
             (margin-top:auto no CSS). Sem esse agrupador o botão acompanha a
             altura do nome e desalinha entre peça de título curto e de 2 linhas. */
          '<div class="card__info">' +
            (p.categoria ? '<span class="card__cat">' + esc(p.categoria) + '</span>' : "") +
            '<h3 class="card__name"><a href="' + url + '">' + esc(p.nome) + '</a></h3>' +
            '<div class="card__price-row"><span class="card__price">' + money(p.preco_centavos) + '</span></div>' +
            (parc ? '<span class="card__installment">' + parc + '</span>' : "") +
          '</div>' +
          (sem
            ? '<a class="card__add btn btn--outline btn--sm" href="' + url + '">Ver peça</a>'
            : '<button class="card__add btn btn--gold btn--sm" ' + addBtnAttrs(p) + '>' + IC.cart + ' Adicionar</button>') +
        '</div>' +
      '</article>';
  }

  /* ---------- Carrinho (estado em localStorage) ---------- */
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CFG.CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function writeCart(itens) {
    try { localStorage.setItem(CFG.CART_KEY, JSON.stringify(itens)); } catch (e) {}
    atualizarContadores();
  }
  function count() { return readCart().reduce(function (n, i) { return n + i.qtd; }, 0); }
  function subtotal() { return readCart().reduce(function (s, i) { return s + i.preco_centavos * i.qtd; }, 0); }

  function addItem(prod, qtd) {
    qtd = qtd || 1;
    var itens = readCart();
    var ex = itens.filter(function (i) { return i.id === prod.id; })[0];
    if (ex) { ex.qtd = Math.min(99, ex.qtd + qtd); }
    else {
      itens.push({
        id: prod.id, slug: prod.slug, nome: prod.nome, categoria: prod.categoria || "",
        preco_centavos: Number(prod.preco_centavos) || 0, imagem_url: prod.imagem_url || "", qtd: Math.min(99, qtd)
      });
    }
    writeCart(itens);
  }
  function setQtd(id, qtd) {
    var itens = readCart();
    itens = itens.map(function (i) { if (i.id === id) i.qtd = qtd; return i; }).filter(function (i) { return i.qtd > 0; });
    writeCart(itens);
    renderDrawer();
  }
  function removeItem(id) {
    writeCart(readCart().filter(function (i) { return i.id !== id; }));
    renderDrawer();
  }

  function atualizarContadores() {
    var c = count();
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = c;
      el.style.display = c > 0 ? "" : "none";
    });
  }

  /* ---------- Drawer (injetado uma vez) ---------- */
  var drawerEl = null;
  function montarDrawer() {
    if (drawerEl) return;
    drawerEl = document.createElement("div");
    drawerEl.className = "drawer";
    drawerEl.id = "cartDrawer";
    drawerEl.innerHTML =
      '<div class="drawer__overlay" data-cart-close></div>' +
      '<aside class="drawer__panel" role="dialog" aria-modal="true" aria-label="Carrinho de compras">' +
        '<div class="drawer__head"><h2>Seu carrinho</h2>' +
          '<button class="drawer__close" data-cart-close aria-label="Fechar carrinho">' + IC.x + '</button></div>' +
        '<div id="drawerBody" class="drawer__body"></div>' +
        '<div id="drawerFoot" class="drawer__foot-slot"></div>' +
      '</aside>';
    document.body.appendChild(drawerEl);
    drawerEl.querySelectorAll("[data-cart-close]").forEach(function (b) {
      b.addEventListener("click", fecharCarrinho);
    });
  }

  function freeshipHTML(sub) {
    var alvo = CFG.FRETE_GRATIS_CENTAVOS;
    var falta = alvo - sub;
    var pct = Math.max(0, Math.min(100, (sub / alvo) * 100));
    var msg = falta > 0
      ? '<span class="freeship__msg">Faltam <b>' + money(falta) + '</b> para o <b>frete grátis</b></span>'
      : '<span class="freeship__msg done">' + IC.check + ' Você ganhou <b>frete grátis</b></span>';
    return '<div class="freeship">' + msg +
      '<div class="freeship__bar"><div class="freeship__fill" style="width:' + pct + '%"></div></div></div>';
  }

  function crossSellHTML() {
    var cache = window.Loja._cross || [];
    var noCart = readCart().map(function (i) { return i.id; });
    var sugest = cache.filter(function (p) { return noCart.indexOf(p.id) < 0 && (p.estoque || 0) > 0; }).slice(0, 3);
    if (!sugest.length) return "";
    var rows = sugest.map(function (p) {
      var media = p.imagem_url
        ? '<img src="' + esc(p.imagem_url) + '" alt="' + esc(p.nome) + '" />'
        : '<span class="cart-cross__ph"></span>';
      return '<div class="cart-cross__row">' + media +
        '<div><div class="cart-cross__name">' + esc(p.nome) + '</div>' +
        '<div class="cart-cross__price">' + money(p.preco_centavos) + '</div></div>' +
        '<button class="btn btn--outline btn--sm" ' + addBtnAttrs(p) + ' aria-label="Adicionar ' + esc(p.nome) + '">' + IC.plus + '</button></div>';
    }).join("");
    return '<div class="cart-cross"><h3>Combina com</h3>' + rows + '</div>';
  }

  function renderDrawer() {
    if (!drawerEl) return;
    var body = drawerEl.querySelector("#drawerBody");
    var foot = drawerEl.querySelector("#drawerFoot");
    var itens = readCart();

    if (!itens.length) {
      body.innerHTML =
        '<div class="drawer__empty">' + IC.cart +
        '<div><h3 style="font-family:var(--font-head);color:var(--ink);">Seu carrinho está vazio</h3>' +
        '<p>Que tal começar a montar seu conjunto?</p></div>' +
        '<a class="btn btn--gold" href="loja.html">Ver a loja</a></div>';
      foot.innerHTML = "";
      return;
    }

    var sub = subtotal();
    var linhas = itens.map(function (i) {
      var media = i.imagem_url ? '<img src="' + esc(i.imagem_url) + '" alt="' + esc(i.nome) + '" />' : IC.gem;
      return '<div class="cart-item">' +
        '<div class="cart-item__media">' + media + '</div>' +
        '<div>' +
          '<div class="cart-item__name">' + esc(i.nome) + '</div>' +
          (i.categoria ? '<div class="cart-item__cat">' + esc(i.categoria) + '</div>' : "") +
          '<div class="qty" role="group" aria-label="Quantidade de ' + esc(i.nome) + '">' +
            '<button data-dec="' + esc(i.id) + '" aria-label="Diminuir">' + IC.minus + '</button>' +
            '<span class="qty__val">' + i.qtd + '</span>' +
            '<button data-inc="' + esc(i.id) + '" aria-label="Aumentar">' + IC.plus + '</button>' +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;display:flex;flex-direction:column;justify-content:space-between;">' +
          '<div class="cart-item__price">' + money(i.preco_centavos * i.qtd) + '</div>' +
          '<button class="cart-item__remove" data-rem="' + esc(i.id) + '">Remover</button>' +
        '</div>' +
      '</div>';
    }).join("");

    body.innerHTML =
      freeshipHTML(sub) +
      '<div class="drawer__items">' + linhas + '</div>' +
      crossSellHTML();

    foot.innerHTML =
      '<div class="drawer__foot">' +
        '<div class="cart-total"><span>Subtotal</span><b>' + money(sub) + '</b></div>' +
        '<p class="drawer__note">Frete e parcelamento são combinados na conversa.</p>' +
        '<a class="btn btn--gold btn--block btn--lg" href="' + waHref(mensagemCarrinho()) + '"' +
          ' target="_blank" rel="noopener" data-cart-wa>' + IC.whats + ' Finalizar no WhatsApp</a>' +
      '</div>';

    // wire quantidade / remover / cross-sell
    body.querySelectorAll("[data-inc]").forEach(function (b) { b.addEventListener("click", function () { var id = b.getAttribute("data-inc"); var it = readCart().filter(function (x) { return x.id === id; })[0]; if (it) setQtd(id, Math.min(99, it.qtd + 1)); }); });
    body.querySelectorAll("[data-dec]").forEach(function (b) { b.addEventListener("click", function () { var id = b.getAttribute("data-dec"); var it = readCart().filter(function (x) { return x.id === id; })[0]; if (it) setQtd(id, it.qtd - 1); }); });
    body.querySelectorAll("[data-rem]").forEach(function (b) { b.addEventListener("click", function () { removeItem(b.getAttribute("data-rem")); }); });
  }

  function abrirCarrinho() {
    montarDrawer();
    renderDrawer();
    drawerEl.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function fecharCarrinho() {
    if (!drawerEl) return;
    drawerEl.classList.remove("open");
    document.body.style.overflow = "";
  }

  /* ---------- Toast ---------- */
  var toastWrap = null;
  function toast(msg, tipo) {
    if (!toastWrap) { toastWrap = document.createElement("div"); toastWrap.className = "toast-wrap"; document.body.appendChild(toastWrap); }
    var t = document.createElement("div");
    t.className = "toast" + (tipo === "error" ? " toast--error" : "");
    t.setAttribute("role", "status");
    t.innerHTML = (tipo === "error" ? IC.x : IC.check) + "<span>" + esc(msg) + "</span>";
    toastWrap.appendChild(t);
    setTimeout(function () { t.style.transition = "opacity .3s, transform .3s"; t.style.opacity = "0"; t.style.transform = "translateY(8px)"; setTimeout(function () { t.remove(); }, 300); }, 2600);
  }

  /* O checkout (Edge Function `criar-pedido` + Mercado Pago) e a consulta de
     pedido por token saíram daqui em 31/07/2026, junto com a compra online.
     As funções foram removidas do Supabase — ver docs/ARQUITETURA-CHECKOUT.md. */

  /* ---------- Reveal on scroll ---------- */
  function iniciarReveal() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var els = document.querySelectorAll(".reveal");
    if (reduce || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (e) { io.observe(e); });
  }
  function observarReveal(scope) {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (scope || document).querySelectorAll(".reveal:not(.in)").forEach(function (e) {
      if (reduce) { e.classList.add("in"); return; }
      var io = new IntersectionObserver(function (ents, obs) { ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); obs.unobserve(en.target); } }); }, { threshold: 0.12 });
      io.observe(e);
    });
  }

  /* ---------- Proporção da foto ----------
     REGRA (acertada em 03/08/2026): quadrada continua quadrada; mais alta que
     isso vai até 3:4 e para ali. A moldura fica presa entre 1:1 e 3:4.

     POR QUE EXISTE
       O acervo tem duas famílias bem diferentes: 3:4 de celular e 9:16 de print
       de story. Caixa fixa corta uma das duas. Na caixa 16:10 que os kits usavam,
       a foto 9:16 perdia 65% da altura e a peça sumia.

     Vale pra foto do produto E pra do kit: as duas chamam esta função. Antes
     ela morava só no pagina-produto.js, e foi o Bernardo pedir "as mesmas
     configurações pros kits" que mostrou que o lugar dela era aqui.

     Escreve `--foto` no elemento da moldura; quem usa esse valor é o
     `aspect-ratio` do CSS (.pdp__media, .kit__media). Enquanto a imagem não
     carrega vale o 3/4 do fallback, que é a proporção mais comum do acervo, e
     por isso a maioria dos casos não mexe um pixel na página. */
  var FOTO_MAIS_ALTA = 3 / 4;   // nada mais estreito que isso
  var FOTO_MAIS_LARGA = 1;      // nada mais largo que quadrada

  function ajustarProporcao(img, moldura) {
    if (!img) return;
    var alvo = moldura || img.parentNode;
    if (!alvo) return;
    function aplicar() {
      if (!img.naturalWidth || !img.naturalHeight) return;   // foto quebrada: fica o fallback
      var r = img.naturalWidth / img.naturalHeight;
      alvo.style.setProperty("--foto", String(Math.min(FOTO_MAIS_LARGA, Math.max(FOTO_MAIS_ALTA, r))));
    }
    if (img.complete) aplicar(); else img.addEventListener("load", aplicar);
  }

  /* ---------- Busca (submete pra loja.html?q=) ---------- */
  function ligarBusca() {
    document.querySelectorAll("[data-search-form]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = form.querySelector("input");
        var q = (input && input.value || "").trim();
        window.location.href = "loja.html" + (q ? "?q=" + encodeURIComponent(q) : "");
      });
    });
  }

  /* ---------- Menu mobile ---------- */
  function ligarMenuMobile() {
    var toggle = document.getElementById("navToggle");
    var menu = document.getElementById("mobileMenu");
    var nav = document.querySelector(".nav");
    if (!toggle || !menu) return;
    function syncNav(open) {
      if (!nav) return;
      if (open) nav.classList.add("scrolled");          // menu aberto: nav sólida (branco no branco não some)
      else if (window.scrollY <= 36) nav.classList.remove("scrolled");
    }
    function fechar() { menu.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; syncNav(false); }
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
      syncNav(open);
    });
    menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", fechar); });
  }

  /* ---------- WhatsApp ---------- */
  function waHref(msg) {
    return "https://wa.me/" + CFG.WA_NUMBER + "?text=" + encodeURIComponent(msg);
  }

  /**
   * A mensagem que sai do carrinho: a lista inteira numa tacada só, com
   * quantidade, preço por linha e subtotal. É o "pedido" que ela recebe —
   * por isso vai formatado o suficiente pra ela conferir sem perguntar nada.
   */
  function mensagemCarrinho() {
    var itens = readCart();
    if (!itens.length) return "Olá! Vim pelo site da Luar Acessórios e queria uma ajuda.";
    var linhas = itens.map(function (i, n) {
      return (n + 1) + ") " + i.nome + (i.qtd > 1 ? " (" + i.qtd + "x)" : "") +
        " — " + money(i.preco_centavos * i.qtd);
    });
    return "Olá! Vim pelo site da Luar Acessórios e tenho interesse nestas peças:\n\n" +
      linhas.join("\n") + "\n\nSubtotal: " + money(subtotal()) +
      "\n\nPoderia me passar as formas de pagamento e o prazo de entrega?";
  }

  function ligarWhatsApp() {
    var temNumero = !!CFG.WA_NUMBER;

    // botão flutuante: só aparece quando o número já estiver configurado
    document.querySelectorAll(".wa-float").forEach(function (el) {
      el.style.display = temNumero ? "" : "none";
      if (temNumero) {
        var msg = el.getAttribute("data-msg") || "Olá! Vim pelo site da Luar Acessórios.";
        el.href = "https://wa.me/" + CFG.WA_NUMBER + "?text=" + encodeURIComponent(msg);
        el.target = "_blank"; el.rel = "noopener";
      }
    });

    // botões e links de conversa: continuam visíveis. Sem número, avisam que abre em breve
    document.querySelectorAll("[data-wa]:not(.wa-float)").forEach(function (el) {
      var msg = el.getAttribute("data-msg") || "Olá! Vim pelo site da Luar Acessórios.";
      if (temNumero) {
        if (el.tagName === "A") { el.href = "https://wa.me/" + CFG.WA_NUMBER + "?text=" + encodeURIComponent(msg); el.target = "_blank"; el.rel = "noopener"; }
      } else {
        el.href = "#";
        el.addEventListener("click", function (e) { e.preventDefault(); toast("O WhatsApp abre em breve, já já tem número aqui!"); });
      }
    });
  }

  /* ---------- Grupo de WhatsApp (botão "entrar no grupo") ---------- */
  function ligarGrupo() {
    document.querySelectorAll("[data-grupo]").forEach(function (el) {
      if (CFG.GRUPO_WA) {
        el.href = CFG.GRUPO_WA; el.target = "_blank"; el.rel = "noopener";
      } else {
        // link ainda não configurado: não quebra a navegação, avisa que abre em breve
        el.href = "#";
        el.addEventListener("click", function (e) { e.preventDefault(); toast("O grupo abre em breve, já já tem link aqui!"); });
      }
    });
  }

  /* O formulário "Ajuda com meu pedido" saiu em 31/07/2026, junto com a
     compra online: sem loja no site e sem tela de atendimentos no sistema,
     mensagem enviada aqui não teria quem lesse. Os links de ajuda passaram
     a abrir o WhatsApp, que é por onde a Luana já atende. */

  /* ---------- Init global ---------- */
  function init() {
    montarDrawer();
    atualizarContadores();
    iniciarReveal();
    ligarBusca();
    ligarMenuMobile();
    ligarWhatsApp();
    ligarGrupo();

    // abrir carrinho
    document.querySelectorAll("[data-cart-open]").forEach(function (b) { b.addEventListener("click", abrirCarrinho); });

    // adicionar ao carrinho (delegação: funciona pra cards renderizados depois)
    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-add]") : null;
      if (!btn) return;
      e.preventDefault();
      var prod = {
        id: btn.getAttribute("data-add"), slug: btn.getAttribute("data-slug"),
        nome: btn.getAttribute("data-nome"), categoria: btn.getAttribute("data-cat"),
        preco_centavos: Number(btn.getAttribute("data-preco")), imagem_url: btn.getAttribute("data-img")
      };
      var q = 1;
      var qEl = document.getElementById("qtdProduto");
      if (qEl && btn.hasAttribute("data-add-qty")) q = Math.max(1, parseInt(qEl.textContent, 10) || 1);
      addItem(prod, q);
      abrirCarrinho();
    });

    // ESC fecha o drawer / o painel de atendimento
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") fecharCarrinho(); });

    // navbar: estado "scrolled" (logo desliza pra esquerda + barra fininha + sombra)
    // páginas internas (sem hero escura) marcam .nav--solid → nav sempre sólida
    var nav = document.querySelector(".nav");
    if (nav) {
      var forceSolid = nav.classList.contains("nav--solid");
      var onScroll = function () { nav.classList.toggle("scrolled", forceSolid || window.scrollY > 36); };
      onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    }

    // ano no rodapé
    document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- API pública ---------- */
  window.Loja = {
    cfg: CFG, sb: sb, IC: IC, esc: esc, TAXONOMIA: TAXONOMIA, DEMO: DEMO,
    money: money, parcelaTexto: parcelaTexto,
    carregarProdutos: carregarProdutos, cardHTML: cardHTML, mediaHTML: mediaHTML, addBtnAttrs: addBtnAttrs,
    addItem: addItem, setQtd: setQtd, removeItem: removeItem, readCart: readCart, count: count, subtotal: subtotal,
    abrirCarrinho: abrirCarrinho, fecharCarrinho: fecharCarrinho, renderDrawer: renderDrawer,
    toast: toast, observarReveal: observarReveal, ajustarProporcao: ajustarProporcao,
    fotosDe: fotosDe,
    waHref: waHref, mensagemCarrinho: mensagemCarrinho,
    _cross: [], // preenchido pelas páginas p/ cross-sell no carrinho
    init: init
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
