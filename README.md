# Sổ học bổng 2027

Web app theo dõi hồ sơ học bổng thạc sĩ (khoa học máy tính, khoa học dữ liệu, AI) cho kỳ xuân và thu 2027. App là trang tĩnh, chạy trên GitHub Pages, không cần máy chủ.

**Mở app:** https://druanli.github.io/hoc-bong-2027/

## App làm được gì

- **Tổng quan:** hạn gần nhất và mức sẵn sàng của hồ sơ đó, việc cần làm tiếp theo, cảnh báo (hạn gần mà hồ sơ còn mỏng, chưa đạt tiếng Anh, APS chưa kịp, vượt ngân sách, IELTS hết hạn), lộ trình hạn nộp, biểu đồ mức sẵn sàng so với thời gian, số hạn theo tháng, mô phỏng điểm IELTS và lệ phí nộp dự kiến.
- **Học bổng:** 101 lựa chọn, lọc theo kỳ, khu vực, loại, tiếng Anh, tài chính, trạng thái, hạn nộp; sắp xếp theo điểm ưu tiên. Có thể tự thêm học bổng mới.
- **Chi tiết:** checklist riêng cho từng nơi (sinh từ yêu cầu của học bổng), điểm 6 yếu tố kèm giải thích, các mốc thời gian, ngày nộp, phỏng vấn và kết quả của bạn, lệ phí, ghi chú, danh sách giáo sư đã liên hệ, nhật ký thay đổi.
- **Tiến độ:** bảng kéo-thả theo trạng thái (cân nhắc, chuẩn bị, đã nộp, phỏng vấn, kết quả, bỏ qua).
- **Lịch:** lịch tháng và danh sách mốc; tải file `.ics` để đưa vào Google Calendar hoặc lịch điện thoại (có nhắc trước 7 ngày).
- **Giấy tờ:** giấy tờ dùng chung (hộ chiếu, bằng, bảng điểm, IELTS, APS, giấy xác nhận học bằng tiếng Anh…) với trạng thái, ngày hết hạn và đường dẫn bản lưu. Đánh dấu một lần là checklist của mọi hồ sơ tự cập nhật.
- **Hồ sơ:** điểm IELTS từng kỹ năng, ngân sách, tuổi, ngày dự kiến có APS, GPA (có quy đổi sang thang Đức), bảng mức chứng minh tài chính khi xin visa so với ngân sách của bạn.
- **So sánh:** đặt tối đa 4 học bổng cạnh nhau trên mọi yếu tố.

## Cách chấm điểm

Mỗi học bổng có điểm 0–100 cho 6 yếu tố, rồi gộp thành **điểm ưu tiên** theo trọng số (đổi được ở Cài đặt):

| Yếu tố | Đo gì |
|---|---|
| Tiếng Anh (20) | Ngưỡng IELTS tổng và từng kỹ năng so với điểm của bạn; được miễn nếu trường nhận giấy xác nhận học bằng tiếng Anh |
| Tài chính (20) | Chi phí tự lo ước tính mỗi năm so với ngân sách |
| Độ phù hợp (20) | Mức khớp với hướng CS, khoa học dữ liệu, nghiên cứu (tự sửa được) |
| Giá trị học bổng (15) | Toàn phần, một phần, chỉ học phí hay học phí thấp |
| Thời gian (15) | Số ngày còn lại so với số việc chưa xong; tính cả ngày có APS; cộng điểm nếu kịp kỳ xuân 2027 |
| Mức cạnh tranh (10) | Tỷ lệ nhận hoặc số suất, nếu có số liệu |

Chưa đạt tiếng Anh thì điểm ưu tiên bị giới hạn ở 35.

## Dữ liệu cá nhân nằm ở đâu

Repo này **công khai** và chỉ chứa code cùng danh mục học bổng (thông tin công khai). Hồ sơ, tiến độ, ghi chú của bạn:

1. lưu trong trình duyệt (localStorage) trên từng máy;
2. nếu bật **Đồng bộ GitHub**, được lưu thành file `data.json` trong một repo **private** riêng. Mỗi thay đổi là một commit, nên mở trên máy khác vẫn thấy và xem lại được lịch sử.

Token GitHub chỉ nằm trong trình duyệt và không bao giờ có trong file sao lưu.

### Bật đồng bộ (một lần)

1. Tạo repo private, ví dụ `hoc-bong-2027-data`.
2. Tạo fine-grained token tại https://github.com/settings/personal-access-tokens/new:
   - Repository access: **Only select repositories**, chọn repo dữ liệu.
   - Permissions, Repository permissions: **Contents: Read and write**.
3. Trong app, mở **Cài đặt**, điền tài khoản, tên repo, dán token, bấm **Lưu và đồng bộ**.

Trên máy khác chỉ cần làm bước 3.

## Cập nhật danh mục

Danh mục nằm ở `data/scholarships.json`. Sửa trực tiếp trên GitHub là app cập nhật sau vài phút. Kiểm tra file sau khi sửa:

```bash
node tools/validate.mjs   # kiểm tra cấu trúc danh mục
node tools/test.mjs       # kiểm tra phần chấm điểm
python3 -m http.server 8000   # chạy thử tại http://localhost:8000
```

Các trường chính của một mục:

| Trường | Ý nghĩa |
|---|---|
| `id`, `name`, `country`, `region`, `type` | Định danh và phân loại |
| `fund` | `toan`, `mot`, `hocphi`, `mien` |
| `spring` | `xuan` hoặc `ca` (kịp xuân 2027), `thu`, `sau` (2028 trở đi) |
| `deadline`, `events[]` | Ngày dạng `YYYY-MM-DD`; `events` gồm `open`, `close`, `interview`, `result`, `other`; `est: true` là dự kiến |
| `english` | `o` IELTS tổng, `b` điểm tối thiểu mỗi kỹ năng, `moi` nhận giấy xác nhận học bằng tiếng Anh, `opt` không đòi chứng chỉ |
| `cost` | `range: [min, max]` chi phí tự lo mỗi năm (€) khi có học bổng; `rule: "at"` là quy tắc theo tuổi của Áo |
| `docs.keys` | Giấy tờ để sinh checklist (`cv`, `motivation`, `lor1`, `transcript`, `aps`, `ielts`…) |
| `fee`, `comp`, `aps`, `gre` | Lệ phí nộp, mức cạnh tranh, yêu cầu APS, GRE |
| `match`, `ver`, `src` | Độ phù hợp, mức xác minh (`xm`, `th`, `dk`), đường dẫn nguồn |

## Lưu ý

Danh mục được tổng hợp ngày 16/10/2026 từ trang chính thức của từng trường và chương trình, cơ sở dữ liệu DAAD, danh mục Erasmus Mundus và trang của cơ quan xuất nhập cảnh. Mục ghi "Dự kiến" suy từ đợt trước. Chi phí tự lo là ước tính. Luôn kiểm tra trang chính thức trước khi nộp.
