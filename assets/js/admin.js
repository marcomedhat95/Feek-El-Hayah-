/* =========================================================
   Admin panel — Feek El Hayah Choir
   ========================================================= */
(function () {
  const app = document.getElementById("app");
  const modal = document.getElementById("modal"), modalBody = document.getElementById("modalBody");
  let current = "dashboard";

  /* ---------- small helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const dt = iso => iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const egp = n => Number(n || 0).toLocaleString("en-US") + " EGP";
  const toLocalInput = iso => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const closeModal = () => modal.classList.remove("open");
  const openModal = html => { modalBody.innerHTML = html; modal.classList.add("open"); };
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

  function askPassword(message) {
    return new Promise(resolve => {
      openModal(`<h3><i class="fa-solid fa-lock"></i> Confirm with admin password</h3><p>${esc(message)}</p>
        <form id="pwf"><input type="password" name="pw" autocomplete="current-password" placeholder="Admin password" required>
        <div class="modal-actions"><button type="button" class="btn btn-light" id="pwc">Cancel</button><button class="btn btn-primary">Confirm</button></div></form>`);
      $("#pwf input").focus();
      $("#pwc").onclick = () => { closeModal(); resolve(false); };
      $("#pwf").onsubmit = async e => {
        e.preventDefault();
        const ok = await DB.reauth(e.target.pw.value);
        if (!ok) return toast("Wrong password", "err");
        closeModal(); resolve(true);
      };
    });
  }

  function downloadCsv(name, rows) {
    if (!rows.length) return toast("Nothing to export", "err");
    const cols = Object.keys(rows[0]);
    const csv = "﻿" + [cols.join(",")].concat(rows.map(r => cols.map(c => `"${String(r[c] == null ? "" : r[c]).replace(/"/g, '""')}"`).join(","))).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = name + ".csv"; a.click();
  }

  async function openFile(bucket, path) {
    if (!path) return;
    const url = await DB.fileUrl(bucket, path);
    if (!url) return toast("File not found", "err");
    if (url.startsWith("data:")) { // demo mode: show inline
      const isImg = url.startsWith("data:image"), isAudio = /^data:(audio|video)/.test(url);
      openModal(`<h3>File</h3>${isImg ? `<img src="${url}" style="max-height:70vh;margin:auto">` : isAudio ? `<audio controls src="${url}" style="width:100%"></audio>` : `<a href="${url}" download>Download file</a>`}
        <div class="modal-actions"><button class="btn btn-light" onclick="document.getElementById('modal').classList.remove('open')">Close</button></div>`);
    } else window.open(url, "_blank");
  }

  /* ---------- generic form fields ---------- */
  function fieldHtml(f, val) {
    const v = val == null ? (f.def != null ? f.def : "") : val;
    const lab = `<label class="${f.req ? "req" : ""}">${f.label}</label>`;
    const dir = f.key.endsWith("_ar") ? 'dir="rtl"' : f.key.endsWith("_en") ? 'dir="ltr"' : "";
    const cls = f.full || f.type === "textarea" || f.type === "layout" || f.type === "image" ? "full" : "";
    switch (f.type) {
      case "textarea": return `<div class="${cls}">${lab}<textarea name="${f.key}" ${dir}>${esc(v)}</textarea>${f.hint ? `<div class="hint">${f.hint}</div>` : ""}</div>`;
      case "number": return `<div>${lab}<input type="number" name="${f.key}" value="${esc(v)}"></div>`;
      case "date": return `<div>${lab}<input type="date" name="${f.key}" value="${esc(String(v).slice(0, 10))}"></div>`;
      case "datetime": return `<div>${lab}<input type="datetime-local" name="${f.key}" value="${esc(toLocalInput(v))}"></div>`;
      case "bool": return `<div class="check-row" style="padding-top:28px"><input type="checkbox" name="${f.key}" id="f_${f.key}" ${v === true || v === "true" ? "checked" : ""}><label for="f_${f.key}" style="margin:0">${f.label}</label></div>`;
      case "select": return `<div>${lab}<select name="${f.key}">${f.options.map(o => `<option value="${o}" ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
      case "image": return `<div class="${cls}">${lab}<div style="display:flex;gap:12px;align-items:center">${v ? `<img class="thumb" src="${esc(v)}">` : ""}
        <input type="file" accept="image/*" name="${f.key}__file" style="flex:1"></div>
        <input type="text" name="${f.key}" value="${esc(v)}" placeholder="…or paste an image link" style="margin-top:6px" dir="ltr"></div>`;
      case "layout": return `<div class="full">${lab}${layoutEditor(v || DB.DEFAULT_LAYOUT)}</div>`;
      default: return `<div class="${cls}">${lab}<input type="text" name="${f.key}" value="${esc(v)}" ${dir}>${f.hint ? `<div class="hint">${f.hint}</div>` : ""}</div>`;
    }
  }

  async function readForm(form, fields) {
    const out = {};
    for (const f of fields) {
      const el = form.elements[f.key];
      if (f.type === "bool") out[f.key] = el.checked;
      else if (f.type === "number") out[f.key] = el.value === "" ? null : Number(el.value);
      else if (f.type === "datetime") out[f.key] = el.value ? new Date(el.value).toISOString() : null;
      else if (f.type === "date") out[f.key] = el.value || null;
      else if (f.type === "layout") out[f.key] = readLayout(form);
      else if (f.type === "image") {
        const file = form.elements[f.key + "__file"].files[0];
        out[f.key] = file ? (await DB.upload("media", file)).url : el.value.trim();
      } else out[f.key] = el.value.trim();
      if (f.req && (out[f.key] === "" || out[f.key] == null)) throw new Error(f.label + " is required");
    }
    return out;
  }

  /* ---------- seat plan editor ---------- */
  function layoutEditor(L) {
    return `<div class="card" style="padding:16px;background:var(--plum-50)" id="layoutEd">
      <b>Seat categories & prices</b>
      <table class="cat-table" style="margin:8px 0"><thead><tr><th>Code</th><th>Name (Arabic)</th><th>Name (English)</th><th>Price (EGP)</th><th>Colour</th><th></th></tr></thead>
      <tbody id="catRows">${(L.categories || []).map(catRow).join("")}</tbody></table>
      <button type="button" class="btn btn-light btn-sm" id="addCat"><i class="fa-solid fa-plus"></i> Add category</button>
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
      <b>Hall sections</b>
      <div class="hint">Simple: <code>A-E:24:vip</code> (rows A to E, 24 seats each).<br>
        Exact (theatre numbering): <code>A: 15 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 _ :vip</code> — seats in order as seen from the hall (stage on top), <code>|</code> = aisle, <code>_</code> = no seat.<br>
        A line with <code>---</code> adds a walkway between rows.</div>
      <div id="secRows">${(L.sections || []).map(secRow).join("")}</div>
      <button type="button" class="btn btn-light btn-sm" id="addSec"><i class="fa-solid fa-plus"></i> Add section</button>
      <p class="hint" id="seatCount"></p>
    </div>`;
  }
  const catRow = c => `<tr><td><input name="c_id" value="${esc(c.id)}" style="width:80px" dir="ltr"></td><td><input name="c_ar" value="${esc(c.name_ar)}" dir="rtl"></td><td><input name="c_en" value="${esc(c.name_en)}"></td>
    <td><input name="c_price" type="number" value="${esc(c.price)}" style="width:100px"></td><td><input name="c_color" type="color" value="${esc(c.color || "#9b59d0")}" style="width:56px;padding:2px"></td>
    <td><button type="button" class="btn btn-sm btn-light del-row"><i class="fa-solid fa-trash"></i></button></td></tr>`;
  const secRow = s => `<div class="sec card" style="padding:12px;margin:10px 0"><div class="form-grid" style="grid-template-columns:1fr 1fr auto">
    <div><label>Section name (Arabic)</label><input name="s_ar" value="${esc(s.name_ar)}" dir="rtl"></div><div><label>Section name (English)</label><input name="s_en" value="${esc(s.name_en)}"></div>
    <div style="padding-top:28px"><button type="button" class="btn btn-sm btn-light del-sec"><i class="fa-solid fa-trash"></i></button></div>
    <div class="full"><label>Rows</label><textarea name="s_rows" dir="ltr" style="min-height:160px;font-family:monospace;font-size:.85rem;white-space:pre;overflow-x:auto">${esc(s.rows)}</textarea></div></div></div>`;
  function wireLayout(root) {
    const ed = $("#layoutEd", root); if (!ed) return;
    const count = () => {
      const L = readLayout(root); let n = 0;
      L.sections.forEach(s => expandRows(s.rows).forEach(r => n += r.seats));
      $("#seatCount", root).textContent = "Total seats in this plan: " + n;
    };
    ed.addEventListener("click", e => {
      if (e.target.closest("#addCat")) $("#catRows", ed).insertAdjacentHTML("beforeend", catRow({ id: "", name_ar: "", name_en: "", price: 0, color: "#5b8def" }));
      if (e.target.closest("#addSec")) $("#secRows", ed).insertAdjacentHTML("beforeend", secRow({ name_ar: "", name_en: "", rows: "" }));
      if (e.target.closest(".del-row")) e.target.closest("tr").remove();
      if (e.target.closest(".del-sec")) e.target.closest(".sec").remove();
      count();
    });
    ed.addEventListener("input", count); count();
  }
  function readLayout(root) {
    const ed = $("#layoutEd", root);
    const categories = [...ed.querySelectorAll("#catRows tr")].map(tr => ({
      id: $("[name=c_id]", tr).value.trim(), name_ar: $("[name=c_ar]", tr).value.trim(), name_en: $("[name=c_en]", tr).value.trim(),
      price: Number($("[name=c_price]", tr).value || 0), color: $("[name=c_color]", tr).value
    })).filter(c => c.id);
    const sections = [...ed.querySelectorAll(".sec")].map(s => ({
      name_ar: $("[name=s_ar]", s).value.trim(), name_en: $("[name=s_en]", s).value.trim(), rows: $("[name=s_rows]", s).value.trim()
    })).filter(s => s.rows);
    return { categories, sections };
  }

  /* ---------- generic table + editor for simple tables ---------- */
  const DEFS = {
    concerts: {
      title: "Concerts", icon: "fa-ticket", order: ["date", false],
      cols: [["Date", r => dt(r.date)], ["Title", r => esc(r.title_ar) + "<br><small>" + esc(r.title_en) + "</small>"],
             ["Status", r => r.status === "cancelled" ? '<span class="tag red">cancelled</span>' : r.booking_open === false ? '<span class="tag grey">booking closed</span>' : '<span class="tag green">open</span>']],
      fields: [
        { key: "title_ar", label: "Title (Arabic)", req: true }, { key: "title_en", label: "Title (English)" },
        { key: "date", label: "Date & time", type: "datetime", req: true }, { key: "status", label: "Status", type: "select", options: ["upcoming", "cancelled"], def: "upcoming" },
        { key: "venue_ar", label: "Venue (Arabic)" }, { key: "venue_en", label: "Venue (English)" },
        { key: "description_ar", label: "Description (Arabic)", type: "textarea" }, { key: "description_en", label: "Description (English)", type: "textarea" },
        { key: "payment_info_ar", label: "Payment instructions (Arabic)", type: "textarea", hint: "e.g. InstaPay / Vodafone Cash number" }, { key: "payment_info_en", label: "Payment instructions (English)", type: "textarea" },
        { key: "booking_open", label: "Booking open", type: "bool", def: true }, { key: "receipt_required", label: "Payment receipt required", type: "bool", def: true },
        { key: "poster_url", label: "Poster image", type: "image" },
        { key: "layout", label: "Seat plan", type: "layout" }
      ],
      secure: true
    },
    albums: {
      title: "Albums", icon: "fa-images", order: ["date", false],
      cols: [["Date", r => esc(r.date || "")], ["Album", r => esc(r.title_ar) + "<br><small>" + esc(r.title_en) + "</small>"]],
      fields: [{ key: "title_ar", label: "Album name (Arabic)", req: true }, { key: "title_en", label: "Album name (English)" }, { key: "date", label: "Date", type: "date" }]
    },
    videos: {
      title: "Videos", icon: "fa-video", order: ["sort", true],
      cols: [["#", r => esc(r.sort)], ["Video", r => `<img class="thumb" src="https://img.youtube.com/vi/${esc(ytId(r.youtube_url))}/mqdefault.jpg">`], ["Title", r => esc(r.title_ar) + "<br><small>" + esc(r.title_en) + "</small>"]],
      fields: [{ key: "youtube_url", label: "YouTube link", req: true, full: true, hint: "Paste the video link from YouTube (Share → Copy link)" },
               { key: "title_ar", label: "Title (Arabic)", req: true }, { key: "title_en", label: "Title (English)" }, { key: "sort", label: "Order (1 = first)", type: "number", def: 1 }]
    },
    members: {
      title: "Team", icon: "fa-users", order: ["sort", true],
      cols: [["#", r => esc(r.sort)], ["Photo", r => r.photo_url ? `<img class="thumb" src="${esc(r.photo_url)}">` : ""], ["Name", r => esc(r.name_ar) + "<br><small>" + esc(r.name_en) + "</small>"], ["Role", r => esc(r.role_ar) + "<br><small>" + esc(r.role_en) + "</small>"]],
      fields: [{ key: "name_ar", label: "Name (Arabic)", req: true }, { key: "name_en", label: "Name (English)" }, { key: "role_ar", label: "Role (Arabic)" }, { key: "role_en", label: "Role (English)" },
               { key: "sort", label: "Order", type: "number", def: 1 }, { key: "photo_url", label: "Photo", type: "image" }]
    }
  };

  async function editRecord(table, row) {
    const d = DEFS[table];
    if (d.secure && !(await askPassword(row ? "Edit this concert?" : "Add a new concert?"))) return;
    openModal(`<h3>${row ? "Edit" : "Add"} — ${d.title}</h3><form id="ef" class="form-grid">${d.fields.map(f => fieldHtml(f, row ? row[f.key] : undefined)).join("")}
      <div class="full modal-actions"><button type="button" class="btn btn-light" id="efc">Cancel</button><button class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save</button></div></form>`);
    wireLayout(modalBody);
    $("#efc").onclick = closeModal;
    $("#ef").onsubmit = async e => {
      e.preventDefault(); const btn = e.target.querySelector("button.btn-primary"); btn.disabled = true;
      try {
        const data = await readForm(e.target, d.fields);
        if (row) await DB.update(table, row.id, data); else await DB.insert(table, data);
        closeModal(); toast("Saved"); show(current);
      } catch (err) { console.error(err); toast(err.message || "Error", "err"); btn.disabled = false; }
    };
  }

  async function renderTable(table) {
    const d = DEFS[table];
    const rows = await DB.list(table, { order: d.order[0], asc: d.order[1] });
    return `<h2><i class="fa-solid ${d.icon}"></i> ${d.title}<button class="btn btn-primary btn-sm" data-act="add"><i class="fa-solid fa-plus"></i> Add</button></h2>
      <div class="table-wrap"><table><thead><tr>${d.cols.map(c => `<th>${c[0]}</th>`).join("")}<th></th></tr></thead><tbody>
      ${rows.map(r => `<tr>${d.cols.map(c => `<td>${c[1](r)}</td>`).join("")}<td style="white-space:nowrap">
        <button class="btn btn-light btn-sm" data-act="edit" data-id="${r.id}"><i class="fa-solid fa-pen"></i> Edit</button>
        ${table === "concerts" ? `<button class="btn btn-light btn-sm" data-act="toggle-cancel" data-id="${r.id}">${r.status === "cancelled" ? "Restore" : "Cancel concert"}</button>` : ""}
        ${table === "albums" ? `<button class="btn btn-light btn-sm" data-act="photos" data-id="${r.id}"><i class="fa-solid fa-upload"></i> Photos</button>` : ""}
        <button class="btn btn-light btn-sm" data-act="del" data-id="${r.id}" style="color:var(--err)"><i class="fa-solid fa-trash"></i></button></td></tr>`).join("")
        || `<tr><td colspan="9" class="empty">No records yet.</td></tr>`}
      </tbody></table></div>`;
  }
  async function tableClick(table, e) {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const rows = await DB.list(table); const row = rows.find(r => r.id === b.dataset.id);
    if (b.dataset.act === "add") editRecord(table);
    if (b.dataset.act === "edit") editRecord(table, row);
    if (b.dataset.act === "photos") managePhotos(row);
    if (b.dataset.act === "toggle-cancel") {
      const cancel = row.status !== "cancelled";
      if (!(await askPassword(cancel ? `Cancel "${row.title_ar}"? Visitors will see it as cancelled and booking will stop.` : `Restore "${row.title_ar}"?`))) return;
      await DB.update("concerts", row.id, { status: cancel ? "cancelled" : "upcoming" }); toast("Updated"); show(current);
    }
    if (b.dataset.act === "del") {
      if (table === "concerts") { if (!(await askPassword(`Delete "${row.title_ar}" and ALL its bookings permanently?`))) return; }
      else if (!confirm("Delete permanently?")) return;
      if (table === "concerts") for (const bk of await DB.list("bookings", { filter: { concert_id: row.id } })) await DB.remove("bookings", bk.id);
      await DB.remove(table, row.id); toast("Deleted"); show(current);
    }
  }

  /* ---------- photos ---------- */
  async function managePhotos(album) {
    const photos = await DB.list("photos", { filter: { album_id: album.id }, order: "created_at", asc: false });
    openModal(`<h3><i class="fa-solid fa-images"></i> ${esc(album.title_ar)} — photos</h3>
      <label>Upload photos (you can select many at once)</label><input type="file" id="pf" accept="image/*" multiple>
      <p class="hint" id="pp"></p>
      <div class="photo-admin">${photos.map(p => `<div><img src="${esc(p.url)}"><button data-del="${p.id}" title="Delete"><i class="fa-solid fa-trash"></i></button></div>`).join("")}</div>
      <div class="modal-actions"><button class="btn btn-light" id="pc">Close</button></div>`);
    $("#pc").onclick = closeModal;
    $("#pf").onchange = async e => {
      const files = [...e.target.files]; let i = 0;
      for (const f of files) {
        $("#pp").textContent = `Uploading ${++i} of ${files.length}…`;
        try { const small = await shrinkImage(f); const up = await DB.upload("media", small); await DB.insert("photos", { album_id: album.id, url: up.url, caption_ar: "", caption_en: "" }); }
        catch (err) { console.error(err); toast("Upload failed: " + f.name, "err"); break; }
      }
      managePhotos(album);
    };
    modalBody.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { if (confirm("Delete this photo?")) { await DB.remove("photos", b.dataset.del); managePhotos(album); } });
  }
  /* resize big photos to max 1600px so pages load fast */
  function shrinkImage(file, max = 1600) {
    return new Promise(resolve => {
      const img = new Image(); img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        if (k === 1 && file.size < 600 * 1024) return resolve(file);
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => resolve(new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })), "image/jpeg", .85);
      };
      img.onerror = () => resolve(file); img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- bookings ---------- */
  let bkFilter = { concert: "", status: "", q: "" };
  async function renderBookings() {
    const concerts = await DB.list("concerts", { order: "date", asc: false });
    if (!bkFilter.concert && concerts[0]) bkFilter.concert = concerts[0].id;
    let rows = await DB.list("bookings", { order: "created_at", asc: false });
    rows = rows.filter(r => (!bkFilter.concert || r.concert_id === bkFilter.concert) && (!bkFilter.status || r.status === bkFilter.status) &&
      (!bkFilter.q || [r.name, r.phone, r.code].join(" ").toLowerCase().includes(bkFilter.q.toLowerCase())));
    const all = (await DB.list("bookings", { filter: bkFilter.concert ? { concert_id: bkFilter.concert } : undefined }));
    const seats = st => all.filter(r => r.status === st).reduce((a, r) => a + r.seats.length, 0);
    const money_ = st => all.filter(r => r.status === st).reduce((a, r) => a + Number(r.total || 0), 0);
    window._bkRows = rows;
    return `<h2><i class="fa-solid fa-chair"></i> Bookings
        <button class="btn btn-light btn-sm" data-act="csv"><i class="fa-solid fa-file-csv"></i> Export</button>
        <button class="btn btn-primary btn-sm" data-act="add-bk" style="margin-inline-start:0"><i class="fa-solid fa-plus"></i> Add booking</button></h2>
      <div class="stats">
        <div class="stat"><b>${seats("confirmed")}</b><span>Confirmed seats</span></div>
        <div class="stat"><b>${seats("pending")}</b><span>Pending seats</span></div>
        <div class="stat"><b>${egp(money_("confirmed"))}</b><span>Confirmed income</span></div>
        <div class="stat"><b>${egp(money_("pending"))}</b><span>Pending income</span></div>
      </div>
      <div class="toolbar">
        <select id="fc"><option value="">All concerts</option>${concerts.map(c => `<option value="${c.id}" ${c.id === bkFilter.concert ? "selected" : ""}>${esc(c.title_ar)} — ${dt(c.date).slice(0, 11)}</option>`).join("")}</select>
        <select id="fs"><option value="">All statuses</option>${["pending", "confirmed", "cancelled"].map(s => `<option ${s === bkFilter.status ? "selected" : ""}>${s}</option>`).join("")}</select>
        <input id="fq" placeholder="Search name / phone / code" value="${esc(bkFilter.q)}">
      </div>
      <div class="table-wrap"><table><thead><tr><th>Code</th><th>Date</th><th>Name</th><th>Phone</th><th>Seats</th><th>Total</th><th>Receipt</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><b dir="ltr">${esc(r.code)}</b></td><td>${dt(r.created_at)}</td><td>${esc(r.name)}${r.notes ? `<br><small title="${esc(r.notes)}">📝 ${esc(r.notes.slice(0, 40))}</small>` : ""}</td>
        <td><a href="https://wa.me/${waNum(r.phone)}" target="_blank" dir="ltr">${esc(r.phone)}</a></td><td>${esc(r.seats.join(", "))}</td><td>${egp(r.total)}</td>
        <td>${r.receipt_path ? `<button class="btn btn-light btn-sm" data-act="receipt" data-id="${r.id}"><i class="fa-solid fa-receipt"></i> View</button>` : "—"}</td>
        <td><select data-status="${r.id}">${["pending", "confirmed", "cancelled"].map(s => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select></td>
        <td><button class="btn btn-light btn-sm" data-act="del-bk" data-id="${r.id}" style="color:var(--err)"><i class="fa-solid fa-trash"></i></button></td></tr>`).join("")
        || `<tr><td colspan="9" class="empty">No bookings.</td></tr>`}
      </tbody></table></div>`;
  }
  const waNum = p => { const d = String(p || "").replace(/\D/g, ""); return d.startsWith("0") ? "2" + d : d; };
  async function bookingsWire(main) {
    $("#fc", main).onchange = e => { bkFilter.concert = e.target.value; show("bookings"); };
    $("#fs", main).onchange = e => { bkFilter.status = e.target.value; show("bookings"); };
    $("#fq", main).onchange = e => { bkFilter.q = e.target.value; show("bookings"); };
    main.querySelectorAll("[data-status]").forEach(s => s.onchange = async () => { await DB.update("bookings", s.dataset.status, { status: s.value }); toast("Status updated"); show("bookings"); });
    main.onclick = async e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const r = (window._bkRows || []).find(x => x.id === b.dataset.id);
      if (b.dataset.act === "receipt") openFile("receipts", r.receipt_path);
      if (b.dataset.act === "del-bk" && confirm("Delete this booking? Its seats become free again.")) { await DB.remove("bookings", r.id); show("bookings"); }
      if (b.dataset.act === "csv") downloadCsv("bookings", window._bkRows.map(x => ({ code: x.code, date: dt(x.created_at), name: x.name, phone: x.phone, email: x.email, seats: x.seats.join(" "), total: x.total, status: x.status, notes: x.notes })));
      if (b.dataset.act === "add-bk") addBooking();
    };
  }
  async function addBooking() {
    const concerts = (await DB.list("concerts", { order: "date", asc: false })).filter(c => c.status !== "cancelled");
    openModal(`<h3>Add booking (e.g. cash / reserved seats)</h3><form id="abf" class="form-grid">
      <div class="full"><label class="req">Concert</label><select name="concert">${concerts.map(c => `<option value="${c.id}" ${c.id === bkFilter.concert ? "selected" : ""}>${esc(c.title_ar)}</option>`).join("")}</select></div>
      <div class="full"><label class="req">Seats</label><input name="seats" dir="ltr" placeholder="A-1, A-2, AA-5"><div class="hint">Seat = ROW-NUMBER, separated by commas</div></div>
      <div><label class="req">Name</label><input name="name"></div><div><label class="req">Phone</label><input name="phone" dir="ltr"></div>
      <div><label>Status</label><select name="status"><option>confirmed</option><option>pending</option></select></div>
      <div><label>Total (EGP) — leave empty to calculate</label><input name="total" type="number"></div>
      <div class="full"><label>Notes</label><input name="notes"></div>
      <div class="full modal-actions"><button type="button" class="btn btn-light" id="abc">Cancel</button><button class="btn btn-primary">Save</button></div></form>`);
    $("#abc").onclick = closeModal;
    $("#abf").onsubmit = async e => {
      e.preventDefault(); const f = e.target.elements;
      const c = concerts.find(x => x.id === f.concert.value);
      const seats = f.seats.value.toUpperCase().split(/[,\s]+/).filter(Boolean);
      const valid = seatPrices(layoutOf(c));
      const bad = seats.filter(s => !(s in valid));
      if (!seats.length || bad.length) return toast("Unknown seats: " + bad.join(", "), "err");
      if (!f.name.value.trim() || !f.phone.value.trim()) return toast("Name and phone are required", "err");
      const total = f.total.value ? Number(f.total.value) : seats.reduce((a, s) => a + valid[s], 0);
      try {
        const res = await DB.bookSeats({ concert_id: c.id, seats, name: f.name.value.trim(), phone: f.phone.value.trim(), email: "", notes: f.notes.value.trim(), total, receipt_path: "" });
        if (f.status.value === "confirmed") {
          const bk = (await DB.list("bookings", { filter: { concert_id: c.id } })).find(x => x.code === res.code);
          if (bk) await DB.update("bookings", bk.id, { status: "confirmed" });
        }
        closeModal(); toast("Booking added: " + res.code); bkFilter.concert = c.id; show("bookings");
      } catch (err) { toast(err.message === "SEATS_TAKEN" ? "Some of these seats are already booked" : (err.message || "Error"), "err"); }
    };
  }

  /* ---------- auditions ---------- */
  let auFilter = "";
  async function renderAuditions() {
    let rows = await DB.list("auditions", { order: "created_at", asc: false });
    window._auRows = rows;
    if (auFilter) rows = rows.filter(r => r.status === auFilter);
    const n = s => window._auRows.filter(r => r.status === s).length;
    return `<h2><i class="fa-solid fa-microphone-lines"></i> Auditions <button class="btn btn-light btn-sm" data-act="csv"><i class="fa-solid fa-file-csv"></i> Export</button></h2>
      <div class="toolbar">${["", "new", "invited", "accepted", "rejected"].map(s => `<button class="btn btn-sm ${s === auFilter ? "btn-primary" : "btn-light"}" data-filter="${s}">${s || "all"} (${s ? n(s) : window._auRows.length})</button>`).join("")}</div>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Name</th><th>Phone</th><th>Age</th><th>Voice</th><th>Church</th><th>Recording</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${dt(r.created_at)}</td><td>${esc(r.full_name)}<br><small>${esc(r.gender)}</small></td>
        <td><a href="https://wa.me/${waNum(r.phone)}" target="_blank" dir="ltr">${esc(r.phone)}</a></td><td>${esc(r.age)}</td><td>${esc(r.voice_type)}</td><td>${esc(r.church)}</td>
        <td>${r.recording_path ? `<button class="btn btn-light btn-sm" data-act="rec" data-id="${r.id}"><i class="fa-solid fa-play"></i> Play</button>` : "—"}</td>
        <td><select data-status="${r.id}">${["new", "invited", "accepted", "rejected"].map(s => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select></td>
        <td style="white-space:nowrap"><button class="btn btn-light btn-sm" data-act="view" data-id="${r.id}"><i class="fa-solid fa-eye"></i> Details</button>
        <button class="btn btn-light btn-sm" data-act="del" data-id="${r.id}" style="color:var(--err)"><i class="fa-solid fa-trash"></i></button></td></tr>`).join("")
        || `<tr><td colspan="9" class="empty">No applications.</td></tr>`}
      </tbody></table></div>`;
  }
  function auditionsWire(main) {
    main.querySelectorAll("[data-status]").forEach(s => s.onchange = async () => { await DB.update("auditions", s.dataset.status, { status: s.value }); toast("Status updated"); show("auditions"); });
    main.onclick = async e => {
      const f = e.target.closest("[data-filter]"); if (f) { auFilter = f.dataset.filter; return show("auditions"); }
      const b = e.target.closest("[data-act]"); if (!b) return;
      const r = (window._auRows || []).find(x => x.id === b.dataset.id);
      if (b.dataset.act === "rec") openFile("auditions", r.recording_path);
      if (b.dataset.act === "del" && confirm("Delete this application?")) { await DB.remove("auditions", r.id); show("auditions"); }
      if (b.dataset.act === "csv") downloadCsv("auditions", window._auRows.map(x => ({ date: dt(x.created_at), name: x.full_name, phone: x.phone, email: x.email, age: x.age, gender: x.gender, voice: x.voice_type, church: x.church, instrument: x.instrument, experience: x.experience, why: x.why, status: x.status, notes: x.admin_notes })));
      if (b.dataset.act === "view") {
        openModal(`<h3>${esc(r.full_name)}</h3><table>${[["Phone", r.phone], ["Email", r.email], ["Age", r.age], ["Gender", r.gender], ["Voice type", r.voice_type], ["Church", r.church], ["Instrument", r.instrument], ["Experience", r.experience], ["Why join", r.why], ["Applied", dt(r.created_at)]]
          .map(([k, v]) => `<tr><th style="width:140px">${k}</th><td dir="auto">${nl2br(v || "—")}</td></tr>`).join("")}</table>
          <label style="margin-top:14px">Admin notes (audition result, date, etc.)</label><textarea id="an">${esc(r.admin_notes || "")}</textarea>
          <div class="modal-actions"><button class="btn btn-light" id="ac">Close</button><button class="btn btn-primary" id="as">Save notes</button></div>`);
        $("#ac").onclick = closeModal;
        $("#as").onclick = async () => { await DB.update("auditions", r.id, { admin_notes: $("#an").value }); closeModal(); toast("Saved"); show("auditions"); };
      }
    };
  }

  /* ---------- messages ---------- */
  async function renderMessages() {
    const rows = await DB.list("messages", { order: "created_at", asc: false }); window._msgRows = rows;
    return `<h2><i class="fa-solid fa-envelope"></i> Messages</h2>
      ${rows.map(r => `<div class="card" style="margin-bottom:14px;${r.is_read ? "opacity:.7" : "border-inline-start:4px solid var(--gold)"}">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><b>${esc(r.full_name)}</b><small dir="ltr">${esc(r.phone)} ${esc(r.email)}</small><small style="margin-inline-start:auto">${dt(r.created_at)}</small></div>
        <p dir="auto" style="margin:10px 0">${nl2br(r.message)}</p>
        <button class="btn btn-light btn-sm" data-read="${r.id}">${r.is_read ? "Mark unread" : "Mark as read"}</button>
        <button class="btn btn-light btn-sm" data-del="${r.id}" style="color:var(--err)"><i class="fa-solid fa-trash"></i></button></div>`).join("") || `<p class="empty">No messages yet.</p>`}`;
  }
  function messagesWire(main) {
    main.onclick = async e => {
      const r = e.target.closest("[data-read]"), d = e.target.closest("[data-del]");
      if (r) { const m = window._msgRows.find(x => x.id === r.dataset.read); await DB.update("messages", m.id, { is_read: !m.is_read }); show("messages"); }
      if (d && confirm("Delete this message?")) { await DB.remove("messages", d.dataset.del); show("messages"); }
    };
  }

  /* ---------- settings ---------- */
  const SETTINGS_GROUPS = [
    ["About the choir", [
      { key: "about_ar", label: "About text (Arabic)", type: "textarea" }, { key: "about_en", label: "About text (English)", type: "textarea" },
      { key: "mission_ar", label: "Mission (Arabic)", type: "textarea" }, { key: "mission_en", label: "Mission (English)", type: "textarea" },
      { key: "since", label: "Serving since (year)" }, { key: "churches", label: "Number of churches (e.g. +10)" },
      { key: "about_photo", label: "About page photo (group photo)", type: "image" }]],
    ["Contact", [
      { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "whatsapp", label: "WhatsApp number" },
      { key: "address_ar", label: "Address (Arabic)" }, { key: "address_en", label: "Address (English)" },
      { key: "rehearsals_ar", label: "Rehearsal times (Arabic)", type: "textarea" }, { key: "rehearsals_en", label: "Rehearsal times (English)", type: "textarea" },
      { key: "map_url", label: "Google Maps embed link", full: true, hint: "Google Maps → Share → Embed a map → copy the HTML and paste it here" }]],
    ["Social media & music", [
      { key: "facebook", label: "Facebook" }, { key: "instagram", label: "Instagram" }, { key: "youtube", label: "YouTube channel link" },
      { key: "youtube_channel_id", label: "YouTube channel ID (starts with UC)" }, { key: "spotify", label: "Spotify" }, { key: "anghami", label: "Anghami" }, { key: "soundcloud", label: "SoundCloud" }]],
    ["Auditions", [
      { key: "auditions_open", label: "Applications are open", type: "bool" },
      { key: "audition_rules_ar", label: "Requirements (Arabic)", type: "textarea" }, { key: "audition_rules_en", label: "Requirements (English)", type: "textarea" }]]
  ];
  async function renderSettings() {
    const s = await DB.getSettings();
    return `<h2><i class="fa-solid fa-gear"></i> Website settings</h2>
      <form id="sf">${SETTINGS_GROUPS.map(([g, fs]) => `<div class="card" style="margin-bottom:20px"><h3 style="color:var(--plum-700)">${g}</h3><div class="form-grid">${fs.map(f => fieldHtml(f, s[f.key])).join("")}</div></div>`).join("")}
      <button class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save settings</button>
      ${DB.live ? "" : `<button type="button" class="btn btn-light" id="reset" style="margin-inline-start:10px">Reset demo data</button>`}</form>`;
  }
  function settingsWire(main) {
    $("#sf", main).onsubmit = async e => {
      e.preventDefault();
      try { await DB.saveSettings(await readForm(e.target, SETTINGS_GROUPS.flatMap(g => g[1]))); toast("Settings saved"); show("settings"); }
      catch (err) { console.error(err); toast(err.message || "Error", "err"); }
    };
    const r = $("#reset", main); if (r) r.onclick = () => { if (confirm("Delete all demo data and start fresh?")) { DB.resetDemo(); location.reload(); } };
  }

  /* ---------- dashboard ---------- */
  async function renderDashboard() {
    const [concerts, bookings, auditions, messages] = await Promise.all(["concerts", "bookings", "auditions", "messages"].map(t => DB.list(t)));
    const up = concerts.filter(c => c.status !== "cancelled" && new Date(c.date) > new Date());
    return `<h2><i class="fa-solid fa-gauge"></i> Dashboard</h2>
      <div class="stats">
        <div class="stat"><b>${up.length}</b><span>Upcoming concerts</span></div>
        <div class="stat"><b>${bookings.filter(b => b.status === "pending").length}</b><span>Bookings waiting for review</span></div>
        <div class="stat"><b>${bookings.filter(b => b.status === "confirmed").reduce((a, b) => a + b.seats.length, 0)}</b><span>Confirmed seats (all concerts)</span></div>
        <div class="stat"><b>${auditions.filter(a => a.status === "new").length}</b><span>New audition applications</span></div>
        <div class="stat"><b>${messages.filter(m => !m.is_read).length}</b><span>Unread messages</span></div>
      </div>
      <div class="card"><h3 style="color:var(--plum-700)">Quick guide</h3>
      <ul><li><b>Concerts:</b> add a concert, set its seat plan & prices, open/close booking, cancel or restore.</li>
      <li><b>Bookings:</b> check each receipt, then change status to <i>confirmed</i>. Cancelling frees the seats.</li>
      <li><b>Gallery:</b> create an album, then click <i>Photos</i> to upload many pictures at once.</li>
      <li><b>Videos:</b> paste YouTube links. <b>Settings:</b> about text, contacts, social links, auditions open/closed.</li></ul>
      ${DB.live ? "" : `<p class="notice warn">Demo mode — everything is saved in this browser only. Add your Supabase keys in <code>assets/js/config.js</code> to go live.</p>`}</div>`;
  }

  /* ---------- shell ---------- */
  const TABS = [["dashboard", "fa-gauge", "Dashboard"], ["concerts", "fa-ticket", "Concerts"], ["bookings", "fa-chair", "Bookings"], ["auditions", "fa-microphone-lines", "Auditions"],
    ["messages", "fa-envelope", "Messages"], ["albums", "fa-images", "Gallery"], ["videos", "fa-video", "Videos"], ["members", "fa-users", "Team"], ["settings", "fa-gear", "Settings"]];

  async function show(tab) {
    current = tab;
    document.querySelectorAll(".admin-side [data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    const main = $(".admin-main"); main.onclick = null; main.innerHTML = `<p class="empty">Loading…</p>`;
    try {
      if (DEFS[tab]) { main.innerHTML = await renderTable(tab); main.onclick = e => tableClick(tab, e); }
      else if (tab === "bookings") { main.innerHTML = await renderBookings(); bookingsWire(main); }
      else if (tab === "auditions") { main.innerHTML = await renderAuditions(); auditionsWire(main); }
      else if (tab === "messages") { main.innerHTML = await renderMessages(); messagesWire(main); }
      else if (tab === "settings") { main.innerHTML = await renderSettings(); settingsWire(main); }
      else main.innerHTML = await renderDashboard();
    } catch (err) { console.error(err); main.innerHTML = `<div class="notice warn">Could not load data: ${esc(err.message || err)}</div>`; }
  }

  function loginScreen() {
    app.innerHTML = `<div class="card login-box"><img src="assets/img/logo.png" alt=""><h2 style="color:var(--plum-700)">Admin login</h2>
      <form id="lf">${DB.live ? `<input name="email" type="email" placeholder="Admin email" required style="margin-bottom:10px">` : ""}
      <input name="pw" type="password" placeholder="Password" required autocomplete="current-password">
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:14px">Log in</button></form>
      ${DB.live ? "" : `<p class="hint" style="margin-top:12px">Demo mode — password is set in config.js</p>`}
      <p style="margin-top:14px"><a href="index.html">← Back to website</a></p></div>`;
    $("#lf").onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      if (await DB.login(f.email ? f.email.value : "", f.pw.value)) shell(); else toast("Wrong login details", "err");
    };
  }

  function shell() {
    app.innerHTML = `<div class="admin-wrap"><aside class="admin-side">
      ${TABS.map(([k, i, l]) => `<button data-tab="${k}"><i class="fa-solid ${i}"></i>${l}</button>`).join("")}
      <button id="logout"><i class="fa-solid fa-right-from-bracket"></i>Log out</button>
      <button onclick="location.href='index.html'"><i class="fa-solid fa-globe"></i>View website</button></aside>
      <section class="admin-main"></section></div>`;
    document.querySelectorAll(".admin-side [data-tab]").forEach(b => b.onclick = () => show(b.dataset.tab));
    $("#logout").onclick = async () => { await DB.logout(); loginScreen(); };
    show("dashboard");
  }

  startPage(async () => { (await DB.isAdmin()) ? shell() : loginScreen(); });
})();
