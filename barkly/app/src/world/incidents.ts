/**
 * Autonomous world incidents.
 *
 * The world should occasionally happen TO Barkly. Existing encounters begin
 * when the player taps a dog; these incidents are different: history creates
 * pressure, the location supplies an opportunity, and the world starts a beat
 * on its own. That makes recurring characters feel like residents rather than
 * vending machines for dialogue.
 *
 * Pure engine only. BarklyRoom/useBarkly can decide how to stage the returned
 * incident; no React, timers or storage live here.
 */

import { bondFor, CharacterState } from '../barkly/character';
import { MemoryState } from '../barkly/memory';
import { sanitize } from '../barkly/facts';
import { LocationId } from './locations';
import { NPCS } from './npcs';

export type IncidentKind = 'friend-needs-you' | 'rival-provokes' | 'reputation' | 'treasure-chaos' | 'private-bit-leaks';

export interface IncidentChoice {
  id: string;
  label: string;
  barklyLine: string;
  memory: string;
  /** Relationship pressure. Positive = intensify current relationship, negative = cool it. */
  bondDelta?: number;
}

export interface WorldIncident {
  id: string;
  kind: IncidentKind;
  location: LocationId;
  actor?: 'biscuit' | 'duke' | 'pepper';
  title: string;
  setup: string;
  barklyOpening: string;
  choices: IncidentChoice[];
  /** Once per real-world day unless a future incident explicitly opts out. */
  cooldownMs: number;
  priority: number;
}

export interface IncidentLedgerEntry {
  timesSeen: number;
  lastSeenAt: number;
  lastChoiceId?: string;
}

export type IncidentLedger = Record<string, IncidentLedgerEntry>;

interface IncidentContext {
  location: LocationId;
  character: CharacterState;
  memory: MemoryState;
  ledger?: IncidentLedger;
  now: number;
}

const DAY = 86_400_000;
const safe = (s: string | undefined, max = 80) => sanitize(s ?? '', max);

/**
 * Social bonds are keyed by npc id (`biscuit`); this text is spoken to the
 * player, so it uses the dog's actual name.
 */
function displayName(key: string): string {
  const npc = (NPCS as Record<string, { name: string } | undefined>)[key];
  return npc?.name ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function signatureCue(memory: MemoryState): string | undefined {
  return [...memory.trainingRules]
    .filter((rule) => rule.timesTriggered >= 6)
    .sort((a, b) => b.timesTriggered - a.timesTriggered || b.updatedAt - a.updatedAt)[0]?.cue;
}

function eligible(incident: WorldIncident, ledger: IncidentLedger, now: number): boolean {
  const seen = ledger[incident.id];
  return !seen || now - seen.lastSeenAt >= incident.cooldownMs;
}

function candidates(ctx: IncidentContext): WorldIncident[] {
  const out: WorldIncident[] = [];
  const duke = bondFor(ctx.character, 'Duke');
  const biscuit = bondFor(ctx.character, 'Biscuit');
  const pepper = bondFor(ctx.character, 'Pepper');
  const treasure = safe(ctx.character.favoriteTreasure);
  const ritual = safe(signatureCue(ctx.memory), 60);

  if (ctx.location === 'park' && duke?.kind === 'rival' && duke.encounters >= 3 && treasure) {
    out.push({
      id: 'duke-eyes-the-treasure', kind: 'rival-provokes', location: 'park', actor: 'duke',
      title: 'Duke is looking at it.',
      setup: `Duke has noticed ${treasure}. He has also noticed that Barkly noticed him noticing it.`,
      barklyOpening: `No. I know that look. He is not getting ${treasure}.`,
      cooldownMs: DAY, priority: 95,
      choices: [
        { id: 'guard', label: 'Let Barkly guard it', barklyLine: 'Correct. Perimeter established.', memory: `Barkly guarded ${treasure} from Duke at the park.`, bondDelta: 1 },
        { id: 'share', label: 'Offer Duke a look', barklyLine: 'A LOOK. With his eyes. From there.', memory: `You made Barkly let Duke inspect ${treasure}; Barkly reluctantly allowed it.`, bondDelta: -1 },
        { id: 'leave', label: 'Walk away', barklyLine: 'Strategic relocation. Not retreat.', memory: `Barkly carried ${treasure} away rather than start another Duke incident.`, bondDelta: -1 },
      ],
    });
  }

  if (ctx.location === 'park' && biscuit?.kind === 'friend' && biscuit.encounters >= 3) {
    out.push({
      id: 'biscuit-lost-stick', kind: 'friend-needs-you', location: 'park', actor: 'biscuit',
      title: 'Biscuit has a problem.',
      setup: 'Biscuit has lost a specific stick and is behaving like this is a municipal emergency.',
      barklyOpening: 'Okay, apparently we have a case now.',
      cooldownMs: DAY * 2, priority: 72,
      choices: [
        { id: 'help', label: 'Help search', barklyLine: 'Nobody panic. I have a nose and no formal training.', memory: 'Barkly helped Biscuit search the park for the important missing stick.', bondDelta: 1 },
        { id: 'substitute', label: 'Find a different stick', barklyLine: 'A stick is a stick. I am prepared to defend this in court.', memory: 'Barkly tried to solve Biscuit’s missing-stick crisis with a substitute.', bondDelta: 0 },
        { id: 'ignore', label: 'Not our problem', barklyLine: 'Cold. Efficient. I respect it a little.', memory: 'You and Barkly declined Biscuit’s missing-stick emergency.', bondDelta: -1 },
      ],
    });
  }

  if (ctx.location === 'town' && pepper && pepper.encounters >= 3 && ritual) {
    out.push({
      id: 'pepper-knows-the-bit', kind: 'reputation', location: 'town', actor: 'pepper',
      title: 'Pepper knows the bit.',
      setup: `Pepper has somehow heard about “${ritual}.” This was supposed to be private lore.`,
      barklyOpening: 'Who told Pepper? I want names.',
      cooldownMs: DAY * 3, priority: 84,
      choices: [
        { id: 'perform', label: `Do “${ritual}”`, barklyLine: 'Fine. But now it is a public performance.', memory: `Barkly performed the private “${ritual}” routine for Pepper in town.`, bondDelta: 1 },
        { id: 'deny', label: 'Deny everything', barklyLine: 'Never heard of it. Fake news. Next question.', memory: `Barkly denied that the “${ritual}” routine exists when Pepper brought it up.`, bondDelta: 0 },
      ],
    });
  }

  if (ctx.location === 'beach' && treasure && (ctx.character.treasuresFound ?? 0) >= 3) {
    out.push({
      id: 'gull-treasure-inspection', kind: 'treasure-chaos', location: 'beach',
      title: 'A gull has made a mistake.',
      setup: `A gull lands much too close to ${treasure}. Barkly immediately interprets this as attempted theft.`,
      barklyOpening: 'HEY. AIR DUKE. BACK UP.',
      cooldownMs: DAY * 2, priority: 66,
      choices: [
        { id: 'chase', label: 'Chase the gull', barklyLine: 'THIEF WITH WINGS. COME BACK AND FACE THE LAW.', memory: `Barkly chased a gull away from ${treasure} at the beach.` },
        { id: 'hold', label: 'Hold Barkly back', barklyLine: 'You are obstructing justice.', memory: `You stopped Barkly from starting a beach feud with a gull over ${treasure}.` },
      ],
    });
  }

  if (ctx.location === 'home' && ritual) {
    const publicWitness = Object.entries(ctx.character.socialBonds ?? {})
      .filter(([, bond]) => bond.encounters >= 3)
      .sort((a, b) => b[1].encounters - a[1].encounters)[0]?.[0];
    if (publicWitness) {
      out.push({
        id: 'private-bit-followup', kind: 'private-bit-leaks', location: 'home',
        title: 'The bit followed you home.',
        setup: `${safe(displayName(publicWitness), 50)} saw “${ritual}” recently. Barkly is now reconsidering whether it belongs to the public.`,
        barklyOpening: `I have been thinking. “${ritual}” used to be OUR thing.`,
        cooldownMs: DAY * 4, priority: 60,
        choices: [
          { id: 'keep-private', label: 'Keep it ours', barklyLine: 'Good. Classified again.', memory: `You and Barkly decided “${ritual}” should stay a private ritual.` },
          { id: 'make-signature', label: 'Make it his signature', barklyLine: 'Fine. If they are going to know it, I am going to be famous for it.', memory: `You and Barkly decided “${ritual}” could become his public signature.` },
        ],
      });
    }
  }

  return out;
}

/** Highest-priority incident history has earned, or null if the world stays quiet. */
export function deriveWorldIncident(ctx: IncidentContext): WorldIncident | null {
  const ledger = ctx.ledger ?? {};
  return candidates(ctx)
    .filter((incident) => eligible(incident, ledger, ctx.now))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0] ?? null;
}

export function noteIncidentSeen(ledger: IncidentLedger, incident: WorldIncident, now: number): IncidentLedger {
  const previous = ledger[incident.id];
  return {
    ...ledger,
    [incident.id]: {
      timesSeen: (previous?.timesSeen ?? 0) + 1,
      lastSeenAt: now,
      lastChoiceId: previous?.lastChoiceId,
    },
  };
}

export function noteIncidentChoice(ledger: IncidentLedger, incidentId: string, choiceId: string): IncidentLedger {
  const previous = ledger[incidentId];
  if (!previous) return ledger;
  return { ...ledger, [incidentId]: { ...previous, lastChoiceId: choiceId } };
}
