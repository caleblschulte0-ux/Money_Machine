import { freshCharacter } from '../src/barkly/character';
import { deriveBarklyProposal, freshCoauthorState, resolveBarklyProposal } from '../src/barkly/coauthor';
import { emptyMemory } from '../src/barkly/memory';

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
});
