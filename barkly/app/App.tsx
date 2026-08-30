import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BarklyRoom from './src/ui/BarklyRoom';

/**
 * Tiny WEB-ONLY rendering corrections.
 *
 * The shipped product is phone-first React Native, but our public playtest is
 * rendered through a browser. Two browser artifacts were making the game look
 * cheaper than the actual design:
 *
 *  1. The dev-only PLAYTEST badge consumed enough horizontal room to truncate
 *     HOME / PARK / TOWN / BEACH. Dev chrome must never damage game chrome.
 *  2. Browser defaults vary in font smoothing/tap highlighting, which adds a
 *     soft web-page feel around otherwise crisp game surfaces.
 *
 * This does not change native UI, tap targets, accessible names or production
 * navigation. It only keeps the web preview honest.
 */
function useWebPolish() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const style = document.createElement('style');
    style.setAttribute('data-barkly-web-polish', 'true');
    style.textContent = `
      html, body, #root {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: geometricPrecision;
      }

      * {
        -webkit-tap-highlight-color: transparent;
      }

      /* Dev chrome stays useful without stealing the location row. */
      [data-testid="playtest-badge"] {
        width: 48px !important;
        min-width: 48px !important;
        max-width: 48px !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }

      [data-testid="playtest-badge"] span {
        font-size: 0 !important;
        letter-spacing: 0 !important;
      }

      [data-testid="playtest-badge"] span::after {
        content: "TEST";
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.7px;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
}

export default function App() {
  useWebPolish();
  return (
    <SafeAreaProvider>
      <BarklyRoom />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
