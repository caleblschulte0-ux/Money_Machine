import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * The app's two motion primitives, in one place.
 *
 * Both of these lived inside LivingScenes.tsx, which is where the ambient
 * world layer needed them. The moment a second surface wanted the same
 * behaviour -- the food sheet, whose rows sat dead still while the room
 * behind them breathed -- copying them would have put two reduce-motion
 * implementations in the app, and the one nobody remembered would be the one
 * that quietly ignored the setting. One copy, imported by both.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => alive && setReduceMotion(enabled))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduceMotion;
}

/**
 * A 0..1 value easing back and forth forever, or parked at a fixed 0.38 when
 * the device asks for reduced motion -- parked rather than zeroed so anything
 * interpolating from it lands mid-travel and still looks composed rather than
 * snapping to one end of its range.
 */
export function useAmbientLoop(duration: number, delay = 0, reduceMotion = false) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      value.stopAnimation();
      value.setValue(0.38);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, reduceMotion, value]);
  return value;
}
