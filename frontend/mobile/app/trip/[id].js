import { useLocalSearchParams } from 'expo-router';
import ScreenRenderer from '../../src/components/ScreenRenderer';

export default function TripRoute() {
  const params = useLocalSearchParams();
  return <ScreenRenderer screen="trip" params={params} />;
}
