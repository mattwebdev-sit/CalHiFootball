"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ImportResult {
  gamesUpserted: number;
  teamsCreated: number;
  finals: number;
  scheduled: number;
  seasonsRecomputed: number[];
}

export function ImportForm({ sample }: { sample: string }) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [source, setSource] = useState("manual-upload");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    setCsv(text);
  }

  async function submit() {
    setStatus("loading");
    setMessage("");
    setResult(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, source }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Import failed");
        return;
      }
      setStatus("done");
      setResult(data as ImportResult);
      router.refresh();
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded bg-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-700">
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setCsv(sample)}
          className="text-sm text-emerald-400 hover:text-emerald-300 hover:underline"
        >
          Load sample
        </button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-neutral-500">source</label>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-40 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
          />
        </div>
      </div>

      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder="Paste CSV here, or choose a file above…"
        spellCheck={false}
        className="h-56 w-full rounded border border-neutral-700 bg-neutral-950 p-3 font-mono text-xs text-neutral-200 focus:border-emerald-500 focus:outline-none"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={status === "loading" || csv.trim() === ""}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? "Importing…" : "Import & recompute"}
        </button>

        {status === "done" && result ? (
          <span className="text-sm text-emerald-400">
            Imported {result.gamesUpserted} games ({result.finals} final,{" "}
            {result.scheduled} upcoming), {result.teamsCreated} new teams. Ratings
            updated.
          </span>
        ) : null}
        {status === "error" ? (
          <span className="text-sm text-red-400">{message}</span>
        ) : null}
      </div>
    </div>
  );
}
