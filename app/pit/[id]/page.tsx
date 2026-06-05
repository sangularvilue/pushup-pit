import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import EventDesk from "@/components/EventDesk";
import SiteHeader from "@/components/SiteHeader";
import Ticker from "@/components/Ticker";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  return (
    <>
      <Ticker />
      <SiteHeader />
      <main>
        <EventDesk id={id} />
      </main>
    </>
  );
}
