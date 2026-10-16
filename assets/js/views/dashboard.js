// Tổng quan: the next deadline, what to do next, risks, and the measurements across all applications.
import { store, allItems, isTracked, toggleCheck, setDocStatus, toggleTrack, STATUS, ACTIVE_STATUSES } from "../store.js";
import { scoreAll, risksFor, globalRisks, whatIf, hasIelts, eventsOf, nextClose, englishCheck } from "../scoring.js";
import { esc, fmtDate, fmtLongDate, todayISO, now, fmtEUR, toEUR, parseISO, isoDate, daysUntil } from "../util.js";
import { ctx, countdown, statusPill, scoreBadge, emptyState, icon, starButton } from "../components.js";
import { meter, barList, timeline, scatter, columns, short } from "../charts.js";
import { docType } from "../docs.js";

export const title = "Tổng quan";

export function render(el, app) {
  const c = ctx();
  const ref = now();
  const items = allItems();
  const scores = scoreAll(items, { ...c, ref });
  const trackedS = items.filter((it) => isTracked(it.id)).map((it) => scores.get(it.id));
  const activeS = trackedS.filter((s) => ACTIVE_STATUSES.includes(s.progress.status));
  const prepS = activeS.filter((s) => s.progress.status === "consider" || s.progress.status === "prep");

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Tổng quan</h1>
        <p class="muted">${esc(fmtLongDate(todayISO()))}</p>
      </div>
      <div class="page-actions">
        <a class="btn" href="#/hoc-bong">Mở danh sách học bổng</a>
      </div>
    </div>
    ${setupBanner(c)}
    ${hero(prepS, scores, items, c)}
    ${kpis(trackedS, activeS, c)}
    <div class="grid-2">
      <section class="panel" aria-labelledby="t-next"><div class="panel-head"><h2 id="t-next">Việc tiếp theo</h2><span class="muted small">Theo hạn gần nhất</span></div>${tasks(prepS, c)}</section>
      <section class="panel" aria-labelledby="t-risk"><div class="panel-head"><h2 id="t-risk">Cảnh báo</h2></div>${risks(trackedS, c)}</section>
    </div>
    <section class="panel" aria-labelledby="t-road">
      <div class="panel-head"><h2 id="t-road">Lộ trình hạn nộp</h2><span class="muted small">9 tháng tới, các học bổng đang theo dõi</span></div>
      ${roadmap(activeS, c)}
    </section>
    <div class="grid-2">
      <section class="panel" aria-labelledby="t-scatter">
        <div class="panel-head"><h2 id="t-scatter">Sẵn sàng so với thời gian</h2></div>
        <p class="muted small">Mỗi chấm là một hồ sơ đang chuẩn bị. Góc dưới bên trái là hạn gần mà hồ sơ còn mỏng.</p>
        <div class="chart-slot" data-chart="scatter"></div>
        ${scatterTable(prepS)}
      </section>
      <section class="panel" aria-labelledby="t-months">
        <div class="panel-head"><h2 id="t-months">Số hạn nộp theo tháng</h2></div>
        <p class="muted small">Hạn đóng hồ sơ trong 10 tháng tới, tách phần bạn đang theo dõi.</p>
        <div class="chart-slot" data-chart="columns"></div>
        ${monthsTable(items, c)}
      </section>
    </div>
    <div class="grid-2">
      <section class="panel" aria-labelledby="t-whatif">
        <div class="panel-head"><h2 id="t-whatif">Nếu điểm IELTS thay đổi</h2></div>
        ${whatIfBlock(items, c)}
      </section>
      <section class="panel" aria-labelledby="t-suggest">
        <div class="panel-head"><h2 id="t-suggest">Gợi ý thêm vào danh sách</h2><span class="muted small">Điểm ưu tiên cao, chưa theo dõi</span></div>
        ${suggestions(items, scores, c)}
      </section>
    </div>
    <section class="panel" aria-labelledby="t-docs">
      <div class="panel-head"><h2 id="t-docs">Giấy tờ và chi phí nộp</h2><a class="small" href="#/giay-to">Mở kho giấy tờ</a></div>
      ${docsAndFees(trackedS, activeS, c)}
    </section>
  `;

  const fill = () => {
    const sc = el.querySelector('[data-chart="scatter"]');
    if (sc) {
      const pts = prepS.filter((s) => s.next && !s.next.past).map((s) => ({
        id: s.item.id, name: s.item.name, x: Math.max(0, s.next.days), y: s.ready ? s.ready.pct : 0,
        danger: s.next.days <= 30 && (s.ready ? s.ready.pct : 0) < 50,
      }));
      sc.innerHTML = pts.length ? scatter(pts, { width: sc.clientWidth }) : emptyState("Chưa có hồ sơ nào đang chuẩn bị", "Theo dõi một học bổng và đánh dấu việc đã làm để thấy vị trí của nó ở đây.");
    }
    const co = el.querySelector('[data-chart="columns"]');
    if (co) co.innerHTML = columns(monthCols(items, c), { width: co.clientWidth });
  };
  fill();

  const onClick = (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || !el.contains(b)) return;
    const act = b.getAttribute("data-act");
    if (act === "check") {
      const moved = toggleCheck(b.dataset.id, Number(b.dataset.index));
      if (moved) app.toast("Đã đánh dấu nộp và chuyển sang Đã nộp");
    } else if (act === "doc-done") {
      setDocStatus(b.dataset.key, "xong");
      app.toast(`${docType(b.dataset.key).label}: đã xong cho mọi hồ sơ`);
    } else if (act === "track") {
      toggleTrack(b.dataset.id);
    } else if (act === "open-import") {
      app.openImport();
    }
  };
  el.addEventListener("click", onClick);
  return { resize: fill, cleanup: () => el.removeEventListener("click", onClick) };
}

// ------------------------------------------------------------------ sections
function setupBanner(c) {
  const parts = [];
  if (!hasIelts(c.profile) || c.profile.budgetMax == null || c.profile.budgetMax === "") {
    parts.push(`<div class="banner">
      <div><p class="banner-title">Thêm hồ sơ của bạn để chấm điểm</p>
      <p class="muted">Điểm IELTS từng kỹ năng, ngân sách mỗi năm và ngày dự kiến có APS quyết định phần lớn các yếu tố. Dữ liệu này chỉ lưu trong trình duyệt và repo riêng của bạn.</p></div>
      <div class="banner-actions"><button class="btn btn-primary" data-act="open-import">Nhập file hồ sơ</button><a class="btn" href="#/ho-so">Điền hồ sơ</a></div>
    </div>`);
  }
  return parts.join("");
}

function hero(prepS, scores, items, c) {
  const upcoming = prepS.filter((s) => s.next && !s.next.past).sort((a, b) => a.next.days - b.next.days);
  if (!upcoming.length) {
    const any = items.map((it) => scores.get(it.id)).filter((s) => s.next && !s.next.past).sort((a, b) => a.next.days - b.next.days)[0];
    if (!any) return "";
    return `<section class="hero" aria-label="Hạn gần nhất trong danh mục">
      <div class="hero-main">
        <p class="hero-k">Hạn gần nhất trong danh mục</p>
        <p class="hero-days"><span class="hero-num">${any.next.days}</span><span class="hero-unit">ngày</span></p>
        <p class="hero-name"><a href="#/s/${esc(any.item.id)}">${esc(any.item.name)}</a></p>
        <p class="muted">${esc(fmtDate(any.next.date))}: ${esc(any.next.label || "Hạn nộp")}</p>
      </div>
      <div class="hero-stub"><p>Bạn chưa theo dõi học bổng nào đang mở. Bấm ngôi sao ở danh sách để bắt đầu.</p><a class="btn btn-primary" href="#/hoc-bong">Chọn học bổng</a></div>
    </section>`;
  }
  const s = upcoming[0];
  const r = s.ready || { pct: 0, done: 0, total: 0 };
  const others = upcoming.slice(1, 4);
  return `<section class="hero" aria-label="Hạn gần nhất">
    <div class="hero-main">
      <p class="hero-k">Hạn gần nhất bạn đang theo dõi</p>
      <p class="hero-days"><span class="hero-num">${s.next.days}</span><span class="hero-unit">${s.next.days === 0 ? "hôm nay" : "ngày"}</span></p>
      <p class="hero-name"><a href="#/s/${esc(s.item.id)}">${esc(s.item.name)}</a></p>
      <p class="muted">${esc(fmtDate(s.next.date))}: ${esc(s.next.label || "Hạn nộp")}</p>
      ${others.length ? `<p class="hero-then">Tiếp theo: ${others.map((o) => `<a href="#/s/${esc(o.item.id)}">${esc(short(o.item.name, 34))}</a> <span class="nowrap">(${o.next.days} ngày)</span>`).join(", ")}</p>` : ""}
    </div>
    <div class="hero-stub">
      <p class="hero-k">Hồ sơ đã xong</p>
      <p class="hero-pct">${r.pct}%</p>
      ${meter(r.pct, { label: "Mức sẵn sàng" })}
      <p class="muted small">${r.done}/${r.total} việc. ${statusPill(s.progress.status)}</p>
      <a class="btn btn-primary" href="#/s/${esc(s.item.id)}">Làm tiếp hồ sơ này</a>
    </div>
  </section>`;
}

function kpis(trackedS, activeS, c) {
  const count = (st) => trackedS.filter((s) => s.progress.status === st).length;
  const prepping = trackedS.filter((s) => s.progress.status === "consider" || s.progress.status === "prep");
  const avg = prepping.length ? Math.round(prepping.reduce((a, s) => a + (s.ready ? s.ready.pct : 0), 0) / prepping.length) : null;
  const offers = count("offer"), rejected = count("rejected"), wait = count("waitlist");
  const tiles = [
    { k: "Đang theo dõi", v: trackedS.filter((s) => s.progress.status !== "dropped").length, sub: `${activeS.length} còn đang chạy` },
    { k: "Đang chuẩn bị", v: count("prep"), sub: `${count("consider")} đang cân nhắc` },
    { k: "Đã nộp", v: count("submitted"), sub: count("interview") ? `${count("interview")} đang phỏng vấn` : "Chờ phản hồi" },
    { k: "Kết quả", v: offers, sub: `đỗ; ${wait} chờ, ${rejected} trượt` },
    { k: "Sẵn sàng trung bình", v: avg == null ? "–" : `${avg}%`, sub: "các hồ sơ chưa nộp" },
  ];
  return `<div class="kpis">${tiles.map((t) => `<div class="kpi"><span class="kpi-k">${esc(t.k)}</span><span class="kpi-v">${esc(t.v)}</span><span class="kpi-sub">${esc(t.sub)}</span></div>`).join("")}</div>`;
}

function tasks(prepS, c) {
  const list = [];
  const globalAgg = new Map();
  const sorted = prepS.slice().sort((a, b) => dayKey(a) - dayKey(b));
  for (const s of sorted) {
    if (!s.ready) continue;
    for (const e of s.ready.left) {
      if (e.global) {
        const g = globalAgg.get(e.key) || { key: e.key, label: docType(e.key).label, apps: [], days: dayKey(s) };
        g.apps.push(s.item.name);
        g.days = Math.min(g.days, dayKey(s));
        globalAgg.set(e.key, g);
      } else {
        const due = e.due ? daysUntil(e.due) : null;
        list.push({ type: "app", id: s.item.id, index: e.index, label: e.label, app: s.item.name, days: due != null ? due : dayKey(s), dueOwn: due != null });
      }
    }
  }
  for (const g of globalAgg.values()) list.push({ type: "global", ...g });
  list.sort((a, b) => a.days - b.days);
  if (!list.length) {
    return emptyState(prepS.length ? "Không còn việc nào chưa xong" : "Chưa có hồ sơ nào đang chuẩn bị", prepS.length ? "Các hồ sơ đang chuẩn bị đã đủ checklist. Nhớ bấm nộp đúng hạn." : `Theo dõi học bổng ở <a href="#/hoc-bong">danh sách</a>, checklist sẽ hiện ở đây.`);
  }
  const top = list.slice(0, 12);
  return `<ul class="tasks">${top.map((t) => {
    const days = t.days >= 9e6 ? null : t.days;
    if (t.type === "global") {
      return `<li class="task">
        <button class="checkbox" data-act="doc-done" data-key="${esc(t.key)}" aria-label="Đánh dấu ${esc(t.label)} đã xong"></button>
        <div class="task-body"><span class="task-label">${esc(t.label)}</span><span class="task-sub">Dùng chung cho ${t.apps.length} hồ sơ: ${esc(t.apps.slice(0, 3).map((n) => short(n, 28)).join(", "))}${t.apps.length > 3 ? "…" : ""}</span></div>
        ${countdown(days)}
      </li>`;
    }
    return `<li class="task">
      <button class="checkbox" data-act="check" data-id="${esc(t.id)}" data-index="${t.index}" aria-label="Đánh dấu ${esc(t.label)} cho ${esc(t.app)} đã xong"></button>
      <div class="task-body"><span class="task-label">${esc(t.label)}</span><a class="task-sub" href="#/s/${esc(t.id)}">${esc(t.app)}</a></div>
      ${countdown(days, t.dueOwn ? {} : {})}
    </li>`;
  }).join("")}</ul>${list.length > top.length ? `<p class="muted small">Còn ${list.length - top.length} việc khác trong các hồ sơ.</p>` : ""}`;
}

function dayKey(s) { return s.next && !s.next.past ? s.next.days : 9e6; }

function risks(trackedS, c) {
  const all = [];
  for (const s of trackedS) all.push(...risksFor(s, c));
  all.push(...globalRisks(c));
  const order = { crit: 0, warn: 1, info: 2 };
  all.sort((a, b) => order[a.level] - order[b.level]);
  if (!all.length) return emptyState("Chưa có cảnh báo", trackedS.length ? "Các hồ sơ đang theo dõi chưa có vấn đề nào về hạn, tiếng Anh, APS hay ngân sách." : "Cảnh báo về hạn nộp, tiếng Anh, APS và ngân sách sẽ hiện khi bạn theo dõi học bổng.");
  const top = all.slice(0, 10);
  const tone = { crit: "crit", warn: "warn", info: "info" };
  return `<ul class="risks">${top.map((r) => `<li class="risk risk-${r.level}">${icon(tone[r.level])}<div><span class="risk-name">${r.id ? `<a href="#/s/${esc(r.id)}">${esc(r.name)}</a>` : esc(r.name)}</span><span class="risk-text">${esc(r.text)}</span></div></li>`).join("")}</ul>${all.length > top.length ? `<p class="muted small">Và ${all.length - top.length} cảnh báo nhẹ hơn.</p>` : ""}`;
}

function roadmap(activeS, c) {
  const rows = activeS
    .filter((s) => s.next)
    .sort((a, b) => dayKey(a) - dayKey(b))
    .map((s) => ({
      id: s.item.id,
      name: s.item.name,
      sub: STATUS[s.progress.status].label,
      events: eventsOf(s.item, s.progress).filter((e) => e.kind !== "own"),
      ready: s.ready ? s.ready.pct : null,
    }));
  const undated = activeS.filter((s) => !s.next);
  const undatedNote = undated.length ? `<p class="small muted">Chưa có ngày cụ thể: ${undated.map((s) => `<a href="#/s/${esc(s.item.id)}">${esc(short(s.item.name, 40))}</a>`).join(", ")}. Xem lịch dự kiến ở trang chi tiết.</p>` : "";
  if (!rows.length) return emptyState("Chưa có mốc nào để vẽ", "Theo dõi học bổng có ngày cụ thể để xem lộ trình.") + undatedNote;
  const table = `<details class="table-view"><summary>Xem dạng bảng</summary><div class="table-wrap"><table class="data-table"><thead><tr><th>Học bổng</th><th>Ngày</th><th>Mốc</th><th>Sẵn sàng</th></tr></thead><tbody>${rows.flatMap((r) => r.events.filter((e) => daysUntil(e.date) >= 0).map((e) => `<tr><td>${esc(r.name)}</td><td class="num">${fmtDate(e.date)}</td><td>${esc(e.label)}${e.est ? " (dự kiến)" : ""}</td><td class="num">${r.ready == null ? "–" : r.ready + "%"}</td></tr>`)).join("")}</tbody></table></div></details>`;
  return `<p class="small muted tl-hint">Vuốt ngang trong khung để xem các tháng sau.</p><div class="table-wrap">${timeline(rows, { start: todayISO(), months: 9 })}</div>${undatedNote}${table}`;
}

function scatterTable(prepS) {
  const rows = prepS.filter((s) => s.next && !s.next.past);
  if (!rows.length) return "";
  return `<details class="table-view"><summary>Xem dạng bảng</summary><div class="table-wrap"><table class="data-table"><thead><tr><th>Học bổng</th><th>Ngày còn lại</th><th>Sẵn sàng</th></tr></thead><tbody>${rows.sort((a, b) => a.next.days - b.next.days).map((s) => `<tr><td>${esc(s.item.name)}</td><td class="num">${s.next.days}</td><td class="num">${s.ready ? s.ready.pct : 0}%</td></tr>`).join("")}</tbody></table></div></details>`;
}

function monthCols(items, c) {
  const start = parseISO(todayISO());
  const cols = [];
  for (let m = 0; m < 10; m++) {
    const d = new Date(start.getFullYear(), start.getMonth() + m, 1);
    const key = isoDate(d).slice(0, 7);
    cols.push({ key, label: `T${d.getMonth() + 1}${d.getMonth() === 0 ? "/" + String(d.getFullYear()).slice(2) : ""}`, a: 0, b: 0 });
  }
  const today = todayISO();
  for (const it of items) {
    const tracked = isTracked(it.id);
    for (const e of it.events || []) {
      if (e.kind !== "close" || e.date < today) continue;
      const col = cols.find((x) => x.key === e.date.slice(0, 7));
      if (col) { if (tracked) col.a++; else col.b++; }
    }
  }
  return cols;
}

function monthsTable(items, c) {
  const cols = monthCols(items, c);
  return `<details class="table-view"><summary>Xem dạng bảng</summary><div class="table-wrap"><table class="data-table"><thead><tr><th>Tháng</th><th>Đang theo dõi</th><th>Khác</th></tr></thead><tbody>${cols.map((x) => `<tr><td>${esc(x.key.slice(5))}/${esc(x.key.slice(0, 4))}</td><td class="num">${x.a}</td><td class="num">${x.b}</td></tr>`).join("")}</tbody></table></div></details>`;
}

function whatIfBlock(items, c) {
  const res = whatIf(items, c.profile);
  if (!res) return emptyState("Chưa có điểm IELTS", `Nhập 4 kỹ năng ở <a href="#/ho-so">trang Hồ sơ</a> để xem mỗi mức điểm mở thêm bao nhiêu học bổng.`);
  const rows = res.map((r) => ({ label: r.label, value: r.count, display: `${r.count}`, tone: r.key === "now" ? "s" : "s2", tip: r.unlocked.length ? `${r.label}: thêm ${r.unlocked.length}\n${r.unlocked.slice(0, 6).map((x) => x.name).join("\n")}` : `${r.label}: ${r.count} học bổng còn mở đạt yêu cầu tiếng Anh` }));
  const seen = new Set();
  const details = res.map((r) => {
    const fresh = r.unlocked.filter((x) => !seen.has(x.id));
    fresh.forEach((x) => seen.add(x.id));
    if (!fresh.length) return "";
    return `<p class="small"><b>${esc(r.label)}</b> mở thêm ${fresh.length}: ${fresh.slice(0, 8).map((x) => `<a href="#/s/${esc(x.id)}">${esc(short(x.name, 30))}</a>`).join(", ")}${fresh.length > 8 ? "…" : ""}</p>`;
  }).join("");
  return `<p class="muted small">Số học bổng còn mở mà điểm tiếng Anh đạt yêu cầu (tính cả mục được miễn hoặc không đòi chứng chỉ).</p>${barList(rows)}${details || '<p class="small muted">Nâng điểm không mở thêm học bổng nào trong danh mục.</p>'}`;
}

function suggestions(items, scores, c) {
  const regions = c.profile.regions || [];
  const list = items
    .filter((it) => !isTracked(it.id))
    .map((it) => scores.get(it.id))
    .filter((s) => !s.closed && s.factors.english.state !== "fail" && (!regions.length || regions.includes(s.item.region)))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
  if (!list.length) return emptyState("Không còn gợi ý", "Bạn đã theo dõi hết các học bổng hợp hồ sơ, hoặc bộ lọc khu vực ở trang Hồ sơ đang hẹp.");
  return `<ul class="suggest">${list.map((s) => `<li>
    ${starButton(s.item.id, false, s.item.name)}
    <div class="suggest-body"><a href="#/s/${esc(s.item.id)}">${esc(s.item.name)}</a><span class="muted small">${esc(s.item.country)}${s.next && !s.next.past ? `, hạn ${fmtDate(s.next.date)}` : ""}</span></div>
    ${scoreBadge(s.priority)}
  </li>`).join("")}</ul>`;
}

function docsAndFees(trackedS, activeS, c) {
  const prep = activeS.filter((s) => s.progress.status === "consider" || s.progress.status === "prep");
  const need = new Map();
  let lor = 0, lorDone = 0, mot = 0, motDone = 0, prop = 0, propDone = 0;
  for (const s of prep) {
    for (const e of s.progress.checklist) {
      if (e.global) {
        if (!need.has(e.key)) need.set(e.key, 0);
        need.set(e.key, need.get(e.key) + 1);
      } else if (/^lor\d+$/.test(e.key)) { lor++; if (e.done) lorDone++; }
      else if (e.key === "motivation") { mot++; if (e.done) motDone++; }
      else if (e.key === "proposal") { prop++; if (e.done) propDone++; }
    }
  }
  const docRows = [...need.entries()].sort((a, b) => b[1] - a[1]).map(([key, n]) => {
    const d = c.docs[key];
    const st = d ? d.status : "chua";
    const tone = st === "xong" ? "ok" : st === "dang-lam" ? "warn" : st === "cap-nhat" ? "crit" : "idle";
    const label = { xong: "Đã xong", "dang-lam": "Đang làm", "cap-nhat": "Cần cập nhật", chua: "Chưa có" }[st];
    return `<li><span class="verdict tone-${tone}">${icon(tone)}<span>${esc(docType(key).label)}</span></span><span class="muted small">${esc(label)}, cần cho ${n} hồ sơ</span></li>`;
  }).join("");

  // application fees, deduplicated for shared portals
  const rates = c.settings.rates || store.meta.rates || {};
  let total = 0, paid = 0, unknown = 0;
  const groups = new Map();
  for (const s of activeS) {
    const f = s.item.fee;
    if (!f) { unknown++; continue; }
    const isPaid = !!(s.progress.fee && s.progress.fee.paid);
    if (f.group === "uhr") {
      if (!groups.has("uhr")) { groups.set("uhr", true); const v = toEUR(f.amt, f.cur, rates) || 0; total += v; if (isPaid) paid += v; }
      else if (isPaid) { /* counted once */ }
    } else if (f.group === "uniassist") {
      const n = groups.get("uniassist") || 0;
      const amt = n === 0 ? 75 : 30;
      groups.set("uniassist", n + 1);
      total += amt; if (isPaid) paid += amt;
    } else {
      const v = toEUR(f.amt, f.cur, rates) || 0;
      total += v; if (isPaid) paid += v;
    }
  }
  return `<div class="grid-2 grid-tight">
    <div>
      <h3 class="h3">Giấy tờ dùng chung cho hồ sơ đang chuẩn bị</h3>
      ${docRows ? `<ul class="doc-mini">${docRows}</ul>` : '<p class="muted small">Chưa có hồ sơ nào đang chuẩn bị.</p>'}
    </div>
    <div>
      <h3 class="h3">Phải viết riêng cho từng nơi</h3>
      <ul class="count-list">
        <li><span>Thư giới thiệu</span><b>${lorDone}/${lor}</b></li>
        <li><span>Thư động lực, SOP</span><b>${motDone}/${mot}</b></li>
        <li><span>Đề cương nghiên cứu</span><b>${propDone}/${prop}</b></li>
      </ul>
      <h3 class="h3">Lệ phí nộp hồ sơ</h3>
      <ul class="count-list">
        <li><span>Dự kiến (quy đổi gần đúng)</span><b>${fmtEUR(total)}</b></li>
        <li><span>Đã trả</span><b>${fmtEUR(paid)}</b></li>
        <li><span>Hồ sơ chưa rõ lệ phí</span><b>${unknown}</b></li>
      </ul>
      <p class="muted small">uni-assist tính €75 cho hồ sơ đầu và €30 mỗi hồ sơ sau; universityadmissions.se thu SEK 900 một lần cho cả đợt.</p>
    </div>
  </div>`;
}
