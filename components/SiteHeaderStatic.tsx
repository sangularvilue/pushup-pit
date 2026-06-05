import Link from "next/link";
import BrandMark from "./BrandMark";

/** Logged-out header for client-rendered auth pages (no session lookup). */
export default function SiteHeaderStatic() {
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <BrandMark />
        PU$HUP<span className="accent">PIT</span>
      </Link>
      <div className="header-right">
        <Link href="/login" className="btn btn-ghost">
          Sign in
        </Link>
        <Link href="/register" className="btn btn-gold">
          Sign Up
        </Link>
      </div>
    </header>
  );
}
