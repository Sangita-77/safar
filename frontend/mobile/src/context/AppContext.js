import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth, useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { API_URL, createApi, errMsg } from '../lib/api';

const AppContext = createContext(null);
const AUTH_TOKEN_KEY = 'safar_auth_token';

async function readStoredToken() {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('safar_local_token');
        return window.localStorage.getItem(AUTH_TOKEN_KEY);
      }
      return null;
    }
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function writeStoredToken(token) {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('safar_local_token');
        if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
        else window.localStorage.removeItem(AUTH_TOKEN_KEY);
      }
      return;
    }
    if (token) await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

function SharedAppProvider({
  children,
  getToken,
  authLoaded,
  isSignedIn,
  onRawSignOut,
  authMode = 'clerk',
  signInWithCredentials,
  registerWithCredentials,
  initialUser = null,
}) {
  const router = useRouter();
  const api = useMemo(() => createApi(getToken), [getToken]);
  const [me, setMe] = useState(initialUser);
  const [meLoading, setMeLoading] = useState(false);
  const [meError, setMeError] = useState(null);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    if (initialUser) setMe(initialUser);
  }, [initialUser]);

  const getCurrentLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Allow location access to use your current location.');
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: position.coords.latitude, lon: position.coords.longitude };
  }, []);

  const signOut = useCallback(async () => {
    setMe(null);
    setMeError(null);
    setMeLoading(false);
    await onRawSignOut?.();
    try {
      router.replace('/');
    } catch {
      // router might not be mounted yet
    }
  }, [onRawSignOut, router]);

  const refreshMe = useCallback(async () => {
    if (!isSignedIn) {
      setMe(null);
      setMeError(null);
      return null;
    }

    setMeLoading(true);
    setMeError(null);
    try {
      const { data } = await api.get('/me');
      setMe(data);
      return data;
    } catch (error) {
      if (error?.response?.status === 401) {
        await onRawSignOut?.();
        setMe(null);
        setMeError(null);
        return null;
      }
      setMeError(error);
      throw error;
    } finally {
      setMeLoading(false);
    }
  }, [api, isSignedIn, onRawSignOut]);

  const retryMe = useCallback(async () => {
    try {
      return await refreshMe();
    } catch (error) {
      setMeError(error);
      return null;
    }
  }, [refreshMe]);

  useEffect(() => {
    if (!authLoaded) return;
    if (!isSignedIn) {
      setMe(null);
      setMeError(null);
      setMeLoading(false);
      return;
    }
    refreshMe().catch((error) => setMeError(error));
  }, [authLoaded, isSignedIn, refreshMe]);

  useEffect(() => {
    if (!isSignedIn || me?.driver?.status !== 'pending') return undefined;
    const timer = setInterval(() => {
      api.get('/me').then(({ data }) => setMe(data)).catch(() => {});
    }, 6000);
    return () => clearInterval(timer);
  }, [api, isSignedIn, me?.driver?.status]);

  useEffect(() => {
    if (me?.role !== 'driver' || me?.driver?.status !== 'approved' || !me?.driver?.online) {
      setLocationError('');
      return undefined;
    }
    let active = true;
    let subscription;
    const startTracking = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (active) setLocationError('');
          return;
        }
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 25 },
          async ({ coords }) => {
            try {
              await api.post('/driver/location', { lat: coords.latitude, lon: coords.longitude });
              if (active) setLocationError('');
            } catch {
              // ignore background location post failure
            }
          },
        );
        if (!active && subscription?.remove) subscription.remove();
      } catch {
        // Desktop browsers or devices without GPS hardware may not support watchPositionAsync
        if (active) setLocationError('');
      }
    };
    startTracking();
    return () => {
      active = false;
      if (subscription?.remove) subscription.remove();
    };
  }, [api, me?.driver?.online, me?.driver?.status, me?.role]);

  const value = useMemo(
    () => ({
      api,
      me,
      meLoading,
      meError,
      authLoaded,
      isSignedIn,
      refreshMe,
      retryMe,
      signOut,
      getCurrentLocation,
      locationError,
      authMode,
      signInWithCredentials,
      registerWithCredentials,
    }),
    [
      api,
      me,
      meLoading,
      meError,
      authLoaded,
      isSignedIn,
      refreshMe,
      retryMe,
      signOut,
      getCurrentLocation,
      locationError,
      authMode,
      signInWithCredentials,
      registerWithCredentials,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function ClerkAppProvider({ children }) {
  const { getToken, isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  return (
    <SharedAppProvider
      getToken={getToken}
      authLoaded={authLoaded}
      isSignedIn={isSignedIn}
      onRawSignOut={signOut}
      authMode="clerk"
    >
      {children}
    </SharedAppProvider>
  );
}

export function CredentialsAppProvider({ children }) {
  const [token, setToken] = useState(null);
  const [cachedUser, setCachedUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    readStoredToken().then((saved) => {
      if (saved && saved.startsWith('safar.')) {
        setToken(saved);
      } else if (saved) {
        writeStoredToken(null);
      }
      setAuthLoaded(true);
    });
  }, []);

  const getToken = useCallback(async () => token, [token]);

  const parseAuthError = (data, fallback) => {
    const detail = data?.detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg).join(', ');
    return detail || fallback;
  };

  const signInWithCredentials = useCallback(async ({ email, password }) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(parseAuthError(data, 'Invalid email or password'));
    }
    await writeStoredToken(data.token);
    setCachedUser(data.user || null);
    setToken(data.token);
    return data;
  }, []);

  const registerWithCredentials = useCallback(async ({ name, email, phone, password }) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(parseAuthError(data, 'Could not create account'));
    }
    await writeStoredToken(data.token);
    setCachedUser(data.user || null);
    setToken(data.token);
    return data;
  }, []);

  const rawSignOut = useCallback(async () => {
    await writeStoredToken(null);
    setCachedUser(null);
    setToken(null);
  }, []);

  return (
    <SharedAppProvider
      getToken={getToken}
      authLoaded={authLoaded}
      isSignedIn={Boolean(token)}
      onRawSignOut={rawSignOut}
      authMode="credentials"
      signInWithCredentials={signInWithCredentials}
      registerWithCredentials={registerWithCredentials}
      initialUser={cachedUser}
    >
      {children}
    </SharedAppProvider>
  );
}

export const AppProvider = ClerkAppProvider;

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used within AppProvider');
  return value;
}
