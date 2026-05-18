import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Login",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
