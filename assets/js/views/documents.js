// Giấy tờ: shared documents used across applications, with status, expiry and a link to your copy.
import { store, update, touch, addLog, trackedItems, ACTIVE_STATUSES } from "../store.js";
import { DOC_TYPES, GLOBAL_DOC_KEYS, DOC_STATUS, docType } from "../docs.js";
import { esc, fmtDate, addYears, daysUntil, safeUrl, debounce } from "../util.js";
import { icon, emptyState } from "../components.js";
import { short } from "../charts.js";

export const title = "Giấy tờ";

export function render(el, app) {
  const tracked = trackedItems().filter((it) => ACTIVE_STATUSES.includes(store.user.progress[it.id].status));
  const usedBy = new Map(GLOBAL_DOC_KEYS.map((k) => [k, []]));
  let lor = 0, lorDone = 0, mot = 0, motDone = 0, prop = 0, propDone = 0, cv = 0, cvDone = 0;
  for (const it of tracked) {
    const p = store.user.progress[it.id];
    for (const e of p.checklist) {
      if (e.global && usedBy.has(e.key)) usedBy.get(e.key).push(it);
      else if (/^lor\d+$/.test(e.key)) { lor++; if (e.done) lorDone++; }
      else if (e.key === "motivation") { mot++; if (e.done) motDone++; }
      else if (e.key === "proposal") { prop++; if (e.done) propDone++; }
      else if (e.key === "cv") { cv++; if (e.done) cvDone++; }
    }
  }
  const keys = GLOBAL_DOC_KEYS.slice().sort((a, b) => usedBy.get(b).length - usedBy.get(a).length);
  const docs = store.user.docs;
  const doneCount = keys.filter((k) => usedBy.get(k).length && docs[k] && docs[k].status === "xong").length;
  const neededCount = keys.filter((k) => usedBy.get(k).length).length;
  const ielts = store.user.profile.ielts;

  el.innerHTML = `
    <div class="page-head"><div><h1>Giấy tờ</h1><p class="muted">Mỗi giấy tờ chỉ cần làm một lần rồi dùng cho mọi hồ sơ. Đánh dấu ở đây là checklist của các học bổng tự cập nhật.</p></div></div>
    <div class="kpis kpis-3">
      <div class="kpi"><span class="kpi-k">Giấy tờ chung đã xong</span><span class="kpi-v">${doneCount}/${neededCount}</span><span class="kpi-sub">cho hồ sơ đang theo dõi</span></div>
      <div class="kpi"><span class="kpi-k">Thư giới thiệu</span><span class="kpi-v">${lorDone}/${lor}</span><span class="kpi-sub">tính riêng từng hồ sơ</span></div>
      <div class="kpi"><span class="kpi-k">Thư động lực, SOP</span><span class="kpi-v">${motDone}/${mot}</span><span class="kpi-sub">${prop ? `và ${propDone}/${prop} đề cương nghiên cứu` : "viết riêng cho từng nơi"}</span></div>
    </div>
    <div class="doc-list">
      ${keys.map((k) => docRow(k, docs[k], usedBy.get(k), ielts)).join("")}
    </div>
    <p class="muted small">Đường dẫn nên trỏ tới bản lưu riêng của bạn (Google Drive, OneDrive…). App chỉ lưu đường dẫn, không lưu file.</p>
  `;

  const saveText = debounce((key, field, value) => {
    update((u) => { const d = u.docs[key] || { status: "chua", expiry: "", link: "", note: "" }; d[field] = value; u.docs[key] = touch(d); }, { silent: true });
  }, 500);

  const onChange = (e) => {
    const t = e.target;
    const key = t.dataset.key;
    if (!key) return;
    const field = t.dataset.field;
    if (field === "status" || field === "expiry") {
      update((u) => {
        const d = u.docs[key] || { status: "chua", expiry: "", link: "", note: "" };
        d[field] = t.value;
        u.docs[key] = touch(d);
        if (field === "status") addLog(u, "", `${docType(key).label}: ${DOC_STATUS[t.value].label.toLowerCase()}`);
      });
    } else if (field === "link" || field === "note") {
      saveText.flush(key, field, t.value);
    }
  };
  const onInput = (e) => {
    const t = e.target;
    if (t.dataset.key && (t.dataset.field === "link" || t.dataset.field === "note")) saveText(t.dataset.key, t.dataset.field, t.value);
  };
  el.addEventListener("change", onChange);
  el.addEventListener("input", onInput);
  return { cleanup: () => { saveText.cancel(); el.removeEventListener("change", onChange); el.removeEventListener("input", onInput); } };
}

function docRow(key, d, apps, ielts) {
  const t = DOC_TYPES[key];
  const doc = d || { status: "chua", expiry: "", link: "", note: "" };
  const st = DOC_STATUS[doc.status] || DOC_STATUS.chua;
  let expiry = doc.expiry;
  let expiryNote = "";
  if (key === "ielts" && !expiry && ielts && ielts.date) { expiry = addYears(ielts.date, 2); expiryNote = "Tính từ ngày thi ở trang Hồ sơ"; }
  const left = expiry ? daysUntil(expiry) : null;
  const expTone = left == null ? "" : left < 60 ? "crit" : left < 365 ? "warn" : "ok";
  const link = doc.link && safeUrl(doc.link) !== "#" ? `<a class="small" href="${esc(safeUrl(doc.link))}" target="_blank" rel="noopener">Mở bản lưu</a>` : "";
  return `<section class="doc-row${apps.length ? "" : " is-unused"}" aria-labelledby="doc-${key}">
    <div class="doc-head">
      <span class="verdict tone-${st.tone}">${icon(st.tone)}<span id="doc-${key}">${esc(t.label)}</span></span>
      <span class="muted small">${apps.length ? `Cần cho ${apps.length} hồ sơ: ${apps.slice(0, 4).map((a) => `<a href="#/s/${esc(a.id)}">${esc(short(a.name, 26))}</a>`).join(", ")}${apps.length > 4 ? "…" : ""}` : "Chưa hồ sơ nào đang theo dõi cần"}</span>
    </div>
    ${t.hint ? `<p class="small muted">${esc(t.hint)}</p>` : ""}
    <div class="doc-fields">
      <div class="field"><label for="ds-${key}">Trạng thái</label><select id="ds-${key}" data-key="${key}" data-field="status">${Object.entries(DOC_STATUS).map(([k, v]) => `<option value="${k}"${doc.status === k ? " selected" : ""}>${esc(v.label)}</option>`).join("")}</select></div>
      ${t.expires ? `<div class="field"><label for="de-${key}">Hết hạn</label><input id="de-${key}" type="date" data-key="${key}" data-field="expiry" value="${esc(doc.expiry || "")}">${expiry ? `<span class="small tone-text-${expTone}">${left < 0 ? "Đã hết hạn" : `Còn ${left} ngày`}${expiryNote ? `. ${esc(expiryNote)}` : ""}</span>` : ""}</div>` : ""}
      <div class="field field-grow"><label for="dl-${key}">Đường dẫn bản lưu</label><input id="dl-${key}" type="url" inputmode="url" placeholder="https://drive.google.com/…" data-key="${key}" data-field="link" value="${esc(doc.link || "")}">${link}</div>
      <div class="field field-grow"><label for="dn-${key}">Ghi chú</label><input id="dn-${key}" type="text" maxlength="200" data-key="${key}" data-field="note" value="${esc(doc.note || "")}" placeholder="Ví dụ: đã công chứng 5 bộ"></div>
    </div>
  </section>`;
}
