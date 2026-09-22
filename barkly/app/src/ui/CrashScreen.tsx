/**
 * THE LAST LINE OF DEFENCE: a render error must never become a white screen.
 *
 * Found during the App Store pass (2026-09-22): the app had no error boundary
 * anywhere. React unmounts the entire tree when a component throws during
 * render, so any bug in any sheet, scene or prop -- a malformed save, an
 * unexpected undefined -- left a child staring at a blank screen with no way
 * back except force-quitting, and App Review files that as a crash.
 *
 * Three things this deliberately does and does not do:
 *
 *   - It NEVER touches storage. A crash is a bug in code, not in his memory,
 *     and wiping a child's dog to "recover" would turn one bad render into
 *     the loss of everything they built. "Try again" remounts; the save is
 *     read fresh exactly as on launch.
 *   - It reports nowhere. There is no crash reporter in this app on purpose
 *     (docs/PRIVACY.md §1), so the error goes to the device log and no
 *     further.
 *   - It stays in the product's voice without pretending the dog is fine:
 *     the words say something went wrong and offer the one thing that helps.
 *
 * Rendering is kept dependency-light -- plain View/Text/Image and theme
 * tokens -- because whatever broke the app may be something the richer UI
 * depends on.
 */
import { Component, ErrorInfo, ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from './theme';

const FRONT = require('../../assets/barkly/outlined/front.png');

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
  /** Bumped on every retry so the children remount from scratch. */
  attempt: number;
}

export class CrashBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Device log only. See the header: there is no reporter, by design.
    console.error('Barkly render error', error, info.componentStack);
  }

  retry = () => {
    this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));
  };

  render() {
    if (this.state.failed) return <CrashScreen onRetry={this.retry} />;
    return <View key={this.state.attempt} style={styles.fill}>{this.props.children}</View>;
  }
}

export function CrashScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.screen} testID="crash-screen">
      <Image source={FRONT} style={styles.dog} resizeMode="contain" accessibilityIgnoresInvertColors />
      <Text style={styles.title} accessibilityRole="header">Something went wrong.</Text>
      <Text style={styles.body}>
        Barkly is fine and everything he remembers is still saved. The screen just tripped over
        itself.
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        testID="crash-retry"
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
    backgroundColor: color.paper,
  },
  dog: { width: 160, height: 200, marginBottom: space.xl },
  title: { ...type.title, color: color.ink, textAlign: 'center', marginBottom: space.sm },
  body: { ...type.body, color: color.ink, textAlign: 'center', marginBottom: space.xl },
  button: {
    minHeight: 48,
    minWidth: 180,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.brand,
  },
  pressed: { opacity: 0.85 },
  buttonText: { ...type.strong, color: color.inkOn },
});
