import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getPlatform } from "@/lib/platform";

/**
 * The whole app is request-time rendered. The platform reads configuration and
 * connects to its store when it boots, and a build must never do either — the
 * config guards would (correctly) refuse to run with production settings absent.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Command Center — AI Holding Company",
  description: "Portfolio, approvals, automation and cost oversight for the holding company.",
};

const NAV = [
  { href: "/", label: "Portfolio" },
  { href: "/approvals", label: "Approvals" },
  { href: "/automation", label: "Automation" },
  { href: "/costs", label: "Costs & capital" },
  { href: "/experiments", label: "Experiments" },
  { href: "/audit", label: "Audit trail" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { demoMode, platform } = await getPlatform();

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">Northbridge</div>
            <div className="brand-sub">Command Center</div>
            <nav className="nav">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div style={{ marginTop: 24 }} className="small muted stack">
              <span>Store: {platform.store.driver}</span>
              <span>Model: {platform.providers.model.name}</span>
              <span>Email: {platform.providers.email.name}</span>
              <span>
                Paid providers: {platform.env.ALLOW_PAID_PROVIDERS ? "enabled" : "off"}
              </span>
              <span>
                Live comms: {platform.env.ALLOW_LIVE_COMMUNICATIONS ? "enabled" : "off"}
              </span>
            </div>
          </aside>
          <main className="main">
            {demoMode && (
              <div
                className="callout"
                style={{ borderLeftColor: "#8a5a12", background: "rgba(138,90,18,0.14)" }}
              >
                <strong style={{ color: "#8a5a12" }}>Demo data</strong>
                <div className="callout-body">
                  Running on the in-memory store with seeded fictional companies. Every figure
                  below is invented, no provider is live, and nothing persists past a restart.
                </div>
              </div>
            )}
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
