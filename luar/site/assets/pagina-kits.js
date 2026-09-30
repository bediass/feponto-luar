/* Página de Kits — lê as visões `kits_site` e `kit_itens_site`.
 *
 * POR QUE VISÃO E NÃO TABELA
 *   O banco já entrega pronto o que dá trabalho calcular aqui: quantos kits
 *   dá pra montar (o menor estoque/quantidade entre as peças), a soma das
 *   peças e a economia. Fazer essa conta no navegador exigiria baixar o
 *   estoque de todas as peças e repetir a regra em outro lugar — duas
 *   fontes da mesma verdade, que divergem no primeiro ajuste.
 *   Ver supabase/migrations/0016_kits.sql.
 *
 * O carrinho é o mesmo das peças: o botão usa `data-add`, que o loja.js
 * já escuta por delegação. Kit entra como uma linha só no pedido do
 * WhatsApp — a Luana lança a venda no ERP e as peças dão baixa sozinhas.
 */
(function () {
  "use strict";
  if (!window.Loja) return;
  // ATENÇÃO: `Loja.sb` é uma FÁBRICA preguiçosa, não o cliente. Ela só cria o
  // client na primeira chamada (e devolve null se o supabase-js ainda não
  // carregou). Guardar `L.sb` e chamar `.from()` nele dá TypeError.
  var L = window.Loja, esc = L.esc, money = L.money, sb = L.sb();

  var grade = document.getElementById("kitsGrid");
  var elCount = document.getElementById("kitsCount");
  if (!grade) return;

  /* Ícone de reserva quando o kit ainda não tem foto. Mesmo diamante da
     home (index.html) — sem emoji, herda a cor por currentColor. */
  var GEMA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12l3 5-9 13L3 8l3-5Z"/><path d="M3 8h18"/></svg>';

  function cardKit(k, pecas) {
    var temFoto = k.foto_urls && k.foto_urls.length && k.foto_urls[0];
    var media = temFoto
      ? '<img src="' + esc(k.foto_urls[0]) + '" alt="' + esc(k.nome) + '" loading="lazy" width="400" height="250" />'
      : GEMA;

    // Tarja: o selo da Luana quando existe; senão a economia, que é o
    // argumento de venda do kit. Nunca as duas — poluiria o card.
    var tarja = "";
    if (k.selo) tarja = '<span class="tag">' + esc(k.selo) + "</span>";
    else if (k.economia_centavos > 0) tarja = '<span class="tag tag--line">economize ' + money(k.economia_centavos) + "</span>";

    var lista = "";
    if (pecas.length) {
      lista = '<ul class="kit__pecas">' + pecas.map(function (p) {
        return "<li>" + (p.quantidade > 1 ? '<b>' + p.quantidade + "x</b> " : "") + esc(p.nome) + "</li>";
      }).join("") + "</ul>";
    }

    // Preço riscado só quando há economia de verdade — `.kit__price s` já
    // existe no estilo.css e é o padrão usado na home.
    var preco = "<b>" + money(k.preco_centavos) + "</b>" +
      (k.economia_centavos > 0 ? " <s>" + money(k.soma_pecas_centavos) + "</s>" : "");

    var acao = k.disponivel
      ? '<button class="btn btn--gold btn--sm" data-add="' + esc(k.id) + '" data-slug="' + esc(k.slug) +
        '" data-nome="' + esc(k.nome) + '" data-cat="Kit" data-preco="' + Number(k.preco_centavos) +
        '" data-img="' + esc(temFoto ? k.foto_urls[0] : "") + '">Adicionar</button>'
      : '<span class="kit__esgotado">Esgotado</span>';

    return '<article class="kit reveal">' +
      '<div class="kit__media">' + media + "</div>" +
      tarja +
      '<h2 class="kit__name">' + esc(k.nome) + "</h2>" +
      (k.subtitulo ? '<p class="kit__desc">' + esc(k.subtitulo) + "</p>" : '<p class="kit__desc"></p>') +
      lista +
      '<div class="kit__foot"><span class="kit__price">' + preco + "</span>" + acao + "</div>" +
      "</article>";
  }

  function vazio(msg) {
    grade.className = "";       // tira o grid de 3 colunas pro aviso ocupar a largura
    grade.innerHTML = '<p class="plp-empty">' + esc(msg) + "</p>";
  }

  function render(kits, itensPorKit) {
    if (!kits.length) {
      elCount.textContent = "";
      vazio("Nenhum kit disponível no momento. Dá uma olhada nas peças avulsas, elas continuam todas na loja.");
      return;
    }
    elCount.textContent = kits.length + (kits.length === 1 ? " kit" : " kits");
    grade.innerHTML = kits.map(function (k) {
      return cardKit(k, itensPorKit[k.id] || []);
    }).join("");
    // Cada moldura assume a proporção da própria foto (entre 1:1 e 3:4), a mesma
    // regra da página de produto. Sem isso a foto 9:16 sai decepada. Ver loja.js.
    grade.querySelectorAll(".kit__media img").forEach(function (img) {
      L.ajustarProporcao(img, img.closest(".kit__media"));
    });
    if (L.observarReveal) L.observarReveal();
  }

  function carregar() {
    if (!sb) { elCount.textContent = ""; vazio("Não consegui carregar os kits agora. Recarrega a página em instantes."); return; }

    // O `select("*")` aqui é seguro porque as duas são VIEWS de vitrine: a
    // coluna sensível (custo_centavos, markup) não existe dentro delas. Nas
    // tabelas de base o `anon` tem SELECT apenas nas colunas que estas views
    // referenciam — as views são `security_invoker`, então a permissão é
    // conferida como visitante (migrações 0018 e 0020). Não trocar estas
    // leituras por `from("kits")` direto: lá o `anon` não alcança tudo, e
    // um `select("*")` na base responde 403.
    Promise.all([
      sb.from("kits_site").select("*").order("destaque_ordem", { ascending: true, nullsFirst: false }),
      sb.from("kit_itens_site").select("*")
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      var kits = res[0].data || [];
      var itens = (res[1] && res[1].data) || [];

      var porKit = {};
      itens.forEach(function (i) {
        (porKit[i.kit_id] = porKit[i.kit_id] || []).push(i);
      });

      render(kits, porKit);
    }).catch(function () {
      elCount.textContent = "";
      vazio("Não consegui carregar os kits agora. Recarrega a página em instantes.");
    });
  }

  carregar();
})();
