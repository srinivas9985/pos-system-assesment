import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { isNetworkConnected } from '@/services/network';

/** True when the device cannot reach the server (no interface or API unreachable). */
export function useIsOffline() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = async () => {
      setOffline(!(await isNetworkConnected()));
    };

    void update();
    const unsubscribe = NetInfo.addEventListener(() => {
      void update();
    });
    return unsubscribe;
  }, []);

  return offline;
}
