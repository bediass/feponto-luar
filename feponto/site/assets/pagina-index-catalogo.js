(function () {
  "use strict";
  if (!window.Loja) return;

  Loja.carregar().then(function (r) {
    // Mega-menu (categorias por genero) — presente em todas as paginas
    Loja.montarMega(r.prods, r.byId);
    if (r.error && window.console) console.error("Loja:", r.error);
  }).catch(function (err) {
    if (window.console) console.error("Loja:", err);
  });
})();
