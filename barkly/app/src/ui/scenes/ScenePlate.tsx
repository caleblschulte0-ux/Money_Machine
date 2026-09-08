import React from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

const MANIFEST = require('../../../assets/world/scenes/manifest.json') as SceneManifest;
const PLATE_ART: Record<string, number> = {
  park: require('../../../assets/world/scenes/park.png'),
};

type Anchor = { x: number; y: number };
type SceneManifest = {
  scenes: Record<string, {
    file: string;
    width: number;
    height: number;
    unitPx?: number;
    anchors: Record<string, Anchor>;
  }>;
};

/**
 * THE SWITCH. One constant, and the app goes back to composited scenes.
 *
 * A location can be drawn two ways now: assembled at runtime out of separate
 * props over a code-drawn ground, or as one plate rendered in Blender as a
 * single lit place. The second is a better picture and a worse fit for a
 * responsive app, so both paths stay live until the trade is settled, and the
 * old one is not deleted -- it is the thing this falls back to.
 *
 * Flip to `false` and every scene renders exactly as it did before this
 * existed. Nothing else has to change; no assets have to be restored.
 */
export const SCENE_PLATES = true;

/** Which locations actually have a plate. The rest stay composited either way. */
export function hasPlate(name: string): boolean {
  return SCENE_PLATES && name in PLATE_ART && name in MANIFEST.scenes;
}

/**
 * A location's plate, cover-scaled and ANCHORED to where the dog stands.
 *
 * A plate is one fixed-aspect image and a phone is not, so something has to
 * give. What must NOT give is the dog's feet: he stands at a particular place
 * on that painted ground, and if the plate slides even slightly he is floating
 * or buried. So the anchor is solved for first and the scale is then chosen as
 * the smallest one that still covers the screen with the anchor held.
 *
 * The anchor is not a tuned number. `tools/blender/world_scene_pack.py`
 * projects the real world point through the real camera and publishes it in
 * the manifest, so the contract cannot drift from the picture -- a re-render
 * that moves the ground moves the anchor with it.
 */
export function ScenePlate({
  name,
  groundY,
  night,
  opacity = 1,
}: {
  name: string;
  /** Screen y of the dog's ground line -- the same value the scene already uses. */
  groundY: number;
  night?: boolean;
  opacity?: number;
}) {
  const { width, height } = useWindowDimensions();
  const meta = MANIFEST.scenes[name];
  const art = PLATE_ART[name];
  if (!meta || !art) return null;

  const stand = meta.anchors.stand ?? { x: 0.5, y: 0.6 };
  const ax = Math.min(0.98, Math.max(0.02, stand.x));
  const ay = Math.min(0.98, Math.max(0.02, stand.y));

  /*
   * Three lower bounds on the scale, all of them from the same requirement:
   * with the anchor pinned, the plate still has to reach every screen edge.
   *
   *   left  <= 0            needs  renderedW >= width / (2 * ax)
   *   right >= width        needs  renderedW >= width / (2 * (1 - ax))
   *   top   <= 0            needs  renderedH >= groundY / ay
   *   bottom >= height      needs  renderedH >= (height - groundY) / (1 - ay)
   *
   * Taking the largest is the smallest plate that satisfies all four, which is
   * the least cropping this composition can be shown at on this device.
   */
  const byLeft = width / (2 * ax) / meta.width;
  const byRight = width / (2 * (1 - ax)) / meta.width;
  const byTop = groundY / ay / meta.height;
  const byBottom = (height - groundY) / (1 - ay) / meta.height;
  const scale = Math.max(byLeft, byRight, byTop, byBottom);

  const w = meta.width * scale;
  const h = meta.height * scale;

  return (
    <View style={styles.fill} pointerEvents="none">
      <Image
        source={art}
        /*
         * `scripts/blocking.mjs` measures every <img> in the scene and refuses
         * a prop standing wholly inside another. A plate is an image the size
         * of the screen, so without this every remaining prop, badge anchor and
         * NPC would report as buried inside it -- the same false positive the
         * haze copy caused, from the other direction. A plate is the GROUND,
         * not an object standing on it.
         */
        testID="scene-plate"
        resizeMode="stretch"
        style={{
          position: 'absolute',
          left: width / 2 - ax * w,
          top: groundY - ay * h,
          width: w,
          height: h,
          // Night is the master grade's job, exactly as it is for every prop:
          // dimming the plate as well would take it below the sky it sits in.
          opacity: opacity * (night ? 0.94 : 1),
        }}
      />
    </View>
  );
}

/** Where the plate puts the horizon on screen, for the sky and the haze. */
export function plateHorizon(name: string, groundY: number, height: number): number | null {
  const meta = MANIFEST.scenes[name];
  if (!meta?.anchors.horizon || !meta.anchors.stand) return null;
  const stand = meta.anchors.stand;
  const horizon = meta.anchors.horizon;
  // The two anchors are a known distance apart in the plate; the scale that
  // put `stand` on `groundY` puts `horizon` here.
  const ay = stand.y;
  const byTop = groundY / ay / meta.height;
  const byBottom = (height - groundY) / (1 - ay) / meta.height;
  const scale = Math.max(byTop, byBottom);
  return groundY - (stand.y - horizon.y) * meta.height * scale;
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});
