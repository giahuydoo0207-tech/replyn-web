# Báo cáo bàn giao Replyn (replyn-web) cho AI tiếp quản

> Tài liệu này viết cho trợ lý AI (Claude Code, Cursor, Antigravity...) đọc trước khi làm việc trên repo.
> Đọc hết một lần, rồi đọc lại mục 4–6 trước khi sửa phần đăng nhập hoặc thỏa thuận.
> Ngày viết: 17/10/2026. Người bàn giao: Huy (Đỗ Gia Huy).

---

## 1. Bối cảnh ngắn

- Replyn là web demo cho freelancer và doanh nghiệp làm việc với nhau: chat, mở dự án, chốt thỏa thuận, chia giai đoạn
  (milestone), ký quỹ mô phỏng, nộp sản phẩm, yêu cầu sửa, tranh chấp và nhật ký bằng chứng.
- Trước đây Replyn gắn với **Nova** (một sản phẩm khác, lo đăng nhập và tạo đề xuất) và có tài liệu dự kiến dùng
  **Supabase**. Dự án Nova đã dừng, tài khoản Supabase bị khóa.
- Repo đã được viết lại để **chạy độc lập**: không còn Nova, không dùng Supabase, không dùng blockchain.
- Hướng phát triển tiếp theo do người tiếp quản quyết định. Tài liệu này chỉ mô tả hiện trạng và những chỗ dễ làm hỏng.

## 2. Trạng thái repo

| Mục | Giá trị |
| --- | --- |
| GitHub | `giahuydoo0207-tech/replyn-web` |
| Nhánh chứa bản viết lại | `feat/standalone-without-nova` |
| Pull request | #10 "Tách Replyn khỏi Nova: tài khoản mẫu, giữ mã băm, bỏ Solana" (chưa merge) |
| `main` | vẫn là bản cũ có Nova + Solana cho tới khi merge PR #10 |

**Việc đầu tiên:** kiểm tra PR #10 đã merge chưa. Nếu chưa, làm việc trên nhánh `feat/standalone-without-nova`
hoặc merge trước. Đừng phát triển tiếp trên `main` cũ.

## 3. Stack và lệnh

- **Next.js 16.3.8** (App Router, Turbopack), **React 19.2.8**, **TypeScript**, **Tailwind CSS v4** (token màu trong
  `src/app/globals.css`: `bg-app`, `bg-panel`, `bg-rail`, `text-ink`, `text-ink-2`, `text-muted`, accent `yellow`).
- `lucide-react` (icon), `pdf-lib` + `@pdf-lib/fontkit` (tạo PDF), `qrcode-generator` (QR trong PDF).
- Node 22 (đã kiểm tra trên 22.22).

```bash
npm install
npm run dev            # http://localhost:3000
npx next typegen       # sinh kiểu PageProps/LayoutProps, chạy trước typecheck nếu thêm route mới
npm run typecheck
npm run lint
npm test               # node --test, 37 test
npm run build
npm run screens        # Playwright + Chrome cài sẵn, cần dev server đang chạy, BASE_URL tùy chọn
```

### Next.js 16 khác bản bạn biết

`AGENTS.md` trong repo yêu cầu đọc `node_modules/next/dist/docs/` trước khi viết code. Những điểm đã gặp:

- `middleware.ts` đổi tên thành `proxy.ts` (repo hiện **không** dùng proxy; bảo vệ trang làm trong Server Component).
- `cookies()` và `headers()` là **async**.
- Chạy `npx next typegen` để có kiểu cho `PageProps`/`LayoutProps`.
- Font Inter lấy từ Google Fonts bằng `next/font/google`. Môi trường không ra được Internet sẽ build lỗi; đó là lỗi
  mạng, không phải lỗi code.

## 4. Kiến trúc

```
src/
  app/
    page.tsx                   trang chính: chưa đăng nhập -> redirect /login
    login/                     trang đăng nhập + LoginForm (danh sách tài khoản mẫu)
    verify/page.tsx            trang công khai kiểm chứng thỏa thuận
    api/auth/login|logout|session/route.ts
    api/agreements/receipt|verify/route.ts
    globals.css, layout.tsx
  lib/
    types.ts                   Workspace, Milestone, Message, Conversation, EvidenceEvent...
    reducer.ts                 TOÀN BỘ nghiệp vụ (mỗi hành động sinh tin nhắn hệ thống + sự kiện bằng chứng)
    seed.ts                    dữ liệu mẫu + các cảnh demo (SCENES 1–5)
    store.tsx                  StoreProvider: useReducer + lưu localStorage + tài khoản đăng nhập
    auth/accounts.ts           3 tài khoản mẫu, mật khẩu chung
    auth/session.ts            ký/kiểm cookie phiên (server-only, node:crypto)
    auth/currentAccount.ts     đọc tài khoản trong Server Component
    agreement/agreement.ts     chuẩn hóa thỏa thuận + SHA-256 (chạy cả browser và server)
    agreement/fromWorkspace.ts dựng thỏa thuận từ workspace đã xác nhận
    agreement/receipt.ts       chữ ký xác nhận HMAC (server-only)
    agreement/pdf.ts           PDF thỏa thuận vi/en, đính kèm JSON gốc, trang "Chứng nhận xác thực"
    disputePack.ts / disputePackPdf.ts  hồ sơ hỗ trợ (tranh chấp)
    scopeChange.ts             đề xuất thay đổi phạm vi, phiên bản thỏa thuận
    reminders.ts, protection.ts, fees.ts, archive.ts, preview.ts, format.ts
  components/
    ReplynApp.tsx, Rail.tsx (menu Demo), ChatList.tsx, NavigationMenu.tsx, AccountCard.tsx
    chat/ChatView.tsx, chat/Messages.tsx, chat/OpenProjectDialog.tsx
    panel/ (tab Thỏa thuận, Tiến độ, Sản phẩm, Nhật ký, Hỗ trợ, Lưu trữ; AgreementCard; ScopeChange)
    verify/ (VerifyPage, TechDetails, Emblem)
tests/
  workspace/*.test.mjs         reducer, reminders, scope change, dispute pack
  agreement/*.test.mjs         PDF, mã băm, chữ ký, phiên đăng nhập
  workspace/ts-resolve.mjs     loader để node --test import được file .ts
```

**Chưa có backend và cơ sở dữ liệu.** Mọi dữ liệu chat/dự án là reducer phía client. Server chỉ làm 2 việc:
xác thực phiên đăng nhập và ký/kiểm chữ ký thỏa thuận.

## 5. Đăng nhập

- Trang `/login`, mật khẩu chung `replyn2026`:

| Email | Tên | Vai trò | id trong dữ liệu |
| --- | --- | --- | --- |
| `ha@moccoffee.vn` | Trần Thu Hà | business | `u-ha` |
| `khoa@replyn.dev` | Lê Minh Khoa | freelancer | `u-khoa` |
| `yen@studioyen.vn` | Lê Hoàng Yến | business | `u-yen` |

- `POST /api/auth/login` `{email, password}` → so mật khẩu bằng so sánh an toàn thời gian, đặt cookie
  `replyn_session` (HttpOnly, SameSite=Lax, 7 ngày, `Secure` khi chạy https). Lỗi: 401 `invalid_credentials`,
  400, 413, 503 `not_configured`.
- Token = `base64url(payload).base64url(HMAC-SHA256)`, payload `{uid, exp}`, khóa `REPLYN_SESSION_SECRET`.
- `POST /api/auth/logout` (204, xóa cookie), `GET /api/auth/session` (tài khoản hoặc 401).
- Vai trò và "mình là ai" luôn theo tài khoản đăng nhập: hàm `seat()` trong `store.tsx` ép `role` và
  `roleUser[role] = account.id` sau mỗi action. Trong app **không còn** nút đổi vai.
- `currentAccount()` gọi `cookies()` **trước** khi đọc secret. Đừng đảo thứ tự: nếu đảo, lúc build thiếu secret thì
  `/` và `/login` bị prerender tĩnh và luôn redirect.

**Đây là đăng nhập demo**, không phải hệ thống tài khoản thật: mật khẩu nằm trong code, không có đăng ký, không giới
hạn số lần thử. Thay bằng auth thật trước khi có người dùng thật.

## 6. Mã băm và kiểm chứng thỏa thuận (quan trọng)

Bản cũ ghi mã băm thỏa thuận lên Solana devnet. Bản này **giữ mã băm, bỏ chuỗi khối**:

1. **Mã băm file:** file nộp sản phẩm được băm SHA-256 ngay trên trình duyệt (`sha256Hex` trong `format.ts`), hiện
   ở tab Sản phẩm. File trong dữ liệu mẫu dùng mã giả (`mockHash`).
2. **Dấu vân tay thỏa thuận:** khi hai bên xác nhận (`LOCK_TERMS`), `agreementFromWorkspace()` dựng bản thỏa thuận:
   tên dự án, phạm vi, các giai đoạn (tên, số tiền, hạn), tổng tiền, số lần sửa, số ngày nghiệm thu, tên hai bên,
   `version`, `acceptedAt`. `canonicalJson()` cố định thứ tự trường, chuẩn hóa NFC, rồi băm SHA-256.
   Đổi phạm vi được đồng ý → `version` tăng → dấu vân tay đổi.
3. **Chữ ký xác nhận:** khi người dùng tải PDF/JSON, client gọi `POST /api/agreements/receipt` (phải đăng nhập và tên
   tài khoản phải là một trong hai bên). Server trả
   `receipt = { hash, signedAt, signature }`, với `signature = HMAC-SHA256(REPLYN_SESSION_SECRET,
   "replyn-agreement-receipt-v1.{workspaceId}.{hash}.{signedAt}")`.
4. **File tải về:** `{ format: "replyn-agreement/2", agreement, receipt }`. PDF đính kèm đúng JSON này (tên
   `thoa-thuan-replyn.json`) để trang kiểm chứng đọc lại.
5. **Kiểm chứng:** `/verify` đọc PDF hoặc JSON, gửi `POST /api/agreements/verify`. Kết quả:
   - `match`: chữ ký thật, nội dung khớp → "Đúng bản gốc"
   - `modified`: chữ ký thật nhưng nội dung đã sửa → "File đã bị sửa"
   - `invalid`: chữ ký không do server này cấp (giả, sai workspace, hoặc đã đổi khóa) → "Chữ ký không hợp lệ"
   - `unsigned`: không có phần xác nhận → "Chưa có xác nhận của Replyn"

**Giới hạn cần biết:**
- Đổi `REPLYN_SESSION_SECRET` thì **mọi file đã tải trước đó báo "Chữ ký không hợp lệ"**, và mọi người bị đăng xuất.
  Nếu sau này muốn tách khóa ký thỏa thuận khỏi khóa phiên, thêm biến riêng và cập nhật `receipt.ts` + route.
- Server ký đúng nội dung client gửi lên (chưa có cơ sở dữ liệu để đối chiếu). Khi có backend, server nên tự dựng
  thỏa thuận từ dữ liệu của mình thay vì tin client.
- Khác blockchain, người ngoài không tự kiểm được nếu không gọi server Replyn.
- Trong demo, giờ chốt thỏa thuận theo đồng hồ demo còn giờ ký theo giờ thật, nên nhật ký trong PDF có thể lệch vài phút.

## 7. Dữ liệu và luồng demo

- Dữ liệu demo lưu trong `localStorage` key `replyn-demo-state-v2`, **dùng chung cho mọi tài khoản trên cùng trình
  duyệt**: Hà làm xong, đăng xuất, đăng nhập Khoa là thấy cùng dự án. Trình duyệt/máy khác không thấy.
  Đổi cấu trúc `AppState` thì tăng số phiên bản của key để không đọc dữ liệu cũ hỏng.
- Chat trực tiếp hiện tên người còn lại theo người xem (`chatFace()` trong `reducer.ts`).
- **Mở dự án:** trong chat trực tiếp chưa có dự án, tài khoản business bấm **+ → Mở dự án** (`OpenProjectDialog`) →
  `CREATE_WORKSPACE` với `fromChat` → workspace chưa xác nhận → hai bên bấm *Hai bên xác nhận thỏa thuận*.
- Luồng tiếp: ký quỹ (mô phỏng) → freelancer nộp sản phẩm (kéo thả file vào chat) → nghiệm thu / yêu cầu sửa →
  tranh chấp → `TEAM_REVIEW` (Đội hỗ trợ Replyn) → quyết định chia tiền → giải ngân (mô phỏng).
- Menu **Demo** ở rail trái: tài khoản đang đăng nhập + đăng xuất, du hành thời gian, 5 cảnh dựng sẵn, đặt lại demo.
- Tiền, ký quỹ, phí (BASIC 7% / ADVANCED 10%) đều là **mô phỏng**, không có thanh toán thật.

## 8. Biến môi trường

Chỉ một biến, chỉ ở server (không dùng tiền tố `NEXT_PUBLIC_`):

```
REPLYN_SESSION_SECRET=   # ≥ 32 ký tự ngẫu nhiên
# tạo: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

- Production thiếu biến này → không đăng nhập được (503) và không ký/kiểm được thỏa thuận.
- Chạy máy (không phải production) mà bỏ trống → dùng khóa dev cố định trong `session.ts`.
- Không commit `.env*` thật, không in khóa ra log.

## 9. Đã gỡ khỏi repo (đừng thêm lại nếu không có lý do)

- Đăng nhập Nova (Nova ID + Nova Key, mã QR Nova Mobile), route `/auth/nova`, `/workspace/[id]`, `/api/workspaces`,
  `/api/seal/*`, `/api/auth/nova/*`.
- Niêm phong Solana (`@solana/kit`, `@solana-program/memo`), script tạo ví, `jsqr`, tài liệu Nova–Supabase.
- Các tên cũ đã đổi: `NOVA_TEAM_ID` → `TEAM_ID` (`"replyn-team"`), `NOVA_REVIEW` → `TEAM_REVIEW`,
  `sourceNovaChatId` → `sourceChatId`, `lib/seal` → `lib/agreement`, `components/seal` → `components/verify`,
  `SealCard` → `AgreementCard`. Hội thoại kiểu `"nova"` → `"direct"` (`dm-khoa`, `dm-quan`, `dm-yen`).

Kiểm tra nhanh còn sót: `grep -rni "nova\|solana\|seal/" src tests scripts` (chỉ còn tên class CSS `seal-press`,
`seal-reveal` là bình thường).

## 10. Quy ước khi sửa code

- Giao diện và chuỗi hiển thị bằng **tiếng Việt**, có dấu. PDF có bản tiếng Anh (`T.en` trong `pdf.ts`).
- Nghiệp vụ mới viết thành action trong `reducer.ts` (hàm thuần), kèm tin nhắn hệ thống và sự kiện bằng chứng nếu
  hành động có ý nghĩa với hai bên. Thêm test trong `tests/workspace/`.
- Code dùng chung browser/server (`agreement.ts`, `pdf.ts`) **không** import `node:*`. Code dùng khóa bí mật
  (`session.ts`, `receipt.ts`) **chỉ** import ở route handler / Server Component.
- Không đổi định dạng `canonicalJson` hoặc `AGREEMENT_FORMAT` mà không tăng phiên bản (`replyn-agreement/3`), vì file
  người dùng đã tải sẽ không còn khớp.
- Trước khi commit: `npx next typegen && npm run typecheck && npm run lint && npm test && npm run build`.
- Không commit secret. Không chạy `npm audit fix --force`. Không đẩy thẳng lên `main`; làm nhánh + PR.

## 11. Việc nên làm tiếp (gợi ý, chưa ai làm)

1. Merge PR #10, deploy (ví dụ Vercel) với `REPLYN_SESSION_SECRET`.
2. Backend + cơ sở dữ liệu thật để hai bên trên hai máy thấy cùng dữ liệu; khi đó server tự dựng thỏa thuận để ký.
3. Auth thật (đăng ký, mật khẩu băm, giới hạn số lần thử) thay cho tài khoản mẫu.
4. Tách khóa ký thỏa thuận khỏi khóa phiên, hỗ trợ xoay khóa (giữ khóa cũ để kiểm file cũ).
5. Chạy lại `npm run screens` trên máy có Chrome (script đã sửa theo luồng đăng nhập mới nhưng chưa chạy được trong
   môi trường bàn giao).

## 12. Đã kiểm tra lúc bàn giao

- typecheck, lint, 37 test, `next build` đều qua.
- Chạy thử trên trình duyệt bản build: đăng nhập sai bị từ chối; đăng nhập Hà; mở dự án từ chat với Đỗ Minh Quân;
  xác nhận thỏa thuận "Landing page Mộc Coffee"; tải PDF và JSON có chữ ký; `/verify` báo đúng với file gốc, "đã bị
  sửa" với JSON đổi số tiền, "chưa có xác nhận" với JSON bỏ chữ ký; đăng xuất; đăng nhập Khoa thấy thỏa thuận đã xác
  nhận; gọi API ký khi chưa đăng nhập bị 401.
