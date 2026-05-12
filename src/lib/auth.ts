import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const credentialsSchema = z.object({
email: z.string().trim().toLowerCase().email(),
password: z.string().min(8).max(128),
portal: z.enum(["user", "admin"]).default("user"),
}).passthrough();

const MAX_FAILED_ATTEMPTS = 10;
const LOCK_TTL_SECONDS = 30 * 60;

async function recordFailedAttempt(identifier: string) {
try {
const failKey = `auth:fail:${identifier}`;
const lockKey = `auth:lock:${identifier}`;
const count = await redis.incr(failKey);
if (count === 1) {
await redis.expire(failKey, LOCK_TTL_SECONDS);
}
if (count >= MAX_FAILED_ATTEMPTS) {
await redis.set(lockKey, "locked", { ex: LOCK_TTL_SECONDS });
}
} catch (err) {
// Redis failed, but continue - auth doesn't depend on rate limiting
}
}

async function clearFailedAttempts(identifier: string) {
try {
const failKey = `auth:fail:${identifier}`;
const lockKey = `auth:lock:${identifier}`;
await redis.del(failKey, lockKey);
} catch (err) {
// Redis failed, but continue
}
}

function logAuth(_msg: string) {
	// Logging disabled to avoid writing auth data to disk.
}

const authConfig: NextAuthConfig = {
	// Ensure NextAuth trusts the host (useful for localhost/dev behind proxies)
	trustHost: true,
	// Explicit secret (also read from env by NextAuth, but set here for clarity)
	secret: process.env.NEXTAUTH_SECRET,
providers: [
Credentials({
name: "Credentials",
credentials: {
email: { label: "Email", type: "email" },
password: { label: "Password", type: "password" },
portal: { label: "Portal", type: "text" },
},
async authorize(credentials) {
try {
const parsed = credentialsSchema.safeParse(credentials);
logAuth(`authorize:after-parse`);
if (!parsed.success) {
logAuth(`authorize:parse-failed ${JSON.stringify(parsed.error.issues)}`);
return null;
}

const email = parsed.data.email;
logAuth(`authorize:email-extract ${email}`);
const identifier = email;
const lockKey = `auth:lock:${identifier}`;

logAuth(`authorize:redis-get-start`);
let isLocked = false;
try {
const lockStatus = await redis.get(lockKey);
isLocked = !!lockStatus;
logAuth(`authorize:redis-get-done ${String(isLocked)}`);
} catch (err) {
logAuth(`authorize:redis-error ${err instanceof Error ? err.message : String(err)}`);
// Continue without rate limiting if Redis fails
isLocked = false;
}

if (isLocked) {
logAuth(`authorize:locked ${identifier}`);
throw new Error("ACCOUNT_LOCKED");
}

logAuth(`authorize:prisma-start`);
const user = await prisma.user.findUnique({
where: { email },
});
logAuth(`authorize:prisma-done ${user ? user.id : 'null'}`);

if (!user || !user.isActive) {
recordFailedAttempt(identifier).catch(() => {});
logAuth(`authorize:user-missing-or-inactive ${identifier}`);
return null;
}

logAuth(`authorize:bcrypt-start`);
const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
logAuth(`authorize:bcrypt-done ${passwordValid}`);
if (!passwordValid) {
recordFailedAttempt(identifier).catch(() => {});
return null;
}

if (parsed.data.portal === "admin" && user.role !== "ADMIN" && user.role !== "STAFF") {
recordFailedAttempt(identifier).catch(() => {});
logAuth(`authorize:not-admin-or-staff ${identifier} (role: ${user.role})`);
return null;
}

if (parsed.data.portal === "user" && user.role !== "USER") {
recordFailedAttempt(identifier).catch(() => {});
logAuth(`authorize:not-user ${identifier} (role: ${user.role})`);
return null;
}

// Clear failed attempts (fire-and-forget to avoid blocking)
clearFailedAttempts(identifier).catch(() => {});
logAuth(`authorize:success ${identifier}`);

return {
id: user.id,
name: user.name,
email: user.email,
role: user.role,
};
	} catch (err) {
		logAuth(`authorize:error ${err instanceof Error ? err.message : String(err)}`);
		// Don't throw here - return null so NextAuth treats as invalid credentials
		// and avoids bubbling an exception that causes a Configuration error redirect.
		return null;
	}
},
}),
],
session: {
strategy: "jwt",
	maxAge: 365 * 24 * 60 * 60,
	updateAge: 24 * 60 * 60,
},
	jwt: {
		maxAge: 365 * 24 * 60 * 60,
	},
	// Explicit cookie settings to avoid secure/SameSite issues in dev
	cookies: {
		sessionToken: {
			name: "next-auth.session-token",
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: process.env.NODE_ENV === "production",
			},
		},
	},
callbacks: {
async jwt({ token, user }) {
		logAuth(`jwt:start user=${user ? user.email : 'null'}`);
		try {
			if (user && user.id) {
				const role = (user as { role?: string }).role;
				token.id = String(user.id);
				if (role) {
					token.role = role as "USER" | "STAFF" | "ADMIN";
				}
				token.name = user.name ?? "";
				logAuth(`jwt:modified-token`);
			}
			logAuth(`jwt:success`);
			return token;
		} catch (err) {
			logAuth(`jwt:error ${err instanceof Error ? err.message : String(err)}`);
			throw err;
		}
	},
	async session({ session, token }) {
		logAuth(`session:start`);
		try {
			if (session.user && token.id && token.role) {
				session.user.id = String(token.id);
				session.user.role = token.role as "USER" | "STAFF" | "ADMIN";
				session.user.name = (token.name as string | null) ?? session.user.name ?? "";
				logAuth(`session:modified`);
			}
			logAuth(`session:success`);
			return session;
		} catch (err) {
			logAuth(`session:error ${err instanceof Error ? err.message : String(err)}`);
			throw err;
		}
	},
},
pages: {
signIn: "/login",
error: "/login",
},
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
