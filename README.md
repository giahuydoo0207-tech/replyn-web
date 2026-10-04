# Replyn Web — MVP demo (UniHackFest 10/10/2026)

> Nova giúp hai bên gặp nhau. Replyn giúp hai bên tin nhau để làm việc.

Web demo UI/UX của Replyn: chat + workspace + milestone + bằng chứng dự án. Bố cục học theo WhatsApp Web,
mật độ tin nhắn học theo Telegram, theme vàng-đen. **Toàn bộ dữ liệu là mock, chưa có backend.**
Cấp vốn, giải ngân và phí vận hành đều là mô phỏng. Replyn không custody tiền thật.

## Trạng thái tích hợp với Nova

- Nova Business và Nova Mobile dùng chung một backend Spring Boot/PostgreSQL.
- Nova Mobile có đăng nhập thật (email/OTP, token lưu an toàn trên thiết bị).
- Nova Business hiện là demo dưới một organization mẫu, **chưa có phiên đăng nhập người dùng doanh nghiệp**.
- Màn “Tiếp tục với Nova” của Replyn (`/auth/nova`, Nova ID / Mã QR) là **prototype frontend**: xác thực được mô phỏng
  trên trình duyệt, chưa gọi Nova hay Supabase.
- Tin nhắn Nova CHAT trong bản nộp là **dữ liệu seed**.
- Tích hợp Supabase, signed handoff và QR pairing là **kiến trúc tiếp theo**, chưa triển khai.
- Ký quỹ, phí và giải ngân đều là **mô phỏng**; Replyn không giữ tiền thật.

Kiến trúc, ERD và integration contract dự kiến: [docs/architecture/nova-supabase-integration.md](docs/architecture/nova-supabase-integration.md).

## Chạy

```powershell
cd replyn-web
npm install
npm run dev          # http://localhost:3000
npm run typecheck; npm run lint; npm run build
```

Chụp màn hình các cảnh demo và chạy thử luồng chính (cần `npm run dev` đang chạy và Chrome đã cài):

```powershell
$env:BASE_URL="http://localhost:3000"; npm run screens   # ảnh lưu ở ./screenshots
```

## Đăng nhập Replyn bằng Nova (prototype frontend)

Route `/auth/nova`, ví dụ `/auth/nova?handoff=demo-handoff-01&conversation=nova-khoa`. Đây là **prototype frontend**:
toàn bộ là mô phỏng phía trình duyệt, chưa gọi Nova API, Supabase Auth hay OAuth. Thiết kế thật (signed handoff,
QR pairing, Supabase) nằm trong [tài liệu kiến trúc](docs/architecture/nova-supabase-integration.md).

- **Nova ID** (Business): Nova ID là định danh công khai nên luôn đi kèm **Nova Key**. Cặp demo nằm trong
  `src/lib/auth/mockNova.ts` (`NVB-7K29Q` / `DEMO-2026`), không phải secret production. Nova Key không được lưu.
- **Mã QR** (Nova Mobile, demo đăng nhập là Freelancer): QR chứa URL demo, không chứa token. Mục *Điều khiển demo*
  dưới mã thay cho điện thoại thật: `ready → scanned → approved`, làm mã hết hạn, lỗi tạo mã.
- Đăng nhập xong, `src/lib/auth/demoSession.ts` ghi vào sessionStorage của tab: vai trò, cuộc trò chuyện cần mở
  và một thông báo một lần. Màn chat đọc kết quả này một lần rồi chạy như cũ (reducer mock trong bộ nhớ):
  có `handoff` + `conversation` thì mở thẳng cuộc trò chuyện (nếu tài khoản là thành viên) và hiện
  "Đã liên kết cuộc trò chuyện từ Nova."; không có thì mở danh sách chat. `returnTo` chỉ nhận đường dẫn nội bộ.
- Màn chat chính chưa bắt buộc đăng nhập, để giữ nguyên luồng demo hiện tại.
- **Backend thật phải xác minh signed handoff** (chữ ký, hạn dùng, người nhận) ở server, không tin query trên URL.

```powershell
$env:BASE_URL="http://localhost:3000"; npm run test:login   # ảnh login-*.png lưu ở ./screenshots
```

Test giải mã lại ảnh chụp QR bằng `jsqr` (devDependency) để chắc mã vẫn quét được khi có logo ở giữa.

## IA: tách lớp Chat và lớp Protection

- **Rail trái**: thu gọn 64px, hover thì giãn ra dạng overlay, ☰ để ghim mở. Label dùng `opacity` + `pointer-events`.
- **Chat giữa**: chỉ có bubble, file preview gọn, và notice 1 dòng kèm link mở đúng tab bên phải. Không còn card nghiệp vụ.
- **Bảo vệ dự án (panel phải)**: Status Header cố định (dự án, tiền, hai bên, phí mô phỏng, *Việc cần làm*) + 5 tab chi tiết.
  Mặc định mở *Milestones*; nếu có tranh chấp mở thì tab *Tranh chấp* tự lên đầu và được chọn, header giữa hiện *Xem tranh chấp*, rail có badge đỏ.
  Badge chỉ dành cho việc cần làm: cam = chờ người xem xử lý, đỏ = tranh chấp.
- **Màu**: vàng chỉ là accent (logo, nút hành động chính, chấm active). Còn lại dùng ngà/xám.

## Luồng demo

Nút **Demo** ở rail trái cho phép nhảy thẳng tới từng cảnh và đổi vai **Business / Freelancer**:

1. **Nova Chat**: phỏng vấn xong, menu `+` chỉ có *Gửi tệp · Gửi ảnh · Đề xuất Replyn*.
2. **Đề xuất Replyn**: proposal card, CTA *Mở Replyn / Để sau*.
3. **Workspace & milestone**: khóa điều khoản ở tab Điều khoản, M1 *Đã ký quỹ (mô phỏng)*.
4. **Nộp sản phẩm**: chat chỉ có bubble file gọn + notice; SHA-256 nằm trong tab Files.
5. **Tranh chấp**: yêu cầu sửa, nộp lại v2, mở tranh chấp, *Đội ngũ Nova* review.
6. **Quyết định & bằng chứng**: chia 600/400, phí mô phỏng, timeline *Bằng chứng dự án*.

Mọi bước cũng làm được bằng thao tác thật: kéo thả file vào khung chat để nộp sản phẩm (hash tính ngay trên
trình duyệt), hoặc dùng các nút trong panel Replyn Protection.

## Cấu trúc

```
src/
  app/                 layout (Inter + vietnamese), globals.css (design tokens vàng-đen, pattern khung chat)
  lib/
    types.ts           Workspace, Milestone, Submission, Dispute, EvidenceEvent, Message (+ refs)
    reducer.ts         toàn bộ luồng nghiệp vụ; mỗi hành động sinh message trong chat + sự kiện bằng chứng
    seed.ts            mock data, workspace phụ (dựng bằng chính reducer), các scene demo
    fees.ts            BASIC 7% / ADVANCED 10% (mô phỏng), phí chỉ tính trên phần freelancer nhận
    store.tsx          React context + useReducer
  components/
    Rail.tsx           rail icon trái + menu Demo / đổi vai
    ChatList.tsx       search, filter chips, unread, badge trạng thái workspace
    chat/              ChatView (header + tagline, dòng ghim, composer), Messages (bubble + notice 1 dòng)
    panel/             Bảo vệ dự án: StatusHeader + Điều khoản, Milestones, Files, Bằng chứng, Tranh chấp
    (lib/protection.ts) thứ tự tab, tab mặc định, việc cần làm theo ngữ cảnh
    actions.tsx        dialog Nộp sản phẩm / Yêu cầu sửa / Mở tranh chấp
public/pattern.svg     doodle line-icon cho nền chat (tự vẽ, không dùng asset WhatsApp/Telegram)
```

Không copy logo, icon, brand hay code của WhatsApp/Telegram, chỉ học UX pattern. Icon dùng `lucide-react`.
