/**
 * What he is looking at.
 *
 * This is a small file with an outsized job: it is the difference between an
 * app that TELLS you the dog is hungry and a dog that stares at his bowl until
 * you do something about it. The properties worth pinning are about priority
 * and about not lying — he must never look at something that is not there, and
 * being spoken to must outrank his own appetite, because a character who does
 * not turn when addressed reads as furniture.
 */

import {
  rivalInSight, attentionFor, lookFor, GLANCE } from '../src/ui/attention';

const base = { wants: null, npcSpeaking: null, speaking: false, asleep: false } as const;

describe('what he attends to', () => {
  it('looks at you when nothing else is happening — that is the default', () => {
    expect(attentionFor({ ...base })).toEqual({ at: 'you' });
  });

  it('looks at the thing he wants', () => {
    expect(attentionFor({ ...base, wants: 'feed' })).toEqual({ at: 'bowl' });
    expect(attentionFor({ ...base, wants: 'play' })).toEqual({ at: 'toy' });
    expect(attentionFor({ ...base, wants: 'sleep' })).toEqual({ at: 'bed' });
  });

  it('turns to whoever is talking, even when he is hungry', () => {
    // A dog that ignores someone addressing him is furniture. This outranks
    // his own appetite on purpose.
    expect(attentionFor({ ...base, wants: 'feed', npcSpeaking: 'duke' })).toEqual({
      at: 'npc',
      id: 'duke',
    });
  });

  it('looks at YOU while he is talking to you', () => {
    expect(attentionFor({ ...base, wants: 'feed', speaking: true })).toEqual({ at: 'you' });
  });

  it('asleep, he is facing his bed and nothing else moves him', () => {
    expect(attentionFor({ ...base, asleep: true, npcSpeaking: 'duke', wants: 'play' })).toEqual({
      at: 'bed',
    });
  });
});

describe('the directions are directions, not coordinates', () => {
  it('you are straight ahead', () => {
    expect(lookFor({ at: 'you' })).toEqual({ x: 0, y: 0 });
  });

  it('his things are DOWN, because they are on the floor', () => {
    for (const at of ['bowl', 'toy', 'bed'] as const) {
      expect(lookFor({ at }).y).toBeGreaterThan(0.5);
    }
  });

  it('the bowl and the bed are on opposite sides, as they are on screen', () => {
    expect(lookFor({ at: 'bowl' }).x).toBeLessThan(0);
    expect(lookFor({ at: 'bed' }).x).toBeGreaterThan(0);
    expect(lookFor({ at: 'toy' }).x).toBe(0);
  });

  it('the other dogs are where they actually stand', () => {
    // Biscuit holds the left edge of the scene; Duke and Pepper the right.
    expect(lookFor({ at: 'npc', id: 'biscuit' }).x).toBeLessThan(0);
    expect(lookFor({ at: 'npc', id: 'duke' }).x).toBeGreaterThan(0);
    expect(lookFor({ at: 'npc', id: 'pepper' }).x).toBeGreaterThan(0);
  });

  it('never asks for a look his neck cannot make', () => {
    const every = [
      { at: 'you' }, { at: 'bowl' }, { at: 'toy' }, { at: 'bed' },
      { at: 'npc', id: 'biscuit' }, { at: 'npc', id: 'duke' }, { at: 'npc', id: 'pepper' },
    ] as const;
    for (const a of every) {
      const { x, y } = lookFor(a);
      expect(Math.abs(x)).toBeLessThanOrEqual(1);
      expect(Math.abs(y)).toBeLessThanOrEqual(1);
    }
  });
});

describe('it is a glance, not a stare', () => {
  it('he spends longer looking back at you than at the thing', () => {
    // The looking-BACK is the half that carries the meaning: checking the bowl
    // is information, checking you is a question.
    expect(GLANCE.back).toBeGreaterThan(GLANCE.away);
  });
});

/*
 * THE FEUD, VISIBLE BEFORE ANYONE SPEAKS.
 *
 * An NPC only entered his attention while it was actively SPEAKING, so Duke
 * could stand four feet away with a recorded feud behind him and Barkly would
 * carry on staring at his bowl. The Pack Book said "nemesis"; his body said
 * nothing. Added 2026-09-03.
 */
describe('which dog he watches', () => {
  const rival = (encounters: number) => ({ kind: 'rival' as const, encounters });
  const friend = (encounters: number) => ({ kind: 'friend' as const, encounters });

  it('watches a rival he has history with', () => {
    expect(rivalInSight([{ id: 'duke', bond: rival(3) }])).toBe('duke');
  });

  it('does NOT watch a rival he has never actually met', () => {
    // A first meeting is a first meeting. Wariness is earned on the second.
    expect(rivalInSight([{ id: 'duke', bond: rival(0) }])).toBeNull();
    expect(rivalInSight([{ id: 'duke' }])).toBeNull();
  });

  it('never watches a friend that way', () => {
    expect(rivalInSight([{ id: 'biscuit', bond: friend(40) }])).toBeNull();
  });

  it('picks the worst relationship in the room', () => {
    expect(
      rivalInSight([
        { id: 'biscuit', bond: friend(20) },
        { id: 'pepper', bond: rival(2) },
        { id: 'duke', bond: rival(9) },
      ]),
    ).toBe('duke');
  });

  it('an empty park is nobody to watch', () => {
    expect(rivalInSight([])).toBeNull();
  });
});

describe('he keeps an eye on the one he does not trust', () => {
  const base = { wants: null, npcSpeaking: null, speaking: false, asleep: false } as const;

  it('watches a rival who is standing there, unprompted', () => {
    expect(attentionFor({ ...base, rivalPresent: 'duke' })).toEqual({ at: 'npc', id: 'duke' });
  });

  it('interrupts his own dinner to check on him', () => {
    // The honest priority: a dog will look up from the bowl for a dog he
    // dislikes. Wanting food does not outrank it.
    expect(attentionFor({ ...base, wants: 'feed', rivalPresent: 'duke' })).toEqual({ at: 'npc', id: 'duke' });
  });

  it('still gives the floor to whoever is actually talking', () => {
    expect(attentionFor({ ...base, npcSpeaking: 'biscuit', rivalPresent: 'duke' }))
      .toEqual({ at: 'npc', id: 'biscuit' });
  });

  it('looks at YOU while answering you, rival or no rival', () => {
    expect(attentionFor({ ...base, speaking: true, rivalPresent: 'duke' })).toEqual({ at: 'you' });
  });

  it('a meal in front of him still wins — a dog with food does not do eye contact', () => {
    expect(attentionFor({ ...base, eating: true, rivalPresent: 'duke' })).toEqual({ at: 'bowl' });
  });

  it('asleep, nothing moves him, not even Duke', () => {
    expect(attentionFor({ ...base, asleep: true, rivalPresent: 'duke' })).toEqual({ at: 'bed' });
  });

  it('behaves exactly as before when no rival is present', () => {
    expect(attentionFor({ ...base, wants: 'feed' })).toEqual({ at: 'bowl' });
    expect(attentionFor({ ...base, rivalPresent: null })).toEqual({ at: 'you' });
  });
});
