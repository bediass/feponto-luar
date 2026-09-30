  (function () {
    "use strict";

    /* Nav, menu mobile, reveal, ano e links de WhatsApp saíram daqui pro
       assets/pagina-chrome.js, que a garantia.html também usa. */

    var grid = document.getElementById("grid");
    var estado = document.getElementById("catalogoEstado");
    if (!window.Loja) { if (estado) estado.textContent = "Não foi possível carregar o acervo agora."; return; }

    /* --- Catálogo filtrável --- */
    var params = new URLSearchParams(location.search);
    var genero = (params.get("publico") || "todos").toLowerCase();
    if (["feminino", "masculino", "infantil"].indexOf(genero) < 0) genero = "todos";
    var familia = params.get("fam") || "todas";
    var sub = params.get("sub") || "";
    var busca = (params.get("q") || "").trim();   // termo vindo da busca do cabeçalho
    var cat = (params.get("cat") || "").trim();   // categoria por NOME, do carrossel da home

    Loja.carregar().then(function (r) {
      Loja.montarMega(r.prods, r.byId);
      if (r.error) throw r.error;
      var prods = r.prods, byId = r.byId;

      // ?cat=<nome> — o carrossel da home aponta por NOME, não por id: a URL
      // fica legível e não quebra se a categoria for recriada no ERP com
      // outro id. Compara sem acento e sem caixa (cat=aneis casa com "Anéis").
      if (cat) {
        var alvoNome = Loja.normalizar(cat), achado = null;
        for (var k in byId) {
          if (Loja.normalizar(byId[k].nome) !== alvoNome) continue;
          // Quase toda família tem uma subcategoria homônima ("Anéis > Anéis").
          // A família ganha: mostra a seção inteira, não só o balde genérico.
          if (!byId[k].parent_id) { achado = byId[k]; break; }
          if (!achado) achado = byId[k];
        }
        if (achado) {
          if (achado.parent_id) { sub = achado.id; }
          else { familia = achado.id; sub = ""; }
        }
      }

      // Se veio uma subcategoria, ativa a família-pai no filtro
      if (sub && byId[sub] && byId[sub].parent_id) familia = byId[sub].parent_id;

      // Famílias presentes no acervo (para os botões)
      var famsMap = {};
      prods.forEach(function (p) { var f = Loja.familiaDe(p.categoria_id, byId); if (f) famsMap[f.id] = { id: f.id, nome: f.nome, ordem: f.ordem || 0 }; });
      var fams = Object.keys(famsMap).map(function (k) { return famsMap[k]; })
        .sort(function (a, b) { return (a.ordem - b.ordem) || a.nome.localeCompare(b.nome); });

      // Botões de gênero
      var generos = [["todos", "Todos"], ["feminino", "Feminino"], ["masculino", "Masculino"], ["infantil", "Infantil"]];
      document.getElementById("filtroGenero").innerHTML = generos.map(function (g) {
        return '<button class="filter" type="button" data-g="' + g[0] + '">' + g[1] + '</button>';
      }).join("");

      // Botões de família
      document.getElementById("filtroFamilia").innerHTML =
        '<button class="filter" type="button" data-f="todas">Todas</button>' +
        fams.map(function (f) { return '<button class="filter" type="button" data-f="' + Loja.esc(f.id) + '">' + Loja.esc(f.nome) + '</button>'; }).join("");

      function casaChave(p, g) {
        if (g === "todos") return true;
        var pub = (p.publico || "").toLowerCase();
        if (pub === g) return true;
        if ((g === "masculino" || g === "feminino") && pub === "unissex") return true;
        return false;
      }
      function casaGenero(p) { return casaChave(p, genero); }
      function casaFamilia(p) {
        if (familia === "todas") return true;
        var f = Loja.familiaDe(p.categoria_id, byId);
        return !!(f && f.id === familia);
      }
      function casaSub(p) { return !sub || p.categoria_id === sub; }

      function nomeGenero() {
        var m = { todos: "", feminino: "Feminino", masculino: "Masculino", infantil: "Infantil" };
        return m[genero] || "";
      }
      function nomeFiltro() {
        if (sub && byId[sub]) return byId[sub].nome;
        if (familia !== "todas" && byId[familia]) return byId[familia].nome;
        return "";
      }

      function atualizarCabecalho(qtd) {
        var g = nomeGenero(), c = nomeFiltro();
        var partes = [c, g].filter(Boolean);
        var titulo = document.getElementById("colecaoTitulo");
        var subEl = document.getElementById("colecaoSub");
        titulo.textContent = busca
          ? "Resultados da busca"
          : (partes.length ? partes.join(" · ") : "Coleção completa");
        subEl.textContent = qtd + (qtd === 1 ? " peça encontrada" : " peças encontradas") + " · fale no WhatsApp para valores e disponibilidade.";
      }

      /* Chip "buscando por X" + botão de limpar. Sem ele o usuário fica sem
         saber por que a coleção veio cortada ao chegar por ?q=. */
      var chip = document.getElementById("buscaAtiva");
      function atualizarChipBusca() {
        if (!chip) return;
        chip.hidden = !busca;
        chip.innerHTML = busca
          ? '<span>Buscando por</span> <strong>' + Loja.esc(busca) + '</strong>' +
            '<button type="button" id="limparBusca">Limpar busca &times;</button>'
          : "";
      }
      if (chip) chip.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest("#limparBusca") : null;
        if (!b) return;
        busca = ""; render();
      });

      /* O público é refino da categoria, então os chips dele acompanham o que
         existe DENTRO da categoria escolhida: sem peça, o chip apaga e não
         clica. Sem isso a Fernanda (e o cliente) cai em "0 peças encontradas"
         com facilidade — o cadastro de público é irregular, há peça sem público
         nenhum, e nenhuma peça do acervo é masculina, então "Masculino" só
         responde pelas unissex. O chip ativo nunca é desabilitado: ele precisa
         continuar clicável pra dar pra sair da seleção vazia. */
      function marcarAtivos() {
        var base = prods.filter(function (p) { return casaFamilia(p) && casaSub(p); });
        if (busca) base = Loja.filtrarBusca(base, busca);
        document.querySelectorAll("#filtroGenero .filter").forEach(function (b) {
          var g = b.getAttribute("data-g");
          var ativo = g === genero;
          var tem = base.some(function (p) { return casaChave(p, g); });
          b.classList.toggle("active", ativo);
          b.disabled = !tem && !ativo;
          b.setAttribute("aria-pressed", ativo ? "true" : "false");
        });
        document.querySelectorAll("#filtroFamilia .filter").forEach(function (b) {
          var ativo = b.getAttribute("data-f") === familia;
          b.classList.toggle("active", ativo);
          b.setAttribute("aria-pressed", ativo ? "true" : "false");
        });
      }

      function sincronizarURL() {
        var q = [];
        if (genero !== "todos") q.push("publico=" + genero);
        if (sub) q.push("sub=" + sub);
        else if (familia !== "todas") q.push("fam=" + familia);
        if (busca) q.push("q=" + encodeURIComponent(busca));
        var url = "colecao.html" + (q.length ? "?" + q.join("&") : "");
        try { history.replaceState(null, "", url); } catch (e) { /* file:// pode bloquear */ }
      }

      function render() {
        var lista = prods.filter(function (p) { return casaGenero(p) && casaFamilia(p) && casaSub(p); });
        if (busca) lista = Loja.filtrarBusca(lista, busca);   // busca por cima dos filtros
        if (!lista.length) {
          grid.innerHTML = "";
          estado.style.display = "";
          estado.textContent = busca
            ? 'Nenhuma peça encontrada para “' + busca + '”. Tente outro termo, veja outras categorias ou fale com a gente no WhatsApp.'
            : "Nenhuma peça nesta seleção no momento. Veja outras categorias ou fale com a gente no WhatsApp.";
        } else {
          estado.style.display = "none";
          grid.innerHTML = lista.map(function (p) { return Loja.cardHTML(p, byId); }).join("");
        }
        marcarAtivos();
        atualizarChipBusca();
        atualizarCabecalho(lista.length);
        sincronizarURL();
      }

      document.getElementById("filtroGenero").addEventListener("click", function (e) {
        var b = e.target.closest(".filter"); if (!b) return;
        genero = b.getAttribute("data-g"); sub = ""; render();
      });
      document.getElementById("filtroFamilia").addEventListener("click", function (e) {
        var b = e.target.closest(".filter"); if (!b) return;
        familia = b.getAttribute("data-f"); sub = ""; render();
      });

      render();
    }).catch(function (err) {
      if (window.console) console.error("Loja:", err);
      estado.textContent = "Não foi possível carregar o acervo agora. Fale com a gente no WhatsApp.";
    });
  })();
