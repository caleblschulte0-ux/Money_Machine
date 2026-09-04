import { freshCharacter } from '../src/barkly/character';
import { deriveBarklyProposal, freshCoauthorState, resolveBarklyProposal } from '../src/barkly/coauthor';
import { emptyMemory } from '../src/barkly/memory';
import { TREASURES } from '../src/world/stash';

const stats = { mood: 70, energy: 70, hunger: 30, affection: 85, curiosity: 75 };
const NOW = 100_000_000;

describe('Barkly co-authorship', () => {
  test('Barkly can name an object only after attachment is earned', () => {
    const character = freshCharacter();
    character.favoriteTreasure = 'duck rock';
    character.treasureAffinities = { 'duck rock': { score: 6, discoveries: 1, firstSeenAt: 1, lastSeenAt: 2 } };
    const proposal = deriveBarklyProposal({ character, memory: emptyMemory(), stats, now: NOW });
    expect(proposal?.kind).toBe('object-name');
    expect(proposal?.subject).toBe('duck rock');
    expect(proposal?.proposedValue).toMatch(/rock/i);
  });

  test('accepting Barkly canon makes it durable and prevents repeat asks', () => {
    const character = freshCharacter();
    character.favoriteTreasure = 'good stick';
    character.treasureAffinities = { 'good stick': { score: 7, discoveries: 2, firstSeenAt: 1, lastSeenAt: 2 } };
    const memory = emptyMemory();
    const initial = freshCoauthorState();
    const proposal = deriveBarklyProposal({ character, memory, stats, state: initial, now: NOW })!;
    const accepted = resolveBarklyProposal(initial, proposal, true, NOW);
    expect(accepted.canon?.subject).toBe('good stick');
    expect(accepted.state.canon).toHaveLength(1);
    const later = deriveBarklyProposal({ character, memory, stats, state: accepted.state, now: NOW + 24 * 3_600_000 });
    expect(later?.id).not.toBe(proposal.id);
  });

  test('rejecting a proposal is also remembered', () => {
    const character = freshCharacter();
    character.socialBonds = { Duke: { kind: 'rival', encounters: 8, firstSeenAt: 1, lastSeenAt: 2 } };
    const initial = freshCoauthorState();
    const proposal = deriveBarklyProposal({ character, memory: emptyMemory(), stats, state: initial, now: NOW })!;
    expect(proposal.kind).toBe('dog-nickname');
    const rejected = resolveBarklyProposal(initial, proposal, false, NOW);
    expect(rejected.state.rejected[proposal.id]).toBe(NOW);
    const later = deriveBarklyProposal({ character, memory: emptyMemory(), stats, state: rejected.state, now: NOW + 24 * 3_600_000 });
    expect(later).toBeNull();
  });

  test('a repeated private routine can become a tradition Barkly proposes', () => {
    const memory = emptyMemory();
    memory.trainingRules = [{
      id: 'showtime', normalizedCue: 'showtime', cue: 'showtime', instruction: 'spin then sit',
      speech: 'Fine.', actions: [], learnedAt: 1, updatedAt: 2, timesTriggered: 10,
    }];
    const proposal = deriveBarklyProposal({ character: freshCharacter(), memory, stats, now: NOW });
    expect(proposal?.kind).toBe('signature');
    expect(proposal?.ask).toMatch(/our thing/i);
  });

  /*
   * The names are written as jokes -- "a sock (previously owned)", "a map? or
   * trash? unclear" -- and the generator used to title-case the whole joke and
   * cut it at 32 characters. 20 of the 24 treasures in the game came out as
   * "The A Sock (Previously Owned)" or "The Someone'S Frisbee (Finders Keep…",
   * truncated mid-word, in the one beat where Barkly is the author.
   *
   * This asserts the SHAPE over the live table rather than freezing the 24
   * strings, so a treasure added later is held to the same bar.
   */
  test('every treasure in the game gets a name that reads like a name', () => {
    for (const treasure of TREASURES) {
      const character = freshCharacter();
      character.favoriteTreasure = treasure.name;
      character.treasureAffinities = {
        [treasure.name]: { score: 6, discoveries: 1, firstSeenAt: 1, lastSeenAt: 2 },
      };
      const proposal = deriveBarklyProposal({ character, memory: emptyMemory(), stats, now: NOW });
      const name = proposal?.proposedValue ?? '';
      expect(proposal?.kind).toBe('object-name');
      // Never a truncation, an aside, or an article he forgot to strip.
      expect(name).not.toMatch(/[…()?,]/);
      expect(name).not.toMatch(/^The (?:A|An|The|One|Exactly|Half|Piece|Length)\b/);
      // Never "Someone'S". A stray capital after an apostrophe is the tell
      // that something ran a regex over prose and called it a name.
      expect(name).not.toMatch(/'[A-Z]/);
      expect(name.split(/\s+/).length).toBeLessThanOrEqual(5);
      expect(name.length).toBeGreaterThan(2);
    }
  });

  test('the tradition refusal does not name a count the ask contradicts', () => {
    const memory = emptyMemory();
    memory.trainingRules = [{
      id: 'showtime', normalizedCue: 'showtime', cue: 'showtime', instruction: 'spin then sit',
      speech: 'Fine.', actions: [], learnedAt: 1, updatedAt: 2, timesTriggered: 10,
    }];
    const proposal = deriveBarklyProposal({ character: freshCharacter(), memory, stats, now: NOW })!;
    expect(proposal.ask).toContain('10 times');
    // It said "Eight performances" while the ask said ten.
    expect(proposal.rejectLine).not.toMatch(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i);
  });
});