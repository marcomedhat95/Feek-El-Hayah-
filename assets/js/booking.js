/* Concerts page: list concerts, seat plan, booking */
(function () {
  const MAX = SITE_CONFIG.MAX_SEATS_PER_BOOKING;
  const state = {}; // concertId → { c, selected:Set, taken:Set }

  function priceChips(c) {
    return (layoutOf(c).categories || []).map(k =>
      `<span class="price-chip"><i style="background:${esc(k.color)}"></i>${esc(tf(k, "name"))}: <b>${money(k.price)}</b></span>`).join("");
  }

  function concertCard(c) {
    const cancelled = c.status === "cancelled";
    const canBook = !cancelled && c.booking_open !== false;
    return `
    <article class="card concert" id="c-${c.id}">
      <div class="concert-top">
        <div class="poster">${c.poster_url ? `<img src="${esc(c.poster_url)}" alt="">` : `<img class="ph" src="assets/img/logo.png" alt="">`}</div>
        <div class="body">
          ${cancelled ? `<span class="tag red">${t("cancelled")}</span>` : !canBook ? `<span class="tag grey">${t("booking_closed")}</span>` : ""}
          <h2 style="color:var(--plum-700);margin:8px 0 0">${esc(tf(c, "title"))}</h2>
          <div class="meta"><span><i class="fa-regular fa-calendar"></i>${fmtDate(c.date)}</span><span><i class="fa-solid fa-location-dot"></i>${esc(tf(c, "venue"))}</span></div>
          <p>${nl2br(tf(c, "description"))}</p>
          <div class="prices">${priceChips(c)}</div>
          ${canBook ? `<button class="toggle-plan" data-id="${c.id}"><span class="arrow"><i class="fa-solid fa-chevron-right"></i></span><span class="lbl">${t("show_seats")}</span></button>` : ""}
        </div>
      </div>
      <div class="plan-wrap" id="plan-${c.id}"></div>
    </article>`;
  }

  function planHtml(id) {
    const { c, taken, selected } = state[id];
    const L = layoutOf(c), cats = catMap(L);
    let h = `<div class="plan-scroll"><div class="plan"><div class="stage">${t("stage")}</div>`;
    (L.sections || []).forEach(sec => {
      h += `<h4>${esc(tf(sec, "name"))}</h4>`;
      expandRows(sec.rows).forEach(r => {
        if (r.spacer) { h += `<div class="walkway"></div>`; return; }
        const col = (cats[r.cat] || {}).color || "#999";
        h += `<div class="row"><span class="rl">${esc(r.row)}</span>`;
        r.list.forEach(x => {
          if (x === "|") { h += `<span class="gap"></span>`; return; }
          if (x === "_") { h += `<span class="noseat"></span>`; return; }
          const sid = r.row + "-" + x;
          h += `<button type="button" class="seat${selected.has(sid) ? " sel" : ""}" style="--c:${esc(col)}" data-seat="${sid}" title="${sid} — ${esc(tf(cats[r.cat] || {}, "name"))}" ${taken.has(sid) ? "disabled" : ""}>${x}</button>`;
        });
        h += `<span class="rl">${esc(r.row)}</span></div>`;
      });
    });
    h += `<div class="legend">${(L.categories || []).map(k => `<span><i style="border-color:${esc(k.color)}"></i>${esc(tf(k, "name"))} (${money(k.price)})</span>`).join("")}
      <span><i style="background:var(--plum-600);border-color:var(--plum-600)"></i>${t("legend_selected")}</span>
      <span><i style="background:#d6d2da;border-color:#d6d2da"></i>${t("legend_taken")}</span></div></div></div>`;
    return h;
  }

  function seatPrice(c, sid) {
    if (!c._prices) c._prices = seatPrices(layoutOf(c));
    return c._prices[sid] || 0;
  }

  function summaryHtml(id) {
    const { c } = state[id];
    const pay = tf(c, "payment_info");
    return `
    <aside class="card summary">
      <h3 style="color:var(--plum-700)">${t("selected_seats")}</h3>
      <div class="seats-list" id="sl-${id}"></div>
      <div>${t("total")}: <div class="total" id="tt-${id}">${money(0)}</div></div>
      <form id="bf-${id}" novalidate>
        <div class="field"><label class="req">${t("your_name")}</label><input name="name" required maxlength="80"></div>
        <div class="field"><label class="req">${t("your_phone")}</label><input name="phone" required inputmode="tel" dir="ltr" maxlength="20"></div>
        <div class="field"><label>${t("your_email")}</label><input name="email" type="email" dir="ltr" maxlength="120"></div>
        ${pay ? `<div class="pay-box"><b><i class="fa-solid fa-wallet"></i> ${t("payment_info")}</b><br>${nl2br(pay)}</div>` : ""}
        <div class="field"><label class="${c.receipt_required === false ? "" : "req"}">${t("receipt")}</label><input name="receipt" type="file" accept="image/*,.pdf"><div class="hint">${t("receipt_hint")}</div></div>
        <div class="field"><label>${t("notes")}</label><textarea name="notes" maxlength="500" style="min-height:70px"></textarea></div>
        <button class="btn btn-gold" style="width:100%;justify-content:center"><i class="fa-solid fa-check"></i> ${t("confirm_booking")}</button>
      </form>
    </aside>`;
  }

  function refreshSummary(id) {
    const st = state[id];
    const seats = [...st.selected];
    document.getElementById("sl-" + id).innerHTML = seats.length ? seats.map(s => `<span>${s}</span>`).join("") : `<small style="color:var(--muted)">${t("none_selected")}</small>`;
    document.getElementById("tt-" + id).textContent = money(seats.reduce((a, s) => a + seatPrice(st.c, s), 0));
  }

  async function openPlan(id) {
    const wrap = document.getElementById("plan-" + id);
    wrap.innerHTML = `<p class="empty">${t("loading")}</p>`;
    state[id].taken = new Set(await DB.takenSeats(id));
    [...state[id].selected].forEach(s => state[id].taken.has(s) && state[id].selected.delete(s));
    wrap.innerHTML = `<div>${planHtml(id)}</div>${summaryHtml(id)}`;
    refreshSummary(id);
    wrap.querySelector(".plan").addEventListener("click", e => {
      const b = e.target.closest(".seat"); if (!b || b.disabled) return;
      const sel = state[id].selected, sid = b.dataset.seat;
      if (sel.has(sid)) sel.delete(sid);
      else { if (sel.size >= MAX) return toast(t("max_seats") + ": " + MAX, "err"); sel.add(sid); }
      b.classList.toggle("sel", sel.has(sid)); refreshSummary(id);
    });
    document.getElementById("bf-" + id).addEventListener("submit", e => submit(e, id));
  }

  async function submit(e, id) {
    e.preventDefault();
    const f = e.target, st = state[id], btn = f.querySelector("button");
    const seats = [...st.selected];
    const el = f.elements; const name = el["name"].value.trim(), phone = el["phone"].value.trim(), file = el["receipt"].files[0];
    if (!seats.length) return toast(t("none_selected"), "err");
    if (!name) return toast(t("your_name") + " — " + t("required"), "err");
    if (!validPhone(phone)) return toast(t("invalid_phone"), "err");
    if (st.c.receipt_required !== false && !file) return toast(t("receipt") + " — " + t("required"), "err");
    if (file && file.size > 8 * 1024 * 1024) return toast(t("file_too_big"), "err");
    btn.disabled = true; btn.textContent = t("sending");
    try {
      let receipt_path = "";
      if (file) receipt_path = (await DB.upload("receipts", file)).path;
      const total = seats.reduce((a, s) => a + seatPrice(st.c, s), 0);
      const res = await DB.bookSeats({ concert_id: id, seats, name, phone, email: el["email"].value.trim(), notes: el["notes"].value.trim(), total, receipt_path });
      st.selected.clear();
      document.getElementById("plan-" + id).innerHTML = `
        <div class="card done-box" style="grid-column:1/-1">
          <i class="fa-solid fa-circle-check" style="font-size:3rem;color:var(--ok)"></i>
          <h3>${t("booking_done")}</h3>
          <div>${t("booking_code")}</div><div class="code">${esc(res.code)}</div>
          <p>${seats.join(" · ")} — <b>${money(total)}</b></p>
          <p class="hint">${t("booking_pending_note")}</p>
        </div>`;
    } catch (err) {
      console.error(err);
      if (err.message === "SEATS_TAKEN") { toast(t("seat_taken"), "err"); openPlan(id); }
      else { toast(t("error"), "err"); btn.disabled = false; btn.textContent = t("confirm_booking"); }
    }
  }

  startPage(async () => {
    const list = await upcomingConcerts();
    const box = document.getElementById("list");
    if (!list.length) { box.innerHTML = `<div class="empty"><i class="fa-solid fa-music"></i>${t("no_concerts")}</div>`; }
    else box.innerHTML = list.map(concertCard).join("");
    list.forEach(c => state[c.id] = { c, selected: new Set(), taken: new Set() });

    box.addEventListener("click", e => {
      const b = e.target.closest(".toggle-plan"); if (!b) return;
      const card = document.getElementById("c-" + b.dataset.id);
      const open = card.classList.toggle("open");
      b.querySelector(".lbl").textContent = open ? t("hide_seats") : t("show_seats");
      if (open) openPlan(b.dataset.id);
    });
    const hash = location.hash.replace("#c-", "");
    if (hash && state[hash]) {
      const b = document.querySelector(`.toggle-plan[data-id="${hash}"]`);
      if (b) b.click();
      document.getElementById("c-" + hash).scrollIntoView();
    }

    document.getElementById("checkForm").addEventListener("submit", async e => {
      e.preventDefault();
      const f = e.target, out = document.getElementById("checkResult");
      const r = await DB.checkBooking(f.code.value, f.phone.value);
      if (!r) { out.innerHTML = `<div class="notice warn">${t("not_found")}</div>`; return; }
      const cls = { pending: "warn", confirmed: "ok", cancelled: "" }[r.status] || "";
      out.innerHTML = `<div class="notice ${cls}"><b>${esc(tf(r, "title"))}</b> — ${fmtDate(r.date)}<br>
        ${t("selected_seats")}: ${esc((r.seats || []).join(", "))}<br>${t("status")}: <b>${t("st_" + r.status)}</b></div>`;
    });
  });
})();
