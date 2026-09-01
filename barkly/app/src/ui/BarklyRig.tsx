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
  pupil_l: require('../../assets/barkly/rig/pupil_l.png'),
  pupil_r: require('../../assets/barkly/rig/pupil_r.png'),
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

/** Faces whose eyes are the resting ones, so the pupil layers belong on them. */
const NEUTRAL_EYES = new Set<HeadArt>(['head', 'head_smile', 'head_mouth_open']);

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

/**
 * A one-shot physical reaction to something that just happened.
 *
 * The rig existed and almost nothing used it: he could cock his head, and the
 * only thing that ever asked him to was a line of dialogue. Everything else a
 * person does to him — petting him, being refused, arriving somewhere new,
 * being handed something — went past without his body noticing.
 *
 * `at` is a timestamp, not a boolean, so the same beat can fire twice in a row.
 * Petting him three times should be three reactions, not one.
 */
export type BeatKind = 'pet' | 'refuse' | 'arrive' | 'delight';
export interface Beat {
  kind: BeatKind;
  at: number;
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
  /** Something just happened to him. See Beat. */
  beat?: Beat | null;
}

/**
 * How far each part may go — and the shape of the fix for "the animations look
 * goofy", which they did.
 *
 * THE HEAD WAS SLIDING. A look was 13px of horizontal translation plus a tilt,
 * and a front-view head cannot be turned by sliding it: his skull visibly came
 * unscrewed and swam over his collar. Watching twelve frames of it side by side
 * is unambiguous.
 *
 * A real look is mostly EYES. So the pupils carry it, fast and small; the head
 * leans a few degrees after them; the body leans a fraction of that, later
 * still. Nothing translates. The head's hinge is down inside the collar, so a
 * tilt already swings the top of his skull through an arc — that arc is the
 * sideways motion, and it is attached to a neck.
 */
const LIMITS = {
  /** Pixels of pupil travel. Small: past this they climb onto his cheek. */
  eyeX: 4.5,
  eyeY: 2.6,
  /** Degrees the head leans into a look. A deliberate head-cock gets more. */
  lean: 5,
  cock: 9,
  /** Pixels of nod. Vertical reads honestly from the front; sideways does not. */
  nod: 5,
  /** How much of the head's lean the body picks up, a beat later. */
  bodyFollow: 0.22,
  /** Degrees of ear swing. Held poses, not a permanent wobble. */
  ear: 14,
  /** A flick is a quick twitch of ONE ear, and it is an event, not a loop. */
  flick: 7,
};

/**
 * A damped move to a value.
 *
 * `friction` matters more than it looks. At 9 every change overshot and settled
 * with a visible wobble, and a dog whose head boings after every glance reads as
 * a bobblehead. These are tuned to arrive and stop.
 */
function useSpringy(target: number, tension = 50, friction = 13): Animated.Value {
  const v = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: target, tension, friction, useNativeDriver: true }).start();
  }, [target, tension, friction, v]);
  return v;
}

/**
 * How each beat moves him. Degrees and pixels, added on top of whatever else he
 * is doing, so a reaction reads even mid-sentence.
 *
 *   PET      leans in and half-closes his eyes. The head goes DOWN and toward
 *            the hand; ears fall back. This is the one that has to feel good.
 *   REFUSE   pulls back and up, ears flat. Short and sharp — a flinch, not a
 *            sulk, because he is unimpressed rather than hurt.
 *   ARRIVE   a look around: eyes lead left, then right, head trailing.
 *   DELIGHT  ears up, chin up, and a hop the body layer picks up.
 */
const BEATS: Record<BeatKind, { tilt: number; nod: number; ear: number; eye: number; ms: number }> = {
  pet: { tilt: -4, nod: 5, ear: -7, eye: 1.5, ms: 900 },
  refuse: { tilt: 3, nod: -5, ear: -11, eye: -1.5, ms: 520 },
  arrive: { tilt: 0, nod: -2, ear: 8, eye: -4, ms: 1200 },
  delight: { tilt: 0, nod: -4, ear: 13, eye: -2, ms: 700 },
};

/** Fire once per `beat.at`, then settle back to nothing. */
function useBeat(beat: Beat | null | undefined): { v: Animated.Value; kind: BeatKind } {
  const v = useRef(new Animated.Value(0)).current;
  const [kind, setKind] = React.useState<BeatKind>('pet');
  const last = useRef(0);
  useEffect(() => {
    if (!beat || beat.at === last.current) return;
    last.current = beat.at;
    setKind(beat.kind);
    const shape = BEATS[beat.kind];
    v.setValue(0);
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: shape.ms * 0.28, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: shape.ms * 0.72, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [beat, v]);
  return { v, kind };
}

/**
 * A GESTURE: in fast, then most of the way back, then hold.
 *
 * This is the difference between body language and a frozen pose. A head-cock
 * used to be a boolean — the brain put HEAD_TILT on a reply and he held nine
 * degrees of lean for the entire six-second line, which does not read as
 * curious, it reads as broken. Measuring it made it obvious: his nose sat
 * 11.7px off centre for eight consecutive frames and then snapped back.
 *
 * A real dog cocks his head, holds it for a beat, and mostly straightens while
 * keeping a trace of it. So: peak, decay to a residual, and only fall to zero
 * when the beat is over.
 */
function useGesture(active: boolean, residual = 0.22): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      Animated.timing(v, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
      return;
    }
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      Animated.delay(520),
      Animated.timing(v, { toValue: residual, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [active, residual, v]);
  return v;
}

/**
 * An ear flick: one ear, once, quickly, then back.
 *
 * It used to be a sine loop running the whole time he was awake, with the two
 * ears on different spring tensions so they never lined up — which is why they
 * flapped continuously and out of phase, like a windsock. Real ears are still
 * most of the time and then twitch at something.
 */
function useEarFlick(active: boolean): { l: Animated.Value; r: Animated.Value } {
  const l = useRef(new Animated.Value(0)).current;
  const r = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        const which = Math.random() < 0.5 ? l : r;
        Animated.sequence([
          Animated.timing(which, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(which, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]).start();
        schedule();
      }, 4200 + Math.random() * 5200);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [active, l, r]);
  return { l, r };
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
 * A small unscripted performance while nobody is asking him to do anything.
 * Breathing and blinking keep an image from freezing; this makes Barkly feel
 * as if he is deciding where to look. Eyes lead, the chin follows, one ear
 * notices, then everything settles before the next cue.
 */
function useIdlePerformance(active: boolean): { v: Animated.Value; direction: number } {
  const v = useRef(new Animated.Value(0)).current;
  const [direction, setDirection] = React.useState(1);
  useEffect(() => {
    if (!active) {
      v.stopAnimation();
      Animated.timing(v, { toValue: 0, duration: 260, useNativeDriver: true }).start();
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        setDirection(Math.random() < 0.5 ? -1 : 1);
        v.setValue(0);
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.delay(460),
          Animated.timing(v, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (finished && alive) schedule();
        });
      }, 3600 + Math.random() * 3800);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
      v.stopAnimation();
    };
  }, [active, v]);
  return { v, direction };
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

export default function BarklyRig({ state, actions, look, speaking = false, scale = 1, collarArt, beat }: RigProps) {
  const has = (a: BodyAction) => actions.includes(a);
  const idlePerformance = useIdlePerformance(
    !speaking
      && !look
      && !has('HEAD_TILT')
      && !['sleepy', 'thinking', 'listening', 'eating', 'playing'].includes(state),
  );

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
  // EYES FIRST, and quickly — this is the part that actually reads as looking.
  const eyeXBase = useSpringy(lx * LIMITS.eyeX, 170, 16);
  const eyeYBase = useSpringy(ly * LIMITS.eyeY, 170, 16);
  // Then the neck leans after them, less far and more slowly.
  const nodBase = useSpringy(ly * LIMITS.nod, 45, 14);
  // The lean he holds while looking somewhere, plus the cock he does as a beat.
  const lookLean = useSpringy(lx * LIMITS.lean, 42, 14);
  const cock = useGesture(has('HEAD_TILT'));
  const react = useBeat(beat);
  const shape = BEATS[react.kind];
  // ARRIVE sweeps the eyes across rather than holding them somewhere, which is
  // what looking around a new place actually is.
  const idleEye = Animated.multiply(idlePerformance.v, idlePerformance.direction * 2.4);
  const eyeX = Animated.add(
    Animated.add(eyeXBase, idleEye),
    react.v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, shape.eye, -shape.eye * 0.6] }),
  );
  const eyeY = Animated.add(eyeYBase, react.v.interpolate({ inputRange: [0, 1], outputRange: [0, shape.eye * 0.3] }));
  const tiltDeg = Animated.add(
    Animated.add(
      Animated.add(lookLean, cock.interpolate({ inputRange: [0, 1], outputRange: [0, LIMITS.cock] })),
      Animated.multiply(idlePerformance.v, idlePerformance.direction * 2.2),
    ),
    react.v.interpolate({ inputRange: [0, 1], outputRange: [0, shape.tilt] }),
  );
  // And his shoulders come round last. Without this the head leans off a body
  // that has not noticed, which is most of what "goofy" meant.
  const bodyTiltDeg = Animated.multiply(tiltDeg, LIMITS.bodyFollow);

  // ---------------------------------------------------------------- ears
  const perk = has('EAR_PERK') || state === 'listening' || state === 'excited';
  const droop = state === 'sleepy' || state === 'hungry';
  const earBase = droop ? -LIMITS.ear * 0.8 : 0;
  // A held pose, with one ear a touch shyer than the other so he is not
  // symmetrical — but they arrive together. Running them on different spring
  // tensions made them drift permanently out of phase, which is what made him
  // look like he had two windsocks stapled on.
  const earSettle = useSpringy(earBase, 55, 12);
  // Perking is a beat too: up sharply, then most of the way down again. Held
  // permanently, both ears standing to attention is a hood ornament.
  const perked = useGesture(perk, 0.35);
  const beatEar = react.v.interpolate({ inputRange: [0, 1], outputRange: [0, shape.ear] });
  const idleEar = idlePerformance.v.interpolate({ inputRange: [0, 1], outputRange: [0, 3.2] });
  const earLDeg = Animated.add(
    Animated.add(earSettle, perked.interpolate({ inputRange: [0, 1], outputRange: [0, LIMITS.ear] })),
    Animated.add(beatEar, idlePerformance.direction < 0 ? idleEar : 0),
  );
  const earRDeg = Animated.add(
    Animated.add(earSettle, perked.interpolate({ inputRange: [0, 1], outputRange: [0, LIMITS.ear * 0.86] })),
    Animated.add(beatEar, idlePerformance.direction > 0 ? idleEar : 0),
  );
  const flick = useEarFlick(!droop);

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
        ...hinge(
          P.head.x,
          // Shoulders, not neck: the body pivots low, around where his chest
          // meets the floor, so a follow-through leans him rather than swings
          // him.
          CANVAS.h - 40,
          0,
          0,
          CANVAS.w,
          CANVAS.h,
          bodyTiltDeg.interpolate({ inputRange: [-90, 90], outputRange: ['-90deg', '90deg'] }),
        ),
      ],
    }),
    [breathe, wag, bodyTiltDeg],
  );

  const headStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: Animated.add(
            Animated.add(
              Animated.add(nodBase, react.v.interpolate({ inputRange: [0, 1], outputRange: [0, shape.nod] })),
              idlePerformance.v.interpolate({ inputRange: [0, 1], outputRange: [0, 1.8] }),
            ),
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
    [nodBase, breathe, tiltDeg, react.v, shape.nod],
  );

  const ear = (side: 'l' | 'r', deg: Animated.Animated, lead: number) => {
    const box = side === 'l' ? L.ear_l : L.ear_r;
    const piv = side === 'l' ? P.ear_l : P.ear_r;
    const twitch = side === 'l' ? flick.l : flick.r;
    const total = Animated.add(
      deg,
      twitch.interpolate({ inputRange: [0, 1], outputRange: [0, lead] }),
    );
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
        {/* His pupils, on the three faces that keep his resting eyes. The other
            faces redraw them — a blink has no pupil to move. */}
        {NEUTRAL_EYES.has(face) && (
          <>
            <Part art={ART.pupil_l} box={L.pupil_l} style={{ transform: [{ translateX: eyeX }, { translateY: eyeY }] }} />
            <Part art={ART.pupil_r} box={L.pupil_r} style={{ transform: [{ translateX: eyeX }, { translateY: eyeY }] }} />
          </>
        )}
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

