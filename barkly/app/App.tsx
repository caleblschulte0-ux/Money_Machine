import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BarklyRoom from './src/ui/BarklyRoom';

export default function App() {
  return (
    <SafeAreaProvider>
      <BarklyRoom />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
