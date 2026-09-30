/* ============================================================================
   Fê Ponto Joias — camada de loja (compartilhada por index.html e colecao.html)
   Lê as peças marcadas "no site" no sistema (Supabase) e monta cards, o
   mega-menu da Coleção e o carrossel de Mais vendidos.
   Requer o CDN do supabase-js carregado ANTES deste arquivo.
   ============================================================================ */
window.Loja = (function () {
  'use strict';

  var SUPABASE_URL = 'https://bbeowsellckpnddirbep.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_oUi2GRdWQ6beCyhtbkc8CQ_sooBbuiF';
  var WA_NUMBER = '5531994732018';

  var sb = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  var WA_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3.2-.9-2.7-1.2-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9 .9-2.1c.2-.2 .5-.3 .7-.3h.5c.2 0 .4 0 .6 .5l.8 2c.1 .2 .1 .4 0 .5l-.4 .5c-.1 .2-.3 .3-.1 .6 .1 .3 .7 1.1 1.4 1.8 1 .8 1.7 1.1 2 1.2 .2 .1 .4 .1 .5-.1l.7-.8c.2-.2 .4-.2 .6-.1l1.9 .9c.3 .1 .5 .2 .5 .4 .1 .1 .1 .8-.1 1.3Z"/></svg>';
  var BAG_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 8h13l-1 12.2a1 1 0 0 1-1 .8H7.5a1 1 0 0 1-1-.8L5.5 8Z"/><path d="M9 8V6.2a3 3 0 0 1 6 0V8"/></svg>';

  var _reg = {};   // registro de produtos por id (para o card de detalhes)
  var _byId = {};  // categorias por id

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function waHref(msg) {
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg);
  }

  // ----- Par de alianças ----------------------------------------------------
  // Um produto = as duas peças (PROJETO FEPONTO/sql/bloco-3-par-alianca.sql).
  // O preco_venda que vem do banco JÁ é o do par (soma dos dois índices); aqui
  // só somamos o peso e juntamos as medidas das duas peças para exibir.
  function numOuNulo(v) { return (v === null || v === undefined || v === '') ? null : Number(v); }
  function fmtNum(v) { return String(v).replace('.', ','); }

  function pesoTotal(p) {
    var a = numOuNulo(p.peso_gramas);
    if (!p.eh_par) return a;
    var b = numOuNulo(p.par_peso_gramas);
    if (a === null && b === null) return null;
    return (a || 0) + (b || 0);
  }
  // "4,5 mm" quando as duas peças medem igual; "4,5 mm e 3 mm" quando diferem.
  function medidaDoPar(a, b, sufixo, ehPar) {
    var x = (a === null || a === undefined || a === '') ? null : a;
    var y = (b === null || b === undefined || b === '') ? null : b;
    if (!ehPar || y === null || String(x) === String(y)) return x === null ? '' : fmtNum(x) + sufixo;
    if (x === null) return fmtNum(y) + sufixo;
    return fmtNum(x) + sufixo + ' e ' + fmtNum(y) + sufixo;
  }

  // Família (nível 1) de uma categoria. Subcategoria -> pai; família -> ela mesma.
  function familiaDe(catId, byId) {
    var c = byId[catId];
    if (!c) return null;
    return c.parent_id ? (byId[c.parent_id] || c) : c;
  }

  // Card de peça — mesmo desenho nas duas páginas.
  function cardHTML(p, byId) {
    var f = familiaDe(p.categoria_id, byId);
    var famId = f ? f.id : 'todas';
    var famNome = f ? f.nome : '';
    var mat = [p.cor_ouro, p.teor, p.pedras].filter(Boolean).join(' · ');
    var preco = (p.mostrar_preco && p.preco_venda > 0) ? brl.format(p.preco_venda) : 'Sob consulta';
    var parSelo = p.eh_par ? '<span class="piece__par">Par · 2 peças</span>' : '';
    var foto = (p.foto_urls && p.foto_urls[0]) ? p.foto_urls[0] : null;
    var media = foto
      ? '<img class="piece__photo" src="' + esc(foto) + '" alt="' + esc(p.nome) + '" loading="lazy" />'
      : '<span class="piece__tag">Imagem em breve</span><div class="halo"></div><div class="glyph"><svg viewBox="0 0 64 64" fill="none" stroke="var(--gold)" stroke-width="1" aria-hidden="true"><circle cx="32" cy="36" r="15"/><path d="M32 21 L26 8 h12 Z"/></svg></div>';
    var precoAttr = (p.mostrar_preco && p.preco_venda > 0) ? p.preco_venda : '';
    return '<article class="piece" data-id="' + esc(p.id) + '" data-category="' + esc(famId) + '" data-publico="' + esc((p.publico || '').toLowerCase()) + '" data-sub="' + esc(p.categoria_id || '') + '">' +
        '<div class="piece__media">' + media + '</div>' +
        '<div class="piece__body">' +
          (famNome || parSelo ? '<span class="piece__cat">' + esc(famNome) + parSelo + '</span>' : '') +
          '<h3 class="piece__name">' + esc(p.nome) + '</h3>' +
          '<p class="piece__mat">' + esc(mat) + '</p>' +
          '<div class="piece__foot">' +
            '<span class="piece__price">' + esc(preco) + '</span>' +
            '<button type="button" class="btn-wa btn-add"' +
              ' data-id="' + esc(p.id) + '"' +
              ' data-nome="' + esc(p.nome) + '"' +
              ' data-codigo="' + esc(p.codigo || '') + '"' +
              ' data-preco="' + precoAttr + '"' +
              ' data-mostrar="' + (p.mostrar_preco ? '1' : '0') + '"' +
              ' data-par="' + (p.eh_par ? '1' : '0') + '"' +
              ' data-foto="' + esc(foto || '') + '">' + BAG_SVG + 'Adicionar</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  // ⚠️ As peças NÃO vêm mais de `from('produtos')`: vêm da função
  // `catalogo_site()` no banco (PROJETO FEPONTO/sql/bloco-12). Ela devolve as
  // mesmas 23 colunas de vitrine, na mesma ordem (mais nova primeiro), com
  // duas já resolvidas lá dentro:
  //   `mostrar_preco` — depois de aplicada a chave `preco_site_modo`, que a
  //     Fernanda controla no ERP (mostrar todos / ocultar todos / manual);
  //   `preco_venda`   — NULO quando o preço é para ficar escondido.
  // Ou seja, preço escondido não chega nem no JSON. O `anon` perdeu o SELECT
  // em `produtos.preco_venda` justamente para não sobrar o caminho velho —
  // pedir a coluna direto agora responde "permission denied".
  //
  // Coluna nova na vitrine se adiciona NA FUNÇÃO (no `returns table` e no
  // `select`), não mais só no grant do bloco-9. As categorias continuam vindo
  // da tabela, onde o grant por coluna do bloco-9 é que manda.
  //
  // Carrega categorias + peças visíveis. Resolve { cats, prods, byId, error }.
  // A promessa fica em cache: a página e a busca do cabeçalho chamam carregar()
  // cada uma por conta própria, e sem isso o catálogo viria do Supabase 2x.
  // Em caso de erro o cache é descartado, pra uma tentativa seguinte refazer.
  var _carga = null;
  function carregar() {
    if (!sb) return Promise.resolve({ cats: [], prods: [], byId: {}, error: new Error('sem-conexao') });
    if (_carga) return _carga;
    _carga = Promise.all([
      sb.from('categorias').select('id,nome,parent_id,ordem'),
      sb.rpc('catalogo_site')
    ]).then(function (res) {
      var cats = (res[0] && res[0].data) || [];
      var prods = (res[1] && res[1].data) || [];
      var byId = {};
      cats.forEach(function (c) { byId[c.id] = c; });
      _byId = byId;
      prods.forEach(function (p) { _reg[p.id] = p; }); // registro p/ o card de detalhes
      var error = (res[1] && res[1].error) || (res[0] && res[0].error) || null;
      if (error) _carga = null;
      return { cats: cats, prods: prods, byId: byId, error: error };
    }, function (err) { _carga = null; throw err; });
    return _carga;
  }

  // ----- Busca textual sobre o acervo --------------------------------------
  // Sem acento e sem caixa: "aneis", "anéis" e "ANÉIS" batem no mesmo lugar.
  function normalizar(s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
  var _hay = {};   // texto normalizado por peça (nome, código, pedra, categoria…)
  function palheiro(p) {
    if (_hay[p.id]) return _hay[p.id];
    var f = familiaDe(p.categoria_id, _byId);
    var sub = _byId[p.categoria_id];
    var partes = [p.nome, p.codigo, p.pedras, p.cor_ouro, p.teor, p.publico, p.descricao,
                  f && f.nome, sub && sub.nome];
    _hay[p.id] = normalizar(partes.filter(Boolean).join(' '));
    return _hay[p.id];
  }
  // Pontua: começo do nome > palavra do nome > código > qualquer outro campo.
  // Todos os termos precisam bater em algum campo (busca "anel esmeralda" só
  // traz o que tem as duas coisas). Devolve -1 quando a peça não serve.
  function pontuar(p, termos) {
    var hay = palheiro(p), nome = normalizar(p.nome), cod = normalizar(p.codigo);
    var total = 0;
    for (var i = 0; i < termos.length; i++) {
      var t = termos[i];
      if (hay.indexOf(t) < 0) return -1;
      if (nome.indexOf(t) === 0) total += 5;
      else if (nome.indexOf(' ' + t) >= 0) total += 4;
      else if (cod && cod.indexOf(t) === 0) total += 4;
      else if (nome.indexOf(t) >= 0) total += 3;
      else total += 1;
    }
    return total;
  }
  function filtrarBusca(prods, termo) {
    var termos = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!termos.length) return [];
    return prods.map(function (p) { return { p: p, s: pontuar(p, termos) }; })
      .filter(function (x) { return x.s >= 0; })
      .sort(function (a, b) { return (b.s - a.s) || a.p.nome.localeCompare(b.p.nome); })
      .map(function (x) { return x.p; });
  }

  // ----- Mega-menu da Coleção -----------------------------------------------
  // ⚠️ O menu é por CATEGORIA, e público NÃO entra aqui.
  // Até 24/09/2026 o painel tinha uma coluna por público (Feminino, Masculino,
  // Infantil) e a família aparecia repetida dentro de cada uma. Duas coisas
  // quebravam na prática, as duas por depender de um campo que o cadastro nem
  // sempre preenche:
  //   • peça sem `publico` não entrava em coluna nenhuma e sumia da navegação
  //     (eram 25 das 365 no site, sendo 24 delas brincos);
  //   • "Brincos" não existia na coluna Feminino porque nenhum brinco estava
  //     marcado feminino — e "Masculino" mostrava só as peças unissex, já que
  //     nenhuma peça do acervo é masculina.
  // Agora a categoria é a porta de entrada e o público virou filtro DENTRO da
  // coleção (chips de Público em colecao.html): o link do menu não carrega
  // `publico=`, então a coleção sempre abre em "Todos" e ninguém perde peça por
  // causa de campo em branco.

  // No ERP quase toda familia tem uma subcategoria com o MESMO nome, servindo de
  // balde generico: Aneis > Aneis (o anel que nao e alianca), Brincos > Brincos,
  // Pulseiras > Pulseiras, Piercings > Piercings, Separadores > Separadores,
  // Aliancas > Alianca (a aliança inteira, que nao e meia alianca).
  // Faz sentido no cadastro, mas no menu saia como o nome escrito duas vezes,
  // uma embaixo da outra. O link da familia ja cobre esse balde (a colecao
  // filtra por familia e traz os filhos junto), entao a subcategoria homonima
  // nao vira linha propria. Compara sem acento, sem caixa e sem plural, pra
  // "Aneis"/"aneis" e "Aliancas"/"Alianca" contarem como o mesmo nome.
  function mesmoNome(a, b) {
    var n = function (s) {
      return String(s || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };
    // Singular e plural contam como o MESMO nome. "Alianças" (familia) e
    // "Aliança" (subcategoria) sao a mesma palavra: escrever as duas uma
    // embaixo da outra so repete. Tira o "s" final depois de normalizar.
    // Nao atropela nome composto: "Colares & Correntes" vira
    // "colares & corrente" e "Colares" vira "colare" — seguem diferentes,
    // entao Colares continua com linha propria.
    var raiz = function (s) { return n(s).replace(/s$/, ''); };
    return raiz(a) === raiz(b);
  }

  // Famílias que têm peça no site, cada uma com as subcategorias que aparecem.
  // A ordem é a do cadastro (`categorias.ordem`), a mesma dos chips da coleção.
  function agruparPorFamilia(prods, byId) {
    var mapa = {};
    prods.forEach(function (p) {
      var sub = byId[p.categoria_id];
      if (!sub) return;
      var fam = sub.parent_id ? (byId[sub.parent_id] || sub) : sub;
      if (!mapa[fam.id]) mapa[fam.id] = { id: fam.id, nome: fam.nome, ordem: fam.ordem || 0, subs: {} };
      if (sub.parent_id && !mesmoNome(sub.nome, fam.nome)) {
        mapa[fam.id].subs[sub.id] = { id: sub.id, nome: sub.nome, ordem: sub.ordem || 0 };
      }
    });
    return Object.keys(mapa).map(function (k) { return mapa[k]; })
      .sort(function (a, b) { return (a.ordem - b.ordem) || a.nome.localeCompare(b.nome); });
  }

  function megaMenuHTML(prods, byId) {
    var cols = agruparPorFamilia(prods, byId).map(function (fam) {
      var subs = Object.keys(fam.subs).map(function (k) { return fam.subs[k]; })
        .sort(function (a, b) { return (a.ordem - b.ordem) || a.nome.localeCompare(b.nome); });
      var lis = subs.map(function (s) {
        return '<li><a class="mega__sub" href="colecao.html?sub=' + s.id + '">' + esc(s.nome) + '</a></li>';
      }).join('');
      return '<div class="mega__col">' +
          '<a class="mega__fam" href="colecao.html?fam=' + fam.id + '">' + esc(fam.nome) + '</a>' +
          (lis ? '<ul class="mega__subs">' + lis + '</ul>' : '') +
        '</div>';
    }).join('');
    if (!cols) cols = '<div class="mega__col"><p class="mega__vazio">Acervo em atualização — fale no WhatsApp.</p></div>';
    return '<div class="mega__cols">' + cols + '</div>' +
           '<a class="mega__todos" href="colecao.html">Ver todos os produtos <span aria-hidden="true">→</span></a>';
  }

  // Injeta o mega-menu no #megaPanel e liga a abertura (clique/hover/esc).
  function montarMega(prods, byId) {
    var panel = document.getElementById('megaPanel');
    var btn = document.getElementById('megaBtn');
    if (!panel || !btn) return;
    panel.innerHTML = megaMenuHTML(prods, byId);
    var wrap = btn.closest('.nav__mega');
    if (!wrap) return;
    function abrir() { wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    function fechar() { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function (e) { e.preventDefault(); wrap.classList.contains('open') ? fechar() : abrir(); });
    if (window.matchMedia('(hover: hover) and (min-width: 861px)').matches) {
      wrap.addEventListener('mouseenter', abrir);
      wrap.addEventListener('mouseleave', fechar);
    }
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) fechar(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });
    // Quem abre o painel pelo teclado sai dele com Tab, não com o mouse: sem
    // isso o menu fica aberto por cima da página depois que o foco já passou
    // pro próximo link da nav. `relatedTarget` é pra onde o foco foi.
    wrap.addEventListener('focusout', function (e) {
      if (!e.relatedTarget || !wrap.contains(e.relatedTarget)) fechar();
    });
  }

  // Liga os links [data-wa] (mensagem pré-preenchida) — igual ao index original.
  function ligarWhatsApp() {
    document.querySelectorAll('[data-wa]').forEach(function (el) {
      var msg = el.getAttribute('data-msg') || 'Olá! Vim pelo site da Fê Ponto Joias.';
      var href = waHref(msg);
      if (el.tagName === 'A') { el.setAttribute('href', href); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
      else { el.addEventListener('click', function () { window.open(href, '_blank', 'noopener'); }); }
    });
  }

  // ===== Carrinho (persistido em localStorage; a mesma cesta nas 2 páginas) =====
  var CHAVE = 'fp_carrinho_v1';
  function lerCarrinho() { try { return JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch (e) { return []; } }
  function salvarCarrinho(itens) { try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch (e) {} atualizarBadge(); }
  function atualizarBadge() {
    var n = lerCarrinho().length;
    document.querySelectorAll('.nav__cart-badge').forEach(function (b) { b.textContent = n; b.style.display = n > 0 ? '' : 'none'; });
  }
  function addCarrinho(item) {
    var itens = lerCarrinho();
    fecharDetalhe();
    if (itens.some(function (x) { return x.id === item.id; })) { abrirCarrinho(); return false; }
    itens.push(item); salvarCarrinho(itens); abrirCarrinho(); return true;
  }
  function removerCarrinho(id) { salvarCarrinho(lerCarrinho().filter(function (x) { return x.id !== id; })); renderCarrinho(); }
  function limparCarrinho() { salvarCarrinho([]); renderCarrinho(); }
  function mensagemCarrinho() {
    var itens = lerCarrinho();
    if (!itens.length) return 'Olá! Vim pelo site da Fê Ponto Joias e gostaria de mais informações.';
    var linhas = itens.map(function (it, i) {
      var preco = (it.mostrar_preco && it.preco) ? brl.format(it.preco) : 'Sob consulta';
      return (i + 1) + ') ' + it.nome + (it.par ? ' — par (2 peças)' : '') + (it.codigo ? ' (cód. ' + it.codigo + ')' : '') + ' — ' + preco;
    });
    return 'Olá! Vim pelo site da Fê Ponto Joias e tenho interesse nestas peças:\n\n' + linhas.join('\n') + '\n\nPoderiam me passar mais informações sobre elas?';
  }
  function renderCarrinho() {
    var itens = lerCarrinho();
    var body = document.getElementById('cartBody');
    if (body) {
      if (!itens.length) {
        body.innerHTML = '<p class="cart__vazio">Seu carrinho está vazio.<br>Adicione peças da coleção para consultar tudo de uma vez no WhatsApp.</p>';
      } else {
        body.innerHTML = itens.map(function (it) {
          var preco = (it.mostrar_preco && it.preco) ? brl.format(it.preco) : 'Sob consulta';
          var img = it.foto ? '<img src="' + esc(it.foto) + '" alt="' + esc(it.nome) + '" />' : '<span class="cart__semfoto">' + BAG_SVG + '</span>';
          return '<div class="cart__item">' +
              '<div class="cart__thumb">' + img + '</div>' +
              '<div class="cart__info"><p class="cart__nome">' + esc(it.nome) + '</p>' +
                ((it.codigo || it.par)
                  ? '<p class="cart__cod">' + [it.codigo ? 'Cód. ' + esc(it.codigo) : '', it.par ? 'Par · 2 peças' : ''].filter(Boolean).join(' · ') + '</p>'
                  : '') +
                '<p class="cart__preco">' + esc(preco) + '</p></div>' +
              '<button type="button" class="cart__rm" data-rm="' + esc(it.id) + '" aria-label="Remover peça" title="Remover">&times;</button>' +
            '</div>';
        }).join('');
      }
    }
    var wa = document.getElementById('cartWa');
    if (wa) { wa.setAttribute('href', waHref(mensagemCarrinho())); wa.classList.toggle('is-disabled', !itens.length); }
    var cnt = document.getElementById('cartCount');
    if (cnt) cnt.textContent = itens.length ? ('(' + itens.length + ')') : '';
  }
  function abrirCarrinho() {
    renderCarrinho();
    var el = document.getElementById('cart'), ov = document.getElementById('cartOverlay');
    if (el) el.classList.add('open');
    if (ov) ov.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function fecharCarrinho() {
    var el = document.getElementById('cart'), ov = document.getElementById('cartOverlay');
    if (el) el.classList.remove('open');
    if (ov) ov.classList.remove('open');
    document.body.style.overflow = '';
  }
  function montarCarrinho() {
    if (!document.body || document.getElementById('cart')) return;
    var d = document.createElement('div');
    d.innerHTML =
      '<div class="cart-overlay" id="cartOverlay"></div>' +
      '<aside class="cart" id="cart" aria-label="Carrinho" role="dialog" aria-modal="true">' +
        '<div class="cart__head"><h3>Meu carrinho <span id="cartCount"></span></h3>' +
          '<button type="button" class="cart__close" id="cartClose" aria-label="Fechar carrinho">&times;</button></div>' +
        '<div class="cart__body" id="cartBody"></div>' +
        '<div class="cart__foot">' +
          '<a class="btn btn-gold cart__wa" id="cartWa" target="_blank" rel="noopener">' + WA_SVG + 'Finalizar no WhatsApp</a>' +
          '<button type="button" class="cart__clear" id="cartClear">Esvaziar carrinho</button>' +
        '</div>' +
      '</aside>';
    while (d.firstChild) document.body.appendChild(d.firstChild);

    document.querySelectorAll('#cartBtn, .nav__cart').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); abrirCarrinho(); });
    });
    var close = document.getElementById('cartClose'); if (close) close.addEventListener('click', fecharCarrinho);
    var ov = document.getElementById('cartOverlay'); if (ov) ov.addEventListener('click', fecharCarrinho);
    var clr = document.getElementById('cartClear'); if (clr) clr.addEventListener('click', limparCarrinho);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharCarrinho(); });

    document.addEventListener('click', function (e) {
      var t = e.target;
      var add = (t && t.closest) ? t.closest('.btn-add') : null;
      if (add) {
        e.preventDefault();
        addCarrinho({
          id: add.getAttribute('data-id'),
          nome: add.getAttribute('data-nome'),
          codigo: add.getAttribute('data-codigo') || null,
          preco: add.getAttribute('data-preco') ? Number(add.getAttribute('data-preco')) : null,
          mostrar_preco: add.getAttribute('data-mostrar') === '1',
          par: add.getAttribute('data-par') === '1',
          foto: add.getAttribute('data-foto') || null
        });
        return;
      }
      var rm = (t && t.closest) ? t.closest('[data-rm]') : null;
      if (rm) removerCarrinho(rm.getAttribute('data-rm'));
    });

    renderCarrinho();
    atualizarBadge();
  }

  // ===== Card de detalhes do produto =====
  function specRow(rot, val) { return val ? '<div class="det__spec"><dt>' + rot + '</dt><dd>' + esc(val) + '</dd></div>' : ''; }
  function abrirDetalhe(p) {
    if (!p || !document.getElementById('detalhe')) return;
    var f = familiaDe(p.categoria_id, _byId);
    var cat = f ? f.nome : '';
    var subCat = _byId[p.categoria_id];
    var subNome = (subCat && subCat.parent_id) ? subCat.nome : '';
    var preco = (p.mostrar_preco && p.preco_venda > 0) ? brl.format(p.preco_venda) : 'Sob consulta';
    var material = [p.cor_ouro, p.teor].filter(Boolean).join(' ');
    var publicoRot = { feminino: 'Feminino', masculino: 'Masculino', infantil: 'Infantil', unissex: 'Unissex' }[(p.publico || '').toLowerCase()] || '';
    var fotos = (p.foto_urls || []).filter(Boolean);
    var mediaMain = fotos.length
      ? '<img id="detMain" src="' + esc(fotos[0]) + '" alt="' + esc(p.nome) + '" />'
      : '<div class="det__semfoto">' + BAG_SVG + '</div>';
    var thumbs = fotos.length > 1
      ? '<div class="det__thumbs">' + fotos.map(function (u, i) { return '<button type="button" class="det__thumb' + (i === 0 ? ' active' : '') + '" data-src="' + esc(u) + '"><img src="' + esc(u) + '" alt="" /></button>'; }).join('') + '</div>'
      : '';
    // Par de alianças: as duas peças num card só. Peso soma, medidas aparecem
    // lado a lado quando diferem, e o preço mostrado é o do par.
    var peso = pesoTotal(p);
    var pesoRot = p.eh_par ? 'Peso do par' : 'Peso';
    var tamanhoRot = p.eh_par ? 'Aros' : 'Tamanho';
    var specs =
      specRow('Categoria', subNome ? (cat + ' · ' + subNome) : cat) +
      (p.eh_par ? specRow('Conjunto', 'Par · 2 peças') : '') +
      specRow('Material', material) +
      specRow('Pedra', p.pedras) +
      specRow(pesoRot, peso ? (fmtNum(peso) + ' g') : '') +
      specRow('Largura', medidaDoPar(p.largura_mm, p.par_largura_mm, ' mm', p.eh_par)) +
      specRow('Espessura', medidaDoPar(p.espessura_mm, p.par_espessura_mm, ' mm', p.eh_par)) +
      specRow(tamanhoRot, medidaDoPar(p.tamanho, p.par_tamanho, '', p.eh_par)) +
      specRow('Público', publicoRot);
    var precoAttr = (p.mostrar_preco && p.preco_venda > 0) ? p.preco_venda : '';
    var addBtn = '<button type="button" class="btn btn-gold btn-add" data-id="' + esc(p.id) + '" data-nome="' + esc(p.nome) + '" data-codigo="' + esc(p.codigo || '') + '" data-preco="' + precoAttr + '" data-mostrar="' + (p.mostrar_preco ? '1' : '0') + '" data-par="' + (p.eh_par ? '1' : '0') + '" data-foto="' + esc(fotos[0] || '') + '">' + BAG_SVG + 'Adicionar ao carrinho</button>';
    var waMsg = 'Olá! Tenho interesse ' + (p.eh_par ? 'no par de alianças "' : 'na peça "') + p.nome + '"' + (p.codigo ? ' (cód. ' + p.codigo + ')' : '') + '. Poderia me passar mais detalhes?';
    var waBtn = '<a class="btn btn-outline" href="' + waHref(waMsg) + '" target="_blank" rel="noopener">Consultar no WhatsApp</a>';
    document.getElementById('detMedia').innerHTML = mediaMain + thumbs;
    document.getElementById('detInfo').innerHTML =
      (cat ? '<span class="det__cat">' + esc(cat) + '</span>' : '') +
      '<h3 class="det__nome">' + esc(p.nome) + '</h3>' +
      '<p class="det__preco">' + esc(preco) +
        ((p.eh_par && p.mostrar_preco && p.preco_venda > 0) ? '<span class="det__preco-nota">o par</span>' : '') +
      '</p>' +
      '<dl class="det__specs">' + specs + '</dl>' +
      '<p class="det__nota">Alterações na peça e informações de tamanho sob consulta.</p>' +
      (p.descricao ? '<p class="det__desc">' + esc(p.descricao) + '</p>' : '') +
      '<div class="det__acoes">' + addBtn + waBtn + '</div>';
    document.getElementById('detOverlay').classList.add('open');
    document.getElementById('detalhe').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function fecharDetalhe() {
    var el = document.getElementById('detalhe'), ov = document.getElementById('detOverlay');
    if (el) el.classList.remove('open');
    if (ov) ov.classList.remove('open');
    var cart = document.getElementById('cart');
    if (!cart || !cart.classList.contains('open')) document.body.style.overflow = '';
  }
  function montarDetalhe() {
    if (!document.body || document.getElementById('detalhe')) return;
    var d = document.createElement('div');
    d.innerHTML =
      '<div class="detalhe-overlay" id="detOverlay"></div>' +
      '<div class="detalhe" id="detalhe" role="dialog" aria-modal="true" aria-label="Detalhes da peça">' +
        '<button type="button" class="detalhe__close" id="detClose" aria-label="Fechar">&times;</button>' +
        '<div class="detalhe__grid"><div class="det__media" id="detMedia"></div><div class="det__info" id="detInfo"></div></div>' +
      '</div>';
    while (d.firstChild) document.body.appendChild(d.firstChild);
    var close = document.getElementById('detClose'); if (close) close.addEventListener('click', fecharDetalhe);
    var ov = document.getElementById('detOverlay'); if (ov) ov.addEventListener('click', fecharDetalhe);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharDetalhe(); });
    var media = document.getElementById('detMedia');
    if (media) media.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.det__thumb') : null;
      if (!t) return;
      var main = document.getElementById('detMain');
      if (main) main.setAttribute('src', t.getAttribute('data-src'));
      media.querySelectorAll('.det__thumb').forEach(function (b) { b.classList.remove('active'); });
      t.classList.add('active');
    });
    document.addEventListener('click', function (e) {
      var alvo = (e.target && e.target.closest) ? e.target.closest('.piece__media, .piece__name') : null;
      if (!alvo) return;
      var art = alvo.closest('.piece');
      if (!art) return;
      var id = art.getAttribute('data-id');
      if (id && _reg[id]) abrirDetalhe(_reg[id]);
    });
  }

  // ===== Busca do cabeçalho (painel abaixo da nav, em todas as páginas) =====
  var LUPA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4-4"/></svg>';
  var MAX_BUSCA = 8;              // resultados no painel; o resto vai pra coleção
  var _bProds = null;             // acervo carregado (null enquanto não chega)
  var _bLista = [];               // o que está na tela agora
  var _bAtivo = -1;               // índice destacado pelo teclado
  var _bTimer = null;
  var _bErro = false;             // catálogo não veio (Supabase fora, rede caiu)

  // A nav muda de altura entre o estado normal e o .scrolled, e o painel é
  // fixed logo abaixo dela — daí medir em vez de chutar um valor no CSS.
  function alturaNav() {
    var nav = document.getElementById('nav');
    var h = nav ? Math.round(nav.getBoundingClientRect().height) : 76;
    document.documentElement.style.setProperty('--nav-h', h + 'px');
  }

  function itemBuscaHTML(p, i) {
    var f = familiaDe(p.categoria_id, _byId);
    var meta = [f && f.nome, p.codigo ? 'Cód. ' + p.codigo : '', p.pedras].filter(Boolean).join(' · ');
    var preco = (p.mostrar_preco && p.preco_venda > 0) ? brl.format(p.preco_venda) : 'Sob consulta';
    var foto = (p.foto_urls && p.foto_urls[0]) ? p.foto_urls[0] : null;
    return '<li class="busca__op" role="option" id="busca-op-' + i + '" aria-selected="false" data-id="' + esc(p.id) + '">' +
        '<span class="busca__thumb">' + (foto ? '<img src="' + esc(foto) + '" alt="" width="56" height="56" loading="lazy" />' : BAG_SVG) + '</span>' +
        '<span class="busca__txt">' +
          '<span class="busca__nome">' + esc(p.nome) + '</span>' +
          (meta ? '<span class="busca__meta">' + esc(meta) + '</span>' : '') +
        '</span>' +
        '<span class="busca__preco">' + esc(preco) + '</span>' +
      '</li>';
  }

  function renderBusca() {
    var input = document.getElementById('buscaInput');
    var lista = document.getElementById('buscaLista');
    var status = document.getElementById('buscaStatus');
    var vazio = document.getElementById('buscaVazio');
    var todos = document.getElementById('buscaTodos');
    var limpar = document.getElementById('buscaLimpar');
    if (!input || !lista) return;

    var termo = input.value.trim();
    limpar.hidden = !termo;
    _bAtivo = -1;
    input.removeAttribute('aria-activedescendant');
    vazio.hidden = true;

    if (!_bProds) {
      _bLista = []; lista.innerHTML = '';
      status.textContent = _bErro ? 'Não foi possível carregar o acervo agora' : 'Carregando o acervo…';
      if (_bErro) {
        vazio.hidden = false;
        vazio.innerHTML = 'Tente de novo em instantes ou <a href="' +
          waHref('Olá! Vim pelo site da Fê Ponto Joias e gostaria de ver as peças disponíveis.') +
          '" target="_blank" rel="noopener">fale com a gente no WhatsApp</a>.';
      }
      todos.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      return;
    }

    if (!termo) {   // estado inicial: destaques, pra ninguém encarar um painel vazio
      _bLista = _bProds.filter(function (p) { return p.destaque_site; }).slice(0, 4);
      if (!_bLista.length) _bLista = _bProds.slice(0, 4);
      status.textContent = _bLista.length ? 'Destaques' : '';
      lista.innerHTML = _bLista.map(itemBuscaHTML).join('');
      todos.hidden = false;
      todos.setAttribute('href', 'colecao.html');
      todos.innerHTML = 'Ver toda a coleção <span aria-hidden="true">&rarr;</span>';
      input.setAttribute('aria-expanded', _bLista.length ? 'true' : 'false');
      return;
    }

    var achou = filtrarBusca(_bProds, termo);
    _bLista = achou.slice(0, MAX_BUSCA);
    lista.innerHTML = _bLista.map(itemBuscaHTML).join('');
    input.setAttribute('aria-expanded', _bLista.length ? 'true' : 'false');

    if (!achou.length) {
      status.textContent = 'Nenhuma peça encontrada';
      vazio.hidden = false;
      vazio.innerHTML = 'Nada encontrado para <strong>' + esc(termo) + '</strong>.<br>' +
        'Tente outro nome, categoria ou pedra — ou <a href="' + waHref('Olá! Procurei por “' + termo + '” no site e não encontrei. Vocês têm algo assim?') +
        '" target="_blank" rel="noopener">pergunte no WhatsApp</a>.';
      todos.hidden = false;
      todos.setAttribute('href', 'colecao.html');
      todos.innerHTML = 'Ver toda a coleção <span aria-hidden="true">&rarr;</span>';
      return;
    }

    status.textContent = achou.length === 1 ? '1 peça encontrada' : achou.length + ' peças encontradas';
    todos.hidden = false;
    todos.setAttribute('href', 'colecao.html?q=' + encodeURIComponent(termo));
    todos.innerHTML = (achou.length > _bLista.length)
      ? 'Ver os ' + achou.length + ' resultados <span aria-hidden="true">&rarr;</span>'
      : 'Ver na coleção <span aria-hidden="true">&rarr;</span>';
  }

  function marcarAtivoBusca(n) {
    var input = document.getElementById('buscaInput');
    var itens = document.querySelectorAll('#buscaLista .busca__op');
    if (!itens.length) return;
    if (n < 0) n = itens.length - 1;
    if (n >= itens.length) n = 0;
    _bAtivo = n;
    for (var i = 0; i < itens.length; i++) {
      var on = i === n;
      itens[i].classList.toggle('ativo', on);
      itens[i].setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) {
        input.setAttribute('aria-activedescendant', itens[i].id);
        if (itens[i].scrollIntoView) itens[i].scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function abrirPecaBusca(id) {
    var p = _reg[id];
    fecharBusca();
    if (p) abrirDetalhe(p);
  }

  function abrirBusca() {
    var painel = document.getElementById('busca'), ov = document.getElementById('buscaOverlay');
    var btn = document.getElementById('buscaBtn'), input = document.getElementById('buscaInput');
    if (!painel) return;
    // menu mobile e carrinho abertos atrapalhariam — fecha antes
    var menu = document.getElementById('mobileMenu'), toggle = document.getElementById('navToggle');
    if (menu && menu.classList.contains('open')) {
      menu.classList.remove('open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
    fecharCarrinho();
    alturaNav();
    painel.classList.add('open');
    if (ov) ov.classList.add('open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    renderBusca();
    if (!_bProds) {
      _bErro = false;                       // carregar() zera o cache no erro: dá pra tentar de novo
      carregar().then(function (r) {
        if (r.error) throw r.error;
        _bProds = r.prods || [];
      }).catch(function (err) {
        _bErro = true;
        if (window.console) console.error('Loja (busca):', err);
      }).then(function () {
        if (painel.classList.contains('open')) renderBusca();
      });
    }
    if (input) requestAnimationFrame(function () { input.focus(); });
  }

  function fecharBusca(devolverFoco) {
    var painel = document.getElementById('busca'), ov = document.getElementById('buscaOverlay');
    var btn = document.getElementById('buscaBtn');
    if (!painel || !painel.classList.contains('open')) return;
    painel.classList.remove('open');
    if (ov) ov.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (devolverFoco && btn) btn.focus();
  }

  function montarBusca() {
    var btn = document.getElementById('buscaBtn');
    if (!btn || !document.body || document.getElementById('busca')) return;

    var d = document.createElement('div');
    d.innerHTML =
      '<div class="busca-overlay" id="buscaOverlay"></div>' +
      '<div class="busca" id="busca">' +
        '<div class="busca__inner">' +
          '<form class="busca__campo" id="buscaForm" role="search" action="colecao.html" method="get">' +
            LUPA_SVG +
            '<input class="busca__input" id="buscaInput" name="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search"' +
              ' role="combobox" aria-expanded="false" aria-controls="buscaLista" aria-autocomplete="list"' +
              ' aria-label="Buscar peças por nome, código, pedra ou categoria"' +
              ' placeholder="Buscar peça, código, pedra…" />' +
            '<button class="busca__limpar" id="buscaLimpar" type="button" hidden>Limpar</button>' +
            '<button class="busca__fechar" id="buscaFechar" type="button" aria-label="Fechar busca">&times;</button>' +
          '</form>' +
          '<p class="busca__status" id="buscaStatus" role="status" aria-live="polite"></p>' +
          '<ul class="busca__lista" id="buscaLista" role="listbox" aria-label="Peças encontradas"></ul>' +
          '<p class="busca__vazio" id="buscaVazio" hidden></p>' +
          '<a class="busca__todos" id="buscaTodos" href="colecao.html">Ver toda a coleção <span aria-hidden="true">&rarr;</span></a>' +
        '</div>' +
      '</div>';
    while (d.firstChild) document.body.appendChild(d.firstChild);

    var painel = document.getElementById('busca');
    var input = document.getElementById('buscaInput');

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      painel.classList.contains('open') ? fecharBusca(true) : abrirBusca();
    });
    document.getElementById('buscaOverlay').addEventListener('click', function () { fecharBusca(); });
    document.getElementById('buscaFechar').addEventListener('click', function () { fecharBusca(true); });
    document.getElementById('buscaLimpar').addEventListener('click', function () {
      input.value = ''; renderBusca(); input.focus();
    });

    input.addEventListener('input', function () {
      if (_bTimer) clearTimeout(_bTimer);
      _bTimer = setTimeout(renderBusca, 120);   // não recalcula a cada tecla
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); marcarAtivoBusca(_bAtivo + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); marcarAtivoBusca(_bAtivo - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); fecharBusca(true); }
    });

    // Sem item destacado, o Enter cai no submit do form -> colecao.html?q=…
    // (funciona até sem JS). Com item destacado, abre o card da peça.
    document.getElementById('buscaForm').addEventListener('submit', function (e) {
      if (_bAtivo >= 0 && _bLista[_bAtivo]) {
        e.preventDefault();
        abrirPecaBusca(_bLista[_bAtivo].id);
      } else if (!input.value.trim()) {
        e.preventDefault();
      }
    });

    document.getElementById('buscaLista').addEventListener('click', function (e) {
      var li = e.target.closest ? e.target.closest('.busca__op') : null;
      if (li) abrirPecaBusca(li.getAttribute('data-id'));
    });

    // A rolagem do fundo continua livre de propósito: travar o body faria a
    // barra de rolagem sumir e o logo (nav fixed) pular. Como a nav encolhe ao
    // rolar, o painel remede a altura dela pra não descolar.
    window.addEventListener('resize', function () {
      if (painel.classList.contains('open')) alturaNav();
    });
    window.addEventListener('scroll', function () {
      if (painel.classList.contains('open')) alturaNav();
    }, { passive: true });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fecharBusca();
    });
  }

  montarCarrinho();
  montarDetalhe();
  montarBusca();

  return {
    sb: sb,
    WA_NUMBER: WA_NUMBER,
    esc: esc,
    brl: brl,
    WA_SVG: WA_SVG,
    waHref: waHref,
    familiaDe: familiaDe,
    cardHTML: cardHTML,
    carregar: carregar,
    normalizar: normalizar,
    filtrarBusca: filtrarBusca,
    megaMenuHTML: megaMenuHTML,
    montarMega: montarMega,
    ligarWhatsApp: ligarWhatsApp,
    Carrinho: {
      add: addCarrinho,
      abrir: abrirCarrinho,
      montar: montarCarrinho,
      conta: function () { return lerCarrinho().length; },
      atualizarBadge: atualizarBadge
    },
    Detalhe: { abrir: abrirDetalhe, montar: montarDetalhe },
    Busca: { abrir: abrirBusca, fechar: fecharBusca, montar: montarBusca }
  };
})();
