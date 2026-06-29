import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Resolve the machine running Metro/backend — localhost fails on simulators and physical devices. */
function resolveDevHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.manifest2 as { extra?: { expoClient?: { hostUri?: string } } } | null)?.extra
      ?.expoClient?.hostUri;

  if (typeof hostUri === 'string' && hostUri.length > 0) {
    return hostUri.split(':')[0];
  }

  // Android emulator special alias for host machine
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }

  return 'localhost';
}

const DEV_HOST = resolveDevHost();

export const API_URL = `http://${DEV_HOST}:8080`;
export const WS_URL = `ws://${DEV_HOST}:8080`;
export const POLL_INTERVAL_MS = 5000;
export const PAGE_SIZE = 50;
