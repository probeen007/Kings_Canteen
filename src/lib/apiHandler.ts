import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { Prisma } from "@prisma/client";
import { getToken } from "next-auth/jwt";

import { auth } from "@/lib/auth";
import { AppError, AuthError, ValidationError } from "@/lib/errors";

export type Role = "USER" | "STAFF" | "ADMIN";

type HandlerContext<T> = {
  requestId: string;
  user: { id: string; role: Role } | null;
  body: T | null;
  params?: Record<string, string>;
};

type HandlerOptions<T> = {
  roles?: Role[];
  schema?: ZodSchema<T>;
  requireAuth?: boolean;
};

type RouteContext = { params?: Record<string, string> | Promise<Record<string, string>> };

export function apiHandler<TBody, TResult>(
  handler: (request: Request, context: HandlerContext<TBody>) => Promise<TResult>,
  options: HandlerOptions<TBody> = {}
) {
  return async function wrapped(request: Request, context?: RouteContext) {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const method = request.method;

    try {
      const cookieHeader = request.headers.get("cookie") ?? "";
      const cookieNames = process.env.NODE_ENV === "production"
        ? [
            "__Secure-next-auth.session-token",
            "next-auth.session-token",
            "__Secure-authjs.session-token",
            "authjs.session-token",
          ]
        : [
            "next-auth.session-token",
            "authjs.session-token",
            "__Secure-next-auth.session-token",
            "__Secure-authjs.session-token",
          ];

      let token: any = null;
      for (const cookieName of cookieNames) {
        token = await getToken({
          req: { headers: { cookie: cookieHeader } } as any,
          secret: process.env.NEXTAUTH_SECRET,
          cookieName,
        });
        if (token?.id || token?.role) break;
      }
      const session = token?.id && token?.role
        ? { user: { id: token.id as string, role: token.role as Role } }
        : await auth();
      const user =
        session?.user?.id && session?.user?.role
          ? { id: session.user.id as string, role: session.user.role as Role }
          : null;

      // Diagnostic logging to help debug missing auth tokens during dev.
      const debug = process.env.DEBUG_API_AUTH === "1" || process.env.NODE_ENV !== "production";
      if (debug) {
        const hasNextAuthCookie = /next-auth(?:\.session-token|\.callback)?.*/i.test(cookieHeader);
        console.info("api:auth-debug", {
          path: url.pathname,
          cookieLength: cookieHeader.length,
          hasNextAuthCookie,
          tokenIdPresent: !!token?.id,
          tokenRolePresent: !!token?.role,
          sessionUserId: session?.user?.id ?? null,
          sessionUserRole: session?.user?.role ?? null,
        });
      }

      if ((options.requireAuth || options.roles) && !user) {
        throw new AuthError("Unauthenticated", "AUTH_001");
      }

      if (options.roles && user && !options.roles.includes(user.role)) {
        throw new AppError("Forbidden", 403, "AUTH_005");
      }

      let parsedBody: TBody | null = null;
      if (options.schema) {
        if (method === "GET") {
          const params: Record<string, string> = {};
          for (const [key, value] of url.searchParams.entries()) {
            params[key] = value;
          }
          parsedBody = options.schema.parse(params);
        } else {
          const json = await request.json().catch(() => null);
          parsedBody = options.schema.parse(json);
        }
      }

      const routeParams = context?.params
        ? await Promise.resolve(context.params as Record<string, string> | Promise<Record<string, string>>)
        : undefined;

      const data = await handler(request, {
        requestId,
        user,
        body: parsedBody,
        params: routeParams,
      });
      const response = NextResponse.json({ success: true, data }, { status: 200 });
      const duration = Date.now() - startedAt;
      response.headers.set("X-Request-ID", requestId);
      response.headers.set("X-Response-Time", `${duration}ms`);
      console.info("api", { method, path: url.pathname, status: 200, duration, userId: user?.id, requestId });
      return response;
    } catch (error) {
      const duration = Date.now() - startedAt;
      let status = 500;
      let code = "SERVER_ERROR";
      let message = "Internal server error";
      let details: unknown = undefined;

      console.error("api:error", {
        method,
        path: url.pathname,
        requestId,
        error,
      });

      if (error instanceof ZodError) {
        status = 400;
        code = "VALIDATION";
        message = "Validation error";
        details = error.flatten();
      } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          status = 409;
          code = "DUPLICATE";
          const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(", ") : String(error.meta?.target ?? "field");
          message = `Duplicate ${target}`;
        }
      } else if (error instanceof ValidationError) {
        status = error.statusCode;
        code = error.code;
        message = error.message;
        details = error.details;
      } else if (error instanceof AppError) {
        status = error.statusCode;
        code = error.code;
        message = error.message;
        details = error.details;
      }

      const response = NextResponse.json(
        { success: false, error: message, code, details },
        { status }
      );
      if (status === 429 && typeof details === "object" && details !== null) {
        const retryAfter = (details as { retryAfterSeconds?: number }).retryAfterSeconds;
        if (retryAfter) {
          response.headers.set("Retry-After", String(retryAfter));
        }
      }
      response.headers.set("X-Request-ID", requestId);
      response.headers.set("X-Response-Time", `${duration}ms`);
      console.info("api", { method, path: url.pathname, status, duration, requestId });
      return response;
    }
  };
}
