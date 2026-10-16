// Check data/scholarships.json after editing it: `node tools/validate.mjs`
import { readFileSync } from "node:fs";

const file = new URL("../data/scholarships.json", import.meta.url);
let data;
try {
  data = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error("JSON lỗi cú pháp:", e.message);
  process.exit(1);
}
const FUND = ["toan", "mot", "hocphi", "mien"];
const SPRING = ["xuan", "ca", "thu", "sau"];
const REGION = ["chau-au", "chau-a", "trung-dong", "bac-my", "dai-duong", "viet-nam"];
const MATCH = ["cao", "tb", "thap"];
const VER = ["xm", "th", "dk"];
const KIND = ["open", "close", "interview", "result", "other"];
const iso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const errors = [];
const ids = new Set();
data.forEach((it, i) => {
  const at = `#${i} (${it.id || "?"})`;
  if (!it.id || typeof it.id !== "string") errors.push(`${at}: thiếu id`);
  if (ids.has(it.id)) errors.push(`${at}: id trùng`);
  ids.add(it.id);
  if (!it.name) errors.push(`${at}: thiếu name`);
  if (!FUND.includes(it.fund)) errors.push(`${at}: fund phải là ${FUND.join("/")}`);
  if (!SPRING.includes(it.spring)) errors.push(`${at}: spring phải là ${SPRING.join("/")}`);
  if (!REGION.includes(it.region)) errors.push(`${at}: region phải là ${REGION.join("/")}`);
  if (!MATCH.includes(it.match)) errors.push(`${at}: match phải là ${MATCH.join("/")}`);
  if (!VER.includes(it.ver)) errors.push(`${at}: ver phải là ${VER.join("/")}`);
  if (it.deadline && !iso(it.deadline)) errors.push(`${at}: deadline phải dạng YYYY-MM-DD`);
  if (!it.english || typeof it.english !== "object") errors.push(`${at}: thiếu english`);
  if (!it.cost || typeof it.cost !== "object") errors.push(`${at}: thiếu cost`);
  else if (it.cost.range && !(Array.isArray(it.cost.range) && it.cost.range.length === 2 && it.cost.range[0] <= it.cost.range[1])) errors.push(`${at}: cost.range phải là [min, max]`);
  if (!it.docs || !Array.isArray(it.docs.keys)) errors.push(`${at}: thiếu docs.keys`);
  for (const e of it.events || []) {
    if (!iso(e.date)) errors.push(`${at}: event có ngày sai: ${e.date}`);
    if (!KIND.includes(e.kind)) errors.push(`${at}: event kind phải là ${KIND.join("/")}`);
  }
  if (it.src && !/^https?:\/\//.test(it.src)) errors.push(`${at}: src phải bắt đầu bằng http(s)://`);
});
if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} lỗi trong ${data.length} mục.`);
  process.exit(1);
}
console.log(`OK: ${data.length} mục hợp lệ.`);
