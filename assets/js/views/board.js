// Tiến độ: kanban of tracked applications; drag a card or use its status menu.
import { trackedItems, setStatus, STATUS } from "../store.js";
import { scoreItem } from "../scoring.js";
import { esc, now, fmtDate } from "../util.js";
import { ctx, countdown, scoreBadge, emptyState } from "../components.js";
import { meter } from "../charts.js";

export const title = "Tiến độ";

const COLUMNS = [
  { key: "consider", statuses: ["consider"], title: "Đang cân nhắc", hint: "Chưa quyết định nộp" },
  { key: "prep", statuses: ["prep"], title: "Đang chuẩn bị", hint: "Đang làm hồ sơ" },
  { key: "submitted", statuses: ["submitted"], title: "Đã nộp", hint: "Chờ phản hồi" },
  { key: "interview", statuses: ["interview"], title: "Phỏng vấn / thi", hint: "Đang ở vòng sau" },
  { key: "result", statuses: ["offer", "waitlist", "rejected"], title: "Kết quả", hint: "Đỗ, chờ, trượt" },
  { key: "dropped", statuses: ["dropped"], title: "Bỏ qua", hint: "Không nộp nữa" },
];

export function render(el, app) {
  const c = ctx();
  const ref = now();
  const items = trackedItems();
  const scored = items.map((it) => scoreItem(it, { ...c, progress: c.user.progress[it.id], ref }));
  if (!scored.length) {
    el.innerHTML = `<div class="page-head"><div><h1>Tiến độ</h1></div></div>${emptyState("Chưa theo dõi học bổng nào", "Bấm ngôi sao ở danh sách học bổng để đưa vào bảng tiến độ.", '<a class="btn btn-primary" href="#/hoc-bong">Chọn học bổng</a>')}`;
    return {};
  }
  const dk = (s) => (s.next && !s.next.past ? s.next.days : 1e6);
  el.innerHTML = `
    <div class="page-head"><div><h1>Tiến độ</h1><p class="muted">Kéo thẻ sang cột khác, hoặc đổi trạng thái ngay trên thẻ.</p></div></div>
    <div class="board" role="list">
      ${COLUMNS.map((col) => {
        const cards = scored.filter((s) => col.statuses.includes(s.progress.status)).sort((a, b) => dk(a) - dk(b));
        const body = col.key === "result"
          ? col.statuses.map((st) => {
              const sub = cards.filter((s) => s.progress.status === st);
              return `<div class="col-sub" data-drop="${st}"><p class="col-sub-title status-text-${st}">${esc(STATUS[st].label)} <span>${sub.length}</span></p>${sub.map(card).join("")}</div>`;
            }).join("")
          : `<div class="col-sub" data-drop="${col.statuses[0]}">${cards.map(card).join("") || '<p class="col-empty">Thả thẻ vào đây</p>'}</div>`;
        return `<section class="col" role="listitem" aria-label="${esc(col.title)}">
          <div class="col-head"><h2>${esc(col.title)}</h2><span class="col-count">${cards.length}</span></div>
          <p class="col-hint">${esc(col.hint)}</p>
          ${body}
        </section>`;
      }).join("")}
    </div>`;

  let dragId = null;
  const onDragStart = (e) => {
    const cardEl = e.target.closest(".kcard");
    if (!cardEl) return;
    dragId = cardEl.dataset.id;
    cardEl.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", dragId); } catch (err) { /* ignore */ }
  };
  const onDragEnd = (e) => {
    const cardEl = e.target.closest(".kcard");
    if (cardEl) cardEl.classList.remove("is-dragging");
    el.querySelectorAll(".is-over").forEach((x) => x.classList.remove("is-over"));
  };
  const onDragOver = (e) => {
    const zone = e.target.closest("[data-drop]");
    if (!zone || !dragId) return;
    e.preventDefault();
    el.querySelectorAll(".is-over").forEach((x) => { if (x !== zone) x.classList.remove("is-over"); });
    zone.classList.add("is-over");
  };
  const onDrop = (e) => {
    const zone = e.target.closest("[data-drop]");
    if (!zone || !dragId) return;
    e.preventDefault();
    const st = zone.dataset.drop;
    const id = dragId;
    dragId = null;
    setStatus(id, st);
    app.toast(`Đã chuyển sang ${STATUS[st].label}`);
  };
  const onChange = (e) => {
    const t = e.target;
    if (t.dataset.field === "card-status") {
      setStatus(t.dataset.id, t.value);
      app.toast(`Đã chuyển sang ${STATUS[t.value].label}`);
    }
  };
  el.addEventListener("dragstart", onDragStart);
  el.addEventListener("dragend", onDragEnd);
  el.addEventListener("dragover", onDragOver);
  el.addEventListener("drop", onDrop);
  el.addEventListener("change", onChange);
  return {
    cleanup: () => {
      el.removeEventListener("dragstart", onDragStart);
      el.removeEventListener("dragend", onDragEnd);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
      el.removeEventListener("change", onChange);
    },
  };
}

function card(s) {
  const it = s.item;
  const p = s.progress;
  const r = s.ready || { pct: 0, done: 0, total: 0 };
  const before = p.status === "consider" || p.status === "prep";
  return `<article class="kcard" draggable="true" data-id="${esc(it.id)}">
    <div class="kcard-top"><a class="kcard-name" href="#/s/${esc(it.id)}">${esc(it.name)}</a>${scoreBadge(s.priority)}</div>
    <p class="kcard-meta">${esc(it.country)}</p>
    ${s.next ? `<p class="kcard-when"><span class="date">${fmtDate(s.next.date)}</span>${countdown(s.next.days)}</p>` : ""}
    ${before ? `<div class="kcard-ready">${meter(r.pct, { small: true })}<span class="small">${r.done}/${r.total}</span></div>` : p.dates && p.dates.submitted ? `<p class="small muted">Nộp ngày ${fmtDate(p.dates.submitted)}</p>` : ""}
    <label class="sr-only" for="ks-${esc(it.id)}">Trạng thái của ${esc(it.name)}</label>
    <select id="ks-${esc(it.id)}" class="input-sm kcard-status" data-field="card-status" data-id="${esc(it.id)}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${p.status === k ? " selected" : ""}>${esc(v.label)}</option>`).join("")}</select>
  </article>`;
}
