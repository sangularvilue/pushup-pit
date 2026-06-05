import type { Metadata } from "next";
import { Graduate, IBM_Plex_Mono, Libre_Franklin } from "next/font/google";
import "./globals.css";

const graduate = Graduate({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-graduate",
});
const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});
const franklin = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-franklin",
});

export const metadata: Metadata = {
  title: "PUSHUP PIT — The Push-Up Derivatives Exchange",
  description:
    "List push-up contracts, trade futures, calls, puts and straddles against your friends, watch the payoff diagram, and settle up when the reps are counted.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* apply saved theme/density before first paint to avoid a flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement;d.setAttribute("data-theme",localStorage.getItem("pp-theme")||"board");d.setAttribute("data-density",localStorage.getItem("pp-density")||"cozy");}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${graduate.variable} ${plexMono.variable} ${franklin.variable}`}
        style={{
          ["--font-display" as string]: "var(--font-graduate)",
          ["--font-mono" as string]: "var(--font-plex-mono)",
          ["--font-body" as string]: "var(--font-franklin)",
        }}
      >
        {children}
      </body>
    </html>
  );
}
