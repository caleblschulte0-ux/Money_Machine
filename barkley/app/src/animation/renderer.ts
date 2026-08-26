/**
 * The renderer contract — the seam between Barkley's brain and his body.
 *
 * A Barkley renderer is any React component that accepts BarkleyRenderProps.
 * The placeholder (ui/BarkleyView.tsx) draws him from plain Views; a
 * production renderer (Rive is the recommended path — state-machine-native,
 * inputs map 1:1 onto these props; Live2D/Spine/sprites/3D all fit too)
 * implements the exact same props. The conversation system never knows which
 * renderer is mounted, and a physical toy maps the same BodyActions to servos.
 */

import { BarkleyState, BodyAction } from '../barkley/types';

export interface BarkleyRenderProps {
  state: BarkleyState;
  /** Body commands currently in effect (ambient + dialogue-chosen). */
  actions: BodyAction[];
}
