import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveBackendUrl() {
  const raw = (process.env.EXPO_PUBLIC_BACKEND_URL || '').trim().replace(/\/+$/, '');
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost || '';
  const lanHost = hostUri ? hostUri.split(':')[0] : '';

  if (Platform.OS !== 'web' && lanHost && lanHost !== 'localhost' && lanHost !== '127.0.0.1') {
    if (!raw || raw.includes('localhost') || raw.includes('127.0.0.1')) {
      return `http://${lanHost}:7200`;
    }
  }

  if (raw) return raw;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:7200`;
  }

  return 'http://localhost:7200';
}

export const BACKEND_URL = resolveBackendUrl();
export const API_URL = `${BACKEND_URL}/api`;

export function createApi(getToken) {
  const api = axios.create({ baseURL: API_URL, timeout: 15000 });
  api.interceptors.request.use(async (config) => {
    const token = typeof getToken === 'function' ? await getToken() : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (!config.method || config.method.toLowerCase() === 'get') {
      config.params = { ...(config.params || {}), _t: Date.now() };
    }
    return config;
  });
  return api;
}

export function errMsg(error) {
  if (!error?.response) {
    if (!error?.isAxiosError && error?.message) return error.message;
    return "You're offline or the server is unreachable. Please retry.";
  }
  const detail = error.response.data?.detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(', ');
  return detail || 'Something went wrong';
}

export const inr = (amount) =>
  `₹${Math.round(Number(amount || 0)).toLocaleString('en-IN')}`;

export const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
    : '';

export const SERVICES = [
  { id: 'car', title: 'Cab', sub: 'Mini, Sedan, SUV', image: require('../../assets/images/car.jpg') },
  { id: 'bike', title: 'Bike', sub: 'Beat the traffic', image: require('../../assets/images/bike.jpg') },
  { id: 'erickshaw', title: 'E-Rickshaw', sub: 'Green & cheap', image: require('../../assets/images/erickshaw.jpg') },
  { id: 'parcel', title: 'Parcel', sub: 'Send anything', image: require('../../assets/images/parcel.jpg') },
  { id: 'rental', title: 'Rentals', sub: 'By the hour', image: require('../../assets/images/rental.jpg') },
];

export const VEHICLE_IMAGES = {
  car: require('../../assets/images/car.jpg'),
  bike: require('../../assets/images/bike.jpg'),
  erickshaw: require('../../assets/images/erickshaw.jpg'),
  van: require('../../assets/images/parcel.jpg'),
};

export const STATUS = {
  searching: { label: 'Finding your driver', color: '#A16207', background: '#FEF3C7' },
  accepted: { label: 'Driver on the way', color: '#075985', background: '#E0F2FE' },
  arrived: { label: 'Driver has arrived', color: '#3730A3', background: '#E0E7FF' },
  ongoing: { label: 'On trip', color: '#166534', background: '#DCFCE7' },
  completed: { label: 'Completed', color: '#44403C', background: '#E7E5E4' },
  cancelled: { label: 'Cancelled', color: '#991B1B', background: '#FEE2E2' },
};
