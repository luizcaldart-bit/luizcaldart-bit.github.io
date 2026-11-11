/*
 * Contador de acessos do site (sem cookies, sem IP, sem terceiros).
 * Manda para o seu próprio banco (Supabase) só: um código aleatório que vale enquanto a aba está aberta,
 * a página, de onde a pessoa veio, o tipo de aparelho e cliques marcados com data-evento="...".
 * Respeita "Não rastrear" do navegador e não conta quem abriu o endereço com ?naocontar=1 (use no seu próprio navegador).
 *
 * ANTES DE PUBLICAR: troque as duas linhas abaixo pela URL e pela chave "anon public" do Supabase
 * (as mesmas do arquivo .env do app). Essa chave é pública por natureza; quem protege os dados é o banco.
 */
(function () {
  "use strict";
  var SUPABASE_URL = "https://laiqhmmqervzqwrzoqkn.supabase.co";
  var SUPABASE_CHAVE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhaXFobW1xZXJ2enF3cnpvcWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxNTc3OTEsImV4cCI6MjEwOTczMzc5MX0._fwMg1Rt-LCVDZj5ULX13Hbcf0YVu8z2zKIZyPAflXs";

  try {
    if (SUPABASE_URL.indexOf("__") === 0) return;                         // ainda não configurado
    var nav = navigator, loc = location;
    if (/^(localhost|127\.|\[::1\])/.test(loc.hostname)) return;          // testes locais não contam
    if (nav.doNotTrack === "1" || window.doNotTrack === "1" || nav.msDoNotTrack === "1") return;
    if (/bot|crawl|spider|slurp|headless|lighthouse/i.test(nav.userAgent)) return;

    // ?naocontar=1 marca este navegador como "não contar" (?naocontar=0 desfaz)
    var q = new URLSearchParams(loc.search);
    try {
      if (q.get("naocontar") === "1") localStorage.setItem("tr_naocontar", "1");
      if (q.get("naocontar") === "0") localStorage.removeItem("tr_naocontar");
      if (localStorage.getItem("tr_naocontar") === "1") return;
    } catch (e) { /* sem armazenamento: segue contando */ }

    var CHAVE_SESSAO = "tr_s";   // mesma chave usada pelo app (/app/), para a visita seguir do site para o app

    function codigo() {
      var letras = "abcdefghijklmnopqrstuvwxyz0123456789", out = "", i;
      try {
        var b = new Uint8Array(16); crypto.getRandomValues(b);
        for (i = 0; i < 16; i++) out += letras.charAt(b[i] % 36);
      } catch (e) {
        for (i = 0; i < 16; i++) out += letras.charAt(Math.floor(Math.random() * 36));
      }
      return out;
    }

    function rotulo(v) {
      v = (v || "").toLowerCase().replace(/^\s+|\s+$/g, "");
      return /^[a-z0-9._ -]{1,60}$/.test(v) ? v : "";
    }

    function origem() {
      var utm = rotulo(q.get("utm_source"));
      if (utm) return utm;
      var host = "";
      try { host = new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, ""); } catch (e) { /* sem referência */ }
      var meu = loc.hostname.toLowerCase().replace(/^www\./, "");
      if (host && host !== meu) {
        if (/(^|\.)instagram\.com$/.test(host)) return "instagram.com";
        if (/(^|\.)facebook\.com$/.test(host)) return "facebook.com";
        if (/(^|\.)google\.[a-z.]+$/.test(host)) return "google.com";
        if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(host)) return "whatsapp.com";
        if (host === "t.co") return "x.com";
        return rotulo(host);
      }
      // navegador interno do Instagram/Facebook costuma não mandar a referência
      if (/Instagram/i.test(nav.userAgent)) return "instagram.com";
      if (/FBAN|FBAV/i.test(nav.userAgent)) return "facebook.com";
      return "";
    }

    function aparelho() {
      var ua = nav.userAgent;
      if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
      if (nav.platform === "MacIntel" && nav.maxTouchPoints > 1) return "tablet";   // iPad com site de computador
      if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "celular";
      return "computador";
    }

    var s = null;
    try { s = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || "null"); } catch (e) { s = null; }
    if (!s || !s.id) {
      s = { id: codigo(), origem: origem(), meio: rotulo(q.get("utm_medium")), campanha: rotulo(q.get("utm_campaign")) };
      try { sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); } catch (e) { /* vale só nesta página */ }
    }
    var ap = aparelho();

    function enviar(dados) {
      dados.sessao = s.id; dados.plataforma = "site"; dados.origem = s.origem; dados.meio = s.meio;
      dados.campanha = s.campanha; dados.aparelho = ap;
      try {
        fetch(SUPABASE_URL + "/rest/v1/rpc/registrar_acesso", {
          method: "POST", keepalive: true,
          headers: { "Content-Type": "application/json", apikey: SUPABASE_CHAVE, Authorization: "Bearer " + SUPABASE_CHAVE },
          body: JSON.stringify({ p_dados: dados })
        }).catch(function () { /* contador nunca atrapalha o site */ });
      } catch (e) { /* idem */ }
    }

    var caminho = loc.pathname.replace(/\/index\.html$/, "/") || "/";
    enviar({ tipo: "pagina", caminho: caminho });

    // qualquer elemento com data-evento="nome" vira um evento ao ser clicado (ex.: botão "Abrir o app")
    document.addEventListener("click", function (e) {
      var el = e.target && e.target.closest ? e.target.closest("[data-evento]") : null;
      if (el) enviar({ tipo: "evento", evento: el.getAttribute("data-evento"), caminho: caminho });
    }, true);
  } catch (e) { /* o contador jamais pode quebrar o site */ }
})();
