import type { Metadata } from "next";
import { ImportForm } from "./ImportForm";

export const metadata: Metadata = {
  title: "Add Scores",
  description:
    "Upload California high school football scores via CSV to update CalHi ratings.",
};

const SAMPLE_CSV = `date,week,home,home_city,home_section,away,away_city,away_section,home_score,away_score,status
2026-09-12,4,St. John Bosco,Bellflower,SS,Kahuku,Kahuku HI,OOS,35,28,final
2026-09-12,4,Mater Dei,Santa Ana,SS,Centennial,Corona,SS,42,17,final`;

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Add Scores</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Paste or upload a CSV of game results. Teams are matched by name and
          city (new teams are created automatically), games are de-duplicated, and
          ratings recompute immediately.
        </p>
      </div>

      <ImportForm sample={SAMPLE_CSV} />

      <section className="card p-5 text-sm text-neutral-300">
        <h2 className="mb-2 text-base font-bold text-white">CSV format</h2>
        <p className="mb-2">
          Required columns: <code className="text-emerald-300">date</code>,{" "}
          <code className="text-emerald-300">home</code>,{" "}
          <code className="text-emerald-300">away</code>. Optional:{" "}
          <code>week</code>, <code>home_city</code>, <code>home_section</code>,{" "}
          <code>home_oos</code>, <code>away_city</code>, <code>away_section</code>,{" "}
          <code>away_oos</code>, <code>home_score</code>, <code>away_score</code>,{" "}
          <code>status</code>, <code>source_id</code>.
        </p>
        <p className="text-neutral-400">
          Leave <code>home_score</code>/<code>away_score</code> blank for upcoming
          games. Section codes: SS, SDS, CCS, NCS, SJS, CS, LACS, SFS, OS, NS, OOS.
        </p>
      </section>
    </div>
  );
}
