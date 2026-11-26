import { useApp } from '../src/context/AppContext';
import { ErrorScreen, LoadingScreen } from '../src/components/ScreenRenderer';
import ScreenRenderer from '../src/components/ScreenRenderer';

export default function HomeRoute() {
  const { authLoaded, isSignedIn, me, meLoading, meError, retryMe } = useApp();
  if (!authLoaded) return <LoadingScreen message="Checking your session…" />;
  if (!isSignedIn) return <ScreenRenderer screen="landing" />;
  if (meLoading || !me && !meError) return <LoadingScreen />;
  if (meError || !me) return <ErrorScreen message={meError?.message || 'Account data is unavailable.'} onRetry={retryMe} />;
  const screen = me.role === 'admin' ? 'admin-overview' : me.role === 'driver' ? 'driver-home' : 'customer-home';
  return <ScreenRenderer screen={screen} />;
}
