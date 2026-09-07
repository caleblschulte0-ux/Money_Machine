import { baselineZ } from '../src/ui/scenes/WorldScene';

/*
 * THE PARK BENCH WAS DRAWN THROUGH A TREE TRUNK.
 *
 * Not by a nudge -- fully inside it, at every viewport, for as long as anyone
 * had been looking at the park. The cause was that draw order came from the
 * LAYER NAME: the bench sat in `props` (z 40), the tree in `landmark` (z 30),
 * so the bench won even though its base was 40px higher up the ground plane,
 * which on a flat ground plane means it is standing further away.
 *
 * That made depth a naming convention maintained by hand, and it drifted the
 * moment anything moved. The only way to catch it was to look at the render,
 * and nothing in the repo looked.
 *
 * These are the invariants of the painter's rule that replaced it.
 */
describe('scenery is painted back to front by where it stands', () => {
  it('puts the nearer object in front, whatever it is called', () => {
    // The real numbers, measured at 390x844: bench base 361, tree base 401.
    const bench = baselineZ(271, 90);
    const tree = baselineZ(90, 311);
    expect(tree).toBeGreaterThan(bench);
  });

  it('orders by the ground line and not by height or size', () => {
    // A short thing standing in front of a tall thing still wins. This is the
    // case a "bigger is nearer" heuristic gets backwards.
    const smallButNear = baselineZ(500, 40);
    const hugeButFar = baselineZ(60, 300);
    expect(smallButNear).toBeGreaterThan(hugeButFar);
  });

  it('ties when two things stand on the same line', () => {
    expect(baselineZ(100, 200)).toBe(baselineZ(250, 50));
  });

  it('stays positive for a prop whose box starts above the canvas', () => {
    // Park's near tree is placed at top:-88 on a short viewport; a negative
    // zIndex there would drop it behind the sky instead of in front of it.
    expect(baselineZ(-88, 20)).toBeGreaterThan(0);
    expect(baselineZ(-900, 0)).toBeGreaterThan(0);
  });
});
