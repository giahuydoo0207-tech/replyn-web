# Replyn Web — MVP demo (UniHackFest 10/10/2026)

> Nova giúp hai bên gặp nhau. Replyn giúp hai bên tin nhau để làm việc.

Web demo UI/UX của Replyn: chat + workspace + milestone + bằng chứng dự án. Bố cục học theo WhatsApp Web,
mật độ tin nhắn học theo Telegram, theme vàng-đen. **Toàn bộ dữ liệu là mock, chưa có backend.**
Cấp vốn, giải ngân và phí vận hành đều là mô phỏng. Replyn không custody tiền thật.

## Chạy

```powershell
cd D:\replyn-web
npm install
npm run dev          # http://localhost:3000
```

Chụp màn hình các cảnh demo và chạy thử luồng chính (cần `npm run dev` đang chạy và Chrome đã cài):

```powershell
$env:BASE_URL="http://localhost:3000"; npm run screens   # ảnh lưu ở ./screenshots
```

## Luồng demo

Nút **Demo** ở rail trái cho phép nhảy thẳng tới từng cảnh và đổi vai **Business / Freelancer**:

1. **Nova Chat**: phỏng vấn xong, menu `+` chỉ có *Gửi tệp · Gửi ảnh · Đề xuất Replyn*.
2. **Đề xuất Replyn**: proposal card, CTA *Mở Replyn / Để sau*.
3. **Workspace & milestone**: điều khoản đã khóa (ghim), M1 *Đã cấp vốn (mô phỏng)*.
4. **Nộp sản phẩm**: file card có SHA-256 và version, trạng thái *Đang chờ nghiệm thu*.
5. **Tranh chấp**: yêu cầu sửa, nộp lại v2, mở tranh chấp, *Đội ngũ Nova* review.
6. **Quyết định & bằng chứng**: chia 600/400, phí mô phỏng, timeline *Bằng chứng dự án*.

Mọi bước cũng làm được bằng thao tác thật: kéo thả file vào khung chat để nộp sản phẩm (hash tính ngay trên
trình duyệt), nút trên milestone card, panel phải (Milestones · Bằng chứng · Files · Tranh chấp).

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
    chat/              ChatView (header, banner, ghim, composer), Messages (bubble kiểu Telegram + card nghiệp vụ)
    panel/             Milestones, Bằng chứng dự án, Files, Tranh chấp + mô phỏng phí
    actions.tsx        dialog Nộp sản phẩm / Yêu cầu sửa / Mở tranh chấp
public/pattern.svg     doodle line-icon cho nền chat (tự vẽ, không dùng asset WhatsApp/Telegram)
```

Không copy logo, icon, brand hay code của WhatsApp/Telegram, chỉ học UX pattern. Icon dùng `lucide-react`.
