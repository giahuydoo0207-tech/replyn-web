# Replyn Web — MVP demo (UniHackFest 10/10/2026)

> Nova giúp hai bên gặp nhau. Replyn giúp hai bên tin nhau để làm việc.

Web demo UI/UX của Replyn: chat + workspace + milestone + bằng chứng dự án. Bố cục học theo WhatsApp Web,
mật độ tin nhắn học theo Telegram, theme vàng-đen. **Toàn bộ dữ liệu là mock, chưa có backend.**
Cấp vốn, giải ngân và phí vận hành đều là mô phỏng. Replyn không custody tiền thật.

## Trạng thái tích hợp với Nova

- Nova Business và Nova Mobile dùng chung một backend Spring Boot/PostgreSQL.
- Nova Mobile có đăng nhập thật (email/OTP, token lưu an toàn trên thiết bị).
- Nova Business hiện là demo dưới một organization mẫu, **chưa có phiên đăng nhập người dùng doanh nghiệp**.
- Màn “Tiếp tục với Nova” của Replyn (`/auth/nova`) xác thực thật qua server Replyn: **Nova ID + Nova Key** (Business)
  và **mã QR xác nhận bằng Nova Mobile** (Talent), cấp phiên Replyn trong cookie HttpOnly.
- Tin nhắn Nova CHAT trong bản nộp là **dữ liệu seed** (chỉ xem); đăng nhập thật chưa đồng bộ tin nhắn thật.
- Workspace của đề xuất đã chấp nhận trên Nova được đọc thật từ Nova backend (xem *Workspace thật từ Nova*).
- Tích hợp Supabase và signed handoff là **kiến trúc tiếp theo**, chưa triển khai.
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

## Đăng nhập Replyn bằng Nova

Route `/auth/nova`, ví dụ `/auth/nova?handoff=demo-handoff-01&conversation=nova-khoa`. Server Replyn
(`src/lib/auth/server/novaBusinessAuth.ts`) gọi Nova backend; trình duyệt chỉ gọi route same-origin của Replyn.
Biến môi trường (chỉ server, không bao giờ `NEXT_PUBLIC_`): `NOVA_API_URL`, `REPLYN_SESSION_SECRET`,
`REPLYN_QR_CLIENT_SECRET` (xem `.env.example`).

- **Nova ID** (Business): Nova ID là định danh công khai nên luôn đi kèm **Nova Key**; `POST /api/auth/nova/business`
  xác minh cặp này với Nova. Nova Key không được lưu.
- **Mã QR** (Talent, Nova Mobile): `POST /api/auth/nova/qr` nhờ Nova backend tạo challenge 60 giây, đặt cookie
  `replyn_qr_pairing` (HttpOnly, ký HMAC, giữ pairingId + browserSecret) và chỉ trả `qrUrl`
  (`/auth/nova?pairing=…&secret=…&exp=…&action=login`). Trang hỏi `GET /api/auth/nova/qr` mỗi 2 giây; khi Nova Mobile
  đã xác nhận, server tiêu thụ challenge đúng một lần, đặt phiên Talent và xóa cookie challenge. Talent không có
  Nova ID: giao diện hiện tên và “Nova Mobile đã xác minh”, không bao giờ hiện mã hồ sơ nội bộ.
- Đăng nhập xong, `src/lib/auth/demoSession.ts` ghi vào sessionStorage của tab cuộc trò chuyện cần mở và một thông báo
  một lần; vai trò luôn đọc lại từ cookie phiên nên refresh vẫn giữ. Có `handoff` + `conversation` thì mở thẳng cuộc
  trò chuyện (nếu tài khoản là thành viên); Talent không có handoff thì mở kênh `channel-nova`; `returnTo` chỉ nhận
  đường dẫn nội bộ.
- Chưa có giới hạn tần suất phân tán cho các route đăng nhập; đó là hạ tầng tiếp theo (không dùng bộ đếm trong bộ nhớ).
- Màn chat chính chưa bắt buộc đăng nhập, để giữ nguyên luồng demo hiện tại.
- **Backend thật phải xác minh signed handoff** (chữ ký, hạn dùng, người nhận) ở server, không tin query trên URL.

```powershell
$env:BASE_URL="http://localhost:3000"; npm run test:login   # ảnh login-*.png lưu ở ./screenshots
```

`npm run test:login` dùng máy chủ Nova giả trên máy (tự duyệt challenge thay cho Nova Mobile) và giải mã lại ảnh chụp
QR bằng `jsqr` (devDependency) để chắc mã vẫn quét được khi có logo ở giữa. `npm run test:auth` kiểm thử server.

## IA: tách lớp Chat và lớp Protection

- **Rail trái**: thu gọn 64px, hover thì giãn ra dạng overlay, ☰ để ghim mở. Label dùng `opacity` + `pointer-events`.
- **Chat giữa**: chỉ có bubble, file preview gọn, và notice 1 dòng kèm link mở đúng tab bên phải. Không còn card nghiệp vụ.
- **Bảo vệ dự án (panel phải)**: Status Header cố định (dự án, tiền, hai bên, phí mô phỏng, *Việc cần làm*) + 5 tab chi tiết.
  Mặc định mở *Milestones*; nếu có tranh chấp mở thì tab *Tranh chấp* tự lên đầu và được chọn, header giữa hiện *Xem tranh chấp*, rail có badge đỏ.
  Badge chỉ dành cho việc cần làm: cam = chờ người xem xử lý, đỏ = tranh chấp.
- **Màu**: vàng chỉ là accent (logo, nút hành động chính, chấm active). Còn lại dùng ngà/xám.

## Luồng demo

Nút **Demo** ở rail trái cho phép nhảy thẳng tới từng cảnh và đổi vai **Business / Freelancer**:

Đề xuất Replyn **không** được tạo trong Replyn: doanh nghiệp gửi đề xuất từ cuộc trò chuyện trên Nova Business,
freelancer chấp nhận hoặc từ chối trên Nova Mobile. Replyn chỉ mở workspace của thỏa thuận đã được chấp nhận; lịch sử
Nova Chat trong dữ liệu mẫu chỉ để xem.

1. **Thỏa thuận từ Nova**: workspace mở từ đề xuất đã chấp nhận, hai bên xem và *Xác nhận thỏa thuận*.
2. **Workspace & milestone**: thỏa thuận đã xác nhận, M1 *Đã ký quỹ (mô phỏng)*.
3. **Nộp sản phẩm**: chat chỉ có bubble file gọn + notice; SHA-256 nằm trong tab Files.
4. **Tranh chấp**: yêu cầu sửa, nộp lại v2, mở tranh chấp, *Đội ngũ Nova* review.
5. **Quyết định & bằng chứng**: chia 600/400, phí mô phỏng, timeline *Bằng chứng dự án*.

## Workspace thật từ Nova

- `/workspace/{workspaceId}`: id mờ do Nova cấp khi freelancer chấp nhận đề xuất. Chưa đăng nhập thì chuyển sang
  `/auth/nova?returnTo=/workspace/{id}` (Business dùng Nova ID, Talent quét QR) rồi quay lại đúng workspace.
- `GET /api/workspaces` và `GET /api/workspaces/{id}`: server Replyn đọc danh tính từ cookie phiên và hỏi Nova
  (`POST /api/v1/integrations/replyn/workspaces/lookup`, cùng `REPLYN_QR_CLIENT_SECRET`). Workspace không tồn tại và
  workspace của người khác đều trả 404; trình duyệt không nhận mã hồ sơ nội bộ.
- Danh tính thật ngồi ghế riêng (`nova-me`), không dùng ghế mẫu `u-ha` / `u-khoa`. Talent đăng nhập bằng QR mà không có
  `returnTo` sẽ được mở workspace được chấp nhận gần nhất, nếu có.
- Giới hạn: thỏa thuận, milestone và hai bên đến từ Nova; các thao tác trong workspace (xác nhận thỏa thuận, nộp sản
  phẩm, nghiệm thu, nhật ký) vẫn là mô phỏng trong từng trình duyệt, chưa đồng bộ giữa hai bên.

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
