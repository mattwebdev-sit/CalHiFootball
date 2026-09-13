import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

/** Simple breadcrumb trail, e.g. California › Central Section › Northwest Athletic Conference. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-neutral-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {item.href ? (
              <Link href={item.href} className="hover:text-emerald-300">
                {item.label}
              </Link>
            ) : (
              <span className="text-neutral-300">{item.label}</span>
            )}
            {i < items.length - 1 ? (
              <span className="text-neutral-600">&rsaquo;</span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
