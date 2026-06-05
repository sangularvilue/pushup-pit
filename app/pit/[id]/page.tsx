import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import EventDesk from "@/components/EventDesk";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  return (
    <main>
      <EventDesk id={id} displayName={user.displayName} />
    </main>
  );
}
