import Link from "next/link";
import { currentUser } from "@/lib/auth";
import BrandMark from "./BrandMark";
import LogoutButton from "./LogoutButton";

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
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/login" className="btn btn-ghost">
              Sign in
            </Link>
            <Link href="/register" className="btn btn-gold">
              Get a badge
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
