# Replyn Web — MVP demo

> Replyn giúp hai bên tin nhau để làm việc: chat, thỏa thuận dự án, milestone và bằng chứng ở cùng một nơi.

Web demo UI/UX của Replyn. Bố cục học theo WhatsApp Web, mật độ tin nhắn học theo Telegram, theme vàng-đen.
**Chưa có backend:** dữ liệu là dữ liệu mẫu, lưu trong trình duyệt. Ký quỹ, phí và giải ngân đều là mô phỏng;
Replyn không giữ tiền thật. Bản này chạy độc lập, không còn phụ thuộc Nova hay Supabase.

## Chạy

```powershell
cd replyn-web
npm install
npm run dev          # http://localhost:3000
npm run typecheck; npm run lint; npm test; npm run build
```

Chụp màn hình và chạy thử luồng chính (cần `npm run dev` đang chạy và Chrome đã cài):

```powershell
$env:BASE_URL="http://localhost:3000"; npm run screens   # ảnh lưu ở ./screenshots
```

## Đăng nhập bằng tài khoản mẫu

Trang `/login`, mật khẩu chung `replyn2026`:

| Email | Tên | Vai trò |
| --- | --- | --- |
| `ha@moccoffee.vn` | Trần Thu Hà | Doanh nghiệp |
| `khoa@replyn.dev` | Lê Minh Khoa | Freelancer |
| `yen@studioyen.vn` | Lê Hoàng Yến | Doanh nghiệp |

- `POST /api/auth/login` kiểm tra email + mật khẩu, đặt cookie `replyn_session` (HttpOnly, SameSite=Lax, 7 ngày, ký
  HMAC-SHA256). `POST /api/auth/logout` xóa cookie, `GET /api/auth/session` trả tài khoản hiện tại.
- Vai trò và "mình là ai" trong dữ liệu luôn theo tài khoản đăng nhập, không đổi được trong app.
- Dữ liệu demo dùng chung cho các tài khoản trên cùng một trình duyệt: đăng xuất rồi đăng nhập tài khoản bên kia là
  thấy đúng dự án vừa làm. Trình duyệt khác thì không thấy (chưa có backend).
- Biến môi trường duy nhất: `REPLYN_SESSION_SECRET` (≥ 32 ký tự, xem `.env.example`). Bắt buộc trên production; khi
  chạy máy mà bỏ trống thì dùng khóa dev cố định.

## IA: tách lớp Chat và lớp Protection

- **Rail trái**: thu gọn 64px, hover thì giãn ra dạng overlay, ☰ để ghim mở. Label dùng `opacity` + `pointer-events`.
- **Chat giữa**: chỉ có bubble, file preview gọn, và notice 1 dòng kèm link mở đúng tab bên phải. Không còn card nghiệp vụ.
- **Bảo vệ dự án (panel phải)**: Status Header cố định (dự án, tiền, hai bên, phí mô phỏng, *Việc cần làm*) + 5 tab chi tiết.
  Mặc định mở *Milestones*; nếu có tranh chấp mở thì tab *Tranh chấp* tự lên đầu và được chọn, header giữa hiện *Xem tranh chấp*, rail có badge đỏ.
  Badge chỉ dành cho việc cần làm: cam = chờ người xem xử lý, đỏ = tranh chấp.
- **Màu**: vàng chỉ là accent (logo, nút hành động chính, chấm active). Còn lại dùng ngà/xám.

## Luồng demo

1. **Mở dự án**: trong chat trực tiếp chưa có dự án, doanh nghiệp bấm **+ → Mở dự án**, đặt tên và các giai đoạn.
2. **Xác nhận thỏa thuận**: hai bên rà lại trong tab Thỏa thuận và *Hai bên xác nhận thỏa thuận*.
3. **Ký quỹ & nộp sản phẩm**: ký quỹ mô phỏng, freelancer kéo thả file vào chat để nộp (SHA-256 tính ngay trên trình
   duyệt, xem ở tab Files).
4. **Tranh chấp**: yêu cầu sửa, nộp lại v2, mở tranh chấp, *Đội hỗ trợ Replyn* xem xét.
5. **Quyết định & bằng chứng**: chia tiền, phí mô phỏng, timeline *Bằng chứng dự án*.

Nút **Demo** ở rail trái có tài khoản đang đăng nhập, du hành thời gian, các cảnh dựng sẵn và đặt lại demo.

## Dấu vân tay và kiểm chứng thỏa thuận

Bản trước niêm phong mã băm lên Solana devnet; bản này **giữ mã băm, bỏ chuỗi khối**:

- Khi hai bên xác nhận, thỏa thuận (tên dự án, các giai đoạn, số tiền, hạn, tên hai bên, phiên bản) được chuẩn hóa và
  băm SHA-256 (`src/lib/agreement/agreement.ts`). Đổi phạm vi thì phiên bản tăng và dấu vân tay đổi theo.
- Tải bản PDF (tiếng Việt/Anh) hoặc JSON: server ký xác nhận HMAC-SHA256 trên (mã workspace, dấu vân tay, thời điểm)
  bằng `REPLYN_SESSION_SECRET` (`POST /api/agreements/receipt`, chỉ một trong hai bên được xin). Chữ ký và dữ liệu gốc
  được đính kèm trong PDF.
- Trang công khai `/verify`: thả file PDF/JSON vào, server tính lại mã băm và kiểm chữ ký
  (`POST /api/agreements/verify`): **đúng bản gốc**, **file đã bị sửa**, **chữ ký không hợp lệ** hoặc **chưa có xác
  nhận**. File không được lưu lại.
- Giới hạn: đổi `REPLYN_SESSION_SECRET` thì các file cũ báo chữ ký không hợp lệ. Chữ ký chứng minh Replyn đã xác nhận
  nội dung, nhưng khác chuỗi khối, người ngoài không tự kiểm được nếu không hỏi server Replyn.

Kiểm thử: `npm run test:agreement` (PDF, dấu vân tay, chữ ký, phiên đăng nhập), `npm run test:workspace` (reducer).

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
