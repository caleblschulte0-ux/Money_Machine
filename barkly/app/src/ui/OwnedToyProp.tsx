import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/** The toy Barkly is currently obsessed with sits in his world, not in a list. */
export default function OwnedToyProp({ toyId }: { toyId?: string }) {
  if (toyId === 'toy_ball') {
    return (
      <View style={styles.ball} pointerEvents="none">
        <Svg width={34} height={34} viewBox="0 0 34 34">
          <Circle cx={17} cy={17} r={15} fill="#E9B83F" />
          <Path d="M3 15 C12 11 22 11 31 15" stroke="#9B7420" strokeWidth={2.5} fill="none" />
          <Circle cx={11} cy={10} r={4} fill="#FFF4C8" opacity={0.48} />
        </Svg>
      </View>
    );
  }
  if (toyId === 'toy_rope') {
    return (
      <View style={styles.rope} pointerEvents="none">
        <Svg width={70} height={34} viewBox="0 0 70 34">
          <Path d="M12 17 C20 4 27 30 35 17 C43 4 50 30 58 17" stroke="#B7654F" strokeWidth={9} strokeLinecap="round" fill="none" />
          <Path d="M5 8l12 18M53 8l12 18" stroke="#E3C89D" strokeWidth={3} strokeLinecap="round" />
        </Svg>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  ball: { position: 'absolute', bottom: 28, right: '22%', zIndex: 2 },
  rope: { position: 'absolute', bottom: 26, right: '17%', zIndex: 2, transform: [{ rotate: '-8deg' }] },
});
