import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";
import SiteHeader from "@/components/SiteHeader";
import Ticker from "@/components/Ticker";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect("/pit");
  return (
    <>
      <Ticker />
      <SiteHeader />
      <main>
        <AuthForm mode="login" />
      </main>
    </>
  );
}
