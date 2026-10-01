import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { errorMessage } from './api';

export function useRemote<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const requestId = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const result = await loader();
      if (requestId === sequence.current) setData(result);
    } catch (err) {
      if (requestId === sequence.current) setError(errorMessage(err));
    } finally {
      if (requestId === sequence.current) setLoading(false);
    }
  }, [loader]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        sequence.current++;
      };
    }, [reload]),
  );
  return { data, loading, error, reload };
}
