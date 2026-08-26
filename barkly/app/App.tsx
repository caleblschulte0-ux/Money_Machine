import { StatusBar } from 'expo-status-bar';
import BarklyRoom from './src/ui/BarklyRoom';

export default function App() {
  return (
    <>
      <BarklyRoom />
      <StatusBar style="dark" />
    </>
  );
}
