import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('connected');
  const [lastSync, setLastSync] = useState<Date>(new Date());

  useEffect(() => {
    const checkConnection = async () => {
      try {
        setStatus('reconnecting');
        const { error } = await supabase.from('client_health_scores').select('id').limit(1);
        
        if (error) {
          setStatus('disconnected');
        } else {
          setStatus('connected');
          setLastSync(new Date());
        }
      } catch (err) {
        setStatus('disconnected');
      }
    };

    // Check immediately
    checkConnection();

    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  return { status, lastSync };
}
