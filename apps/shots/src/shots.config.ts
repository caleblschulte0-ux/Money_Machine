import type { Shot } from "@holdco/shots";

/**
 * Your ideas. One entry each.
 *
 * To launch a new one: copy a block, change the words, set status to "live".
 * That is the whole process — the page, the form and the scoreboard entry all
 * appear automatically at /s/<slug>.
 *
 * The three fields that stop you fooling yourself:
 *   askedFor          — an email is weak evidence; a deposit is strong
 *   successLooksLike  — write it BEFORE launch, in numbers
 *   killAfterDays     — when it dies on its own
 *
 * The examples below are STARTING POINTS, not researched businesses. The words
 * are mine, the judgement has to be yours: I have no evidence any of these
 * three problems is real or that anyone will pay for these prices. Rewrite them
 * to match something you actually know about.
 */
export const SHOTS: readonly Shot[] = [
  {
    slug: "quote-chaser",
    name: "Quote Chaser",
    forWhom: "Contractors who send quotes and then lose track of them",
    problem:
      "You send a quote and hear nothing. You mean to follow up, then a job goes sideways and three weeks pass.",
    offer:
      "We follow up on every quote you send — day 2, day 7, day 21 — by email and text, in your words, until they answer yes or no. You get a weekly list of who is still open.",
    priceMinor: 29_900,
    priceNote: "per month",
    points: [
      "Every quote gets chased three times, without you remembering to",
      "You see one list each Monday: who replied, who went quiet, who said no",
      "Set up from your existing quotes — no new software to learn",
      "Cancel any month, no contract",
    ],
    notPromised: [
      "We do not promise a specific increase in closed jobs.",
      "We do not write your quotes or set your prices.",
      "We do not contact anyone who has asked you to stop.",
    ],
    askedFor: "booked_call",
    cta: "Book a 15-minute call",
    successLooksLike: "5 calls booked from 60 contractors contacted, within 14 days",
    killAfterDays: 14,
    status: "draft",
    trafficPlan: "Direct outreach to local contractors; trade Facebook groups",
  },

  {
    slug: "permit-watch",
    name: "Permit Watch",
    forWhom: "Trades who want to know about jobs before the homeowner calls three competitors",
    problem:
      "By the time you hear about a project, four other companies already quoted it.",
    offer:
      "A weekly email listing new building permits filed in your county, filtered to the work you actually do, with the property address and owner name where it is public record.",
    priceMinor: 9_900,
    priceNote: "per month",
    points: [
      "One email a week, filtered to your trade and your county",
      "Public permit records only — nothing scraped from behind a login",
      "First two weeks free so you can judge whether the leads are real",
    ],
    notPromised: [
      "We do not promise these permits turn into work.",
      "We do not contact the property owner on your behalf.",
      "Coverage depends on what your county publishes, which varies.",
    ],
    askedFor: "email",
    cta: "Get the first two weeks free",
    successLooksLike: "25 signups from 400 visitors, within 21 days",
    killAfterDays: 21,
    status: "draft",
    trafficPlan: "Trade groups, county-specific search terms",
  },

  {
    slug: "invoice-rescue",
    name: "Invoice Rescue",
    forWhom: "Small firms with money owed that nobody has time to chase",
    problem:
      "There is $40k sitting in unpaid invoices and chasing it is nobody's actual job.",
    offer:
      "We chase your overdue invoices — polite, persistent, on a schedule — and tell you weekly what came in. You keep every dollar collected; you pay a flat monthly fee, not a percentage.",
    priceMinor: 49_900,
    priceNote: "per month",
    points: [
      "Every overdue invoice chased on a fixed schedule",
      "Flat fee — we do not take a cut of what you are already owed",
      "You approve the wording before anything goes out",
      "Stops immediately on any account you flag",
    ],
    notPromised: [
      "We do not guarantee any amount will be collected.",
      "We are not a debt collection agency and do not pursue legal action.",
      "We do not report anyone to a credit bureau.",
    ],
    askedFor: "booked_call",
    cta: "Book a 15-minute call",
    successLooksLike: "4 calls booked from 50 firms contacted, within 14 days",
    killAfterDays: 14,
    status: "draft",
    trafficPlan: "Direct outreach to bookkeepers and small firm owners",
  },
];
