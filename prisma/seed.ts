import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEASON = 2026;

interface SectionSeed {
  code: string;
  name: string;
  isCa: boolean;
}

interface TeamSeed {
  slug: string;
  name: string;
  city: string;
  mascot: string;
  section: string;
  isOutOfState?: boolean;
}

interface GameSeed {
  week: number;
  date: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  neutral?: boolean;
}

const sections: SectionSeed[] = [
  { code: "SS", name: "CIF Southern Section", isCa: true },
  { code: "SDS", name: "CIF San Diego Section", isCa: true },
  { code: "CCS", name: "CIF Central Coast Section", isCa: true },
  { code: "NCS", name: "CIF North Coast Section", isCa: true },
  { code: "SJS", name: "CIF Sac-Joaquin Section", isCa: true },
  { code: "CS", name: "CIF Central Section", isCa: true },
  { code: "LACS", name: "CIF Los Angeles City Section", isCa: true },
  { code: "SFS", name: "CIF San Francisco Section", isCa: true },
  { code: "OS", name: "CIF Oakland Section", isCa: true },
  { code: "NS", name: "CIF Northern Section", isCa: true },
  { code: "OOS", name: "Out of State", isCa: false },
];

const teams: TeamSeed[] = [
  { slug: "santa-margarita-rancho-santa-margarita", name: "Santa Margarita", city: "Rancho Santa Margarita", mascot: "Eagles", section: "SS" },
  { slug: "st-john-bosco-bellflower", name: "St. John Bosco", city: "Bellflower", mascot: "Braves", section: "SS" },
  { slug: "mater-dei-santa-ana", name: "Mater Dei", city: "Santa Ana", mascot: "Monarchs", section: "SS" },
  { slug: "sierra-canyon-chatsworth", name: "Sierra Canyon", city: "Chatsworth", mascot: "Trailblazers", section: "SS" },
  { slug: "centennial-corona", name: "Centennial", city: "Corona", mascot: "Huskies", section: "SS" },
  { slug: "mission-viejo-mission-viejo", name: "Mission Viejo", city: "Mission Viejo", mascot: "Diablos", section: "SS" },
  { slug: "orange-lutheran-orange", name: "Orange Lutheran", city: "Orange", mascot: "Lancers", section: "SS" },
  { slug: "servite-anaheim", name: "Servite", city: "Anaheim", mascot: "Friars", section: "SS" },
  { slug: "los-alamitos-los-alamitos", name: "Los Alamitos", city: "Los Alamitos", mascot: "Griffins", section: "SS" },
  { slug: "san-clemente-san-clemente", name: "San Clemente", city: "San Clemente", mascot: "Tritons", section: "SS" },
  { slug: "gardena-serra-gardena", name: "Gardena Serra", city: "Gardena", mascot: "Cavaliers", section: "SS" },
  { slug: "chaminade-west-hills", name: "Chaminade", city: "West Hills", mascot: "Eagles", section: "SS" },
  { slug: "pacifica-oxnard", name: "Pacifica", city: "Oxnard", mascot: "Tritons", section: "SS" },
  { slug: "de-la-salle-concord", name: "De La Salle", city: "Concord", mascot: "Spartans", section: "NCS" },
  { slug: "pittsburg-pittsburg", name: "Pittsburg", city: "Pittsburg", mascot: "Pirates", section: "NCS" },
  { slug: "folsom-folsom", name: "Folsom", city: "Folsom", mascot: "Bulldogs", section: "SJS" },
  { slug: "grant-sacramento", name: "Grant", city: "Sacramento", mascot: "Pacers", section: "SJS" },
  { slug: "central-fresno", name: "Central", city: "Fresno", mascot: "Grizzlies", section: "CS" },
  { slug: "buchanan-clovis", name: "Buchanan", city: "Clovis", mascot: "Bears", section: "CS" },
  { slug: "serra-san-mateo", name: "Serra", city: "San Mateo", mascot: "Padres", section: "CCS" },
  { slug: "archbishop-riordan-san-francisco", name: "Archbishop Riordan", city: "San Francisco", mascot: "Crusaders", section: "CCS" },
  { slug: "carlsbad-carlsbad", name: "Carlsbad", city: "Carlsbad", mascot: "Lancers", section: "SDS" },
  { slug: "cathedral-catholic-san-diego", name: "Cathedral Catholic", city: "San Diego", mascot: "Dons", section: "SDS" },
  { slug: "lincoln-san-diego", name: "Lincoln", city: "San Diego", mascot: "Hornets", section: "SDS" },
  { slug: "bishop-gorman-las-vegas", name: "Bishop Gorman", city: "Las Vegas, NV", mascot: "Gaels", section: "OOS", isOutOfState: true },
  { slug: "st-frances-academy-baltimore", name: "St. Frances Academy", city: "Baltimore, MD", mascot: "Panthers", section: "OOS", isOutOfState: true },
  { slug: "kahuku-kahuku", name: "Kahuku", city: "Kahuku, HI", mascot: "Red Raiders", section: "OOS", isOutOfState: true },
];

const games: GameSeed[] = [
  // Week 1 - 2026-08-22
  { week: 1, date: "2026-08-22", home: "st-john-bosco-bellflower", away: "st-frances-academy-baltimore", homeScore: 24, awayScore: 21 },
  { week: 1, date: "2026-08-22", home: "santa-margarita-rancho-santa-margarita", away: "gardena-serra-gardena", homeScore: 35, awayScore: 10 },
  { week: 1, date: "2026-08-22", home: "mater-dei-santa-ana", away: "chaminade-west-hills", homeScore: 42, awayScore: 7 },
  { week: 1, date: "2026-08-22", home: "sierra-canyon-chatsworth", away: "pacifica-oxnard", homeScore: 28, awayScore: 21 },
  { week: 1, date: "2026-08-22", home: "mission-viejo-mission-viejo", away: "centennial-corona", homeScore: 24, awayScore: 21 },
  { week: 1, date: "2026-08-22", home: "orange-lutheran-orange", away: "servite-anaheim", homeScore: 31, awayScore: 28 },
  { week: 1, date: "2026-08-22", home: "de-la-salle-concord", away: "pittsburg-pittsburg", homeScore: 42, awayScore: 20 },
  { week: 1, date: "2026-08-22", home: "folsom-folsom", away: "grant-sacramento", homeScore: 49, awayScore: 21 },
  { week: 1, date: "2026-08-22", home: "central-fresno", away: "buchanan-clovis", homeScore: 35, awayScore: 14 },
  { week: 1, date: "2026-08-22", home: "serra-san-mateo", away: "archbishop-riordan-san-francisco", homeScore: 27, awayScore: 24 },
  { week: 1, date: "2026-08-22", home: "carlsbad-carlsbad", away: "lincoln-san-diego", homeScore: 38, awayScore: 17 },
  { week: 1, date: "2026-08-22", home: "los-alamitos-los-alamitos", away: "cathedral-catholic-san-diego", homeScore: 24, awayScore: 28 },
  { week: 1, date: "2026-08-22", home: "bishop-gorman-las-vegas", away: "san-clemente-san-clemente", homeScore: 42, awayScore: 21, neutral: true },

  // Week 2 - 2026-08-29
  { week: 2, date: "2026-08-29", home: "st-john-bosco-bellflower", away: "pittsburg-pittsburg", homeScore: 26, awayScore: 14 },
  { week: 2, date: "2026-08-29", home: "santa-margarita-rancho-santa-margarita", away: "orange-lutheran-orange", homeScore: 34, awayScore: 24 },
  { week: 2, date: "2026-08-29", home: "mater-dei-santa-ana", away: "los-alamitos-los-alamitos", homeScore: 45, awayScore: 20 },
  { week: 2, date: "2026-08-29", home: "sierra-canyon-chatsworth", away: "kahuku-kahuku", homeScore: 35, awayScore: 28, neutral: true },
  { week: 2, date: "2026-08-29", home: "centennial-corona", away: "servite-anaheim", homeScore: 38, awayScore: 17 },
  { week: 2, date: "2026-08-29", home: "mission-viejo-mission-viejo", away: "san-clemente-san-clemente", homeScore: 31, awayScore: 28 },
  { week: 2, date: "2026-08-29", home: "de-la-salle-concord", away: "folsom-folsom", homeScore: 21, awayScore: 24 },
  { week: 2, date: "2026-08-29", home: "central-fresno", away: "grant-sacramento", homeScore: 28, awayScore: 27 },
  { week: 2, date: "2026-08-29", home: "carlsbad-carlsbad", away: "cathedral-catholic-san-diego", homeScore: 20, awayScore: 35 },
  { week: 2, date: "2026-08-29", home: "gardena-serra-gardena", away: "chaminade-west-hills", homeScore: 28, awayScore: 24 },
  { week: 2, date: "2026-08-29", home: "pacifica-oxnard", away: "buchanan-clovis", homeScore: 41, awayScore: 14 },
  { week: 2, date: "2026-08-29", home: "serra-san-mateo", away: "lincoln-san-diego", homeScore: 30, awayScore: 21 },

  // Week 3 - 2026-09-05
  { week: 3, date: "2026-09-05", home: "santa-margarita-rancho-santa-margarita", away: "st-john-bosco-bellflower", homeScore: 28, awayScore: 24 },
  { week: 3, date: "2026-09-05", home: "mater-dei-santa-ana", away: "sierra-canyon-chatsworth", homeScore: 31, awayScore: 27 },
  { week: 3, date: "2026-09-05", home: "centennial-corona", away: "mater-dei-santa-ana", homeScore: 14, awayScore: 21 },
  { week: 3, date: "2026-09-05", home: "mission-viejo-mission-viejo", away: "orange-lutheran-orange", homeScore: 17, awayScore: 20 },
  { week: 3, date: "2026-09-05", home: "de-la-salle-concord", away: "central-fresno", homeScore: 35, awayScore: 14 },
  { week: 3, date: "2026-09-05", home: "folsom-folsom", away: "pittsburg-pittsburg", homeScore: 42, awayScore: 28 },
  { week: 3, date: "2026-09-05", home: "cathedral-catholic-san-diego", away: "carlsbad-carlsbad", homeScore: 24, awayScore: 21 },
  { week: 3, date: "2026-09-05", home: "los-alamitos-los-alamitos", away: "san-clemente-san-clemente", homeScore: 34, awayScore: 30 },
  { week: 3, date: "2026-09-05", home: "gardena-serra-gardena", away: "pacifica-oxnard", homeScore: 21, awayScore: 24 },
  { week: 3, date: "2026-09-05", home: "serra-san-mateo", away: "grant-sacramento", homeScore: 28, awayScore: 20 },
  { week: 3, date: "2026-09-05", home: "sierra-canyon-chatsworth", away: "servite-anaheim", homeScore: 38, awayScore: 21 },

  // Week 4 - 2026-09-12 (scheduled, no scores yet)
  { week: 4, date: "2026-09-12", home: "st-john-bosco-bellflower", away: "kahuku-kahuku", homeScore: null, awayScore: null },
  { week: 4, date: "2026-09-12", home: "mater-dei-santa-ana", away: "centennial-corona", homeScore: null, awayScore: null },
  { week: 4, date: "2026-09-12", home: "santa-margarita-rancho-santa-margarita", away: "mission-viejo-mission-viejo", homeScore: null, awayScore: null },
  { week: 4, date: "2026-09-12", home: "folsom-folsom", away: "de-la-salle-concord", homeScore: null, awayScore: null },
  { week: 4, date: "2026-09-12", home: "sierra-canyon-chatsworth", away: "orange-lutheran-orange", homeScore: null, awayScore: null },
];

async function main() {
  console.log("Seeding sections...");
  const sectionByCode = new Map<string, string>();
  for (const s of sections) {
    const row = await prisma.section.upsert({
      where: { code: s.code },
      update: { name: s.name, isCa: s.isCa },
      create: { code: s.code, name: s.name, isCa: s.isCa },
    });
    sectionByCode.set(s.code, row.id);
  }

  console.log("Seeding teams...");
  const teamBySlug = new Map<string, string>();
  for (const t of teams) {
    const sectionId = sectionByCode.get(t.section);
    if (!sectionId) throw new Error(`Unknown section ${t.section} for ${t.slug}`);
    const row = await prisma.team.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        city: t.city,
        mascot: t.mascot,
        sectionId,
        isOutOfState: t.isOutOfState ?? false,
      },
      create: {
        slug: t.slug,
        name: t.name,
        city: t.city,
        mascot: t.mascot,
        sectionId,
        isOutOfState: t.isOutOfState ?? false,
      },
    });
    teamBySlug.set(t.slug, row.id);
  }

  console.log("Seeding games...");
  for (const g of games) {
    const homeId = teamBySlug.get(g.home);
    const awayId = teamBySlug.get(g.away);
    if (!homeId || !awayId) throw new Error(`Unknown team in game ${g.home} vs ${g.away}`);
    const status = g.homeScore === null || g.awayScore === null ? "scheduled" : "final";
    const date = new Date(`${g.date}T19:00:00-07:00`);

    await prisma.game.upsert({
      where: {
        season_date_homeTeamId_awayTeamId: {
          season: SEASON,
          date,
          homeTeamId: homeId,
          awayTeamId: awayId,
        },
      },
      update: {
        week: g.week,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        status,
        source: "seed",
      },
      create: {
        season: SEASON,
        week: g.week,
        date,
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        status,
        source: "seed",
      },
    });
  }

  console.log(
    `Seeded ${sections.length} sections, ${teams.length} teams, ${games.length} games.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
