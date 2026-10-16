// Lịch: month grid of deadlines and personal dates, agenda list, and .ics export.
import { store, allItems, isTracked, setUI, STATUS } from "../store.js";
import { eventsOf } from "../scoring.js";
import { esc, parseISO, isoDate, todayISO, fmtDate, daysUntil, downloadFile } from "../util.js";
import { countdown, emptyState } from "../components.js";
import { short } from "../charts.js";

export const title = "Lịch";

const KIND = { close: "Hạn nộp", open: "Mở nộp", interview: "Phỏng vấn", result: "Kết quả", other: "Mốc khác", own: "Đã nộp", task: "Hạn riêng" };
const MONTH_NAMES = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function collect(scope) {
  const out = [];
  for (const it of allItems()) {
    const tracked = isTracked(it.id);
    if (scope === "tracked" && !tracked) continue;
    const p = store.user.progress[it.id];
    const evs = tracked ? eventsOf(it, p) : (it.events || []).filter((e) => e.kind === "close" || e.kind === "open");
    for (const e of evs) out.push({ ...e, id: it.id, name: it.name, tracked, status: p && p.status });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function render(el, app) {
  const scope = store.ui.calScope || "tracked";
  const month = store.ui.calMonth || todayISO().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const events = collect(scope);
  const inMonth = events.filter((e) => e.date.slice(0, 7) === month);
  const byDay = new Map();
  for (const e of inMonth) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date).push(e);
  }
  const startOffset = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(isoDate(new Date(y, m - 1, d)));
  while (cells.length % 7) cells.push(null);
  const today = todayISO();
  const upcoming = events.filter((e) => daysUntil(e.date) >= 0).slice(0, 8);

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Lịch</h1><p class="muted">Hạn nộp, ngày mở cổng, phỏng vấn và các hạn riêng bạn tự đặt.</p></div>
      <div class="page-actions"><button class="btn" data-act="ics">Tải lịch (.ics)</button></div>
    </div>
    <div class="cal-toolbar">
      <div class="seg" role="group" aria-label="Phạm vi">
        <button class="seg-btn${scope === "tracked" ? " is-on" : ""}" data-act="scope" data-v="tracked" aria-pressed="${scope === "tracked"}">Đang theo dõi</button>
        <button class="seg-btn${scope === "all" ? " is-on" : ""}" data-act="scope" data-v="all" aria-pressed="${scope === "all"}">Cả danh mục</button>
      </div>
      <div class="cal-nav">
        <button class="icon-btn" data-act="prev" aria-label="Tháng trước"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <h2 class="cal-title">${MONTH_NAMES[m - 1]}, ${y}</h2>
        <button class="icon-btn" data-act="next" aria-label="Tháng sau"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="btn btn-sm btn-ghost" data-act="today">Tháng này</button>
      </div>
    </div>
    <div class="cal-layout">
      <div class="cal-grid-wrap">
        <div class="cal-grid" role="grid" aria-label="${MONTH_NAMES[m - 1]} ${y}">
          ${DOW.map((d) => `<div class="cal-dow" role="columnheader">${d}</div>`).join("")}
          ${cells.map((iso) => {
            if (!iso) return '<div class="cal-cell is-blank" aria-hidden="true"></div>';
            const evs = byDay.get(iso) || [];
            return `<div class="cal-cell${iso === today ? " is-today" : ""}${iso < today ? " is-past" : ""}" role="gridcell" aria-label="${fmtDate(iso)}${evs.length ? `, ${evs.length} mốc` : ""}">
              <span class="cal-day">${Number(iso.slice(8))}</span>
              ${evs.slice(0, 3).map((e) => `<a class="cal-ev ev-${esc(e.kind)}${e.tracked ? "" : " is-other"}${e.est ? " is-est" : ""}" href="#/s/${esc(e.id)}" data-tip="${esc(`${fmtDate(e.date)}: ${e.label}${e.est ? " (dự kiến)" : ""}\n${e.name}`)}">${esc(short(e.name, 22))}</a>`).join("")}
              ${evs.length > 3 ? `<span class="cal-more">+${evs.length - 3}</span>` : ""}
            </div>`;
          }).join("")}
        </div>
        <div class="legend-row"><span class="lg"><span class="swatch ev-close"></span>Hạn nộp</span><span class="lg"><span class="swatch ev-open"></span>Mở nộp</span><span class="lg"><span class="swatch ev-interview"></span>Phỏng vấn, kết quả</span><span class="lg"><span class="swatch ev-task"></span>Hạn riêng, ngày đã nộp</span></div>
      </div>
      <aside class="panel agenda" aria-labelledby="h-agenda">
        <div class="panel-head"><h2 id="h-agenda">Trong tháng</h2><span class="muted small">${inMonth.length} mốc</span></div>
        ${inMonth.length ? `<ol class="agenda-list">${inMonth.map((e) => agendaItem(e)).join("")}</ol>` : `<p class="muted small">Không có mốc nào trong tháng này.</p>`}
        <div class="panel-head"><h2>Sắp tới</h2></div>
        ${upcoming.length ? `<ol class="agenda-list">${upcoming.map((e) => agendaItem(e)).join("")}</ol>` : emptyState("Chưa có mốc sắp tới", scope === "tracked" ? "Theo dõi học bổng để thấy các mốc ở đây." : "")}
      </aside>
    </div>`;

  const onClick = (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || !el.contains(b)) return;
    const act = b.dataset.act;
    if (act === "scope") { setUI("calScope", b.dataset.v); app.rerender(); }
    else if (act === "prev" || act === "next") {
      const d = new Date(y, m - 1 + (act === "next" ? 1 : -1), 1);
      setUI("calMonth", isoDate(d).slice(0, 7));
      app.rerender();
    } else if (act === "today") { setUI("calMonth", todayISO().slice(0, 7)); app.rerender(); }
    else if (act === "ics") {
      const evs = collect("tracked").filter((x) => daysUntil(x.date) >= 0);
      if (!evs.length) { app.toast("Chưa có mốc nào sắp tới để xuất. Hãy theo dõi học bổng trước."); return; }
      downloadFile("hoc-bong-2027.ics", toICS(evs), "text/calendar");
      app.toast(`Đã tạo file lịch với ${evs.length} mốc`);
    }
  };
  el.addEventListener("click", onClick);
  return { cleanup: () => el.removeEventListener("click", onClick) };
}

function agendaItem(e) {
  const d = daysUntil(e.date);
  return `<li class="agenda-item ev-${esc(e.kind)}"><span class="agenda-date">${fmtDate(e.date, { short: true })}</span><div><a href="#/s/${esc(e.id)}">${esc(e.name)}</a><span class="muted small">${esc(e.label)}${e.est ? " (dự kiến)" : ""}</span></div>${d >= 0 ? countdown(d) : ""}</li>`;
}

function icsEscape(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }

export function toICS(evs) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//hoc-bong-2027//VI", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Học bổng 2027"];
  for (const e of evs) {
    const d = e.date.replace(/-/g, "");
    const next = isoDate(new Date(parseISO(e.date).getTime() + 86400000)).replace(/-/g, "");
    lines.push("BEGIN:VEVENT",
      `UID:${e.id}-${e.kind}-${d}@hoc-bong-2027`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${icsEscape(`${KIND[e.kind] || "Mốc"}: ${e.name}`)}`,
      `DESCRIPTION:${icsEscape(e.label + (e.est ? " (dự kiến)" : ""))}`);
    if (e.kind === "close") lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(`Còn 7 ngày: ${e.name}`)}`, "TRIGGER:-P7D", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
