import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { errorMessage } from './api';

export function useRemote<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loader());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [loader]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  return { data, loading, error, reload };
}
