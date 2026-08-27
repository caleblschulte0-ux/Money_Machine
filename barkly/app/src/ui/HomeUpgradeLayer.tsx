import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

/**
 * Store home upgrades are cumulative possessions, not a single skin slot.
 * Buying them should immediately change the room the player spends time in.
 */
export default function HomeUpgradeLayer({ owned }: { owned: string[] }) {
  const bed = owned.includes('home_bed');
  const rug = owned.includes('home_rug');
  const window = owned.includes('home_window');
  if (!bed && !rug && !window) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {window && (
        <View style={styles.bigWindow}>
          <Svg width="100%" height="100%" viewBox="0 0 170 132">
            <Rect x={2} y={2} width={166} height={128} rx={10} fill="#EEE0C3" stroke="#C5AB78" strokeWidth={5} />
            <Rect x={12} y={12} width={146} height={102} rx={5} fill="#BFDDE7" />
            <Ellipse cx={48} cy={47} rx={28} ry={10} fill="#FFFFFF" opacity={0.72} />
            <Ellipse cx={123} cy={73} rx={22} ry={8} fill="#FFFFFF" opacity={0.58} />
            <Path d="M85 12v102M12 63h146" stroke="#EEE0C3" strokeWidth={6} />
            <Rect x={3} y={114} width={164} height={14} rx={5} fill="#D3BA87" />
            <Circle cx={142} cy={31} r={5} fill="#F3CE64" opacity={0.8} />
          </Svg>
          <View style={styles.windowBadge} />
        </View>
      )}

      {rug && (
        <View style={styles.rug}>
          <Svg width="100%" height="100%" viewBox="0 0 300 108">
            <Ellipse cx={150} cy={54} rx={145} ry={49} fill="#B7644E" opacity={0.96} />
            <Ellipse cx={150} cy={54} rx={125} ry={37} fill="#D28A69" opacity={0.96} />
            <Path d="M54 54h192M74 35h152M74 73h152" stroke="#F0C7A8" strokeWidth={4} opacity={0.5} />
            <Path d="M112 18l38 72 38-72" stroke="#9A4E3D" strokeWidth={4} fill="none" opacity={0.55} />
          </Svg>
        </View>
      )}

      {bed && (
        <View style={styles.bed}>
          <Svg width="100%" height="100%" viewBox="0 0 150 82">
            <Ellipse cx={75} cy={52} rx={70} ry={27} fill="#6E5133" />
            <Ellipse cx={75} cy={45} rx={61} ry={23} fill="#9A744D" />
            <Ellipse cx={75} cy={44} rx={49} ry={17} fill="#E8D8B5" />
            <Path d="M28 48q47 22 94 0" stroke="#D0BA8B" strokeWidth={3} fill="none" />
            <Circle cx={119} cy={27} r={8} fill="#C6952F" />
            <Path d="M115 27h8M119 23v8" stroke="#6A501C" strokeWidth={1.5} />
          </Svg>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bigWindow: {
    position: 'absolute',
    top: '15%',
    left: '4%',
    width: 170,
    height: 132,
    shadowColor: '#6D5737',
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 5 },
  },
  windowBadge: {
    position: 'absolute',
    right: 12,
    bottom: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C6952F',
  },
  rug: {
    position: 'absolute',
    bottom: '7%',
    alignSelf: 'center',
    width: 300,
    height: 108,
    opacity: 0.88,
  },
  bed: {
    position: 'absolute',
    right: 12,
    bottom: '17%',
    width: 150,
    height: 82,
  },
});
