/* ============================================================
   Chrome comum das páginas internas (colecao.html, garantia.html)
   Nav, menu mobile, reveal, ano do rodapé e links de WhatsApp.
   Saiu de dentro do pagina-colecao.js pra não virar cópia a cada
   página nova. A home continua no pagina-index-ui.js, que mistura
   isso com a vitrine 360 e o filtro do catálogo.
   ============================================================ */
(function () {
  "use strict";

  /* Nesta página a nav já nasce com fundo (não há hero atrás dela) */
  var nav = document.getElementById("nav");
  if (nav) {
    nav.classList.add("scrolled");
    window.addEventListener("scroll", function () {
      nav.classList.add("scrolled");
    }, { passive: true });
  }

  /* Menu mobile */
  var toggle = document.getElementById("navToggle");
  var menu = document.getElementById("mobileMenu");
  function closeMenu() {
    if (!menu || !toggle) return;
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeMenu); });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  /* Reveal ao rolar */
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (r) { r.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    reveals.forEach(function (r) { io.observe(r); });
  }

  /* Ano do rodapé */
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  /* Links [data-wa]: o loja.js já traz o número e a montagem do href */
  if (window.Loja) Loja.ligarWhatsApp();
})();
