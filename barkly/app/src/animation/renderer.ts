/**
 * The renderer contract — the seam between Barkly's brain and his body.
 *
 * A Barkly renderer is any React component that accepts BarklyRenderProps.
 * The placeholder (ui/BarklyView.tsx) draws him from plain Views; a
 * production renderer (Rive is the recommended path — state-machine-native,
 * inputs map 1:1 onto these props; Live2D/Spine/sprites/3D all fit too)
 * implements the exact same props. The conversation system never knows which
 * renderer is mounted, and a physical toy maps the same BodyActions to servos.
 */

import { BarklyState, BodyAction } from '../barkly/types';

export interface BarklyRenderProps {
  state: BarklyState;
  /** Body commands currently in effect (ambient + dialogue-chosen). */
  actions: BodyAction[];
  /**
   * Scene-motion hint from the stage (not the brain): which travel pose to
   * hold while the stage moves him — running right, or carrying the ball
   * back leftward. Renderers without matching art may ignore it.
   */
  variant?: 'runRight' | 'carryLeft' | null;
  /**
   * Tint for a bought collar. The concept sheet's brown leather is the
   * default and stays canon; this recolours it, it never redraws him. A
   * renderer with no collar layer may ignore it.
   */
  /** STORE id of the collar he is wearing, e.g. `collar_red`. */
  collarId?: string | null;
}
