// Small shared helpers: escaping, dates, money, text.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Attribute-safe URL: only http(s) links are allowed; anything else becomes "#". */
export function safeUrl(url) {
  const s = String(url || "").trim();
  return /^https?:\/\//i.test(s) ? s : "#";
}

export const DAY = 86400000;

/** "Today" can be pinned with ?today=YYYY-MM-DD (useful for testing). */
let pinnedToday = null;
try {
  const q = new URLSearchParams(location.search).get("today");
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) pinnedToday = q;
} catch (e) { /* no location in tests */ }

export function now() {
  if (pinnedToday) {
    const [y, m, d] = pinnedToday.split("-").map(Number);
    const real = new Date();
    return new Date(y, m - 1, d, real.getHours(), real.getMinutes(), real.getSeconds());
  }
  return new Date();
}

export function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function todayISO() { return isoDate(now()); }

export function parseISO(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from now until the end of the given day (negative once the day is over). */
export function daysUntil(iso, ref = now()) {
  const d = parseISO(iso);
  if (!d) return null;
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  const diff = end.getTime() - ref.getTime();
  if (diff < 0) return -1 - Math.floor(-diff / DAY);
  return Math.floor(diff / DAY);
}

export function fmtDate(iso, opts = {}) {
  const d = parseISO(iso);
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return opts.short ? `${dd}/${mm}` : `${dd}/${mm}/${d.getFullYear()}`;
}

const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
export function fmtLongDate(iso) {
  const d = parseISO(iso);
  if (!d) return "";
  return `${WEEKDAYS[d.getDay()]}, ${fmtDate(iso)}`;
}

export function countdownLabel(days) {
  if (days == null) return "Chưa có ngày";
  if (days < 0) return "Đã qua";
  if (days === 0) return "Hôm nay";
  if (days === 1) return "Còn 1 ngày";
  return `Còn ${days} ngày`;
}

/** urgent ≤ 14 days, soon ≤ 45, later beyond; past and none for the rest. */
export function urgency(days) {
  if (days == null) return "none";
  if (days < 0) return "past";
  if (days <= 14) return "urgent";
  if (days <= 45) return "soon";
  return "later";
}

export function addMonths(iso, months) {
  const d = parseISO(iso);
  if (!d) return null;
  return isoDate(new Date(d.getFullYear(), d.getMonth() + months, d.getDate()));
}
export function addYears(iso, years) { return addMonths(iso, years * 12); }

export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
export function round(v, step = 1) { return Math.round(v / step) * step; }

export function debounce(fn, ms) {
  let t = null;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

export function uid(prefix = "x") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Lower-case, strip Vietnamese diacritics, for accent-insensitive search. */
export function normalize(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
}

export function nowStamp() { return new Date().toISOString(); }

const NF = new Intl.NumberFormat("en-US");
export function fmtNum(n) { return n == null || isNaN(n) ? "–" : NF.format(Math.round(n)); }
export function fmtEUR(n) { return n == null || isNaN(n) ? "–" : `€${NF.format(Math.round(n))}`; }
export function fmtRange(r) {
  if (!r) return "Chưa rõ";
  const [a, b] = r;
  if (a === b) return fmtEUR(a);
  return `${fmtEUR(a)}–${NF.format(Math.round(b))}`;
}

export function toEUR(amount, currency, rates) {
  if (amount == null) return null;
  const r = rates && rates[currency];
  return r == null ? null : amount * r;
}

export function fmtMoney(amount, currency) {
  if (amount == null) return "–";
  const sym = { EUR: "€", USD: "US$", CHF: "CHF ", SEK: "SEK ", JPY: "¥", KRW: "KRW ", CAD: "CAD ", HKD: "HKD ", TWD: "NT$", THB: "THB ", GBP: "£" }[currency] || `${currency} `;
  return `${sym}${NF.format(amount)}`;
}

/** IELTS overall: mean of four bands rounded to the nearest half band (.25 up, .75 up). */
export function ieltsOverall(b) {
  const vals = [b.L, b.R, b.W, b.S].map(Number);
  if (vals.some((v) => !isFinite(v) || v <= 0)) return null;
  const mean = vals.reduce((s, v) => s + v, 0) / 4;
  const whole = Math.floor(mean);
  const frac = mean - whole;
  if (frac < 0.25) return whole;
  if (frac < 0.75) return whole + 0.5;
  return whole + 1;
}

/** Modified Bavarian formula used by German universities. */
export function germanGrade(gpa, max = 10, minPass = 5) {
  const g = Number(gpa);
  if (!isFinite(g) || max <= minPass) return null;
  const v = 1 + 3 * (max - g) / (max - minPass);
  return clamp(v, 1, 4);
}

export function pluralItems(n, word) { return `${n} ${word}`; }

export function sum(arr, fn = (x) => x) { return arr.reduce((s, x) => s + (fn(x) || 0), 0); }

export function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) {
    const k = fn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

/** Keep focus and caret across a full re-render of a container. */
export function captureFocus() {
  const el = document.activeElement;
  if (!el || !el.id) return null;
  const state = { id: el.id };
  try {
    if (typeof el.selectionStart === "number") {
      state.start = el.selectionStart;
      state.end = el.selectionEnd;
    }
  } catch (e) { /* some inputs have no selection */ }
  return state;
}
export function restoreFocus(state) {
  if (!state) return;
  const el = document.getElementById(state.id);
  if (!el) return;
  el.focus({ preventScroll: true });
  try {
    if (state.start != null && typeof el.setSelectionRange === "function") el.setSelectionRange(state.start, state.end);
  } catch (e) { /* ignore */ }
}

export function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
}
export function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
export function lsDel(key) {
  try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
}

export function downloadFile(name, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
