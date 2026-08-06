import Link from "next/link";
import { getShots, formatPrice } from "@/lib/shots";
import "./globals.css";

export const dynamic = "force-dynamic";

const VERDICT_LABEL: Record<string, { text: string; tone: string }> = {
  stuck: { text: "STUCK — worth real work", tone: "good" },
  early_signal: { text: "early signal", tone: "ok" },
  no_signal: { text: "no signal", tone: "bad" },
  past_kill_date: { text: "past kill date — close it", tone: "bad" },
  no_audience_yet: { text: "nobody has seen it", tone: "warn" },
  not_launched: { text: "not launched", tone: "muted" },
};

export default async function Scoreboard() {
  const { registry, scoreboard, organizationId } = await getShots();
  const results = await scoreboard.scoreAll(organizationId, registry.list());

  return (
    <main className="page board">
      <h1>Shots</h1>
      <p className="summary">{scoreboard.summarize(results)}</p>

      <table>
        <thead>
          <tr>
            <th>Idea</th>
            <th>Price</th>
            <th className="n">Seen by</th>
            <th className="n">Signups</th>
            <th className="n">Rate</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const v = VERDICT_LABEL[r.verdict]!;
            return (
              <tr key={r.shot.slug}>
                <td>
                  <Link href={`/s/${r.shot.slug}`}>{r.shot.name}</Link>
                  <div className="sub">{r.shot.forWhom}</div>
                  <div className="todo">{r.whatToDo}</div>
                </td>
                <td className="n">{formatPrice(r.shot)}</td>
                <td className="n">{r.uniqueVisitors}</td>
                <td className="n">{r.signups}</td>
                <td className="n">
                  {r.conversionRate === null ? "—" : `${(r.conversionRate * 100).toFixed(1)}%`}
                </td>
                <td>
                  <span className={`tag ${v.tone}`}>{v.text}</span>
                  <div className="sub">
                    asked for: {r.shot.askedFor.replace(/_/g, " ")} · dies after{" "}
                    {r.shot.killAfterDays}d
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="note">
        <h2>How to read this</h2>
        <p>
          <strong>Nobody has seen it</strong> is not a failure — it means you have not shown it to
          anyone yet, so it tells you nothing. Fewer than 30 visitors and there is no verdict to
          give.
        </p>
        <p>
          <strong>No signal</strong> after real traffic is a genuine answer. Change the offer or
          close it.
        </p>
        <p>
          Signups are weighted by what you asked for. Forty email addresses are worth less than
          two people who booked a call, and the ranking reflects that.
        </p>
        <p className="add">
          To add an idea: copy a block in{" "}
          <code>apps/shots/src/shots.config.ts</code>, change the words, set{" "}
          <code>status: &quot;live&quot;</code>. The page appears at <code>/s/your-slug</code>.
        </p>
      </section>
    </main>
  );
}
