/** Sanity check: reads through the app's Prisma client (libSQL adapter path). */
import { prisma } from "@/lib/db";

async function main() {
  const [teams, games, ranked] = await Promise.all([
    prisma.team.count(),
    prisma.game.count(),
    prisma.ratingSnapshot.count(),
  ]);
  const top = await prisma.ratingSnapshot.findFirst({
    orderBy: { rating: "desc" },
    include: { team: true },
  });
  console.log({ teams, games, ranked, topTeam: top?.team.name, topRating: top?.rating });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
