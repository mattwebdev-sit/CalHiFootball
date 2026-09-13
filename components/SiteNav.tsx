"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavLink {
  href: string;
  label: string;
}

/**
 * Primary site navigation. Renders an inline link row on >=sm screens and a
 * collapsible hamburger dropdown on mobile. The dropdown is absolutely
 * positioned below the header so it overlays content instead of shifting it.
 */
export function SiteNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const active =
      href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `rounded px-2 py-1 text-sm font-medium hover:bg-white/10 hover:text-white ${
      active ? "text-white" : "text-neutral-200"
    }`;
  };

  return (
    <>
      <nav className="hidden items-center gap-2 sm:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={linkClass(l.href)}>
            {l.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        aria-label="Toggle navigation menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded p-2 text-neutral-200 hover:bg-white/10 sm:hidden"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-50 border-b border-neutral-800 bg-neutral-950/95 shadow-lg backdrop-blur sm:hidden">
          <nav className="container-page flex flex-col py-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded px-2 py-2.5 text-sm font-medium hover:bg-white/10 hover:text-white ${
                  (l.href === "/" ? pathname === "/" : pathname.startsWith(l.href))
                    ? "text-white"
                    : "text-neutral-200"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}
