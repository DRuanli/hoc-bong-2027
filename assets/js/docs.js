// Document types used to build each application's checklist.
// "global" documents are shared: one status in the document library covers every application.

export const DOC_TYPES = {
  // shared documents
  passport: { label: "Hộ chiếu", scope: "global", hint: "Còn hạn ít nhất suốt thời gian học là an toàn nhất", expires: true },
  degree: { label: "Bằng tốt nghiệp (bản dịch công chứng)", scope: "global" },
  transcript: { label: "Bảng điểm (bản dịch công chứng)", scope: "global" },
  ielts: { label: "Chứng chỉ IELTS", scope: "global", hint: "Hiệu lực 2 năm kể từ ngày thi", expires: true },
  moi: { label: "Giấy xác nhận học bằng tiếng Anh", scope: "global", hint: "Văn bản chính thức của trường: cả chương trình cử nhân dạy bằng tiếng Anh" },
  aps: { label: "Chứng chỉ APS", scope: "global", hint: "Bắt buộc với hầu hết trường Đức khi nộp" },
  legal: { label: "Hợp pháp hóa lãnh sự bằng và bảng điểm", scope: "global", hint: "Áo đòi bản hợp pháp hóa kèm bản dịch" },
  courses: { label: "Mô tả học phần (module descriptions)", scope: "global" },
  pubs: { label: "Danh sách và bản PDF công bố khoa học", scope: "global" },
  rank: { label: "Giấy xác nhận xếp hạng trong khóa", scope: "global" },
  funds: { label: "Chứng minh tài chính", scope: "global", hint: "Cần khi xin visa; số tiền theo từng nước" },
  health: { label: "Giấy khám sức khỏe", scope: "global", expires: true },
  // per-application work
  form: { label: "Điền đơn trực tuyến", scope: "app" },
  programs: { label: "Chọn chương trình", scope: "app" },
  cv: { label: "CV theo mẫu chương trình", scope: "app" },
  motivation: { label: "Thư động lực", scope: "app" },
  proposal: { label: "Đề cương nghiên cứu", scope: "app" },
  video: { label: "Video giới thiệu", scope: "app" },
  ects: { label: "Bảng đối chiếu ECTS", scope: "app" },
  selfeval: { label: "Mẫu tự đánh giá", scope: "app" },
  workcert: { label: "Xác nhận kinh nghiệm làm việc", scope: "app" },
  advisor: { label: "Liên hệ và được giáo sư đồng ý", scope: "app" },
  nomination: { label: "Được đề cử", scope: "app" },
  admit: { label: "Thư mời nhập học", scope: "app" },
  prelim: { label: "Thủ tục sơ bộ", scope: "app" },
  fee: { label: "Đóng lệ phí", scope: "app" },
  test: { label: "Bài kiểm tra / phỏng vấn", scope: "app" },
  hardcopy: { label: "Gửi bản giấy", scope: "app" },
  submit: { label: "Bấm nộp và lưu xác nhận", scope: "app" },
};

export const GLOBAL_DOC_KEYS = Object.keys(DOC_TYPES).filter((k) => DOC_TYPES[k].scope === "global");

export const DOC_STATUS = {
  chua: { label: "Chưa có", tone: "idle" },
  "dang-lam": { label: "Đang làm", tone: "warn" },
  xong: { label: "Đã xong", tone: "ok" },
  "cap-nhat": { label: "Cần cập nhật", tone: "crit" },
};

export function docType(key) {
  if (/^lor\d+$/.test(key)) return { label: `Thư giới thiệu ${key.slice(3)}`, scope: "app", lor: true };
  if (key.startsWith("custom-")) return { label: "Việc riêng", scope: "app", custom: true };
  return DOC_TYPES[key] || { label: key, scope: "app" };
}

/** Fresh checklist for an application, from the catalog item's document list. */
export function buildChecklist(item) {
  const keys = (item.docs && item.docs.keys) || ["form", "cv", "motivation", "transcript", "degree", "ielts", "passport", "submit"];
  const labels = (item.docs && item.docs.labels) || {};
  return keys.map((key) => {
    const t = docType(key);
    return {
      key,
      label: labels[key] || t.label,
      global: t.scope === "global",
      done: false,
      due: "",
      note: "",
    };
  });
}

/** Is a checklist entry done? Shared documents follow the library. */
export function isDone(entry, docsLib) {
  if (entry.global) {
    const d = docsLib && docsLib[entry.key];
    return !!d && d.status === "xong";
  }
  return !!entry.done;
}
