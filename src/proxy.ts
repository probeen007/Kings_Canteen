import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Proxy for route protection and security headers
function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=()");
  const isProd = process.env.NODE_ENV === "production";
  const scriptSrc = isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`
  );
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isPaymentVerify = pathname === "/api/payment/verify";
  const isPublicMenuApi = pathname === "/api/menu";

  if (isApi && (isAuthApi || isPaymentVerify || isPublicMenuApi)) {
    return withSecurityHeaders(NextResponse.next());
  }

  async function getSessionViaEndpoint(req: NextRequest) {
    try {
      const cookie = req.headers.get("cookie") ?? "";
      const origin = req.nextUrl.origin;
      const resp = await fetch(`${origin}/api/auth/session`, {
        headers: { cookie },
        next: { revalidate: 0 },
      });
      if (!resp.ok) return null;
      return (await resp.json()) as any;
    } catch {
      return null;
    }
  }

  const session = await getSessionViaEndpoint(request);
  const user = session?.user;
  const role = user?.role;
  const isAuthenticated = !!user;

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isStaffLoginPage = pathname === "/staff/login";
  const isAdminLoginPage = pathname === "/admin/login";
  const isAdminRoute = pathname.startsWith("/admin");
  const isStaffRoute = pathname.startsWith("/staff");
  const isUserRoute =
    pathname.startsWith("/menu") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/token");

  // 1. Handle Unauthenticated Users
  if ((isAdminRoute || isStaffRoute || isUserRoute || (isApi && !isAdminApi)) &&
      !isAuthenticated &&
      !isStaffLoginPage &&
      !isAdminLoginPage &&
      !isAuthPage) {
    if (isApi) {
      return withSecurityHeaders(
        NextResponse.json({ success: false, error: "Unauthenticated", code: "AUTH_001" }, { status: 401 })
      );
    }
    const loginUrl = new URL(isAdminRoute ? "/admin/login" : isStaffRoute ? "/staff/login" : "/login", request.url);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  // 2. If it's a login page, allow it to proceed regardless of auth state
  if (isAuthPage || isStaffLoginPage || isAdminLoginPage) {
    return withSecurityHeaders(NextResponse.next());
  }

  // 3. Handle Role-Based Access Control for Authenticated Users
  if (isAdminRoute && role !== "ADMIN") {
    if (isApi) {
      return withSecurityHeaders(
        NextResponse.json({ success: false, error: "Forbidden", code: "AUTH_005" }, { status: 403 })
      );
    }
    return withSecurityHeaders(NextResponse.redirect(new URL("/staff/login", request.url)));
  }

  if (isStaffRoute && role !== "STAFF" && role !== "ADMIN") {
    if (isApi) {
      return withSecurityHeaders(
        NextResponse.json({ success: false, error: "Forbidden", code: "AUTH_005" }, { status: 403 })
      );
    }
    return withSecurityHeaders(NextResponse.redirect(new URL("/login", request.url)));
  }

  if (isUserRoute && role !== "USER") {
    if (isApi) {
      return withSecurityHeaders(
        NextResponse.json({ success: false, error: "Forbidden", code: "AUTH_005" }, { status: 403 })
      );
    }
    return withSecurityHeaders(NextResponse.redirect(new URL("/login", request.url)));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
