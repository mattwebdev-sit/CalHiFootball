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
    <Link href={`/teams/${slug}`} className={className ?? "hover:text-emerald-300"}>
      {rank ? <span className="mr-1 text-xs font-semibold text-emerald-400">#{rank}</span> : null}
      {name}
    </Link>
  );
}
