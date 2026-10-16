// Chi tiết một học bổng: checklist, factor breakdown, dates, notes, contacts, history.
import { store, getItem, getProgress, update, ensureProgress, touch, addLog, toggleTrack, toggleCheck, setStatus, deleteCustom, STATUS, PRIORITY } from "../store.js";
import { scoreItem, eventsOf, FACTORS, FUND_LABEL, MATCH_LABEL, VER_LABEL, SPRING_LABEL } from "../scoring.js";
import { esc, fmtDate, daysUntil, now, uid, fmtMoney, fmtEUR, toEUR, nowStamp, debounce } from "../util.js";
import { ctx, verdict, statusPill, countdown, scoreBadge, emptyState, sourceLink, icon, TONE } from "../components.js";
import { meter } from "../charts.js";
import { buildChecklist, isDone, DOC_STATUS } from "../docs.js";
import { toggleCompare } from "./list.js";

export const title = "Chi tiết";

const CONTACT_STATUS = { chua: "Chưa liên hệ", gui: "Đã gửi email", "tra-loi": "Đã trả lời", "dong-y": "Đồng ý nhận", "tu-choi": "Từ chối" };

export function render(el, app, param) {
  const item = getItem(param);
  if (!item) {
    el.innerHTML = emptyState("Không tìm thấy học bổng này", "Có thể mục đã bị xóa hoặc đường dẫn sai.", '<a class="btn" href="#/hoc-bong">Về danh sách</a>');
    return {};
  }
  const c = ctx();
  const p = getProgress(item.id);
  const tracked = !!(p && p.tracked);
  const s = scoreItem(item, { ...c, progress: p, ref: now() });
  const inCompare = (store.ui.compare || []).includes(item.id);
  const meta = [item.country, item.type.toLowerCase(), item.level !== "Thạc sĩ" ? item.level.toLowerCase() : null].filter(Boolean).join(", ");

  el.innerHTML = `
    <a class="back-link" href="#/hoc-bong"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>Danh sách học bổng</a>
    <div class="detail-head">
      <div class="detail-title">
        <h1>${esc(item.name)}</h1>
        <p class="muted">${esc(meta)}${item.intake ? `, nhập học ${esc(item.intake)}` : ""}</p>
        <p class="small">${item.src ? `Nguồn: ${sourceLink(item)}` : "Chưa có nguồn"} <span class="chip chip-ver ver-${esc(item.ver)}">${esc(VER_LABEL[item.ver] || item.ver)}</span>${item.custom ? ' <span class="chip">Tự thêm</span>' : ""}</p>
      </div>
      <div class="detail-score"><span class="muted small">Điểm ưu tiên</span>${scoreBadge(s.priority, { big: true })}</div>
    </div>
    <div class="detail-actions">
      <button type="button" class="btn ${tracked ? "" : "btn-primary"}" data-act="track" aria-pressed="${tracked}">${tracked ? "Đang theo dõi" : "Theo dõi học bổng này"}</button>
      ${tracked ? `<div class="field field-inline"><label for="d-status">Trạng thái</label><select id="d-status" data-field="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${p.status === k ? " selected" : ""}>${esc(v.label)}</option>`).join("")}</select></div>
      <div class="field field-inline"><label for="d-prio">Ưu tiên của bạn</label><select id="d-prio" data-field="priority">${Object.entries(PRIORITY).map(([k, v]) => `<option value="${k}"${p.priority === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></div>` : ""}
      <button type="button" class="btn btn-ghost${inCompare ? " is-on" : ""}" data-act="compare" aria-pressed="${inCompare}">${inCompare ? "Đang so sánh" : "Thêm vào so sánh"}</button>
      ${item.custom ? `<button type="button" class="btn btn-ghost" data-act="edit-custom">Sửa thông tin</button><button type="button" class="btn btn-ghost btn-danger" data-act="del-custom">Xóa mục này</button>` : ""}
    </div>
    ${nextStrip(s)}
    <div class="detail-grid">
      <div class="col-main">
        ${checklistPanel(item, p, tracked, c)}
        ${requirementsPanel(item, s)}
        ${tracked ? notesPanel(p) : ""}
        ${tracked ? contactsPanel(p) : ""}
        ${tracked ? logPanel(item) : ""}
      </div>
      <aside class="col-side">
        ${factorsPanel(s, c)}
        ${eventsPanel(item, p)}
        ${tracked ? datesPanel(p) : ""}
        ${tracked ? feePanel(item, p, c) : ""}
        ${tracked ? overridePanel(item, p) : ""}
      </aside>
    </div>
  `;

  const id = item.id;
  const saveNotes = debounce((v) => update((u) => { const q = ensureProgress(u, id); q.notes = v; touch(q); }, { silent: true }), 500);

  const onClick = (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || !el.contains(b)) return;
    const act = b.dataset.act;
    if (act === "track") toggleTrack(id);
    else if (act === "check") {
      const moved = toggleCheck(id, Number(b.dataset.index));
      if (moved) app.toast("Đã chuyển sang Đã nộp và ghi ngày nộp hôm nay");
    } else if (act === "del-check") {
      const i = Number(b.dataset.index);
      update((u) => { const q = ensureProgress(u, id); const [gone] = q.checklist.splice(i, 1); touch(q); if (gone) addLog(u, id, `Xóa việc: ${gone.label}`); });
    } else if (act === "reset-checklist") {
      if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Bấm lần nữa để tạo lại"; return; }
      update((u) => {
        const q = ensureProgress(u, id);
        const old = new Map(q.checklist.map((x) => [x.key, x]));
        q.checklist = buildChecklist(item).map((x) => (old.has(x.key) ? { ...x, done: old.get(x.key).done, due: old.get(x.key).due } : x));
        touch(q);
        addLog(u, id, "Tạo lại checklist mặc định");
      });
    } else if (act === "compare") { toggleCompare(id); app.rerender(); }
    else if (act === "edit-custom") app.openCustom(item);
    else if (act === "del-custom") {
      if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Bấm lần nữa để xóa"; return; }
      deleteCustom(id);
      location.hash = "#/hoc-bong";
    } else if (act === "del-contact") {
      const i = Number(b.dataset.index);
      update((u) => { const q = ensureProgress(u, id); q.contacts.splice(i, 1); touch(q); });
    }
  };

  const onChange = (e) => {
    const t = e.target;
    const field = t.dataset.field;
    if (!field) return;
    if (field === "status") { setStatus(id, t.value); return; }
    if (field === "priority") { update((u) => { const q = ensureProgress(u, id); q.priority = t.value; touch(q); }); return; }
    if (field === "due") { const i = Number(t.dataset.index); update((u) => { const q = ensureProgress(u, id); if (q.checklist[i]) q.checklist[i].due = t.value; touch(q); }); return; }
    if (field.startsWith("date-")) { const k = field.slice(5); update((u) => { const q = ensureProgress(u, id); q.dates[k] = t.value; touch(q); addLog(u, id, `Ghi ngày ${k === "submitted" ? "nộp" : k === "interview" ? "phỏng vấn" : "kết quả"}: ${fmtDate(t.value) || "xóa"}`); }); return; }
    if (field === "fee-paid") { update((u) => { const q = ensureProgress(u, id); q.fee = { ...(q.fee || {}), paid: t.checked }; touch(q); addLog(u, id, t.checked ? "Đã đóng lệ phí" : "Bỏ đánh dấu lệ phí"); }); return; }
    if (field === "ov-match") { update((u) => { const q = ensureProgress(u, id); q.override.match = t.value || null; touch(q); }); return; }
    if (field === "ov-cost") { update((u) => { const q = ensureProgress(u, id); q.override.cost = t.value === "" ? null : Number(t.value); touch(q); }); return; }
    if (field === "contact-status") { const i = Number(t.dataset.index); update((u) => { const q = ensureProgress(u, id); if (q.contacts[i]) { q.contacts[i].status = t.value; q.contacts[i].at = nowStamp(); } touch(q); addLog(u, id, `Liên hệ ${q.contacts[i] ? q.contacts[i].name : ""}: ${CONTACT_STATUS[t.value]}`); }); return; }
    if (field === "notes") { saveNotes.flush(t.value); return; }
  };
  const onInput = (e) => {
    const t = e.target;
    if (t.dataset.field === "notes") saveNotes(t.value);
  };
  const onSubmit = (e) => {
    const f = e.target.closest("form[data-form]");
    if (!f) return;
    e.preventDefault();
    if (f.dataset.form === "add-check") {
      const input = f.querySelector("input");
      const label = input.value.trim();
      if (!label) return;
      update((u) => { const q = ensureProgress(u, id); q.checklist.push({ key: uid("custom"), label, global: false, done: false, due: "", note: "" }); touch(q); addLog(u, id, `Thêm việc: ${label}`); });
    } else if (f.dataset.form === "add-contact") {
      const name = f.querySelector('[name="name"]').value.trim();
      const email = f.querySelector('[name="email"]').value.trim();
      if (!name) return;
      update((u) => { const q = ensureProgress(u, id); q.contacts.push({ name, email, status: "chua", at: nowStamp() }); touch(q); addLog(u, id, `Thêm liên hệ: ${name}`); });
    }
  };
  el.addEventListener("click", onClick);
  el.addEventListener("change", onChange);
  el.addEventListener("input", onInput);
  el.addEventListener("submit", onSubmit);
  return {
    cleanup: () => {
      saveNotes.cancel();
      el.removeEventListener("click", onClick);
      el.removeEventListener("change", onChange);
      el.removeEventListener("input", onInput);
      el.removeEventListener("submit", onSubmit);
    },
  };
}

function nextStrip(s) {
  const t = s.factors.timing;
  const p = s.progress;
  if (p && p.tracked && STATUS[p.status] && !(p.status === "consider" || p.status === "prep")) {
    const st = STATUS[p.status];
    const tone = p.status === "offer" ? "ok" : p.status === "rejected" ? "crit" : p.status === "waitlist" ? "warn" : "ok";
    const when = p.dates && p.dates.submitted ? `Đã nộp ngày ${fmtDate(p.dates.submitted)}.` : "Đã nộp.";
    const res = p.dates && p.dates.result ? ` Kết quả ngày ${fmtDate(p.dates.result)}.` : "";
    const iv = p.dates && p.dates.interview ? ` Phỏng vấn ngày ${fmtDate(p.dates.interview)}.` : "";
    return `<div class="next-strip tone-${tone}">${icon(tone)}<div><b>${esc(st.label)}</b> <span class="next-label">${esc(when + iv + res)}</span>${s.next && !s.next.past ? `<p class="small muted">Hạn nộp ${fmtDate(s.next.date)} (${esc(s.next.label || "")}). Ghi ngày phỏng vấn và ngày có kết quả ở khung Ngày của bạn.</p>` : ""}</div></div>`;
  }
  const tone = TONE.timing[t.state] || "idle";
  if (!s.next) return `<div class="next-strip tone-idle">${icon("idle")}<div><b>Chưa có ngày cụ thể.</b> <span>${esc(s.item.dtext || "")}</span></div></div>`;
  return `<div class="next-strip tone-${tone}">${icon(tone)}<div>
    <b>${s.next.past ? "Hạn cuối đã qua" : "Hạn tiếp theo"}: ${fmtDate(s.next.date)}</b> ${countdown(s.next.days)}
    <span class="next-label">${esc(s.next.label || "")}</span>
    <p class="small muted">${esc(t.text)}${s.item.dtext ? `. ${esc(s.item.dtext)}` : ""}</p>
  </div></div>`;
}

function checklistPanel(item, p, tracked, c) {
  if (!tracked) {
    const preview = buildChecklist(item);
    return `<section class="panel p-check"><div class="panel-head"><h2>Checklist hồ sơ</h2></div>
      <p class="muted">Theo dõi học bổng này để đánh dấu từng việc. Checklist mặc định:</p>
      <ul class="checklist checklist-preview">${preview.map((x) => `<li class="check-item"><span class="checkbox" aria-hidden="true"></span><div class="check-body"><span class="check-label">${esc(x.label)}</span>${x.global ? '<span class="chip chip-shared">Dùng chung</span>' : ""}</div></li>`).join("")}</ul>
      <button class="btn btn-primary" data-act="track">Theo dõi và dùng checklist</button></section>`;
  }
  const done = p.checklist.filter((x) => isDone(x, c.docs)).length;
  const total = p.checklist.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<section class="panel p-check" aria-labelledby="h-check">
    <div class="panel-head"><h2 id="h-check">Checklist hồ sơ</h2><span class="check-sum"><b>${done}/${total}</b> ${meter(pct)}</span></div>
    <ul class="checklist">${p.checklist.map((x, i) => {
      const d = isDone(x, c.docs);
      const lib = x.global ? (c.docs[x.key] || { status: "chua" }) : null;
      const dueDays = x.due ? daysUntil(x.due) : null;
      return `<li class="check-item${d ? " is-done" : ""}">
        <button type="button" class="checkbox" data-act="check" data-index="${i}" aria-pressed="${d}" aria-label="${esc(x.label)}: ${d ? "đã xong, bấm để bỏ" : "chưa xong, bấm để đánh dấu"}">${d ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ""}</button>
        <div class="check-body">
          <span class="check-label">${esc(x.label)}</span>
          ${x.global ? `<span class="chip chip-shared" tabindex="0" data-tip="Giấy tờ dùng chung\nĐánh dấu ở đây sẽ cập nhật cho mọi hồ sơ. Trạng thái trong kho: ${esc(DOC_STATUS[lib.status] ? DOC_STATUS[lib.status].label : "Chưa có")}">Dùng chung</span>` : ""}
          ${x.due ? countdown(dueDays, { label: `Hạn riêng ${fmtDate(x.due, { short: true })}` }) : ""}
        </div>
        <div class="check-tools">
          ${x.global ? "" : `<label class="sr-only" for="due-${i}">Hạn riêng cho ${esc(x.label)}</label><input class="input-sm" type="date" id="due-${i}" data-field="due" data-index="${i}" value="${esc(x.due || "")}">`}
          ${x.global ? "" : `<button type="button" class="icon-btn" data-act="del-check" data-index="${i}" aria-label="Xóa việc ${esc(x.label)}" title="Xóa việc này"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>`}
        </div>
      </li>`;
    }).join("")}</ul>
    <form class="add-row" data-form="add-check"><label class="sr-only" for="new-check">Việc mới</label><input id="new-check" type="text" placeholder="Thêm việc, ví dụ: hỏi giáo sư về chủ đề luận văn" maxlength="140"><button class="btn btn-sm" type="submit">Thêm việc</button></form>
    <button type="button" class="btn btn-ghost btn-sm" data-act="reset-checklist">Tạo lại checklist mặc định</button>
  </section>`;
}

function requirementsPanel(item, s) {
  const e = item.english || {};
  const rows = [
    ["Học bổng", `${esc(item.amount || "–")} <span class="chip chip-fund fund-${esc(item.fund)}">${esc(FUND_LABEL[item.fund] || item.fund)}</span>`],
    ["Tiếng Anh", `${verdict("Tiếng Anh", s.factors.english, "english")}<p class="small">${esc(e.text || "")}</p>`],
    ["Chi phí tự lo", `${verdict("Tài chính", s.factors.cost, "cost")}<p class="small">${esc(s.factors.cost.text)}</p>`],
    ["Kỳ nhập học", `${esc(item.intake || "–")} <span class="chip${item.spring === "xuan" || item.spring === "ca" ? " chip-spring" : ""}">${esc(SPRING_LABEL[item.spring] || "")}</span>`],
    item.cond ? ["Điều kiện", esc(item.cond)] : null,
    item.note ? ["Lưu ý", esc(item.note)] : null,
    item.docsText ? ["Hồ sơ và phí", esc(item.docsText)] : null,
    item.aps ? ["APS", item.aps === "required" ? "Cần chứng chỉ APS khi nộp" : "APS nộp kèm hoặc chậm nhất khi nhập học"] : null,
    item.gre ? ["GRE", "Không bắt buộc nhưng được khuyến khích"] : null,
    item.fee ? ["Lệ phí nộp", `${esc(fmtMoney(item.fee.amt, item.fee.cur))}${item.fee.note ? `. ${esc(item.fee.note)}` : ""}`] : null,
    item.comp ? ["Cạnh tranh", esc(item.comp.text)] : null,
  ].filter(Boolean);
  return `<section class="panel p-req" aria-labelledby="h-req"><div class="panel-head"><h2 id="h-req">Yêu cầu và điều kiện</h2></div>
    <dl class="req-list">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl></section>`;
}

function notesPanel(p) {
  return `<section class="panel p-notes" aria-labelledby="h-notes"><div class="panel-head"><h2 id="h-notes">Ghi chú</h2><span class="muted small">Tự lưu khi gõ</span></div>
    <label class="sr-only" for="notes">Ghi chú</label>
    <textarea id="notes" data-field="notes" rows="5" placeholder="Tài khoản cổng nộp (không ghi mật khẩu), ý chính cho thư động lực, câu hỏi cần gửi trường…">${esc(p.notes || "")}</textarea></section>`;
}

function contactsPanel(p) {
  return `<section class="panel p-contacts" aria-labelledby="h-contacts"><div class="panel-head"><h2 id="h-contacts">Liên hệ giáo sư và trường</h2></div>
    ${p.contacts.length ? `<ul class="contacts">${p.contacts.map((x, i) => `<li>
      <div><b>${esc(x.name)}</b>${x.email ? ` <span class="muted small sel">${esc(x.email)}</span>` : ""}</div>
      <label class="sr-only" for="cs-${i}">Trạng thái liên hệ</label>
      <select id="cs-${i}" class="input-sm" data-field="contact-status" data-index="${i}">${Object.entries(CONTACT_STATUS).map(([k, v]) => `<option value="${k}"${x.status === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>
      <button type="button" class="icon-btn" data-act="del-contact" data-index="${i}" aria-label="Xóa liên hệ ${esc(x.name)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
    </li>`).join("")}</ul>` : '<p class="muted small">Ghi lại giáo sư hoặc người phụ trách bạn đã liên hệ, để biết ai đã trả lời.</p>'}
    <form class="add-row" data-form="add-contact"><label class="sr-only" for="c-name">Tên</label><input id="c-name" name="name" placeholder="Tên giáo sư hoặc phòng ban" maxlength="80"><label class="sr-only" for="c-email">Email</label><input id="c-email" name="email" type="email" placeholder="Email (không bắt buộc)" maxlength="120"><button class="btn btn-sm" type="submit">Thêm liên hệ</button></form>
  </section>`;
}

function logPanel(item) {
  const entries = store.user.log.filter((x) => x.id === item.id).slice(0, 15);
  return `<section class="panel p-log" aria-labelledby="h-log"><div class="panel-head"><h2 id="h-log">Nhật ký</h2></div>
    ${entries.length ? `<ol class="log">${entries.map((x) => `<li><time>${esc(new Date(x.at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))}</time><span>${esc(x.text)}</span></li>`).join("")}</ol>` : '<p class="muted small">Chưa có hoạt động.</p>'}</section>`;
}

function factorsPanel(s, c) {
  const w = c.settings.weights;
  return `<section class="panel p-fac" aria-labelledby="h-fac"><div class="panel-head"><h2 id="h-fac">Đo các yếu tố</h2><a class="small" href="#/cai-dat">Đổi trọng số</a></div>
    <ul class="factors">${FACTORS.map((f) => {
      const x = s.factors[f.key];
      const tone = (TONE[f.key] && TONE[f.key][x.state]) || (x.score >= 75 ? "ok" : x.score >= 50 ? "mid" : "low");
      return `<li class="factor">
        <div class="factor-top"><span class="factor-name" data-tip="${esc(f.label + "\n" + f.hint)}" tabindex="0">${esc(f.label)}</span><span class="factor-w">trọng số ${w[f.key]}</span><b class="factor-score">${x.score}</b></div>
        <span class="factor-track"><span class="factor-fill fill-${x.score >= 75 ? "ok" : x.score >= 50 ? "mid" : "low"}" style="width:${x.score}%"></span></span>
        <p class="factor-text"><span class="factor-state tone-${tone}">${esc(x.label)}</span> ${esc(x.text || "")}</p>
      </li>`;
    }).join("")}</ul>
    ${s.gates.length ? `<p class="small gate-note">${icon("warn")} Điểm bị giới hạn vì: ${esc(s.gates.map((g) => g.text).join("; "))}.</p>` : ""}
  </section>`;
}

function eventsPanel(item, p) {
  const evs = eventsOf(item, p);
  return `<section class="panel p-ev" aria-labelledby="h-ev"><div class="panel-head"><h2 id="h-ev">Các mốc thời gian</h2></div>
    ${evs.length ? `<ol class="events">${evs.map((e) => {
      const d = daysUntil(e.date);
      return `<li class="ev ev-${esc(e.kind)}${d < 0 ? " is-past" : ""}"><span class="ev-date">${fmtDate(e.date)}</span><span class="ev-label">${esc(e.label)}${e.est ? ' <span class="chip chip-est">Dự kiến</span>' : ""}</span>${d >= 0 ? countdown(d) : ""}</li>`;
    }).join("")}</ol>` : `<p class="muted small">${esc(item.dtext || "Chưa có ngày cụ thể.")}</p>`}
  </section>`;
}

function datesPanel(p) {
  const d = p.dates || {};
  const f = (k, label) => `<div class="field"><label for="dt-${k}">${label}</label><input type="date" id="dt-${k}" data-field="date-${k}" value="${esc(d[k] || "")}"></div>`;
  return `<section class="panel p-dates" aria-labelledby="h-dates"><div class="panel-head"><h2 id="h-dates">Ngày của bạn</h2></div>
    <div class="form-grid">${f("submitted", "Ngày đã nộp")}${f("interview", "Ngày phỏng vấn / thi")}${f("result", "Ngày có kết quả")}</div></section>`;
}

function feePanel(item, p, c) {
  const rates = c.settings.rates || store.meta.rates || {};
  const fee = item.fee;
  const eur = fee ? toEUR(fee.amt, fee.cur, rates) : null;
  return `<section class="panel p-fee" aria-labelledby="h-fee"><div class="panel-head"><h2 id="h-fee">Lệ phí nộp</h2></div>
    <p>${fee ? `<b>${esc(fmtMoney(fee.amt, fee.cur))}</b>${fee.cur !== "EUR" && eur != null ? ` <span class="muted small">≈ ${fmtEUR(eur)}</span>` : ""}` : '<span class="muted">Chưa rõ lệ phí</span>'}</p>
    ${fee && fee.note ? `<p class="small muted">${esc(fee.note)}</p>` : ""}
    <label class="check-line"><input type="checkbox" data-field="fee-paid"${p.fee && p.fee.paid ? " checked" : ""}> Đã đóng lệ phí</label></section>`;
}

function overridePanel(item, p) {
  const o = p.override || {};
  return `<section class="panel p-ov" aria-labelledby="h-ov"><div class="panel-head"><h2 id="h-ov">Tự đánh giá</h2></div>
    <p class="muted small">Sửa khi bạn biết rõ hơn danh mục. Điểm ưu tiên tính lại ngay.</p>
    <div class="form-grid">
      <div class="field"><label for="ov-match">Độ phù hợp</label><select id="ov-match" data-field="ov-match"><option value="">Theo danh mục (${esc(MATCH_LABEL[item.match] || "")})</option>${Object.entries(MATCH_LABEL).map(([k, v]) => `<option value="${k}"${o.match === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
      <div class="field"><label for="ov-cost">Chi phí tự lo mỗi năm (€)</label><input id="ov-cost" type="number" min="0" step="100" inputmode="numeric" data-field="ov-cost" value="${o.cost != null ? esc(o.cost) : ""}" placeholder="Theo ước tính"></div>
    </div></section>`;
}
