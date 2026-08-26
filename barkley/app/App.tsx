import { StatusBar } from 'expo-status-bar';
import BarkleyRoom from './src/ui/BarkleyRoom';

export default function App() {
  return (
    <>
      <BarkleyRoom />
      <StatusBar style="dark" />
    </>
  );
}
