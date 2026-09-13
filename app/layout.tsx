import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "CalHiFootball — California High School Football Ratings",
    template: "%s — CalHiFootball",
  },
  description:
    "Objective computer power ratings and rankings for California high school football. Results-based, statewide, updated weekly.",
  metadataBase: new URL("https://calhifootball.com"),
};

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/rankings", label: "Rankings" },
  { href: "/leagues", label: "Leagues" },
  { href: "/about", label: "How It Works" },
  { href: "/admin", label: "Add Scores" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        <header className="relative border-b border-neutral-800 bg-gradient-to-b from-field to-neutral-950">
          <div className="container-page flex items-center justify-between py-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-xl font-black tracking-tight text-white">
                CalHi<span className="text-emerald-400">Football</span>
              </span>
              <span className="hidden text-xs uppercase tracking-widest text-emerald-200/70 sm:inline">
                California HS Football Ratings
              </span>
            </Link>
            <SiteNav links={navLinks} />
          </div>
        </header>

        <main className="container-page py-6">{children}</main>

        <footer className="mt-12 border-t border-neutral-800 py-6">
          <div className="container-page text-xs text-neutral-500">
            <p>
              CalHiFootball computes objective, results-based power ratings for
              California high school football. Not affiliated with CIF, MaxPreps,
              or CalPreps.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
