// Sanity tests for the scoring and merge logic: `node tools/test.mjs`
import { readFileSync } from "node:fs";
import { englishCheck, costCheck, nextClose, timingCheck, whatIf, scoreItem } from "../assets/js/scoring.js";
import { mergeUser, defaultUser } from "../assets/js/store.js";
import { ieltsOverall, germanGrade } from "../assets/js/util.js";

const catalog = JSON.parse(readFileSync(new URL("../data/scholarships.json", import.meta.url), "utf8"));
const byId = Object.fromEntries(catalog.map((x) => [x.id, x]));
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) pass++; else { fail++; console.log("FAIL", name, extra); } };

const profile = {
  ielts: { L: 6.5, R: 8.5, W: 6.5, S: 6.0, overall: 7.0, date: "2026-01-10" },
  moi: true, budgetMin: 10000, budgetMax: 12000, age: null, apsDate: "2026-12-01", preferSpring: true,
};
const ref = new Date(2026, 9, 16, 10, 0, 0);
const settings = { weights: { english: 20, cost: 20, match: 20, value: 15, timing: 15, comp: 10 }, daysPerTask: 2 };

ok("ielts overall", ieltsOverall({ L: 6.5, R: 8.5, W: 6.5, S: 6 }) === 7);
ok("german grade 8.98 ≈ 1.61", Math.abs(germanGrade(8.98) - 1.612) < 0.01);

ok("Delft fails on Speaking", englishCheck(byId.delft, profile).state === "fail");
ok("Delft passes with S 6.5", englishCheck(byId.delft, { ...profile, ielts: { ...profile.ielts, S: 6.5 } }).state === "pass");
ok("Hamburg passes (6.5, bands ≥ 6.0)", englishCheck(byId.hamburg, profile).state === "pass");
ok("EDISS passes", englishCheck(byId.ediss, profile).state === "pass");
ok("EMAI fails", englishCheck(byId.emai, profile).state === "fail");
ok("TU Darmstadt exempt with English-medium letter", englishCheck(byId.tudarmstadt, profile).state === "exempt");
ok("TU Darmstadt passes on IELTS 7.0 without letter", englishCheck(byId.tudarmstadt, { ...profile, moi: false }).state === "pass");
ok("NAIST optional", englishCheck(byId.naist, profile).state === "optional");
ok("Unknown threshold stays unknown", englishCheck(byId.eiffel, profile).state === "unknown");

ok("Passau tight vs €10–12k", costCheck(byId.passau, profile, null).state === "tight", JSON.stringify(costCheck(byId.passau, profile, null)));
ok("DAAD ok", costCheck(byId.daad, profile, null).state === "ok");
ok("Leiden short", costCheck(byId.leiden, profile, null).state === "short");
const at = costCheck(byId.tuwien, profile, null);
ok("Austria without age gives a range", at.range[0] < at.range[1] && at.state === "tight", JSON.stringify(at.range));
ok("Austria under 24 fits", costCheck(byId.tuwien, { ...profile, age: 23 }, null).state === "ok");
ok("Austria 24+ short", costCheck(byId.tuwien, { ...profile, age: 25 }, null).state === "short");
ok("override cost respected", costCheck(byId.leiden, profile, { override: { cost: 9000 } }).state === "ok");

const nc1 = nextClose(byId.passau, profile, ref);
ok("Passau next close is 15/12 with APS 01/12", nc1.date === "2026-12-15" && !nc1.skipped, JSON.stringify(nc1));
const nc2 = nextClose(byId.passau, { ...profile, apsDate: "2026-12-20" }, ref);
ok("Passau skips to 31/05 when APS is late", nc2.date === "2027-05-31" && nc2.skipped, JSON.stringify(nc2));
const nc3 = nextClose(byId.bonn, { ...profile, apsDate: "2027-06-01" }, ref);
ok("Bonn flags APS late when no round fits", nc3.apsLate === true, JSON.stringify(nc3));
ok("GIST closed", timingCheck(byId.gist, null, profile, settings, {}, ref).state === "closed");
const t = timingCheck(byId.daad, null, profile, settings, {}, ref);
ok("DAAD timing is risky with 5 days left", t.state === "risk" && t.next.days === 5, JSON.stringify(t));

const w = whatIf(catalog, profile);
ok("what-if: Speaking 6.5 unlocks more", w[1].count > w[0].count && w[1].unlocked.some((x) => x.id === "delft"));

const s = scoreItem(byId.emai, { profile, settings, docs: {}, ref, progress: null });
ok("English gate caps priority at 35", s.priority <= 35);

const a = defaultUser(); const b = defaultUser();
a.profile = { ...a.profile, budgetMax: 1, updatedAt: "2026-01-01T00:00:00Z" };
b.profile = { ...b.profile, budgetMax: 2, updatedAt: "2026-02-01T00:00:00Z" };
a.progress = { x: { updatedAt: "2026-03-01T00:00:00Z", tracked: true, status: "prep", checklist: [] } };
b.progress = { x: { updatedAt: "2026-01-01T00:00:00Z", tracked: false, status: "consider", checklist: [] }, y: { updatedAt: "2026-01-01T00:00:00Z", tracked: true, status: "prep", checklist: [] } };
const m = mergeUser(a, b);
ok("merge: newer profile wins", m.profile.budgetMax === 2);
ok("merge: newer record wins per item", m.progress.x.status === "prep");
ok("merge: union of items", !!m.progress.y);

for (const it of catalog) {
  ok(`catalog ${it.id} has events or deadline text`, (it.events && it.events.length) || it.dtext);
  ok(`catalog ${it.id} has docs`, it.docs && it.docs.keys.length >= 3);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
