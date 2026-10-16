// Học bổng: the whole catalog with filters, personal verdicts and the priority score.
import { store, allItems, isTracked, toggleTrack, setUI, STATUS } from "../store.js";
import { scoreAll, REGION_LABEL, FUND_LABEL, SPRING_LABEL, VER_LABEL } from "../scoring.js";
import { esc, normalize, fmtDate, now } from "../util.js";
import { ctx, verdict, statusPill, countdown, scoreBadge, starButton, emptyState } from "../components.js";
import { meter } from "../charts.js";

export const title = "Học bổng";

const DEFAULTS = { q: "", spring: "", region: "", type: "", eng: "", cost: "", track: "", deadline: "", sort: "priority" };

export function render(el, app) {
  const f = { ...DEFAULTS, ...(store.ui.list || {}) };
  const items = allItems();
  const types = [...new Set(items.map((x) => x.type))].sort((a, b) => a.localeCompare(b, "vi"));
  const sel = (id, label, options, value) => `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-f="${id.slice(2)}">${options.map(([v, t]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`;

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Học bổng</h1><p class="muted">${items.length} lựa chọn thạc sĩ CS, khoa học dữ liệu và AI. Bấm ngôi sao để theo dõi và có checklist riêng.</p></div>
      <div class="page-actions"><button class="btn" data-act="add-custom">Thêm học bổng</button><a class="btn" href="#/so-sanh">So sánh</a></div>
    </div>
    <form class="filters" id="filters" autocomplete="off" role="search">
      <div class="field field-grow"><label for="f-q">Tìm</label><input id="f-q" data-f="q" type="search" value="${esc(f.q)}" placeholder="Tên, nước, điều kiện…"></div>
      ${sel("f-spring", "Kỳ nhập học", [["", "Tất cả"], ["xuan", "Kịp xuân 2027"], ["thu", "Thu 2027"], ["sau", "2028 trở đi"]], f.spring)}
      ${sel("f-region", "Khu vực", [["", "Tất cả"], ...Object.entries(REGION_LABEL)], f.region)}
      ${sel("f-type", "Loại", [["", "Tất cả"], ...types.map((t) => [t, t])], f.type)}
      ${sel("f-eng", "Tiếng Anh", [["", "Tất cả"], ["ok", "Đạt hoặc được miễn"], ["fail", "Chưa đạt"], ["unknown", "Chưa rõ"]], f.eng)}
      ${sel("f-cost", "Tài chính", [["", "Tất cả"], ["ok", "Đủ"], ["tight", "Sát ngân sách"], ["short", "Thiếu"], ["unknown", "Chưa rõ"]], f.cost)}
      ${sel("f-track", "Theo dõi", [["", "Tất cả"], ["yes", "Đang theo dõi"], ["no", "Chưa theo dõi"], ...Object.entries(STATUS).map(([k, s]) => [`st-${k}`, `Trạng thái: ${s.label}`])], f.track)}
      ${sel("f-deadline", "Hạn nộp", [["", "Tất cả"], ["open", "Còn mở"], ["30", "Trong 30 ngày"], ["none", "Chưa có ngày"], ["past", "Đã qua"]], f.deadline)}
      ${sel("f-sort", "Sắp xếp", [["priority", "Điểm ưu tiên"], ["deadline", "Hạn gần nhất"], ["ready", "Mức sẵn sàng"], ["value", "Giá trị học bổng"], ["name", "Tên A–Z"]], f.sort)}
      <button type="button" class="btn btn-ghost" data-act="reset">Bỏ lọc</button>
    </form>
    <p class="count-line" id="count-line" aria-live="polite"></p>
    <div class="catalog" id="catalog"></div>
    ${compareBar()}
    <details class="excluded">
      <summary>Đã rà nhưng loại (${store.excluded.length})</summary>
      <p class="muted small">Loại vì đòi GRE, chỉ dành cho tiến sĩ, đã hết hạn cho kỳ 2027, dạy bằng tiếng khác hoặc ngoài ngành.</p>
      <ul class="ex-list">${store.excluded.map((x) => `<li><b>${esc(x.name)}</b><span>${esc(x.reason)}</span></li>`).join("")}</ul>
    </details>
  `;

  const drawList = () => {
    const c = ctx();
    const scores = scoreAll(items, { ...c, ref: now() });
    const cur = { ...DEFAULTS, ...(store.ui.list || {}) };
    let rows = items.map((it) => scores.get(it.id)).filter((s) => matches(s, cur));
    rows = sortRows(rows, cur.sort);
    const tracked = items.filter((it) => isTracked(it.id)).length;
    el.querySelector("#count-line").textContent = `Đang hiện ${rows.length} trên ${items.length} mục, đang theo dõi ${tracked}`;
    el.querySelector("#catalog").innerHTML = rows.length
      ? rows.map(rowHtml).join("")
      : emptyState("Không có mục nào khớp bộ lọc", "Bỏ bớt điều kiện lọc để xem lại toàn bộ.", '<button class="btn" data-act="reset">Bỏ lọc</button>');
  };
  drawList();

  const onInput = (e) => {
    const t = e.target.closest("[data-f]");
    if (!t) return;
    const next = { ...DEFAULTS, ...(store.ui.list || {}), [t.dataset.f]: t.value };
    setUI("list", next);
    drawList();
  };
  const onClick = (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || !el.contains(b)) return;
    const act = b.dataset.act;
    if (act === "track") { toggleTrack(b.dataset.id); }
    else if (act === "reset") { setUI("list", { ...DEFAULTS }); app.rerender(); }
    else if (act === "compare") { toggleCompare(b.dataset.id); app.rerender(); }
    else if (act === "clear-compare") { setUI("compare", []); app.rerender(); }
    else if (act === "add-custom") { app.openCustom(); }
  };
  const form = el.querySelector("#filters");
  form.addEventListener("input", onInput);
  form.addEventListener("change", onInput);
  form.addEventListener("submit", (e) => e.preventDefault());
  el.addEventListener("click", onClick);
  return { cleanup: () => el.removeEventListener("click", onClick) };
}

function matches(s, f) {
  const it = s.item;
  const p = s.progress;
  if (f.spring === "xuan" && !(it.spring === "xuan" || it.spring === "ca")) return false;
  if (f.spring === "thu" && !(it.spring === "thu" || it.spring === "ca")) return false;
  if (f.spring === "sau" && it.spring !== "sau") return false;
  if (f.region && it.region !== f.region) return false;
  if (f.type && it.type !== f.type) return false;
  const es = s.factors.english.state;
  if (f.eng === "ok" && !(es === "pass" || es === "exempt" || es === "optional")) return false;
  if (f.eng === "fail" && es !== "fail") return false;
  if (f.eng === "unknown" && es !== "unknown") return false;
  if (f.cost && s.factors.cost.state !== f.cost) return false;
  const tracked = !!(p && p.tracked);
  if (f.track === "yes" && !tracked) return false;
  if (f.track === "no" && tracked) return false;
  if (f.track.startsWith("st-") && !(tracked && p.status === f.track.slice(3))) return false;
  const n = s.next;
  if (f.deadline === "open" && !(n && !n.past)) return false;
  if (f.deadline === "30" && !(n && !n.past && n.days <= 30)) return false;
  if (f.deadline === "none" && n) return false;
  if (f.deadline === "past" && !(n && n.past)) return false;
  if (f.q) {
    const hay = normalize([it.name, it.country, it.type, it.level, it.amount, it.cond, it.note, it.dtext, it.english && it.english.text, it.docsText].join(" "));
    for (const term of normalize(f.q).split(/\s+/).filter(Boolean)) if (!hay.includes(term)) return false;
  }
  return true;
}

function sortRows(rows, sort) {
  const dk = (s) => (s.next && !s.next.past ? s.next.days : s.next ? 1e7 : 5e6);
  const by = {
    priority: (a, b) => (a.closed - b.closed) || (b.priority - a.priority) || (dk(a) - dk(b)),
    deadline: (a, b) => (dk(a) - dk(b)) || (b.priority - a.priority),
    ready: (a, b) => ((b.ready ? b.ready.pct : -1) - (a.ready ? a.ready.pct : -1)) || (dk(a) - dk(b)),
    value: (a, b) => (b.factors.value.score - a.factors.value.score) || (b.priority - a.priority),
    name: (a, b) => a.item.name.localeCompare(b.item.name, "vi"),
  }[sort] || ((a, b) => b.priority - a.priority);
  return rows.slice().sort(by);
}

function rowHtml(s) {
  const it = s.item;
  const p = s.progress;
  const tracked = !!(p && p.tracked);
  const inCompare = (store.ui.compare || []).includes(it.id);
  const spring = it.spring === "xuan" || it.spring === "ca" ? `<span class="chip chip-spring">Kịp xuân 2027</span>` : it.spring === "sau" ? `<span class="chip">2028 trở đi</span>` : "";
  const fund = `<span class="chip chip-fund fund-${esc(it.fund)}">${esc(FUND_LABEL[it.fund] || it.fund)}</span>`;
  const meta = [it.country, it.type.toLowerCase(), it.level !== "Thạc sĩ" ? it.level.toLowerCase() : null].filter(Boolean).join(", ");
  return `<article class="crow${s.closed ? " is-closed" : ""}" id="row-${esc(it.id)}">
    ${starButton(it.id, tracked, it.name)}
    <div class="crow-main">
      <h3 class="crow-name"><a href="#/s/${esc(it.id)}">${esc(it.name)}</a>${it.custom ? ' <span class="chip">Tự thêm</span>' : ""}</h3>
      <p class="crow-meta">${esc(meta)}${it.ver === "dk" ? ' <span class="chip chip-est">Dự kiến</span>' : ""}</p>
      <div class="crow-chips">
        ${verdict("Tiếng Anh", s.factors.english, "english", { focus: false })}
        ${verdict("Tài chính", s.factors.cost, "cost", { focus: false })}
        ${fund}${spring}
      </div>
    </div>
    <div class="crow-side">
      <div class="crow-when">${s.next ? `<span class="date">${fmtDate(s.next.date)}</span>${countdown(s.next.days)}` : '<span class="muted small">Chưa có ngày</span>'}</div>
      <div class="crow-progress">${tracked ? `${statusPill(p.status)}${s.ready ? `<span class="crow-ready">${meter(s.ready.pct, { small: true })}<span class="small">${s.ready.pct}%</span></span>` : ""}` : ""}</div>
      <div class="crow-score">${scoreBadge(s.priority, { focus: false, tip: `Điểm ưu tiên ${s.priority}/100${s.gates.length ? "\n" + s.gates.map((g) => g.text).join("\n") : ""}` })}
        <button type="button" class="btn btn-sm btn-ghost${inCompare ? " is-on" : ""}" data-act="compare" data-id="${esc(it.id)}" aria-pressed="${inCompare}">${inCompare ? "Đang so sánh" : "So sánh"}</button></div>
    </div>
  </article>`;
}

export function toggleCompare(id) {
  const cur = (store.ui.compare || []).slice();
  const i = cur.indexOf(id);
  if (i >= 0) cur.splice(i, 1);
  else { if (cur.length >= 4) cur.shift(); cur.push(id); }
  setUI("compare", cur);
}

function compareBar() {
  const ids = store.ui.compare || [];
  if (!ids.length) return "";
  return `<div class="compare-bar" role="region" aria-label="So sánh"><span>Đã chọn ${ids.length}/4 để so sánh</span><a class="btn btn-primary btn-sm" href="#/so-sanh">Mở so sánh</a><button class="btn btn-sm btn-ghost" data-act="clear-compare">Bỏ chọn</button></div>`;
}
