// So sánh: up to four scholarships side by side on every factor.
import { store, allItems, getItem, setUI } from "../store.js";
import { scoreItem, FACTORS, FUND_LABEL, SPRING_LABEL, REGION_LABEL } from "../scoring.js";
import { esc, fmtDate, normalize, fmtRange, now } from "../util.js";
import { ctx, scoreBadge, verdict, countdown, emptyState, sourceLink } from "../components.js";

export const title = "So sánh";

export function render(el, app) {
  const ids = (store.ui.compare || []).filter((id) => getItem(id));
  const c = ctx();
  const ref = now();
  const ss = ids.map((id) => scoreItem(getItem(id), { ...c, progress: c.user.progress[id] || null, ref }));
  const q = store.ui.compareQ || "";

  const best = (fn) => {
    const vals = ss.map(fn);
    const max = Math.max(...vals);
    if (vals.every((v) => v === max)) return vals.map(() => false);
    return vals.map((v) => ss.length > 1 && v === max);
  };

  const rows = ss.length ? [
    ["Điểm ưu tiên", ss.map((s) => scoreBadge(s.priority, { big: true })), best((s) => s.priority)],
    ...FACTORS.map((f) => [f.label, ss.map((s) => {
      const x = s.factors[f.key];
      return `<div class="cmp-factor"><span class="cmp-bar"><span style="width:${x.score}%"></span></span><b>${x.score}</b><span class="small muted">${esc(x.label)}</span></div>`;
    }), best((s) => s.factors[f.key].score)]),
    ["Hạn tiếp theo", ss.map((s) => (s.next ? `${fmtDate(s.next.date)} ${countdown(s.next.days)}` : '<span class="muted">Chưa có ngày</span>')), null],
    ["Kỳ nhập học", ss.map((s) => `${esc(s.item.intake || "–")}<br><span class="small muted">${esc(SPRING_LABEL[s.item.spring] || "")}</span>`), null],
    ["Học bổng", ss.map((s) => `<span class="chip chip-fund fund-${esc(s.item.fund)}">${esc(FUND_LABEL[s.item.fund])}</span><p class="small">${esc(s.item.amount)}</p>`), null],
    ["Tiếng Anh", ss.map((s) => `${verdict("Tiếng Anh", s.factors.english, "english")}<p class="small">${esc((s.item.english && s.item.english.text) || "")}</p>`), null],
    ["Chi phí tự lo/năm", ss.map((s) => `<b>${esc(fmtRange(s.factors.cost.range))}</b><p class="small muted">${esc((s.item.cost && s.item.cost.note) || "")}</p>`), null],
    ["Cạnh tranh", ss.map((s) => esc(s.item.comp ? s.item.comp.text : "Chưa rõ")), null],
    ["Số việc trong checklist", ss.map((s) => (s.ready ? `${s.ready.done}/${s.ready.total} xong` : `${(s.item.docs && s.item.docs.keys.length) || "–"} việc`)), null],
    ["Khu vực", ss.map((s) => `${esc(s.item.country)}<br><span class="small muted">${esc(REGION_LABEL[s.item.region] || "")}</span>`), null],
    ["Nguồn", ss.map((s) => sourceLink(s.item) || "–"), null],
  ] : [];

  const matchesQ = q ? allItems().filter((it) => !ids.includes(it.id) && normalize(`${it.name} ${it.country}`).includes(normalize(q))).slice(0, 8) : [];

  el.innerHTML = `
    <div class="page-head"><div><h1>So sánh</h1><p class="muted">Chọn tối đa 4 học bổng. Ô đậm là mục cao nhất ở hàng đó.</p></div></div>
    <div class="cmp-pick">
      <div class="field field-grow"><label for="cmp-q">Thêm học bổng vào bảng</label><input id="cmp-q" type="search" value="${esc(q)}" placeholder="Gõ tên hoặc nước…" autocomplete="off"></div>
      ${matchesQ.length ? `<ul class="cmp-results">${matchesQ.map((it) => `<li><button class="btn btn-sm btn-ghost" data-act="add" data-id="${esc(it.id)}">Thêm</button> ${esc(it.name)} <span class="muted small">${esc(it.country)}</span></li>`).join("")}</ul>` : ""}
    </div>
    ${ss.length ? `<div class="table-wrap"><table class="cmp-table">
      <thead><tr><th scope="col"><span class="sr-only">Tiêu chí</span></th>${ss.map((s) => `<th scope="col"><a href="#/s/${esc(s.item.id)}">${esc(s.item.name)}</a><button class="icon-btn" data-act="remove" data-id="${esc(s.item.id)}" aria-label="Bỏ ${esc(s.item.name)} khỏi bảng"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></th>`).join("")}</tr></thead>
      <tbody>${rows.map(([label, cells, bests]) => `<tr><th scope="row">${esc(label)}</th>${cells.map((cell, i) => `<td class="${bests && bests[i] ? "is-best" : ""}">${cell}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>` : emptyState("Chưa chọn học bổng nào", "Gõ tên ở ô trên, hoặc bấm So sánh ở danh sách học bổng.", '<a class="btn" href="#/hoc-bong">Mở danh sách</a>')}
  `;

  const onInput = (e) => {
    if (e.target.id === "cmp-q") { setUI("compareQ", e.target.value); app.rerender(); }
  };
  const onClick = (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || !el.contains(b)) return;
    const cur = (store.ui.compare || []).slice();
    if (b.dataset.act === "add") { if (cur.length >= 4) cur.shift(); cur.push(b.dataset.id); setUI("compare", cur); setUI("compareQ", ""); app.rerender(); }
    if (b.dataset.act === "remove") { setUI("compare", cur.filter((x) => x !== b.dataset.id)); app.rerender(); }
  };
  el.addEventListener("input", onInput);
  el.addEventListener("click", onClick);
  return { cleanup: () => { el.removeEventListener("input", onInput); el.removeEventListener("click", onClick); } };
}
