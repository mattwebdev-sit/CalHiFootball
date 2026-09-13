import Link from "next/link";

export function TeamLink({
  slug,
  name,
  rank,
  className,
}: {
  slug: string;
  name: string;
  rank?: number | null;
  className?: string;
}) {
  return (
    // Prefetch disabled: these links appear by the hundreds (rankings rows,
    // scoreboards, schedules). Prefetching every one fires a flood of RSC
    // requests to the server. Team pages are ISR-cached, so a real click is
    // still fast on the first hit and instant thereafter.
    <Link
      href={`/teams/${slug}`}
      prefetch={false}
      className={className ?? "hover:text-emerald-300"}
    >
      {rank ? <span className="mr-1 text-xs font-semibold text-emerald-400">#{rank}</span> : null}
      {name}
    </Link>
  );
}
