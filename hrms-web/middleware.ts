import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

const LOGIN_PATH = "/login";
const SELECT_WORKSPACE_PATH = "/select-workspace";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (pathname === LOGIN_PATH) {
    if (hasSession) {
      return NextResponse.redirect(new URL(SELECT_WORKSPACE_PATH, request.url));
    }
    return NextResponse.next();
  }

  if (pathname === SELECT_WORKSPACE_PATH) {
    if (!hasSession) {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
