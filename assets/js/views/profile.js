// Hồ sơ: the private profile every score is measured against.
import { store, update, touch } from "../store.js";
import { REGION_LABEL, whatIf, hasIelts } from "../scoring.js";
import { esc, ieltsOverall, germanGrade, fmtEUR, addYears, fmtDate, daysUntil } from "../util.js";
import { emptyState } from "../components.js";
import { barList } from "../charts.js";

export const title = "Hồ sơ";

export function render(el, app) {
  const p = store.user.profile;
  const i = p.ielts || {};
  const calcOverall = ieltsOverall(i);
  const overall = i.overall != null && i.overall !== "" ? i.overall : calcOverall;
  const gg = p.gpa10 != null && p.gpa10 !== "" ? germanGrade(p.gpa10, 10, Number(p.gpaMin) || 5) : null;
  const ieltsExp = i.date ? addYears(i.date, 2) : "";
  const fmtBand = (v) => (v == null || v === "" ? "–" : Number(v).toFixed(1));
  const band = (k, name) => `<div class="band${Number(i[k]) > 0 && Number(i[k]) < 6.5 ? " is-low" : ""}"><label for="b-${k}">${name}</label><input id="b-${k}" type="number" min="0" max="9" step="0.5" inputmode="decimal" data-p="ielts.${k}" value="${i[k] ?? ""}"></div>`;

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Hồ sơ của bạn</h1><p class="muted">Mọi điểm số trong app đo theo các thông tin này. Chúng chỉ nằm trong trình duyệt và repo riêng của bạn, không nằm trong code công khai.</p></div>
      <div class="page-actions"><button class="btn" data-act="open-import">Nhập file hồ sơ</button></div>
    </div>

    <section class="pass" aria-label="Tóm tắt hồ sơ">
      <div class="pass-main">
        <p class="pass-k">Thạc sĩ CS, khoa học dữ liệu, AI ${p.preferSpring ? "từ kỳ xuân 2027" : "năm 2027"}</p>
        <div class="pass-bands">
          ${["L", "R", "W", "S"].map((k) => `<span class="pb${Number(i[k]) > 0 && Number(i[k]) < 6.5 ? " is-low" : ""}"><b>${fmtBand(i[k])}</b><small>${{ L: "Listening", R: "Reading", W: "Writing", S: "Speaking" }[k]}</small></span>`).join("")}
          <span class="pb pb-total"><b>${fmtBand(overall)}</b><small>Tổng</small></span>
        </div>
        <p class="pass-facts">${p.moi ? "Có giấy xác nhận học bằng tiếng Anh. " : ""}${p.gpa10 ? `GPA ${esc(p.gpa10)}/10${gg ? ` (khoảng ${gg.toFixed(1)} thang Đức)` : ""}. ` : ""}${p.apsDate ? `APS dự kiến ${fmtDate(p.apsDate)}.` : ""}</p>
      </div>
      <div class="pass-stub">
        <p class="pass-k">Tự lo mỗi năm</p>
        <p class="pass-money">${p.budgetMin != null && p.budgetMax != null && p.budgetMin !== "" ? `${fmtEUR(p.budgetMin)}–${Number(p.budgetMax).toLocaleString("en-US")}` : "Chưa nhập"}</p>
        <p class="muted small">Ngoài phần học bổng chi trả</p>
      </div>
    </section>

    <div class="grid-2">
      <section class="panel" aria-labelledby="h-ielts">
        <div class="panel-head"><h2 id="h-ielts">IELTS</h2>${calcOverall != null ? `<span class="muted small">Trung bình 4 kỹ năng làm tròn: ${calcOverall}</span>` : ""}</div>
        <div class="bands-form">${band("L", "Listening")}${band("R", "Reading")}${band("W", "Writing")}${band("S", "Speaking")}
          <div class="band"><label for="b-o">Tổng</label><input id="b-o" type="number" min="0" max="9" step="0.5" inputmode="decimal" data-p="ielts.overall" value="${i.overall ?? ""}" placeholder="${calcOverall ?? ""}"></div>
        </div>
        <div class="form-grid">
          <div class="field"><label for="b-date">Ngày thi</label><input id="b-date" type="date" data-p="ielts.date" value="${esc(i.date || "")}">${ieltsExp ? `<span class="small muted">Hết hạn ${fmtDate(ieltsExp)} (còn ${Math.max(0, daysUntil(ieltsExp))} ngày)</span>` : `<span class="small muted">Để kiểm tra hạn 2 năm so với từng hạn nộp</span>`}</div>
        </div>
        <label class="check-line"><input type="checkbox" data-p="moi"${p.moi ? " checked" : ""}> Có giấy xác nhận cả chương trình cử nhân dạy bằng tiếng Anh</label>
        <p class="small muted">Nhiều trường (TU Darmstadt, FAU, ETH, Trento, UNIST, NTU…) nhận giấy này thay chứng chỉ.</p>
      </section>

      <section class="panel" aria-labelledby="h-money">
        <div class="panel-head"><h2 id="h-money">Tài chính và thời gian</h2></div>
        <div class="form-grid">
          <div class="field"><label for="p-bmin">Tự lo tối thiểu mỗi năm (€)</label><input id="p-bmin" type="number" min="0" step="500" inputmode="numeric" data-p="budgetMin" value="${p.budgetMin ?? ""}"></div>
          <div class="field"><label for="p-bmax">Tự lo tối đa mỗi năm (€)</label><input id="p-bmax" type="number" min="0" step="500" inputmode="numeric" data-p="budgetMax" value="${p.budgetMax ?? ""}"></div>
          <div class="field"><label for="p-age">Tuổi khi nộp</label><input id="p-age" type="number" min="16" max="60" step="1" inputmode="numeric" data-p="age" value="${p.age ?? ""}"><span class="small muted">Áo tính mức chứng minh theo tuổi (dưới 24 hay từ 24)</span></div>
          <div class="field"><label for="p-aps">Ngày dự kiến có chứng chỉ APS</label><input id="p-aps" type="date" data-p="apsDate" value="${esc(p.apsDate || "")}"><span class="small muted">Trường Đức đòi APS khi nộp sẽ bị cảnh báo nếu hạn sớm hơn ngày này</span></div>
        </div>
        <label class="check-line"><input type="checkbox" data-p="preferSpring"${p.preferSpring ? " checked" : ""}> Ưu tiên bắt đầu kỳ xuân 2027 (cộng điểm thời gian cho mục còn kịp)</label>
      </section>
    </div>

    <div class="grid-2">
      <section class="panel" aria-labelledby="h-gpa">
        <div class="panel-head"><h2 id="h-gpa">Điểm học tập</h2></div>
        <div class="form-grid">
          <div class="field"><label for="p-gpa">GPA thang 10</label><input id="p-gpa" type="number" min="0" max="10" step="0.01" inputmode="decimal" data-p="gpa10" value="${p.gpa10 ?? ""}"></div>
          <div class="field"><label for="p-gmin">Điểm đạt tối thiểu của trường</label><select id="p-gmin" data-p="gpaMin"><option value="5"${Number(p.gpaMin) !== 4 ? " selected" : ""}>5</option><option value="4"${Number(p.gpaMin) === 4 ? " selected" : ""}>4</option></select></div>
        </div>
        ${gg != null ? `<p class="convert"><span class="convert-num">${gg.toFixed(2)}</span><span>thang điểm Đức theo công thức Bavaria (1.0 là cao nhất, 4.0 là đạt). Nhiều trường lấy 1 chữ số thập phân: <b>${(Math.floor(gg * 10) / 10).toFixed(1)}</b>.</span></p>` : '<p class="muted small">Nhập GPA để quy đổi sang thang Đức.</p>'}
        <p class="small muted">Paderborn đòi GRE khi điểm quy đổi kém hơn 1.5; LMU Data Science đòi tốt hơn 1.5.</p>
      </section>

      <section class="panel" aria-labelledby="h-regions">
        <div class="panel-head"><h2 id="h-regions">Khu vực muốn học</h2></div>
        <p class="muted small">Dùng để lọc phần gợi ý ở Tổng quan. Để trống là xét tất cả.</p>
        <div class="check-grid">${Object.entries(REGION_LABEL).map(([k, v]) => `<label class="check-line"><input type="checkbox" data-region="${k}"${(p.regions || []).includes(k) ? " checked" : ""}> ${esc(v)}</label>`).join("")}</div>
      </section>
    </div>

    <section class="panel" aria-labelledby="h-fin">
      <div class="panel-head"><h2 id="h-fin">Mức chứng minh tài chính khi xin visa</h2></div>
      <p class="muted small">Số tiền tối thiểu cho sinh hoạt mỗi nước đòi khi cấp thị thực du học, so với ngân sách bạn nhập. Học bổng thường được tính thay một phần số này. Quy đổi ngoại tệ là gần đúng.</p>
      ${financeTable(p)}
    </section>

    <section class="panel" aria-labelledby="h-what">
      <div class="panel-head"><h2 id="h-what">Nếu điểm IELTS thay đổi</h2></div>
      ${whatIfBlock()}
    </section>
  `;

  const onChange = (e) => {
    const t = e.target;
    if (t.dataset.region) {
      const k = t.dataset.region;
      update((u) => { const set = new Set(u.profile.regions || []); if (t.checked) set.add(k); else set.delete(k); u.profile.regions = [...set]; touch(u.profile); });
      return;
    }
    const path = t.dataset.p;
    if (!path) return;
    let v;
    if (t.type === "checkbox") v = t.checked;
    else if (t.type === "number") v = t.value === "" ? null : Number(t.value);
    else v = t.value;
    if (path === "gpaMin") v = Number(v);
    update((u) => {
      if (path.startsWith("ielts.")) u.profile.ielts[path.slice(6)] = v;
      else u.profile[path] = v;
      touch(u.profile);
    });
  };
  const onClick = (e) => {
    const b = e.target.closest("[data-act]");
    if (b && b.dataset.act === "open-import") app.openImport();
  };
  el.addEventListener("change", onChange);
  el.addEventListener("click", onClick);
  return { cleanup: () => { el.removeEventListener("change", onChange); el.removeEventListener("click", onClick); } };
}

function financeTable(p) {
  const bmax = p.budgetMax != null && p.budgetMax !== "" ? Number(p.budgetMax) : null;
  const age = p.age != null && p.age !== "" ? Number(p.age) : null;
  const verdict = (need) => {
    if (bmax == null) return '<span class="tag tag-idle">Nhập ngân sách</span>';
    if (need <= bmax) return '<span class="tag tag-ok">Đủ</span>';
    if (need <= bmax * 1.1) return '<span class="tag tag-warn">Sát</span>';
    return '<span class="tag tag-crit">Thiếu nếu không có học bổng</span>';
  };
  const rows = store.finance.map((f) => {
    let need, needText, v;
    if (f.rule === "at") {
      const a = f.under24 + 1453, b = f.from24 + 1453;
      if (age == null) { needText = `${fmtEUR(a)} (dưới 24) / ${fmtEUR(b)} (từ 24)`; v = `${verdict(a)} ${verdict(b)}`; }
      else { need = age < 24 ? a : b; needText = fmtEUR(need); v = verdict(need); }
    } else {
      need = f.year + (f.plus || 0);
      needText = fmtEUR(need);
      v = verdict(need);
    }
    return `<tr><td data-label="Nước">${esc(f.country)}</td><td data-label="Mức phải chứng minh">${esc(f.text)}</td><td data-label="Cần mỗi năm" class="num">${needText}</td><td data-label="So với ngân sách">${v}<span class="small muted fin-extra">${esc(f.extra || "")}</span></td><td data-label="Nguồn"><a href="${esc(f.src)}" target="_blank" rel="noopener">${esc(f.srcName)}</a></td></tr>`;
  }).join("");
  return `<div class="table-wrap"><table class="data-table fin-table"><thead><tr><th>Nước</th><th>Mức phải chứng minh</th><th>Cần mỗi năm</th><th>So với ngân sách</th><th>Nguồn</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function whatIfBlock() {
  const res = whatIf(store.catalog.concat(store.user.custom.filter((c) => !c.deleted)), store.user.profile);
  if (!res) return emptyState("Chưa có điểm IELTS", "Nhập đủ 4 kỹ năng ở trên để xem mỗi mức điểm mở thêm bao nhiêu học bổng.");
  const rows = res.map((r) => ({ label: r.label, value: r.count, display: `${r.count}`, tone: r.key === "now" ? "s" : "s2" }));
  const seen = new Set();
  const lines = res.map((r) => {
    const fresh = r.unlocked.filter((x) => !seen.has(x.id));
    fresh.forEach((x) => seen.add(x.id));
    return fresh.length ? `<p class="small"><b>${esc(r.label)}</b> mở thêm ${fresh.length}: ${fresh.map((x) => `<a href="#/s/${esc(x.id)}">${esc(x.name)}</a>`).join(", ")}</p>` : "";
  }).join("");
  return `${barList(rows)}${lines || '<p class="small muted">Điểm hiện tại đã đạt mọi ngưỡng trong danh mục.</p>'}`;
}
