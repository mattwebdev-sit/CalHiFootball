import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-3xl font-black text-white">404</h1>
      <p className="mt-2 text-neutral-400">
        We couldn&rsquo;t find that page or team.
      </p>
      <Link href="/" className="link mt-4 inline-block">
        Back to the scoreboard
      </Link>
    </div>
  );
}
