import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export function useAppState(onForeground: () => void) {
  const callbackRef = useRef(onForeground);
  callbackRef.current = onForeground;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        callbackRef.current();
      }
    });
    return () => subscription.remove();
  }, []);
}
