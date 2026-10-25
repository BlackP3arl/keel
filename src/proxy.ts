import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  const path = req.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/api/auth");
  const isDataApi = path.startsWith("/api/desk") || path.startsWith("/api/users");
  const isLogin = path === "/login" || path.startsWith("/login/");

  // Data APIs check the session themselves and must return 401, not a login redirect.
  if (isAuthRoute || isDataApi || isLogin) return NextResponse.next();

  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
