import { prisma } from "@/lib/db";

const ms = (t: number) => `${Date.now() - t}ms`;

async function main() {
  console.log("DB:", process.env.TURSO_DATABASE_URL ? "TURSO (remote)" : "local file");

  let t = Date.now();
  const c = await prisma.team.count();
  console.log(`team.count = ${c} in ${ms(t)}`);

  t = Date.now();
  const snaps = await prisma.ratingSnapshot.findMany({
    where: { season: 2026, rank: { not: null }, team: { format: "eleven" } },
    orderBy: { rank: "asc" },
    include: { team: { include: { section: true, league: true } } },
  });
  console.log(`getRankings-style findMany = ${snaps.length} rows in ${ms(t)}`);

  t = Date.now();
  const snaps2 = await prisma.ratingSnapshot.findMany({
    where: { season: 2026, rank: { not: null }, team: { format: "eleven" } },
    orderBy: { rank: "asc" },
    select: {
      rank: true, rating: true, sos: true, wins: true, losses: true, ties: true,
      team: { select: { slug: true, name: true, city: true, section: { select: { code: true } }, league: { select: { slug: true, name: true } } } },
    },
  });
  console.log(`select-only variant = ${snaps2.length} rows in ${ms(t)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
