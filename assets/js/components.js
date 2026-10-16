// Shared UI pieces rendered as HTML strings.
import { esc, countdownLabel, urgency, fmtDate, safeUrl } from "./util.js";
import { STATUS, store } from "./store.js";
import { scoreColor } from "./scoring.js";

export function ctx() {
  return {
    user: store.user,
    profile: store.user.profile,
    settings: store.user.settings,
    docs: store.user.docs,
  };
}

export const TONE = {
  english: { pass: "ok", exempt: "teal", optional: "teal", fail: "crit", unknown: "idle" },
  cost: { ok: "ok", tight: "warn", short: "crit", unknown: "idle" },
  timing: { ok: "ok", risk: "warn", aps: "crit", closed: "idle", unknown: "idle" },
};

const ICON = {
  ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  teal: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  warn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5l6 11H2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.6v.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  crit: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  idle: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2.2 2"/></svg>',
  info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 7.2v4M8 4.9v.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};
export function icon(tone) { return ICON[tone] || ICON.idle; }

export function verdict(kindLabel, check, kind, opts = {}) {
  const tone = (TONE[kind] && TONE[kind][check.state]) || "idle";
  const focus = opts.focus === false ? "" : ' tabindex="0"';
  return `<span class="verdict tone-${tone}" data-tip="${esc(`${kindLabel}: ${check.label}\n${check.text || ""}`)}"${focus}>${icon(tone)}<span><span class="verdict-k">${esc(kindLabel)}</span> ${esc(check.label)}</span></span>`;
}

export function statusPill(status) {
  const s = STATUS[status] || STATUS.consider;
  return `<span class="pill status status-${esc(status)}">${esc(s.label)}</span>`;
}

export function countdown(days, opts = {}) {
  const u = urgency(days);
  return `<span class="cd cd-${u}">${esc(opts.label || countdownLabel(days))}</span>`;
}

export function scoreBadge(score, opts = {}) {
  const c = scoreColor(score);
  const focus = opts.focus === false ? "" : ' tabindex="0"';
  return `<span class="score score-${c}${opts.big ? " score-big" : ""}" data-tip="${esc(opts.tip || `Điểm ưu tiên ${score}/100`)}"${focus} aria-label="Điểm ưu tiên ${score} trên 100"><b>${score}</b>${opts.big ? '<span class="score-of">/100</span>' : ""}</span>`;
}

export function starButton(id, on, name) {
  return `<button type="button" class="star" data-act="track" data-id="${esc(id)}" aria-pressed="${on}" aria-label="${esc((on ? "Bỏ theo dõi " : "Theo dõi ") + name)}" title="${on ? "Đang theo dõi" : "Theo dõi"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>`;
}

export function emptyState(title, body, actionsHtml = "") {
  return `<div class="empty"><p class="empty-title">${esc(title)}</p>${body ? `<p>${body}</p>` : ""}${actionsHtml ? `<div class="empty-actions">${actionsHtml}</div>` : ""}</div>`;
}

export function deadlineLine(next) {
  if (!next) return `<span class="muted">Chưa có ngày</span>`;
  return `<span class="date">${fmtDate(next.date)}</span> ${countdown(next.days)}`;
}

export function sourceLink(item) {
  if (!item.src) return "";
  let host = item.src;
  try { host = new URL(item.src).hostname.replace(/^www\d?\./, ""); } catch (e) { /* keep raw */ }
  return `<a class="src-link" href="${esc(safeUrl(item.src))}" target="_blank" rel="noopener">${esc(host)}</a>`;
}
