// Cài đặt: scoring weights, GitHub sync, data backup, theme.
import { store, update, touch, exportJSON, importJSON, resetUser, allItems, DEFAULT_WEIGHTS } from "../store.js";
import { FACTORS, scoreAll } from "../scoring.js";
import { getConfig, setConfig, forgetToken, testConnection, syncNow, getState, isConfigured } from "../sync.js";
import { esc, downloadFile, todayISO, now, lsGet, lsSet } from "../util.js";
import { scoreBadge } from "../components.js";

export const title = "Cài đặt";

export function render(el, app) {
  const w = store.user.settings.weights;
  const cfg = getConfig();
  const st = getState();
  const rates = store.user.settings.rates || store.meta.rates || {};
  const theme = lsGet("hb27:theme", "auto");

  el.innerHTML = `
    <div class="page-head"><div><h1>Cài đặt</h1><p class="muted">Trọng số chấm điểm, đồng bộ GitHub, sao lưu dữ liệu.</p></div></div>

    <section class="panel" aria-labelledby="h-w">
      <div class="panel-head"><h2 id="h-w">Trọng số các yếu tố</h2><button class="btn btn-sm btn-ghost" data-act="reset-weights">Về mặc định</button></div>
      <p class="muted small">Điểm ưu tiên là trung bình có trọng số của 6 yếu tố. Kéo để đổi mức quan trọng; điểm cập nhật ngay.</p>
      <div class="weights">${FACTORS.map((f) => `<div class="weight-row">
        <label for="w-${f.key}"><b>${esc(f.label)}</b><span class="small muted">${esc(f.hint)}</span></label>
        <input id="w-${f.key}" type="range" min="0" max="40" step="5" value="${w[f.key]}" data-w="${f.key}">
        <output for="w-${f.key}" id="wo-${f.key}">${w[f.key]}</output>
      </div>`).join("")}</div>
      <div class="field field-inline"><label for="s-days">Số ngày cho mỗi việc chưa xong</label><input id="s-days" type="number" min="1" max="14" step="1" value="${store.user.settings.daysPerTask}" data-s="daysPerTask"><span class="small muted">Dùng để tính yếu tố thời gian</span></div>
      <h3 class="h3">Năm học bổng điểm cao nhất với trọng số này</h3>
      <ol class="top5" id="top5"></ol>
    </section>

    <section class="panel" aria-labelledby="h-sync">
      <div class="panel-head"><h2 id="h-sync">Đồng bộ với GitHub</h2><span class="sync-pill sync-${esc(st.status)}">${esc(st.configured ? st.message || "Đã kết nối" : "Chưa kết nối")}</span></div>
      <p class="muted small">Dữ liệu cá nhân được lưu thành một file JSON trong repo <b>private</b> của bạn. Mỗi lần thay đổi là một commit, nên mở trên máy khác vẫn thấy và xem lại được lịch sử.</p>
      <form id="sync-form" class="form-grid" autocomplete="off">
        <div class="field"><label for="g-owner">Tài khoản GitHub</label><input id="g-owner" name="owner" value="${esc(cfg.owner)}" placeholder="ví dụ: DRuanli" autocapitalize="off" spellcheck="false"></div>
        <div class="field"><label for="g-repo">Repo private chứa dữ liệu</label><input id="g-repo" name="repo" value="${esc(cfg.repo)}" placeholder="hoc-bong-2027-data" autocapitalize="off" spellcheck="false"></div>
        <div class="field"><label for="g-branch">Nhánh</label><input id="g-branch" name="branch" value="${esc(cfg.branch)}" autocapitalize="off" spellcheck="false"></div>
        <div class="field"><label for="g-path">Tên file</label><input id="g-path" name="path" value="${esc(cfg.path)}" autocapitalize="off" spellcheck="false"></div>
        <div class="field field-wide"><label for="g-token">Fine-grained token</label><input id="g-token" name="token" type="password" value="${esc(cfg.token)}" placeholder="github_pat_…" autocapitalize="off" spellcheck="false"><span class="small muted">Chỉ lưu trong trình duyệt này. Không bao giờ nằm trong file sao lưu.</span></div>
        <label class="check-line field-wide"><input type="checkbox" name="auto"${cfg.auto ? " checked" : ""}> Tự đồng bộ vài giây sau mỗi thay đổi</label>
        <div class="btn-row field-wide">
          <button class="btn btn-primary" type="submit">Lưu và đồng bộ</button>
          <button class="btn" type="button" data-act="test">Kiểm tra kết nối</button>
          <button class="btn btn-ghost" type="button" data-act="forget">Quên token trên máy này</button>
        </div>
        <p class="small field-wide" id="sync-msg" aria-live="polite">${st.at ? `Lần gần nhất: ${esc(new Date(st.at).toLocaleString("vi-VN"))}. ${esc(st.message)}` : ""}</p>
      </form>
      <details class="howto"><summary>Cách tạo token (một lần, khoảng 2 phút)</summary>
        <ol>
          <li>Mở <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a>.</li>
          <li>Đặt tên, ví dụ "hoc-bong-2027", chọn hạn dùng (ví dụ 1 năm).</li>
          <li>Ở <b>Repository access</b>, chọn <b>Only select repositories</b> rồi chọn repo private chứa dữ liệu.</li>
          <li>Ở <b>Permissions</b>, mục Repository permissions, đặt <b>Contents</b> là <b>Read and write</b>. Không cần quyền nào khác.</li>
          <li>Bấm Generate token, sao chép chuỗi bắt đầu bằng <code>github_pat_</code> và dán vào ô trên.</li>
        </ol>
        <p class="small muted">Token này chỉ đọc và ghi được đúng repo dữ liệu đó. Nếu lộ, vào trang token trên GitHub để thu hồi.</p>
      </details>
    </section>

    <div class="grid-2">
      <section class="panel" aria-labelledby="h-data">
        <div class="panel-head"><h2 id="h-data">Sao lưu dữ liệu</h2></div>
        <p class="muted small">File gồm hồ sơ, tiến độ, giấy tờ và học bổng tự thêm. Không gồm token.</p>
        <div class="btn-row"><button class="btn" data-act="export">Tải bản sao (.json)</button><button class="btn" data-act="open-import">Nhập file (.json)</button></div>
        <div class="danger-zone-box">
          <p class="small"><b>Xóa dữ liệu trên máy này.</b> Dữ liệu trên GitHub (nếu đã đồng bộ) không bị xóa.</p>
          <button class="btn btn-ghost btn-danger" data-act="reset">Xóa dữ liệu trên máy này</button>
        </div>
      </section>
      <section class="panel" aria-labelledby="h-look">
        <div class="panel-head"><h2 id="h-look">Giao diện và tỷ giá</h2></div>
        <div class="seg" role="group" aria-label="Giao diện">
          ${[["auto", "Theo hệ thống"], ["light", "Sáng"], ["dark", "Tối"]].map(([k, v]) => `<button class="seg-btn${theme === k ? " is-on" : ""}" data-act="theme" data-v="${k}" aria-pressed="${theme === k}">${v}</button>`).join("")}
        </div>
        <h3 class="h3">Tỷ giá quy đổi sang euro</h3>
        <p class="small muted">Dùng cho lệ phí nộp. Sửa khi tỷ giá đổi nhiều.</p>
        <div class="rates">${Object.entries(rates).filter(([k]) => k !== "EUR").map(([k, v]) => `<div class="field field-inline"><label for="r-${k}">1 ${k} =</label><input id="r-${k}" type="number" step="0.0001" min="0" value="${v}" data-rate="${k}"><span class="small muted">€</span></div>`).join("")}</div>
      </section>
    </div>

    <section class="panel" aria-labelledby="h-about">
      <div class="panel-head"><h2 id="h-about">Về dữ liệu</h2></div>
      <p class="small">Danh mục cập nhật ngày ${esc(store.meta.updated || "")}, ${esc(String(store.meta.count || store.catalog.length))} mục. ${esc(store.meta.about || "")}</p>
      <p class="small muted">Danh mục nằm trong <code>data/scholarships.json</code> của repo app; sửa file đó trên GitHub là app cập nhật sau vài phút.</p>
    </section>
  `;

  const drawTop = () => {
    const c = { user: store.user, profile: store.user.profile, settings: store.user.settings, docs: store.user.docs, ref: now() };
    const scores = [...scoreAll(allItems(), c).values()].filter((s) => !s.closed).sort((a, b) => b.priority - a.priority).slice(0, 5);
    el.querySelector("#top5").innerHTML = scores.map((s) => `<li><a href="#/s/${esc(s.item.id)}">${esc(s.item.name)}</a>${scoreBadge(s.priority)}</li>`).join("");
  };
  drawTop();

  const onInput = (e) => {
    const t = e.target;
    if (t.dataset.w) {
      el.querySelector(`#wo-${t.dataset.w}`).textContent = t.value;
      update((u) => { u.settings.weights[t.dataset.w] = Number(t.value); touch(u.settings); }, { silent: true });
      drawTop();
    }
  };
  const onChange = (e) => {
    const t = e.target;
    if (t.dataset.w) { update((u) => { touch(u.settings); }, { silent: true }); }
    else if (t.dataset.s === "daysPerTask") update((u) => { u.settings.daysPerTask = Math.max(1, Number(t.value) || 2); touch(u.settings); });
    else if (t.dataset.rate) update((u) => { u.settings.rates = { ...(u.settings.rates || store.meta.rates), [t.dataset.rate]: Number(t.value) }; touch(u.settings); }, { silent: true });
  };
  const msg = (text, tone = "") => { const m = el.querySelector("#sync-msg"); m.textContent = text; m.className = `small field-wide ${tone ? "tone-text-" + tone : ""}`; };
  const formCfg = () => {
    const f = el.querySelector("#sync-form");
    return { owner: f.owner.value.trim(), repo: f.repo.value.trim(), branch: f.branch.value.trim() || "main", path: f.path.value.trim() || "data.json", token: f.token.value.trim(), auto: f.auto.checked };
  };
  const onSubmit = async (e) => {
    if (e.target.id !== "sync-form") return;
    e.preventDefault();
    const c = formCfg();
    if (!c.owner || !c.repo || !c.token) { msg("Cần điền tài khoản, repo và token.", "crit"); return; }
    setConfig(c);
    msg("Đang đồng bộ…");
    const r = await syncNow();
    msg(r.message, r.ok ? "ok" : "crit");
    if (r.ok) app.toast("Đã đồng bộ với GitHub");
  };
  const onClick = async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || !el.contains(b)) return;
    const act = b.dataset.act;
    if (act === "reset-weights") { update((u) => { u.settings.weights = { ...DEFAULT_WEIGHTS }; touch(u.settings); }); }
    else if (act === "test") {
      const c = formCfg();
      if (!c.owner || !c.repo || !c.token) { msg("Cần điền tài khoản, repo và token.", "crit"); return; }
      msg("Đang kiểm tra…");
      const r = await testConnection(c);
      msg(r.message, r.ok ? "ok" : "crit");
    } else if (act === "forget") { forgetToken(); app.toast("Đã xóa token khỏi trình duyệt này"); app.rerender(); }
    else if (act === "export") { downloadFile(`hoc-bong-2027-${todayISO()}.json`, exportJSON()); app.toast("Đã tải bản sao dữ liệu"); }
    else if (act === "open-import") app.openImport();
    else if (act === "reset") {
      if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Bấm lần nữa để xóa hẳn"; return; }
      resetUser();
      app.toast("Đã xóa dữ liệu trên máy này");
    } else if (act === "theme") { app.setTheme(b.dataset.v); app.rerender(); }
  };
  el.addEventListener("input", onInput);
  el.addEventListener("change", onChange);
  el.addEventListener("submit", onSubmit);
  el.addEventListener("click", onClick);
  return { cleanup: () => { el.removeEventListener("input", onInput); el.removeEventListener("change", onChange); el.removeEventListener("submit", onSubmit); el.removeEventListener("click", onClick); } };
}
