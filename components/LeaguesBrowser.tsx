"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SectionLeagues } from "@/lib/queries";

/**
 * Searchable, collapsible directory of leagues grouped by section. Sections are
 * collapsed by default (a compact overview that scrolls well on mobile); typing
 * in the search box filters leagues live and auto-expands matching sections.
 */
export function LeaguesBrowser({
  sections,
  format,
}: {
  sections: SectionLeagues[];
  format: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return sections;
    return sections
      .map((s) => {
        const sectionMatch =
          s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
        const leagues = sectionMatch
          ? s.leagues
          : s.leagues.filter((l) => l.name.toLowerCase().includes(q));
        const independentCount =
          sectionMatch || "independent".includes(q) ? s.independentCount : 0;
        return { ...s, leagues, independentCount };
      })
      .filter((s) => s.leagues.length > 0 || s.independentCount > 0);
  }, [sections, q]);

  const allOpen =
    sections.length > 0 && sections.every((s) => open.has(s.code));

  const toggle = (code: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const toggleAll = () =>
    setOpen(allOpen ? new Set() : new Set(sections.map((s) => s.code)));

  const isOpen = (code: string) => q.length > 0 || open.has(code);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search leagues…"
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={toggleAll}
          className="shrink-0 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-6 text-sm text-neutral-400">
          No leagues match &ldquo;{query.trim()}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start">
          {filtered.map((s) => {
            const expanded = isOpen(s.code);
            return (
              <section key={s.code} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(s.code)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-white/5"
                >
                  <span className="text-sm font-bold uppercase tracking-wide text-emerald-300">
                    {s.name}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="tabular-nums">
                      {s.leagues.length}
                      {s.leagues.length === 1 ? " league" : " leagues"}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
                {expanded ? (
                  <ul className="space-y-0.5 border-t border-neutral-800 p-2">
                    {s.leagues.map((l) => (
                      <li key={l.slug}>
                        <Link
                          href={`/leagues/${l.slug}`}
                          prefetch={false}
                          className="flex items-center justify-between rounded px-2 py-2 text-sm text-neutral-200 hover:bg-white/5 hover:text-emerald-300"
                        >
                          <span>{l.name}</span>
                          <span className="tabular-nums text-xs text-neutral-500">
                            {l.teamCount}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {s.independentCount > 0 ? (
                      <li>
                        <Link
                          href={`/rankings?format=${format}&section=${s.code}&league=independent`}
                          className="flex items-center justify-between rounded px-2 py-2 text-sm italic text-neutral-400 hover:bg-white/5 hover:text-emerald-300"
                        >
                          <span>Independent</span>
                          <span className="tabular-nums text-xs text-neutral-500">
                            {s.independentCount}
                          </span>
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
