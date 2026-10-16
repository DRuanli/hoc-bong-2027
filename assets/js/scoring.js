// Measuring each scholarship against the private profile: six factors, a weighted priority,
// readiness from the checklist, risk flags, and an English what-if.
import { daysUntil, parseISO, addYears, fmtDate, fmtRange, clamp, todayISO, now } from "./util.js";
import { isDone } from "./docs.js";
import { DEFAULT_WEIGHTS, STATUS } from "./store.js";

export const FACTORS = [
  { key: "english", label: "Tiếng Anh", hint: "So yêu cầu IELTS tổng và từng kỹ năng với điểm của bạn" },
  { key: "cost", label: "Tài chính", hint: "Chi phí tự lo ước tính mỗi năm so với ngân sách" },
  { key: "match", label: "Độ phù hợp", hint: "Mức khớp của chương trình với hướng CS, khoa học dữ liệu, nghiên cứu" },
  { key: "value", label: "Giá trị học bổng", hint: "Toàn phần, một phần, chỉ học phí hay học phí thấp" },
  { key: "timing", label: "Thời gian", hint: "Số ngày còn lại so với số việc chưa xong; tính cả APS" },
  { key: "comp", label: "Mức cạnh tranh", hint: "Tỷ lệ nhận hoặc số suất, càng ít suất điểm càng thấp" },
];

export const FUND_LABEL = { toan: "Toàn phần", mot: "Một phần", hocphi: "Chỉ học phí", mien: "Học phí 0 hoặc thấp" };
export const MATCH_LABEL = { cao: "Cao", tb: "Trung bình", thap: "Thấp" };
export const VER_LABEL = { xm: "Đã xác minh", th: "Nguồn tổng hợp", dk: "Dự kiến", tu: "Tự nhập" };
export const SPRING_LABEL = { xuan: "Kịp xuân 2027", ca: "Kịp xuân 2027", thu: "Thu 2027", sau: "2028 trở đi" };
export const REGION_LABEL = { "chau-au": "Châu Âu", "chau-a": "Châu Á", "trung-dong": "Trung Đông", "bac-my": "Bắc Mỹ", "dai-duong": "Châu Đại Dương", "viet-nam": "Kênh trong nước" };

const BAND_NAME = { L: "Listening", R: "Reading", W: "Writing", S: "Speaking" };

export function hasIelts(profile) {
  const i = profile && profile.ielts;
  return !!(i && [i.L, i.R, i.W, i.S].every((v) => v != null && v !== "" && isFinite(v)));
}
function overallOf(profile) {
  const i = profile.ielts;
  if (i.overall != null && i.overall !== "" && isFinite(i.overall)) return Number(i.overall);
  const vals = [i.L, i.R, i.W, i.S].map(Number);
  const mean = vals.reduce((s, v) => s + v, 0) / 4;
  const whole = Math.floor(mean), f = mean - whole;
  return f < 0.25 ? whole : f < 0.75 ? whole + 0.5 : whole + 1;
}

// ------------------------------------------------------------------ factor checks
export function englishCheck(item, profile) {
  const e = item.english || {};
  if (e.opt) return { state: "optional", score: 100, label: "Không bắt buộc", text: e.text || "Không bắt buộc chứng chỉ tiếng Anh" };
  if (e.moi && profile.moi) return { state: "exempt", score: 100, label: "Được miễn", text: "Dùng giấy xác nhận học bằng tiếng Anh thay chứng chỉ" };
  if (e.o == null && e.b == null) return { state: "unknown", score: 50, label: "Chưa rõ", text: e.text || "Chưa rõ ngưỡng tiếng Anh" };
  if (!hasIelts(profile)) return { state: "unknown", score: 50, label: "Chưa có điểm", text: "Nhập điểm IELTS ở trang Hồ sơ để chấm" };
  const gaps = [];
  const overall = overallOf(profile);
  if (e.o != null && overall < e.o) gaps.push(`tổng ${overall} < ${e.o}`);
  if (e.b != null) {
    for (const k of ["L", "R", "W", "S"]) {
      const v = Number(profile.ielts[k]);
      if (v < e.b) gaps.push(`${BAND_NAME[k]} ${v} < ${e.b}`);
    }
  }
  const req = [e.o != null && e.o > 0 ? `tổng ${e.o}` : null, e.b != null ? `mỗi kỹ năng ≥ ${e.b}` : null].filter(Boolean).join(", ");
  if (!gaps.length) {
    return { state: "pass", score: 100, label: "Đạt", text: req ? `Yêu cầu ${req}` : (e.text || "Đạt") };
  }
  return { state: "fail", score: 0, label: "Chưa đạt", text: `Cần ${gaps.join("; ")}`, gaps };
}

/** Self-paid cost range per year in EUR, using the Austrian age rule where relevant. */
export function costRange(item, profile, progress) {
  const ov = progress && progress.override && progress.override.cost;
  if (ov != null && ov !== "" && isFinite(ov)) return [Number(ov), Number(ov)];
  const c = item.cost || {};
  if (c.rule === "at") {
    const under = 8671, over = 15700;
    const tuition = c.tuition || 0, award = c.award || 0;
    const calc = (living) => Math.max(0, living + tuition - award);
    const age = profile && profile.age != null && profile.age !== "" ? Number(profile.age) : null;
    if (age == null) return [calc(under), calc(over)];
    return age < 24 ? [calc(under), calc(under)] : [calc(over), calc(over)];
  }
  return Array.isArray(c.range) ? c.range : null;
}

export function costCheck(item, profile, progress) {
  const r = costRange(item, profile, progress);
  const note = (item.cost && item.cost.note) || "";
  if (!r) return { state: "unknown", score: 50, label: "Chưa rõ", text: note || "Chưa ước tính được chi phí", range: null };
  const bmin = profile.budgetMin, bmax = profile.budgetMax;
  if (bmin == null || bmax == null || bmin === "" || bmax === "") {
    return { state: "unknown", score: 50, label: "Chưa có ngân sách", text: `Tự lo khoảng ${fmtRange(r)}/năm. Nhập ngân sách ở trang Hồ sơ`, range: r };
  }
  const [lo, hi] = r;
  let state, score, label;
  if (hi <= bmin) { state = "ok"; score = 100; label = "Đủ"; }
  else if (hi <= bmax) { state = "ok"; score = 85; label = "Đủ"; }
  else if (lo <= bmax * 1.1) { state = "tight"; score = 55; label = "Sát ngân sách"; }
  else if (lo <= bmax * 1.25) { state = "short"; score = 30; label = "Thiếu"; }
  else { state = "short"; score = 10; label = "Thiếu"; }
  const parts = [`Tự lo khoảng ${fmtRange(r)}/năm so với ngân sách ${fmtRange([Number(bmin), Number(bmax)])}`];
  if (note) parts.push(note);
  if (item.cost && item.cost.rule === "at" && (profile.age == null || profile.age === "")) parts.push("Nhập tuổi ở trang Hồ sơ để tính đúng mức của Áo");
  return { state, score, label, text: (parts.join(". ") + ".").replace(/\.{2,}/g, "."), range: r };
}

export function matchCheck(item, progress) {
  const m = (progress && progress.override && progress.override.match) || item.match || "tb";
  const score = { cao: 90, tb: 60, thap: 30 }[m] || 60;
  const own = progress && progress.override && progress.override.match;
  return { state: m, score, label: MATCH_LABEL[m] || m, text: own ? "Theo đánh giá của bạn" : "Theo đánh giá ban đầu của danh mục" };
}

export function valueCheck(item) {
  const score = { toan: 100, mot: 60, hocphi: 50, mien: 40 }[item.fund] ?? 50;
  return { state: item.fund, score, label: FUND_LABEL[item.fund] || item.fund, text: item.amount || "" };
}

export function compCheck(item) {
  const c = item.comp;
  if (!c) return { state: "unknown", score: 50, label: "Chưa rõ", text: "Chưa có số liệu tỷ lệ nhận hay số suất" };
  let score;
  if (c.rate != null) score = c.rate <= 0.03 ? 15 : c.rate <= 0.06 ? 25 : c.rate <= 0.1 ? 35 : c.rate <= 0.25 ? 55 : 75;
  else if (c.awards != null) score = c.awards <= 5 ? 25 : c.awards <= 20 ? 40 : c.awards <= 60 ? 50 : 60;
  else score = 50;
  const label = score <= 25 ? "Rất cao" : score <= 40 ? "Cao" : score <= 55 ? "Vừa" : "Thấp hơn";
  return { state: "known", score, label, text: c.text || "" };
}

/** Upcoming and past events, sorted. */
export function eventsOf(item, progress) {
  const evs = (item.events || []).map((e) => ({ ...e, own: false }));
  const d = (progress && progress.dates) || {};
  if (d.submitted) evs.push({ date: d.submitted, label: "Bạn đã nộp", kind: "own", own: true });
  if (d.interview) evs.push({ date: d.interview, label: "Lịch phỏng vấn của bạn", kind: "interview", own: true });
  if (d.result) evs.push({ date: d.result, label: "Ngày có kết quả", kind: "result", own: true });
  for (const c of (progress && progress.checklist) || []) {
    if (c.due) evs.push({ date: c.due, label: `Hạn riêng: ${c.label}`, kind: "task", own: true });
  }
  return evs.filter((e) => parseISO(e.date)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** The next closing date that is still feasible given the APS date (if the item needs APS). */
export function nextClose(item, profile, ref = now()) {
  const closes = (item.events || []).filter((e) => e.kind === "close" && parseISO(e.date));
  const future = closes.filter((e) => daysUntil(e.date, ref) >= 0);
  if (!closes.length && item.deadline) {
    const d = daysUntil(item.deadline, ref);
    return d >= 0 ? { date: item.deadline, label: "Hạn nộp", days: d } : { date: item.deadline, label: "Hạn nộp", days: d, past: true };
  }
  if (!future.length) {
    const last = closes[closes.length - 1];
    return last ? { ...last, days: daysUntil(last.date, ref), past: true } : null;
  }
  const first = future[0];
  const apsDate = profile && profile.apsDate;
  if (item.aps === "required" && apsDate) {
    const feasible = future.find((e) => apsDate <= e.date);
    if (feasible && feasible !== first) {
      return { ...feasible, days: daysUntil(feasible.date, ref), skipped: first };
    }
    if (!feasible) return { ...first, days: daysUntil(first.date, ref), apsLate: true };
  }
  return { ...first, days: daysUntil(first.date, ref) };
}

export function readiness(progress, docsLib) {
  if (!progress || !progress.checklist || !progress.checklist.length) return { done: 0, total: 0, pct: 0, left: [] };
  const left = [];
  let done = 0;
  progress.checklist.forEach((c, i) => {
    if (isDone(c, docsLib)) done++;
    else left.push({ ...c, index: i });
  });
  const total = progress.checklist.length;
  return { done, total, pct: Math.round((done / total) * 100), left };
}

export function timingCheck(item, progress, profile, settings, docsLib, ref = now()) {
  const nc = nextClose(item, profile, ref);
  if (!nc) return { state: "unknown", score: 50, label: "Chưa có ngày", text: item.dtext || "Chưa có ngày cụ thể", next: null };
  if (nc.past) return { state: "closed", score: 0, label: "Đã qua hạn", text: `Hạn cuối ${fmtDate(nc.date)} đã qua. ${item.dtext || ""}`.trim(), next: nc };
  const r = progress && progress.checklist && progress.checklist.length ? readiness(progress, docsLib) : null;
  const leftCount = r ? r.left.length : ((item.docs && item.docs.keys && item.docs.keys.length) || 8);
  const perTask = (settings && settings.daysPerTask) || 2;
  const need = Math.max(7, leftCount * perTask);
  let score = Math.round(clamp(nc.days / need, 0, 1) * 100);
  const parts = [`Còn ${nc.days} ngày tới ${fmtDate(nc.date)}`, r ? `còn ${leftCount} việc, cần khoảng ${need} ngày` : `khoảng ${leftCount} việc khi bắt đầu`];
  let state = score >= 60 ? "ok" : "risk";
  let label = state === "ok" ? "Kịp" : "Gấp";
  if (nc.apsLate) {
    score = Math.min(score, 15);
    state = "aps";
    label = "Chưa kịp APS";
    parts.push(`cần APS trước ${fmtDate(nc.date)}, APS dự kiến ${fmtDate(profile.apsDate)}`);
  } else if (nc.skipped) {
    parts.push(`đợt ${fmtDate(nc.skipped.date)} không kịp APS nên tính đợt sau`);
  }
  if (profile && profile.preferSpring && (item.spring === "xuan" || item.spring === "ca") && !nc.skipped && !nc.apsLate) {
    score = Math.min(100, score + 10);
    parts.push("kịp kỳ xuân 2027");
  }
  return { state, score, label, text: parts.join("; "), next: nc };
}

// ------------------------------------------------------------------ priority
export function scoreItem(item, ctx) {
  const { profile, settings, docs, ref } = ctx;
  const progress = ctx.progress !== undefined ? ctx.progress : null;
  const w = { ...DEFAULT_WEIGHTS, ...((settings && settings.weights) || {}) };
  const f = {
    english: englishCheck(item, profile),
    cost: costCheck(item, profile, progress),
    match: matchCheck(item, progress),
    value: valueCheck(item),
    timing: timingCheck(item, progress, profile, settings, docs, ref),
    comp: compCheck(item),
  };
  let num = 0, den = 0;
  for (const k of Object.keys(f)) { num += (w[k] || 0) * f[k].score; den += (w[k] || 0); }
  let priority = den ? Math.round(num / den) : 0;
  const gates = [];
  if (f.english.state === "fail") { priority = Math.min(priority, 35); gates.push({ key: "english", text: f.english.text }); }
  if (f.timing.state === "aps") gates.push({ key: "aps", text: "APS chưa kịp trước hạn" });
  if (f.timing.state === "closed") gates.push({ key: "closed", text: "Đã qua hạn" });
  if (f.cost.state === "short") gates.push({ key: "cost", text: "Vượt ngân sách" });
  const ready = progress ? readiness(progress, docs) : null;
  return { item, progress, factors: f, priority, gates, ready, next: f.timing.next, closed: f.timing.state === "closed" };
}

export function scoreAll(items, ctx) {
  const out = new Map();
  for (const it of items) {
    out.set(it.id, scoreItem(it, { ...ctx, progress: ctx.user.progress[it.id] || null }));
  }
  return out;
}

// ------------------------------------------------------------------ risks
export function risksFor(s, ctx) {
  const { profile, docs } = ctx;
  const out = [];
  const p = s.progress;
  if (!p || !p.tracked || (STATUS[p.status] && STATUS[p.status].final)) return out;
  const name = s.item.name;
  const before = p.status === "consider" || p.status === "prep";
  const next = s.next;
  if (before && next && !next.past && s.ready) {
    if (next.days <= 14 && s.ready.pct < 70) out.push({ level: "crit", id: s.item.id, name, text: `Còn ${next.days} ngày, mới xong ${s.ready.pct}% hồ sơ` });
    else if (next.days <= 30 && s.ready.pct < 40) out.push({ level: "warn", id: s.item.id, name, text: `Còn ${next.days} ngày, mới xong ${s.ready.pct}% hồ sơ` });
  }
  if (before && s.factors.english.state === "fail") out.push({ level: "crit", id: s.item.id, name, text: `Tiếng Anh chưa đạt: ${s.factors.english.text.replace(/^Cần /, "cần ")}` });
  if (before && s.factors.timing.state === "aps") out.push({ level: "crit", id: s.item.id, name, text: `Cần APS trước ${fmtDate(next.date)}, APS dự kiến ${fmtDate(profile.apsDate)}` });
  if (before && s.factors.cost.state === "short") out.push({ level: "warn", id: s.item.id, name, text: `Tự lo khoảng ${fmtRange(s.factors.cost.range)}/năm, vượt ngân sách` });
  if (before && s.factors.english.state === "unknown" && hasIelts(profile)) out.push({ level: "info", id: s.item.id, name, text: "Chưa rõ ngưỡng tiếng Anh, cần hỏi trường" });
  const needsCert = s.factors.english.state === "pass" || s.factors.english.state === "fail";
  if (before && needsCert && profile.ielts && profile.ielts.date && next && !next.past) {
    const exp = addYears(profile.ielts.date, 2);
    if (exp && exp < next.date) out.push({ level: "warn", id: s.item.id, name, text: `IELTS hết hạn ${fmtDate(exp)}, trước hạn nộp ${fmtDate(next.date)}` });
  }
  if (before && s.item.ver === "dk") out.push({ level: "info", id: s.item.id, name, text: "Lịch suy từ đợt trước, kiểm tra lại trang chính thức" });
  if (p.status === "submitted" && p.dates && !p.dates.submitted) out.push({ level: "info", id: s.item.id, name, text: "Chưa ghi ngày nộp" });
  return out;
}

export function globalRisks(ctx) {
  const out = [];
  const pass = ctx.docs.passport;
  if (pass && pass.expiry) {
    const limit = addYears(todayISO(), 2);
    if (pass.expiry < limit) out.push({ level: "warn", id: "", name: "Hộ chiếu", text: `Hết hạn ${fmtDate(pass.expiry)}, nên gia hạn trước khi xin visa` });
  }
  const ie = ctx.profile.ielts;
  if (ie && ie.date) {
    const exp = addYears(ie.date, 2);
    const d = daysUntil(exp);
    if (d != null && d < 180) out.push({ level: d < 60 ? "crit" : "warn", id: "", name: "IELTS", text: `Chứng chỉ hết hạn ${fmtDate(exp)} (còn ${Math.max(0, d)} ngày)` });
  }
  return out;
}

// ------------------------------------------------------------------ what-if
export function whatIf(items, profile) {
  const variants = [
    { key: "now", label: "Điểm hiện tại", apply: (i) => i },
    { key: "s65", label: "Speaking lên 6.5", apply: (i) => ({ ...i, S: Math.max(Number(i.S) || 0, 6.5) }) },
    { key: "all65", label: "Mọi kỹ năng ≥ 6.5", apply: (i) => ({ ...i, L: Math.max(i.L, 6.5), R: Math.max(i.R, 6.5), W: Math.max(i.W, 6.5), S: Math.max(i.S, 6.5) }) },
    { key: "o75", label: "Tổng 7.5, mỗi kỹ năng ≥ 7.0", apply: (i) => ({ ...i, L: Math.max(i.L, 7), R: Math.max(i.R, 7), W: Math.max(i.W, 7), S: Math.max(i.S, 7), overall: Math.max(Number(i.overall) || 0, 7.5) }) },
  ];
  if (!hasIelts(profile)) return null;
  const open = items.filter((it) => {
    const nc = nextClose(it, profile);
    return !(nc && nc.past);
  });
  const base = new Set(open.filter((it) => englishCheck(it, profile).state !== "fail").map((it) => it.id));
  return variants.map((v) => {
    const ielts = v.apply({ ...profile.ielts, L: Number(profile.ielts.L), R: Number(profile.ielts.R), W: Number(profile.ielts.W), S: Number(profile.ielts.S) });
    if (v.key !== "now" && v.key !== "o75") ielts.overall = Math.max(Number(profile.ielts.overall) || 0, overallOf({ ielts: { ...ielts, overall: null } }));
    const prof = { ...profile, ielts };
    const ok = open.filter((it) => englishCheck(it, prof).state !== "fail");
    return { ...v, count: ok.length, unlocked: ok.filter((it) => !base.has(it.id)) };
  });
}

export function scoreColor(score) {
  if (score >= 75) return "ok";
  if (score >= 50) return "mid";
  return "low";
}
