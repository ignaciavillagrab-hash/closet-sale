const CFG = window.SITE_CONFIG;

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.length && r.some(v => v.trim() !== "")).map(r => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (r[idx] || "").trim());
    return obj;
  });
}

function formatCLP(n) {
  return "$" + Number(n).toLocaleString("es-CL");
}

function normalizeEstado(v) {
  v = (v || "").toLowerCase();
  if (v.startsWith("vend")) return "vendido";
  if (v.startsWith("reserv")) return "reservado";
  return "disponible";
}

async function loadStatusMap() {
  const map = {};
  if (!CFG.SHEET_CSV_URL) return map;
  try {
    const res = await fetch(CFG.SHEET_CSV_URL + (CFG.SHEET_CSV_URL.includes("?") ? "&" : "?") + "cb=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    rows.forEach(r => {
      const item = (r.Item || r.item || "").trim();
      if (item) map[item] = normalizeEstado(r.Estado || r.estado);
    });
  } catch (e) {
    console.warn("No se pudo cargar el estado en vivo desde el Sheet:", e);
  }
  return map;
}

function waLink(item, desc, precio) {
  const msg = `Hola! Quiero comprar el item ${item.replace(/^I/, "")} (${desc}) - ${formatCLP(precio)}`;
  return `https://wa.me/${CFG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function cardHTML(it, estado) {
  const photos = it.fotos.map(f => `images/${f}`);
  const isSold = estado === "vendido";
  const isReserved = estado === "reservado";
  const stateClass = isSold ? "sold" : (isReserved ? "reserved" : "");

  const imgs = photos.map((src, i) =>
    `<img src="${src}" class="${i === 0 ? "active" : ""}" data-idx="${i}" loading="lazy" alt="${it.descripcion}">`
  ).join("");

  const nav = photos.length > 1 ? `
    <div class="nav prev">‹</div>
    <div class="nav next">›</div>
    <div class="dots">${photos.map((_, i) => `<span class="${i === 0 ? "active" : ""}"></span>`).join("")}</div>
  ` : "";

  const stamp = isSold ? `<div class="stamp"><span>VENDIDO</span></div>`
    : isReserved ? `<div class="stamp reserved"><span>RESERVADO</span></div>` : "";

  const badge = it.nuevo ? `<div class="badge">NUEVO</div>` : "";

  const metaParts = [];
  if (it.marca) metaParts.push(it.marca);
  if (it.talla) metaParts.push("Talla " + it.talla);

  return `
  <div class="card ${stateClass}" data-item="${it.item}" data-cat="${it.categoria}"
       data-search="${(it.item + " " + it.descripcion + " " + it.marca + " " + it.categoria).toLowerCase()}">
    ${badge}
    <div class="carousel">
      ${imgs}
      ${nav}
      ${stamp}
    </div>
    <div class="info">
      <div class="item-no">Item #${it.item.replace(/^I/, "")}</div>
      <div class="desc">${it.descripcion}</div>
      <div class="meta">${metaParts.join(" · ")}</div>
      <div class="price">${formatCLP(it.precio)}</div>
    </div>
    <a class="buy-btn" href="${waLink(it.item, it.descripcion, it.precio)}" target="_blank">Comprar</a>
  </div>`;
}

function attachCarousel(card) {
  const imgs = [...card.querySelectorAll(".carousel img")];
  const dots = [...card.querySelectorAll(".dots span")];
  if (imgs.length <= 1) return;
  let idx = 0;
  function show(n) {
    idx = (n + imgs.length) % imgs.length;
    imgs.forEach((im, i) => im.classList.toggle("active", i === idx));
    dots.forEach((d, i) => d.classList.toggle("active", i === idx));
  }
  card.querySelector(".nav.prev").addEventListener("click", (e) => { e.preventDefault(); show(idx - 1); });
  card.querySelector(".nav.next").addEventListener("click", (e) => { e.preventDefault(); show(idx + 1); });
}

async function main() {
  const statusEl = document.getElementById("status");
  const gridEl = document.getElementById("grid");
  const chipsEl = document.getElementById("chips");
  const searchEl = document.getElementById("search");

  const [catalog, statusMap] = await Promise.all([
    fetch("data/catalog.json").then(r => r.json()),
    loadStatusMap()
  ]);

  if (!CFG.SHEET_CSV_URL) {
    statusEl.textContent = "⚠️ Aún no está conectado el Google Sheet — todos los items se muestran como disponibles.";
  } else if (Object.keys(statusMap).length === 0) {
    statusEl.textContent = "⚠️ No se pudo leer el estado en vivo del Sheet — mostrando catálogo base.";
  } else {
    statusEl.textContent = `Catálogo actualizado. ${catalog.length} items en total.`;
  }

  const categorias = [...new Set(catalog.map(i => i.categoria))];
  chipsEl.innerHTML = `<div class="chip active" data-cat="__all__">Todo</div>` +
    categorias.map(c => `<div class="chip" data-cat="${c}">${c}</div>`).join("");

  let activeCat = "__all__";
  let query = "";

  function render() {
    const byCat = {};
    catalog.forEach(it => {
      if (activeCat !== "__all__" && it.categoria !== activeCat) return;
      const estado = statusMap[it.item] || "disponible";
      const searchable = (it.item + " " + it.descripcion + " " + it.marca + " " + it.categoria).toLowerCase();
      if (query && !searchable.includes(query)) return;
      byCat[it.categoria] = byCat[it.categoria] || [];
      byCat[it.categoria].push({ it, estado });
    });

    const cats = Object.keys(byCat);
    if (!cats.length) {
      gridEl.innerHTML = `<div class="empty">No se encontraron items.</div>`;
      return;
    }

    let html = "";
    cats.forEach(cat => {
      const precios = byCat[cat].map(({ it }) => it.precio);
      const min = Math.min(...precios), max = Math.max(...precios);
      const rango = min === max ? formatCLP(min) : `${formatCLP(min)} - ${formatCLP(max)}`;
      html += `<div class="category-title">${cat} <span style="font-weight:400; font-size:0.85rem; color:var(--muted);">(${rango})</span></div>`;
      const list = byCat[cat].sort((a, b) => {
        const rank = s => s.estado === "vendido" ? 2 : s.estado === "reservado" ? 1 : 0;
        return rank(a) - rank(b);
      });
      html += list.map(({ it, estado }) => cardHTML(it, estado)).join("");
    });
    gridEl.innerHTML = html;
    gridEl.querySelectorAll(".card").forEach(attachCarousel);
  }

  chipsEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    chipsEl.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeCat = chip.dataset.cat;
    render();
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value.trim().toLowerCase();
    render();
  });

  render();
}

main();
