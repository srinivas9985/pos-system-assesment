import NetInfo from '@react-native-community/netinfo';

/** Device has a network interface — local backend (localhost/LAN) still counts as online. */
export async function isNetworkConnected(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected !== false;
}

/** Strict check for real internet — not used for localhost API calls. */
export async function hasInternetReachability(): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}
