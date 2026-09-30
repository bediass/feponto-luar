(function () {
  "use strict";
  if (!window.Loja) return;
  var L = window.Loja, TAX = L.TAXONOMIA, esc = L.esc, money = L.money;
  var el = function (id) { return document.getElementById(id); };

  var grade = el("gradeProdutos"), estado = el("estado"), elCount = el("shopCount");
  var elChips = el("chips"), elSort = el("sortSelect"), catPills = el("catPills");
  var plpTitle = el("plpTitle"), crumb = el("crumb");
  var grpTipo = el("grpTipo"), listaTipo = el("listaTipo");
  var grpMat = el("grpMaterial"), listaMat = el("listaMaterial");
  var grpPreco = el("grpPreco"), precoRange = el("precoRange"), precoValor = el("precoValor");
  var semFiltros = el("semFiltros"), filterN = el("filterN"), verResultados = el("verResultados");
  var buscaForm = el("buscaLojaForm"), buscaInput = el("buscaLoja"), buscaX = el("buscaLojaLimpar");
  var plpMore = el("plpMore"), btnMais = el("carregarMais");

  var PAGE = 12, mostrados = PAGE;
  var TODOS = [], MATERIAIS = [], PRECO_MAX = 0, ULTIMA = [];
  var S = { cat: "", sub: "", material: "", precoMax: null, q: "", ordenar: "novidades" };

  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/[áàâãä]/g, "a").replace(/[éèêë]/g, "e").replace(/[íìîï]/g, "i")
      .replace(/[óòôõö]/g, "o").replace(/[úùûü]/g, "u").replace(/ç/g, "c").replace(/ñ/g, "n");
  }
  function catObj(nome) { for (var i = 0; i < TAX.length; i++) if (TAX[i].nome === nome) return TAX[i]; return null; }
  function principalDe(cat) {
    var n = norm(cat);
    for (var i = 0; i < TAX.length; i++) {
      var t = TAX[i];
      if (norm(t.nome) === n) return t.nome;
      for (var j = 0; j < t.subs.length; j++) if (norm(t.subs[j]) === n) return t.nome;
    }
    return null;
  }
  function contarCat(nome) { var n = 0; for (var i = 0; i < TODOS.length; i++) if (principalDe(TODOS[i].categoria) === nome) n++; return n; }

  /* ---------- URL ---------- */
  function lerURL() {
    var p = new URLSearchParams(location.search);
    S.cat = p.get("cat") || ""; S.sub = p.get("sub") || ""; S.material = p.get("material") || "";
    S.q = p.get("q") || ""; S.ordenar = p.get("ordenar") || "novidades";
    var pm = p.get("precoMax"); S.precoMax = pm ? parseInt(pm, 10) : null;
  }
  function escreverURL() {
    var p = new URLSearchParams();
    if (S.cat) p.set("cat", S.cat);
    if (S.sub) p.set("sub", S.sub);
    if (S.material) p.set("material", S.material);
    if (S.q) p.set("q", S.q);
    if (S.ordenar && S.ordenar !== "novidades") p.set("ordenar", S.ordenar);
    if (S.precoMax != null && S.precoMax < PRECO_MAX) p.set("precoMax", S.precoMax);
    var qs = p.toString();
    history.replaceState(null, "", "loja.html" + (qs ? "?" + qs : ""));
  }

  /* ---------- filtro + ordenação ---------- */
  function filtrar() {
    var q = norm(S.q);
    var lista = TODOS.filter(function (p) {
      if (S.cat && principalDe(p.categoria) !== S.cat) return false;
      if (S.sub && norm(p.categoria) !== norm(S.sub)) return false;
      if (S.material && norm(p.material) !== norm(S.material)) return false;
      if (S.precoMax != null && (p.preco_centavos || 0) > S.precoMax) return false;
      if (q && norm(p.nome + " " + (p.descricao || "") + " " + (p.categoria || "")).indexOf(q) < 0) return false;
      return true;
    });
    if (S.ordenar === "preco-asc") lista.sort(function (a, b) { return (a.preco_centavos || 0) - (b.preco_centavos || 0); });
    else if (S.ordenar === "preco-desc") lista.sort(function (a, b) { return (b.preco_centavos || 0) - (a.preco_centavos || 0); });
    else if (S.ordenar === "nome") lista.sort(function (a, b) { return norm(a.nome) < norm(b.nome) ? -1 : 1; });
    return lista;
  }

  /* ---------- render: pills + cabeçalho ---------- */
  function renderPills() {
    var html = '<button type="button" class="pill' + (!S.cat ? " is-active" : "") + '" data-cat="">Todos</button>';
    html += TAX.map(function (t) {
      return '<button type="button" class="pill' + (S.cat === t.nome ? " is-active" : "") + '" data-cat="' + esc(t.nome) + '">' + esc(t.nome) + '</button>';
    }).join("");
    catPills.innerHTML = html;
  }
  function renderHeader() {
    if (S.cat) {
      plpTitle.textContent = S.cat;
      crumb.innerHTML = '<a href="index.html">Início</a><i>/</i><a href="loja.html">Produtos</a><i>/</i><span>' + esc(S.cat) + '</span>';
    } else {
      plpTitle.innerHTML = 'Nossa <em>coleção</em>';
      crumb.innerHTML = '<a href="index.html">Início</a><i>/</i><a href="loja.html">Produtos</a>';
    }
  }

  /* ---------- render: filtros do painel ---------- */
  function opcao(tipo, valor, rotulo, ativo, extra) {
    return '<button type="button" class="filter-opt' + (ativo ? " is-active" : "") + '" data-' + tipo + '="' + esc(valor) + '">' +
      '<span class="filter-opt__dot"></span><span class="filter-opt__txt">' + esc(rotulo) + '</span>' +
      (extra ? '<span class="filter-opt__n">' + extra + '</span>' : "") + '</button>';
  }
  function renderPainel() {
    // Tipo (subcategoria): só quando a categoria tem mais de um tipo
    var co = catObj(S.cat);
    if (co && co.subs.length > 1) {
      var th = opcao("sub", "", "Todos", !S.sub, "");
      th += co.subs.map(function (s) { return opcao("sub", s, s, norm(S.sub) === norm(s), ""); }).join("");
      listaTipo.innerHTML = th; grpTipo.hidden = false;
    } else { grpTipo.hidden = true; if (!co) S.sub = ""; }

    // Material
    if (MATERIAIS.length) {
      var mh = opcao("material", "", "Todos", !S.material, "");
      mh += MATERIAIS.map(function (m) { return opcao("material", m, m, norm(S.material) === norm(m), ""); }).join("");
      listaMat.innerHTML = mh; grpMat.hidden = false;
    } else { grpMat.hidden = true; }

    // Preço
    if (PRECO_MAX > 0) {
      grpPreco.hidden = false;
      precoRange.max = String(PRECO_MAX);
      precoRange.value = String(S.precoMax != null ? S.precoMax : PRECO_MAX);
      precoValor.textContent = money(S.precoMax != null ? S.precoMax : PRECO_MAX);
    } else { grpPreco.hidden = true; }

    semFiltros.hidden = !(grpTipo.hidden && grpMat.hidden && grpPreco.hidden);

    var n = (S.sub ? 1 : 0) + (S.material ? 1 : 0) + (S.precoMax != null && S.precoMax < PRECO_MAX ? 1 : 0);
    filterN.textContent = n; filterN.classList.toggle("on", n > 0);
  }

  /* ---------- render: chips ---------- */
  function renderChips() {
    var chips = [];
    if (S.q) chips.push({ k: "q", txt: 'Busca: "' + S.q + '"' });
    if (S.cat) chips.push({ k: "cat", txt: S.cat });
    if (S.sub) chips.push({ k: "sub", txt: S.sub });
    if (S.material) chips.push({ k: "material", txt: S.material });
    if (S.precoMax != null && S.precoMax < PRECO_MAX) chips.push({ k: "precoMax", txt: "Até " + money(S.precoMax) });
    elChips.innerHTML = chips.map(function (c) {
      return '<span class="chip">' + esc(c.txt) + '<button type="button" data-chip="' + c.k + '" aria-label="Remover filtro">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg></button></span>';
    }).join("");
  }

  /* ---------- busca do catálogo ----------
     O campo é a fonte da verdade só enquanto ela digita; quem manda no estado é
     S.q. A comparação é com o valor APARADO: sem isso, digitar "colar " e cair
     num render engolia o espaço recém-teclado, porque S.q guarda a versão sem
     espaço e a atribuição reescreveria o campo no meio da digitação. */
  function syncBusca() {
    if (!buscaInput) return;
    if (buscaInput.value.trim() !== S.q) buscaInput.value = S.q;
    buscaX.hidden = !S.q;
  }

  /* ---------- render principal ---------- */
  function render() {
    renderPills(); renderHeader(); renderPainel(); renderChips(); syncBusca(); escreverURL();
    elSort.value = S.ordenar;

    var lista = filtrar(); ULTIMA = lista;

    if (!TODOS.length) {
      grade.style.display = "none"; plpMore.hidden = true;
      estado.innerHTML = '<div class="state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M6 3h12l3 5-9 13L3 8l3-5Z"/><path d="M3 8h18"/></svg>' +
        '<h3>Coleção chegando</h3><p>As primeiras peças entram em breve. Volte já já ou entre no grupo da Luar pra ser a primeira a ver.</p>' +
        '<a class="btn btn--gold btn--sm" href="index.html">Voltar para a home</a></div>';
      elCount.textContent = "Coleção em breve";
      verResultados.textContent = "Ver resultados";
      return;
    }
    if (!lista.length) {
      grade.style.display = "none"; plpMore.hidden = true;
      estado.innerHTML = '<div class="state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>' +
        '<h3>Nada com esses filtros</h3><p>Tente afrouxar a busca ou limpar os filtros.</p>' +
        '<button class="btn btn--outline btn--sm" id="vazioLimpar">Limpar tudo</button></div>';
      var vl = el("vazioLimpar"); if (vl) vl.addEventListener("click", limparTudo);
      elCount.textContent = "0 peças"; verResultados.textContent = "Ver resultados";
      return;
    }

    estado.innerHTML = ""; grade.style.display = "";
    var alvo = Math.min(mostrados, lista.length);
    grade.innerHTML = lista.slice(0, alvo).map(L.cardHTML).join("");
    grade.querySelectorAll(".reveal").forEach(function (c) { c.classList.add("in"); });   // catálogo aparece na hora
    if (ehDemo) grade.querySelectorAll('a[href^="produto.html"]').forEach(function (a) { a.href += "&demo=1"; });

    plpMore.hidden = lista.length <= alvo;
    var rot = lista.length + (lista.length > 1 ? " peças" : " peça");
    elCount.textContent = rot;
    verResultados.textContent = "Ver " + rot;
  }

  /* ---------- ações ---------- */
  function reset() { mostrados = PAGE; render(); }
  function setCat(v) { S.cat = v; S.sub = ""; reset(); }
  function limparTudo() { S.cat = ""; S.sub = ""; S.material = ""; S.q = ""; S.precoMax = null; S.ordenar = "novidades"; reset(); }
  function limparPainel() { S.sub = ""; S.material = ""; S.precoMax = null; reset(); }

  /* ---------- carregar ---------- */
  lerURL();
  var ehDemo = new URLSearchParams(location.search).get("demo") === "1";
  var fonte = ehDemo ? Promise.resolve({ prods: L.DEMO, error: null }) : L.carregarProdutos();
  fonte.then(function (r) {
    if (r.error) throw r.error;
    TODOS = r.prods.filter(function (p) { return (p.estoque || 0) > 0; });   // esgotadas não aparecem
    L._cross = TODOS.slice(0, 8);
    PRECO_MAX = TODOS.reduce(function (m, p) { return Math.max(m, p.preco_centavos || 0); }, 0);
    var setM = {}; TODOS.forEach(function (p) { if (p.material) setM[p.material] = 1; });
    MATERIAIS = Object.keys(setM).sort();
    render();
  }).catch(function (err) {
    if (window.console) console.error("Loja:", err);
    grade.style.display = "none"; plpMore.hidden = true;
    estado.innerHTML = '<div class="state"><h3>Não deu pra carregar agora</h3><p>Recarregue a página em instantes.</p></div>';
    elCount.textContent = "";
  });

  /* ---------- eventos ---------- */
  catPills.addEventListener("click", function (e) { var b = e.target.closest("[data-cat]"); if (b) setCat(b.getAttribute("data-cat")); });

  if (buscaForm) {
    var tBusca = null;
    function aplicarBusca() { clearTimeout(tBusca); S.q = buscaInput.value.trim(); reset(); }
    // Espera de 200ms pra filtrar uma vez por palavra, não uma por tecla: cada
    // render redesenha a grade inteira.
    buscaInput.addEventListener("input", function () { clearTimeout(tBusca); tBusca = setTimeout(aplicarBusca, 200); });
    // Enter fecha o teclado do celular, senão ele tapa metade do resultado.
    buscaForm.addEventListener("submit", function (e) { e.preventDefault(); aplicarBusca(); buscaInput.blur(); });
    buscaX.addEventListener("click", function () { buscaInput.value = ""; aplicarBusca(); buscaInput.focus(); });
  }

  listaTipo.addEventListener("click", function (e) { var b = e.target.closest("[data-sub]"); if (b) { S.sub = b.getAttribute("data-sub"); reset(); } });
  listaMat.addEventListener("click", function (e) { var b = e.target.closest("[data-material]"); if (b) { S.material = b.getAttribute("data-material"); reset(); } });
  precoRange.addEventListener("input", function () { S.precoMax = parseInt(precoRange.value, 10); precoValor.textContent = money(S.precoMax); });
  precoRange.addEventListener("change", function () { S.precoMax = parseInt(precoRange.value, 10); reset(); });
  elSort.addEventListener("change", function () { S.ordenar = elSort.value; reset(); });
  el("limparFiltros").addEventListener("click", limparPainel);
  btnMais.addEventListener("click", function () { mostrados += PAGE; render(); });
  elChips.addEventListener("click", function (e) {
    var b = e.target.closest("[data-chip]"); if (!b) return;
    var k = b.getAttribute("data-chip");
    if (k === "q") S.q = "";
    else if (k === "precoMax") S.precoMax = null;
    else if (k === "sub") S.sub = "";
    else if (k === "cat") { S.cat = ""; S.sub = ""; }
    else S[k] = "";
    reset();
  });

  /* ---------- painel de filtros (abre/fecha) ---------- */
  var fbox = el("filterbox"), fOpen = el("filterOpen");
  function abrir() { fbox.classList.add("open"); fOpen.setAttribute("aria-expanded", "true"); document.body.style.overflow = "hidden"; }
  function fechar() { fbox.classList.remove("open"); fOpen.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; }
  fOpen.addEventListener("click", abrir);
  fbox.querySelectorAll("[data-filter-close]").forEach(function (b) { b.addEventListener("click", fechar); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fechar(); });
})();
