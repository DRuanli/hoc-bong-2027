// Sync user data to a JSON file in a (private) GitHub repository through the REST Contents API.
// The token never leaves this browser except in requests to api.github.com, and is never exported.
import { store, mergeUser, replaceUser } from "./store.js";
import { lsGet, lsSet, lsDel, debounce } from "./util.js";

const CFG_KEY = "hb27:gh";
const STATE_KEY = "hb27:gh-state";
const API = "https://api.github.com";

export function getConfig() {
  return { owner: "", repo: "", branch: "main", path: "data.json", token: "", auto: true, ...(lsGet(CFG_KEY, {}) || {}) };
}
export function setConfig(cfg) {
  const cur = getConfig();
  lsSet(CFG_KEY, { ...cur, ...cfg });
  notify();
}
export function forgetToken() {
  const cur = getConfig();
  cur.token = "";
  lsSet(CFG_KEY, cur);
  notify();
}
export function clearConfig() { lsDel(CFG_KEY); lsDel(STATE_KEY); notify(); }
export function isConfigured() {
  const c = getConfig();
  return !!(c.owner && c.repo && c.path && c.token);
}

let state = { status: "off", message: "", at: "", ...(lsGet(STATE_KEY, {}) || {}) };
if (state.status === "busy") state.status = "idle";
const listeners = new Set();
export function onSyncState(fn) { listeners.add(fn); fn(getState()); return () => listeners.delete(fn); }
export function getState() {
  return { ...state, configured: isConfigured() };
}
function setState(patch) {
  state = { ...state, ...patch };
  lsSet(STATE_KEY, { status: state.status === "busy" ? "idle" : state.status, message: state.message, at: state.at, sha: state.sha, pushedAt: state.pushedAt });
  notify();
}
function notify() { const s = getState(); for (const fn of listeners) { try { fn(s); } catch (e) { console.error(e); } } }

// ------------------------------------------------------------------ base64 for UTF-8 text
export function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64decode(b64) {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }

function explain(status, body) {
  const msg = body && body.message ? ` (${body.message})` : "";
  if (status === 401) return "Token không hợp lệ hoặc đã hết hạn. Tạo token mới rồi dán lại.";
  if (status === 403) return `GitHub từ chối quyền truy cập. Token cần quyền Contents: Read and write trên repo này${msg}.`;
  if (status === 404) return "Không thấy repo hoặc nhánh. Kiểm tra tên chủ sở hữu, tên repo, nhánh, và token đã được cấp quyền cho repo đó chưa.";
  if (status === 409) return "Dữ liệu trên GitHub vừa đổi ở thiết bị khác. Bấm Đồng bộ ngay để gộp lại.";
  if (status === 422) return `GitHub không nhận nội dung${msg}.`;
  return `Lỗi GitHub HTTP ${status}${msg}.`;
}

async function gh(method, cfg, body) {
  const url = `${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encPath(cfg.path)}` +
    (method === "GET" ? `?ref=${encodeURIComponent(cfg.branch || "main")}` : "");
  let res;
  try {
    res = await fetch(url, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${cfg.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new Error("Không kết nối được tới GitHub. Kiểm tra mạng rồi thử lại.");
    err.status = 0;
    throw err;
  }
  let json = null;
  try { json = await res.json(); } catch (e) { json = null; }
  if (!res.ok) {
    const err = new Error(explain(res.status, json));
    err.status = res.status;
    throw err;
  }
  return json;
}

/** Read the remote file. Returns { data, sha } or { data: null, sha: null } when it does not exist yet. */
export async function readRemote(cfg = getConfig()) {
  try {
    const j = await gh("GET", cfg);
    if (!j || !j.content) return { data: null, sha: j && j.sha };
    return { data: JSON.parse(b64decode(j.content)), sha: j.sha };
  } catch (e) {
    if (e.status === 404) {
      // 404 is either "file missing" (fine) or "repo missing" (not fine): tell them apart.
      const ok = await repoExists(cfg);
      if (ok) return { data: null, sha: null };
    }
    throw e;
  }
}

async function repoExists(cfg) {
  try {
    const res = await fetch(`${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${cfg.token}`, "X-GitHub-Api-Version": "2022-11-28" },
    });
    return res.ok;
  } catch (e) { return false; }
}

async function writeRemote(cfg, data, sha, message) {
  const body = {
    message,
    content: b64encode(JSON.stringify(data, null, 1)),
    branch: cfg.branch || "main",
  };
  if (sha) body.sha = sha;
  const j = await gh("PUT", cfg, body);
  return j && j.content ? j.content.sha : null;
}

function summary() {
  const top = store.user.log[0];
  const tracked = Object.values(store.user.progress).filter((p) => p.tracked).length;
  return top ? `Cập nhật: ${top.text}`.slice(0, 120) : `Cập nhật dữ liệu (${tracked} học bổng theo dõi)`;
}

let running = null;
let dirty = false;

/** Pull, merge, push. Safe to call any time; concurrent calls share one run. */
export async function syncNow(opts = {}) {
  if (!isConfigured()) {
    setState({ status: "off", message: "Chưa kết nối GitHub" });
    return { ok: false, message: "Chưa kết nối GitHub" };
  }
  if (running) { dirty = true; return running; }
  running = (async () => {
    const cfg = getConfig();
    setState({ status: "busy", message: "Đang đồng bộ…" });
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await readRemote(cfg);
        const merged = remote.data ? mergeUser(store.user, remote.data) : store.user;
        const changedLocal = remote.data && JSON.stringify(merged) !== JSON.stringify(store.user);
        if (changedLocal) replaceUser(merged, { reason: "sync" });
        const sameAsRemote = remote.data && JSON.stringify(stripVolatile(merged)) === JSON.stringify(stripVolatile(remote.data));
        if (sameAsRemote && !opts.force) {
          setState({ status: "ok", message: "Đã đồng bộ", at: new Date().toISOString(), sha: remote.sha });
          return { ok: true, message: "Dữ liệu đã khớp với GitHub" };
        }
        try {
          const sha = await writeRemote(cfg, store.user, remote.sha, summary());
          setState({ status: "ok", message: "Đã đồng bộ", at: new Date().toISOString(), sha, pushedAt: new Date().toISOString() });
          return { ok: true, message: remote.data ? "Đã gộp và lưu lên GitHub" : "Đã tạo file dữ liệu trên GitHub" };
        } catch (e) {
          if ((e.status === 409 || e.status === 422) && attempt < 2) continue; // someone else wrote first: merge again
          throw e;
        }
      }
      throw new Error("GitHub đổi liên tục, chưa gộp được. Thử lại sau ít phút.");
    } catch (e) {
      setState({ status: "error", message: e.message || String(e), at: new Date().toISOString() });
      return { ok: false, message: e.message || String(e) };
    } finally {
      running = null;
      if (dirty) { dirty = false; setTimeout(() => syncNow(), 500); }
    }
  })();
  return running;
}

function stripVolatile(u) {
  const c = JSON.parse(JSON.stringify(u));
  delete c.updatedAt;
  delete c.exportedAt;
  delete c.syncHint;
  return c;
}

/** Test the connection without writing anything. */
export async function testConnection(cfg) {
  try {
    const r = await readRemote(cfg);
    return { ok: true, message: r.data ? "Kết nối được. Đã thấy file dữ liệu trên GitHub." : "Kết nối được. File dữ liệu chưa có, lần đồng bộ đầu sẽ tạo file." };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

export const scheduleSync = debounce(() => {
  const c = getConfig();
  if (c.auto && isConfigured()) syncNow();
}, 4000);
