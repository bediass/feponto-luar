  (function () {
    "use strict";
    var WA_NUMBER = "5531994732018"; // (31) 99473-2018

    /* --- WhatsApp links: monta href com mensagem pré-preenchida --- */
    document.querySelectorAll("[data-wa]").forEach(function (el) {
      var msg = el.getAttribute("data-msg") || "Olá! Vim pelo site da Fê Ponto Joias.";
      var href = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(msg);
      if (el.tagName === "A") {
        el.setAttribute("href", href);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      } else {
        el.addEventListener("click", function () { window.open(href, "_blank", "noopener"); });
      }
    });

    /* --- Navbar scrolled state + WhatsApp flutuante após a hero --- */
    var nav = document.getElementById("nav");
    var waFloat = document.querySelector(".wa-float");
    var curadoria = document.getElementById("curadoria");
    var onScroll = function () {
      nav.classList.toggle("scrolled", window.scrollY > 40);
      if (waFloat && curadoria) {
        // aparece quando a segunda seção (Curadoria) entra na tela
        var show = curadoria.getBoundingClientRect().top < window.innerHeight * 0.75;
        waFloat.classList.toggle("visible", show);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    /* --- Mobile menu --- */
    var toggle = document.getElementById("navToggle");
    var menu = document.getElementById("mobileMenu");
    var closeMenu = function () {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    menu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeMenu); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

    /* --- Category filter --- */
    var filters = document.querySelectorAll(".filter");
    var pieces = document.querySelectorAll(".piece");
    filters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        filters.forEach(function (f) { f.classList.remove("active"); });
        btn.classList.add("active");
        var cat = btn.getAttribute("data-filter");
        pieces.forEach(function (p) {
          var show = cat === "todas" || p.getAttribute("data-category") === cat;
          p.style.display = show ? "" : "none";
        });
      });
    });

    /* --- Scroll reveal --- */
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var reveals = document.querySelectorAll(".reveal");
    if (reduce || !("IntersectionObserver" in window)) {
      reveals.forEach(function (r) { r.classList.add("in"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
      reveals.forEach(function (r) { io.observe(r); });
    }

    /* --- Carrossel de avaliações: duplica os cards p/ loop contínuo --- */
    var voicesTrack = document.getElementById("voicesTrack");
    if (voicesTrack && !reduce) {
      Array.prototype.slice.call(voicesTrack.children).forEach(function (card) {
        var clone = card.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        voicesTrack.appendChild(clone);
      });
    }

    /* --- Vitrine 360 (carrossel côncavo arrastável) --- */
    var vp = document.getElementById("arcViewport");
    if (vp) {
      var cards = Array.prototype.slice.call(vp.querySelectorAll(".arc-card"));
      var N = cards.length;
      var ANG = 22;                        // graus de rotação (tilt) por peça
      var DRAGPX = 90;                     // pixels de arraste por peça
      var SPACING = 300;                   // recalculado em metrics()
      var rot = 0, vel = 0, dragging = false, lastX = 0, raf = null;

      /* Dimensiona as peças para ~5 preencherem a tela, bordas quase na borda */
      function metrics() {
        var vw = vp.clientWidth || window.innerWidth;
        var cw = vw < 680
          ? Math.max(150, Math.min(vw / 2.7, 320))
          : Math.max(180, Math.min(vw / 5.2, 380));
        for (var i = 0; i < N; i++) { cards[i].style.width = cw + "px"; }
        SPACING = cw * 1.04;               // distância uniforme entre as fotos
      }

      function render() {
        for (var i = 0; i < N; i++) {
          var p = i - rot;                 // posição relativa ao centro (em passos)
          while (p > N / 2) p -= N;        // loop infinito
          while (p <= -N / 2) p += N;
          var x = p * SPACING;             // distância horizontal IGUAL entre peças
          var ry = -p * ANG;               // cada peça inclina em direção ao centro
          var sc = 1 - Math.min(Math.abs(p) * 0.07, 0.34); // mais para trás = menor
          var a = Math.max(0, Math.min(1, 1 - (Math.abs(p) - 2.4) / 0.9));
          var c = cards[i];
          c.style.transform =
            "translate(-50%,0) translateX(" + x.toFixed(1) + "px)" +
            " rotateY(" + ry.toFixed(1) + "deg) scale(" + sc.toFixed(3) + ")";
          c.style.opacity = a.toFixed(2);
          c.style.zIndex = String(1000 - Math.round(Math.abs(p) * 100));
          c.style.pointerEvents = a > 0.5 ? "auto" : "none";
        }
      }

      function tick() {                    // inércia + snap na peça mais próxima
        if (Math.abs(vel) > 0.004) {       // fase 1: desacelera
          rot += vel; vel *= 0.9;
          render(); raf = requestAnimationFrame(tick); return;
        }
        vel = 0;                           // fase 2: encaixa suavemente
        var target = Math.round(rot);
        var d = target - rot;
        if (Math.abs(d) < 0.0015) { rot = target; raf = null; render(); return; }
        rot += d * 0.14;
        render(); raf = requestAnimationFrame(tick);
      }
      function settle() {                  // dispara inércia/snap se não estiver rodando
        if (raf) return;
        if (reduce) { rot = Math.round(rot); render(); return; }
        raf = requestAnimationFrame(tick);
      }

      /* Arrastar com mouse/dedo.
       *
       * Cada peça virou LINK de categoria, e isso muda o jogo: o gesto só
       * pode virar rotação quando for mesmo arraste. Duas armadilhas aqui,
       * as duas descobertas testando no navegador de verdade:
       *
       * 1. `setPointerCapture` no pointerdown MATAVA o clique no PC. Com a
       *    captura ativa o Chrome entrega o `click` ao elemento que capturou
       *    (a vitrine), e o link do card nunca recebia — clicar não abria
       *    nada. No celular funcionava, porque ali o clique nasce do toque e
       *    não passa por essa regra. Por isso a captura só começa DEPOIS que
       *    o gesto virou arraste.
       *
       * 2. Sem limiar, a tremida natural do mouse entre apertar e soltar
       *    já girava o carrossel: a pessoa clicava e a vitrine andava para a
       *    foto do lado. Abaixo de LIMIAR o gesto é clique e não mexe em nada.
       */
      var LIMIAR = 8;                      // px para o gesto virar arraste
      var andou = 0, arrastou = false;

      /* 3. Link é arrastável por padrão: soltar depois de mover 2px iniciava o
       *    arraste NATIVO do link e o navegador engolia o clique — no PC não
       *    abria nada. Já barrado por draggable="false" no HTML e por
       *    -webkit-user-drag no CSS; aqui é a trava que pega o texto do nome. */
      vp.addEventListener("dragstart", function (e) { e.preventDefault(); });

      vp.addEventListener("pointerdown", function (e) {
        dragging = true; lastX = e.clientX; vel = 0; andou = 0; arrastou = false;
        if (raf) { cancelAnimationFrame(raf); raf = null; }
      });
      vp.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var dx = e.clientX - lastX; lastX = e.clientX;
        andou += Math.abs(dx);
        if (!arrastou) {
          if (andou < LIMIAR) return;      // ainda é tremida de clique
          arrastou = true;
          vp.classList.add("grabbing");
          try { vp.setPointerCapture(e.pointerId); } catch (err) {}
        }
        var dRot = -dx / DRAGPX;
        rot += dRot; vel = dRot; render();
      });

      /* Girar não é clicar: depois de arrastar, soltar o dedo abriria a
         categoria que por acaso estivesse sob o cursor. Na fase de captura,
         para o clique antes de ele chegar no link. */
      vp.addEventListener("click", function (e) {
        if (arrastou) { e.preventDefault(); e.stopPropagation(); }
      }, true);

      /* Tab entre os links: traz o card focado para o centro. Sem isto o foco
         ia parar numa peça quase invisível na beirada do arco.
         SÓ para foco de teclado (:focus-visible). Clicar também dá foco ao
         card, e recentralizar ali movia a peça de baixo do cursor entre
         apertar e soltar — o navegador então não gerava clique nenhum, e os
         cards laterais ficavam impossíveis de abrir no mouse. */
      cards.forEach(function (c, i) {
        c.addEventListener("focus", function () {
          var porTeclado = false;
          try { porTeclado = c.matches(":focus-visible"); } catch (err) {}
          if (!porTeclado) return;
          if (raf) { cancelAnimationFrame(raf); raf = null; }
          rot = i; vel = 0; render();
        });
      });
      function release() {
        if (!dragging) return;
        dragging = false; vp.classList.remove("grabbing");
        if (!arrastou) { vel = 0; return; }  // foi clique: não gira nem encaixa
        settle();                          // inércia e encaixe na peça mais próxima
      }
      vp.addEventListener("pointerup", release);
      vp.addEventListener("pointercancel", release);
      /* Também no window: antes do limiar não há captura de ponteiro, então
         soltar o botão fora da vitrine não avisaria ninguém e o próximo
         movimento do mouse giraria o carrossel sem botão apertado. */
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);

      /* Scroll horizontal (trackpad) — não intercepta a rolagem vertical da página */
      var wheelTimer = null;
      vp.addEventListener("wheel", function (e) {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          e.preventDefault();
          if (raf) { cancelAnimationFrame(raf); raf = null; }
          rot += e.deltaX / 80;
          render();
          if (wheelTimer) clearTimeout(wheelTimer);
          wheelTimer = setTimeout(function () {   // gesto parou → encaixa
            if (!dragging) settle();
          }, 140);
        }
      }, { passive: false });

      /* Teclado: setas giram a vitrine */
      vp.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { rot -= 1; render(); e.preventDefault(); }
        else if (e.key === "ArrowRight") { rot += 1; render(); e.preventDefault(); }
      });

      window.addEventListener("resize", function () { metrics(); render(); });
      metrics();
      render();                            // já centralizado na peça do meio (rot = 0)
    }

    /* --- Year --- */
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  })();
