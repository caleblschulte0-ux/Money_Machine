/**
 * A render error must never become a white screen, and recovering from one
 * must never cost the child their dog. See src/ui/CrashScreen.tsx.
 */
import { Text } from 'react-native';
import { CrashBoundary } from '../src/ui/CrashScreen';

// Typed by hand, the way the sibling suites type `fs`: the renderer ships with
// jest-expo and a whole @types package for four calls is not worth adding.
declare const require: (m: string) => any;
type Node = { props: Record<string, any> };
type Renderer = { root: { findAll: (f: (n: Node) => boolean) => Node[] }; toJSON: () => unknown };
const TestRenderer = require('react-test-renderer') as { create: (el: unknown) => Renderer };
const { act } = require('react-test-renderer') as { act: (fn: () => void) => void };
const { readFileSync } = require('fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('path') as { join: (...p: string[]) => string };

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('boom');
  return <Text>alive</Text>;
}

describe('the crash boundary', () => {
  const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
  afterAll(() => quiet.mockRestore());

  it('shows the recovery screen instead of an empty tree', () => {
    shouldThrow = true;
    let r!: Renderer;
    act(() => { r = TestRenderer.create(<CrashBoundary><Flaky /></CrashBoundary>); });
    expect(r.root.findAll((n) => n.props.testID === 'crash-screen').length).toBeGreaterThan(0);
    expect(JSON.stringify(r.toJSON())).toContain('Try again');
  });

  it('"Try again" remounts the tree once the fault is gone', () => {
    shouldThrow = true;
    let r!: Renderer;
    act(() => { r = TestRenderer.create(<CrashBoundary><Flaky /></CrashBoundary>); });
    shouldThrow = false;
    const retry = r.root.findAll((n) => n.props.testID === 'crash-retry' && typeof n.props.onPress === 'function')[0];
    act(() => { retry.props.onPress(); });
    expect(JSON.stringify(r.toJSON())).toContain('alive');
  });

  it('renders children untouched when nothing throws', () => {
    shouldThrow = false;
    let r!: Renderer;
    act(() => { r = TestRenderer.create(<CrashBoundary><Flaky /></CrashBoundary>); });
    expect(JSON.stringify(r.toJSON())).toContain('alive');
  });

  it('never touches storage -- recovering must not wipe his memory', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'ui', 'CrashScreen.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/AsyncStorage|storage|clear\(|remove\(|reset/i);
  });

  it('wraps the whole app', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    expect(app).toMatch(/<CrashBoundary>\s*<BarklyRoom \/>\s*<\/CrashBoundary>/);
  });
});

