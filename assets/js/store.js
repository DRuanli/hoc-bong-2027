// App state: the public catalog (read-only JSON) and the private user data (browser + GitHub sync).
import { lsGet, lsSet, nowStamp, uid, todayISO } from "./util.js";
import { buildChecklist, docType } from "./docs.js";

const KEY = "hb27:data";
const UI_KEY = "hb27:ui";
export const SCHEMA = 1;

export const STATUS = {
  consider: { label: "Đang cân nhắc", short: "Cân nhắc", order: 0, tone: "idle" },
  prep: { label: "Đang chuẩn bị", short: "Chuẩn bị", order: 1, tone: "s1" },
  submitted: { label: "Đã nộp", short: "Đã nộp", order: 2, tone: "s2" },
  interview: { label: "Phỏng vấn / thi", short: "Phỏng vấn", order: 3, tone: "s3" },
  offer: { label: "Đỗ", short: "Đỗ", order: 4, tone: "ok", final: true },
  waitlist: { label: "Danh sách chờ", short: "Chờ", order: 5, tone: "warn", final: true },
  rejected: { label: "Trượt", short: "Trượt", order: 6, tone: "crit", final: true },
  dropped: { label: "Bỏ qua", short: "Bỏ qua", order: 7, tone: "idle", final: true },
};
export const ACTIVE_STATUSES = ["consider", "prep", "submitted", "interview"];

export const PRIORITY = { cao: "Cao", tb: "Trung bình", thap: "Thấp" };

export const DEFAULT_WEIGHTS = { english: 20, cost: 20, match: 20, value: 15, timing: 15, comp: 10 };

export function defaultUser() {
  return {
    schema: SCHEMA,
    updatedAt: "",
    profile: {
      updatedAt: "",
      name: "",
      ielts: { L: null, R: null, W: null, S: null, overall: null, date: "" },
      moi: false,
      gpa10: null,
      gpaMin: 5,
      budgetMin: null,
      budgetMax: null,
      age: null,
      apsDate: "",
      preferSpring: false,
      regions: [],
    },
    settings: { updatedAt: "", weights: { ...DEFAULT_WEIGHTS }, daysPerTask: 2, rates: null },
    progress: {},
    docs: {},
    custom: [],
    log: [],
  };
}

export const store = {
  catalog: [],
  excluded: [],
  finance: [],
  meta: {},
  user: defaultUser(),
  ui: lsGet(UI_KEY, {}) || {},
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(info) { for (const fn of listeners) { try { fn(info); } catch (e) { console.error(e); } } }

export async function loadCatalog(base = "") {
  const names = ["scholarships", "excluded", "finance", "meta"];
  const res = await Promise.all(names.map(async (n) => {
    const r = await fetch(`${base}data/${n}.json`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`Không tải được data/${n}.json (HTTP ${r.status})`);
    return r.json();
  }));
  [store.catalog, store.excluded, store.finance, store.meta] = res;
}

/** Fill missing fields so older or partial files keep working. */
export function migrate(raw) {
  if (!raw || typeof raw !== "object") return null;
  const base = defaultUser();
  const out = { ...base, ...raw };
  out.schema = SCHEMA;
  out.profile = { ...base.profile, ...(raw.profile || {}) };
  out.profile.ielts = { ...base.profile.ielts, ...((raw.profile && raw.profile.ielts) || {}) };
  out.settings = { ...base.settings, ...(raw.settings || {}) };
  out.settings.weights = { ...DEFAULT_WEIGHTS, ...((raw.settings && raw.settings.weights) || {}) };
  out.progress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  out.docs = raw.docs && typeof raw.docs === "object" ? raw.docs : {};
  out.custom = Array.isArray(raw.custom) ? raw.custom : [];
  out.log = Array.isArray(raw.log) ? raw.log : [];
  for (const id of Object.keys(out.progress)) {
    const p = out.progress[id];
    p.checklist = Array.isArray(p.checklist) ? p.checklist : [];
    p.dates = p.dates || {};
    p.fee = p.fee || { paid: false };
    p.contacts = Array.isArray(p.contacts) ? p.contacts : [];
    p.override = p.override || {};
    if (!STATUS[p.status]) p.status = "consider";
  }
  delete out.syncHint;
  delete out.exportedAt;
  return out;
}

export function loadUser() {
  store.user = migrate(lsGet(KEY, null)) || defaultUser();
}

function persist() {
  store.user.updatedAt = nowStamp();
  lsSet(KEY, store.user);
}

/**
 * Change user data. `mutator(user)` edits in place.
 * opts.silent: save and sync without re-rendering (typing in a text box).
 */
export function update(mutator, opts = {}) {
  mutator(store.user);
  persist();
  emit({ silent: !!opts.silent, reason: opts.reason || "" });
}

/** Replace all user data (import or first sync). */
export function replaceUser(next, opts = {}) {
  store.user = migrate(next) || defaultUser();
  persist();
  emit({ silent: false, reason: opts.reason || "replace" });
}

export function setUI(key, value) {
  store.ui[key] = value;
  lsSet(UI_KEY, store.ui);
}

export function touch(obj) { obj.updatedAt = nowStamp(); return obj; }

export function addLog(user, id, text) {
  user.log.unshift({ at: nowStamp(), id, text });
  if (user.log.length > 400) user.log.length = 400;
}

// ------------------------------------------------------------------ catalog access
export function allItems() {
  const custom = store.user.custom.filter((c) => !c.deleted);
  return store.catalog.concat(custom);
}
export function getItem(id) {
  return store.catalog.find((x) => x.id === id) || store.user.custom.find((x) => x.id === id && !x.deleted) || null;
}
export function getProgress(id) { return store.user.progress[id] || null; }
export function isTracked(id) { const p = store.user.progress[id]; return !!(p && p.tracked); }
export function trackedItems() {
  return allItems().filter((it) => isTracked(it.id));
}

export function newProgress(item) {
  return {
    updatedAt: nowStamp(),
    tracked: true,
    status: "consider",
    priority: "tb",
    checklist: buildChecklist(item),
    dates: {},
    fee: { paid: false },
    notes: "",
    contacts: [],
    override: {},
  };
}

/** Inside a mutator: get or create progress for an item. */
export function ensureProgress(user, id) {
  if (!user.progress[id]) {
    const item = getItem(id);
    if (!item) return null;
    user.progress[id] = newProgress(item);
  }
  return user.progress[id];
}

// ------------------------------------------------------------------ actions
export function toggleTrack(id) {
  const item = getItem(id);
  if (!item) return;
  update((u) => {
    const existed = !!u.progress[id];
    const p = ensureProgress(u, id);
    p.tracked = existed ? !p.tracked : true;
    touch(p);
    addLog(u, id, p.tracked ? "Bắt đầu theo dõi" : "Ngừng theo dõi");
  }, { reason: "track" });
}

export function setStatus(id, status) {
  if (!STATUS[status]) return;
  update((u) => {
    const p = ensureProgress(u, id);
    if (!p) return;
    const prev = p.status;
    p.status = status;
    p.tracked = true;
    if (status === "submitted" && !p.dates.submitted) p.dates.submitted = todayISO();
    if ((status === "offer" || status === "rejected" || status === "waitlist") && !p.dates.result) p.dates.result = todayISO();
    touch(p);
    if (prev !== status) addLog(u, id, `Trạng thái: ${STATUS[prev] ? STATUS[prev].label : prev} → ${STATUS[status].label}`);
  }, { reason: "status" });
}

export function setDocStatus(key, status) {
  update((u) => {
    const d = u.docs[key] || { status: "chua", expiry: "", link: "", note: "" };
    const prev = d.status;
    d.status = status;
    u.docs[key] = touch(d);
    if (prev !== status) addLog(u, "", `${docType(key).label}: ${status === "xong" ? "đã xong" : status === "dang-lam" ? "đang làm" : status === "cap-nhat" ? "cần cập nhật" : "chưa có"}`);
  }, { reason: "doc" });
}

/** Check or uncheck a checklist entry; shared documents update the library. */
export function toggleCheck(id, index) {
  let movedToSubmitted = false;
  update((u) => {
    const p = ensureProgress(u, id);
    if (!p) return;
    const e = p.checklist[index];
    if (!e) return;
    if (e.global) {
      const d = u.docs[e.key] || { status: "chua", expiry: "", link: "", note: "" };
      d.status = d.status === "xong" ? "chua" : "xong";
      u.docs[e.key] = touch(d);
      addLog(u, id, `${e.label}: ${d.status === "xong" ? "đã xong (dùng chung)" : "bỏ đánh dấu (dùng chung)"}`);
    } else {
      e.done = !e.done;
      addLog(u, id, `${e.label}: ${e.done ? "đã xong" : "bỏ đánh dấu"}`);
      if (e.key === "submit" && e.done && (p.status === "consider" || p.status === "prep")) {
        p.status = "submitted";
        if (!p.dates.submitted) p.dates.submitted = todayISO();
        movedToSubmitted = true;
        addLog(u, id, "Trạng thái: → Đã nộp");
      }
    }
    if (p.status === "consider" && !movedToSubmitted && p.checklist.some((c) => !c.global && c.done)) p.status = "prep";
    touch(p);
  }, { reason: "check" });
  return movedToSubmitted;
}

// ------------------------------------------------------------------ merge, import, export
const stamp = (o) => (o && o.updatedAt) || "";
const newer = (a, b) => (stamp(a) >= stamp(b) ? a : b);

function mergeMap(a = {}, b = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(k in a)) out[k] = b[k];
    else if (!(k in b)) out[k] = a[k];
    else out[k] = newer(a[k], b[k]);
  }
  return out;
}

/** Merge two user documents record by record: the newer record wins. */
export function mergeUser(a, b) {
  const A = migrate(a) || defaultUser();
  const B = migrate(b) || defaultUser();
  const customs = new Map();
  for (const c of A.custom.concat(B.custom)) {
    const cur = customs.get(c.id);
    customs.set(c.id, cur ? newer(cur, c) : c);
  }
  const seen = new Set();
  const log = [];
  for (const e of A.log.concat(B.log)) {
    const k = `${e.at}|${e.id}|${e.text}`;
    if (seen.has(k)) continue;
    seen.add(k);
    log.push(e);
  }
  log.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
  return {
    schema: SCHEMA,
    updatedAt: stamp(A) >= stamp(B) ? stamp(A) : stamp(B),
    profile: newer(A.profile, B.profile),
    settings: newer(A.settings, B.settings),
    progress: mergeMap(A.progress, B.progress),
    docs: mergeMap(A.docs, B.docs),
    custom: [...customs.values()],
    log: log.slice(0, 400),
  };
}

export function exportJSON() {
  return JSON.stringify({ ...store.user, exportedAt: nowStamp() }, null, 1);
}

/** Returns { ok, message, syncHint } */
export function importJSON(text, mode = "merge") {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return { ok: false, message: "File không phải JSON hợp lệ." }; }
  if (!obj || typeof obj !== "object" || (!obj.profile && !obj.progress)) {
    return { ok: false, message: "File không có dữ liệu hồ sơ hoặc tiến độ của app này." };
  }
  const hint = obj.syncHint || null;
  const next = mode === "replace" ? migrate(obj) : mergeUser(store.user, obj);
  replaceUser(next, { reason: "import" });
  const n = Object.values(store.user.progress).filter((p) => p.tracked).length;
  return { ok: true, message: `Đã nhập dữ liệu: ${n} học bổng đang theo dõi.`, syncHint: hint };
}

export function resetUser() {
  replaceUser(defaultUser(), { reason: "reset" });
}

// ------------------------------------------------------------------ custom scholarships
export function saveCustom(data) {
  let id = data.id;
  update((u) => {
    const now = nowStamp();
    const base = {
      level: "Thạc sĩ",
      region: "chau-au",
      type: "Học bổng trường",
      fund: "toan",
      spring: "thu",
      amount: "",
      dtext: "",
      intake: "",
      cond: "",
      note: "",
      english: { o: null, b: null, moi: false, opt: false, text: "" },
      cost: { range: null, note: "" },
      match: "tb",
      ver: "tu",
      src: "",
      docs: { keys: ["form", "cv", "motivation", "lor1", "lor2", "transcript", "degree", "ielts", "passport", "submit"], labels: {} },
      custom: true,
    };
    if (id) {
      const i = u.custom.findIndex((c) => c.id === id);
      if (i >= 0) u.custom[i] = { ...u.custom[i], ...data, updatedAt: now };
    } else {
      id = uid("c");
      u.custom.push({ ...base, ...data, id, updatedAt: now });
    }
    const it = u.custom.find((c) => c.id === id);
    it.events = it.deadline ? [{ date: it.deadline, label: "Hạn nộp", kind: "close" }] : [];
    addLog(u, id, data.id ? "Sửa học bổng tự thêm" : "Thêm học bổng mới");
  }, { reason: "custom" });
  return id;
}

export function deleteCustom(id) {
  update((u) => {
    const c = u.custom.find((x) => x.id === id);
    if (c) { c.deleted = true; c.updatedAt = nowStamp(); }
    if (u.progress[id]) { u.progress[id].tracked = false; touch(u.progress[id]); }
    addLog(u, id, "Xóa học bổng tự thêm");
  }, { reason: "custom" });
}
