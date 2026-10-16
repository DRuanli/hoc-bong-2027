// Small chart builders (HTML/SVG strings) and one shared tooltip.
import { esc, parseISO, isoDate, fmtDate, clamp, now } from "./util.js";

// ------------------------------------------------------------------ tooltip
let tipEl = null;
export function initTooltips(root = document) {
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.className = "tooltip";
    tipEl.setAttribute("role", "tooltip");
    tipEl.hidden = true;
    document.body.appendChild(tipEl);
  }
  const show = (el) => {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    tipEl.textContent = "";
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      const div = document.createElement("div");
      div.textContent = line;
      if (i === 0) div.className = "tip-strong";
      tipEl.appendChild(div);
    });
    tipEl.hidden = false;
    const r = el.getBoundingClientRect();
    const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    let left = r.left + r.width / 2 - tw / 2;
    left = clamp(left, 8, window.innerWidth - tw - 8);
    let top = r.top - th - 8;
    if (top < 8) top = r.bottom + 8;
    tipEl.style.left = `${left + window.scrollX}px`;
    tipEl.style.top = `${top + window.scrollY}px`;
  };
  const hide = () => { if (tipEl) tipEl.hidden = true; };
  root.addEventListener("pointerover", (e) => { const el = e.target.closest("[data-tip]"); if (el) show(el); });
  root.addEventListener("pointerout", (e) => { const el = e.target.closest("[data-tip]"); if (el && !el.contains(e.relatedTarget)) hide(); });
  root.addEventListener("focusin", (e) => { const el = e.target.closest("[data-tip]"); if (el) show(el); });
  root.addEventListener("focusout", hide);
  window.addEventListener("scroll", hide, { passive: true });
}
export function hideTooltip() { if (tipEl) tipEl.hidden = true; }

// ------------------------------------------------------------------ meters and bar lists
export function meter(pct, opts = {}) {
  const v = clamp(Math.round(pct || 0), 0, 100);
  const tone = opts.tone || (v >= 80 ? "ok" : v >= 40 ? "mid" : "low");
  return `<span class="meter meter-${tone}${opts.small ? " meter-sm" : ""}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" aria-label="${esc(opts.label || "Mức sẵn sàng")} ${v}%"><span style="width:${v}%"></span></span>`;
}

/** Horizontal bars as HTML: rows = [{label, value, max, display, tone, tip}] */
export function barList(rows, opts = {}) {
  const max = opts.max || Math.max(1, ...rows.map((r) => r.value || 0));
  return `<div class="barlist${opts.compact ? " barlist-compact" : ""}">${rows.map((r) => {
    const w = clamp(((r.value || 0) / max) * 100, 0, 100);
    return `<div class="barlist-row"${r.tip ? ` data-tip="${esc(r.tip)}" tabindex="0"` : ""}>
      <span class="barlist-label">${esc(r.label)}</span>
      <span class="barlist-track"><span class="barlist-fill tone-${esc(r.tone || "s")}" style="width:${w}%"></span></span>
      <span class="barlist-value">${esc(r.display != null ? r.display : r.value)}</span>
    </div>`;
  }).join("")}</div>`;
}

// ------------------------------------------------------------------ deadline timeline
const MONTHS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
const KIND_LABEL = { open: "Mở nộp", close: "Hạn nộp", interview: "Phỏng vấn", result: "Kết quả", other: "Mốc khác", own: "Bạn đã nộp", task: "Hạn riêng" };

/**
 * rows: [{ id, name, sub, events:[{date, kind, label, est}], ready:null|number, statusLabel }]
 * Positions are percentages of the window [start, start + months].
 */
export function timeline(rows, opts = {}) {
  const start = parseISO(opts.start) || now();
  const months = opts.months || 9;
  const s0 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const end = new Date(s0.getFullYear(), s0.getMonth() + months, s0.getDate());
  const span = end - s0;
  const pos = (iso) => {
    const d = parseISO(iso);
    if (!d) return null;
    return ((d - s0) / span) * 100;
  };
  const ticks = [];
  for (let m = 0; m <= months; m++) {
    const d = new Date(s0.getFullYear(), s0.getMonth() + m, 1);
    if (d < s0) continue;
    const p = pos(isoDate(d));
    if (p != null && p <= 100) ticks.push({ p, label: d.getMonth() === 0 ? `${MONTHS[0]}/${d.getFullYear()}` : MONTHS[d.getMonth()] });
  }
  const head = `<div class="tl-row tl-head" aria-hidden="true"><span class="tl-name"></span><span class="tl-track">${ticks.map((t) => `<span class="tl-tick" style="left:${t.p}%">${esc(t.label)}</span>`).join("")}</span><span class="tl-ready">Sẵn sàng</span></div>`;
  const body = rows.map((r) => {
    const marks = r.events.map((e) => {
      const p = pos(e.date);
      if (p == null || p < 0 || p > 100) return "";
      const tip = `${fmtDate(e.date)}: ${e.label || KIND_LABEL[e.kind] || ""}${e.est ? " (dự kiến)" : ""}\n${r.name}`;
      return `<span class="tl-mark tl-${esc(e.kind)}${e.est ? " tl-est" : ""}" style="left:${p}%" data-tip="${esc(tip)}" tabindex="0" aria-label="${esc(tip.replace("\n", ", "))}"></span>`;
    }).join("");
    const offLeft = r.events.some((e) => { const p = pos(e.date); return p != null && p > 100 && e.kind === "close"; });
    return `<div class="tl-row">
      <a class="tl-name" href="#/s/${esc(r.id)}"><span>${esc(r.name)}</span>${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</a>
      <span class="tl-track"><span class="tl-line"></span>${marks}${offLeft ? `<span class="tl-more" title="Có hạn sau khung thời gian này">›</span>` : ""}</span>
      <span class="tl-ready">${r.ready == null ? "–" : `${r.ready}%`}</span>
    </div>`;
  }).join("");
  const legend = `<div class="legend-row"><span class="lg"><span class="tl-mark tl-close lg-mark"></span>Hạn nộp</span><span class="lg"><span class="tl-mark tl-open lg-mark"></span>Mở nộp</span><span class="lg"><span class="tl-mark tl-interview lg-mark"></span>Phỏng vấn</span><span class="lg"><span class="tl-mark tl-result lg-mark"></span>Kết quả</span><span class="lg"><span class="tl-mark tl-task lg-mark"></span>Hạn riêng của bạn</span><span class="lg"><span class="tl-mark tl-close tl-est lg-mark"></span>Dự kiến</span></div>`;
  return `<div class="timeline">${head}${body}</div>${legend}`;
}

// ------------------------------------------------------------------ readiness × time scatter
/** points: [{id, name, x: days, y: readiness, danger}] */
export function scatter(points, opts = {}) {
  const W = Math.max(280, Math.round(opts.width || 560));
  const H = opts.height || 260;
  const m = { l: 40, r: 14, t: 14, b: 34 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const maxX = opts.maxX || 180;
  const sx = (d) => m.l + (clamp(d, 0, maxX) / maxX) * iw;
  const sy = (v) => m.t + ih - (clamp(v, 0, 100) / 100) * ih;
  const xt = [0, 30, 60, 90, 120, 150, 180].filter((v) => v <= maxX);
  const yt = [0, 25, 50, 75, 100];
  const dz = { x: sx(0), y: sy(50), w: sx(30) - sx(0), h: sy(0) - sy(50) };
  const grid = yt.map((v) => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}"/><text class="axis" x="${m.l - 6}" y="${sy(v) + 4}" text-anchor="end">${v}%</text>`).join("") +
    xt.map((v) => `<text class="axis" x="${sx(v)}" y="${H - m.b + 16}" text-anchor="middle">${v}</text>`).join("");
  const dots = points.map((p) => {
    const cx = sx(p.x), cy = sy(p.y);
    const tip = `${p.name}\nCòn ${p.x} ngày, sẵn sàng ${p.y}%`;
    return `<g class="dot${p.danger ? " dot-danger" : ""}" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip.replace("\n", ", "))}"><circle class="hit" cx="${cx}" cy="${cy}" r="13"/><circle class="mark" cx="${cx}" cy="${cy}" r="5.5"/></g>`;
  }).join("");
  // Direct-label only danger points, and only where a label does not collide with one already placed.
  const placed = [{ x1: dz.x, x2: dz.x + 80, y1: sy(50) + 2, y2: sy(50) + 18 }];
  const overlaps = (r) => placed.some((q) => r.x1 < q.x2 && r.x2 > q.x1 && r.y1 < q.y2 && r.y2 > q.y1);
  const labels = points.filter((p) => p.danger).sort((a, b) => a.x - b.x).map((p) => {
    const cx = sx(p.x), cy = sy(p.y);
    const text = short(p.name, 24);
    const w = text.length * 6.3;
    const anchor = cx + 9 + w > W - m.r ? "end" : "start";
    for (const dy of [-10, 18, -24, 32]) {
      const y = cy + dy;
      const x1 = anchor === "start" ? cx + 9 : cx - 9 - w;
      const r = { x1, x2: x1 + w, y1: y - 11, y2: y + 3 };
      if (y < m.t + 10 || y > H - m.b - 2 || overlaps(r)) continue;
      placed.push(r);
      return `<text class="dlabel" x="${anchor === "start" ? cx + 9 : cx - 9}" y="${y}" text-anchor="${anchor}">${esc(text)}</text>`;
    }
    return "";
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(opts.label || "Biểu đồ mức sẵn sàng theo số ngày còn lại")}">
    <rect class="danger-zone" x="${dz.x}" y="${dz.y}" width="${dz.w}" height="${dz.h}"/>
    <text class="zone-label" x="${dz.x + 6}" y="${sy(50) + 14}">Vùng rủi ro</text>
    ${grid}
    <line class="baseline" x1="${m.l}" x2="${W - m.r}" y1="${sy(0)}" y2="${sy(0)}"/>
    <text class="axis" x="${m.l + iw / 2}" y="${H - 4}" text-anchor="middle">Số ngày tới hạn gần nhất</text>
    ${dots}${labels}
  </svg>`;
}

// ------------------------------------------------------------------ monthly columns (two series stacked)
/** cols: [{label, a, b, tipA, tipB}] a = tracked (accent), b = others (de-emphasis) */
export function columns(cols, opts = {}) {
  const W = Math.max(280, Math.round(opts.width || 560));
  const H = opts.height || 220;
  const m = { l: 30, r: 8, t: 12, b: 28 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = Math.max(1, ...cols.map((c) => c.a + c.b));
  const niceMax = Math.max(4, Math.ceil(max / 4) * 4);
  const band = iw / cols.length;
  const bw = Math.min(24, band * 0.6);
  const sy = (v) => m.t + ih - (v / niceMax) * ih;
  const ticks = [0, niceMax / 2, niceMax];
  const grid = ticks.map((v) => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}"/><text class="axis" x="${m.l - 6}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`).join("");
  const bars = cols.map((c, i) => {
    const x = m.l + band * i + (band - bw) / 2;
    const ya = sy(c.a), yb = sy(c.a + c.b);
    const gap = c.a > 0 && c.b > 0 ? 2 : 0;
    const segA = c.a > 0 ? roundedTop(x, ya, bw, sy(0) - ya, c.b > 0 ? 0 : 4, "col-a") : "";
    const segB = c.b > 0 ? roundedTop(x, yb, bw, Math.max(0, ya - yb - gap), 4, "col-b") : "";
    const tip = `${c.label}\nĐang theo dõi: ${c.a}\nKhác trong danh mục: ${c.b}`;
    const total = c.a + c.b;
    return `<g tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip.replace(/\n/g, ", "))}"><rect class="hit" x="${m.l + band * i}" y="${m.t}" width="${band}" height="${ih}"/>${segA}${segB}${total ? `<text class="vlabel" x="${x + bw / 2}" y="${yb - 5}" text-anchor="middle">${total}</text>` : ""}<text class="axis" x="${x + bw / 2}" y="${H - m.b + 16}" text-anchor="middle">${esc(c.label)}</text></g>`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(opts.label || "Số hạn nộp theo tháng")}">${grid}<line class="baseline" x1="${m.l}" x2="${W - m.r}" y1="${sy(0)}" y2="${sy(0)}"/>${bars}</svg>
  <div class="legend-row"><span class="lg"><span class="swatch col-a"></span>Đang theo dõi</span><span class="lg"><span class="swatch col-b"></span>Khác trong danh mục</span></div>`;
}

function roundedTop(x, y, w, h, r, cls) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  if (!rr) return `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  return `<path class="${cls}" d="M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z"/>`;
}

export function short(s, n) {
  const t = String(s || "");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}
