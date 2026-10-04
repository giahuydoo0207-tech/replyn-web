import { handleLogout, liveAuthDeps } from "@/lib/auth/server/novaBusinessAuth";

export function POST(request: Request) {
  return handleLogout(request, liveAuthDeps());
}
