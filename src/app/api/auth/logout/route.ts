import { clearSessionCookie, isSecure } from "@/lib/auth/session";

export function POST(request: Request) {
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie(isSecure(request)), "Cache-Control": "no-store" } });
}
