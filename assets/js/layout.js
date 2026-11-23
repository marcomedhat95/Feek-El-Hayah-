/* Shared header, footer and helper functions */
(function () {
  const PAGES = [
    ["index.html", "nav_home"], ["about.html", "nav_about"], ["concerts.html", "nav_concerts"],
    ["gallery.html", "nav_gallery"], ["videos.html", "nav_videos"], ["join.html", "nav_join"], ["contact.html", "nav_contact"]
  ];
  const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  /* ---------- helpers ---------- */
  window.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  window.nl2br = s => esc(s).replace(/\n/g, "<br>");
  window.fmtDate = (iso, withTime = true) => {
    if (!iso) return "";
    const o = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    if (withTime) { o.hour = "numeric"; o.minute = "2-digit"; }
    return new Date(iso).toLocaleString(LANG === "ar" ? "ar-EG" : "en-GB", o);
  };
  window.money = n => Number(n || 0).toLocaleString(LANG === "ar" ? "ar-EG" : "en-US") + " " + SITE_CONFIG.CURRENCY[LANG];
  window.ytId = url => {
    if (!url) return "";
    const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
    return m ? m[1] : (/^[\w-]{11}$/.test(url) ? url : "");
  };
  window.toast = (msg, type = "ok") => {
    const el = document.createElement("div"); el.className = "toast " + type; el.textContent = msg;
    document.body.appendChild(el); setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 3800);
  };
  window.validPhone = p => /^(\+?20)?0?1[0125]\d{8}$/.test(String(p).replace(/[\s-]/g, "")) || /^\+?\d{8,15}$/.test(String(p).replace(/[\s-]/g, ""));

  /* Seat-plan rows text → rows. Two formats per line:
     1) Simple:  "A-E:24:vip"   → rows A..E, seats 1..24 (aisle in the middle), category vip
                 "AA-EE:20:bal" → double letters work too
     2) Exact:   "A: 15 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 _ :vip"
                 numbers = seats in the order shown (left → right, stage on top)
                 "|" = aisle,  "_" = empty place (no seat)
     A line "---" adds a horizontal walkway between rows. */
  window.expandRows = function (text) {
    const out = [];
    String(text || "").split(/\n|;/).map(l => l.trim()).filter(Boolean).forEach(line => {
      if (/^-{3,}$/.test(line)) { out.push({ spacer: true, list: [], seats: 0 }); return; }
      const parts = line.split(":").map(x => (x || "").trim());
      const range = parts[0], mid = parts[1] || "", cat = parts[2] || "";
      if (/\s/.test(mid) || /[|_]/.test(mid)) {          // exact list
        const list = mid.split(/\s+/).filter(Boolean).map(x => /^\d+$/.test(x) ? x : (x === "|" ? "|" : "_"));
        out.push({ row: range.toUpperCase(), list, seats: list.filter(x => /^\d+$/.test(x)).length, cat });
        return;
      }
      const n = parseInt(mid, 10) || 0, half = Math.ceil(n / 2);
      const list = []; for (let i = 1; i <= n; i++) { if (i === half + 1) list.push("|"); list.push(String(i)); }
      const [a, b] = range.split("-").map(x => x.trim().toUpperCase());
      if (!b) { out.push({ row: a, list, seats: n, cat }); return; }
      const rep = a.length;
      for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) out.push({ row: String.fromCharCode(c).repeat(rep), list: list.slice(), seats: n, cat });
    });
    return out;
  };
  /* all valid seat ids of a layout → { "A-15": price, ... } */
  window.seatPrices = function (layout) {
    const cats = Object.fromEntries((layout.categories || []).map(x => [x.id, x])), out = {};
    (layout.sections || []).forEach(sec => expandRows(sec.rows).forEach(r => (r.list || []).forEach(x => {
      if (/^\d+$/.test(x)) out[r.row + "-" + x] = Number((cats[r.cat] || {}).price || 0);
    })));
    return out;
  };

  window.SOCIALS = [
    ["facebook", "fa-brands fa-facebook-f", "Facebook"], ["instagram", "fa-brands fa-instagram", "Instagram"],
    ["youtube", "fa-brands fa-youtube", "YouTube"], ["spotify", "fa-brands fa-spotify", "Spotify"],
    ["anghami", "fa-solid fa-music", "Anghami"], ["soundcloud", "fa-brands fa-soundcloud", "SoundCloud"]
  ];
  window.socialIcons = (s, cls = "socials") =>
    `<div class="${cls}">` + SOCIALS.filter(x => s[x[0]]).map(x =>
      `<a href="${esc(s[x[0]])}" target="_blank" rel="noopener" title="${x[2]}" aria-label="${x[2]}"><i class="${x[1]}"></i></a>`).join("") + `</div>`;

  /* ---------- header & footer ---------- */
  window.renderLayout = async function () {
    const header = document.getElementById("site-header");
    const isAdminPage = here === "admin.html";
    if (header) {
      header.innerHTML = `
      ${DB.live ? "" : `<div class="demo-banner">${t("demo_banner")}</div>`}
      <nav class="nav">
        <a class="brand" href="index.html"><img src="assets/img/logo.png" alt=""><span>${t("site_name")}</span></a>
        <button class="burger" aria-label="Menu" onclick="document.body.classList.toggle('menu-open')"><span></span><span></span><span></span></button>
        <div class="links">
          ${PAGES.map(([h, k]) => `<a href="${h}" class="${h === here ? "active" : ""}">${t(k)}</a>`).join("")}
          ${isAdminPage ? `<a href="admin.html" class="active">${t("nav_admin")}</a>` : ""}
          <button class="lang-btn" onclick="setLang('${LANG === "ar" ? "en" : "ar"}')"><i class="fa-solid fa-globe"></i> ${t("lang_switch")}</button>
        </div>
      </nav>`;
    }
    const footer = document.getElementById("site-footer");
    if (footer) {
      const s = window.SETTINGS || await DB.getSettings();
      footer.innerHTML = `
      <div class="foot-inner">
        <div class="foot-brand"><img src="assets/img/logo-white.png" alt=""><div><b>${t("site_name")}</b><p>${t("site_tag")}</p></div></div>
        <div class="foot-links">${PAGES.map(([h, k]) => `<a href="${h}">${t(k)}</a>`).join("")}</div>
        <div class="foot-contact">
          <b>${t("follow_us")}</b>${socialIcons(s)}
          ${s.email ? `<a href="mailto:${esc(s.email)}"><i class="fa-solid fa-envelope"></i> ${esc(s.email)}</a>` : ""}
        </div>
      </div>
      <div class="foot-bottom">© ${new Date().getFullYear()} ${t("site_name")} — ${t("footer_rights")} · <a href="admin.html">${t("nav_admin")}</a></div>`;
    }
    applyI18n();
  };

  window.startPage = async function (fn) {
    try { window.SETTINGS = await DB.getSettings(); } catch (e) { console.error(e); window.SETTINGS = {}; }
    await renderLayout();
    try { if (fn) await fn(window.SETTINGS); } catch (e) { console.error(e); toast(t("error"), "err"); }
    document.body.classList.add("ready");
  };
})();
