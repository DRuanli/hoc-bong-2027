// Bootstrap: load data, route between views, keep the header's sync status current.
import { store, loadCatalog, loadUser, subscribe, importJSON, saveCustom, getItem } from "./store.js";
import { onSyncState, scheduleSync, syncNow, isConfigured, setConfig, getConfig } from "./sync.js";
import { initTooltips, hideTooltip } from "./charts.js";
import { captureFocus, restoreFocus, esc, lsGet, lsSet, debounce } from "./util.js";
import { REGION_LABEL, FUND_LABEL, MATCH_LABEL } from "./scoring.js";
import * as dashboard from "./views/dashboard.js";
import * as list from "./views/list.js";
import * as detail from "./views/detail.js";
import * as board from "./views/board.js";
import * as calendar from "./views/calendar.js";
import * as documents from "./views/documents.js";
import * as profile from "./views/profile.js";
import * as settings from "./views/settings.js";
import * as compare from "./views/compare.js";

const ROUTES = {
  "": { view: dashboard, nav: "" },
  "hoc-bong": { view: list, nav: "hoc-bong" },
  s: { view: detail, nav: "hoc-bong", param: true },
  "tien-do": { view: board, nav: "tien-do" },
  lich: { view: calendar, nav: "lich" },
  "giay-to": { view: documents, nav: "giay-to" },
  "ho-so": { view: profile, nav: "ho-so" },
  "cai-dat": { view: settings, nav: "cai-dat" },
  "so-sanh": { view: compare, nav: "hoc-bong" },
};

const main = document.getElementById("view");
let current = null;
let lastKey = "";

function parse() {
  const h = location.hash.replace(/^#\/?/, "");
  const [head, ...rest] = h.split("/");
  const r = ROUTES[head] ? head : "";
  return { key: r, route: ROUTES[r], param: rest.length ? decodeURIComponent(rest.join("/")) : null, full: h };
}

function render(opts = {}) {
  const r = parse();
  const sameView = r.full === lastKey;
  const focus = sameView ? captureFocus() : null;
  const scroll = window.scrollY;
  hideTooltip();
  if (current && current.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
  main.innerHTML = "";
  let res = {};
  try {
    res = r.route.view.render(main, app, r.param) || {};
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty"><p class="empty-title">Trang này gặp lỗi khi hiển thị</p><p class="muted">${esc(e.message)}</p><p><a class="btn" href="#/">Về Tổng quan</a></p></div>`;
  }
  current = res;
  document.querySelectorAll(".nav a").forEach((a) => {
    const on = a.dataset.nav === r.route.nav;
    a.classList.toggle("is-active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  const t = r.key === "s" ? ((getItem(r.param) || {}).name || "Chi tiết") : r.route.view.title;
  document.title = t && r.key ? `${t} | Sổ học bổng 2027` : "Sổ học bổng 2027";
  if (sameView) {
    window.scrollTo(0, scroll);
    restoreFocus(focus);
  } else {
    window.scrollTo(0, 0);
    if (!opts.initial) main.focus({ preventScroll: true });
    const active = document.querySelector(".nav a.is-active");
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  lastKey = r.full;
}

let rafPending = false;
function rerender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; render(); });
}

// ------------------------------------------------------------------ toast
function toast(text, opts = {}) {
  const box = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = `toast${opts.tone ? " toast-" + opts.tone : ""}`;
  el.setAttribute("role", "status");
  el.textContent = text;
  box.appendChild(el);
  setTimeout(() => { el.classList.add("is-out"); setTimeout(() => el.remove(), 300); }, opts.ms || 3200);
}

// ------------------------------------------------------------------ theme
function setTheme(mode) {
  lsSet("hb27:theme", mode);
  applyTheme();
}
function applyTheme() {
  const mode = lsGet("hb27:theme", "auto");
  const root = document.documentElement;
  if (mode === "light" || mode === "dark") root.setAttribute("data-theme", mode);
  else root.removeAttribute("data-theme");
}

// ------------------------------------------------------------------ dialogs
function openImport() {
  const dlg = document.getElementById("dlg-import");
  const form = dlg.querySelector("form");
  form.reset();
  dlg.querySelector(".dlg-msg").textContent = "";
  dlg.showModal();
}

function setupImport() {
  const dlg = document.getElementById("dlg-import");
  const form = dlg.querySelector("form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = form.file.files[0];
    const pasted = form.pasted.value.trim();
    const msg = dlg.querySelector(".dlg-msg");
    let text = pasted;
    if (file) text = await file.text();
    if (!text) { msg.textContent = "Chọn file .json hoặc dán nội dung vào ô."; return; }
    const r = importJSON(text, form.mode.value);
    if (!r.ok) { msg.textContent = r.message; return; }
    dlg.close();
    toast(r.message);
    if (r.syncHint && !getConfig().repo) {
      setConfig({ owner: r.syncHint.owner || "", repo: r.syncHint.repo || "", branch: r.syncHint.branch || "main", path: r.syncHint.path || "data.json" });
      setTimeout(() => toast("Đã điền sẵn repo đồng bộ. Chỉ cần dán token ở trang Cài đặt."), 600);
    }
  });
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
}

function openCustom(item) {
  const dlg = document.getElementById("dlg-custom");
  const f = dlg.querySelector("form");
  f.reset();
  f.cid.value = item ? item.id : "";
  dlg.querySelector("h2").textContent = item ? "Sửa học bổng tự thêm" : "Thêm học bổng";
  if (item) {
    const e = item.english || {};
    const set = (n, v) => { if (f[n]) f[n].value = v == null ? "" : v; };
    set("sname", item.name); set("country", item.country); set("region", item.region); set("type", item.type); set("fund", item.fund);
    set("deadline", item.deadline); set("intake", item.intake); set("src", item.src); set("amount", item.amount);
    set("eo", e.o); set("eb", e.b); f.emoi.checked = !!e.moi; f.eopt.checked = !!e.opt; set("etext", e.text);
    const r = item.cost && item.cost.range;
    set("cmin", r ? r[0] : ""); set("cmax", r ? r[1] : ""); set("match", item.match); set("spring", item.spring); set("cond", item.cond); set("note", item.note);
  }
  dlg.querySelector(".dlg-msg").textContent = "";
  dlg.showModal();
}

function setupCustom() {
  const dlg = document.getElementById("dlg-custom");
  const f = dlg.querySelector("form");
  f.region.innerHTML = Object.entries(REGION_LABEL).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  f.fund.innerHTML = Object.entries(FUND_LABEL).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  f.match.innerHTML = Object.entries(MATCH_LABEL).map(([k, v]) => `<option value="${k}"${k === "tb" ? " selected" : ""}>${esc(v)}</option>`).join("");
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const num = (v) => (v === "" || v == null ? null : Number(v));
    const name = f.sname.value.trim();
    if (!name) { dlg.querySelector(".dlg-msg").textContent = "Cần nhập tên học bổng."; return; }
    const cmin = num(f.cmin.value), cmax = num(f.cmax.value);
    const data = {
      id: f.cid.value || undefined,
      name,
      country: f.country.value.trim() || "Chưa rõ",
      region: f.region.value,
      type: f.type.value,
      fund: f.fund.value,
      deadline: f.deadline.value,
      intake: f.intake.value.trim(),
      src: f.src.value.trim(),
      amount: f.amount.value.trim(),
      english: { o: num(f.eo.value), b: num(f.eb.value), moi: f.emoi.checked, opt: f.eopt.checked, text: f.etext.value.trim() },
      cost: { range: cmin != null || cmax != null ? [cmin ?? cmax, cmax ?? cmin] : null, note: "Bạn tự ước tính" },
      match: f.match.value,
      spring: f.spring.value,
      cond: f.cond.value.trim(),
      note: f.note.value.trim(),
      dtext: f.deadline.value ? "" : "Chưa có ngày",
    };
    if (!data.id) delete data.id;
    const id = saveCustom(data);
    dlg.close();
    toast(data.id ? "Đã lưu thay đổi" : "Đã thêm học bổng");
    location.hash = `#/s/${encodeURIComponent(id)}`;
  });
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
}

// ------------------------------------------------------------------ sync indicator
function setupSyncIndicator() {
  const btn = document.getElementById("sync-btn");
  const label = btn.querySelector(".sync-label");
  onSyncState((s) => {
    btn.dataset.state = s.configured ? s.status : "off";
    const text = !s.configured ? "Chưa đồng bộ" : s.status === "busy" ? "Đang đồng bộ" : s.status === "error" ? "Lỗi đồng bộ" : "Đã đồng bộ";
    label.textContent = text;
    btn.title = s.configured ? `${s.message || text}${s.at ? `\nLần gần nhất: ${new Date(s.at).toLocaleString("vi-VN")}` : ""}` : "Kết nối GitHub ở trang Cài đặt để lưu dữ liệu sang máy khác";
  });
  btn.addEventListener("click", async () => {
    if (!isConfigured()) { location.hash = "#/cai-dat"; return; }
    const r = await syncNow();
    toast(r.message, { tone: r.ok ? "" : "crit" });
  });
}

export const app = { toast, rerender, openImport, openCustom, setTheme };

async function start() {
  applyTheme();
  loadUser();
  initTooltips(document);
  setupImport();
  setupCustom();
  setupSyncIndicator();
  try {
    await loadCatalog();
  } catch (e) {
    main.innerHTML = `<div class="empty"><p class="empty-title">Không tải được danh mục học bổng</p><p class="muted">${esc(e.message)}</p><p><button class="btn" onclick="location.reload()">Tải lại trang</button></p></div>`;
    return;
  }
  subscribe((info) => {
    if (info.reason !== "sync") scheduleSync();
    if (!info.silent) rerender();
  });
  window.addEventListener("hashchange", () => render());
  let lastW = window.innerWidth;
  window.addEventListener("resize", debounce(() => {
    if (Math.abs(window.innerWidth - lastW) < 40) return;
    lastW = window.innerWidth;
    if (current && current.resize) current.resize(); else rerender();
  }, 200));
  render({ initial: true });
  if (isConfigured()) syncNow();
}

start();
