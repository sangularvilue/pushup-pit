import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import Ticker from "@/components/Ticker";
import TradingFloor from "@/components/TradingFloor";

export default async function PitPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <>
      <Ticker />
      <SiteHeader />
      <main>
        <TradingFloor />
      </main>
    </>
  );
}
