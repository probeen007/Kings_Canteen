import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
	prisma?: PrismaClient;
};

const clientOptions: ConstructorParameters<typeof PrismaClient>[0] = {
	log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
};

const resolveDatasourceUrl = () => {
	let url = process.env.DATABASE_URL;
	if (process.env.DIRECT_URL && process.env.FORCE_DIRECT_URL === "true") {
		url = process.env.DIRECT_URL;
	}

	if (!url) {
		return undefined;
	}

	const parsed = new URL(url);
	const isPooler = parsed.host.includes("pooler.supabase.com");
	const disablePreparedStatements =
		process.env.DISABLE_PREPARED_STATEMENTS === "true" || process.env.NODE_ENV === "development";

	if (disablePreparedStatements || isPooler) {
		parsed.searchParams.set("pgbouncer", "true");
		parsed.searchParams.set("statement_cache_size", "0");
	}

	if (isPooler) {
		parsed.searchParams.set("connection_limit", "1");
		if (!parsed.searchParams.has("sslmode")) {
			parsed.searchParams.set("sslmode", "require");
		}
	}

	return parsed.toString();
};

const datasourceUrl = resolveDatasourceUrl();
if (datasourceUrl) {
	(clientOptions as any).datasources = { db: { url: datasourceUrl } };
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient(clientOptions);

if (process.env.NODE_ENV === "development") {
	globalForPrisma.prisma = prisma;
}