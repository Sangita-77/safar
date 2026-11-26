import { useLocalSearchParams } from 'expo-router';
import ScreenRenderer from '../../src/components/ScreenRenderer';

export default function BookingRoute() {
  const params = useLocalSearchParams();
  return <ScreenRenderer screen="booking" params={params} />;
}
