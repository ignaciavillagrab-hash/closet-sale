const CFG = window.SITE_CONFIG;

const GRUPO_ORDER = ["CLOSET", "CASA", "LIBROS"];
const GRUPO_LABEL = { CLOSET: "👗 CLOSET", CASA: "🏠 CASA", LIBROS: "📚 LIBROS" };

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

function normalizeSiNo(v) {
  return (v || "").trim().toLowerCase().startsWith("si");
}

async function loadStatusMap(timeoutMs = 8000) {
  const map = {};
  if (!CFG.SHEET_CSV_URL) return map;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      CFG.SHEET_CSV_URL + (CFG.SHEET_CSV_URL.includes("?") ? "&" : "?") + "cb=" + Date.now(),
      { signal: controller.signal }
    );
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    rows.forEach(r => {
      const item = (r.Item || r.item || "").trim();
      if (item) {
        map[item] = {
          estado: normalizeEstado(r.Estado || r.estado),
          entregaEspecial: normalizeSiNo(r.EntregaEspecial || r.entregaEspecial)
        };
      }
    });
  } catch (e) {
    console.warn("No se pudo cargar el estado en vivo desde el Sheet:", e);
  } finally {
    clearTimeout(timer);
  }
  return map;
}

function waLink(item, desc, precio) {
  const msg = `Hola! Quiero comprar el item ${item.replace(/^I/, "")} (${desc}) - ${formatCLP(precio)}`;
  return `https://wa.me/${CFG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function cardHTML(it, info) {
  const v = CFG.IMG_VERSION || 1;
  const photos = it.fotos.map(f => `images/${f}?v=${v}`);
  const estado = info.estado || "disponible";
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
  const entregaBadge = info.entregaEspecial
    ? `<div class="badge badge-entrega">📦 Entrega: Lun 31 Ago – Sáb 5 Sept</div>` : "";

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
      ${entregaBadge}
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

function priceRange(items) {
  const precios = items.map(i => i.precio).filter(p => p != null);
  if (!precios.length) return "";
  const min = Math.min(...precios), max = Math.max(...precios);
  return min === max ? formatCLP(min) : `${formatCLP(min)}-${formatCLP(max)}`;
}

async function main() {
  const statusEl = document.getElementById("status");
  const gridEl = document.getElementById("grid");
  const chipsGrupoEl = document.getElementById("chips-grupo");
  const chipsEl = document.getElementById("chips");
  const searchEl = document.getElementById("search");

  statusEl.textContent = "Cargando catálogo...";

  let catalog;
  try {
    const res = await fetch("data/catalog.json");
    catalog = await res.json();
  } catch (e) {
    statusEl.textContent = "⚠️ No se pudo cargar el catálogo. Revisa tu conexión y recarga la página.";
    console.error(e);
    return;
  }

  let statusMap = {};

  const gruposPresentes = GRUPO_ORDER.filter(g => catalog.some(i => i.grupo === g));

  chipsGrupoEl.innerHTML = `<div class="chip chip-grupo active" data-grupo="__all__">Todo (${priceRange(catalog)})</div>` +
    gruposPresentes.map(g => {
      const items = catalog.filter(i => i.grupo === g);
      return `<div class="chip chip-grupo" data-grupo="${g}">${GRUPO_LABEL[g] || g} (${priceRange(items)})</div>`;
    }).join("");

  let activeGrupo = "__all__";
  let activeCat = "__all__";
  let query = "";

  function renderCategoriaChips() {
    const base = activeGrupo === "__all__" ? catalog : catalog.filter(i => i.grupo === activeGrupo);
    const categorias = [...new Set(base.map(i => i.categoria))];
    const chipLabel = (cat) => {
      const items = catalog.filter(i => i.categoria === cat);
      const rango = priceRange(items);
      return `${cat}${rango ? ` <span class="range">(${rango})</span>` : ""}`;
    };
    chipsEl.innerHTML = `<div class="chip active" data-cat="__all__">Todas</div>` +
      categorias.map(c => `<div class="chip" data-cat="${c}">${chipLabel(c)}</div>`).join("");
    activeCat = "__all__";
  }

  function render() {
    const filtered = catalog.filter(it => {
      if (activeGrupo !== "__all__" && it.grupo !== activeGrupo) return false;
      if (activeCat !== "__all__" && it.categoria !== activeCat) return false;
      const searchable = (it.item + " " + it.descripcion + " " + it.marca + " " + it.categoria).toLowerCase();
      if (query && !searchable.includes(query)) return false;
      return true;
    });

    if (!filtered.length) {
      gridEl.innerHTML = `<div class="empty">No se encontraron items.</div>`;
      return;
    }

    const byGrupo = {};
    filtered.forEach(it => {
      byGrupo[it.grupo] = byGrupo[it.grupo] || {};
      byGrupo[it.grupo][it.categoria] = byGrupo[it.grupo][it.categoria] || [];
      byGrupo[it.grupo][it.categoria].push(it);
    });

    let html = "";
    GRUPO_ORDER.filter(g => byGrupo[g]).forEach(grupo => {
      const grupoItems = Object.values(byGrupo[grupo]).flat();
      html += `<div class="grupo-title">${GRUPO_LABEL[grupo] || grupo} <span class="range">(${priceRange(grupoItems)})</span></div>`;
      Object.keys(byGrupo[grupo]).forEach(cat => {
        const items = byGrupo[grupo][cat];
        html += `<div class="category-title">${cat} <span style="font-weight:400; font-size:0.85rem; color:var(--muted);">(${priceRange(items)})</span></div>`;
        const list = items.slice().sort((a, b) => {
          const infoA = statusMap[a.item] || {};
          const infoB = statusMap[b.item] || {};
          const rank = s => s.estado === "vendido" ? 2 : s.estado === "reservado" ? 1 : 0;
          return rank(infoA) - rank(infoB);
        });
        html += list.map(it => cardHTML(it, statusMap[it.item] || {})).join("");
      });
    });
    gridEl.innerHTML = html;
    gridEl.querySelectorAll(".card").forEach(attachCarousel);
  }

  chipsGrupoEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip-grupo");
    if (!chip) return;
    chipsGrupoEl.querySelectorAll(".chip-grupo").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeGrupo = chip.dataset.grupo;
    renderCategoriaChips();
    render();
  });

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

  renderCategoriaChips();
  statusEl.textContent = `${catalog.length} items en total.`;
  render();

  if (CFG.SHEET_CSV_URL) {
    loadStatusMap().then((map) => {
      statusMap = map;
      if (Object.keys(map).length === 0) {
        statusEl.textContent = "⚠️ No se pudo leer el estado en vivo del Sheet — mostrando catálogo base.";
      } else {
        statusEl.textContent = `Catálogo actualizado. ${catalog.length} items en total.`;
      }
      render();
    });
  } else {
    statusEl.textContent = "⚠️ Aún no está conectado el Google Sheet — todos los items se muestran como disponibles.";
  }
}

main();
