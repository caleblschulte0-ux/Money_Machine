/**
 * Barkly, as a puppet instead of a photograph.
 *
 * Everything physical he did used to be a transform on the WHOLE dog. A head
 * tilt rotated his legs. An ear flick was a full-body wobble. Looking at
 * something was impossible, so the app had to TELL you he was hungry with a
 * badge instead of letting him stare at his bowl. One image can only move as
 * one object, and that was the ceiling on how alive he could seem.
 *
 * So he is cut into layers — head, both ears, body — by scripts/build-rig.py,
 * which slices the APPROVED render and refuses to write anything unless
 * stacking the pieces back up reproduces that file pixel for pixel. This is not
 * a redesign and cannot become one: at rest he is the same drawing, and the
 * build fails if he stops being.
 *
 * THE HIERARCHY IS THE WHOLE TRICK. Ears are children of the head, so a head
 * cock carries them with it and only their own extra swing is theirs. Parented
 * wrong — ears rotating in world space — a head turn slides his skull out from
 * under them and opens a seam across the top. It looked fine standing still,
 * which is exactly how that bug survives.
 *
 * WHAT IS STILL FLAT. Only his FRONT pose is rigged. The three-quarter, side-lie
 * and closeup renders are whole images, and BarklyPhotoView keeps using them —
 * this takes over for the pose he is in most of the time, which is most of the
 * value for a fraction of the work.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import rig from '../../assets/barkly/rig/rig.json';
import { BarklyState, BodyAction } from '../barkly/types';

const ART = {
  body: require('../../assets/barkly/rig/body.png'),
  ear_l: require('../../assets/barkly/rig/ear_l.png'),
  ear_r: require('../../assets/barkly/rig/ear_r.png'),
  head: require('../../assets/barkly/rig/head.png'),
  head_blink: require('../../assets/barkly/rig/head_blink.png'),
  head_half: require('../../assets/barkly/rig/head_half.png'),
  head_wide: require('../../assets/barkly/rig/head_wide.png'),
  head_smile: require('../../assets/barkly/rig/head_smile.png'),
  head_squint: require('../../assets/barkly/rig/head_squint.png'),
  head_mouth_open: require('../../assets/barkly/rig/head_mouth_open.png'),
} as const;

type HeadArt = Extract<keyof typeof ART, `head${string}`>;

const CANVAS = rig.canvas;
const L = rig.layers;
const P = rig.pivots;

/**
 * Where he is looking, in his own terms: -1 is hard left / up, +1 is hard
 * right / down, 0 is straight at you. The stage works out the numbers; he does
 * not know what a bowl is.
 */
export interface LookTarget {
  x: number;
  y: number;
}

export interface RigProps {
  state: BarklyState;
  actions: BodyAction[];
  /** null = looking at you, which is his default and his most flattering. */
  look?: LookTarget | null;
  speaking?: boolean;
  scale?: number;
  /**
   * A bought collar, as the full-frame overlay derive_collars.py produces.
   * It rides INSIDE the body group, because the collar is on his body — drawn
   * over the whole rig instead, it would sit still while his chest moved.
   */
  collarArt?: number | null;
}

/** How far each part is allowed to go. Measured, not guessed — see the notes. */
const LIMITS = {
  /** Degrees of head cock. Past ~14 the collar stops hiding the neck seam. */
  tilt: 11,
  /** Pixels the head slides to follow a look. It is a turn, faked by a shift. */
  slide: 13,
  nod: 9,
  /**
   * Degrees of ear swing. The build reconstructs the shoulder of his skull
   * behind each ear root, and measuring the exposure across 0..30 degrees put
   * the worst case at 18 pixels — so this is limited by taste, not by tearing.
   */
  ear: 17,
};

function useSpringy(target: number, tension = 60): Animated.Value {
  const v = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: target, tension, friction: 9, useNativeDriver: true }).start();
  }, [target, tension, v]);
  return v;
}

/** A 0→1→0 loop while `active`, eased back to rest when not. */
function useLoop(active: boolean, duration: number): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      Animated.timing(v, { toValue: 0, duration: 260, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, duration, v]);
  return v;
}

/**
 * Rotate about a point. React Native rotates about a view's centre, so every
 * hinge in here is translate-to-pivot, turn, translate back — done in the
 * layer's own coordinates, which is why each part is positioned absolutely on a
 * canvas the size of the original render rather than laid out.
 */
function hinge(
  pivotX: number,
  pivotY: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  deg: Animated.AnimatedInterpolation<string>,
) {
  // React Native turns a view about its OWN CENTRE, so a hinge is: shift the
  // centre onto the pivot, turn, shift back.
  const px = pivotX - (boxX + boxW / 2);
  const py = pivotY - (boxY + boxH / 2);
  return [
    { translateX: px },
    { translateY: py },
    { rotate: deg },
    { translateX: -px },
    { translateY: -py },
  ];
}

function Part({ art, box, style }: { art: number; box: Box; style?: object }) {
  return (
    <Animated.View style={[{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h }, style]}>
      <Image source={art} style={{ width: box.w, height: box.h }} resizeMode="stretch" />
    </Animated.View>
  );
}

interface Box { x: number; y: number; w: number; h: number }

/**
 * ONE scale transform for the whole rig, anchored top-left.
 *
 * Two wrong answers came first, and both are instructive. Applying `scale` to
 * the canvas turns about its CENTRE, so a 416x520 rig in a 244x305 slot lands
 * offset by half the difference — he came out oversized and shoved sideways.
 * Multiplying each layer's box instead fixed the position and introduced
 * hairline seams: every part rounds its own fractional size independently, so
 * where two layers meet the background shows through a sub-pixel crack, and a
 * bright line ran across his head and his chest.
 *
 * Scaling the group once solves both. The offset below is what turns a
 * centre-anchored scale into a top-left one.
 */
function anchorTopLeft(k: number) {
  return [
    { translateX: -(CANVAS.w - CANVAS.w * k) / 2 },
    { translateY: -(CANVAS.h - CANVAS.h * k) / 2 },
    { scale: k },
  ];
}

/** Which face is on the head right now. */
function faceFor(state: BarklyState, speaking: boolean, jawOpen: boolean, blink: number): HeadArt {
  if (speaking && jawOpen) return 'head_mouth_open';
  if (blink === 2) return 'head_blink';
  if (blink === 1) return 'head_half';
  switch (state) {
    case 'happy':
    case 'excited':
    case 'playing':
      return 'head_smile';
    case 'annoyed':
      return 'head_squint';
    case 'listening':
    case 'thinking':
      return 'head_wide';
    case 'sleepy':
      return 'head_half';
    default:
      return 'head';
  }
}

export default function BarklyRig({ state, actions, look, speaking = false, scale = 1, collarArt }: RigProps) {
  const has = (a: BodyAction) => actions.includes(a);

  // ------------------------------------------------------------------ blink
  // Two frames, because a blink that is one frame long reads as a glitch and a
  // blink that skips the half-lid reads as a shutter.
  const [blink, setBlink] = React.useState(0);
  useEffect(() => {
    if (state === 'sleepy') return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const cycle = () => {
      if (!alive) return;
      // Real dogs do not blink on a metronome, and neither does he.
      timer = setTimeout(() => {
        setBlink(1);
        timer = setTimeout(() => {
          setBlink(2);
          timer = setTimeout(() => {
            setBlink(1);
            timer = setTimeout(() => {
              setBlink(0);
              cycle();
            }, 60);
          }, 70);
        }, 45);
      }, 2200 + Math.random() * 3800);
    };
    cycle();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [state]);

  // ------------------------------------------------------------------- jaw
  const [jaw, setJaw] = React.useState(false);
  useEffect(() => {
    if (!speaking) {
      setJaw(false);
      return;
    }
    const id = setInterval(() => setJaw((j) => !j), 115);
    return () => clearInterval(id);
  }, [speaking]);

  // ------------------------------------------------------------- attention
  // A look is a small slide plus a tilt in the same direction, which is what a
  // head turn looks like from the front. Rotating alone reads as a lean;
  // sliding alone reads as the whole dog stepping sideways.
  // The brain's own LOOK_LEFT / LOOK_RIGHT still work: they are a look with no
  // particular thing on the end of it, which is what he does when a line lands.
  const nudged = look ?? (has('LOOK_LEFT') ? { x: -0.7, y: 0 } : has('LOOK_RIGHT') ? { x: 0.7, y: 0 } : null);
  const lx = Math.max(-1, Math.min(1, nudged?.x ?? 0));
  const ly = Math.max(-1, Math.min(1, nudged?.y ?? 0));
  const slide = useSpringy(lx * LIMITS.slide);
  const nod = useSpringy(ly * LIMITS.nod);
  const tiltDeg = useSpringy(
    // He cocks his head when something is odd — a look off to the side, or a
    // question he is chewing on.
    (has('HEAD_TILT') ? 1 : 0) * LIMITS.tilt + lx * LIMITS.tilt * 0.45,
  );

  // ---------------------------------------------------------------- ears
  const perk = has('EAR_PERK') || state === 'listening' || state === 'excited';
  const droop = state === 'sleepy' || state === 'hungry';
  const earBase = droop ? -LIMITS.ear * 0.8 : perk ? LIMITS.ear : 0;
  // One ear leads. A dog that moves both ears in perfect unison is a toy.
  const earLDeg = useSpringy(earBase, 70);
  const earRDeg = useSpringy(earBase * 0.82, 55);
  const flick = useLoop(!droop && !speaking, 2600);

  // ---------------------------------------------------------------- body
  const breathe = useLoop(true, state === 'sleepy' ? 2600 : 1700);
  const wag = useLoop(has('TAIL_WAG') || state === 'happy' || state === 'excited', 260);

  const k = scale;
  const bodyStyle = useMemo(
    () => ({
      transform: [
        { translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] }) },
        { scaleY: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) },
        { rotate: wag.interpolate({ inputRange: [0, 1], outputRange: ['-0.7deg', '0.7deg'] }) },
      ],
    }),
    [breathe, wag],
  );

  const headStyle = useMemo(
    () => ({
      transform: [
        { translateX: slide },
        {
          translateY: Animated.add(
            nod,
            breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -3.4] }),
          ),
        },
        ...hinge(
          P.head.x,
          P.head.y,
          0,
          0,
          CANVAS.w,
          CANVAS.h,
          tiltDeg.interpolate({ inputRange: [-90, 90], outputRange: ['-90deg', '90deg'] }),
        ),
      ],
    }),
    [slide, nod, breathe, tiltDeg],
  );

  const ear = (side: 'l' | 'r', deg: Animated.Value, lead: number) => {
    const box = side === 'l' ? L.ear_l : L.ear_r;
    const piv = side === 'l' ? P.ear_l : P.ear_r;
    const total = Animated.add(deg, flick.interpolate({ inputRange: [0, 1], outputRange: [0, lead] }));
    return (
      <Part
        key={side}
        art={side === 'l' ? ART.ear_l : ART.ear_r}
        box={box}
        style={{
          transform: hinge(
            piv.x,
            piv.y,
            box.x,
            box.y,
            box.w,
            box.h,
            total.interpolate({ inputRange: [-90, 90], outputRange: ['-90deg', '90deg'] }),
          ),
        }}
      />
    );
  };

  const face = faceFor(state, speaking, jaw, blink);

  return (
    <View style={{ width: CANVAS.w * k, height: CANVAS.h * k }} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: CANVAS.w,
          height: CANVAS.h,
          transform: anchorTopLeft(k),
        }}
      >
        {/* Head group: the ears ride on it, which is the point. */}
        <Animated.View style={[StyleSheet.absoluteFill, headStyle]}>
          <Part art={ART[face]} box={L.head} />
          {ear('l', earLDeg, 5)}
          {ear('r', earRDeg, -6)}
        </Animated.View>
        {/* Drawn last so the collar covers where his head meets his neck. */}
        <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
          <Part art={ART.body} box={L.body} />
          {collarArt ? (
            <Image
              source={collarArt}
              style={{ position: 'absolute', left: 0, top: 0, width: CANVAS.w, height: CANVAS.h }}
              resizeMode="stretch"
            />
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}


