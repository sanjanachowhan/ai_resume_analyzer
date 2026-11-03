import { useEffect, useState } from 'react';
import api from '../services/api.js';

export function useHealth() {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/health')
      .then((res) => !cancelled && setState({ loading: false, data: res.data, error: null }))
      .catch((err) => {
        // A 503 still carries a useful body (database: disconnected).
        const data = err.response?.data ?? null;
        if (!cancelled) setState({ loading: false, data, error: err.userMessage });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
