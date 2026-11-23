/* =========================================================
   Data layer — works with Supabase (live) or Demo mode
   (browser storage) using the same functions.
   ========================================================= */
(function () {
  const CFG = window.SITE_CONFIG;
  const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const sb = LIVE ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const code = () => "FH-" + Math.random().toString(36).slice(2, 8).toUpperCase();

  /* ---------- default settings (also used as fallback in live mode) ---------- */
  const DEFAULT_SETTINGS = {
    about_ar: "كورال فيك الحياة هو خورس مختلط من شباب وشابات من عدة كنائس بالإسكندرية. نقدّم التسبحة والألحان القبطية التراثية والترانيم الجديدة، ونخدم بلا أي هدف تجاري.\nبدأت خدمة الكورال سنة ٢٠١٠ تحت رعاية أبونا يوأنس عزيز، ومن وقتها نشارك في الحفلات والنهضات والمناسبات الكنسية.",
    about_en: "Feek El Hayah is a mixed choir of young men and women from several churches in Alexandria. We sing praise, traditional Coptic hymns and newly composed hymns, and we serve with no commercial aim.\nThe choir began serving in 2010 under the patronage of Father Youannes Aziz, and since then we have taken part in concerts, spiritual revivals and church occasions.",
    mission_ar: "أن نوصّل كلمة الله ومحبته من خلال التسبيح، وأن نكون صوتاً واحداً يمجّد اسمه.",
    mission_en: "To share God's word and love through praise, and to be one voice glorifying His name.",
    since: "2010",
    churches: "+10",
    email: "feek.el7ayah.choir@gmail.com",
    phone: "",
    whatsapp: "",
    address_ar: "الإسكندرية، مصر",
    address_en: "Alexandria, Egypt",
    rehearsals_ar: "",
    rehearsals_en: "",
    map_url: "",
    youtube_channel_id: "UCYPD5WW9gSeJ3LYOe0vrgkw",
    facebook: "https://www.facebook.com/feek.ElHayah",
    instagram: "https://www.instagram.com/feek.el7ayah.choir",
    youtube: "https://www.youtube.com/@feekelhayahchoir",
    anghami: "https://open.anghami.com/IraJlmSHK2b",
    spotify: "https://open.spotify.com/artist/7yVEkvq8GPmiYoZwq8OWFs",
    soundcloud: "https://soundcloud.com/feek-el-hayah-choir",
    auditions_open: true,
    audition_rules_ar: "• السن من ١٦ إلى ٣٥ سنة\n• الالتزام بمواعيد البروفات الأسبوعية\n• تجربة أداء قصيرة لتحديد طبقة الصوت",
    audition_rules_en: "• Age 16 to 35\n• Commitment to weekly rehearsals\n• A short audition to identify your voice type"
  };

  /* Default seat plan: Papal HQ theatre — hall rows A–R + balcony AA–EE (prices are placeholders) */
  const DEFAULT_LAYOUT = {
    categories: [
      { id: "vip", name_ar: "VIP", name_en: "VIP", price: 300, color: "#d4a64a" },
      { id: "c1", name_ar: "الفئة الأولى", name_en: "Category 1", price: 200, color: "#9b59d0" },
      { id: "c2", name_ar: "الفئة الثانية", name_en: "Category 2", price: 150, color: "#5b8def" },
      { id: "bal", name_ar: "البلكون", name_en: "Balcony", price: 100, color: "#3fb68b" }
    ],
    sections: [
      { name_ar: "الصالة", name_en: "Main Hall", rows: "A: _ _ _ _ | 15 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 _ :vip\nB: _ _ _ _ | _ 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 22 :vip\nC: _ _ _ _ | 15 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 22 :vip\nD: _ _ _ _ | _ 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 _ :vip\n---\nE: _ _ _ _ | 15 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 22 :c1\nF: _ _ _ _ | _ 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 22 :c1\nG: _ _ _ _ | 15 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 _ :c1\nH: _ _ _ _ | _ 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 _ :c1\nI: _ _ _ _ | 15 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 22 :c1\nJ: _ _ _ _ | _ 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 22 :c1\nK: _ _ _ _ | 15 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 _ :c1\nL: _ 21 19 17 | _ 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 _ :c2\nM: 23 21 19 17 | 15 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 22 :c2\nN: 23 21 19 17 | _ 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 22 :c2\nO: _ 21 19 17 | 15 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 _ :c2\nP: _ 21 19 17 | _ 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 _ :c2\nQ: 23 21 19 17 | 15 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 22 :c2\nR: 23 21 19 17 | _ _ _ 9 7 5 3 1 2 4 6 8 10 _ _ | 16 18 20 22 :c2" },
      { name_ar: "البلكون", name_en: "Balcony", rows: "AA: 21 19 17 15 13 11 9 7 5 3 1 | 2 4 6 8 10 12 14 16 18 20 22 :bal\nBB: 21 19 17 15 13 11 9 7 5 3 1 | 2 4 6 8 10 12 14 16 18 20 22 :bal\nCC: 21 19 17 15 13 11 9 7 5 3 1 | 2 4 6 8 10 12 14 16 18 20 22 :bal\nDD: 5 3 1 _ _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ _ _ _ :bal\nEE: 5 3 1 _ _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ _ _ _ :bal" }
    ]
  };

  /* ---------------- DEMO MODE (browser storage) ---------------- */
  const KEY = "feh_demo_db";
  const TABLES = ["concerts", "bookings", "albums", "photos", "videos", "members", "auditions", "messages"];
  function seed() {
    const d = new Date(); d.setDate(d.getDate() + 30); d.setHours(19, 0, 0, 0);
    const db = { settings: {}, files: {} };
    TABLES.forEach(t => db[t] = []);
    db.concerts.push({
      id: uid(), created_at: new Date().toISOString(),
      title_ar: "حفلة الكريسماس ٢٠٢٦", title_en: "Christmas Concert 2026",
      description_ar: "أمسية ترانيم الميلاد مع كورال فيك الحياة. (نص تجريبي — عدّله من صفحة الإدارة)",
      description_en: "An evening of Christmas hymns with Feek El Hayah Choir. (Sample text — edit it from the admin page)",
      venue_ar: "مسرح المقر البابوي — الإسكندرية", venue_en: "Papal Headquarters Theatre — Alexandria",
      date: d.toISOString(), poster_url: "", status: "upcoming", booking_open: true,
      payment_info_ar: "حوّل قيمة التذاكر على إنستاباي أو فودافون كاش على الرقم: 01XXXXXXXXX ثم ارفع صورة التحويل.",
      payment_info_en: "Transfer the ticket amount via InstaPay or Vodafone Cash to: 01XXXXXXXXX, then upload the screenshot.",
      layout: DEFAULT_LAYOUT
    });
    db.members.push(
      { id: uid(), name_ar: "أبونا يوأنس عزيز", name_en: "Fr. Youannes Aziz", role_ar: "راعي الكورال", role_en: "Choir patron", photo_url: "", sort: 1 },
      { id: uid(), name_ar: "اسم قائد الكورال", name_en: "Conductor name", role_ar: "قائد الكورال (مايسترو)", role_en: "Conductor", photo_url: "", sort: 2 }
    );
    return db;
  }
  function load() {
    try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
    const db = seed(); save(db); return db;
  }
  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { alert("Browser storage is full (demo mode). Connect Supabase to store more files."); throw e; }
  }
  const fileToDataUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

  function sortRows(rows, order, asc) {
    if (!order) return rows;
    return rows.slice().sort((a, b) => {
      const x = a[order], y = b[order];
      if (x == y) return 0;
      return (x > y ? 1 : -1) * (asc === false ? -1 : 1);
    });
  }

  const Demo = {
    live: false,
    async list(table, o = {}) {
      let rows = load()[table] || [];
      if (o.filter) rows = rows.filter(r => Object.keys(o.filter).every(k => r[k] === o.filter[k]));
      return sortRows(rows, o.order, o.asc);
    },
    async insert(table, row) {
      const db = load(); const r = Object.assign({ id: uid(), created_at: new Date().toISOString() }, row);
      db[table].push(r); save(db); return r;
    },
    async update(table, id, patch) {
      const db = load(); const r = db[table].find(x => x.id === id); Object.assign(r, patch); save(db); return r;
    },
    async remove(table, id) {
      const db = load(); db[table] = db[table].filter(x => x.id !== id);
      if (table === "albums") db.photos = db.photos.filter(p => p.album_id !== id);
      save(db);
    },
    async getSettings() { return Object.assign({}, DEFAULT_SETTINGS, load().settings); },
    async saveSettings(obj) { const db = load(); Object.assign(db.settings, obj); save(db); },
    async upload(bucket, file) {
      const db = load(); const path = uid() + "-" + file.name.replace(/[^\w.\-]/g, "_");
      db.files[bucket + "/" + path] = await fileToDataUrl(file); save(db);
      return { path, url: bucket === "media" ? db.files[bucket + "/" + path] : "" };
    },
    async fileUrl(bucket, path) { return load().files[bucket + "/" + path] || ""; },
    async takenSeats(concertId) {
      return load().bookings.filter(b => b.concert_id === concertId && b.status !== "cancelled").flatMap(b => b.seats);
    },
    async bookSeats(p) {
      const db = load();
      const taken = new Set(db.bookings.filter(b => b.concert_id === p.concert_id && b.status !== "cancelled").flatMap(b => b.seats));
      if (p.seats.some(s => taken.has(s))) throw new Error("SEATS_TAKEN");
      const b = Object.assign({ id: uid(), created_at: new Date().toISOString(), status: "pending", code: code() }, p);
      db.bookings.push(b); save(db); return { code: b.code };
    },
    async checkBooking(c, phone) {
      const db = load();
      const b = db.bookings.find(x => x.code.toUpperCase() === c.trim().toUpperCase() && x.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""));
      if (!b) return null;
      const con = db.concerts.find(x => x.id === b.concert_id) || {};
      return { status: b.status, seats: b.seats, title_ar: con.title_ar, title_en: con.title_en, date: con.date };
    },
    async login(email, pw) { if (pw === CFG.DEMO_ADMIN_PASSWORD) { sessionStorage.setItem("feh_admin", "1"); return true; } return false; },
    async logout() { sessionStorage.removeItem("feh_admin"); },
    async isAdmin() { return sessionStorage.getItem("feh_admin") === "1"; },
    async reauth(pw) { return pw === CFG.DEMO_ADMIN_PASSWORD; },
    resetDemo() { localStorage.removeItem(KEY); }
  };

  /* ---------------- LIVE MODE (Supabase) ---------------- */
  const chk = ({ data, error }) => { if (error) throw error; return data; };
  const Live = {
    live: true,
    async list(table, o = {}) {
      let q = sb.from(table).select("*");
      if (o.filter) Object.keys(o.filter).forEach(k => q = q.eq(k, o.filter[k]));
      if (o.order) q = q.order(o.order, { ascending: o.asc !== false });
      return chk(await q);
    },
    async insert(table, row, opts = {}) {
      if (opts.returning === false) { chk(await sb.from(table).insert(row)); return null; }
      return chk(await sb.from(table).insert(row).select().single());
    },
    async update(table, id, patch) { return chk(await sb.from(table).update(patch).eq("id", id).select().single()); },
    async remove(table, id) { chk(await sb.from(table).delete().eq("id", id)); },
    async getSettings() {
      const rows = chk(await sb.from("settings").select("*")); const s = Object.assign({}, DEFAULT_SETTINGS);
      rows.forEach(r => s[r.key] = r.value); return s;
    },
    async saveSettings(obj) {
      const rows = Object.keys(obj).map(k => ({ key: k, value: obj[k] }));
      chk(await sb.from("settings").upsert(rows));
    },
    async upload(bucket, file) {
      const path = uid() + "-" + file.name.replace(/[^\w.\-]/g, "_");
      chk(await sb.storage.from(bucket).upload(path, file, { contentType: file.type }));
      const url = bucket === "media" ? sb.storage.from(bucket).getPublicUrl(path).data.publicUrl : "";
      return { path, url };
    },
    async fileUrl(bucket, path) {
      const { data } = await sb.storage.from(bucket).createSignedUrl(path, 3600); return data ? data.signedUrl : "";
    },
    async takenSeats(concertId) { return chk(await sb.rpc("get_taken_seats", { p_concert: concertId })) || []; },
    async bookSeats(p) {
      const { data, error } = await sb.rpc("book_seats", {
        p_concert: p.concert_id, p_seats: p.seats, p_name: p.name, p_phone: p.phone, p_email: p.email || "",
        p_notes: p.notes || "", p_total: p.total, p_receipt: p.receipt_path || ""
      });
      if (error) { if ((error.message || "").includes("SEATS_TAKEN")) throw new Error("SEATS_TAKEN"); throw error; }
      return { code: data };
    },
    async checkBooking(c, phone) {
      const rows = chk(await sb.rpc("check_booking", { p_code: c.trim(), p_phone: phone }));
      return rows && rows.length ? rows[0] : null;
    },
    async login(email, pw) {
      const { error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error) return false;
      if (!(await Live.isAdmin())) { await sb.auth.signOut(); return false; }
      return true;
    },
    async logout() { await sb.auth.signOut(); },
    async reauth(pw) {
      const { data } = await sb.auth.getSession(); if (!data.session) return false;
      const { error } = await sb.auth.signInWithPassword({ email: data.session.user.email, password: pw });
      return !error;
    },
    async isAdmin() {
      const { data } = await sb.auth.getSession(); if (!data.session) return false;
      const { data: ok } = await sb.rpc("is_admin"); return !!ok;
    }
  };

  window.DB = LIVE ? Live : Demo;
  window.DB.DEFAULT_LAYOUT = DEFAULT_LAYOUT;
  window.DB.uid = uid;
})();
