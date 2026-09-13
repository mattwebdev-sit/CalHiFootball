/**
 * One-off: loads the local SQLite dump (turso-seed.sql) into the Turso database.
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the environment.
 *
 *   sqlite3 prisma/dev.db .dump > turso-seed.sql
 *   npm run load:turso
 */
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) throw new Error("TURSO_DATABASE_URL is not set");

const raw = readFileSync("turso-seed.sql", "utf8");

// Reconstruct statements from the dump. Each statement ends on a line whose
// trimmed text ends with ';'. Skip transaction/pragma wrappers.
const statements: string[] = [];
let buf = "";
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t) continue;
  if (t.startsWith("PRAGMA") || t === "BEGIN TRANSACTION;" || t === "COMMIT;") continue;
  buf += (buf ? "\n" : "") + line;
  if (t.endsWith(";")) {
    statements.push(buf);
    buf = "";
  }
}

const isDDL = (s: string) => /^\s*CREATE\s/i.test(s);
const ddl = statements.filter(isDDL);

// Insert parents before children so FK constraints (enforced by Turso) hold.
const TABLE_ORDER = [
  "_prisma_migrations",
  "Section",
  "League",
  "Team",
  "Game",
  "RatingSnapshot",
];
const tableOf = (s: string): string => {
  const m = s.match(/^\s*INSERT (?:OR \w+ )?INTO\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/i);
  return m ? m[1] : "";
};
const rank = (s: string) => {
  const i = TABLE_ORDER.indexOf(tableOf(s));
  return i === -1 ? TABLE_ORDER.length : i;
};
const dml = statements
  .filter((s) => !isDDL(s))
  // OR IGNORE makes the loader safely re-runnable.
  .map((s) => s.replace(/^\s*INSERT INTO/i, "INSERT OR IGNORE INTO"))
  .map((s, idx) => ({ s, idx }))
  .sort((a, b) => rank(a.s) - rank(b.s) || a.idx - b.idx)
  .map((x) => x.s);

const client = createClient({ url, authToken });

async function main() {
  console.log(`Parsed ${ddl.length} DDL + ${dml.length} DML statements.`);

  for (const s of ddl) {
    try {
      await client.execute(s);
    } catch (e) {
      const msg = (e as Error).message;
      // Ignore "already exists" so the loader is re-runnable.
      if (!/already exists/i.test(msg)) throw e;
    }
  }
  console.log("Schema created.");

  const BATCH = 400;
  for (let i = 0; i < dml.length; i += BATCH) {
    const chunk = dml.slice(i, i + BATCH);
    await client.batch(chunk, "write");
    console.log(`  inserted ${Math.min(i + BATCH, dml.length)}/${dml.length}`);
  }

  for (const tbl of ["Section", "League", "Team", "Game", "RatingSnapshot"]) {
    const r = await client.execute(`SELECT COUNT(*) AS c FROM "${tbl}"`);
    console.log(`${tbl}: ${r.rows[0].c}`);
  }
  console.log("Turso load complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
