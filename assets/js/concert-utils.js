/* Shared helpers for concerts and videos */
window.upcomingConcerts = async function (includePast) {
  const all = await DB.list("concerts", { order: "date", asc: true });
  const now = Date.now() - 6 * 3600 * 1000; // keep a concert visible until 6h after start
  return includePast ? all : all.filter(c => new Date(c.date).getTime() >= now);
};

window.startCountdown = function (el, iso) {
  const end = new Date(iso).getTime();
  const tick = () => {
    let d = Math.max(0, end - Date.now()) / 1000;
    const parts = [[Math.floor(d / 86400), "days"], [Math.floor(d % 86400 / 3600), "hours"], [Math.floor(d % 3600 / 60), "minutes"], [Math.floor(d % 60), "seconds"]];
    el.innerHTML = parts.map(([n, k]) => `<div><b>${n.toLocaleString(LANG === "ar" ? "ar-EG" : "en-US")}</b><span>${t(k)}</span></div>`).join("");
  };
  tick(); setInterval(tick, 1000);
};

window.videoCard = function (v) {
  const id = ytId(v.youtube_url || v.youtube_id);
  return `<div class="card video-card"><div class="video-frame"><iframe loading="lazy" src="https://www.youtube.com/embed/${esc(id)}" title="${esc(tf(v, "title"))}" allowfullscreen allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div><div class="vt">${esc(tf(v, "title"))}</div></div>`;
};

window.layoutOf = c => (c && c.layout && c.layout.sections) ? c.layout : DB.DEFAULT_LAYOUT;
window.catMap = layout => Object.fromEntries((layout.categories || []).map(x => [x.id, x]));
