import { NextResponse } from "next/server";
import { csvToRawGames } from "@/lib/ingest/csv";
import { upsertGames, seasonForDate } from "@/lib/ingest/upsert";
import { recomputeSeason } from "@/lib/ratings/persist";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let csv = "";
  let source = "csv-upload";

  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { csv?: string; source?: string };
      csv = body.csv ?? "";
      if (body.source) source = body.source;
    } else {
      csv = await request.text();
    }
  } catch {
    return NextResponse.json({ error: "Could not read request body" }, { status: 400 });
  }

  if (!csv.trim()) {
    return NextResponse.json({ error: "No CSV content provided" }, { status: 400 });
  }

  let rawGames;
  try {
    rawGames = csvToRawGames(csv);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to parse CSV" },
      { status: 400 }
    );
  }

  if (rawGames.length === 0) {
    return NextResponse.json({ error: "No games found in CSV" }, { status: 400 });
  }

  const summary = await upsertGames(rawGames, source);

  const seasons = new Set(
    rawGames.map((g) =>
      seasonForDate(
        /^\d{4}-\d{2}-\d{2}$/.test(g.date)
          ? new Date(`${g.date}T19:00:00-07:00`)
          : new Date(g.date)
      )
    )
  );
  const recomputed: number[] = [];
  for (const season of seasons) {
    await recomputeSeason(season);
    recomputed.push(season);
  }

  return NextResponse.json({ ...summary, seasonsRecomputed: recomputed });
}
