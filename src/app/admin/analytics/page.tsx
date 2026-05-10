import { auth } from "@/lib/auth";

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-red-900">{title}</h1>
      <p className="mt-2 text-sm text-red-700">{message}</p>
    </div>
  );
}

export default async function Page() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return <ErrorState title="Access denied" message="You must sign in as an admin to view analytics." />;
    }

    return (
      <div className="rounded-[28px] border border-[#eadbcc] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#5b3418]">Analytics</h1>
        <p className="mt-2 text-sm text-neutral-600">Analytics dashboards will come after menu and order flows are in place.</p>
      </div>
    );
  } catch (error) {
    return <ErrorState title="Analytics unavailable" message="Something went wrong while loading analytics. Please try again." />;
  }
}
