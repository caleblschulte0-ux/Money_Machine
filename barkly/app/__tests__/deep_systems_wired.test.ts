
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

  it('the incident gate reads onboarding COMPLETION, not its mere existence', () => {
    // `onboarding` stays a truthy record forever once the flow is done, so a
    // plain truthiness check silences the world permanently. This cost a
    // debugging round; it should not cost another.
    const hook = read('src/hooks/useBarkly.ts');
    expect(hook).toMatch(/onboarding\?\.step !== 'done'/);
  });
});
