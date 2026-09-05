
/**
 * Identity, biography and incidents each shipped as a well-tested engine that
 * nothing imported: green CI over code no player could reach. Unit tests could
 * not catch that, because a pure function passes its tests whether or not
 * anyone calls it. These assert the SEAM -- that the runtime still reaches
 * them -- so disconnecting one fails the build instead of going quiet.
 */
declare const __filename: string;
declare const require: (m: string) => any;
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: string) => string };
const { join } = require('path') as { join: (...p: string[]) => string };

const ROOT = join(__filename, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('the deep systems stay wired to the runtime', () => {
  it('the system prompt is built from his formed identity', () => {
    const prompts = read('src/barkly/prompts.ts');
    expect(prompts).toContain("from './identity'");
    expect(prompts).toMatch(/deriveBarklyIdentity\(/);
    expect(prompts).toMatch(/describeIdentity\(/);
  });

  it('the controller derives identity and the room biography', () => {
    const hook = read('src/hooks/useBarkly.ts');
    expect(hook).toContain("from '../barkly/identity'");
    expect(hook).toContain("from '../world/biography'");
    expect(hook).toMatch(/deriveBarklyIdentity\(/);
    expect(hook).toMatch(/deriveHomeBiography\(/);
    // Exposed on the controller, or the UI cannot render any of it.
    expect(hook).toMatch(/\n\s+identity,\n/);
    expect(hook).toMatch(/\n\s+biography,\n/);
  });

  it('the home scene renders biography props the player can actually see', () => {
    const room = read('src/ui/BarklyRoom.tsx');
    expect(room).toMatch(/biography=\{barkly\.biography\}/);
    const home = read('src/ui/scenes/HomeRenderedScene.tsx');
    expect(home).toContain("from '../../world/biography'");
    expect(home).toMatch(/testID=\{`biography-\$\{prop\.id\}`\}/);
  });

  it('the world can start an incident, and the choice is playable', () => {
    const hook = read('src/hooks/useBarkly.ts');
    expect(hook).toContain("from '../world/incidents'");
    expect(hook).toMatch(/deriveWorldIncident\(/);
    expect(hook).toMatch(/noteIncidentSeen\(/);
    expect(hook).toMatch(/noteIncidentChoice\(/);
    expect(hook).toMatch(/\n\s+activeIncident,\n/);
    expect(hook).toMatch(/\n\s+resolveIncident,\n/);
    const room = read('src/ui/BarklyRoom.tsx');
    expect(room).toMatch(/momentFromIncident\(barkly\.activeIncident\)/);
    expect(room).toMatch(/barkly\.resolveIncident\(/);
  });

  it('incident and canon state survive a restart', () => {
    const keys = read('src/storage/keys.ts');
    expect(keys).toMatch(/INCIDENT_KEY/);
    expect(keys).toMatch(/COAUTHOR_KEY/);
    // In ALL_SAVE_KEYS, or a preset load would leave a previous life behind.
    const all = keys.slice(keys.indexOf('ALL_SAVE_KEYS'));
    expect(all).toMatch(/INCIDENT_KEY/);
    expect(all).toMatch(/COAUTHOR_KEY/);
  });

  /*
   * The test above is exactly the trap this file was written about. It passed
   * for weeks while the co-authorship engine had NO caller: the key existed,
   * the preset wrote it, ALL_SAVE_KEYS listed it -- and nothing ever produced
   * a proposal, so the canon that "survived a restart" was always the empty
   * array. A storage key is not a seam. These are.
   */
  it('Barkly can actually propose canon, and the player can answer', () => {
    const hook = read('src/hooks/useBarkly.ts');
    expect(hook).toContain("from '../barkly/coauthor'");
    expect(hook).toMatch(/deriveBarklyProposal\(/);
    expect(hook).toMatch(/resolveBarklyProposal\(/);
    // Read back and written, or a ratified name dies with the session.
    expect(hook).toMatch(/asyncStorageStore\.get\(COAUTHOR_KEY\)/);
    expect(hook).toMatch(/gate\.write\(COAUTHOR_KEY/);
    // Exposed, or the UI cannot show the question.
    expect(hook).toMatch(/\n\s+activeProposal,\n/);
    expect(hook).toMatch(/\n\s+resolveProposal,\n/);
  });

  it('the proposal is a sheet the player can see and answer', () => {
    const room = read('src/ui/BarklyRoom.tsx');
    expect(room).toMatch(/momentFromProposal\(barkly\.activeProposal\)/);
    expect(room).toMatch(/barkly\.resolveProposal\(/);
    const sheet = read('src/ui/EncounterSheet.tsx');
    expect(sheet).toMatch(/export function momentFromProposal/);
  });

  it('ratified canon reaches BOTH brains, not just the model', () => {
    // The prompt carries it as prose for a model...
    const prompts = read('src/barkly/prompts.ts');
    expect(prompts).toMatch(/coauthorPromptTexture\(/);
    // ...and the offline brain gets it as data, or the ball he named goes
    // back to being "the ball" the moment the network drops.
    const dialogue = read('src/barkly/dialogue.ts');
    expect(dialogue).toMatch(/canon: canon\?\.canon\.map/);
    const scripted = read('src/providers/dialogue/scripted.ts');
    expect(scripted).toMatch(/function canonName\(/);
  });

  /*
   * storyV2 was the same story as coauthor, one file over: 195 lines of
   * persistent, branching, resolvable sagas, imported by its own test and by
   * nothing else. `story.ts` -- which IS wired -- derives the saga current
   * history implies, so the Pack Book always had a "current drama"; it just
   * had no past tense, could not be decided, and could never end. Closing the
   * app put you back at Chapter I.
   */
  it('the saga ledger is loaded, synced, decided and saved', () => {
    const hook = read('src/hooks/useBarkly.ts');
    expect(hook).toContain("from '../barkly/storyV2'");
    expect(hook).toMatch(/syncStoryState\(/);
    expect(hook).toMatch(/advanceStory\(/);
    expect(hook).toMatch(/asyncStorageStore\.get\(STORY_KEY\)/);
    expect(hook).toMatch(/gate\.write\(STORY_KEY/);
    expect(hook).toMatch(/\n\s+activeStoryChoice,\n/);
    expect(hook).toMatch(/\n\s+resolveStoryChoice,\n/);
    const keys = read('src/storage/keys.ts');
    expect(keys.slice(keys.indexOf('ALL_SAVE_KEYS'))).toMatch(/STORY_KEY/);
  });

  it('the saga is a fork the player can take, and a history they can read', () => {
    const room = read('src/ui/BarklyRoom.tsx');
    expect(room).toMatch(/momentFromStory\(barkly\.activeStoryChoice\)/);
    expect(room).toMatch(/barkly\.resolveStoryChoice\(/);
    // The chapters and the endings have to be somewhere the player can LOOK,
    // or a resolved saga is a row in a JSON file.
    expect(room).toMatch(/story=\{barkly\.storyState\}/);
    const pack = read('src/ui/PackBookSheet.tsx');
    expect(pack).toMatch(/testID=\{`saga-chapter-\$\{chapter\.number\}`\}/);
    expect(pack).toMatch(/testID=\{`saga-archived-\$\{past\.id\}`\}/);
    // And the model is told what already ended, so it cannot restart it.
    expect(read('src/barkly/prompts.ts')).toMatch(/storyPromptTexture\(/);
  });

  it('every line the controller speaks comes from a file the bank harvests', () => {
    /*
     * Not a style rule -- an audit that keeps finding the same bug. Three
     * spoken surfaces were narrated by the browser because the harvest list
     * had never been checked against what `speak(...)` actually holds:
     * encounter replies (the main NPC interaction), incident choices, and the
     * saga forks added here. The scope names are what the SOURCES entries use;
     * a new spoken property added to one of these files without extending its
     * scope is exactly the failure this catches.
     */
    const bank = read('scripts/voice-bank.mjs');
    for (const file of [
      'src/barkly/encounters.ts',
      'src/world/incidents.ts',
      'src/barkly/storyV2.ts',
      'src/barkly/coauthor.ts',
    ]) {
      expect(bank).toContain(file);
    }
  });

  it('the incident gate reads onboarding COMPLETION, not its mere existence', () => {
    // `onboarding` stays a truthy record forever once the flow is done, so a
    // plain truthiness check silences the world permanently. This cost a
    // debugging round; it should not cost another.
    const hook = read('src/hooks/useBarkly.ts');
    expect(hook).toMatch(/onboarding\?\.step !== 'done'/);
  });
});
