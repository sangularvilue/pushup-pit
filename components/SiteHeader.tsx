import Link from "next/link";
import { currentUser } from "@/lib/auth";
import BrandMark from "./BrandMark";
import LogoutButton from "./LogoutButton";
import ViewTweaks from "./ViewTweaks";

export default async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="site-header">
      <Link href={user ? "/pit" : "/"} className="brand">
        <BrandMark />
        PUSHUP<span className="accent">PIT</span>
      </Link>
      <div className="header-right">
        {user ? (
          <>
            <span className="mono-sub">badge: {user.displayName}</span>
            <ViewTweaks />
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/login" className="btn btn-ghost">
              Sign in
            </Link>
            <Link href="/register" className="btn btn-gold">
              Sign Up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
