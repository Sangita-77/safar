import { useLocalSearchParams } from 'expo-router';
import ScreenRenderer from '../src/components/ScreenRenderer';

export default function AuthRoute() {
  const params = useLocalSearchParams();
  return <ScreenRenderer screen="auth" params={params} />;
}
