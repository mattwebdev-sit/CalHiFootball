import type { Metadata } from "next";
import { DEFAULT_CONFIG } from "@/lib/ratings/types";

export const metadata: Metadata = {
  title: "How the CalHi Rating Works",
  description:
    "The methodology behind CalHiFootball's objective, results-only power ratings for California high school football.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-black tracking-tight text-white">
        How the CalHi Rating Works
      </h1>

      <p className="text-neutral-300">
        The CalHi Rating is a <strong>100% objective, results-based</strong> power
        rating. Enrollment, division, league, geography, history, and reputation
        are <em>not</em> inputs. The only things that matter are who a team played
        and what happened on the field.
      </p>

      <Section title="The core idea">
        <p>
          Every team starts at <strong>0</strong>. The rating gap between two
          teams is an estimate of the points that separate them on a neutral
          field &mdash; a team rated 20 points higher would be expected to win by
          about 20.
        </p>
        <p>
          The engine repeatedly sweeps through every game and asks: given the
          current ratings, what &ldquo;should&rdquo; have happened? A team is set
          to the average of its opponents&rsquo; ratings plus how it actually
          performed against them. All ratings are then recentered to average 0,
          and the process repeats until the numbers stop moving.
        </p>
      </Section>

      <Section title="Wins matter most; margins have limits">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            The result &mdash; win or loss &mdash; is always the most important
            thing. A win always helps and a loss always hurts.
          </li>
          <li>
            Margin of victory is used, but capped at{" "}
            <strong>{DEFAULT_CONFIG.movCap} points</strong> with diminishing
            returns, so running up the score on a weak opponent does not inflate a
            rating.
          </li>
          <li>
            Home field is neutralized (about {DEFAULT_CONFIG.homeField} points)
            before a game is scored, and neutral-site games are treated as such.
          </li>
          <li>
            Because schedule strength is baked in, a 1&ndash;2 team that played
            elite competition can &mdash; and often should &mdash; rate above a
            2&ndash;1 team that beat weaker opponents.
          </li>
        </ul>
      </Section>

      <Section title="California focus">
        <p>
          Only California teams appear in the rankings. When a California team
          plays an out-of-state or non-CIF opponent, that opponent is still rated
          so schedule strength stays honest &mdash; it just doesn&rsquo;t appear
          in the statewide list.
        </p>
      </Section>

      <Section title="Where the scores come from">
        <p>
          Scores are ingested from official CIF section scoreboards and can be
          supplemented with CSV uploads. CalHiFootball does not scrape MaxPreps or
          hsratings. Missing a score?{" "}
          <a href="/admin" className="link">
            Add it here
          </a>
          .
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <h2 className="mb-2 text-lg font-bold text-white">{title}</h2>
      <div className="space-y-3 text-sm text-neutral-300">{children}</div>
    </section>
  );
}
