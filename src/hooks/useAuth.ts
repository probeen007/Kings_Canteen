"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { clientCache } from "@/lib/clientCache";

export function useAuth() {
	const { data, status } = useSession();
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		if (status === "unauthenticated" && pathname !== "/login" && pathname !== "/register") {
			router.replace("/login");
		}
	}, [status, pathname, router]);

	const role = data?.user?.role;

	return {
		user: data?.user ?? null,
		role,
		isAdmin: role === "ADMIN",
		isStaff: role === "STAFF" || role === "ADMIN",
		isLoading: status === "loading",
		signOut: async (options?: Parameters<typeof signOut>[0]) => {
			clientCache.clearAll();
			return signOut(options);
		},
	};
}